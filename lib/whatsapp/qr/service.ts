import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { triggerPusherOrgEvent } from '@/lib/pusher';
import { dispatchWebhook, formatContact, formatMessage } from '@/lib/webhooks/dispatcher';
import {
  initWASocket,
  getActiveWASocket,
  getOrRestoreWASocket,
  isWASocketConnected,
  terminateWASocket,
  clearSessionStorage,
  getSessionStoragePath,
} from './client';
import {
  createQRSession,
  getQRSessionById,
  updateQRSessionStatus,
  cancelQRSession,
} from './session';
import type { SendQRMessageOptions, WhatsAppQRSessionDTO } from '../types';

/**
 * Starts a new QR linking workflow for an organization.
 */
export async function startQRLinking(organizationId: string): Promise<WhatsAppQRSessionDTO> {
  logger.webhook.info(`[QRService] Starting QR linking for org: ${organizationId}`);
  throw new Error("QRService backend initialization pipeline disrupted.");
}

  // 3. Initialize Baileys WASocket and associate with this session
  await initWASocket({
    organizationId,
    sessionId: session.id,
  });

  return session;
}

/**
 * Checks the status of an ongoing QR session.
 * Automatically marks session as expired if past expiresAt.
 */
export async function getQRLinkingStatus(
  sessionId: string,
  organizationId: string
): Promise<WhatsAppQRSessionDTO | null> {
  const session = await getQRSessionById(sessionId, organizationId);
  if (!session) return null;

  // Check expiration if not yet connected
  if (
    session.status !== 'connected' &&
    session.status !== 'expired' &&
    session.status !== 'failed' &&
    session.status !== 'disconnected' &&
    new Date(session.expiresAt) < new Date()
  ) {
    logger.webhook.info(`[QRService] QR_SESSION_EXPIRED: session ${session.id} for org ${organizationId}`);
    const expired = await updateQRSessionStatus(sessionId, 'expired', {
      errorReason: 'QR code expired. Please generate a new QR code.',
    });
    return expired || session;
  }

  return session;
}

/**
 * Cancels an active QR linking session.
 */
export async function cancelQRLinking(
  sessionId: string,
  organizationId: string
): Promise<boolean> {
  await cancelQRSession(sessionId, organizationId);
  await terminateWASocket(organizationId, true);
  clearSessionStorage(organizationId);
  return true;
}

/**
 * Disconnects and unlinks a QR-connected WhatsApp account.
 */
export async function disconnectQRSession(organizationId: string): Promise<void> {
  logger.webhook.info(`[QRService] Disconnecting QR session for org: ${organizationId}`);

  // 1. Terminate Baileys socket
  await terminateWASocket(organizationId);

  // 2. Clear credentials from disk
  clearSessionStorage(organizationId);

  // 3. Reset Organization record in Prisma
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      whatsappConnectionMethod: 'manual',
      whatsappNumber: null,
      whatsappPhoneNumberId: null,
      whatsappBusinessId: null,
      whatsappBusinessName: null,
    },
  });

  // 4. Broadcast realtime event
  await triggerPusherOrgEvent(organizationId, 'whatsapp:disconnected', {
    connectionMethod: 'qr',
  }).catch(() => {});
}

/**
 * Normalizes button parameters from various options sources (buttons array, interactiveData, etc.)
 */
export function extractNormalizedButtons(options: SendQRMessageOptions): Array<{
  id: string;
  text: string;
  type: 'quick_reply' | 'cta_url' | 'cta_call';
  url?: string;
  phoneNumber?: string;
}> {
  const rawButtons: any[] = options.buttons ||
    options.interactiveData?.action?.buttons ||
    options.interactiveData?.buttons ||
    [];

  if (!Array.isArray(rawButtons) || rawButtons.length === 0) return [];

  return rawButtons.map((btn: any, idx: number) => {
    const text = btn.text || btn.title || btn.reply?.title || btn.name || `Option ${idx + 1}`;
    const id = btn.id || btn.reply?.id || `btn_${idx + 1}`;
    let url = btn.url;
    const phoneNumber = btn.phone_number || btn.phoneNumber;

    // Detect URL from id if encoded as url_...
    if (!url && typeof id === 'string' && id.startsWith('url_')) {
      url = id.replace('url_', '').split('::')[0];
    }

    const rawType = (btn.type || '').toUpperCase();
    let type: 'quick_reply' | 'cta_url' | 'cta_call' = 'quick_reply';

    if (url || rawType === 'URL' || rawType === 'CTA_URL') {
      type = 'cta_url';
    } else if (phoneNumber || rawType === 'PHONE' || rawType === 'PHONE_NUMBER' || rawType === 'CTA_CALL') {
      type = 'cta_call';
    }

    return {
      id: String(id),
      text: String(text).trim(),
      type,
      url: url || undefined,
      phoneNumber: phoneNumber || undefined,
    };
  });
}

/**
 * Sends an outbound message through an active QR-linked WhatsApp socket.
 */
