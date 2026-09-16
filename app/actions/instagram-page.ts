"use server";

import { getServerSession } from "next-auth";
import { logActivity } from "@/lib/activityLog";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { internalSendInstagramMessage } from "@/lib/instagram/api";

type InstagramProfile = {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramStory = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
};

type GraphErrorResponse = {
  error?: {
    message?: string;
  };
};

type GraphProfileResponse = InstagramProfile & GraphErrorResponse;
type GraphMediaResponse = {
  data?: InstagramMedia[];
} & GraphErrorResponse;

type GraphStoriesResponse = {
  data?: InstagramStory[];
} & GraphErrorResponse;

type InstagramComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  replies?: {
    data?: Array<{
      id: string;
      text?: string;
      username?: string;
      timestamp?: string;
    }>;
  };
};

type GraphCommentsResponse = {
  data?: InstagramComment[];
} & GraphErrorResponse;

type GraphReplyResponse = {
  id?: string;
} & GraphErrorResponse;

type GraphPagesResponse = {
  data?: Array<{
    id: string;
    name?: string;
    tasks?: string[];
    instagram_business_account?: {
      id: string;
    };
  }>;
} & GraphErrorResponse;

import { generateSocialCommentAiReply } from "@/lib/ai/social-comment-ai";

export type InstagramKeywordRule = {
  id: string;
  keyword: string;
  matchType: 'contains' | 'exact' | 'starts_with';
  publicReplyText?: string;
  autoLike?: boolean;
};

export type InstagramPostAutomationRule = {
  postId: string; // post ID or "ALL" for global default
  enabled: boolean;
  keywords: InstagramKeywordRule[];
  defaultReply?: {
    enabled: boolean;
    publicReplyText?: string;
    autoLike?: boolean;
  };
  aiAgent?: {
    enabled: boolean;
    agentId?: string;
    autoLike?: boolean;
    customPrompt?: string;
  };
};

export type InstagramStoryAutomationRule = {
  storyId: string; // story ID or "ALL_STORIES"
  enabled: boolean;
  keywords: InstagramKeywordRule[];
  defaultReply?: {
    enabled: boolean;
    dmReplyText?: string;
  };
  aiAgent?: {
    enabled: boolean;
    agentId?: string;
    customPrompt?: string;
  };
};

export type InstagramAutoCommentRule = {
  postId: string;
  replyText: string;
};

export type InstagramAutoCommentConfig = {
  enabled: boolean;
  replyText: string;
  rules: InstagramAutoCommentRule[];
  postRules: InstagramPostAutomationRule[];
  globalRule?: InstagramPostAutomationRule;
  storyRules?: InstagramStoryAutomationRule[];
  globalStoryRule?: InstagramStoryAutomationRule;
};

