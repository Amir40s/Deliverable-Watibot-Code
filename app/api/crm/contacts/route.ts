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

    const { searchParams } = req.nextUrl;
    const platform = searchParams.get("platform");
    const whereClause: any = { organizationId: org.id };
    if (platform) {
      whereClause.platform = platform.toUpperCase();
    }

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        waId: true,
        name: true,
        platform: true,
        createdAt: true,
        lastMessage: true,
        lastMessageAt: true,
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: contacts.length,
      contacts,
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
    const { name, waId, platform } = body;

    if (!name || !waId) {
      return NextResponse.json({ status: 400, error: "Name and waId are required." }, { status: 400 });
    }

    const newContact = await prisma.contact.create({
      data: {
        organizationId: org.id,
        name,
        waId,
        platform: (platform || "WHATSAPP").toUpperCase(),
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Contact created successfully",
      contact: newContact,
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
    const { id, name, waId, platform } = body;

    if (!id) {
      return NextResponse.json({ status: 400, error: "Contact ID is required for update." }, { status: 400 });
    }

    const existing = await prisma.contact.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Contact not found in this organization." }, { status: 404 });
    }

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        waId: waId !== undefined ? waId : existing.waId,
        platform: platform !== undefined ? platform.toUpperCase() : existing.platform,
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Contact updated successfully",
      contact: updatedContact,
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
      return NextResponse.json({ status: 400, error: "Contact ID is required for deletion." }, { status: 400 });
    }

    const existing = await prisma.contact.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Contact not found." }, { status: 404 });
    }

    await prisma.contact.delete({
      where: { id },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Contact deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
