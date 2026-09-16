import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface AuthedOrg {
    id: string;
    name: string;
    slug: string;
    plan: string;
    ownerId?: string | null;
    metaAccessToken: string | null;
    instagramAccessToken: string | null;
    whatsappPhoneNumberId: string | null;
    whatsappBusinessId: string | null;
    whatsappNumber: string | null;
    whatsappBusinessName?: string | null;
    businessEmail: string | null;
    businessAddress: string | null;
    businessDescription: string | null;
    businessWebsites: any;
    logo: string | null;
    businessLogo?: string | null;
    industry: string | null;
    businessVertical?: string | null;
    vendorConfig?: any;
    createdAt: Date;
    updatedAt: Date;
}

async function resolveTargetOrg(baseOrgId: string, targetProjectId: string | null): Promise<AuthedOrg | null> {
    if (!targetProjectId || targetProjectId === baseOrgId) return null;

    const baseOrg = await prisma.organization.findUnique({
        where: { id: baseOrgId },
        select: { ownerId: true }
    });

    let targetOrg = null;

    if (baseOrg?.ownerId) {
        targetOrg = await prisma.organization.findFirst({
            where: {
                id: targetProjectId,
                OR: [
                    { ownerId: baseOrg.ownerId },
                    { users: { some: { id: baseOrg.ownerId } } }
                ]
            },
            select: {
                id: true, name: true, slug: true, plan: true, ownerId: true,
                metaAccessToken: true, whatsappPhoneNumberId: true,
                whatsappBusinessId: true, whatsappNumber: true, whatsappBusinessName: true,
                businessEmail: true, businessAddress: true,
                businessDescription: true, businessWebsites: true,
                logo: true, businessLogo: true, industry: true, businessVertical: true, createdAt: true, updatedAt: true,
                instagramAccessToken: true, vendorConfig: true
            }
        });
    }

    if (!targetOrg) {
        targetOrg = await prisma.organization.findUnique({
            where: { id: targetProjectId },
            select: {
                id: true, name: true, slug: true, plan: true, ownerId: true,
                metaAccessToken: true, whatsappPhoneNumberId: true,
                whatsappBusinessId: true, whatsappNumber: true, whatsappBusinessName: true,
                businessEmail: true, businessAddress: true,
                businessDescription: true, businessWebsites: true,
                logo: true, businessLogo: true, industry: true, businessVertical: true, createdAt: true, updatedAt: true,
                instagramAccessToken: true, vendorConfig: true
            }
        });
    }

    return targetOrg as AuthedOrg | null;
}

/**
 * Authenticates a Project API Key from the request headers.
 * Accepts: X-WatiBot-Project-API-Key  OR  Authorization: Bearer <key>
 *
 * Returns { org } on success, or a NextResponse error to return immediately.
 */
export async function authenticateProjectKey(req: NextRequest): Promise<
    { org: AuthedOrg; error: null } | { org: null; error: NextResponse }
> {
    const projectKey =
        req.headers.get("x-watibot-project-api-key") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    
    const shopifyToken = req.headers.get("x-watibot-token");
    const targetProjectId = req.headers.get("x-watibot-project-id") || req.headers.get("x-project-id");

    if (!projectKey && !shopifyToken) {
        return {
            org: null,
            error: NextResponse.json(
                { status: 401, error: "Missing authentication header. Provide X-WatiBot-Project-API-Key or X-Watibot-Token." },
                { status: 401 }
            ),
        };
    }

    if (shopifyToken || projectKey) {
        const tokenToUse = shopifyToken || projectKey;
        const org = await prisma.organization.findUnique({
            where: { shopifyIntegrationToken: tokenToUse },
            select: {
                id: true, name: true, slug: true, plan: true, ownerId: true,
                metaAccessToken: true, whatsappPhoneNumberId: true,
                whatsappBusinessId: true, whatsappNumber: true, whatsappBusinessName: true,
                businessEmail: true, businessAddress: true,
                businessDescription: true, businessWebsites: true,
                logo: true, businessLogo: true, industry: true, businessVertical: true, createdAt: true, updatedAt: true,
                instagramAccessToken: true, vendorConfig: true
            }
        });
        if (org) {
            const switchedOrg = await resolveTargetOrg(org.id, targetProjectId);
            return { org: (switchedOrg || org) as AuthedOrg, error: null };
        }
    }

    if (projectKey) {
        // Fallback: check businessDescription JSON for projectApiKey
        const orgs = await prisma.organization.findMany({
            select: {
                id: true, name: true, slug: true, plan: true, ownerId: true,
                metaAccessToken: true, whatsappPhoneNumberId: true,
                whatsappBusinessId: true, whatsappNumber: true, whatsappBusinessName: true,
                businessEmail: true, businessAddress: true,
                businessDescription: true, businessWebsites: true,
                logo: true, businessLogo: true, industry: true, businessVertical: true, createdAt: true, updatedAt: true,
                instagramAccessToken: true, vendorConfig: true
            }
        });

        const org = orgs.find((o) => {
            try {
                const data = JSON.parse(o.businessDescription || "{}");
                return data.projectApiKey === projectKey;
            } catch {
                return false;
            }
        });

        if (org) {
            const switchedOrg = await resolveTargetOrg(org.id, targetProjectId);
            return { org: (switchedOrg || org) as AuthedOrg, error: null };
        }
    }

    return {
        org: null,
        error: NextResponse.json(
            { status: 401, error: "Invalid Project API Key or Token." },
            { status: 401 }
        ),
    };
}

/** Standard error response */
export function apiError(status: number, message: string) {
    return NextResponse.json({ status, error: message }, { status });
}
