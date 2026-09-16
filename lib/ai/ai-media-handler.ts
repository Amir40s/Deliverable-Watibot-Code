import { logger } from "@/lib/logger";
import { sendUnifiedMessage } from "@/lib/messaging/api";

export interface AIMediaItem {
  type: "image" | "video" | "audio" | "document";
  url: string;
  caption?: string;
}


const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "3gp", "mkv", "avi", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "ogg", "wav", "m4a", "aac"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]);

/**
 * Clean and sanitize a raw media URL extracted from prompt or model response.
 */
export function sanitizeMediaUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  let cleaned = rawUrl.trim();

  // Remove markdown link wrapper if model returned [caption](https://...)
  const mdMatch = cleaned.match(/\]\((https?:\/\/[^\s\)]+)\)/i);
  if (mdMatch && mdMatch[1]) {
    cleaned = mdMatch[1].trim();
  }

  // Repeatedly strip leading and trailing unwanted symbols (brackets, quotes, punctuation)
  let prev = "";
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^[\(<\["'`\s]+/, "")
      .replace(/[\)>\]"'`.,;:!\?\s]+$/, "")
      .trim();
  }

  return cleaned;
}

/**
 * Detect media type from extension or Content-Type header.
 */
export function detectMediaTypeFromUrl(
  url: string,
  fallbackType?: "image" | "video" | "audio" | "document"
): "image" | "video" | "audio" | "document" {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const ext = pathname.split(".").pop() || "";

    if (IMAGE_EXTENSIONS.has(ext)) return "image";
    if (VIDEO_EXTENSIONS.has(ext)) return "video";
    if (AUDIO_EXTENSIONS.has(ext)) return "audio";
    if (DOCUMENT_EXTENSIONS.has(ext)) return "document";
  } catch {
    // ignore
  }

  if (fallbackType) {
    return fallbackType;
  }

  return "image";
}

/**
 * Validate and verify accessibility of a media URL without downloading full binary.
 */
export async function validateAIMediaItem(
  item: AIMediaItem
): Promise<{ isValid: boolean; item: AIMediaItem; reason?: string }> {
  const cleanUrl = sanitizeMediaUrl(item.url);

  if (!cleanUrl) {
    return { isValid: false, item: { ...item, url: "" }, reason: "Empty media URL" };
  }

  try {
    const parsed = new URL(cleanUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { isValid: false, item, reason: `Unsupported protocol: ${parsed.protocol}` };
    }
  } catch (err: any) {
    return { isValid: false, item, reason: `Invalid URL format: ${cleanUrl}` };
  }

  let determinedType: "image" | "video" | "audio" | "document" = detectMediaTypeFromUrl(cleanUrl, item.type);

  // If extension is not clearly an image, video, audio, or document, attempt lightweight HEAD request
  const hasKnownExt = (() => {
    try {
      const ext = new URL(cleanUrl).pathname.split(".").pop()?.toLowerCase() || "";
      return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext);
    } catch {
      return false;
    }
  })();

  if (!hasKnownExt) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const headRes = await fetch(cleanUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
          Accept: "*/*",
        },
      });
      clearTimeout(timeoutId);

      if (!headRes.ok && headRes.status >= 400 && headRes.status < 500) {
        return { isValid: false, item, reason: `HTTP ${headRes.status} for URL: ${cleanUrl}` };
      }

      const contentType = headRes.headers.get("content-type")?.toLowerCase() || "";
      if (contentType.startsWith("video/")) {
        determinedType = "video";
      } else if (contentType.startsWith("image/")) {
        determinedType = "image";
      } else if (contentType.startsWith("audio/")) {
        determinedType = "audio";
      } else if (contentType.includes("pdf") || contentType.includes("document") || contentType.includes("msword")) {
        determinedType = "document";
      }
    } catch (err: any) {
      logger.flow.warn(`[AIMedia] Fast probe warning for ${cleanUrl}: ${err.message}. Proceeding with default.`);
    }
  }

  const cleanCaption = item.caption ? item.caption.trim().slice(0, 1024) : undefined;

  return {
    isValid: true,
    item: {
      type: determinedType,
      url: cleanUrl,
      caption: cleanCaption,
    },
  };
}

