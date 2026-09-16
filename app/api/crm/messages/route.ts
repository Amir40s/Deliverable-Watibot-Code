import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { recalculateContactLastMessage } from "@/lib/chat/recalculateLastMessage";

async function authorize(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  let apiKey = searchParams.get("apiKey") || searchParams.get("token");

  if (!apiKey) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.substring(7);
    } else {
      apiKey = req.headers.get("X-WatiBot-Project-API-Key") || "";
    }
  }

  if (!apiKey) return null;

  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, businessDescription: true },
  });

  const org = organizations.find((o) => {
    try {
      const data = JSON.parse(o.businessDescription || "{}");
      return data.projectApiKey === apiKey || data.campaignApiKey === apiKey;
    } catch {
      return false;
    }
  });

  return org || null;
}

export async function GET(req: NextRequest) {
  try {
    const org = await authorize(req);
    if (!org) {
      return NextResponse.json({ status: 401, error: "Unauthorized or Invalid API Key." }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const contactId = searchParams.get("contactId");
    const whereClause: any = { contact: { organizationId: org.id } };
    if (contactId) {
      whereClause.contactId = contactId;
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        direction: true,
        status: true,
        content: true,
        createdAt: true,
        platform: true,
        contact: {
          select: {
            id: true,
            name: true,
            waId: true,
          },
        },
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: messages.length,
      messages,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const org = await authorize(req);
    if (!org) {
      return NextResponse.json({ status: 401, error: "Unauthorized or Invalid API Key." }, { status: 401 });
    }

    const body = await req.json();
    const { contactId, content, direction, platform, type } = body;

    if (!contactId || !content) {
      return NextResponse.json({ status: 400, error: "contactId and content are required." }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: org.id },
    });

    if (!contact) {
      return NextResponse.json({ status: 404, error: "Associated contact not found under this organization." }, { status: 404 });
    }

    const newMessage = await prisma.message.create({
      data: {
        contactId,
        content,
        direction: direction || "OUTGOING",
        platform: platform || contact.platform,
        type: type || "text",
        status: "SENT",
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Message logged successfully",
      chatMessage: newMessage,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const org = await authorize(req);
    if (!org) {
      return NextResponse.json({ status: 401, error: "Unauthorized or Invalid API Key." }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ status: 400, error: "Message ID is required for deletion." }, { status: 400 });
    }

    const existing = await prisma.message.findFirst({
      where: { id, contact: { organizationId: org.id } },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Message not found." }, { status: 404 });
    }

    const contactId = existing.contactId;

    await prisma.message.delete({
      where: { id },
    });

    await recalculateContactLastMessage(contactId);

    try {
      const session = await getServerSession(authOptions);
      const user = session?.user;
      const { logActivity } = await import('@/lib/activityLog');
      await logActivity({
        organizationId: org.id,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userName: user?.name || 'Agent',
        action: 'Delete Message',
        module: 'Live Chat',
        target: existing.content || `[${existing.type}]`,
        details: `Deleted message from contact`,
        status: 'success'
      });
    } catch (e) {
      console.warn('[CRM Delete Message] Failed to log activity:', e);
    }

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Message deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
