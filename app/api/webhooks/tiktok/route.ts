import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    logger.webhook.info(
        `[TikTok] GET webhook received ${JSON.stringify({
            path: req.nextUrl.pathname,
            query: Object.fromEntries(req.nextUrl.searchParams.entries()),
            headers: Object.fromEntries(req.headers.entries()),
        })}`
    );

    // TikTok verification can use different query keys depending on product/version.
    const challenge =
        req.nextUrl.searchParams.get('challenge') ||
        req.nextUrl.searchParams.get('hub.challenge') ||
        req.nextUrl.searchParams.get('challenge_code');
    const challengeCode = req.nextUrl.searchParams.get('challenge_code');
    if (challengeCode) {
        const secret = process.env.TIKTOK_WEBHOOK_SECRET || process.env.TIKTOK_CLIENT_SECRET || '';
        if (secret) {
            const responseToken = crypto
                .createHash('sha256')
                .update(challengeCode + secret)
                .digest('hex');
            return NextResponse.json(
                { challenge_code: challengeCode, response_token: responseToken },
                { status: 200 }
            );
        }
        return NextResponse.json({ challenge_code: challengeCode }, { status: 200 });
    }

    // Fallback for plain challenge echo checks.
    if (challenge) {
        return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}

export async function HEAD() {
    return new NextResponse(null, { status: 200 });
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        let body: any = {};
        try {
            body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
            // Some verification requests can arrive as non-JSON payloads.
            body = {};
        }
        logger.webhook.info(
            `[TikTok] POST webhook payload received ${JSON.stringify({
                path: req.nextUrl.pathname,
                headers: Object.fromEntries(req.headers.entries()),
                body,
                rawBody,
            })}`
        );
        const postChallengeCode =
            body?.challenge_code ||
            body?.challenge ||
            body?.['hub.challenge'] ||
            body?.data?.challenge_code;
        if (postChallengeCode) {
            const secret = process.env.TIKTOK_WEBHOOK_SECRET || process.env.TIKTOK_CLIENT_SECRET || '';
            if (secret) {
                const responseToken = crypto
                    .createHash('sha256')
                    .update(String(postChallengeCode) + secret)
                    .digest('hex');
                return NextResponse.json(
                    { challenge_code: String(postChallengeCode), response_token: responseToken },
                    { status: 200 }
                );
            }
            return NextResponse.json({ challenge_code: String(postChallengeCode) }, { status: 200 });
        }

        const webhookSecret = process.env.TIKTOK_WEBHOOK_SECRET || process.env.TIKTOK_CLIENT_SECRET;
        if (webhookSecret) {
            const signature =
                req.headers.get('tiktok-signature') ||
                req.headers.get('x-tiktok-signature') ||
                req.headers.get('x-tt-signature');

            // Do not hard-fail if signature is absent for test hooks/challenges.
            if (signature && !verifySignature(signature, rawBody, webhookSecret)) {
                return new NextResponse('Unauthorized webhook signature', { status: 401 });
            }
        }
        const event = body.event;
        const senderId = body.core_user_id; // Identifier for the TikTok user
        const recipientId = body.recipient_id; // Our TikTok Business ID

        if (event === 'comment') {
            const videoId = body.video_id;
            const commentId = body.comment_id;
            const commentText = body.content || '';
            const commenterId = body.core_user_id; // The user who commented
            const commenterName = body.username || 'TikTok User';

            if (videoId && commentId && recipientId && commenterId) {
                const org = await prisma.organization.findFirst({
                    where: { tiktokCreatorId: recipientId }
                });

                if (org) {
                    // 1. Upsert Contact (Commenter)
                    const contact = await prisma.contact.upsert({
                        where: {
                            organizationId_platform_waId: {
                                organizationId: org.id,
                                platform: 'TIKTOK',
                                waId: commenterId
                            }
                        },
                        update: {
                            isAutoCreated: false,
                            name: commenterName,
                            lastMessage: commentText,
                            lastMessageAt: new Date(),
                        },
                        create: {
                            organizationId: org.id,
                            platform: 'TIKTOK',
                            waId: commenterId,
                            name: commenterName,
                            lastMessage: commentText,
                            lastMessageAt: new Date(),
                        }
                    });

                    // 2. Save Comment as Message
                    await prisma.message.upsert({
                        where: { wamid: commentId }, // Use commentId as unique wamid
                        update: {
                            content: commentText,
                            status: 'received'
                        },
                        create: {
                            contactId: contact.id,
                            content: commentText,
                            direction: 'inbound',
                            platform: 'TIKTOK',
                            type: 'comment',
                            status: 'received',
                            wamid: commentId,
                            rawBody: body
                        }
                    });

                    // 3. Check for auto-comment rules
                    if (org.tiktokAccessToken) {
                        try {
                            const rawConfig = org.businessVertical;
                            if (rawConfig) {
                                const parsed = JSON.parse(rawConfig);
                                const rules = parsed.tiktokAutoCommentRules || [];
                                const matchedRule = rules.find((r: any) => r.videoId === videoId);

                                if (matchedRule?.replyText) {
                                    logger.webhook.info(`[TikTok Webhook] Auto-replying to comment ${commentId} on video ${videoId}`);
                                    await fetch(`https://business-api.tiktok.com/open_api/v1.3/business/comment/reply/`, {
                                        method: 'POST',
                                        headers: {
                                            'Access-Token': org.tiktokAccessToken,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            business_id: org.tiktokCreatorId,
                                            comment_id: commentId,
                                            text: matchedRule.replyText
                                        })
                                    });

                                    // Save our reply to DB too
                                    await prisma.message.create({
                                        data: {
                                            contactId: contact.id,
                                            content: matchedRule.replyText,
                                            direction: 'outbound',
                                            platform: 'TIKTOK',
                                            type: 'comment_reply',
                                            status: 'sent',
                                            rawBody: { video_id: videoId, parent_comment_id: commentId }
                                        }
                                    });
                                }
                            }
                        } catch (err) {
                            logger.webhook.error(`[TikTok Webhook] Auto-reply failed: ${err}`);
                        }
                    }
                }
            }
            return new NextResponse('OK', { status: 200 });
        }

        if (event !== 'message' || !senderId) {
            return new NextResponse('OK', { status: 200 });
        }

        // Find Organization
        const org = await prisma.organization.findFirst({
            where: { tiktokCreatorId: recipientId }
        });

        if (!org) {
            logger.webhook.error(`No organization found for TikTok Creator ID: ${recipientId}`);
            return new NextResponse('OK', { status: 200 });
        }

        // --- BLOCK CHECK ---
        const existingContact = await prisma.contact.findUnique({
            where: {
                organizationId_platform_waId: {
                    organizationId: org.id,
                    platform: 'TIKTOK',
                    waId: senderId
                }
            },
            select: { isBlocked: true }
        });

        if (existingContact?.isBlocked) {
            logger.webhook.info(`[TikTok] Message from BLOCKED contact ${senderId} ignored.`);
            return new NextResponse('OK', { status: 200 });
        }

        const content = body.content || '[TikTok Message]';

        // Upsert Contact
        const contact = await prisma.contact.upsert({
            where: {
                organizationId_platform_waId: {
                    organizationId: org.id,
                    platform: 'TIKTOK',
                    waId: senderId
                }
            },
            update: {
                isAutoCreated: false,
                lastMessage: content,
                lastMessageAt: new Date(),
                unreadCount: { increment: 1 }
            },
            create: {
                organizationId: org.id,
                waId: senderId,
                name: `TikTok User ${senderId.slice(-4)}`,
                platform: 'TIKTOK',
                lastMessage: content,
                lastMessageAt: new Date(),
                unreadCount: 1
            }
        });

        // Create Message
        await prisma.message.create({
            data: {
                contactId: contact.id,
                type: 'text',
                direction: 'inbound',
                platform: 'TIKTOK',
                status: 'delivered',
                content: content,
                rawBody: body as any
            }
        });

        // Flow Engine (handles local dev automatically)
        const { enqueueFlow } = await import('@/lib/flows/queue');
        enqueueFlow({
            organizationId: org.id,
            contactId: contact.id,
            messageText: content,
            contact: { ...contact, organization: org },
        }).catch(err => {
            logger.webhook.error(`[Queue] [TIKTOK] Failed to enqueue message: ${err.message}`);
        });

        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        logger.webhook.error('TikTok Webhook Error:' + String(error));
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

