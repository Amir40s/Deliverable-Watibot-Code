'use server';

import { getServerSession } from 'next-auth';
import { logActivity } from "@/lib/activityLog";
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  internalSendFacebookMessage, 
  replyToFacebookComment, 
  likeFacebookComment,
  resolveFacebookPageAccessToken, 
  fetchFacebookSenderProfile, 
  internalSendMetaMediaMessage 
} from '@/lib/facebook/api';
import { generateSocialCommentAiReply } from '@/lib/ai/social-comment-ai';
import type { Prisma } from '@/lib/generated/prisma';

type FacebookPagePost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
};

type FacebookAccountsResponse = {
  data?: Array<{
    id: string;
    name?: string;
    access_token?: string;
    tasks?: string[];
  }>;
  error?: {
    message?: string;
  };
};

type FacebookPostsResponse = {
  data?: FacebookPagePost[];
  error?: {
    message?: string;
  };
};

type FacebookPostComment = {
  id: string;
  message?: string;
  created_time?: string;
  from?: {
    id?: string;
    name?: string;
  };
  permalink_url?: string;
  mediaUrl?: string;
};

type FacebookCommentsResponse = {
  data?: FacebookPostComment[];
  error?: {
    message?: string;
  };
};

export type FacebookKeywordRule = {
  id: string;
  keyword: string;
  matchType: 'contains' | 'exact' | 'starts_with';
  publicReplyText?: string;
  autoLike?: boolean;
};

export type FacebookPostAutomationRule = {
  postId: string; // post ID or "ALL" for global default
  enabled: boolean;
  keywords: FacebookKeywordRule[];
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

export type FacebookAutoCommentConfig = {
  enabled: boolean;
  globalRule?: FacebookPostAutomationRule;
  postRules: FacebookPostAutomationRule[];
  // Legacy compatibility fields
  replyText: string;
  rules: Array<{ postId: string; replyText: string }>;
};

function parseFacebookAutoCommentConfig(rawValue: string | null | undefined): FacebookAutoCommentConfig {
  if (!rawValue) {
    return { enabled: false, replyText: '', rules: [], postRules: [] };
  }
  try {
    const parsed = JSON.parse(rawValue) as any;
    
    // Convert legacy rules if new structure isn't populated
    const legacyRules: Array<{ postId: string; replyText: string }> = Array.isArray(parsed.facebookAutoCommentRules)
      ? parsed.facebookAutoCommentRules
          .map((rule: any) => ({
            postId: typeof rule?.postId === 'string' ? rule.postId.trim() : '',
            replyText: typeof rule?.replyText === 'string' ? rule.replyText.trim() : '',
          }))
          .filter((rule: any) => !!rule.postId && !!rule.replyText)
      : [];

    let postRules: FacebookPostAutomationRule[] = Array.isArray(parsed.facebookPostAutomationRules)
      ? parsed.facebookPostAutomationRules
      : [];

    // If no new postRules exist, migrate legacy rules seamlessly
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

    const globalRule: FacebookPostAutomationRule | undefined = parsed.facebookGlobalAutomationRule || undefined;

    return {
      enabled: !!parsed.facebookAutoCommentEnabled,
      replyText: typeof parsed.facebookAutoCommentReplyText === 'string' ? parsed.facebookAutoCommentReplyText : '',
      rules: legacyRules,
      postRules,
      globalRule,
    };
  } catch {
    return { enabled: false, replyText: '', rules: [], postRules: [] };
  }
}

function extractPostLeafId(postId: string): string {
  const trimmed = postId.trim();
  const parts = trimmed.split('_').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

export type GetFacebookPostsOptions = {
  limit?: number;
  after?: string;
  fetchAll?: boolean;
};

export async function getConnectedFacebookPagePosts(
  optionsOrLimit?: GetFacebookPostsOptions | number
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      facebookPageId: true,
      facebookPageName: true,
      metaAccessToken: true,
    },
  });

  if (!org?.facebookPageId) {
    throw new Error('No Facebook Page is connected for this project.');
  }
  if (!org.metaAccessToken) {
    throw new Error('Missing Meta access token. Reconnect Facebook Page first.');
  }

  // Resolve latest page access token using the stored user token or direct PAT.
  const matchedPageToken = await resolveFacebookPageAccessToken(session.user.organizationId);

  const opts: GetFacebookPostsOptions =
    typeof optionsOrLimit === 'number'
      ? { limit: optionsOrLimit }
      : optionsOrLimit || { fetchAll: true };

  const fetchAll = opts.fetchAll ?? (opts.limit === undefined || opts.limit === 0);
  const targetLimit = fetchAll ? Infinity : Math.max(1, opts.limit || 50);
  const batchSize = Math.min(targetLimit === Infinity ? 100 : targetLimit, 100);

  const allPosts: FacebookPagePost[] = [];
  const afterParam = opts.after ? `&after=${encodeURIComponent(opts.after)}` : '';
  let nextUrl: string | null = `https://graph.facebook.com/v21.0/${org.facebookPageId}/posts?fields=id,message,created_time,permalink_url,full_picture,attachments{media,target}&limit=${batchSize}${afterParam}&access_token=${matchedPageToken}`;
  let lastAfterCursor: string | null = null;
  let hasMore = false;

  let iterations = 0;
  const maxIterations = fetchAll ? 100 : Math.ceil(targetLimit / 100);

  while (nextUrl && allPosts.length < targetLimit && iterations < maxIterations) {
    iterations++;
    const postsRes = await fetchWithTimeout(nextUrl, 15000);
    const postsData = (await postsRes.json()) as any;
    if (!postsRes.ok || postsData?.error) {
      if (allPosts.length > 0) {
        break;
      }
      throw new Error(postsData?.error?.message || 'Failed to fetch Facebook posts.');
    }

    const fetched: FacebookPagePost[] = Array.isArray(postsData?.data) ? postsData.data : [];
    if (fetched.length === 0) {
      break;
    }

    allPosts.push(...fetched);
    lastAfterCursor = postsData?.paging?.cursors?.after || null;
    nextUrl = postsData?.paging?.next || null;
    hasMore = !!nextUrl;

    if (allPosts.length >= targetLimit) {
      break;
    }
  }

  return {
    pageId: org.facebookPageId,
    pageName: org.facebookPageName || 'Unnamed Page',
    posts: targetLimit === Infinity ? allPosts : allPosts.slice(0, targetLimit),
    nextCursor: lastAfterCursor,
    hasNextPage: hasMore,
  };
}