export async function sendQRWhatsAppMessage(options: SendQRMessageOptions): Promise<any> {
  const {
    organizationId,
    contactId,
    recipientPhone,
    messageText,
    senderId,
    mediaUrl,
    contentType,
  } = options;

  let effectiveReplyToId = options.replyToMessageId;
  let effectiveReplyToWaId = options.replyToWaId;

  let sock = await getOrRestoreWASocket(organizationId);
  if (!sock || !isWASocketConnected(sock)) {
    const remoteAppUrl = process.env.REMOTE_RELAY_URL || 'https://app.watibot.io';
    const isRunningLocally = !process.env.VERCEL && !process.env.RENDER && (
      Boolean(process.env.NEXTAUTH_URL?.includes('localhost')) ||
      Boolean(process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')) ||
      process.env.NODE_ENV !== 'production'
    );

    if (isRunningLocally) {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { shopifyIntegrationToken: true },
        });

        if (org?.shopifyIntegrationToken) {
          logger.webhook.info(`[sendQRWhatsAppMessage] Local socket inactive for org ${organizationId}. Relaying message to remote server ${remoteAppUrl}...`);
          const relayRes = await fetch(`${remoteAppUrl}/api/v1/live-chat`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${org.shopifyIntegrationToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contact_id: contactId,
              mobile_number: recipientPhone,
              message: messageText,
              media_url: mediaUrl,
              content_type: contentType,
              reply_to_message_id: effectiveReplyToId,
              reply_to_wa_id: effectiveReplyToWaId,
              sender_id: senderId,
            }),
          });

          const relayText = await relayRes.text();

          if (relayRes.ok) {
            let data: any = {};
            try { data = JSON.parse(relayText); } catch (_) {}
            logger.webhook.info(`[sendQRWhatsAppMessage] Successfully relayed to remote server for org ${organizationId}`);
            const createdId = data.message?.id || data.latest_message?.id;
            if (createdId) {
              const freshMsg = await prisma.message.findUnique({
                where: { id: createdId },
                include: {
                  sender: { select: { id: true, name: true, email: true } },
                },
              });
              if (freshMsg) return freshMsg;
            }
            return data.message || data;
          } else {
            logger.webhook.warn(`[sendQRWhatsAppMessage] Remote relay returned status ${relayRes.status}: ${relayText}`);
          }
        }
      } catch (relayErr: any) {
        try {
          fs.appendFileSync('d:/web/watibot/debug_relay.log', `[${new Date().toISOString()}] relay exception: ${relayErr.message}\n${relayErr.stack}\n`);
        } catch (_) {}
        logger.webhook.warn(`[sendQRWhatsAppMessage] Remote relay attempt failed: ${relayErr.message}`);
      }
    }

    throw new Error('WhatsApp QR device is not connected or session has expired. Please go to Settings > WhatsApp and scan the QR code to connect your device.');
  }

  // Resolve recipient JID: correctly distinguish between Phone JID (@s.whatsapp.net) and LID (@lid)
  let jid = '';
  const trimmedPhone = recipientPhone?.trim() || '';

  if (trimmedPhone.includes('@')) {
    jid = trimmedPhone;
  } else {
    // If contactId is provided, check if the contact has an associated phone JID or LID
    let resolvedJid = '';
    if (contactId) {
      try {
        const contact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { waId: true, customAttributes: true, platform: true },
        });

        const platform = (contact?.platform || 'WHATSAPP').toUpperCase().trim();
        if (platform !== 'WHATSAPP') {
          logger.webhook.info(`[sendQRWhatsAppMessage] Contact ${contactId} is on platform ${platform}. Delegating to Unified Messenger.`);
          const { sendUnifiedMessage } = await import('@/lib/messaging/api');
          return await sendUnifiedMessage({
            contactId,
            message: messageText,
            senderId,
            mediaUrl,
            contentType,
            fileName: options.fileName,
            mimetype: options.mimetype,
            replyToMessageId: options.replyToMessageId,
            replyToWaId: options.replyToWaId,
            interactiveData: options.interactiveData,
          });
        }

        const customAttrs = (contact?.customAttributes as any) || {};
        const phoneCandidate = contact?.waId || trimmedPhone;
        const cleanDigits = phoneCandidate.replace(/\D/g, '');

        if (customAttrs.whatsappJid && customAttrs.whatsappJid.endsWith('@s.whatsapp.net')) {
          resolvedJid = customAttrs.whatsappJid;
        } else if (cleanDigits.length >= 7 && cleanDigits.length <= 15) {
          // Standard E.164 phone number: always prefer phone JID
          resolvedJid = `${cleanDigits}@s.whatsapp.net`;
        } else if (customAttrs.whatsappLid && customAttrs.whatsappLid.endsWith('@lid')) {
          resolvedJid = customAttrs.whatsappLid;
        }

        if (!resolvedJid) {
          const lastInbound = await prisma.message.findFirst({
            where: { contactId, direction: 'inbound' },
            orderBy: { createdAt: 'desc' },
            select: { rawBody: true },
          });
          const inKey = (lastInbound?.rawBody as any)?.key;
          if (inKey?.remoteJidAlt && inKey.remoteJidAlt.endsWith('@s.whatsapp.net')) {
            resolvedJid = inKey.remoteJidAlt;
          } else if (inKey?.remoteJid && inKey.remoteJid.endsWith('@s.whatsapp.net')) {
            resolvedJid = inKey.remoteJid;
          } else if (inKey?.remoteJid && inKey.remoteJid.endsWith('@lid')) {
            resolvedJid = inKey.remoteJid;
          }
        }
      } catch (lookupErr: any) {
        logger.webhook.warn(`[sendQRWhatsAppMessage] Contact JID lookup warning: ${lookupErr.message}`);
      }
    }

    if (resolvedJid) {
      jid = resolvedJid;
    } else {
      const cleanDigits = trimmedPhone.replace(/\D/g, '');
      jid = `${cleanDigits}@s.whatsapp.net`;
    }
  }

  logger.webhook.info(`[sendQRWhatsAppMessage] Dispatching message to JID ${jid} (org: ${organizationId}, contact: ${contactId})`);

  let baileysPayload: any = { text: messageText };
  let mediaSource: any = undefined;

  if (mediaUrl) {
    mediaSource = { url: mediaUrl };

    try {
      if (mediaUrl.includes('/api/media/files/')) {
        const relPart = mediaUrl.split('/api/media/files/')[1];
        if (relPart) {
          const cleanParts = relPart.replace(/^(\/|\\)+/, '').split(/[\/\\]+/);
          const { getLocalStorageRoot } = await import('@/lib/storage/providers/local-provider');
          const fullPath = path.resolve(getLocalStorageRoot(), ...cleanParts);
          if (fs.existsSync(fullPath)) {
            mediaSource = fs.readFileSync(fullPath);
          }
        }
      } else if (mediaUrl.startsWith('/uploads/')) {
        const fullPath = path.resolve(process.cwd(), 'public', mediaUrl.replace(/^\/+/, ''));
        if (fs.existsSync(fullPath)) {
          mediaSource = fs.readFileSync(fullPath);
        }
      } else if (mediaUrl.startsWith('/')) {
        const { getAppBaseUrl } = await import('@/lib/storage/media');
        mediaSource = { url: `${getAppBaseUrl()}${mediaUrl}` };
      }
    } catch (e) {
      logger.webhook.warn(`[sendQRWhatsAppMessage] Media buffer resolution error: ${e}`);
      mediaSource = { url: mediaUrl };
    }

    const { getMimeTypeFromFileNameOrUrl } = await import('@/lib/storage/media');
    
    // Resolve extension from mediaUrl or options.fileName
    const urlClean = (mediaUrl || '').split('?')[0].trim();
    const urlExt = urlClean.split('.').pop()?.toLowerCase() || '';
    const nameClean = (options.fileName || '').split('?')[0].trim();
    const nameExt = nameClean.split('.').pop()?.toLowerCase() || '';
    const resolvedExt = urlExt || nameExt;

    const isImageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(resolvedExt);
    const isVideoExt = ['mp4', '3gp', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(resolvedExt);
    const isAudioExt = ['mp3', 'ogg', 'm4a', 'wav', 'aac', 'opus', 'amr'].includes(resolvedExt);
    const isDocExt = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv', 'json', 'rtf'].includes(resolvedExt);

    const normContent = (contentType || '').toLowerCase().trim();
    const isAudio = normContent === 'audio' || normContent === 'voice' || isAudioExt;
    const isVideo = normContent === 'video' || (!isAudio && isVideoExt);
    const isDoc = normContent === 'document' || normContent === 'file' || isDocExt;
    const isImage = (normContent === 'image' || isImageExt || (!isAudio && !isVideo && !isDoc));

    if (isAudio) {
      if (Buffer.isBuffer(mediaSource) && (normContent === 'voice' || contentType === 'voice' || isAudioExt)) {
        try {
          const { transcodeToWhatsAppOggOpus } = await import('@/lib/chat/audio-transcoder');
          mediaSource = await transcodeToWhatsAppOggOpus(mediaSource);
        } catch (_) {}
      }
      const isVoice = normContent === 'voice' || contentType === 'voice' || messageText === '[Voice Message]';
      const mime = isVoice ? 'audio/ogg; codecs=opus' : (options.mimetype || getMimeTypeFromFileNameOrUrl(mediaUrl, 'audio/ogg; codecs=opus'));
      baileysPayload = { audio: mediaSource, ptt: isVoice, mimetype: mime };
    } else if (isVideo) {
      const mime = options.mimetype || getMimeTypeFromFileNameOrUrl(mediaUrl, 'video/mp4');
      baileysPayload = { video: mediaSource, caption: messageText || undefined, mimetype: mime };
    } else if (isDoc) {
      let resolvedFileName = options.fileName || options.mediaUrl?.split('/').pop()?.split('?')[0] || 'document';
      if (messageText && /\.(docx|doc|pdf|xlsx|xls|pptx|ppt|txt|csv|zip|rar)$/i.test(messageText.trim())) {
        resolvedFileName = messageText.trim();
      }
      const resolvedMime = options.mimetype || getMimeTypeFromFileNameOrUrl(resolvedFileName || mediaUrl, 'application/octet-stream');
      baileysPayload = {
        document: mediaSource,
        fileName: resolvedFileName,
        mimetype: resolvedMime,
        caption: messageText || undefined,
      };
    } else {
      const mime = options.mimetype || getMimeTypeFromFileNameOrUrl(mediaUrl, 'image/jpeg');
      baileysPayload = { image: mediaSource, caption: messageText || undefined, mimetype: mime };
    }
  }

  // Resolve referenced message for native WhatsApp reply/quote
  let quotedBaileysMsg: any = undefined;
  let replyPreview: string | null = null;
  let replySenderName: string | null = null;
  let replyMessageType: string | null = null;

  if (effectiveReplyToId || effectiveReplyToWaId) {
    try {
      const referenced = await prisma.message.findFirst({
        where: {
          OR: [
            ...(effectiveReplyToId ? [{ id: effectiveReplyToId }, { wamid: effectiveReplyToId }] : []),
            ...(effectiveReplyToWaId ? [{ wamid: effectiveReplyToWaId }, { id: effectiveReplyToWaId }] : []),
          ],
        },
        include: { sender: true },
      });

      if (referenced) {
        effectiveReplyToId = referenced.id;
        effectiveReplyToWaId = referenced.wamid || effectiveReplyToWaId;
        replyPreview = referenced.content || (referenced.type ? `[${referenced.type}]` : 'Message');
        replySenderName = referenced.direction === 'outbound' ? (referenced.sender?.name || 'You') : 'Customer';
        replyMessageType = referenced.type || 'text';

        const raw = referenced.rawBody as any;
        if (raw?.key) {
          quotedBaileysMsg = raw;
        } else {
          quotedBaileysMsg = {
            key: {
              remoteJid: jid,
              fromMe: referenced.direction === 'outbound',
              id: referenced.wamid,
            },
            message: {
              conversation: referenced.content || '',
            },
          };
        }
      }
    } catch (refErr: any) {
      logger.webhook.warn(`[sendQRWhatsAppMessage] Quoted message resolution warning: ${refErr.message}`);
    }
  }
  const normalizedButtons = extractNormalizedButtons(options);
  let sentResult: any;
  let isInteractive = false;
  try {
    if (normalizedButtons.length > 0) {
      isInteractive = true;
      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const buttonLines = normalizedButtons.map((b, i) => {
        const emoji = numberEmojis[i] || `[${i + 1}]`;
        if (b.type === 'cta_url' && b.url) {
          return `${emoji} *${b.text}* 🔗 ${b.url}`;
        }
        if (b.type === 'cta_call' && b.phoneNumber) {
          return `${emoji} *${b.text}* 📞 ${b.phoneNumber}`;
        }
        return `${emoji} *${b.text}*`;
      }).join('\n');

      const footerSection = (options.footerText || options.interactiveData?.footer?.text)
        ? `\n\n_${options.footerText || options.interactiveData?.footer?.text}_`
        : '';
      const promptLine = `\n\n_👉 Reply with the number (e.g. 1) or option name._`;
      const fullContentText = `${messageText ? `${messageText}\n\n` : ''}${buttonLines}${footerSection}${promptLine}`;

      if (mediaUrl) {
        if (baileysPayload.image) baileysPayload.image.caption = fullContentText;
        else if (baileysPayload.video) baileysPayload.video.caption = fullContentText;
        else baileysPayload.caption = fullContentText;
      } else {
        baileysPayload = { text: fullContentText };
      }

      console.log(`[WhatsAppQR] 📤 Sending message with ${normalizedButtons.length} interactive option(s) to ${jid} (org: ${organizationId})...`);
      sentResult = await sock.sendMessage(jid, baileysPayload, quotedBaileysMsg ? { quoted: quotedBaileysMsg } : undefined);
      console.log(`[WhatsAppQR] ✅ Sent QR message with buttons to ${jid} | WAMID: ${sentResult?.key?.id}`);
    } else {
      console.log(`[WhatsAppQR] 📤 Sending message to ${jid} (org: ${organizationId})...`);
      sentResult = await sock.sendMessage(jid, baileysPayload, quotedBaileysMsg ? { quoted: quotedBaileysMsg } : undefined);
      console.log(`[WhatsAppQR] ✅ Sent QR message to ${jid} | WAMID: ${sentResult?.key?.id}`);
    }
  } catch (sendErr: any) {
    console.error(`[WhatsAppQR] ❌ Failed to send QR message to ${jid}:`, sendErr?.message || sendErr);
    if (sendErr?.message?.includes("reading 'id'") || !sock.user?.id) {
      throw new Error('WhatsApp QR device is not authenticated. Please scan the QR code in Settings to connect.');
    }
    throw sendErr;
  }
  const wamid = sentResult?.key?.id || `qr_${Date.now()}`;

  const isImageKind = !contentType || contentType === 'image' || contentType.startsWith('image/');
  const isVideoKind = contentType === 'video' || contentType?.startsWith('video/');

  const rawBodyPayload = isInteractive
    ? {
        type: 'interactive',
        interactive: {
          type: 'button',
          header: options.interactiveData?.header || (mediaUrl ? { type: isImageKind ? 'image' : isVideoKind ? 'video' : 'document', [isImageKind ? 'image' : isVideoKind ? 'video' : 'document']: { link: mediaUrl } } : undefined),
          body: { text: messageText || '' },
          footer: options.footerText || options.interactiveData?.footer?.text ? { text: options.footerText || options.interactiveData?.footer?.text } : undefined,
          action: {
            buttons: normalizedButtons.map((b) => ({
              type: 'reply',
              reply: {
                id: b.id,
                title: b.text,
              },
            })),
          },
        },
      }
    : baileysPayload;

  const qrChannel = await prisma.whatsAppChannel.findFirst({
    where: {
      organizationId,
      OR: [
        ...(options.channelId ? [{ id: options.channelId }] : []),
        { connectionMethod: 'qr' },
        { phoneNumberId: `qr_${organizationId}` },
      ],
    },
    orderBy: { isDefault: 'desc' },
  }).catch(() => null);

  // Persist outbound message to database
  const [savedMessage] = await Promise.all([
    prisma.message.create({
      data: {
        contactId,
        senderId,
        channelId: options.channelId || qrChannel?.id || null,
        wamid,
        type: isInteractive ? 'interactive' : (mediaUrl ? (contentType?.split('/')[0] || 'media') : 'text'),
        direction: 'outbound',
        status: 'sent',
        content: messageText || '',
        mediaUrl: mediaUrl || null,
        rawBody: sanitizeBaileysObject(rawBodyPayload),
        replyToId: effectiveReplyToId || null,
        replyToWaId: effectiveReplyToWaId || null,
        replyPreview: replyPreview || null,
        replySenderName: replySenderName || null,
        replyMessageType: replyMessageType || null,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
        replyTo: {
          select: {
            id: true,
            wamid: true,
            content: true,
            type: true,
            direction: true,
            mediaUrl: true,
            sender: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: {
        lastMessage: messageText || (mediaUrl ? `[${(contentType?.split('/')[0] || 'Media').replace(/^./, (c: string) => c.toUpperCase())}]` : ''),
        lastMessageAt: new Date(),
      },
    }),
  ]);

  // Broadcast outbound event to Live Chat
  const { formatMobileMessage } = await import('@/lib/api/mobile-formatters');
  const formattedMsg = formatMobileMessage(savedMessage);
  await triggerPusherOrgEvent(organizationId, 'message:outbound', {
    ...formattedMsg,
    contactId,
    contact_id: contactId,
    contactNumber: recipientPhone,
    waId: recipientPhone,
    message: formattedMsg,
  }).catch(() => {});

  return savedMessage;
}

/**
 * Safely sanitizes a Baileys message object into a clean, plain JSON-serializable object.
 * This prevents Protobuf prototype errors (e.g. this.constructor.toObject is not a function)
 * and safely transforms 64-bit Long integers, Buffers, Dates, and nested structures.
 */
export function sanitizeBaileysObject(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle Long integers (e.g. messageTimestamp)
  if (typeof obj.toNumber === 'function') {
    try {
      return obj.toNumber();
    } catch {
      return String(obj);
    }
  }

  // Handle Buffer or Uint8Array
  if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
    return Buffer.from(obj).toString('base64');
  }

  // Handle Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Circular reference guard
  if (seen.has(obj)) {
    return '[Circular]';
  }
  seen.add(obj);

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeBaileysObject(item, seen));
  }

  // Handle plain object or Protobuf message class instance
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'function') continue;
    clean[key] = sanitizeBaileysObject(val, seen);
  }
  return clean;
}

