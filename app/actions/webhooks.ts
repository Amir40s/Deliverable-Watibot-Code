'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activityLog';
import { randomBytes } from 'crypto';

async function getActiveOrgId(session: any): Promise<string | null> {
    if (session?.user?.organizationId) return session.user.organizationId;
    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { organizationId: true }
        });
        if (user?.organizationId) return user.organizationId;
    }
    const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    return firstOrg?.id || null;
}

export async function getWebhooks() {
    const session = await getServerSession(authOptions);
    const orgId = await getActiveOrgId(session);
    if (!orgId) {
        throw new Error('Unauthorized');
    }

    const webhooks = await prisma.externalWebhook.findMany({
        where: {
            organizationId: orgId,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return webhooks;
}

export async function createWebhook(name: string, targetUrl: string, events: string[], isAiAgent: boolean = false) {
    try {
        const session = await getServerSession(authOptions);
        const orgId = await getActiveOrgId(session);
        if (!orgId) {
            return { error: 'Unauthorized' };
        }

        const webhookName = name.trim();
        const secretKey = randomBytes(32).toString('hex'); 

        const webhook = await prisma.externalWebhook.create({
            data: {
                organizationId: orgId,
                name: webhookName,
                targetUrl: targetUrl.trim(),
                secretKey,
                events,
                isActive: true,
                isAiAgent: !!isAiAgent,
            },
        });

        logActivity({
          organizationId: orgId,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          userName: session?.user?.name,
          action: 'Created',
          module: 'Webhooks',
          target: webhookName,
          status: 'success',
        });
        
        return { success: true, data: webhook };
    } catch (error: any) {
        console.error("[createWebhook] Error:", error);
        return { error: error.message || "Failed to create webhook" };
    }
}

export async function updateWebhook(id: string, name: string, targetUrl: string, events: string[], isActive: boolean, isAiAgent: boolean = false) {
    try {
        const session = await getServerSession(authOptions);
        const orgId = await getActiveOrgId(session);
        if (!orgId) {
            return { error: 'Unauthorized' };
        }

        const webhookName = name.trim();

        const webhook = await prisma.externalWebhook.update({
            where: {
                id,
                organizationId: orgId,
            },
            data: {
                name: webhookName,
                targetUrl: targetUrl.trim(),
                events,
                isActive,
                isAiAgent: !!isAiAgent,
            },
        });

        logActivity({
          organizationId: orgId,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          userName: session?.user?.name,
          action: 'Updated',
          module: 'Webhooks',
          target: webhookName,
          status: 'success',
        });
        
        return { success: true, data: webhook };
    } catch (error: any) {
        console.error("[updateWebhook] Error:", error);
        return { error: error.message || "Failed to update webhook" };
    }
}

export async function deleteWebhook(id: string) {
    try {
        const session = await getServerSession(authOptions);
        const orgId = await getActiveOrgId(session);
        if (!orgId) {
            throw new Error('Unauthorized');
        }

        const webhook = await prisma.externalWebhook.delete({
            where: {
                id,
                organizationId: orgId,
            },
        });

        logActivity({
          organizationId: orgId,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          userName: session?.user?.name,
          action: 'Deleted',
          module: 'Webhooks',
          target: webhook.name,
          status: 'success',
        });
        
        return { success: true };
    } catch (error: any) {
        console.error("[deleteWebhook] Error:", error);
        return { error: error.message || "Failed to delete webhook" };
    }
}

export async function regenerateWebhookSecret(id: string) {
    try {
        const session = await getServerSession(authOptions);
        const orgId = await getActiveOrgId(session);
        if (!orgId) {
            return { error: 'Unauthorized' };
        }

        const secretKey = randomBytes(32).toString('hex');

        const webhook = await prisma.externalWebhook.update({
            where: {
                id,
                organizationId: orgId,
            },
            data: {
                secretKey,
            },
        });

        logActivity({
          organizationId: orgId,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          userName: session?.user?.name,
          action: 'Regenerated Secret',
          module: 'Webhooks',
          target: webhook.name,
          status: 'success',
        });
        
        return { success: true, data: webhook };
    } catch (error: any) {
        console.error("[regenerateWebhookSecret] Error:", error);
        return { error: error.message || "Failed to regenerate secret" };
    }
}

export async function verifyWebhookUrl(url: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) {
            return { error: 'Unauthorized' };
        }

        // Validate URL format
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return { error: 'Invalid protocol. URL must start with http or https' };
            }
        } catch (e) {
            return { error: 'Invalid URL format' };
        }

        // Attempt a GET request to check if the endpoint is reachable
        // We set a timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(parsedUrl.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'WatiBot-Webhook-Verifier/1.0',
                    'Accept': '*/*'
                }
            });
            clearTimeout(timeoutId);
            
            // We consider the URL "exists" if we get ANY HTTP response (even 401, 403, 404, 405)
            // It just means the server is reachable.
            return { success: true, status: response.status };
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
                return { error: 'Connection timed out. The server took too long to respond.' };
            }
            return { error: 'Failed to reach the URL. Please check if the URL is correct and public.' };
        }
    } catch (error: any) {
        return { error: "Failed to verify URL" };
    }
}
