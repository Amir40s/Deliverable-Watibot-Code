"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { getPlanStorageLimit, getPlanSlugAliases } from "@/lib/plan-slugs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAdminVendorScope, verifyAdminPermission } from "@/lib/admin/rbac"

export type VendorRow = {
 id: string
 userId: string
 title: string
 adminName: string
 username: string
 email: string
 phoneNumber?: string | null
 status: string
 subscriptionStatus: string
 role?: string
 whatsappNumber?: string | null
 createdAt: Date | string
 lastLoginAt?: Date | string | null
 plan?: string | null
 contactsCount: number
 isAiBotEnabled?: boolean
 whatsappStatus?: string | null
 planStartDate?: Date | string | null
 planEndDate?: Date | string | null
 knowledgeBaseManagement?: string
 aiMessageLimit?: number
 isAiLimitUnlimited?: boolean
}

function parseMetaPhoneError(errorObj: any): { status: string; isRateLimitOrTransient: boolean } {
  if (!errorObj) return { status: "UNKNOWN", isRateLimitOrTransient: true };
  const msg = (errorObj.message || "").toLowerCase();
  const subcode = errorObj.error_subcode;
  const code = errorObj.code;

  // Rate limiting errors (Meta API busy / throttled) - NEVER treat as disconnected!
  if (
    code === 80008 ||
    code === 80007 ||
    code === 4 ||
    code === 17 ||
    code === 613 ||
    code === 32 ||
    msg.includes("too many calls") ||
    msg.includes("rate limit") ||
    msg.includes("throttled") ||
    msg.includes("wait a bit")
  ) {
    return { status: "RATE_LIMITED", isRateLimitOrTransient: true };
  }

  // Transient / temporary server errors
  if ((code >= 500 && code < 600) || msg.includes("temporarily unavailable") || msg.includes("timeout")) {
    return { status: "TRANSIENT_ERROR", isRateLimitOrTransient: true };
  }

  // Account bans and restrictions
  if (msg.includes("banned") || subcode === 2490350) {
    return { status: "BANNED", isRateLimitOrTransient: false };
  }
  if (msg.includes("disabled")) {
    return { status: "DISABLED", isRateLimitOrTransient: false };
  }
  if (msg.includes("restricted") || msg.includes("blocked")) {
    return { status: "DISABLED", isRateLimitOrTransient: false };
  }

  // Token expired / revoked
  if (msg.includes("revoked") || msg.includes("invalidated") || code === 190) {
    return { status: "DISCONNECTED", isRateLimitOrTransient: false };
  }

  // Entity does not exist / invalid ID
  if (code === 100 || msg.includes("does not exist") || msg.includes("unknown path") || msg.includes("cannot be found") || msg.includes("unsupported get request")) {
    return { status: "DISCONNECTED", isRateLimitOrTransient: false };
  }

  // App permission review or other OAuth errors - do not mark as disconnected
  return { status: "UNKNOWN_ERROR", isRateLimitOrTransient: true };
}

export async function computeVendorFilterCounts(vendors: VendorRow[]) {
  const now = Date.now();
  const in5Days = now + 5 * 24 * 60 * 60 * 1000;
  return {
    all: vendors.length,
    active: vendors.filter(v => (v.status === "ACTIVE" || v.subscriptionStatus === "active") && (v.whatsappStatus === "LIVE" || v.whatsappStatus === "CONNECTED" || v.whatsappStatus === "APPROVED")).length,
    expired: vendors.filter(v => v.status === "EXPIRED" || v.subscriptionStatus === "expired" || (!!v.planEndDate && new Date(v.planEndDate).getTime() < now)).length,
    expireSoon: vendors.filter(v => !!v.planEndDate && new Date(v.planEndDate).getTime() >= now && new Date(v.planEndDate).getTime() <= in5Days).length,
    pendingPlan: vendors.filter(v => v.status === "PENDING" || v.subscriptionStatus === "pending" || !v.plan || v.plan.toLowerCase() === "free" || v.plan.toLowerCase() === "pending").length,
    wabaActive: vendors.filter(v => v.whatsappStatus === "LIVE" || v.whatsappStatus === "CONNECTED" || v.whatsappStatus === "APPROVED").length,
    banned: vendors.filter(v => ["BANNED", "DISABLED", "BLOCKED", "RESTRICTED"].includes(v.whatsappStatus || "")).length,
    disconnected: vendors.filter(v => !v.whatsappStatus || v.whatsappStatus === "DISCONNECTED").length,
    suspended: vendors.filter(v => v.status === "SUSPENDED" || v.subscriptionStatus === "suspended").length,
    trial: vendors.filter(v => v.status === "TRIAL" || v.subscriptionStatus === "trial" || v.plan?.toLowerCase() === "trial").length,
  };
}

