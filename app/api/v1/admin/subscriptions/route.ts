import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { authenticateProjectKey } from "@/lib/api/project-auth"

export async function GET(req: Request) {
  try {
    let isAuthorized = false

    const session = await getServerSession(authOptions)
    if (session?.user) {
      const role = session.user.role?.toUpperCase()
      if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      const auth = await authenticateProjectKey(req as NextRequest)
      if (!auth.error && auth.org) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        users: {
          take: 1,
          select: { email: true, name: true }
        }
      }
    })

    const subscriptions = orgs.map((org) => {
      const p = (org.plan || "free").toLowerCase()
      const isPaid = p === 'ultimate' || p === 'pro' || p === 'premium'
      const amount = isPaid ? (p === 'ultimate' ? '$199.00 / mo' : '$99.00 / mo') : '$0.00 / mo'
      return {
        id: org.id,
        vendor: org.name,
        plan: p.toUpperCase(),
        status: (org.status || "active").toUpperCase(),
        amount: amount,
        email: org.users[0]?.email || "N/A",
        createdAt: org.createdAt,
        endsAt: new Date(new Date(org.createdAt).setMonth(new Date(org.createdAt).getMonth() + 1)).toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      subscriptions,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch subscriptions" }, { status: 500 })
  }
}
