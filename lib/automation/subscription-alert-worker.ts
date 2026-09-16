/**
 * Subscription Ending Alert Automation Worker
 * 
 * Handles daily scheduled checks for subscriptions expiring in 5 days or 1 day,
 * enforces duplicate prevention, and dispatches WhatsApp alert templates
 * sequentially with a strict 1-minute gap between each recipient.
 */

import { prisma } from '@/lib/prisma';
import { sendSystemWhatsAppTemplateDetailed } from '@/lib/whatsapp/system';
import { normalizePhoneNumber } from '@/lib/phone';

// Concurrency lock for in-process queue processing
let isQueueWorkerRunning = false;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse time strings like "12:00 PM", "01:30 AM", "14:00", "09:00" into 24h hour and minute.
 */
export function parseCheckTime(timeStr: string | null | undefined): { hour: number; minute: number } {
  if (!timeStr) return { hour: 12, minute: 0 };

  const trimmed = timeStr.trim().toUpperCase();
  const is12Hour = trimmed.includes('AM') || trimmed.includes('PM');

  if (is12Hour) {
    const isPM = trimmed.includes('PM');
    const cleanTime = trimmed.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');
    let h = parseInt(parts[0] || '12', 10);
    const m = parseInt(parts[1] || '0', 10);

    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;

    return { hour: isNaN(h) ? 12 : h, minute: isNaN(m) ? 0 : m };
  }

  const parts = trimmed.split(':');
  const h = parseInt(parts[0] || '12', 10);
  const m = parseInt(parts[1] || '0', 10);

  return { hour: isNaN(h) ? 12 : h, minute: isNaN(m) ? 0 : m };
}

/**
 * Format hour and minute into standard "12:00 PM" display
 */
export function formatTo12Hour(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = String(minute).padStart(2, '0');
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

/**
 * Get current date, hour, and minute in the specified target timezone (e.g. "Asia/Karachi")
 */
export function getZonedTimeDetails(timeZone: string = 'Asia/Karachi', referenceDate: Date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(referenceDate);
    let year = '1970';
    let month = '01';
    let day = '01';
    let hour = '00';
    let minute = '00';
    let second = '00';

    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
      if (part.type === 'second') second = part.value;
    }

    const dateStr = `${year}-${month}-${day}`;
    return {
      dateStr,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10),
      hour: parseInt(hour, 10),
      minute: parseInt(minute, 10),
      second: parseInt(second, 10),
    };
  } catch (err) {
    // Fallback if timezone string is unrecognized
    const utcDate = referenceDate.toISOString().slice(0, 10);
    return {
      dateStr: utcDate,
      year: referenceDate.getUTCFullYear(),
      month: referenceDate.getUTCMonth() + 1,
      day: referenceDate.getUTCDate(),
      hour: referenceDate.getUTCHours(),
      minute: referenceDate.getUTCMinutes(),
      second: referenceDate.getUTCSeconds(),
    };
  }
}

/**
 * Calculate difference in calendar days between two dates within the specified timezone.
 * Returns: (calendarEndDate - calendarCurrentDate)
 */
