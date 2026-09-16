import { apiError } from "@/lib/api/project-auth";
import { toEpoch, toIso } from "@/lib/api/mobile-formatters";
import type { NextRequest } from "next/server";

export function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function readJsonObject(req: NextRequest) {
  try {
    const parsed = asBodyObject(await req.json());
    if (!parsed) return { body: null, error: apiError(400, "Invalid JSON body.") };
    return { body: parsed, error: null };
  } catch {
    return { body: null, error: apiError(400, "Invalid JSON body.") };
  }
}

export function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

export function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function jsonValue(value: unknown) {
  return value === undefined ? undefined : value;
}

export function parseDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseFileUrls(fileUrl?: unknown): string[] {
  if (!fileUrl) return [];
  if (Array.isArray(fileUrl)) return fileUrl.map(String).filter(Boolean);
  const str = String(fileUrl).trim();
  if (!str) return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
  }
  return [str];
}

export function parseFileNames(fileName?: unknown): string[] {
  if (!fileName) return [];
  if (Array.isArray(fileName)) return fileName.map(String).filter(Boolean);
  const str = String(fileName).trim();
  if (!str) return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
  }
  return [str];
}

export function formatQuickReply(reply: unknown) {
  const item = asBodyObject(reply) ?? {};
  const fileUrls = parseFileUrls(item.fileUrl);
  const fileNames = parseFileNames(item.fileName);

  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    type: item.type ?? "text",
    content: item.content ?? null,
    file_url: item.fileUrl ?? null,
    file_name: item.fileName ?? null,
    file_urls: fileUrls,
    file_names: fileNames,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatScheduledMessage(message: unknown) {
  const item = asBodyObject(message) ?? {};
  const contact = asBodyObject(item.contact) ?? {};
  const group = asBodyObject(item.group) ?? {};
  const groupContacts = asArray(group.contacts)
    .map((member) => {
      const row = asBodyObject(member) ?? {};
      const memberContact = asBodyObject(row.contact) ?? {};
      return {
        contact_id: row.contactId ?? memberContact.id ?? null,
        name: memberContact.name ?? null,
        phone_number: memberContact.waId ?? null,
      };
    })
    .filter((member) => member.contact_id || member.phone_number);

  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    contact_id: item.contactId ?? null,
    group_id: item.groupId ?? null,
    content: item.content,
    media_url: item.mediaUrl ?? null,
    scheduled_at: toEpoch(item.scheduledAt),
    scheduled_at_iso: toIso(item.scheduledAt),
    status: item.status ?? "PENDING",
    type: item.type ?? "SCHEDULED",
    platform: item.platform ?? "WHATSAPP",
    template_name: item.templateName ?? null,
    template_language: item.templateLanguage ?? null,
    template_params: item.templateParams ?? null,
    buttons: item.buttons ?? null,
    attempts: item.attempts ?? 0,
    last_error: item.lastError ?? null,
    contact: (contact && Object.keys(contact).length)
      ? {
          id: contact.id,
          name: contact.name ?? null,
          phone_number: contact.waId ?? null,
          platform: contact.platform ?? "WHATSAPP",
        }
      : null,
    group: (group && Object.keys(group).length)
      ? {
          id: group.id,
          name: group.name,
          color: group.color ?? null,
          contacts: groupContacts,
          contacts_count: groupContacts.length || undefined,
        }
      : null,
    recipients_count: groupContacts.length || (Object.keys(contact).length || Object.keys(group).length ? 1 : 0),
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatWelcomeMessage(message: unknown) {
  const item = asBodyObject(message) ?? {};

  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    content: item.content,
    media_url: item.mediaUrl ?? null,
    media_type: item.mediaType ?? null,
    is_active: item.isActive ?? false,
    priority: item.priority ?? 0,
    delay_seconds: item.delaySeconds ?? 0,
    conditions: item.conditions ?? [],
    condition_logic: item.conditionLogic ?? "OR",
    trigger_log: item.triggerLog ?? null,
    platform: item.platform ?? "ALL",
    template_name: item.templateName ?? null,
    template_language: item.templateLanguage ?? null,
    template_params: item.templateParams ?? null,
    buttons: item.buttons ?? null,
    sequence_items: item.sequenceItems ?? [],
    sequenceItems: item.sequenceItems ?? [],
    assign_tag_id: item.assignTagId ?? null,
    assign_agent_id: item.assignAgentId ?? null,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatFlow(flow: unknown) {
  const item = asBodyObject(flow) ?? {};
  const count = asBodyObject(item._count) ?? {};
  const executions = asArray(item.executions);
  const lastExec = executions[0] ? asBodyObject(executions[0]) : null;
  const lastRunTime = lastExec?.startedAt ? lastExec.startedAt : null;

  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    description: item.description ?? null,
    is_active: item.isActive ?? false,
    trigger: item.trigger ?? null,
    nodes: item.nodes ?? [],
    edges: item.edges ?? [],
    welcome_message: item.welcomeMessage ?? null,
    platform: item.platform ?? "ALL",
    executions_count: count.executions ?? undefined,
    last_run_at: lastRunTime ? toEpoch(lastRunTime) : null,
    last_run_at_iso: lastRunTime ? toIso(lastRunTime) : null,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatKnowledgeBase(entry: unknown) {
  const item = asBodyObject(entry) ?? {};
  const count = asBodyObject(item._count) ?? {};
  const aiAgent = asBodyObject(item.aiAgent);
  const content = optionalString(item.content) ?? "";
  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    title: item.title,
    status: item.status ?? "active",
    file_name: item.fileName ?? null,
    source_url: item.sourceUrl ?? null,
    content_preview: content.slice(0, 240),
    chunks_count: count.chunks ?? undefined,
    ai_agent: (aiAgent && Object.keys(aiAgent).length)
      ? {
          id: aiAgent.id,
          name: aiAgent.name,
          provider: aiAgent.aiProvider ?? null,
        }
      : null,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatCatalogProduct(product: unknown) {
  const item = asBodyObject(product) ?? {};
  const price = Number(item.price ?? 0);

  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    description: item.description ?? null,
    price: Number.isFinite(price) ? price : 0,
    currency: item.currency ?? "USD",
    image_url: item.imageUrl ?? null,
    sku: item.sku ?? null,
    status: item.status ?? "active",
    platform: item.platform ?? "manual",
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function maskSecret(value: unknown) {
  const raw = optionalString(value);
  if (!raw) return null;
  if (raw.length <= 8) return "*".repeat(raw.length);
  return `${raw.slice(0, 4)}${"*".repeat(Math.max(8, raw.length - 8))}${raw.slice(-4)}`;
}

export function formatDepartment(department: unknown) {
  const item = asBodyObject(department) ?? {};
  const count = asBodyObject(item._count) ?? {};
  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    description: item.description ?? null,
    users_count: count.users ?? 0,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatAgent(agent: unknown) {
  const item = asBodyObject(agent) ?? {};
  const department = asBodyObject(item.department) ?? {};
  const count = asBodyObject(item._count) ?? {};
  const latestDevice = asBodyObject(asArray(item.deviceSettings)[0]) ?? {};

  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name ?? null,
    email: item.email,
    role: item.role ?? "USER",
    status: item.status ?? "PENDING",
    phone_number: item.phoneNumber ?? null,
    permissions: item.permissions ?? {},
    onboarding_completed: item.onboardingCompleted ?? false,
    department: Object.keys(department).length ? formatDepartment(department) : null,
    assigned_contacts_count: count.assignedContacts ?? undefined,
    sent_messages_count: count.sentMessages ?? undefined,
    latest_device: Object.keys(latestDevice).length
      ? {
          id: latestDevice.id,
          device_id: latestDevice.deviceId,
          device_name: latestDevice.deviceName ?? null,
          notifications_enabled: latestDevice.notificationsEnabled ?? true,
          last_active_at: toEpoch(latestDevice.lastActiveAt),
          last_active_at_iso: toIso(latestDevice.lastActiveAt),
        }
      : null,
    last_login_at: toEpoch(item.lastLoginAt),
    last_login_at_iso: toIso(item.lastLoginAt),
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatTagRecord(tag: unknown) {
  const item = asBodyObject(tag) ?? {};
  const count = asBodyObject(item._count) ?? {};
  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    color: item.color ?? "#10B981",
    category: item.category ?? "General",
    contacts_count: count.contacts ?? undefined,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatActivityLog(log: unknown) {
  const item = asBodyObject(log) ?? {};
  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    user_id: item.userId ?? null,
    user_email: item.userEmail ?? null,
    user_name: item.userName ?? null,
    action: item.action,
    module: item.module,
    target: item.target ?? null,
    details: item.details ?? null,
    status: item.status ?? "success",
    is_read: item.isRead ?? false,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
  };
}

export function formatExternalWebhook(webhook: unknown, includeSecret = false) {
  const item = asBodyObject(webhook) ?? {};
  return {
    id: item.id,
    project_id: item.organizationId ?? null,
    name: item.name,
    target_url: item.targetUrl,
    events: asArray(item.events).map(String),
    is_active: item.isActive ?? true,
    secret_key: includeSecret ? item.secretKey ?? null : maskSecret(item.secretKey),
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatProject(project: unknown, activeProjectId?: string) {
  const item = asBodyObject(project) ?? {};
  const rawData = asBodyObject(item.whatsapp_onboarding_raw_data) ?? {};
  const phoneInfo = asBodyObject(rawData.phone_info || rawData.phone) ?? {};
  const rawQuality = optionalString(phoneInfo.quality_rating) || optionalString(item.quality_rating) || optionalString(item.qualityRating) || "GREEN";

  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    domain: item.domain ?? null,
    plan: item.plan ?? "free",
    status: item.status ?? "active",
    owner_id: item.ownerId ?? null,
    is_active_project: activeProjectId ? item.id === activeProjectId : undefined,
    whatsapp_number: item.whatsappNumber ?? null,
    whatsapp_business_id: item.whatsappBusinessId ?? null,
    whatsapp_phone_number_id: item.whatsappPhoneNumberId ?? null,
    quality_rating: rawQuality,
    qualityRating: rawQuality,
    facebook_page_id: item.facebookPageId ?? null,
    instagram_business_id: item.instagramBusinessId ?? null,
    shopify_connected: !!item.shopifyStoreUrl,
    woocommerce_connected: !!item.woocommerceStoreUrl,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatTemplate(t: any, projectId?: string | null, businessId?: string | null) {
  const item = asBodyObject(t) ?? (typeof t === "object" && t ? t : {});
  const components = Array.isArray(item.components) ? item.components : [];

  const bodyComp = components.find((c: any) => c.type === "BODY");
  const headerComp = components.find((c: any) => c.type === "HEADER");
  const footerComp = components.find((c: any) => c.type === "FOOTER");
  const buttonsComp = components.find((c: any) => c.type === "BUTTONS");
  const carouselComp = components.find((c: any) => c.type === "CAROUSEL");

  const createdAt = item.created_time
    ? new Date(item.created_time).getTime()
    : (item.created_at ? toEpoch(item.created_at) : null);

  const updatedAt = item.updated_time
    ? new Date(item.updated_time).getTime()
    : (item.updated_at ? toEpoch(item.updated_at) : null);

  return {
    id: item.id ?? null,
    name: item.name ?? "",
    label: item.name ?? "",
    status: item.status ?? "PENDING",
    category: item.category ?? "MARKETING",
    language: item.language ?? "en_US",
    type: "template",
    text: bodyComp?.text ?? null,
    sample_text: bodyComp?.example ?? null,
    header: headerComp ?? null,
    body: bodyComp ?? null,
    footer: footerComp ?? null,
    buttons: buttonsComp?.buttons ?? [],
    call_to_action: buttonsComp ? [buttonsComp] : [],
    carousel: carouselComp ?? null,
    message_action_type: item.category ?? "MARKETING",
    header_parameters: headerComp?.example ?? null,
    quality_score: item.quality_score ?? null,
    rejected_reason: item.rejected_reason ?? null,
    project_id: projectId ?? null,
    business_id: businessId ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    created_time: item.created_time ?? null,
    updated_time: item.updated_time ?? null,
    components: components,
  };
}

export function formatMediaLibraryItem(item: unknown) {
  const row = asBodyObject(item) ?? {};
  return {
    id: row.id,
    project_id: row.organizationId ?? null,
    name: row.name,
    url: row.url,
    type: row.type ?? "image",
    created_at: toEpoch(row.createdAt),
    created_at_iso: toIso(row.createdAt),
    updated_at: toEpoch(row.updatedAt),
    updated_at_iso: toIso(row.updatedAt),
  };
}


