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
      platform: "INSTAGRAM_POSTS",
      posts: [
        { id: "ig_post_01", caption: "Behind the scenes at our creative workshop! 🎨📸", likes: 412, commentsCount: 34, mediaUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c" },
        { id: "ig_post_02", caption: "Coffee and coding: the perfect morning combo. ☕💻", likes: 231, commentsCount: 12, mediaUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97" }
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
    const { caption, imageUrl } = body;

    if (!caption) {
      return NextResponse.json({ status: 400, error: "caption is required." }, { status: 400 });
    }

    return NextResponse.json({
      status: 201,
      success: true,
      post: {
        id: "ig_post_" + Math.random().toString(36).substring(7),
        caption,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c",
        likes: 0,
        commentsCount: 0,
        createdAt: new Date(),
      }
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message }, { status: 500 });
  }
}
