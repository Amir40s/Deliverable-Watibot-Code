import { prisma } from '@/lib/prisma';
import type { WhatsAppConnectionMethod, SendQRMessageOptions } from './types';
import { ManualConnectionProvider } from './manual/provider';
import { EmbeddedSignupProvider } from './embedded-signup/provider';
import {
  startQRLinking,
  getQRLinkingStatus,
  cancelQRLinking,
  disconnectQRSession,
  sendQRWhatsAppMessage,
} from './qr/service';

export class QRDeviceConnectionProvider {
  static getMethod(): WhatsAppConnectionMethod {
    return 'qr';
  }

  static async startLinking(organizationId: string) {
    return startQRLinking(organizationId);
  }

  static async getStatus(sessionId: string, organizationId: string) {
    return getQRLinkingStatus(sessionId, organizationId);
  }

  static async cancelLinking(sessionId: string, organizationId: string) {
    return cancelQRLinking(sessionId, organizationId);
  }

  static async disconnect(organizationId: string) {
    return disconnectQRSession(organizationId);
  }

  static async sendMessage(options: SendQRMessageOptions) {
    return sendQRWhatsAppMessage(options);
  }
}

export class WhatsAppConnectionService {
  /**
   * Retrieves the corresponding provider class for a connection method
   */
  static getProvider(method: WhatsAppConnectionMethod) {
    switch (method) {
      case 'qr':
        return QRDeviceConnectionProvider;
      case 'embedded_signup':
        return EmbeddedSignupProvider;
      case 'manual':
      default:
        return ManualConnectionProvider;
    }
  }
  /**
   * Identifies which connection method is active for an organization:
   * 'qr' | 'embedded_signup' | 'manual' | null
   */
  static async getConnectionMethod(organizationId: string): Promise<WhatsAppConnectionMethod | null> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappConnectionMethod: true,
        metaAccessToken: true,
        whatsappPhoneNumberId: true,
        whatsappNumber: true,
        embedded_setup_done_at: true,
      },
    });

    if (!org) return null;

    if (org.whatsappConnectionMethod === 'qr' && org.whatsappNumber) {
      return 'qr';
    }

    if (org.metaAccessToken && org.whatsappPhoneNumberId && org.whatsappPhoneNumberId !== 'default_active_wa_id') {
      if (org.whatsappConnectionMethod === 'embedded_signup' || org.embedded_setup_done_at) {
        return 'embedded_signup';
      }
      return 'manual';
    }

    return null;
  }

  /**
   * Unified message sender that automatically routes to the appropriate provider
   */
  static async sendMessage(options: {
    organizationId: string;
    contactId: string;
    recipientPhone: string;
    messageText: string;
    senderId?: string;
    existingContact?: any;
    interactiveData?: any;
    skipWindowCheck?: boolean;
    mediaUrl?: string;
    contentType?: string;
    replyToMessageId?: string;
    replyToWaId?: string;
  }) {
    const method = await this.getConnectionMethod(options.organizationId);

    if (method === 'qr') {
      return QRDeviceConnectionProvider.sendMessage({
        organizationId: options.organizationId,
        contactId: options.contactId,
        recipientPhone: options.recipientPhone,
        messageText: options.messageText,
        senderId: options.senderId,
        mediaUrl: options.mediaUrl,
        contentType: options.contentType,
        replyToMessageId: options.replyToMessageId,
        replyToWaId: options.replyToWaId,
      });
    }

    if (method === 'embedded_signup') {
      return EmbeddedSignupProvider.sendMessage({
        contactId: options.contactId,
        message: options.messageText,
        existingContact: options.existingContact,
        interactiveData: options.interactiveData,
        skipWindowCheck: options.skipWindowCheck,
        senderId: options.senderId,
        replyToMessageId: options.replyToMessageId,
        replyToWaId: options.replyToWaId,
      });
    }

    // Default to Manual Meta API
    return ManualConnectionProvider.sendMessage({
      contactId: options.contactId,
      message: options.messageText,
      existingContact: options.existingContact,
      interactiveData: options.interactiveData,
      skipWindowCheck: options.skipWindowCheck,
      senderId: options.senderId,
      replyToMessageId: options.replyToMessageId,
      replyToWaId: options.replyToWaId,
    });
  }

  /**
   * Unified disconnect handler
   */
  static async disconnect(organizationId: string) {
    const method = await this.getConnectionMethod(organizationId);
    if (method === 'qr') {
      await QRDeviceConnectionProvider.disconnect(organizationId);
    }
  }
}