export async function parseInstagramAutoCommentConfig(
  rawValue: string | null | undefined,
): Promise<InstagramAutoCommentConfig> {
  if (!rawValue) return { enabled: false, replyText: "", rules: [], postRules: [], storyRules: [] };
  try {
    const parsed = JSON.parse(rawValue) as {
      instagramAutoCommentEnabled?: boolean;
      instagramAutoCommentReplyText?: string;
      instagramAutoCommentRules?: Array<{
        postId?: string;
        replyText?: string;
      }>;
      instagramPostAutomationRules?: InstagramPostAutomationRule[];
      instagramGlobalAutomationRule?: InstagramPostAutomationRule;
      instagramStoryAutomationRules?: InstagramStoryAutomationRule[];
      instagramGlobalStoryAutomationRule?: InstagramStoryAutomationRule;
    };

    const legacyRules: Array<{ postId: string; replyText: string }> = Array.isArray(parsed.instagramAutoCommentRules)
      ? parsed.instagramAutoCommentRules
          .map((rule) => ({
            postId: typeof rule?.postId === "string" ? rule.postId.trim() : "",
            replyText:
              typeof rule?.replyText === "string" ? rule.replyText.trim() : "",
          }))
          .filter((rule) => !!rule.postId && !!rule.replyText)
      : [];

    let postRules: InstagramPostAutomationRule[] = Array.isArray(parsed.instagramPostAutomationRules)
      ? parsed.instagramPostAutomationRules
      : [];

    if (postRules.length === 0 && legacyRules.length > 0) {
      postRules = legacyRules.map((r) => ({
        postId: r.postId,
        enabled: true,
        keywords: [],
        defaultReply: {
          enabled: true,
          publicReplyText: r.replyText,
          autoLike: false,
        },
      }));
    }

    const globalRule = parsed.instagramGlobalAutomationRule || undefined;
    const storyRules: InstagramStoryAutomationRule[] = Array.isArray(parsed.instagramStoryAutomationRules)
      ? parsed.instagramStoryAutomationRules
      : [];
    const globalStoryRule = parsed.instagramGlobalStoryAutomationRule || undefined;

    return {
      enabled: !!parsed.instagramAutoCommentEnabled,
      replyText:
        typeof parsed.instagramAutoCommentReplyText === "string"
          ? parsed.instagramAutoCommentReplyText.trim()
          : "",
      rules: legacyRules,
      postRules,
      globalRule,
      storyRules,
      globalStoryRule,
    };
  } catch {
    return { enabled: false, replyText: "", rules: [], postRules: [], storyRules: [] };
  }
}
function pickPreferredInstagramAccount(
  pages: NonNullable<GraphPagesResponse["data"]>,
) {
  const withInstagram = pages.filter(
    (page) => page.instagram_business_account?.id,
  );
  if (withInstagram.length === 0) return null;

  const hasTask = (page: { tasks?: string[] }, task: string) =>
    Array.isArray(page.tasks) && page.tasks.includes(task);

  const preferred =
    withInstagram.find((page) => hasTask(page, "MESSAGING")) ||
    withInstagram.find((page) => hasTask(page, "MANAGE")) ||
    withInstagram[0];

  return preferred?.instagram_business_account?.id || null;
}

