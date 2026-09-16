import { qstash } from "@/lib/qstash";
import { logger } from "@/lib/logger";

export async function enqueueFlow(payload: {
    organizationId: string;
    contactId: string;
    messageText: string;
    contact: any;
    buttonId?: string;
    metadata?: any;
}) {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const baseUrl = rawUrl.replace(/\/+$/, '');
    
    try {
        // Only use QStash if we are not on localhost and have a valid token
        if (!baseUrl.includes('localhost') && process.env.QSTASH_TOKEN && !process.env.QSTASH_TOKEN.startsWith('ey')) {
             // We check for 'ey' because the user's current token starts with 'ey' and is failing due to region issues.
             // If they provide a new one, it might work, but for now we want to allow bypassing if it's the broken one.
             // Actually, let's just try to use it and fall back if it fails.
        }

        if (!baseUrl.includes('localhost') && process.env.QSTASH_TOKEN && process.env.NODE_ENV !== 'development') {
            return await qstash.publishJSON({
                url: `${baseUrl}/api/webhooks/whatsapp/queue`,
                body: payload,
            });
        }
    } catch (err: any) {
        logger.webhook.warn(`[Queue] QStash enqueue failed, falling back to direct execution: ${err.message}`);
    }

    // Direct execution fallback (Local development or QStash failure)
    // Run in background via setImmediate so incoming webhook request is never blocked
    setImmediate(async () => {
        try {
            const { processIncomingMessage } = await import("./engine");
            await processIncomingMessage(
                payload.organizationId,
                payload.contactId,
                payload.messageText,
                payload.contact,
                payload.buttonId,
                payload.metadata
            );
        } catch (err: any) {
            logger.flow.error(`[Queue] Direct flow execution failed: ${err.message}`);
        }
    });

    return { queued: false, direct: true, success: true };
}

export async function scheduleFlowResumption(payload: {
    executionId: string;
    nodeId: string;
    organizationId: string;
    seconds: number;
}) {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const baseUrl = rawUrl.replace(/\/+$/, '');

    try {
        if (!baseUrl.includes('localhost') && process.env.QSTASH_TOKEN) {
            return await qstash.publishJSON({
                url: `${baseUrl}/api/flows/resume`,
                delay: payload.seconds,
                body: {
                    executionId: payload.executionId,
                    nodeId: payload.nodeId,
                    organizationId: payload.organizationId
                }
            });
        }
    } catch (err: any) {
        logger.flow.warn(`[Queue] QStash scheduling failed, falling back to local setTimeout: ${err.message}`);
    }

    // Local fallback
    logger.flow.info(`[Queue] Using local setTimeout for delay (${payload.seconds}s)`);
    setTimeout(async () => {
        try {
            const { resumeFlowExecution } = await import("./engine");
            await resumeFlowExecution(
                payload.executionId,
                payload.nodeId,
                payload.organizationId
            );
        } catch (err: any) {
            logger.flow.error(`[Queue] Local delay resumption failed: ${err.message}`);
        }
    }, payload.seconds * 1000);
}

export async function scheduleShopifyMessage(payload: {
    contactId: string;
    templateName: string;
    language: string;
    components: any[];
    delayMinutes: number;
    organizationId: string;
}) {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const baseUrl = rawUrl.replace(/\/+$/, '');

    try {
        if (process.env.QSTASH_TOKEN) {
            logger.webhook.info(`[Queue] Scheduling Shopify message for ${payload.contactId} with ${payload.delayMinutes}m delay`);
            return await qstash.publishJSON({
                url: `${baseUrl}/api/webhooks/shopify/queue`,
                delay: Math.round(payload.delayMinutes * 60),
                body: payload,
            });
        }
    } catch (err: any) {
        logger.webhook.error(`[Queue] QStash scheduling failed: ${err.message}`);
    }

    // Fallback: Send immediately if queue fails
    setImmediate(async () => {
        try {
            const { internalSendTemplateMessage } = await import("@/lib/whatsapp/api");
            await internalSendTemplateMessage(
                payload.contactId,
                payload.templateName,
                payload.language,
                payload.components
            );
        } catch (err: any) {
            logger.webhook.error(`[Queue] Fallback send template failed: ${err.message}`);
        }
    });
    return { success: true, queued: false, direct: true };
}

export async function scheduleWooCommerceMessage(payload: {
    contactId: string;
    templateName: string;
    language: string;
    components: any[];
    delayHours: number;
    organizationId: string;
}) {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const baseUrl = rawUrl.replace(/\/+$/, '');

    try {
        if (process.env.QSTASH_TOKEN) {
            logger.webhook.info(`[Queue] Scheduling WooCommerce message for ${payload.contactId} with ${payload.delayHours}h delay`);
            return await qstash.publishJSON({
                url: `${baseUrl}/api/webhooks/woocommerce/queue`,
                delay: payload.delayHours * 60 * 60,
                body: payload,
            });
        }
    } catch (err: any) {
        logger.webhook.error(`[Queue] QStash scheduling failed: ${err.message}`);
    }

    // Fallback: Send immediately if queue fails
    setImmediate(async () => {
        try {
            const { internalSendTemplateMessage } = await import("@/lib/whatsapp/api");
            await internalSendTemplateMessage(
                payload.contactId,
                payload.templateName,
                payload.language,
                payload.components
            );
        } catch (err: any) {
            logger.webhook.error(`[Queue] Fallback send template failed: ${err.message}`);
        }
    });
    return { success: true, queued: false, direct: true };
}

export async function scheduleAiFallbackTrigger(payload: {
    executionId: string;
    nodeId: string;
    organizationId: string;
    seconds: number;
}) {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const baseUrl = rawUrl.replace(/\/+$/, '');

    try {
        if (!baseUrl.includes('localhost') && process.env.QSTASH_TOKEN) {
            return await qstash.publishJSON({
                url: `${baseUrl}/api/flows/fallback`,
                delay: payload.seconds,
                body: {
                    executionId: payload.executionId,
                    nodeId: payload.nodeId,
                    organizationId: payload.organizationId
                }
            });
        }
    } catch (err: any) {
        logger.flow.warn(`[Queue] QStash fallback scheduling failed, falling back to local setTimeout: ${err.message}`);
    }

    // Local fallback
    logger.flow.info(`[Queue] Using local setTimeout for AI Fallback delay (${payload.seconds}s)`);
    setTimeout(async () => {
        try {
            const { triggerAiFallback } = await import("./engine");
            await triggerAiFallback(
                payload.executionId,
                payload.nodeId,
                payload.organizationId
            );
        } catch (err: any) {
            logger.flow.error(`[Queue] Local AI Fallback trigger failed: ${err.message}`);
        }
    }, payload.seconds * 1000);
}

