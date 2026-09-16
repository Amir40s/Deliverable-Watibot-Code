import { prisma } from '@/lib/prisma';
import { checkQuota } from '@/lib/quota';

async function enforceBotRepliesQuota(organizationId: string) {
    const quotaCheck = await checkQuota(organizationId, 'maxBotReplies');
    if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message || 'Bot Replies limit reached. Please upgrade your plan.');
    }
}

function inferMediaMessageType(mediaUrl?: string): 'image' | 'video' | 'audio' | 'template' {
    const lowercaseUrl = (mediaUrl || '').toLowerCase();
    if (lowercaseUrl.match(/\.(mp4|mov|avi|webm)(\?|#|$)/)) return 'video';
    if (lowercaseUrl.match(/\.(mp3|ogg|wav|m4a|webm)(\?|#|$)/)) return 'audio';
    return 'image';
}

export async function replyToInstagramComment(options: { organizationId: string; commentId: string; message: string }) {
    const { resolveFacebookPageAccessToken } = await import('@/lib/facebook/api');
    const pageAccessToken = await resolveFacebookPageAccessToken(options.organizationId);

    const res = await fetch(`https://graph.facebook.com/v21.0/${options.commentId}/replies`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: options.message,
            access_token: pageAccessToken,
        }),
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
        throw new Error(data?.error?.message || 'Instagram API Error');
    }

    return data;
}

export async function internalSendInstagramMessage(
    contactId: string, 
    message: string, 
    existingContact?: any, 
    senderId?: string,
    interactiveData?: any,
    mediaUrl?: string,
    commentId?: string
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
    if (!org.instagramBusinessId) {
        throw new Error('Instagram not configured for this organization');
    }

    // Instagram Messaging requires a Page Access Token for the linked Facebook Page
    const { resolveFacebookPageAccessToken } = await import('@/lib/facebook/api');
    const pageAccessToken = await resolveFacebookPageAccessToken(org.id);
    
    await enforceBotRepliesQuota(org.id);
    
    // Use the explicit Page ID instead of 'me' to avoid ambiguity
    const pageId = org.facebookPageId || 'me';
    const url = `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${pageAccessToken}`;

    let payload: any = {
        recipient: commentId ? { comment_id: commentId } : { id: contact.waId },
    };

    // Support direct template payloads (like Carousels)
    if (interactiveData?.type === 'template') {
        payload.message = {
            attachment: {
                type: 'template',
                payload: interactiveData.payload
            }
        };
    } else if (mediaUrl) {
        const buttons = interactiveData?.action?.buttons ? interactiveData.action.buttons.map((btn: any) => {
            if (btn.url || btn.type === 'link') {
                return {
                    type: 'web_url',
                    url: btn.url,
                    title: btn.text
                };
            }
            return {
                type: 'postback',
                title: btn.text,
                payload: btn.id || btn.text
            };
        }) : undefined;

        if (buttons && buttons.length > 0) {
            payload.message = {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [
                            {
                                title: message || "Attachment",
                                image_url: mediaUrl,
                                buttons: buttons.slice(0, 3)
                            }
                        ]
                    }
                }
            };
        } else {
            const lowercaseUrl = mediaUrl.toLowerCase();
            const isAudio = lowercaseUrl.match(/\.(mp3|ogg|wav|m4a|webm)/);
            if (isAudio) {
                payload.message = {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'generic',
                            elements: [
                                {
                                    title: message || "Voice Message / Audio",
                                    subtitle: "Click the button below to play the audio",
                                    image_url: "https://res.cloudinary.com/dxuuqpqho/image/upload/v1778316865/watibot-assets/audio-placeholder.jpg",
                                    buttons: [
                                        {
                                            type: "web_url",
                                            url: mediaUrl,
                                            title: "Play Audio"
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                };
            } else {
                let mediaType = 'image';
                if (lowercaseUrl.match(/\.(mp4|mov|avi)/)) {
                    mediaType = 'video';
                }
                payload.message = {
                    attachment: {
                        type: mediaType,
                        payload: {
                            url: mediaUrl,
                            is_reusable: true
                        }
                    }
                };
            }
        }
    } else {
        const hasUrlButton = interactiveData?.action?.buttons?.some((btn: any) => btn.url || btn.type === 'link');

        if (hasUrlButton) {
            // Send as a Generic Template to support URL buttons
            payload.message = {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [
                            {
                                title: message,
                                buttons: interactiveData.action.buttons.map((btn: any) => {
                                    if (btn.url || btn.type === 'link') {
                                        return {
                                            type: 'web_url',
                                            url: btn.url,
                                            title: btn.text
                                        };
                                    }
                                    return {
                                        type: 'postback',
                                        title: btn.text,
                                        payload: btn.id || btn.text
                                    };
                                }).slice(0, 3)
                            }
                        ]
                    }
                }
            };
        } else {
            // Standard text message
            payload.message = { text: message };

            // Support Quick Replies if provided
            if (interactiveData?.action?.buttons) {
                payload.message.quick_replies = interactiveData.action.buttons.map((btn: any) => ({
                    content_type: 'text',
                    title: btn.text,
                    payload: btn.id || btn.text,
                })).slice(0, 10);
            }
        }
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.error) {
        console.error('[InstagramSend] Error:', JSON.stringify(data.error, null, 2));
        throw new Error(`Instagram API Error: ${data.error.message}`);
    }

    const attachmentType = payload.message?.attachment?.type;
    const storedType =
        attachmentType === 'template'
            ? 'template'
            : attachmentType === 'image' || attachmentType === 'video' || attachmentType === 'audio'
                ? attachmentType
                : mediaUrl
                    ? inferMediaMessageType(mediaUrl)
                    : 'text';
    const storedContent = message || (storedType === 'text' ? '' : `[${storedType}]`);

    // Save DB
    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: senderId,
            platform: 'INSTAGRAM',
            direction: 'outbound',
            status: 'sent',
            type: storedType,
            content: storedContent,
            mediaUrl: mediaUrl || null,
            rawBody: {
                ...data,
                sentPayload: payload
            }
        }
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: storedContent,
            lastMessageAt: new Date()
        }
    });

    return newMessage;
}
