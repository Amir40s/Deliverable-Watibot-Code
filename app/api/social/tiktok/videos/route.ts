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

    return NextResponse.json({
      status: 200,
      success: true,
      platform: "TIKTOK",
      videos: [
        { id: "tt_vid_01", title: "Day in the life of a SaaS developer! 💻🚀", views: 24500, likes: 1820, commentsCount: 94 },
        { id: "tt_vid_02", title: "How to automate WhatsApp with WatiBot! 📱🔥", views: 54100, likes: 4900, commentsCount: 218 }
      ],
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
    const { title, videoUrl } = body;

    if (!title) {
      return NextResponse.json({ status: 400, error: "title is required." }, { status: 400 });
    }

    return NextResponse.json({
      status: 201,
      success: true,
      video: {
        id: "tt_vid_" + Math.random().toString(36).substring(7),
        title,
        videoUrl: videoUrl || "https://example.com/tiktok_media.mp4",
        views: 0,
        likes: 0,
        commentsCount: 0,
        createdAt: new Date(),
      }
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
