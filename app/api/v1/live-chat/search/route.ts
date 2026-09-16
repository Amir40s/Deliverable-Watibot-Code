import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { Platform, type Prisma } from "@/lib/generated/prisma";
import {
  clampLimit,
  formatMobileContact,
  formatMobileMessage,
  normalizeWaId,
} from "@/lib/api/mobile-formatters";

function normalizePlatform(value: unknown): Platform {
  const normalized = String(value || "WHATSAPP").toUpperCase();
  return Object.values(Platform).includes(normalized as Platform)
    ? normalized as Platform
    : Platform.WHATSAPP;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || sp.get("contact") || sp.get("search") || "").trim();
  const mobileNumber = sp.get("mobile_number")
    || sp.get("phone_number")
    || sp.get("phone")
    || sp.get("destination")
    || sp.get("to")
    || "";
  const platform = (sp.get("platform") || "").trim().toUpperCase();
  const limit = clampLimit(sp.get("limit"), 25, 100);
  const messageLimit = clampLimit(sp.get("message_limit") || sp.get("messages_limit"), 500, 1000);

  const where: Prisma.ContactWhereInput = { organizationId: org.id };

  if (platform && platform !== "ALL") {
    where.platform = normalizePlatform(platform);
  }

  if (mobileNumber) {
    where.waId = { contains: normalizeWaId(mobileNumber) };
  } else if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { whatsappName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { waId: { contains: q.replace(/\D/g, "") || q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: limit,
      include: {
        tags: true,
        groups: { include: { group: true } },
        assignedUsers: { select: { id: true, name: true, email: true } },
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
    });
    const selectedContact = contacts[0] ?? null;
    const [conversationMessagesDesc, messagesTotal] = selectedContact
      ? await Promise.all([
          prisma.message.findMany({
            where: {
              contactId: selectedContact.id,
              type: { notIn: ["comment", "comment_reply"] },
            },
            orderBy: { createdAt: "desc" },
            take: messageLimit,
            include: {
              contact: { select: { id: true, name: true, waId: true, platform: true } },
              sender: { select: { id: true, name: true, email: true } },
            },
          }),
          prisma.message.count({
            where: {
              contactId: selectedContact.id,
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
      query: q || mobileNumber || null,
      total: contacts.length,
      contacts: contacts.map((contact) => {
        const contactLatestMessage = contact.messages[0]
          ? formatMobileMessage(contact.messages[0])
          : null;
        return {
          ...formatMobileContact(contact, org.id),
          latest_message: contactLatestMessage,
        };
      }),
      selected_contact: selectedContact
        ? {
            ...formatMobileContact(selectedContact, org.id),
            latest_message: latestMessage,
          }
        : null,
      latest_message: latestMessage,
      messages,
      messages_total: messagesTotal,
      message_limit: selectedContact ? messageLimit : 0,
      messages_has_more: messagesTotal > messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search live chat contacts.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
