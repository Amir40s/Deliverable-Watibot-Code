import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/project
 *
 * Returns project details (contacts count, message stats, plan info).
 *
 * Headers:
 * X-WatiBot-Project-API-Key: <your_project_api_key>
 */
export async function GET(req: NextRequest) {
 const auth = await authenticateProjectKey(req);
 if (auth.error) return auth.error;
 const { org } = auth;

 // Parallel stats fetch
 const [totalContacts, totalMessages, totalFlows, totalTags] = await Promise.all([
 prisma.contact.count({ where: { organizationId: org.id } }),
 prisma.message.count({ where: { contact: { organizationId: org.id } } }),
 prisma.flow.count({ where: { organizationId: org.id } }),
 prisma.tag.count({ where: { organizationId: org.id } }),
 ]);

 return NextResponse.json({
 id: org.id,
 name: org.name,
 slug: org.slug,
 business_id: org.whatsappBusinessId ?? null,
 active: true,
 plan: org.plan,
 plan_active: true,
 status: "STARTED",
 wallet: 0,
 active_plan: org.plan,
 created_at: org.createdAt.getTime(),
 updated_at: org.updatedAt.getTime(),
 max_contacts: null,
 max_storage: null,
 credits: 0,
 wa_number: org.whatsappNumber ?? null,
 wa_phone_number_id: org.whatsappPhoneNumberId ?? null,
 wa_business_id: org.whatsappBusinessId ?? null,
 wa_connected: !!(org.metaAccessToken && org.whatsappPhoneNumberId),
 wa_display_name: org.name,
 wa_billing_plan: org.plan,
 stats: {
 total_contacts: totalContacts,
 total_messages: totalMessages,
 total_flows: totalFlows,
 total_tags: totalTags,
 },
 billing_currency: "USD",
 timezone: "UTC",
 industry: org.industry ?? null,
 });
}
