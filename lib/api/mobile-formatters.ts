type ApiObject = Record<string, unknown>;

function asObject(value: unknown): ApiObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiObject : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function toEpoch(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

export function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeMobileNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[^\d+]/g, "");
  const withPlus = compact.startsWith("+") ? compact : `+${compact}`;
  return withPlus.replace(/(?!^)\+/g, "");
}

export function normalizeWaId(value: unknown) {
  return normalizeMobileNumber(value).replace("+", "");
}

export function clampLimit(value: string | null, fallback = 50, max = 100) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function formatMobileMessage(message: unknown) {
  const item = asObject(message);
  const contact = asObject(item.contact);
  const sender = asObject(item.sender);
  const replyTo = asObject(item.replyTo);
  const rawBody = asObject(item.rawBody);
  const isVoice = item.type === 'voice' || 
                  rawBody.voice === true || 
                  rawBody.isVoice === true || 
                  (rawBody.audio as ApiObject)?.voice === true ||
                  (rawBody.body as ApiObject)?.voice === true;

  let replyToId = (item.replyToId as string) || (item.reply_to_id as string) || (replyTo.id as string) || null;
  let replyToWaId = (item.replyToWaId as string) || (item.reply_to_wa_id as string) || (replyTo.wamid as string) || null;
  let replyPreview = (item.replyPreview as string) || (item.reply_preview as string) || (replyTo.content as string) || null;
  let replySenderName = (item.replySenderName as string) || (item.reply_sender_name as string) || null;
  let replyMessageType = (item.replyMessageType as string) || (item.reply_message_type as string) || (replyTo.type as string) || null;

  if (replyTo && Object.keys(replyTo).length > 0) {
    if (!replySenderName) {
      const repSender = asObject(replyTo.sender);
      replySenderName = (repSender.name as string) || (replyTo.direction === 'outbound' ? 'You' : (contact.name as string) || 'Customer');
    }
    if (!replyPreview && replyTo.content) {
      replyPreview = replyTo.content as string;
    }
    if (!replyMessageType && replyTo.type) {
      replyMessageType = replyTo.type as string;
    }
  }

  // Fallback: If replyPreview or replyToWaId is missing, check rawBody (Baileys contextInfo or Meta context)
  if (!replyPreview || !replyToWaId) {
    // 1. Meta context
    const metaContext = (rawBody.context || rawBody.context_info) as ApiObject;
    if (metaContext) {
      if (!replyToWaId && metaContext.id) {
        replyToWaId = metaContext.id as string;
      }
    }

    // 2. Baileys contextInfo
    const baileysMsg = (rawBody.message || rawBody) as ApiObject;
    const ctx = (
      (baileysMsg?.extendedTextMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.imageMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.videoMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.audioMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.documentMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.stickerMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.buttonsResponseMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.templateButtonReplyMessage as ApiObject)?.contextInfo ||
      (baileysMsg?.listResponseMessage as ApiObject)?.contextInfo ||
      baileysMsg?.contextInfo
    ) as ApiObject;

    if (ctx) {
      if (!replyToWaId && ctx.stanzaId) {
        replyToWaId = ctx.stanzaId as string;
      }
      const qm = ctx.quotedMessage as ApiObject;
      if (qm && !replyPreview) {
        if (qm.conversation || (qm.extendedTextMessage as ApiObject)?.text) {
          replyPreview = ((qm.conversation || (qm.extendedTextMessage as ApiObject)?.text) as string) || null;
          replyMessageType = replyMessageType || 'text';
        } else if (qm.imageMessage) {
          replyPreview = ((qm.imageMessage as ApiObject)?.caption as string) || 'Photo';
          replyMessageType = replyMessageType || 'image';
        } else if (qm.videoMessage) {
          replyPreview = ((qm.videoMessage as ApiObject)?.caption as string) || 'Video';
          replyMessageType = replyMessageType || 'video';
        } else if (qm.audioMessage) {
          replyPreview = 'Voice message';
          replyMessageType = replyMessageType || 'voice';
        } else if (qm.documentMessage) {
          replyPreview = ((qm.documentMessage as ApiObject)?.fileName as string) || 'Document';
          replyMessageType = replyMessageType || 'document';
        } else if (qm.stickerMessage) {
          replyPreview = 'Sticker';
          replyMessageType = replyMessageType || 'sticker';
        }
      }
      if (!replySenderName && ctx.participant) {
        const participantStr = ctx.participant as string;
        const partDigits = participantStr.replace(/\D/g, '');
        const contactDigits = ((contact.phone_number || contact.waId) as string || '').replace(/\D/g, '');
        if (contactDigits && partDigits === contactDigits) {
          replySenderName = (contact.name as string) || `+${contactDigits}`;
        } else {
          replySenderName = 'You';
        }
      }
    }
  }

  const replyToMessageObj = replyTo && Object.keys(replyTo).length > 0 ? {
    id: replyTo.id ?? replyToId,
    wamid: replyTo.wamid ?? replyToWaId,
    content: replyTo.content ?? replyPreview,
    type: replyTo.type ?? replyMessageType ?? 'text',
    direction: replyTo.direction ?? 'inbound',
    sender_name: replySenderName,
    media_url: replyTo.mediaUrl ?? null,
  } : null;

  return {
    id: item.id,
    wamid: item.wamid ?? null,
    contact_id: item.contactId,
    type: item.type,
    direction: item.direction,
    status: item.status,
    content: item.content ?? null,
    media_url: item.mediaUrl ?? null,
    is_voice: isVoice,
    platform: item.platform ?? contact.platform ?? "WHATSAPP",
    sender: Object.keys(sender).length
      ? {
          id: sender.id,
          name: sender.name ?? null,
          email: sender.email ?? null,
        }
      : null,
    contact: Object.keys(contact).length
      ? {
          id: contact.id,
          name: contact.name ?? null,
          phone_number: contact.waId ?? null,
          platform: contact.platform ?? "WHATSAPP",
        }
      : null,
    raw_body: item.rawBody ?? null,
    reply_to_id: replyToId,
    reply_to_wa_id: replyToWaId,
    reply_preview: replyPreview,
    reply_sender_name: replySenderName,
    reply_message_type: replyMessageType,
    reply_to_message: replyToMessageObj,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

export function formatMobileContact(contact: unknown, organizationId?: string) {
  const item = asObject(contact);
  const count = asObject(item._count);
  const aiAgent = asObject(item.aiAgent);

  return {
    id: item.id,
    project_id: organizationId ?? item.organizationId ?? null,
    business_id: organizationId ?? item.organizationId ?? null,
    name: item.name ?? null,
    first_name: item.firstName ?? null,
    last_name: item.lastName ?? null,
    email: item.email ?? null,
    phone_number: item.waId ?? null,
    wa_id: item.waId ?? null,
    platform: item.platform ?? "WHATSAPP",
    profile_pic: item.profilePic ?? null,
    notes: item.notes ?? null,
    attributes: item.customAttributes ?? {},
    is_blocked: item.isBlocked ?? false,
    is_ai_bot_enabled: item.isAiBotEnabled ?? true,
    is_webhook_enabled: item.isWebhookEnabled ?? true,
    disabled_webhook_ids: Array.isArray(item.disabledWebhookIds) ? item.disabledWebhookIds : [],
    is_org_ai_enabled: (item.organization as ApiObject)?.isAiBotEnabled ?? true,
    is_handled_by_ai: (item.isAiBotEnabled ?? true) && (item.isWebhookEnabled ?? true) && ((item.organization as ApiObject)?.isAiBotEnabled !== false),
    unread_count: item.unreadCount ?? 0,
    last_message: item.lastMessage ?? null,
    last_message_at: toEpoch(item.lastMessageAt),
    last_message_at_iso: toIso(item.lastMessageAt),
    last_inbound_message_at: toEpoch(item.lastInboundMessageAt),
    last_inbound_message_at_iso: toIso(item.lastInboundMessageAt),
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
    tags: asArray(item.tags).map((tag) => {
      const tagObject = asObject(tag);
      return {
        id: tagObject.id,
        name: tagObject.name,
        color: tagObject.color ?? null,
        category: tagObject.category ?? null,
      };
    }),
    groups: asArray(item.groups).map((member) => {
      const memberObject = asObject(member);
      const group = asObject(memberObject.group ?? member);
      return {
        id: group.id,
        name: group.name,
        color: group.color ?? null,
      };
    }),
    assigned_users: asArray(item.assignedUsers).map((user) => {
      const userObject = asObject(user);
      return {
        id: userObject.id,
        name: userObject.name ?? null,
        email: userObject.email ?? null,
      };
    }),
    assigned_agent_id: (item.assignedAgentId as string) ?? null,
    assigned_agent: ((item.assignedAgent as ApiObject)?.name as string) ?? ((item.assignedAgent as ApiObject)?.email as string) ?? (asArray(item.assignedUsers)[0] ? (((asObject(asArray(item.assignedUsers)[0]).name as string) || (asObject(asArray(item.assignedUsers)[0]).email as string)) ?? null) : null),
    assigned_user_ids: Array.from(new Set([
      ...((item.assignedAgentId as string) ? [item.assignedAgentId as string] : []),
      ...asArray(item.assignedUsers).map((u) => asObject(u).id as string).filter(Boolean)
    ])),
    ai_agent: Object.keys(aiAgent).length
      ? {
          id: aiAgent.id,
          name: aiAgent.name,
          provider: aiAgent.aiProvider ?? null,
          is_default: aiAgent.isDefault ?? false,
        }
      : null,
    message_count: count.messages ?? undefined,
  };
}
