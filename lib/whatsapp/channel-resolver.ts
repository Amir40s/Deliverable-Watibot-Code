import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type ResolvedSenderCredentials = {
  channelId: string | null;
  channelName: string;
  phoneNumber: string;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  accessToken: string | null;
  connectionMethod: string;
  isQr: boolean;
  status: string;
};

export type WhatsAppChannelDTO = {
  id: string;
  organizationId: string;
  name: string;
  phoneNumber: string;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  connectionMethod: string;
  status: string;
  isDefault: boolean;
  qrSessionToken: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Ensures legacy single-number organizations have a synchronized default WhatsAppChannel record.
 */
export async function ensureDefaultChannelForOrg(organizationId: string): Promise<WhatsAppChannelDTO | null> {
  try {
    const existingDefault = await prisma.whatsAppChannel.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (existingDefault) return existingDefault as WhatsAppChannelDTO;

    const anyExisting = await prisma.whatsAppChannel.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    if (anyExisting) {
      const updated = await prisma.whatsAppChannel.update({
        where: { id: anyExisting.id },
        data: { isDefault: true },
      });
      return updated as WhatsAppChannelDTO;
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        whatsappNumber: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessId: true,
        whatsappBusinessName: true,
        metaAccessToken: true,
        whatsappConnectionMethod: true,
      },
    });

    if (!org) return null;

    const hasConnection = !!(
      org.whatsappPhoneNumberId ||
      (org.whatsappNumber && org.whatsappNumber !== '+15550000000') ||
      org.metaAccessToken
    );

    if (!hasConnection) return null;

    const rawNumber = org.whatsappNumber || (org.whatsappPhoneNumberId ? `Phone ${org.whatsappPhoneNumberId}` : 'Primary Number');
    const cleanPhone = rawNumber.replace(/\D/g, '') || org.whatsappPhoneNumberId || 'primary';

    const channel = await prisma.whatsAppChannel.create({
      data: {
        organizationId,
        name: org.whatsappBusinessName || 'Primary WhatsApp',
        phoneNumber: org.whatsappNumber || cleanPhone,
        phoneNumberId: org.whatsappPhoneNumberId || null,
        businessAccountId: org.whatsappBusinessId || null,
        accessToken: org.metaAccessToken || null,
        connectionMethod: org.whatsappConnectionMethod || (org.whatsappPhoneNumberId?.startsWith('qr_') ? 'qr' : 'manual'),
        status: 'CONNECTED',
        isDefault: true,
      },
    });

    return channel as WhatsAppChannelDTO;
  } catch (error) {
    logger.webhook.error(`[ensureDefaultChannelForOrg] Error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Retrieves all connected WhatsApp numbers/channels for an organization.
 */
export async function getOrganizationChannels(organizationId: string): Promise<WhatsAppChannelDTO[]> {
  try {
    let channels = await prisma.whatsAppChannel.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    if (channels.length === 0) {
      const defaultChannel = await ensureDefaultChannelForOrg(organizationId);
      if (defaultChannel) {
        channels = [defaultChannel as any];
      }
    } else {
      // Sync QR channel state with active organization QR state
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          whatsappConnectionMethod: true,
          whatsappNumber: true,
          whatsappPhoneNumberId: true,
          whatsappBusinessName: true,
        },
      });

      if (org?.whatsappConnectionMethod === 'qr' && org.whatsappNumber && org.whatsappNumber !== '+15550000000') {
        for (const ch of channels) {
          if (ch.connectionMethod === 'qr' && (ch.status !== 'CONNECTED' || ch.phoneNumber.startsWith('pending_') || !ch.phoneNumberId)) {
            const updated = await prisma.whatsAppChannel.update({
              where: { id: ch.id },
              data: {
                status: 'CONNECTED',
                phoneNumber: org.whatsappNumber,
                phoneNumberId: org.whatsappPhoneNumberId || `qr_${organizationId}`,
                name: ch.name.startsWith('WhatsApp Number') || ch.name === 'Qr code' || ch.name === 'QR Channel'
                  ? (org.whatsappBusinessName || ch.name)
                  : ch.name,
              },
            });
            Object.assign(ch, updated);
          }
        }
      }
    }

    return channels as WhatsAppChannelDTO[];
  } catch (error) {
    logger.webhook.error(`[getOrganizationChannels] Error: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Resolves active sender credentials (Meta API token/phoneId or QR socket) for an outbound message.
 * If channelId is provided, resolves that specific channel.
 * Otherwise, resolves the default channel or falls back transparently to Organization flat fields.
 */
export async function resolveSenderCredentials(
  organizationId: string,
  channelId?: string | null
): Promise<ResolvedSenderCredentials | null> {
  try {
    if (channelId) {
      const channel = await prisma.whatsAppChannel.findFirst({
        where: { id: channelId, organizationId },
      });

      if (channel) {
        const isQr = channel.connectionMethod === 'qr' || !!channel.phoneNumberId?.startsWith('qr_');
        return {
          channelId: channel.id,
          channelName: channel.name,
          phoneNumber: channel.phoneNumber,
          phoneNumberId: channel.phoneNumberId || null,
          businessAccountId: channel.businessAccountId || null,
          accessToken: channel.accessToken || null,
          connectionMethod: channel.connectionMethod,
          isQr,
          status: channel.status,
        };
      }
    }

    // Check default channel
    const defaultChannel = await prisma.whatsAppChannel.findFirst({
      where: { organizationId, isDefault: true },
    });

    if (defaultChannel) {
      const isQr = defaultChannel.connectionMethod === 'qr' || !!defaultChannel.phoneNumberId?.startsWith('qr_');
      return {
        channelId: defaultChannel.id,
        channelName: defaultChannel.name,
        phoneNumber: defaultChannel.phoneNumber,
        phoneNumberId: defaultChannel.phoneNumberId || null,
        businessAccountId: defaultChannel.businessAccountId || null,
        accessToken: defaultChannel.accessToken || null,
        connectionMethod: defaultChannel.connectionMethod,
        isQr,
        status: defaultChannel.status,
      };
    }

    // Transparent fallback to Organization record
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        whatsappNumber: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessId: true,
        whatsappBusinessName: true,
        metaAccessToken: true,
        whatsappConnectionMethod: true,
      },
    });

    if (!org) return null;

    const isQr = org.whatsappConnectionMethod === 'qr' || !!org.whatsappPhoneNumberId?.startsWith('qr_');
    return {
      channelId: null,
      channelName: org.whatsappBusinessName || 'Primary WhatsApp',
      phoneNumber: org.whatsappNumber || '',
      phoneNumberId: org.whatsappPhoneNumberId || null,
      businessAccountId: org.whatsappBusinessId || null,
      accessToken: org.metaAccessToken || null,
      connectionMethod: org.whatsappConnectionMethod || 'manual',
      isQr,
      status: org.whatsappPhoneNumberId || org.whatsappNumber ? 'CONNECTED' : 'DISCONNECTED',
    };
  } catch (error) {
    logger.webhook.error(`[resolveSenderCredentials] Error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Resolves the parent organization and matched channel for incoming webhooks.
 */
export async function resolveChannelForIncoming(params: {
  phoneNumberId?: string | null;
  wabaId?: string | null;
  phoneNumber?: string | null;
  organizationId?: string | null;
}): Promise<{ organizationId: string; channelId: string | null } | null> {
  const { phoneNumberId, wabaId, phoneNumber, organizationId } = params;

  try {
    if (phoneNumberId) {
      const channel = await prisma.whatsAppChannel.findFirst({
        where: { phoneNumberId },
      });
      if (channel) {
        return { organizationId: channel.organizationId, channelId: channel.id };
      }
    }

    if (phoneNumber) {
      const clean = phoneNumber.replace(/\D/g, '');
      const channel = await prisma.whatsAppChannel.findFirst({
        where: {
          OR: [
            { phoneNumber },
            { phoneNumber: `+${clean}` },
            { phoneNumber: clean },
          ],
        },
      });
      if (channel) {
        return { organizationId: channel.organizationId, channelId: channel.id };
      }
    }

    if (organizationId) {
      const defaultChannel = await prisma.whatsAppChannel.findFirst({
        where: { organizationId, isDefault: true },
      });
      return { organizationId, channelId: defaultChannel?.id || null };
    }

    // Fallback to legacy Organization query
    if (phoneNumberId) {
      const org = await prisma.organization.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
        select: { id: true },
      });
      if (org) {
        return { organizationId: org.id, channelId: null };
      }
    }

    if (wabaId) {
      const org = await prisma.organization.findFirst({
        where: { whatsappBusinessId: wabaId },
        select: { id: true },
      });
      if (org) {
        return { organizationId: org.id, channelId: null };
      }
    }

    return null;
  } catch (error) {
    logger.webhook.error(`[resolveChannelForIncoming] Error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
