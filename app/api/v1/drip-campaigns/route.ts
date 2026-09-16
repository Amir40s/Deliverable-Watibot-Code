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
import { clampLimit, normalizeWaId } from "@/lib/api/mobile-formatters";

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

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const status = (sp.get("status") || "").trim();

  const where: Prisma.ScheduledMessageWhereInput = {
    organizationId: org.id,
    type: "DRIP",
    ...(status ? { status } : {}),
  };

  const [total, campaigns] = await Promise.all([
    prisma.scheduledMessage.count({ where }),
    prisma.scheduledMessage.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      take: limit,
      include: campaignInclude,
    }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total,
    campaigns: campaigns.map(formatScheduledMessage),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const contactId = await resolveContactId(org.id, body);
  const groupId = optionalString(body.group_id) || optionalString(body.groupId);
  const content = optionalString(body.content) || optionalString(body.message);
  const scheduledAt = parseDate(body.scheduled_at) || parseDate(body.scheduledAt) || new Date();

  if (!content) return apiError(400, "Field 'content' is required.");
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
  if (!contactId && !groupId) return apiError(400, "Provide either 'mobile_number' or 'group_id'.");

  const targetError = await validateTarget(org.id, contactId, groupId);
  if (targetError) return apiError(404, targetError);

  const campaign = await prisma.scheduledMessage.create({
    data: {
      organizationId: org.id,
      contactId,
      groupId,
      content,
      mediaUrl: optionalString(body.media_url) || optionalString(body.mediaUrl),
      scheduledAt,
      status: optionalString(body.status) || "PENDING",
      type: "DRIP",
      platform: optionalString(body.platform) || "WHATSAPP",
      templateName: optionalString(body.template_name) || optionalString(body.templateName),
      templateLanguage: optionalString(body.template_language) || optionalString(body.templateLanguage),
      templateParams: body.template_params as Prisma.InputJsonValue | undefined,
      buttons: body.buttons as Prisma.InputJsonValue | undefined,
    },
    include: campaignInclude,
  });

  return NextResponse.json({
    status: 201,
    success: true,
    campaign: formatScheduledMessage(campaign),
  }, { status: 201 });
}
