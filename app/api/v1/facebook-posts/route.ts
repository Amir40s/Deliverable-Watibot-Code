import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit, toEpoch, toIso } from "@/lib/api/mobile-formatters";
import { asBodyObject, optionalString } from "@/lib/api/mobile-route-utils";
import { resolveFacebookPageAccessToken } from "@/lib/facebook/api";

function formatFacebookPost(post: unknown) {
  const item = asBodyObject(post) ?? {};
  return {
    id: item.id,
    message: item.message ?? null,
    full_picture: item.full_picture ?? null,
    permalink_url: item.permalink_url ?? null,
    attachments: item.attachments ?? null,
    created_at: toEpoch(item.created_time),
    created_at_iso: toIso(item.created_time),
  };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const limit = clampLimit(req.nextUrl.searchParams.get("limit"), 20, 50);
  const fbOrg = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      facebookPageId: true,
      facebookPageName: true,
      metaAccessToken: true,
      facebookPageAccessToken: true,
    },
  });

  if (!fbOrg?.facebookPageId) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      platform: "FACEBOOK_POSTS",
      connected: false,
      message: "No Facebook Page is connected for this project.",
      page: null,
      total: 0,
      posts: [],
    });
  }

  if (!fbOrg.facebookPageAccessToken && !fbOrg.metaAccessToken) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      platform: "FACEBOOK_POSTS",
      connected: false,
      message: "Missing Meta access token. Reconnect Facebook Page first.",
      page: {
        id: fbOrg.facebookPageId,
        name: fbOrg.facebookPageName || "Unnamed Page",
      },
      total: 0,
      posts: [],
    });
  }

  try {
    const pageAccessToken = await resolveFacebookPageAccessToken(org.id);
    const url = new URL(`https://graph.facebook.com/v21.0/${fbOrg.facebookPageId}/posts`);
    url.searchParams.set(
      "fields",
      "id,message,created_time,permalink_url,full_picture,attachments{media,target}",
    );
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("access_token", pageAccessToken);

    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = asBodyObject(await res.json()) ?? {};
    const error = asBodyObject(data.error);

    if (!res.ok || error) {
      const message = optionalString(error?.message) || "Failed to fetch Facebook posts.";
      return NextResponse.json({
        status: 502,
        success: false,
        error: message,
        project_id: org.id,
        platform: "FACEBOOK_POSTS",
        connected: true,
      }, { status: 502 });
    }

    const posts = Array.isArray(data.data) ? data.data : [];

    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      platform: "FACEBOOK_POSTS",
      connected: true,
      page: {
        id: fbOrg.facebookPageId,
        name: fbOrg.facebookPageName || "Unnamed Page",
      },
      total: posts.length,
      posts: posts.map(formatFacebookPost),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Facebook posts.";
    return NextResponse.json({
      status: 502,
      success: false,
      error: message,
      project_id: org.id,
      platform: "FACEBOOK_POSTS",
      connected: true,
    }, { status: 502 });
  }
}