export function calculateCalendarDaysRemaining(endDate: Date, timeZone: string, referenceDate: Date = new Date()): number {
  const targetZoned = getZonedTimeDetails(timeZone, endDate);
  const currentZoned = getZonedTimeDetails(timeZone, referenceDate);

  const targetUtc = Date.UTC(targetZoned.year, targetZoned.month - 1, targetZoned.day);
  const currentUtc = Date.UTC(currentZoned.year, currentZoned.month - 1, currentZoned.day);

  const diffMs = targetUtc - currentUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export interface CandidateSubscriptionAlert {
  organizationId: string;
  organizationName: string;
  subscriptionId: string;
  userId: string | null;
  recipientPhone: string;
  planName: string;
  endDate: Date;
  daysRemaining: number;
  alertType: '5_DAYS' | '1_DAY';
  templateName: string;
}

/**
 * Determine if an organization has a connected/live WhatsApp number.
 */
export function isVendorWhatsAppConnected(org: {
  whatsappNumber?: string | null;
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessId?: string | null;
  whatsappConnectionMethod?: string | null;
  whatsapp_onboarding_raw_data?: any;
  whatsappQRSessions?: { id: string; status: string }[];
}): { isConnected: boolean; whatsappNumber: string | null } {
  let cleanWaNumber = org.whatsappNumber || null;
  let cleanPhoneId = org.whatsappPhoneNumberId || null;

  if (cleanWaNumber === '+15550000000') cleanWaNumber = null;
  if (cleanPhoneId === 'default_active_wa_id') cleanPhoneId = null;

  const rawData = org.whatsapp_onboarding_raw_data as any;
  if (!cleanPhoneId && rawData) {
    const recoveredId =
      rawData?.phone?.id ||
      rawData?.phone_number_id ||
      rawData?.phone_info?.id ||
      rawData?.waba?.phone_numbers?.data?.[0]?.id;
    if (recoveredId && recoveredId !== 'default_active_wa_id') {
      cleanPhoneId = recoveredId;
    }
  }

  if (!cleanWaNumber && rawData) {
    const recoveredNum =
      rawData?.phone?.display_phone_number ||
      rawData?.waba?.phone_numbers?.data?.[0]?.display_phone_number;
    if (recoveredNum && recoveredNum !== '+15550000000') {
      cleanWaNumber = recoveredNum;
    }
  }

  // QR Session check
  const isQr = org.whatsappConnectionMethod === 'qr' || cleanPhoneId?.startsWith('qr_');
  const hasActiveQr =
    Array.isArray(org.whatsappQRSessions) &&
    org.whatsappQRSessions.some((s) => s.status?.toLowerCase() === 'connected');

  // Cloud API / Embedded signup check
  const hasCloudApi = !!(cleanPhoneId || org.whatsappBusinessId);

  const isConnected = isQr ? (hasActiveQr || !!cleanWaNumber) : (hasCloudApi || !!cleanWaNumber);

  return {
    isConnected: !!isConnected,
    whatsappNumber: cleanWaNumber,
  };
}

 
export async function findEligibleSubscriptionAlerts(): Promise<CandidateSubscriptionAlert[]> {
  let systemConfig: any;
  try {
    systemConfig = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        subAlert5DaysEnabled: true,
        subAlert5DaysTemplate: true,
        subAlert1DayEnabled: true,
        subAlert1DayTemplate: true,
        subAlertTimezone: true,
        trialLimitDays: true,
        whatsappPhoneNumberId: true,
        metaAccessToken: true,
      }
    });
  } catch (err: any) {
    if (err?.message && err.message.includes('subAlert')) {
      const baseConfig = await prisma.systemConfig.findFirst({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          trialLimitDays: true,
          whatsappPhoneNumberId: true,
          metaAccessToken: true,
        }
      });
      if (baseConfig) {
        const rawFields: any = await prisma.$queryRawUnsafe(
          `SELECT "subAlertCheckTime", "subAlertTimezone", "subAlert5DaysEnabled", "subAlert5DaysTemplate", "subAlert1DayEnabled", "subAlert1DayTemplate" FROM "SystemConfig" WHERE id = $1 LIMIT 1`,
          baseConfig.id
        );
        systemConfig = {
          ...baseConfig,
          ...(rawFields?.[0] || {})
        };
      }
    } else {
      throw err;
    }
  }

  if (!systemConfig) return [];
  if (!systemConfig.whatsappPhoneNumberId || !systemConfig.metaAccessToken) {
    console.warn('[SubscriptionAlertWorker] Admin WhatsApp Gateway is not configured. Skipping alert checks.');
    return [];
  }

  const { subAlert5DaysEnabled, subAlert5DaysTemplate, subAlert1DayEnabled, subAlert1DayTemplate } = systemConfig;
  if (!subAlert5DaysEnabled && !subAlert1DayEnabled) {
    return [];
  }

  const timeZone = systemConfig.subAlertTimezone || 'Asia/Karachi';
  const now = new Date();

  // Fetch active organizations (excluding expired, suspended, deleted)
  const organizations = await prisma.organization.findMany({
    where: {
      status: 'active'
    },
    select: {
      id: true,
      name: true,
      plan: true,
      status: true,
      whatsappNumber: true,
      whatsappPhoneNumberId: true,
      whatsappBusinessId: true,
      whatsappConnectionMethod: true,
      whatsapp_onboarding_raw_data: true,
      ownerId: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          status: true,
          trialStartDate: true,
          trialLimitDays: true,
          createdAt: true,
        }
      },
      users: {
        where: { phoneNumber: { not: null } },
        select: { id: true, phoneNumber: true },
        take: 1
      },
      whatsappQRSessions: {
        where: {
          OR: [
            { status: 'connected' },
            { status: 'CONNECTED' },
            { status: 'live' },
            { status: 'LIVE' },
          ]
        },
        select: { id: true, status: true },
        take: 1
      }
    }
  });

  const candidates: CandidateSubscriptionAlert[] = [];

  for (const org of organizations) {
    // ─── Filter: Only vendors with connected WhatsApp number ───────────────
    const waStatus = isVendorWhatsAppConnected(org);
    if (!waStatus.isConnected) {
      continue;
    }

    // Determine subscription endDate and subscriptionId
    let endDate: Date | null = null;
    let subscriptionId = org.id;

    const isTrial = org.owner?.status === 'TRIAL';

    if (isTrial) {
      const limit = org.owner?.trialLimitDays ?? systemConfig.trialLimitDays ?? 15;
      const startDate = org.owner?.trialStartDate || org.owner?.createdAt || org.createdAt;
      endDate = new Date(new Date(startDate).getTime() + limit * 24 * 60 * 60 * 1000);
    } else {
      const subscription = await prisma.subscription.findFirst({
        where: { vendor: org.id },
        orderBy: { createdAt: 'desc' }
      });

      if (subscription) {
        subscriptionId = subscription.id;
        if (subscription.endDate) {
          endDate = new Date(subscription.endDate);
        }
        // Exclude cancelled subscriptions
        if (subscription.status && subscription.status.includes('cancelled')) {
          continue;
        }
      } else {
        // Fallback: 30 days from creation
        endDate = new Date(new Date(org.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    if (!endDate) continue;

    // Check if subscription has already expired in real time
    if (endDate.getTime() <= now.getTime()) {
      continue;
    }

    // Determine recipient phone number: vendor owner's registered personal phone number (fallback to first user's registered phone)
    const rawPhone = org.owner?.phoneNumber || org.users[0]?.phoneNumber;
    const cleanPhone = normalizePhoneNumber(rawPhone);

    if (!cleanPhone || cleanPhone.length < 7) {
      // No valid registered personal phone number found for this vendor owner
      continue;
    }

    // Calculate calendar days remaining using the configured timezone
    const daysRemaining = calculateCalendarDaysRemaining(endDate, timeZone, now);

    let alertType: '5_DAYS' | '1_DAY' | null = null;
    let templateName: string | null = null;

    if (daysRemaining === 5 && subAlert5DaysEnabled && subAlert5DaysTemplate) {
      alertType = '5_DAYS';
      templateName = subAlert5DaysTemplate;
    } else if (daysRemaining === 1 && subAlert1DayEnabled && subAlert1DayTemplate) {
      alertType = '1_DAY';
      templateName = subAlert1DayTemplate;
    }

    if (!alertType || !templateName) {
      continue;
    }

    candidates.push({
      organizationId: org.id,
      organizationName: org.name,
      subscriptionId,
      userId: org.ownerId || null,
      recipientPhone: cleanPhone,
      planName: org.plan || 'Standard',
      endDate,
      daysRemaining,
      alertType,
      templateName
    });
  }

  return candidates;
}

/**
 * Scan, filter for duplicates, and enqueue alert notification jobs.
 */
export async function evaluateAndQueueSubscriptionAlerts(manualTrigger: boolean = false): Promise<{
  queuedCount: number;
  skippedCount: number;
  jobs: any[];
}> {
  console.log(`[SubscriptionAlertWorker] Starting alert evaluation (manual: ${manualTrigger})...`);
  const candidates = await findEligibleSubscriptionAlerts();
  console.log(`[SubscriptionAlertWorker] Found ${candidates.length} candidate alerts.`);

  let queuedCount = 0;
  let skippedCount = 0;
  const createdJobs: any[] = [];
  const now = new Date();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    // ─── Duplicate Prevention Check ──────────────────────────────────────────
    // 1. Check if already successfully sent for this subscription & alertType & cycle
    const alreadySent = await prisma.subscriptionAlertLog.findFirst({
      where: {
        subscriptionId: candidate.subscriptionId,
        alertType: candidate.alertType,
        status: 'SENT',
        ...(candidate.endDate ? { subscriptionEndDate: candidate.endDate } : {})
      }
    });

    if (alreadySent) {
      console.log(`[SubscriptionAlertWorker] Skipped: ${candidate.alertType} alert already sent for subscription ${candidate.subscriptionId}`);
      skippedCount++;
      continue;
    }

    // 2. Check if a job is already queued/pending or currently processing
    const alreadyQueued = await prisma.subscriptionAlertLog.findFirst({
      where: {
        subscriptionId: candidate.subscriptionId,
        alertType: candidate.alertType,
        status: { in: ['PENDING', 'PROCESSING'] },
        ...(candidate.endDate ? { subscriptionEndDate: candidate.endDate } : {})
      }
    });

    if (alreadyQueued) {
      console.log(`[SubscriptionAlertWorker] Skipped: ${candidate.alertType} alert is already in queue/processing for subscription ${candidate.subscriptionId}`);
      skippedCount++;
      continue;
    }

    // Calculate sequential schedule time with 1-minute gap: index 0 at now, index 1 at now + 1m, etc.
    const scheduledFor = new Date(now.getTime() + queuedCount * 60_000);

    const job = await prisma.subscriptionAlertLog.create({
      data: {
        subscriptionId: candidate.subscriptionId,
        organizationId: candidate.organizationId,
        userId: candidate.userId,
        recipientPhone: candidate.recipientPhone,
        alertType: candidate.alertType,
        templateName: candidate.templateName,
        subscriptionEndDate: candidate.endDate,
        status: 'PENDING',
        scheduledFor,
      }
    });

    createdJobs.push(job);
    queuedCount++;
    console.log(`[SubscriptionAlertWorker] Queued ${candidate.alertType} alert for ${candidate.organizationName} (${candidate.recipientPhone}) scheduled for ${scheduledFor.toISOString()}`);
  }

  return {
    queuedCount,
    skippedCount,
    jobs: createdJobs
  };
}

/**
 * Sequential Queue Processor
 * Dispatches pending alert jobs with a strict 1-minute delay between messages.
 */
export async function processSubscriptionAlertQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  if (isQueueWorkerRunning) {
    console.log('[SubscriptionAlertWorker] Queue worker is already active, skipping overlapping execution.');
    return { processed: 0, sent: 0, failed: 0 };
  }

  isQueueWorkerRunning = true;
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    const now = new Date();

    // 1. Recover stale PROCESSING jobs (stuck for more than 5 minutes due to server restart/crash)
    const staleCutoff = new Date(now.getTime() - 5 * 60 * 1000);
    await prisma.subscriptionAlertLog.updateMany({
      where: {
        status: 'PROCESSING',
        lockedAt: { lte: staleCutoff }
      },
      data: {
        status: 'PENDING',
        lockedAt: null,
      }
    });

    // 2. Fetch pending jobs ready to be sent (scheduledFor <= now or already queued for today)
    const pendingJobs = await prisma.subscriptionAlertLog.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: new Date(now.getTime() + 10_000) } // 10s leeway
      },
      orderBy: [
        { scheduledFor: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    if (pendingJobs.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    console.log(`[SubscriptionAlertWorker] Processing ${pendingJobs.length} queued alert jobs sequentially...`);

    const systemConfig = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { platformName: true, subAlertTimezone: true }
    });
    const platformName = systemConfig?.platformName || 'Wati Bot';
    const timeZone = systemConfig?.subAlertTimezone || 'Asia/Karachi';

    for (let i = 0; i < pendingJobs.length; i++) {
      const job = pendingJobs[i];

      // Atomic lock via update
      const claimResult = await prisma.subscriptionAlertLog.updateMany({
        where: {
          id: job.id,
          status: 'PENDING'
        },
        data: {
          status: 'PROCESSING',
          lockedAt: new Date()
        }
      });

      if (claimResult.count === 0) {
        // Already claimed by another thread
        continue;
      }

      processed++;

      // Re-verify duplicate prevention before sending
      const alreadySent = await prisma.subscriptionAlertLog.findFirst({
        where: {
          subscriptionId: job.subscriptionId,
          alertType: job.alertType,
          status: 'SENT',
          id: { not: job.id },
          ...(job.subscriptionEndDate ? { subscriptionEndDate: job.subscriptionEndDate } : {})
        }
      });

      if (alreadySent) {
        console.log(`[SubscriptionAlertWorker] Idempotency guard: alert already sent for subscription ${job.subscriptionId}. Marking job ${job.id} as SKIPPED.`);
        await prisma.subscriptionAlertLog.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: 'Duplicate prevented: alert was already sent for this subscription cycle.',
          }
        });
        continue;
      }

      // Fetch organization details for variable replacement
      const org = await prisma.organization.findUnique({
        where: { id: job.organizationId },
        select: { name: true, plan: true, status: true }
      });

      // Format expiration date nicely in configured timezone
      let formattedExpirationDate = 'N/A';
      if (job.subscriptionEndDate) {
        try {
          formattedExpirationDate = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }).format(new Date(job.subscriptionEndDate));
        } catch {
          formattedExpirationDate = new Date(job.subscriptionEndDate).toISOString().slice(0, 10);
        }
      }

      const daysRemainingText = job.alertType === '5_DAYS' ? '5' : '1';
      const planName = org?.plan ? org.plan.toUpperCase() : 'Standard';

      const variableValues: Record<string, string> = {
        vendor_name: org?.name || 'Customer',
        expiration_date: formattedExpirationDate,
        plan_name: planName,
        system_name: platformName,
        days_remaining: daysRemainingText,
      };

      const fallbackParameters = [
        { type: 'text', text: org?.name || 'Customer' },
        { type: 'text', text: formattedExpirationDate },
        { type: 'text', text: planName },
        { type: 'text', text: platformName },
      ];

      console.log(`[SubscriptionAlertWorker] Dispatching ${job.alertType} alert to ${job.recipientPhone} (${org?.name})...`);

      const sendResult = await sendSystemWhatsAppTemplateDetailed(
        job.recipientPhone,
        job.templateName || '',
        fallbackParameters,
        job.templateLanguage || 'en',
        variableValues
      );

      if (sendResult.success) {
        await prisma.subscriptionAlertLog.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            messageId: sendResult.messageId || null,
            error: null
          }
        });
        sent++;
        console.log(`[SubscriptionAlertWorker] Successfully sent alert ${job.id} to ${job.recipientPhone}. Message ID: ${sendResult.messageId}`);
      } else {
        await prisma.subscriptionAlertLog.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: sendResult.error || 'Unknown WhatsApp Gateway error',
            attempts: job.attempts + 1
          }
        });
        failed++;
        console.warn(`[SubscriptionAlertWorker] Failed sending alert ${job.id} to ${job.recipientPhone}: ${sendResult.error}`);
      }

      // ─── One-Minute Gap Between Messages ─────────────────────────────────
      // If there are more pending messages in this run, wait approximately 60 seconds
      const hasMorePending = i < pendingJobs.length - 1;
      if (hasMorePending) {
        console.log('[SubscriptionAlertWorker] Waiting 1 minute (60,000 ms) before sending next alert message...');
        await sleep(60_000);
      }
    }
  } catch (err) {
    console.error('[SubscriptionAlertWorker] Error processing alert queue:', err);
  } finally {
    isQueueWorkerRunning = false;
  }

  return { processed, sent, failed };
}

