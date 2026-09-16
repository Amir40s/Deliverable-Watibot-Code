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

    const flows = await prisma.flow.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: flows.length,
      flows,
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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ status: 400, error: "Flow name is required." }, { status: 400 });
    }

    const newFlow = await prisma.flow.create({
      data: {
        organizationId: org.id,
        name,
        description: description || "",
        isActive: true,
        trigger: JSON.stringify({ event: "message.created" }),
        nodes: JSON.stringify([]),
        edges: JSON.stringify([]),
      },
    });

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Chat Flow created successfully",
      flow: newFlow,
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
    const { id, name, isActive, description } = body;

    if (!id) {
      return NextResponse.json({ status: 400, error: "Flow ID is required for update." }, { status: 400 });
    }

    const existing = await prisma.flow.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Flow not found." }, { status: 404 });
    }

    const updatedFlow = await prisma.flow.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        description: description !== undefined ? description : existing.description,
      },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Flow updated successfully",
      flow: updatedFlow,
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
      return NextResponse.json({ status: 400, error: "Flow ID is required for deletion." }, { status: 400 });
    }

    const existing = await prisma.flow.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json({ status: 404, error: "Flow not found." }, { status: 404 });
    }

    await prisma.flow.delete({
      where: { id },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Flow deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
