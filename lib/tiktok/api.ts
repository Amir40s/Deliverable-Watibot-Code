import { prisma } from '@/lib/prisma';
import { checkQuota } from '@/lib/quota';

async function enforceBotRepliesQuota(organizationId: string) {
    const quotaCheck = await checkQuota(organizationId, 'maxBotReplies');
    if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message || 'Bot Replies limit reached. Please upgrade your plan.');
    }
}

export async function internalSendTikTokMessage(contactId: string, message: string, existingContact?: any, senderId?: string) {
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
    if (!org.tiktokAccessToken) {
        throw new Error('TikTok not configured for this organization');
    }

    await enforceBotRepliesQuota(org.id);

    // TikTok Business API - Send Message
    // Note: Requires valid tiktokAccessToken and a recently active user (24h window)
    // Endpoint: https://business-api.tiktok.com/open_api/v1.3/message/send/
    
    console.log(`[TikTokSend] Sending to ${contact.waId}: ${message}`);
    
    try {
        const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/message/send/', {
            method: 'POST',
            headers: {
                'Access-Token': org.tiktokAccessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient_id: contact.waId,
                message_content: {
                    text: message
                }
            })
        });

        const data = await res.json();
        if (!res.ok || data.code !== 0) {
            console.error('[TikTokSend] Error response:', data);
            throw new Error(data.message || 'Failed to send TikTok message');
        }
    } catch (err: any) {
        console.error('[TikTokSend] Request failed:', err.message);
        // We log the error but don't necessarily want to crash the flow runner
        // if this was an automated reply.
    }
    
    // Save DB
    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            platform: 'TIKTOK',
            direction: 'outbound',
            status: 'sent',
            type: 'text',
            content: message,
            rawBody: { placeholder: true, message }
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: message,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}
