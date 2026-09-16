import { prisma } from '@/lib/prisma';

/**
 * Uploads a media file to Facebook's Attachment Upload API via multipart/form-data.
 * We download the file to our own server first, then push the raw bytes directly to Meta.
 * This completely eliminates the (#100) Upload attachment failure error caused by Meta's
 * servers intermittently failing to fetch files from Cloudinary URLs.
 */
async function uploadAttachmentToFacebook(
    pageId: string,
    pageAccessToken: string,
    mediaUrl: string,
    type: 'image' | 'video' | 'audio' | 'file'
): Promise<string | null> {
    try {
        console.log('[FB] Downloading file from Cloudinary for direct upload:', mediaUrl);
        
        // Step 1: Download the file to our server
        const fileRes = await fetch(mediaUrl);
        if (!fileRes.ok) {
            console.warn('[FB] Failed to download file from Cloudinary:', fileRes.status);
            return null;
        }
        const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
        const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
        
        // Extract filename from URL
        const filename = mediaUrl.split('/').pop()?.split('?')[0] || `upload.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'bin'}`;

        console.log(`[FB] Uploading ${fileBuffer.length} bytes (${contentType}) directly to Facebook...`);

        // Step 2: Build multipart/form-data body
        const metaType = type === 'file' ? 'file' : type;
        const boundary = `--FBUpload${Date.now()}`;
        
        const messagePart = `--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${JSON.stringify({
            attachment: { type: metaType, payload: { is_reusable: true } }
        })}\r\n`;
        
        const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="filedata"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
        const closing = `\r\n--${boundary}--\r\n`;

        const body = Buffer.concat([
            Buffer.from(messagePart),
            Buffer.from(fileHeader),
            fileBuffer,
            Buffer.from(closing)
        ]);

        // Step 3: Upload directly to Facebook
        const uploadRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/message_attachments?access_token=${pageAccessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                body,
            }
        );

        const data = await uploadRes.json();
        if (data?.attachment_id) {
            console.log('[FB] Direct upload successful. attachment_id:', data.attachment_id);
            return data.attachment_id;
        }
        console.warn('[FB] Direct upload failed, falling back to URL method:', data?.error?.message);
        return null;
    } catch (e) {
        console.warn('[FB] Direct upload exception, falling back to URL method:', e);
        return null;
    }
}


type ReplyToCommentOptions = {
    organizationId: string;
    commentId: string;
    message: string;
};

export async function replyToFacebookComment(options: ReplyToCommentOptions) {
    const org = await prisma.organization.findUnique({
        where: { id: options.organizationId },
        select: {
            id: true,
            name: true,
            facebookPageId: true,
        },
    });

    if (!org) {
        throw new Error('Organization not found for Facebook auto-comment reply');
    }
    if (!org.facebookPageId) {
        throw new Error('Missing facebookPageId for Facebook auto-comment reply');
    }

    const pageAccessToken = await resolveFacebookPageAccessToken(options.organizationId);

    const res = await fetch(`https://graph.facebook.com/v21.0/${options.commentId}/comments`, {
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
        const errorMessage = data?.error?.message || `Facebook API request failed with status ${res.status}`;
        throw new Error(errorMessage);
    }

    return data;
}

export async function likeFacebookComment(commentId: string, organizationId: string) {
    try {
        const pageAccessToken = await resolveFacebookPageAccessToken(organizationId);
        const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/likes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: pageAccessToken })
        });
        const data = await res.json();
        return data;
    } catch (err) {
        console.warn('[FB] Failed to like comment:', err);
        return null;
    }
}

