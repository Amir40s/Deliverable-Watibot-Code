'use server';

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { processWindowReminders } from '@/lib/automation/window-reminder-worker';

/**
 * Get currently authenticated user's organization ID.
 */
async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = session?.user?.organizationId;
  if (!orgId) throw new Error('Unauthorized: No active organization session');
  return orgId;
}

/**
 * Fetch Window Reminder settings, rules, and KPI stats.
 */
export async function getWindowReminderSettings() {
  try {
    const orgId = await getOrgId();

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { isWindowRemindersEnabled: true }
    });

    const rules = await prisma.windowReminderRule.findMany({
      where: { organizationId: orgId },
      orderBy: { minutesBeforeExpiry: 'desc' }
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [sentToday, failedCount, activeRulesCount] = await Promise.all([
      prisma.windowReminderLog.count({
        where: {
          organizationId: orgId,
          status: 'SENT',
          sentAt: { gte: startOfToday }
        }
      }),
      prisma.windowReminderLog.count({
        where: {
          organizationId: orgId,
          status: 'FAILED',
          sentAt: { gte: startOfToday }
        }
      }),
      prisma.windowReminderRule.count({
        where: {
          organizationId: orgId,
          isActive: true
        }
      })
    ]);

    return {
      success: true,
      isEnabled: org?.isWindowRemindersEnabled ?? true,
      rules,
      stats: {
        totalRules: rules.length,
        activeRules: activeRulesCount,
        sentToday,
        failedCount
      }
    };
  } catch (error: any) {
    console.error('[WindowReminders] getWindowReminderSettings error:', error);
    return { success: false, error: error?.message || 'Failed to fetch settings' };
  }
}

/**
 * Toggle master window reminders enabled/disabled for the organization.
 */
export async function toggleWindowReminders(enabled: boolean) {
  try {
    const orgId = await getOrgId();
    await prisma.organization.update({
      where: { id: orgId },
      data: { isWindowRemindersEnabled: enabled }
    });

    revalidatePath('/dashboard/window-reminders');
    return { success: true, isEnabled: enabled };
  } catch (error: any) {
    console.error('[WindowReminders] toggleWindowReminders error:', error);
    return { success: false, error: error?.message || 'Failed to update setting' };
  }
}

/**
 * Create or update a Window Reminder Rule.
 */
export async function saveWindowReminderRule(data: {
  id?: string;
  name: string;
  minutesBeforeExpiry: number;
  messageType: 'TEXT' | 'TEMPLATE';
  textContent?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: any;
  isActive?: boolean;
}) {
  try {
    const orgId = await getOrgId();

    if (!data.name?.trim()) {
      return { success: false, error: 'Rule name is required' };
    }
    if (typeof data.minutesBeforeExpiry !== 'number' || data.minutesBeforeExpiry < 1 || data.minutesBeforeExpiry > 1440) {
      return { success: false, error: 'Minutes before expiry must be between 1 and 1440 (24 hours)' };
    }
    if (data.messageType === 'TEXT' && !data.textContent?.trim()) {
      return { success: false, error: 'Message text is required for TEXT message type' };
    }
    if (data.messageType === 'TEMPLATE' && !data.templateName?.trim()) {
      return { success: false, error: 'Template name is required for TEMPLATE message type' };
    }

    let rule;
    if (data.id) {
      // Update existing
      rule = await prisma.windowReminderRule.update({
        where: { id: data.id, organizationId: orgId },
        data: {
          name: data.name.trim(),
          minutesBeforeExpiry: data.minutesBeforeExpiry,
          messageType: data.messageType,
          textContent: data.textContent?.trim() || null,
          templateName: data.templateName?.trim() || null,
          templateLanguage: data.templateLanguage || 'en',
          templateComponents: data.templateComponents || null,
          isActive: data.isActive !== undefined ? data.isActive : true
        }
      });
    } else {
      // Create new
      rule = await prisma.windowReminderRule.create({
        data: {
          organizationId: orgId,
          name: data.name.trim(),
          minutesBeforeExpiry: data.minutesBeforeExpiry,
          messageType: data.messageType,
          textContent: data.textContent?.trim() || null,
          templateName: data.templateName?.trim() || null,
          templateLanguage: data.templateLanguage || 'en',
          templateComponents: data.templateComponents || null,
          isActive: data.isActive !== undefined ? data.isActive : true
        }
      });
    }

    revalidatePath('/dashboard/window-reminders');
    return { success: true, data: rule };
  } catch (error: any) {
    console.error('[WindowReminders] saveWindowReminderRule error:', error);
    return { success: false, error: error?.message || 'Failed to save rule' };
  }
}

