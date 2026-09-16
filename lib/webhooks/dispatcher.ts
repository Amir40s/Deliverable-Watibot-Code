import { createHmac, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// ─── All available topics ─────────────────────────────────────────────────────
export const WEBHOOK_TOPICS = [
    "contact.created",
    "contact.tag.updated",
    "contact.attribute.revised",
    "contact.chat.intervened",
    "contact.chat.closed",
    "contact.chat.requesting",
    "contact.campaign.sent",
    "contact.campaign.delivered",
    "contact.campaign.read",
    "contact.first_message.updated",
    "message.created",
    "message.status.updated",
    "message.sender.user",
    "order.placed",
    "payment.captured",
    "payment.refunded",
] as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number];

// ─── Webhook config shape (stored inside businessDescription JSON) ─────────────
export interface WebhookConfig {
    url: string;
    enabled: boolean;
    topics: WebhookTopic[];
    deliveryAttempts?: number;      // lifetime counters for stats
    lastDeliveredAt?: string | null;
    lastFailedAt?: string | null;
}

// ─── Parse webhook config from org ──────────────────────────────────────────
export function parseWebhookConfig(businessDescription: string | null | undefined): WebhookConfig | null {
    try {
        const data = JSON.parse(businessDescription || "{}");
        if (!data.webhookConfig?.url) return null;
        return data.webhookConfig as WebhookConfig;
    } catch {
        return null;
    }
}

// ─── Sign payload ─────────────────────────────────────────────────────────────
function sign(body: string, secret: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
}

