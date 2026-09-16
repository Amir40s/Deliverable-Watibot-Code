import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import {
  clampLimit,
  formatMobileContact,
  formatMobileMessage,
  normalizeWaId,
} from "@/lib/api/mobile-formatters";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function getHistoryWindowMeta(lastInboundMessageAt: Date | string | null | undefined) {
  if (!lastInboundMessageAt) {
    return {
      is_window_expired: true,
      window_status: "closed",
      hours_since_last_inbound: null,
    };
  }

  const lastInboundTime = new Date(lastInboundMessageAt).getTime();
  if (Number.isNaN(lastInboundTime)) {
    return {
      is_window_expired: true,
      window_status: "closed",
      hours_since_last_inbound: null,
    };
  }

  const hoursSinceLastInbound = Math.floor((Date.now() - lastInboundTime) / (60 * 60 * 1000));

  return {
    is_window_expired: Date.now() - lastInboundTime >= TWENTY_FOUR_HOURS_MS,
    window_status: Date.now() - lastInboundTime >= TWENTY_FOUR_HOURS_MS ? "expired" : "open",
    hours_since_last_inbound: hoursSinceLastInbound,
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 100, 200);
  const messageLimit = clampLimit(sp.get("message_limit") || sp.get("messages_limit"), 500, 1000);
  const contactId = sp.get("contact_id") || sp.get("contactId");
  const mobileNumber = sp.get("mobile_number")
    || sp.get("phone_number")
    || sp.get("phone")
    || sp.get("destination")
    || sp.get("to");
  const waId = mobileNumber ? normalizeWaId(mobileNumber) : "";
  const direction = (sp.get("direction") || "").trim().toLowerCase();
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const expiredBefore = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  const expiredConversationFilter: Prisma.ContactWhereInput = {
    OR: [
      { lastInboundMessageAt: null },
      { lastInboundMessageAt: { lt: expiredBefore } },
    ],
  };

  const contactWhere: Prisma.ContactWhereInput = {
    organizationId: org.id,
    messages: { some: { type: { notIn: ["comment", "comment_reply"] } } },
    AND: [expiredConversationFilter],
  };

  if (search) {
    contactWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { whatsappName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { waId: { contains: search.replace(/\D/g, "") || search } },
      { email: { contains: search, mode: "insensitive" } },
      { lastMessage: { contains: search, mode: "insensitive" } },
    ];
  }

  if (waId) {
    contactWhere.waId = { contains: waId };
  }

  if (contactId) {
    contactWhere.id = contactId;
  }

  const historyMessageWhere: Prisma.MessageWhereInput = {
    contact: contactWhere,
    type: { notIn: ["comment", "comment_reply"] },
    ...(direction === "inbound" || direction === "outbound" ? { direction } : {}),
  };

  try {
    const [conversations, totalConversations, totalHistoryMessages] = await Promise.all([
      prisma.contact.findMany({
        where: contactWhere,
        orderBy: { lastMessageAt: "desc" },
        take: limit,
        include: {
          tags: true,
          groups: { include: { group: true } },
          assignedUsers: { select: { id: true, name: true, email: true } },
          aiAgent: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.contact.count({ where: contactWhere }),
      prisma.message.count({ where: historyMessageWhere }),
    ]);
    const selectedContact = conversations[0] ?? null;
    const selectedMessageWhere: Prisma.MessageWhereInput = {
      contactId: selectedContact?.id,
      type: { notIn: ["comment", "comment_reply"] },
      ...(direction === "inbound" || direction === "outbound" ? { direction } : {}),
    };
    const [conversationMessagesDesc, messagesTotal] = selectedContact
      ? await Promise.all([
          prisma.message.findMany({
            where: selectedMessageWhere,
            orderBy: { createdAt: "desc" },
            take: messageLimit,
            include: {
              contact: { select: { id: true, name: true, waId: true, platform: true } },
              sender: { select: { id: true, name: true, email: true } },
            },
          }),
          prisma.message.count({ where: selectedMessageWhere }),
        ])
      : [[], 0];
    const messages = [...conversationMessagesDesc].reverse().map(formatMobileMessage);
    const latestMessage = messages.length ? messages[messages.length - 1] : null;
    const formattedConversations = conversations.map((contact) => ({
      ...formatMobileContact(contact, org.id),
      ...getHistoryWindowMeta(contact.lastInboundMessageAt),
    }));
    const selectedConversation = selectedContact
      ? {
          ...formatMobileContact(selectedContact, org.id),
          ...getHistoryWindowMeta(selectedContact.lastInboundMessageAt),
          latest_message: latestMessage,
        }
      : null;

    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      history_filter: {
        type: "expired_or_closed",
        older_than_hours: 24,
        expired_before: expiredBefore.toISOString(),
      },
      total_conversations: totalConversations,
      total_history_messages: totalHistoryMessages,
      total_messages: messagesTotal,
      conversations: formattedConversations,
      selected_contact: selectedConversation,
      latest_message: latestMessage,
      messages,
      messages_total: messagesTotal,
      message_limit: selectedContact ? messageLimit : 0,
      messages_has_more: messagesTotal > messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history data.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