async function resolveOrgInstagramContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      instagramBusinessId: true,
      metaAccessToken: true,
      instagramAccessToken: true,
      facebookPageAccessToken: true,
    },
  });

  const token = org?.facebookPageAccessToken || org?.instagramAccessToken || org?.metaAccessToken;

  if (!token) {
    throw new Error("Missing Meta access token. Reconnect Instagram first.");
  }

  let instagramBusinessId = org?.instagramBusinessId;

  if (!instagramBusinessId) {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,tasks,instagram_business_account{id}&access_token=${token}`,
    );
    const pagesData = (await pagesRes.json()) as GraphPagesResponse;

    if (pagesRes.ok && !pagesData?.error && Array.isArray(pagesData.data)) {
      const discoveredInstagramId = pickPreferredInstagramAccount(
        pagesData.data,
      );
      if (discoveredInstagramId) {
        instagramBusinessId = discoveredInstagramId;
        await prisma.organization.update({
          where: { id: session.user.organizationId },
          data: { instagramBusinessId: discoveredInstagramId },
        });
      }
    }
  }

  if (!instagramBusinessId) {
    throw new Error(
      "No Instagram business account is connected for this project.",
    );
  }

  return { token, instagramBusinessId };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export type GetInstagramDataOptions = {
  limit?: number;
  after?: string;
  fetchAll?: boolean;
};

export async function getConnectedInstagramAccountData(
  optionsOrLimit?: GetInstagramDataOptions | number
) {
  const { token, instagramBusinessId } = await resolveOrgInstagramContext();
  const igId = instagramBusinessId;

  const profileRes = await fetch(
    `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count&access_token=${token}`,
  );
  const profileData = (await profileRes.json()) as GraphProfileResponse;
  if (!profileRes.ok || profileData?.error) {
    throw new Error(
      profileData?.error?.message || "Failed to fetch Instagram profile.",
    );
  }

  const opts: GetInstagramDataOptions =
    typeof optionsOrLimit === 'number'
      ? { limit: optionsOrLimit }
      : optionsOrLimit || { fetchAll: true };

  const fetchAll = opts.fetchAll ?? (opts.limit === undefined || opts.limit === 0);
  const targetLimit = fetchAll ? Infinity : Math.max(1, opts.limit || 50);
  const batchSize = Math.min(targetLimit === Infinity ? 100 : targetLimit, 100);

  const allMedia: InstagramMedia[] = [];
  const afterParam = opts.after ? `&after=${encodeURIComponent(opts.after)}` : '';
  let nextMediaUrl: string | null = `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${batchSize}${afterParam}&access_token=${token}`;
  let lastAfterCursor: string | null = null;
  let hasMore = false;

  let iterations = 0;
  const maxIterations = fetchAll ? 100 : Math.ceil(targetLimit / 100);

  while (nextMediaUrl && allMedia.length < targetLimit && iterations < maxIterations) {
    iterations++;
    const mediaRes = await fetchWithTimeout(nextMediaUrl, 15000);
    const mediaData = (await mediaRes.json()) as any;
    if (!mediaRes.ok || mediaData?.error) {
      if (allMedia.length > 0) {
        break;
      }
      throw new Error(
        mediaData?.error?.message || "Failed to fetch Instagram posts.",
      );
    }

    const fetched: InstagramMedia[] = Array.isArray(mediaData?.data) ? mediaData.data : [];
    if (fetched.length === 0) {
      break;
    }

    allMedia.push(...fetched);
    lastAfterCursor = mediaData?.paging?.cursors?.after || null;
    nextMediaUrl = mediaData?.paging?.next || null;
    hasMore = !!nextMediaUrl;

    if (allMedia.length >= targetLimit) {
      break;
    }
  }

  let storiesData: GraphStoriesResponse = { data: [] };
  try {
    const storiesRes = await fetchWithTimeout(
      `https://graph.facebook.com/v21.0/${igId}/stories?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50&access_token=${token}`,
      12000,
    );
    const parsedStories = (await storiesRes.json()) as GraphStoriesResponse;
    if (storiesRes.ok && !parsedStories?.error) {
      storiesData = parsedStories;
    } else {
      console.warn(
        "[InstagramStories] Failed to fetch stories:",
        parsedStories?.error?.message || "Unknown error",
      );
    }
  } catch (storiesError) {
    console.warn(
      "[InstagramStories] Network error while fetching stories:",
      storiesError,
    );
  }

  return {
    profile: {
      id: profileData.id,
      username: profileData.username || "",
      name: profileData.name || "",
      biography: profileData.biography || "",
      profilePictureUrl: profileData.profile_picture_url || "",
      followersCount: profileData.followers_count ?? 0,
      followsCount: profileData.follows_count ?? 0,
      mediaCount: profileData.media_count ?? 0,
    },
    media: targetLimit === Infinity ? allMedia : allMedia.slice(0, targetLimit),
    stories: storiesData.data || [],
    nextCursor: lastAfterCursor,
    hasNextPage: hasMore,
  };
}

export async function getInstagramActiveStories() {
    try {
        const { token, instagramBusinessId } = await resolveOrgInstagramContext();
        const storiesRes = await fetchWithTimeout(
            `https://graph.facebook.com/v21.0/${instagramBusinessId}/stories?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${token}`,
            12000,
        );
        const parsedStories = (await storiesRes.json()) as GraphStoriesResponse;
        return parsedStories.data || [];
    } catch (err) {
        console.error('[InstagramStoriesAction] Error:', err);
        return [];
    }
}