export async function getVendors(filter?: string, customUser?: any): Promise<VendorRow[]> {
  try {
    const session = customUser ? { user: customUser } : await getServerSession(authOptions);
    const userToEvaluate = customUser !== undefined ? customUser : session?.user;
    const scope = userToEvaluate
      ? getAdminVendorScope(userToEvaluate)
      : { isAllVendors: true, allowedVendorIds: [] };

    const [orgs, contactCounts, sysConfig] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          users: { some: {} },
          ...(scope.isAllVendors ? {} : { id: { in: scope.allowedVendorIds } }),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          whatsappNumber: true,
          whatsappPhoneNumberId: true,
          whatsappConnectionMethod: true,
          whatsappBusinessName: true,
          metaAccessToken: true,
          whatsapp_onboarding_raw_data: true,
          createdAt: true,
          plan: true,
          status: true,
          isAiBotEnabled: true,
          vendorConfig: true,
          users: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, email: true, phoneNumber: true, role: true, status: true, lastLoginAt: true, trialStartDate: true, trialLimitDays: true },
          }
        }
      }),
      prisma.contact.groupBy({
        by: ['organizationId'],
        _count: {
          id: true
        }
      }),
      prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { metaAccessToken: true }
      })
    ])

    const defaultMetaToken = sysConfig?.metaAccessToken || process.env.META_ACCESS_TOKEN || null;

    // Real-time parallel status check for all organizations with WhatsApp Phone IDs
    const liveStatusMap = new Map<string, { status: string; quality?: string; verifiedName?: string; displayPhone?: string }>();

    const checkPromises = orgs.map(async (org) => {
      // Skip QR-based connections as they are handled via Baileys and not Meta Graph API
      if (org.whatsappConnectionMethod === 'qr' || org.whatsappPhoneNumberId?.startsWith('qr_')) {
        liveStatusMap.set(org.id, {
          status: (org.whatsappPhoneNumberId || org.whatsappNumber) ? 'LIVE' : 'DISCONNECTED',
          quality: 'GREEN',
          verifiedName: org.whatsappBusinessName || org.name,
          displayPhone: org.whatsappNumber || undefined
        });
        return;
      }

      let cleanPhoneId = org.whatsappPhoneNumberId;
      if (cleanPhoneId === 'default_active_wa_id') cleanPhoneId = null;
      if (!cleanPhoneId) {
        const raw = (org.whatsapp_onboarding_raw_data as any) || {};
        const recovered = raw?.phone_number_id || raw?.phone_info?.id || raw?.whatsappPhoneNumberId;
        if (recovered && recovered !== 'default_active_wa_id') cleanPhoneId = recovered;
      }

      const rawData = (org.whatsapp_onboarding_raw_data as any) || {};
      const phoneInfo = rawData.phone_info || {};
      const cachedStatus = phoneInfo.status;
      const lastSynced = phoneInfo.last_synced_at ? new Date(phoneInfo.last_synced_at).getTime() : 0;
      const isFresh = (Date.now() - lastSynced) < 60 * 60 * 1000; // Fresh within 1 hour

      // If cached status is valid and recent, use it directly without exhausting Meta API rate limits
      if (cachedStatus && isFresh && cachedStatus !== 'DISCONNECTED') {
        liveStatusMap.set(org.id, {
          status: ['APPROVED', 'CONNECTED', 'LIVE'].includes(cachedStatus.toUpperCase()) ? 'LIVE' : cachedStatus.toUpperCase(),
          quality: phoneInfo.quality_rating || 'GREEN',
          verifiedName: phoneInfo.verified_name || org.name,
          displayPhone: phoneInfo.display_phone_number || org.whatsappNumber || undefined
        });
        return;
      }

      const token = org.metaAccessToken || defaultMetaToken;
      if (cleanPhoneId && token) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const res = await fetch(`https://graph.facebook.com/v21.0/${cleanPhoneId}?fields=display_phone_number,quality_rating,status,verified_name`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));

          if (res.ok) {
            const data = await res.json();
            const rawStatus = (data.status || "CONNECTED").toUpperCase();
            let liveStatus = "LIVE";
            if (['APPROVED', 'CONNECTED', 'LIVE'].includes(rawStatus)) {
              liveStatus = "LIVE";
            } else if (['BANNED', 'DISABLED', 'BLOCKED', 'RESTRICTED', 'SUSPENDED'].includes(rawStatus)) {
              liveStatus = rawStatus === 'RESTRICTED' ? 'DISABLED' : (rawStatus === 'BLOCKED' ? 'BANNED' : rawStatus);
            } else {
              liveStatus = rawStatus;
            }

            liveStatusMap.set(org.id, {
              status: liveStatus,
              quality: data.quality_rating || "GREEN",
              verifiedName: data.verified_name || org.name,
              displayPhone: data.display_phone_number
            });

            // Asynchronously update DB cache if changed
            if (phoneInfo.status !== liveStatus || phoneInfo.quality_rating !== data.quality_rating) {
              prisma.organization.update({
                where: { id: org.id },
                data: {
                  whatsapp_onboarding_raw_data: {
                    ...rawData,
                    phone_info: {
                      ...phoneInfo,
                      status: liveStatus,
                      quality_rating: data.quality_rating || phoneInfo.quality_rating || "GREEN",
                      verified_name: data.verified_name || phoneInfo.verified_name || org.name,
                      display_phone_number: data.display_phone_number || phoneInfo.display_phone_number,
                      last_synced_at: new Date().toISOString()
                    }
                  }
                }
              }).catch(() => {});
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            const parsedErr = parseMetaPhoneError(errData?.error);
            if (parsedErr.isRateLimitOrTransient) {
              // Rate limited by Meta: DO NOT overwrite DB as DISCONNECTED! Preserve existing status
              const safeStatus = (cachedStatus && cachedStatus !== 'DISCONNECTED') ? cachedStatus : (cleanPhoneId ? 'LIVE' : 'DISCONNECTED');
              liveStatusMap.set(org.id, {
                status: ['APPROVED', 'CONNECTED', 'LIVE'].includes(safeStatus.toUpperCase()) ? 'LIVE' : safeStatus.toUpperCase(),
                quality: phoneInfo.quality_rating || 'GREEN',
                verifiedName: phoneInfo.verified_name || org.name,
                displayPhone: phoneInfo.display_phone_number || org.whatsappNumber || undefined
              });
            } else {
              // Genuine permanent failure
              liveStatusMap.set(org.id, { status: parsedErr.status });
              if (phoneInfo.status !== parsedErr.status) {
                prisma.organization.update({
                  where: { id: org.id },
                  data: {
                    whatsapp_onboarding_raw_data: {
                      ...rawData,
                      phone_info: {
                        ...phoneInfo,
                        status: parsedErr.status,
                        last_synced_at: new Date().toISOString()
                      }
                    }
                  }
                }).catch(() => {});
              }
            }
          }
        } catch {
          // If network timeout or abort, fallback to cached state
          const safeStatus = (cachedStatus && cachedStatus !== 'DISCONNECTED') ? cachedStatus : (cleanPhoneId ? 'LIVE' : 'DISCONNECTED');
          liveStatusMap.set(org.id, {
            status: ['APPROVED', 'CONNECTED', 'LIVE'].includes(safeStatus.toUpperCase()) ? 'LIVE' : safeStatus.toUpperCase(),
            quality: phoneInfo.quality_rating || 'GREEN',
            verifiedName: phoneInfo.verified_name || org.name,
            displayPhone: phoneInfo.display_phone_number || org.whatsappNumber || undefined
          });
        }
      } else if (cleanPhoneId || org.whatsappNumber) {
        liveStatusMap.set(org.id, {
          status: 'LIVE',
          quality: phoneInfo.quality_rating || 'GREEN',
          verifiedName: org.name,
          displayPhone: org.whatsappNumber || undefined
        });
      }
    });

    await Promise.allSettled(checkPromises);

    const contactCountMap = new Map<string, number>(
      contactCounts.map(c => [c.organizationId, c._count.id])
    )

    const orgIds = orgs.map(o => o.id)
    const subscriptions = await prisma.subscription.findMany({
      where: { vendor: { in: orgIds } },
      orderBy: { createdAt: "desc" }
    })

    const latestSubMap = new Map<string, any>()
    for (const sub of subscriptions) {
      if (!latestSubMap.has(sub.vendor)) {
        latestSubMap.set(sub.vendor, sub)
      }
    }

    const dbPlans = await prisma.plan.findMany({
      select: { name: true, slug: true }
    });

    const planMap = new Map<string, string>();
    for (const p of dbPlans) {
      planMap.set(p.slug.toLowerCase().trim(), p.name);
    }

    const allVendors: VendorRow[] = orgs.map((org) => {
      const sub = latestSubMap.get(org.id);
      const rawPlan = (sub?.plan || org.plan || "free").toLowerCase().trim();
      const planName = planMap.get(rawPlan) || rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);

      let planStartDate: string | null = null;
      let planEndDate: string | null = null;

      if (sub?.startDate) {
        planStartDate = typeof sub.startDate === 'string' ? sub.startDate : sub.startDate.toISOString();
      } else if (org.users[0]?.trialStartDate) {
        planStartDate = typeof org.users[0].trialStartDate === 'string' ? org.users[0].trialStartDate : org.users[0].trialStartDate.toISOString();
      } else if (org.createdAt) {
        planStartDate = typeof org.createdAt === 'string' ? org.createdAt : org.createdAt.toISOString();
      }

      if (sub?.endDate) {
        planEndDate = typeof sub.endDate === 'string' ? sub.endDate : sub.endDate.toISOString();
      } else if (org.users[0]?.trialStartDate && org.users[0]?.trialLimitDays) {
        const end = new Date(org.users[0].trialStartDate);
        end.setDate(end.getDate() + org.users[0].trialLimitDays);
        planEndDate = end.toISOString();
      }

      const onboardingData = org.whatsapp_onboarding_raw_data as any;
      const statusFromOnboarding = onboardingData?.phone_info?.status;
      
      let cleanWaNumber = org.whatsappNumber;
      let cleanPhoneId = org.whatsappPhoneNumberId;
      if (cleanWaNumber === '+15550000000') cleanWaNumber = null;
      if (cleanPhoneId === 'default_active_wa_id') cleanPhoneId = null;
      if (!cleanPhoneId) {
        const recovered = onboardingData?.phone_number_id || onboardingData?.phone_info?.id || onboardingData?.whatsappPhoneNumberId;
        if (recovered && recovered !== 'default_active_wa_id') cleanPhoneId = recovered;
      }

      // Asynchronously clean up dummy records from DB if present
      if (org.whatsappNumber === '+15550000000' || org.whatsappPhoneNumberId === 'default_active_wa_id') {
        prisma.organization.update({
          where: { id: org.id },
          data: {
            ...(org.whatsappNumber === '+15550000000' ? { whatsappNumber: null } : {}),
            ...(org.whatsappPhoneNumberId === 'default_active_wa_id' ? { whatsappPhoneNumberId: null } : {})
          }
        }).catch(() => {});
      }

      const liveCheck = liveStatusMap.get(org.id);
      let whatsappStatus = "DISCONNECTED";

      const isQr = org.whatsappConnectionMethod === 'qr' || org.whatsappPhoneNumberId?.startsWith('qr_');

      if (liveCheck?.status && liveCheck.status !== 'DISCONNECTED') {
        whatsappStatus = liveCheck.status;
      } else if (isQr) {
        whatsappStatus = (cleanPhoneId || cleanWaNumber) ? "LIVE" : "DISCONNECTED";
      } else if (statusFromOnboarding && (cleanPhoneId || cleanWaNumber)) {
        const s = statusFromOnboarding.toUpperCase();
        if (['APPROVED', 'CONNECTED', 'LIVE'].includes(s)) {
          whatsappStatus = "LIVE";
        } else if (['BANNED', 'DISABLED', 'BLOCKED', 'RESTRICTED'].includes(s)) {
          whatsappStatus = s === 'RESTRICTED' ? 'DISABLED' : (s === 'BLOCKED' ? 'BANNED' : s);
        } else if (s === 'DISCONNECTED') {
          // If DB was corrupted with DISCONNECTED, but org has an active phone number or contacts, treat as LIVE
          const hasContacts = (contactCountMap.get(org.id) || 0) > 0;
          whatsappStatus = (cleanPhoneId || hasContacts) ? "LIVE" : "DISCONNECTED";
        } else {
          whatsappStatus = s;
        }
      } else if (cleanPhoneId || cleanWaNumber) {
        whatsappStatus = "LIVE";
      } else {
        whatsappStatus = "DISCONNECTED";
      }

      return {
        id: org.id,
        userId: org.users[0]?.id || "",
        title: org.name,
        adminName: org.users[0]?.name ?? org.users[0]?.email ?? org.name,
        username: org.slug,
        email: org.users[0]?.email ?? "—",
        phoneNumber: org.users[0]?.phoneNumber,
        status: (org.users[0]?.status as string) || "ACTIVE",
        subscriptionStatus: sub?.status?.[0] || org.status || "active",
        role: org.users[0]?.role,
        whatsappNumber: cleanWaNumber,
        createdAt: org.createdAt.toISOString(),
        lastLoginAt: org.users[0]?.lastLoginAt ? org.users[0].lastLoginAt.toISOString() : null,
        plan: planName,
        contactsCount: contactCountMap.get(org.id) || 0,
        isAiBotEnabled: org.isAiBotEnabled,
        whatsappStatus,
        planStartDate,
        planEndDate,
        knowledgeBaseManagement: (org.vendorConfig as any)?.knowledgeBaseManagement || "user",
        aiMessageLimit: typeof (org.vendorConfig as any)?.aiMessageLimit === "number" ? (org.vendorConfig as any).aiMessageLimit : 5000,
        isAiLimitUnlimited: !!(org.vendorConfig as any)?.isAiLimitUnlimited,
      }
    })

    if (!filter || filter.toUpperCase() === "ALL") {
      return allVendors
    }

    const normalizedFilter = (filter || "").toLowerCase().replace(/['"_\-\s]/g, "")
    const now = Date.now()
    const in5Days = now + 5 * 24 * 60 * 60 * 1000

    return allVendors.filter(v => {
      const isVendorActive = v.status === "ACTIVE" || v.subscriptionStatus === "active"
      const isWaLive = v.whatsappStatus === "LIVE" || v.whatsappStatus === "CONNECTED" || v.whatsappStatus === "APPROVED"

      if (normalizedFilter === "active") {
        return isVendorActive && isWaLive
      }
      if (normalizedFilter === "expired") {
        return (v.status as string) === "EXPIRED" || v.subscriptionStatus === "expired" || (!!v.planEndDate && new Date(v.planEndDate).getTime() < now)
      }
      if (normalizedFilter === "expiresoon") {
        return !!v.planEndDate && new Date(v.planEndDate).getTime() >= now && new Date(v.planEndDate).getTime() <= in5Days
      }
      if (normalizedFilter === "pendingplan" || normalizedFilter === "pending") {
        return v.status === "PENDING" || v.subscriptionStatus === "pending" || !v.plan || v.plan.toLowerCase() === "free" || v.plan.toLowerCase() === "pending"
      }
      if (normalizedFilter === "wabaactive") {
        return isWaLive
      }
      if (normalizedFilter === "banned") {
        return ["BANNED", "DISABLED", "BLOCKED", "RESTRICTED"].includes(v.whatsappStatus || "")
      }
      if (normalizedFilter === "disconnected") {
        return !v.whatsappStatus || v.whatsappStatus === "DISCONNECTED"
      }
      if (normalizedFilter === "suspended") {
        return v.status === "SUSPENDED" || v.subscriptionStatus === "suspended"
      }
      if (normalizedFilter === "trial") {
        return v.status === "TRIAL" || v.subscriptionStatus === "trial" || v.plan?.toLowerCase() === "trial"
      }
      return false
    })
  } catch (error) {
    console.error("Failed to fetch vendors:", error)
    return []
  }
}

