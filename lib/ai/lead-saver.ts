import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { AIMediaItem, sanitizeMediaUrl, detectMediaTypeFromUrl } from "@/lib/ai/ai-media-handler";
import { assignContactTagWithPipelineSync } from "@/lib/pipeline/sync";

export interface ProcessedAIResponse {
  textMessage: string;
  isJson: boolean;
  parsedData: Record<string, any> | null;
  media: AIMediaItem[];
  intent?: string;
  order?: any;
  appointment?: any;
}

/**
 * Helper to find any linked Google Sheet / Excel sheet for an organization.
 */
export async function getOrganizationSpreadsheet(organizationId: string, aiAgentId?: string): Promise<{
  spreadsheetId: string;
  sheetName: string;
} | null> {
  try {
    // 1. Check if specific AI Agent has a googleSpreadsheetId configured
    if (aiAgentId) {
      const agent = await prisma.aIAgent.findUnique({
        where: { id: aiAgentId },
        select: { googleSpreadsheetId: true, googleSheetName: true },
      });
      if (agent?.googleSpreadsheetId) {
        return {
          spreadsheetId: agent.googleSpreadsheetId,
          sheetName: agent.googleSheetName || "Leads",
        };
      }
    }

    // 2. Check default AI Agent for organization
    const defaultAgent = await prisma.aIAgent.findFirst({
      where: { organizationId, isDefault: true },
      select: { googleSpreadsheetId: true, googleSheetName: true },
    });
    if (defaultAgent?.googleSpreadsheetId) {
      return {
        spreadsheetId: defaultAgent.googleSpreadsheetId,
        sheetName: defaultAgent.googleSheetName || "Leads",
      };
    }

    // 3. Check any AI Agent in organization with spreadsheet configured
    const anyAgent = await prisma.aIAgent.findFirst({
      where: { organizationId, googleSpreadsheetId: { not: null } },
      select: { googleSpreadsheetId: true, googleSheetName: true },
    });
    if (anyAgent?.googleSpreadsheetId) {
      return {
        spreadsheetId: anyAgent.googleSpreadsheetId,
        sheetName: anyAgent.googleSheetName || "Leads",
      };
    }

    // 4. Check KnowledgeBase for googlesheets:// entries
    const kbEntry = await prisma.knowledgeBase.findFirst({
      where: {
        organizationId,
        sourceUrl: { startsWith: "googlesheets://" },
      },
      select: { sourceUrl: true },
    });

    if (kbEntry?.sourceUrl) {
      const withoutPrefix = kbEntry.sourceUrl.replace("googlesheets://", "");
      const [spreadsheetId, sheetName] = withoutPrefix.split("/");
      return {
        spreadsheetId: spreadsheetId || "",
        sheetName: sheetName || "Leads",
      };
    }

    return null;

    return null;
  } catch (err: any) {
    logger.flow.error(`[LeadSaver] Error looking up spreadsheet: ${err.message}`);
    return null;
  }
}

export interface ProcessAIJsonOptions {
  rawAiResponse: string;
  organizationId: string;
  contactId: string;
  fallbackPhone?: string;
  aiAgentId?: string;
  aiAgentName?: string;
  provider?: string;
  model?: string;
  userPrompt?: string;
  retrievedChunks?: string[];
  systemPromptUsed?: string;
  durationMs?: number;
}

