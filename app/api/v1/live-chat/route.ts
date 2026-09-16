import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { getPusherServer, triggerPusherOrgEvent } from "@/lib/pusher";
import { sendUnifiedMessage } from "@/lib/messaging/api";
import { Platform, type Prisma } from "@/lib/generated/prisma";
import {
  clampLimit,
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

function normalizePlatform(value: unknown): Platform {
  const normalized = String(value || "WHATSAPP").toUpperCase();
  return Object.values(Platform).includes(normalized as Platform)
    ? normalized as Platform
    : Platform.WHATSAPP;
}

function buildMessageComponents(templateParams: unknown) {
  if (!Array.isArray(templateParams) || templateParams.length === 0) return undefined;
  return [
    {
      type: "body",
      parameters: templateParams.map((value) => ({
        type: "text",
        text: String(value),
      })),
    },
  ];
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const skip = (page - 1) * limit;

  const messageLimit = clampLimit(sp.get("message_limit") || sp.get("messages_limit"), 50, 1000); // reduced default minimum to 50 for realistic chat paging
  const messagePage = Math.max(1, parseInt(sp.get("message_page") || "1", 10));
  const messageSkip = (messagePage - 1) * messageLimit;

  const contactId = sp.get("contact_id") || sp.get("contactId");
  const mobileNumber = sp.get("mobile_number")
    || sp.get("phone_number")
    || sp.get("phone")
    || sp.get("destination")
    || sp.get("to");
  const waId = mobileNumber ? normalizeWaId(mobileNumber) : "";
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const platform = (sp.get("platform") || "").trim().toUpperCase();
  const tab = (sp.get("tab") || "").trim().toLowerCase();
  const requesterId = sp.get("requester_id");
  const requesterEmail = sp.get("requester_email");

  // Build the query using an array of AND conditions to avoid conflicts
  const andClauses: any[] = [
    { organizationId: org.id },
    { messages: { some: { type: { notIn: ["comment", "comment_reply"] } } } }
  ];

  if (platform && platform !== "ALL") {
    andClauses.push({ platform: normalizePlatform(platform) });
  }

  const tagIdsParam = sp.get("tag_ids") || sp.get("tag_id") || sp.get("tags");
  if (tagIdsParam) {
    const tagIds = tagIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (tagIds.length > 0) {
      andClauses.push({
        tags: {
          some: {
            OR: [
              { id: { in: tagIds } },
              { name: { in: tagIds, mode: "insensitive" } },
            ],
          },
        },
      });
    }
  }

  const agentIdsParam = sp.get("agent_ids") || sp.get("agent_id");
  if (agentIdsParam) {
    const agentIds = agentIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (agentIds.length > 0) {
      andClauses.push({
        OR: [
          { assignedAgentId: { in: agentIds } },
          { assignedUsers: { some: { id: { in: agentIds } } } },
        ],
      });
    }
  }

  const readStatusParam = (sp.get("read_status") || sp.get("readStatus") || "").trim().toLowerCase();
  if (readStatusParam === "unread") {
    andClauses.push({ unreadCount: { gt: 0 } });
  } else if (readStatusParam === "read") {
    andClauses.push({ unreadCount: 0 });
  }

  if (search) {
    const digitsOnly = search.replace(/\D/g, "");
    const searchOR: any[] = [
      { name: { contains: search, mode: "insensitive" } },
      { whatsappName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { waId: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
    if (digitsOnly) {
      searchOR.push({ waId: { contains: digitsOnly } });
    }
    andClauses.push({ OR: searchOR });
  }

  // Permission Logic
  let requester = null;
  if (requesterId) {
    requester = await prisma.user.findUnique({ where: { id: requesterId } });
  }
  if (!requester && requesterEmail) {
    requester = await prisma.user.findUnique({ where: { email: requesterEmail } });
  }

  if (requester) {
    const userPerms = (requester.permissions as Record<string, unknown>) || {};
    const chatAccess = userPerms.chat;
    if (chatAccess === 'none' || chatAccess === false) {
      return NextResponse.json({
        status: 403,
        success: false,
        error: "Access denied. You do not have permission to access Live Chat.",
        contacts: [],
        total: 0,
        unread_count: 0,
      });
    }

    const canViewAll = requester.role === 'SUPER_ADMIN' ||
      requester.role === 'ADMIN' ||
      userPerms.chat_super === true ||
      userPerms.view_all_chats === 'full' ||
      userPerms.view_all_chats === 'view';

    if (!canViewAll) {
      andClauses.push({
        OR: [
          { assignedAgentId: requester.id },
          { assignedUsers: { some: { id: requester.id } } },
        ],
      });
    }
  }

  const baseWhere = { AND: andClauses };

  const allWhere = { ...baseWhere };
  const unreadWhere = { 
    AND: [
      ...andClauses, 
      { unreadCount: { gt: 0 } }
    ] 
  };
  const targetAgentId = requester?.id || requesterId || '';
  const targetAgentEmail = requester?.email || requesterEmail || '';
  const myChatsWhere = { 
    AND: [
      ...andClauses, 
      { 
        OR: [
          ...(targetAgentId ? [{ assignedAgentId: targetAgentId }] : []),
          { 
            assignedUsers: { 
              some: { 
                OR: [
                  ...(targetAgentId ? [{ id: targetAgentId }] : []),
                  ...(targetAgentEmail ? [{ email: targetAgentEmail }] : [])
                ]
              } 
            } 
          }
        ]
      }
    ] 
  };
  const aiAgentWebhooks = await prisma.externalWebhook.findMany({
    where: { organizationId: org.id, isAiAgent: true },
    select: { id: true }
  });
  const aiWebhookIds = aiAgentWebhooks.map(w => w.id);

  const interventedWhere = { 
    AND: [
      ...andClauses,
      {
        OR: [
          { isAiBotEnabled: false },
          { isWebhookEnabled: false },
          ...(aiWebhookIds.length > 0 ? [{ disabledWebhookIds: { hasSome: aiWebhookIds } }] : [])
        ]
      }
    ]
  };
  const isQr = (org as any).whatsappConnectionMethod === 'qr';
  const aiWhere = { 
    AND: [
      ...andClauses,
      { isAiBotEnabled: true },
      { isWebhookEnabled: { not: false } },
      { organization: { isAiBotEnabled: true } },
      ...(aiWebhookIds.length > 0 ? [{ NOT: { disabledWebhookIds: { hasSome: aiWebhookIds } } }] : []),
      ...(isQr ? [] : [{ lastInboundMessageAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }])
    ]
  };

  let where = allWhere;
  if (tab === 'unread') {
    where = unreadWhere;
  } else if (tab === 'assigned') {
    where = myChatsWhere;
  } else if (tab === 'ai') {
    where = aiWhere;
  } else if (tab === 'intervented') {
    where = interventedWhere;
  }

  const messagesOnly = sp.get("messages_only") === "true";

  if (messagesOnly && (contactId || waId)) {
    try {
      const activeContact = await prisma.contact.findFirst({
        where: {
          organizationId: org.id,
          ...(contactId ? { id: contactId } : { waId }),
        },
        select: { id: true, name: true, waId: true, platform: true }
      });

      if (!activeContact) return apiError(404, "Contact not found.");

      const [conversationMessagesDesc, messagesTotal] = await Promise.all([
        prisma.message.findMany({
          where: {
            contactId: activeContact.id,
            type: { notIn: ["comment", "comment_reply"] },
          },
          orderBy: { createdAt: "desc" },
          take: messageLimit,
          skip: messageSkip,
          include: {
            contact: { select: { id: true, name: true, waId: true, platform: true } },
            sender: { select: { id: true, name: true, email: true } },
            replyTo: {
              select: {
                id: true,
                wamid: true,
                content: true,
                type: true,
                direction: true,
                mediaUrl: true,
                sender: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
        prisma.message.count({
          where: {
            contactId: activeContact.id,
            type: { notIn: ["comment", "comment_reply"] },
          },
        }),
      ]);

      const messages = [...conversationMessagesDesc].reverse().map(formatMobileMessage);

      return NextResponse.json({
        status: 200,
        success: true,
        project_id: org.id,
        messages,
        messages_total: messagesTotal,
        message_limit: messageLimit,
        messages_has_more: messagesTotal > messageSkip + messages.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load messages.";
      return NextResponse.json({ status: 500, error: message }, { status: 500 });
    }
  }

  try {
    const [contacts, total, tabCounts, selectedContact] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        take: limit,
        skip,
        include: {
          tags: true,
          groups: { include: { group: true } },
          assignedUsers: { select: { id: true, name: true, email: true } },
          assignedAgent: { select: { id: true, name: true, email: true } },
          aiAgent: true,
          messages: {
            where: { type: { notIn: ["comment", "comment_reply"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.contact.count({ where }),
      Promise.all([
        prisma.contact.count({ where: allWhere }),
        prisma.contact.count({ where: unreadWhere }),
        prisma.contact.count({ where: myChatsWhere }),
        prisma.contact.count({ where: aiWhere }),
      ]),
      contactId || waId
        ? prisma.contact.findFirst({
            where: {
              organizationId: org.id,
              ...(contactId ? { id: contactId } : { waId }),
            },
            include: {
              tags: true,
              groups: { include: { group: true } },
              assignedUsers: { select: { id: true, name: true, email: true } },
              assignedAgent: { select: { id: true, name: true, email: true } },
              aiAgent: true,
              _count: { select: { messages: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    if ((contactId || waId) && !selectedContact) return apiError(404, "Contact not found.");

    const activeContact = selectedContact ?? contacts[0] ?? null;
    const [conversationMessagesDesc, messagesTotal] = activeContact
      ? await Promise.all([
          prisma.message.findMany({
            where: {
              contactId: activeContact.id,
              type: { notIn: ["comment", "comment_reply"] },
            },
            orderBy: { createdAt: "desc" },
            take: messageLimit,
            skip: messageSkip,
            include: {
              contact: { select: { id: true, name: true, waId: true, platform: true } },
              sender: { select: { id: true, name: true, email: true } },
            },
          }),
          prisma.message.count({
            where: {
              contactId: activeContact.id,
              type: { notIn: ["comment", "comment_reply"] },
            },
          }),
        ])
      : [[], 0];
    const messages = [...conversationMessagesDesc].reverse().map(formatMobileMessage);
    const latestMessage = messages.length ? messages[messages.length - 1] : null;

    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      total,
      contacts_has_more: total > skip + contacts.length,
      tab_counts: {
        all: tabCounts[0],
        unread: tabCounts[1],
        assigned: tabCounts[2],
        ai: tabCounts[3],
      },
      contacts: contacts.map((contact) => {
        const contactLatestMessage = contact.messages[0]
          ? formatMobileMessage(contact.messages[0])
          : null;
        return {
          ...formatMobileContact(contact, org.id),
          latest_message: contactLatestMessage,
        };
      }),
      selected_contact: activeContact
        ? {
            ...formatMobileContact(activeContact, org.id),
            latest_message: latestMessage,
          }
        : null,
      latest_message: latestMessage,
      messages,
      messages_total: messagesTotal,
      message_limit: activeContact ? messageLimit : 0,
      messages_has_more: messagesTotal > messageSkip + messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load live chat data.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
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

  const textBody = asBodyObject(body.text);
  const contactId = optionalString(body.contact_id) || optionalString(body.contactId);
  const mobileNumber = optionalString(body.mobile_number)
    || optionalString(body.phone_number)
    || optionalString(body.phone)
    || optionalString(body.destination)
    || optionalString(body.to);
  const waId = mobileNumber ? normalizeWaId(mobileNumber) : undefined;
  const message = optionalString(body.message) || optionalString(textBody?.body);
  const templateName = optionalString(body.template_name) || optionalString(body.templateName);
  const messageLimit = clampLimit(
    body.message_limit ?? body.messages_limit ? String(body.message_limit ?? body.messages_limit) : null,
    500,
    1000
  );

  const mediaUrl = optionalString(body.media_url) || optionalString(body.mediaUrl);

  if (!contactId && !waId) return apiError(400, "Field 'mobile_number' is required.");
  if (!message && !templateName && !mediaUrl) return apiError(400, "Field 'message', 'template_name', or 'media_url' is required.");

  const contact = contactId
    ? await prisma.contact.findFirst({
        where: { id: contactId, organizationId: org.id },
      })
    : await prisma.contact.findFirst({
        where: {
          organizationId: org.id,
          platform: normalizePlatform(body.platform),
          waId,
        },
      });
  if (!contact) {
    return apiError(404, contactId ? "Contact not found." : "Contact not found for mobile_number.");
  }

  const senderId = optionalString(body.sender_id) || optionalString(body.senderId);
  if (senderId) {
    const sender = await prisma.user.findFirst({ where: { id: senderId } });
    if (!sender) {
      return apiError(400, "Invalid sender_id: User not found.");
    }
    const senderPerms = (sender.permissions as Record<string, unknown>) || {};
    if (senderPerms.chat === 'none' || senderPerms.chat === false || senderPerms.chat === 'view') {
      return apiError(403, "Permission denied: You do not have permission to send messages in Live Chat.");
    }
  }

  try {
    const rawContentType = optionalString(body.content_type) || optionalString(body.contentType);
    const isAudioType = rawContentType === 'audio' || rawContentType === 'voice';
    const textToSend = isAudioType ? "" : (typeof message === "string" ? message : (templateName ? `Template: ${templateName}` : ""));

    const rawMediaUrls = Array.isArray(body.media_urls) ? body.media_urls : (Array.isArray(body.mediaUrls) ? body.mediaUrls : null);
    let mediaUrlsList: string[] = [];
    if (rawMediaUrls) {
      mediaUrlsList = rawMediaUrls.map(String).filter(Boolean);
    } else {
      const singleMediaUrl = (optionalString(body.media_url) || optionalString(body.mediaUrl) || '').trim();
      if (singleMediaUrl.startsWith('[') && singleMediaUrl.endsWith(']')) {
        try {
          const parsed = JSON.parse(singleMediaUrl);
          if (Array.isArray(parsed)) mediaUrlsList = parsed.map(String).filter(Boolean);
        } catch {}
      }
      if (mediaUrlsList.length === 0 && singleMediaUrl) {
        mediaUrlsList = [singleMediaUrl];
      }
    }

    const rawFileName = optionalString(body.file_name) || optionalString(body.fileName);
    const rawMimeType = optionalString(body.mimetype) || optionalString(body.mime_type);

    let sentMessage;
    if (mediaUrlsList.length > 1) {
      for (let i = 0; i < mediaUrlsList.length; i++) {
        const u = mediaUrlsList[i];
        const isFirst = i === 0;
        const msgToSend = isFirst ? textToSend : "";
        sentMessage = await sendUnifiedMessage({
          contactId: contact.id,
          message: msgToSend,
          mediaUrl: u,
          contentType: rawContentType,
          fileName: isFirst ? rawFileName : undefined,
          mimetype: isFirst ? rawMimeType : undefined,
          templateName: isFirst ? templateName : undefined,
          templateLanguage: optionalString(body.language) || optionalString(body.template_language) || "en",
          templateComponents: isFirst ? (Array.isArray(body.components) ? body.components : buildMessageComponents(body.template_params)) : undefined,
          skipWindowCheck: Boolean(body.skip_window_check),
          senderId: optionalString(body.sender_id) || optionalString(body.senderId),
          replyToMessageId: isFirst ? (optionalString(body.reply_to_message_id) || optionalString(body.replyToMessageId) || optionalString(body.context_message_id) || optionalString(body.contextMessageId)) : undefined,
          replyToWaId: isFirst ? (optionalString(body.reply_to_wa_id) || optionalString(body.replyToWaId)) : undefined,
        });
        if (i < mediaUrlsList.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } else {
      sentMessage = await sendUnifiedMessage({
        contactId: contact.id,
        message: textToSend,
        mediaUrl: mediaUrlsList[0] || optionalString(body.media_url) || optionalString(body.mediaUrl),
        contentType: rawContentType,
        fileName: rawFileName,
        mimetype: rawMimeType,
        templateName,
        templateLanguage: optionalString(body.language) || optionalString(body.template_language) || "en",
        templateComponents: Array.isArray(body.components) ? body.components : buildMessageComponents(body.template_params),
        skipWindowCheck: Boolean(body.skip_window_check),
        senderId: optionalString(body.sender_id) || optionalString(body.senderId),
        replyToMessageId: optionalString(body.reply_to_message_id) || optionalString(body.replyToMessageId) || optionalString(body.context_message_id) || optionalString(body.contextMessageId),
        replyToWaId: optionalString(body.reply_to_wa_id) || optionalString(body.replyToWaId),
      });
    }
    const [conversationMessagesDesc, messagesTotal, refreshedContact] = await Promise.all([
      prisma.message.findMany({
        where: {
          contactId: contact.id,
          type: { notIn: ["comment", "comment_reply"] },
        },
        orderBy: { createdAt: "desc" },
        take: messageLimit,
        include: {
          contact: { select: { id: true, name: true, waId: true, platform: true } },
          sender: { select: { id: true, name: true, email: true } },
          replyTo: {
            select: {
              id: true,
              wamid: true,
              content: true,
              type: true,
              direction: true,
              mediaUrl: true,
              sender: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.message.count({
        where: {
          contactId: contact.id,
          type: { notIn: ["comment", "comment_reply"] },
        },
      }),
      prisma.contact.findFirst({
        where: { id: contact.id, organizationId: org.id },
        include: {
          tags: true,
          groups: { include: { group: true } },
          assignedUsers: { select: { id: true, name: true, email: true } },
          aiAgent: true,
          _count: { select: { messages: true } },
        },
      }),
    ]);
    const messages = [...conversationMessagesDesc].reverse().map(formatMobileMessage);
    const latestMessage = messages.length ? messages[messages.length - 1] : null;

    const formattedMsg = formatMobileMessage(sentMessage);
    await triggerPusherOrgEvent(org.id, 'message:outbound', {
      ...formattedMsg,
      contactId: contact.id,
      contact_id: contact.id,
      contactNumber: contact.waId,
      waId: contact.waId,
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: formatMobileMessage(sentMessage),
      selected_contact: refreshedContact
        ? {
            ...formatMobileContact(refreshedContact, org.id),
            latest_message: latestMessage,
          }
        : null,
      latest_message: latestMessage,
      messages,
      messages_total: messagesTotal,
      message_limit: messageLimit,
      messages_has_more: messagesTotal > messages.length,
    }, { status: 201 });
  } catch (error) {
    console.error("[LiveChat POST Error]:", error);
    const messageText = error instanceof Error ? error.message : "Failed to send live chat message.";
    return NextResponse.json({ status: 422, error: messageText }, { status: 422 });
  }
}
