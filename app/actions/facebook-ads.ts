"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const GRAPH_API_VERSION = 'v21.0';

export async function connectFacebookAdsWithToken(shortLivedToken: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  let sysConfig = await prisma.systemConfig.findFirst({
    where: {
      AND: [
        { facebookAppId: { not: null } },
        { facebookAppId: { not: "" } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => null);

  if (!sysConfig) {
    sysConfig = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    }).catch(() => null);
  }

  const clientId = sysConfig?.facebookAppId;
  const clientSecret = sysConfig?.facebookAppSecret;

  if (!clientId || !clientSecret) {
    throw new Error('Meta app credentials (App ID/Secret) are missing in System Configurations.');
  }

  let accessToken = shortLivedToken;

  try {
    const exchangeUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`;
    const exchangeRes = await fetch(exchangeUrl);
    const exchangeData = await exchangeRes.json();

    if (exchangeRes.ok && exchangeData.access_token) {
      accessToken = exchangeData.access_token;
    } else {
      console.warn('[ConnectFacebookAds] Failed to exchange token:', exchangeData);
    }
  } catch (err) {
    console.warn('[ConnectFacebookAds] Error during token exchange:', err);
  }

  // Verify the token works for ads_management
  const permsRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/permissions?access_token=${accessToken}`);
  const permsData = await permsRes.json();
  const perms = Array.isArray(permsData?.data) ? permsData.data : [];

  const hasAdsManagement = perms.some((p: any) => p.permission === 'ads_management' && p.status === 'granted');
  const hasPagesShowList = perms.some((p: any) => p.permission === 'pages_show_list' && p.status === 'granted');

  if (!hasAdsManagement || !hasPagesShowList) {
    console.warn('[ConnectFacebookAds] Token is missing some recommended permissions:', perms);
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { facebookAdsAccessToken: accessToken }
  });

  return { success: true };
}

export async function getFacebookPages() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { metaAccessToken: true, facebookAdsAccessToken: true }
  })

  const token = org?.facebookAdsAccessToken || org?.metaAccessToken
  if (!token) throw new Error("Facebook not connected")

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=name,id,access_token,category,picture&access_token=${token}`
  )

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  return data.data || []
}

export async function saveFacebookPageId(pageId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  return prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { facebookPageId: pageId }
  })
}

export async function getAdAccounts(pageId?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { metaAccessToken: true, facebookAdsAccessToken: true, facebookPageId: true }
  })

  const userToken = org?.facebookAdsAccessToken || org?.metaAccessToken
  if (!userToken) throw new Error("Facebook not connected")

  const targetPageId = pageId || org?.facebookPageId

  if (targetPageId) {
    try {
      // Step 1: Get the page access token
      const pagesRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts?fields=id,access_token&access_token=${userToken}`
      )
      const pagesData = await pagesRes.json()
      const pageEntry = (pagesData.data || []).find((p: any) => p.id === targetPageId)
      const pageToken = pageEntry?.access_token || userToken

      // Step 2: Find the Business Manager linked to this page
      const pageInfoRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${targetPageId}?fields=business&access_token=${pageToken}`
      )
      const pageInfo = await pageInfoRes.json()
      const businessId = pageInfo?.business?.id

      if (businessId) {
        // Step 3: Fetch ad accounts owned by or assigned to this business
        const [ownedRes, clientRes] = await Promise.all([
          fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/owned_ad_accounts?fields=name,account_id,id,account_status,currency&access_token=${userToken}`),
          fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/client_ad_accounts?fields=name,account_id,id,account_status,currency&access_token=${userToken}`)
        ])
        const [ownedData, clientData] = await Promise.all([ownedRes.json(), clientRes.json()])

        const owned = ownedData.error ? [] : (ownedData.data || [])
        const client = clientData.error ? [] : (clientData.data || [])

        // Merge and deduplicate by id
        const all = [...owned, ...client]
        const unique = Array.from(new Map(all.map((a: any) => [a.id, a])).values())

        console.log(`[getAdAccounts] Business ${businessId} for page ${targetPageId}: ${unique.length} ad accounts`)
        return unique
      }

      console.warn(`[getAdAccounts] Page ${targetPageId} has no linked Business Manager — returning empty`)
      return []
    } catch (err) {
      console.warn('[getAdAccounts] Error fetching business-scoped ad accounts:', err)
      return []
    }
  }

  // No page selected: fetch all user-level ad accounts
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts?fields=name,account_id,id,account_status,currency&access_token=${userToken}`
  )
  const data = await response.json()
  if (data.error) throw new Error(data.error.message)
  return data.data || []
}

export async function saveAdAccountId(adAccountId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  return prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { facebookAdAccountId: adAccountId }
  })
}

export async function disconnectAdAccount() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  return prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { 
      facebookAdAccountId: null,
      facebookAdsAccessToken: null
    }
  })
}

