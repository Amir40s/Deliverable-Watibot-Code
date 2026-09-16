import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint — no auth needed — used by the embedded widget script
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  try {
    const { widgetId } = await params

    const org = await prisma.organization.findFirst({
      where: { OR: [{ slug: widgetId }, { id: widgetId }] },
      select: { widgetConfig: true, whatsappNumber: true, whatsappBusinessName: true }
    })

    if (!org) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 })
    }

    const cfg = (org.widgetConfig as Record<string, string>) || {}

    const response = NextResponse.json({
      phone: cfg.phone || org.whatsappNumber || "",
      buttonBgColor: cfg.buttonBgColor || "#4dc247",
      ctaText: cfg.ctaText || "Chat with us",
      marginBottom: cfg.marginBottom || 30,
      marginLeft: cfg.marginLeft || 30,
      marginRight: cfg.marginRight || 30,
      borderRadius: cfg.borderRadius || 24,
      prefillMsg: cfg.prefillMsg || "Hi",
      position: cfg.position || "Bottom-Right",
      
      brandName: cfg.brandName || org.whatsappBusinessName || "AiSensy",
      brandSubtitle: cfg.brandSubtitle || "online",
      brandColor: cfg.brandColor || "#0A5F54",
      brandImageUrl: cfg.brandImageUrl || "",
      widgetCtaText: cfg.widgetCtaText || "Start chat",
      onScreenMsg: cfg.onScreenMsg || "Hi,\nHow can I help you?",
      
      openOnMobile: cfg.openOnMobile || "Yes",
      openByDefault: cfg.openByDefault || "Yes",
      reopenByDefault: cfg.reopenByDefault || "Always",

      urlPersonalizationEnabled: cfg.urlPersonalizationEnabled || false,
      urlRules: cfg.urlRules || [],
      
      automationType: cfg.automationType || "none",
    })

    // Allow embedding from any domain
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.headers.set("Cache-Control", "public, max-age=10")
    return response
  } catch (e) {
    console.error("[wa-widget/[widgetId]]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  return response
}
