"use server";

import { getServerSession } from "next-auth";
import { logActivity } from "@/lib/activityLog";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/** Returns the campaign API key for the current org.
 * We store it as a JSON key inside the Organization's
 *`businessDescription` field to avoid a schema migration,
 * but ideally you'd add a dedicated column. */
async function getOrg() {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error("Not authenticated");
 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 });
 if (!org) throw new Error("Organization not found");
 return org;
}

function parseKeys(org: { businessDescription?: string | null }) {
 try {
 const data = JSON.parse(org.businessDescription || "{}");
 return {
 campaignApiKey: data.campaignApiKey ?? null,
 projectApiKey: data.projectApiKey ?? null,
 webhookSecret: data.webhookSecret ?? null,
 };
 } catch {
 return { campaignApiKey: null, projectApiKey: null, webhookSecret: null };
 }
}

type JsonMap = Record<string, unknown>;

function asJsonMap(value: unknown): JsonMap {
 return value && typeof value === "object" && !Array.isArray(value)
   ? value as JsonMap
   : {};
}

function parseJsonMap(value: string | null | undefined): JsonMap {
 try {
   return asJsonMap(JSON.parse(value || "{}"));
 } catch {
   return {};
 }
}

async function persistKeys(
 orgId: string,
 keys: { campaignApiKey?: string; projectApiKey?: string; webhookSecret?: string }
) {
 const org = await prisma.organization.findUnique({ where: { id: orgId } });
 let current: JsonMap = {};
 let originalDescription = "";
 if (org?.businessDescription) {
   const trimmed = org.businessDescription.trim();
   if (trimmed.startsWith('{')) {
     try {
       current = asJsonMap(JSON.parse(trimmed));
     } catch {
       originalDescription = org.businessDescription;
     }
   } else {
     originalDescription = org.businessDescription;
   }
 }

 await prisma.organization.update({
   where: { id: orgId },
   data: {
     businessDescription: JSON.stringify({
       ...current,
       ...keys,
       description: current.description || originalDescription
     }),
   },
 });
}

export async function getDeveloperKeys() {
 const org = await getOrg();
 const keys = parseKeys(org);

 // Auto-generate missing keys on first access
 if (!keys.campaignApiKey || !keys.projectApiKey || !keys.webhookSecret) {
 const newKeys = {
 campaignApiKey: keys.campaignApiKey ??`wbck_${randomBytes(32).toString("hex")}`,
 projectApiKey: keys.projectApiKey ??`wbpk_${randomBytes(24).toString("hex")}`,
 webhookSecret: keys.webhookSecret ??`wbwh_${randomBytes(20).toString("hex")}`,
 };
 await persistKeys(org.id, newKeys);
 return { ...newKeys, webhookUrl: buildWebhookUrl() };
 }

 return { ...keys, webhookUrl: buildWebhookUrl() };
}

export async function getDeveloperSampleData() {
 const org = await getOrg();
 const [contact, campaign] = await Promise.all([
   prisma.contact.findFirst({
     where: {
       organizationId: org.id,
       waId: { not: "" },
     },
     select: { waId: true },
     orderBy: { updatedAt: "desc" },
   }),
   prisma.scheduledMessage.findFirst({
     where: {
       organizationId: org.id,
       type: "DRIP",
     },
     select: { id: true },
     orderBy: { updatedAt: "desc" },
   }),
 ]);

 return {
   mobileNumber: contact?.waId || "923037771186",
   campaignId: campaign?.id || "CAMPAIGN_ID",
 };
}

export async function regenerateCampaignApiKey() {
 const org = await getOrg();
 const newKey =`wbck_${randomBytes(32).toString("hex")}`;
 await persistKeys(org.id, { campaignApiKey: newKey });
 
   const session = await getServerSession(authOptions);
   await logActivity({
     organizationId: org.id, userId: session?.user?.id || '', userEmail: session?.user?.email || '', userName: session?.user?.name || '',
     action: 'Updated', module: 'System', target: 'Campaign API Key', status: 'success'
   });
   return { campaignApiKey: newKey };
}

