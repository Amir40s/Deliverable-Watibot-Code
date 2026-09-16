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

    const config = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    const googleClientId = config?.googleClientId || process.env.GOOGLE_CLIENT_ID || ''
    const facebookAppId = config?.facebookAppId || ''
    const embeddedSignupConfigId = config?.embeddedSignupConfigId || ''
    const cloudinaryCloudName = config?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || ''
    const aiProvider = config?.aiProvider || 'openai'
    const smtpHost = config?.smtpHost || process.env.EMAIL_SERVER_HOST || ''

    return NextResponse.json({
      success: true,
      socialConfig: {
        googleLoginEnabled: config?.googleLoginEnabled ?? true,
        googleClientId: googleClientId ? `${googleClientId.substring(0, 15)}...` : 'Not Configured',
        facebookAppId: facebookAppId ? `${facebookAppId.substring(0, 12)}...` : 'Not Configured',
        embeddedSignupConfigId: embeddedSignupConfigId ? `${embeddedSignupConfigId.substring(0, 12)}...` : 'Not Configured',
        cloudinaryCloudName: cloudinaryCloudName || 'Not Configured',
        aiProvider: aiProvider.toUpperCase(),
        smtpHost: smtpHost || 'Not Configured',
        metaAppConfigured: Boolean(facebookAppId && embeddedSignupConfigId),
        googleAppConfigured: Boolean(googleClientId),
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch social login config" }, { status: 500 })
  }
}