export async function sendFacebookPrivateReply(commentId: string, message: string, organizationId: string) {
    try {
        const pageAccessToken = await resolveFacebookPageAccessToken(organizationId);
        const res = await fetch(`https://graph.facebook.com/v21.0/me/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { comment_id: commentId },
                message: { text: message },
                access_token: pageAccessToken
            })
        });
        const data = await res.json();
        if (!res.ok || data?.error) {
            console.warn('[FB] Private reply API warning:', data?.error?.message);
            return null;
        }
        return data;
    } catch (err) {
        console.warn('[FB] Failed to send private reply:', err);
        return null;
    }
}

type FacebookAccountsResponse = {
    data?: Array<{
        id: string;
        name?: string;
        access_token?: string;
    }>;
    error?: {
        message?: string;
    };
};

export async function resolveFacebookPageAccessToken(organizationId: string) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            metaAccessToken: true,
            facebookPageId: true,
            facebookPageAccessToken: true,
        },
    });

    if (!org || !org.facebookPageId) {
        throw new Error('Facebook page is not configured for this organization');
    }

    // Prioritize stored Page Access Token (PAT)
    if (org.facebookPageAccessToken) {
        return org.facebookPageAccessToken;
    }

    if (!org.metaAccessToken) {
        throw new Error('Meta access token missing; cannot resolve page access.');
    }

    // Fallback to /me/accounts for legacy connections
    const accountsRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${org.metaAccessToken}`
    );
    const accountsData = await accountsRes.json() as FacebookAccountsResponse;
    if (!accountsRes.ok || accountsData?.error) {
        throw new Error(accountsData?.error?.message || 'Failed to fetch Facebook page account access.');
    }

    const matchedPage = (accountsData.data || []).find((page) => page.id === org.facebookPageId);
    if (!matchedPage?.access_token) {
        throw new Error('Connected Facebook page is not accessible with current token. Please reconnect the page.');
    }

    return matchedPage.access_token;
}

export async function internalSendFacebookMessage(
    contactId: string,
    message: string,
    existingContact?: any,
    senderId?: string,
    interactiveData?: any,
    commentId?: string
) {
    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true },
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    if (contact.platform !== 'FACEBOOK') {
        throw new Error('Selected contact is not a Facebook chat.');
    }

    const pageAccessToken = await resolveFacebookPageAccessToken(contact.organization.id);
    const pageId = contact.organization.facebookPageId || 'me';
    const url = `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${pageAccessToken}`;
    
    const buttons = interactiveData?.action?.buttons || [];
    const hasUrlButton = buttons.some((btn: any) => btn.url && btn.url.trim());

    let payload: any;
    const recipient = commentId ? { comment_id: commentId } : { id: contact.waId };

    if (interactiveData?.type === 'template' && interactiveData.payload) {
        payload = {
            recipient,
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: 'template',
                    payload: interactiveData.payload,
                },
            },
        };
    } else if (hasUrlButton) {
        payload = {
            recipient,
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: message,
                        buttons: buttons.map((btn: any) => {
                            if (btn.url && btn.url.trim()) {
                                return {
                                    type: "web_url",
                                    url: btn.url,
                                    title: btn.text,
                                    webview_height_ratio: "full"
                                };
                            } else {
                                return {
                                    type: "postback",
                                    title: btn.text,
                                    payload: btn.id || btn.text
                                };
                            }
                        })
                    }
                }
            }
        };
    } else {
        payload = {
            recipient,
            messaging_type: 'RESPONSE',
            message: { text: message },
        };
        if (buttons.length > 0) {
            payload.message.quick_replies = buttons.map((btn: any) => ({
                content_type: 'text',
                title: btn.text,
                payload: btn.id || btn.text,
            }));
        }
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
        throw new Error(data?.error?.message || 'Facebook API Error');
    }

    const messageId = data?.message_id || data?.id || null;
    const storedType = interactiveData?.type === 'template' && interactiveData.payload ? 'template' : 'text';
    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId,
            wamid: messageId,
            platform: 'FACEBOOK',
            direction: 'outbound',
            status: 'sent',
            type: storedType,
            content: message,
            rawBody: {
                ...data,
                sentPayload: payload,
            },
        },
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: message,
            lastMessageAt: new Date(),
        },
    });

    return newMessage;
}

