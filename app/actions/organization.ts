'use server';

import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';
import { prisma } from'@/lib/prisma';
import { Prisma } from'@/lib/generated/prisma';
import { revalidatePath } from'next/cache';
import { logActivity } from '@/lib/activityLog';
import { parseDescription, mergeDescription } from '@/lib/profile';

export async function getOrganizationProfile() {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 throw new Error('Unauthorized');
 }

 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: {
 businessAddress: true,
 businessDescription: true,
 businessEmail: true,
 businessVertical: true,
 businessWebsites: true,
 businessLogo: true,
 name: true,
 }
 });

 if (!org) throw new Error('Organization not found');

 // Parse websites if stored as JSON
 const websites = Array.isArray(org.businessWebsites) 
 ? (org.businessWebsites as string[]) 
 : [""];

 return {
 ...org,
 businessDescription: parseDescription(org.businessDescription),
 businessWebsites: websites.length > 0 ? websites : [""]
 };
}

export async function updateOrganizationProfile(data: {
 businessAddress?: string;
 businessDescription?: string;
 businessEmail?: string;
 businessVertical?: string;
 businessWebsites?: string[];
 businessLogo?: string;
}) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 throw new Error('Unauthorized');
 }

 try {
  const existingOrg = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { businessDescription: true }
  });

  const updatedDescription = mergeDescription(existingOrg?.businessDescription, data.businessDescription);

 await prisma.organization.update({
 where: { id: session.user.organizationId },
 data: {
 businessAddress: data.businessAddress,
 businessDescription: updatedDescription,
 businessEmail: data.businessEmail,
 businessVertical: data.businessVertical,
 businessWebsites: data.businessWebsites as Prisma.InputJsonValue | undefined,
 businessLogo: data.businessLogo,
 }
 });

  revalidatePath('/dashboard');

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Updated',
    module: 'System',
    target: 'Organization Profile',
    status: 'success'
  });

  return { success: true };
 } catch (error) {
 console.error('Failed to update organization profile:', error);
 return { success: false, error:'Failed to update profile' };
 }
}

export async function getSocialConnectionStatus() {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 return { facebookConnected: false, instagramConnected: false };
 }

 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: {
 facebookPageId: true,
 instagramBusinessId: true,
 }
 });

 return {
 facebookConnected: !!org?.facebookPageId,
 instagramConnected: !!org?.instagramBusinessId,
 };
}

export async function disconnectInstagramAccount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      instagramBusinessId: null,
    }
  });
  revalidatePath('/dashboard/settings');

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Integrations',
    target: 'Instagram Account',
    status: 'success'
  });

  return { success: true };
}

