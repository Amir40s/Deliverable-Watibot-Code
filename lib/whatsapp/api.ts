import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma';
import { checkQuota } from '@/lib/quota';
import { logger } from '@/lib/logger';
import { sanitizeCustomerMessage } from '@/lib/messaging/sanitize';
import { resolveContactVariables } from '@/lib/messaging/contactVariables';
import { isOrganizationPlanExpired } from '@/lib/subscription';

export type WhatsAppFlowPayload = {
    flowId: string;
    flowToken?: string;
    flowMode?: 'draft' | 'published';
    flowAction?: 'navigate' | 'data_exchange';
    flowCta?: string;
    flowScreen?: string;
    flowData?: Record<string, unknown>;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
};

async function enforceBotRepliesQuota(organizationId: string) {
    const quotaCheck = await checkQuota(organizationId, 'maxBotReplies');
    if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message || 'Bot Replies limit reached. Please upgrade your plan.');
    }
}

async function handleMetaError(error: any, organizationId: string) {
    console.error(`[MetaError] Org: ${organizationId}, Code: ${error?.code}, Message: ${error?.message}`);
    
    // Handle specific error: Object does not exist (often permission/app mismatch)
    if (error?.code === 100 && (error?.error_subcode === 33 || error?.message?.includes('does not exist'))) {
        console.error(`[MetaError] FATAL PERMISSION ERROR for org ${organizationId}: The token does not have access to the Phone Number ID or WABA. Ensure the System User is added to the WhatsApp Business Account in Meta Business Suite.`);
    }

    if (error?.code === 138000) {
        console.error(`[MetaError] CALLING API NOT ENABLED for org ${organizationId}: Calling status is disabled for this WhatsApp phone number. Please enable WhatsApp Calling in Meta Business Suite / WhatsApp Manager or via settings API.`);
    }

    if (error?.code === 190) {
        // NON-DESTRUCTIVE: Log token expiration / OAuth warning, but NEVER wipe database credentials
        // (whatsappPhoneNumberId, whatsappNumber, whatsappBusinessId) automatically.
        // Preserving credentials ensures incoming webhooks and self-healing token refresh continue working.
        console.warn(`[MetaError] Meta OAuth session warning for org ${organizationId} (code 190): ${error?.message}. Preserving connection parameters for re-authentication.`);
        return true;
    }
    return false;
}

/**
 * Centralized helper to call Meta WhatsApp API with token fallback.
 * Tries metaAccessToken first, then instagramAccessToken if a permission error occurs.
 */
async function callMetaWhatsAppAPI(url: string, payload: any, organization: { id: string; metaAccessToken?: string | null; instagramAccessToken?: string | null }) {
    if (await isOrganizationPlanExpired(organization.id)) {
        logger.message.warn(`[MetaAPI] Call blocked for org ${organization.id}: Subscription plan EXPIRED.`);
        return { 
            status: 403, 
            data: { 
                error: { 
                    message: 'WhatsApp Business API connection is suspended due to subscription plan expiration. Please renew your plan.', 
                    code: 403, 
                    type: 'SubscriptionExpiredException' 
                } 
            } 
        };
    }

    const tokens = [
        organization.metaAccessToken,
        organization.instagramAccessToken
    ].filter((t): t is string => !!t);

    let lastData: any = null;
    let lastStatus = 0;

    for (const token of tokens) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            lastStatus = res.status;
            const data = await res.json();
            lastData = data;

            if (!data.error) {
                return { status: res.status, data };
            }

            // If it's a permission/not-found error and we have more tokens, try fallback
            const isPermissionError = 
                data.error.code === 100 || // Object does not exist
                data.error.code === 200 || // Permission denied
                data.error.code === 190 || // OAuth exception
                res.status === 403;

            if (isPermissionError && tokens.indexOf(token) < tokens.length - 1) {
                console.warn(`[MetaAPI] Token fallback triggered for org ${organization.id} due to error: ${data.error.message}`);
                continue;
            }

            return { status: res.status, data };
        } catch (e) {
            console.error(`[MetaAPI] Fetch failed for org ${organization.id}:`, e);
            if (tokens.indexOf(token) < tokens.length - 1) continue;
            throw e;
        }
    }

    return { status: lastStatus, data: lastData || { error: { message: 'No valid tokens available' } } };
}

/**
 * Centralized helper to process raw buttons into Meta-compliant interactive buttons.
 * Handles:
 * 1. Title shortening (20 chars for reply buttons, 24 for list rows).
 * 2. Title uniqueness (Meta requires unique titles within a message).
 * 3. ID generation from URL (prefixed with url_) or text.
 * 4. ID uniqueness (Meta requires unique IDs within a message) using suffix ::n.
 */
export function prepareInteractiveButtons(buttons: any[], maxTitleLen: number = 20) {
    if (!buttons || buttons.length === 0) return [];

    const usedTitles = new Set<string>();
    const usedIds = new Set<string>();

    return buttons.map(btn => {
        // 1. Process Title
        let rawTitle = (btn.text || btn.title || "Button").slice(0, maxTitleLen).trim();
        if (!rawTitle) rawTitle = "Button";

        let uniqueTitle = rawTitle;
        let titleCounter = 1;
        while (usedTitles.has(uniqueTitle)) {
            const suffix = ` ${titleCounter}`;
            uniqueTitle = rawTitle.slice(0, maxTitleLen - suffix.length) + suffix;
            titleCounter++;
            if (titleCounter > 9) break;
        }
        usedTitles.add(uniqueTitle);

        // 2. Process ID
        const baseId = btn.url ? `url_${btn.url}` : (btn.id || btn.text || btn.title);
        
        // 3. Ensure ID uniqueness
        let uniqueId = baseId;
        let idCounter = 1;
        while (usedIds.has(uniqueId)) {
            const suffix = `::${idCounter}`;
            uniqueId = baseId + suffix;
            idCounter++;
        }
        usedIds.add(uniqueId);

        return {
            type: 'reply',
            reply: {
                id: uniqueId,
                title: uniqueTitle
            }
        };
    });
}