export async function fetchFacebookSenderProfile(
    senderId: string, 
    accessToken: string, 
    platform: 'FACEBOOK' | 'INSTAGRAM' = 'FACEBOOK',
    pageId?: string | null
) {
    try {
        // Facebook Messenger PSID vs Instagram IGSID have different valid fields
        // Requesting 'username' on a Facebook PSID will cause an "Unsupported get request" error.
        const fields = platform === 'INSTAGRAM' 
            ? 'name,username,profile_pic' 
            : 'first_name,last_name,profile_pic';

        const profileRes = await fetch(
            `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${accessToken}`
        );
        const profileData = await profileRes.json();

        if (profileRes.ok && !profileData?.error) {
            // 1. Resolve Name
            let name = '';
            if (platform === 'INSTAGRAM') {
                name = profileData.name || profileData.username || '';
            } else {
                // Facebook Messenger
                if (profileData.name) {
                    name = profileData.name;
                } else {
                    name = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
                }
            }

            return {
                name: name.trim(),
                firstName: profileData.first_name || null,
                lastName: profileData.last_name || null,
                username: profileData.username || null,
                profilePic: profileData.profile_pic || null,
            };
        }

        // Fallback for Facebook Messenger via Page Conversations API
        if (platform === 'FACEBOOK' && pageId) {
            try {
                const convRes = await fetch(
                    `https://graph.facebook.com/v21.0/${pageId}/conversations?user_id=${senderId}&fields=participants&access_token=${accessToken}`
                );
                const convData = await convRes.json();
                const participants = convData?.data?.[0]?.participants?.data || [];
                const matched = participants.find((p: any) => p.id === senderId) || participants.find((p: any) => p.id !== pageId);
                if (matched?.name) {
                    const nameParts = matched.name.trim().split(' ');
                    return {
                        name: matched.name.trim(),
                        firstName: nameParts[0] || null,
                        lastName: nameParts.slice(1).join(' ') || null,
                        username: null,
                        profilePic: null,
                    };
                }
            } catch (convErr) {
                console.warn(`[META_API] Conversations fallback failed for ${senderId}:`, convErr);
            }
        }

        // Fallback for Instagram via Page Conversations API with platform=instagram
        if (platform === 'INSTAGRAM' && pageId) {
            try {
                const convRes = await fetch(
                    `https://graph.facebook.com/v21.0/${pageId}/conversations?platform=instagram&user_id=${senderId}&fields=participants&access_token=${accessToken}`
                );
                const convData = await convRes.json();
                const participants = convData?.data?.[0]?.participants?.data || [];
                const matched = participants.find((p: any) => p.id === senderId);
                if (matched?.name || matched?.username) {
                    const name = (matched.name || matched.username || '').trim();
                    const nameParts = name.split(' ');
                    return {
                        name,
                        firstName: nameParts[0] || null,
                        lastName: nameParts.slice(1).join(' ') || null,
                        username: matched.username || null,
                        profilePic: matched.profile_pic || null,
                    };
                }
            } catch (convErr) {
                console.warn(`[META_API] Instagram conversations fallback failed for ${senderId}:`, convErr);
            }
        }

        console.warn(`[META_API] Failed to fetch ${platform} profile for ${senderId}: ${profileData?.error?.message || 'Unknown error'}`);
        return null;
    } catch (error) {
        console.warn(`[META_API] Profile fetch exception for ${senderId}: ${String(error)}`);
        return null;
    }
}