export async function createVendor(data: any) {
 try {
  const session = await getServerSession(authOptions)
  const check = verifyAdminPermission(session?.user, "vendors", "write")
  if (!check.allowed) {
    return { error: check.error || "Forbidden: Vendors write permission required" }
  }

  const { title, username, firstName, lastName, email, password, whatsappNumber } = data

 // Check if organization slug or user email already exists
 const existingOrg = await prisma.organization.findUnique({ where: { slug: username } })
 if (existingOrg) return { error: "Username already taken" }

 const existingUser = await prisma.user.findUnique({ where: { email } })
 if (existingUser) return { error: "Email already exists" }

 const hashedPassword = await bcrypt.hash(password, 10)

 const organization = await prisma.organization.create({
 data: {
 name: title,
 slug: username,
 whatsappNumber,
 status: "active",
 users: {
 create: {
 name:`${firstName} ${lastName}`.trim(),
 email,
 password: hashedPassword,
 role: "ADMIN",
 status: "ACTIVE",
 }
 }
 }
 })

 revalidatePath("/admin/vendors")
 return { success: true, organization }
 } catch (error: any) {
 console.error("Failed to create vendor:", error)
 return { error: error.message || "An unexpected error occurred" }
 }
}

export async function updateVendor(data: any) {
  try {
    const session = await getServerSession(authOptions);
    const check = verifyAdminPermission(session?.user, "vendors", "write");
    if (!check.allowed) {
      return { error: check.error || "Forbidden: Vendors write permission required" };
    }
    const scope = getAdminVendorScope(session?.user);
    if (!scope.isAllVendors && !scope.allowedVendorIds.includes(data?.id)) {
      return { error: "Forbidden: You do not have permission to manage this specific vendor" };
    }

    const { 
      id, 
      // Organization Details
      title, username, whatsappNumber, country, timezone,
      // Account Settings
      status, role, emailVerified, phoneVerified, twoFactorAuth, allowLogin, loginAsVendor,
      // Subscription
      plan, billingCycle, subscriptionStatus, trialStartDate, trialEndDate, expiryDate, nextBillingDate, autoRenew,
      // Contact Person
      contactPerson, email, mobileNumber,
      // Limits & Permissions (Stored in vendorConfig)
      contactsLimit, broadcastLimit, campaignLimit, storageLimit, aiCredits,
      isAiBotEnabled, enableCampaigns, enableApiAccess, enableLiveChat, enableAutomation,
      knowledgeBaseManagement, aiMessageLimit, isAiLimitUnlimited,
      // Notes
      adminNotes,
      trialLimitDays
    } = data;

    // Normalize status logic:
    // User explicitly selected status takes precedence
    let finalUserStatus = status;
    let finalOrgStatus = status ? status.toLowerCase() : (subscriptionStatus ? subscriptionStatus.toLowerCase() : undefined);

    if (status === 'INACTIVE' || status === 'SUSPENDED' || status === 'PENDING' || status === 'ACTIVE' || status === 'TRIAL') {
      finalOrgStatus = status.toLowerCase();
      finalUserStatus = status;
    }

    // Detect if plan is changing to reset configuration overrides to the new plan's defaults.
    const existingOrg = await prisma.organization.findUnique({
      where: { id },
      select: { plan: true, vendorConfig: true, isAiBotEnabled: true }
    });
    const existingConfig = (existingOrg?.vendorConfig as Record<string, unknown> | null) || {};

    // Always fetch the plan's default limits from DB and use them as the base.
    // This ensures no stale cached/overridden limits from previous plans persist.
    const requestedPlanSlug = (plan || existingOrg?.plan || 'free').toLowerCase().trim();
    const allDbPlans = await prisma.plan.findMany();
    const targetPlan = allDbPlans.find(p => p.slug.toLowerCase().trim() === requestedPlanSlug || p.name.toLowerCase().trim() === requestedPlanSlug)
      || await prisma.plan.findFirst({ where: { slug: { in: getPlanSlugAliases(requestedPlanSlug) } } });
    const targetPlanSlug = targetPlan?.slug || requestedPlanSlug;

    const finalContactsLimit = targetPlan?.maxContacts ?? contactsLimit ?? 100;
    const finalBroadcastLimit = targetPlan?.maxBotReplies ?? broadcastLimit ?? 100;
    const finalCampaignLimit = targetPlan?.maxCampaigns ?? campaignLimit ?? 10;
    const finalBotFlowsLimit = targetPlan?.maxBotFlows ?? data.maxBotFlows ?? 2;
    const finalTeamMembersLimit = targetPlan?.maxTeamMembers ?? data.maxTeamMembers ?? data.maxMembers ?? 1;
    const finalStorageLimit = getPlanStorageLimit(targetPlanSlug);
    const finalAiCredits = targetPlan?.aiChatBotEnabled ? 500 : (aiCredits ?? 0);
    const finalIsAiBotEnabled = isAiBotEnabled ?? existingOrg?.isAiBotEnabled ?? false;
    const finalEnableCampaigns = targetPlan ? (targetPlan.maxCampaigns !== 0) : (enableCampaigns ?? true);
    const finalEnableApiAccess = targetPlan?.apiWebhookAccess ?? enableApiAccess ?? false;
    const finalEnableLiveChat = enableLiveChat ?? true;
    const finalEnableAutomation = targetPlan ? (targetPlan.maxBotFlows !== 0) : (enableAutomation ?? true);
    
    const vendorConfig = {
      ...existingConfig,
      country: country !== undefined ? country : (existingConfig.country || ""),
      phoneVerified: phoneVerified !== undefined ? phoneVerified : (existingConfig.phoneVerified || false),
      twoFactorAuth: twoFactorAuth !== undefined ? twoFactorAuth : (existingConfig.twoFactorAuth || false),
      allowLogin: allowLogin !== undefined ? allowLogin : (existingConfig.allowLogin !== false),
      loginAsVendor: loginAsVendor !== undefined ? loginAsVendor : (existingConfig.loginAsVendor !== false),
      planSlug: targetPlanSlug,
      contactsLimit: finalContactsLimit,
      broadcastLimit: finalBroadcastLimit,
      campaignLimit: finalCampaignLimit,
      maxBotFlows: finalBotFlowsLimit,
      maxTeamMembers: finalTeamMembersLimit,
      storageLimit: finalStorageLimit,
      aiCredits: finalAiCredits,
      enableCampaigns: finalEnableCampaigns,
      enableApiAccess: finalEnableApiAccess,
      enableLiveChat: finalEnableLiveChat,
      enableAutomation: finalEnableAutomation,
      modulesAccess: targetPlan ? (targetPlan.modulesAccess || {}) : (existingConfig.modulesAccess || {}),
      knowledgeBaseManagement: knowledgeBaseManagement || existingConfig.knowledgeBaseManagement || "user",
      aiMessageLimit: typeof aiMessageLimit === "number" ? aiMessageLimit : (typeof existingConfig.aiMessageLimit === "number" ? existingConfig.aiMessageLimit : 5000),
      isAiLimitUnlimited: typeof isAiLimitUnlimited === "boolean" ? isAiLimitUnlimited : (existingConfig.isAiLimitUnlimited ?? false),
    };

    await prisma.organization.update({
      where: { id },
      data: {
        name: title,
        slug: username,
        whatsappNumber,
        timezone,
        isAiBotEnabled: finalIsAiBotEnabled,
        adminNotes,
        vendorConfig,
        ...(finalOrgStatus && { status: finalOrgStatus }),
        ...(plan && { plan: targetPlanSlug }),
      }
    });
    
    // 2. Update User (Admin)
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { users: { take: 1, orderBy: { createdAt: "asc" } } }
    });
    
    if (org?.users?.[0]) {
      const adminUserId = org.users[0].id;
      
      const userUpdateData: any = {};
      if (role) userUpdateData.role = role;
      if (finalUserStatus) {
        userUpdateData.status = finalUserStatus;
        if (finalUserStatus === 'TRIAL' && trialStartDate) {
          userUpdateData.trialStartDate = new Date(trialStartDate);
        }
      }
      if (contactPerson) userUpdateData.name = contactPerson;
      if (email) userUpdateData.email = email;
      if (mobileNumber) userUpdateData.phoneNumber = mobileNumber;
      if (typeof emailVerified === 'boolean') {
        userUpdateData.emailVerified = emailVerified ? new Date() : null;
      }

      // Handle computed trial fields
      if (trialStartDate && trialEndDate) {
        const start = new Date(trialStartDate);
        const end = new Date(trialEndDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        userUpdateData.trialLimitDays = diffDays;
        userUpdateData.trialStartDate = start;
      } else if (trialLimitDays !== undefined) {
        userUpdateData.trialLimitDays = trialLimitDays;
      }

      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: adminUserId },
          data: userUpdateData
        });
      }
    }

    // 3. Update Subscription
    // Check if subscription exists
    const subscription = await prisma.subscription.findFirst({
      where: { vendor: id },
      orderBy: { createdAt: 'desc' }
    });

    const subEndDateString = (targetPlanSlug === 'free' && finalUserStatus === 'TRIAL')
      ? trialEndDate
      : (expiryDate || nextBillingDate);

    const subStartDateString = (targetPlanSlug === 'free' && finalUserStatus === 'TRIAL')
      ? trialStartDate
      : undefined;

    const parsedStartDate = subStartDateString ? new Date(subStartDateString) : undefined;
    const parsedEndDate = subEndDateString ? new Date(subEndDateString) : undefined;

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: targetPlanSlug,
          status: subscriptionStatus ? [subscriptionStatus] : undefined,
          frequency: billingCycle,
          ...(parsedStartDate && { startDate: parsedStartDate }),
          ...(parsedEndDate && { endDate: parsedEndDate }),
          isAuto: autoRenew === true,
        }
      });
    } else {
      await prisma.subscription.create({
        data: {
          vendor: id, // Link subscription to organization ID
          isAuto: autoRenew === true,
          plan: targetPlanSlug,
          startDate: parsedStartDate || new Date(),
          endDate: parsedEndDate || new Date(new Date().setMonth(new Date().getMonth() + 1)),
          amount: 0,
          currency: "USD",
          frequency: billingCycle || "monthly",
          status: subscriptionStatus ? [subscriptionStatus] : ["active"],
        }
      });
    }
    
    revalidatePath("/admin/vendors");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update vendor:", error);
    return { error: error.message || "An unexpected error occurred" };
  }
}

