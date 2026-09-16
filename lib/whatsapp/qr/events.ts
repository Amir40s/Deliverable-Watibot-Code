import { triggerPusherOrgEvent } from '@/lib/pusher';
import { logger } from '@/lib/logger';
import type { QRSessionStatus } from '../types';

export interface QRSessionUpdateEvent {
  sessionId: string;
  sessionToken?: string;
  status: QRSessionStatus;
  qrData?: string | null;
  errorReason?: string | null;
  expiresAt?: string;
  phoneNumber?: string | null;
  businessName?: string | null;
}

/**
 * Broadcasts QR session status updates to the organization's live Pusher channel
 */
export async function notifyQRSessionUpdate(
  organizationId: string,
  payload: QRSessionUpdateEvent
) {
  try {
    logger.webhook.info(`[QREvents] Emitting whatsapp:qr-update to org ${organizationId}: status=${payload.status}`);
    await triggerPusherOrgEvent(organizationId, 'whatsapp:qr-update', payload);
  } catch (error) {
    logger.webhook.warn(`[QREvents] Failed to emit whatsapp:qr-update: ${String(error)}`);
  }
}

/**
 * Broadcasts successful WhatsApp device connection
 */
export async function notifyWhatsAppConnected(
  organizationId: string,
  payload: {
    connectionMethod: 'qr';
    phoneNumber: string;
    businessName: string;
  }
) {
  try {
    logger.webhook.info(`[QREvents] Emitting whatsapp:connected to org ${organizationId}: ${payload.phoneNumber}`);
    await triggerPusherOrgEvent(organizationId, 'whatsapp:connected', payload);
  } catch (error) {
    logger.webhook.warn(`[QREvents] Failed to emit whatsapp:connected: ${String(error)}`);
  }
}

/**
 * Broadcasts WhatsApp disconnection
 */
export async function notifyWhatsAppDisconnected(
  organizationId: string,
  payload: { connectionMethod: 'qr' | 'manual' | 'embedded_signup' }
) {
  try {
    logger.webhook.info(`[QREvents] Emitting whatsapp:disconnected to org ${organizationId}`);
    await triggerPusherOrgEvent(organizationId, 'whatsapp:disconnected', payload);
  } catch (error) {
    logger.webhook.warn(`[QREvents] Failed to emit whatsapp:disconnected: ${String(error)}`);
  }
}