export async function internalSendMetaMedia(
    params: {
        contactId: string;
        file: File;
        type: 'image' | 'video' | 'audio' | 'file';
        platform: 'FACEBOOK' | 'INSTAGRAM';
        senderId?: string;
        isVoice?: boolean;
    }
) {
    const contact = await prisma.contact.findUnique({
        where: { id: params.contactId },
        include: { organization: true },
    });

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const pageAccessToken = await resolveFacebookPageAccessToken(contact.organization.id);

    // Save media locally so it can always be played in the Live Chat UI
    let localSavedUrl = '';
    try {
        const { saveMediaLocally } = await import('@/lib/storage/media');
        const arrayBuffer = await params.file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = params.isVoice ? 'ogg' : (params.file.name?.split('.').pop() || (params.type === 'audio' ? 'mp3' : 'bin'));
        const filename = `${params.isVoice ? 'voice' : params.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const mimeType = params.isVoice ? 'audio/ogg' : (params.file.type || 'application/octet-stream');
        localSavedUrl = await saveMediaLocally(buffer, filename, mimeType);
    } catch (saveErr: any) {
        console.warn('[internalSendMetaMedia] Failed to save media locally:', saveErr?.message);
    }
    
    // 1. Upload media to get a reusable attachment_id
    let attachmentId: string | null = null;
    try {
        const uploadUrl = `https://graph.facebook.com/v21.0/me/message_attachments?access_token=${pageAccessToken}`;
        const uploadFormData = new FormData();
        uploadFormData.append('message', JSON.stringify({
            attachment: {
                type: params.type === 'file' ? 'file' : params.type,
                payload: { is_reusable: true }
            }
        }));
        uploadFormData.append('filedata', params.file);

        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            body: uploadFormData,
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData?.attachment_id) {
            attachmentId = uploadData.attachment_id;
        } else {
            console.warn('[internalSendMetaMedia] Attachment upload warning:', uploadData?.error?.message);
        }
    } catch (uploadErr) {
        console.warn('[internalSendMetaMedia] Attachment upload exception:', uploadErr);
    }

    // 2. Send message using attachment_id or fallback URL
    const pageId = contact.organization.facebookPageId || 'me';
    const sendUrl = `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${pageAccessToken}`;
    
    let sendPayload: any;
    if (attachmentId) {
        sendPayload = {
            recipient: { id: contact.waId },
            message: {
                attachment: {
                    type: params.type === 'file' ? 'file' : params.type,
                    payload: { attachment_id: attachmentId }
                }
            }
        };
    } else if (localSavedUrl) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://278a-103-152-117-115.ngrok-free.app';
        const absoluteUrl = localSavedUrl.startsWith('http') ? localSavedUrl : `${appUrl.replace(/\/$/, '')}${localSavedUrl}`;
        
        if (params.type === 'audio' || params.isVoice) {
            // Send as Generic Template Card with "Play Audio" CTA for maximum Meta cross-platform compatibility
            sendPayload = {
                recipient: { id: contact.waId },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'generic',
                            elements: [
                                {
                                    title: params.isVoice ? "Voice Message" : (params.file.name || "Audio Recording"),
                                    subtitle: "Click below to listen to the audio recording",
                                    image_url: "https://res.cloudinary.com/dxuuqpqho/image/upload/v1778316865/watibot-assets/audio-placeholder.jpg",
                                    buttons: [
                                        {
                                            type: "web_url",
                                            url: absoluteUrl,
                                            title: "▶ Play Audio"
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            };
        } else {
            sendPayload = {
                recipient: { id: contact.waId },
                message: {
                    attachment: {
                        type: params.type === 'file' ? 'file' : params.type,
                        payload: { url: absoluteUrl, is_reusable: true }
                    }
                }
            };
        }
    } else {
        throw new Error('Failed to upload or store media file for Meta sending');
    }

    const res = await fetch(sendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendPayload),
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
        throw new Error(data?.error?.message || 'Meta API Media Send Error');
    }

    const messageId = data?.message_id || data?.id || null;
    const finalMediaUrl = localSavedUrl || (attachmentId ? `/api/media/${attachmentId}?orgId=${contact.organization.id}` : '');
    const displayType = params.isVoice ? 'voice' : params.type;
    const displayContent = params.isVoice ? '[Voice Message]' : `[${params.type.charAt(0).toUpperCase() + params.type.slice(1)}]`;

    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId: params.senderId,
            wamid: messageId,
            platform: params.platform,
            direction: 'outbound',
            status: 'sent',
            type: displayType,
            content: displayContent,
            mediaUrl: finalMediaUrl,
            rawBody: {
                ...data,
                voice: Boolean(params.isVoice),
                isVoice: Boolean(params.isVoice),
                audio: params.isVoice ? { voice: true } : undefined,
                mediaUrl: finalMediaUrl,
            },
        },
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: displayContent,
            lastMessageAt: new Date(),
        },
    });

    // Broadcast via Pusher to live chat
    try {
        const { triggerPusherOrgEvent } = await import('@/lib/pusher');
        await Promise.allSettled([
            triggerPusherOrgEvent(contact.organization.id, 'new-message', {
                message: {
                    ...newMessage,
                },
                contactId: contact.id,
            }),
            triggerPusherOrgEvent(contact.organization.id, 'message:outbound', {
                contactId: contact.id,
                message: newMessage,
            }),
        ]);
    } catch (pusherErr) {
        console.warn('[internalSendMetaMedia] Pusher broadcast warning:', pusherErr);
    }

    return newMessage;
}

