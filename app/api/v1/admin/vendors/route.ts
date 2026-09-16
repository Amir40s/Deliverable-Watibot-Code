import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { authenticateProjectKey } from "@/lib/api/project-auth"
import { getVendors, computeVendorFilterCounts } from "@/app/[locale]/admin/vendors/actions"

export async function GET(req: Request) {
  try {
    let isAuthorized = false
    let currentAdminUser: any = null

    const session = await getServerSession(authOptions)
    if (session?.user) {
      const role = session.user.role?.toUpperCase()
      if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        isAuthorized = true
        currentAdminUser = session.user
      }
    }

    if (!isAuthorized) {
      const auth = await authenticateProjectKey(req as NextRequest)
      if (!auth.error && auth.org) {
        isAuthorized = true
        const userIdHeader = (req as NextRequest).headers.get('x-watibot-user-id')
        if (userIdHeader) {
          const { prisma } = await import('@/lib/prisma')
          const user = await prisma.user.findUnique({
            where: { id: userIdHeader },
            select: { id: true, role: true, permissions: true },
          })
          if (user) currentAdminUser = user
        }
        if (!currentAdminUser && auth.org.ownerId) {
          const { prisma } = await import('@/lib/prisma')
          const owner = await prisma.user.findUnique({
            where: { id: auth.org.ownerId },
            select: { id: true, role: true, permissions: true },
          })
          if (owner) currentAdminUser = owner
        }
        if (!currentAdminUser) {
          currentAdminUser = { role: 'SUPER_ADMIN' }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') || searchParams.get('status') || 'ALL'

    const allVendors = await getVendors(filter, currentAdminUser)
    const counts = await computeVendorFilterCounts(allVendors)

    // Apply filter if specified
    let filteredList = allVendors
    if (filter && filter.toUpperCase() !== 'ALL') {
      const normalizedFilter = filter.toLowerCase().replace(/[_-]/g, "")
      const now = Date.now()
      const in5Days = now + 5 * 24 * 60 * 60 * 1000

      filteredList = allVendors.filter(v => {
        const isVendorActive = v.status === "ACTIVE" || v.subscriptionStatus === "active"
        const isWaLive = v.whatsappStatus === "LIVE" || v.whatsappStatus === "CONNECTED" || v.whatsappStatus === "APPROVED"

        if (normalizedFilter === "active") {
          return isVendorActive && isWaLive
        }
        if (normalizedFilter === "expired") {
          return v.status === "EXPIRED" || v.subscriptionStatus === "expired" || (!!v.planEndDate && new Date(v.planEndDate).getTime() < now)
        }
        if (normalizedFilter === "expiresoon") {
          return !!v.planEndDate && new Date(v.planEndDate).getTime() >= now && new Date(v.planEndDate).getTime() <= in5Days
        }
        if (normalizedFilter === "pendingplan" || normalizedFilter === "pending") {
          return v.status === "PENDING" || v.subscriptionStatus === "pending" || !v.plan || v.plan.toLowerCase() === "free" || v.plan.toLowerCase() === "pending"
        }
        if (normalizedFilter === "wabaactive") {
          return isWaLive
        }
        if (normalizedFilter === "banned") {
          return ["BANNED", "DISABLED", "BLOCKED", "RESTRICTED"].includes(v.whatsappStatus || "")
        }
        if (normalizedFilter === "disconnected") {
          return !v.whatsappStatus || v.whatsappStatus === "DISCONNECTED"
        }
        if (normalizedFilter === "suspended") {
          return v.status === "SUSPENDED" || v.subscriptionStatus === "suspended"
        }
        if (normalizedFilter === "trial") {
          return v.status === "TRIAL" || v.subscriptionStatus === "trial" || v.plan?.toLowerCase() === "trial"
        }
        return true
      })
    }

    const vendors = filteredList.map((v) => ({
      id: v.id,
      name: v.title,
      slug: v.username,
      plan: v.plan || "free",
      status: v.status || "ACTIVE",
      subscriptionStatus: v.subscriptionStatus || "active",
      contactPerson: v.adminName,
      adminName: v.adminName,
      userId: v.userId,
      email: v.email,
      phone: v.whatsappNumber || v.phoneNumber || "N/A",
      phoneNumber: v.phoneNumber,
      whatsappNumber: v.whatsappNumber,
      whatsappStatus: v.whatsappStatus || "DISCONNECTED",
      contactsCount: v.contactsCount,
      usersCount: 1,
      createdAt: v.createdAt,
      lastLoginAt: v.lastLoginAt,
      planStartDate: v.planStartDate,
      planEndDate: v.planEndDate,
      isAiBotEnabled: v.isAiBotEnabled || false,
    }))

    return NextResponse.json({
      success: true,
      filter,
      total: vendors.length,
      counts,
      vendors,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch vendors" }, { status: 500 })
  }
}