export async function getConnectedInstagramPostComments(
  mediaId: string,
  limit = 50,
) {
  if (!mediaId) {
    throw new Error("Media ID is required.");
  }

  const { token } = await resolveOrgInstagramContext();
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const commentsUrl = `https://graph.facebook.com/v21.0/${mediaId}/comments?fields=id,text,username,replies{id,text,username}&limit=${safeLimit}&access_token=${token}`;
  let commentsRes: Response | null = null;
  let commentsData: GraphCommentsResponse | null = null;

  // Retry once on transient network failures/timeouts.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      commentsRes = await fetchWithTimeout(commentsUrl, 12000);
      commentsData = (await commentsRes.json()) as GraphCommentsResponse;
      break;
    } catch (error) {
      const isLastAttempt = attempt === 2;
      if (isLastAttempt) {
        console.error(
          "[InstagramComments] Network error while fetching comments:",
          error,
        );
        return {
          mediaId,
          comments: [],
          warning: "Instagram comments API timed out. Please try again.",
        };
      }
    }
  }

  if (!commentsRes || !commentsData) {
    return {
      mediaId,
      comments: [],
      warning: "Instagram comments are temporarily unavailable.",
    };
  }

  if (!commentsRes.ok || commentsData?.error) {
    throw new Error(
      commentsData?.error?.message ||
        "Failed to fetch comments for this Instagram post.",
    );
  }

  return {
    mediaId,
    comments: commentsData.data || [],
  };
}

