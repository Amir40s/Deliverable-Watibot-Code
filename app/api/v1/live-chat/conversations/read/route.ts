import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { getPusherServer, triggerPusherOrgEvent } from "@/lib/pusher";

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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

  const contactId = typeof body.contact_id === 'string' ? body.contact_id : typeof body.contactId === 'string' ? body.contactId : null;

  if (!contactId) {
    return apiError(400, "Field 'contact_id' is required.");
  }

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: org.id },
      include: { organization: true }
    });

    if (!contact) {
      return apiError(404, "Contact not found.");
    }

    const isUnread = body.unread === true || body.unread === 'true' || body.status === 'unread';
    const targetUnreadCount = isUnread ? 1 : 0;

    // 1. Update unread count locally
    await prisma.contact.update({
      where: { id: contact.id },
      data: { unreadCount: targetUnreadCount }
    });

    if (!isUnread) {
      // 2. Mark local messages as read
      await prisma.message.updateMany({
        where: {
          contactId: contact.id,
          direction: 'inbound',
          status: { not: 'read' }
        },
        data: { status: 'read' }
      });
    }

    // 3. Inform Meta that messages are read
    // Find the latest message wamid to mark as read
    const lastMessage = await prisma.message.findFirst({
      where: {
        contactId: contact.id,
        direction: 'inbound',
        wamid: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (
      contact.platform === 'WHATSAPP' &&
      lastMessage?.wamid &&
      contact.organization.metaAccessToken &&
      contact.organization.whatsappPhoneNumberId
    ) {
      const url = `https://graph.facebook.com/v19.0/${contact.organization.whatsappPhoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: lastMessage.wamid
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${contact.organization.metaAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const data = await res.json();
          console.error('[MarkRead API] Meta API Error:', data);
        }
      } catch (e) {
        console.error('[MarkRead API] Failed to notify Meta:', e);
      }
    }

    // Trigger Pusher event so Web CRM & Mobile App instantly update read/unread state
    await triggerPusherOrgEvent(org.id, isUnread ? 'contact:unread' : 'contact:read', { 
      contactId: contact.id, 
      contact_id: contact.id,
      waId: contact.waId,
      unreadCount: targetUnreadCount,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: isUnread ? "Chat marked as unread successfully" : "Chat marked as read successfully"
    }, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark chat as read.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