export async function getConnectedInstagramProfile(): Promise<{
  id: string;
  username: string | null;
  name: string | null;
  profilePic: string | null;
} | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      instagramBusinessId: true,
      facebookPageAccessToken: true,
      instagramAccessToken: true,
    }
  });

  if (!org?.instagramBusinessId) return null;

  const token = org.facebookPageAccessToken || org.instagramAccessToken;
  if (!token) return { id: org.instagramBusinessId, username: null, name: null, profilePic: null };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${org.instagramBusinessId}?fields=id,username,name,profile_picture_url&access_token=${token}`
    );
    const data = await res.json();
    if (data?.error) {
      return { id: org.instagramBusinessId, username: null, name: null, profilePic: null };
    }
    return {
      id: data.id || org.instagramBusinessId,
      username: data.username || null,
      name: data.name || null,
      profilePic: data.profile_picture_url || null,
    };
  } catch {
    return { id: org.instagramBusinessId, username: null, name: null, profilePic: null };
  }
}

export async function disconnectFacebookAccount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      facebookPageId: null,
      facebookPageName: null,
    }
  });
  revalidatePath('/dashboard/settings');

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Integrations',
    target: 'Facebook Account',
    status: 'success'
  });

  return { success: true };
}

export async function getIntegrationStatus() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { shopifyConnected: false, googleSheetsConnected: false, woocommerceConnected: false };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      shopifyStoreUrl: true,
      woocommerceWebhookSecret: true,
    }
  });

  return {
    shopifyConnected: !!org?.shopifyStoreUrl,
    googleSheetsConnected: false, // Still not implemented in schema
    woocommerceConnected: !!org?.woocommerceWebhookSecret,
  };
}

export type IntegrationId = 'google-sheets' | 'shopify' | 'woocommerce';

export async function disconnectIntegration(integrationId: IntegrationId) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;

  try {
    if (integrationId === 'shopify') {
      const currentOrganization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          shopifyStoreUrl: true,
          shopifyAccessToken: true,
          shopifyIntegrationToken: true,
        },
      });

      if (!currentOrganization) {
        return { success: false, error: 'Organization not found' };
      }

      const normalizeShopUrl = (url: string) =>
        url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/g, '');

      const storeUrlMatches = currentOrganization.shopifyStoreUrl
        ? Array.from(
            new Set(
              [
                currentOrganization.shopifyStoreUrl.trim(),
                normalizeShopUrl(currentOrganization.shopifyStoreUrl),
                `https://${normalizeShopUrl(currentOrganization.shopifyStoreUrl)}`,
              ].filter((value): value is string => Boolean(value))
            )
          )
        : [];

      const matchFilters: Prisma.OrganizationWhereInput[] = [
        { id: organizationId },
        ...storeUrlMatches.map((shopifyStoreUrl) => ({ shopifyStoreUrl })),
      ];

      if (currentOrganization.shopifyIntegrationToken) {
        matchFilters.push({ shopifyIntegrationToken: currentOrganization.shopifyIntegrationToken });
      }

      if (currentOrganization.shopifyAccessToken) {
        matchFilters.push({ shopifyAccessToken: currentOrganization.shopifyAccessToken });
      }

      const linkedOrganizations = await prisma.organization.findMany({
        where: { OR: matchFilters },
        select: { id: true },
      });
      const orgIds = linkedOrganizations.map((org) => org.id);

      await prisma.$transaction([
        prisma.shopifyOrder.deleteMany({
          where: { organizationId: { in: orgIds } },
        }),
        prisma.product.deleteMany({
          where: {
            organizationId: { in: orgIds },
            platform: 'shopify',
          },
        }),
        prisma.organization.updateMany({
          where: { id: { in: orgIds } },
          data: {
            shopifyStoreUrl: null,
            shopifyAccessToken: null,
            shopifyIntegrationToken: null,
            shopifyOrderAutomationEnabled: false,
            shopifyOrderTemplate: 'order_confirmation',
            shopifyOrderTemplateLanguage: 'en_US',
          },
        }),
      ]);
    } else if (integrationId === 'woocommerce') {
      await prisma.$transaction([
        prisma.wooCommerceOrder.deleteMany({
          where: { organizationId },
        }),
        prisma.product.deleteMany({
          where: {
            organizationId,
            platform: 'woocommerce',
          },
        }),
        prisma.organization.update({
          where: { id: organizationId },
          data: {
            woocommerceStoreUrl: null,
            woocommerceConsumerKey: null,
            woocommerceConsumerSecret: null,
            woocommerceWebhookSecret: null,
            woocommerceOrderAutomationEnabled: false,
            woocommerceAutomation: Prisma.DbNull,
          },
        }),
      ]);
    } else {
      return { success: false, error: 'Google Sheets connection settings are not available yet.' };
    }

    revalidatePath('/dashboard/integrations');
    revalidatePath('/dashboard/integrations/shopify');
    revalidatePath('/dashboard/integrations/woocommerce');

    await logActivity({
      organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Deleted',
      module: 'Integrations',
      target: integrationId === 'shopify' ? 'Shopify Store' : 'WooCommerce Store',
      details: 'Integration credentials and synced data were cleared.',
      status: 'success',
    });

    return { success: true, status: await getIntegrationStatus() };
  } catch (error) {
    console.error(`Failed to disconnect ${integrationId}:`, error);
    return { success: false, error: 'Failed to disconnect integration' };
  }
}

export async function getOrganizationAiStatus() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      isAiBotEnabled: true,
    }
  });

  return org?.isAiBotEnabled ?? false;
}

