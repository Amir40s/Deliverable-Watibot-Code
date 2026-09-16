import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { authenticateProjectKey } from '@/lib/api/project-auth'
import { getDateBounds } from '@/lib/admin/dashboard-date-filter'
import { getVendors } from '@/app/[locale]/admin/vendors/actions'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    let isAuthorized = false

    // 1. Web session check
    const session = await getServerSession(authOptions)
    if (session?.user) {
      const role = session.user.role?.toUpperCase()
      if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        isAuthorized = true
      }
    }

    // 2. Mobile API key / Bearer token check
    if (!isAuthorized) {
      const auth = await authenticateProjectKey(req as NextRequest)
      if (!auth.error && auth.org) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') || 'all'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const dateBounds = getDateBounds({ filter, startDate, endDate })
    const { from, to } = dateBounds
    const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {}

    // Previous period for growth calculation
    let prevFrom: Date | null = null
    let prevTo: Date | null = null
    if (from && to) {
      const duration = to.getTime() - from.getTime()
      prevTo = new Date(from.getTime() - 1)
      prevFrom = new Date(prevTo.getTime() - duration)
    } else {
      const today = new Date(new Date().setHours(0, 0, 0, 0))
      prevTo = today
      prevFrom = new Date(new Date().setDate(new Date().getDate() - 30))
    }
    const prevCondition = prevFrom && prevTo ? { createdAt: { gte: prevFrom, lte: prevTo } } : {}

    const [
      totalVendors,
      activeVendors,
      trialVendors,
      vendorsPrevPeriod,
      totalMessages,
      messagesPrevPeriod,
      totalContacts,
      activeSubscriptions,
      allOrgs,
      dbPlans,
      recentVendors,
      topVendors,
      recentActivity,
      recentLogs
    ] = await Promise.all([
      prisma.organization.count({ where: { users: { some: {} }, ...dateCondition } }),
      prisma.organization.count({ where: { status: 'active', users: { some: {} }, ...dateCondition } }),
      prisma.organization.count({ where: { status: 'trial', users: { some: {} }, ...dateCondition } }),
      prisma.organization.count({ where: { users: { some: {} }, ...prevCondition } }),
      prisma.message.count({ where: { ...dateCondition } }),
      prisma.message.count({ where: { ...prevCondition } }),
      prisma.contact.count({ where: { ...dateCondition } }),
      prisma.subscription.findMany({ 
        where: { 
          status: { has: 'active' },
          ...(from && to ? { startDate: { lte: to }, endDate: { gte: from } } : {})
        }, 
        select: { amount: true, frequency: true, createdAt: true } 
      }),
      prisma.organization.findMany({
        where: { users: { some: {} }, ...dateCondition },
        select: { 
          id: true, 
          name: true,
          plan: true, 
          status: true, 
          whatsappPhoneNumberId: true, 
          whatsappNumber: true,
          whatsappConnectionMethod: true,
          whatsapp_onboarding_raw_data: true,
          createdAt: true 
        }
      }),
      prisma.plan.findMany({ select: { name: true, slug: true, monthlyPrice: true, yearlyPrice: true } }).catch(() => []),
      prisma.organization.findMany({
        take: 5,
        where: { users: { some: {} }, ...dateCondition },
        orderBy: { createdAt: 'desc' },
        include: { users: { take: 1, select: { name: true, email: true } } }
      }),
      prisma.organization.findMany({
        take: 5,
        where: { users: { some: {} }, ...dateCondition },
        orderBy: { contacts: { _count: 'desc' } },
        select: { id: true, name: true, _count: { select: { contacts: true, users: true } } }
      }),
      prisma.activityLog.findMany({
        where: { ...dateCondition },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { organization: { select: { name: true } }, user: { select: { name: true, email: true } } }
      }),
      prisma.activityLog.findMany({
        where: { status: { in: ['failed', 'error', 'warning'] }, ...dateCondition },
        take: 5,
        orderBy: { createdAt: 'desc' }
      })
    ])

    let mrr = 0
    activeSubscriptions.forEach(sub => {
      if (sub.frequency?.toLowerCase() === 'monthly') mrr += Number(sub.amount || 0)
      if (sub.frequency?.toLowerCase() === 'yearly') mrr += Number(sub.amount || 0) / 12
    })
    const arr = mrr * 12

    const hasHistoricalVendors = vendorsPrevPeriod > 0
    const vendorGrowth = hasHistoricalVendors ? ((activeVendors - vendorsPrevPeriod) / vendorsPrevPeriod) * 100 : null

    const hasHistoricalMessages = messagesPrevPeriod > 0
    const messageGrowth = hasHistoricalMessages ? ((totalMessages - messagesPrevPeriod) / messagesPrevPeriod) * 100 : null

    // Detailed WABA statistics
    const wabaTotal = allOrgs.length
    let wabaActive = 0
    let wabaPending = 0
    let wabaExpired = 0

    for (const org of allOrgs) {
      const raw = (org.whatsapp_onboarding_raw_data as any) || {}
      const rawStatus = (raw?.phone_info?.status || '').toUpperCase()

      if (rawStatus === 'LIVE' || rawStatus === 'CONNECTED' || rawStatus === 'APPROVED') {
        wabaActive++
      } else if (rawStatus === 'PENDING') {
        wabaPending++
      } else if (rawStatus === 'BANNED' || rawStatus === 'DISABLED' || rawStatus === 'RESTRICTED') {
        wabaExpired++
      } else if (org.whatsappPhoneNumberId || org.whatsappNumber) {
        wabaActive++
      }
    }

    const wabaDisconnected = Math.max(0, wabaTotal - wabaActive - wabaPending - wabaExpired)
    const wabaHealthScore = wabaTotal > 0 ? Math.round((wabaActive / wabaTotal) * 100) : 0

    // Subscription & Active Plans breakdown
    const planNameMap = new Map<string, string>()
    const priceMap = new Map<string, number>()
    dbPlans.forEach(p => {
      planNameMap.set(p.slug.toLowerCase().trim(), p.name)
      priceMap.set(p.slug.toLowerCase().trim(), Number(p.monthlyPrice || p.yearlyPrice || 0))
    })

    const formatPlanName = (rawPlan: string | null) => {
      if (!rawPlan) return 'Free'
      const lower = rawPlan.toLowerCase().trim()
      if (planNameMap.has(lower)) return planNameMap.get(lower)!
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    }

    const planCounts: Record<string, number> = {}
    let planActiveCount = 0
    let planTrialCount = 0
    let planExpiredCount = 0

    allOrgs.forEach(o => {
      const pName = formatPlanName(o.plan)
      planCounts[pName] = (planCounts[pName] || 0) + 1
      const st = (o.status || '').toLowerCase()
      if (st === 'active') planActiveCount++
      else if (st === 'trial') planTrialCount++
      else planExpiredCount++
    })

    const planTotal = allOrgs.length
    const planDistribution = Object.entries(planCounts).map(([name, count]) => ({
      name,
      value: count,
      percentage: planTotal > 0 ? Math.round((count / planTotal) * 100) : 0
    })).sort((a, b) => b.value - a.value)

    // Revenue Timeline Analytics
    const isDaily = filter === 'today' || filter === 'yesterday'
    const isWeekly = filter === '7days' || (from && to && (to.getTime() - from.getTime()) <= 31 * 86400000)
    const revenueMap = new Map<string, number>()

    if (activeSubscriptions.length > 0) {
      activeSubscriptions.forEach(sub => {
        const date = sub.createdAt
        const amount = sub.frequency?.toLowerCase() === 'yearly' ? Number(sub.amount) / 12 : Number(sub.amount)
        let key = ''
        if (isDaily) key = `${String(date.getHours()).padStart(2, '0')}:00`
        else if (isWeekly) key = date.toLocaleDateString('default', { month: 'short', day: 'numeric' })
        else key = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`
        revenueMap.set(key, (revenueMap.get(key) || 0) + amount)
      })
    } else {
      allOrgs.forEach(org => {
        const planKey = (org.plan || '').toLowerCase().trim()
        const price = priceMap.get(planKey) || (planKey.includes('enterprise') ? 199 : planKey.includes('pro') ? 49 : 0)
        if (price > 0) {
          const d = org.createdAt
          const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
          revenueMap.set(key, (revenueMap.get(key) || 0) + price)
        }
      })
    }

    const revenueData = Array.from(revenueMap.entries()).map(([month, revenue]) => ({
      month,
      revenue: Math.floor(revenue)
    }))

    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbPing = Date.now() - dbStart

    return NextResponse.json({
      success: true,
      filter: {
        type: dateBounds.filterType,
        label: dateBounds.label,
        subLabel: dateBounds.subLabel,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null
      },
      executive: {
        totalVendors,
        activeVendors,
        trialVendors,
        totalContacts,
        totalMessages,
        mrr: Math.round(mrr),
        arr: Math.round(arr),
        vendorGrowth: vendorGrowth !== null ? parseFloat(vendorGrowth.toFixed(1)) : 0,
        messageGrowth: messageGrowth !== null ? parseFloat(messageGrowth.toFixed(1)) : 0,
        hasData: true
      },
      revenue: {
        hasData: revenueData.length > 0,
        data: revenueData
      },
      whatsapp: {
        hasData: wabaTotal > 0,
        active: wabaActive,
        disconnected: wabaDisconnected,
        pending: wabaPending,
        expired: wabaExpired,
        total: wabaTotal,
        healthScore: wabaHealthScore,
        connected: wabaActive,
        verified: wabaActive
      },
      subscriptions: {
        hasData: planDistribution.length > 0,
        total: planTotal,
        activeCount: planActiveCount,
        trialCount: planTrialCount,
        expiredCount: planExpiredCount,
        activePercentage: planTotal > 0 ? Math.round((planActiveCount / planTotal) * 100) : 0,
        trialPercentage: planTotal > 0 ? Math.round((planTrialCount / planTotal) * 100) : 0,
        expiredPercentage: planTotal > 0 ? Math.round((planExpiredCount / planTotal) * 100) : 0,
        distribution: planDistribution
      },
      health: {
        hasData: true,
        apiStatus: 'Operational',
        dbStatus: 'Operational',
        dbPing: `${dbPing}ms`,
        dbPingMs: dbPing
      },
      recentVendors: {
        hasData: recentVendors.length > 0,
        data: recentVendors.map(v => ({
          id: v.id,
          name: v.name,
          contactPerson: v.users[0]?.name || v.users[0]?.email || 'N/A',
          plan: v.plan || 'Free',
          status: v.status || 'ACTIVE',
          createdAt: v.createdAt,
          revenue: '-'
        }))
      },
      topVendors: {
        hasData: topVendors.length > 0,
        data: topVendors.map((v, i) => ({
          rank: i + 1,
          id: v.id,
          name: v.name,
          revenue: `${v._count?.contacts?.toLocaleString() || 0} Contacts`,
          growth: `${v._count?.users || 1} Users`
        }))
      },
      recentActivity: {
        hasData: recentActivity.length > 0,
        data: recentActivity.map(a => ({
          id: a.id,
          action: a.action,
          details: a.details,
          orgName: a.organization?.name || 'System',
          userEmail: a.user?.email || 'N/A',
          createdAt: a.createdAt
        }))
      },
      systemLogs: {
        hasData: recentLogs.length > 0,
        data: recentLogs.map(l => ({
          id: l.id,
          action: l.action,
          details: l.details,
          createdAt: l.createdAt
        }))
      }
    })
  } catch (error: any) {
    console.error('Super Admin Dashboard API Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch admin stats' }, { status: 500 })
  }
}
