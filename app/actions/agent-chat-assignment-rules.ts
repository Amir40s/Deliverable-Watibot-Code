'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activityLog';
import { unassignAllChatsForAgent } from '@/lib/chat/assignment-engine';

export type AssignmentType =
  | 'SPECIFIC_CHAT'
  | 'AFTER_AGENT_CREATION'
  | 'ALL_CHATS'
  | 'TAG_BASED'
  | 'DATETIME_RANGE';

export interface CreateAssignmentRuleInput {
  agentId: string;
  assignmentType: AssignmentType;
  specificChatIds?: string[];
  tagIds?: string[];
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  priority?: number;
  isActive?: boolean;
  applyToExistingChats?: boolean;
}

export interface UpdateAssignmentRuleInput {
  assignmentType?: AssignmentType;
  specificChatIds?: string[];
  tagIds?: string[];
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  priority?: number;
  isActive?: boolean;
}

/**
 * Fetch all assignment rules for a specific agent (or entire org)
 */
export async function getAgentAssignmentRules(agentId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];
  const orgId = session.user.organizationId;

  const rules = await prisma.agentChatAssignmentRule.findMany({
    where: {
      organizationId: orgId,
      agentId,
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          status: true,
          availabilityStatus: true,
        },
      },
    },
  });

  // Collect all tag IDs and chat IDs across rules to fetch enriched labels in bulk
  const allTagIds = Array.from(new Set(rules.flatMap((r) => r.tagIds)));
  const allChatIds = Array.from(new Set(rules.flatMap((r) => r.specificChatIds)));

  const [tags, contacts] = await Promise.all([
    allTagIds.length > 0
      ? prisma.tag.findMany({
          where: { id: { in: allTagIds }, organizationId: orgId },
          select: { id: true, name: true, color: true },
        })
      : [],
    allChatIds.length > 0
      ? prisma.contact.findMany({
          where: { id: { in: allChatIds }, organizationId: orgId },
          select: { id: true, name: true, waId: true, whatsappName: true },
        })
      : [],
  ]);

  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return rules.map((rule) => ({
    ...rule,
    resolvedTags: rule.tagIds.map((id) => tagMap.get(id)).filter(Boolean),
    resolvedChats: rule.specificChatIds.map((id) => contactMap.get(id)).filter(Boolean),
  }));
}

/**
 * Get available tags and recent chats to populate selection pickers
 */
export async function getAssignmentSelectorData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { tags: [], recentChats: [], orgTimezone: 'UTC' };
  }
  const orgId = session.user.organizationId;

  const [tags, contacts, org] = await Promise.all([
    prisma.tag.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
    prisma.contact.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        waId: true,
        whatsappName: true,
        lastMessage: true,
        lastMessageAt: true,
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    }),
  ]);

  return {
    tags,
    recentChats: contacts,
    orgTimezone: org?.timezone || 'UTC',
  };
}

/**
 * Create a new assignment rule for an agent
 */
export async function createAgentAssignmentRule(input: CreateAssignmentRuleInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  // Validate agent belongs to organization
  const agent = await prisma.user.findFirst({
    where: { id: input.agentId, organizationId: orgId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!agent) throw new Error('Agent not found');

  // Determine rule priority
  let priority = input.priority;
  if (priority === undefined) {
    const maxRule = await prisma.agentChatAssignmentRule.findFirst({
      where: { organizationId: orgId, agentId: input.agentId },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    });
    priority = (maxRule?.priority ?? 0) + 1;
  }

  const createdRule = await prisma.agentChatAssignmentRule.create({
    data: {
      organizationId: orgId,
      agentId: input.agentId,
      assignmentType: input.assignmentType,
      specificChatIds: input.specificChatIds || [],
      tagIds: input.tagIds || [],
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      timezone: input.timezone || 'UTC',
      priority,
      isActive: input.isActive !== false,
    },
  });

  // Apply to matching chats if requested or if specific chat IDs provided
  if (input.isActive !== false) {
    if (input.assignmentType === 'SPECIFIC_CHAT' && input.specificChatIds && input.specificChatIds.length > 0) {
      await prisma.contact.updateMany({
        where: {
          id: { in: input.specificChatIds },
          organizationId: orgId,
        },
        data: {
          assignedAgentId: agent.id,
          assignmentType: 'manual',
          assignedAt: new Date(),
        },
      });

      // Update M-to-M assignedUsers for live-chat compatibility
      for (const chatId of input.specificChatIds) {
        await prisma.contact.update({
          where: { id: chatId },
          data: {
            assignedUsers: { set: [{ id: agent.id }] },
          },
        }).catch(() => {});
      }
    } else if (input.applyToExistingChats) {
      if (input.assignmentType === 'ALL_CHATS') {
        await prisma.contact.updateMany({
          where: { organizationId: orgId },
          data: {
            assignedAgentId: agent.id,
            assignmentType: 'all_chats_rule',
            assignedAt: new Date(),
          },
        });
      } else if (input.assignmentType === 'TAG_BASED' && input.tagIds && input.tagIds.length > 0) {
        const matchingContacts = await prisma.contact.findMany({
          where: {
            organizationId: orgId,
            tags: { some: { id: { in: input.tagIds } } },
          },
          select: { id: true },
        });
        if (matchingContacts.length > 0) {
          const contactIds = matchingContacts.map((c) => c.id);
          await prisma.contact.updateMany({
            where: { id: { in: contactIds } },
            data: {
              assignedAgentId: agent.id,
              assignmentType: 'tag',
              assignedAt: new Date(),
            },
          });
        }
      }
    }
  }

  revalidatePath('/manage/permissions');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Created Live Chat Assignment Rule',
    module: 'Permissions',
    target: agent.name || agent.email,
    details: `Type: ${input.assignmentType} (Priority: ${priority}, Active: ${input.isActive !== false})`,
    status: 'success',
  }).catch(() => {});

  return createdRule;
}

