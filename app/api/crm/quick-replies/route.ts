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

    const quickReplies = await prisma.quickReply.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: quickReplies.length,
      quickReplies,
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
    const { trigger, message } = body;

    const name = trigger;
    const content = message;

    if (!name || !content) {
      return NextResponse.json({ status: 400, error: "Trigger (name) and message (content) are required." }, { status: 400 });
    }

    const newQuickReply = await prisma.quickReply.create({
      data: {
        organizationId: org.id,
        name,
        content,
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Quick Reply created successfully",
      quickReply: newQuickReply,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const org = await authorize(req);
    if (!org) {
      return NextResponse.json({ status: 401, error: "Unauthorized or Invalid API Key." }, { status: 401 });
    }

    const body = await req.json();
    const { id, trigger, message } = body;

    if (!id) {
      return NextResponse.json({ status: 400, error: "Quick reply ID is required for update." }, { status: 400 });
    }

    const existing = await prisma.quickReply.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Quick reply not found in this organization." }, { status: 404 });
    }

    const updatedQuickReply = await prisma.quickReply.update({
      where: { id },
      data: {
        name: trigger !== undefined ? trigger : existing.name,
        content: message !== undefined ? message : existing.content,
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Quick Reply updated successfully",
      quickReply: updatedQuickReply,
    }, { status: 200 });
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
      return NextResponse.json({ status: 400, error: "Quick reply ID is required for deletion." }, { status: 400 });
    }

    const existing = await prisma.quickReply.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Quick reply not found." }, { status: 404 });
    }

    await prisma.quickReply.delete({
      where: { id },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Quick reply deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