export async function regenerateProjectApiKey() {
 const org = await getOrg();
 const newKey =`wbpk_${randomBytes(24).toString("hex")}`;
 await persistKeys(org.id, { projectApiKey: newKey });
 
   const session = await getServerSession(authOptions);
   await logActivity({
     organizationId: org.id, userId: session?.user?.id || '', userEmail: session?.user?.email || '', userName: session?.user?.name || '',
     action: 'Updated', module: 'System', target: 'Project API Key', status: 'success'
   });
   return { projectApiKey: newKey };
}

export async function regenerateWebhookSecret() {
 const org = await getOrg();
 const newSecret =`wbwh_${randomBytes(20).toString("hex")}`;
 await persistKeys(org.id, { webhookSecret: newSecret });
 
   const session = await getServerSession(authOptions);
   await logActivity({
     organizationId: org.id, userId: session?.user?.id || '', userEmail: session?.user?.email || '', userName: session?.user?.name || '',
     action: 'Updated', module: 'System', target: 'Webhook Secret', status: 'success'
   });
   return { webhookSecret: newSecret };
}

function buildWebhookUrl() {
 return`${process.env.NEXTAUTH_URL ?? "https://app.watibot.pro"}/api/webhooks/whatsapp`;
}

// ─── Webhook subscription config ─────────────────────────────────────────────

export async function getWebhookConfig() {
 const org = await getOrg();
 const parsed = parseJsonMap(org.businessDescription);
 const webhookConfig = asJsonMap(parsed.webhookConfig);

 return {
 url: typeof webhookConfig.url === "string" ? webhookConfig.url : "",
 enabled: typeof webhookConfig.enabled === "boolean" ? webhookConfig.enabled : false,
 topics: Array.isArray(webhookConfig.topics)
   ? webhookConfig.topics.filter((topic): topic is string => typeof topic === "string")
   : [],
 deliveryAttempts: typeof webhookConfig.deliveryAttempts === "number" ? webhookConfig.deliveryAttempts : 0,
 lastDeliveredAt: webhookConfig.lastDeliveredAt ?? null,
 lastFailedAt: webhookConfig.lastFailedAt ?? null,
 webhookSecret: typeof parsed.webhookSecret === "string" ? parsed.webhookSecret : null,
 };
}

export async function saveWebhookConfig(payload: {
 url: string;
 enabled: boolean;
 topics: string[];
}) {
 const org = await getOrg();
 const parsed = parseJsonMap(org.businessDescription);

 const updated = {
 ...parsed,
 webhookConfig: {
 ...asJsonMap(parsed.webhookConfig),
 url: payload.url,
 enabled: payload.enabled,
 topics: payload.topics,
 },
 };

 await prisma.organization.update({
 where: { id: org.id },
 data: { businessDescription: JSON.stringify(updated) },
 });

 
  const session = await getServerSession(authOptions);
  await logActivity({
    organizationId: org.id, userId: session?.user?.id || '', userEmail: session?.user?.email || '', userName: session?.user?.name || '',
    action: 'Updated', module: 'System', target: 'Webhook Config', status: 'success'
  });
  return { success: true };
}

export async function toggleWebhook(enabled: boolean) {
 const org = await getOrg();
 const parsed = parseJsonMap(org.businessDescription);

 const updated = {
 ...parsed,
 webhookConfig: {
 ...asJsonMap(parsed.webhookConfig),
 enabled,
 },
 };

 await prisma.organization.update({
 where: { id: org.id },
 data: { businessDescription: JSON.stringify(updated) },
 });

 
  const session = await getServerSession(authOptions);
  await logActivity({
    organizationId: org.id, userId: session?.user?.id || '', userEmail: session?.user?.email || '', userName: session?.user?.name || '',
    action: enabled ? 'Activated' : 'Deactivated', module: 'System', target: 'Webhook', status: 'success'
  });
  return { success: true, enabled };
}
