import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { sendUnifiedMessage } from "@/lib/messaging/api";
import type { Prisma } from "@/lib/generated/prisma";
import {
  formatMobileContact,
  formatMobileMessage,
  normalizeWaId,
} from "@/lib/api/mobile-formatters";

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function buildTemplateComponents(params: unknown) {
  if (!Array.isArray(params) || params.length === 0) return undefined;
  return [
    {
      type: "body",
      parameters: params.map((value) => ({
        type: "text",
        text: String(value),
      })),
    },
  ];
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  let body: Record<string, unknown>;
  try {
    const parsed = asBodyObject(await req.json());
    if (!parsed) return apiError(400, "Invalid JSON body.");
    body = parsed;
  } catch {
    return apiError(400, "Invalid JSON body.");
  }

  const mobileNumber = optionalString(body.mobile_number)
    || optionalString(body.phone)
    || optionalString(body.destination)
    || optionalString(body.to);
  const templateName = optionalString(body.template_name)
    || optionalString(body.templateName)
    || optionalString(body.campaignName);
  const waId = normalizeWaId(mobileNumber);

  if (!waId) return apiError(400, "Field 'mobile_number' is required.");
  if (!templateName) return apiError(400, "Field 'template_name' is required.");

  try {
    const contact = await prisma.contact.upsert({
      where: {
        organizationId_platform_waId: {
          organizationId: org.id,
          platform: "WHATSAPP",
          waId,
        },
      },
      update: {
        ...(body.name !== undefined ? { name: optionalString(body.name) } : {}),
        ...(body.attributes !== undefined ? { customAttributes: body.attributes as Prisma.InputJsonValue } : {}),
        isAutoCreated: false,
      },
      create: {
        organizationId: org.id,
        waId,
        name: optionalString(body.name) || waId,
        platform: "WHATSAPP",
        customAttributes: body.attributes as Prisma.InputJsonValue | undefined,
        isAutoCreated: false,
        lastMessageAt: new Date(),
      },
      include: {
        tags: true,
        groups: { include: { group: true } },
        assignedUsers: { select: { id: true, name: true, email: true } },
        aiAgent: true,
        _count: { select: { messages: true } },
      },
    });

    const textToSend = optionalString(body.message) ?? (templateName ? `Template: ${templateName}` : "");
    const sentMessage = await sendUnifiedMessage({
      contactId: contact.id,
      message: textToSend,

      templateName,
      templateLanguage: optionalString(body.language) || optionalString(body.template_language) || "en",
      templateComponents: Array.isArray(body.components) ? body.components : buildTemplateComponents(body.template_params),
      skipWindowCheck: true,
    });

    return NextResponse.json({
      status: 201,
      success: true,
      contact: formatMobileContact(contact, org.id),
      message: formatMobileMessage(sentMessage),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start conversation.";
    return NextResponse.json({ status: 422, error: message }, { status: 422 });
  }
}
