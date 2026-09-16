import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import {
  asArray,
  formatExternalWebhook,
  optionalBoolean,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

function stringList(value: unknown) {
  return asArray(value).map(String).map((item) => item.trim()).filter(Boolean);
}

function validateUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const webhook = await prisma.externalWebhook.findFirst({
    where: { id: webhookId, organizationId: org.id },
  });
  if (!webhook) return apiError(404, "Webhook not found.");

  return NextResponse.json({
    status: 200,
    success: true,
    webhook: formatExternalWebhook(webhook),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.externalWebhook.findFirst({
    where: { id: webhookId, organizationId: org.id },
  });
  if (!existing) return apiError(404, "Webhook not found.");

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const targetUrl = optionalString(body.target_url)?.trim() || optionalString(body.targetUrl)?.trim();
  if (targetUrl && !validateUrl(targetUrl)) {
    return apiError(400, "Field 'target_url' must be a valid http or https URL.");
  }

  const events = body.events !== undefined ? stringList(body.events) : undefined;
  if (body.events !== undefined && !events?.length) {
    return apiError(400, "Field 'events' must include at least one event.");
  }

  const webhook = await prisma.externalWebhook.update({
    where: { id: webhookId },
    data: {
      ...(body.name !== undefined ? { name: optionalString(body.name)?.trim() || existing.name } : {}),
      ...(targetUrl ? { targetUrl } : {}),
      ...(events ? { events } : {}),
      ...(body.is_active !== undefined || body.isActive !== undefined
        ? { isActive: optionalBoolean(body.is_active) ?? optionalBoolean(body.isActive) ?? existing.isActive }
        : {}),
    },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    webhook: formatExternalWebhook(webhook),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.externalWebhook.findFirst({
    where: { id: webhookId, organizationId: org.id },
    select: { id: true },
  });
  if (!existing) return apiError(404, "Webhook not found.");

  await prisma.externalWebhook.delete({ where: { id: webhookId } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: webhookId,
  });
}