export interface SendAIMediaOptions {
  organizationId: string;
  contactId: string;
  mediaList: AIMediaItem[];
  flowContext?: any;
  maxBatchSize?: number;
}

/**
 * Backend Media Handler:
 * Validates each media item and sends it through WhatsApp Cloud API or QR connection in sequential order.
 * Failures are isolated and gracefully logged to protect customer text responses.
 */
export async function sendAIMediaResponses(options: SendAIMediaOptions): Promise<{
  sentCount: number;
  failedCount: number;
  results: Array<{ url: string; success: boolean; error?: string }>;
}> {
  const { organizationId, contactId, mediaList, flowContext, maxBatchSize = 5 } = options;

  if (!mediaList || !Array.isArray(mediaList) || mediaList.length === 0) {
    return { sentCount: 0, failedCount: 0, results: [] };
  }

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const uniqueItems: AIMediaItem[] = [];

  for (const item of mediaList) {
    const rawUrl = item?.url ? sanitizeMediaUrl(item.url) : "";
    if (rawUrl && !seenUrls.has(rawUrl)) {
      seenUrls.add(rawUrl);
      uniqueItems.push({
        ...item,
        url: rawUrl,
      });
    }
  }

  const batch = uniqueItems.slice(0, maxBatchSize);
  const results: Array<{ url: string; success: boolean; error?: string }> = [];
  let sentCount = 0;
  let failedCount = 0;

  logger.flow.info(`[AIMedia] Dispatching ${batch.length} media item(s) to contact ${contactId}`);

  for (let i = 0; i < batch.length; i++) {
    const candidate = batch[i];

    // Slight delay between multiple media messages so WhatsApp delivers them in orderly sequence
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      const validated = await validateAIMediaItem(candidate);
      if (!validated.isValid) {
        logger.flow.warn(`[AIMedia] Skipping invalid media URL (${candidate.url}): ${validated.reason}`);
        results.push({ url: candidate.url, success: false, error: validated.reason });
        failedCount++;
        continue;
      }

      const mediaToSend = validated.item;

      logger.flow.info(
        `[AIMedia] Sending ${mediaToSend.type.toUpperCase()} (${i + 1}/${batch.length}): ${mediaToSend.url}`
      );

      const { getMimeTypeFromFileNameOrUrl } = await import('@/lib/storage/media');
      let docFileName: string | undefined = undefined;
      if (mediaToSend.caption && /\.(docx|doc|pdf|xlsx|xls|pptx|ppt|txt|csv|zip|rar)$/i.test(mediaToSend.caption.trim())) {
        docFileName = mediaToSend.caption.trim();
      } else {
        docFileName = mediaToSend.url.split('/').pop()?.split('?')[0];
      }
      const docMime = getMimeTypeFromFileNameOrUrl(docFileName || mediaToSend.url);

      await sendUnifiedMessage({
        contactId,
        message: mediaToSend.caption || "",
        mediaUrl: mediaToSend.url,
        contentType: mediaToSend.type,
        fileName: docFileName,
        mimetype: docMime,
        skipWindowCheck: true,
      });

      results.push({ url: mediaToSend.url, success: true });
      sentCount++;
      logger.flow.success(`[AIMedia] Successfully delivered ${mediaToSend.type} to contact ${contactId}`);
    } catch (err: any) {
      failedCount++;
      const errMsg = err?.message || String(err);
      logger.flow.error(`[AIMedia] Failed to send media item (${candidate.url}): ${errMsg}`);
      results.push({ url: candidate.url, success: false, error: errMsg });
      // Crucial: Continue with next media; do not crash flow
    }
  }

  return {
    sentCount,
    failedCount,
    results,
  };
}
