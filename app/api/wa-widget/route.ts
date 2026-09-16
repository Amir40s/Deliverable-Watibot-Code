import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true, widgetConfig: true, whatsappNumber: true, whatsappBusinessName: true, slug: true }
    })

    const [agents, flows] = await Promise.all([
      prisma.aIAgent.findMany({
        where: { organizationId: session.user.organizationId },
        select: { id: true, name: true, model: true, aiProvider: true, isDefault: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.flow.findMany({
        where: { organizationId: session.user.organizationId },
        select: { id: true, name: true, isActive: true },
        orderBy: { updatedAt: "desc" }
      })
    ])

    return NextResponse.json({
      widgetId: org?.slug || org?.id,
      config: org?.widgetConfig || null,
      whatsappNumber: org?.whatsappNumber,
      businessName: org?.whatsappBusinessName,
      availableAgents: agents,
      availableFlows: flows,
    })
  } catch (e) {
    console.error("[wa-widget GET]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { 
      phone, buttonBgColor, ctaText, marginBottom, marginLeft, marginRight, borderRadius,
      prefillMsg, position,
      brandName, brandSubtitle, brandColor, brandImageUrl, widgetCtaText, onScreenMsg,
      openOnMobile, openByDefault, reopenByDefault,
      urlPersonalizationEnabled, urlRules,
      automationType, agentId, flowId
    } = body

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        widgetConfig: { 
          phone, buttonBgColor, ctaText, marginBottom, marginLeft, marginRight, borderRadius,
          prefillMsg, position,
          brandName, brandSubtitle, brandColor, brandImageUrl, widgetCtaText, onScreenMsg,
          openOnMobile, openByDefault, reopenByDefault,
          urlPersonalizationEnabled, urlRules,
          automationType: automationType || "none",
          agentId: agentId || null,
          flowId: flowId || null
        }
      }
    })

    return NextResponse.json({ success: true, widgetId: session.user.organizationId })
  } catch (e) {
    console.error("[wa-widget POST]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