/**
 * Daily scheduler tick:
 * Invoked by instrumentation.ts every 60 seconds.
 * Checks current time against configured Daily Alert Check Time in configured Timezone.
 * Executes daily subscription check only once per calendar day.
 */
export async function runSubscriptionAlertSchedulerTick(): Promise<void> {
  try {
    const config = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subAlertCheckTime: true,
        subAlertTimezone: true,
        subAlert5DaysEnabled: true,
        subAlert1DayEnabled: true,
        subAlertLastRunDate: true,
        whatsappPhoneNumberId: true,
        metaAccessToken: true,
      }
    });

    if (!config) return;

    // First process any pending queue items if available
    await processSubscriptionAlertQueue().catch(console.error);

    // If neither alert is enabled or gateway is disconnected, skip daily check trigger
    if (!config.subAlert5DaysEnabled && !config.subAlert1DayEnabled) {
      return;
    }
    if (!config.whatsappPhoneNumberId || !config.metaAccessToken) {
      return;
    }

    const timeZone = config.subAlertTimezone || 'Asia/Karachi';
    const targetTime = parseCheckTime(config.subAlertCheckTime || '12:00 PM');
    const nowZoned = getZonedTimeDetails(timeZone, new Date());

    // Check if the current time in the configured timezone has reached the check time
    // and that today has not yet been processed
    const alreadyRunToday = config.subAlertLastRunDate === nowZoned.dateStr;

    // Triggers when current hour & minute match, or if it passed target time and hasn't run today
    const isTimeToRun =
      (nowZoned.hour === targetTime.hour && nowZoned.minute === targetTime.minute) ||
      (!alreadyRunToday && (nowZoned.hour > targetTime.hour || (nowZoned.hour === targetTime.hour && nowZoned.minute >= targetTime.minute)));

    if (isTimeToRun && !alreadyRunToday) {
      console.log(`[SubscriptionAlertWorker] Triggering daily alert check for date ${nowZoned.dateStr} at ${nowZoned.hour}:${nowZoned.minute} (${timeZone}). Target was ${targetTime.hour}:${targetTime.minute}.`);

      // Update subAlertLastRunDate immediately to prevent duplicate runs today
      await prisma.systemConfig.update({
        where: { id: config.id },
        data: { subAlertLastRunDate: nowZoned.dateStr }
      });

      // Enqueue eligible alerts
      await evaluateAndQueueSubscriptionAlerts(false);

      // Start processing queue
      await processSubscriptionAlertQueue();
    }
  } catch (err) {
    console.error('[SubscriptionAlertWorker] Error in scheduler tick:', err);
  }
}

/**
 * Manual trigger helper for testing or admin-forced check
 */
export async function triggerManualAlertCheck(): Promise<{
  success: boolean;
  queued: number;
  skipped: number;
  details: string;
}> {
  try {
    const res = await evaluateAndQueueSubscriptionAlerts(true);
    // Kick off queue processing in background
    setImmediate(() => {
      processSubscriptionAlertQueue().catch(console.error);
    });

    return {
      success: true,
      queued: res.queuedCount,
      skipped: res.skippedCount,
      details: `Evaluated subscriptions: ${res.queuedCount} queued, ${res.skippedCount} skipped (already sent or not eligible).`
    };
  } catch (err: any) {
    return {
      success: false,
      queued: 0,
      skipped: 0,
      details: err?.message || 'Error running manual check'
    };
  }
}
