'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activityLog';
import { evaluateAiRouting } from '@/lib/ai/ai-routing-engine';

export interface CreateAiRoutingRuleInput {
  name: string;
  topic: string;
  keywords?: string[];
  agentId: string;
  transferMessage?: string;
  isActive?: boolean;
}

export interface UpdateAiRoutingRuleInput {
  name?: string;
  topic?: string;
  keywords?: string[];
  agentId?: string;
  transferMessage?: string;
  isActive?: boolean;
}

/**
 * Fetch all AI Routing rules for the current organization
 */
export async function getAiRoutingRules() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];
  const orgId = session.user.organizationId;

  try {
    const rules = await (prisma as any).aiRoutingRule.findMany({
      where: { organizationId: orgId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            availabilityStatus: true,
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rules;
  } catch (error: any) {
    console.error('[getAiRoutingRules Error]:', error);
    return [];
  }
}

/**
 * Fetch available organization team agents for routing selection
 */
export async function getOrgAgents() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];
  const orgId = session.user.organizationId;

  try {
    const users = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: { not: 'SUPER_ADMIN' },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        availabilityStatus: true,
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return users;
  } catch (error: any) {
    console.error('[getOrgAgents Error]:', error);
    return [];
  }
}

/**
 * Create a new AI Routing Rule
 */
export async function createAiRoutingRule(input: CreateAiRoutingRuleInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  if (!input.name?.trim()) throw new Error('Rule name is required');
  if (!input.topic?.trim()) throw new Error('Topic / Intent description is required');
  if (!input.agentId?.trim()) throw new Error('Assigned agent is required');

  // Verify agent belongs to organization
  const agent = await prisma.user.findFirst({
    where: { id: input.agentId, organizationId: orgId },
    select: { id: true, name: true, email: true },
  });
  if (!agent) throw new Error('Selected agent does not belong to this organization');

  // Clean keywords
  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map((k) => k.trim()).filter(Boolean)
    : [];

  const rule = await (prisma as any).aiRoutingRule.create({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      topic: input.topic.trim(),
      keywords,
      agentId: input.agentId,
      transferMessage: input.transferMessage?.trim() || 'We will connect you to our agent.',
      isActive: input.isActive !== false,
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  });

  revalidatePath('/dashboard/knowledge-base');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Created AI Routing Rule',
    module: 'Knowledge Base',
    target: rule.name,
    details: `Routed topic "${rule.topic}" to agent ${agent.name || agent.email}`,
    status: 'success',
  }).catch(() => {});

  return { success: true, rule };
}

/**
 * Update an existing AI Routing Rule
 */
export async function updateAiRoutingRule(id: string, input: UpdateAiRoutingRuleInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const existing = await (prisma as any).aiRoutingRule.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) throw new Error('Routing rule not found');

  if (input.agentId) {
    const agent = await prisma.user.findFirst({
      where: { id: input.agentId, organizationId: orgId },
    });
    if (!agent) throw new Error('Selected agent does not belong to this organization');
  }

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.topic !== undefined) updateData.topic = input.topic.trim();
  if (input.keywords !== undefined) {
    updateData.keywords = Array.isArray(input.keywords)
      ? input.keywords.map((k) => k.trim()).filter(Boolean)
      : [];
  }
  if (input.agentId !== undefined) updateData.agentId = input.agentId;
  if (input.transferMessage !== undefined) updateData.transferMessage = input.transferMessage.trim();
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const updated = await (prisma as any).aiRoutingRule.update({
    where: { id },
    data: updateData,
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  });

  revalidatePath('/dashboard/knowledge-base');
  revalidatePath('/live-chat');

  return { success: true, rule: updated };
}

/**
 * Toggle AI Routing Rule Active/Disabled status
 */
export async function toggleAiRoutingRule(id: string, isActive: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const rule = await (prisma as any).aiRoutingRule.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!rule) throw new Error('Rule not found');

  const updated = await (prisma as any).aiRoutingRule.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath('/dashboard/knowledge-base');
  return { success: true, rule: updated };
}

/**
 * Delete an AI Routing Rule
 */
export async function deleteAiRoutingRule(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  const rule = await (prisma as any).aiRoutingRule.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!rule) throw new Error('Rule not found');

  await (prisma as any).aiRoutingRule.delete({
    where: { id },
  });

  revalidatePath('/dashboard/knowledge-base');
  revalidatePath('/live-chat');

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted AI Routing Rule',
    module: 'Knowledge Base',
    target: rule.name,
    status: 'success',
  }).catch(() => {});

  return { success: true };
}

/**
 * Test Simulator: Tests a sample user message against organization's rules
 */
export async function testAiRoutingMatch(sampleMessage: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');
  const orgId = session.user.organizationId;

  if (!sampleMessage || !sampleMessage.trim()) {
    return {
      matched: false,
      reasoning: 'Please enter a sample customer message to test.',
    };
  }

  const result = await evaluateAiRouting({
    organizationId: orgId,
    messageText: sampleMessage.trim(),
    simulateOnly: true,
  });

  return result;
}
