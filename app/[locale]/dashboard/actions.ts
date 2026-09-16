"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAdAccounts, getCampaigns } from "@/app/actions/campaigns"

/** Last 12 months: how many contacts (users) were created each month */
export type ChartDataPoint = { month: string; count: number }

async function getScopedContactWhere(session: any, orgId: string) {
  const userId = session?.user?.id;
  if (!userId) return { organizationId: orgId };

  const isSuperOrAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
  if (isSuperOrAdmin) return { organizationId: orgId };

  const perms = (session?.user?.permissions || {}) as Record<string, any>;
  if (perms.chat_super === true || perms.view_all_chats === 'full' || perms.view_all_chats === 'view') {
    return { organizationId: orgId };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true }
  }).catch(() => null);

  if (org?.ownerId === userId) {
    return { organizationId: orgId };
  }

  return {
    organizationId: orgId,
    OR: [
      { assignedAgentId: userId },
      { assignedUsers: { some: { id: userId } } }
    ]
  };
}

export async function getDashboardChartData(): Promise<ChartDataPoint[]> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return []

  const orgId = session.user.organizationId
  try {
    const contactWhere = await getScopedContactWhere(session, orgId)
    const now = new Date()
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    // Optimized: Run 12 counts in parallel instead of fetching all records
    const chartData = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
        
        const count = await prisma.contact.count({
          where: {
            ...contactWhere,
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
        })

        const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        return { month: monthLabel, count, sortKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
      })
    )

    return chartData
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ month, count }) => ({ month, count }))
  } catch (error) {
    console.error("Failed to fetch dashboard chart data:", error)
    return []
  }
}

export type DashboardStats = {
 totalContacts: number
 totalMessages: number
 subscriptionActive: boolean
 subscriptionPlan: string
 totalCampaigns: number
 totalTemplates: number
 totalFlows: number
 organizationName: string | null
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return null

  const orgId = session.user.organizationId

  try {
    const contactWhere = await getScopedContactWhere(session, orgId)
    const [org, totalContacts, totalMessages, templates, totalFlows] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { plan: true, status: true, name: true },
      }),
      prisma.contact.count({ where: contactWhere }),
      prisma.message.count({
        where: { contact: contactWhere },
      }),
      getMessageTemplates().catch(() => []),
      prisma.flow.count({ where: { organizationId: orgId } }),
    ])

    const subscriptionActive = org?.status === "active"
    const plan = org?.plan ?? "free"
    const subscriptionPlan =
      plan === "free"
        ? "Free"
        : plan === "monthly"
        ? "Monthly"
        : plan === "yearly"
        ? "Yearly"
        : plan.charAt(0).toUpperCase() + plan.slice(1)

    const totalTemplates = Array.isArray(templates) ? templates.length : 0

    // Fetch campaign count
    let totalCampaigns = 0
    try {
      const accountsRes = await getAdAccounts()
      if (accountsRes.success && accountsRes.data) {
        if (accountsRes.data.length > 0) {
          const campaignsRes = await getCampaigns(accountsRes.data[0].id)
          if (campaignsRes.success && campaignsRes.data) {
            totalCampaigns = campaignsRes.data.length
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch campaign count for dashboard:", err)
    }

    return {
      totalContacts,
      totalMessages,
      subscriptionActive,
      subscriptionPlan,
      totalCampaigns,
      totalTemplates,
      totalFlows,
      organizationName: org?.name ?? null,
    }
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error)
    return null
  }
}

/** Today's message counts: sent (outbound) and received (inbound) */
export type TodayMessagesStats = { sent: number; received: number }

export async function getTodayMessagesStats(): Promise<TodayMessagesStats> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return { sent: 0, received: 0 }

  const orgId = session.user.organizationId
  const now = new Date()
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const endOfToday = new Date(startOfToday)
  endOfToday.setUTCDate(endOfToday.getUTCDate() + 1)

  try {
    const contactWhere = await getScopedContactWhere(session, orgId)
    const [sent, received] = await Promise.all([
      prisma.message.count({
        where: {
          contact: contactWhere,
          direction: "outbound",
          createdAt: { gte: startOfToday, lt: endOfToday },
        },
      }),
      prisma.message.count({
        where: {
          contact: contactWhere,
          direction: "inbound",
          createdAt: { gte: startOfToday, lt: endOfToday },
        },
      }),
    ])
    return { sent, received }
  } catch (error) {
    console.error("Failed to fetch today messages stats:", error)
    return { sent: 0, received: 0 }
  }
}