export async function toggleOrganizationAiStatus(enabled: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  try {
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        isAiBotEnabled: enabled,
      }
    });

    revalidatePath('/dashboard');

    await logActivity({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Updated',
      module: 'System',
      target: `AI Bot Status: ${enabled ? 'Enabled' : 'Disabled'}`,
      status: 'success'
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to toggle organization AI status:', error);
    return { success: false, error: 'Failed to update AI status' };
  }
}

export async function getOrganizationRoutingMode() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { agentRoutingMode: true }
  });

  return org?.agentRoutingMode ?? "manual";
}

export async function updateOrganizationRoutingMode(mode: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  try {
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { agentRoutingMode: mode }
    });

    revalidatePath('/dashboard');

    await logActivity({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Updated',
      module: 'System',
      target: `Agent Routing Mode set to ${mode}`,
      status: 'success'
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to update organization routing mode:', error);
    return { success: false, error: 'Failed to update routing mode' };
  }
}

export async function getOrganizationVoiceStatus() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      aiVoiceResponseEnabled: true,
    }
  });

  return org?.aiVoiceResponseEnabled ?? false;
}

export async function toggleOrganizationVoiceStatus(enabled: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }
  try {
    if (enabled) {
      const config = await getOrganizationAiConfig();
      const hasKey = Boolean(
        config.apiKeys['gemini'] ||
        config.apiKeys['openai'] ||
        config.apiKeys['elevenlabs'] ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY
      );
      if (!hasKey) {
        return { 
          success: false, 
          needsKey: true,
          error: 'Please add a Google Gemini, OpenAI, or ElevenLabs API key first. This is required for voice transcription and responses.' 
        };
      }
    }

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        aiVoiceResponseEnabled: enabled,
      }
    });

    revalidatePath('/dashboard/knowledge-base');

    await logActivity({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Updated',
      module: 'System',
      target: `AI Voice Response Status: ${enabled ? 'Enabled' : 'Disabled'}`,
      status: 'success'
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to toggle organization AI voice status:', error);
    return { success: false, error: 'Failed to update AI voice status' };
  }
}

export interface AiResponseFormatConfig {
  text: 'text' | 'voice';
  voice: 'text' | 'voice';
  media: 'text' | 'voice';
}

export async function getOrganizationAiConfig() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      aiProvider: true,
      aiProviderApiKey: true,
      aiApiKeys: true,
      aiVoiceResponseEnabled: true,
    }
  });

  let apiKeys: Record<string, any> = {};
  if (org?.aiApiKeys && typeof org.aiApiKeys === 'object') {
    apiKeys = org.aiApiKeys as Record<string, any>;
  } else if (org?.aiProviderApiKey) {
    apiKeys[org.aiProvider || 'openai'] = org.aiProviderApiKey;
  }

  const storedFormat = apiKeys['aiResponseFormat'];
  const responseFormat: AiResponseFormatConfig = storedFormat && typeof storedFormat === 'object'
    ? {
        text: storedFormat.text === 'voice' ? 'voice' : 'text',
        voice: storedFormat.voice === 'text' ? 'text' : 'voice',
        media: storedFormat.media === 'voice' ? 'voice' : 'text',
      }
    : (org?.aiVoiceResponseEnabled
        ? { text: 'text', voice: 'voice', media: 'text' }
        : { text: 'text', voice: 'text', media: 'text' });

  return {
    provider: org?.aiProvider || 'openai',
    apiKeys,
    responseFormat
  };
}

export async function getOrganizationResponseFormatAction(): Promise<AiResponseFormatConfig> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      aiApiKeys: true,
      aiVoiceResponseEnabled: true,
    }
  });

  const keys = (org?.aiApiKeys && typeof org.aiApiKeys === 'object') ? (org.aiApiKeys as Record<string, any>) : {};
  const stored = keys.aiResponseFormat;

  if (stored && typeof stored === 'object') {
    return {
      text: stored.text === 'voice' ? 'voice' : 'text',
      voice: stored.voice === 'text' ? 'text' : 'voice',
      media: stored.media === 'voice' ? 'voice' : 'text',
    };
  }

  if (org?.aiVoiceResponseEnabled) {
    return { text: 'text', voice: 'voice', media: 'text' };
  }

  return { text: 'text', voice: 'text', media: 'text' };
}