async function performVendorCascadeDelete(tx: any, organizationId: string) {
  // 1. Break the circular relation between Organization and owner User
  try {
    await tx.organization.update({
      where: { id: organizationId },
      data: { ownerId: null }
    })
  } catch (e) {
    console.warn("Could not nullify organization ownerId:", e)
  }

  // 2. Find all users of this organization to clean up auth records
  const orgUsers = await tx.user.findMany({
    where: { organizationId },
    select: { id: true }
  })
  const userIds = orgUsers.map((u: any) => u.id)

  if (userIds.length > 0) {
    await tx.account.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {})
    await tx.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {})
    await tx.deviceSetting.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {})
  }

  // 3. Clear dependent child records that might not cascade automatically
  await tx.subscription.deleteMany({ where: { vendor: organizationId } }).catch(() => {})
  await tx.activityLog.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.quickReply.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.welcomeMessage.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.scheduledMessage.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.externalWebhook.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.knowledgeChunk.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.knowledgeBase.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.mediaLibraryItem.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.whatsAppQRSession.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.aiRoutingRule.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.tagAssignmentRule.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.agentChatAssignmentRule.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.windowReminderLog.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.windowReminderRule.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.chatAssignmentHistory.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.aIAgentExecution.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.aIFunction.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.aIMcpServer.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.aIAgent.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.pipeline.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.product.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.tag.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.department.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.order.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.appointment.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.bookedCall.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.businessService.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.businessProfile.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.flowExecution.deleteMany({ where: { flow: { organizationId } } }).catch(() => {})
  await tx.flow.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.message.deleteMany({ where: { contact: { organizationId } } }).catch(() => {})
  await tx.contactGroupMember.deleteMany({ where: { group: { organizationId } } }).catch(() => {})
  await tx.contactGroup.deleteMany({ where: { organizationId } }).catch(() => {})
  await tx.contact.deleteMany({ where: { organizationId } }).catch(() => {})

  // 4. Delete all users belonging to this organization
  await tx.user.deleteMany({ where: { organizationId } })

  // 5. Delete the organization
  await tx.organization.delete({ where: { id: organizationId } })
}

