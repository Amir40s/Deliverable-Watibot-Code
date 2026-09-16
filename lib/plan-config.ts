import { prisma } from "./prisma";
import { getPlanSlugAliases, getPlanStorageLimit } from "./plan-slugs";

type PlanConfigSource = {
  slug: string;
  maxContacts: number;
  maxCampaigns: number;
  maxBotReplies: number;
  maxBotFlows: number;
  maxTeamMembers: number;
  aiChatBotEnabled: boolean;
  apiWebhookAccess: boolean;
  modulesAccess?: any;
};

export function buildVendorConfigFromPlan(
  plan: PlanConfigSource,
  existingConfig: Record<string, unknown> = {}
) {
  return {
    ...existingConfig,
    planSlug: plan.slug,
    contactsLimit: plan.maxContacts,
    broadcastLimit: plan.maxBotReplies,
    campaignLimit: plan.maxCampaigns,
    maxBotFlows: plan.maxBotFlows,
    maxTeamMembers: plan.maxTeamMembers,
    storageLimit: getPlanStorageLimit(plan.slug),
    aiCredits: plan.aiChatBotEnabled ? 500 : 0,
    enableCampaigns: plan.maxCampaigns !== 0,
    enableApiAccess: plan.apiWebhookAccess ?? false,
    enableLiveChat: true,
    enableAutomation: plan.maxBotFlows !== 0,
    modulesAccess: plan.modulesAccess || {},
  };
}

export async function propagatePlanConfigToOrganizations(plan: PlanConfigSource) {
  const planAliases = getPlanSlugAliases(plan.slug);
  const organizations = await prisma.organization.findMany({
    where: { plan: { in: planAliases } },
    select: { id: true, vendorConfig: true },
  });

  if (organizations.length === 0) return 0;

  await prisma.$transaction(
    organizations.map((organization) => {
      const existingConfig =
        organization.vendorConfig && typeof organization.vendorConfig === "object" && !Array.isArray(organization.vendorConfig)
          ? (organization.vendorConfig as Record<string, unknown>)
          : {};

      return prisma.organization.update({
        where: { id: organization.id },
        data: {
          plan: plan.slug,
          vendorConfig: buildVendorConfigFromPlan(plan, existingConfig),
        },
      });
    })
  );

  return organizations.length;
}
