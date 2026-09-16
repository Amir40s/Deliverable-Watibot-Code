import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export interface SyncTagResult {
  success: boolean;
  contactId: string;
  tagId: string;
  tagName: string;
  pipelineStageName?: string;
  movedStage: boolean;
}

/**
 * Assigns a tag to a contact and automatically synchronizes with the Pipeline module.
 * If the tag is mapped to a PipelineStage:
 *  - Safely detaches any other pipeline stage tags from the contact
 *  - Attaches the new stage tag
 *  - Preserves all general/custom non-pipeline tags
 *  - Invalidate caches so the Pipeline Board (/dashboard/pipeline) reflects the move instantly.
 *
 * If the tag is a general tag (not tied to any stage), it simply attaches the tag to the contact.
 */
export async function assignContactTagWithPipelineSync(
  organizationId: string,
  contactId: string,
  tagIdentifier: { id?: string; name?: string; color?: string }
): Promise<SyncTagResult | null> {
  try {
    if (!organizationId || !contactId) {
      logger.flow.warn("[PipelineSync] Missing organizationId or contactId");
      return null;
    }

    // 1. Resolve or create Tag
    let tag: { id: string; name: string } | null = null;
    if (tagIdentifier.id) {
      tag = await prisma.tag.findFirst({
        where: { id: tagIdentifier.id, organizationId },
        select: { id: true, name: true },
      });
    }

    if (!tag && tagIdentifier.name) {
      const cleanName = tagIdentifier.name.trim();
      if (!cleanName || cleanName === "N/A" || cleanName === "none") {
        return null;
      }

      tag = await prisma.tag.findFirst({
        where: {
          organizationId,
          name: { equals: cleanName, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });

      if (!tag) {
        const color = tagIdentifier.color || (
          cleanName.toLowerCase().includes("hot") ? "#ef4444" :
          cleanName.toLowerCase().includes("warm") || cleanName.toLowerCase().includes("interest") ? "#f59e0b" :
          cleanName.toLowerCase().includes("qualified") || cleanName.toLowerCase().includes("convert") ? "#10b981" :
          "#3b82f6"
        );

        tag = await prisma.tag.create({
          data: {
            organizationId,
            name: cleanName,
            color,
            category: "Pipeline & AI",
          },
          select: { id: true, name: true },
        });
        logger.flow.info(`[PipelineSync] Created new tag "${cleanName}" (${tag.id})`);
      }
    }

    if (!tag) {
      return null;
    }

    // 2. Fetch current contact tags and all pipeline stages in organization
    const [contact, allStages] = await Promise.all([
      prisma.contact.findFirst({
        where: { id: contactId, organizationId },
        include: { tags: { select: { id: true, name: true } } },
      }),
      prisma.pipelineStage.findMany({
        where: { organizationId },
        select: { id: true, tagId: true, name: true },
      }),
    ]);

    if (!contact) {
      logger.flow.warn(`[PipelineSync] Contact not found: ${contactId}`);
      return null;
    }

    // Map stage tags
    const pipelineTagMap = new Map<string, string>(); // tagId -> stageName
    for (const stage of allStages) {
      if (stage.tagId) {
        pipelineTagMap.set(stage.tagId, stage.name);
      }
    }

    const isPipelineStageTag = pipelineTagMap.has(tag.id);
    const currentTagIds = contact.tags.map((t) => t.id);

    let updatedTagIds: string[];

    if (isPipelineStageTag) {
      // Is a pipeline stage tag: remove old pipeline stage tags, keep other custom tags, attach target stage tag
      updatedTagIds = currentTagIds.filter(
        (id) => id === tag!.id || !pipelineTagMap.has(id)
      );
      if (!updatedTagIds.includes(tag.id)) {
        updatedTagIds.push(tag.id);
      }
    } else {
      // Regular tag: connect without touching other tags
      if (currentTagIds.includes(tag.id)) {
        return {
          success: true,
          contactId,
          tagId: tag.id,
          tagName: tag.name,
          movedStage: false,
        };
      }
      updatedTagIds = [...currentTagIds, tag.id];
    }

    // 3. Update Contact Tags
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          set: updatedTagIds.map((id) => ({ id })),
        },
      },
    });

    const targetStageName = pipelineTagMap.get(tag.id);

    logger.flow.info(
      `[PipelineSync] Contact ${contact.waId || contactId} assigned tag "${tag.name}"${
        targetStageName ? ` -> Synced to Pipeline Stage: "${targetStageName}"` : ""
      }`
    );

    // 4. Revalidate pages for immediate UI updates
    try {
      revalidatePath("/dashboard/pipeline");
      revalidatePath("/dashboard/contacts");
    } catch {
      // safe inside non-request async flows
    }

    return {
      success: true,
      contactId,
      tagId: tag.id,
      tagName: tag.name,
      pipelineStageName: targetStageName,
      movedStage: isPipelineStageTag,
    };
  } catch (err: any) {
    logger.flow.error(`[PipelineSync] Failed to sync contact tag: ${err.message}`);
    return null;
  }
}
