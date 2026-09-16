import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { authenticateProjectKey } from "@/lib/api/project-auth"
import crypto from "crypto"

export async function POST(req: Request) {
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
      return NextResponse.json({ error: 'Unauthorized. Admin permissions required.' }, { status: 401 })
    }

    const body = await req.json()
    const { vendorId, userId } = body

    if (!vendorId && !userId) {
      return NextResponse.json({ error: 'vendorId or userId is required' }, { status: 400 })
    }

    let org: any = null
    if (vendorId) {
      org = await prisma.organization.findUnique({
        where: { id: vendorId },
        include: {
          users: {
            orderBy: { createdAt: "asc" },
            take: 1
          }
        }
      })
    } else if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true }
      })
      if (user && user.organization) {
        org = {
          ...user.organization,
          users: [user]
        }
      }
    }

    if (!org) {
      return NextResponse.json({ error: 'Vendor organization not found' }, { status: 404 })
    }

    const primaryUser = org.users?.[0]
    if (!primaryUser) {
      return NextResponse.json({ error: 'No user associated with this vendor workspace' }, { status: 404 })
    }

    // Ensure shopifyIntegrationToken exists as projectApiKey
    let token = org.shopifyIntegrationToken
    if (!token) {
      token = `wbpk_${crypto.randomBytes(12).toString('hex')}`
      await prisma.organization.update({
        where: { id: org.id },
        data: { shopifyIntegrationToken: token }
      })
    }

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: primaryUser.id,
        name: primaryUser.name || org.name,
        email: primaryUser.email,
        role: primaryUser.role || 'ADMIN',
        organizationId: org.id,
        organizationName: org.name,
        image: primaryUser.image || org.logo || '',
      }
    })
  } catch (error: any) {
    console.error('Impersonation API error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to start vendor impersonation' }, { status: 500 })
  }
}
