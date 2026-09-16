'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activityLog';

/**
 * FETCH ALL TAG ASSIGNMENT RULES
 */
export async function getTagAssignmentRules() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];

  return await prisma.tagAssignmentRule.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      tag: { select: { id: true, name: true, color: true } },
      agent: { select: { id: true, name: true, email: true, status: true, availabilityStatus: true } },
    },
    orderBy: { priority: 'asc' },
  });
}

/**
 * CREATE A TAG ASSIGNMENT RULE
 */
export async function createTagAssignmentRule(tagId: string, agentId: string, priority?: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  // If priority not specified, put at end
  let rulePriority = priority;
  if (rulePriority === undefined) {
    const maxRule = await prisma.tagAssignmentRule.findFirst({
      where: { organizationId: orgId },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    });
    rulePriority = (maxRule?.priority ?? 0) + 1;
  }

  // Check if rule already exists for this tag and agent
  const existing = await prisma.tagAssignmentRule.findUnique({
    where: {
      organizationId_tagId_agentId: {
        organizationId: orgId,
        tagId,
        agentId,
      },
    },
  });

  if (existing) {
    throw new Error('An assignment rule for this Tag and Agent already exists');
  }

  const rule = await prisma.tagAssignmentRule.create({
    data: {
      organizationId: orgId,
      tagId,
      agentId,
      priority: rulePriority,
    },
    include: {
      tag: { select: { id: true, name: true, color: true } },
      agent: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath('/manage/agents');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Created Tag Assignment Rule',
    module: 'Live Chat',
    target: rule.tag.name,
    details: `Assigned to ${rule.agent.name || rule.agent.email} (Priority: ${rule.priority})`,
    status: 'success',
  }).catch(() => {});

  return rule;
}

/**
 * UPDATE A TAG ASSIGNMENT RULE
 */
export async function updateTagAssignmentRule(id: string, tagId: string, agentId: string, priority: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const rule = await prisma.tagAssignmentRule.update({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
    data: {
      tagId,
      agentId,
      priority,
    },
    include: {
      tag: { select: { id: true, name: true } },
      agent: { select: { id: true, name: true, email: true } },
    },
  });

  revalidatePath('/manage/agents');
  return rule;
}

/**
 * DELETE A TAG ASSIGNMENT RULE
 */
export async function deleteTagAssignmentRule(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  await prisma.tagAssignmentRule.delete({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath('/manage/agents');
  return { success: true };
}

/**
 * REORDER TAG ASSIGNMENT RULES BY PRIORITY
 */
export async function reorderTagAssignmentRules(ruleIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const updates = ruleIds.map((id, index) =>
    prisma.tagAssignmentRule.updateMany({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      data: { priority: index + 1 },
    })
  );

  await prisma.$transaction(updates);

  revalidatePath('/manage/agents');
  return { success: true };
}

/**
 * FETCH GLOBAL CHAT ASSIGNMENT & ROUND-ROBIN SETTINGS FOR ORGANIZATION
 */
export async function getAssignmentSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;
  const orgId = session.user.organizationId;

  const [org, agents] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        autoAssignmentEnabled: true,
        roundRobinFallbackEnabled: true,
        roundRobinBatchSize: true,
        roundRobinCurrentCount: true,
        roundRobinLastAgentId: true,
        roundRobinConfig: true,
      },
    }),
    prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: 'USER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        isAutoAssignEligible: true,
        availabilityStatus: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    autoAssignmentEnabled: org?.autoAssignmentEnabled ?? true,
    roundRobinFallbackEnabled: org?.roundRobinFallbackEnabled ?? true,
    roundRobinBatchSize: org?.roundRobinBatchSize ?? 1,
    roundRobinCurrentCount: org?.roundRobinCurrentCount ?? 0,
    roundRobinLastAgentId: org?.roundRobinLastAgentId ?? null,
    roundRobinConfig: (org?.roundRobinConfig as any) || null,
    agents,
  };
}

/**
 * UPDATE GLOBAL CHAT ASSIGNMENT & ROUND-ROBIN SETTINGS FOR ORGANIZATION
 */
export async function updateAssignmentSettings(data: {
  autoAssignmentEnabled?: boolean;
  roundRobinFallbackEnabled?: boolean;
  roundRobinBatchSize?: number;
  roundRobinConfig?: any;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const updatedOrg = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      ...(data.autoAssignmentEnabled !== undefined && { autoAssignmentEnabled: data.autoAssignmentEnabled }),
      ...(data.roundRobinFallbackEnabled !== undefined && { roundRobinFallbackEnabled: data.roundRobinFallbackEnabled }),
      ...(data.roundRobinBatchSize !== undefined && { roundRobinBatchSize: Math.max(1, data.roundRobinBatchSize) }),
      ...(data.roundRobinConfig !== undefined && { roundRobinConfig: data.roundRobinConfig }),
    },
    select: {
      autoAssignmentEnabled: true,
      roundRobinFallbackEnabled: true,
      roundRobinBatchSize: true,
      roundRobinCurrentCount: true,
      roundRobinConfig: true,
    },
  });

  revalidatePath('/manage/permissions');
  revalidatePath('/manage/agents');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Updated Round-Robin Routing Settings',
    module: 'Permissions',
    target: 'Round-Robin Fallback',
    details: `Enabled: ${updatedOrg.roundRobinFallbackEnabled}, Batch Size: ${updatedOrg.roundRobinBatchSize}`,
    status: 'success',
  }).catch(() => {});

  return updatedOrg;
}

/**
 * UPDATE AGENT AVAILABILITY & AUTO-ASSIGN ELIGIBILITY
 */
export async function updateAgentAvailability(
  agentId: string,
  data: {
    isAutoAssignEligible?: boolean;
    availabilityStatus?: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'UNAVAILABLE';
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  // Verify target user belongs to organization
  const agent = await prisma.user.findFirst({
    where: { id: agentId, organizationId: session.user.organizationId },
  });
  if (!agent) throw new Error('Agent not found');

  const updatedAgent = await prisma.user.update({
    where: { id: agentId },
    data: {
      ...(data.isAutoAssignEligible !== undefined && { isAutoAssignEligible: data.isAutoAssignEligible }),
      ...(data.availabilityStatus !== undefined && { availabilityStatus: data.availabilityStatus }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      isAutoAssignEligible: true,
      availabilityStatus: true,
    },
  });

  revalidatePath('/manage/agents');
  return updatedAgent;
}
