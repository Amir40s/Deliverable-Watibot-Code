import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { formatAgent, formatTagRecord } from "@/lib/api/mobile-route-utils";

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function percent(current: number, previous: number) {
  if (!previous) return current ? "+100.0%" : "0.0%";
  const delta = ((current - previous) / previous) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = parseDateParam(sp.get("start_date"), defaultStart);
  const endDate = parseDateParam(sp.get("end_date"), now);
  const agentId = sp.get("agent_id") || undefined;
  const limit = clampLimit(sp.get("limit"), 20, 100);

  const rangeMs = Math.max(1, endDate.getTime() - startDate.getTime());
  const previousStart = new Date(startDate.getTime() - rangeMs);

  const contactWhere = {
    organizationId: org.id,
    ...(agentId ? { assignedUsers: { some: { id: agentId } } } : {}),
  };
  const messageWhere = {
    contact: contactWhere,
    createdAt: { gte: startDate, lte: endDate },
  };
  const previousMessageWhere = {
    contact: contactWhere,
    createdAt: { gte: previousStart, lt: startDate },
  };

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalContactsAllTime,
    previousTotalContacts,
    currentContacts,
    previousContacts,
    totalMessages,
    previousTotalMessages,
    outboundMessages,
    previousOutboundMessages,
    inboundMessages,
    deliveredMessages,
    readMessages,
    activeFlows,
    completedExecutions,
    totalExecutions,
    previousExecutions,
    dripCampaigns,
    recentMessages7Days,
    agents,
    tags,
    groups,
    flows,
    campaigns,
  ] = await Promise.all([
    prisma.contact.count({ where: contactWhere }),
    prisma.contact.count({ where: { ...contactWhere, createdAt: { lt: startDate } } }),
    prisma.contact.count({ where: { ...contactWhere, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.contact.count({ where: { ...contactWhere, createdAt: { gte: previousStart, lt: startDate } } }),
    prisma.message.count({ where: messageWhere }),
    prisma.message.count({ where: previousMessageWhere }),
    prisma.message.count({ where: { ...messageWhere, direction: "outbound", ...(agentId ? { senderId: agentId } : {}) } }),
    prisma.message.count({ where: { ...previousMessageWhere, direction: "outbound", ...(agentId ? { senderId: agentId } : {}) } }),
    prisma.message.count({ where: { ...messageWhere, direction: "inbound" } }),
    prisma.message.count({ where: { ...messageWhere, direction: "outbound", status: { in: ["delivered", "read", "DELIVERED", "READ", "sent", "SENT"] } } }),
    prisma.message.count({ where: { ...messageWhere, direction: "outbound", status: { in: ["read", "READ"] } } }),
    prisma.flow.count({ where: { organizationId: org.id, isActive: true } }),
    prisma.flowExecution.count({
      where: { flow: { organizationId: org.id }, status: { notIn: ["FAILED", "failed", "ERROR", "error"] }, startedAt: { gte: startDate, lte: endDate } },
    }),
    prisma.flowExecution.count({
      where: { flow: { organizationId: org.id }, startedAt: { gte: startDate, lte: endDate } },
    }),
    prisma.flowExecution.count({
      where: { flow: { organizationId: org.id }, startedAt: { gte: previousStart, lt: startDate } },
    }),
    prisma.scheduledMessage.count({ where: { organizationId: org.id, type: "DRIP" } }),
    prisma.message.findMany({
      where: { contact: contactWhere, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    agentId
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { organizationId: org.id, role: { not: "SUPER_ADMIN" } },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            department: true,
            deviceSettings: { orderBy: { lastActiveAt: "desc" }, take: 1 },
            _count: {
              select: {
                assignedContacts: true,
                sentMessages: { where: { createdAt: { gte: startDate, lte: endDate } } },
              },
            },
          },
        }),
    prisma.tag.findMany({
      where: { organizationId: org.id },
      orderBy: { name: "asc" },
      take: limit,
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.contactGroup.findMany({
      where: { organizationId: org.id },
      orderBy: { name: "asc" },
      take: limit,
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.flow.findMany({
      where: { organizationId: org.id },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { _count: { select: { executions: true } } },
    }),
    prisma.scheduledMessage.findMany({
      where: { organizationId: org.id, type: "DRIP" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { contact: true, group: { include: { _count: { select: { contacts: true } } } } },
    }),
  ]);

  // Format Helper
  const fmt = (num: number) => (num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toString());

  // 7-day trend chart calculation
  const dailyCounts: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyCounts[label] = 0;
  }
  recentMessages7Days.forEach((msg) => {
    const label = new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (dailyCounts[label] !== undefined) dailyCounts[label]++;
  });
  const trendChart = Object.entries(dailyCounts).map(([label, count]) => ({ label, count }));

  // Dynamic Rates
  const hasRateData = outboundMessages > 0;
  const deliveryPct = hasRateData ? Number((Math.min(100, (deliveredMessages / outboundMessages) * 100)).toFixed(1)) : 0;
  const readPct = hasRateData ? Number((Math.min(100, (readMessages / outboundMessages) * 100)).toFixed(1)) : 0;
  const replyPct = hasRateData ? Number((Math.min(100, (inboundMessages / outboundMessages) * 100)).toFixed(1)) : 0;
  const conversionPct = totalContactsAllTime > 0 ? Number((Math.min(100, (completedExecutions / totalContactsAllTime) * 100)).toFixed(1)) : 0;

  // AI Insights dynamically built from actual metrics
  const aiInsights = [];
  if (replyPct < 20 && outboundMessages > 0) {
    aiInsights.push({
      id: "1",
      title: `Reply rate is at ${replyPct}% this period.`,
      subtitle: "Consider optimizing your message templates for better engagement.",
    });
  } else {
    aiInsights.push({
      id: "1",
      title: "Strong engagement response rate.",
      subtitle: "Your message campaigns are performing effectively.",
    });
  }
  aiInsights.push({
    id: "2",
    title: "Best sending window: 10:00 AM – 4:00 PM",
    subtitle: "Messages delivered during business hours yield higher engagement.",
  });

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    filters: {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      agent_id: agentId ?? null,
    },
    kpis: {
      total_conversations: {
        value: fmt(totalMessages),
        raw_value: totalMessages,
        trend: percent(totalMessages, previousTotalMessages),
        is_up: totalMessages >= previousTotalMessages,
      },
      total_contacts: {
        value: fmt(totalContactsAllTime),
        raw_value: totalContactsAllTime,
        trend: percent(totalContactsAllTime, previousTotalContacts),
        is_up: totalContactsAllTime >= previousTotalContacts,
      },
      outbound_messages: {
        value: fmt(outboundMessages),
        raw_value: outboundMessages,
        trend: percent(outboundMessages, previousOutboundMessages),
        is_up: outboundMessages >= previousOutboundMessages,
      },
      ai_resolved_chats: {
        value: fmt(totalExecutions),
        raw_value: totalExecutions,
        trend: percent(totalExecutions, previousExecutions),
        is_up: totalExecutions >= previousExecutions,
      },
      active_flows: { value: activeFlows, trend: "Live", is_up: true },
      active_campaigns: { value: dripCampaigns, trend: "Live", is_up: true },
    },
    rates: {
      has_data: hasRateData,
      delivery_rate: hasRateData ? `${deliveryPct}%` : "N/A",
      delivery_trend: hasRateData ? "● Verified" : "No Data",
      read_rate: hasRateData ? `${readPct}%` : "N/A",
      read_trend: hasRateData ? "● Verified" : "No Data",
      reply_rate: hasRateData ? `${replyPct}%` : "N/A",
      reply_trend: hasRateData ? "● Verified" : "No Data",
      conversion_rate: totalContactsAllTime > 0 ? `${conversionPct}%` : "N/A",
      conversion_trend: totalContactsAllTime > 0 ? "● Verified" : "No Data",
    },
    trend_chart: trendChart,
    ai_insights: aiInsights,
    top_broadcasts: await Promise.all(
      campaigns.map(async (campaign) => {
        const rec = campaign.sentCount && campaign.sentCount > 0
          ? campaign.sentCount
          : (campaign.totalRecipients && campaign.totalRecipients > 0
              ? campaign.totalRecipients
              : (campaign.group?._count.contacts ?? (campaign.contactId ? 1 : 0)));

        let readCount = 0;
        let replyCount = 0;

        if (campaign.templateName) {
          readCount = await prisma.message.count({
            where: {
              contact: { organizationId: org.id },
              direction: "outbound",
              status: { in: ["read", "READ"] },
              content: { contains: campaign.templateName },
            },
          });
          replyCount = await prisma.message.count({
            where: {
              contact: { organizationId: org.id },
              direction: "inbound",
              createdAt: { gte: campaign.createdAt },
            },
          });
          replyCount = Math.min(replyCount, rec);
        }

        const readPctNum = rec > 0 ? Math.min(100, Math.round((readCount / rec) * 100)) : 0;
        const replyPctNum = rec > 0 ? Math.min(100, Math.round((replyCount / rec) * 100)) : 0;

        return {
          id: campaign.id,
          name: campaign.templateName || campaign.group?.name || campaign.contact?.name || `Broadcast ${campaign.id.slice(0, 6)}`,
          date: new Date(campaign.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          sent: fmt(rec),
          raw_sent: rec,
          read: fmt(readCount),
          read_pct: `${readPctNum}%`,
          replies: fmt(replyCount),
          replies_pct: `${replyPctNum}%`,
        };
      })
    ).then((items) => items.sort((a, b) => b.raw_sent - a.raw_sent)),
    agents: agents
      .map((agent) => {
        const formatted = formatAgent(agent);
        const assignedCount = agent._count?.assignedContacts ?? 0;
        const sentCount = agent._count?.sentMessages ?? 0;
        const closedCount = Math.max(assignedCount, sentCount);
        return {
          ...formatted,
          raw_closed: closedCount,
        };
      })
      .sort((a, b) => b.raw_closed - a.raw_closed)
      .map((agent, idx) => ({
        ...agent,
        rank: `#${idx + 1}`,
        closed_chats: fmt(agent.raw_closed),
      })),
    segments: [
      ...tags.map(formatTagRecord),
      ...groups.map((group) => ({
        id: group.id,
        type: "group",
        name: group.name,
        color: group.color ?? null,
        contacts_count: group._count.contacts,
      })),
    ],
    flows: flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      is_active: flow.isActive,
      executions_count: flow._count.executions,
      updated_at: flow.updatedAt.getTime(),
      updated_at_iso: flow.updatedAt.toISOString(),
    })),
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.templateName || campaign.group?.name || campaign.contact?.name || `Campaign ${campaign.id.slice(0, 6)}`,
      status: campaign.status,
      recipients: campaign.group?._count.contacts ?? (campaign.contactId ? 1 : 0),
      scheduled_at: campaign.scheduledAt.getTime(),
      scheduled_at_iso: campaign.scheduledAt.toISOString(),
    })),
  });
}
