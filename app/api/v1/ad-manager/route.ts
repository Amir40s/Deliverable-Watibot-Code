import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { asBodyObject, optionalString } from "@/lib/api/mobile-route-utils";

const GRAPH_API_VERSION = "v21.0";

function graphDataArray(value: unknown) {
  const item = asBodyObject(value) ?? {};
  return Array.isArray(item.data) ? item.data : [];
}

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

async function fetchGraph(path: string, token: string, params: Record<string, string | number> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", token);

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = asBodyObject(await res.json()) ?? {};
  const error = asBodyObject(data.error);

  if (!res.ok || error) {
    throw new Error(optionalString(error?.message) || `Meta request failed with status ${res.status}.`);
  }

  return data;
}

async function settle<T>(label: string, promise: Promise<T>) {
  try {
    return { label, value: await promise, warning: null };
  } catch (error) {
    return {
      label,
      value: null,
      warning: error instanceof Error ? `${label}: ${error.message}` : `${label}: failed`,
    };
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const datePreset = sp.get("date_preset") || "last_30d";
  const limit = clampLimit(sp.get("limit"), 50, 100);

  const settings = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      facebookPageId: true,
      facebookPageName: true,
      facebookAdAccountId: true,
      metaAccessToken: true,
      facebookAdsAccessToken: true,
    },
  });

  const token = settings?.facebookAdsAccessToken || settings?.metaAccessToken || null;
  if (!settings || !token) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      connected: false,
      message: "Facebook Ads is not connected for this project.",
      pages: [],
      ad_accounts: [],
      insights: null,
      account_details: null,
      campaigns: [],
      audience: [],
      leads: [],
    });
  }

  const warnings: string[] = [];
  const [pagesResult, accountsResult] = await Promise.all([
    settle("pages", fetchGraph("me/accounts", token, {
      fields: "name,id,category,picture",
      limit,
    })),
    settle("ad_accounts", fetchGraph("me/adaccounts", token, {
      fields: "name,account_id,id,account_status,currency",
      limit,
    })),
  ]);

  if (pagesResult.warning) warnings.push(pagesResult.warning);
  if (accountsResult.warning) warnings.push(accountsResult.warning);

  const pages = graphDataArray(pagesResult.value);
  const adAccounts = graphDataArray(accountsResult.value);
  const queryAccountId = sp.get("ad_account_id");
  const queryPageId = sp.get("page_id");
  const firstAccount = asBodyObject(adAccounts[0]);
  const firstPage = asBodyObject(pages[0]);
  const selectedAdAccountId = queryAccountId || settings.facebookAdAccountId || optionalString(firstAccount?.id) || null;
  const selectedPageId = queryPageId || settings.facebookPageId || optionalString(firstPage?.id) || null;

  if (!selectedAdAccountId) {
    return NextResponse.json({
      status: 200,
      success: true,
      project_id: org.id,
      connected: true,
      message: "Facebook is connected, but no ad account is available for this project.",
      selected_page_id: selectedPageId,
      selected_ad_account_id: null,
      pages,
      ad_accounts: adAccounts,
      insights: null,
      account_details: null,
      campaigns: [],
      audience: [],
      leads: [],
      warnings,
    });
  }

  const actId = normalizeAdAccountId(selectedAdAccountId);
  const [insightsResult, detailsResult, campaignsResult, audienceResult, leadsResult] = await Promise.all([
    settle("insights", fetchGraph(`${actId}/insights`, token, {
      fields: "spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions",
      date_preset: datePreset,
      limit,
    })),
    settle("account_details", fetchGraph(actId, token, {
      fields: "name,account_id,id,currency,amount_spent,balance,account_status",
    })),
    settle("campaigns", fetchGraph(`${actId}/campaigns`, token, {
      fields: `name,status,objective,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions},adsets{id,name,status,daily_budget,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions},ads{id,name,status,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions}}}`,
      limit,
    })),
    settle("audience", fetchGraph(`${actId}/insights`, token, {
      breakdowns: "age,gender",
      fields: "reach,impressions,spend,clicks",
      date_preset: datePreset,
      limit,
    })),
    selectedPageId
      ? settle("leads", fetchGraph(`${selectedPageId}/leads`, token, {
          fields: "created_time,id,ad_id,ad_name,field_data",
          limit,
        }))
      : Promise.resolve({ label: "leads", value: null, warning: "leads: no Facebook page selected" }),
  ]);

  for (const result of [insightsResult, detailsResult, campaignsResult, audienceResult, leadsResult]) {
    if (result.warning) warnings.push(result.warning);
  }

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    connected: true,
    date_preset: datePreset,
    selected_page_id: selectedPageId,
    selected_page_name: settings.facebookPageName,
    selected_ad_account_id: selectedAdAccountId,
    pages,
    ad_accounts: adAccounts,
    insights: graphDataArray(insightsResult.value)[0] ?? null,
    account_details: detailsResult.value,
    campaigns: graphDataArray(campaignsResult.value),
    audience: graphDataArray(audienceResult.value),
    leads: graphDataArray(leadsResult.value),
    warnings,
  });
}