const RAW_MEDIA_URL_REGEX = /(?:https?:\/\/)[^\s"'<>\)]+\.(?:jpg|jpeg|png|webp|gif|bmp|svg|mp4|mov|webm|3gp|mkv|avi|m4v|mp3|ogg|wav|m4a|aac|pdf|doc|docx)(?:\?[^\s"'<>\)]*)?/gi;

const LABELED_MEDIA_URL_REGEX = /(?:menu\s*(?:image|photo|pic|picture)?|image|photo|picture|tasveer|video|audio|voice|catalog|brochure|file|document)\s*[:=]\s*(https?:\/\/[^\s"'<>\)]+)/gi;

export function extractMediaFromText(text: string): { cleanedText: string; media: AIMediaItem[] } {
  if (!text || typeof text !== "string") {
    return { cleanedText: text || "", media: [] };
  }

  const media: AIMediaItem[] = [];
  const seenUrls = new Set<string>();
  const matches = text.match(RAW_MEDIA_URL_REGEX);

  let cleanedText = text;

  if (matches) {
    for (const rawUrl of matches) {
      const cleanUrl = sanitizeMediaUrl(rawUrl);
      if (cleanUrl && !seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        const type = detectMediaTypeFromUrl(cleanUrl, "image");
        media.push({ type, url: cleanUrl });
        cleanedText = cleanedText.split(rawUrl).join("");
      }
    }

    cleanedText = cleanedText
      .replace(/\[\s*Image\s*:\s*\]/gi, "")
      .replace(/\[\s*Video\s*:\s*\]/gi, "")
      .replace(/\[\s*Audio\s*:\s*\]/gi, "")
      .replace(/\[\s*Document\s*:\s*\]/gi, "")
      .replace(/(?:image|video|photo|picture|audio|document)\s*:\s*$/gim, "")
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();
  }

  return { cleanedText, media };
}

export function extractContextualMediaFromPrompt(
  systemPrompt: string | undefined,
  userPrompt: string | undefined,
  aiTextMessage: string | undefined
): AIMediaItem[] {
  if (!systemPrompt || typeof systemPrompt !== "string") return [];

  const userText = (userPrompt || "").toLowerCase();
  const replyText = (aiTextMessage || "").toLowerCase();

  // Detection triggers: did customer ask for media or menu, or did AI state it is sharing/showing media?
  const isMenuIntent =
    userText.includes("menu") ||
    userText.includes("rate list") ||
    userText.includes("price list") ||
    userText.includes("food list") ||
    userText.includes("card") ||
    userText.includes("prices") ||
    userText.includes("deals") ||
    replyText.includes("menu") ||
    replyText.includes("rate list") ||
    replyText.includes("price list") ||
    replyText.includes("is image mein") ||
    replyText.includes("is picture mein") ||
    replyText.includes("is photo mein") ||
    replyText.includes("yeh raha hamara menu") ||
    replyText.includes("here is our menu") ||
    replyText.includes("here is the menu") ||
    replyText.includes("hamara menu");

  const isVideoIntent =
    userText.includes("video") ||
    userText.includes("demo") ||
    userText.includes("clip") ||
    replyText.includes("video") ||
    replyText.includes("demo");

  const isCatalogIntent =
    userText.includes("catalog") ||
    userText.includes("brochure") ||
    userText.includes("pdf") ||
    replyText.includes("catalog") ||
    replyText.includes("brochure");

  const isAudioIntent =
    userText.includes("audio") ||
    userText.includes("voice") ||
    replyText.includes("audio") ||
    replyText.includes("voice");

  const isGeneralMediaIntent =
    isMenuIntent ||
    isVideoIntent ||
    isCatalogIntent ||
    isAudioIntent ||
    userText.includes("image") ||
    userText.includes("photo") ||
    userText.includes("picture") ||
    userText.includes("tasveer") ||
    userText.includes("pic") ||
    userText.includes("pics") ||
    userText.includes("bhejo") ||
    userText.includes("send") ||
    userText.includes("dikhao") ||
    userText.includes("share") ||
    userText.includes("dekhna") ||
    userText.includes("show") ||
    replyText.includes("image") ||
    replyText.includes("photo") ||
    replyText.includes("picture") ||
    replyText.includes("attached") ||
    replyText.includes("share kar raha hoon") ||
    replyText.includes("share kar rahi hoon") ||
    replyText.includes("bhej raha hoon") ||
    replyText.includes("bhej di hai");

  if (!isGeneralMediaIntent) return [];

  const lines = systemPrompt.split("\n");
  const candidates: { type: "image" | "video" | "audio" | "document"; url: string; label: string; score: number }[] = [];
  const seenUrls = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : "";
    const combinedContext = `${prevLine} ${line}`.toLowerCase();

    // 1. Check raw media file URLs
    const rawMatches: string[] = [...(line.match(RAW_MEDIA_URL_REGEX) || [])];
    // 2. Check labeled URLs (e.g. MENU IMAGE: https://...)
    let labeledMatch: RegExpExecArray | null;
    const labeledRegex = new RegExp(LABELED_MEDIA_URL_REGEX.source, "gi");
    while ((labeledMatch = labeledRegex.exec(line)) !== null) {
      if (labeledMatch[1]) rawMatches.push(labeledMatch[1]);
    }

    for (const rawUrl of rawMatches) {
      const cleanUrl = sanitizeMediaUrl(rawUrl);
      if (!cleanUrl || seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      const resolvedType = detectMediaTypeFromUrl(cleanUrl, "image");
      let score = 5;

      if (isMenuIntent && (combinedContext.includes("menu") || cleanUrl.toLowerCase().includes("menu"))) {
        score += 50;
      }
      if (isVideoIntent && (combinedContext.includes("video") || resolvedType === "video")) {
        score += 50;
      }
      if (isCatalogIntent && (combinedContext.includes("catalog") || combinedContext.includes("brochure") || resolvedType === "document")) {
        score += 50;
      }
      if (isAudioIntent && (combinedContext.includes("audio") || resolvedType === "audio")) {
        score += 50;
      }
      if (!isVideoIntent && !isCatalogIntent && !isAudioIntent && resolvedType === "image") {
        score += 20;
      }
      if (combinedContext.includes("image:") || combinedContext.includes("menu image")) {
        score += 20;
      }

      candidates.push({
        type: resolvedType,
        url: cleanUrl,
        label: combinedContext,
        score,
      });
    }
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const caption = isMenuIntent ? "Menu" : undefined;
  return [{ type: top.type, url: top.url, caption }];
}

/**
 * Safely extracts the customer-facing reply text from truncated or malformed JSON output
 * so that raw JSON syntax is NEVER exposed to WhatsApp users.
 */
function extractMessageFromTruncatedOrRawJson(rawText: string): string | null {
  if (!rawText || typeof rawText !== "string") return null;

  const match = rawText.match(/"(?:reply|message|response|text)"\s*:\s*"((?:[^"\\]|\\[\s\S])*)/);
  if (match && match[1]) {
    let candidate = match[1];
    const quoteIndex = candidate.search(/(^|[^\\])"/);
    if (quoteIndex !== -1) {
      const actualEnd = candidate.charAt(quoteIndex) === '"' ? quoteIndex : quoteIndex + 1;
      candidate = candidate.substring(0, actualEnd);
    }
    const cleaned = candidate
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();

    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  return null;
}

/**
 * Parses raw AI response string for JSON lead output, updates DB contact details/tags,
 * automatically appends lead data to the linked Google/Excel sheet, and records execution history log.
 */
export async function processAIJsonResponse(
  rawAiResponseOrOptions: string | ProcessAIJsonOptions,
  orgIdParam?: string,
  contactIdParam?: string,
  fallbackPhoneParam?: string
): Promise<ProcessedAIResponse> {
  const options: ProcessAIJsonOptions =
    typeof rawAiResponseOrOptions === "object"
      ? rawAiResponseOrOptions
      : {
          rawAiResponse: rawAiResponseOrOptions,
          organizationId: orgIdParam || "",
          contactId: contactIdParam || "",
          fallbackPhone: fallbackPhoneParam,
        };

  const {
    rawAiResponse,
    organizationId,
    contactId,
    fallbackPhone,
    aiAgentId,
    aiAgentName,
    provider,
    model,
    userPrompt,
    retrievedChunks,
    systemPromptUsed,
    durationMs,
  } = options;

  if (!rawAiResponse || typeof rawAiResponse !== "string") {
    return { textMessage: rawAiResponse || "", isJson: false, parsedData: null, media: [] };
  }

  // 1. Resolve Contact and Agent details early for accurate execution logging
  let contactName = "";
  let contactPhone = fallbackPhone || "";
  let contact: any = null;

  if (contactId) {
    try {
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          waId: true,
          name: true,
          aiAgentId: true,
          customAttributes: true,
          tags: { select: { id: true, name: true } },
        },
      });

      if (contact) {
        contactName = contact.name || "";
        contactPhone = contact.waId || fallbackPhone || "";
      }
    } catch (err: any) {
      logger.flow.error(`[LeadSaver] Error looking up contact: ${err.message}`);
    }
  }

  let resolvedAgentId = aiAgentId || contact?.aiAgentId;
  let resolvedAgentName = aiAgentName;
  let resolvedProvider = provider;
  let resolvedModel = model;
  let resolvedSystemPrompt = systemPromptUsed;
  let activeAgentRecord: any = null;

  if (organizationId) {
    try {
      activeAgentRecord = resolvedAgentId
        ? await prisma.aIAgent.findUnique({ where: { id: resolvedAgentId } })
        : (await prisma.aIAgent.findFirst({ where: { organizationId, isDefault: true } })) ||
          (await prisma.aIAgent.findFirst({ where: { organizationId } }));

      if (activeAgentRecord) {
        resolvedAgentId = activeAgentRecord.id; 
        resolvedAgentName = resolvedAgentName || activeAgentRecord.name;
        resolvedProvider = resolvedProvider || activeAgentRecord.aiProvider || "openai";
        resolvedModel = resolvedModel || activeAgentRecord.model || "gpt-4o-mini";
        resolvedSystemPrompt = resolvedSystemPrompt || activeAgentRecord.instructions || "";
      }
    } catch {
      // ignore
    }
  }

  // 2. Extract JSON block if present
  let jsonString = rawAiResponse.trim();
  const codeBlockMatch = rawAiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonString = codeBlockMatch[1].trim();
  } else {
    const firstBrace = rawAiResponse.indexOf("{");
    const lastBrace = rawAiResponse.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = rawAiResponse.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  let parsed: Record<string, any> | null = null;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    // Truncation or malformed JSON recovery
    const recoveredMessage = extractMessageFromTruncatedOrRawJson(rawAiResponse);
    const finalCleanText = recoveredMessage || rawAiResponse;

    if (organizationId) {
      const { logAIAgentExecution } = await import("@/app/actions/ai-executions");
      logAIAgentExecution({
        organizationId,
        contactId,
        contactName: contactName || "Customer",
        contactPhone,
        aiAgentId: resolvedAgentId,
        aiAgentName: resolvedAgentName || "AI Agent",
        provider: resolvedProvider || "openai",
        model: resolvedModel || "gpt-4o-mini",
        userPrompt: userPrompt || "Customer Query",
        retrievedChunks: retrievedChunks || [],
        systemPromptUsed: resolvedSystemPrompt || "",
        rawAiOutput: rawAiResponse,
        parsedMessage: finalCleanText,
        sheetSaved: false,
        durationMs: durationMs || 0,
        status: "success",
      }).catch(() => {});
    }
    const textExtraction = extractMediaFromText(finalCleanText);
    return { textMessage: textExtraction.cleanedText, isJson: !!recoveredMessage, parsedData: null, media: textExtraction.media };
  }

  if (!parsed || typeof parsed !== "object") {
    const recoveredMessage = extractMessageFromTruncatedOrRawJson(rawAiResponse);
    const finalCleanText = recoveredMessage || rawAiResponse;

    if (organizationId) {
      const { logAIAgentExecution } = await import("@/app/actions/ai-executions");
      logAIAgentExecution({
        organizationId,
        contactId,
        contactName: contactName || "Customer",
        contactPhone,
        aiAgentId: resolvedAgentId,
        aiAgentName: resolvedAgentName || "AI Agent",
        provider: resolvedProvider || "openai",
        model: resolvedModel || "gpt-4o-mini",
        userPrompt: userPrompt || "Customer Query",
        retrievedChunks: retrievedChunks || [],
        systemPromptUsed: resolvedSystemPrompt || "",
        rawAiOutput: rawAiResponse,
        parsedMessage: finalCleanText,
        sheetSaved: false,
        durationMs: durationMs || 0,
        status: "success",
      }).catch(() => {});
    }
    const textExtraction = extractMediaFromText(finalCleanText);
    return { textMessage: textExtraction.cleanedText, isJson: !!recoveredMessage, parsedData: null, media: textExtraction.media };
  }

  // 3. Extract customer-facing message and media
  let textMessage = String(
    parsed.message || parsed.response || parsed.reply || parsed.text || ""
  ).trim();

  // If textMessage is empty or somehow returned the raw JSON, recover the conversational text
  if (!textMessage || (textMessage.startsWith("{") && textMessage.includes('"reply"'))) {
    const recovered = extractMessageFromTruncatedOrRawJson(rawAiResponse);
    textMessage = recovered || rawAiResponse.trim();
  }
  
  // Replace literal '\n' string representations with actual newlines if model output escaped strings
  textMessage = textMessage.replace(/\\n/g, "\n");


  const extractedMedia: AIMediaItem[] = [];
  const seenMediaUrls = new Set<string>();

  const addMediaCandidate = (typeCandidate?: string, urlCandidate?: string, captionCandidate?: string) => {
    if (!urlCandidate || typeof urlCandidate !== "string") return;
    const cleanUrl = sanitizeMediaUrl(urlCandidate);
    if (!cleanUrl || seenMediaUrls.has(cleanUrl)) return;
    seenMediaUrls.add(cleanUrl);
    const resolvedType = (typeCandidate === "video" || typeCandidate === "image" || typeCandidate === "audio" || typeCandidate === "document")
      ? (typeCandidate as any)
      : detectMediaTypeFromUrl(cleanUrl, "image");
    extractedMedia.push({
      type: resolvedType,
      url: cleanUrl,
      caption: captionCandidate ? String(captionCandidate).trim() : undefined,
    });
  };

  // Extract from parsed.media (array or single object)
  if (Array.isArray(parsed.media)) {
    for (const item of parsed.media) {
      if (item && typeof item === "object") {
        addMediaCandidate(item.type, item.url || item.link || item.media_url, item.caption || item.title);
      } else if (typeof item === "string") {
        addMediaCandidate(undefined, item);
      }
    }
  } else if (parsed.media && typeof parsed.media === "object") {
    addMediaCandidate(parsed.media.type, parsed.media.url || parsed.media.link, parsed.media.caption);
  } else if (typeof parsed.media === "string") {
    addMediaCandidate(undefined, parsed.media);
  }

  // Fallback keys if model used alternative names: image, images, video, videos, audio, document, image_url, video_url
  if (Array.isArray(parsed.images)) {
    for (const img of parsed.images) addMediaCandidate("image", typeof img === "string" ? img : img?.url, img?.caption);
  }
  if (Array.isArray(parsed.videos)) {
    for (const vid of parsed.videos) addMediaCandidate("video", typeof vid === "string" ? vid : vid?.url, vid?.caption);
  }
  if (parsed.image) addMediaCandidate("image", typeof parsed.image === "string" ? parsed.image : parsed.image?.url, parsed.image?.caption);
  if (parsed.image_url) addMediaCandidate("image", parsed.image_url);
  if (parsed.video) addMediaCandidate("video", typeof parsed.video === "string" ? parsed.video : parsed.video?.url, parsed.video?.caption);
  if (parsed.video_url) addMediaCandidate("video", parsed.video_url);

  // If no media found in JSON structure, check if textMessage contains raw URLs
  if (extractedMedia.length === 0) {
    const textExtraction = extractMediaFromText(textMessage);
    textMessage = textExtraction.cleanedText;
    for (const m of textExtraction.media) {
      addMediaCandidate(m.type, m.url, m.caption);
    }
  }

  // 3b. Keyword-Based Automated Media / File Triggers (Independent from prompt)
  if (activeAgentRecord?.keywordResponses && Array.isArray(activeAgentRecord.keywordResponses) && userPrompt) {
    const promptLower = userPrompt.toLowerCase();
    for (const rule of activeAgentRecord.keywordResponses as any[]) {
      if (!rule || !rule.keyword || !rule.mediaUrl) continue;
      const kw = String(rule.keyword).trim().toLowerCase();
      if (kw && promptLower.includes(kw)) {
        addMediaCandidate(
          rule.responseType || "document",
          rule.mediaUrl,
          rule.fileName || rule.caption || undefined
        );
      }
    }
  }

  // Auto-detect media from prompt instructions & knowledge base if customer asked or AI indicated media sharing
  if (extractedMedia.length === 0) {
    const combinedContext = [
      options.systemPromptUsed || "",
      ...(options.retrievedChunks || [])
    ].join("\n");

    if (combinedContext.trim().length > 0) {
      const promptMedia = extractContextualMediaFromPrompt(
        combinedContext,
        userPrompt,
        textMessage
      );
      for (const m of promptMedia) {
        addMediaCandidate(m.type, m.url, m.caption);
      }
    }
  }

  // Ensure customer textMessage does not leak raw media URLs
  if (extractedMedia.length > 0) {
    for (const m of extractedMedia) {
      if (textMessage.includes(m.url)) {
        textMessage = textMessage.split(m.url).join("").trim();
      }
    }
    // Clean up empty parentheses, brackets, or orphaned labels
    textMessage = textMessage
      .replace(/\[\s*Image\s*:\s*\]/gi, "")
      .replace(/\[\s*Video\s*:\s*\]/gi, "")
      .replace(/\[\s*Audio\s*:\s*\]/gi, "")
      .replace(/\[\s*Document\s*:\s*\]/gi, "")
      .replace(/(?:image|video|photo|picture|audio|document)\s*:\s*$/gim, "")
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();
  }

  let isSheetSaved = false;
  let targetSheetId = "";
  let targetSheetName = "";
  let exportedRowData: Record<string, string> | null = null;

  // 4. Process Lead Data Extraction
  try {

    // Resolve Contact's most recent inbound media URL (e.g. CV Image, Resume Document)
    let candidateMediaUrl: string | null = null;
    if (contactId) {
      try {
        const recentMediaMsg = await prisma.message.findFirst({
          where: {
            contactId,
            direction: "inbound",
            mediaUrl: { not: null },
            type: { in: ["image", "document", "video"] },
          },
          orderBy: { createdAt: "desc" },
          select: { mediaUrl: true, type: true },
        });

        if (recentMediaMsg?.mediaUrl) {
          const { getAppBaseUrl } = await import("@/lib/storage/media");
          const base = getAppBaseUrl();
          const raw = recentMediaMsg.mediaUrl;
          candidateMediaUrl =
            raw.startsWith("http://") || raw.startsWith("https://")
              ? raw
              : `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
        }
      } catch (err: any) {
        logger.flow.warn(`[LeadSaver] Media lookup failed: ${err.message}`);
      }
    }

    const existingAttrs = (contact?.customAttributes as Record<string, any>) || {};

    if (!candidateMediaUrl) {
      const raw = (existingAttrs?.lastMediaUrl || contact?.customAttributes?.lastMediaUrl) as string | undefined;
      if (raw) {
        const { getAppBaseUrl } = await import("@/lib/storage/media");
        const base = getAppBaseUrl();
        candidateMediaUrl =
          raw.startsWith("http://") || raw.startsWith("https://")
            ? raw
            : `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
      }
    }

    const phoneNo =
      parsed.phone_number && parsed.phone_number !== "N/A"
        ? String(parsed.phone_number)
        : contactPhone || "N/A";

    const fullName =
      parsed.full_name && parsed.full_name !== "N/A"
        ? String(parsed.full_name)
        : contactName || "N/A";

    // Resolve Lead Tag & Pipeline Stage Target
    let targetTagToSync: { id?: string; name?: string } | null = null;
    const tagConfig = Array.isArray(activeAgentRecord?.customVariables)
      ? (activeAgentRecord.customVariables as any[]).find(
          (c: any) => c && typeof c === "object" && (c.type === "system_tag_config" || c.id === "_tag_config")
        )
      : null;

    if (parsed.lead_tag && parsed.lead_tag !== "N/A" && parsed.lead_tag !== "none") {
      targetTagToSync = { name: String(parsed.lead_tag).trim() };
    }

    // Ignore keys for data collection extraction
    const ignoreKeys = new Set([
      "message",
      "response",
      "reply",
      "text",
      "customer_message",
      "media",
      "intent",
      "order",
      "appointment",
      "order_status",
      "appointment_status",
      "is_confirmed",
      "lead_tag",
      "status",
    ]);

    // 4. Extract Configured Custom Variables (Strict Source of Truth)
    const configuredCustomVariables: string[] = [];
    if (activeAgentRecord?.customVariables && Array.isArray(activeAgentRecord.customVariables)) {
      for (const cv of activeAgentRecord.customVariables as any[]) {
        if (typeof cv === "string" && cv.trim()) {
          configuredCustomVariables.push(cv.trim());
        } else if (cv && typeof cv === "object" && (cv.name || cv.key)) {
          if (cv.type !== "system_tag_config" && cv.id !== "_tag_config") {
            configuredCustomVariables.push(String(cv.name || cv.key).trim());
          }
        }
      }
    }

    const rawVarPool: Record<string, any> = {
      ...(parsed.custom_variables && typeof parsed.custom_variables === "object" ? parsed.custom_variables : {}),
      ...parsed,
    };

    const extractedVariables: Record<string, any> = {};

    if (configuredCustomVariables.length > 0) {
      // STRICT FILTER: Keep ONLY variables configured in Custom Variables
      const allowedKeyMap = new Map<string, string>();
      for (const k of configuredCustomVariables) {
        allowedKeyMap.set(k.toLowerCase().replace(/[\s-_]+/g, ""), k);
      }

      for (const [key, val] of Object.entries(rawVarPool)) {
        if (ignoreKeys.has(key.toLowerCase()) || key === "custom_variables") continue;
        const normKey = key.toLowerCase().replace(/[\s-_]+/g, "");
        const matchingConfiguredKey = allowedKeyMap.get(normKey);
        if (matchingConfiguredKey && val !== null && val !== undefined && val !== "" && val !== "N/A") {
          extractedVariables[matchingConfiguredKey] = val;
        }
      }
    } else {
      // Fallback for legacy agents without configured custom variables
      for (const [key, val] of Object.entries(parsed)) {
        if (!ignoreKeys.has(key.toLowerCase()) && key !== "custom_variables") {
          extractedVariables[key] = val;
        }
      }
    }

    // Replace media placeholders (CV/document) if candidate media URL available
    if (candidateMediaUrl) {
      for (const [key, val] of Object.entries(extractedVariables)) {
        const lowerVal = String(val).toLowerCase().trim();
        const isMediaKey = /^(cv|resume|portfolio|image|doc|document|attachment|file|photo)/i.test(key);
        if (isMediaKey && (lowerVal === "image" || lowerVal === "[image]" || lowerVal === "document" || lowerVal === "[document]" || lowerVal === "received" || lowerVal === "true" || lowerVal === "yes" || lowerVal === "n/a")) {
          extractedVariables[key] = candidateMediaUrl;
        }
      }
      if (candidateMediaUrl && !extractedVariables["cv"] && !extractedVariables["resume"] && !extractedVariables["document"]) {
        if (configuredCustomVariables.some(k => k.toLowerCase() === "cv" || k.toLowerCase() === "resume")) {
          extractedVariables["cv"] = candidateMediaUrl;
        }
      }
    }

    // Update Contact details in DB with extracted custom variables
    const updatedAttrs = {
      ...existingAttrs,
      leadData: {
        ...(existingAttrs.leadData || {}),
        ...extractedVariables,
        lastUpdated: new Date().toISOString(),
      },
      ...(candidateMediaUrl ? { lastMediaUrl: candidateMediaUrl } : {}),
    };

    const updateData: any = {
      customAttributes: updatedAttrs,
    };

    if (fullName !== "N/A" && (!contact?.name || contact.name === contact.waId)) {
      updateData.name = fullName;
    }

    if (resolvedAgentId && (!contact?.aiAgentId || contact.aiAgentId !== resolvedAgentId)) {
      updateData.aiAgentId = resolvedAgentId;
    }

    if (contactId) {
      await prisma.contact.update({
        where: { id: contactId },
        data: updateData,
      });

      // Synchronize Contact Tag & Pipeline Stage
      if (!targetTagToSync) {
        if (Object.keys(extractedVariables).length > 0 && tagConfig?.qualifiedTagId) {
          targetTagToSync = { id: tagConfig.qualifiedTagId };
        } else if (tagConfig?.defaultTagId && (!contact?.tags || contact.tags.length === 0)) {
          targetTagToSync = { id: tagConfig.defaultTagId };
        }
      }

      if (targetTagToSync && organizationId) {
        await assignContactTagWithPipelineSync(organizationId, contactId, targetTagToSync);
      }
    }

    // Determine Configured Destinations
    const configuredDestinations: string[] = (activeAgentRecord?.destinations && Array.isArray(activeAgentRecord.destinations))
      ? activeAgentRecord.destinations
      : [];

    const rawIntent = (parsed.intent || parsed.detected_intent || "").toLowerCase();

    // 5. Ordering System Destination Integration
    if (configuredDestinations.includes("ordering_system") && organizationId && contactId) {
      const orderProduct = extractedVariables.product || extractedVariables.item || parsed.order?.product || null;
      const orderQty = extractedVariables.quantity || parsed.order?.quantity || 1;
      
      const parsedOrderStatus = String(parsed.order?.status || "").toLowerCase().trim();
      const hasExplicitConfirmWord = !!(userPrompt && /^(yes|haan|confirm|ok|okay|theek hai|place order|done|sure|bilkul|haan ji)\b/i.test(userPrompt.trim()));
      
      // Strict confirmation determination:
      // NEVER confirm while the AI is still collecting information!
      let finalOrderStatus: "confirmed" | "collecting_information" | "awaiting_confirmation" | "cancelled" = "collecting_information";
      
      if (parsedOrderStatus === "cancelled") {
        finalOrderStatus = "cancelled";
      } else if (parsedOrderStatus === "confirmed") {
        finalOrderStatus = "confirmed";
      } else if (parsedOrderStatus === "awaiting_confirmation") {
        finalOrderStatus = hasExplicitConfirmWord ? "confirmed" : "awaiting_confirmation";
      } else if (parsedOrderStatus === "collecting_information") {
        finalOrderStatus = "collecting_information";
      } else if (parsed.is_confirmed === true || (hasExplicitConfirmWord && existingAttrs?.pendingOrder)) {
        finalOrderStatus = "confirmed";
      } else {
        finalOrderStatus = "collecting_information";
      }

      if (orderProduct || parsed.order) {
        try {
          const { processCommerceAutomation } = await import("@/lib/ai/commerce-handler");
          await processCommerceAutomation({
            organizationId,
            contactId,
            fallbackPhone: contactPhone,
            agentId: activeAgentRecord?.id,
            intent: "order",
            order: {
              ...(parsed.order || {}),
              status: finalOrderStatus,
              product: orderProduct || parsed.order?.product || "Order Item",
              quantity: orderQty,
              customer: {
                name: extractedVariables.name || extractedVariables.full_name || parsed.order?.customer?.name || contactName || undefined,
                phone: extractedVariables.phone || extractedVariables.phone_number || parsed.order?.customer?.phone || contactPhone || undefined,
                address: extractedVariables.address || extractedVariables.delivery_address || parsed.order?.customer?.address || existingAttrs?.deliveryAddress || undefined,
                email: extractedVariables.email || parsed.order?.customer?.email || undefined,
              },
              notes: activeAgentRecord?.name ? `Captured by ${activeAgentRecord.name}` : undefined,
              ...extractedVariables,
            },
            rawCustomerMessage: userPrompt,
          });
        } catch (commErr: any) {
          logger.flow.error(`[LeadSaver] Error in ordering automation: ${commErr.message}`);
        }
      }
    }

    // 6. Appointment System Destination Integration
    if (configuredDestinations.includes("appointment_system") && organizationId && contactId) {
      const aptService = extractedVariables.service || extractedVariables.appointment_service || parsed.appointment?.service || null;
      const aptDate = extractedVariables.appointment_date || extractedVariables.date || parsed.appointment?.date || null;
      const aptTime = extractedVariables.appointment_time || extractedVariables.time || parsed.appointment?.time || null;

      const parsedAptStatus = String(parsed.appointment?.status || "").toLowerCase().trim();
      const hasExplicitAptConfirmWord = !!(userPrompt && /^(yes|haan|confirm|ok|okay|theek hai|book it|done|sure|bilkul|haan ji)\b/i.test(userPrompt.trim()));

      let finalAptStatus: "confirmed" | "collecting_information" | "awaiting_confirmation" | "cancelled" | "reschedule_requested" = "collecting_information";

      if (parsedAptStatus === "cancelled") {
        finalAptStatus = "cancelled";
      } else if (parsedAptStatus === "reschedule_requested") {
        finalAptStatus = "reschedule_requested";
      } else if (parsedAptStatus === "confirmed") {
        finalAptStatus = "confirmed";
      } else if (parsedAptStatus === "awaiting_confirmation") {
        finalAptStatus = hasExplicitAptConfirmWord ? "confirmed" : "awaiting_confirmation";
      } else if (parsedAptStatus === "collecting_information") {
        finalAptStatus = "collecting_information";
      } else if (parsed.is_confirmed === true || (hasExplicitAptConfirmWord && existingAttrs?.pendingAppointment)) {
        finalAptStatus = "confirmed";
      } else {
        finalAptStatus = "collecting_information";
      }

      if (aptService || aptDate || aptTime || parsed.appointment) {
        try {
          const { processCommerceAutomation } = await import("@/lib/ai/commerce-handler");
          await processCommerceAutomation({
            organizationId,
            contactId,
            fallbackPhone: contactPhone,
            intent: "appointment",
            appointment: {
              ...(parsed.appointment || {}),
              status: finalAptStatus,
              service: aptService || parsed.appointment?.service || "Appointment",
              date: aptDate || parsed.appointment?.date,
              time: aptTime || parsed.appointment?.time,
              customer: {
                name: extractedVariables.name || extractedVariables.full_name || parsed.appointment?.customer?.name || contactName || undefined,
                phone: extractedVariables.phone || parsed.appointment?.customer?.phone || contactPhone || undefined,
                email: extractedVariables.email || parsed.appointment?.customer?.email || undefined,
              },
              notes: activeAgentRecord?.name ? `Captured by ${activeAgentRecord.name}` : undefined,
              ...extractedVariables,
            },
            rawCustomerMessage: userPrompt,
          });
        } catch (commErr: any) {
          logger.flow.error(`[LeadSaver] Error in appointment automation: ${commErr.message}`);
        }
      }
    }

    // 7. Spreadsheet / Excel Destination Integration
    if (configuredDestinations.includes("spreadsheet")) {
      const sheetTarget = await getOrganizationSpreadsheet(organizationId, aiAgentId);

      const rowData: Record<string, string> = {
        Timestamp: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
      };

      for (const [key, value] of Object.entries(extractedVariables)) {
        const headerName = key
          .split(/[\s_-]+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        let formattedValue = "N/A";
        if (value !== null && value !== undefined && value !== "") {
          if (typeof value === "boolean") {
            formattedValue = value ? "True" : "False";
          } else if (typeof value === "object") {
            formattedValue = JSON.stringify(value);
          } else {
            formattedValue = String(value).trim();
          }
        }
        rowData[headerName] = formattedValue;
      }

      if (!rowData["Phone Number"] || rowData["Phone Number"] === "N/A") {
        rowData["Phone Number"] = phoneNo;
      }

      const isLeadComplete =
        parsed.status === true ||
        String(parsed.status).toLowerCase() === "true" ||
        parsed.is_confirmed === true ||
        Object.keys(extractedVariables).length >= Math.max(1, configuredCustomVariables.length);

      if (sheetTarget?.spreadsheetId && isLeadComplete) {
        const { appendToGoogleSheet } = await import("@/lib/flows/integrations/google-sheets");

        targetSheetId = sheetTarget.spreadsheetId;
        targetSheetName = sheetTarget.sheetName || "Leads";
        exportedRowData = rowData;

        await appendToGoogleSheet(
          targetSheetId,
          targetSheetName,
          rowData,
          organizationId
        ).catch((err: any) => {
          logger.flow.error(`[LeadSaver] Failed to append row to Google Sheet: ${err.message}`);
        });

        isSheetSaved = true;
        logger.flow.success(`[LeadSaver] Saved completed custom variables (${Object.keys(rowData).length} columns) to sheet for contact ${contactId}`);
      } else if (sheetTarget?.spreadsheetId && !isLeadComplete) {
        logger.flow.info(`[LeadSaver] In-progress conversation. Updated contact attributes in DB; skipping sheet export until completion.`);
      }
    }
  } catch (err: any) {
    logger.flow.error(`[LeadSaver] Error processing lead attributes or sheet save: ${err.message}`);
  }

  // 5. Log Execution History to AIAgentExecution table
  if (organizationId) {
    try {
      const { logAIAgentExecution } = await import("@/app/actions/ai-executions");
      await logAIAgentExecution({
        organizationId,
        contactId,
        contactName: contactName || fullNameFromParsed(parsed) || "Customer",
        contactPhone,
        aiAgentId: resolvedAgentId,
        aiAgentName: resolvedAgentName || "AI Agent",
        provider: resolvedProvider || "openai",
        model: resolvedModel || "gpt-4o-mini",
        userPrompt: userPrompt || "Customer Query",
        retrievedChunks: retrievedChunks || [],
        systemPromptUsed: resolvedSystemPrompt || "",
        rawAiOutput: rawAiResponse,
        parsedMessage: textMessage,
        extractedLeadData: parsed,
        sheetSaved: isSheetSaved,
        spreadsheetId: targetSheetId,
        sheetName: targetSheetName,
        sheetRowData: exportedRowData || undefined,
        durationMs: durationMs || 0,
        status: "success",
      });
    } catch (err: any) {
      console.error("[LeadSaver Execution Log Failed]:", err.message);
    }
  }

  return {
    textMessage,
    isJson: true,
    parsedData: parsed,
    media: extractedMedia,
    intent: parsed.intent || undefined,
    order: parsed.order || undefined,
    appointment: parsed.appointment || undefined,
  };
}

function fullNameFromParsed(parsed: any): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  return parsed.full_name || parsed.name || parsed.customer_name || null;
}
