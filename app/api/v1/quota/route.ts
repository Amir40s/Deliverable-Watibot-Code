import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { getPlanSlugAliases, normalizePlanSlug } from "@/lib/plan-slugs";

function quotaItem(key: string, name: string, used: number, limit: number) {
  const unlimited = limit === -1;
  const remaining = unlimited ? null : Math.max(0, limit - used);
  const percentage = unlimited || limit <= 0 ? 0 : Math.min(100, Number(((used / limit) * 100).toFixed(1)));
  return { key, name, used, limit, unlimited, remaining, percentage };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const [project, contacts, campaigns, botReplies, botFlows, teamMembers] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      select: { plan: true, vendorConfig: true, owner: { select: { status: true } } },
    }),
    prisma.contact.count({ where: { organizationId: org.id } }),
    prisma.scheduledMessage.count({ where: { organizationId: org.id, type: "DRIP" } }),
    prisma.message.count({ where: { contact: { organizationId: org.id }, direction: "outbound" } }),
    prisma.flow.count({ where: { organizationId: org.id } }),
    prisma.user.count({ where: { organizationId: org.id } }),
  ]);

  if (!project) return apiError(404, "Project not found.");

  const rawPlan = project.owner?.status === "TRIAL" ? "free" : project.plan || "free";
  const planSlug = normalizePlanSlug(rawPlan);

  let plan = await prisma.plan.findFirst({
    where: { slug: planSlug, isEnabled: true },
  });
  if (!plan) {
    plan = await prisma.plan.findFirst({
      where: { slug: { in: getPlanSlugAliases(planSlug) }, isEnabled: true },
    });
  }

  let rawPlanName = plan?.name || planSlug;
  if (rawPlanName.toLowerCase() === "satndard") rawPlanName = "Standard";
  if (rawPlanName.toLowerCase().endsWith(" plan")) {
    rawPlanName = rawPlanName.slice(0, -5).trim();
  }
  const cleanPlanName = rawPlanName.charAt(0).toUpperCase() + rawPlanName.slice(1);

  const config = project.vendorConfig as Record<string, unknown> | null;
  const configPlanSlug = typeof config?.planSlug === "string" ? config.planSlug : null;
  const configMatchesPlan = !configPlanSlug || getPlanSlugAliases(planSlug).includes(normalizePlanSlug(configPlanSlug));
  const configLimit = (key: string) => {
    const value = configMatchesPlan ? config?.[key] : undefined;
    return value !== undefined ? Number(value) : undefined;
  };

  const limits = {
    contacts: configLimit("contactsLimit") ?? Number(plan?.maxContacts ?? 100),
    campaigns: configLimit("campaignLimit") ?? Number(plan?.maxCampaigns ?? 10),
    botReplies: configLimit("broadcastLimit") ?? Number(plan?.maxBotReplies ?? 100),
    botFlows: configLimit("maxBotFlows") ?? Number(plan?.maxBotFlows ?? 2),
    teamMembers: configLimit("maxTeamMembers") ?? configLimit("maxMembers") ?? Number(plan?.maxTeamMembers ?? 1),
  };
  const usage = { contacts, campaigns, botReplies, botFlows, teamMembers };
  const totalQuota = Object.values(limits).reduce((sum, value) => sum + (value === -1 ? 0 : value), 0);
  const usedQuota = Object.values(usage).reduce((sum, value) => sum + value, 0);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    plan: {
      id: plan?.id ?? null,
      name: cleanPlanName,
      slug: plan?.slug ?? planSlug,
      currency: plan?.currency ?? "USD",
    },
    total_quota: totalQuota,
    used_quota: usedQuota,
    remaining_quota: Math.max(0, totalQuota - usedQuota),
    percentage: totalQuota ? Math.min(100, Number(((usedQuota / totalQuota) * 100).toFixed(1))) : 0,
    resources: [
      quotaItem("contacts", "Contacts", usage.contacts, limits.contacts),
      quotaItem("drip_campaign", "Drip Campaigns", usage.campaigns, limits.campaigns),
      quotaItem("live_chat", "Live Chat Messages", usage.botReplies, limits.botReplies),
      quotaItem("bot_flows", "Bot Flows", usage.botFlows, limits.botFlows),
      quotaItem("agents", "Agents", usage.teamMembers, limits.teamMembers),
    ],
  });
}