function verifySignature(signatureHeader: string, payload: string, secret: string): boolean {
    const normalized = signatureHeader.trim();

    // TikTok canonical format:
    // TikTok-Signature: t=1633174587,s=<hex-hmac>
    const parts = normalized.split(',').map((part) => part.trim());
    const timestampPart = parts.find((part) => part.startsWith('t='));
    const signaturePart = parts.find((part) => part.startsWith('s='));

    if (timestampPart && signaturePart) {
        const timestamp = timestampPart.slice(2);
        const incomingSigHex = signaturePart.slice(2);
        if (!timestamp || !incomingSigHex) return false;
        if (!/^\d+$/.test(timestamp) || !/^[a-fA-F0-9]+$/.test(incomingSigHex)) return false;

        // Replay protection: reject old signatures (>5 minutes skew).
        const nowSec = Math.floor(Date.now() / 1000);
        const ts = Number(timestamp);
        if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;

        const signedPayload = `${timestamp}.${payload}`;
        const expectedSigHex = crypto
            .createHmac('sha256', secret)
            .update(signedPayload, 'utf8')
            .digest('hex');

        const incomingBuffer = Buffer.from(incomingSigHex, 'hex');
        const expectedBuffer = Buffer.from(expectedSigHex, 'hex');
        if (incomingBuffer.length !== expectedBuffer.length) return false;
        return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
    }

    // Backward compatibility with legacy formats (raw hex/base64 hmac(payload)).
    const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
    const expectedBase64 = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');
    const incoming = normalized.replace(/^sha256=/i, '');
    if (/^[a-fA-F0-9]+$/.test(incoming)) {
        const incomingBuffer = Buffer.from(incoming, 'hex');
        const expectedBuffer = Buffer.from(expectedHex, 'hex');
        if (incomingBuffer.length !== expectedBuffer.length) return false;
        return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
    }
    const incomingBuffer = Buffer.from(incoming, 'base64');
    const expectedBuffer = Buffer.from(expectedBase64, 'base64');
    if (incomingBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
}
