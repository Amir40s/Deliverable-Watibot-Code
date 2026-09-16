import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import {
  formatScheduledMessage,
  optionalString,
  parseDate,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";
import { normalizeWaId } from "@/lib/api/mobile-formatters";

const campaignInclude = {
  contact: { select: { id: true, name: true, waId: true, platform: true } },
  group: {
    select: {
      id: true,
      name: true,
      color: true,
      contacts: {
        include: {
          contact: { select: { id: true, name: true, waId: true, platform: true } },
        },
      },
    },
  },
};

async function validateTarget(orgId: string, contactId?: string, groupId?: string) {
  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true },
    });
    if (!contact) return "Contact not found in this project.";
  }

  if (groupId) {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true },
    });
    if (!group) return "Contact group not found in this project.";
  }

  return null;
}

async function resolveContactId(orgId: string, body: Record<string, unknown>) {
  const contactId = optionalString(body.contact_id) || optionalString(body.contactId);
  if (contactId) return contactId;

  const mobileNumber = optionalString(body.mobile_number)
    || optionalString(body.phone_number)
    || optionalString(body.phone)
    || optionalString(body.destination)
    || optionalString(body.to);
  if (!mobileNumber) return undefined;

  const contact = await prisma.contact.findFirst({
    where: {
      organizationId: orgId,
      waId: normalizeWaId(mobileNumber),
    },
    select: { id: true },
  });

  return contact?.id ?? null;
}

function campaignNotFound(campaignId: string) {
  return NextResponse.json(
    {
      status: 404,
      error: "Drip campaign not found.",
      hint: campaignId === "CAMPAIGN_ID"
        ? "Replace CAMPAIGN_ID with a real campaign id from GET /api/v1/drip-campaigns."
        : "Use a campaign id returned by GET /api/v1/drip-campaigns for this project token.",
    },
    { status: 404 }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.scheduledMessage.findFirst({
    where: { id: campaignId, organizationId: org.id, type: "DRIP" },
  });
  if (!existing) return campaignNotFound(campaignId);

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const contactId = await resolveContactId(org.id, body);
  const groupId = optionalString(body.group_id) || optionalString(body.groupId);
  if (contactId === null) {
    return NextResponse.json(
      {
        status: 404,
        error: "Contact not found for mobile_number.",
        hint: "Use an existing WhatsApp number from GET /api/v1/contacts or GET /api/v1/live-chat.",
      },
      { status: 404 }
    );
  }
  const targetError = await validateTarget(org.id, contactId, groupId);
  if (targetError) return apiError(404, targetError);

  const scheduledAt = parseDate(body.scheduled_at) || parseDate(body.scheduledAt);
  const updated = await prisma.scheduledMessage.update({
    where: { id: campaignId },
    data: {
      ...(contactId !== undefined ? { contactId } : {}),
      ...(groupId !== undefined ? { groupId } : {}),
      ...(body.content !== undefined || body.message !== undefined
        ? { content: optionalString(body.content) || optionalString(body.message) || existing.content }
        : {}),
      ...(body.media_url !== undefined || body.mediaUrl !== undefined
        ? { mediaUrl: optionalString(body.media_url) || optionalString(body.mediaUrl) || null }
        : {}),
      ...(scheduledAt !== undefined ? { scheduledAt } : {}),
      ...(body.status !== undefined ? { status: optionalString(body.status) || existing.status } : {}),
      ...(body.platform !== undefined ? { platform: optionalString(body.platform) || existing.platform } : {}),
      ...(body.template_name !== undefined || body.templateName !== undefined
        ? { templateName: optionalString(body.template_name) || optionalString(body.templateName) || null }
        : {}),
      ...(body.template_language !== undefined || body.templateLanguage !== undefined
        ? { templateLanguage: optionalString(body.template_language) || optionalString(body.templateLanguage) || null }
        : {}),
      ...(body.template_params !== undefined ? { templateParams: body.template_params as Prisma.InputJsonValue } : {}),
      ...(body.buttons !== undefined ? { buttons: body.buttons as Prisma.InputJsonValue } : {}),
    },
    include: campaignInclude,
  });

  return NextResponse.json({
    status: 200,
    success: true,
    campaign: formatScheduledMessage(updated),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.scheduledMessage.findFirst({
    where: { id: campaignId, organizationId: org.id, type: "DRIP" },
    select: { id: true },
  });
  if (!existing) return campaignNotFound(campaignId);

  await prisma.scheduledMessage.delete({ where: { id: campaignId } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: campaignId,
  });
}
