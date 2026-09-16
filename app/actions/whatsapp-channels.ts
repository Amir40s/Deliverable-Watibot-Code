'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import {
  getOrganizationChannels,
  ensureDefaultChannelForOrg,
  type WhatsAppChannelDTO,
} from '@/lib/whatsapp/channel-resolver';

import { startQRLinking, cancelQRLinking, disconnectQRSession } from '@/lib/whatsapp/qr/service';

export async function getWhatsAppChannels(): Promise<{
  success: boolean;
  channels?: WhatsAppChannelDTO[];
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  try {
    const channels = await getOrganizationChannels(organizationId);
    return { success: true, channels };
  } catch (error: any) {
    logger.webhook.error(`[getWhatsAppChannels] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to fetch channels' };
  }
}

export async function createWhatsAppChannel(data: {
  name: string;
  phoneNumber?: string;
  connectionMethod?: 'qr' | 'embedded_signup' | 'manual';
}): Promise<{
  success: boolean;
  channel?: WhatsAppChannelDTO;
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  try {
    const existingCount = await prisma.whatsAppChannel.count({
      where: { organizationId },
    });

    const isFirst = existingCount === 0;
    const name = data.name.trim() || `WhatsApp Number ${existingCount + 1}`;
    const rawPhone = data.phoneNumber?.trim() || `pending_${Date.now()}`;

    const channel = await prisma.whatsAppChannel.create({
      data: {
        organizationId,
        name,
        phoneNumber: rawPhone,
        connectionMethod: data.connectionMethod || 'qr',
        status: 'DISCONNECTED',
        isDefault: isFirst,
      },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/live-chat');
    return { success: true, channel: channel as WhatsAppChannelDTO };
  } catch (error: any) {
    logger.webhook.error(`[createWhatsAppChannel] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to create channel' };
  }
}

export async function updateWhatsAppChannel(
  channelId: string,
  data: {
    name?: string;
    isDefault?: boolean;
  }
): Promise<{
  success: boolean;
  channel?: WhatsAppChannelDTO;
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  try {
    if (data.isDefault) {
      await prisma.whatsAppChannel.updateMany({
        where: { organizationId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.whatsAppChannel.update({
      where: { id: channelId, organizationId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(typeof data.isDefault === 'boolean' ? { isDefault: data.isDefault } : {}),
      },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/live-chat');
    return { success: true, channel: updated as WhatsAppChannelDTO };
  } catch (error: any) {
    logger.webhook.error(`[updateWhatsAppChannel] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to update channel' };
  }
}

export async function deleteWhatsAppChannel(channelId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  try {
    const channel = await prisma.whatsAppChannel.findFirst({
      where: { id: channelId, organizationId },
    });

    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    if (channel.connectionMethod === 'qr') {
      try {
        const { terminateWASocket, clearSessionStorage } = await import('@/lib/whatsapp/qr/client');
        await terminateWASocket(organizationId);
      } catch (_) {}
    }

    await prisma.whatsAppChannel.delete({
      where: { id: channelId },
    });

    // If deleted channel was default, assign default to another remaining channel
    if (channel.isDefault) {
      const nextChannel = await prisma.whatsAppChannel.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });
      if (nextChannel) {
        await prisma.whatsAppChannel.update({
          where: { id: nextChannel.id },
          data: { isDefault: true },
        });
      }
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/live-chat');
    return { success: true };
  } catch (error: any) {
    logger.webhook.error(`[deleteWhatsAppChannel] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to delete channel' };
  }
}

export async function connectMetaChannel(
  channelId: string,
  data: {
    phoneNumber: string;
    phoneNumberId: string;
    businessAccountId?: string;
    accessToken: string;
  }
): Promise<{
  success: boolean;
  channel?: WhatsAppChannelDTO;
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const organizationId = session.user.organizationId;
  try {
    const cleanPhone = data.phoneNumber.startsWith('+') ? data.phoneNumber : `+${data.phoneNumber.replace(/\D/g, '')}`;

    const updated = await prisma.whatsAppChannel.update({
      where: { id: channelId, organizationId },
      data: {
        phoneNumber: cleanPhone,
        phoneNumberId: data.phoneNumberId.trim(),
        businessAccountId: data.businessAccountId?.trim() || null,
        accessToken: data.accessToken.trim(),
        connectionMethod: 'manual',
        status: 'CONNECTED',
      },
    });

    if (updated.isDefault) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          whatsappNumber: cleanPhone,
          whatsappPhoneNumberId: data.phoneNumberId.trim(),
          whatsappBusinessId: data.businessAccountId?.trim() || null,
          metaAccessToken: data.accessToken.trim(),
          whatsappConnectionMethod: 'manual',
        },
      });
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/live-chat');
    return { success: true, channel: updated as WhatsAppChannelDTO };
  } catch (error: any) {
    logger.webhook.error(`[connectMetaChannel] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to connect Meta WhatsApp channel' };
  }
}

export async function connectSecondaryMetaChannelViaEmbeddedSignup(data: {
  channelName?: string;
  code?: string;
  accessToken?: string;
  wabaId?: string | null;
  phoneNumberId?: string | null;
}): Promise<{
  success: boolean;
  channel?: WhatsAppChannelDTO;
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) {
    return { success: false, error: 'Unauthorized. Please log in again.' };
  }

  const organizationId = session.user.organizationId;

  try {
    let accessToken = data.accessToken;
    if (!accessToken && data.code) {
      accessToken = await exchangeMetaCodeToToken(data.code, '', false);
    }

    if (!accessToken) {
      return { success: false, error: 'Failed to obtain access token from Meta' };
    }

    // Long-lived exchange if not already done
    let sysConfig = await prisma.systemConfig.findFirst({
      where: {
        AND: [
          { facebookAppId: { not: null } },
          { facebookAppId: { not: '' } },
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

    if (clientId && clientSecret) {
      try {
        const exchanged = await exchangeToLongLivedMetaToken({
          accessToken,
          clientId,
          clientSecret,
        });
        accessToken = exchanged.accessToken;
      } catch (err) {
        console.warn('[connectSecondaryMetaChannelViaEmbeddedSignup] Long-lived exchange warning:', err);
      }
    }

    // Discovery: find WABA and Phone
    let foundWaba: any = null;
    let foundPhone: any = null;

    if (data.wabaId && data.phoneNumberId) {
      try {
        const validateUrl = `https://graph.facebook.com/v21.0/${data.wabaId}?fields=id,name,phone_numbers{id,display_phone_number,platform_type}&access_token=${accessToken}`;
        const res = await fetch(validateUrl);
        const resData = await res.json();
        if (!resData.error) {
          foundWaba = resData;
          foundPhone =
            resData.phone_numbers?.data?.find((p: any) => p.id === data.phoneNumberId) ||
            resData.phone_numbers?.data?.[0];
        }
      } catch (e) {
        console.warn('[connectSecondaryMetaChannelViaEmbeddedSignup] Direct validation fetch failed:', e);
      }
    }

    if (!foundWaba || !foundPhone) {
      try {
        const meRes = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name,assigned_whatsapp_business_accounts{id,name,status}&access_token=${accessToken}`
        );
        const meData = await meRes.json();
        const wabaList = meData?.assigned_whatsapp_business_accounts?.data || [];
        for (const waba of wabaList) {
          const phoneRes = await fetch(
            `https://graph.facebook.com/v21.0/${waba.id}/phone_numbers?fields=id,display_phone_number,platform_type&access_token=${accessToken}`
          );
          const phoneData = await phoneRes.json();
          if (phoneData?.data?.length > 0) {
            foundWaba = waba;
            foundPhone = phoneData.data[0];
            break;
          }
        }
      } catch (e) {
        console.warn('[connectSecondaryMetaChannelViaEmbeddedSignup] Assigned accounts fetch failed:', e);
      }
    }

    if (!foundWaba || !foundPhone) {
      try {
        const meDirect = await fetch(
          `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name,status&access_token=${accessToken}`
        );
        const directData = await meDirect.json();
        const directList = directData?.data || [];
        for (const waba of directList) {
          const phoneRes = await fetch(
            `https://graph.facebook.com/v21.0/${waba.id}/phone_numbers?fields=id,display_phone_number,platform_type&access_token=${accessToken}`
          );
          const phoneData = await phoneRes.json();
          if (phoneData?.data?.length > 0) {
            foundWaba = waba;
            foundPhone = phoneData.data[0];
            break;
          }
        }
      } catch (e) {
        console.warn('[connectSecondaryMetaChannelViaEmbeddedSignup] Direct WABA fetch failed:', e);
      }
    }

    if (!foundWaba || !foundPhone) {
      return {
        success: false,
        error: 'Could not discover WhatsApp Business Account or Phone Number from Meta credentials',
      };
    }

    // Check if linked to ANOTHER organization
    const existingOtherOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { whatsappPhoneNumberId: foundPhone.id },
          { whatsappNumber: foundPhone.display_phone_number },
        ],
        NOT: { id: organizationId },
      },
      select: { name: true },
    });

    if (existingOtherOrg) {
      return {
        success: false,
        error: `WhatsApp number is already linked to another organization (${existingOtherOrg.name})`,
      };
    }

    // Register phone number if needed
    if (foundPhone.platform_type !== 'CLOUD_API') {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${foundPhone.id}/register`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin: '123456' }),
        });
      } catch (regErr) {
        console.warn('[connectSecondaryMetaChannelViaEmbeddedSignup] Phone registration error:', regErr);
      }
    }

    // Configure Webhook for this WABA & Phone
    try {
      await configureMetaWebhookWithRetry({
        organizationId,
        accessToken,
        wabaId: foundWaba.id,
        phoneNumberId: foundPhone.id,
      });
    } catch (webhookErr) {
      console.warn('[connectSecondaryMetaChannelViaEmbeddedSignup] Webhook setup warning:', webhookErr);
    }

    // Check if channel already exists for this phone in current organization
    const existingChannel = await prisma.whatsAppChannel.findFirst({
      where: {
        organizationId,
        OR: [
          { phoneNumberId: foundPhone.id },
          { phoneNumber: foundPhone.display_phone_number },
        ],
      },
    });

    const channelName = data.channelName?.trim() || foundWaba.name || foundPhone.display_phone_number;

    let channelRecord;
    if (existingChannel) {
      channelRecord = await prisma.whatsAppChannel.update({
        where: { id: existingChannel.id },
        data: {
          name: data.channelName?.trim() ? data.channelName.trim() : existingChannel.name,
          phoneNumber: foundPhone.display_phone_number,
          phoneNumberId: foundPhone.id,
          businessAccountId: foundWaba.id,
          accessToken,
          connectionMethod: 'embedded_signup',
          status: 'CONNECTED',
        },
      });
    } else {
      const existingChannelsCount = await prisma.whatsAppChannel.count({
        where: { organizationId },
      });

      channelRecord = await prisma.whatsAppChannel.create({
        data: {
          organizationId,
          name: channelName,
          phoneNumber: foundPhone.display_phone_number,
          phoneNumberId: foundPhone.id,
          businessAccountId: foundWaba.id,
          accessToken,
          connectionMethod: 'embedded_signup',
          status: 'CONNECTED',
          isDefault: existingChannelsCount === 0,
        },
      });
    }

    // If default or first, also update organization record
    if (channelRecord.isDefault) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          whatsappBusinessId: foundWaba.id,
          whatsappBusinessName: channelName,
          whatsappPhoneNumberId: foundPhone.id,
          whatsappNumber: foundPhone.display_phone_number,
          metaAccessToken: accessToken,
          whatsappConnectionMethod: 'embedded_signup',
        },
      });
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/live-chat');

    return {
      success: true,
      channel: channelRecord as WhatsAppChannelDTO,
    };
  } catch (error: any) {
    logger.webhook.error(`[connectSecondaryMetaChannelViaEmbeddedSignup] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to connect Meta WhatsApp channel' };
  }
}