// Check if contact is within 24-hour messaging window
export async function canSendRegularMessage(contactId: string): Promise<boolean> {
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { 
            waId: true,
            customAttributes: true,
            lastInboundMessageAt: true,
            platform: true,
            organization: {
                select: { whatsappConnectionMethod: true }
            }
        }
    });

    if (!contact) return false;

    // Website Widget contacts have NO 24-hour window restriction
    if (contact.waId?.startsWith('web_') || (contact.customAttributes as any)?.channel === 'website_widget') {
        return true;
    }

    // Multi-Device QR companion connections have NO 24-hour Meta customer service window
    if (contact.organization?.whatsappConnectionMethod === 'qr') {
        return true;
    }

    let lastInboundTime = contact?.lastInboundMessageAt
        ? new Date(contact.lastInboundMessageAt as any).getTime()
        : undefined;

    // Fallback: Check Message table for latest inbound message (self-healing)
    if (!lastInboundTime) {
        const lastInboundMsg = await prisma.message.findFirst({
            where: {
                contactId: contactId,
                direction: 'inbound'
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        if (lastInboundMsg) {
            lastInboundTime = lastInboundMsg.createdAt.getTime();

            // Optional: Async update the contact to fix data inconsistency
            // Not awaiting this to keep response fast
            prisma.contact.update({
                where: { id: contactId },
                data: { lastInboundMessageAt: lastInboundMsg.createdAt }
            }).catch(console.error);
        }
    }

    if (!lastInboundTime) {
        return false; // No inbound message ever
    }

    const hoursSinceLastInbound = (Date.now() - lastInboundTime) / (1000 * 60 * 60);
    return hoursSinceLastInbound < 23.95;
}

async function getReplyMetadata(replyToMessageId?: string, replyToWaId?: string) {
    if (!replyToMessageId && !replyToWaId) return null;

    let targetMsg: any = null;
    if (replyToMessageId) {
        targetMsg = await prisma.message.findUnique({
            where: { id: replyToMessageId },
            include: { contact: true, sender: true }
        });
    }
    if (!targetMsg && replyToWaId) {
        targetMsg = await prisma.message.findUnique({
            where: { wamid: replyToWaId },
            include: { contact: true, sender: true }
        });
    }

    if (!targetMsg) {
        return {
            replyToId: replyToMessageId || null,
            replyToWaId: replyToWaId || null,
            replyPreview: "Original message unavailable",
            replySenderName: "Unknown",
            replyMessageType: "text"
        };
    }

    const senderName = targetMsg.direction === 'outbound'
        ? (targetMsg.sender?.name || 'You')
        : (targetMsg.contact?.name || targetMsg.contact?.waId || 'User');

    let preview = targetMsg.content || '';
    if (!preview) {
        preview = targetMsg.type ? `[${targetMsg.type.charAt(0).toUpperCase() + targetMsg.type.slice(1)}]` : 'Message';
    }

    return {
        replyToId: targetMsg.id,
        replyToWaId: targetMsg.wamid || replyToWaId || null,
        replyPreview: preview,
        replySenderName: senderName,
        replyMessageType: targetMsg.type || 'text'
    };
}

export async function internalSendWhatsAppMessage(
    contactId: string, 
    message: string, 
    existingContact?: any, 
    interactiveData?: any, 
    skipWindowCheck: boolean = false, 
    senderId?: string,
    replyToMessageId?: string,
    replyToWaId?: string,
    channelId?: string
): Promise<any> {
    const safeMessage = sanitizeCustomerMessage(message);

    // 1. Fetch contact and organization if not provided or incomplete
    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const platform = (contact.platform || 'WHATSAPP').toUpperCase().trim();
    if (platform !== 'WHATSAPP') {
        if (platform === 'FACEBOOK' || platform === 'MESSENGER' || platform === 'FACEBOOK_MESSENGER') {
            const { internalSendFacebookMessage } = await import('@/lib/facebook/api');
            return await internalSendFacebookMessage(contactId, safeMessage, contact, senderId, interactiveData as any);
        }
        if (platform === 'INSTAGRAM' || platform === 'IG') {
            const { internalSendInstagramMessage } = await import('@/lib/instagram/api');
            return await internalSendInstagramMessage(contactId, safeMessage, contact, senderId, interactiveData as any);
        }
        if (platform === 'TIKTOK') {
            const { internalSendTikTokMessage } = await import('@/lib/tiktok/api');
            return await internalSendTikTokMessage(contactId, safeMessage, contact, senderId);
        }
        const { sendUnifiedMessage } = await import('@/lib/messaging/api');
        return await sendUnifiedMessage({
            contactId,
            message: safeMessage,
            senderId,
            existingContact: contact,
            interactiveData: interactiveData as any,
            skipWindowCheck,
            replyToMessageId,
            replyToWaId,
            channelId
        });
    }

    const resolvedMessage = resolveContactVariables(safeMessage, contact);
    const org = contact.organization;

    // Resolve channel credentials dynamically
    const { resolveSenderCredentials } = await import('@/lib/whatsapp/channel-resolver');
    const creds = await resolveSenderCredentials(org.id, channelId);

    const isQrConnection = creds?.isQr || org.whatsappConnectionMethod === 'qr';

    // Multi-Device QR companion connections have NO 24-hour customer service window
    if (isQrConnection) {
        const { sendQRWhatsAppMessage } = await import('@/lib/whatsapp/qr/service');
        return await sendQRWhatsAppMessage({
            organizationId: org.id,
            contactId,
            recipientPhone: contact.waId || contact.phoneNumber || '',
            messageText: resolvedMessage,
            senderId,
            replyToMessageId,
            replyToWaId,
            interactiveData,
        });
    }

    // 2. Check 24-hour window logic (for Meta Cloud API)
    let lastInboundTime = contact.lastInboundMessageAt
        ? new Date(contact.lastInboundMessageAt as any).getTime()
        : undefined;

    // Fallback: Check Message table if not set on contact (rare self-healing)
    if (!lastInboundTime) {
        const lastInboundMsg = await prisma.message.findFirst({
            where: {
                contactId: contactId,
                direction: 'inbound'
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });
        if (lastInboundMsg) {
            lastInboundTime = lastInboundMsg.createdAt.getTime();
            // Fire and forget update
            prisma.contact.update({
                where: { id: contactId },
                data: { lastInboundMessageAt: lastInboundMsg.createdAt }
            }).catch(console.error);
        }
    }

    const isWindowExpired = !lastInboundTime || (Date.now() - lastInboundTime) >= (24 * 60 * 60 * 1000);

    if (!skipWindowCheck) {
        if (isWindowExpired) {
            throw new Error(`Cannot send regular message. User (${contact.waId}) has not messaged in the last 24 hours. (Last: ${lastInboundTime ? new Date(lastInboundTime).toISOString() : 'Never'})`);
        }
    } else if (isWindowExpired) {
        // Log warning but continue
        logger.message.warn(`[SendMsg] Window expired for ${contact.waId} but skipWindowCheck is ON. Attempting send anyway. (Last inbound: ${lastInboundTime ? new Date(lastInboundTime).toISOString() : 'Never'})`);
    }

    // 3. Prepare Meta Cloud API Payload
    const accessToken = creds?.accessToken || org.metaAccessToken;
    const phoneNumberId = creds?.phoneNumberId || org.whatsappPhoneNumberId;

    if (!accessToken || !phoneNumberId) {
        throw new Error('WhatsApp not configured for this organization');
    }

    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const replyMeta = await getReplyMetadata(replyToMessageId, replyToWaId);

    const payload: any = {
        messaging_product: 'whatsapp',
        to: contact.waId,
    };

    if (replyMeta?.replyToWaId) {
        payload.context = {
            message_id: replyMeta.replyToWaId
        };
    }

    const isValidInteractive = !!(
        interactiveData &&
        typeof interactiveData === 'object' &&
        interactiveData.type &&
        (interactiveData.action || interactiveData.type === 'cta_url')
    );

    if (isValidInteractive) {
        payload.type = 'interactive';
        
        if (interactiveData.action?.buttons && !interactiveData._processed) {
            interactiveData.action.buttons = prepareInteractiveButtons(interactiveData.action.buttons);
            interactiveData._processed = true;
        }

        // Clone to avoid polluting the original data with Meta-unfriendly keys
        const cleanInteractive = { ...interactiveData };
        delete cleanInteractive._processed;

        // Handle CTA URL button if there's only one and it's a URL
        if (cleanInteractive.type === 'button' && cleanInteractive.action?.buttons?.length === 1) {
            const btn = cleanInteractive.action.buttons[0];
            // Check if the ID suggests it's a URL link (encoded by our helper)
            if (btn.reply?.id?.startsWith('url_')) {
                const urlStr = btn.reply.id.split('::')[0].replace('url_', '');
                payload.interactive = {
                    type: 'cta_url',
                    body: { text: sanitizeCustomerMessage(cleanInteractive.body?.text || resolvedMessage || ' ') },
                    action: {
                        name: 'cta_url',
                        parameters: JSON.stringify({
                            display_text: btn.reply.title,
                            url: urlStr
                        })
                    }
                };
            } else {
                payload.interactive = cleanInteractive;
            }
        } else {
            if (cleanInteractive.body?.text) {
                cleanInteractive.body.text = sanitizeCustomerMessage(cleanInteractive.body.text);
            }
            payload.interactive = cleanInteractive;
        }
    } else {
        payload.type = 'text';
        payload.text = { body: resolvedMessage };
    }

    // 4. Send to Meta
    console.log(`[internalSend] Sending to Meta: ${url}`);
    console.log(`[internalSend] Payload: ${JSON.stringify(payload, null, 2)}`);

    const callOrg = {
        id: org.id,
        metaAccessToken: accessToken,
        instagramAccessToken: org.instagramAccessToken
    };
    const { status, data } = await callMetaWhatsAppAPI(url, payload, callOrg);

    if (data.error) {
        console.error('[InternalSend] Meta API Error:', JSON.stringify(data.error, null, 2));
        await handleMetaError(data.error, org.id);
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    // 5. Save DB & Update Contact (Parallel)
    const displayContent = isValidInteractive ? `[Interactive] ${resolvedMessage}` : resolvedMessage;
    const msgType = isValidInteractive ? 'interactive' : 'text';

    const [newMessage] = await Promise.all([
        prisma.message.create({
            data: {
                contactId: contact.id,
                channelId: creds?.channelId || channelId || null,
                senderId: senderId,
                wamid: data.messages?.[0]?.id,
                type: msgType,
                direction: 'outbound',
                status: 'sent',
                content: displayContent,
                rawBody: payload,
                ...(replyMeta ? {
                    replyToId: replyMeta.replyToId,
                    replyToWaId: replyMeta.replyToWaId,
                    replyPreview: replyMeta.replyPreview,
                    replySenderName: replyMeta.replySenderName,
                    replyMessageType: replyMeta.replyMessageType
                } : {})
            }
        }),
        prisma.contact.update({
            where: { id: contact.id },
            data: {
                lastMessage: displayContent,
                lastMessageAt: new Date()
            }
        })
    ]);

    return newMessage;
}

export async function internalSendFlowMessage(
    contactId: string,
    flowPayload: WhatsAppFlowPayload,
    existingContact?: any,
    senderId?: string
) {
    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const org = contact.organization;
    if (!org.metaAccessToken || !org.whatsappPhoneNumberId) {
        throw new Error('WhatsApp not configured for this organization');
    }

    const normalizedFlowId = (flowPayload.flowId || '').trim();
    if (!normalizedFlowId) {
        throw new Error('Meta Flow ID is required');
    }

    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    const action: Record<string, unknown> = {
        name: 'flow',
        parameters: {
            flow_message_version: '3',
            flow_id: normalizedFlowId,
            flow_cta: (flowPayload.flowCta || 'Continue').slice(0, 30),
            flow_action: flowPayload.flowAction || 'navigate',
        }
    };

    if (flowPayload.flowToken?.trim()) {
        (action.parameters as Record<string, unknown>).flow_token = flowPayload.flowToken.trim();
    }

    if (flowPayload.flowMode) {
        (action.parameters as Record<string, unknown>).mode = flowPayload.flowMode;
    }

    if (flowPayload.flowAction === 'navigate' && flowPayload.flowScreen?.trim()) {
        (action.parameters as Record<string, unknown>).flow_action_payload = {
            screen: flowPayload.flowScreen.trim(),
            data: flowPayload.flowData || {}
        };
    } else if (flowPayload.flowAction === 'data_exchange' && flowPayload.flowData) {
        (action.parameters as Record<string, unknown>).flow_action_payload = {
            data: flowPayload.flowData
        };
    }

    const payload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to: contact.waId,
        type: 'interactive',
        interactive: {
            type: 'flow',
            ...(flowPayload.headerText ? { header: { type: 'text', text: flowPayload.headerText } } : {}),
            body: { text: flowPayload.bodyText || 'Please complete this form.' },
            ...(flowPayload.footerText ? { footer: { text: flowPayload.footerText } } : {}),
            action
        }
    };

    const { status, data } = await callMetaWhatsAppAPI(url, payload, org);

    if (data.error) {
        await handleMetaError(data.error, org.id);
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    const content = `[Meta Flow] ${flowPayload.flowCta || flowPayload.bodyText || 'Flow sent'}`;
    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId,
            wamid: data.messages?.[0]?.id,
            type: 'interactive',
            direction: 'outbound',
            status: 'sent',
            content,
            rawBody: payload as Prisma.InputJsonValue
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: content,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}

async function rehostWhatsAppMedia(mediaUrl: string, org: any): Promise<{ id?: string, link?: string } | null> {
    if (!mediaUrl) return null;

    let targetUrl = mediaUrl;
    // Auto-optimize Cloudinary image URLs to fit within Meta's 5 MB limit
    if (targetUrl.includes('cloudinary.com') && targetUrl.includes('/upload/') && !targetUrl.includes('/q_auto')) {
        targetUrl = targetUrl.replace('/upload/', '/upload/q_auto:good,f_auto,w_1600,c_limit/');
    }

    console.log(`[InternalTemplate] Attempting to re-host/upload media URL to Meta: ${targetUrl}`);
    try {
        let fetchRes = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });
        if (fetchRes.ok) {
            let buffer: Uint8Array = new Uint8Array(await fetchRes.arrayBuffer());
            const rawType = fetchRes.headers.get('content-type') || `image/jpeg`;
            let mimeType = rawType.split(';')[0].trim();
            let ext = mimeType.split('/')[1] || 'jpeg';

            let sizeInMB = buffer.byteLength / (1024 * 1024);
            const isImage = mimeType.startsWith('image/');
            const maxAllowedMB = isImage ? 5 : (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) ? 16 : 100;

            // If an image exceeds Meta's 5 MB limit (or for any oversized image header), compress it locally via sharp
            if (isImage && sizeInMB > maxAllowedMB) {
                console.log(`[InternalTemplate] Image file size (${sizeInMB.toFixed(2)} MB) exceeds Meta's 5 MB limit. Auto-compressing via sharp...`);
                try {
                    const sharp = (await import('sharp')).default;
                    const compressedBuffer = await sharp(Buffer.from(buffer))
                        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
                        .toBuffer();

                    buffer = new Uint8Array(compressedBuffer);
                    sizeInMB = buffer.byteLength / (1024 * 1024);
                    mimeType = 'image/jpeg';
                    ext = 'jpg';
                    console.log(`[InternalTemplate] Image compressed successfully via sharp! New size: ${sizeInMB.toFixed(2)} MB`);
                } catch (sharpErr) {
                    console.error(`[InternalTemplate] Local sharp image compression error:`, sharpErr);
                }
            }

            if (sizeInMB > maxAllowedMB) {
                console.warn(`[InternalTemplate] Media file size (${sizeInMB.toFixed(2)} MB) exceeds Meta limit of ${maxAllowedMB} MB for ${mimeType}.`);
            }

            const blob = new Blob([buffer as any], { type: mimeType });
            const formData = new FormData();
            formData.append('file', blob, `media.${ext}`);
            formData.append('type', mimeType);
            formData.append('messaging_product', 'whatsapp');

            const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${org.metaAccessToken}` },
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.id) {
                console.log(`[InternalTemplate] Re-hosted successfully to Meta media endpoint. Media ID: ${uploadData.id}`);
                return { id: uploadData.id };
            } else {
                console.error(`[InternalTemplate] Meta media upload endpoint error:`, uploadData);
            }
        } else {
            console.error(`[InternalTemplate] Failed to fetch mediaUrl server-side: HTTP ${fetchRes.status}`);
        }
    } catch (e) {
        console.error(`[InternalTemplate] Error re-hosting media:`, e);
    }
    return { link: targetUrl }; // fallback to returning the original link if upload fails
}

export async function internalSendTemplateMessage(
    contactId: string,
    templateName: string,
    languageCode: string = 'en',
    components?: any[],
    senderId?: string
) {
    let finalLang = languageCode;

    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: { organization: true }
    });

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const org = contact.organization;

    if (!org.metaAccessToken || !org.whatsappPhoneNumberId) {
        throw new Error('WhatsApp not configured');
    }

    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    // Track original sent header media URL before Meta re-hosting/upload
    let originalHeaderMediaUrl: string | null = null;
    if (components) {
        for (const comp of components) {
            if (comp.type === 'header' || comp.type === 'HEADER') {
                for (const param of (comp.parameters || [])) {
                    if (param.type === 'image' || param.type === 'video' || param.type === 'document' || param.type === 'audio') {
                        const mediaObj = param[param.type];
                        if (mediaObj && (mediaObj.link || mediaObj.url)) {
                            originalHeaderMediaUrl = mediaObj.link || mediaObj.url;
                        }
                    }
                }
            }
        }
    }

    // Automatically re-host WhatsApp CDN links to prevent delivery failures
    if (components) {
        for (const comp of components) {
            if (comp.type === 'header' || comp.type === 'HEADER') {
                for (const param of (comp.parameters || [])) {
                    if (param.type === 'image' || param.type === 'video' || param.type === 'document' || param.type === 'audio') {
                        const mediaObj = param[param.type];
                        if (mediaObj && mediaObj.link) {
                            const newMedia = await rehostWhatsAppMedia(mediaObj.link, org);
                            if (newMedia) {
                                delete mediaObj.link;
                                if (newMedia.id) mediaObj.id = newMedia.id;
                                else if (newMedia.link) mediaObj.link = newMedia.link;
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`[InternalTemplate] Calling Meta for ${contactId}. Template: ${templateName}, Lang: ${languageCode}, Components: ${JSON.stringify(components)}`);
    const templateObj: any = {
        name: templateName,
        language: { code: finalLang }
    };

    if (components && components.length > 0) {
        templateObj.components = components;
    }

    const payload = {
        messaging_product: 'whatsapp',
        to: contact.waId,
        type: 'template',
        template: templateObj
    };

    let { status, data } = await callMetaWhatsAppAPI(url, payload, org);

    // Smart Fallback for Language Mismatch (Meta Error 132001)
    if (data.error && data.error.code === 132001 && data.error.message.includes('translation')) {
        let fallbackLang = null;
        if (finalLang === 'en') fallbackLang = 'en_US';
        else if (finalLang === 'en_US') fallbackLang = 'en';
        else if (finalLang === 'ru') fallbackLang = 'ru_RU';
        else if (finalLang === 'ru_RU') fallbackLang = 'ru';

        if (fallbackLang) {
            console.log(`[InternalTemplate] Language mismatch for ${finalLang}. Retrying with fallback: ${fallbackLang}`);
            payload.template.language.code = fallbackLang;
            const retryRes = await callMetaWhatsAppAPI(url, payload, org);
            if (!retryRes.data.error) {
                data = retryRes.data;
                status = retryRes.status;
                finalLang = fallbackLang; // Update for logging/rawBody
            }
        }
    }

    // Smart Fallback for Media Upload/Download Error (Meta Error 131053, 131052, 131051, 131009, 131056)
    if (data.error && [131053, 131052, 131051, 131009, 131056].includes(data.error.code)) {
        console.log(`[InternalTemplate] Meta Media Error ${data.error.code} (${data.error.message}). Re-uploading media binary to Meta...`);
        let mediaReuploaded = false;
        if (payload.template?.components) {
            for (const comp of payload.template.components) {
                if (comp.type === 'header' || comp.type === 'HEADER') {
                    for (const param of (comp.parameters || [])) {
                        const mediaType = param.type;
                        if (mediaType && param[mediaType]) {
                            const mediaObj = param[mediaType];
                            const linkToUpload = mediaObj.link || mediaObj.url;
                            if (linkToUpload) {
                                const newMedia = await rehostWhatsAppMedia(linkToUpload, org);
                                if (newMedia && newMedia.id) {
                                    delete mediaObj.link;
                                    delete mediaObj.url;
                                    mediaObj.id = newMedia.id;
                                    mediaReuploaded = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (mediaReuploaded) {
            console.log(`[InternalTemplate] Media successfully uploaded as Meta media_id. Retrying template send...`);
            const retryRes = await callMetaWhatsAppAPI(url, payload, org);
            data = retryRes.data;
            status = retryRes.status;
        }
    }

     if (data.error && data.error.code === 132012 && data.error.error_data?.details?.includes('expected IMAGE')) {
        console.log(`[InternalTemplate] Missing image header for template. Fetching default from Meta...`);
        try {
            const templateRes = await fetch(`https://graph.facebook.com/v21.0/${org.whatsappBusinessId}/message_templates?name=${templateName}`, {
                headers: { 'Authorization': `Bearer ${org.metaAccessToken}` }
            });
            const templateData = await templateRes.json();
            const matchingTemplate = templateData.data?.find((t: any) => t.language === finalLang);
            
            let defaultImageUrl = null;
            if (matchingTemplate) {
                const headerComp = matchingTemplate.components?.find((c: any) => c.type === 'HEADER' && c.format === 'IMAGE');
                if (headerComp?.example?.header_handle?.[0]) {
                    defaultImageUrl = headerComp.example.header_handle[0];
                }
            }

            if (defaultImageUrl) {
                console.log(`[InternalTemplate] Found default image from Meta. Retrying...`);
                if (!payload.template.components) payload.template.components = [];
                
                let mediaPayload: any = { link: defaultImageUrl };
                const newMedia = await rehostWhatsAppMedia(defaultImageUrl, org);
                if (newMedia) {
                    mediaPayload = newMedia;
                }

                const existingHeader = payload.template.components.find((c: any) => c.type === 'header');
                if (!existingHeader) {
                    payload.template.components.push({
                        type: 'header',
                        parameters: [{ type: 'image', image: mediaPayload }]
                    });
                } else {
                    existingHeader.parameters = [{ type: 'image', image: mediaPayload }];
                }
                
                const retryRes = await callMetaWhatsAppAPI(url, payload, org);
                data = retryRes.data;
                status = retryRes.status;
                if (retryRes.data.error) {
                    console.log(`[InternalTemplate] Fallback retry also failed: ${retryRes.data.error.message}`);
                }
            }
        } catch (fetchErr) {
            console.error('[InternalTemplate] Failed to fetch default template image:', fetchErr);
        }
    }

    // Smart Fallback for Calling API Not Enabled (Meta Error 138000)
    if (data.error && data.error.code === 138000) {
        console.log(`[InternalTemplate] Meta Calling API disabled (Error 138000). Auto-enabling calling status for phone number ${org.whatsappPhoneNumberId}...`);
        try {
            const settingsUrl = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/settings`;
            const settingsPayload = {
                messaging_product: 'whatsapp',
                calling: {
                    status: 'ENABLED'
                }
            };
            const settingsRes = await callMetaWhatsAppAPI(settingsUrl, settingsPayload, org);
            console.log(`[InternalTemplate] Calling settings updated:`, JSON.stringify(settingsRes.data));

            console.log(`[InternalTemplate] Retrying template message send after enabling calling...`);
            const retryRes = await callMetaWhatsAppAPI(url, payload, org);
            data = retryRes.data;
            status = retryRes.status;
        } catch (enableErr) {
            console.error('[InternalTemplate] Failed to auto-enable calling status via Meta API:', enableErr);
        }

        // If calling is disabled/restricted on this phone number, bypass the voice call button and deliver the template directly to the contact
        if (data.error && data.error.code === 138000) {
            console.log(`[InternalTemplate] Calling not supported on this phone number. Bypassing voice call button and delivering template directly to ${contact.waId}...`);
            try {
                let headerText = '';
                let bodyText = '';
                let buttons: any[] = [];

                if (org.whatsappBusinessId && org.metaAccessToken) {
                    const tRes = await fetch(`https://graph.facebook.com/v21.0/${org.whatsappBusinessId}/message_templates?name=${encodeURIComponent(templateName)}`, {
                        headers: { 'Authorization': `Bearer ${org.metaAccessToken}` }
                    });
                    const tData = await tRes.json();
                    const matched = tData.data?.find((t: any) => t.language === finalLang) || tData.data?.[0];
                    if (matched?.components) {
                        for (const comp of matched.components) {
                            if (comp.type === 'HEADER' && comp.text) headerText = comp.text;
                            if (comp.type === 'BODY' && comp.text) bodyText = comp.text;
                            if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
                                buttons = comp.buttons
                                    .filter((b: any) => b.type !== 'VOICE_CALL')
                                    .slice(0, 3)
                                    .map((b: any) => ({
                                        type: 'reply',
                                        reply: {
                                            id: `btn_${(b.text || 'action').slice(0, 20).replace(/\s+/g, '_')}`,
                                            title: (b.text || 'Action').slice(0, 20)
                                        }
                                    }));
                            }
                        }
                    }
                }

                // Replace positional parameters in bodyText
                const bodyComp = payload.template?.components?.find((c: any) => c.type?.toLowerCase() === 'body');
                if (bodyComp?.parameters && Array.isArray(bodyComp.parameters)) {
                    bodyComp.parameters.forEach((param: any, idx: number) => {
                        bodyText = bodyText.replace(`{{${idx + 1}}}`, param.text || '');
                    });
                }

                if (!bodyText) {
                    bodyText = `Template: ${templateName}`;
                }

                const fallbackPayload: any = {
                    messaging_product: 'whatsapp',
                    to: contact.waId,
                    type: buttons.length > 0 ? 'interactive' : 'text',
                    ...(buttons.length > 0 ? {
                        interactive: {
                            type: 'button',
                            ...(headerText ? { header: { type: 'text', text: headerText } } : {}),
                            body: { text: bodyText },
                            action: { buttons }
                        }
                    } : {
                        text: { body: headerText ? `*${headerText}*\n\n${bodyText}` : bodyText }
                    })
                };

                const directRes = await callMetaWhatsAppAPI(url, fallbackPayload, org);
                if (!directRes.data.error) {
                    data = directRes.data;
                    status = directRes.status;
                    console.log(`[InternalTemplate] Bypassed voice call successfully, delivered directly to ${contact.waId}! WAMID:`, data.messages?.[0]?.id);
                } else {
                    console.error(`[InternalTemplate] Direct fallback send error:`, directRes.data.error);
                }
            } catch (bypassErr) {
                console.error(`[InternalTemplate] Error bypassing voice call button:`, bypassErr);
            }
        }
    }

    // Smart Fallback for Invalid Phone Number ID / WABA ID Mismatch (Meta Error 100 subcode 33)
    if (data.error && data.error.code === 100 && (data.error.error_subcode === 33 || data.error.message?.includes('does not exist'))) {
        console.log(`[InternalTemplate] Meta Error 100 subcode 33 for org ${org.id} (ID: ${org.whatsappPhoneNumberId}). Attempting auto-resolution of Phone Number ID from Meta...`);
        try {
            const wabaIdToQuery = org.whatsappBusinessId || org.whatsappPhoneNumberId;
            if (wabaIdToQuery && org.metaAccessToken) {
                const phoneNumbersRes = await fetch(`https://graph.facebook.com/v21.0/${wabaIdToQuery}/phone_numbers`, {
                    headers: { 'Authorization': `Bearer ${org.metaAccessToken}` }
                });
                const phoneNumbersData = await phoneNumbersRes.json();
                console.log(`[InternalTemplate] Phone numbers query result for WABA ${wabaIdToQuery}:`, JSON.stringify(phoneNumbersData));
                if (phoneNumbersData.data && Array.isArray(phoneNumbersData.data) && phoneNumbersData.data.length > 0) {
                    const validPhoneObj = phoneNumbersData.data[0];
                    if (validPhoneObj.id && validPhoneObj.id !== org.whatsappPhoneNumberId) {
                        console.log(`[InternalTemplate] Found correct Phone Number ID ${validPhoneObj.id} (display: ${validPhoneObj.display_phone_number}). Updating DB and retrying...`);
                        await prisma.organization.update({
                            where: { id: org.id },
                            data: {
                                whatsappPhoneNumberId: validPhoneObj.id,
                                whatsappNumber: validPhoneObj.display_phone_number?.replace(/\D/g, '') || org.whatsappNumber
                            }
                        }).catch(e => console.error('[InternalTemplate] DB update error:', e));

                        const newUrl = `https://graph.facebook.com/v21.0/${validPhoneObj.id}/messages`;
                        const retryRes = await callMetaWhatsAppAPI(newUrl, payload, org);
                        data = retryRes.data;
                        status = retryRes.status;
                    }
                }
            }
        } catch (autoFixErr) {
            console.error('[InternalTemplate] Auto-resolution of Phone Number ID failed:', autoFixErr);
        }
    }

    // Auto-heal for Missing Button Parameter (Meta Error 131008)
    const buttonDetail = data?.error?.error_data?.details || data?.error?.message || '';
    const buttonErrorMatch = buttonDetail.match(/Button at index (\d+) of type (\w+) requires a parameter/i);
    if (data.error && data.error.code === 131008 && buttonErrorMatch) {
        const btnIndex = buttonErrorMatch[1];
        const btnType = buttonErrorMatch[2].toLowerCase();

        const bodyComp = payload.template.components?.find((c: any) => c.type?.toLowerCase() === 'body');
        const candidateParam = bodyComp?.parameters?.[0]?.text || '1';

        const newComponents = [...(payload.template.components || [])];
        const filteredComponents = newComponents.filter((c: any) => !(c.type === 'button' && String(c.index) === String(btnIndex)));

        filteredComponents.push({
            type: 'button',
            sub_type: btnType === 'copy_code' ? 'copy_code' : 'url',
            index: btnIndex,
            parameters: [
                btnType === 'copy_code'
                    ? { type: 'coupon_code', coupon_code: candidateParam }
                    : { type: 'text', text: candidateParam }
            ]
        });

        payload.template.components = filteredComponents;
        console.log(`[InternalTemplate] Auto-healing missing button parameter for button index ${btnIndex} (type: ${btnType}). Retrying with parameter: ${candidateParam}...`);
        const retryRes = await callMetaWhatsAppAPI(url, payload, org);
        data = retryRes.data;
        status = retryRes.status;
    }

    if (data.error) {
        console.error('[InternalTemplate] Meta API Error:', JSON.stringify(data.error, null, 2));
        await handleMetaError(data.error, org.id);
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    const paramPreview = components?.flatMap(c => c.parameters || []).map(p => p.text).join(', ');
    const displayContent = `Template: ${templateName}${paramPreview ? ` (${paramPreview})` : ''}`;

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            wamid: data.messages?.[0]?.id,
            type: 'template',
            direction: 'outbound',
            status: 'sent',
            content: displayContent,
            mediaUrl: originalHeaderMediaUrl,
            rawBody: JSON.stringify({
                ...templateObj,
                media_url: originalHeaderMediaUrl,
                mediaUrl: originalHeaderMediaUrl,
            }) as any
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: `Template: ${templateName}`,
            lastMessageAt: new Date()
        }
    });

    console.log(`[InternalTemplate] ✅ Sent WhatsApp Template "${templateName}" (${finalLang}) to ${contact.waId}! WAMID: ${data.messages?.[0]?.id}`);

    // Broadcast to Live Chat in real-time
    try {
        const { triggerPusherOrgEvent } = await import('@/lib/pusher');
        await Promise.allSettled([
            triggerPusherOrgEvent(org.id, 'new-message', {
                message: newMessage,
                contactId: contact.id,
            }),
            triggerPusherOrgEvent(org.id, 'message:outbound', {
                contactId: contact.id,
                message: newMessage,
            }),
        ]);
    } catch (pushErr: any) {
        console.error('[InternalTemplate] Pusher broadcast error:', pushErr?.message);
    }

    return newMessage;
}