/**
 * Update an existing assignment rule
 */
export async function updateAgentAssignmentRule(id: string, input: UpdateAssignmentRuleInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const existing = await prisma.agentChatAssignmentRule.findFirst({
    where: { id, organizationId: orgId },
    include: { agent: { select: { id: true, name: true, email: true } } },
  });
  if (!existing) throw new Error('Assignment rule not found');

  const updatedRule = await prisma.agentChatAssignmentRule.update({
    where: { id },
    data: {
      ...(input.assignmentType && { assignmentType: input.assignmentType }),
      ...(input.specificChatIds !== undefined && { specificChatIds: input.specificChatIds }),
      ...(input.tagIds !== undefined && { tagIds: input.tagIds }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  revalidatePath('/manage/permissions');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Updated Live Chat Assignment Rule',
    module: 'Permissions',
    target: existing.agent.name || existing.agent.email,
    details: `Updated rule ID ${id}`,
    status: 'success',
  }).catch(() => {});

  return updatedRule;
}

/**
 * Delete an assignment rule
 */
export async function deleteAgentAssignmentRule(id: string, unassignChats: boolean = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const rule = await prisma.agentChatAssignmentRule.findFirst({
    where: { id, organizationId: orgId },
    include: { agent: { select: { id: true, name: true, email: true } } },
  });
  if (!rule) throw new Error('Rule not found');

  await prisma.agentChatAssignmentRule.delete({
    where: { id },
  });

  let unassignedCount = 0;
  if (unassignChats && rule.agent?.id) {
    const res = await unassignAllChatsForAgent({
      organizationId: orgId,
      agentId: rule.agent.id,
      assignedByUserId: session.user.id,
      assignedByName: session.user.name,
    });
    unassignedCount = res.count;
  }

  revalidatePath('/manage/permissions');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted Live Chat Assignment Rule',
    module: 'Permissions',
    target: rule.agent.name || rule.agent.email,
    details: `Deleted ${rule.assignmentType} rule${unassignedCount > 0 ? ` and unassigned ${unassignedCount} active chat(s)` : ''}`,
    status: 'success',
  }).catch(() => {});

  return { success: true, unassignedCount };
}

/**
 * Fetch total number of conversations currently assigned to this agent in the organization
 */
export async function getAgentAssignedChatsCount(agentId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return 0;
  const orgId = session.user.organizationId;

  try {
    const count = await prisma.contact.count({
      where: {
        organizationId: orgId,
        OR: [
          { assignedAgentId: agentId },
          { assignedUsers: { some: { id: agentId } } },
        ],
      },
    });
    return count;
  } catch (error) {
    console.error('Failed to get agent assigned chats count:', error);
    return 0;
  }
}

/**
 * Manually unassign all conversations currently assigned to an agent
 */
export async function unassignAllAgentChatsAction(agentId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const agent = await prisma.user.findFirst({
    where: { id: agentId, organizationId: orgId },
    select: { id: true, name: true, email: true },
  });
  if (!agent) throw new Error('Agent not found');

  const res = await unassignAllChatsForAgent({
    organizationId: orgId,
    agentId,
    assignedByUserId: session.user.id,
    assignedByName: session.user.name,
  });

  revalidatePath('/manage/permissions');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Unassigned All Chats From Agent',
    module: 'Permissions',
    target: agent.name || agent.email,
    details: `Unassigned ${res.count} active conversations from ${agent.name || agent.email}`,
    status: 'success',
  }).catch(() => {});

  return { success: true, count: res.count };
}

/**
 * Toggle active status of an assignment rule
 */
export async function toggleAgentAssignmentRule(id: string, isActive: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const rule = await prisma.agentChatAssignmentRule.update({
    where: { id, organizationId: orgId },
    data: { isActive },
  });

  revalidatePath('/manage/permissions');
  revalidatePath('/live-chat');

  return rule;
}

