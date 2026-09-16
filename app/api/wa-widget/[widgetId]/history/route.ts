import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function setCorsHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*")
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  return res
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 })
  return setCorsHeaders(res)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  try {
    const { widgetId } = await params
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      const errRes = NextResponse.json({ error: "sessionId is required" }, { status: 400 })
      return setCorsHeaders(errRes)
    }

    const org = await prisma.organization.findFirst({
      where: { OR: [{ slug: widgetId }, { id: widgetId }] },
      select: { id: true, status: true }
    })

    if (!org || org.status !== "active") {
      const errRes = NextResponse.json({ error: "Widget not found" }, { status: 404 })
      return setCorsHeaders(errRes)
    }

    const waId = `web_${sessionId}`
    const contact = await prisma.contact.findUnique({
      where: {
        organizationId_platform_waId: {
          organizationId: org.id,
          platform: "WHATSAPP",
          waId,
        }
      },
      select: { id: true }
    })

    if (!contact) {
      const res = NextResponse.json({ messages: [] })
      return setCorsHeaders(res)
    }

    const messages = await prisma.message.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        type: true,
        direction: true,
        content: true,
        mediaUrl: true,
        rawBody: true,
        createdAt: true,
      }
    })

    const formattedMessages = messages.map(m => {
      const raw = (m.rawBody as Record<string, any>) || {}
      return {
        id: m.id,
        direction: m.direction,
        type: m.type,
        content: m.content,
        mediaUrl: m.mediaUrl || raw.mediaUrl || null,
        fileName: raw.fileName || null,
        interactiveData: raw.interactiveData || null,
        createdAt: m.createdAt,
      }
    })

    const res = NextResponse.json({ messages: formattedMessages })
    return setCorsHeaders(res)
  } catch (error: any) {
    console.error("[wa-widget history error]", error)
    const errRes = NextResponse.json({ error: "Server error" }, { status: 500 })
    return setCorsHeaders(errRes)
  }
}
