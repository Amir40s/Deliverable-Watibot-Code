/**
 * WhatsApp 24-Hour Conversation Window Automation Engine
 */
import prisma from '@/lib/prisma';
import { internalSendWhatsAppMessage, internalSendTemplateMessage } from '@/lib/whatsapp/api';
import { triggerPusherOrgEvent } from '@/lib/pusher';

let isWorkerRunning = false;

export interface WindowReminderProcessResult {
  success: boolean;
  organizationsChecked: number;
  candidatesEvaluated: number;
  remindersSent: number;
  remindersFailed: number;
  remindersSkipped: number;
  errors: Array<{ contactId: string; ruleId: string; error: string }>;
}

/**
 * Core background worker function for evaluating and dispatching WhatsApp 24-hour window expiry reminders.
 */
export async function processWindowReminders(filterOrgId?: string): Promise<WindowReminderProcessResult> {
  if (isWorkerRunning) {
    console.log('[WindowReminderWorker] Worker is already running, skipping overlapping tick.');
    return {
      success: true,
      organizationsChecked: 0,
      candidatesEvaluated: 0,
      remindersSent: 0,
      remindersFailed: 0,
      remindersSkipped: 0,
      errors: []
    };
  }

  isWorkerRunning = true;
  const result: WindowReminderProcessResult = {
    success: true,
    organizationsChecked: 0,
    candidatesEvaluated: 0,
    remindersSent: 0,
    remindersFailed: 0,
    remindersSkipped: 0,
    errors: []
  };

  try {
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Fetch active organizations with reminders enabled and valid WhatsApp credentials
    const orgQuery: any = {
      isWindowRemindersEnabled: true,
      status: 'active',
      whatsappPhoneNumberId: { not: null },
      metaAccessToken: { not: null }
    };
    if (filterOrgId) {
      orgQuery.id = filterOrgId;
    }

    const organizations = await prisma.organization.findMany({
      where: orgQuery,
      select: {
        id: true,
        name: true,
        whatsappPhoneNumberId: true,
        metaAccessToken: true,
        windowReminderRules: {
          where: { isActive: true },
          orderBy: { minutesBeforeExpiry: 'desc' }
        }
      }
    });

    result.organizationsChecked = organizations.length;

    for (const org of organizations) {
      const activeRules = org.windowReminderRules;
      if (!activeRules || activeRules.length === 0) continue;

      // 2. Find contacts in this org that have an active 24h window (inbound message within last 24h)
      // 24 hours ago timestamp
      const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000);

      const candidateContacts = await prisma.contact.findMany({
        where: {
          organizationId: org.id,
          lastInboundMessageAt: {
            gt: twentyFourHoursAgo
          },
          isBlocked: false
        },
        select: {
          id: true,
          name: true,
          waId: true,
          lastInboundMessageAt: true,
          windowExpiresAt: true
        }
      });

      for (const contact of candidateContacts) {
        if (!contact.lastInboundMessageAt) continue;

        const inboundTimeMs = new Date(contact.lastInboundMessageAt).getTime();
        const calculatedExpiresAt = contact.windowExpiresAt
          ? new Date(contact.windowExpiresAt)
          : new Date(inboundTimeMs + 24 * 60 * 60 * 1000);

        const expiresAtMs = calculatedExpiresAt.getTime();
        const remainingMs = expiresAtMs - nowMs;

        // Skip if window has already expired
        if (remainingMs <= 0) continue;

        // Update contact windowExpiresAt if not set or out of sync
        if (!contact.windowExpiresAt || Math.abs(new Date(contact.windowExpiresAt).getTime() - expiresAtMs) > 10000) {
          prisma.contact.update({
            where: { id: contact.id },
            data: {
              windowExpiresAt: calculatedExpiresAt,
              windowStatus: remainingMs <= 60 * 60 * 1000 ? 'EXPIRING_SOON' : 'ACTIVE'
            }
          }).catch(console.error);
        }

        const remainingMinutes = remainingMs / (1000 * 60);

        // 3. Check each rule against this contact's remaining time
        for (const rule of activeRules) {
          result.candidatesEvaluated++;

          // Rule triggers when remaining time is less than or equal to configured rule threshold
          // e.g. rule is 50 mins before expiry -> triggers when remainingMinutes <= 50
          if (remainingMinutes <= rule.minutesBeforeExpiry) {
            // 1. Strict Cooldown Guard: Skip if ANY reminder for this rule was already sent or attempted in the last 12 hours
            const recentLog = await prisma.windowReminderLog.findFirst({
              where: {
                contactId: contact.id,
                ruleId: rule.id,
                sentAt: {
                  gte: new Date(nowMs - 12 * 60 * 60 * 1000)
                }
              }
            });

            if (recentLog) {
              result.remindersSkipped++;
              continue;
            }

            // 2. Window Cycle Guard: Skip if ANY log exists for this window cycle (regardless of status)
            const existingLog = await prisma.windowReminderLog.findFirst({
              where: {
                contactId: contact.id,
                ruleId: rule.id,
                windowExpiresAt: {
                  gte: new Date(expiresAtMs - 15 * 60 * 1000),
                  lte: new Date(expiresAtMs + 15 * 60 * 1000)
                }
              }
            });

            if (existingLog) {
              result.remindersSkipped++;
              continue;
            }

            // 3. Atomic Pre-Claim: Insert log record as SENT BEFORE dispatching to prevent any concurrent duplicate sends
            let logRecord;
            try {
              logRecord = await prisma.windowReminderLog.create({
                data: {
                  organizationId: org.id,
                  contactId: contact.id,
                  ruleId: rule.id,
                  windowExpiresAt: calculatedExpiresAt,
                  status: 'SENT',
                  sentAt: new Date()
                }
              });
            } catch (claimErr) {
              // Unique constraint collision: another process/tick already claimed this reminder, skip immediately
              result.remindersSkipped++;
              continue;
            }

            // 4. Dispatch the reminder message via existing WhatsApp API services
            try {
              let sendRes: any;

              if (rule.messageType === 'TEMPLATE' && rule.templateName) {
                sendRes = await internalSendTemplateMessage(
                  contact.id,
                  rule.templateName,
                  rule.templateLanguage || 'en',
                  (rule.templateComponents as any) || undefined,
                  undefined
                );
              } else if (rule.textContent) {
                sendRes = await internalSendWhatsAppMessage(
                  contact.id,
                  rule.textContent,
                  undefined,
                  undefined, // interactiveData
                  false // skipWindowCheck
                );
              } else {
                throw new Error('Rule is missing textContent or templateName');
              }

              const messageId = sendRes?.id || sendRes?.wamid || sendRes?.messageId || sendRes?.data?.id || null;
              if (messageId) {
                await prisma.windowReminderLog.update({
                  where: { id: logRecord.id },
                  data: { messageId }
                }).catch(() => {});
              }

              result.remindersSent++;
              console.log(`[WindowReminderWorker] Successfully sent "${rule.name}" to ${contact.name || contact.waId} (${rule.minutesBeforeExpiry}m warning)`);

              // Broadcast real-time Pusher event for live chat UI update
              await triggerPusherOrgEvent(org.id, 'window:reminder_sent', {
                contactId: contact.id,
                ruleId: rule.id,
                ruleName: rule.name,
                minutesBeforeExpiry: rule.minutesBeforeExpiry,
                sentAt: new Date().toISOString()
              }).catch(console.error);
            } catch (sendErr: any) {
              const errMsg = sendErr?.message || 'Exception during message send';
              // Update log with error, but DO NOT delete it so it never retries in a tight loop
              await prisma.windowReminderLog.update({
                where: { id: logRecord.id },
                data: {
                  status: 'FAILED',
                  error: errMsg
                }
              }).catch(console.error);

              result.remindersFailed++;
              result.errors.push({ contactId: contact.id, ruleId: rule.id, error: errMsg });
              console.error(`[WindowReminderWorker] Exception sending "${rule.name}" to ${contact.waId}:`, sendErr);
            }
          }
        }
      }
    }
  } catch (globalErr: any) {
    console.error('[WindowReminderWorker] Fatal error in worker run:', globalErr);
    result.success = false;
  } finally {
    isWorkerRunning = false;
  }

  return result;
}