/**
 * Downloads media from a Baileys message object and saves it to local media storage.
 */
export async function downloadAndSaveInboundMedia(
  m: any,
  mediaObj: any,
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker',
  mimeType?: string,
  preferredFileName?: string
): Promise<string | null> {
  if (!mediaObj) return null;

  try {
    let buffer: Buffer | null = null;

    // Method 1: Direct stream decryption via downloadContentFromMessage with directPath & mediaKey
    try {
      const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
      let mediaKey = mediaObj.mediaKey;
      if (typeof mediaKey === 'string') {
        mediaKey = Buffer.from(mediaKey, 'base64');
      } else if (mediaKey && !Buffer.isBuffer(mediaKey)) {
        mediaKey = Buffer.from(mediaKey);
      }

      if (mediaKey && (mediaObj.directPath || mediaObj.url)) {
        const stream = await downloadContentFromMessage(
          {
            mediaKey,
            directPath: mediaObj.directPath,
            url: mediaObj.url,
          },
          mediaType
        );
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          buffer = Buffer.concat(chunks);
        }
      }
    } catch (streamErr: any) {
      logger.webhook.warn(`[InboundMedia] Stream download attempt 1 failed: ${streamErr?.message}`);
    }

    // Method 2: Fallback to downloadMediaMessage
    if (!buffer || buffer.length === 0) {
      try {
        const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
        buffer = await downloadMediaMessage(m, 'buffer', {});
      } catch (fallbackErr: any) {
        logger.webhook.warn(`[InboundMedia] Fallback downloadMediaMessage failed: ${fallbackErr?.message}`);
      }
    }

    if (!buffer || buffer.length === 0) {
      logger.webhook.error(`[InboundMedia] Failed to extract media buffer for type: ${mediaType}`);
      return null;
    }

    const { saveMediaLocally, getExtensionFromMimeType } = await import('@/lib/storage/media');
    const finalMime = mimeType || mediaObj.mimetype || 'application/octet-stream';
    const ext = getExtensionFromMimeType(finalMime);
    const baseName = preferredFileName ? preferredFileName.replace(/[^a-zA-Z0-9._-]/g, '_') : `wa_${mediaType}_${Date.now()}`;
    const filename = baseName.includes('.') ? baseName : `${baseName}.${ext}`;

    const savedUrl = await saveMediaLocally(buffer, filename, finalMime);
    logger.webhook.info(`[InboundMedia] Saved inbound ${mediaType} (${buffer.length} bytes) to ${savedUrl}`);
    return savedUrl;
  } catch (err: any) {
    logger.webhook.error(`[InboundMedia] Unexpected error saving inbound media: ${err?.message}`);
    return null;
  }
}

