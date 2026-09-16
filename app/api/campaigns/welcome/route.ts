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

    const messages = await prisma.welcomeMessage.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: messages.length,
      welcomeMessages: messages,
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
    const { name, content, platform } = body;

    if (!name || !content) {
      return NextResponse.json({ status: 400, error: "name and content are required." }, { status: 400 });
    }

    const newMessage = await prisma.welcomeMessage.create({
      data: {
        organizationId: org.id,
        name,
        content,
        platform: platform || "ALL",
        isActive: true,
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Welcome message trigger created successfully",
      welcomeMessage: newMessage,
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
    const { id, name, content, isActive } = body;

    if (!id) {
      return NextResponse.json({ status: 400, error: "ID is required for update." }, { status: 400 });
    }

    const existing = await prisma.welcomeMessage.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Welcome message not found." }, { status: 404 });
    }

    const updated = await prisma.welcomeMessage.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        content: content !== undefined ? content : existing.content,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Welcome message updated successfully",
      welcomeMessage: updated,
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
      return NextResponse.json({ status: 400, error: "ID is required for deletion." }, { status: 400 });
    }

    const existing = await prisma.welcomeMessage.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Welcome message not found." }, { status: 404 });
    }

    await prisma.welcomeMessage.delete({
      where: { id },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Welcome message deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
