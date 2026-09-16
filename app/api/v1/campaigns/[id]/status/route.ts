import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const campaignId = resolvedParams.id;

    const msg = await prisma.scheduledMessage.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        sentCount: true,
        totalRecipients: true,
        lastSentToContactId: true,
        lastSentAt: true,
        nextSendAt: true,
        nextContactId: true,
        lockedAt: true,
        lastError: true,
        contactId: true,
        groupId: true,
        group: {
          select: {
            _count: {
              select: { contacts: true }
            }
          }
        }
      }
    });

    if (!msg) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const lastContact = msg.lastSentToContactId
      ? await prisma.contact.findUnique({
          where: { id: msg.lastSentToContactId },
          select: { name: true, waId: true }
        })
      : null;

    const nextContact = msg.nextContactId
      ? await prisma.contact.findUnique({
          where: { id: msg.nextContactId },
          select: { name: true, waId: true }
        })
      : null;

    const calculatedTotal = msg.totalRecipients || (msg.group?._count?.contacts ?? (msg.contactId ? 1 : 0));

    let executionDurationMs = 0;
    let formattedDuration = "0s";
    if (msg.lastSentAt) {
      const startTime = msg.lockedAt ? new Date(msg.lockedAt).getTime() : Date.now();
      const endTime = new Date(msg.lastSentAt).getTime();
      executionDurationMs = Math.max(0, endTime - startTime);
      const secs = Math.floor(executionDurationMs / 1000);
      const mins = Math.floor(secs / 60);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) formattedDuration = `${hrs}h ${mins % 60}m ${secs % 60}s`;
      else if (mins > 0) formattedDuration = `${mins}m ${secs % 60}s`;
      else formattedDuration = `${secs}s`;
    }

    return NextResponse.json({
      id: msg.id,
      status: msg.status,
      sentCount: msg.sentCount || 0,
      totalRecipients: calculatedTotal,
      lastSentTo: lastContact ? { name: lastContact.name || lastContact.waId, waId: lastContact.waId } : null,
      lastSentAt: msg.lastSentAt,
      nextSendAt: msg.nextSendAt,
      nextRecipient: nextContact ? { name: nextContact.name || nextContact.waId, waId: nextContact.waId } : null,
      lockedAt: msg.lockedAt,
      lastError: msg.lastError,
      executionDurationMs,
      formattedDuration,
    });
  } catch (error: any) {
    console.error("[CampaignStatusAPI] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch status" }, { status: 500 });
  }
}