export async function updateOrganizationResponseFormatAction(formats: Partial<AiResponseFormatConfig>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { aiApiKeys: true, aiVoiceResponseEnabled: true }
    });

    const currentKeys = (org?.aiApiKeys && typeof org.aiApiKeys === 'object')
      ? { ...(org.aiApiKeys as Record<string, any>) }
      : {};

    const existingFormat = (currentKeys.aiResponseFormat && typeof currentKeys.aiResponseFormat === 'object')
      ? currentKeys.aiResponseFormat
      : (org?.aiVoiceResponseEnabled
          ? { text: 'text', voice: 'voice', media: 'text' }
          : { text: 'text', voice: 'text', media: 'text' });

    const newFormat: AiResponseFormatConfig = {
      text: (formats.text === 'voice' || formats.text === 'text') ? formats.text : (existingFormat.text === 'voice' ? 'voice' : 'text'),
      voice: (formats.voice === 'voice' || formats.voice === 'text') ? formats.voice : (existingFormat.voice === 'voice' ? 'voice' : 'text'),
      media: (formats.media === 'voice' || formats.media === 'text') ? formats.media : (existingFormat.media === 'voice' ? 'voice' : 'text'),
    };

    const hasAnyVoice = newFormat.text === 'voice' || newFormat.voice === 'voice' || newFormat.media === 'voice';

    currentKeys.aiResponseFormat = newFormat;

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        aiApiKeys: currentKeys,
        aiVoiceResponseEnabled: hasAnyVoice,
      }
    });

    revalidatePath('/dashboard/knowledge-base');

    await logActivity({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Updated',
      module: 'AI Settings',
      target: `AI Response Formats: Text->${newFormat.text}, Voice->${newFormat.voice}, Media->${newFormat.media}`,
      status: 'success'
    });

    return { success: true, formats: newFormat };
  } catch (error: any) {
    console.error('Failed to update organization response format:', error);
    return { success: false, error: error.message || 'Failed to update response format' };
  }
}

export async function updateOrganizationAiConfig(
  provider: string, 
  apiKey: string, 
  extraConfig?: { voiceId?: string }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { aiApiKeys: true, aiProviderApiKey: true }
    });

    let currentKeys: Record<string, any> = {};
    if (org?.aiApiKeys && typeof org.aiApiKeys === 'object') {
      currentKeys = { ...(org.aiApiKeys as Record<string, any>) };
    } else if (org?.aiProviderApiKey) {
      currentKeys[provider] = org.aiProviderApiKey;
    }

    if (apiKey) {
      currentKeys[provider] = apiKey;
    }

    if (extraConfig?.voiceId) {
      currentKeys['elevenlabsVoiceId'] = extraConfig.voiceId;
    }

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        aiProvider: provider,
        aiProviderApiKey: apiKey || org?.aiProviderApiKey || undefined,
        aiApiKeys: currentKeys,
      }
    });

    revalidatePath('/dashboard/knowledge-base');

    await logActivity({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Updated',
      module: 'System',
      target: `AI Provider Config: ${provider}`,
      status: 'success'
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update organization AI config:', error);
    return { success: false, error: error.message || 'Failed to update AI configuration' };
  }
}

export async function fetchElevenLabsVoicesAction(apiKeyInput?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  let key = apiKeyInput?.trim();
  if (!key) {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { aiApiKeys: true }
    });
    const keys = (org?.aiApiKeys && typeof org.aiApiKeys === 'object') 
      ? (org.aiApiKeys as Record<string, string>) 
      : {};
    key = keys['elevenlabs'];
  }

  if (!key) {
    return { success: false, error: 'Please enter your ElevenLabs API Key first.' };
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: { 'xi-api-key': key },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.detail?.message || `ElevenLabs error: ${res.statusText} (${res.status})`;
      return { success: false, error: msg };
    }

    const data = await res.json();
    const voices = (data.voices || []).map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category || 'premade',
      previewUrl: v.preview_url || null,
      description: v.labels ? Object.entries(v.labels).map(([k, val]) => `${val}`).filter(Boolean).join(' • ') : ''
    }));

    return { success: true, voices };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch voices from ElevenLabs' };
  }
}