/** Hourly breakdown for today: sent and received per hour (UTC) */
export type TodayMessagesChartPoint = { hour: string; sent: number; received: number }

export async function getTodayMessagesChartData(): Promise<TodayMessagesChartPoint[]> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return []

  const orgId = session.user.organizationId
  try {
    const contactWhere = await getScopedContactWhere(session, orgId)
    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))

    // Optimized: Run 24 parallel counts for sent/received messages per hour
    const hourlyData = await Promise.all(
      Array.from({ length: 24 }, async (_, i) => {
        const hourStart = new Date(startOfToday)
        hourStart.setUTCHours(i)
        const hourEnd = new Date(hourStart)
        hourEnd.setUTCHours(i + 1)

        const [sent, received] = await Promise.all([
          prisma.message.count({
            where: {
              contact: contactWhere,
              direction: "outbound",
              createdAt: { gte: hourStart, lt: hourEnd },
            },
          }),
          prisma.message.count({
            where: {
              contact: contactWhere,
              direction: "inbound",
              createdAt: { gte: hourStart, lt: hourEnd },
            },
          }),
        ])

        return {
          hour: String(i).padStart(2, "0") + ":00",
          sent,
          received,
        }
      })
    )

    return hourlyData
  } catch (error) {
    console.error("Failed to fetch today messages chart data:", error)
    return []
  }
}

/** Contacts created per day in the current month */
export type ContactsThisMonthChartPoint = { day: string; count: number }

export async function getContactsThisMonthChartData(): Promise<ContactsThisMonthChartPoint[]> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return []

  const orgId = session.user.organizationId
  try {
    const contactWhere = await getScopedContactWhere(session, orgId)
    const now = new Date()
    const today = now.getDate()

    // Optimized: Run daily counts in parallel for the current month
    const dailyData = await Promise.all(
      Array.from({ length: today }, async (_, i) => {
        const day = i + 1
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), day, 0, 0, 0, 0)
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59, 999)
        
        const count = await prisma.contact.count({
          where: {
            ...contactWhere,
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        })

        return {
          day: String(day),
          count,
        }
      })
    )

    return dailyData
  } catch (error) {
    console.error("Failed to fetch contacts this month chart data:", error)
    return []
  }
}

export type ContactSourcePoint = {
  name: string
  value: number
  color: string
}

export async function getContactSourceDistribution(): Promise<ContactSourcePoint[]> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return []

  const orgId = session.user.organizationId

  try {
    const contactWhere = await getScopedContactWhere(session, orgId)
    const platforms = ["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK"]
    const colorMap: Record<string, string> = {
      WHATSAPP: "#10B981",
      FACEBOOK: "#3B82F6",
      INSTAGRAM: "#F97316",
      TIKTOK: "#111827",
    }

    const toLabel = (platform: string) => {
      if (platform === "WHATSAPP") return "WhatsApp"
      if (platform === "FACEBOOK") return "Facebook"
      if (platform === "INSTAGRAM") return "Instagram"
      if (platform === "TIKTOK") return "TikTok"
      return platform
    }

    // Optimized: Run platform counts in parallel instead of fetching all contacts
    const sourceStats = await Promise.all(
      platforms.map(async (platform) => {
        const count = await prisma.contact.count({
          where: { 
            ...contactWhere,
            platform: platform as any
          },
        })
        return { platform, count }
      })
    )

    return sourceStats
      .filter(({ count }) => count > 0)
      .map(({ platform, count }) => ({
        name: toLabel(platform),
        value: count,
        color: colorMap[platform] || "#6366F1",
      }))
  } catch (error) {
    console.error("Failed to fetch contact source distribution:", error)
    return []
  }
}