function detectMediaType(url: string, defaultType: string): string {
    const normDefault = (defaultType || '').toLowerCase().trim();
    if (normDefault === 'audio' || normDefault === 'voice') return 'audio';

    const ext = url ? url.split('?')[0].split('.').pop()?.toLowerCase() : '';
    if (ext) {
        const audio = ['mp3', 'ogg', 'm4a', 'wav', 'aac', 'opus'];
        const images = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        const videos = ['mp4', '3gp', 'mov', 'webm', 'mkv', 'avi', 'm4v'];
        const docs = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', 'csv'];

        if (audio.includes(ext)) return 'audio';
        if (videos.includes(ext)) return 'video';
        if (images.includes(ext)) return 'image';
        if (docs.includes(ext)) return 'document';
    }

    if (normDefault === 'video') return 'video';
    if (normDefault === 'image') return 'image';
    if (normDefault === 'document' || normDefault === 'file') return 'document';

    return 'image';
}


export async function internalSendMediaMessage(
    contactId: string,
    contentType: string,
    fileUrl: string,
    caption?: string,
    buttons?: any[],
    existingContact?: any,
    senderId?: string,
    replyToMessageId?: string,
    replyToWaId?: string,
    fileName?: string,
    mimetype?: string
): Promise<any> {
    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const platform = (contact.platform || 'WHATSAPP').toUpperCase().trim();
    if (platform !== 'WHATSAPP') {
        if (platform === 'FACEBOOK' || platform === 'MESSENGER' || platform === 'FACEBOOK_MESSENGER') {
            const { internalSendMetaMediaMessage } = await import('@/lib/facebook/api');
            const metaType = contentType === 'video' || contentType === 'audio' || contentType === 'file' ? contentType : 'image';
            return await internalSendMetaMediaMessage(contactId, metaType, fileUrl, caption || '', contact, senderId, undefined);
        }
        if (platform === 'INSTAGRAM' || platform === 'IG') {
            const { internalSendInstagramMessage } = await import('@/lib/instagram/api');
            return await internalSendInstagramMessage(contactId, caption || '', contact, senderId, undefined, fileUrl);
        }
        const { sendUnifiedMessage } = await import('@/lib/messaging/api');
        return await sendUnifiedMessage({
            contactId,
            message: caption || '',
            senderId,
            existingContact: contact,
            mediaUrl: fileUrl,
            contentType,
            fileName,
            mimetype,
            replyToMessageId,
            replyToWaId,
        });
    }

    const resolvedCaption = caption && caption !== '__voice__' && caption !== '[Voice Message]' && caption !== '[Voice]'
        ? resolveContactVariables(caption, contact)
        : caption;

    const org = contact.organization;
    if (org.whatsappConnectionMethod === 'qr') {
        const { sendQRWhatsAppMessage } = await import('@/lib/whatsapp/qr/service');
        return await sendQRWhatsAppMessage({
            organizationId: org.id,
            contactId,
            recipientPhone: contact.waId || contact.phoneNumber || '',
            messageText: resolvedCaption || '',
            senderId,
            mediaUrl: fileUrl,
            contentType,
            fileName,
            mimetype,
            replyToMessageId,
            replyToWaId,
            buttons,
        });
    }

    if (!org.metaAccessToken || !org.whatsappPhoneNumberId) {
        throw new Error('WhatsApp not configured');
    }

    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    const replyMeta = await getReplyMetadata(replyToMessageId, replyToWaId);

    // Map content type to WhatsApp type with auto-detection safety
    let waType = detectMediaType(fileUrl, contentType);

    console.log(`[MediaSend] Processing media message. Type: ${waType}, Caption: ${caption ? caption.slice(0, 30) + '...' : 'NONE'}, Buttons: ${buttons?.length || 0}`);

    let payload: any;

    if (buttons && buttons.length > 0) {
        // Send as Interactive Message with Media Header
        const processedButtons = prepareInteractiveButtons(buttons);
        const headerType = waType === 'audio' ? 'text' : waType;
        const mediaHeaderObj = headerType === 'text' 
            ? { type: 'text', text: '🎵 Audio' }
            : {
                type: headerType,
                [headerType]: {
                    link: fileUrl,
                    ...(headerType === 'document' ? { filename: fileUrl.split('/').pop()?.split('?')[0] || 'file' } : {})
                }
            };

        // Special case: Only 1 button and it's a URL -> use cta_url for native link
        if (processedButtons.length === 1 && processedButtons[0].reply.id.startsWith('url_')) {
            const btn = processedButtons[0];
            payload = {
                messaging_product: 'whatsapp',
                to: contact.waId,
                type: 'interactive',
                interactive: {
                    type: 'cta_url',
                    header: mediaHeaderObj,
                    body: { text: resolvedCaption || ' ' },
                    action: {
                        name: 'cta_url',
                        parameters: JSON.stringify({
                            display_text: btn.reply.title,
                            url: btn.reply.id.split('::')[0].replace('url_', '')
                        })
                    }
                }
            };
        } else {
            payload = {
                messaging_product: 'whatsapp',
                to: contact.waId,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    header: mediaHeaderObj,
                    body: {
                        text: resolvedCaption || ' '
                    },
                    action: {
                        buttons: processedButtons
                    }
                }
            };
        }
    } else {
        // Handle audio & voice notes for WhatsApp Cloud API
        let mediaLink = fileUrl;
        const normContent = (contentType || '').toLowerCase().trim();
        const isVoiceNote = normContent === 'voice' || 
                            waType === 'voice' || 
                            caption === '__voice__' || 
                            caption === '[Voice Message]' || 
                            caption === '[Voice]' ||
                            mediaLink.includes('ac_opus') ||
                            (normContent === 'audio' && (!caption || caption === '__voice__' || caption === '[Voice Message]' || caption === '[Voice]'));
        let shouldSetVoiceTrue = false;
        let uploadedMediaId: string | null = null;

        if (isVoiceNote) {
            shouldSetVoiceTrue = true;

            // Follow the exact CRM approach: resolve audio buffer, ensure Ogg Opus, and upload directly to Meta /media endpoint
            try {
                let audioBuffer: Buffer | null = null;
                const cleanFileUrl = fileUrl.split('?')[0];
                if (cleanFileUrl.includes('/api/media/files/')) {
                    const relPart = cleanFileUrl.split('/api/media/files/')[1];
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

                if (!audioBuffer && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
                    const fetchRes = await fetch(fileUrl);
                    if (fetchRes.ok) {
                        audioBuffer = Buffer.from(await fetchRes.arrayBuffer());
                    }
                }

                if (audioBuffer) {
                    const { transcodeToWhatsAppOggOpus, isOggOpusBuffer } = await import('@/lib/chat/audio-transcoder');
                    try {
                        audioBuffer = await transcodeToWhatsAppOggOpus(audioBuffer);
                    } catch (transcodeErr) {
                        console.warn('[InternalSendMedia] Audio transcode error:', transcodeErr);
                    }

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
                        headers: {
                            'Authorization': `Bearer ${org.metaAccessToken}`
                        },
                        body: uploadFormData
                    });

                    const uploadData = await uploadRes.json();
                    if (uploadData?.id) {
                        uploadedMediaId = uploadData.id;
                    } else if (uploadData?.error) {
                        console.warn('[InternalSendMedia] Meta media upload failed:', uploadData.error);
                    }
                }
            } catch (mediaUploadErr) {
                console.warn('[InternalSendMedia] Failed direct Meta media upload for voice note:', mediaUploadErr);
            }
        }

        const targetWaType = (waType === 'voice' || isVoiceNote) ? 'audio' : waType;
        const cleanCaption = (resolvedCaption === '__voice__' || resolvedCaption === '[Voice Message]' || resolvedCaption === '[Voice]') ? undefined : resolvedCaption;
        let docFileName = fileName || fileUrl.split('/').pop()?.split('?')[0] || 'document';
        if (resolvedCaption && /\.(docx|doc|pdf|xlsx|xls|pptx|ppt|txt|csv|zip|rar)$/i.test(resolvedCaption.trim())) {
            docFileName = resolvedCaption.trim();
        }

        // Send as standard Media Message
        if (uploadedMediaId && targetWaType === 'audio') {
            payload = {
                messaging_product: 'whatsapp',
                to: contact.waId,
                type: 'audio',
                audio: {
                    id: uploadedMediaId,
                    voice: true
                }
            };
        } else {
            const isOggLink = mediaLink.endsWith('.ogg') || mediaLink.includes('ac_opus');
            payload = {
                messaging_product: 'whatsapp',
                to: contact.waId,
                type: targetWaType,
                [targetWaType]: {
                    link: mediaLink,
                    ...(waType === 'document' ? { filename: docFileName } : {}),
                    ...(shouldSetVoiceTrue && isOggLink ? { voice: true } : {}),
                    ...(cleanCaption && targetWaType !== 'audio' ? { caption: cleanCaption } : {})
                }
            };
        }
    }

    if (replyMeta?.replyToWaId) {
        payload.context = {
            message_id: replyMeta.replyToWaId
        };
    }

    console.log(`[MediaSend] Final Payload for Meta: ${JSON.stringify(payload, null, 2)}`);

    const { status, data } = await callMetaWhatsAppAPI(url, payload, org);

    if (data.error) {
        console.error('[InternalSendMedia] Meta API Error:', JSON.stringify(data.error, null, 2));
        await handleMetaError(data.error, org.id);
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    const normContent = (contentType || '').toLowerCase().trim();
    const isVoice = normContent === 'voice' || waType === 'voice' || payload.audio?.voice === true;

    const displayContent = resolvedCaption && resolvedCaption !== '__voice__'
        ? resolvedCaption
        : isVoice 
            ? '[Voice Message]' 
            : `[${waType.charAt(0).toUpperCase() + waType.slice(1)}]`;

    const lastMsgSnippet = isVoice 
        ? '🎤 Voice message' 
        : waType === 'audio' 
            ? '🎵 Audio attachment' 
            : displayContent;

    const savedRawBody = {
        ...payload,
        ...(isVoice ? { voice: true, isVoice: true } : { voice: false })
    };

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            wamid: data.messages?.[0]?.id,
            type: waType === 'interactive' ? 'button' : (waType === 'voice' ? 'audio' : waType),
            direction: 'outbound',
            status: 'sent',
            content: displayContent,
            mediaUrl: fileUrl.startsWith('/api/media/') && !fileUrl.includes('orgId=') 
                ? `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}orgId=${org.id}`
                : fileUrl,
            rawBody: savedRawBody as Prisma.InputJsonValue,
            ...(replyMeta ? {
                replyToId: replyMeta.replyToId,
                replyToWaId: replyMeta.replyToWaId,
                replyPreview: replyMeta.replyPreview,
                replySenderName: replyMeta.replySenderName,
                replyMessageType: replyMeta.replyMessageType
            } : {})
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: lastMsgSnippet,
            lastMessageAt: new Date()
        }
    });

    // If it's a button message, we need to pause the flow and wait for response
    if (buttons && buttons.length > 0) {
        // This is handled by the Flow Engine caller usually, 
        // but we return the message so it knows it was a pause-point.
    }

    return newMessage;
}