/**
 * Delete a Window Reminder Rule.
 */
export async function deleteWindowReminderRule(ruleId: string) {
  try {
    const orgId = await getOrgId();
    await prisma.windowReminderRule.delete({
      where: { id: ruleId, organizationId: orgId }
    });

    revalidatePath('/dashboard/window-reminders');
    return { success: true };
  } catch (error: any) {
    console.error('[WindowReminders] deleteWindowReminderRule error:', error);
    return { success: false, error: error?.message || 'Failed to delete rule' };
  }
}

/**
 * Toggle single rule active/inactive.
 */
export async function toggleWindowReminderRule(ruleId: string, isActive: boolean) {
  try {
    const orgId = await getOrgId();
    const updated = await prisma.windowReminderRule.update({
      where: { id: ruleId, organizationId: orgId },
      data: { isActive }
    });

    revalidatePath('/dashboard/window-reminders');
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('[WindowReminders] toggleWindowReminderRule error:', error);
    return { success: false, error: error?.message || 'Failed to toggle rule' };
  }
}

/**
 * Get paginated execution history / logs.
 */
export async function getWindowReminderLogs(options: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  try {
    const orgId = await getOrgId();
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 15));
    const skip = (page - 1) * limit;

    const where: any = { organizationId: orgId };
    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }
    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { contact: { name: { contains: q, mode: 'insensitive' } } },
        { contact: { waId: { contains: q, mode: 'insensitive' } } },
        { rule: { name: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.windowReminderLog.count({ where }),
      prisma.windowReminderLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          contact: {
            select: { id: true, name: true, waId: true, profilePic: true }
          },
          rule: {
            select: { id: true, name: true, minutesBeforeExpiry: true, messageType: true }
          }
        }
      })
    ]);

    return {
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error: any) {
    console.error('[WindowReminders] getWindowReminderLogs error:', error);
    return { success: false, error: error?.message || 'Failed to fetch logs' };
  }
}

/**
 * Get live 24-hour window details & checklist for a specific contact.
 */
