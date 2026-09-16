import { randomBytes } from "crypto";
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

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const webhooks = await prisma.externalWebhook.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total: webhooks.length,
    webhooks: webhooks.map((webhook) => formatExternalWebhook(webhook)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name)?.trim();
  const targetUrl = optionalString(body.target_url)?.trim() || optionalString(body.targetUrl)?.trim();
  const events = stringList(body.events);

  if (!name) return apiError(400, "Field 'name' is required.");
  if (!targetUrl) return apiError(400, "Field 'target_url' is required.");
  if (!validateUrl(targetUrl)) return apiError(400, "Field 'target_url' must be a valid http or https URL.");
  if (!events.length) return apiError(400, "Field 'events' must include at least one event.");

  const webhook = await prisma.externalWebhook.create({
    data: {
      organizationId: org.id,
      name,
      targetUrl,
      events,
      isActive: optionalBoolean(body.is_active) ?? optionalBoolean(body.isActive) ?? true,
      secretKey: randomBytes(32).toString("hex"),
    },
  });

  return NextResponse.json({
    status: 201,
    success: true,
    webhook: formatExternalWebhook(webhook, true),
  }, { status: 201 });
}