// ─── Core dispatcher ──────────────────────────────────────────────────────────
export async function dispatchWebhook(
    organizationId: string,
    topic: WebhookTopic,
    data: Record<string, any>
) {
    try {
        // Check per-chat webhook automation control
        let targetContact: { isWebhookEnabled: boolean; disabledWebhookIds: string[]; waId?: string; isAiBotEnabled?: boolean; organization?: { isAiBotEnabled: boolean } | null } | null = null;
        const contactId = data.contactId || data.contact_id || data.contact?.id || data.message?.contactId || data.message?.contact?.id;
        const phoneStr = data.waId || data.from || data.phone || data.to || data.recipient_id || 
                         data.message?.from || data.message?.waId || data.message?.to || data.message?.recipient_id ||
                         data.contact?.waId || data.contact?.phone;

        if (contactId) {
            targetContact = await prisma.contact.findUnique({
                where: { id: contactId },
                select: { 
                    isWebhookEnabled: true, 
                    disabledWebhookIds: true, 
                    waId: true,
                    isAiBotEnabled: true,
                    organization: { select: { isAiBotEnabled: true } }
                }
            });
        }
        
        if (!targetContact && phoneStr && organizationId) {
            const cleanPhone = String(phoneStr).replace(/[^0-9]/g, '');
            if (cleanPhone) {
                targetContact = await prisma.contact.findFirst({
                    where: {
                        organizationId,
                        OR: [
                            { waId: cleanPhone },
                            { waId: `+${cleanPhone}` }
                        ]
                    },
                    select: { 
                        isWebhookEnabled: true, 
                        disabledWebhookIds: true, 
                        waId: true,
                        isAiBotEnabled: true,
                        organization: { select: { isAiBotEnabled: true } }
                    }
                });
            }
        }

        if (targetContact && targetContact.isWebhookEnabled === false) {
            console.log(`[Webhook] Skipping ALL webhooks for topic=${topic} org=${organizationId} - Webhook automation disabled for contact`);
            return;
        }

        const disabledIds = targetContact?.disabledWebhookIds || [];

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, businessDescription: true, isAiBotEnabled: true },
        });

        // 1. System/Legacy Webhook (stored in businessDescription)
        if (org) {
            let parsed: Record<string, any> = {};
            try { parsed = JSON.parse(org.businessDescription || "{}"); } catch { /* noop */ }

            const config: WebhookConfig | undefined = parsed.webhookConfig;
            const secret: string | null = parsed.webhookSecret ?? null;

            const isTopicMatch = config?.topics?.includes(topic) ||
                (topic === "message.created" && config?.topics?.includes("message.sender.user")) ||
                (topic === "message.sender.user" && config?.topics?.includes("message.created"));

            if (disabledIds.includes('system')) {
                console.log(`[Webhook] Skipping System Webhook for topic=${topic} org=${organizationId} - Disabled for contact ${contactId}`);
            } else if (config?.url && config.enabled && isTopicMatch && secret) {
                const notification = {
                    id: randomUUID(),
                    created_at: Date.now(),
                    topic,
                    delivery_attempt: 1,
                    app_id: "watibot",
                    webhook_id: `whk_${organizationId}`,
                    project_id: organizationId,
                    data,
                };

                const body = JSON.stringify(notification);
                const signature = sign(body, secret);

                console.log(`[Webhook] Dispatching system webhook for topic=${topic} org=${organizationId} to: ${config.url}\n[Webhook] Payload: ${body}`);

                fetch(config.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-WatiBot-Signature": signature,
                        "X-WatiBot-API-Version": "2025-04-15",
                        "X-WatiBot-Project-Id": organizationId,
                    },
                    body,
                    signal: AbortSignal.timeout(5000),
                }).then(async (res) => {
                    const success = res.status >= 200 && res.status < 300;
                    const now = new Date().toISOString();
                    const updated = {
                        ...parsed,
                        webhookConfig: {
                            ...config,
                            deliveryAttempts: (config.deliveryAttempts ?? 0) + 1,
                            ...(success ? { lastDeliveredAt: now } : { lastFailedAt: now }),
                        },
                    };
                    await prisma.organization.update({
                        where: { id: organizationId },
                        data: { businessDescription: JSON.stringify(updated) },
                    }).catch(console.error);

                    if (success) {
                        console.log(`[Webhook] System Delivery succeeded for topic=${topic} org=${organizationId}`);
                    } else {
                        const errorText = await res.text().catch(() => "");
                        console.warn(`[Webhook] System Delivery failed for topic=${topic} org=${organizationId} status=${res.status} error=${errorText.slice(0, 500)}`);
                    }
                }).catch(err => {
                    console.error(`[Webhook] System Dispatch error for topic=${topic} org=${organizationId}:`, err?.message);
                });
            }
        }

        // 2. Custom Webhooks (stored in ExternalWebhook table)
        const customWebhooks = await prisma.externalWebhook.findMany({
            where: {
                organizationId,
                isActive: true,
            },
        });

        for (const webhook of customWebhooks) {
            if (disabledIds.includes(webhook.id)) {
                console.log(`[Webhook] Skipping Custom Webhook (${webhook.name}) for topic=${topic} org=${organizationId} - Disabled for contact ${contactId}`);
                continue;
            }

            // Check if webhook is an AI Agent webhook and if AI is paused/intervened for contact or organization
            if (webhook.isAiAgent) {
                const isContactAiEnabled = targetContact?.isAiBotEnabled ?? true;
                const isOrgAiEnabled = targetContact?.organization?.isAiBotEnabled ?? org?.isAiBotEnabled ?? true;

                if (!isContactAiEnabled || !isOrgAiEnabled) {
                    console.log(`[Webhook] Skipping AI Agent Webhook (${webhook.name}) for topic=${topic} org=${organizationId} - AI is paused/intervened for this contact (contactAi=${isContactAiEnabled}, orgAi=${isOrgAiEnabled})`);
                    continue;
                }
            }
            if (!webhook.targetUrl || !webhook.targetUrl.trim()) continue;
            const webhookEvents = webhook.events || [];

            let isSubscribed = webhookEvents.length === 0 || 
                               webhookEvents.includes("*") || 
                               webhookEvents.includes("all") || 
                               webhookEvents.includes(topic);

            if (!isSubscribed) {
                if (topic === "message.created" || topic === "message.sender.user") {
                    isSubscribed = webhookEvents.includes("message.received") || webhookEvents.includes("message.created") || webhookEvents.includes("message");
                } else if (topic === "message.status.updated") {
                    const status = (data?.status || data?.message?.status || "").toString().toLowerCase();
                    if (status === "delivered") isSubscribed = webhookEvents.includes("message.delivered") || webhookEvents.includes("message");
                    else if (status === "read") isSubscribed = webhookEvents.includes("message.read") || webhookEvents.includes("message");
                    else if (status === "sent") isSubscribed = webhookEvents.includes("message.sent") || webhookEvents.includes("message");
                } else if (topic === "contact.created") {
                    isSubscribed = webhookEvents.includes("contact.created") || webhookEvents.includes("contact");
                }
            }

            if (!isSubscribed) continue;

            const messageObj = data.message || (data.type === "message" ? data : null);
            const rawMediaUrl = messageObj?.mediaUrl || messageObj?.media_url || data.mediaUrl || data.media_url || null;
            const mediaUrl = toAbsoluteUrl(rawMediaUrl);

            const notification = {
                webhook_id: webhook.id,
                event: (topic === "message.created" || topic === "message.sender.user") ? "message.received" : topic,
                timestamp: new Date().toISOString(),
                contactId: contactId,
                waId: data.waId || data.phone || messageObj?.waId || targetContact?.waId,
                phone: data.phone || data.waId || messageObj?.waId || targetContact?.waId,
                media_url: mediaUrl,
                mediaUrl: mediaUrl,
                message: messageObj?.content || messageObj?.body || "",
                data: messageObj ? {
                    ...messageObj,
                    media_url: mediaUrl,
                    mediaUrl: mediaUrl,
                } : (data.contact || data),
            };

            const body = JSON.stringify(notification);
            const signature = sign(body, webhook.secretKey);

            console.log(`[Webhook] Dispatching custom webhook "${webhook.name}" (${webhook.id}) to: ${webhook.targetUrl}\n[Webhook] Payload: ${body}`);

            fetch(webhook.targetUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-WatiBot-Signature": signature,
                },
                body,
                signal: AbortSignal.timeout(5000),
            }).then(async (res) => {
                if (res.status >= 200 && res.status < 300) {
                    console.log(`[Webhook] Custom Delivery succeeded for "${webhook.name}" (${webhook.id})`);
                } else {
                    const errorText = await res.text().catch(() => "");
                    console.warn(`[Webhook] Custom Delivery failed for "${webhook.name}" (${webhook.id}) status=${res.status} error=${errorText.slice(0, 500)}`);
                }
            }).catch(err => {
                console.error(`[Webhook] Custom Dispatch error for "${webhook.name}" (${webhook.id}):`, err?.message);
            });
        }
    } catch (err: any) {
        console.error(`[Webhook] Main Dispatch error for topic=${topic} org=${organizationId}:`, err?.message);
    }
}

function toAbsoluteUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (typeof url === 'string' && url.startsWith('/')) {
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')).replace(/\/$/, '');
        return baseUrl ? `${baseUrl}${url}` : url;
    }
    return url;
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

/** Format a Contact for the notification payload */
export function formatContact(contact: any): Record<string, unknown> {
    return {
        type: "contact",
        id: contact.id,
        project_id: contact.organizationId,
        name: contact.name,
        phone_number: contact.phone ?? contact.waId,
        is_closed: contact.isClosed ?? false,
        is_requesting: contact.isRequesting ?? false,
        is_intervened: contact.isIntervened ?? false,
        created_at: contact.createdAt ? new Date(contact.createdAt).getTime() : null,
        tags: (contact.tags ?? []).map((t: any) => ({ id: t.id, added_at: t.createdAt ? new Date(t.createdAt).getTime() : null })),
        attributes: contact.attributes ?? {},
        last_active: contact.lastInboundMessageAt ? new Date(contact.lastInboundMessageAt).getTime() : null,
        last_message: contact.lastMessageAt ? new Date(contact.lastMessageAt).getTime() : null,
        source: contact.source ?? null,
        country_code: contact.countryCode ?? null,
    };
}

/** Format a Message for the notification payload */
export function formatMessage(message: any, contact?: any): Record<string, unknown> {
    const rawMediaUrl = message.mediaUrl || message.media_url || message.rawBody?.mediaUrl || message.rawBody?.media_url || null;
    const mediaUrl = toAbsoluteUrl(rawMediaUrl);

    return {
        type: "message",
        id: message.id,
        project_id: contact?.organizationId ?? message.contactId,
        phone_number: contact?.phone ?? contact?.waId ?? null,
        contact_id: message.contactId,
        sender: message.direction === "inbound" ? "user" : (message.senderId ? "agent" : "assistant"),
        message_content: message.rawBody ?? { text: message.content },
        message_type: message.type?.toUpperCase() ?? "TEXT",
        media_url: mediaUrl,
        mediaUrl: mediaUrl,
        status: message.status,
        is_HSM: message.type === "template",
        delivered_at: message.deliveredAt ? new Date(message.deliveredAt).getTime() : null,
        read_at: message.readAt ? new Date(message.readAt).getTime() : null,
        sent_at: message.createdAt ? new Date(message.createdAt).getTime() : null,
        failed_at: message.failedAt ? new Date(message.failedAt).getTime() : null,
        messageId: message.wamid ?? message.id,
    };
}