/**
 * Handles incoming customer messages received via Baileys socket.
 */
export async function handleInboundQRMessage(
  organizationId: string,
  upsertEvent: any
): Promise<void> {
  const messages = upsertEvent?.messages || [];

  for (const m of messages) {
    const key = m.key;
    if (!key || !key.remoteJid) continue;

    // Ignore WhatsApp status broadcasts and group messages
    if (key.remoteJid === 'status@broadcast' || key.remoteJid.endsWith('@g.us')) {
      continue;
    }

    // Ignore outbound messages from ourselves
    if (key.fromMe) {
      continue;
    }

    const remoteJid = key.remoteJid || '';
    const remoteJidAlt = key.remoteJidAlt || '';

    // Extract actual phone number and LID
    let realPhone = '';
    let lid = '';

    if (remoteJid.endsWith('@s.whatsapp.net')) {
      realPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    } else if (remoteJid.endsWith('@lid')) {
      lid = remoteJid;
    }

    if (remoteJidAlt.endsWith('@s.whatsapp.net')) {
      realPhone = remoteJidAlt.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    } else if (remoteJidAlt.endsWith('@lid')) {
      lid = remoteJidAlt;
    }

    // Always prefer real phone number as cleanPhone for user-facing contact identification
    const cleanPhone = realPhone || (lid ? lid.replace('@lid', '').replace(/\D/g, '') : '');
    if (!cleanPhone) continue;

    const pushName = m.pushName || `+${cleanPhone}`;

    // Unwrap view-once / ephemeral message wrappers if present
    let msgObj = m.message || {};
    if (msgObj.ephemeralMessage?.message) {
      msgObj = msgObj.ephemeralMessage.message;
    }
    if (msgObj.viewOnceMessage?.message) {
      msgObj = msgObj.viewOnceMessage.message;
    }
    if (msgObj.viewOnceMessageV2?.message) {
      msgObj = msgObj.viewOnceMessageV2.message;
    }
    if (msgObj.documentWithCaptionMessage?.message) {
      msgObj = msgObj.documentWithCaptionMessage.message;
    }

    // -----------------------------------------------------------------
    // Handle WhatsApp Reaction Messages (Emoji reactions on messages)
    // -----------------------------------------------------------------
    if (msgObj.reactionMessage) {
      const targetWamid = msgObj.reactionMessage.key?.id;
      const emoji = (msgObj.reactionMessage.text || '').trim();
      const isFromMe = Boolean(key.fromMe);

      logger.webhook.info(`[InboundQR] Reaction received: '${emoji}' for target message ${targetWamid}`);

      if (targetWamid) {
        const targetMessage = await prisma.message.findFirst({
          where: { wamid: targetWamid },
        });

        if (targetMessage) {
          const existingRaw = (targetMessage.rawBody as any) || {};
          let reactions: Array<{ emoji: string; fromMe: boolean; sender: string }> = Array.isArray(existingRaw.reactions)
            ? [...existingRaw.reactions]
            : [];

          // Remove any prior reaction from this sender
          reactions = reactions.filter(
            (r) => !(r.sender === cleanPhone && r.fromMe === isFromMe)
          );

          if (emoji) {
            reactions.push({
              emoji,
              fromMe: isFromMe,
              sender: cleanPhone,
            });
          }

          const updatedRaw = {
            ...existingRaw,
            reactions,
            reaction: reactions.length > 0 ? reactions[reactions.length - 1] : null,
          };

          await prisma.message.update({
            where: { id: targetMessage.id },
            data: { rawBody: updatedRaw },
          });

          // Trigger real-time update in Live Chat
          await Promise.allSettled([
            triggerPusherOrgEvent(organizationId, 'message:reaction', {
              messageId: targetMessage.id,
              contactId: targetMessage.contactId,
              reactions,
              reaction: updatedRaw.reaction,
              rawBody: updatedRaw,
            }),
            triggerPusherOrgEvent(organizationId, 'message:update', {
              messageId: targetMessage.id,
              contactId: targetMessage.contactId,
              rawBody: updatedRaw,
            }),
          ]);

          return;
        }
      }

      // If target message wasn't found in DB, do not create an orphan "[Message]" bubble
      return;
    }

    // Determine message type and extract content
    let msgType = 'text';
    let content = '';
    let mediaUrl: string | undefined = undefined;
    let mediaObj: any = null;
    let mediaCategory: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null = null;
    let mimeType = 'application/octet-stream';
    let preferredFileName: string | undefined = undefined;
    let buttonId: string | undefined = undefined;

    if (msgObj.conversation) {
      content = msgObj.conversation;
    } else if (msgObj.extendedTextMessage?.text) {
      content = msgObj.extendedTextMessage.text;
    } else if (msgObj.imageMessage) {
      msgType = 'image';
      content = msgObj.imageMessage.caption || '[Image]';
      mediaObj = msgObj.imageMessage;
      mediaCategory = 'image';
      mimeType = msgObj.imageMessage.mimetype || 'image/jpeg';
    } else if (msgObj.videoMessage) {
      msgType = 'video';
      content = msgObj.videoMessage.caption || '[Video]';
      mediaObj = msgObj.videoMessage;
      mediaCategory = 'video';
      mimeType = msgObj.videoMessage.mimetype || 'video/mp4';
    } else if (msgObj.audioMessage) {
      msgType = msgObj.audioMessage.ptt ? 'voice' : 'audio';
      content = msgObj.audioMessage.ptt ? '[Voice Note]' : '[Audio]';
      mediaObj = msgObj.audioMessage;
      mediaCategory = 'audio';
      mimeType = msgObj.audioMessage.mimetype || 'audio/ogg; codecs=opus';
    } else if (msgObj.documentMessage) {
      msgType = 'document';
      content = msgObj.documentMessage.fileName || '[Document]';
      mediaObj = msgObj.documentMessage;
      mediaCategory = 'document';
      mimeType = msgObj.documentMessage.mimetype || 'application/octet-stream';
      preferredFileName = msgObj.documentMessage.fileName;
    } else if (msgObj.stickerMessage) {
      msgType = 'sticker';
      content = '[Sticker]';
      mediaObj = msgObj.stickerMessage;
      mediaCategory = 'sticker';
      mimeType = msgObj.stickerMessage.mimetype || 'image/webp';
    } else if (msgObj.locationMessage) {
      msgType = 'location';
      content = msgObj.locationMessage.name || '[Location]';
    } else if (msgObj.buttonsResponseMessage) {
      content = msgObj.buttonsResponseMessage.selectedDisplayText || content;
      buttonId = msgObj.buttonsResponseMessage.selectedButtonId || undefined;
    } else if (msgObj.templateButtonReplyMessage) {
      content = msgObj.templateButtonReplyMessage.selectedDisplayText || content;
      buttonId = msgObj.templateButtonReplyMessage.selectedId || undefined;
    } else if (msgObj.listResponseMessage) {
      content = msgObj.listResponseMessage.title || content;
      buttonId = msgObj.listResponseMessage.singleSelectReply?.selectedRowId || undefined;
    } else if (msgObj.interactiveResponseMessage) {
      const interactive = msgObj.interactiveResponseMessage;
      let btnText = interactive.body?.text;
      if (interactive.nativeFlowResponseMessage?.paramsJson) {
        try {
          const parsed = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson);
          btnText = parsed.display_text || parsed.id || btnText;
          buttonId = parsed.id || buttonId;
        } catch {}
      }
      content = btnText || buttonId || '[Button Response]';
    } else {
      content = '[Message]';
    }

    // Extract contextInfo (quoted reply info) from any Baileys message type
    const contextInfo =
      msgObj.extendedTextMessage?.contextInfo ||
      msgObj.imageMessage?.contextInfo ||
      msgObj.videoMessage?.contextInfo ||
      msgObj.audioMessage?.contextInfo ||
      msgObj.documentMessage?.contextInfo ||
      msgObj.stickerMessage?.contextInfo ||
      msgObj.buttonsResponseMessage?.contextInfo ||
      msgObj.templateButtonReplyMessage?.contextInfo ||
      msgObj.listResponseMessage?.contextInfo ||
      msgObj.interactiveResponseMessage?.contextInfo ||
      (msgObj as any)?.contextInfo;

    let replyToId: string | null = null;
    let replyToWaId: string | null = contextInfo?.stanzaId || null;
    let replyPreview: string | null = null;
    let replySenderName: string | null = null;
    let replyMessageType: string | null = null;

    if (contextInfo?.stanzaId) {
      const referencedMsg = await prisma.message.findFirst({
        where: {
          OR: [
            { wamid: contextInfo.stanzaId },
            { id: contextInfo.stanzaId },
          ],
        },
        include: { sender: true },
      });

      if (referencedMsg) {
        replyToId = referencedMsg.id;
        replyToWaId = referencedMsg.wamid || contextInfo.stanzaId;
        replyPreview = referencedMsg.content || (referencedMsg.type ? `[${referencedMsg.type.charAt(0).toUpperCase() + referencedMsg.type.slice(1)}]` : 'Message');
        replySenderName = referencedMsg.direction === 'outbound'
          ? (referencedMsg.sender?.name || 'You')
          : (pushName || 'Customer');
        replyMessageType = referencedMsg.type || 'text';
      } else {
        const qm = contextInfo.quotedMessage;
        if (qm) {
          if (qm.conversation || qm.extendedTextMessage?.text) {
            replyPreview = qm.conversation || qm.extendedTextMessage?.text;
            replyMessageType = 'text';
          } else if (qm.imageMessage) {
            replyPreview = qm.imageMessage.caption || 'Photo';
            replyMessageType = 'image';
          } else if (qm.videoMessage) {
            replyPreview = qm.videoMessage.caption || 'Video';
            replyMessageType = 'video';
          } else if (qm.audioMessage) {
            replyPreview = 'Voice message';
            replyMessageType = 'voice';
          } else if (qm.documentMessage) {
            replyPreview = qm.documentMessage.fileName || 'Document';
            replyMessageType = 'document';
          } else if (qm.stickerMessage) {
            replyPreview = 'Sticker';
            replyMessageType = 'sticker';
          } else {
            replyPreview = 'Original message';
            replyMessageType = 'text';
          }
        } else {
          replyPreview = 'Original message';
          replyMessageType = 'text';
        }

        if (contextInfo.participant) {
          const partClean = contextInfo.participant.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/\D/g, '');
          if (partClean === cleanPhone) {
            replySenderName = pushName || `+${cleanPhone}`;
          } else {
            replySenderName = 'You';
          }
        } else {
          replySenderName = 'You';
        }
      }
    }

    if (mediaObj && mediaCategory) {
      try {
        const downloadedUrl = await downloadAndSaveInboundMedia(
          m,
          mediaObj,
          mediaCategory,
          mimeType,
          preferredFileName
        );
        if (downloadedUrl) {
          mediaUrl = downloadedUrl;
        }
      } catch (mediaErr: any) {
        logger.webhook.error(`[InboundQR] Media download failed: ${mediaErr?.message}`);
      }
    }

    const wamid = key.id || `qr_in_${Date.now()}`;
    const rawBody = sanitizeBaileysObject(m);

    try {
      // Find Contact by real phone number OR by previous LID
      let contact = await prisma.contact.findFirst({
        where: {
          organizationId,
          platform: 'WHATSAPP',
          OR: [
            { waId: cleanPhone },
            ...(realPhone && lid ? [{ waId: lid.replace('@lid', '').replace(/\D/g, '') }] : []),
          ],
        },
      });

      const customAttrsUpdate: Record<string, any> = {
        ...(contact?.customAttributes as any || {}),
        ...(lid ? { whatsappLid: lid } : {}),
        ...(realPhone ? { whatsappJid: `${realPhone}@s.whatsapp.net` } : {}),
      };

      let isNewContact = false;
      if (!contact) {
        isNewContact = true;
        contact = await prisma.contact.create({
          data: {
            organizationId,
            waId: cleanPhone,
            name: pushName || cleanPhone,
            whatsappName: pushName,
            platform: 'WHATSAPP',
            isAiBotEnabled: true,
            lastInboundMessageAt: new Date(),
            lastMessage: content,
            lastMessageAt: new Date(),
            unreadCount: 1,
            customAttributes: customAttrsUpdate,
          },
        });
      } else {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: {
            waId: cleanPhone,
            lastInboundMessageAt: new Date(),
            lastMessage: content,
            lastMessageAt: new Date(),
            unreadCount: { increment: 1 },
            customAttributes: customAttrsUpdate,
          },
        });
      }

      // Auto-assign conversation if unassigned or new
      try {
        const { evaluateAndAssignConversation } = await import('@/lib/chat/assignment-engine');
        await evaluateAndAssignConversation(contact.id, organizationId, { isNewContact: isNewContact });
      } catch (assignErr) {
        console.warn('[QR] Auto-assign error:', assignErr);
      }

      // Fetch fresh assignment details
      let assignedAgentId = contact.assignedAgentId || null;
      let assignedUserIds: string[] = [];
      try {
        const freshContact = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: {
            assignedAgentId: true,
            assignedUsers: { select: { id: true } },
          },
        });
        if (freshContact) {
          assignedAgentId = freshContact.assignedAgentId || assignedAgentId;
          assignedUserIds = freshContact.assignedUsers?.map((u: { id: string }) => u.id) || [];
          if (assignedAgentId && !assignedUserIds.includes(assignedAgentId)) {
            assignedUserIds.push(assignedAgentId);
          }
        }
      } catch (_) {}

      // Asynchronously fetch and cache contact's WhatsApp profile picture
      if (!contact.profilePic) {
        syncContactProfilePic(organizationId, contact.id).catch(() => {});
      }

      // Resolve matching WhatsApp channel for this QR device
      const qrChannel = await prisma.whatsAppChannel.findFirst({
        where: {
          organizationId,
          OR: [
            { connectionMethod: 'qr' },
            { phoneNumberId: `qr_${organizationId}` },
          ],
        },
        orderBy: { isDefault: 'desc' },
      }).catch(() => null);

      // Create Message record with native reply fields
      const savedMessage = await prisma.message.create({
        data: {
          contactId: contact.id,
          channelId: qrChannel?.id || null,
          wamid,
          type: msgType,
          direction: 'inbound',
          status: 'delivered',
          content,
          mediaUrl: mediaUrl || null,
          rawBody,
          replyToId,
          replyToWaId,
          replyPreview,
          replySenderName,
          replyMessageType,
        },
        include: {
          contact: { select: { id: true, name: true, waId: true, platform: true } },
          sender: { select: { id: true, name: true, email: true } },
          replyTo: {
            select: {
              id: true,
              wamid: true,
              content: true,
              type: true,
              direction: true,
              mediaUrl: true,
              sender: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const { formatMobileMessage } = await import('@/lib/api/mobile-formatters');
      const formattedMessage = formatMobileMessage(savedMessage);

      // Broadcast inbound message to Live Chat inbox in real-time
      await triggerPusherOrgEvent(organizationId, 'message:inbound', {
        ...formattedMessage,
        contactId: contact.id,
        contact_id: contact.id,
        contactName: contact.name || contact.waId,
        contactNumber: contact.waId,
        waId: contact.waId,
        assignedAgentId,
        assigned_agent_id: assignedAgentId,
        assignedUserIds,
        assigned_user_ids: assignedUserIds,
        contact: {
          ...contact,
          assignedAgentId,
          lastMessage: content,
          lastMessageAt: new Date(),
        },
        message: formattedMessage,
      }).catch(() => {});

      // Forward to Flow Engine (triggers AI bot, AI routing, interactive flows)
      try {
        const { enqueueFlow } = await import('@/lib/flows/queue');
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
        });

        await enqueueFlow({
          organizationId,
          contactId: contact.id,
          messageText: content,
          buttonId: buttonId || undefined,
          contact: { ...contact, organization: org },
          metadata: {
            msgType,
            mediaType: msgType,
            isVoice: msgType === 'audio',
            buttonId: buttonId || undefined,
          },
        });
      } catch (flowErr: any) {
        logger.webhook.warn(`[QRService] Flow enqueue error: ${flowErr.message}`);
      }

      // Dispatch external webhooks
      dispatchWebhook(organizationId, 'message.created', {
        message: formatMessage(
          {
            id: savedMessage.id,
            contactId: contact.id,
            type: msgType,
            direction: 'inbound',
            status: 'delivered',
            content,
            mediaUrl,
            rawBody,
            createdAt: new Date(),
            wamid,
          },
          contact
        ),
      }).catch(() => {});
    } catch (err: any) {
      logger.webhook.error(`[QRService] Error handling inbound message: ${err.message}${err.stack ? `\n${err.stack}` : ''}`);
    }
  }
}

