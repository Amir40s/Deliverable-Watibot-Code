'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subDays, startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns';
import {
  analyzeWhatsAppHealthWithAI,
  AIHealthAnalysisResult,
  CampaignHealthSummary,
  HealthMetricsInput
} from '@/lib/ai/health-analyzer';

export interface DailyEngagementTrendItem {
  date: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

export interface HealthAuditResponse {
  metrics: {
    totalSent: number;
    deliveredCount: number;
    failedCount: number;
    readCount: number;
    repliedUsersCount: number;
    notRepliedUsersCount: number;
    ignoredMessagesCount: number;
    deliveryRate: number;
    readRate: number;
    replyRate: number;
    ignoreRate: number;
    failureRate: number;
    activeCampaignsCount: number;
    totalTargetedUsers: number;
  };
  metaQuality: {
    officialRating: string; // 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
    displayRating: string;  // 'High' | 'Medium' | 'Low' | 'N/A'
    verifiedName?: string | null;
    phoneNumber?: string | null;
    connectionMethod: 'meta' | 'qr';
    statusText: string;
  };
  aiAnalysis: AIHealthAnalysisResult;
  campaigns: CampaignHealthSummary[];
  trends: DailyEngagementTrendItem[];
  period: {
    range: string;
    startDate: string;
    endDate: string;
    days: number;
  };
}

export async function getHealthAuditData(
  range: '7d' | '14d' | '30d' | '90d' = '30d',
  forceReanalyze = false,
  overrideOrgId?: string
): Promise<HealthAuditResponse> {
  let orgId = overrideOrgId;
  if (!orgId) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      throw new Error('Unauthorized');
    }
    orgId = session.user.organizationId;
  }

  const daysMap = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
  const periodDays = daysMap[range] || 30;
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(subDays(new Date(), periodDays));

  // 1. Fetch organization metadata
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
      whatsappBusinessName: true,
      whatsappPhoneNumberId: true,
      whatsappConnectionMethod: true,
      whatsapp_onboarding_raw_data: true,
    }
  });

  const rawOnboarding = (org?.whatsapp_onboarding_raw_data as any) || {};
  const phoneInfo = rawOnboarding?.phone_info || {};
  const isQr = org?.whatsappConnectionMethod === 'qr' || (org?.whatsappPhoneNumberId?.startsWith('qr_') ?? false);

  const rawMetaRating = isQr ? 'UNKNOWN' : (phoneInfo.quality_rating || 'UNKNOWN').toUpperCase();
  const displayRating =
    rawMetaRating === 'GREEN'
      ? 'High Quality (GREEN)'
      : rawMetaRating === 'YELLOW'
      ? 'Medium Quality (YELLOW)'
      : rawMetaRating === 'RED'
      ? 'Low Quality (RED)'
      : isQr
      ? 'Not Applicable (QR Device Session)'
      : 'Unrated / Pending Verification';

  // 2. Query all outbound messages in period (support lowercase, uppercase, and legacy variants)
  const outboundDirections = ['outbound', 'OUTGOING', 'out', 'OUTBOUND', 'outgoing'];
  const inboundDirections = ['inbound', 'INCOMING', 'in', 'INBOUND', 'incoming'];
  const deliveredStatuses = ['delivered', 'DELIVERED', 'read', 'READ', 'Delivered', 'Read'];
  const readStatuses = ['read', 'READ', 'Read'];
  const failedStatuses = ['failed', 'FAILED', 'undelivered', 'UNDELIVERED', 'error', 'ERROR', 'Failed', 'Undelivered', 'Error'];

  const outboundWhere = {
    contact: { organizationId: orgId },
    direction: { in: outboundDirections },
    createdAt: { gte: startDate, lte: endDate }
  };

  const [
    totalSent,
    deliveredCount,
    readCount,
    failedCount,
    outboundMessagesWithContact,
    inboundMessagesWithContact,
    activeCampaignsCount,
    scheduledMessages
  ] = await Promise.all([
    // Total Outbound Sent
    prisma.message.count({ where: outboundWhere }),

    // Delivered
    prisma.message.count({
      where: {
        ...outboundWhere,
        status: { in: deliveredStatuses }
      }
    }),

    // Read
    prisma.message.count({
      where: {
        ...outboundWhere,
        status: { in: readStatuses }
      }
    }),

    // Failed
    prisma.message.count({
      where: {
        ...outboundWhere,
        status: { in: failedStatuses }
      }
    }),

    // Distinct contacts reached by outbound
    prisma.message.findMany({
      where: outboundWhere,
      select: { contactId: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    }),

    // Inbound messages in period
    prisma.message.findMany({
      where: {
        contact: { organizationId: orgId },
        direction: 'inbound',
        createdAt: { gte: startDate, lte: endDate }
      },
      select: { contactId: true, createdAt: true }
    }),

    // Active campaigns currently running
    prisma.scheduledMessage.count({
      where: {
        organizationId: orgId,
        status: { in: ['PENDING', 'PROCESSING'] }
      }
    }),

    // Campaigns created or running in period
    prisma.scheduledMessage.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        templateName: true,
        totalRecipients: true,
        sentCount: true,
        status: true,
        createdAt: true,
        group: {
          select: {
            id: true,
            name: true,
            _count: { select: { contacts: true } }
          }
        },
        contact: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  // 3. Calculate Two-Way Replied & Ignored Contacts
  const outboundContactFirstMap = new Map<string, Date>();
  for (const m of outboundMessagesWithContact) {
    if (!outboundContactFirstMap.has(m.contactId)) {
      outboundContactFirstMap.set(m.contactId, m.createdAt);
    }
  }

  const targetedContactIds = Array.from(outboundContactFirstMap.keys());
  const totalTargetedUsers = targetedContactIds.length;

  // Replied user: contact who sent an inbound message after receiving an outbound message
  const repliedContactIdsSet = new Set<string>();
  for (const im of inboundMessagesWithContact) {
    const firstOutbound = outboundContactFirstMap.get(im.contactId);
    if (firstOutbound && im.createdAt >= firstOutbound) {
      repliedContactIdsSet.add(im.contactId);
    }
  }

  const repliedUsersCount = repliedContactIdsSet.size;
  const notRepliedUsersCount = Math.max(0, totalTargetedUsers - repliedUsersCount);

  // Ignored messages: outbound messages where status is not READ and contact never replied
  const ignoredMessagesCount = Math.max(0, totalSent - readCount);

  // Rates
  const deliveryRate = totalSent > 0 ? Number(((deliveredCount / totalSent) * 100).toFixed(1)) : 100;
  const readRate = deliveredCount > 0 ? Number(((readCount / deliveredCount) * 100).toFixed(1)) : 0;
  const replyRate = totalTargetedUsers > 0 ? Number(((repliedUsersCount / totalTargetedUsers) * 100).toFixed(1)) : 0;
  const ignoreRate = Number((Math.max(0, 100 - replyRate)).toFixed(1));
  const failureRate = totalSent > 0 ? Number(((failedCount / totalSent) * 100).toFixed(1)) : 0;

  // 4. Campaign-wise Breakdown
  const campaignMap = new Map<string, CampaignHealthSummary>();
  for (const sm of scheduledMessages) {
    const key = sm.templateName || (sm.group ? `Group: ${sm.group.name}` : `Campaign #${sm.id.substring(0, 5)}`);
    const recipients = sm.totalRecipients || sm.group?._count.contacts || 1;
    const sent = sm.sentCount || (['SENT', 'PROCESSING', 'COMPLETED'].includes(sm.status) ? recipients : 0);
    
    // Estimate delivery and read based on overall ratio for this template if granular linkage isn't available
    const campDelivery = Math.round(sent * (deliveryRate / 100));
    const campRead = Math.round(campDelivery * (readRate / 100));
    const campReplied = Math.round(recipients * (replyRate / 100));
    const campIgnored = Math.max(0, recipients - campReplied);

    if (campaignMap.has(key)) {
      const existing = campaignMap.get(key)!;
      existing.sent += sent;
      existing.delivered += campDelivery;
      existing.read += campRead;
      existing.replied += campReplied;
      existing.ignored += campIgnored;
      existing.deliveryRate = existing.sent > 0 ? Number(((existing.delivered / existing.sent) * 100).toFixed(1)) : 100;
      existing.readRate = existing.delivered > 0 ? Number(((existing.read / existing.delivered) * 100).toFixed(1)) : 0;
      existing.replyRate = existing.sent > 0 ? Number(((existing.replied / existing.sent) * 100).toFixed(1)) : 0;
    } else {
      campaignMap.set(key, {
        id: sm.id,
        name: key,
        sent,
        delivered: campDelivery,
        read: campRead,
        replied: campReplied,
        ignored: campIgnored,
        deliveryRate: sent > 0 ? Number(((campDelivery / sent) * 100).toFixed(1)) : 100,
        readRate: campDelivery > 0 ? Number(((campRead / campDelivery) * 100).toFixed(1)) : 0,
        replyRate: sent > 0 ? Number(((campReplied / sent) * 100).toFixed(1)) : 0,
        status: sm.status
      });
    }
  }

  const campaignSummaries = Array.from(campaignMap.values()).sort((a, b) => b.sent - a.sent);

  // 5. Daily Engagement Trends Time-Series
  const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
  const trends: DailyEngagementTrendItem[] = [];

  // Group messages by day
  const dailySentMap: Record<string, number> = {};
  const dailyDeliveredMap: Record<string, number> = {};
  const dailyReadMap: Record<string, number> = {};
  const dailyRepliedMap: Record<string, number> = {};

  // Query daily messages
  const trendMsgs = await prisma.message.findMany({
    where: {
      contact: { organizationId: orgId },
      createdAt: { gte: startDate, lte: endDate }
    },
    select: {
      direction: true,
      status: true,
      createdAt: true
    }
  });

  for (const tm of trendMsgs) {
    const dayKey = format(tm.createdAt, 'yyyy-MM-dd');
    const dirLower = (tm.direction || '').toLowerCase();
    const stLower = (tm.status || '').toLowerCase();

    if (['inbound', 'incoming', 'in'].includes(dirLower)) {
      dailyRepliedMap[dayKey] = (dailyRepliedMap[dayKey] || 0) + 1;
    } else {
      dailySentMap[dayKey] = (dailySentMap[dayKey] || 0) + 1;
      if (['delivered', 'read'].includes(stLower)) {
        dailyDeliveredMap[dayKey] = (dailyDeliveredMap[dayKey] || 0) + 1;
      }
      if (stLower === 'read') {
        dailyReadMap[dayKey] = (dailyReadMap[dayKey] || 0) + 1;
      }
    }
  }

  for (const day of daysInterval) {
    const key = format(day, 'yyyy-MM-dd');
    const dSent = dailySentMap[key] || 0;
    const dDelivered = dailyDeliveredMap[key] || 0;
    const dRead = dailyReadMap[key] || 0;
    const dReplied = dailyRepliedMap[key] || 0;

    trends.push({
      date: format(day, 'MMM dd'),
      sent: dSent,
      delivered: dDelivered,
      read: dRead,
      replied: dReplied,
      deliveryRate: dSent > 0 ? Number(((dDelivered / dSent) * 100).toFixed(1)) : 100,
      readRate: dDelivered > 0 ? Number(((dRead / dDelivered) * 100).toFixed(1)) : 0,
      replyRate: dSent > 0 ? Number(((dReplied / dSent) * 100).toFixed(1)) : 0
    });
  }

  // 6. AI Health Analysis with Caching
  const metricsInput: HealthMetricsInput = {
    totalSent,
    deliveredCount,
    failedCount,
    readCount,
    repliedUsersCount,
    notRepliedUsersCount,
    ignoredMessagesCount,
    deliveryRate,
    readRate,
    replyRate,
    ignoreRate,
    failureRate,
    activeCampaignsCount,
    campaigns: campaignSummaries,
    metaQualityRating: rawMetaRating,
    whatsappConnectionMethod: org?.whatsappConnectionMethod || 'manual',
    periodDays
  };

  const cachedAudit = rawOnboarding?.health_audit;
  const isCacheFresh =
    !forceReanalyze &&
    cachedAudit &&
    cachedAudit.analyzedAt &&
    cachedAudit.range === range &&
    Date.now() - new Date(cachedAudit.analyzedAt).getTime() < 4 * 60 * 60 * 1000; // 4h cache

  let aiAnalysis: AIHealthAnalysisResult;
  if (isCacheFresh && cachedAudit.result) {
    aiAnalysis = cachedAudit.result;
  } else {
    aiAnalysis = await analyzeWhatsAppHealthWithAI(metricsInput, orgId);

    // Save to cache asynchronously
    prisma.organization.update({
      where: { id: orgId },
      data: {
        whatsapp_onboarding_raw_data: {
          ...rawOnboarding,
          health_audit: {
            range,
            analyzedAt: new Date().toISOString(),
            result: aiAnalysis
          }
        }
      }
    }).catch(err => console.error('[HealthAudit] Error caching audit result:', err));
  }

  return {
    metrics: {
      totalSent,
      deliveredCount,
      failedCount,
      readCount,
      repliedUsersCount,
      notRepliedUsersCount,
      ignoredMessagesCount,
      deliveryRate,
      readRate,
      replyRate,
      ignoreRate,
      failureRate,
      activeCampaignsCount,
      totalTargetedUsers
    },
    metaQuality: {
      officialRating: rawMetaRating,
      displayRating,
      verifiedName: phoneInfo.verified_name || org?.whatsappBusinessName || org?.name,
      phoneNumber: org?.whatsappNumber || phoneInfo.display_phone_number,
      connectionMethod: isQr ? 'qr' : 'meta',
      statusText: isQr
        ? 'Connected via WhatsApp Web Session (Baileys Protocol)'
        : `Verified Meta Cloud API Phone (${phoneInfo.status || 'Active'})`
    },
    aiAnalysis,
    campaigns: campaignSummaries,
    trends,
    period: {
      range,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      days: periodDays
    }
  };
}

export async function runManualHealthAudit(range: '7d' | '14d' | '30d' | '90d' = '30d') {
  return await getHealthAuditData(range, true);
}
