'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type RestrictionResource = 'PHONE_NUMBER' | 'WABA' | 'BUSINESS_PORTFOLIO' | 'META_APP' | 'UNKNOWN';

export interface ResourceHealthDetail {
  status: 'ACTIVE' | 'RESTRICTED' | 'BANNED' | 'DISABLED' | 'SUSPENDED' | 'REJECTED' | 'PENDING' | 'UNKNOWN';
  label: string;
  rawStatus: string | null;
  reason: string | null;
  details?: string | null;
  code?: number | null;
  subcode?: number | null;
  lastChecked: string;
}

export interface WhatsAppHealthDiagnosis {
  lastChecked: string;
  overallStatus: 'HEALTHY' | 'RESTRICTED' | 'BANNED' | 'DISABLED' | 'UNKNOWN';
  overallLabel: string;
  affectedResources: RestrictionResource[];
  primaryIssue: string | null;
  headline: string;
  phone: ResourceHealthDetail & {
    id: string | null;
    displayNumber: string | null;
    qualityRating: string | null;
    verifiedName: string | null;
  };
  waba: ResourceHealthDetail & {
    id: string | null;
    name: string | null;
    accountReviewStatus: string | null;
    banInfo?: any;
  };
  business: ResourceHealthDetail & {
    id: string | null;
    name: string | null;
    verificationStatus: string | null;
    isDisabled: boolean;
  };
  app?: ResourceHealthDetail & {
    id?: string | null;
    isValid?: boolean;
  };
  isQrConnection?: boolean;
}

function parseMetaErrorReason(errorObj: any): { reason: string; code: number | null; subcode: number | null } {
  if (!errorObj) {
    return { reason: 'Unknown Meta API response', code: null, subcode: null };
  }
  const code = typeof errorObj.code === 'number' ? errorObj.code : null;
  const subcode = typeof errorObj.error_subcode === 'number' ? errorObj.error_subcode : null;
  const userMsg = errorObj.error_user_msg || errorObj.error_user_title;
  const msg = errorObj.message || 'Meta API returned an error.';

  const fullReason = userMsg ? `${userMsg} (${msg})` : msg;
  return { reason: fullReason, code, subcode };
}

/**
 * Checks and diagnoses the WhatsApp / Meta account health at 3 independent layers:
 * 1. WhatsApp Phone Number
 * 2. WhatsApp Business Account (WABA)
 * 3. Meta Business Portfolio / Business Manager
 */