export async function replyToConnectedInstagramComment(
  commentId: string,
  message: string,
) {
  if (!commentId) {
    throw new Error("Comment ID is required.");
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error("Reply message cannot be empty.");
  }

  if (trimmedMessage.length > 1000) {
    throw new Error("Reply message is too long (max 1000 characters).");
  }

  const { token } = await resolveOrgInstagramContext();
  const form = new URLSearchParams({
    message: trimmedMessage,
    access_token: token,
  });

  const replyRes = await fetch(
    `https://graph.facebook.com/v21.0/${commentId}/replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
  );
  const replyData = (await replyRes.json()) as GraphReplyResponse;

  if (!replyRes.ok || replyData?.error || !replyData?.id) {
    const errorMsg = replyData?.error?.message || "Failed to publish Instagram comment reply.";
    if (errorMsg.includes("Missing Permission") || errorMsg.includes("#100")) {
      throw new Error(
        "Meta Error: (#100) Missing Permission (instagram_manage_comments). Please go to Settings and click 'Reconnect Instagram' to grant the newly added comment permission."
      );
    }
    throw new Error(errorMsg);
  }

  return { success: true, replyId: replyData.id };
}

export async function sendConnectedInstagramMessage(
  contactId: string,
  message: string,
  skipSessionCheck: boolean = false,
  mediaUrl?: string,
  buttons?: any,
) {
  try {
    let userId: string | undefined;

    if (!skipSessionCheck) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.organizationId || !session.user.id) {
        return { success: false, error: "Unauthorized" };
      }
      userId = session.user.id;
    }

    const trimmed = message.trim();
    if (!trimmed && !mediaUrl) {
      return { success: false, error: "Message cannot be empty." };
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { organization: true },
    });

    if (!contact) {
      return { success: false, error: "Contact not found." };
    }

    if (!skipSessionCheck) {
      const session = await getServerSession(authOptions);
      if (contact.organizationId !== session?.user?.organizationId) {
        return { success: false, error: "Contact not found." };
      }
    }

    if (contact.platform !== "INSTAGRAM") {
      return {
        success: false,
        error: "Selected contact is not an Instagram chat.",
      };
    }

    const interactiveData = buttons ? { action: { buttons } } : undefined;

    const newMessage = await internalSendInstagramMessage(
      contactId,
      trimmed,
      contact,
      userId,
      interactiveData,
      mediaUrl
    );
    return { success: true, data: newMessage };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send Instagram message.",
    };
  }
}

export async function getInstagramAutoCommentRules() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { businessDescription: true },
  });
  const config = await parseInstagramAutoCommentConfig(org?.businessDescription);
  return {
    enabled: config.enabled,
    defaultReplyText: config.replyText,
    rules: config.rules,
  };
}

export async function getInstagramPostAutomations() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { businessDescription: true },
  });

  const config = await parseInstagramAutoCommentConfig(org?.businessDescription);

  const aiAgents = await prisma.aIAgent.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true, isDefault: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    enabled: config.enabled,
    defaultReplyText: config.replyText,
    postRules: config.postRules || [],
    globalRule: config.globalRule || null,
    aiAgents,
  };
}

export async function saveInstagramPostAutomation(rule: InstagramPostAutomationRule) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");
  if (!rule?.postId) throw new Error("Post/Media ID is required");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) throw new Error("Organization not found");

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existingConfig = await parseInstagramAutoCommentConfig(org.businessDescription);

  if (rule.postId === "ALL") {
    const nextBusiness = {
      ...parsedBusiness,
      instagramAutoCommentEnabled: true,
      instagramGlobalAutomationRule: rule,
    };
    await prisma.organization.update({
      where: { id: org.id },
      data: { businessDescription: JSON.stringify(nextBusiness) },
    });
    return { success: true, rule, isGlobal: true };
  }

  const nextRules = [...(existingConfig.postRules || [])];
  const idx = nextRules.findIndex((r) => r.postId === rule.postId);
  if (idx >= 0) {
    nextRules[idx] = rule;
  } else {
    nextRules.push(rule);
  }

  const nextBusiness = {
    ...parsedBusiness,
    instagramAutoCommentEnabled: true,
    instagramPostAutomationRules: nextRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return { success: true, rule, postRules: nextRules };
}

export async function deleteInstagramPostAutomation(postId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) throw new Error("Organization not found");

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existingConfig = await parseInstagramAutoCommentConfig(org.businessDescription);

  if (postId === "ALL") {
    const { instagramGlobalAutomationRule, ...rest } = parsedBusiness as any;
    await prisma.organization.update({
      where: { id: org.id },
      data: { businessDescription: JSON.stringify(rest) },
    });
    return { success: true, deleted: true, isGlobal: true };
  }

  const nextRules = (existingConfig.postRules || []).filter((r) => r.postId !== postId);
  const nextBusiness = {
    ...parsedBusiness,
    instagramPostAutomationRules: nextRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return { success: true, deleted: true };
}

export async function saveInstagramAutoCommentRule(
  mediaId: string,
  replyText: string,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const normalizedMediaId = mediaId.trim();
  const normalizedReplyText = replyText.trim();
  if (!normalizedMediaId) throw new Error("Media ID is required.");
  if (!normalizedReplyText) throw new Error("Reply text is required.");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) throw new Error("Organization not found.");

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();
  const existing = await parseInstagramAutoCommentConfig(org.businessDescription);
  const nextRules = [...existing.rules];
  const existingIndex = nextRules.findIndex(
    (rule) => rule.postId === normalizedMediaId,
  );
  if (existingIndex >= 0) {
    nextRules[existingIndex] = {
      postId: normalizedMediaId,
      replyText: normalizedReplyText,
    };
  } else {
    nextRules.push({
      postId: normalizedMediaId,
      replyText: normalizedReplyText,
    });
  }

  const nextBusiness = {
    ...parsedBusiness,
    instagramAutoCommentEnabled: true,
    instagramAutoCommentReplyText: existing.replyText || "",
    instagramAutoCommentRules: nextRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return { success: true, rules: nextRules };
}

export async function executeInstagramCommentAutomation(params: {
  organizationId: string;
  commentId: string;
  mediaId?: string;
  commentText: string;
  commenterName?: string;
  commenterId?: string;
}) {
  const { organizationId, commentId, mediaId, commentText, commenterName, commenterId } = params;
  if (!organizationId || !commentId) return { handled: false, reason: "Missing parameters" };

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        businessDescription: true,
        metaAccessToken: true,
        facebookPageAccessToken: true,
        instagramAccessToken: true,
      },
    });

    if (!org) return { handled: false, reason: "Org not found" };

    const token = org.facebookPageAccessToken || org.instagramAccessToken || org.metaAccessToken;
    if (!token) return { handled: false, reason: "No access token" };

    const config = await parseInstagramAutoCommentConfig(org.businessDescription);
    if (!config.enabled) return { handled: false, reason: "Automation disabled" };

    const replyMarkerId = `ig_auto_reply_${commentId}`;
    const existingReply = await prisma.message.findUnique({
      where: { wamid: replyMarkerId },
      select: { id: true },
    });
    if (existingReply) return { handled: false, reason: "Already replied" };

    const contact = commenterId
      ? await prisma.contact.findFirst({
          where: { organizationId: org.id, waId: String(commenterId), platform: "INSTAGRAM" },
        })
      : null;

    const rule = (mediaId ? config.postRules.find((r) => r.postId === mediaId && r.enabled) : undefined)
      || (config.globalRule?.enabled ? config.globalRule : undefined);

    const displayName = commenterName || "there";
    const formatText = (text: string) =>
      text.replace(/\{name\}/gi, displayName).replace(/\{user\}/gi, displayName);

    // --- STRATEGY A: Keyword Rules ---
    if (rule?.keywords && rule.keywords.length > 0) {
      const lower = commentText.toLowerCase().trim();
      for (const kw of rule.keywords) {
        if (!kw.keyword) continue;
        const kwLower = kw.keyword.toLowerCase().trim();
        let isMatch = false;
        if (kw.matchType === 'exact') {
          isMatch = lower === kwLower;
        } else if (kw.matchType === 'starts_with') {
          isMatch = lower.startsWith(kwLower);
        } else {
          isMatch = lower.includes(kwLower);
        }

        if (isMatch && kw.publicReplyText) {
          const publicReply = formatText(kw.publicReplyText);
          const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: publicReply, access_token: token }),
          });
          const replyData = await replyRes.json();
          if (replyRes.ok && replyData?.id) {
            if (contact) {
              await prisma.message.create({
                data: {
                  contactId: contact.id,
                  wamid: replyMarkerId,
                  type: "comment_reply",
                  direction: "outbound",
                  platform: "INSTAGRAM",
                  status: "sent",
                  content: publicReply,
                  rawBody: { autoReplyForCommentId: commentId, matchedKeyword: kw.keyword } as any,
                },
              }).catch(() => {});
            }
            return { handled: true, type: "keyword", keyword: kw.keyword };
          }
        }
      }
    }

    // --- STRATEGY B: AI Agent Intelligence ---
    if (rule?.aiAgent?.enabled) {
      const aiReply = await generateSocialCommentAiReply({
        organizationId,
        agentId: rule.aiAgent.agentId,
        commenterName: displayName,
        commentText,
        customPrompt: rule.aiAgent.customPrompt,
        channel: "comment",
      });

      if (aiReply) {
        const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: aiReply, access_token: token }),
        });
        const replyData = await replyRes.json();
        if (replyRes.ok && replyData?.id) {
          if (contact) {
            await prisma.message.create({
              data: {
                contactId: contact.id,
                wamid: replyMarkerId,
                type: "comment_reply",
                direction: "outbound",
                platform: "INSTAGRAM",
                status: "sent",
                content: aiReply,
                rawBody: { autoReplyForCommentId: commentId, aiGenerated: true, agentId: rule.aiAgent.agentId } as any,
              },
            }).catch(() => {});
          }
          return { handled: true, type: "ai", response: aiReply };
        }
      }
    }

    // --- STRATEGY C: Default Fallback Reply ---
    if (rule?.defaultReply?.enabled && rule.defaultReply.publicReplyText) {
      const replyMsg = formatText(rule.defaultReply.publicReplyText);
      const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMsg, access_token: token }),
      });
      const replyData = await replyRes.json();
      if (replyRes.ok && replyData?.id) {
        if (contact) {
          await prisma.message.create({
            data: {
              contactId: contact.id,
              wamid: replyMarkerId,
              type: "comment_reply",
              direction: "outbound",
              platform: "INSTAGRAM",
              status: "sent",
              content: replyMsg,
              rawBody: { autoReplyForCommentId: commentId, isDefault: true } as any,
            },
          }).catch(() => {});
        }
        return { handled: true, type: "default" };
      }
    }

    // --- STRATEGY D: Legacy Default Fallback ---
    if (config.replyText && config.replyText.trim()) {
      const legacyReply = formatText(config.replyText);
      const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: legacyReply, access_token: token }),
      });
      const replyData = await replyRes.json();
      if (replyRes.ok && replyData?.id) {
        return { handled: true, type: "legacy_default" };
      }
    }

    return { handled: false, reason: "No rule matched" };
  } catch (err: any) {
    console.warn(`[IG_AUTO_COMMENT] Execution failed: ${err?.message}`);
    return { handled: false, error: err?.message };
  }
}

export async function getInstagramStoryAutomations() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { businessDescription: true },
  });

  const config = await parseInstagramAutoCommentConfig(org?.businessDescription);

  const aiAgents = await prisma.aIAgent.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true, isDefault: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    enabled: config.enabled,
    storyRules: config.storyRules || [],
    globalStoryRule: config.globalStoryRule || null,
    aiAgents,
  };
}

export async function saveInstagramStoryAutomation(rule: InstagramStoryAutomationRule) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");
  if (!rule?.storyId) throw new Error("Story ID is required");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) throw new Error("Organization not found");

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existingConfig = await parseInstagramAutoCommentConfig(org.businessDescription);

  if (rule.storyId === "ALL_STORIES") {
    const nextBusiness = {
      ...parsedBusiness,
      instagramAutoCommentEnabled: true,
      instagramGlobalStoryAutomationRule: rule,
    };
    await prisma.organization.update({
      where: { id: org.id },
      data: { businessDescription: JSON.stringify(nextBusiness) },
    });
    return { success: true, rule, isGlobal: true };
  }

  const nextRules = [...(existingConfig.storyRules || [])];
  const idx = nextRules.findIndex((r) => r.storyId === rule.storyId);
  if (idx >= 0) {
    nextRules[idx] = rule;
  } else {
    nextRules.push(rule);
  }

  const nextBusiness = {
    ...parsedBusiness,
    instagramAutoCommentEnabled: true,
    instagramStoryAutomationRules: nextRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return { success: true, rule, storyRules: nextRules };
}

export async function deleteInstagramStoryAutomation(storyId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) throw new Error("Organization not found");

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existingConfig = await parseInstagramAutoCommentConfig(org.businessDescription);

  if (storyId === "ALL_STORIES") {
    const { instagramGlobalStoryAutomationRule, ...rest } = parsedBusiness as any;
    await prisma.organization.update({
      where: { id: org.id },
      data: { businessDescription: JSON.stringify(rest) },
    });
    return { success: true, deleted: true, isGlobal: true };
  }

  const nextRules = (existingConfig.storyRules || []).filter((r) => r.storyId !== storyId);
  const nextBusiness = {
    ...parsedBusiness,
    instagramStoryAutomationRules: nextRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return { success: true, deleted: true };
}

export async function executeInstagramStoryReplyAutomation(params: {
  organizationId: string;
  contactId: string;
  storyId?: string;
  messageText: string;
  senderId: string;
  contact?: any;
}) {
  const { organizationId, contactId, storyId, messageText, senderId, contact: providedContact } = params;
  if (!organizationId || !contactId) {
    return { handled: false, reason: "Missing required parameters" };
  }

  try {
    console.log(`[IG_STORY_AUTO] Processing story reply: org=${organizationId}, storyId=${storyId}, text="${messageText}"`);

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        businessDescription: true,
      },
    });
    if (!org) {
      console.warn(`[IG_STORY_AUTO] Org not found: ${organizationId}`);
      return { handled: false, reason: "Org not found" };
    }

    const config = await parseInstagramAutoCommentConfig(org.businessDescription);
    const storyRules = config.storyRules || [];
    const globalStoryRule = config.globalStoryRule;

    console.log(`[IG_STORY_AUTO] Configured story rules count: ${storyRules.length}, hasGlobalRule: ${!!globalStoryRule}`);

    const rule = (storyId ? storyRules.find((r) => String(r.storyId).trim() === String(storyId).trim() && r.enabled) : undefined)
      || (globalStoryRule?.enabled ? globalStoryRule : undefined);

    if (!rule) {
      console.log(`[IG_STORY_AUTO] No matching story rule found for storyId ${storyId} (and no active global story rule)`);
      return { handled: false, reason: "No story automation rule found" };
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { organization: true },
    });
    if (!contact) {
      console.warn(`[IG_STORY_AUTO] Contact not found: ${contactId}`);
      return { handled: false, reason: "Contact not found" };
    }

    const displayName = contact.name || contact.whatsappName || "there";
    const formatText = (text: string) =>
      text.replace(/\{name\}/gi, displayName).replace(/\{user\}/gi, displayName);

    const lower = (messageText || "").toLowerCase().trim();

    // 1. Keyword Matching
    if (rule.keywords && rule.keywords.length > 0) {
      for (const kw of rule.keywords) {
        if (!kw.keyword) continue;
        const kwLower = kw.keyword.toLowerCase().trim();
        let isMatch = false;
        if (kw.matchType === "exact") {
          isMatch = lower === kwLower;
        } else if (kw.matchType === "starts_with") {
          isMatch = lower.startsWith(kwLower);
        } else {
          isMatch = lower.includes(kwLower);
        }

        if (isMatch && kw.publicReplyText) {
          const replyText = formatText(kw.publicReplyText);
          console.log(`[IG_STORY_AUTO] Keyword matched ("${kw.keyword}"). Sending DM: "${replyText}"`);
          await internalSendInstagramMessage(contact.id, replyText, contact, undefined);
          return { handled: true, type: "keyword", keyword: kw.keyword, replyText };
        }
      }
    }

    // 2. AI Agent reply
    if (rule.aiAgent?.enabled) {
      console.log(`[IG_STORY_AUTO] Generating AI Agent reply for story reply...`);
      const aiReply = await generateSocialCommentAiReply({
        organizationId,
        agentId: rule.aiAgent.agentId,
        commenterName: displayName,
        commentText: messageText || "Story reaction",
        customPrompt: rule.aiAgent.customPrompt || "The customer replied to an Instagram story. Provide a helpful, engaging, and friendly response.",
        channel: "dm",
      });

      if (aiReply) {
        console.log(`[IG_STORY_AUTO] AI Agent generated DM reply: "${aiReply}". Sending...`);
        await internalSendInstagramMessage(contact.id, aiReply, contact, undefined);
        return { handled: true, type: "ai", replyText: aiReply };
      }
    }

    // 3. Default DM reply fallback
    if (rule.defaultReply?.enabled) {
      const rawText = rule.defaultReply.dmReplyText?.trim() || "Hi @{name}! Thanks for replying to our story!";
      const defaultText = formatText(rawText);
      console.log(`[IG_STORY_AUTO] Sending Default Story DM to contact ${contact.id}: "${defaultText}"`);
      await internalSendInstagramMessage(contact.id, defaultText, contact, undefined);
      return { handled: true, type: "default", replyText: defaultText };
    }

    console.log(`[IG_STORY_AUTO] No keyword matched, AI disabled, and Default DM disabled for story ${storyId}`);
    return { handled: false, reason: "No matching story action configured" };
  } catch (err: any) {
    console.error(`[IG_STORY_AUTO] Execution error: ${err?.message}`, err);
    return { handled: false, error: err?.message };
  }
}
