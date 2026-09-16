'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  startQRLinking,
  getQRLinkingStatus,
  cancelQRLinking,
} from '@/lib/whatsapp/qr/service';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function createWhatsAppQRSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const organizationId = session.user.organizationId;
  try {
    const qrSession = await startQRLinking(organizationId);
    return { success: true, session: qrSession };
  } catch (error: any) {
    logger.webhook.error(`[createWhatsAppQRSession] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to initialize QR session' };
  }
}

export async function getWhatsAppQRSession(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const organizationId = session.user.organizationId;
  try {
    const qrSession = await getQRLinkingStatus(sessionId, organizationId);
    if (!qrSession) {
      return { success: false, error: 'QR session not found or access denied' };
    }

    let phoneNumber: string | null = null;
    let businessName: string | null = null;
    if (qrSession.status === 'connected') {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { whatsappNumber: true, whatsappBusinessName: true },
      });
      phoneNumber = org?.whatsappNumber || null;
      businessName = org?.whatsappBusinessName || null;
    }

    return { success: true, session: qrSession, phoneNumber, businessName };
  } catch (error: any) {
    logger.webhook.error(`[getWhatsAppQRSession] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to fetch QR session' };
  }
}

export async function cancelWhatsAppQRSession(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const organizationId = session.user.organizationId;
  try {
    await cancelQRLinking(sessionId, organizationId);
    return { success: true };
  } catch (error: any) {
    logger.webhook.error(`[cancelWhatsAppQRSession] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to cancel QR session' };
  }
}

export async function regenerateWhatsAppQRSession(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const organizationId = session.user.organizationId;
  try {
    await cancelQRLinking(sessionId, organizationId).catch(() => {});
    const newSession = await startQRLinking(organizationId);
    return { success: true, session: newSession };
  } catch (error: any) {
    logger.webhook.error(`[regenerateWhatsAppQRSession] Error: ${error.message}`);
    return { success: false, error: error.message || 'Failed to regenerate QR code' };
  }
}
