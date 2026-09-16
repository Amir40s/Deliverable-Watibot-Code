import { prisma } from './prisma';
import { getCanonicalPlanSlug, getPlanFamily, getPlanSlugAliases, getPlanStorageLimit } from './plan-slugs';

type VendorPlanConfig = {
  planSlug?: string;
  contactsLimit: number;
  broadcastLimit: number;
  campaignLimit: number;
  maxBotFlows: number;
  maxTeamMembers: number;
  storageLimit: number;
  aiCredits: number;
  enableCampaigns: boolean;
  enableApiAccess: boolean;
  enableLiveChat: boolean;
  enableAutomation: boolean;
};

export async function activatePlanForOrganization(
  organizationId: string,
  planSlug: string,
  details?: {
    billingCycle?: string;
    amount?: number;
    currency?: string;
    provider?: string;
  }
) {
  // 1. Fetch Plan configuration from DB
  let plan = await prisma.plan.findFirst({
    where: { slug: { in: getPlanSlugAliases(planSlug) } }
  });

  if (!plan) {
    // Dynamic database fallback: find the basic plan in the database (usually has lowest contact limits)
    plan = await prisma.plan.findFirst({
      orderBy: { maxContacts: 'asc' }
    });
  }

  const slug = plan?.slug || planSlug || "free";

  const vendorConfig = {
    planSlug: slug,
    contactsLimit: plan?.maxContacts ?? 100,
    broadcastLimit: plan?.maxBotReplies ?? 100,
    campaignLimit: plan?.maxCampaigns ?? 10,
    maxBotFlows: plan?.maxBotFlows ?? 2,
    maxTeamMembers: plan?.maxTeamMembers ?? 1,
    storageLimit: getPlanStorageLimit(slug, plan ? [plan] : []),
    aiCredits: plan?.aiChatBotEnabled ? 500 : 0,
    enableCampaigns: plan ? plan.maxCampaigns !== 0 : false,
    enableApiAccess: plan?.apiWebhookAccess ?? false,
    enableLiveChat: true,
    enableAutomation: plan ? plan.maxBotFlows !== 0 : false,
    modulesAccess: plan?.modulesAccess || {}
  };

  // 3. Update Organization
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: slug,
      status: 'active',
      vendorConfig,
    },
    select: { ownerId: true }
  });

  // Update Owner status to ACTIVE if they are TRIAL
  if (org?.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: org.ownerId },
      select: { status: true }
    });
    if (owner?.status === 'TRIAL') {
      await prisma.user.update({
        where: { id: org.ownerId },
        data: { status: 'ACTIVE' }
      });
    }
  }

  // 4. Update or Create Subscription Tracking Record
  const billingCycle = details?.billingCycle || 'monthly';
  const amount = details?.amount || 0;
  const currency = details?.currency || 'USD';
  const provider = details?.provider || 'Dashboard';

  const startDate = new Date();
  const endDate = billingCycle === 'yearly'
    ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    : new Date(new Date().setMonth(new Date().getMonth() + 1));

  const subscription = await prisma.subscription.findFirst({
    where: { vendor: organizationId },
    orderBy: { createdAt: 'desc' }
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: slug,
        startDate,
        endDate,
        amount,
        currency,
        frequency: billingCycle,
        status: ['active'],
        isAuto: provider === 'Stripe' || provider === 'PayFast',
      }
    });
  } else {
    await prisma.subscription.create({
      data: {
        vendor: organizationId, // Link subscription to organization using organization ID
        plan: slug,
        startDate,
        endDate,
        amount,
        currency,
        frequency: billingCycle,
        status: ['active'],
        isAuto: provider === 'Stripe' || provider === 'PayFast',
      }
    });
  }
}

export interface PlanExpiryInfo {
  organizationId: string;
  plan: string;
  endDate: string | null;
  daysRemaining: number;
  isExpired: boolean;
  isTrial: boolean;
  statusColor: 'green' | 'orange' | 'red';
}

export async function getOrganizationPlanExpiryStatus(organizationId: string): Promise<PlanExpiryInfo | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      plan: true,
      status: true,
      createdAt: true,
      owner: {
        select: {
          status: true,
          trialStartDate: true,
          trialLimitDays: true,
          createdAt: true,
        }
      }
    }
  });

  if (!org) return null;

  let endDate: Date | null = null;
  const isTrial = org.owner?.status === 'TRIAL';

  if (isTrial) {
    const systemConfig = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null);
    const limit = org.owner?.trialLimitDays ?? systemConfig?.trialLimitDays ?? 15;
    const startDate = org.owner?.trialStartDate || org.owner?.createdAt || org.createdAt;
    endDate = new Date(new Date(startDate).getTime() + limit * 24 * 60 * 60 * 1000);
  } else {
    const subscription = await prisma.subscription.findFirst({
      where: { vendor: organizationId },
      orderBy: { createdAt: 'desc' }
    });

    if (subscription?.endDate) {
      endDate = new Date(subscription.endDate);
    } else {
      endDate = new Date(new Date(org.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = diffMs <= 0 || org.status === 'expired';

  let statusColor: 'green' | 'orange' | 'red' = 'green';
  if (isExpired || daysRemaining === 0) {
    statusColor = 'red';
  } else if (daysRemaining <= 7) {
    statusColor = 'orange';
  } else {
    statusColor = 'green';
  }

  if (isExpired && org.status !== 'expired') {
    prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'expired' }
    }).catch(err => console.error(`[ExpiryCheck] Failed to update org ${organizationId} status to expired:`, err));
  }

  return {
    organizationId,
    plan: org.plan || 'free',
    endDate: endDate ? endDate.toISOString() : null,
    daysRemaining: isExpired ? 0 : daysRemaining,
    isExpired,
    isTrial,
    statusColor,
  };
}

export async function isOrganizationPlanExpired(organizationId: string): Promise<boolean> {
  const status = await getOrganizationPlanExpiryStatus(organizationId);
  return status ? status.isExpired : false;
}
