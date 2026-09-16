import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { normalizeWaId } from "@/lib/api/mobile-formatters";
import { prisma } from "@/lib/prisma";
import { formatContact } from "../route";
import { triggerPusherOrgEvent } from "@/lib/pusher";
import { Platform, type Prisma } from "@/lib/generated/prisma";

const contactInclude = {
  tags: true,
  groups: { include: { group: true } },
  assignedUsers: { select: { id: true, name: true, email: true } },
  aiAgent: true,
  organization: { select: { isAiBotEnabled: true } },
  _count: { select: { messages: true } },
};

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : undefined;
}

function normalizePlatform(value: unknown): Platform {
  const normalized = String(value || "WHATSAPP").toUpperCase();
  return Object.values(Platform).includes(normalized as Platform)
    ? normalized as Platform
    : Platform.WHATSAPP;
}

function normalizeContactKey(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function findContactByKey(contactKey: string, organizationId: string) {
  const normalizedKey = normalizeContactKey(contactKey);
  const waId = normalizeWaId(normalizedKey);

  return prisma.contact.findFirst({
    where: {
      organizationId,
      OR: [
        { id: normalizedKey },
        ...(waId ? [{ waId }] : []),
      ],
    },
    include: contactInclude,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const contact = await findContactByKey(contactId, org.id);
  if (!contact) return apiError(404, "Contact not found.");

  return NextResponse.json(formatContact(contact, org.id));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await findContactByKey(contactId, org.id);
  if (!existing) return apiError(404, "Contact not found.");

  let body: Record<string, unknown>;
  try {
    const parsed = asBodyObject(await req.json());
    if (!parsed) return apiError(400, "Invalid JSON body.");
    body = parsed;
  } catch {
    return apiError(400, "Invalid JSON body.");
  }

  const name = optionalString(body.name);
  const mobileNumber = optionalString(body.mobile_number);
  const email = optionalString(body.email);
  const firstName = optionalString(body.first_name);
  const lastName = optionalString(body.last_name);
  const notes = optionalString(body.notes);
  const tagIds = stringList(body.tag_ids);
  const groupIds = stringList(body.group_ids);
  const assignedUserIds = stringList(body.assigned_user_ids ?? body.assignedUserIds);

  const aiAgentWebhooks = await prisma.externalWebhook.findMany({
    where: { organizationId: org.id, isAiAgent: true },
    select: { id: true }
  });
  const aiWebhookIds = aiAgentWebhooks.map((w) => w.id);

  let updatedDisabledWebhookIds = [...(existing.disabledWebhookIds || [])];

  const hasAiToggle = typeof body.is_ai_bot_enabled === "boolean" || typeof body.isAiBotEnabled === "boolean";
  const nextAiEnabled = typeof body.is_ai_bot_enabled === "boolean"
    ? body.is_ai_bot_enabled
    : (typeof body.isAiBotEnabled === "boolean" ? body.isAiBotEnabled : undefined);

  if (hasAiToggle && nextAiEnabled !== undefined) {
    if (nextAiEnabled) {
      if (aiWebhookIds.length > 0) {
        updatedDisabledWebhookIds = updatedDisabledWebhookIds.filter((id) => !aiWebhookIds.includes(id));
      }
    } else {
      for (const id of aiWebhookIds) {
        if (!updatedDisabledWebhookIds.includes(id)) {
          updatedDisabledWebhookIds.push(id);
        }
      }
    }
  }

  const hasWebhookToggle = typeof body.is_webhook_enabled === "boolean" || typeof body.isWebhookEnabled === "boolean";
  const nextWebhookEnabled = typeof body.is_webhook_enabled === "boolean"
    ? body.is_webhook_enabled
    : (typeof body.isWebhookEnabled === "boolean" ? body.isWebhookEnabled : undefined);

  if (hasWebhookToggle && nextWebhookEnabled !== undefined) {
    if (nextWebhookEnabled) {
      updatedDisabledWebhookIds = [];
    }
  }

  const customDisabledIds = stringList(body.disabled_webhook_ids ?? body.disabledWebhookIds);
  if (customDisabledIds !== undefined) {
    updatedDisabledWebhookIds = customDisabledIds;
  }

  const updateData: Prisma.ContactUpdateInput = {
    ...(name !== undefined ? { name } : {}),
    ...(mobileNumber !== undefined ? { waId: normalizeWaId(mobileNumber) } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(body.platform !== undefined ? { platform: normalizePlatform(body.platform) } : {}),
    ...(typeof body.is_blocked === "boolean" ? { isBlocked: body.is_blocked } : {}),
    ...(hasAiToggle && nextAiEnabled !== undefined ? {
      isAiBotEnabled: nextAiEnabled,
      isWebhookEnabled: nextAiEnabled ? true : (hasWebhookToggle && nextWebhookEnabled !== undefined ? nextWebhookEnabled : existing.isWebhookEnabled),
      disabledWebhookIds: updatedDisabledWebhookIds,
      ...(nextAiEnabled ? { assignedUsers: { set: [] } } : {}),
    } : {
      ...(hasWebhookToggle && nextWebhookEnabled !== undefined ? {
        isWebhookEnabled: nextWebhookEnabled,
        disabledWebhookIds: updatedDisabledWebhookIds,
        ...(nextWebhookEnabled ? { isAiBotEnabled: true, assignedUsers: { set: [] } } : {}),
      } : (customDisabledIds !== undefined ? { disabledWebhookIds: updatedDisabledWebhookIds } : {})),
    }),
    ...(body.attributes !== undefined ? { customAttributes: body.attributes as Prisma.InputJsonValue } : {}),
    ...(tagIds !== undefined ? { tags: { set: tagIds.map((id) => ({ id })) } } : {}),
    ...(assignedUserIds !== undefined ? { assignedUsers: { set: assignedUserIds.map((id) => ({ id })) } } : {}),
    ...(groupIds !== undefined
      ? {
          groups: {
            deleteMany: {},
            create: groupIds.map((groupId) => ({ groupId })),
          },
        }
      : {}),
  };

  const updated = await prisma.contact.update({
    where: { id: existing.id },
    data: updateData,
    include: contactInclude,
  });

  const formatted = formatContact(updated, org.id);
  await triggerPusherOrgEvent(org.id, 'contact:update', formatted);

  return NextResponse.json(formatted);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await findContactByKey(contactId, org.id);
  if (!existing) return apiError(404, "Contact not found.");

  await prisma.contact.delete({ where: { id: existing.id } });

  await triggerPusherOrgEvent(org.id, 'contact:delete', {
    contactId: existing.id,
    contact_id: existing.id,
    waId: existing.waId,
  });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: existing.id,
    phone_number: existing.waId,
  });
}