export async function internalSendListMessage(
    contactId: string,
    header: string,
    body: string,
    footer: string,
    buttonText: string,
    sections: any[],
    existingContact?: any,
    senderId?: string
) {
    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const org = contact.organization;
    if (!org.metaAccessToken || !org.whatsappPhoneNumberId) {
        throw new Error('WhatsApp not configured');
    }

    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    // Sanitize and validate fields strictly according to Meta Cloud API limits:
    // 1. Button label: max 20 chars
    let safeButtonText = (buttonText || 'View Options').toString().trim();
    if (!safeButtonText) safeButtonText = 'View Options';
    if (safeButtonText.length > 20) {
        safeButtonText = safeButtonText.slice(0, 20).trim();
    }

    // 2. Header text: max 60 chars
    const safeHeader = header && typeof header === 'string' && header.trim() 
        ? header.trim().slice(0, 60).trim() 
        : undefined;

    // 3. Body text: max 1024 chars
    const safeBody = (body && typeof body === 'string' ? body.trim() : 'Please select an option:').slice(0, 1024);

    // 4. Footer text: max 60 chars
    const safeFooter = footer && typeof footer === 'string' && footer.trim() 
        ? footer.trim().slice(0, 60).trim() 
        : undefined;

    // 5. Sections and rows
    const rawSections = Array.isArray(sections) && sections.length > 0 ? sections : [{ title: 'Options', items: [] }];
    const safeSections = rawSections.map((s, sIdx) => {
        let sectionTitle = (s.title || `Section ${sIdx + 1}`).toString().trim().slice(0, 24).trim();
        if (!sectionTitle) sectionTitle = `Section ${sIdx + 1}`;

        const usedRowTitles = new Set<string>();
        const usedIds = new Set<string>();

        const rawItems = Array.isArray(s.items) ? s.items : (Array.isArray(s.rows) ? s.rows : []);
        const rows = rawItems.map((item: any, itemIdx: number) => {
            const rawItemTitle = (item?.title || item?.name || `Option ${itemIdx + 1}`).toString().trim();
            let title = rawItemTitle.slice(0, 24).trim();
            if (!title) title = `Option ${itemIdx + 1}`;

            let uniqueTitle = title;
            let counter = 1;
            while (usedRowTitles.has(uniqueTitle)) {
                const suffix = ` ${counter}`;
                uniqueTitle = title.slice(0, 24 - suffix.length) + suffix;
                counter++;
                if (counter > 9) break;
            }
            usedRowTitles.add(uniqueTitle);

            let rawId = item?.url ? `url_${item.url}` : (item?.id || rawItemTitle || `opt_${itemIdx}`);
            let id = String(rawId).slice(0, 200);
            let uniqueId = id;
            let idCounter = 1;
            while (usedIds.has(uniqueId)) {
                const suffix = `::${idCounter}`;
                uniqueId = id.slice(0, 200 - suffix.length) + suffix;
                idCounter++;
            }
            usedIds.add(uniqueId);

            const rowObj: any = {
                id: uniqueId,
                title: uniqueTitle
            };

            if (item?.description && typeof item.description === 'string' && item.description.trim()) {
                rowObj.description = item.description.trim().slice(0, 72).trim();
            }

            return rowObj;
        });

        return {
            title: sectionTitle,
            rows: rows.length > 0 ? rows : [{ id: `opt_${sIdx + 1}`, title: 'Option 1' }]
        };
    });

    const payload: any = {
        messaging_product: 'whatsapp',
        to: contact.waId,
        type: 'interactive',
        interactive: {
            type: 'list',
            ...(safeHeader ? { header: { type: 'text', text: safeHeader } } : {}),
            body: { text: safeBody },
            ...(safeFooter ? { footer: { text: safeFooter } } : {}),
            action: {
                button: safeButtonText,
                sections: safeSections
            }
        }
    };

    const { status, data } = await callMetaWhatsAppAPI(url, payload, org);

    if (data.error) {
        console.error('[InternalSendList] Meta API Error:', JSON.stringify(data.error, null, 2));
        await handleMetaError(data.error, org.id);
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    const displayContent = body || '[List Message]';

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            wamid: data.messages?.[0]?.id,
            type: 'button', // List selection comes back as button_reply or list_reply
            direction: 'outbound',
            status: 'sent',
            content: displayContent,
            rawBody: payload as any
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: displayContent,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}

export async function internalSendProductMessage(
    contactId: string,
    body: string,
    footer: string,
    catalogId: string,
    productRetailerId: string,
    existingContact?: any,
    senderId?: string
) {
    let contact = existingContact;
    if (!contact) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const org = contact.organization;
    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: contact.waId,
        type: 'interactive',
        interactive: {
            type: 'product',
            body: { text: body || 'Check out this product!' },
            ...(footer ? { footer: { text: footer } } : {}),
            action: {
                catalog_id: catalogId,
                product_retailer_id: productRetailerId
            }
        }
    };

    const { status, data } = await callMetaWhatsAppAPI(url, payload, org);

    if (data.error) {
        await handleMetaError(data.error, org.id);
        throw new Error(`Meta API Error: ${data.error.message}`);
    }

    const displayContent = body || '[Product Message]';

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            wamid: data.messages?.[0]?.id,
            type: 'product',
            direction: 'outbound',
            status: 'sent',
            content: displayContent,
            rawBody: payload as any
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: displayContent,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}

