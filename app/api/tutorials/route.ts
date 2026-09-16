import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTutorialVideos, DEFAULT_TUTORIAL_VIDEOS } from "@/lib/tutorial-videos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: { tutorialVideos: true },
      take: 5,
    });

    for (const config of configs) {
      const normalized = normalizeTutorialVideos(config.tutorialVideos);
      const activeVideos = normalized.filter((video) => video.isActive);
      if (activeVideos.length > 0) {
        return NextResponse.json({ videos: activeVideos });
      }
    }

    const fallback = normalizeTutorialVideos(configs[0]?.tutorialVideos).filter((v) => v.isActive);
    if (fallback.length > 0) {
      return NextResponse.json({ videos: fallback });
    }

    return NextResponse.json({ videos: DEFAULT_TUTORIAL_VIDEOS.filter((v) => v.isActive) });
  } catch (error) {
    console.error("Failed to fetch public tutorial videos:", error);
    return NextResponse.json({ error: "Failed to fetch tutorial videos" }, { status: 500 });
  }
}
