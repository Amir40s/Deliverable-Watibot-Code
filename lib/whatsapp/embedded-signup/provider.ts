import { prisma } from '@/lib/prisma';
import { internalSendWhatsAppMessage } from '../api';
import type { WhatsAppConnectionMethod } from '../types';

export class EmbeddedSignupProvider {
  static getMethod(): WhatsAppConnectionMethod {
    return 'embedded_signup';
  }
  static async isConfigured(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappPhoneNumberId: true,
        metaAccessToken: true,
        embedded_setup_done_at: true,
        whatsappConnectionMethod: true,
      },
    });

    return !!(
      org?.metaAccessToken &&
      org?.whatsappPhoneNumberId &&
      org.whatsappPhoneNumberId !== 'default_active_wa_id' &&
      (org.embedded_setup_done_at || org.whatsappConnectionMethod === 'embedded_signup')
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