export async function internalSendMultiProductMessage(
    contactId: string,
    header: string,
    body: string,
    footer: string,
    catalogId: string,
    sections: any[],
    existingContact?: any,
    senderId?: string
) {
    let contact = existingContact;
    if (!contact) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const org = contact.organization;
    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    // Format sections for WhatsApp
    // sections: [{ title: string, product_retailer_ids: string[] }]
    const formattedSections = sections.map(s => ({
        title: s.title || 'Product Section',
        product_retailer_ids: s.items?.map((item: any) => item.retailer_id) || []
    })).filter(s => s.product_retailer_ids.length > 0);

    const payload = {
        messaging_product: 'whatsapp',
        to: contact.waId,
        type: 'interactive',
        interactive: {
            type: 'product_list',
            header: { type: 'text', text: header || 'Our Catalog' },
            body: { text: body || 'Browse our products below:' },
            ...(footer ? { footer: { text: footer } } : {}),
            action: {
                catalog_id: catalogId,
                sections: formattedSections
            }
        }
    };

    const { status, data } = await callMetaWhatsAppAPI(url, payload, org);
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);

    const displayContent = body || '[Multi-Product Message]';

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            wamid: data.messages?.[0]?.id,
            type: 'multi_product',
            direction: 'outbound',
            status: 'sent',
            content: displayContent,
            rawBody: payload as any
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: displayContent,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}

