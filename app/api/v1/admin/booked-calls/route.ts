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

    const calls = await prisma.bookedCall.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    })

    const bookedCalls = calls.map((c) => ({
      id: c.id,
      date: c.date,
      time: c.time,
      phoneNumber: c.phoneNumber,
      status: c.status || 'PENDING',
      userName: c.user?.name || c.user?.email || 'N/A',
      userEmail: c.user?.email || 'N/A',
      orgName: c.organization?.name || 'System',
      createdAt: c.createdAt,
    }))

    return NextResponse.json({
      success: true,
      bookedCalls,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch booked calls" }, { status: 500 })
  }
}
