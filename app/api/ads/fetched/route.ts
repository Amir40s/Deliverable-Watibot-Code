import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const META_API_VERSION ='v19.0';
const BASE_URL =`https://graph.facebook.com/${META_API_VERSION}`;

export async function GET() {
 try {
 const session: any = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }

 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: { 
 facebookAdAccountId: true,
 metaAccessToken: true 
 }
 });

 // Dynamic credentials from DB with transition fallback to ENV
 const adAccountId = org?.facebookAdAccountId || process.env.FB_AD_ACCOUNT_ID;
 const accessToken = org?.metaAccessToken || process.env.FB_ACCESS_TOKEN;

 if (!adAccountId || !accessToken) {
 return NextResponse.json(
 { error: "Meta Ads not configured for this organization. Please connect in settings." },
 { status: 400 }
 );
 }

 const actId = adAccountId.startsWith('act_') ? adAccountId :`act_${adAccountId}`;

 // Fetch Ads (for daily_budget, status, name)
 const adsUrl =`${BASE_URL}/${actId}/ads?fields=name,status,daily_budget&limit=100&access_token=${accessToken}`;
 
 // Fetch Insights (for spend, impressions, clicks, reach)
 const insightsUrl =`${BASE_URL}/${actId}/insights?fields=ad_id,ad_name,spend,impressions,inline_link_clicks,reach&level=ad&limit=100&access_token=${accessToken}`;

 const [adsRes, insightsRes] = await Promise.all([
 fetch(adsUrl),
 fetch(insightsUrl)
 ]);

 const adsData = await adsRes.json();
 const insightsData = await insightsRes.json();

 if (adsData.error) {
 console.error("Meta Ads Error:", adsData.error);
 return NextResponse.json({ error: adsData.error.message }, { status: 500 });
 }
 if (insightsData.error) {
 console.error("Meta Insights Error:", insightsData.error);
 return NextResponse.json({ error: insightsData.error.message }, { status: 500 });
 }

 // Map insights by ad_id for easy lookup
 const insightsMap = new Map();
 if (insightsData.data) {
 insightsData.data.forEach((insight: any) => {
 insightsMap.set(insight.ad_id, insight);
 });
 }

 // Merge ad data with insight data
 const mergedAds = (adsData.data || []).map((ad: any) => {
 const relatedInsights = insightsMap.get(ad.id) || {};
 
 // Format budget if present (Meta returns API budget in lowest denomination usually, e.g., paise for INR. 
 // We'll return it as raw divided by 100 for basic visualization).
 let formattedBudget = ad.daily_budget ? (parseInt(ad.daily_budget) / 100) : 0;

 return {
 id: ad.id,
 name: ad.name,
 status: ad.status,
 daily_budget: formattedBudget,
 spend: relatedInsights.spend ? parseFloat(relatedInsights.spend) : 0,
 impressions: relatedInsights.impressions ? parseInt(relatedInsights.impressions) : 0,
 reach: relatedInsights.reach ? parseInt(relatedInsights.reach) : 0,
 clicks: relatedInsights.inline_link_clicks ? parseInt(relatedInsights.inline_link_clicks) : 0,
 };
 });

 // Optional: Sort by spend (desc) or status
 mergedAds.sort((a: any, b: any) => b.spend - a.spend);

 return NextResponse.json({ data: mergedAds });

 } catch (error: any) {
 console.error("Error fetching Meta ads:", error);
 return NextResponse.json(
 { error: "Failed to fetch fetched ads." },
 { status: 500 }
 );
 }
}
