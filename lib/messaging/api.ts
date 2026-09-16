import { prisma } from '@/lib/prisma';
import { internalSendWhatsAppMessage, internalSendTemplateMessage } from '@/lib/whatsapp/api';
import type { WhatsAppFlowPayload } from '@/lib/whatsapp/api';
import { internalSendInstagramMessage } from '@/lib/instagram/api';
import { internalSendFacebookMessage } from '@/lib/facebook/api';
import { internalSendTikTokMessage } from '@/lib/tiktok/api';
import { sanitizeCustomerMessage } from '@/lib/messaging/sanitize';
import { replaceContactVariables } from '@/lib/messaging/contactVariables';

type MetaMediaType = 'image' | 'video' | 'audio' | 'file';
type UnifiedInteractiveButton = {
    id?: string;
    text: string;
    url?: string;
    type?: string;
};
type UnifiedInteractiveData = {
    type?: string;
    body?: { text?: string };
    action?: { buttons?: UnifiedInteractiveButton[] };
    payload?: unknown;
} & Record<string, unknown>;

export type UnifiedMessageOptions = {
    contactId: string;
    message: string;
    senderId?: string;
    existingContact?: any;
    interactiveData?: UnifiedInteractiveData;
    skipWindowCheck?: boolean;
    templateName?: string;
    templateLanguage?: string;
    templateComponents?: unknown[];
    components?: unknown[];
    mediaUrl?: string;
    contentType?: string;
    fileName?: string;
    mimetype?: string;
    flowPayload?: WhatsAppFlowPayload;
    commentId?: string;
    replyToMessageId?: string;
    replyToWaId?: string;
    metadata?: any;
    channel?: string;
    channelId?: string;
};

function getMetaMediaType(contentType?: string): MetaMediaType {
    return contentType === 'video' || contentType === 'audio' || contentType === 'file'
        ? contentType
        : 'image';
}