/**
 * Restores all active QR sessions on server startup.
 */
export async function restoreActiveQRSessions(): Promise<void> {
  try {
    const orgs = await prisma.organization.findMany({
      where: {
        whatsappConnectionMethod: 'qr',
      },
      select: { id: true, name: true },
    });

    if (orgs.length === 0) return;

    logger.webhook.info(`[QRService] Restoring ${orgs.length} QR session(s) on startup...`);

    for (const org of orgs) {
      const sessionDir = getSessionStoragePath(org.id);
      if (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0) {
        initWASocket({ organizationId: org.id, isRestoring: true }).catch((err) => {
          logger.webhook.warn(`[QRService] Failed to restore socket for org ${org.name}: ${err.message}`);
        });
      }
    }
  } catch (err: any) {
    logger.webhook.error(`[QRService] Error restoring QR sessions: ${err.message}`);
  }
}

/**
 * Syncs the WhatsApp profile information (profile picture, status/bio, business details)
 * from the active Baileys socket to the Organization record in database.
 */
export async function syncQRProfile(organizationId: string): Promise<{
  phoneNumber: string | null;
  businessName: string | null;
  businessLogo: string | null;
  businessDescription: string | null;
  businessEmail: string | null;
  businessAddress: string | null;
  businessWebsites: string[] | null;
}> {
  logger.webhook.info(`[QRService] Syncing QR profile for org: ${organizationId}`);

  let sock = await getOrRestoreWASocket(organizationId);
  if (!sock || !isWASocketConnected(sock)) {
    throw new Error('WhatsApp QR device is not connected.');
  }

  const rawUserJid = sock.user?.id || '';
  const cleanPhone = rawUserJid.split(':')[0].split('@')[0];
  const formattedPhone = cleanPhone ? (cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`) : null;
  const businessName = sock.user?.name || null;

  const fullJid = rawUserJid
    ? (rawUserJid.includes('@')
        ? rawUserJid.split(':')[0] + '@s.whatsapp.net'
        : `${rawUserJid}@s.whatsapp.net`)
    : null;

  let businessLogo: string | null = null;
  let businessDescription: string | null = null;
  let businessEmail: string | null = null;
  let businessAddress: string | null = null;
  let businessWebsites: string[] | null = null;

  if (fullJid) {
    // 1. Fetch Profile Picture
    try {
      if (typeof sock.profilePictureUrl === 'function') {
        businessLogo = await sock.profilePictureUrl(fullJid, 'image').catch(() => null);
        if (!businessLogo) {
          businessLogo = await sock.profilePictureUrl(fullJid, 'preview').catch(() => null);
        }
      }
    } catch (e: any) {
      logger.webhook.warn(`[QRService] Could not fetch profile picture: ${e.message}`);
    }

    // 2. Fetch Business Profile (if WhatsApp Business account)
    try {
      if (typeof sock.getBusinessProfile === 'function') {
        const bProfile = await sock.getBusinessProfile(fullJid).catch(() => null);
        if (bProfile) {
          if (bProfile.description) businessDescription = bProfile.description;
          if (bProfile.email) businessEmail = bProfile.email;
          if (bProfile.address) businessAddress = bProfile.address;
          if (bProfile.websites && Array.isArray(bProfile.websites)) businessWebsites = bProfile.websites;
        }
      }
    } catch (e: any) {
      logger.webhook.warn(`[QRService] Could not fetch business profile: ${e.message}`);
    }

    // 3. Fetch Status / Bio if no business description was found
    if (!businessDescription) {
      try {
        if (typeof sock.fetchStatus === 'function') {
          const statusRes = await sock.fetchStatus(fullJid).catch(() => null);
          if (statusRes?.status) {
            businessDescription = statusRes.status;
          }
        }
      } catch (e: any) {
        // Status may not be set or permitted
      }
    }
  }

  // Update Organization in database
  const updateData: any = {
    whatsappConnectionMethod: 'qr',
  };
  if (formattedPhone) updateData.whatsappNumber = formattedPhone;
  if (businessName) updateData.whatsappBusinessName = businessName;
  if (businessLogo) updateData.businessLogo = businessLogo;
  if (businessDescription) updateData.businessDescription = businessDescription;
  if (businessEmail) updateData.businessEmail = businessEmail;
  if (businessAddress) updateData.businessAddress = businessAddress;
  if (businessWebsites) updateData.businessWebsites = businessWebsites;

  await prisma.organization.update({
    where: { id: organizationId },
    data: updateData,
  });

  return {
    phoneNumber: formattedPhone,
    businessName,
    businessLogo,
    businessDescription,
    businessEmail,
    businessAddress,
    businessWebsites,
  };
}

/**
 * Fetches and updates a contact's WhatsApp profile picture from the active Baileys socket.
 */
export async function syncContactProfilePic(
  organizationId: string,
  contactId: string
): Promise<string | null> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, waId: true, profilePic: true, customAttributes: true },
    });

    if (!contact) return null;

    let sock = await getOrRestoreWASocket(organizationId);
    if (!sock || !isWASocketConnected(sock)) return null;

    const customAttrs = (contact.customAttributes as any) || {};
    const targetJid =
      customAttrs.whatsappJid ||
      (contact.waId ? `${contact.waId.replace(/\D/g, '')}@s.whatsapp.net` : null);

    if (!targetJid) return null;

    let picUrl: string | null = null;
    try {
      picUrl = await sock.profilePictureUrl(targetJid, 'image');
    } catch {
      try {
        picUrl = await sock.profilePictureUrl(targetJid, 'preview');
      } catch {
        // Picture is not available or restricted by user privacy
      }
    }

    if (picUrl && picUrl !== contact.profilePic) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { profilePic: picUrl },
      });

      await triggerPusherOrgEvent(organizationId, 'contact:update', {
        contactId: contact.id,
        profilePic: picUrl,
      }).catch(() => {});

      logger.webhook.info(`[QRService] Synced profile picture for contact ${contact.id} (${targetJid})`);
    }

    return picUrl || contact.profilePic || null;
  } catch (err: any) {
    logger.webhook.warn(`[QRService] Error syncing contact profile pic: ${err.message}`);
    return null;
  }
}

export async function handleMessageStatusQRUpdate(
  organizationId: string,
  updates: Array<{ key: { remoteJid?: string; id?: string; fromMe?: boolean }; update?: { status?: number | string } }>
): Promise<void> {
  if (!updates || !Array.isArray(updates) || updates.length === 0) return;

  for (const item of updates) {
    const wamid = item.key?.id;
    if (!wamid) continue;

    const rawStatus = item.update?.status;
    let mappedStatus: string | null = null;

    if (rawStatus === 2 || rawStatus === 'SERVER_ACK' || rawStatus === 'sent') {
      mappedStatus = 'sent';
    } else if (rawStatus === 3 || rawStatus === 'DELIVERY_ACK' || rawStatus === 'delivered') {
      mappedStatus = 'delivered';
    } else if (rawStatus === 4 || rawStatus === 'READ' || rawStatus === 'read') {
      mappedStatus = 'read';
    } else if (rawStatus === 5 || rawStatus === 'PLAYED' || rawStatus === 'played') {
      mappedStatus = 'read';
    }

    if (!mappedStatus) continue;

    try {
      const existing = await prisma.message.findFirst({
        where: { wamid },
        select: { id: true, contactId: true, status: true },
      });

      if (existing) {
        await prisma.message.update({
          where: { id: existing.id },
          data: { status: mappedStatus },
        });

        await triggerPusherOrgEvent(organizationId, 'message:update', {
          id: existing.id,
          messageId: existing.id,
          wamid,
          status: mappedStatus,
          rawStatus: rawStatus,
          contactId: existing.contactId,
          contact_id: existing.contactId,
        }).catch(() => {});
      }
    } catch (e: any) {
      logger.webhook.warn(`[handleMessageStatusQRUpdate] Error updating status for ${wamid}: ${e.message}`);
    }
  }
}

export async function handleMessageReceiptQRUpdate(
  organizationId: string,
  receipts: Array<{ key: { remoteJid?: string; id?: string; fromMe?: boolean }; receipt?: any }>
): Promise<void> {
  if (!receipts || !Array.isArray(receipts) || receipts.length === 0) return;

  for (const item of receipts) {
    const wamid = item.key?.id;
    if (!wamid) continue;

    const receipt = item.receipt || {};
    let mappedStatus: string = 'delivered';
    if (receipt.readTimestamp || receipt.playedTimestamp) {
      mappedStatus = 'read';
    } else if (receipt.receiptTimestamp) {
      mappedStatus = 'delivered';
    }

    try {
      const existing = await prisma.message.findFirst({
        where: { wamid },
        select: { id: true, contactId: true, status: true },
      });

      if (existing) {
        await prisma.message.update({
          where: { id: existing.id },
          data: { status: mappedStatus },
        });

        await triggerPusherOrgEvent(organizationId, 'message:update', {
          id: existing.id,
          messageId: existing.id,
          wamid,
          status: mappedStatus,
          contactId: existing.contactId,
          contact_id: existing.contactId,
        }).catch(() => {});
      }
    } catch (e: any) {
      logger.webhook.warn(`[handleMessageReceiptQRUpdate] Error updating receipt for ${wamid}: ${e.message}`);
    }
  }
}