export async function checkWhatsAppHealthStatus(
  forceRefresh = false,
  targetOrgId?: string
): Promise<WhatsAppHealthDiagnosis> {
  const session = await getServerSession(authOptions);
  let orgId = targetOrgId || session?.user?.organizationId;

  if (!orgId && session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });
    orgId = user?.organizationId || undefined;
  }

  const nowIso = new Date().toISOString();

  const defaultEmptyDiagnosis: WhatsAppHealthDiagnosis = {
    lastChecked: nowIso,
    overallStatus: 'UNKNOWN',
    overallLabel: 'Not Connected',
    affectedResources: [],
    primaryIssue: null,
    headline: 'WhatsApp account not configured or connected.',
    phone: {
      id: null,
      displayNumber: null,
      status: 'UNKNOWN',
      label: 'Not Configured',
      rawStatus: null,
      qualityRating: null,
      verifiedName: null,
      reason: null,
      lastChecked: nowIso,
    },
    waba: {
      id: null,
      name: null,
      status: 'UNKNOWN',
      label: 'Not Configured',
      rawStatus: null,
      accountReviewStatus: null,
      reason: null,
      lastChecked: nowIso,
    },
    business: {
      id: null,
      name: null,
      status: 'UNKNOWN',
      label: 'Not Configured',
      rawStatus: null,
      verificationStatus: null,
      isDisabled: false,
      reason: null,
      lastChecked: nowIso,
    },
  };

  if (!orgId) {
    return defaultEmptyDiagnosis;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      whatsappPhoneNumberId: true,
      whatsappBusinessId: true,
      whatsappBusinessName: true,
      metaBusinessId: true,
      metaAccessToken: true,
      whatsapp_onboarding_raw_data: true,
      whatsapp_token_info_data: true,
    },
  });

  if (!org) {
    return defaultEmptyDiagnosis;
  }

  const rawData = (org.whatsapp_onboarding_raw_data as Record<string, any> | null) || {};
  const isQrConnection = rawData?.connectionMethod === 'qr' || rawData?.method === 'qr';

  // If QR Baileys connection, Meta Cloud API restriction diagnosis does not apply
  if (isQrConnection) {
    return {
      lastChecked: nowIso,
      overallStatus: 'HEALTHY',
      overallLabel: 'QR Connected',
      affectedResources: [],
      primaryIssue: null,
      headline: 'Connected via WhatsApp QR Web session.',
      isQrConnection: true,
      phone: {
        id: null,
        displayNumber: rawData?.phone_info?.display_phone_number || null,
        status: 'ACTIVE',
        label: 'Active / Healthy (QR)',
        rawStatus: 'CONNECTED',
        qualityRating: 'GREEN',
        verifiedName: null,
        reason: null,
        lastChecked: nowIso,
      },
      waba: {
        id: null,
        name: null,
        status: 'ACTIVE',
        label: 'Not Applicable (QR Session)',
        rawStatus: 'NA',
        accountReviewStatus: null,
        reason: null,
        lastChecked: nowIso,
      },
      business: {
        id: null,
        name: null,
        status: 'ACTIVE',
        label: 'Not Applicable (QR Session)',
        rawStatus: 'NA',
        verificationStatus: null,
        isDisabled: false,
        reason: null,
        lastChecked: nowIso,
      },
    };
  }

  // Check if we have cached diagnosis within the last 5 minutes, unless forceRefresh is requested
  const cachedDiagnosis = rawData?.whatsapp_health_diagnosis as WhatsAppHealthDiagnosis | undefined;
  if (!forceRefresh && cachedDiagnosis?.lastChecked) {
    const ageMs = Date.now() - new Date(cachedDiagnosis.lastChecked).getTime();
    if (ageMs < 5 * 60 * 1000) {
      return cachedDiagnosis;
    }
  }

  const metaToken = org.metaAccessToken;
  const phoneId = org.whatsappPhoneNumberId;
  const wabaId = org.whatsappBusinessId || rawData?.waba_id || rawData?.whatsappBusinessId;
  let bmId = org.metaBusinessId || rawData?.business?.id || rawData?.business_manager?.id;
  let bmName: string | null = rawData?.business?.name || rawData?.business_manager?.name || org.whatsappBusinessName || null;

  // Initialize independent diagnosis models
  const phoneResult: WhatsAppHealthDiagnosis['phone'] = {
    id: phoneId || null,
    displayNumber: rawData?.phone_info?.display_phone_number || null,
    status: 'UNKNOWN',
    label: 'Unable to Verify',
    rawStatus: null,
    qualityRating: rawData?.phone_info?.quality_rating || null,
    verifiedName: rawData?.phone_info?.verified_name || null,
    reason: null,
    lastChecked: nowIso,
  };

  const wabaResult: WhatsAppHealthDiagnosis['waba'] = {
    id: wabaId || null,
    name: org.whatsappBusinessName || null,
    status: 'UNKNOWN',
    label: 'Unable to Verify',
    rawStatus: null,
    accountReviewStatus: null,
    reason: null,
    lastChecked: nowIso,
  };

  const businessResult: WhatsAppHealthDiagnosis['business'] = {
    id: bmId || null,
    name: bmName || null,
    status: 'UNKNOWN',
    label: 'Unable to Verify',
    rawStatus: null,
    verificationStatus: null,
    isDisabled: false,
    reason: null,
    lastChecked: nowIso,
  };

  let tokenExpired = false;

  // =========================================================================
  // 1. INDEPENDENT CHECK: WHATSAPP PHONE NUMBER
  // =========================================================================
  if (phoneId && metaToken) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}?fields=id,display_phone_number,status,quality_rating,name_status,verified_name,code_verification_status`,
        {
          headers: { Authorization: `Bearer ${metaToken}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawStatus = (data.status || 'CONNECTED').toUpperCase();
        phoneResult.rawStatus = rawStatus;
        if (data.display_phone_number) phoneResult.displayNumber = data.display_phone_number;
        if (data.quality_rating) phoneResult.qualityRating = data.quality_rating;
        if (data.verified_name) phoneResult.verifiedName = data.verified_name;

        if (rawStatus === 'BANNED') {
          phoneResult.status = 'BANNED';
          phoneResult.label = 'Banned';
          phoneResult.reason = 'Meta has banned this phone number from the WhatsApp Business Platform.';
        } else if (rawStatus === 'RESTRICTED') {
          phoneResult.status = 'RESTRICTED';
          phoneResult.label = 'Restricted';
          phoneResult.reason = 'Meta has placed outbound messaging restrictions on this phone number.';
        } else if (rawStatus === 'FLAGGED' || rawStatus === 'RATE_LIMITED') {
          phoneResult.status = 'RESTRICTED';
          phoneResult.label = rawStatus === 'FLAGGED' ? 'Flagged (Low Quality)' : 'Rate Limited';
          phoneResult.reason = 'Phone number messaging capability is restricted due to low quality rating or rate limits.';
        } else if (rawStatus === 'DISCONNECTED') {
          phoneResult.status = 'UNKNOWN';
          phoneResult.label = 'Disconnected';
          phoneResult.reason = 'Phone number is marked as Disconnected in Meta Graph API.';
        } else {
          phoneResult.status = 'ACTIVE';
          phoneResult.label = 'Active / Healthy';
          phoneResult.reason = null;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const { reason, code, subcode } = parseMetaErrorReason(errJson?.error);
        const errMsg = String(reason).toLowerCase();
        phoneResult.code = code;
        phoneResult.subcode = subcode;

        if (code === 190) {
          tokenExpired = true;
          phoneResult.status = 'UNKNOWN';
          phoneResult.label = 'Unable to Verify';
          phoneResult.reason = 'Meta access token has expired or was revoked. Re-authentication required.';
        } else if (subcode === 2490350 || errMsg.includes('banned')) {
          phoneResult.status = 'BANNED';
          phoneResult.label = 'Banned';
          phoneResult.reason = reason;
        } else if (errMsg.includes('restricted')) {
          phoneResult.status = 'RESTRICTED';
          phoneResult.label = 'Restricted';
          phoneResult.reason = reason;
        } else if (errMsg.includes('disabled')) {
          phoneResult.status = 'DISABLED';
          phoneResult.label = 'Disabled';
          phoneResult.reason = reason;
        } else {
          phoneResult.status = 'UNKNOWN';
          phoneResult.label = 'Unable to Verify';
          phoneResult.reason = reason;
        }
      }
    } catch (err: any) {
      phoneResult.status = 'UNKNOWN';
      phoneResult.label = 'Unable to Verify';
      phoneResult.reason = err?.message || 'Network timeout connecting to Meta Graph API.';
    }
  } else if (!phoneId) {
    phoneResult.label = 'No Phone Number Connected';
    phoneResult.reason = 'No WhatsApp Phone Number ID found in organization settings.';
  }

  // =========================================================================
  // 2. INDEPENDENT CHECK: WHATSAPP BUSINESS ACCOUNT (WABA)
  // =========================================================================
  if (wabaId && metaToken) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}?fields=id,name,account_review_status,business{id,name,verification_status},ban_info`,
        {
          headers: { Authorization: `Bearer ${metaToken}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const reviewStatus = (data.account_review_status || 'APPROVED').toUpperCase();
        wabaResult.rawStatus = reviewStatus;
        wabaResult.accountReviewStatus = reviewStatus;
        if (data.name) wabaResult.name = data.name;
        if (data.ban_info) wabaResult.banInfo = data.ban_info;

        if (data.business?.id) {
          bmId = data.business.id;
          businessResult.id = bmId;
        }
        if (data.business?.name) {
          bmName = data.business.name;
          businessResult.name = bmName;
        }
        if (data.business?.verification_status) {
          businessResult.verificationStatus = data.business.verification_status;
        }

        if (reviewStatus === 'RESTRICTED') {
          wabaResult.status = 'RESTRICTED';
          wabaResult.label = 'Restricted';
          wabaResult.reason = 'WhatsApp Business Account (WABA) is restricted by Meta.';
        } else if (reviewStatus === 'DISABLED') {
          wabaResult.status = 'DISABLED';
          wabaResult.label = 'Disabled';
          wabaResult.reason = 'WhatsApp Business Account (WABA) is disabled by Meta.';
        } else if (reviewStatus === 'SUSPENDED') {
          wabaResult.status = 'SUSPENDED';
          wabaResult.label = 'Suspended';
          wabaResult.reason = 'WhatsApp Business Account (WABA) is suspended by Meta.';
        } else if (reviewStatus === 'REJECTED') {
          wabaResult.status = 'REJECTED';
          wabaResult.label = 'Review Rejected';
          wabaResult.reason = 'WABA review status is REJECTED by Meta. (Note: This is a WABA review status, not a phone-number ban.)';
        } else if (reviewStatus === 'PENDING') {
          wabaResult.status = 'PENDING';
          wabaResult.label = 'Pending Review';
          wabaResult.reason = 'WhatsApp Business Account is currently pending Meta review.';
        } else {
          wabaResult.status = 'ACTIVE';
          wabaResult.label = 'Active';
          wabaResult.reason = null;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const { reason, code, subcode } = parseMetaErrorReason(errJson?.error);
        const errMsg = String(reason).toLowerCase();
        wabaResult.code = code;
        wabaResult.subcode = subcode;

        if (code === 190) {
          tokenExpired = true;
          wabaResult.status = 'UNKNOWN';
          wabaResult.label = 'Unable to Verify';
          wabaResult.reason = 'Meta access token expired or invalid.';
        } else if (errMsg.includes('disabled') || subcode === 2490350) {
          wabaResult.status = 'DISABLED';
          wabaResult.label = 'Disabled';
          wabaResult.reason = reason;
        } else if (errMsg.includes('restricted') || errMsg.includes('banned')) {
          wabaResult.status = 'RESTRICTED';
          wabaResult.label = 'Restricted';
          wabaResult.reason = reason;
        } else {
          wabaResult.status = 'UNKNOWN';
          wabaResult.label = 'Unable to Verify';
          wabaResult.reason = reason;
        }
      }
    } catch (err: any) {
      wabaResult.status = 'UNKNOWN';
      wabaResult.label = 'Unable to Verify';
      wabaResult.reason = err?.message || 'Network timeout querying WABA status.';
    }
  } else if (!wabaId) {
    wabaResult.label = 'No WABA ID Configured';
    wabaResult.reason = 'No WhatsApp Business Account ID found in organization settings.';
  }

  // =========================================================================
  // 3. INDEPENDENT CHECK: META BUSINESS PORTFOLIO / BUSINESS MANAGER
  // =========================================================================
  if (bmId && metaToken) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${bmId}?fields=id,name,verification_status,is_disabled,sharing_status`,
        {
          headers: { Authorization: `Bearer ${metaToken}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.name) businessResult.name = data.name;
        if (data.verification_status) businessResult.verificationStatus = data.verification_status;
        businessResult.isDisabled = !!data.is_disabled;

        if (data.is_disabled === true) {
          businessResult.status = 'DISABLED';
          businessResult.label = 'Business Portfolio Disabled';
          businessResult.reason = 'The Meta Business Portfolio (Business Manager) is disabled by Meta.';
        } else {
          businessResult.status = 'ACTIVE';
          businessResult.label = 'Business Portfolio Active';
          businessResult.reason = null;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        const { reason, code, subcode } = parseMetaErrorReason(errJson?.error);
        const errMsg = String(reason).toLowerCase();
        businessResult.code = code;
        businessResult.subcode = subcode;

        if (code === 190) {
          tokenExpired = true;
          businessResult.status = 'UNKNOWN';
          businessResult.label = 'Unable to Verify';
          businessResult.reason = 'Meta access token expired or invalid.';
        } else if (errMsg.includes('disabled') || errMsg.includes('deactivated') || subcode === 2490350) {
          businessResult.status = 'DISABLED';
          businessResult.isDisabled = true;
          businessResult.label = 'Business Portfolio Disabled';
          businessResult.reason = reason;
        } else if (errMsg.includes('restricted')) {
          businessResult.status = 'RESTRICTED';
          businessResult.label = 'Business Portfolio Restricted';
          businessResult.reason = reason;
        } else {
          businessResult.status = 'UNKNOWN';
          businessResult.label = 'Unable to Verify';
          businessResult.reason = reason;
        }
      }
    } catch (err: any) {
      businessResult.status = 'UNKNOWN';
      businessResult.label = 'Unable to Verify';
      businessResult.reason = err?.message || 'Network timeout checking Business Portfolio.';
    }
  } else if (!bmId) {
    businessResult.label = 'Not Linked / Unknown';
    businessResult.reason = 'No Meta Business Portfolio ID associated with this WhatsApp account.';
  }

  // =========================================================================
  // 4. OVERALL DIAGNOSIS & REASONING SYNTHESIS
  // =========================================================================
  const affectedResources: RestrictionResource[] = [];

  const isPhoneIssue = phoneResult.status === 'BANNED' || phoneResult.status === 'RESTRICTED' || phoneResult.status === 'DISABLED';
  const isWabaIssue = wabaResult.status === 'RESTRICTED' || wabaResult.status === 'DISABLED' || wabaResult.status === 'SUSPENDED' || wabaResult.status === 'REJECTED';
  const isBusinessIssue = businessResult.status === 'DISABLED' || businessResult.status === 'RESTRICTED';

  if (isPhoneIssue) affectedResources.push('PHONE_NUMBER');
  if (isWabaIssue) affectedResources.push('WABA');
  if (isBusinessIssue) affectedResources.push('BUSINESS_PORTFOLIO');
  if (tokenExpired) affectedResources.push('META_APP');

  let overallStatus: WhatsAppHealthDiagnosis['overallStatus'] = 'HEALTHY';
  let overallLabel = 'All Resources Active & Healthy';
  let primaryIssue: string | null = null;
  let headline = 'WhatsApp Phone Number, WABA, and Business Portfolio are all healthy.';

  if (tokenExpired) {
    overallStatus = 'RESTRICTED';
    overallLabel = 'Meta Token Expired';
    primaryIssue = 'Meta Access Token Expired';
    headline = 'Your Meta authentication token has expired. Please re-authenticate via Facebook Login.';
  } else if (phoneResult.status === 'BANNED') {
    overallStatus = 'BANNED';
    overallLabel = 'Phone Number Banned';
    primaryIssue = 'WhatsApp Phone Number — BANNED';
    headline = 'The connected WhatsApp Phone Number has been banned by Meta.';
  } else if (wabaResult.status === 'DISABLED' || wabaResult.status === 'SUSPENDED') {
    overallStatus = 'DISABLED';
    overallLabel = 'WABA Disabled';
    primaryIssue = `WABA Account — ${wabaResult.status}`;
    headline = `The WhatsApp Business Account (WABA) is ${wabaResult.status.toLowerCase()} by Meta.`;
  } else if (businessResult.status === 'DISABLED') {
    overallStatus = 'DISABLED';
    overallLabel = 'Business Portfolio Disabled';
    primaryIssue = 'Meta Business Portfolio — DISABLED';
    headline = 'The associated Meta Business Portfolio (Business Manager) has been disabled by Meta.';
  } else if (phoneResult.status === 'RESTRICTED') {
    overallStatus = 'RESTRICTED';
    overallLabel = 'Phone Number Restricted';
    primaryIssue = 'WhatsApp Phone Number — RESTRICTED';
    headline = 'The WhatsApp Phone Number is restricted by Meta from sending outbound messages.';
  } else if (wabaResult.status === 'REJECTED') {
    overallStatus = 'RESTRICTED';
    overallLabel = 'WABA Review Rejected';
    primaryIssue = 'WABA Review Rejected (Phone Number is NOT banned)';
    headline = 'The WhatsApp Business Account review was rejected by Meta. Your phone number is not banned.';
  } else if (wabaResult.status === 'RESTRICTED') {
    overallStatus = 'RESTRICTED';
    overallLabel = 'WABA Restricted';
    primaryIssue = 'WABA Account — RESTRICTED';
    headline = 'The WhatsApp Business Account (WABA) has been restricted by Meta.';
  } else if (businessResult.status === 'RESTRICTED') {
    overallStatus = 'RESTRICTED';
    overallLabel = 'Business Portfolio Restricted';
    primaryIssue = 'Meta Business Portfolio — RESTRICTED';
    headline = 'The Meta Business Portfolio is restricted. Phone number and WABA may otherwise be active.';
  } else if (affectedResources.length > 1) {
    overallStatus = 'RESTRICTED';
    overallLabel = 'Multiple Resources Restricted';
    primaryIssue = `Restrictions on: ${affectedResources.join(', ')}`;
    headline = 'Multiple Meta resources have restrictions applied.';
  }

  // Self-heal metaBusinessId in database if retrieved
  if (bmId && org.metaBusinessId !== bmId) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { metaBusinessId: bmId },
    }).catch(() => {});
  }

  const diagnosis: WhatsAppHealthDiagnosis = {
    lastChecked: nowIso,
    overallStatus,
    overallLabel,
    affectedResources,
    primaryIssue,
    headline,
    phone: phoneResult,
    waba: wabaResult,
    business: businessResult,
    app: tokenExpired
      ? {
          status: 'RESTRICTED',
          label: 'Token Expired',
          rawStatus: 'TOKEN_EXPIRED',
          reason: 'Meta access token has expired or was revoked.',
          lastChecked: nowIso,
          isValid: false,
        }
      : undefined,
  };

  // Persist the latest diagnosis in organization's whatsapp_onboarding_raw_data
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      whatsapp_onboarding_raw_data: {
        ...rawData,
        whatsapp_health_diagnosis: diagnosis as any,
        phone_info: {
          ...(rawData?.phone_info || {}),
          status: phoneResult.rawStatus || rawData?.phone_info?.status,
          quality_rating: phoneResult.qualityRating || rawData?.phone_info?.quality_rating,
          verified_name: phoneResult.verifiedName || rawData?.phone_info?.verified_name,
        },
      } as any,
    },
  }).catch((err) => console.error('[checkWhatsAppHealthStatus] Failed to persist health diagnosis:', err));

  return diagnosis;
}