export async function deleteVendor(id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
      return { error: "Unauthorized: Admin privileges required" }
    }

    const check = verifyAdminPermission(session.user, "vendors", "write")
    if (!check.allowed) {
      return { error: check.error || "Forbidden: Vendors write permission required" }
    }

    const scope = getAdminVendorScope(session.user)
    if (!scope.isAllVendors && !scope.allowedVendorIds.includes(id)) {
      return { error: "Forbidden: You do not have permission to manage this specific vendor" }
    }

    await prisma.$transaction(async (tx) => {
      await performVendorCascadeDelete(tx, id)
    }, {
      maxWait: 10000,
      timeout: 20000,
    })

    revalidatePath("/admin/vendors")
    revalidatePath("/[locale]/admin/vendors", "page")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete vendor:", error)
    return { error: error.message || "An unexpected error occurred while deleting vendor" }
  }
}

export async function deleteVendorsBulk(ids: string[]) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
      return { error: "Unauthorized: Admin privileges required" }
    }

    const check = verifyAdminPermission(session.user, "vendors", "write")
    if (!check.allowed) {
      return { error: check.error || "Forbidden: Vendors write permission required" }
    }

    const scope = getAdminVendorScope(session.user)
    const targetIds = scope.isAllVendors ? ids : ids.filter((id) => scope.allowedVendorIds.includes(id))

    if (!targetIds || targetIds.length === 0) {
      return { error: "Forbidden: None of the selected vendors are within your assigned scope" }
    }

    let deletedCount = 0
    const errors: string[] = []

    for (const id of targetIds) {
      try {
        await prisma.$transaction(async (tx) => {
          await performVendorCascadeDelete(tx, id)
        }, {
          maxWait: 10000,
          timeout: 20000,
        })
        deletedCount++
      } catch (err: any) {
        console.error(`Failed deleting vendor ${id}:`, err)
        errors.push(err.message || id)
      }
    }

    revalidatePath("/admin/vendors")
    revalidatePath("/[locale]/admin/vendors", "page")

    return {
      success: true,
      count: deletedCount,
      failed: errors.length,
    }
  } catch (error: any) {
    console.error("Failed to bulk delete vendors:", error)
    return { error: error.message || "An unexpected error occurred during bulk deletion" }
  }
}

