'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activityLog';

const DEFAULT_STAGES = [
  { name: 'New Lead', color: '#3B82F6', tagName: 'new-lead', order: 0 },
  { name: 'Contacted', color: '#8B5CF6', tagName: 'contacted', order: 1 },
  { name: 'Interested', color: '#F59E0B', tagName: 'interested', order: 2 },
  { name: 'Follow-up', color: '#EC4899', tagName: 'follow-up', order: 3 },
  { name: 'Qualified', color: '#10B981', tagName: 'qualified', order: 4 },
  { name: 'Converted', color: '#059669', tagName: 'converted', order: 5 },
];

/**
 * Ensures the organization has a default pipeline with standard journey stages.
 */
async function ensureDefaultPipeline(organizationId: string) {
  let pipeline = await prisma.pipeline.findFirst({
    where: { organizationId, isDefault: true },
    include: {
      stages: {
        include: { tag: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        organizationId,
        name: 'Lead Journey',
        description: 'Customer journey pipeline tracking leads from initial contact to conversion.',
        isDefault: true,
      },
      include: {
        stages: {
          include: { tag: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  // If no stages exist in the pipeline, create the default stages and tags
  if (pipeline.stages.length === 0) {
    for (const defStage of DEFAULT_STAGES) {
      // Find or create tag for this stage
      let tag = await prisma.tag.findFirst({
        where: {
          organizationId,
          name: { equals: defStage.tagName, mode: 'insensitive' },
        },
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: {
            organizationId,
            name: defStage.tagName,
            color: defStage.color,
            category: 'Journey',
          },
        });
      }

      await prisma.pipelineStage.create({
        data: {
          pipelineId: pipeline.id,
          organizationId,
          name: defStage.name,
          color: defStage.color,
          order: defStage.order,
          tagId: tag.id,
          ruleType: 'TAG',
        },
      });
    }

    pipeline = await prisma.pipeline.findUnique({
      where: { id: pipeline.id },
      include: {
        stages: {
          include: { tag: true },
          orderBy: { order: 'asc' },
        },
      },
    }) as any;
  }

  return pipeline;
}

/**
 * Retrieves the full pipeline board with dynamic lead assignments based on tag rules.
 */
export async function getPipelineBoardData(filters?: {
  pipelineId?: string;
  search?: string;
  tagId?: string;
  agentId?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const organizationId = session.user.organizationId;
  const pipeline = await ensureDefaultPipeline(organizationId);
  if (!pipeline) {
    throw new Error('Failed to load pipeline');
  }

  // Fetch all available tags and agents for filtering & stage modal
  const [availableTags, availableAgents] = await Promise.all([
    prisma.tag.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true, category: true },
    }),
    prisma.user.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, image: true },
    }),
  ]);

  // Fetch contacts for the organization with tag & agent relationships
  const contactWhere: any = {
    organizationId,
    isBlocked: false,
  };

  if (filters?.search && filters.search.trim()) {
    const s = filters.search.trim();
    contactWhere.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { whatsappName: { contains: s, mode: 'insensitive' } },
      { waId: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { notes: { contains: s, mode: 'insensitive' } },
    ];
  }

  if (filters?.tagId && filters.tagId !== 'all') {
    contactWhere.tags = {
      some: { id: filters.tagId },
    };
  }

  if (filters?.agentId && filters.agentId !== 'all') {
    contactWhere.assignedUsers = {
      some: { id: filters.agentId },
    };
  }

  const contacts = await prisma.contact.findMany({
    where: contactWhere,
    select: {
      id: true,
      waId: true,
      name: true,
      whatsappName: true,
      email: true,
      profilePic: true,
      lastMessage: true,
      lastMessageAt: true,
      unreadCount: true,
      platform: true,
      notes: true,
      createdAt: true,
      tags: {
        select: { id: true, name: true, color: true },
      },
      assignedUsers: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  const stages = pipeline.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    order: stage.order,
    color: stage.color || '#10B981',
    tagId: stage.tagId,
    tag: stage.tag,
    ruleType: stage.ruleType,
    leads: [] as typeof contacts,
  }));

  const unassignedLeads: typeof contacts = [];

  // Dynamic Rule Evaluation:
  // Sort stages by order descending to assign contact to the most advanced stage if multiple tags match
  const stagesByOrderDesc = [...stages].sort((a, b) => b.order - a.order);

  for (const contact of contacts) {
    const contactTagIds = new Set(contact.tags.map((t) => t.id));
    let matchedStageId: string | null = null;

    for (const stage of stagesByOrderDesc) {
      if (stage.tagId && contactTagIds.has(stage.tagId)) {
        matchedStageId = stage.id;
        break;
      }
    }

    if (matchedStageId) {
      const targetStage = stages.find((s) => s.id === matchedStageId);
      if (targetStage) {
        targetStage.leads.push(contact);
      } else {
        unassignedLeads.push(contact);
      }
    } else {
      unassignedLeads.push(contact);
    }
  }

  return {
    pipeline: {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
    },
    stages,
    unassignedLeads,
    totalLeadsCount: contacts.length,
    availableTags,
    availableAgents,
  };
}

/**
 * Creates a new pipeline stage column.
 */
export async function createPipelineStage(data: {
  pipelineId?: string;
  name: string;
  tagId?: string | null;
  color?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  const stageName = data.name.trim();
  if (!stageName) {
    return { error: 'Stage name is required.' };
  }

  let pipelineId = data.pipelineId;
  if (!pipelineId) {
    const defaultPipeline = await ensureDefaultPipeline(organizationId);
    if (!defaultPipeline) {
      return { error: 'Default pipeline not found.' };
    }
    pipelineId = defaultPipeline.id;
  }

  const highestOrder = await prisma.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const nextOrder = (highestOrder?.order ?? -1) + 1;

  const newStage = await prisma.pipelineStage.create({
    data: {
      pipelineId,
      organizationId,
      name: stageName,
      color: data.color?.trim() || '#10B981',
      order: nextOrder,
      tagId: data.tagId || null,
      ruleType: 'TAG',
    },
    include: { tag: true },
  });

  revalidatePath('/dashboard/pipeline');
  logActivity({
    organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Created',
    module: 'Pipeline',
    target: stageName,
    details: `Created pipeline stage "${stageName}"`,
    status: 'success',
  });

  return { success: true, stage: newStage };
}

/**
 * Updates a pipeline stage (name, color, associated tag).
 */
export async function updatePipelineStage(
  stageId: string,
  data: {
    name?: string;
    tagId?: string | null;
    color?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  const existing = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId },
  });

  if (!existing) {
    return { error: 'Pipeline stage not found.' };
  }

  const updated = await prisma.pipelineStage.update({
    where: { id: stageId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.color ? { color: data.color.trim() } : {}),
      ...(data.tagId !== undefined ? { tagId: data.tagId || null } : {}),
    },
    include: { tag: true },
  });

  revalidatePath('/dashboard/pipeline');
  logActivity({
    organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Updated',
    module: 'Pipeline',
    target: updated.name,
    details: `Updated pipeline stage "${updated.name}"`,
    status: 'success',
  });

  return { success: true, stage: updated };
}

