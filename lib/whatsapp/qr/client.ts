import path from 'path';
import fs from 'fs';
import pino from 'pino';
import * as baileysModule from '@whiskeysockets/baileys';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { notifyQRSessionUpdate, notifyWhatsAppConnected, notifyWhatsAppDisconnected } from './events';
import { getActiveQRSession, updateQRSessionStatus } from './session';

// Accommodate default vs named export patterns in bundlers
const makeWASocket = null as any;
const useMultiFileAuthState = null as any;
const DisconnectReason = {} as any;

const DisconnectReason =
  (baileysModule as any).DisconnectReason ||
  (baileysModule as any).default?.DisconnectReason;

// Global singleton registry to prevent orphaned sockets across Next.js dev reloads
const globalSockets: Map<string, any> =
  (globalThis as any).__wati_baileys_sockets || new Map<string, any>();
(globalThis as any).__wati_baileys_sockets = globalSockets;

// Track active QR sessions currently awaiting user scan
const pendingSessionMap: Map<string, string> =
  (globalThis as any).__wati_baileys_pending_sessions || new Map<string, string>();
(globalThis as any).__wati_baileys_pending_sessions = pendingSessionMap;

// Track reconnection attempts to prevent tight loops
const reconnectAttempts: Map<string, { count: number; lastAttempt: number }> =
  (globalThis as any).__wati_baileys_reconnect_attempts || new Map<string, { count: number; lastAttempt: number }>();
(globalThis as any).__wati_baileys_reconnect_attempts = reconnectAttempts;

/**
 * Returns the storage directory path for an organization's WhatsApp session credentials
 */
