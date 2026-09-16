import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const messages = await prisma.scheduledMessage.findMany({
      where: { organizationId: org.id },
      orderBy: { scheduledAt: "asc" },
      take: 50,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: messages.length,
      scheduledMessages: messages,
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
    const { content, scheduledAt, platform } = body;

    if (!content || !scheduledAt) {
      return NextResponse.json({ status: 400, error: "content and scheduledAt are required." }, { status: 400 });
    }

    const newMessage = await prisma.scheduledMessage.create({
      data: {
        organizationId: org.id,
        content,
        scheduledAt: new Date(scheduledAt),
        platform: platform || "WHATSAPP",
        status: "PENDING",
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Message scheduled successfully",
      scheduledMessage: newMessage,
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
      return NextResponse.json({ status: 400, error: "Scheduled message ID is required for deletion." }, { status: 400 });
    }

    const existing = await prisma.scheduledMessage.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Scheduled message not found." }, { status: 404 });
    }

    await prisma.scheduledMessage.delete({
      where: { id },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Scheduled message canceled and deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