export async function changeVendorPassword(id: string, newPassword: string) {
 try {
 const organization = await prisma.organization.findUnique({
 where: { id },
 include: { users: { where: { role: "ADMIN" }, take: 1 } }
 })
 
 if (!organization || organization.users.length === 0) {
 return { error: "Admin user not found for this vendor" }
 }

 const adminUser = organization.users[0]
 const hashedPassword = await bcrypt.hash(newPassword, 10)
 
 await prisma.user.update({
 where: { id: adminUser.id },
 data: { password: hashedPassword }
 })
 
 return { success: true }
 } catch (error: any) {
 console.error("Failed to change vendor password:", error)
 return { error: error.message || "An unexpected error occurred" }
 }
}

export async function getPlans() {
 try {
 const dbPlansRaw = await prisma.plan.findMany({
 orderBy: { createdAt:'asc' }
 });
 const dbPlans = dbPlansRaw.map((plan) => ({
 id: plan.id,
 name: plan.name,
 slug: plan.slug,
 isEnabled: plan.isEnabled,
 maxContacts: plan.maxContacts,
 maxCampaigns: plan.maxCampaigns,
 maxBotReplies: plan.maxBotReplies,
 maxBotFlows: plan.maxBotFlows,
 maxCustomFields: plan.maxCustomFields,
 maxTeamMembers: plan.maxTeamMembers,
 aiChatBotEnabled: plan.aiChatBotEnabled,
 apiWebhookAccess: plan.apiWebhookAccess,
 monthlyEnabled: plan.monthlyEnabled,
 monthlyPrice: plan.monthlyPrice ? Number(plan.monthlyPrice) : 0,
 yearlyEnabled: plan.yearlyEnabled,
 yearlyPrice: plan.yearlyPrice ? Number(plan.yearlyPrice) : 0,
 currency: plan.currency,
 createdAt: plan.createdAt.toISOString(),
 updatedAt: plan.updatedAt.toISOString(),
 }));
   return { success: true, data: dbPlans };
  } catch (error: any) {
  console.error("Failed to fetch plans:", error);
  return { error: "Failed to fetch plans" };
  }
}

