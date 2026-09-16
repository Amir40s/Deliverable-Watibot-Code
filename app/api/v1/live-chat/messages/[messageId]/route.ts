import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherOrgEvent } from "@/lib/pusher";

import { recalculateContactLastMessage } from "@/lib/chat/recalculateLastMessage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  let orgId: string | null = null;

  // 1. Try NextAuth session (for Web CRM browser requests)
  const session = await getServerSession(authOptions);
  if (session?.user?.organizationId) {
    orgId = session.user.organizationId;
  } else {
    // 2. Try Project API Key / Token header auth (for Mobile App requests)
    const auth = await authenticateProjectKey(req);
    if (auth.org) {
      orgId = auth.org.id;
    }
  }

  if (!orgId) {
    return apiError(401, "Unauthorized authentication header missing.");
  }

  try {
    // 1. Find existing message in this org
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        contact: { organizationId: orgId },
      },
      include: { contact: true },
    });

    if (!message) {
      return apiError(404, "Message not found.");
    }

    const contactId = message.contactId;

    // 2. Delete message from CRM database ONLY (DO NOT call Meta API)
    await prisma.message.delete({
      where: { id: message.id },
    });

    // 3. Recalculate and update contact's lastMessage and lastMessageAt with the remaining latest non-internal message
    const { lastMessage, lastMessageAt, latestRemainingMessage } = await recalculateContactLastMessage(contactId);

    // 4. Log activity for audit log
    try {
      const { logActivity } = await import('@/lib/activityLog');
      await logActivity({
        organizationId: orgId,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
        userName: session?.user?.name || 'Agent',
        action: 'Delete Message',
        module: 'Live Chat',
        target: message.content || `[${message.type}]`,
        details: `Deleted message from contact ${message.contact?.name || message.contact?.waId}`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[Delete Message API] Failed to log activity:', e);
    }

    // 5. Broadcast real-time Pusher event to Web CRM and Flutter App
    await triggerPusherOrgEvent(orgId, 'message:delete', {
      messageId: message.id,
      contactId: contactId,
      lastMessage: lastMessage,
      lastMessageAt: lastMessageAt.toISOString(),
      newLatestMessage: latestRemainingMessage ? {
        id: latestRemainingMessage.id,
        content: lastMessage,
        type: latestRemainingMessage.type,
        direction: latestRemainingMessage.direction,
        created_at_iso: latestRemainingMessage.createdAt.toISOString(),
      } : null,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      deleted: true,
      messageId: message.id,
      contactId: contactId,
    }, { status: 200 });

  } catch (error) {
    console.error('[Delete Message API] Error:', error);
    return apiError(500, "Failed to delete message.");
  }
}
