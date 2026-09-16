'use server';

import { getServerSession } from 'next-auth';
import { logActivity } from "@/lib/activityLog";
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type TikTokStatePayload = {
  uid?: string;
  orgId: string;
  ts: number;
};

function parseTikTokConfig(rawMetaAppName: string | null | undefined) {
  if (!rawMetaAppName) {
    return {
      tiktokClientKey: '',
      tiktokClientSecret: '',
      tiktokRedirectUri: '',
      tiktokOauthScopes: '',
      tiktokIsBusinessApi: false,
    };
  }
  try {
    const parsed = JSON.parse(rawMetaAppName) as Record<string, unknown>;
    return {
      tiktokClientKey: typeof parsed.tiktokClientKey === 'string' ? parsed.tiktokClientKey : '',
      tiktokClientSecret: typeof parsed.tiktokClientSecret === 'string' ? parsed.tiktokClientSecret : '',
      tiktokRedirectUri: typeof parsed.tiktokRedirectUri === 'string' ? parsed.tiktokRedirectUri : '',
      tiktokOauthScopes: typeof parsed.tiktokOauthScopes === 'string' ? parsed.tiktokOauthScopes : '',
      tiktokIsBusinessApi: parsed.tiktokIsBusinessApi !== undefined ? !!parsed.tiktokIsBusinessApi : false,
    };
  } catch {
    return {
      tiktokClientKey: '',
      tiktokClientSecret: '',
      tiktokRedirectUri: '',
      tiktokOauthScopes: '',
      tiktokIsBusinessApi: false,
    };
  }
}

function toBase64Url(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function buildRedirectUri() {
  return 'https://watibot.vercel.app/dashboard/tiktok-callback';
}

function logTikTokDebug(label: string, payload: unknown) {
  // Verbose provider payload logs for local debugging only.
  if (process.env.NODE_ENV === 'production') return;
  console.log(`[TikTok Debug] ${label}:`, payload);
}

function resolveTikTokScope(rawScope: string) {
  const parsed = rawScope
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !!s);

  // Ensure essential profile scopes are present for avatar/display info.
  if (!parsed.includes('user.info.basic')) parsed.push('user.info.basic');
  if (!parsed.includes('user.info.profile')) parsed.push('user.info.profile');

  // Deduplicate while preserving order.
  return Array.from(new Set(parsed)).join(',');
}

export async function getTikTokConnectUrl() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const systemConfig = await prisma.systemConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
  const tiktokConfig = parseTikTokConfig(systemConfig?.metaAppName);

  const clientKey =
    tiktokConfig.tiktokClientKey.trim() ||
    process.env.TIKTOK_CLIENT_KEY?.trim() ||
    process.env.TIKTOK_CLIENT_ID?.trim();
  if (!clientKey) {
    throw new Error('TikTok Client Key is missing. Add it in Admin > Configurations > Social Login Settings > TikTok OAuth.');
  }

  const redirectUri =
    tiktokConfig.tiktokRedirectUri.trim() ||
    buildRedirectUri();
  if (!redirectUri || !redirectUri.startsWith('http')) {
    throw new Error('TikTok redirect URI is invalid. Set TIKTOK_REDIRECT_URI or NEXTAUTH_URL.');
  }

  const rawScope =
    (tiktokConfig.tiktokOauthScopes.trim() ||
      process.env.TIKTOK_OAUTH_SCOPES ||
      'user.info.basic,user.info.profile,video.list,video.upload,business.dm.send,business.dm.receive').trim();
  const scope = resolveTikTokScope(rawScope);
  const statePayload: TikTokStatePayload = {
    uid: session.user.id,
    orgId: session.user.organizationId,
    ts: Date.now(),
  };
  const state = toBase64Url(JSON.stringify(statePayload));

  // Use TikTok Login Kit OAuth by default (client_key).
  const authBaseUrl = 'https://www.tiktok.com/v2/auth/authorize/';

  const authUrl = new URL(authBaseUrl);
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  console.log('[TikTok] Generated Login Kit Auth URL:', {
    clientKey,
    redirectUri,
    scope,
    url: authUrl.toString()
  });

  return { url: authUrl.toString() };
}