export async function getVendorFullDetails(vendorId: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: vendorId },
      include: {
        users: { take: 1, orderBy: { createdAt: "asc" } },
        _count: {
          select: {
            contacts: true,
            flows: true,
            scheduledMessages: true,
            quickReplies: true,
          }
        }
      }
    });

    if (!org) return { error: "Vendor not found" };

    const subscription = await prisma.subscription.findFirst({
      where: { vendor: vendorId },
      orderBy: { createdAt: 'desc' }
    });

    const recentActivity = await prisma.activityLog.findMany({
      where: { organizationId: vendorId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const dbPlans = await prisma.plan.findMany({
      select: { name: true, slug: true }
    });

    const planMap = new Map<string, string>();
    for (const p of dbPlans) {
      planMap.set(p.slug.toLowerCase().trim(), p.name);
    }

    const rawPlan = (org.plan || "free").toLowerCase().trim();
    const planName = planMap.get(rawPlan) || rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);

    const { getAiUsageAndLimit } = await import("@/lib/ai/ai-limit");
    const aiUsageInfo = await getAiUsageAndLimit(vendorId);

    const serializedOrganization = {
      ...org,
      aiUsageInfo,
      knowledgeBaseManagement: (org.vendorConfig as any)?.knowledgeBaseManagement || "user",
      aiMessageLimit: typeof (org.vendorConfig as any)?.aiMessageLimit === "number" ? (org.vendorConfig as any).aiMessageLimit : 5000,
      isAiLimitUnlimited: !!(org.vendorConfig as any)?.isAiLimitUnlimited,
      plan: org.plan || "free",
      planName: planName,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      users: org.users.map((user) => ({
        ...user,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        trialStartDate: user.trialStartDate?.toISOString() ?? null,
      })),
    };

    const serializedSubscription = subscription
      ? {
          ...subscription,
          plan: subscription.plan || "free",
          planName: planMap.get((subscription.plan || "free").toLowerCase().trim()) || subscription.plan,
          amount: Number(subscription.amount),
          startDate: subscription.startDate.toISOString(),
          endDate: subscription.endDate.toISOString(),
          createdAt: subscription.createdAt.toISOString(),
          updatedAt: subscription.updatedAt.toISOString(),
        }
      : null;

    const serializedRecentActivity = recentActivity.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        organization: serializedOrganization,
        subscription: serializedSubscription,
        recentActivity: serializedRecentActivity
      }
    };
  } catch (error: any) {
    console.error("Failed to fetch full vendor details:", error);
    return { error: "Failed to fetch vendor details" };
  }
}

export async function updateUserAccountStatus(userId: string, newStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED') {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus as any },
    });

    if (user.organizationId) {
      const orgStatus = newStatus === 'ACTIVE' ? 'active' : newStatus === 'SUSPENDED' ? 'suspended' : 'pending';
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { status: orgStatus },
      }).catch(() => null);
    }

    revalidatePath('/admin/vendors');
    revalidatePath('/manage/agents');
    return { success: true, user };
  } catch (error: any) {
    console.error("Failed to update user account status:", error);
    return { error: error?.message || "Failed to update account status" };
  }
}

