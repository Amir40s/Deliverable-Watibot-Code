import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { dispatchWebhook, formatContact, formatMessage } from '@/lib/webhooks/dispatcher';
import { getPusherServer, triggerPusherOrgEvent } from '@/lib/pusher';
import { replyToFacebookComment, resolveFacebookPageAccessToken, fetchFacebookSenderProfile } from '@/lib/facebook/api';
import { isOrganizationPlanExpired } from '@/lib/subscription';
import crypto from 'crypto';
import type { Prisma } from '@/lib/generated/prisma';

function cleanPhoneNumber(num: string | null | undefined): string {
    if (!num) return '';
    return num.replace(/\D/g, '');
}

function toJsonRecord(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : { value };
        } catch {
            return { value };
        }
    }
    return typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}
function extractSourceFromMessageData(messageData: any): { 
    source: string | null; 
    adSource: string | null; 
    campaignName: string | null; 
    referral: any | null 
} {
    const referral = messageData?.referral || null;
    if (referral) {
        const sourceType = (referral.source_type || '').toLowerCase();
        const sourceUrl = (referral.source_url || '').toLowerCase();

        let platform = 'Facebook';
        if (sourceUrl.includes('instagram.com') || sourceUrl.includes('ig.me') || sourceType.includes('instagram')) {
            platform = 'Instagram';
        } else if (sourceUrl.includes('wa.me') || sourceUrl.includes('whatsapp.com')) {
            platform = 'WhatsApp';
        } else if (sourceUrl.includes('fb.me') || sourceUrl.includes('facebook.com')) {
            platform = 'Facebook';
        }

        const isAd = sourceType === 'ad' || !!referral.ad_id || !!referral.source_id || sourceUrl.includes('fb.me') || sourceUrl.includes('instagram.com/ad') || sourceUrl.includes('facebook.com/ads');
        const exactAdSource = isAd ? `${platform} Ad` : `${platform} Campaign`;
        const actualCampaignName = referral.headline || referral.campaign_name || referral.source_id || (referral.ad_id ? `Ad ID: ${referral.ad_id}` : null);
        const primarySource = isAd ? 'Ad' : 'Campaign';

        return { 
            source: primarySource, 
            adSource: exactAdSource, 
            campaignName: actualCampaignName, 
            referral 
        };
    }

    if (messageData?.campaignName || messageData?.campaign_name || messageData?.campaignId || messageData?.campaign_id || messageData?.context?.campaign_id) {
        const cName = messageData.campaignName || messageData.campaign_name || messageData.campaignId || messageData.campaign_id;
        return { 
            source: 'Campaign', 
            adSource: 'WhatsApp Campaign', 
            campaignName: cName ? String(cName) : null, 
            referral: null 
        };
    }

    return { source: null, adSource: null, campaignName: null, referral: null };
}