/**
 * Deletes a pipeline stage safely without deleting any contacts.
 */
export async function deletePipelineStage(stageId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  const existing = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId },
  });

  if (!existing) {
    return { error: 'Pipeline stage not found.' };
  }

  await prisma.pipelineStage.delete({
    where: { id: stageId },
  });

  revalidatePath('/dashboard/pipeline');
  logActivity({
    organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Pipeline',
    target: existing.name,
    details: `Deleted pipeline stage "${existing.name}"`,
    status: 'success',
  });

  return { success: true };
}

/**
 * Reorders pipeline stages.
 */
export async function reorderPipelineStages(
  stageOrders: { id: string; order: number }[]
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;

  await prisma.$transaction(
    stageOrders.map((item) =>
      prisma.pipelineStage.updateMany({
        where: { id: item.id, organizationId },
        data: { order: item.order },
      })
    )
  );

  revalidatePath('/dashboard/pipeline');
  return { success: true };
}

/**
 * Moves a contact between stages via drag-and-drop or manual stage selection,
 * keeping the contact's tags and all CRM modules 100% synchronized.
 */
export async function moveContactStage(
  contactId: string,
  targetStageId: string,
  sourceStageId?: string,
  newIndex?: number
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    include: { tags: true },
  });

  if (!contact) {
    return { error: 'Contact not found.' };
  }

  // Fetch all stages in the organization to know all pipeline tag IDs
  const allStages = await prisma.pipelineStage.findMany({
    where: { organizationId },
    select: { id: true, tagId: true, name: true },
  });

  const pipelineTagIds = new Set(
    allStages.map((s) => s.tagId).filter((id): id is string => Boolean(id))
  );

  const targetStage =
    targetStageId === 'unassigned'
      ? null
      : allStages.find((s) => s.id === targetStageId);

  if (targetStageId !== 'unassigned' && !targetStage) {
    return { error: 'Target stage not found.' };
  }

  const targetTagId = targetStage?.tagId || null;
  const targetStageName = targetStage?.name || 'Unassigned';

  // Calculate updated tag IDs: preserve non-pipeline tags, remove existing pipeline tags, add new target stage tag
  let updatedTagIds = contact.tags
    .map((t) => t.id)
    .filter((id) => !pipelineTagIds.has(id));

  if (targetTagId && !updatedTagIds.includes(targetTagId)) {
    updatedTagIds.push(targetTagId);
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      tags: {
        set: updatedTagIds.map((id) => ({ id })),
      },
    },
  });

  revalidatePath('/dashboard/pipeline');
  revalidatePath('/dashboard/contacts');

  logActivity({
    organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Updated',
    module: 'Pipeline',
    target: contact.name || contact.waId,
    details: `Moved contact ${contact.name || contact.waId} to stage "${targetStageName}"`,
    status: 'success',
  });

  return { success: true, updatedTagIds };
}