export async function internalSendMetaMediaMessage(
    contactId: string,
    type: 'image' | 'video' | 'audio' | 'file',
    mediaUrl: string,
    caption?: string,
    existingContact?: any,
    senderId?: string,
    interactiveData?: any
) {
    let contact = existingContact;
    if (!contact || !contact.organization) {
        contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true },
        });
    }

    if (!contact || !contact.organization) {
        throw new Error('Contact or Organization not found');
    }

    const pageAccessToken = await resolveFacebookPageAccessToken(contact.organization.id);
    const pageId = contact.organization.facebookPageId || 'me';
    const url = `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${pageAccessToken}`;

    // 1. If there's a caption, send it as a separate text message first
    if (caption && caption.trim()) {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: contact.waId },
                    messaging_type: 'RESPONSE',
                    message: { text: caption }
                })
            });
        } catch (e) {
            console.warn('[MetaMedia] Failed to send separate caption message:', e);
        }
    }

    const buttons = interactiveData?.action?.buttons || [];
    const hasUrlButton = buttons.some((btn: any) => btn.url && btn.url.trim());

    let payload: any;
    if (hasUrlButton) {
        payload = {
            recipient: { id: contact.waId },
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [
                            {
                                title: "Attachment",
                                image_url: mediaUrl,
                                default_action: {
                                    type: "web_url",
                                    url: mediaUrl,
                                    webview_height_ratio: "full"
                                },
                                buttons: buttons.map((btn: any) => {
                                    if (btn.url && btn.url.trim()) {
                                        return {
                                            type: "web_url",
                                            url: btn.url,
                                            title: btn.text,
                                            webview_height_ratio: "full"
                                        };
                                    } else {
                                        return {
                                            type: "postback",
                                            title: btn.text,
                                            payload: btn.id || btn.text
                                        };
                                    }
                                })
                            }
                        ]
                    }
                }
            }
        };
    } else if (type === 'audio') {
        // Meta's Messenger API rejects raw audio uploads (webm/mp3/ogg etc).
        // We use a Generic Template Card with a Play Audio CTA — the standard workaround.
        payload = {
            recipient: { id: contact.waId },
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [
                            {
                                title: caption || "Voice Message / Audio",
                                subtitle: "Click below to play the audio recording",
                                image_url: "https://res.cloudinary.com/dxuuqpqho/image/upload/v1778316865/watibot-assets/audio-placeholder.jpg",
                                buttons: [
                                    {
                                        type: "web_url",
                                        url: mediaUrl,
                                        title: "▶ Play Audio"
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        };
    } else {
        // For images, videos, files: pre-upload to Facebook's Attachment Upload API.
        // This is far more reliable than URL-based sends, which frequently fail when
        // Meta's servers can't reach the Cloudinary URL (error #100 subcode 2018047).
        const attachmentId = await uploadAttachmentToFacebook(pageId, pageAccessToken, mediaUrl, type);
        
        const attachmentPayloadField = attachmentId
            ? { attachment_id: attachmentId }
            : { url: mediaUrl, is_reusable: true };

        payload = {
            recipient: { id: contact.waId },
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: type === 'file' ? 'file' : type,
                    payload: attachmentPayloadField
                }
            }
        };
        if (buttons.length > 0) {
            payload.message.quick_replies = buttons.map((btn: any) => ({
                content_type: 'text',
                title: btn.text,
                payload: btn.id || btn.text,
            }));
        }
    }
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
        throw new Error(data?.error?.message || 'Meta API Media Message Error');
    }

    const messageId = data?.message_id || data?.id || null;
    const newMessage = await prisma.message.create({
        data: {
            contactId: contact.id,
            senderId,
            wamid: messageId,
            platform: contact.platform,
            direction: 'outbound',
            status: 'sent',
            type,
            content: caption || `[${type}]`,
            mediaUrl,
            rawBody: data,
        },
    });

    await prisma.contact.update({
        where: { id: contact.id },
        data: {
            lastMessage: caption || `[${type}]`,
            lastMessageAt: new Date(),
        },
    });

    return newMessage;
}