export function getSessionStoragePath(organizationId: string): string {
  const dir = path.join(process.cwd(), 'storage', 'whatsapp-sessions', organizationId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Cleans up stored authentication credentials on disk for an organization
 */
export function clearSessionStorage(organizationId: string): void {
  try {
    const dir = path.join(process.cwd(), 'storage', 'whatsapp-sessions', organizationId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      logger.webhook.info(`[BaileysClient] Cleaned auth files for org ${organizationId}`);
    }
  } catch (error: any) {
    logger.webhook.warn(`[BaileysClient] Error clearing auth files for org ${organizationId}: ${error.message}`);
  }
}

/**
 * Checks if a WASocket instance is open and authenticated.
 * Baileys uses WebSocketClient where isOpen is a getter and socket is the underlying WebSocket.
 */
export function isWASocketConnected(sock: any): boolean {
  if (!sock) return false;
  const isOpen = Boolean(sock.ws?.isOpen || sock.ws?.socket?.readyState === 1 || sock.ws?.readyState === 1);
  const isAuth = Boolean(sock.user?.id || sock.authState?.creds?.me?.id);
  return isOpen && isAuth;
}

/**
 * Returns the active WASocket instance for an organization, if connected and authenticated
 */
export function getActiveWASocket(organizationId: string): any | null {
  const sock = globalSockets.get(organizationId);
  if (!sock || !isWASocketConnected(sock)) return null;
  return sock;
}

/**
 * Returns an active WASocket instance, or attempts to restore the connection
 * from stored credentials if the socket is closed or not in memory.
 */
export async function getOrRestoreWASocket(organizationId: string): Promise<any | null> {
  let sock = globalSockets.get(organizationId);
  if (isWASocketConnected(sock)) {
    return sock;
  }

  const sessionDir = getSessionStoragePath(organizationId);
  const credsFile = path.join(sessionDir, 'creds.json');
  if (fs.existsSync(credsFile)) {
    try {
      // If a socket exists and is in the middle of connecting, wait for it instead of destroying it
      if (sock) {
        for (let i = 0; i < 30; i++) {
          if (isWASocketConnected(sock)) return sock;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      logger.webhook.info(`[BaileysClient] Restoring inactive/missing socket for org ${organizationId}...`);
      sock = await initWASocket({ organizationId, isRestoring: true });
      for (let i = 0; i < 50; i++) {
        if (isWASocketConnected(sock)) return sock;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return isWASocketConnected(sock) ? sock : null;
    } catch (restoreErr: any) {
      logger.webhook.warn(`[BaileysClient] Failed to restore socket for ${organizationId}: ${restoreErr.message}`);
    }
  }

  return isWASocketConnected(sock) ? sock : null;
}

/**
 * Disconnects and terminates the active WASocket for an organization
 */
export async function terminateWASocket(
  organizationId: string,
  clearPendingSession: boolean = true
): Promise<void> {
  const existing = globalSockets.get(organizationId);
  if (existing) {
    try {
      existing.ev?.removeAllListeners();
      existing.end?.(undefined);
    } catch (e) {
      // Ignore teardown errors
    }
    globalSockets.delete(organizationId);
  }
  if (clearPendingSession) {
    pendingSessionMap.delete(organizationId);
  }
}

/**
 * Initializes or retrieves a persistent WASocket connection for an organization.
 * When sessionId is provided, it links QR events to the pending database session.
 */
export async function initWASocket(params: {
  organizationId: string;
  sessionId?: string;
  isRestoring?: boolean;
}): Promise<any> {
  const { organizationId, sessionId, isRestoring } = params;

  // Preserve or set active session ID
  const activeSessionId = sessionId || pendingSessionMap.get(organizationId);
  if (activeSessionId) {
    pendingSessionMap.set(organizationId, activeSessionId);
  }

  // If already connected and not requesting a fresh QR scan, return existing
  const existingSocket = globalSockets.get(organizationId);
  if (existingSocket && !sessionId && !isRestoring) {
    return existingSocket;
  }

  // If a previous socket exists for this org, close it before restarting
  // Do NOT clear pendingSessionMap so the reconnected socket retains session context
  if (existingSocket) {
    await terminateWASocket(organizationId, false);
  }

  const sessionDir = getSessionStoragePath(organizationId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const socketLogger = pino({ level: 'silent' });

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: socketLogger,
    browser: ['WatiBot Device', 'Chrome', '124.0.0'],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    markOnlineOnConnect: true,
  });

  globalSockets.set(organizationId, sock);

  // Save updated credentials
  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
    } catch (err: any) {
      logger.webhook.warn(`[BaileysClient] Error saving credentials for org ${organizationId}: ${err.message}`);
    }
  });

  // Handle connection events
  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    // Resolve current session ID (in-memory first, fallback to active session from DB)
    let currentSessionId = pendingSessionMap.get(organizationId);
    if (!currentSessionId) {
      try {
        const activeDbSession = await getActiveQRSession(organizationId);
        if (activeDbSession) {
          currentSessionId = activeDbSession.id;
          pendingSessionMap.set(organizationId, currentSessionId);
        }
      } catch (err: any) {
        logger.webhook.warn(`[BaileysClient] Error fetching active DB session: ${err.message}`);
      }
    }

    // 1. QR Code generated by WhatsApp Web
    if (qr && currentSessionId) {
      logger.webhook.info(`[BaileysClient] QR_GENERATED for org ${organizationId}, session ${currentSessionId}`);

      await updateQRSessionStatus(currentSessionId, 'qr_ready', {
        qrData: qr,
      });

      await notifyQRSessionUpdate(organizationId, {
        sessionId: currentSessionId,
        status: 'qr_ready',
        qrData: qr,
      });
    }

    // 2. User scanned the QR code from phone
    if (isNewLogin && currentSessionId) {
      logger.webhook.info(`[BaileysClient] QR_AUTHENTICATED for org ${organizationId}`);

      // Extend expiration so the session does not expire while restarting/connecting
      const extendedExpiresAt = new Date(Date.now() + 90 * 1000);

      await updateQRSessionStatus(currentSessionId, 'authenticated', {
        expiresAt: extendedExpiresAt,
      });

      await notifyQRSessionUpdate(organizationId, {
        sessionId: currentSessionId,
        status: 'authenticated',
      });
    }

    // 3. Socket connection fully established
    if (connection === 'open') {
      logger.webhook.info(`[BaileysClient] WHATSAPP_CONNECTED for org ${organizationId}`);

      // Reset reconnect tracking on successful connection
      reconnectAttempts.delete(organizationId);

      // Extract connected user phone number & business name
      const rawUserJid = sock.user?.id || '';
      const cleanPhone = rawUserJid.split(':')[0].split('@')[0];
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
      const businessName = sock.user?.name || 'WhatsApp Web Device';

      // Update session if one was active
      if (currentSessionId) {
        await updateQRSessionStatus(currentSessionId, 'connected', {
          connectedAt: new Date(),
        });

        await notifyQRSessionUpdate(organizationId, {
          sessionId: currentSessionId,
          status: 'connected',
          phoneNumber: formattedPhone,
          businessName,
        });

        pendingSessionMap.delete(organizationId);
      }

      // Update Organization in database
      try {
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            whatsappConnectionMethod: 'qr',
            whatsappNumber: formattedPhone,
            whatsappBusinessName: businessName,
            whatsappPhoneNumberId: `qr_${organizationId}`,
            whatsappBusinessId: `qr_wa_${organizationId}`,
          },
        });

        // Update WhatsAppChannel record in database
        try {
          const qrChannel = await prisma.whatsAppChannel.findFirst({
            where: {
              organizationId,
              OR: [
                { connectionMethod: 'qr', status: { not: 'CONNECTED' } },
                { phoneNumber: { startsWith: 'pending_' } },
                { phoneNumberId: `qr_${organizationId}` },
                { isDefault: true, connectionMethod: 'qr' },
              ],
            },
            orderBy: { updatedAt: 'desc' },
          });

          if (qrChannel) {
            await prisma.whatsAppChannel.update({
              where: { id: qrChannel.id },
              data: {
                phoneNumber: formattedPhone,
                phoneNumberId: `qr_${organizationId}`,
                connectionMethod: 'qr',
                status: 'CONNECTED',
                name: qrChannel.name.startsWith('WhatsApp Number') || qrChannel.name === 'Qr code' || qrChannel.name === 'QR Channel'
                  ? (businessName || 'QR WhatsApp')
                  : qrChannel.name,
              },
            });
          }
        } catch (channelErr: any) {
          logger.webhook.warn(`[BaileysClient] Failed to update WhatsAppChannel: ${channelErr.message}`);
        }

        await notifyWhatsAppConnected(organizationId, {
          connectionMethod: 'qr',
          phoneNumber: formattedPhone,
          businessName,
        });

        // Asynchronously sync rich WhatsApp profile (avatar, bio, business info)
        setTimeout(async () => {
          try {
            const { syncQRProfile } = await import('./service');
            await syncQRProfile(organizationId);
            logger.webhook.info(`[BaileysClient] Profile synced for org ${organizationId}`);
          } catch (syncErr: any) {
            logger.webhook.warn(`[BaileysClient] Profile sync warning for org ${organizationId}: ${syncErr.message}`);
          }
        }, 1200);
      } catch (dbErr: any) {
        logger.webhook.error(`[BaileysClient] Failed to update organization after connect: ${dbErr.message}`);
      }
    }

    // 4. Socket closed / disconnected
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason?.loggedOut || statusCode === 401;
      const isRestartRequired = statusCode === DisconnectReason?.restartRequired || statusCode === 515;

      logger.webhook.warn(
        `[BaileysClient] Socket closed for org ${organizationId}. Status code: ${statusCode}, isLoggedOut: ${isLoggedOut}, isRestartRequired: ${isRestartRequired}`
      );

      if (isLoggedOut) {
        logger.webhook.info(`[BaileysClient] WHATSAPP_DISCONNECTED: logged out from mobile for org ${organizationId}`);

        reconnectAttempts.delete(organizationId);
        clearSessionStorage(organizationId);
        await terminateWASocket(organizationId, true);

        if (currentSessionId) {
          await updateQRSessionStatus(currentSessionId, 'failed', {
            errorReason: 'Logged out from device',
          });
          await notifyQRSessionUpdate(organizationId, {
            sessionId: currentSessionId,
            status: 'failed',
            errorReason: 'Logged out from device',
          });
        }

        // Clear organization connection fields
        try {
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              whatsappConnectionMethod: 'manual',
              whatsappNumber: null,
              whatsappPhoneNumberId: null,
              whatsappBusinessId: null,
              whatsappBusinessName: null,
            },
          });

          await notifyWhatsAppDisconnected(organizationId, { connectionMethod: 'qr' });
        } catch (dbErr: any) {
          logger.webhook.error(`[BaileysClient] Error updating org on disconnect: ${dbErr.message}`);
        }
        return;
      }

      // Check reconnection attempt throttle to prevent tight loops
      const now = Date.now();
      const attemptInfo = reconnectAttempts.get(organizationId) || { count: 0, lastAttempt: now };
      if (now - attemptInfo.lastAttempt > 30000) {
        attemptInfo.count = 0;
      }
      attemptInfo.count += 1;
      attemptInfo.lastAttempt = now;
      reconnectAttempts.set(organizationId, attemptInfo);

      if (attemptInfo.count > 6) {
        logger.webhook.error(
          `[BaileysClient] Max reconnection attempts (6) exceeded for org ${organizationId}. Stopping reconnect.`
        );
        if (currentSessionId) {
          await updateQRSessionStatus(currentSessionId, 'failed', {
            errorReason: 'Connection handshake failed after multiple attempts. Please try again.',
          });
          await notifyQRSessionUpdate(organizationId, {
            sessionId: currentSessionId,
            status: 'failed',
            errorReason: 'Connection handshake failed. Please try again.',
          });
        }
        return;
      }

      // If restartRequired (status 515), Baileys requires reconnecting with newly written credentials
      if (isRestartRequired) {
        logger.webhook.info(
          `[BaileysClient] Restart required (status 515) for org ${organizationId}. Reconnecting socket with saved credentials in 1s...`
        );
        setTimeout(() => {
          initWASocket({
            organizationId,
            sessionId: currentSessionId,
            isRestoring: true,
          }).catch((err) => {
            logger.webhook.error(`[BaileysClient] Error during 515 reconnect for org ${organizationId}: ${err.message}`);
          });
        }, 1000);
        return;
      }

      // Transient disconnect: check if linking is active or org is configured for QR
      try {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { whatsappConnectionMethod: true },
        });

        const hasCredsFile = fs.existsSync(path.join(sessionDir, 'creds.json'));
        const isAuthenticated = !!state?.creds?.me?.id || !!sock?.user?.id || hasCredsFile;
        const isActivelyLinking = !!currentSessionId;
        const isOrgConfiguredForQR = org?.whatsappConnectionMethod === 'qr';

        // If unauthenticated and timed out (408), QR was not scanned in time. Stop loop and await user refresh.
        if (!isAuthenticated && statusCode === 408) {
          logger.webhook.info(
            `[BaileysClient] Pairing QR timed out (408) for org ${organizationId}. Awaiting user refresh in UI.`
          );
          if (currentSessionId) {
            await updateQRSessionStatus(currentSessionId, 'expired', {
              errorReason: 'QR code timed out. Please click scan to generate a fresh QR code.',
            });
            await notifyQRSessionUpdate(organizationId, {
              sessionId: currentSessionId,
              status: 'expired',
              errorReason: 'QR code timed out. Please click scan to generate a fresh QR code.',
            });
          }
          globalSockets.delete(organizationId);
          return;
        }

        if (isAuthenticated && isOrgConfiguredForQR) {
          const delayMs = 5000;
          logger.webhook.info(
            `[BaileysClient] Reconnecting live socket for org ${organizationId} in ${delayMs / 1000}s...`
          );
          setTimeout(() => {
            initWASocket({
              organizationId,
              isRestoring: true,
            }).catch((err) => {
              logger.webhook.warn(`[BaileysClient] Live reconnection failed for org ${organizationId}: ${err.message}`);
            });
          }, delayMs);
        } else if (isActivelyLinking && !isAuthenticated) {
          const delayMs = 2000;
          setTimeout(() => {
            initWASocket({
              organizationId,
              sessionId: currentSessionId,
              isRestoring: true,
            }).catch((err) => {
              logger.webhook.warn(`[BaileysClient] Pairing reconnection failed for org ${organizationId}: ${err.message}`);
            });
          }, delayMs);
        } else {
          logger.webhook.info(
            `[BaileysClient] Org ${organizationId} has no active QR session and is not authenticated. Not reconnecting.`
          );
        }
      } catch (checkErr: any) {
        logger.webhook.warn(`[BaileysClient] Error checking reconnection eligibility: ${checkErr.message}`);
      }
    }
  });

  // Handle incoming messages from customers
  sock.ev.on('messages.upsert', async (m: any) => {
    try {
      const { handleInboundQRMessage } = await import('./service');
      await handleInboundQRMessage(organizationId, m);
    } catch (msgErr: any) {
      logger.webhook.error(`[BaileysClient] Error processing messages.upsert for org ${organizationId}: ${msgErr.message}`);
    }
  });

  // Handle message delivery & read status updates
  sock.ev.on('messages.update', async (updates: any) => {
    try {
      const { handleMessageStatusQRUpdate } = await import('./service');
      await handleMessageStatusQRUpdate(organizationId, updates);
    } catch (statusErr: any) {
      logger.webhook.error(`[BaileysClient] Error processing messages.update for org ${organizationId}: ${statusErr.message}`);
    }
  });

  sock.ev.on('message-receipt.update', async (receipts: any) => {
    try {
      const { handleMessageReceiptQRUpdate } = await import('./service');
      await handleMessageReceiptQRUpdate(organizationId, receipts);
    } catch (receiptErr: any) {
      logger.webhook.error(`[BaileysClient] Error processing message-receipt.update for org ${organizationId}: ${receiptErr.message}`);
    }
  });

  return sock;
}
