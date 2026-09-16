import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMessageDelay, createBatchTracker, isRetryableError, getBackoffDelay, logThrottleEvent, sleep } from "@/lib/campaign-throttle";

/**
 * POST /api/campaign/send
 *
 * Authenticated API endpoint powered by the Campaign API Key from the Developer Hub.
 * Compatible with AiSensy-style payloads:
 *
 * {
 * "apiKey": string, // Required. Campaign API Key from Developer Hub.
 * "campaignName": string, // Required. WhatsApp template name (must be approved).
 * "destination": string | string[], // Required. Single, comma-separated, or array of phone numbers.
 * "userName": string | string[], // Optional for bulk. Display name(s) for recipient(s).
 * "source": string, // Optional. Lead source (e.g. "Website", "CRM").
 * "media": { // Optional. Media to attach (for template header).
 * "url": string,
 * "filename": string
 * },
 * "templateParams": string[],// Optional. Dynamic values for {{1}}, {{2}}, etc.
 * "tags": string[], // Optional. Tags to assign to the contact.
 * "attributes": { // Optional. Attributes to set on the contact.
 * "key": "value"
 * }
 * }
 */
export async function POST(req: NextRequest) {
 try {
 const body = await req.json();

 // ── 1. Validate required fields ──────────────────────────────────
 const { apiKey, campaignName, destination, userName, source, media, templateParams, tags, attributes } = body;

 if (!apiKey || typeof apiKey !== "string") {
 return error(400, "apiKey is required.");
 }
 if (!campaignName || typeof campaignName !== "string") {
 return error(400, "campaignName (template name) is required.");
 }
 if (!destination) {
 return error(400, "destination is required.");
 }
 if (
 userName !== undefined &&
 typeof userName !== "string" &&
 !Array.isArray(userName)
 ) {
 return error(400, "userName must be a string or string array.");
 }

 // ── 2. Authenticate — find org by campaignApiKey ──────────────────
 // Keys are stored as JSON inside businessDescription
 const organizations = await prisma.organization.findMany({
 select: {
 id: true,
 businessDescription: true,
 metaAccessToken: true,
 whatsappPhoneNumberId: true,
 whatsappBusinessId: true,
 },
 });

 const org = organizations.find((o) => {
 try {
 const data = JSON.parse(o.businessDescription || "{}");
 return data.campaignApiKey === apiKey;
 } catch {
 return false;
 }
 });

 if (!org) {
 return error(401, "Invalid API key.");
 }

 if (!org.metaAccessToken || !org.whatsappPhoneNumberId) {
 return error(503, "WhatsApp is not connected for this account.");
 }

 const destinationList = normalizeDestinations(destination);
 if (destinationList.length === 0) {
 return error(400, "destination must contain at least one phone number.");
 }

 // ── 3. Build WhatsApp template components ─────────────────────────
 const components: any[] = [];

 // Body params: {{1}}, {{2}}, ...
 if (Array.isArray(templateParams) && templateParams.length > 0) {
 components.push({
 type: "body",
 parameters: templateParams.map((p: string) => ({
 type: "text",
 text: String(p),
 })),
 });
 }

 // Header media (image / document)
 if (media?.url) {
 const ext = (media.url as string).split("?")[0].split(".").pop()?.toLowerCase();
 const isDoc = ["pdf", "doc", "docx", "xlsx", "xls", "csv", "pptx"].includes(ext ?? "");
 const isVideo = ["mp4", "3gp"].includes(ext ?? "");

 if (isDoc) {
 components.unshift({
 type: "header",
 parameters: [{ type: "document", document: { link: media.url, filename: media.filename ?? "document" } }],
 });
 } else if (isVideo) {
 components.unshift({
 type: "header",
 parameters: [{ type: "video", video: { link: media.url } }],
 });
 } else {
 components.unshift({
 type: "header",
 parameters: [{ type: "image", image: { link: media.url } }],
 });
 }
 }

 // ── 4. Send template via Meta API ─────────────────────────────────
 const metaUrl =`https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

 const templateObj: any = {
 name: campaignName,
 language: { code: "en" },
 };
 if (components.length > 0) {
 templateObj.components = components;
 }

 const existingTags = Array.isArray(tags) && tags.length > 0
 ? await prisma.tag.findMany({
 where: { name: { in: tags }, organizationId: org.id },
 })
 : [];

 const userNames = Array.isArray(userName)
 ? userName
 : destinationList.map(() => (typeof userName === "string" ? userName : "Unknown"));

 const results: Array<{
 destination: string;
 waId: string;
 success: boolean;
 messageId?: string | null;
 contactId?: string;
 error?: string;
 }> = [];

 const batchTracker = createBatchTracker();
 const TAG = 'CampaignAPI';

 for (let i = 0; i < destinationList.length; i++) {
  // Meta-compliant throttled delay between messages
  if (i > 0) {
    await sleep(getMessageDelay());

    // Check if we need a batch break (every 75–100 messages)
    const batchBreakMs = batchTracker.check();
    if (batchBreakMs > 0) {
      logThrottleEvent(TAG, 'BATCH_BREAK', {
        batchNumber: batchTracker.getBatchNumber(),
        messagesSent: i,
        breakDurationMs: batchBreakMs,
      });
      await sleep(batchBreakMs);
    }
  }

  // Log progress every 50 messages
  if (i > 0 && i % 50 === 0) {
    logThrottleEvent(TAG, 'CAMPAIGN_PROGRESS', {
      sent: results.filter(r => r.success).length,
      total: destinationList.length,
      failed: results.filter(r => !r.success).length,
      batchNumber: batchTracker.getBatchNumber(),
    });
  }

  const phone = normalizePhone(destinationList[i]);
 const waId = phone.replace("+", "");
 const currentUserName = userNames[i] || userNames[0] || "Unknown";
 try {
 // Find or create contact
 let contact = await prisma.contact.findFirst({
 where: { waId, organizationId: org.id },
 });

 if (!contact) {
 contact = await prisma.contact.create({
 data: {
 waId,
 name: currentUserName,
 organizationId: org.id,
 },
 });
 } else if (currentUserName && contact.name !== currentUserName) {
 contact = await prisma.contact.update({
 where: { id: contact.id },
 data: { name: currentUserName },
 });
 }

 // Apply tags
 if (existingTags.length > 0) {
 await prisma.contact.update({
 where: { id: contact.id },
 data: {
 tags: {
 connect: existingTags.map((t) => ({ id: t.id })),
 },
 },
 });
 }

 // Apply attributes
 if (attributes && typeof attributes === "object") {
 const currentAttributes = (contact.customAttributes as Record<string, any>) || {};
 await prisma.contact.update({
 where: { id: contact.id },
 data: {
 customAttributes: {
 ...currentAttributes,
 ...attributes,
 },
 },
 });
 }

 const payload = {
 messaging_product: "whatsapp",
 to: waId,
 type: "template",
 template: templateObj,
 };

 // Retry-wrapped Meta API call with exponential backoff
 let metaData: any = null;
 const MAX_RETRIES = 3;
 for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
   const metaRes = await fetch(metaUrl, {
     method: "POST",
     headers: {
       Authorization:`Bearer ${org.metaAccessToken}`,
       "Content-Type": "application/json",
     },
     body: JSON.stringify(payload),
   });

   metaData = await metaRes.json();

   if (metaData.error) {
     const errorMsg = metaData.error.message || "WhatsApp API error";
     if (isRetryableError(new Error(errorMsg)) && attempt < MAX_RETRIES) {
       const backoffMs = getBackoffDelay(attempt);
       logThrottleEvent(TAG, 'RATE_LIMITED', {
         messageId: waId,
         attempt: attempt + 1,
         maxRetries: MAX_RETRIES,
         backoffMs,
         error: errorMsg,
       });
       await sleep(backoffMs);
       continue;
     }
     throw new Error(errorMsg);
   }
   break; // Success
 }

 const wamid = metaData?.messages?.[0]?.id ?? null;

 await prisma.message.create({
 data: {
 contactId: contact.id,
 wamid,
 type: "template",
 direction: "outbound",
 status: "sent",
 content:`Campaign: ${campaignName}`,
 rawBody: payload as any,
 },
 });

 await prisma.contact.update({
 where: { id: contact.id },
 data: {
 lastMessage:`Campaign: ${campaignName}`,
 lastMessageAt: new Date(),
 },
 });

 results.push({
 destination: phone,
 waId,
 success: true,
 messageId: wamid,
 contactId: contact.id,
 });
 } catch (recipientError: any) {
 console.error("[CampaignAPI] Recipient send failed:", { destination: phone, error: recipientError?.message });
 results.push({
 destination: phone,
 waId,
 success: false,
 error: recipientError?.message || "Failed to send to recipient",
 });
 }
 }

 const successCount = results.filter((r) => r.success).length;
 const failedCount = results.length - successCount;

 if (results.length === 1) {
 const single = results[0];
 if (!single.success) {
 return error(422,`WhatsApp API error: ${single.error}`);
 }
 return NextResponse.json(
 {
 status: 200,
 message: "Campaign message sent successfully.",
 messageId: single.messageId ?? null,
 contactId: single.contactId,
 },
 { status: 200 }
 );
 }

 return NextResponse.json(
 {
 status: failedCount > 0 ? 207 : 200,
 message:
 failedCount > 0
 ? `Campaign processed with partial success. ${successCount} sent, ${failedCount} failed.`
 : `Campaign messages sent successfully to ${successCount} recipients.`,
 summary: {
 total: results.length,
 sent: successCount,
 failed: failedCount,
 },
 results,
 },
 { status: failedCount > 0 ? 207 : 200 }
 );
 } catch (err: any) {
 console.error("[CampaignAPI] Unhandled error:", err);
 return error(500, err?.message ?? "Internal server error.");
 }
}

// Also allow GET for endpoint verification (curl -X GET)
export async function GET() {
 return NextResponse.json({
 status: 200,
 endpoint: "POST /api/campaign/send",
 version: "v1",
 docs: "Pass apiKey, campaignName, destination (string, array, or comma-separated), and userName in the request body.",
 });
}

function error(status: number, message: string) {
 return NextResponse.json({ status, error: message }, { status });
}

function normalizeDestinations(destination: unknown): string[] {
 if (Array.isArray(destination)) {
 return destination
 .map((d) => String(d).trim())
 .filter(Boolean);
 }
 if (typeof destination === "string") {
 return destination
 .split(",")
 .map((d) => d.trim())
 .filter(Boolean);
 }
 return [];
}

function normalizePhone(raw: string): string {
 let phone = raw.trim().replace(/\s+/g, "");
 if (!phone.startsWith("+")) {
 phone = `+91${phone}`;
 }
 return phone;
}
