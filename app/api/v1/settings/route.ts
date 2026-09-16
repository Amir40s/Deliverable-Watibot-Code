import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { type Prisma } from "@/lib/generated/prisma";
import { toEpoch, toIso } from "@/lib/api/mobile-formatters";
import {
  asBodyObject,
  maskSecret,
  optionalBoolean,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

function parseDescription(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed.businessDescription ?? parsed.description ?? raw;
    }
  } catch {
    return raw;
  }
  return raw;
}

function formatSettings(org: any) {
  const rawDescription = asBodyObject(org.businessDescription ? safeParse(org.businessDescription) : null);
  return {
    project_id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    status: org.status,
    company_size: org.companySize,
    industry: org.industry,
    timezone: org.timezone,
    business: {
      email: org.businessEmail,
      address: org.businessAddress,
      description: parseDescription(org.businessDescription),
      vertical: org.businessVertical,
      websites: org.businessWebsites ?? [],
      logo: org.businessLogo,
    },
    whatsapp: {
      number: org.whatsappNumber,
      business_id: org.whatsappBusinessId,
      business_name: org.whatsappBusinessName,
      phone_number_id: org.whatsappPhoneNumberId,
      connected: !!org.whatsappPhoneNumberId,
      meta_access_token: maskSecret(org.metaAccessToken),
      onboarding_raw_data: org.whatsapp_onboarding_raw_data ?? null,
      token_info: org.whatsapp_token_info_data ?? null,
    },
    facebook: {
      page_id: org.facebookPageId,
      page_name: org.facebookPageName,
      ad_account_id: org.facebookAdAccountId,
      connected: !!org.facebookPageId,
      page_access_token: maskSecret(org.facebookPageAccessToken),
      ads_access_token: maskSecret(org.facebookAdsAccessToken),
    },
    instagram: {
      business_id: org.instagramBusinessId,
      connected: !!org.instagramBusinessId,
      access_token: maskSecret(org.instagramAccessToken),
    },
    ai: {
      is_ai_bot_enabled: org.isAiBotEnabled,
      ai_voice_response_enabled: org.aiVoiceResponseEnabled,
      response_format: ((org.aiApiKeys as any)?.aiResponseFormat) || (org.aiVoiceResponseEnabled ? { text: 'text', voice: 'voice', media: 'text' } : { text: 'text', voice: 'text', media: 'text' }),
      provider: org.aiProvider,
      assistant_id: org.aiAssistantId,
    },
    developer_keys_present: {
      project_api_key: !!rawDescription?.projectApiKey,
      campaign_api_key: !!rawDescription?.campaignApiKey,
      webhook_secret: !!rawDescription?.webhookSecret,
    },
    created_at: toEpoch(org.createdAt),
    created_at_iso: toIso(org.createdAt),
    updated_at: toEpoch(org.updatedAt),
    updated_at_iso: toIso(org.updatedAt),
  };
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const record = await prisma.organization.findUnique({
    where: { id: org.id },
  });

  if (!record) return apiError(404, "Project not found.");

  return NextResponse.json({
    status: 200,
    success: true,
    settings: formatSettings(record),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const businessWebsites = body.business_websites ?? body.businessWebsites;
  const descriptionInput = optionalString(body.business_description) ?? optionalString(body.businessDescription);
  let businessDescriptionUpdate: string | null | undefined;

  if (body.business_description !== undefined || body.businessDescription !== undefined) {
    const current = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { businessDescription: true },
    });
    const parsed = current?.businessDescription ? safeParse(current.businessDescription) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      businessDescriptionUpdate = JSON.stringify({
        ...parsed,
        businessDescription: descriptionInput || "",
        description: descriptionInput || "",
      });
    } else {
      businessDescriptionUpdate = descriptionInput || null;
    }
  }

  const data: Prisma.OrganizationUpdateInput = {
    ...(body.name !== undefined ? { name: optionalString(body.name)?.trim() || org.name } : {}),
    ...(body.company_size !== undefined || body.companySize !== undefined
      ? { companySize: optionalString(body.company_size) || optionalString(body.companySize) || null }
      : {}),
    ...(body.industry !== undefined ? { industry: optionalString(body.industry) || null } : {}),
    ...(body.timezone !== undefined ? { timezone: optionalString(body.timezone) || "UTC" } : {}),
    ...(body.whatsapp_number !== undefined || body.whatsappNumber !== undefined
      ? { whatsappNumber: optionalString(body.whatsapp_number) || optionalString(body.whatsappNumber) || null }
      : {}),
    ...(body.business_email !== undefined || body.businessEmail !== undefined
      ? { businessEmail: optionalString(body.business_email) || optionalString(body.businessEmail) || null }
      : {}),
    ...(body.business_address !== undefined || body.businessAddress !== undefined
      ? { businessAddress: optionalString(body.business_address) || optionalString(body.businessAddress) || null }
      : {}),
    ...(businessDescriptionUpdate !== undefined ? { businessDescription: businessDescriptionUpdate } : {}),
    ...(body.business_vertical !== undefined || body.businessVertical !== undefined
      ? { businessVertical: optionalString(body.business_vertical) || optionalString(body.businessVertical) || null }
      : {}),
    ...(businessWebsites !== undefined ? { businessWebsites: businessWebsites as Prisma.InputJsonValue } : {}),
    ...(body.business_logo !== undefined || body.businessLogo !== undefined
      ? { businessLogo: optionalString(body.business_logo) || optionalString(body.businessLogo) || null }
      : {}),
    ...(body.is_ai_bot_enabled !== undefined || body.isAiBotEnabled !== undefined
      ? { isAiBotEnabled: optionalBoolean(body.is_ai_bot_enabled) ?? optionalBoolean(body.isAiBotEnabled) ?? false }
      : {}),
    ...(body.ai_voice_response_enabled !== undefined || body.aiVoiceResponseEnabled !== undefined
      ? {
          aiVoiceResponseEnabled:
            optionalBoolean(body.ai_voice_response_enabled) ?? optionalBoolean(body.aiVoiceResponseEnabled) ?? false,
        }
      : {}),
    ...(body.ai_provider !== undefined || body.aiProvider !== undefined
      ? { aiProvider: optionalString(body.ai_provider) || optionalString(body.aiProvider) || "openai" }
      : {}),
  };

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data,
  });

  return NextResponse.json({
    status: 200,
    success: true,
    settings: formatSettings(updated),
  });
}
