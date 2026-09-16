import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { normalizeWaId } from "@/lib/api/mobile-formatters";
import { prisma } from "@/lib/prisma";
import { formatContact } from "@/app/api/v1/contacts/route";
import { triggerPusherOrgEvent } from "@/lib/pusher";

const contactInclude = {
  tags: true,
  groups: { include: { group: true } },
  assignedUsers: { select: { id: true, name: true, email: true } },
  aiAgent: true,
  organization: { select: { isAiBotEnabled: true } },
  _count: { select: { messages: true } },
};

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

function parseWebhooks(org: any, customWebhooks: any[]) {
  const webhooks: Array<{
    id: string;
    name: string;
    target_url?: string;
    is_system: boolean;
    is_active: boolean;
    is_ai_agent: boolean;
  }> = [];

  if (org?.businessDescription) {
    try {
      const parsed = JSON.parse(org.businessDescription);
      if (parsed.webhookConfig?.url) {
        webhooks.push({
          id: "system",
          name: "System Webhook (n8n)",
          target_url: parsed.webhookConfig.url,
          is_system: true,
          is_active: parsed.webhookConfig.enabled !== false,
          is_ai_agent: false,
        });
      }
    } catch { /* noop */ }
  }

  for (const hw of customWebhooks) {
    webhooks.push({
      id: hw.id,
      name: hw.name || "Custom Webhook",
      target_url: hw.targetUrl,
      is_system: false,
      is_active: hw.isActive,
      is_ai_agent: hw.isAiAgent ?? false,
    });
  }

  return webhooks;
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

  const [dbOrg, customWebhooks] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      select: { businessDescription: true },
    }),
    prisma.externalWebhook.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, targetUrl: true, isActive: true, isAiAgent: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const webhooks = parseWebhooks(dbOrg, customWebhooks);

  return NextResponse.json({
    status: 200,
    success: true,
    contact_id: contact.id,
    is_webhook_enabled: contact.isWebhookEnabled ?? true,
    disabled_webhook_ids: contact.disabledWebhookIds || [],
    webhooks,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const contact = await findContactByKey(contactId, org.id);
  if (!contact) return apiError(404, "Contact not found.");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object") return apiError(400, "Invalid JSON body.");
  } catch {
    return apiError(400, "Invalid JSON body.");
  }

  const webhookId = (body.webhook_id ?? body.webhookId ?? body.id)?.toString();
  const enabled = typeof body.enabled === "boolean"
    ? body.enabled
    : typeof body.is_enabled === "boolean"
    ? body.is_enabled
    : true;

  if (!webhookId) {
    return apiError(400, "Field 'webhook_id' is required.");
  }

  let isAiWebhook = false;
  if (webhookId !== "all" && webhookId !== "system") {
    const targetWh = await prisma.externalWebhook.findUnique({
      where: { id: webhookId },
      select: { isAiAgent: true },
    });
    isAiWebhook = !!targetWh?.isAiAgent;
  }

  let updateData: any = {};

  if (webhookId === "all") {
    updateData = {
      isWebhookEnabled: enabled,
      disabledWebhookIds: enabled ? [] : (contact.disabledWebhookIds || []),
      ...(enabled ? { isAiBotEnabled: true, assignedUsers: { set: [] } } : { isAiBotEnabled: false }),
    };
  } else {
    let currentDisabled = [...(contact.disabledWebhookIds || [])];
    if (enabled) {
      currentDisabled = currentDisabled.filter((id) => id !== webhookId);
    } else {
      if (!currentDisabled.includes(webhookId)) {
        currentDisabled.push(webhookId);
      }
    }
    updateData = {
      isWebhookEnabled: true,
      disabledWebhookIds: currentDisabled,
    };

    if (isAiWebhook) {
      if (enabled) {
        updateData.isAiBotEnabled = true;
        updateData.assignedUsers = { set: [] };
      } else {
        const orgAiWebhooks = await prisma.externalWebhook.findMany({
          where: { organizationId: org.id, isAiAgent: true },
          select: { id: true },
        });
        const allAiDisabled = orgAiWebhooks.length > 0 && orgAiWebhooks.every((w) => currentDisabled.includes(w.id));
        if (allAiDisabled) {
          updateData.isAiBotEnabled = false;
        }
      }
    }
  }

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: updateData,
    include: contactInclude,
  });

  const formatted = formatContact(updated, org.id);
  await triggerPusherOrgEvent(org.id, "contact:update", formatted);

  const [dbOrg, customWebhooks] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      select: { businessDescription: true },
    }),
    prisma.externalWebhook.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, targetUrl: true, isActive: true, isAiAgent: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const webhooks = parseWebhooks(dbOrg, customWebhooks);

  return NextResponse.json({
    status: 200,
    success: true,
    contact_id: updated.id,
    is_webhook_enabled: updated.isWebhookEnabled ?? true,
    disabled_webhook_ids: updated.disabledWebhookIds || [],
    webhooks,
    contact: formatted,
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ contactId: string }> }
) {
  return POST(req, ctx);
}