export async function connectTikTokAccount(code: string, state: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  if (!code) {
    throw new Error('Missing TikTok authorization code.');
  }

  let parsedState: TikTokStatePayload | null = null;
  try {
    parsedState = JSON.parse(fromBase64Url(state)) as TikTokStatePayload;
  } catch {
    throw new Error('Invalid TikTok state payload.');
  }

  if (!parsedState?.orgId || !parsedState?.ts) {
    throw new Error('Invalid TikTok state payload.');
  }

  // Expire OAuth state to reduce replay risk.
  const stateAgeMs = Date.now() - parsedState.ts;
  if (stateAgeMs < 0 || stateAgeMs > 15 * 60 * 1000) {
    throw new Error('TikTok state expired. Please retry connection.');
  }

  const targetOrgId = parsedState.orgId;
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
  const targetOrg = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { id: true }
  });
  if (!targetOrg) {
    throw new Error('Invalid TikTok state: organization not found.');
  }

  // Best-effort integrity checks: log mismatch but do not block valid state+org callbacks.
  if (parsedState.uid && parsedState.uid !== session.user.id && !isSuperAdmin) {
    console.warn('[TikTok] State uid mismatch on callback', {
      stateUid: parsedState.uid,
      sessionUid: session.user.id,
      orgId: targetOrgId
    });
  }

  const systemConfig = await prisma.systemConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
  const tiktokConfig = parseTikTokConfig(systemConfig?.metaAppName);
  const clientKey =
    tiktokConfig.tiktokClientKey.trim() ||
    process.env.TIKTOK_CLIENT_KEY?.trim() ||
    process.env.TIKTOK_CLIENT_ID?.trim();
  const clientSecret =
    tiktokConfig.tiktokClientSecret.trim() ||
    process.env.TIKTOK_CLIENT_SECRET?.trim();
  const redirectUri =
    tiktokConfig.tiktokRedirectUri.trim() ||
    buildRedirectUri();
  if (!clientKey || !clientSecret) {
    throw new Error('TikTok client credentials are missing. Add them in Admin > Configurations > Social Login Settings > TikTok OAuth.');
  }

  const tokenBody = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  const tokenData = await tokenRes.json();
  logTikTokDebug('OAuth token exchange response', tokenData);

  if (!tokenRes.ok || tokenData?.error) {
    throw new Error(tokenData?.error_description || tokenData?.message || 'Failed to exchange TikTok token.');
  }

  const accessToken = tokenData?.access_token as string | undefined;
  const refreshToken = tokenData?.refresh_token as string | undefined;
  const expiresIn = Number(tokenData?.expires_in || 0);
  if (!accessToken) {
    throw new Error('TikTok access token missing from token exchange.');
  }

  let creatorId = tokenData?.open_id as string | undefined;
  try {
    const userInfoFields = [
      'open_id',
      'display_name',
      'avatar_url',
      'username',
    ].join(',');
    const userInfoRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${userInfoFields}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userInfoData = await userInfoRes.json();
    logTikTokDebug('User info HTTP status', userInfoRes.status);
    logTikTokDebug('User info requested fields', userInfoFields);
    logTikTokDebug('User info response', userInfoData);
    if (userInfoRes.ok && userInfoData?.data?.user?.open_id) {
      creatorId = userInfoData.data.user.open_id as string;
    }
  } catch {
    // Non-blocking: keep creatorId from token response if available.
  }

  if (!creatorId) {
    throw new Error('TikTok Creator ID not found in API response.');
  }

  await prisma.organization.update({
    where: { id: targetOrgId },
    data: {
      tiktokAccessToken: accessToken,
      tiktokRefreshToken: refreshToken || null,
      tiktokCreatorId: creatorId,
      tiktokExpiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
    },
  });

  return { success: true, creatorId };
}

export async function getTikTokProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { tiktokAccessToken: true, tiktokCreatorId: true }
  });

  if (!org?.tiktokAccessToken || !org?.tiktokCreatorId) {
    return null;
  }

  try {
    const profileRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username',
      {
        headers: { Authorization: `Bearer ${org.tiktokAccessToken}` }
      }
    );

    const profileData = await profileRes.json();
    const user = profileData?.data?.user;
    if (!profileRes.ok || !user) {
      return {
        creatorId: org.tiktokCreatorId,
        displayName: `TikTok ${org.tiktokCreatorId.slice(-4)}`,
        username: null,
        avatarUrl: null
      };
    }

    return {
      creatorId: user.open_id || org.tiktokCreatorId,
      displayName: user.display_name || `TikTok ${org.tiktokCreatorId.slice(-4)}`,
      username: user.username || null,
      avatarUrl: user.avatar_url || null
    };
  } catch {
    return {
      creatorId: org.tiktokCreatorId,
      displayName: `TikTok ${org.tiktokCreatorId.slice(-4)}`,
      username: null,
      avatarUrl: null
    };
  }
}

