import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { QRSessionStatus, WhatsAppQRSessionDTO } from '../types';

/**
 * Creates a new QR linking session for the specified organization.
 * Cleans up or expires any older pending/qr_ready sessions for the organization.
 */
export async function createQRSession(organizationId: string): Promise<WhatsAppQRSessionDTO> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 75 * 1000); // 75 seconds expiration

  try {
    // Expire any previous uncompleted sessions for this organization
    await (prisma as any).whatsAppQRSession.updateMany({
      where: {
        organizationId,
        status: { in: ['pending', 'qr_ready', 'scanning'] },
      },
      data: {
        status: 'expired',
        errorReason: 'Superseded by new session request',
      },
    });

    const session = await (prisma as any).whatsAppQRSession.create({
      data: {
        organizationId,
        sessionToken,
        status: 'pending',
        expiresAt,
      },
    });

    logger.webhook.info(`[QRSession] QR_SESSION_CREATED: session ${session.id} for org ${organizationId}`);
    return session;
  } catch (error: any) {
    logger.webhook.error(`[QRSession] Failed to create QR session: ${error.message}`);
    throw error;
  }
}

/**
 * Retrieves a session by its ID and validates organization ownership.
 */
export async function getQRSessionById(
  id: string,
  organizationId: string
): Promise<WhatsAppQRSessionDTO | null> {
  try {
    const session = await (prisma as any).whatsAppQRSession.findFirst({
      where: { id, organizationId },
    });
    return session;
  } catch (error: any) {
    logger.webhook.error(`[QRSession] Error fetching session ${id}: ${error.message}`);
    return null;
  }
}

/**
 * Retrieves a session by its sessionToken and validates organization ownership.
 */
export async function getQRSessionByToken(
  sessionToken: string,
  organizationId: string
): Promise<WhatsAppQRSessionDTO | null> {
  try {
    const session = await (prisma as any).whatsAppQRSession.findFirst({
      where: { sessionToken, organizationId },
    });
    return session;
  } catch (error: any) {
    logger.webhook.error(`[QRSession] Error fetching token: ${error.message}`);
    return null;
  }
}

/**
 * Returns the currently active QR session for an organization, if any.
 */
export async function getActiveQRSession(
  organizationId: string
): Promise<WhatsAppQRSessionDTO | null> {
  try {
    const session = await (prisma as any).whatsAppQRSession.findFirst({
      where: {
        organizationId,
        status: { in: ['pending', 'qr_ready', 'scanning', 'authenticated'] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return session;
  } catch (error: any) {
    logger.webhook.error(`[QRSession] Error getting active session: ${error.message}`);
    return null;
  }
}

/**
 * Updates status and optional metadata (e.g. qrData, errorReason, connectedAt, expiresAt).
 */
export async function updateQRSessionStatus(
  id: string,
  status: QRSessionStatus,
  extra?: {
    qrData?: string | null;
    errorReason?: string | null;
    connectedAt?: Date;
    expiresAt?: Date;
  }
): Promise<WhatsAppQRSessionDTO | null> {
  try {
    const dataToUpdate: any = { status };
    if (extra?.qrData !== undefined) dataToUpdate.qrData = extra.qrData;
    if (extra?.errorReason !== undefined) dataToUpdate.errorReason = extra.errorReason;
    if (extra?.connectedAt !== undefined) dataToUpdate.connectedAt = extra.connectedAt;
    if (extra?.expiresAt !== undefined) dataToUpdate.expiresAt = extra.expiresAt;

    const updated = await (prisma as any).whatsAppQRSession.update({
      where: { id },
      data: dataToUpdate,
    });

    return updated;
  } catch (error: any) {
    logger.webhook.error(`[QRSession] Failed to update session ${id}: ${error.message}`);
    return null;
  }
}

/**
 * Cancels a session if initiated by the user.
 */
export async function cancelQRSession(
  id: string,
  organizationId: string
): Promise<boolean> {
  try {
    await (prisma as any).whatsAppQRSession.updateMany({
      where: { id, organizationId, status: { notIn: ['connected'] } },
      data: {
        status: 'disconnected',
        errorReason: 'Cancelled by user',
      },
    });
    return true;
  } catch (error: any) {
    logger.webhook.error(`[QRSession] Failed to cancel session ${id}: ${error.message}`);
    return false;
  }
}