export async function sendUnifiedMessage(options: UnifiedMessageOptions): Promise<any> {
    const { 
        contactId, 
        message, 
        senderId,
        existingContact,
        interactiveData, 
        skipWindowCheck,
        templateName,
        templateLanguage,
        templateComponents,
        components,
        mediaUrl,
        contentType,
        fileName,
        mimetype,
        flowPayload,
        commentId,
        replyToMessageId,
        replyToWaId,
        metadata,
        channel,
        channelId
    } = options;
    const safeMessage = sanitizeCustomerMessage(message);

    console.log(`[UnifiedMessage] Sending to ${contactId}:`, { 
        templateName, 
        templateLanguage, 
        message: safeMessage,
        hasComponents: !!templateComponents,
        componentCount: templateComponents?.length || 0,
        replyToMessageId,
        replyToWaId,
        channelId
    });

    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true }
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact not found');
    }

    const resolvedMessage = safeMessage ? replaceContactVariables(safeMessage, contact) : safeMessage;

    let resolvedComponents = templateComponents || components;
    if (resolvedComponents && Array.isArray(resolvedComponents)) {
        resolvedComponents = resolvedComponents.map((comp: any) => {
            if (comp && Array.isArray(comp.parameters)) {
                return {
                    ...comp,
                    parameters: comp.parameters.map((p: any) => {
                        if (p && p.type === 'text' && typeof p.text === 'string') {
                            return { ...p, text: replaceContactVariables(p.text, contact) };
                        }
                        return p;
                    })
                };
            }
            return comp;
        });
    }

    const isWebsiteWidget = 
        channel === 'website_widget' ||
        metadata?.channel === 'website_widget' ||
        (contact.customAttributes as any)?.channel === 'website_widget' ||
        contact.waId?.startsWith('web_');

    if (isWebsiteWidget) {
        const msgType = interactiveData ? 'interactive' : (mediaUrl ? (contentType || 'image') : 'text');
        const [newMessage] = await Promise.all([
            prisma.message.create({
                data: {
                    contactId: contact.id,
                    senderId: senderId || null,
                    type: msgType,
                    direction: 'outbound',
                    status: 'sent',
                    content: resolvedMessage || (mediaUrl ? `[Media: ${msgType}]` : '[Message]'),
                    mediaUrl: mediaUrl || null,
                    rawBody: {
                        channel: 'website_widget',
                        interactiveData: interactiveData || null,
                        mediaUrl: mediaUrl || null,
                        contentType: contentType || null,
                    } as any,
                    replyToId: replyToMessageId || null,
                }
            }),
            prisma.contact.update({
                where: { id: contact.id },
                data: {
                    lastMessage: resolvedMessage || (mediaUrl ? `[Media: ${msgType}]` : '[Message]'),
                    lastMessageAt: new Date()
                }
            })
        ]);

        try {
            const { triggerPusherOrgEvent } = await import('@/lib/pusher');
            await triggerPusherOrgEvent(contact.organization.id, 'new-message', newMessage);
        } catch (pushErr) {
            console.warn('[UnifiedMessage] Pusher event failed for website widget:', pushErr);
        }

        if (metadata?.collector && Array.isArray(metadata.collector)) {
            metadata.collector.push({
                id: newMessage.id,
                type: msgType,
                content: newMessage.content,
                mediaUrl: mediaUrl || null,
                contentType: contentType || null,
                interactiveData: interactiveData || null,
                createdAt: newMessage.createdAt,
            });
        }

        return newMessage;
    }

    const rawPlatform = (contact.platform || 'WHATSAPP').toUpperCase().trim();
    const platform = rawPlatform === 'MESSENGER' || rawPlatform === 'FACEBOOK_MESSENGER' || rawPlatform === 'FB' ? 'FACEBOOK'
                   : rawPlatform === 'IG' ? 'INSTAGRAM'
                   : rawPlatform;

    switch (platform) {
        case 'WHATSAPP':
            const isQrConnection = 
                contact.organization?.whatsappConnectionMethod === 'qr' ||
                contact.organization?.whatsappPhoneNumberId?.startsWith('qr_');

            if (isQrConnection) {
                const { sendQRWhatsAppMessage } = await import('@/lib/whatsapp/qr/service');
                return await sendQRWhatsAppMessage({
                    organizationId: contact.organization.id,
                    contactId,
                    recipientPhone: contact.waId || contact.phoneNumber || '',
                    messageText: resolvedMessage,
                    senderId,
                    mediaUrl,
                    contentType,
                    fileName,
                    mimetype,
                    replyToMessageId,
                    replyToWaId,
                    interactiveData,
                });
            }
            if (flowPayload) {
                const { internalSendFlowMessage } = await import('@/lib/whatsapp/api');
                return await internalSendFlowMessage(
                    contactId,
                    flowPayload,
                    contact,
                    senderId
                );
            }
            if (templateName) {
                return await internalSendTemplateMessage(
                    contactId,
                    templateName,
                    templateLanguage || 'en',
                    resolvedComponents,
                    senderId
                );
            }
            if (mediaUrl) {
                const { internalSendMediaMessage } = await import('@/lib/whatsapp/api');
                return await internalSendMediaMessage(
                    contactId,
                    contentType || 'image',
                    mediaUrl,
                    resolvedMessage,
                    interactiveData?.action?.buttons || [],
                    contact,
                    senderId,
                    replyToMessageId,
                    replyToWaId,
                    fileName,
                    mimetype
                );
            }
            return await internalSendWhatsAppMessage(
                contactId,
                resolvedMessage,
                contact,
                interactiveData,
                skipWindowCheck,
                senderId,
                replyToMessageId,
                replyToWaId,
                channelId
            );
        case 'INSTAGRAM':
            if (mediaUrl) {
                return await internalSendInstagramMessage(
                    contactId,
                    resolvedMessage,
                    contact,
                    senderId,
                    interactiveData,
                    mediaUrl,
                    commentId
                );
            }
            return await internalSendInstagramMessage(
                contactId,
                resolvedMessage,
                contact,
                senderId,
                interactiveData,
                undefined,
                commentId
            );
        case 'FACEBOOK':
        case 'MESSENGER':
        case 'FACEBOOK_MESSENGER':
            if (mediaUrl) {
                const { internalSendMetaMediaMessage } = await import('@/lib/facebook/api');
                return await internalSendMetaMediaMessage(
                    contactId,
                    getMetaMediaType(contentType),
                    mediaUrl,
                    resolvedMessage,
                    contact,
                    senderId,
                    interactiveData
                );
            }
            return await internalSendFacebookMessage(
                contactId,
                resolvedMessage,
                contact,
                senderId,
                interactiveData,
                commentId
            );
        case 'TIKTOK':
            return await internalSendTikTokMessage(
                contactId,
                resolvedMessage,
                contact,
                senderId
            );
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