export async function disconnectTikTokAccount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      tiktokAccessToken: null,
      tiktokRefreshToken: null,
      tiktokCreatorId: null,
      tiktokExpiresAt: null
    }
  });

  
  await logActivity({
    organizationId: session.user.organizationId, userId: session.user.id, userEmail: session.user.email, userName: session.user.name,
    action: 'Created', module: 'Integrations', target: 'TikTok Account', status: 'success'
  });
  return { success: true };
}

export type TikTokVideo = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  shareUrl: string | null;
  embedLink: string | null;
  createTime: string | null;
  duration: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
};

export async function getTikTokVideos() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { tiktokAccessToken: true, tiktokCreatorId: true }
  });

  if (!org?.tiktokAccessToken || !org?.tiktokCreatorId) {
    return { videos: [] as TikTokVideo[], error: 'TikTok account is not connected.' };
  }

  const fields = [
    'id',
    'title',
    'video_description',
    'duration',
    'cover_image_url',
    'share_url',
    'embed_link',
    'create_time',
    'view_count',
    'like_count',
    'comment_count',
    'share_count'
  ].join(',');

  try {
    const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}&max_count=20`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${org.tiktokAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await res.json();
    logTikTokDebug('Video list response', data);

    if (!res.ok || data?.error?.code !== 'ok') {
      return {
        videos: [] as TikTokVideo[],
        error: data?.error?.message || 'Unable to fetch TikTok videos. Ensure video.list scope is approved.'
      };
    }

    const videos = (data?.data?.videos || []).map((video: any) => ({
      id: video.id,
      title: video.title || 'Untitled Video',
      description: video.video_description || null,
      coverImageUrl: video.cover_image_url || null,
      shareUrl: video.share_url || null,
      embedLink: video.embed_link || null,
      createTime: video.create_time ? video.create_time * 1000 : null,
      duration: typeof video.duration === 'number' ? video.duration : null,
      viewCount: typeof video.view_count === 'number' ? video.view_count : null,
      likeCount: typeof video.like_count === 'number' ? video.like_count : null,
      commentCount: typeof video.comment_count === 'number' ? video.comment_count : null,
      shareCount: typeof video.share_count === 'number' ? video.share_count : null,
    })) as TikTokVideo[];

    return { videos, error: null as string | null };
  } catch {
    return {
      videos: [] as TikTokVideo[],
      error: 'Failed to reach TikTok API while fetching videos.'
    };
  }
}
export type TikTokComment = {
  id: string;
  text: string;
  username: string;
  createTime: string;
  likeCount: number;
  replyCount: number;
};

export async function getTikTokComments(videoId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { tiktokAccessToken: true, tiktokCreatorId: true }
  });

  if (!org?.tiktokAccessToken) {
    throw new Error('TikTok account is not connected.');
  }

  try {
    // Note: Comments fetching is a TikTok Business API feature.
    // Official Path: /business/comment/list/
    const res = await fetch(`https://business-api.tiktok.com/open_api/v1.3/business/comment/list/`, {
      method: 'POST',
      headers: {
        'Access-Token': org.tiktokAccessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        business_id: org.tiktokCreatorId,
        video_id: videoId,
        max_count: 20
      })
    });

    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error('[TikTok Comments] Business API Response:', {
        status: res.status,
        contentType,
        body: text.slice(0, 500)
      });

      if (res.status === 403 || res.status === 401) {
        return {
          comments: [] as TikTokComment[],
          error: "Your TikTok account doesn't have permission to view comments. Ensure it is a Business Account."
        };
      }

      return {
        comments: [] as TikTokComment[],
        error: `TikTok API error (${res.status}). Comments may only be available for Business Accounts.`
      };
    }

    const data = await res.json();
    logTikTokDebug('Comment list response', data);

    if (data.code !== 0) {
      return {
        comments: [] as TikTokComment[],
        error: data.message || 'Unable to fetch TikTok comments.'
      };
    }

    const comments = (data.data?.comments || []).map((comment: any) => ({
      id: comment.id,
      text: comment.text,
      username: comment.username,
      createTime: comment.create_time ? comment.create_time * 1000 : null,
      likeCount: comment.like_count || 0,
      replyCount: comment.reply_count || 0,
    })) as TikTokComment[];

    return { comments, error: null as string | null };
  } catch (err: any) {
    console.error('[TikTok Comments] Fetch Failed:', err);
    return {
      comments: [] as TikTokComment[],
      error: 'Failed to connect to TikTok. Please check your internet connection.'
    };
  }
}

