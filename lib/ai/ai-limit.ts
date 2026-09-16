import { prisma } from "@/lib/prisma";

export const AI_LIMIT_REACHED_MESSAGE = "You have reached your AI message limit.\nPlease contact your administrator.";

export interface AiUsageAndLimitResult {
  usage: number;
  limit: number;
  isUnlimited: boolean;
  hasReachedLimit: boolean;
  limitReachedMessage: string;
}

export interface CheckAiMessageLimitResult {
  allowed: boolean;
  usage: number;
  limit: number;
  isUnlimited: boolean;
  message?: string;
}

/**
 * Retrieves the current AI message usage, configured limit, and whether the limit has been reached.
 */
export async function getAiUsageAndLimit(organizationId: string): Promise<AiUsageAndLimitResult> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { vendorConfig: true }
    });

    const config = (org?.vendorConfig as Record<string, any> | null) || {};
    const limit = typeof config.aiMessageLimit === "number" ? config.aiMessageLimit : 5000;
    const isUnlimited = !!config.isAiLimitUnlimited;

    // Determine current usage: Check execution logs count and tracked counter
    const executionCount = await prisma.aIAgentExecution.count({
      where: { organizationId }
    }).catch(() => 0);

    const storedUsage = typeof config.aiUsageCount === "number" ? config.aiUsageCount : 0;
    const usage = Math.max(executionCount, storedUsage);

    const hasReachedLimit = !isUnlimited && usage >= limit;

    return {
      usage,
      limit,
      isUnlimited,
      hasReachedLimit,
      limitReachedMessage: AI_LIMIT_REACHED_MESSAGE
    };
  } catch (err) {
    console.error("[AiLimit] Error fetching AI usage and limit:", err);
    // On unexpected error, do not block users accidentally
    return {
      usage: 0,
      limit: 5000,
      isUnlimited: false,
      hasReachedLimit: false,
      limitReachedMessage: AI_LIMIT_REACHED_MESSAGE
    };
  }
}

/**
 * Checks whether the organization is allowed to send an AI message.
 * Returns allowed: false with prompt message if the limit has been reached.
 */
export async function checkAiMessageLimit(organizationId: string): Promise<CheckAiMessageLimitResult> {
  if (!organizationId) {
    return { allowed: true, usage: 0, limit: 5000, isUnlimited: false };
  }

  const result = await getAiUsageAndLimit(organizationId);

  if (result.hasReachedLimit) {
    return {
      allowed: false,
      usage: result.usage,
      limit: result.limit,
      isUnlimited: result.isUnlimited,
      message: AI_LIMIT_REACHED_MESSAGE
    };
  }

  return {
    allowed: true,
    usage: result.usage,
    limit: result.limit,
    isUnlimited: result.isUnlimited
  };
}

/**
 * Increments the AI usage count for the given organization.
 */
export async function incrementAiUsage(organizationId: string): Promise<number> {
  if (!organizationId) return 0;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { vendorConfig: true }
    });

    const config = (org?.vendorConfig as Record<string, any> | null) || {};
    const executionCount = await prisma.aIAgentExecution.count({
      where: { organizationId }
    }).catch(() => 0);

    const currentUsage = Math.max(executionCount, typeof config.aiUsageCount === "number" ? config.aiUsageCount : 0);
    const newUsage = currentUsage + 1;

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        vendorConfig: {
          ...config,
          aiUsageCount: newUsage
        }
      }
    });

    return newUsage;
  } catch (err) {
    console.error("[AiLimit] Error incrementing AI usage:", err);
    return 0;
  }
}
