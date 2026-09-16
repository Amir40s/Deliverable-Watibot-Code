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
import { clampLimit } from "@/lib/api/mobile-formatters";

function jsonInput(value: unknown) {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

function booleanFromQuery(value: string | null) {
  if (!value) return undefined;
  if (["true", "1", "yes", "active"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no", "inactive"].includes(value.toLowerCase())) return false;
  return undefined;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const platform = (sp.get("platform") || "").trim();
  const isActive = booleanFromQuery(sp.get("is_active") || sp.get("active"));

  const where: Prisma.WelcomeMessageWhereInput = {
    organizationId: org.id,
    ...(platform ? { platform } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, messages] = await Promise.all([
    prisma.welcomeMessage.count({ where }),
    prisma.welcomeMessage.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total,
    quick_messages: messages.map(formatWelcomeMessage),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name) || optionalString(body.title);
  const content = optionalString(body.content) || optionalString(body.message);

  if (!name) return apiError(400, "Field 'name' is required.");
  if (!content) return apiError(400, "Field 'content' is required.");

  const message = await prisma.welcomeMessage.create({
    data: {
      organizationId: org.id,
      name,
      content,
      mediaUrl: optionalString(body.media_url) || optionalString(body.mediaUrl) || null,
      mediaType: optionalString(body.media_type) || optionalString(body.mediaType) || null,
      isActive: optionalBoolean(body.is_active) ?? optionalBoolean(body.isActive) ?? true,
      priority: optionalNumber(body.priority) ?? 0,
      delaySeconds: optionalNumber(body.delay_seconds) ?? optionalNumber(body.delaySeconds) ?? 0,
      conditions: jsonInput(body.conditions) ?? [],
      conditionLogic: optionalString(body.condition_logic) || optionalString(body.conditionLogic) || "OR",
      platform: optionalString(body.platform) || "ALL",
      templateName: optionalString(body.template_name) || optionalString(body.templateName) || null,
      templateLanguage: optionalString(body.template_language) || optionalString(body.templateLanguage) || null,
      templateParams: jsonInput(body.template_params ?? body.templateParams),
      buttons: jsonInput(body.buttons),
      sequenceItems: jsonInput(body.sequence_items ?? body.sequenceItems) ?? [],
      assignTagId: optionalString(body.assign_tag_id) || optionalString(body.assignTagId) || null,
      assignAgentId: optionalString(body.assign_agent_id) || optionalString(body.assignAgentId) || null,
    },
  });

  return NextResponse.json({
    status: 201,
    success: true,
    quick_message: formatWelcomeMessage(message),
  }, { status: 201 });
}