export type TikTokAutoCommentRule = {
  videoId: string;
  replyText: string;
};

export type TikTokAutoCommentConfig = {
  enabled: boolean;
  rules: TikTokAutoCommentRule[];
};

function parseTikTokAutoCommentConfig(rawValue: string | null | undefined): TikTokAutoCommentConfig {
  if (!rawValue) {
    return { enabled: false, rules: [] };
  }
  try {
    const parsed = JSON.parse(rawValue) as {
      tiktokAutoCommentEnabled?: boolean;
      tiktokAutoCommentRules?: Array<{ videoId?: string; replyText?: string }>;
    };
    const rules = Array.isArray(parsed.tiktokAutoCommentRules)
      ? parsed.tiktokAutoCommentRules
        .map((rule) => ({
          videoId: typeof rule?.videoId === 'string' ? rule.videoId.trim() : '',
          replyText: typeof rule?.replyText === 'string' ? rule.replyText.trim() : '',
        }))
        .filter((rule) => !!rule.videoId && !!rule.replyText)
      : [];

    return {
      enabled: !!parsed.tiktokAutoCommentEnabled,
      rules,
    };
  } catch {
    return { enabled: false, rules: [] };
  }
}

export async function getTikTokAutoCommentRules() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { businessVertical: true },
  });

  const config = parseTikTokAutoCommentConfig(org?.businessVertical);
  return {
    enabled: config.enabled,
    rules: config.rules,
  };
}

export async function saveTikTokAutoCommentRule(videoId: string, replyText: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const normalizedVideoId = videoId.trim();
  const normalizedReplyText = replyText.trim();
  if (!normalizedVideoId) {
    throw new Error('Video ID is required.');
  }
  if (!normalizedReplyText) {
    throw new Error('Reply text is required.');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, businessVertical: true },
  });
  if (!org) {
    throw new Error('Organization not found.');
  }

  const parsedBusiness = (() => {
    try {
      return JSON.parse(org.businessVertical || '{}') as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  const existing = parseTikTokAutoCommentConfig(org.businessVertical);
  const nextRules = [...existing.rules];
  const existingIndex = nextRules.findIndex((rule) => rule.videoId === normalizedVideoId);

  if (existingIndex >= 0) {
    nextRules[existingIndex] = { videoId: normalizedVideoId, replyText: normalizedReplyText };
  } else {
    nextRules.push({ videoId: normalizedVideoId, replyText: normalizedReplyText });
  }

  const nextConfig = {
    ...parsedBusiness,
    tiktokAutoCommentEnabled: true,
    tiktokAutoCommentRules: nextRules,
  };

  await prisma.organization.update({
    where: { id: org.id },
    data: { businessVertical: JSON.stringify(nextConfig) },
  });

  return {
    success: true,
    rules: nextRules,
  };
}

export async function replyToTikTokComment(commentId: string, text: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { tiktokAccessToken: true, tiktokCreatorId: true }
  });

  if (!org?.tiktokAccessToken) {
    throw new Error('TikTok account is not connected.');
  }

  try {
    const res = await fetch(`https://business-api.tiktok.com/open_api/v1.3/business/comment/reply/`, {
      method: 'POST',
      headers: {
        'Access-Token': org.tiktokAccessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        business_id: org.tiktokCreatorId,
        comment_id: commentId,
        text: text
      })
    });

    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to reply to TikTok comment.');
    }

    return { success: true };
  } catch (err: any) {
    console.error('[TikTok Reply] Failed:', err);
    throw new Error(err.message || 'Failed to connect to TikTok.');
  }
}
