import { prisma } from './prisma';
import { getPlanSlugAliases, normalizePlanSlug } from './plan-slugs';

export type ResourceLimit = 'maxContacts' | 'maxCampaigns' | 'maxBotReplies' | 'maxBotFlows' | 'maxCustomFields' | 'maxTeamMembers';

export interface QuotaResult {
    allowed: boolean;
    limit: number;
    current: number;
    message?: string;
}

/**
 * Checks if an organization has exceeded its plan limits for a specific resource.
 * For users in TRIAL status, it automatically enforces 'free' plan limits.
 */
export async function checkQuota(organizationId: string, resource: ResourceLimit): Promise<QuotaResult> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
            owner: true
        }
    });

    if (!org) {
        return { allowed: false, limit: 0, current: 0, message: "Organization not found" };
    }

    // Determine the plan to check against.
    // If the organization owner is in TRIAL status, we enforce the 'free' plan limits.
    const isTrial = org.owner?.status === 'TRIAL';
    const rawPlanSlug = isTrial ? 'free' : (org.plan || 'free');

    const plan = await prisma.plan.findFirst({
        where: { slug: { in: getPlanSlugAliases(rawPlanSlug) } }
    });

    if (!plan) {
        // Fallback for missing plan configuration (safety)
        return { allowed: true, limit: -1, current: 0 };
    }

    const config = org.vendorConfig as Record<string, unknown> | null;
    const configPlanSlug = typeof config?.planSlug === 'string' ? config.planSlug : null;
    const configMatchesPlan = !configPlanSlug || getPlanSlugAliases(rawPlanSlug).includes(normalizePlanSlug(configPlanSlug));
    let limit = -1;

    if (configMatchesPlan && resource === 'maxContacts' && config?.contactsLimit !== undefined) {
        limit = Number(config.contactsLimit);
    } else if (configMatchesPlan && resource === 'maxCampaigns' && config?.campaignLimit !== undefined) {
        limit = Number(config.campaignLimit);
    } else if (configMatchesPlan && resource === 'maxBotReplies' && config?.broadcastLimit !== undefined) {
        limit = Number(config.broadcastLimit);
    } else if (configMatchesPlan && resource === 'maxBotFlows' && config?.maxBotFlows !== undefined) {
        limit = Number(config.maxBotFlows);
    } else if (configMatchesPlan && resource === 'maxTeamMembers' && (config?.maxTeamMembers !== undefined || config?.maxMembers !== undefined)) {
        limit = Number(config.maxTeamMembers ?? config.maxMembers);
    } else {
        limit = (plan[resource] as number) ?? -1;
    }

    // If limit is -1, it means unlimited
    if (limit === -1) {
        return { allowed: true, limit, current: 0 };
    }

    let current = 0;

    switch (resource) {
        case 'maxContacts':
            current = await prisma.contact.count({ where: { organizationId } });
            break;
        case 'maxCampaigns':
            // Campaigns are identified as ScheduledMessages with type 'DRIP'
            current = await prisma.scheduledMessage.count({ 
                where: { 
                    organizationId,
                    type: 'DRIP'
                } 
            });
            break;
        case 'maxBotReplies':
            current = await prisma.message.count({
                where: {
                    contact: { organizationId },
                    direction: 'outbound'
                }
            });
            break;
        case 'maxBotFlows':
            current = await prisma.flow.count({ where: { organizationId } });
            break;
        case 'maxTeamMembers':
            current = await prisma.user.count({ where: { organizationId } });
            break;
        case 'maxCustomFields':
            // Logic for custom fields depends on implementation, usually stored in Json
            // For now, return allowed or implement if needed
            return { allowed: true, limit, current: 0 };
        default:
            return { allowed: true, limit, current: 0 };
    }

    const resourceNameMap: Record<ResourceLimit, string> = {
        maxContacts: 'Contacts',
        maxCampaigns: 'Drip Campaign',
        maxBotReplies: 'Live Chat',
        maxBotFlows: 'Flow',
        maxCustomFields: 'Fields',
        maxTeamMembers: 'Agents'
    };

    const resourceLabel = resourceNameMap[resource];
    const allowed = current < limit;

    return {
        allowed,
        limit,
        current,
        message: allowed 
            ? undefined 
            : `You used more than limit of ${resourceLabel} (${current}/${limit}). Please increase your limit by upgrading your plan.`
    };
}
