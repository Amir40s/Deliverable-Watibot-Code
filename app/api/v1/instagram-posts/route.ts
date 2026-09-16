import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit, toEpoch, toIso } from "@/lib/api/mobile-formatters";
import { asBodyObject, optionalString } from "@/lib/api/mobile-route-utils";

function dataArray(value: unknown) {
  const item = asBodyObject(value) ?? {};
  return Array.isArray(item.data) ? item.data : [];
}

function pickPreferredInstagramAccount(pages: unknown[]) {
  const withInstagram = pages.filter((page) => {
    const item = asBodyObject(page) ?? {};
    return !!asBodyObject(item.instagram_business_account)?.id;
  });
  if (!withInstagram.length) return null;

  const hasTask = (page: unknown, task: string) => {
    const item = asBodyObject(page) ?? {};
    return Array.isArray(item.tasks) && item.tasks.includes(task);
  };

  const preferred =
    withInstagram.find((page) => hasTask(page, "MESSAGING")) ||
    withInstagram.find((page) => hasTask(page, "MANAGE")) ||
    withInstagram[0];

  const account = asBodyObject(asBodyObject(preferred)?.instagram_business_account);
  return optionalString(account?.id) || null;
}

async function fetchGraph(url: URL) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const data = asBodyObject(await res.json()) ?? {};
  const error = asBodyObject(data.error);
  if (!res.ok || error) {
    throw new Error(optionalString(error?.message) || `Meta request failed with status ${res.status}.`);
  }
  return data;
}

function formatInstagramMedia(media: unknown) {
  const item = asBodyObject(media) ?? {};
  return {
    id: item.id,
    caption: item.caption ?? null,
    media_type: item.media_type ?? null,
    media_url: item.media_url ?? null,
    thumbnail_url: item.thumbnail_url ?? null,
    permalink: item.permalink ?? null,
    like_count: item.like_count ?? 0,
    comments_count: item.comments_count ?? 0,
    created_at: toEpoch(item.timestamp),
    created_at_iso: toIso(item.timestamp),
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const limit = clampLimit(req.nextUrl.searchParams.get("limit"), 20, 50);
  const settings = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      instagramBusinessId: true,
      metaAccessToken: true,
      instagramAccessToken: true,
      facebookPageAccessToken: true,
    },
  });

  const token = settings?.facebookPageAccessToken || settings?.instagramAccessToken || settings?.metaAccessToken || null;
  if (!settings || !token) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      platform: "INSTAGRAM_POSTS",
      connected: false,
      message: "Missing Meta access token. Reconnect Instagram first.",
      profile: null,
      total: 0,
      media: [],
      stories: [],
    });
  }

  let instagramBusinessId = settings.instagramBusinessId;
  const warnings: string[] = [];

  if (!instagramBusinessId) {
    try {
      const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
      pagesUrl.searchParams.set("fields", "id,name,tasks,instagram_business_account{id}");
      pagesUrl.searchParams.set("access_token", token);
      const pagesData = await fetchGraph(pagesUrl);
      const discovered = pickPreferredInstagramAccount(dataArray(pagesData));
      if (discovered) {
        instagramBusinessId = discovered;
        await prisma.organization.update({
          where: { id: org.id },
          data: { instagramBusinessId: discovered },
        });
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Failed to discover Instagram business account.");
    }
  }

  if (!instagramBusinessId) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      platform: "INSTAGRAM_POSTS",
      connected: false,
      message: "No Instagram business account is connected for this project.",
      profile: null,
      total: 0,
      media: [],
      stories: [],
      warnings,
    });
  }

  try {
    const profileUrl = new URL(`https://graph.facebook.com/v21.0/${instagramBusinessId}`);
    profileUrl.searchParams.set(
      "fields",
      "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count",
    );
    profileUrl.searchParams.set("access_token", token);

    const mediaUrl = new URL(`https://graph.facebook.com/v21.0/${instagramBusinessId}/media`);
    mediaUrl.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    );
    mediaUrl.searchParams.set("limit", String(limit));
    mediaUrl.searchParams.set("access_token", token);

    const [profileData, mediaData] = await Promise.all([
      fetchGraph(profileUrl),
      fetchGraph(mediaUrl),
    ]);

    let stories: unknown[] = [];
    try {
      const storiesUrl = new URL(`https://graph.facebook.com/v21.0/${instagramBusinessId}/stories`);
      storiesUrl.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
      storiesUrl.searchParams.set("limit", "25");
      storiesUrl.searchParams.set("access_token", token);
      stories = dataArray(await fetchGraph(storiesUrl));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Failed to fetch Instagram stories.");
    }

    const media = dataArray(mediaData);

    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      platform: "INSTAGRAM_POSTS",
      connected: true,
      profile: {
        id: profileData.id,
        username: profileData.username ?? "",
        name: profileData.name ?? "",
        biography: profileData.biography ?? "",
        profile_picture_url: profileData.profile_picture_url ?? "",
        followers_count: profileData.followers_count ?? 0,
        follows_count: profileData.follows_count ?? 0,
        media_count: profileData.media_count ?? 0,
      },
      total: media.length,
      media: media.map(formatInstagramMedia),
      stories: stories.map(formatInstagramMedia),
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Instagram posts.";
    return NextResponse.json({
      status: 502,
      success: false,
      error: message,
      project_id: org.id,
      platform: "INSTAGRAM_POSTS",
      connected: true,
    }, { status: 502 });
  }
}
