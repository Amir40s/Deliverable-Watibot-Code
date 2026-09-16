import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerPusherOrgEvent } from "@/lib/pusher"
import { getAIResponseWithDetails } from "@/lib/ai/openai"
import { 
  startFlow, 
  executeFlowFromNode, 
  findMatchingInteractionInNodes, 
  pruneInvalidatedBranchVariables,
  FlowContext 
} from "@/lib/flows/engine"

function setCorsHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*")
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  return res
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 })
  return setCorsHeaders(res)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  try {
    const { widgetId } = await params
    const body = await req.json().catch(() => ({}))
    const { sessionId, message, buttonId, mediaUrl, mediaType, fileName } = body

    if (!sessionId || typeof sessionId !== "string") {
      const errRes = NextResponse.json({ error: "Invalid or missing sessionId" }, { status: 400 })
      return setCorsHeaders(errRes)
    }

    const trimmedMsg = typeof message === "string" ? message.trim() : ""
    if (!trimmedMsg && !buttonId && !mediaUrl) {
      const errRes = NextResponse.json({ error: "Message, media, or buttonId is required" }, { status: 400 })
      return setCorsHeaders(errRes)
    }

    // Limit message length to 2000 characters for abuse prevention
    const safeMsg = trimmedMsg.slice(0, 2000)

    // 1. Identify Widget & Organization
    const org = await prisma.organization.findFirst({
      where: { OR: [{ slug: widgetId }, { id: widgetId }] },
      select: {
        id: true,
        slug: true,
        status: true,
        widgetConfig: true,
        whatsappBusinessName: true,
      }
    })

    if (!org) {
      const errRes = NextResponse.json({ error: "Widget not found" }, { status: 404 })
      return setCorsHeaders(errRes)
    }

    if (org.status !== "active") {
      const errRes = NextResponse.json({ error: "Widget is disabled or inactive" }, { status: 403 })
      return setCorsHeaders(errRes)
    }

    const cfg = (org.widgetConfig as Record<string, any>) || {}
    const automationType = cfg.automationType || "none"

    if (automationType === "none") {
      const errRes = NextResponse.json({ 
        error: "Widget automation is set to None. Please use standard WhatsApp Click-to-Chat." 
      }, { status: 400 })
      return setCorsHeaders(errRes)
    }

    // 2. Ensure "Website" Tag exists
    let websiteTag = await prisma.tag.findFirst({
      where: { organizationId: org.id, name: "Website" }
    })
    if (!websiteTag) {
      websiteTag = await prisma.tag.create({
        data: {
          organizationId: org.id,
          name: "Website",
          color: "#0284c7",
          category: "Channel"
        }
      })
    }

    // 3. Find or Create Contact in CRM
    const waId = `web_${sessionId}`
    let contact = await prisma.contact.findUnique({
      where: {
        organizationId_platform_waId: {
          organizationId: org.id,
          platform: "WHATSAPP",
          waId,
        }
      },
      include: { organization: true, tags: true }
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId: org.id,
          platform: "WHATSAPP",
          waId,
          name: `Visitor #${sessionId.slice(-5)}`,
          customAttributes: {
            channel: "website_widget",
            source: "Website Widget",
            widgetId,
            sessionId,
            widgetName: cfg.brandName || org.whatsappBusinessName || "Website Widget"
          },
          isAiBotEnabled: true,
          tags: {
            connect: { id: websiteTag.id }
          },
          ...(automationType === "ai_agent" && cfg.agentId ? { aiAgentId: cfg.agentId } : {})
        },
        include: { organization: true, tags: true }
      })
    } else {
      // Ensure "Website" tag is connected if somehow missing
      if (!contact.tags.some(t => t.id === websiteTag!.id)) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { tags: { connect: { id: websiteTag!.id } } }
        })
      }
      // Update agent assignment if changed
      if (automationType === "ai_agent" && cfg.agentId && contact.aiAgentId !== cfg.agentId) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { aiAgentId: cfg.agentId }
        })
      }
    }

    // Determine message type
    let inboundType = "text"
    if (buttonId) {
      inboundType = "interactive"
    } else if (mediaType) {
      inboundType = mediaType
    } else if (mediaUrl) {
      const lower = mediaUrl.toLowerCase()
      if (lower.match(/\.(mp3|ogg|wav|m4a|aac|opus)($|\?)/)) inboundType = "audio"
      else if (lower.match(/\.(mp4|webm|mkv|mov|3gp)($|\?)/)) inboundType = "video"
      else if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/)) inboundType = "image"
      else inboundType = "document"
    }

    const isVoice = inboundType === "audio" || inboundType === "voice"

    // 4. Save Inbound Visitor Message
    let inboundDisplayContent = safeMsg
    if (!inboundDisplayContent) {
      if (isVoice) inboundDisplayContent = "🎤 Voice message"
      else if (inboundType === "video") inboundDisplayContent = "📹 Video"
      else if (inboundType === "image") inboundDisplayContent = "📷 Photo"
      else if (inboundType === "document") inboundDisplayContent = fileName ? `📄 ${fileName}` : "📄 Document"
      else if (buttonId) inboundDisplayContent = `[Selected: ${buttonId}]`
    }

    const inboundMessage = await prisma.message.create({
      data: {
        contactId: contact.id,
        type: inboundType,
        direction: "inbound",
        status: "delivered",
        content: inboundDisplayContent,
        mediaUrl: mediaUrl || null,
        rawBody: {
          buttonId: buttonId || null,
          channel: "website_widget",
          sessionId,
          widgetId,
          mediaUrl: mediaUrl || null,
          mediaType: inboundType,
          fileName: fileName || null,
          voice: isVoice,
          isVoice: isVoice,
          audio: isVoice ? { voice: true } : undefined,
        } as any,
      }
    })

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastMessage: inboundDisplayContent,
        lastMessageAt: new Date(),
        lastInboundMessageAt: new Date()
      }
    })

    // Broadcast real-time incoming message event to CRM Live Chat
    try {
      await triggerPusherOrgEvent(org.id, "new-message", inboundMessage)
      await triggerPusherOrgEvent(org.id, "message:inbound", inboundMessage)
    } catch (e) {
      console.warn("[wa-widget message] Pusher inbound broadcast failed:", e)
    }

    // 5. Route by Automation Type
    if (automationType === "ai_agent") {
      const agentId = cfg.agentId
      if (!agentId) {
        const reply = "Support agent is not properly configured. Please contact the administrator."
        const outMsg = await prisma.message.create({
          data: {
            contactId: contact.id,
            type: "text",
            direction: "outbound",
            status: "sent",
            content: reply,
            rawBody: { channel: "website_widget" } as any,
          }
        })
        await triggerPusherOrgEvent(org.id, "new-message", outMsg)
        const res = NextResponse.json({ success: true, messages: [{ id: outMsg.id, type: "text", content: reply }] })
        return setCorsHeaders(res)
      }

      // Fetch recent message history
      const recentMessages = await prisma.message.findMany({
        where: { contactId: contact.id },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { direction: true, content: true }
      })

      const history = recentMessages.reverse().map(m => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.content || ""
      }))

      // Execute AI Agent
      const aiStartTime = Date.now()
      const promptForAI = safeMsg || (isVoice ? "[Customer sent a voice note]" : `[Customer sent a ${inboundType}: ${mediaUrl || "attachment"}]`)
      const aiDetails = await getAIResponseWithDetails(promptForAI, {
        organizationId: org.id,
        contactId: contact.id,
        aiAgentId: agentId,
        history,
      })

      const rawOutput = aiDetails?.rawAiOutput || aiDetails?.text || ""
      let replyText = aiDetails?.text || "Thank you for reaching out. We will get back to you shortly."
      let mediaItems: Array<{ type: string; url: string; caption?: string }> = []

      if (rawOutput) {
        try {
          const { processAIJsonResponse } = await import("@/lib/ai/lead-saver")
          const processedAI = await processAIJsonResponse({
            rawAiResponse: rawOutput,
            organizationId: org.id,
            contactId: contact.id,
            fallbackPhone: contact.waId,
            userPrompt: safeMsg,
            aiAgentId: aiDetails?.agentId || agentId,
            aiAgentName: aiDetails?.agentName,
            provider: aiDetails?.provider,
            model: aiDetails?.model,
            systemPromptUsed: aiDetails?.systemPrompt,
            retrievedChunks: aiDetails?.retrievedChunks || [],
            durationMs: aiDetails?.durationMs || (Date.now() - aiStartTime),
          })
          if (processedAI.textMessage) {
            replyText = processedAI.textMessage
          }
          if (processedAI.media && processedAI.media.length > 0) {
            mediaItems = processedAI.media
          }
        } catch (err) {
          console.warn("[wa-widget message] processAIJsonResponse error, fallback parsing:", err)
          try {
            const firstBrace = rawOutput.indexOf("{")
            const lastBrace = rawOutput.lastIndexOf("}")
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              const parsed = JSON.parse(rawOutput.substring(firstBrace, lastBrace + 1))
              if (parsed.reply || parsed.message || parsed.response) {
                replyText = parsed.reply || parsed.message || parsed.response
              }
            }
          } catch {}
        }
      }

      // Save outbound AI message in CRM
      // Configurable AI Agent Response Delay
      const widgetAgentDelay = typeof (aiDetails as any)?.delaySeconds === "number" ? (aiDetails as any).delaySeconds : 0;
      if (widgetAgentDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(widgetAgentDelay, 120) * 1000));
      }

      const outboundMessage = await prisma.message.create({
        data: {
          contactId: contact.id,
          type: "text",
          direction: "outbound",
          status: "sent",
          content: replyText,
          rawBody: {
            channel: "website_widget",
            aiDetails: aiDetails ? {
              model: aiDetails.model,
              provider: aiDetails.provider,
              agentName: aiDetails.agentName,
              durationMs: aiDetails.durationMs
            } : null
          } as any,
        }
      })

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastMessage: replyText,
          lastMessageAt: new Date()
        }
      })

      try {
        await triggerPusherOrgEvent(org.id, "new-message", outboundMessage)
      } catch (e) {
        console.warn("[wa-widget message] Pusher outbound AI broadcast failed:", e)
      }

      const returnMessages: any[] = [
        {
          id: outboundMessage.id,
          type: "text",
          content: replyText,
          createdAt: outboundMessage.createdAt
        }
      ]

      if (mediaItems.length > 0) {
        for (const m of mediaItems) {
          if (!m.url) continue
          const mediaMsg = await prisma.message.create({
            data: {
              contactId: contact.id,
              type: m.type || "image",
              direction: "outbound",
              status: "sent",
              content: m.caption || "",
              mediaUrl: m.url,
              rawBody: {
                channel: "website_widget",
                mediaUrl: m.url,
                contentType: m.type || "image",
                aiDetails: aiDetails ? {
                  model: aiDetails.model,
                  provider: aiDetails.provider,
                  agentName: aiDetails.agentName,
                  durationMs: aiDetails.durationMs
                } : null
              } as any,
            }
          })

          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              lastMessage: m.caption || `[${(m.type || 'image').toUpperCase()}]`,
              lastMessageAt: new Date()
            }
          })

          try {
            await triggerPusherOrgEvent(org.id, "new-message", mediaMsg)
          } catch (e) {
            console.warn("[wa-widget message] Pusher outbound AI media broadcast failed:", e)
          }

          returnMessages.push({
            id: mediaMsg.id,
            type: mediaMsg.type,
            content: mediaMsg.content || "",
            mediaUrl: mediaMsg.mediaUrl,
            createdAt: mediaMsg.createdAt
          })
        }
      }

      const res = NextResponse.json({
        success: true,
        messages: returnMessages
      })
      return setCorsHeaders(res)
    }

    if (automationType === "flow") {
      const flowId = cfg.flowId
      if (!flowId) {
        const reply = "Flow automation is not configured. Please contact the administrator."
        const outMsg = await prisma.message.create({
          data: {
            contactId: contact.id,
            type: "text",
            direction: "outbound",
            status: "sent",
            content: reply,
            rawBody: { channel: "website_widget" } as any,
          }
        })
        await triggerPusherOrgEvent(org.id, "new-message", outMsg)
        const res = NextResponse.json({ success: true, messages: [{ id: outMsg.id, type: "text", content: reply }] })
        return setCorsHeaders(res)
      }

      const flow = await prisma.flow.findFirst({
        where: { id: flowId, organizationId: org.id }
      })

      if (!flow || !flow.isActive) {
        const reply = "The requested flow is currently inactive or unavailable."
        const outMsg = await prisma.message.create({
          data: {
            contactId: contact.id,
            type: "text",
            direction: "outbound",
            status: "sent",
            content: reply,
            rawBody: { channel: "website_widget" } as any,
          }
        })
        await triggerPusherOrgEvent(org.id, "new-message", outMsg)
        const res = NextResponse.json({ success: true, messages: [{ id: outMsg.id, type: "text", content: reply }] })
        return setCorsHeaders(res)
      }

      const collector: any[] = []
      const metadata = {
        channel: "website_widget",
        collector
      }

      const nodes = (flow.nodes as any[]) || []
      const edges = (flow.edges as any[]) || []

      // Check for paused flow execution
      const pausedExecution = await prisma.flowExecution.findFirst({
        where: {
          contactId: contact.id,
          flowId: flow.id,
          status: "paused",
        },
        orderBy: { startedAt: "desc" }
      })

      if (pausedExecution) {
        let flowContext: FlowContext = (pausedExecution.context as any) || { variables: {} }
        if (!flowContext.variables) flowContext.variables = {}
        flowContext.contactId = contact.id
        flowContext.organizationId = org.id
        flowContext.contact = contact
        flowContext.metadata = metadata

        const matchedInteraction = findMatchingInteractionInNodes(nodes, buttonId, safeMsg)

        if (matchedInteraction) {
          flowContext.variables = pruneInvalidatedBranchVariables(
            matchedInteraction.node.id,
            matchedInteraction.sourceHandle,
            nodes,
            edges,
            flowContext.variables
          )

          const pausedNodeId = matchedInteraction.node.id
          const sourceHandle = matchedInteraction.sourceHandle

          await prisma.flowExecution.update({
            where: { id: pausedExecution.id },
            data: {
              status: "running",
              context: {
                ...flowContext,
                pausedNodeId
              } as any
            }
          })

          await executeFlowFromNode(
            flow.id,
            pausedNodeId,
            nodes,
            edges,
            { ...flowContext, text: safeMsg },
            pausedExecution.id,
            sourceHandle
          )
        } else {
          // Check if paused on input or question node
          const pausedNodeId = (pausedExecution.context as any)?.pausedNodeId
          const pausedNode = nodes.find(n => n.id === pausedNodeId)

          if (pausedNode && (
            pausedNode.type === "input" || 
            pausedNode.type === "askInput" || 
            pausedNode.type === "ask_question" || 
            pausedNode.type === "ask_address"
          )) {
            const varName = pausedNode.data?.variableName || pausedNode.data?.attribute || pausedNode.data?.variable
            if (varName) {
              flowContext.variables[varName] = safeMsg
            }

            await prisma.flowExecution.update({
              where: { id: pausedExecution.id },
              data: {
                status: "running",
                context: flowContext as any
              }
            })

            await executeFlowFromNode(
              flow.id,
              pausedNodeId,
              nodes,
              edges,
              { ...flowContext, text: safeMsg },
              pausedExecution.id
            )
          } else {
            // Unrecognized input on interactive node; restart flow or keep paused
            await startFlow(flow, contact.id, org.id, safeMsg, contact, "en", metadata)
          }
        }
      } else {
        // Start flow fresh
        await startFlow(flow, contact.id, org.id, safeMsg, contact, "en", metadata)
      }

      // If no messages collected (e.g. action nodes only), check if any new outbound messages were created
      if (collector.length === 0) {
        const fallbackMsg = await prisma.message.findFirst({
          where: {
            contactId: contact.id,
            direction: "outbound",
            createdAt: { gte: new Date(Date.now() - 5000) }
          },
          orderBy: { createdAt: "desc" }
        })
        if (fallbackMsg) {
          collector.push({
            id: fallbackMsg.id,
            type: fallbackMsg.type,
            content: fallbackMsg.content,
            createdAt: fallbackMsg.createdAt
          })
        }
      }

      const res = NextResponse.json({
        success: true,
        messages: collector
      })
      return setCorsHeaders(res)
    }

    const unhandledRes = NextResponse.json({ error: "Unsupported automation type" }, { status: 400 })
    return setCorsHeaders(unhandledRes)

  } catch (error: any) {
    console.error("[wa-widget message error]", error)
    const errRes = NextResponse.json({ error: "An error occurred while processing your message." }, { status: 500 })
    return setCorsHeaders(errRes)
  }
}