export async function internalSendCatalogueMessage(
    contactId: string,
    body: string,
    footer: string,
    existingContact?: any
) {
    let contact = existingContact;
    if (!contact) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const org = contact.organization;
    await enforceBotRepliesQuota(org.id);
    const url = `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: contact.waId,
        type: 'interactive',
        interactive: {
            type: 'catalog_message',
            body: { text: body || 'Check out our full catalog!' },
            ...(footer ? { footer: { text: footer } } : {}),
            action: {
                name: "catalog_message"
            }
        }
    };

    const { status, data } = await callMetaWhatsAppAPI(url, payload, org);
    if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);

    const displayContent = body || '[Catalogue Message]';

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            wamid: data.messages?.[0]?.id,
            type: 'catalogue',
            direction: 'outbound',
            status: 'sent',
            content: displayContent,
            rawBody: payload as any
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: displayContent,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}

export async function downloadWhatsAppMedia(mediaId: string, organizationId: string): Promise<{ buffer: Buffer, contentType: string }> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { metaAccessToken: true, instagramAccessToken: true }
    });

    if (!org?.metaAccessToken) {
        throw new Error('Organization not found or Meta access token missing');
    }

    // 1. Get Media Download URL from Meta
    const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const tokens = [org.metaAccessToken, (org as any).instagramAccessToken].filter((t): t is string => !!t);
    let metaData: any = null;
    let usedToken: string | null = null;

    for (const token of tokens) {
        const metaRes = await fetch(metaUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        metaData = await metaRes.json();
        if (!metaData.error && metaData.url) {
            usedToken = token;
            break;
        }
        if (tokens.indexOf(token) === tokens.length - 1) {
            if (metaData.error) await handleMetaError(metaData.error, organizationId);
            throw new Error(`Failed to retrieve media information: ${metaData.error?.message || 'Unknown error'}`);
        }
    }

    // 2. Fetch the actual media
    const downloadRes = await fetch(metaData.url, {
        headers: { 'Authorization': `Bearer ${usedToken}` }
    });

    if (!downloadRes.ok) {
        throw new Error('Failed to download media from Facebook');
    }

    const contentType = downloadRes.headers.get('Content-Type') || 'application/octet-stream';
    const arrayBuffer = await downloadRes.arrayBuffer();

    return {
        buffer: Buffer.from(arrayBuffer),
        contentType
    };
}