/**
 * Lightweight action to get all tags and pipeline stages for dropdown selections in AI Agent / Knowledge Base.
 */
export async function getTagsAndPipelineStagesAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { tags: [], stages: [] };
  }

  const organizationId = session.user.organizationId;
  const [tags, stages] = await Promise.all([
    prisma.tag.findMany({
      where: { organizationId },
      select: { id: true, name: true, color: true, category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.pipelineStage.findMany({
      where: { organizationId },
      select: { id: true, name: true, color: true, tagId: true, order: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  return { tags, stages };
}

/**
 * Quick action to create a new tag and optionally link it to a Pipeline stage from Knowledge Base.
 */
export async function createTagQuickAction(data: {
  name: string;
  color?: string;
  linkStageId?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  const cleanName = data.name.trim();
  if (!cleanName) {
    return { error: 'Tag name is required' };
  }

  let tag = await prisma.tag.findFirst({
    where: {
      organizationId,
      name: { equals: cleanName, mode: 'insensitive' },
    },
  });

  if (!tag) {
    tag = await prisma.tag.create({
      data: {
        organizationId,
        name: cleanName,
        color: data.color || '#10B981',
        category: 'Pipeline & AI',
      },
    });
  }

  if (data.linkStageId && data.linkStageId !== 'none') {
    await prisma.pipelineStage.updateMany({
      where: { id: data.linkStageId, organizationId },
      data: { tagId: tag.id },
    });
  }

  revalidatePath('/dashboard/pipeline');
  revalidatePath('/dashboard/knowledge-base');

  return { success: true, tag };
}