async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getConnectedFacebookPostComments(postId: string, limit = 20) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  if (!postId) {
    throw new Error('Post ID is required.');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      facebookPageId: true,
      metaAccessToken: true,
    },
  });

  if (!org?.facebookPageId) {
    throw new Error('No Facebook Page is connected for this project.');
  }

  if (!org.metaAccessToken) {
    throw new Error('Missing Meta access token. Reconnect Facebook Page first.');
  }

  const cleanPostId = postId.trim();
  const targetLeafId = extractPostLeafId(cleanPostId);
  const targetPostId = cleanPostId.includes('_')
    ? cleanPostId
    : `${org.facebookPageId}_${cleanPostId}`;

  // Helper to retrieve live webhook-saved comments from local database
  const getFallbackComments = async () => {
    const localComments = await prisma.message.findMany({
      where: {
        platform: 'FACEBOOK',
        type: 'comment',
      },
      include: { contact: { select: { waId: true, name: true, organizationId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return localComments
      .filter((msg) => {
        const raw = (msg.rawBody || {}) as any;
        const rawPostId = raw.post_id || raw.parent_id || raw.post?.id || '';
        return (
          rawPostId === cleanPostId ||
          rawPostId === targetPostId ||
          extractPostLeafId(rawPostId) === targetLeafId
        );
      })
      .map((msg) => {
        const raw = (msg.rawBody || {}) as any;
        const content =
          msg.content === '[Facebook comment]' || msg.content === '[Media comment]'
            ? (raw.message || msg.content)
            : msg.content;

        return {
          id: raw.comment_id || msg.wamid || msg.id,
          message: content || undefined,
          created_time: msg.createdAt.toISOString(),
          from: {
            id: raw.from?.id || msg.contact?.waId || undefined,
            name: raw.from?.name || msg.contact?.name || undefined,
          },
          permalink_url: raw.post?.permalink_url || undefined,
          mediaUrl: msg.mediaUrl || undefined,
        };
      });
  };

  try {
    // 1. Resolve page access token
    const matchedPageToken = await resolveFacebookPageAccessToken(session.user.organizationId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    // 2. Multi-strategy Graph API fetch
    let rawComments: any[] = [];
    let fetchSucceeded = false;

    try {
      // Strategy A: Direct /{targetPostId}/comments with basic fields
      let commentsRes = await fetchWithTimeout(
        `https://graph.facebook.com/v21.0/${targetPostId}/comments?fields=id,message,created_time,from,permalink_url,attachment&limit=${safeLimit}&access_token=${matchedPageToken}`
      );
      let commentsData = (await commentsRes.json()) as any;

      // If restricted by (#10) pages_read_user_content due to `from` field, retry without `from`
      if (!commentsRes.ok && commentsData?.error?.code === 10) {
        commentsRes = await fetchWithTimeout(
          `https://graph.facebook.com/v21.0/${targetPostId}/comments?fields=id,message,created_time,permalink_url,attachment&limit=${safeLimit}&access_token=${matchedPageToken}`
        );
        commentsData = (await commentsRes.json()) as any;
      }

      // If targetPostId failed and differed from cleanPostId, try with cleanPostId
      if (!commentsRes.ok && cleanPostId !== targetPostId) {
        commentsRes = await fetchWithTimeout(
          `https://graph.facebook.com/v21.0/${cleanPostId}/comments?fields=id,message,created_time,permalink_url,attachment&limit=${safeLimit}&access_token=${matchedPageToken}`
        );
        commentsData = (await commentsRes.json()) as any;
      }

      // Strategy B: Fetch via post object { comments { ... } }
      if (!commentsRes.ok) {
        const postNodeRes = await fetchWithTimeout(
          `https://graph.facebook.com/v21.0/${targetPostId}?fields=comments.limit(${safeLimit}){id,message,created_time,permalink_url,attachment}&access_token=${matchedPageToken}`
        );
        const postNodeData = (await postNodeRes.json()) as any;
        if (postNodeRes.ok && postNodeData?.comments?.data) {
          rawComments = postNodeData.comments.data;
          fetchSucceeded = true;
        }
      } else if (Array.isArray(commentsData?.data)) {
        rawComments = commentsData.data;
        fetchSucceeded = true;
      }
    } catch (graphErr: any) {
      console.warn('[FB_COMMENTS] Graph API fetch error:', graphErr?.message);
    }

    // 3. Merge Graph API comments + DB (webhook) comments
    const fallbackComments = await getFallbackComments();
    const seenIds = new Set<string>();
    const mergedList: any[] = [];

    // Add Graph API comments
    if (fetchSucceeded && rawComments.length > 0) {
      for (const c of rawComments) {
        if (!c.id || seenIds.has(c.id)) continue;
        seenIds.add(c.id);

        let message = c.message;
        const mediaUrl = c.attachment?.media?.image?.src || c.attachment?.url || undefined;
        if (!message && c.attachment) {
          const type = c.attachment.type || 'Media';
          message = `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;
        }

        let displayName = c.from?.name;
        if (!displayName || displayName === 'Facebook User') {
          const localContact = await prisma.contact.findFirst({
            where: {
              organizationId: session.user.organizationId,
              platform: 'FACEBOOK',
              waId: c.from?.id,
            },
            select: { name: true },
          });
          if (localContact?.name) {
            displayName = localContact.name;
          }
        }

        mergedList.push({
          id: c.id,
          message: message || '[No text content]',
          created_time: c.created_time,
          from: {
            id: c.from?.id,
            name: displayName || c.from?.name || 'Facebook User',
          },
          permalink_url: c.permalink_url,
          mediaUrl,
        });
      }
    }

    // Add local webhook comments
    for (const fbComment of fallbackComments) {
      if (!seenIds.has(fbComment.id)) {
        seenIds.add(fbComment.id);
        mergedList.push(fbComment);
      }
    }

    // Sort by created_time descending
    mergedList.sort((a, b) => {
      const tA = new Date(a.created_time || 0).getTime();
      const tB = new Date(b.created_time || 0).getTime();
      return tB - tA;
    });

    return {
      postId: cleanPostId,
      comments: mergedList,
    };
  } catch (error: any) {
    console.error('[FB_COMMENTS] Network error or timeout:', error.message);
    return { postId: cleanPostId, comments: await getFallbackComments() };
  }
}

export async function sendConnectedFacebookMessage(
  contactId: string,
  message: string,
  skipSessionCheck: boolean = false,
  mediaUrl?: string
) {
  try {
    let userId: string | undefined;

    if (!skipSessionCheck) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.organizationId || !session.user.id) {
        return { success: false, error: 'Unauthorized' };
      }
      userId = session.user.id;
    }

    const trimmed = message.trim();
    if (!trimmed && !mediaUrl) {
      return { success: false, error: 'Message cannot be empty.' };
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { organization: true },
    });

    if (!contact) {
      return { success: false, error: 'Contact not found.' };
    }

    if (!skipSessionCheck) {
      const session = await getServerSession(authOptions);
      if (contact.organizationId !== session?.user?.organizationId) {
        return { success: false, error: 'Contact not found.' };
      }
    }

    if (contact.platform !== 'FACEBOOK') {
      return { success: false, error: 'Selected contact is not a Facebook chat.' };
    }

    let newMessage: any;
    if (mediaUrl) {
      let type: 'image' | 'video' | 'audio' | 'file' = 'image';
      const lowercaseUrl = mediaUrl.toLowerCase();
      // Note: .webm is classified as audio because:
      // 1. Browser voice recordings produce .webm files
      // 2. Facebook's API rejects .webm format for video attachments entirely
      // mp4/mov/avi are the only supported video formats
      if (lowercaseUrl.match(/\.(mp4|mov|avi)/)) {
        type = 'video';
      } else if (lowercaseUrl.match(/\.(mp3|ogg|wav|m4a|webm)/)) {
        type = 'audio';
      } else if (lowercaseUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)/)) {
        type = 'image';
      } else {
        type = 'file';
      }
      newMessage = await internalSendMetaMediaMessage(contactId, type, mediaUrl, trimmed, contact, userId);
    } else {
      newMessage = await internalSendFacebookMessage(contactId, trimmed, contact, userId);
    }

    return { success: true, data: newMessage };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send Facebook message.',
    };
  }
}

export async function getFacebookChatContacts() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];

  const where: Prisma.ContactWhereInput = {
    organizationId: session.user.organizationId,
    platform: 'FACEBOOK',
    messages: {
      some: {
        type: { notIn: ['comment', 'comment_reply'] },
      },
    },
  };

  if (session.user.role === 'USER') {
    where.assignedUsers = {
      some: { id: session.user.id },
    };
  }

  return prisma.contact.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
  });
}

export async function getFacebookChatMessages(contactId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, organizationId: true, platform: true },
  });
  if (!contact || contact.organizationId !== session.user.organizationId || contact.platform !== 'FACEBOOK') {
    return [];
  }

  return prisma.message.findMany({
    where: {
      contactId,
      type: { notIn: ['comment', 'comment_reply'] },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getAvailableAiAgents() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];

  return await prisma.aIAgent.findMany({
    where: { organizationId: session.user.organizationId },
    select: {
      id: true,
      name: true,
      model: true,
      isDefault: true,
      instructions: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFacebookPostAutomations() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const [org, aiAgents] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { businessDescription: true },
    }),
    prisma.aIAgent.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        model: true,
        isDefault: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const config = parseFacebookAutoCommentConfig(org?.businessDescription);
  return {
    enabled: config.enabled,
    defaultReplyText: config.replyText,
    rules: config.rules,
    postRules: config.postRules || [],
    globalRule: config.globalRule || null,
    aiAgents,
  };
}

export async function saveFacebookPostAutomation(rule: FacebookPostAutomationRule) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) {
    throw new Error('Organization not found.');
  }

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || '{}') as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existing = parseFacebookAutoCommentConfig(org.businessDescription);
  let nextPostRules = [...(existing.postRules || [])];
  let nextGlobalRule = existing.globalRule;

  if (rule.postId === 'ALL') {
    nextGlobalRule = rule;
  } else {
    const targetLeafId = extractPostLeafId(rule.postId);
    const existingIdx = nextPostRules.findIndex(
      (r) => r.postId === rule.postId || extractPostLeafId(r.postId) === targetLeafId
    );
    if (existingIdx >= 0) {
      nextPostRules[existingIdx] = rule;
    } else {
      nextPostRules.push(rule);
    }
  }

  // Also maintain backwards-compatible legacy rules
  const nextLegacyRules = nextPostRules.map((pr) => ({
    postId: pr.postId,
    replyText: pr.defaultReply?.publicReplyText || pr.keywords?.[0]?.publicReplyText || existing.replyText || 'Thank you for your comment!',
  }));

  const nextBusiness = {
    ...parsedBusiness,
    facebookAutoCommentEnabled: true,
    facebookGlobalAutomationRule: nextGlobalRule,
    facebookPostAutomationRules: nextPostRules,
    facebookAutoCommentRules: nextLegacyRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return {
    success: true,
    postRules: nextPostRules,
    globalRule: nextGlobalRule,
  };
}

export async function deleteFacebookPostAutomation(postId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessDescription: true },
  });
  if (!org) {
    throw new Error('Organization not found.');
  }

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessDescription || '{}') as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existing = parseFacebookAutoCommentConfig(org.businessDescription);
  let nextPostRules = [...(existing.postRules || [])];
  let nextGlobalRule = existing.globalRule;

  if (postId === 'ALL') {
    nextGlobalRule = undefined;
  } else {
    const targetLeafId = extractPostLeafId(postId);
    nextPostRules = nextPostRules.filter(
      (r) => r.postId !== postId && extractPostLeafId(r.postId) !== targetLeafId
    );
  }

  const nextBusiness = {
    ...parsedBusiness,
    facebookGlobalAutomationRule: nextGlobalRule,
    facebookPostAutomationRules: nextPostRules,
    facebookAutoCommentRules: nextPostRules.map((pr) => ({
      postId: pr.postId,
      replyText: pr.defaultReply?.publicReplyText || '',
    })),
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessDescription: JSON.stringify(nextBusiness) },
  });

  return {
    success: true,
    postRules: nextPostRules,
    globalRule: nextGlobalRule,
  };
}

export async function executeFacebookCommentAutomation(params: {
  organizationId: string;
  commentId: string;
  postId?: string;
  commenterId: string;
  commenterName: string;
  commentText: string;
}) {
  const { organizationId, commentId, postId, commenterId, commenterName, commentText } = params;

  try {
    // 1. Prevent duplicate auto-replies for the same comment
    const replyMarkerId = `fb_auto_reply_${commentId}`;
    const existingReply = await prisma.message.findUnique({
      where: { wamid: replyMarkerId },
      select: { id: true },
    });
    if (existingReply) {
      console.log(`[FB_AUTO_COMMENT] Skipping duplicate auto-reply for comment ${commentId}`);
      return { handled: false, reason: 'duplicate' };
    }

    // 2. Fetch organization config
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        businessDescription: true,
        facebookPageAccessToken: true,
        metaAccessToken: true,
        facebookPageId: true,
      },
    });
    if (!org) return { handled: false, reason: 'no_org' };

    const config = parseFacebookAutoCommentConfig(org.businessDescription);
    if (!config.enabled && !config.globalRule && config.postRules.length === 0) {
      return { handled: false, reason: 'disabled' };
    }

    // 3. Resolve matching automation rule (Specific post rule -> Global rule -> Legacy fallback)
    const cleanPostId = (postId || '').trim();
    const targetLeafId = extractPostLeafId(cleanPostId);

    const specificRule = config.postRules.find(
      (r) => r.enabled && (r.postId === cleanPostId || extractPostLeafId(r.postId) === targetLeafId)
    );
    const rule = specificRule || (config.globalRule?.enabled ? config.globalRule : null);

    const contact = await prisma.contact.findUnique({
      where: {
        organizationId_platform_waId: {
          organizationId,
          platform: 'FACEBOOK',
          waId: commenterId,
        },
      },
    });

    const formatText = (template?: string) => {
      if (!template) return '';
      return template.replace(/\{name\}/gi, commenterName || 'there').trim();
    };

    // --- STRATEGY A: Keyword Match ---
    if (rule && Array.isArray(rule.keywords) && rule.keywords.length > 0) {
      const lowerComment = commentText.toLowerCase().trim();

      for (const kw of rule.keywords) {
        if (!kw.keyword) continue;
        const lowerKw = kw.keyword.toLowerCase().trim();
        let isMatch = false;

        if (kw.matchType === 'exact') {
          isMatch = lowerComment === lowerKw;
        } else if (kw.matchType === 'starts_with') {
          isMatch = lowerComment.startsWith(lowerKw);
        } else {
          // default contains
          isMatch = lowerComment.includes(lowerKw);
        }

        if (isMatch) {
          console.log(`[FB_AUTO_COMMENT] Keyword matched: "${kw.keyword}" for comment ${commentId}`);
          let publicSent = false;

          // 1. Auto Like
          if (kw.autoLike) {
            try {
              await likeFacebookComment(commentId, organizationId);
            } catch (likeErr: any) {
              console.warn(`[FB_AUTO_COMMENT] Auto-like warning: ${likeErr?.message}`);
            }
          }

          // 2. Public Comment Reply
          if (kw.publicReplyText) {
            try {
              const publicReply = formatText(kw.publicReplyText);
              await replyToFacebookComment({
                organizationId,
                commentId,
                message: publicReply,
              });
              publicSent = true;
            } catch (pubErr: any) {
              console.warn(`[FB_AUTO_COMMENT] Public comment reply warning: ${pubErr?.message}`);
            }
          }

          // Store marker to avoid duplicate runs
          if (contact && publicSent) {
            await prisma.message.create({
              data: {
                contactId: contact.id,
                wamid: replyMarkerId,
                type: 'comment_reply',
                direction: 'outbound',
                platform: 'FACEBOOK',
                status: 'sent',
                content: kw.publicReplyText || '[Auto Comment Keyword Reply]',
                rawBody: {
                  autoReplyForCommentId: commentId,
                  matchedKeyword: kw.keyword,
                } as any,
              },
            }).catch(() => {});
          }

          return { handled: true, type: 'keyword', keyword: kw.keyword, publicSent };
        }
      }
    }

    // --- STRATEGY B: AI Agent Intelligence ---
    if (rule?.aiAgent?.enabled) {
      console.log(`[FB_AUTO_COMMENT] Executing AI Agent reply for comment ${commentId}`);

      if (rule.aiAgent.autoLike) {
        try {
          await likeFacebookComment(commentId, organizationId);
        } catch (likeErr: any) {
          console.warn(`[FB_AUTO_COMMENT] AI Auto-like warning: ${likeErr?.message}`);
        }
      }

      const aiReply = await generateSocialCommentAiReply({
        organizationId,
        agentId: rule.aiAgent.agentId,
        commenterName,
        commentText,
        customPrompt: rule.aiAgent.customPrompt,
        channel: 'comment',
      });

      if (aiReply) {
        let publicSent = false;

        try {
          await replyToFacebookComment({
            organizationId,
            commentId,
            message: aiReply,
          });
          publicSent = true;
        } catch (pubErr: any) {
          console.warn(`[FB_AUTO_COMMENT] AI public reply warning: ${pubErr?.message}`);
        }

        if (contact && publicSent) {
          await prisma.message.create({
            data: {
              contactId: contact.id,
              wamid: replyMarkerId,
              type: 'comment_reply',
              direction: 'outbound',
              platform: 'FACEBOOK',
              status: 'sent',
              content: aiReply,
              rawBody: {
                autoReplyForCommentId: commentId,
                aiGenerated: true,
                agentId: rule.aiAgent.agentId,
              } as any,
            },
          }).catch(() => {});
        }

        return { handled: true, type: 'ai', response: aiReply, publicSent };
      }
    }

    // --- STRATEGY C: Default / Fallback Reply ---
    const defaultReply = rule?.defaultReply;
    if (defaultReply?.enabled && defaultReply.publicReplyText) {
      if (defaultReply.autoLike) {
        try {
          await likeFacebookComment(commentId, organizationId);
        } catch (likeErr: any) {
          console.warn(`[FB_AUTO_COMMENT] Fallback auto-like warning: ${likeErr?.message}`);
        }
      }
      let publicSent = false;

      if (defaultReply.publicReplyText) {
        try {
          await replyToFacebookComment({
            organizationId,
            commentId,
            message: formatText(defaultReply.publicReplyText),
          });
          publicSent = true;
        } catch (pubErr: any) {
          console.warn(`[FB_AUTO_COMMENT] Fallback public reply warning: ${pubErr?.message}`);
        }
      }

      if (contact && publicSent) {
        await prisma.message.create({
          data: {
            contactId: contact.id,
            wamid: replyMarkerId,
            type: 'comment_reply',
            direction: 'outbound',
            platform: 'FACEBOOK',
            status: 'sent',
            content: defaultReply.publicReplyText || '[Default Auto Reply]',
            rawBody: { autoReplyForCommentId: commentId } as any,
          },
        }).catch(() => {});
      }

      return { handled: true, type: 'default', publicSent };
    }

    // --- STRATEGY D: Legacy Default Reply Fallback ---
    if (config.replyText && config.replyText.trim()) {
      await replyToFacebookComment({
        organizationId,
        commentId,
        message: formatText(config.replyText),
      });
      return { handled: true, type: 'legacy_default' };
    }

    return { handled: false, reason: 'no_matching_action' };
  } catch (err: any) {
    console.error(`[FB_AUTO_COMMENT] Execution failed:`, err?.message);
    return { handled: false, error: err?.message };
  }
}

export async function getFacebookAutoCommentRules() {
  return getFacebookPostAutomations();
}

export async function saveFacebookAutoCommentRule(postId: string, replyText: string) {
  return saveFacebookPostAutomation({
    postId,
    enabled: true,
    keywords: [],
    defaultReply: {
      enabled: true,
      publicReplyText: replyText,
      autoLike: false,
    },
  });
}

export async function replyToConnectedFacebookComment(commentId: string, message: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      throw new Error('Unauthorized');
    }

    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Message cannot be empty.');
    }

    // Call the library function
    await replyToFacebookComment({
      organizationId: session.user.organizationId,
      commentId,
      message: trimmed,
    });

    
  await logActivity({
    organizationId: session.user.organizationId, userId: session.user.id, userEmail: session.user.email, userName: session.user.name,
    action: 'Created', module: 'Integrations', target: 'Facebook Page', status: 'success'
  });
  return { success: true };
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to reply to Facebook comment.');
  }
}

export async function refreshFacebookContactNames() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: session.user.organizationId,
      platform: 'FACEBOOK',
      OR: [
        { name: { startsWith: 'FB User ' } },
        { name: null },
      ],
    },
  });

  if (contacts.length === 0) {
    return { success: true, message: 'No contacts need refreshing.' };
  }

  try {
    const pageToken = await resolveFacebookPageAccessToken(session.user.organizationId);
    let updatedCount = 0;

    for (const contact of contacts) {
      const profile = await fetchFacebookSenderProfile(contact.waId, pageToken);
      if (profile?.name) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { 
            name: profile.name,
            profilePic: profile.profilePic || contact.profilePic
          },
        });
        updatedCount++;
      }
    }

    return { success: true, updatedCount };
  } catch (error: any) {
    console.error('[REFRESH_FB_NAMES] Error:', error.message);
    throw new Error('Failed to refresh Facebook names: ' + error.message);
  }
}

