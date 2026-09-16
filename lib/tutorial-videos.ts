export interface TutorialVideo {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function getEmbeddableVideoUrl(videoUrl: string) {
  const trimmed = videoUrl.trim();

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (host === "vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function getYouTubeThumbnailUrl(videoUrl: string): string | null {
  try {
    const trimmed = videoUrl.trim();
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    if (trimmed.includes("/embed/")) {
      const videoId = trimmed.split("/embed/")[1]?.split("?")[0];
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  } catch {}

  return null;
}

export function isDirectVideoAsset(videoUrl: string) {
  if (!videoUrl) return false;
  const normalized = videoUrl.split("?")[0]?.split("#")[0] || "";
  return (
    normalized.startsWith("/") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:video") ||
    /\.(mp4|webm|ogg|ogv|mov|m4v|m3u8)$/i.test(normalized) ||
    videoUrl.includes("/video/upload/") ||
    videoUrl.includes("/uploads/") ||
    videoUrl.includes("/api/uploads/") ||
    videoUrl.includes("/api/media/") ||
    videoUrl.includes("/storage/")
  );
}

export const DEFAULT_TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: "tutorial-default-1",
    title: "Platform Walkthrough & Getting Started",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    duration: "03:45",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tutorial-default-2",
    title: "Setting Up WhatsApp API & Templates",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    duration: "05:20",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tutorial-default-3",
    title: "Creating Bulk Broadcast Campaigns",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
    duration: "04:10",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "tutorial-default-4",
    title: "Automating Responses with AI Bot",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
    duration: "06:15",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];


export function normalizeTutorialVideos(input: unknown): TutorialVideo[] {
  let parsedInput = input;
  if (typeof parsedInput === "string") {
    try {
      parsedInput = JSON.parse(parsedInput);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsedInput)) return [];

  return parsedInput
    .map((item, index): TutorialVideo | null => {
      if (!isRecord(item)) return null;

      const title = cleanString(item.title, 140);
      const rawVideoUrl = cleanString(item.videoUrl, 2000);
      const videoUrl = getEmbeddableVideoUrl(rawVideoUrl) || rawVideoUrl;
      const thumbnailUrl = cleanString(item.thumbnailUrl, 2000);
      const duration = cleanString(item.duration, 20);
      const updatedAt = cleanString(item.updatedAt, 40);

      if (!title || !rawVideoUrl) return null;

      const video: TutorialVideo = {
        id: cleanString(item.id, 80) || `tutorial-${index + 1}`,
        title,
        videoUrl: videoUrl || rawVideoUrl,
        isActive: item.isActive !== false,
        createdAt: cleanString(item.createdAt, 40) || new Date().toISOString(),
      };

      if (thumbnailUrl) video.thumbnailUrl = thumbnailUrl;
      if (duration) video.duration = duration;
      if (updatedAt) video.updatedAt = updatedAt;

      return video;
    })
    .filter((item): item is TutorialVideo => Boolean(item));
}