export async function getAdInsights(params?: { datePreset?: string, adAccountId?: string }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) throw new Error("Unauthorized")

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { metaAccessToken: true, facebookAdsAccessToken: true, facebookAdAccountId: true }
  })

  const token = org?.facebookAdsAccessToken || org?.metaAccessToken
  const targetAccountId = params?.adAccountId || org?.facebookAdAccountId
  if (!targetAccountId) throw new Error("No Ad Account linked")
  if (!token) throw new Error("Facebook not connected")

  const datePreset = params?.datePreset || 'maximum'
  
  // Format the ID correctly (Facebook IDs are often prefixed with act_)
  const formattedId = targetAccountId.startsWith('act_') ? targetAccountId : `act_${targetAccountId}`

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/insights?fields=spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions&date_preset=${datePreset}&access_token=${token}`
  )

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  // Insights usually returns an array of daily/total records
  return data.data || []
}

export async function getAdAccountDetails(adAccountId: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) throw new Error("Unauthorized")
  
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { metaAccessToken: true, facebookAdsAccessToken: true }
    })
  
    const token = org?.facebookAdsAccessToken || org?.metaAccessToken
    if (!token) throw new Error("Facebook not connected")
  
    const formattedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}?fields=name,account_id,id,currency,amount_spent,balance&access_token=${token}`
    )
  
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
  
    return data
}

export async function getAdCampaigns(adAccountId: string, datePreset: string = 'last_30d') {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) throw new Error("Unauthorized")
  
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { metaAccessToken: true, facebookAdsAccessToken: true }
    })
  
    const token = org?.facebookAdsAccessToken || org?.metaAccessToken
    if (!token) throw new Error("Facebook not connected")
  
    const formattedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/campaigns?fields=name,status,objective,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions},adsets{id,name,status,daily_budget,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions},ads{id,name,status,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpc,ctr,inline_link_clicks,conversions}}}&access_token=${token}`
    )
  
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
  
    return data.data || []
}

export async function getAdAudienceBreakdown(adAccountId: string, datePreset: string = 'last_30d') {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) throw new Error("Unauthorized")
  
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { metaAccessToken: true, facebookAdsAccessToken: true }
    })
  
    const token = org?.facebookAdsAccessToken || org?.metaAccessToken
    if (!token) throw new Error("Facebook not connected")
  
    const formattedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  
    // Fetch age and gender breakdown
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/insights?breakdowns=age,gender&fields=reach,impressions,spend,clicks&date_preset=${datePreset}&access_token=${token}`
    )
  
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
  
    return data.data || []
}

export async function getAdLeads(pageId: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) throw new Error("Unauthorized")
  
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { metaAccessToken: true, facebookAdsAccessToken: true }
    })
  
    const token = org?.facebookAdsAccessToken || org?.metaAccessToken
    if (!token) throw new Error("Facebook not connected")
  
    // Fetch Page Leads
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/leads?fields=created_time,id,ad_id,ad_name,field_data&limit=50&access_token=${token}`
    )
  
    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
  
    return data.data || []
}

export async function createSimpleAdCampaign(params: {
    adAccountId: string;
    name: string;
    budget: number;
    locations: string[];
    headline: string;
    body: string;
    imageUrl: string;
    pageId: string;
}) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) throw new Error("Unauthorized")
  
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { metaAccessToken: true, facebookAdsAccessToken: true }
    })
  
    const token = org?.facebookAdsAccessToken || org?.metaAccessToken
    if (!token) throw new Error("Facebook not connected")
    const accessToken = token;
    const formattedId = params.adAccountId.startsWith('act_') ? params.adAccountId : `act_${params.adAccountId}`

    // 1. Create Campaign
    const campaignRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/campaigns`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: params.name,
                objective: 'OUTCOME_LEADS', 
                status: 'PAUSED', 
                special_ad_categories: [],
                access_token: accessToken
            })
        }
    );
    const campaignData = await campaignRes.json();
    if (campaignData.error) throw new Error(campaignData.error.message);
    const campaignId = campaignData.id;

    // 2. Create Ad Set
    const adSetRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/adsets`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `${params.name} - Ad Set`,
                campaign_id: campaignId,
                daily_budget: params.budget * 100, 
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'LEAD_GENERATION',
                targeting: {
                    geo_locations: { countries: params.locations },
                    publisher_platforms: ['facebook', 'instagram']
                },
                status: 'PAUSED',
                access_token: accessToken
            })
        }
    );
    const adSetData = await adSetRes.json();
    if (adSetData.error) throw new Error(adSetData.error.message);
    const adSetId = adSetData.id;

    // 3. Create Ad Creative
    const creativeRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/adcreatives`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `${params.name} - Creative`,
                object_story_spec: {
                    page_id: params.pageId,
                    link_data: {
                        image_url: params.imageUrl,
                        message: params.body,
                        link: `https://facebook.com/${params.pageId}`,
                        call_to_action: {
                            type: 'LEARN_MORE',
                            value: { lead_gen_form_id: 'auto' } 
                        }
                    }
                },
                access_token: accessToken
            })
        }
    );
    const creativeData = await creativeRes.json();
    if (creativeData.error) throw new Error(creativeData.error.message);
    const creativeId = creativeData.id;

    // 4. Create Ad
    const adRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${formattedId}/ads`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `${params.name} - Ad`,
                adset_id: adSetId,
                creative: { creative_id: creativeId },
                status: 'PAUSED',
                access_token: accessToken
            })
        }
    );
    const adData = await adRes.json();
    if (adData.error) throw new Error(adData.error.message);

    return { campaignId, adSetId, adId: adData.id };
}
