import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import {
  formatWelcomeMessage,
  optionalBoolean,
  optionalNumber,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

function decodePathKey(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function jsonInput(value: unknown) {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

async function findQuickMessageByKey(messageKey: string, organizationId: string) {
  const key = decodePathKey(messageKey);

  return prisma.welcomeMessage.findFirst({
    where: {
      organizationId,
      OR: [
        { id: key },
        { name: { equals: key, mode: "insensitive" } },
      ],
    },
  });
}

function quickMessageNotFound(messageKey: string) {
  return NextResponse.json(
    {
      status: 404,
      error: "Quick message not found.",
      lookup_key: decodePathKey(messageKey),
      hint: "Use the current quick message name or id from GET /api/v1/quick-messages.",
    },
    { status: 404 }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await findQuickMessageByKey(messageId, org.id);
  if (!existing) return quickMessageNotFound(messageId);

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const updated = await prisma.welcomeMessage.update({
    where: { id: existing.id },
    data: {
      ...(body.name !== undefined || body.title !== undefined
        ? { name: optionalString(body.name) || optionalString(body.title) || existing.name }
        : {}),
      ...(body.content !== undefined || body.message !== undefined
        ? { content: optionalString(body.content) || optionalString(body.message) || existing.content }
        : {}),
      ...(body.media_url !== undefined || body.mediaUrl !== undefined
        ? { mediaUrl: optionalString(body.media_url) || optionalString(body.mediaUrl) || null }
        : {}),
      ...(body.media_type !== undefined || body.mediaType !== undefined
        ? { mediaType: optionalString(body.media_type) || optionalString(body.mediaType) || null }
        : {}),
      ...(body.is_active !== undefined || body.isActive !== undefined
        ? { isActive: optionalBoolean(body.is_active) ?? optionalBoolean(body.isActive) ?? existing.isActive }
        : {}),
      ...(body.priority !== undefined
        ? { priority: optionalNumber(body.priority) ?? existing.priority }
        : {}),
      ...(body.delay_seconds !== undefined || body.delaySeconds !== undefined
        ? { delaySeconds: optionalNumber(body.delay_seconds) ?? optionalNumber(body.delaySeconds) ?? existing.delaySeconds }
        : {}),
      ...(body.conditions !== undefined ? { conditions: jsonInput(body.conditions) } : {}),
      ...(body.condition_logic !== undefined || body.conditionLogic !== undefined
        ? { conditionLogic: optionalString(body.condition_logic) || optionalString(body.conditionLogic) || existing.conditionLogic }
        : {}),
      ...(body.platform !== undefined
        ? { platform: optionalString(body.platform) || existing.platform }
        : {}),
      ...(body.template_name !== undefined || body.templateName !== undefined
        ? { templateName: optionalString(body.template_name) || optionalString(body.templateName) || null }
        : {}),
      ...(body.template_language !== undefined || body.templateLanguage !== undefined
        ? { templateLanguage: optionalString(body.template_language) || optionalString(body.templateLanguage) || null }
        : {}),
      ...(body.template_params !== undefined || body.templateParams !== undefined
        ? { templateParams: jsonInput(body.template_params ?? body.templateParams) }
        : {}),
      ...(body.buttons !== undefined ? { buttons: jsonInput(body.buttons) } : {}),
      ...(body.sequence_items !== undefined || body.sequenceItems !== undefined
        ? { sequenceItems: jsonInput(body.sequence_items ?? body.sequenceItems) ?? [] }
        : {}),
      ...(body.assign_tag_id !== undefined || body.assignTagId !== undefined
        ? { assignTagId: optionalString(body.assign_tag_id) || optionalString(body.assignTagId) || null }
        : {}),
      ...(body.assign_agent_id !== undefined || body.assignAgentId !== undefined
        ? { assignAgentId: optionalString(body.assign_agent_id) || optionalString(body.assignAgentId) || null }
        : {}),
    },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    quick_message: formatWelcomeMessage(updated),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await findQuickMessageByKey(messageId, org.id);
  if (!existing) return quickMessageNotFound(messageId);

  await prisma.welcomeMessage.delete({ where: { id: existing.id } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: existing.id,
    key: decodePathKey(messageId),
  });
}
