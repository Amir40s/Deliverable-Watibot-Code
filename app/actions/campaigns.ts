'use server';

import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';
import { prisma } from'@/lib/prisma';

export interface AdAccount {
 id: string;
 account_id: string;
 name: string;
 currency: string;
 account_status: number;
}

export interface AdCampaign {
 id: string;
 name: string;
 status: string;
 objective: string;
 daily_budget?: string;
 lifetime_budget?: string;
 start_time?: string;
 stop_time?: string;
 insights?: {
 data: Array<{
 spend: string;
 impressions: string;
 clicks: string;
 }>;
 };
}

export async function getAdAccounts() {
 console.log('[GetAdAccounts] Starting...');
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 throw new Error('Unauthorized');
 }

 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: { metaAccessToken: true }
 });

 if (!org?.metaAccessToken) {
 return { error:'not_connected', message:'No Facebook account connected' };
 }

 // Fetch Ad Accounts
 // Fields: name, account_id, currency, account_status
 // account_status: 1 = ACTIVE
 const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,account_id,name,currency,account_status&access_token=${org.metaAccessToken}`;

 console.log(`[GetAdAccounts] Requesting: ${url.replace(org.metaAccessToken!, 'TOKEN_HIDDEN')}`);
 try {
 const res = await fetch(url);
 const data = await res.json();

 if (data.error) {
 console.error('[GetAdAccounts] Meta API Error:', data.error);
 return { error:'api_error', message: data.error.message, code: data.error.code };
 }

 return { success: true, data: data.data as AdAccount[] };
 } catch (e) {
 console.error('[GetAdAccounts] Fetch Error:', e);
 return { error:'server_error', message:'Failed to fetch ad accounts' };
 }
}

export async function getCampaigns(adAccountId: string) {
 if (!adAccountId) {
 throw new Error('Ad Account ID is required');
 }

 console.log(`[GetCampaigns] Fetching for account: ${adAccountId}`);
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 throw new Error('Unauthorized');
 }

 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: { metaAccessToken: true }
 });

 if (!org?.metaAccessToken) {
 return { error:'not_connected', message:'No Facebook account connected' };
 }

 // Ensure adAccountId starts with'act_' if not present, though usually the ID returned by API has it or not depending on context.
 // The previous call returns`id` like "act_123456" and`account_id` like "123456".
 // Graph API edge is usually /{ad_account_id}/campaigns. If using "act_NUM", pass it directly.
 const cleanId = adAccountId.startsWith('act_') ? adAccountId :`act_${adAccountId}`;

 // Fields to fetch
 const fields ='id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time';
 const url =`https://graph.facebook.com/v21.0/${cleanId}/campaigns?fields=${fields}&access_token=${org.metaAccessToken}&limit=50`;

 try {
 const res = await fetch(url);
 const data = await res.json();

 if (data.error) {
 console.error('[GetCampaigns] Meta API Error:', data.error);
 return { error:'api_error', message: data.error.message };
 }

 const campaignData = data.data as AdCampaign[];
 console.log('[GetCampaigns] Raw Meta Response:', JSON.stringify(campaignData, null, 2));
 return { success: true, data: campaignData };
 } catch (e) {
 console.error('[GetCampaigns] Fetch Error:', e);
 return { error:'server_error', message:'Failed to fetch campaigns' };
 }
}
