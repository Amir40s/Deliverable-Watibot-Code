import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTutorialVideos, DEFAULT_TUTORIAL_VIDEOS } from "@/lib/tutorial-videos";

export const dynamic = "force-dynamic";

function isAdminRole(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

async function getStoredTutorialVideos() {
  const configs = await prisma.systemConfig.findMany({
    orderBy: { updatedAt: "desc" },
    select: { tutorialVideos: true },
    take: 5,
  });

  for (const config of configs) {
    const normalized = normalizeTutorialVideos(config.tutorialVideos);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const fallback = normalizeTutorialVideos(configs[0]?.tutorialVideos);
  if (fallback.length > 0) {
    return fallback;
  }

  return DEFAULT_TUTORIAL_VIDEOS;
}

async function saveStoredTutorialVideos(videos: ReturnType<typeof normalizeTutorialVideos>) {
  const existingConfig = await prisma.systemConfig.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existingConfig) {
    await prisma.systemConfig.update({
      where: { id: existingConfig.id },
      data: {
        tutorialVideos: videos as any,
        updatedAt: new Date(),
      },
    });
    return;
  }

  await prisma.systemConfig.create({
    data: {
      platformName: "Wati Bot",
      supportEmail: "info@watibot.pro",
      tutorialVideos: videos as any,
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const publicOnly = url.searchParams.get("public") === "1";

    if (!publicOnly) {
      const session = await getServerSession(authOptions);
      if (!isAdminRole(session?.user?.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let videos = await getStoredTutorialVideos();

    if (publicOnly) {
      videos = videos.filter((video) => video.isActive);
    }

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Failed to fetch tutorial videos:", error);
    return NextResponse.json({ error: "Failed to fetch tutorial videos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdminRole(session?.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const videos = normalizeTutorialVideos(body?.videos).slice(0, 12);
    await saveStoredTutorialVideos(videos);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Failed to save tutorial videos:", error);
    const message = error instanceof Error ? error.message : "Failed to save tutorial videos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
