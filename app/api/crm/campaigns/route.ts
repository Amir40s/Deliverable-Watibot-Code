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

    let campaigns: any[] = [];
    try {
      if ((prisma as any).dripCampaign) {
        campaigns = await (prisma as any).dripCampaign.findMany({
          where: { organizationId: org.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
      }
    } catch {
      campaigns = [];
    }

    return NextResponse.json({
      status: 200,
      success: true,
      totalCount: campaigns.length,
      campaigns,
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
    const { name, triggerEvent, delaySeconds } = body;

    if (!name || !triggerEvent) {
      return NextResponse.json({ status: 400, error: "Campaign name and triggerEvent are required." }, { status: 400 });
    }

    let newCampaign = null;
    if ((prisma as any).dripCampaign) {
      newCampaign = await (prisma as any).dripCampaign.create({
        data: {
          organizationId: org.id,
          name,
          triggerEvent,
          delaySeconds: parseInt(delaySeconds || "0", 10),
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      status: 201,
      success: true,
      message: "Drip Campaign created successfully",
      campaign: newCampaign,
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
    const { id, name, triggerEvent, isActive } = body;

    if (!id) {
      return NextResponse.json({ status: 400, error: "Campaign ID is required for update." }, { status: 400 });
    }

    let updatedCampaign = null;
    if ((prisma as any).dripCampaign) {
      const existing = await (prisma as any).dripCampaign.findFirst({
        where: { id, organizationId: org.id },
      });

      if (!existing) {
        return NextResponse.json({ status: 404, error: "Campaign not found." }, { status: 404 });
      }

      updatedCampaign = await (prisma as any).dripCampaign.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          triggerEvent: triggerEvent !== undefined ? triggerEvent : existing.triggerEvent,
          isActive: isActive !== undefined ? isActive : existing.isActive,
        },
      });
    }

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Campaign updated successfully",
      campaign: updatedCampaign,
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
      return NextResponse.json({ status: 400, error: "Campaign ID is required for deletion." }, { status: 400 });
    }

    if ((prisma as any).dripCampaign) {
      const existing = await (prisma as any).dripCampaign.findFirst({
        where: { id, organizationId: org.id },
      });

      if (!existing) {
        return NextResponse.json({ status: 404, error: "Campaign not found." }, { status: 404 });
      }

      await (prisma as any).dripCampaign.delete({
        where: { id },
      });
    }

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Campaign deleted successfully",
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