export async function syncVendorWhatsAppStatus(vendorId: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        whatsappPhoneNumberId: true,
        whatsappNumber: true,
        whatsappConnectionMethod: true,
        metaAccessToken: true,
        whatsapp_onboarding_raw_data: true,
      }
    });

    if (org && !org.whatsappPhoneNumberId) {
      const rawData = (org?.whatsapp_onboarding_raw_data as any) || {};
      const recoveredPhoneId = rawData?.phone_number_id || rawData?.phone_info?.id || rawData?.whatsappPhoneNumberId;
      const recoveredWabaId = rawData?.waba_id || rawData?.whatsappBusinessId;
      if (recoveredPhoneId && org.id && recoveredPhoneId !== 'default_active_wa_id') {
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            whatsappPhoneNumberId: recoveredPhoneId,
            ...(recoveredWabaId ? { whatsappBusinessId: recoveredWabaId } : {})
          }
        }).catch(() => {});
        org.whatsappPhoneNumberId = recoveredPhoneId;
      }
    }

    if (!org) {
      return { error: "Vendor organization not found." };
    }
    let phoneId = org.whatsappPhoneNumberId;
    if (phoneId === 'default_active_wa_id') phoneId = null;
    let whatsappNum = org.whatsappNumber;
    if (whatsappNum === '+15550000000') whatsappNum = null;

    if (org.whatsappPhoneNumberId === 'default_active_wa_id' || org.whatsappNumber === '+15550000000') {
      await prisma.organization.update({
        where: { id: vendorId },
        data: {
          ...(org.whatsappPhoneNumberId === 'default_active_wa_id' ? { whatsappPhoneNumberId: null } : {}),
          ...(org.whatsappNumber === '+15550000000' ? { whatsappNumber: null } : {})
        }
      }).catch(() => {});
    }

    if (!phoneId) {
      const rawData = (org.whatsapp_onboarding_raw_data as any) || {};
      const recovered = rawData.phone_number_id || rawData.phone_info?.id || rawData.whatsappPhoneNumberId || null;
      if (recovered && recovered !== 'default_active_wa_id') {
        phoneId = recovered;
      }
    }

    if (org.whatsappConnectionMethod === 'qr' || org.whatsappPhoneNumberId?.startsWith('qr_')) {
      revalidatePath("/admin/vendors");
      return { 
        success: true, 
        status: org.whatsappPhoneNumberId ? "LIVE" : "DISCONNECTED", 
        quality: "GREEN" 
      };
    }

    if (!phoneId && !whatsappNum) {
      revalidatePath("/admin/vendors");
      return { success: true, status: "DISCONNECTED", quality: "UNKNOWN" };
    }

    const rawData = (org.whatsapp_onboarding_raw_data as any) || {};
    const phoneInfo = rawData.phone_info || {};

    let liveStatus = phoneId || whatsappNum ? "LIVE" : "DISCONNECTED";
    let liveQuality = phoneInfo.quality_rating || "GREEN";
    let liveVerifiedName = phoneInfo.verified_name || org.name;

    let token = org.metaAccessToken;
    if (!token) {
      const sysConfig = await prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { metaAccessToken: true }
      });
      token = sysConfig?.metaAccessToken || process.env.META_ACCESS_TOKEN || null;
    }

    if (phoneId && token) {
      try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,quality_rating,status,verified_name`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const rawStatus = (data.status || "CONNECTED").toUpperCase();
          liveQuality = data.quality_rating || liveQuality;
          liveVerifiedName = data.verified_name || liveVerifiedName;

          if (['APPROVED', 'CONNECTED', 'LIVE'].includes(rawStatus)) {
            liveStatus = "LIVE";
          } else if (['BANNED', 'DISABLED', 'BLOCKED', 'RESTRICTED', 'SUSPENDED'].includes(rawStatus)) {
            liveStatus = rawStatus === 'RESTRICTED' ? 'DISABLED' : (rawStatus === 'BLOCKED' ? 'BANNED' : rawStatus);
          } else {
            liveStatus = rawStatus;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          const parsedErr = parseMetaPhoneError(errData?.error);
          if (parsedErr.isRateLimitOrTransient) {
            // Keep previous status or default to LIVE - do NOT mark DISCONNECTED on rate limit!
            liveStatus = phoneInfo.status && phoneInfo.status !== 'DISCONNECTED' ? phoneInfo.status : 'LIVE';
          } else {
            liveStatus = parsedErr.status;
          }
        }
      } catch (err) {
        console.error("Meta Graph API fetch error:", err);
      }
    }

    const newOnboardingRawData = {
      ...rawData,
      phone_info: {
        ...phoneInfo,
        status: liveStatus,
        quality_rating: liveQuality,
        verified_name: liveVerifiedName,
        last_synced_at: new Date().toISOString()
      }
    };

    await prisma.organization.update({
      where: { id: vendorId },
      data: {
        whatsappPhoneNumberId: phoneId,
        whatsapp_onboarding_raw_data: newOnboardingRawData
      }
    });

    revalidatePath("/admin/vendors");
    return { success: true, status: liveStatus };
  } catch (error: any) {
    console.error("Failed to sync vendor WhatsApp status:", error);
    return { error: error.message || "Failed to sync status with Meta" };
  }
}

export async function disconnectVendorWhatsApp(vendorId: string) {
  try {
    await prisma.organization.update({
      where: { id: vendorId },
      data: {
        whatsappBusinessId: null,
        whatsappPhoneNumberId: null,
        whatsappNumber: null,
        whatsappBusinessName: null,
        metaBusinessId: null,
        metaAccessToken: null,
        embedded_setup_done_at: null,
        whatsapp_onboarding_raw_data: Prisma.DbNull as any,
        whatsapp_token_info_data: Prisma.DbNull as any,
      }
    });
    revalidatePath("/admin/vendors");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to disconnect vendor WhatsApp:", error);
    return { success: false, error: error?.message || "Failed to disconnect WhatsApp" };
  }
}

export async function syncAllVendorsWhatsAppStatus() {
  try {
    const orgs = await prisma.organization.findMany({
      where: {
        whatsappPhoneNumberId: { not: null },
        NOT: [
          { whatsappConnectionMethod: 'qr' },
          { whatsappPhoneNumberId: { startsWith: 'qr_' } }
        ]
      },
      select: { id: true }
    });

    let syncedCount = 0;
    for (const org of orgs) {
      const res = await syncVendorWhatsAppStatus(org.id);
      if (res.success) syncedCount++;
      // 350ms delay between calls to avoid Meta Graph API rate limits
      await new Promise(r => setTimeout(r, 350));
    }

    revalidatePath("/admin/vendors");
    return { success: true, count: syncedCount };
  } catch (error: any) {
    console.error("Failed to batch sync vendor WhatsApp statuses:", error);
    return { error: error.message || "Failed to batch sync statuses" };
  }
}

export async function getVendorPermissions(organizationId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
      return { error: "Unauthorized" };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, vendorConfig: true }
    });

    if (!org) {
      return { error: "Vendor organization not found" };
    }

    const config = (org.vendorConfig as Record<string, unknown> | null) || {};
    const modulesAccess = (config.modulesAccess as Record<string, boolean>) || {};

    return { success: true, modulesAccess, vendorTitle: org.name };
  } catch (error: any) {
    console.error("Failed to fetch vendor permissions:", error);
    return { error: error?.message || "Failed to fetch vendor permissions" };
  }
}

export async function updateVendorPermissions(organizationId: string, modulesAccess: Record<string, boolean>) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN")) {
      return { error: "Unauthorized" };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, vendorConfig: true }
    });

    if (!org) {
      return { error: "Vendor organization not found" };
    }

    const existingConfig = (org.vendorConfig as Record<string, unknown> | null) || {};
    const existingModules = (existingConfig.modulesAccess as Record<string, boolean>) || {};

    const updatedVendorConfig = {
      ...existingConfig,
      modulesAccess: {
        ...existingModules,
        ...modulesAccess
      }
    };

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        vendorConfig: updatedVendorConfig,
        updatedAt: new Date()
      }
    });

    revalidatePath("/admin/vendors");
    revalidatePath("/[locale]/admin/vendors", "page");

    return { success: true, modulesAccess, vendorTitle: org.name };
  } catch (error: any) {
    console.error("Failed to update vendor permissions:", error);
    return { error: error?.message || "Failed to update vendor permissions" };
  }
}

export async function getCurrentAdminPermissions(): Promise<{ canWrite: boolean; isSuperAdmin: boolean }> {
  try {
    const session = await getServerSession(authOptions);
    const check = verifyAdminPermission(session?.user, "vendors", "write");
    return {
      canWrite: check.allowed,
      isSuperAdmin: check.isSuperAdmin,
    };
  } catch {
    return { canWrite: false, isSuperAdmin: false };
  }
}