export async function getContactWindowDetails(contactId: string) {
  try {
    const orgId = await getOrgId();

    const contact = await prisma.contact.findUnique({
      where: { id: contactId, organizationId: orgId },
      select: {
        id: true,
        name: true,
        waId: true,
        lastInboundMessageAt: true,
        windowExpiresAt: true,
        windowStatus: true
      }
    });

    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    let lastInbound = contact.lastInboundMessageAt;
    // Fallback: self-heal from Message table if lastInboundMessageAt is missing
    if (!lastInbound) {
      const lastInboundMsg = await prisma.message.findFirst({
        where: { contactId, direction: 'inbound' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });
      if (lastInboundMsg) {
        lastInbound = lastInboundMsg.createdAt;
      }
    }

    const now = Date.now();
    let windowExpiresAt: Date | null = contact.windowExpiresAt;

    if (lastInbound) {
      const calculatedExpires = new Date(new Date(lastInbound).getTime() + 24 * 60 * 60 * 1000);
      if (!windowExpiresAt || Math.abs(windowExpiresAt.getTime() - calculatedExpires.getTime()) > 5000) {
        windowExpiresAt = calculatedExpires;
      }
    }

    let remainingSeconds = 0;
    let windowStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'EXPIRED';
    let canSendRegular = false;

    if (windowExpiresAt) {
      const remainingMs = windowExpiresAt.getTime() - now;
      remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      if (remainingMs > 0) {
        canSendRegular = remainingMs > (1000 * 60 * 3); // within 24h
        if (remainingMs <= 60 * 60 * 1000) {
          windowStatus = 'EXPIRING_SOON';
        } else {
          windowStatus = 'ACTIVE';
        }
      }
    }

    // Fetch all active rules for the organization
    const rules = await prisma.windowReminderRule.findMany({
      where: { organizationId: orgId },
      orderBy: { minutesBeforeExpiry: 'desc' }
    });

    // Fetch reminder logs for this contact in the CURRENT window cycle
    const logs = windowExpiresAt ? await prisma.windowReminderLog.findMany({
      where: {
        contactId,
        windowExpiresAt: {
          gte: new Date(windowExpiresAt.getTime() - 60000),
          lte: new Date(windowExpiresAt.getTime() + 60000)
        }
      }
    }) : [];

    const logMap = new Map<string, typeof logs[0]>();
    for (const log of logs) {
      logMap.set(log.ruleId, log);
    }

    const reminderChecklist = rules.map((r) => {
      const exec = logMap.get(r.id);
      return {
        ruleId: r.id,
        ruleName: r.name,
        minutesBeforeExpiry: r.minutesBeforeExpiry,
        isActive: r.isActive,
        isSent: exec?.status === 'SENT',
        status: exec?.status || (r.isActive ? 'PENDING' : 'DISABLED'),
        sentAt: exec?.sentAt || null,
        error: exec?.error || null
      };
    });

    return {
      success: true,
      data: {
        contactId: contact.id,
        name: contact.name || contact.waId,
        waId: contact.waId,
        lastInboundMessageAt: lastInbound,
        windowExpiresAt,
        windowStatus,
        remainingSeconds,
        canSendRegular,
        rules: reminderChecklist
      }
    };
  } catch (error: any) {
    console.error('[WindowReminders] getContactWindowDetails error:', error);
    return { success: false, error: error?.message || 'Failed to fetch window details' };
  }
}

/**
 * Simulation Test Sandbox: Sets simulated window timestamps on a contact to test scenarios.
 */
export async function testSimulateWindow(
  contactId: string,
  scenario: 'active_24h' | 'remaining_60m' | 'remaining_50m' | 'remaining_30m' | 'remaining_10m' | 'expired' | 'reset_reply'
) {
  try {
    const orgId = await getOrgId();
    const now = Date.now();

    let simulatedInbound: Date;
    let simulatedExpires: Date;

    switch (scenario) {
      case 'active_24h':
        simulatedInbound = new Date(now - 10 * 60 * 1000); // 10 mins ago -> 23h 50m remaining
        simulatedExpires = new Date(simulatedInbound.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'remaining_60m':
        simulatedExpires = new Date(now + 59 * 60 * 1000); // 59 mins remaining
        simulatedInbound = new Date(simulatedExpires.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'remaining_50m':
        simulatedExpires = new Date(now + 49 * 60 * 1000); // 49 mins remaining
        simulatedInbound = new Date(simulatedExpires.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'remaining_30m':
        simulatedExpires = new Date(now + 29 * 60 * 1000); // 29 mins remaining
        simulatedInbound = new Date(simulatedExpires.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'remaining_10m':
        simulatedExpires = new Date(now + 9 * 60 * 1000); // 9 mins remaining
        simulatedInbound = new Date(simulatedExpires.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'expired':
        simulatedExpires = new Date(now - 10 * 60 * 1000); // Expired 10 mins ago
        simulatedInbound = new Date(simulatedExpires.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'reset_reply':
        simulatedInbound = new Date(now); // Brand new reply right now
        simulatedExpires = new Date(now + 24 * 60 * 60 * 1000);
        break;
      default:
        throw new Error('Invalid simulation scenario');
    }

    const updated = await prisma.contact.update({
      where: { id: contactId, organizationId: orgId },
      data: {
        lastInboundMessageAt: simulatedInbound,
        windowExpiresAt: simulatedExpires,
        windowStatus: scenario === 'expired' ? 'EXPIRED' : (scenario === 'active_24h' || scenario === 'reset_reply') ? 'ACTIVE' : 'EXPIRING_SOON'
      }
    });

    return {
      success: true,
      message: `Simulated scenario "${scenario}" applied successfully`,
      data: updated
    };
  } catch (error: any) {
    console.error('[WindowReminders] testSimulateWindow error:', error);
    return { success: false, error: error?.message || 'Simulation failed' };
  }
}

/**
 * Manually trigger the background worker run and return stats.
 */
export async function triggerManualWorkerRun() {
  try {
    const orgId = await getOrgId();
    const result = await processWindowReminders(orgId);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('[WindowReminders] triggerManualWorkerRun error:', error);
    return { success: false, error: error?.message || 'Manual worker run failed' };
  }
}
