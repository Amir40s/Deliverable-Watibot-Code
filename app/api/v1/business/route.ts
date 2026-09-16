import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/business
 *
 * Returns the business profile associated with the Project API Key.
 *
 * Headers:
 * X-WatiBot-Project-API-Key: <your_project_api_key>
 */
export async function GET(req: NextRequest) {
 const auth = await authenticateProjectKey(req);
 if (auth.error) return auth.error;
 const { org } = auth;

 // Fetch owner user
 const owner = await prisma.user.findFirst({
 where: { ownedOrganizations: { some: { id: org.id } } },
 select: { name: true, email: true },
 });

 // Parse websites
 let websites: string[] = [];
 try {
 const raw = org.businessWebsites;
 if (Array.isArray(raw)) websites = raw;
 else if (typeof raw === "string") websites = JSON.parse(raw);
 } catch { /* noop */ }

 return NextResponse.json({
 id: org.id,
 active: org.plan !== "suspended",
 display_name: org.name,
 project_ids: [org.id],
 user_name: owner?.name ?? null,
 business_id: org.whatsappBusinessId ?? null,
 email: owner?.email ?? org.businessEmail ?? null,
 created_at: org.createdAt.getTime(),
 updated_at: org.updatedAt.getTime(),
 company: org.name,
 contact: org.whatsappNumber ?? null,
 currency: "USD",
 timezone: "UTC",
 type: org.plan, // free | standard | premium | ultimate
 slug: org.slug,
 industry: org.industry ?? null,
 plan: org.plan,
 websites,
 logo: org.logo ?? null,
 whatsapp_phone_number_id: org.whatsappPhoneNumberId ?? null,
 whatsapp_business_id: org.whatsappBusinessId ?? null,
 });
}
