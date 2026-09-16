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

    const messages = await prisma.message.findMany({
      where: { contact: { organizationId: org.id }, platform: "FACEBOOK" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      platform: "FACEBOOK",
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
    const { contactId, content } = body;

    if (!contactId || !content) {
      return NextResponse.json({ status: 400, error: "contactId and content are required." }, { status: 400 });
    }

    const newMessage = await prisma.message.create({
      data: {
        contactId,
        content,
        type: "text",
        platform: "FACEBOOK",
        direction: "OUTGOING",
        status: "SENT",
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      chatMessage: newMessage,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