export async function handleWhatsAppWebhookGet(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');
   
    const pathParts = req.nextUrl.pathname.split('/');
    const organizationId = pathParts.includes('whatsapp-webhook')
        ? pathParts[pathParts.indexOf('whatsapp-webhook') + 1]
        : null;

    if (mode === 'subscribe') {
        // 1. Check organization-specific token (sha1(organizationId)) - Foodler parity
        if (organizationId) {
            const orgToken = crypto.createHash('sha1').update(organizationId).digest('hex');
            if (token === orgToken) {
                return new Response(challenge, {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }
        }

        // 2. Check env token (instant)
        const envToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
        if (token === envToken) {
            return new Response(challenge, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // 3. Check DB token
        const sysConfigs = await prisma.systemConfig.findMany({
            select: { metaWebhookVerifyToken: true },
            orderBy: { updatedAt: 'desc' },
            take: 5
        }).catch(() => []);

        if (sysConfigs.some(cfg => cfg.metaWebhookVerifyToken && cfg.metaWebhookVerifyToken === token)) {
            return new Response(challenge, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    }

    return new NextResponse('Forbidden', { status: 403 });
}


const log = (msg: string) => logger.webhook.info(msg);

async function fetchWhatsAppSenderProfilePic(params: {
    phoneNumberId?: string | null;
    waId?: string | null;
    userId?: string | null;
    accessToken?: string | null;
}): Promise<string | null> {
    const phoneNumberId = params.phoneNumberId?.trim();
    const waId = params.waId?.trim();
    const userId = params.userId?.trim();
    const accessToken = params.accessToken?.trim();
    if (!phoneNumberId || !waId || !accessToken) return null;

    // WhatsApp profile image availability depends on account privacy/settings.
    // We best-effort query Graph and silently fall back when unavailable.
    const endpointCandidates: Array<{
        type: 'json' | 'picture';
        url: string;
    }> = [];
    const nodeIds = [userId, waId].filter((id): id is string => !!id);
    for (const nodeId of nodeIds) {
        endpointCandidates.push(
            { type: 'json', url: `https://graph.facebook.com/v21.0/${encodeURIComponent(nodeId)}?fields=profile_pic,profile_picture_url` },
            { type: 'picture', url: `https://graph.facebook.com/v21.0/${encodeURIComponent(nodeId)}/picture?type=large&redirect=false` }
        );
    }

    for (const endpoint of endpointCandidates) {
        try {
            const res = await fetch(endpoint.url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            // If the node doesn't exist or permission is denied, silently skip.
            // This is common for WhatsApp regular users as Meta restricts profile querying via phone number.
            if (res.status === 400 || res.status === 403 || res.status === 404) {
                continue;
            }

            if (!res.ok) continue;

            if (endpoint.type === 'picture') {
                const data = await res.json().catch(() => null) as { data?: { url?: string } } | null;
                const picUrl = typeof data?.data?.url === 'string' ? data.data.url : '';
                if (picUrl) return picUrl;
                continue;
            }

            const data = await res.json().catch(() => null) as { profile_pic?: string; profile_picture_url?: string } | null;
            if (typeof data?.profile_pic === 'string' && data.profile_pic) return data.profile_pic;
            if (typeof data?.profile_picture_url === 'string' && data.profile_picture_url) return data.profile_picture_url;
        } catch {
            // Continue trying next endpoint candidate.
        }
    }

    return null;
}

async function triggerWebhookNotification(organizationId: string, title: string, body: string) {
    try {
        const systemConfig = await prisma.systemConfig.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: {
                pusherAppId: true,
                pusherKey: true,
                pusherSecret: true,
                pusherCluster: true,
            },
        });

        if (
            systemConfig?.pusherAppId &&
            systemConfig?.pusherKey &&
            systemConfig?.pusherSecret &&
            systemConfig?.pusherCluster
        ) {
            const pusher = getPusherServer({
                appId: systemConfig.pusherAppId,
                key: systemConfig.pusherKey,
                secret: systemConfig.pusherSecret,
                cluster: systemConfig.pusherCluster,
            });
            await pusher.trigger(`org-${organizationId}`, 'webhook:triggered', {
                title,
                body,
                createdAt: new Date().toISOString(),
            });
        }
    } catch (error) {
        logger.webhook.warn(`[WebhookNotification] Failed to trigger notification: ${String(error)}`);
    }
}

async function recordInboundActivityLog(params: {
    organizationId: string;
    actor: string;
    target: string;
    details?: string | null;
}) {
    try {
        await prisma.activityLog.create({
            data: {
                organizationId: params.organizationId,
                userName: params.actor,
                action: 'Received Message',
                module: 'Live Chat',
                target: params.target,
                details: params.details ?? null,
                status: 'success',
            },
        });
    } catch (error) {
        logger.webhook.warn(`[ActivityLog] Failed to record inbound message activity: ${String(error)}`);
    }
}



export async function handleWhatsAppWebhookPost(req: NextRequest) {
    try {
        // Extract organizationId from path if it exists (for organization-specific webhooks)
        const pathParts = req.nextUrl.pathname.split('/');
        const organizationIdFromPath = pathParts.includes('whatsapp-webhook')
            ? pathParts[pathParts.indexOf('whatsapp-webhook') + 1]
            : null;

        logger.webhook.info('--- Webhook Request Received ---');
        const rawBody = await req.text();
        logger.webhook.info(`Webhook raw payload: ${rawBody}`);

        const systemConfig = await prisma.systemConfig.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: {
                facebookAppId: true,
                facebookAppSecret: true,
                embeddedSignupAppSecret: true,
                pusherAppId: true,
                pusherKey: true,
                pusherSecret: true,
                pusherCluster: true,
                metaAppName: true,
            },
        }).catch(() => null);

        const appSecretFromDb = systemConfig?.facebookAppSecret || undefined;
        const embeddedSignupSecretFromDb = systemConfig?.embeddedSignupAppSecret || undefined;
        const additionalSecrets = (process.env.ADDITIONAL_META_APP_SECRETS || '').split(',').map(s => s.trim()).filter(Boolean);
        const signature = req.headers.get('x-hub-signature-256');
        const isProd = process.env.NODE_ENV === 'production';

        const candidateSecrets = [
            appSecretFromDb,
            embeddedSignupSecretFromDb,
            ...additionalSecrets
        ].filter((s): s is string => !!s);
        
        logger.webhook.info(`Signature verification: ${candidateSecrets.length} candidate secrets found.`);
        if (systemConfig?.facebookAppId) {
            logger.webhook.info(`Using App ID from DB: ${systemConfig.facebookAppId}`);
        }

        let hasValidSignature =
            !!signature &&
            candidateSecrets.some((secret, index) => {
                const isValid = verifySignature(signature, rawBody, secret);
                if (isValid) {
                    logger.webhook.info(`Signature verified successfully using secret at index ${index}.`);
                }
                return isValid;
            });

        let shouldBypassSignature = false;
        let parsedBody = null;
        try {
            parsedBody = JSON.parse(rawBody);
        } catch (e) {
            logger.webhook.error(`Failed to parse webhook JSON body: ${String(e)}`);
        }

        if (parsedBody && !hasValidSignature) {
            let phoneId = null;
            let wabaId = null;
            let pageId = null;

            const object = parsedBody.object;
            const entries = Array.isArray(parsedBody.entry) ? parsedBody.entry : [];
            const entry = entries[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            if (object === 'whatsapp_business_account') {
                phoneId = value?.metadata?.phone_number_id || null;
                wabaId = entry?.id || null;
            } else if (object === 'page') {
                pageId = entry?.id || null;
                if (Array.isArray(entry?.messaging) && entry.messaging.length > 0) {
                    pageId = entry.messaging[0]?.recipient?.id || entry.messaging[0]?.sender?.id || pageId;
                }
            } else if (object === 'instagram') {
                pageId = entry?.id || null;
            }

            logger.webhook.info(`[Signature Debug] phoneId: ${phoneId}, wabaId: ${wabaId}, pageId: ${pageId}, signature: ${signature}`);

            let org = null;
            try {
                if (organizationIdFromPath) {
                    org = await prisma.organization.findUnique({ where: { id: organizationIdFromPath } });
                }
                if (!org && phoneId) {
                    org = await prisma.organization.findFirst({ where: { whatsappPhoneNumberId: phoneId } });
                }
                if (!org && wabaId) {
                    org = await prisma.organization.findFirst({ where: { whatsappBusinessId: wabaId } });
                }
                if (!org && pageId) {
                    org = await prisma.organization.findFirst({
                        where: {
                            OR: [
                                { facebookPageId: pageId },
                                { instagramBusinessId: pageId }
                            ]
                        }
                    });
                }
            } catch (err) {
                logger.webhook.error(`[Signature Debug] Org lookup error: ${String(err)}`);
            }

            if (org) {
                logger.webhook.info(`[Signature Debug] Found Org: ${org.name} (${org.id}), customSecret: ${org.metaAppSecret ? '[PRESENT]' : '[MISSING]'}, customToken: ${org.metaAccessToken ? '[PRESENT]' : '[MISSING]'}`);
                if (org.metaAppSecret && !hasValidSignature && signature) {
                    const isCustomValid = verifySignature(signature, rawBody, org.metaAppSecret);
                    if (isCustomValid) {
                        hasValidSignature = true;
                        logger.webhook.info(`Signature verified successfully using custom App Secret for Org ${org.name}.`);
                    }
                }
                
                if (org.metaAccessToken && !hasValidSignature) {
                    shouldBypassSignature = true;
                    logger.webhook.warn(`[Webhook] Signature check bypassed for Org ${org.name} (${org.id}) because they use a custom Meta App configuration.`);
                }
            } else {
                logger.webhook.warn(`[Signature Debug] No Org found matching identifiers.`);
            }
        }

        if (isProd) {
            if (candidateSecrets.length === 0) {
                logger.webhook.error('WhatsApp webhook rejected: META_APP_SECRET/facebookAppSecret is not configured.');
                return new NextResponse('Webhook signature secret not configured', { status: 503 });
            }
            if (!hasValidSignature && !shouldBypassSignature) {
                logger.webhook.warn(`WhatsApp webhook rejected: invalid signature. Candidate secret lengths: ${candidateSecrets.map(s => s.length).join(', ')}`);
                return new NextResponse('Unauthorized webhook signature', { status: 401 });
            }
        } else if (!hasValidSignature && !shouldBypassSignature) {
            logger.webhook.warn(`WhatsApp webhook signature check bypassed in non-production mode. Candidate secret lengths: ${candidateSecrets.map(s => s.length).join(', ')}`);
        }

        const body = parsedBody || JSON.parse(rawBody);

        logger.webhook.info('Webhook payload received.');

        const object = body.object; //'whatsapp_business_account' or'instagram'
        const entries = Array.isArray(body.entry) ? body.entry : [];

        logger.webhook.info(`[Webhook] Object: ${object}, Entries: ${entries.length}`);

        if (object === 'instagram') {
            for (const entry of entries) {
                await handleInstagramEntry(entry);
            }
            return new NextResponse('OK', { status: 200 });
        }
        if (object === 'page') {
            for (const entry of entries) {
                const pageEntry = entry as any;
                const pageId = pageEntry.id;
                
                logger.webhook.info(`[Webhook] Processing Page Entry ID: ${pageId}`);

                // Meta can deliver Instagram messaging under object=page.
                if (Array.isArray(pageEntry.messaging) && pageEntry.messaging.length > 0) {
                    const recipientId = pageEntry.messaging[0]?.recipient?.id;
                    const senderId = pageEntry.messaging[0]?.sender?.id;
                    
                    logger.webhook.info(`[Webhook] Messenger Event: sender=${senderId}, recipient=${recipientId}`);

                    if (!recipientId) continue;

                    const instagramOrg = await prisma.organization.findFirst({
                        where: { instagramBusinessId: recipientId },
                        select: { id: true },
                    });

                    if (instagramOrg) {
                        logger.webhook.info(`[Webhook] Routing to Instagram handler for org ${instagramOrg.id}`);
                        await handleInstagramEntry(entry);
                    } else {
                        logger.webhook.info(`[Webhook] Routing to Facebook Messaging handler`);
                        await handleFacebookMessagingEntry(entry);
                    }
                    continue;
                }

                if (Array.isArray(pageEntry.changes) && pageEntry.changes.length > 0) {
                    logger.webhook.info(`[Webhook] Feed/Change Event: ${pageEntry.changes[0]?.field}`);
                    await handleFacebookPageEntry(entry);
                    continue;
                }
                
                logger.webhook.warn(`[Webhook] Page entry with no messaging or changes: ${JSON.stringify(pageEntry)}`);
            }
            return new NextResponse('OK', { status: 200 });
        }
        const entry = entries[0];

        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value) {
            logger.webhook.info('Webhook received but no value found in changes');
            return new NextResponse('OK', { status: 200 });
        }

        // Handle Meta Phone Number Quality & Messaging Limit Tier Webhook updates
        const messagingLimitTier = value.messaging_limit_tier || value.event_data?.messaging_limit_tier;
        if (messagingLimitTier || changes?.field === 'phone_number_quality_update') {
            const payloadPhoneId = value.metadata?.phone_number_id || value.phone_number_id;
            if (payloadPhoneId || entry?.id) {
                const org = await prisma.organization.findFirst({
                    where: {
                        OR: [
                            ...(payloadPhoneId ? [{ whatsappPhoneNumberId: payloadPhoneId }] : []),
                            ...(entry?.id ? [{ whatsappBusinessId: entry.id }] : [])
                        ]
                    }
                });
                if (org && messagingLimitTier) {
                    const rawData = (org.whatsapp_onboarding_raw_data as object) || {};
                    await prisma.organization.update({
                        where: { id: org.id },
                        data: {
                            whatsapp_onboarding_raw_data: {
                                ...rawData,
                                messaging_limit_tier: messagingLimitTier,
                                metaQuotaLimit: messagingLimitTier
                            }
                        }
                    }).catch(err => logger.webhook.error(`[Webhook Tier Sync] Failed: ${err.message}`));
                    logger.webhook.info(`[Webhook] Real-time Meta Limit Tier updated for ${org.name}: ${messagingLimitTier}`);
                }
            }
        }

        // Check if it's a message
        if (value.messages && value.messages.length > 0) {
            const phoneNumberId = value.metadata?.phone_number_id;

            if (!phoneNumberId) {
                logger.webhook.error('No phone number ID found in webhook');
                return new NextResponse('OK', { status: 200 });
            }

            // Find Organization & WhatsApp Channel
            let org: any = null;
            let resolvedChannel: any = null;

            // 0. Channel-level Lookup: By WhatsAppChannel Phone Number ID
            if (phoneNumberId) {
                resolvedChannel = await prisma.whatsAppChannel.findFirst({
                    where: { phoneNumberId }
                }).catch(() => null);

                if (resolvedChannel) {
                    org = await prisma.organization.findUnique({
                        where: { id: resolvedChannel.organizationId }
                    }).catch(() => null);
                    if (org) {
                        logger.webhook.info(`Found organization via WhatsAppChannel (${resolvedChannel.name}): ${org.name} (${org.id})`);
                    }
                }
            }

            // 1. Primary Lookup: By Organization Phone Number ID (Fallback / Legacy single-number orgs)
            if (!org && phoneNumberId) {
                const candidateOrgs = await prisma.organization.findMany({
                    where: { whatsappPhoneNumberId: phoneNumberId }
                });
                
                if (candidateOrgs.length > 0) {
                    const incomingDisplayNumber = value.metadata?.display_phone_number;
                    if (incomingDisplayNumber) {
                        const cleanIncoming = cleanPhoneNumber(incomingDisplayNumber);
                        org = candidateOrgs.find(o => o.whatsappNumber && cleanPhoneNumber(o.whatsappNumber) === cleanIncoming);
                    }
                    if (!org) {
                        org = candidateOrgs.find(o => !o.whatsappNumber) || candidateOrgs[0];
                    }
                }
                
                if (org) {
                    logger.webhook.info(`Found organization by Phone Number ID: ${org.name} (${org.id})`);
                }
            }

            // 2. Secondary Lookup: By Path ID (Fallback for onboarding/misconfiguration)
            if (!org && organizationIdFromPath) {
                logger.webhook.info(`No organization found for Phone Number ID ${phoneNumberId}. Trying path ID: ${organizationIdFromPath}`);
                org = await prisma.organization.findUnique({
                    where: { id: organizationIdFromPath }
                });

                // SECURITY: If found by path but it already has a DIFFERENT number ID and no channel matching,
                // DO NOT proceed.
                const hasMatchingChannel = org ? await prisma.whatsAppChannel.findFirst({
                    where: { organizationId: org.id, phoneNumberId }
                }).catch(() => null) : null;

                if (org?.whatsappPhoneNumberId && org.whatsappPhoneNumberId !== phoneNumberId && !hasMatchingChannel) {
                    logger.webhook.warn(`[Webhook] Security Alert: Org ${org.id} in path has different Phone Number ID (${org.whatsappPhoneNumberId}). Incoming message for ${phoneNumberId} ignored.`);
                    return new NextResponse('OK', { status: 200 });
                }
            }

            if (!org) {
                logger.webhook.error(`No organization found for Phone Number ID: ${phoneNumberId}${organizationIdFromPath ? ` or Org ID: ${organizationIdFromPath}` : ''}`);
                logger.webhook.warn('Please ensure the WhatsApp Phone Number ID is correctly saved in the Organization settings.');
                return new NextResponse('OK', { status: 200 });
            }

            // Ensure resolvedChannel is populated if found through org
            if (!resolvedChannel) {
                resolvedChannel = await prisma.whatsAppChannel.findFirst({
                    where: { organizationId: org.id, phoneNumberId }
                }).catch(() => null);
            }

            logger.webhook.success(`Processing for Organization: ${org.name} (${org.id})${resolvedChannel ? ` Channel: ${resolvedChannel.name}` : ''}`);
            logger.webhook.info(`[FilterCheck] DB Phone Number ID: "${org.whatsappPhoneNumberId}", Payload Phone Number ID: "${phoneNumberId}"`);

            // 3. Validate Phone Number ID and Display Phone Number (Strict Filtering)
            // Allow if matches org.whatsappPhoneNumberId OR any connected channel of this org
            const isKnownChannel = resolvedChannel || (org.whatsappPhoneNumberId === phoneNumberId);
            if (!isKnownChannel && org.whatsappPhoneNumberId && phoneNumberId && org.whatsappPhoneNumberId !== phoneNumberId) {
                logger.webhook.warn(`[Webhook] Ignoring message for Org ${org.id}: Phone Number ID mismatch. Expected: ${org.whatsappPhoneNumberId}, Got: ${phoneNumberId}.`);
                return new NextResponse('OK', { status: 200 });
            }

            const incomingDisplayNumber = value.metadata?.display_phone_number;
            if (!resolvedChannel && org.whatsappNumber && incomingDisplayNumber) {
                const cleanOrgNum = cleanPhoneNumber(org.whatsappNumber);
                const cleanIncomingNum = cleanPhoneNumber(incomingDisplayNumber);
                if (cleanOrgNum && cleanIncomingNum && cleanOrgNum !== cleanIncomingNum) {
                    logger.webhook.warn(`[Webhook] Ignoring message for Org ${org.id}: Display Phone Number mismatch. Expected: ${cleanOrgNum}, Got: ${cleanIncomingNum}.`);
                    return new NextResponse('OK', { status: 200 });
                }
            }

            // Enhanced Self-healing: Update missing Phone Number ID and WABA ID.
            // We avoid auto-switching IDs if they already exist to prevent hijacking in shared App environments.
            const wabaIdFromPayload = entry?.id;
            let needsUpdate = false;
            const updateData: any = {};

            if (phoneNumberId && !org.whatsappPhoneNumberId) {
                // Ensure the incoming display number matches the configured display number if present
                let canSelfHeal = true;
                if (org.whatsappNumber && incomingDisplayNumber) {
                    const cleanOrgNum = cleanPhoneNumber(org.whatsappNumber);
                    const cleanIncomingNum = cleanPhoneNumber(incomingDisplayNumber);
                    if (cleanOrgNum !== cleanIncomingNum) {
                        canSelfHeal = false;
                    }
                }

                if (canSelfHeal) {
                    logger.webhook.info(`[SelfHealing] Setting Phone Number ID for Org ${org.id}: ${phoneNumberId}`);
                    updateData.whatsappPhoneNumberId = phoneNumberId;
                    needsUpdate = true;
                } else {
                    logger.webhook.warn(`[SelfHealing] Bypassed setting Phone Number ID for Org ${org.id} due to phone number mismatch.`);
                }
            }

            if (wabaIdFromPayload && !org.whatsappBusinessId) {
                logger.webhook.info(`[SelfHealing] Setting WABA ID for Org ${org.id}: ${wabaIdFromPayload}`);
                updateData.whatsappBusinessId = wabaIdFromPayload;
                needsUpdate = true;
            }

            const rawOnboarding = (org.whatsapp_onboarding_raw_data as any) || {};
            const currentPhoneStatus = rawOnboarding?.phone_info?.status;
            if (currentPhoneStatus !== 'LIVE') {
                updateData.whatsapp_onboarding_raw_data = {
                    ...rawOnboarding,
                    phone_info: {
                        ...(rawOnboarding.phone_info || {}),
                        status: 'LIVE',
                        last_synced_at: new Date().toISOString()
                    }
                };
                needsUpdate = true;
            }

            if (needsUpdate) {
                logger.webhook.info(`[SelfHealing] Syncing Organization ${org.id} IDs and status with latest webhook payload...`);
                await prisma.organization.update({
                    where: { id: org.id },
                    data: updateData
                }).catch(err => logger.webhook.error(`[SelfHealing] Failed to update IDs: ${err.message}`));
                
                // Update local org object for immediate use
                if (updateData.whatsappPhoneNumberId) org.whatsappPhoneNumberId = updateData.whatsappPhoneNumberId;
                if (updateData.whatsappBusinessId) org.whatsappBusinessId = updateData.whatsappBusinessId;
                if (updateData.whatsapp_onboarding_raw_data) org.whatsapp_onboarding_raw_data = updateData.whatsapp_onboarding_raw_data;
            }

            const messageData = value.messages ? value.messages[0] : (value.calls ? value.calls[0] : null);
            if (!messageData && !value.calls) {
              logger.webhook.info('No messages or calls in webhook payload');
              return new NextResponse('OK', { status: 200 });
            }

            // Handle incoming call webhooks
            if (value.calls || (messageData && messageData.type === 'call')) {
              const callObj = value.calls ? value.calls[0] : messageData;
              const callerWaId = callObj.from || callObj.caller;
              const callId = callObj.id || `call-${Date.now()}`;
              const callStatus = callObj.status || 'offered';

              logger.webhook.info(`[Incoming Call] Call ID: ${callId}, Status: ${callStatus}, From: ${callerWaId}`);

              if (callerWaId) {
                const contact = await prisma.contact.findFirst({
                  where: { organizationId: org.id, waId: callerWaId },
                  select: { id: true, name: true, waId: true },
                });

                if (systemConfig?.pusherAppId && systemConfig?.pusherKey && systemConfig?.pusherSecret && systemConfig?.pusherCluster) {
                  const pusher = getPusherServer({
                    appId: systemConfig.pusherAppId,
                    key: systemConfig.pusherKey,
                    secret: systemConfig.pusherSecret,
                    cluster: systemConfig.pusherCluster,
                  });

                  await pusher.trigger(`org-${org.id}`, 'incoming-call', {
                    callId,
                    callerNumber: callerWaId,
                    callerName: contact?.name || `+${callerWaId}`,
                    contactId: contact?.id,
                    timestamp: new Date().toISOString(),
                  });
                }
              }

              if (!value.messages) {
                return new NextResponse('OK', { status: 200 });
              }
            }

            const contactData = value.contacts?.[0]; // Sender info

            const waId = messageData.from; // Sender's phone number
            const senderUserId = messageData.from_user_id || contactData?.user_id || null;
            
            const META_AUTH_SENDERS = new Set([
                '447974904959',
                '12485302708',
                '447710173736',
                '16505434800',
                '447441923485',
                '447441923486',
                '16508531300',
                '16503087300',
                '16503087320',
                '18332639993',
                '18339582008'
            ]);

            const profileName = (contactData?.profile?.name || '').trim();
            const isMetaSender = META_AUTH_SENDERS.has(waId) ||
                /^(meta|facebook|meta security|facebook security|instagram security|whatsapp)$/i.test(profileName) ||
                /^(meta|facebook|instagram)\s+(security|verify|verification|support)$/i.test(profileName);

            // Refined name extraction: Identify Meta/Facebook Security senders or avoid dots
            let name = contactData?.profile?.name || waId;
            if (isMetaSender) {
                name = 'Meta / Facebook Security';
            } else if (!name || name.trim() === '.' || name.trim() === '') {
                name = waId;
            }

            const msgType = messageData.type;
            const wamid = messageData.id;
            const contextWamid = messageData.context?.id;
            const senderProfilePic = await fetchWhatsAppSenderProfilePic({
                phoneNumberId: org.whatsappPhoneNumberId,
                waId,
                userId: senderUserId,
                accessToken: org.metaAccessToken
            });

            log(`Message Type: ${msgType}, WA_ID: ${waId}`);

            const existingMessage = wamid
                ? await prisma.message.findUnique({
                    where: { wamid },
                    select: { id: true }
                })
                : null;
            if (existingMessage) {
                logger.webhook.info(`Duplicate inbound message ignored (wamid: ${wamid})`);
            } else {
                // Check if this is a Meta revoke/protocol event for a previously sent/received message
                if (msgType === 'protocol' || msgType === 'revoke' || messageData.protocol?.type === 'revoke') {
                    const revokedWamid = messageData.revoke?.original_message_id || messageData.protocol?.id || messageData.revoke?.id;
                    logger.webhook.info(`[Webhook] Protocol Revoke event for wamid: ${revokedWamid}`);

                    if (revokedWamid) {
                        const targetMsg = await prisma.message.findUnique({
                            where: { wamid: revokedWamid }
                        });
                        if (targetMsg) {
                            const updatedRawBody = {
                                ...((targetMsg.rawBody as object) || {}),
                                isRevoked: true,
                                revokedAt: new Date().toISOString()
                            };
                            await prisma.message.update({
                                where: { id: targetMsg.id },
                                data: {
                                    status: 'revoked',
                                    rawBody: updatedRawBody as any
                                }
                            });
                            // Trigger Pusher update for live chat UI
                            try {
                                if (
                                    systemConfig?.pusherAppId &&
                                    systemConfig?.pusherKey &&
                                    systemConfig?.pusherSecret &&
                                    systemConfig?.pusherCluster
                                ) {
                                    const { getPusherServer } = await import('@/lib/pusher');
                                    const pusherServer = getPusherServer({
                                        appId: systemConfig.pusherAppId,
                                        key: systemConfig.pusherKey,
                                        secret: systemConfig.pusherSecret,
                                        cluster: systemConfig.pusherCluster,
                                    });
                                    await pusherServer.trigger(`org-${org.id}`, 'new-message', {
                                        id: targetMsg.id,
                                        contactId: targetMsg.contactId,
                                        content: targetMsg.content,
                                        type: targetMsg.type,
                                        direction: targetMsg.direction,
                                        createdAt: targetMsg.createdAt,
                                        status: 'revoked',
                                        isRevoked: true
                                    });
                                }
                            } catch (e) {
                                // ignore pusher trigger failure
                            }
                            return new NextResponse('OK', { status: 200 });
                        }
                    }
                }

                // Check if this is a Meta edit event for a previously sent/received message
                if (msgType === 'edit' || messageData.edit?.original_message_id) {
                    const editedOriginalWamid = messageData.edit?.original_message_id;
                    const newEditedText = messageData.edit?.message?.text?.body || messageData.text?.body || messageData.edit?.text;
                    logger.webhook.info(`[Webhook] Edit event for wamid: ${editedOriginalWamid}, new text: "${newEditedText}"`);

                    if (editedOriginalWamid) {
                        const targetMsg = await prisma.message.findUnique({
                            where: { wamid: editedOriginalWamid }
                        });
                        if (targetMsg && newEditedText) {
                            const updatedRawBody = {
                                ...((targetMsg.rawBody as object) || {}),
                                isEdited: true,
                                previousContent: targetMsg.content,
                                editedAt: new Date().toISOString()
                            };
                            await prisma.message.update({
                                where: { id: targetMsg.id },
                                data: {
                                    content: newEditedText,
                                    rawBody: updatedRawBody as any
                                }
                            });
                            // Update contact's lastMessage if targetMsg was the last message
                            const existingContactForEdit = await prisma.contact.findUnique({
                                where: {
                                    organizationId_platform_waId: {
                                        organizationId: org.id,
                                        platform: 'WHATSAPP',
                                        waId: waId
                                    }
                                }
                            });
                            if (existingContactForEdit && existingContactForEdit.lastMessage === targetMsg.content) {
                                await prisma.contact.update({
                                    where: { id: existingContactForEdit.id },
                                    data: { lastMessage: newEditedText }
                                });
                            }
                            // Trigger Pusher update for live chat UI
                            try {
                                if (
                                    systemConfig?.pusherAppId &&
                                    systemConfig?.pusherKey &&
                                    systemConfig?.pusherSecret &&
                                    systemConfig?.pusherCluster
                                ) {
                                    const { getPusherServer } = await import('@/lib/pusher');
                                    const pusherServer = getPusherServer({
                                        appId: systemConfig.pusherAppId,
                                        key: systemConfig.pusherKey,
                                        secret: systemConfig.pusherSecret,
                                        cluster: systemConfig.pusherCluster,
                                    });
                                    await pusherServer.trigger(`org-${org.id}`, 'new-message', {
                                        id: targetMsg.id,
                                        contactId: targetMsg.contactId,
                                        content: newEditedText,
                                        type: targetMsg.type,
                                        direction: targetMsg.direction,
                                        createdAt: targetMsg.createdAt,
                                        status: targetMsg.status,
                                        isEdited: true
                                    });
                                }
                            } catch (e) {
                                // ignore pusher trigger failure
                            }
                            return new NextResponse('OK', { status: 200 });
                        }
                    }
                }

                // Extract content
                let content = '';
                let mediaUrl = '';
                let buttonId = '';

                if (msgType === 'edit') {
                    content = messageData.edit?.message?.text?.body || messageData.text?.body || '[Edited Message]';
                } else if (msgType === 'text') {
                    const rawText = messageData.text?.body || '';
                    // Extract and format Facebook / Instagram / Meta confirmation code if present
                    const otpMatch = rawText.match(/\b(\d{4,8})\b.*(?:confirmation|verification|code)/i) ||
                                     rawText.match(/(?:confirmation|verification|code).*?\b(\d{4,8})\b/i);
                    const isOfficialMetaText = isMetaSender || 
                        /(?:facebook|instagram).*?(?:confirmation|verification|security)\s*(?:code|otp)|\b(?:fb|ig)-?\d{4,8}\b/i.test(rawText) ||
                        /(?:confirmation|verification)\s*(?:code|otp).*?(?:facebook|instagram)/i.test(rawText);

                    if (isOfficialMetaText && otpMatch) {
                        const code = otpMatch[1];
                        content = `🔑 Facebook Confirmation Code: ${code}\n\n${rawText}`;
                    } else {
                        content = rawText;
                    }
                } else if (msgType === 'interactive') {
                    const interactive = messageData.interactive;
                    if (interactive?.type === 'button_reply') {
                        content = interactive.button_reply?.title;
                        buttonId = interactive.button_reply?.id;
                        log(`Button Reply received: ${content} (ID: ${buttonId})`);
                        
                        // Handle Platform Actions (Shopify/WooCommerce)
                        const { handlePlatformButtonAction } = await import('@/lib/messaging/platform-actions');
                        handlePlatformButtonAction({
                            organizationId: org.id,
                            waId: waId,
                            buttonText: content,
                            contextWamid: contextWamid
                        }).catch(e => logger.webhook.error(`[PlatformAction] Error: ${e.message}`));

                    } else if (interactive?.type === 'list_reply') {
                        content = interactive.list_reply?.title;
                        buttonId = interactive.list_reply?.id;
                        log(`List Reply received: ${content} (ID: ${buttonId})`);
                    }
                } else if (msgType === 'button') {
                    content = messageData.button?.text;
                    buttonId = messageData.button?.payload || messageData.button?.text;
                    log(`Template Button received: ${content} (ID: ${buttonId})`);

                    // Handle Platform Actions (Shopify/WooCommerce)
                    const { handlePlatformButtonAction } = await import('@/lib/messaging/platform-actions');
                    handlePlatformButtonAction({
                        organizationId: org.id,
                        waId: waId,
                        buttonText: content,
                        contextWamid: contextWamid
                    }).catch(e => logger.webhook.error(`[PlatformAction] Error: ${e.message}`));
                } else if (msgType === 'image') {
                    const mediaId = messageData.image?.id;
                    content = messageData.image?.caption || '[Image]';
                    if (mediaId) {
                        const { downloadAndSaveMedia, getAppBaseUrl } = await import('@/lib/storage/media');
                        mediaUrl = await downloadAndSaveMedia(mediaId, org.metaAccessToken) || `${getAppBaseUrl()}/api/media/${mediaId}?orgId=${org.id}`;
                    }
                } else if (msgType === 'document') {
                    const mediaId = messageData.document?.id;
                    content = messageData.document?.caption || messageData.document?.filename || '[Document]';
                    if (mediaId) {
                        const { downloadAndSaveMedia, getAppBaseUrl } = await import('@/lib/storage/media');
                        mediaUrl = await downloadAndSaveMedia(mediaId, org.metaAccessToken) || `${getAppBaseUrl()}/api/media/${mediaId}?orgId=${org.id}`;
                    }
                } else if (msgType === 'audio') {
                    const mediaId = messageData.audio?.id;
                    const nativeTranscription = messageData.audio?.transcription?.text;
                    const isVoiceNote = messageData.audio?.voice === true || 
                                        Boolean(messageData.audio?.mime_type && (messageData.audio.mime_type.includes('opus') || messageData.audio.mime_type === 'audio/ogg'));
                    
                    if (nativeTranscription) {
                        content = nativeTranscription;
                        log(`[Meta] Native voice transcription detected: "${content}"`);
                    } else if (isVoiceNote) {
                        content = '[Voice Message]';
                    } else {
                        content = '[Audio]';
                    }

                    if (mediaId) {
                        const { downloadAndSaveMedia, getAppBaseUrl } = await import('@/lib/storage/media');
                        mediaUrl = await downloadAndSaveMedia(mediaId, org.metaAccessToken) || `${getAppBaseUrl()}/api/media/${mediaId}?orgId=${org.id}`;
                        
                        // Attempt to transcribe with Gemini or OpenAI if native transcription is missing
                        if (!nativeTranscription && org.metaAccessToken) {
                            try {
                                const { downloadWhatsAppMedia } = await import('@/lib/ai/wit');
                                const { transcribeAudio } = await import('@/lib/ai/openai');
                                const audioBuffer = await downloadWhatsAppMedia(mediaId, org.metaAccessToken);
                                if (audioBuffer) {
                                    const mimeType = messageData.audio?.mime_type || 'audio/ogg';
                                    const orgApiKeys = (org.aiApiKeys && typeof org.aiApiKeys === 'object') ? org.aiApiKeys as Record<string, string> : {};
                                    const transcript = await transcribeAudio(audioBuffer, {
                                        fileName: `${mediaId}.ogg`,
                                        mimeType,
                                        apiKeys: orgApiKeys,
                                        apiKey: org.aiProviderApiKey || undefined,
                                        provider: (org.aiProvider as any) || 'auto',
                                        organizationId: org.id
                                    });
                                    if (transcript) {
                                        content = transcript;
                                        log(`[Voice Transcription] Transcribed: "${transcript}"`);
                                    }
                                }
                            } catch (err: any) {
                                logger.webhook.warn(`[Voice Transcription] Failed: ${err.message}`);
                            }
                        }
                    }
                } else if (msgType === 'video') {
                    const mediaId = messageData.video?.id;
                    content = '[Video]' + (messageData.video?.caption || '');
                    if (mediaId) {
                        const { downloadAndSaveMedia, getAppBaseUrl } = await import('@/lib/storage/media');
                        mediaUrl = await downloadAndSaveMedia(mediaId, org.metaAccessToken) || `${getAppBaseUrl()}/api/media/${mediaId}?orgId=${org.id}`;
                    }
                } else if (msgType === 'sticker') {
                    const mediaId = messageData.sticker?.id;
                    content = '[Sticker]';
                    if (mediaId) {
                        const { downloadAndSaveMedia, getAppBaseUrl } = await import('@/lib/storage/media');
                        mediaUrl = await downloadAndSaveMedia(mediaId, org.metaAccessToken) || `${getAppBaseUrl()}/api/media/${mediaId}?orgId=${org.id}`;
                    }
                } else if (msgType === 'location') {
                    const loc = messageData.location;
                    content = `[Location] Lat: ${loc.latitude}, Long: ${loc.longitude}`;
                    if (loc.name) content += ` (${loc.name})`;
                    log(`Location received: ${content}`);
                } else if (msgType === 'reaction') {
                    const targetWamid = messageData.reaction?.message_id;
                    const emoji = (messageData.reaction?.emoji || '').trim();

                    if (targetWamid) {
                        const targetMsg = await prisma.message.findFirst({
                            where: { wamid: targetWamid }
                        });
                        if (targetMsg) {
                            const raw = (targetMsg.rawBody as any) || {};
                            let reactions = Array.isArray(raw.reactions) ? [...raw.reactions] : [];
                            reactions = reactions.filter((r: any) => r.sender !== waId);
                            if (emoji) {
                                reactions.push({ emoji, sender: waId, fromMe: false });
                            }
                            const updatedRaw = {
                                ...raw,
                                reactions,
                                reaction: reactions.length > 0 ? reactions[reactions.length - 1] : null,
                            };
                            await prisma.message.update({
                                where: { id: targetMsg.id },
                                data: { rawBody: updatedRaw }
                            });
                            await Promise.allSettled([
                                triggerPusherOrgEvent(org.id, 'message:reaction', {
                                    messageId: targetMsg.id,
                                    contactId: targetMsg.contactId,
                                    reactions,
                                    rawBody: updatedRaw
                                }),
                                triggerPusherOrgEvent(org.id, 'message:update', {
                                    messageId: targetMsg.id,
                                    contactId: targetMsg.contactId,
                                    rawBody: updatedRaw
                                })
                            ]);
                            return new NextResponse('EVENT_RECEIVED', { status: 200 });
                        }
                    }
                    return new NextResponse('EVENT_RECEIVED', { status: 200 });
                } else if (msgType === 'contacts' || msgType === 'contact') {
                    const contactsList = messageData.contacts || [];
                    const contactDetails = contactsList.map((c: any) => {
                        const name = c.name?.formatted_name || c.name?.first_name || '';
                        const emails = c.emails?.map((e: any) => e.email).filter(Boolean).join(', ');
                        const phones = c.phones?.map((p: any) => p.phone).filter(Boolean).join(', ');
                        return [name, emails, phones].filter(Boolean).join(' | ');
                    }).filter(Boolean).join(' ; ');

                    content = contactDetails ? `[Contact Shared: ${contactDetails}]` : '[Contact Shared]';
                    log(`Contact shared: ${content}`);
                } else if (msgType === 'system') {
                    const sys = messageData.system;
                    const sysBody = sys?.body || sys?.text;
                    if (sysBody) {
                        content = sysBody;
                    } else if (sys?.type === 'user_changed_number') {
                        content = `WhatsApp System Notification: Contact changed phone number${sys.new_wa_id || sys.wa_id ? ' to ' + (sys.new_wa_id || sys.wa_id) : ''}`;
                    } else if (sys?.type === 'user_identity_changed') {
                        content = `WhatsApp System Notification: Contact updated security code / identity`;
                    } else {
                        content = sys?.description || sys?.type ? `WhatsApp System Notification: ${sys.type || sys.description}` : 'WhatsApp System Notification';
                    }
                } else if (msgType === 'unsupported') {
                    const errCode = messageData.errors?.[0]?.code;
                    let errorDetail = messageData.errors?.[0]?.error_data?.details || 'Message type is currently not supported';
                    if (errorDetail.endsWith('.')) {
                        errorDetail = errorDetail.slice(0, -1);
                    }

                    // If incoming message is from Meta Security, it is an authentication template delivered as unsupported by Cloud API
                    if (isMetaSender) {
                        content = `🔐 Meta / Facebook Login Verification Code (Authentication Template)\n\nMeta has sent an encrypted 2FA Authentication message to this number.\n\n(Note: To receive the plain numeric code directly in WatiBot, please choose 'Send code via SMS' on Facebook/Instagram).`;
                    } else {
                        content = `[Unsupported: ${errorDetail}]`;
                    }
                } else {
                    content = `[${msgType}]`;
                }
                
                // --- BLOCK CHECK & PRE-FETCH ---
                const existingContact = await prisma.contact.findUnique({
                    where: {
                        organizationId_platform_waId: {
                            organizationId: org.id,
                            platform: 'WHATSAPP',
                            waId: waId
                        }
                    },
                    select: { id: true, isBlocked: true, name: true, whatsappName: true, customAttributes: true }
                });

                if (existingContact?.isBlocked) {
                    logger.webhook.info(`[Webhook] Message from BLOCKED contact ${waId} ignored.`);
                    return new NextResponse('OK', { status: 200 });
                }

                const msgTimestamp = messageData.timestamp
                    ? new Date(parseInt(messageData.timestamp) * 1000)
                    : new Date();
                const isDelayed = (new Date().getTime() - msgTimestamp.getTime()) > 5 * 60 * 1000;

                const { source: detectedSource, adSource: detectedAdSource, campaignName: detectedCampaignName, referral: referralData } = extractSourceFromMessageData(messageData);

                // Upsert Contact (with customAttributes, source attribution, adSource, campaignName, and custom name protection)
                let contact;
                if (existingContact) {
                    const existingAttrs = (existingContact.customAttributes as Record<string, any>) || {};
                    const existingSource = existingAttrs.source || existingAttrs.contactSource || null;
                    const existingAdSource = existingAttrs.adSource || null;
                    const existingCampaignName = existingAttrs.campaignName || existingAttrs.adTitle || null;

                    let finalSource: string;
                    let finalAdSource: string | null;
                    let finalCampaignName: string | null;

                    if (detectedSource) {
                        finalSource = detectedSource;
                        finalAdSource = detectedAdSource;
                        finalCampaignName = detectedCampaignName;
                    } else if (existingSource && existingSource !== 'General' && existingSource !== 'Organic') {
                        finalSource = existingSource;
                        finalAdSource = existingAdSource;
                        finalCampaignName = existingCampaignName;
                    } else {
                        finalSource = existingSource || 'General';
                        finalAdSource = existingAdSource;
                        finalCampaignName = existingCampaignName;
                    }

                    const updatedAttrs: Record<string, any> = {
                        ...existingAttrs,
                        ...(contactData || {}),
                        source: finalSource,
                        contactSource: finalSource,
                        ...(finalAdSource ? { adSource: finalAdSource } : {}),
                        ...(finalCampaignName ? { campaignName: finalCampaignName, adTitle: finalCampaignName } : {})
                    };

                    if (referralData && typeof referralData === 'object' && Object.keys(referralData).length > 0) {
                        const adSourceId = referralData.source_id || referralData.ad_id || '';
                        const adSourceType = (referralData.source_type || (referralData.ad_id ? 'ad' : 'post')).toLowerCase();
                        const ctwaClickId = referralData.ctwa_clid || '';
                        const adHeadline = referralData.headline || '';
                        const adBody = referralData.body || '';
                        const adSourceUrl = referralData.source_url || '';
                        const adMediaType = referralData.media_type || '';

                        if (adSourceId) {
                            updatedAttrs.ad_source_id = adSourceId;
                            updatedAttrs.adId = adSourceId;
                        }
                        if (adSourceType) updatedAttrs.ad_source_type = adSourceType;
                        if (ctwaClickId) updatedAttrs.ctwa_click_id = ctwaClickId;
                        if (adHeadline) {
                            updatedAttrs.ad_headline = adHeadline;
                            updatedAttrs.adTitle = adHeadline;
                            if (!updatedAttrs.campaignName) {
                                updatedAttrs.campaignName = adHeadline;
                            }
                        }
                        if (adBody) updatedAttrs.ad_body = adBody;
                        if (adSourceUrl) updatedAttrs.ad_source_url = adSourceUrl;
                        if (adMediaType) updatedAttrs.ad_media_type = adMediaType;
                        updatedAttrs.ad_attributed_at = msgTimestamp.toISOString();
                        updatedAttrs.referral = referralData;
                    }

                    // Delete only temporary media fields
                    delete updatedAttrs.lastMediaUrl;
                    delete updatedAttrs.lastMediaType;
                    delete updatedAttrs.lastMediaFilename;

                    const calculatedExpiresAt = new Date(msgTimestamp.getTime() + 24 * 60 * 60 * 1000);

                    const targetContactName = isMetaSender ? 'Meta / Facebook Security' : name;

                    contact = await prisma.contact.update({
                        where: { id: existingContact.id },
                        data: {
                            isAutoCreated: false,
                            whatsappName: targetContactName,
                            ...(isMetaSender || !existingContact.name || existingContact.name === waId ? { name: targetContactName } : {}),
                            ...(senderProfilePic ? { profilePic: senderProfilePic } : {}),
                            customAttributes: updatedAttrs as any,
                            lastMessage: content,
                            lastMessageAt: msgTimestamp,
                            lastInboundMessageAt: msgTimestamp, // Track for 24hr window
                            windowExpiresAt: calculatedExpiresAt,
                            windowStatus: 'ACTIVE',
                            unreadCount: { increment: 1 }
                        }
                    });
                } else {
                    const initialSource = detectedSource || 'General';
                    const initialAttrs: Record<string, any> = {
                        ...(contactData || {}),
                        source: initialSource,
                        contactSource: initialSource,
                        ...(detectedAdSource ? { adSource: detectedAdSource } : {}),
                        ...(detectedCampaignName ? { campaignName: detectedCampaignName, adTitle: detectedCampaignName } : {})
                    };

                    if (referralData && typeof referralData === 'object' && Object.keys(referralData).length > 0) {
                        const adSourceId = referralData.source_id || referralData.ad_id || '';
                        const adSourceType = (referralData.source_type || (referralData.ad_id ? 'ad' : 'post')).toLowerCase();
                        const ctwaClickId = referralData.ctwa_clid || '';
                        const adHeadline = referralData.headline || '';
                        const adBody = referralData.body || '';
                        const adSourceUrl = referralData.source_url || '';
                        const adMediaType = referralData.media_type || '';

                        if (adSourceId) {
                            initialAttrs.ad_source_id = adSourceId;
                            initialAttrs.adId = adSourceId;
                        }
                        if (adSourceType) initialAttrs.ad_source_type = adSourceType;
                        if (ctwaClickId) initialAttrs.ctwa_click_id = ctwaClickId;
                        if (adHeadline) {
                            initialAttrs.ad_headline = adHeadline;
                            initialAttrs.adTitle = adHeadline;
                            if (!initialAttrs.campaignName) {
                                initialAttrs.campaignName = adHeadline;
                            }
                        }
                        if (adBody) initialAttrs.ad_body = adBody;
                        if (adSourceUrl) initialAttrs.ad_source_url = adSourceUrl;
                        if (adMediaType) initialAttrs.ad_media_type = adMediaType;
                        initialAttrs.ad_attributed_at = msgTimestamp.toISOString();
                        initialAttrs.referral = referralData;
                    }

                    // Delete only temporary media fields
                    delete initialAttrs.lastMediaUrl;
                    delete initialAttrs.lastMediaType;
                    delete initialAttrs.lastMediaFilename;

                    const calculatedExpiresAt = new Date(msgTimestamp.getTime() + 24 * 60 * 60 * 1000);

                    contact = await prisma.contact.create({
                        data: {
                            organizationId: org.id,
                            waId: waId,
                            name: name,
                            whatsappName: name,
                            ...(senderProfilePic ? { profilePic: senderProfilePic } : {}),
                            customAttributes: initialAttrs as any,
                            lastMessage: content,
                            lastMessageAt: msgTimestamp,
                            lastInboundMessageAt: msgTimestamp, // Track for 24hr window
                            windowExpiresAt: calculatedExpiresAt,
                            windowStatus: 'ACTIVE',
                            unreadCount: 1,
                            isAutoCreated: false
                        }
                    });
                }

                // Auto-assignment evaluation for incoming conversation
                try {
                    const { evaluateAndAssignConversation } = await import('@/lib/chat/assignment-engine');
                    await evaluateAndAssignConversation(contact.id, org.id, { isNewContact: !existingContact });
                } catch (assignErr: any) {
                    logger.webhook.error(`[AssignmentEngine] Auto-assignment error: ${assignErr?.message}`);
                }

                // Resolve native reply details if this message was a reply (contextWamid)
                let replyToId: string | null = null;
                let replyToWaId: string | null = contextWamid || null;
                let replyPreview: string | null = null;
                let replySenderName: string | null = null;
                let replyMessageType: string | null = null;

                if (contextWamid) {
                    const referencedMsg = await prisma.message.findUnique({
                        where: { wamid: contextWamid },
                        include: { sender: true }
                    });
                    if (referencedMsg) {
                        replyToId = referencedMsg.id;
                        replyToWaId = referencedMsg.wamid || contextWamid;
                        replyPreview = referencedMsg.content || (referencedMsg.type ? `[${referencedMsg.type.charAt(0).toUpperCase() + referencedMsg.type.slice(1)}]` : 'Message');
                        replySenderName = referencedMsg.direction === 'outbound'
                            ? (referencedMsg.sender?.name || 'You')
                            : (contact.name || contact.waId);
                        replyMessageType = referencedMsg.type || 'text';
                    } else {
                        replyPreview = "Original message unavailable";
                        replySenderName = "Unknown";
                        replyMessageType = "text";
                    }
                }

                // Create Message
                try {
                    const isVoiceNote = msgType === 'audio' && (
                        messageData.audio?.voice === true || 
                        Boolean(messageData.audio?.mime_type && (messageData.audio.mime_type.includes('opus') || messageData.audio.mime_type === 'audio/ogg'))
                    );

                    const finalRawBody = {
                        ...messageData,
                        ...(msgType === 'audio' ? {
                            voice: isVoiceNote,
                            audio: {
                                ...(messageData.audio || {}),
                                voice: isVoiceNote
                            }
                        } : {}),
                        metadata: value.metadata
                    };

                    await prisma.message.create({
                        data: {
                            contactId: contact.id,
                            channelId: resolvedChannel?.id || null,
                            wamid: wamid,
                            type: msgType,
                            direction: 'inbound',
                            status: 'delivered',
                            content: content,
                            mediaUrl: mediaUrl,
                            createdAt: msgTimestamp,
                            updatedAt: msgTimestamp,
                            replyToId,
                            replyToWaId,
                            replyPreview,
                            replySenderName,
                            replyMessageType,
                            rawBody: finalRawBody as any
                        }
                    });

                    await triggerWebhookNotification(
                        org.id,
                        'WhatsApp webhook received',
                        `${name || waId}: ${content || '[Media]'}`
                    );

                    await recordInboundActivityLog({
                        organizationId: org.id,
                        actor: 'System',
                        target: contact.name || contact.waId,
                        details: content || mediaUrl || '[Media]'
                    });

                    let assignedAgentId = contact.assignedAgentId || null;
                    let assignedUserIds: string[] = [];
                    try {
                        const freshContact = await prisma.contact.findUnique({
                            where: { id: contact.id },
                            select: {
                                assignedAgentId: true,
                                assignedUsers: { select: { id: true } }
                            }
                        });
                        assignedAgentId = freshContact?.assignedAgentId || contact.assignedAgentId || null;
                        assignedUserIds = freshContact?.assignedUsers?.map((u: { id: string }) => u.id) || [];
                        if (assignedAgentId && !assignedUserIds.includes(assignedAgentId)) {
                            assignedUserIds.push(assignedAgentId);
                        }
                    } catch {
                        // ignore fresh fetch error
                    }

                    await triggerPusherOrgEvent(org.id, 'message:inbound', {
                        id: wamid,
                        messageId: wamid,
                        contactId: contact.id,
                        contact_id: contact.id,
                        channelId: resolvedChannel?.id || null,
                        channel_id: resolvedChannel?.id || null,
                        contactName: contact.name || contact.waId,
                        contactNumber: contact.waId,
                        waId: contact.waId,
                        content: content || '',
                        type: msgType,
                        direction: 'inbound',
                        status: 'delivered',
                        mediaUrl: mediaUrl,
                        media_url: mediaUrl,
                        rawBody: finalRawBody,
                        raw_body: finalRawBody,
                        replyToId,
                        reply_to_id: replyToId,
                        replyToWaId,
                        reply_to_wa_id: replyToWaId,
                        replyPreview,
                        reply_preview: replyPreview,
                        replySenderName,
                        reply_sender_name: replySenderName,
                        replyMessageType,
                        reply_message_type: replyMessageType,
                        assignedAgentId,
                        assigned_agent_id: assignedAgentId,
                        assignedUserIds,
                        assigned_user_ids: assignedUserIds,
                        createdAt: msgTimestamp.toISOString(),
                        created_at_iso: msgTimestamp.toISOString(),
                        windowExpiresAt: contact.windowExpiresAt?.toISOString?.() || new Date(msgTimestamp.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                        lastInboundMessageAt: msgTimestamp.toISOString(),
                        windowStatus: 'ACTIVE'
                    });

                    // If this was a URL button reply, send the link back immediately
                    if (buttonId?.startsWith('url_')) {
                        const url = buttonId.split('::')[0].replace('url_', '');
                        logger.webhook.info(`Detected URL button click. Sending follow-up link: ${url}`);

                        const { sendUnifiedMessage } = await import('@/lib/messaging/api');
                        // Send the link as a separate message
                        // Using skipWindowCheck=true since this is a reply to an interaction
                        await sendUnifiedMessage({
                            contactId: contact.id,
                            message: url,
                            skipWindowCheck: true
                        });
                        logger.webhook.success(`URL follow-up link sent to ${contact.waId}`);
                    }
                } catch (e: any) {
                    // Ignore unique constraint violation if retry
                    if (e.code === 'P2002') {
                        logger.webhook.info(`Duplicate wamid detected during creation: ${wamid}. Stopping processing.`);
                        return new NextResponse('OK', { status: 200 });
                    }
                    console.error('Failed to store message:', e);
                }

                // Flow Engine: Process message for automations
                // We process ALL message types now (including unsupported from Meta Ad clicks)
                if (isDelayed) {
                    logger.webhook.info(`Skipping Flow Engine for delayed message (more than 5 minutes old).`);
                } else if (isMetaSender) {
                    logger.webhook.info(`Skipping Flow Engine for Meta / Facebook Security system message.`);
                } else if (content || msgType !== 'unknown') {
                    logger.webhook.info(`Calling Flow Engine for ${msgType} message: "${content}"`);
                    // We don't await this to avoid blocking the webhook response
                    const contactWithOrg = { ...contact, organization: org };

                    // Enhance content with media/location data if needed for the engine
                    let engineText = content;
                    if (msgType === 'location') {
                        // We'll pass the location data in a format the engine can parse if it's an AskLocationNode
                        engineText = JSON.stringify({
                            type: 'location',
                            latitude: messageData.location.latitude,
                            longitude: messageData.location.longitude,
                            address: messageData.location.address,
                            name: messageData.location.name
                        });
                    } else if (['image', 'video', 'document', 'sticker', 'audio'].includes(msgType)) {
                        // Only wrap in media JSON if there's no transcribed text (content is still placeholder)
                        if (content === '[Audio]' || content === '[Image]' || content === '[Document]' || content === '[Video]' || content === '[Sticker]') {
                            engineText = JSON.stringify({
                                type: 'media',
                                mediaType: msgType,
                                mediaId: messageData[msgType]?.id,
                                mediaUrl: mediaUrl,
                                caption: messageData[msgType]?.caption
                            });
                        }
                    }
                    const { enqueueFlow } = await import('@/lib/flows/queue');
                    await enqueueFlow({
                        organizationId: org.id,
                        contactId: contact.id,
                        messageText: engineText,
                        contact: contactWithOrg,
                        buttonId,
                        metadata: { 
                            isVoice: msgType === 'audio',
                            msgType: msgType,
                            mediaType: msgType,
                            mediaUrl: mediaUrl,
                            referral: messageData.referral 
                        }
                    }).catch(err => {
                        logger.webhook.error(`[Queue] Failed to enqueue message: ${err.message}`);
                    });
                } else {
                    logger.webhook.info(`Skipping Flow Engine - msgType: ${msgType}, hasContent: ${!!content}`);
                }
 
                dispatchWebhook(org.id, 'message.created', {
                    message: formatMessage({ id: wamid, contactId: contact.id, type: msgType, direction: 'inbound', status: 'delivered', content, mediaUrl, rawBody: messageData, createdAt: new Date(), wamid }, contact)
                }).catch(() => { });

            }
        }
        if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
            for (const statusUpdate of value.statuses) {
                const wamid = statusUpdate.id;
                const status = statusUpdate.status;
                const recipientId = statusUpdate.recipient_id;

                if (!wamid) continue;

                log(`Status Update: ${status} for WA_ID: ${recipientId} (Message ID: ${wamid})`);

                const existingMsg = await prisma.message.findFirst({
                    where: { wamid: wamid },
                    select: {
                        id: true,
                        contactId: true,
                        type: true,
                        direction: true,
                        status: true,
                        content: true,
                        createdAt: true,
                        wamid: true,
                        rawBody: true,
                        contact: { select: { id: true, organizationId: true, waId: true } }
                    }
                }).catch(() => null);

                if (status === 'failed') {
                    const errorData = statusUpdate.errors?.[0];
                    const msgPreview = existingMsg ? ` (Content: "${existingMsg.content?.substring(0, 50)}...")` : '';
                    logger.webhook.error(`Message FAILED: ${wamid}${msgPreview}. Error: ${errorData?.message} (Code: ${errorData?.code})`);

                    await prisma.message.updateMany({
                        where: { wamid: wamid },
                        data: {
                            status: 'failed',
                            rawBody: {
                                ...toJsonRecord(existingMsg?.rawBody),
                                statusUpdate,
                            } as Prisma.InputJsonValue
                        }
                    }).catch(err => logger.webhook.error(`Failed to update status for ${wamid}: ${err.message}`));
                } else {
                    await prisma.message.updateMany({
                        where: { wamid: wamid },
                        data: { status: status }
                    }).catch(err => logger.webhook.error(`Failed to update status for ${wamid}: ${err.message}`));
                }

                let targetContactId = existingMsg?.contactId;
                let targetOrgId = existingMsg?.contact?.organizationId;

                if (!targetContactId && recipientId) {
                    const cleanPhone = recipientId.replace(/[^0-9]/g, '');
                    if (cleanPhone) {
                        const foundContact = await prisma.contact.findFirst({
                            where: {
                                waId: { contains: cleanPhone }
                            },
                            select: { id: true, organizationId: true }
                        }).catch(() => null);

                        if (foundContact) {
                            targetContactId = foundContact.id;
                            targetOrgId = foundContact.organizationId;
                        }
                    }
                }

                let updatedUnreadCount: number | undefined;

                if (status === 'read' && targetContactId) {
                    if (existingMsg) {
                        await prisma.message.updateMany({
                            where: {
                                contactId: targetContactId,
                                direction: 'inbound',
                                status: { not: 'read' },
                                createdAt: { lte: existingMsg.createdAt }
                            },
                            data: { status: 'read' }
                        }).catch(err => logger.webhook.error(`Failed to bulk update prior messages status to read: ${err.message}`));
                    } else {
                        await prisma.message.updateMany({
                            where: {
                                contactId: targetContactId,
                                direction: 'inbound',
                                status: { not: 'read' }
                            },
                            data: { status: 'read' }
                        }).catch(err => logger.webhook.error(`Failed to update all messages status to read: ${err.message}`));
                    }

                    const newUnread = await prisma.message.count({
                        where: {
                            contactId: targetContactId,
                            direction: 'inbound',
                            status: { not: 'read' }
                        }
                    }).catch(() => 0);

                    updatedUnreadCount = newUnread;

                    await prisma.contact.update({
                        where: { id: targetContactId },
                        data: { unreadCount: newUnread }
                    }).catch(err => logger.webhook.error(`Failed to update contact unreadCount for ${targetContactId}: ${err.message}`));
                }

                if (targetOrgId && targetContactId) {
                    const mappedPusherStatus = (status === 'played' || status === 'read') ? 'read' : status;
                    await triggerPusherOrgEvent(targetOrgId, 'message:update', {
                        id: existingMsg?.id,
                        messageId: existingMsg?.id || wamid,
                        wamid: wamid,
                        status: mappedPusherStatus,
                        rawStatus: status,
                        contactId: targetContactId,
                        contact_id: targetContactId
                    }).catch(err => {
                        const errMessage = err instanceof Error ? err.message : 'Unknown Pusher error';
                        logger.webhook.warn(`Pusher status update trigger failed: ${errMessage}`);
                    });

                    if (status === 'read' || status === 'played') {
                        await triggerPusherOrgEvent(targetOrgId, 'contact:read', {
                            contactId: targetContactId,
                            unreadCount: updatedUnreadCount ?? 0
                        }).catch(() => {});
                    }

                    if (existingMsg) {
                        dispatchWebhook(targetOrgId, 'message.status.updated', {
                            message: formatMessage({ ...existingMsg, status }, existingMsg.contact)
                        }).catch(() => { });
                    }
                }
            }
        }

        logger.webhook.success('Webhook processed successfully');
        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        logger.webhook.error('Webhook Error:' + String(error));
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

type FacebookAutoCommentConfig = {
    enabled: boolean;
    replyText: string;
    rules: Array<{ postId: string; replyText: string }>;
};

type InstagramAutoCommentConfig = {
    enabled: boolean;
    replyText: string;
    rules: Array<{ postId: string; replyText: string }>;
};

function parseFacebookAutoCommentConfig(rawValue: string | null): FacebookAutoCommentConfig {
    if (!rawValue) {
        return { enabled: false, replyText: '', rules: [] };
    }
    try {
        const parsed = JSON.parse(rawValue) as {
            facebookAutoCommentEnabled?: boolean;
            facebookAutoCommentReplyText?: string;
            facebookAutoCommentRules?: Array<{ postId?: string; replyText?: string }>;
        };
        const rules = Array.isArray(parsed.facebookAutoCommentRules)
            ? parsed.facebookAutoCommentRules
                .map((rule) => ({
                    postId: typeof rule?.postId === 'string' ? rule.postId.trim() : '',
                    replyText: typeof rule?.replyText === 'string' ? rule.replyText.trim() : '',
                }))
                .filter((rule) => !!rule.postId && !!rule.replyText)
            : [];
        return {
            enabled: !!parsed.facebookAutoCommentEnabled,
            replyText: typeof parsed.facebookAutoCommentReplyText === 'string'
                ? parsed.facebookAutoCommentReplyText.trim()
                : '',
            rules,
        };
    } catch {
        return { enabled: false, replyText: '', rules: [] };
    }
}

function parseInstagramAutoCommentConfig(rawValue: string | null): InstagramAutoCommentConfig {
    if (!rawValue) {
        return { enabled: false, replyText: '', rules: [] };
    }
    try {
        const parsed = JSON.parse(rawValue) as {
            instagramAutoCommentEnabled?: boolean;
            instagramAutoCommentReplyText?: string;
            instagramAutoCommentRules?: Array<{ postId?: string; replyText?: string }>;
        };
        const rules = Array.isArray(parsed.instagramAutoCommentRules)
            ? parsed.instagramAutoCommentRules
                .map((rule) => ({
                    postId: typeof rule?.postId === 'string' ? rule.postId.trim() : '',
                    replyText: typeof rule?.replyText === 'string' ? rule.replyText.trim() : '',
                }))
                .filter((rule) => !!rule.postId && !!rule.replyText)
            : [];
        return {
            enabled: !!parsed.instagramAutoCommentEnabled,
            replyText: typeof parsed.instagramAutoCommentReplyText === 'string'
                ? parsed.instagramAutoCommentReplyText.trim()
                : '',
            rules,
        };
    } catch {
        return { enabled: false, replyText: '', rules: [] };
    }
}

function extractPostLeafId(postId: string | undefined): string | null {
    if (!postId) return null;
    const trimmed = postId.trim();
    if (!trimmed) return null;
    const parts = trimmed.split('_').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

function resolveAutoReplyText(autoComment: FacebookAutoCommentConfig, postId: string | undefined): string {
    const postLeafId = extractPostLeafId(postId);
    if (!postLeafId) return autoComment.replyText;

    const matchedRule = autoComment.rules.find((rule) => {
        const ruleLeaf = extractPostLeafId(rule.postId);
        if (!ruleLeaf) return false;
        return rule.postId === postId || ruleLeaf === postLeafId;
    });

    return matchedRule?.replyText || autoComment.replyText;
}

function resolveInstagramAutoReplyText(autoComment: InstagramAutoCommentConfig, mediaId: string | undefined): string {
    const normalizedMediaId = (mediaId || '').trim();
    if (!normalizedMediaId) return autoComment.replyText;

    const matchedRule = autoComment.rules.find((rule) => rule.postId === normalizedMediaId);
    return matchedRule?.replyText || autoComment.replyText;
}

async function handleFacebookPageEntry(entry: unknown) {
    const pageEntry = entry as {
        id?: string;
        changes?: Array<{
            field?: string;
            value?: {
                item?: string;
                verb?: string;
                comment_id?: string;
                message?: string;
                from?: { id?: string; name?: string };
                post_id?: string;
                created_time?: number;
            };
        }>;
    };

    const pageId = pageEntry?.id;
    const changes = Array.isArray(pageEntry?.changes) ? pageEntry.changes : [];
    if (!pageId || changes.length === 0) return;

    const org = await prisma.organization.findFirst({
        where: { facebookPageId: pageId },
        select: { id: true, facebookPageId: true, businessDescription: true, name: true },
    });
    
    logger.webhook.info(`[handleFacebookPageEntry] Page ID: ${pageId}, Org Found: ${org ? org.name : 'NONE'}`);

    if (!org) {
        logger.webhook.warn(`No organization found for Facebook page ID: ${pageId}`);
        return;
    }

    const autoComment = parseFacebookAutoCommentConfig(org.businessDescription);

    for (const change of changes) {
        const value = change?.value;
        logger.webhook.info(`[handleFacebookPageEntry] Processing change: field=${change?.field}, item=${value?.item}, verb=${value?.verb}`);

        if (change?.field !== 'feed' || value?.item !== 'comment' || value?.verb !== 'add') {
            continue;
        }

        const commentId = value?.comment_id;
        const commenterId = value?.from?.id;
        logger.webhook.info(`[handleFacebookPageEntry] Comment ID: ${commentId}, Commenter ID: ${commenterId}`);

        if (!commentId || !commenterId) {
            continue;
        }

        // Ignore comments made by the page itself.
        if (commenterId === pageId || commenterId === org.facebookPageId) {
            continue;
        }

        const syntheticWamid = `fb_comment_${commentId}`;
        const commentContent = value?.message?.trim() || ((value as any)?.attachment?.type ? `[${(value as any).attachment.type.charAt(0).toUpperCase() + (value as any).attachment.type.slice(1)}]` : '[Media comment]');
        const mediaUrl = (value as any)?.attachment?.media?.image?.src || (value as any)?.attachment?.url || null;
        let resolvedName = value?.from?.name?.trim();
        if (!resolvedName) {
            try {
                const pageToken = await resolveFacebookPageAccessToken(org.id);
                const senderProfile = await fetchFacebookSenderProfile(commenterId, pageToken, 'FACEBOOK', org.facebookPageId);
                if (senderProfile?.name) {
                    resolvedName = senderProfile.name;
                }
            } catch (err) {
                logger.webhook.warn(`[FACEBOOK_FEED] Could not resolve name for ${commenterId}: ${String(err)}`);
            }
        }
        const commenterName = resolvedName || `FB User ${commenterId.slice(-4)}`;

        const contact = await prisma.contact.upsert({
            where: {
                organizationId_platform_waId: {
                    organizationId: org.id,
                    platform: 'FACEBOOK',
                    waId: commenterId,
                },
            },
            update: {
                isAutoCreated: false,
                name: commenterName,
                lastInboundMessageAt: new Date(),
            },
            create: {
                organizationId: org.id,
                waId: commenterId,
                name: commenterName,
                platform: 'FACEBOOK',
                lastInboundMessageAt: new Date(),
                isAutoCreated: false,
            },
        });

        let isDuplicate = false;
        try {
            await prisma.message.create({
                data: {
                    contactId: contact.id,
                    wamid: syntheticWamid,
                    type: 'comment',
                    direction: 'inbound',
                    platform: 'FACEBOOK',
                    status: 'delivered',
                    content: commentContent,
                    mediaUrl: mediaUrl,
                    rawBody: value,
                },
            });
        } catch (error: unknown) {
            const prismaErr = error as { code?: string };
            if (prismaErr?.code === 'P2002') {
                isDuplicate = true;
            } else {
                logger.webhook.error(`Failed storing Facebook comment ${commentId}: ${String(error)}`);
            }
        }

        if (isDuplicate) {
            logger.webhook.info(`Skipping duplicate Facebook comment event: ${commentId}`);
            continue;
        }

        await recordInboundActivityLog({
            organizationId: org.id,
            actor: 'System',
            target: contact.name || contact.waId,
            details: commentContent || mediaUrl || '[Media]'
        });



        await triggerWebhookNotification(
            org.id,
            'Facebook comment received',
            `${commenterName}: ${commentContent}`
        );
        
        // Post Automation Engine (Keywords, AI Agent, Auto-Like, Public + Private DM replies)
        try {
            const { executeFacebookCommentAutomation } = await import('@/app/actions/facebook-page');
            const autoResult = await executeFacebookCommentAutomation({
                organizationId: org.id,
                commentId,
                postId: value?.post_id || (value as any)?.parent_id,
                commenterId,
                commenterName,
                commentText: commentContent,
            });
            logger.webhook.info(`[handleFacebookPageEntry] Auto-comment engine result for ${commentId}: ${JSON.stringify(autoResult)}`);
        } catch (autoErr: any) {
            logger.webhook.warn(`[handleFacebookPageEntry] Auto-comment engine error: ${autoErr?.message}`);
        }

        // Flow Engine: Process comment for custom flows
        const { enqueueFlow } = await import('@/lib/flows/queue');
        const contactWithOrg = { ...contact, organization: org, platform: 'FACEBOOK_COMMENT' };
        
        logger.webhook.info(`[handleFacebookPageEntry] Enqueueing flow for Org: ${org.id}, Contact: ${contact.id}`);

        await enqueueFlow({
            organizationId: org.id,
            contactId: contact.id,
            messageText: commentContent,
            contact: contactWithOrg,
            metadata: { 
                commentId,
                postId: value?.post_id,
                platform: 'FACEBOOK_COMMENT'
            }
        }).then(() => {
            logger.webhook.info(`[handleFacebookPageEntry] Successfully enqueued flow for comment ${commentId}`);
        }).catch(err => {
            logger.webhook.error(`[Queue] [FACEBOOK_FEED] Failed to enqueue comment: ${err.message}`);
        });
    }

    return;
}

export async function GET(req: NextRequest) {
    return handleWhatsAppWebhookGet(req);
}

export async function POST(req: NextRequest) {
    return handleWhatsAppWebhookPost(req);
}

function verifySignature(signatureHeader: string, payload: string, secret: string): boolean {
    if (!signatureHeader.startsWith('sha256=')) {
        return false;
    }

    const incoming = signatureHeader.slice('sha256='.length).trim();
    const expected = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

    const incomingBuffer = Buffer.from(incoming, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (incomingBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
}



async function handleMetaMessagingEntry(entry: any, platform: 'INSTAGRAM' | 'FACEBOOK') {
    const messaging = entry?.messaging?.[0];
    if (!messaging) return;

    const senderId = messaging.sender?.id;
    const recipientId = messaging.recipient?.id;
    const message = messaging.message;
    const postback = messaging.postback;

    if (!senderId || (!message && !postback)) return;

    if (message?.is_echo) {
        logger.webhook.info(`[${platform}] Echo message ignored (mid: ${message.mid})`);
        return;
    }

    const mid = message?.mid || (postback ? `postback_${messaging.timestamp || Date.now()}_${senderId}` : '');
    const buttonId = postback?.payload || message?.quick_reply?.payload || '';
    
    const existingMessage = mid
        ? await prisma.message.findUnique({
            where: { wamid: mid },
            select: { id: true }
        }).catch(() => null)
        : null;
    if (existingMessage) {
        logger.webhook.info(`[${platform}] Duplicate inbound message ignored (mid: ${mid})`);
        return;
    }

    // Find Organization
    const org = platform === 'INSTAGRAM'
        ? await prisma.organization.findFirst({
            where: {
                OR: [
                    { instagramBusinessId: recipientId },
                    { instagramBusinessId: entry?.id },
                    { facebookPageId: recipientId },
                ]
            }
        })
        : await prisma.organization.findFirst({ where: { facebookPageId: recipientId } });

    if (!org) {
        const channelLabel = platform === 'INSTAGRAM' ? 'Instagram Business ID' : 'Facebook Page ID';
        logger.webhook.error(`[handleMetaMessagingEntry] No organization found for ${channelLabel}: ${recipientId}. Sender: ${senderId}. Mid: ${mid}`);
        
        // Debug: log all organizations with a facebookPageId to see if there's a mismatch
        if (platform === 'FACEBOOK') {
            const allFBOrgs = await prisma.organization.findMany({
                where: { NOT: { facebookPageId: null } },
                select: { id: true, facebookPageId: true, name: true }
            });
            logger.webhook.info(`[handleMetaMessagingEntry] Debug: Current FB Orgs in DB: ${JSON.stringify(allFBOrgs)}`);
        }
        return;
    }
    
    logger.webhook.info(`[handleMetaMessagingEntry] Found Org: ${org.name} (${org.id}) for platform ${platform}`);

    const attachments = (message && Array.isArray(message.attachments)) ? message.attachments : [];
    let resolvedName = `${platform === 'INSTAGRAM' ? 'IG' : 'FB'} User ${senderId.slice(-4)}`;
    let resolvedProfilePic: string | null = null;
    const content = postback?.title || message?.text || (attachments[0]?.type ? `[${attachments[0].type}]` : (postback ? '[Button Click]' : '[Attachment]'));

    // Profile Resolution for Facebook and Instagram
    let firstName: string | null = null;
    let lastName: string | null = null;
    
    try {
        const pageToken = await resolveFacebookPageAccessToken(org.id);
        const senderProfile = await fetchFacebookSenderProfile(senderId, pageToken, platform, org.facebookPageId);
        if (senderProfile?.name) {
            resolvedName = senderProfile.name;
        }
        if (senderProfile?.profilePic) {
            resolvedProfilePic = senderProfile.profilePic;
        }
        firstName = senderProfile?.firstName || null;
        lastName = senderProfile?.lastName || null;
    } catch (err) {
        logger.webhook.warn(`[MetaMessagingEntry] Could not resolve ${platform} profile for ${senderId}: ${String(err)}`);
    }

    // --- BLOCK CHECK ---
    const existingContact = await prisma.contact.findUnique({
        where: {
            organizationId_platform_waId: {
                organizationId: org.id,
                platform,
                waId: senderId
            }
        },
        select: { isBlocked: true, name: true }
    });

    if (existingContact?.isBlocked) {
        logger.webhook.info(`[${platform}] Message from BLOCKED contact ${senderId} ignored.`);
        return;
    }

    // Upsert Contact
    const contact = await prisma.contact.upsert({
        where: {
            organizationId_platform_waId: {
                organizationId: org.id,
                platform,
                waId: senderId
            }
        },
        update: {
            isAutoCreated: false,
            whatsappName: resolvedName,
            ...(existingContact?.name ? {} : { name: resolvedName }),
            firstName,
            lastName,
            ...(resolvedProfilePic ? { profilePic: resolvedProfilePic } : {}),
            customAttributes: {
                resolvedName,
                resolvedProfilePic,
                messengerId: senderId,
                lastUpdate: new Date().toISOString()
            },
            lastMessage: content,
            lastMessageAt: new Date(),
            lastInboundMessageAt: new Date(),
            unreadCount: { increment: 1 }
        },
        create: {
            organizationId: org.id,
            waId: senderId,
            name: resolvedName,
            whatsappName: resolvedName,
            firstName,
            lastName,
            ...(resolvedProfilePic ? { profilePic: resolvedProfilePic } : {}),
            customAttributes: {
                resolvedName,
                resolvedProfilePic,
                messengerId: senderId,
                firstSeen: new Date().toISOString()
            },
            platform,
            lastMessage: content,
            lastMessageAt: new Date(),
            lastInboundMessageAt: new Date(),
            unreadCount: 1,
            isAutoCreated: false,
        }
    });

    // Create Messages (Handle multiple attachments)
    const messagesToStore = [];
    if (attachments.length > 0) {
        for (let i = 0; i < attachments.length; i++) {
            const att = attachments[i];
            const type = att.type || 'text';
            const url = att.payload?.url || null;
            // If there's text, we put it on the first attachment, otherwise use [Type]
            const msgContent = i === 0 && message.text ? message.text : `[${type}]`;
            
            messagesToStore.push({
                wamid: attachments.length > 1 ? `${mid}_${i}` : mid,
                type,
                content: msgContent,
                mediaUrl: url,
            });
        }
    } else {
        messagesToStore.push({
            wamid: mid,
            type: 'text',
            content: content || '',
            mediaUrl: null,
        });
    }

    for (const msgData of messagesToStore) {
        let createdMessageId: string | null = null;
        try {
            const created = await prisma.message.create({
                data: {
                    contactId: contact.id,
                    wamid: msgData.wamid,
                    type: msgData.type,
                    direction: 'inbound',
                    platform,
                    status: 'delivered',
                    content: msgData.content,
                    ...(msgData.mediaUrl ? { mediaUrl: msgData.mediaUrl } : {}),
                    rawBody: messaging as any
                }
            });
            createdMessageId = created.id;
        } catch (error: unknown) {
            const prismaErr = error as { code?: string };
            if (prismaErr?.code !== 'P2002') {
                logger.webhook.error(`[${platform}] Failed storing inbound message ${msgData.wamid}: ${String(error)}`);
            } else {
                // If it's a duplicate, we might still want to trigger notifications/pusher if it's the first one
                continue;
            }
        }

        if (createdMessageId) {
            await triggerWebhookNotification(
                org.id,
                `${platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} webhook received`,
                `${resolvedName}: ${msgData.content || '[Media]'}`
            );
        }

        // Realtime updates for chat UIs
        try {
            const systemConfig = await prisma.systemConfig.findFirst({
                orderBy: { updatedAt: 'desc' },
                select: {
                    pusherAppId: true,
                    pusherKey: true,
                    pusherSecret: true,
                    pusherCluster: true,
                },
            });

            let assignedAgentId = contact.assignedAgentId || null;
            let assignedUserIds: string[] = [];
            try {
                const freshContact = await prisma.contact.findUnique({
                    where: { id: contact.id },
                    select: {
                        assignedAgentId: true,
                        assignedUsers: { select: { id: true } }
                    }
                });
                assignedAgentId = freshContact?.assignedAgentId || contact.assignedAgentId || null;
                assignedUserIds = freshContact?.assignedUsers?.map((u: { id: string }) => u.id) || [];
                if (assignedAgentId && !assignedUserIds.includes(assignedAgentId)) {
                    assignedUserIds.push(assignedAgentId);
                }
            } catch {
                // ignore
            }

            await triggerPusherOrgEvent(org.id, 'message:inbound', {
                id: createdMessageId || msgData.wamid,
                messageId: msgData.wamid,
                dbMessageId: createdMessageId,
                contactId: contact.id,
                contact_id: contact.id,
                contactName: contact.name || contact.waId,
                contactNumber: contact.waId,
                waId: contact.waId,
                content: msgData.content || '',
                type: msgData.type,
                direction: 'inbound',
                platform,
                mediaUrl: msgData.mediaUrl,
                assignedAgentId,
                assigned_agent_id: assignedAgentId,
                assignedUserIds,
                assigned_user_ids: assignedUserIds,
                createdAt: new Date().toISOString(),
                created_at_iso: new Date().toISOString(),
            }, systemConfig);
        } catch (pusherErr: unknown) {
            logger.webhook.warn(`[${platform}] Pusher trigger failed: ${String(pusherErr)}`);
        }
    }

    // Flow Engine (handles local dev automatically) - Only once per message batch
    const { enqueueFlow } = await import('@/lib/flows/queue');
    const contactWithOrg = { ...contact, organization: org };
    
    // Detect Story Reply
    const isStoryReply = message ? (!!message.story || !!message.reply_to?.story) : false;
    const storyId = message ? (message.story?.id || message.reply_to?.story?.id || null) : null;
    const storyUrl = message ? (message.story?.url || message.reply_to?.story?.url || null) : null;

    const effectivePlatform = isStoryReply
        ? (platform === 'INSTAGRAM' ? 'INSTAGRAM_STORY_REPLY' : 'FACEBOOK_STORY_REPLY')
        : platform;

    if (isStoryReply) {
        logger.webhook.info(`[${platform}] Story reply detected! Platform: ${effectivePlatform}, Story ID: ${storyId}, URL: ${storyUrl}`);
    }

    // Direct Instagram Story Automation Engine (Keywords, AI Agent, Default DM reply)
    if (isStoryReply && platform === 'INSTAGRAM') {
        try {
            const { executeInstagramStoryReplyAutomation } = await import('@/app/actions/instagram-page');
            const storyAutoRes = await executeInstagramStoryReplyAutomation({
                organizationId: org.id,
                contactId: contact.id,
                storyId: storyId || undefined,
                messageText: content,
                senderId,
                contact,
            });
            if (storyAutoRes.handled) {
                logger.webhook.info(`[INSTAGRAM_STORY_AUTO] Successfully responded to story reply (type: ${storyAutoRes.type})`);
            }
        } catch (storyErr: any) {
            logger.webhook.warn(`[INSTAGRAM_STORY_AUTO] Automation execution failed: ${storyErr?.message}`);
        }
    }

    await enqueueFlow({
        organizationId: org.id,
        contactId: contact.id,
        messageText: content,
        buttonId: buttonId || undefined,
        contact: contactWithOrg,
        metadata: {
            isStoryReply,
            storyId,
            storyUrl,
            platform: effectivePlatform
        }
    }).catch(err => {
        logger.webhook.error(`[Queue] [${platform}] Failed to enqueue message: ${err.message}`);
    });

    return;
}

async function handleInstagramEntry(entry: any) {
    // 1. Handle Messages (DMs)
    if (Array.isArray(entry.messaging) && entry.messaging.length > 0) {
        await handleMetaMessagingEntry(entry, 'INSTAGRAM');
    }

    // 2. Handle Changes (Comments)
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    if (changes.length > 0) {
        const igBusinessId = String(entry?.id || '');
        let org = await prisma.organization.findFirst({
            where: {
                OR: [
                    { instagramBusinessId: igBusinessId },
                    { facebookPageId: igBusinessId },
                ],
            },
            select: { 
                id: true, 
                instagramBusinessId: true, 
                businessDescription: true, 
                metaAccessToken: true,
                instagramAccessToken: true,
                facebookPageAccessToken: true
            },
        });

        // Fallback for Meta test webhook triggers (where entry.id is dummy like '0')
        if (!org) {
            org = await prisma.organization.findFirst({
                where: { instagramBusinessId: { not: null } },
                select: { 
                    id: true, 
                    instagramBusinessId: true, 
                    businessDescription: true, 
                    metaAccessToken: true,
                    instagramAccessToken: true,
                    facebookPageAccessToken: true
                },
            });
        }

        if (!org) {
            logger.webhook.warn(`No organization found for Instagram business ID: ${igBusinessId}`);
            return;
        }

        for (const change of changes) {
            const field = change?.field;
            const value = change?.value;
            if (field !== 'comments' || !value?.id) continue;

            const commenterId = value?.from?.id;
            const commenterName = value?.from?.username || value?.from?.name || (commenterId ? `IG User ${String(commenterId).slice(-4)}` : 'Instagram User');
            const commentId = value?.id;
            const mediaId = value?.media?.id || value?.media_id;
            const commentText = value?.text?.trim() || '[Instagram comment]';
            if (!commenterId || !commentId) continue;

            // Prevent webhook echo loops: ignore comments/replies authored by our own IG business account.
            if (String(commenterId) === String(org.instagramBusinessId || '')) {
                logger.webhook.info(`[INSTAGRAM] Skipping self-authored comment event: ${commentId}`);
                continue;
            }

            const contact = await prisma.contact.upsert({
                where: {
                    organizationId_platform_waId: {
                        organizationId: org.id,
                        platform: 'INSTAGRAM',
                        waId: String(commenterId),
                    },
                },
                update: {
                    isAutoCreated: false,
                    name: commenterName,
                    lastInboundMessageAt: new Date(),
                },
                create: {
                    organizationId: org.id,
                    waId: String(commenterId),
                    name: commenterName,
                    platform: 'INSTAGRAM',
                    lastInboundMessageAt: new Date(),
                    isAutoCreated: false,
                },
            });

            let isDuplicate = false;
            try {
                await prisma.message.create({
                    data: {
                        contactId: contact.id,
                        wamid: `ig_comment_${commentId}`,
                        type: 'comment',
                        direction: 'inbound',
                        platform: 'INSTAGRAM',
                        status: 'delivered',
                        content: commentText,
                        rawBody: {
                            ...value,
                            media_id: mediaId || null,
                        } as any,
                    },
                });
            } catch (error: unknown) {
                const prismaErr = error as { code?: string };
                if (prismaErr?.code === 'P2002') {
                    isDuplicate = true;
                } else {
                    logger.webhook.error(`Failed storing Instagram comment ${commentId}: ${String(error)}`);
                }
            }
            if (isDuplicate) continue;

            await recordInboundActivityLog({
                organizationId: org.id,
                actor: 'System',
                target: contact.name || contact.waId,
                details: commentText || '[Media]'
            });



            await triggerWebhookNotification(
                org.id,
                'Instagram comment received',
                `${commenterName}: ${commentText}`
            );

            // Flow Engine: Process Instagram comment for automations
            const { enqueueFlow } = await import('@/lib/flows/queue');
            const contactWithOrg = { ...contact, organization: org, platform: 'INSTAGRAM_COMMENT' };
            await enqueueFlow({
                organizationId: org.id,
                contactId: contact.id,
                messageText: commentText,
                contact: contactWithOrg,
                metadata: { 
                    commentId,
                    postId: mediaId,
                    platform: 'INSTAGRAM_COMMENT'
                }
            }).catch(err => {
                logger.webhook.error(`[Queue] [INSTAGRAM_FEED] Failed to enqueue comment: ${err.message}`);
            });

            // Instagram Post Automation Engine (Keywords, AI Agent, Default fallback)
            try {
                const { executeInstagramCommentAutomation } = await import('@/app/actions/instagram-page');
                const autoResult = await executeInstagramCommentAutomation({
                    organizationId: org.id,
                    commentId,
                    mediaId: mediaId || undefined,
                    commentText,
                    commenterName,
                    commenterId: String(commenterId),
                });
                if (autoResult.handled) {
                    logger.webhook.info(`[INSTAGRAM_AUTO_COMMENT] Handled comment ${commentId} via ${autoResult.type}`);
                }
            } catch (autoErr: any) {
                logger.webhook.warn(`[INSTAGRAM_AUTO_COMMENT] Failed executing automation: ${autoErr?.message}`);
            }
        }
    }
}

async function handleFacebookMessagingEntry(entry: any) {
    return handleMetaMessagingEntry(entry, 'FACEBOOK');
}
