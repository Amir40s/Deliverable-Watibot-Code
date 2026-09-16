import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/messages
 *
 * Send a WhatsApp message to a contact using the Project API Key.
 * Mirrors AiSensy's Send Message endpoint.
 *
 * Headers:
 * X-WatiBot-Project-API-Key: <your_project_api_key>
 * Content-Type: application/json
 *
 * Body:
 * {
 * "messaging_product": "whatsapp",
 * "recipient_type": "individual",
 * "to": "+919876543210", // E.164 phone number
 * "type": "text" | "template" | "image" | "document" | "audio" | "video",
 *
 * // For type=text:
 * "text": { "body": "Hello!" },
 *
 * // For type=template:
 * "template": {
 * "name": "order_confirmation",
 * "language": { "code": "en" },
 * "components": [...]
 * },
 *
 * // For type=image / document / audio / video:
 * "image": { "link": "https://..." },
 * "document": { "link": "https://...", "caption": "file.pdf" },
 * "audio": { "link": "https://..." },
 * "video": { "link": "https://...", "caption": "..." }
 * }
 */
export async function POST(req: NextRequest) {
 const auth = await authenticateProjectKey(req);
 if (auth.error) return auth.error;
 const { org } = auth;

 if (!org.metaAccessToken || !org.whatsappPhoneNumberId) {
 return apiError(503, "WhatsApp is not connected for this account.");
 }

 let body: any;
 try {
 body = await req.json();
 } catch {
 return apiError(400, "Invalid JSON body.");
 }

 const { to, type = "text", text, template, image, document: doc, audio, video } = body;

 if (!to) return apiError(400, "Field'to' (phone number) is required.");
 if (!type) return apiError(400, "Field'type' is required.");

 // Normalize phone
 let phone = String(to).trim().replace(/\s+/g, "");
 if (!phone.startsWith("+")) phone = "+91" + phone;
 const waId = phone.replace("+", "");

 // Find or create contact
 let contact = await prisma.contact.findFirst({
 where: { waId, organizationId: org.id },
 });
 if (!contact) {
 contact = await prisma.contact.create({
 data: {
 waId,
 name: waId,
 organizationId: org.id,
 },
 });
 }

 // Build Meta payload
 const metaUrl =`https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;
 let payload: any = {
 messaging_product: "whatsapp",
 recipient_type: body.recipient_type ?? "individual",
 to: waId,
 type,
 };

 if (type === "text") {
 if (!text?.body) return apiError(400, "text.body is required for type=text.");
 payload.text = { body: text.body };
 } else if (type === "template") {
 if (!template?.name) return apiError(400, "template.name is required for type=template.");
 payload.template = {
 name: template.name,
 language: template.language ?? { code: "en" },
 ...(template.components?.length ? { components: template.components } : {}),
 };
 } else if (["image", "document", "audio", "video", "voice"].includes(type)) {
  const isVoiceRequest = type === "voice" || (type === "audio" && (body.voice === true || audio?.voice === true || audio?.isVoice === true || body.isVoice === true));
  const effectiveType = type === "voice" ? "audio" : type;
  const media = image ?? doc ?? audio ?? video ?? body.voice;
  if (!media?.link) return apiError(400, `${type}.link is required.`);
  
  let uploadedMediaId: string | null = null;
  if (isVoiceRequest && media.link) {
    try {
      let audioBuffer: Buffer | null = null;
      const cleanLink = media.link.split('?')[0];
      if (cleanLink.includes('/api/media/files/')) {
        const relPart = cleanLink.split('/api/media/files/')[1];
        if (relPart) {
          const decodedRel = decodeURIComponent(relPart);
          const cleanParts = decodedRel.replace(/^(\/|\\)+/, '').split(/[\/\\]+/);
          const { getLocalStorageRoot } = await import('@/lib/storage/providers/local-provider');
          const fs = await import('fs');
          const path = await import('path');
          const fullPath = path.resolve(getLocalStorageRoot(), ...cleanParts);
          if (fs.existsSync(fullPath)) {
            audioBuffer = fs.readFileSync(fullPath);
          }
        }
      }
      if (!audioBuffer && (media.link.startsWith('http://') || media.link.startsWith('https://'))) {
        const fetchRes = await fetch(media.link);
        if (fetchRes.ok) {
          audioBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }
      }
      if (audioBuffer) {
        const { transcodeToWhatsAppOggOpus, isOggOpusBuffer } = await import('@/lib/chat/audio-transcoder');
        try { audioBuffer = await transcodeToWhatsAppOggOpus(audioBuffer); } catch (_) {}

        const isOgg = isOggOpusBuffer(audioBuffer);
        const mimeType = isOgg ? 'audio/ogg' : 'audio/mp4';
        const filename = isOgg ? 'voice.ogg' : 'voice.m4a';

        const uploadFormData = new FormData();
        const uploadBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
        uploadFormData.append('file', uploadBlob, filename);
        uploadFormData.append('type', mimeType);
        uploadFormData.append('messaging_product', 'whatsapp');

        const uploadUrl = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/media`;
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${org.metaAccessToken}` },
          body: uploadFormData
        });
        if (uploadRes.ok) {
          const upData = await uploadRes.json();
          if (upData?.id) uploadedMediaId = upData.id;
        }
      }
    } catch (e) {
      console.warn('[Messages API] Voice media upload fallback:', e);
    }
  }

  payload.type = effectiveType;
  if (uploadedMediaId && effectiveType === "audio") {
    payload.audio = {
      id: uploadedMediaId,
      voice: true
    };
  } else {
    const isOggLink = media.link?.endsWith('.ogg') || media.link?.includes('ac_opus');
    payload[effectiveType] = {
      link: media.link,
      ...(media.caption ? { caption: media.caption } : {}),
      ...(effectiveType === "document" && media.filename ? { filename: media.filename } : {}),
      ...(effectiveType === "audio" && isVoiceRequest && isOggLink ? { voice: true } : {}),
    };
  }
 } else {
  return apiError(400, `Unsupported message type: ${type}`);
 }

 // Send via Meta API
 const metaRes = await fetch(metaUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${org.metaAccessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
 });

 const metaData = await metaRes.json();
 if (metaData.error) {
  return apiError(422, `WhatsApp API error: ${metaData.error.message}`);
 }

 const isVoice = payload.type === "audio" && (payload.audio?.voice === true || type === "voice");
 const effectiveSavedType = payload.type || type;
 const wamid = metaData.messages?.[0]?.id ?? null;
 const content = type === "text" 
   ? text.body 
   : type === "template" 
     ? `Template: ${template.name}` 
     : isVoice 
       ? "[Voice Message]" 
       : `[${effectiveSavedType}]`;

 const lastMsgSnippet = isVoice ? "🎤 Voice message" : content;

 // Log message
 const newMessage = await prisma.message.create({
  data: {
    contactId: contact.id,
    wamid,
    type: isVoice ? "audio" : effectiveSavedType,
    direction: "outbound",
    status: "sent",
    content,
    mediaUrl: type !== "text" && type !== "template" ? (image ?? doc ?? audio ?? video ?? body.voice)?.link : null,
    rawBody: {
      ...payload,
      ...(isVoice ? { voice: true, isVoice: true } : {})
    } as any,
  },
 });

 await prisma.contact.update({
  where: { id: contact.id },
  data: { lastMessage: lastMsgSnippet, lastMessageAt: new Date() },
 });

 return NextResponse.json({
 messaging_product: "whatsapp",
 contacts: [{ input: to, wa_id: waId }],
 messages: [{ id: wamid }],
 _meta: { messageId: newMessage.id, contactId: contact.id },
 });
}
