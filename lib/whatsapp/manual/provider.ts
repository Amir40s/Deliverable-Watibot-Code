import { prisma } from '@/lib/prisma';
import { internalSendWhatsAppMessage } from '../api';
import type { WhatsAppConnectionMethod } from '../types';

export class ManualConnectionProvider {
  static getMethod(): WhatsAppConnectionMethod {
    return 'manual';
  }
  static async isConfigured(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        metaAccessToken: true,
        whatsappConnectionMethod: true,
      },
    });

    return !!(
      org?.metaAccessToken &&
      org?.whatsappPhoneNumberId &&
      org.whatsappPhoneNumberId !== 'default_active_wa_id' &&
      (!org.whatsappConnectionMethod || org.whatsappConnectionMethod === 'manual')
    );
  }

  static async sendMessage(options: {
    contactId: string;
    message: string;
    existingContact?: any;
    interactiveData?: any;
    skipWindowCheck?: boolean;
    senderId?: string;
    replyToMessageId?: string;
    replyToWaId?: string;
  }) {
    return internalSendWhatsAppMessage(
      options.contactId,
      options.message,
      options.existingContact,
      options.interactiveData,
      options.skipWindowCheck,
      options.senderId,
      options.replyToMessageId,
      options.replyToWaId
    );
  }
}
