import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getPusherServer } from "@/lib/pusher";
import { sendUnifiedMessage } from "@/lib/messaging/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AiRoutingEvaluationResult {
  matched: boolean;
  rule?: {
    id: string;
    name: string;
    topic: string;
    keywords: string[];
    agentId: string;
    transferMessage: string;
    isActive: boolean;
  } | null;
  assignedAgent?: {
    id: string;
    name: string | null;
    email: string;
    role?: string;
    department?: { id: string; name: string } | null;
  } | null;
  matchType?: "keyword" | "ai_intent" | null;
  reasoning?: string;
  transferMessageSent?: boolean;
}

/**
 * Notify Pusher for real-time live-chat inbox update when conversation is routed
 */
async function notifyRoutingPusher(params: {
  organizationId: string;
  contactId: string;
  newAgentId: string;
  previousAgentId: string | null;
  assignedByName?: string;
}) {
  try {
    const systemConfig = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        pusherAppId: true,
        pusherKey: true,
        pusherSecret: true,
        pusherCluster: true,
      },
    });

    if (
      systemConfig?.pusherAppId &&
      systemConfig?.pusherKey &&
      systemConfig?.pusherSecret &&
      systemConfig?.pusherCluster
    ) {
      const pusher = getPusherServer({
        appId: systemConfig.pusherAppId,
        key: systemConfig.pusherKey,
        secret: systemConfig.pusherSecret,
        cluster: systemConfig.pusherCluster,
      });

      const payload = {
        contactId: params.contactId,
        newAgentId: params.newAgentId,
        previousAgentId: params.previousAgentId,
        assignmentType: "ai_routing",
        assignedByName: params.assignedByName || "AI Routing",
        timestamp: new Date().toISOString(),
      };

      // Notify organization channel (live chat view)
      await pusher.trigger(`org-${params.organizationId}`, "chat-assignment-updated", payload);

      // Notify assigned agent's personal channel
      await pusher.trigger(`user-${params.newAgentId}`, "chat-assigned", payload);

      if (params.previousAgentId && params.previousAgentId !== params.newAgentId) {
        await pusher.trigger(`user-${params.previousAgentId}`, "chat-unassigned", payload);
      }
    }
  } catch (error) {
    logger.flow.warn(`[AIRoutingEngine] Pusher notification failed: ${String(error)}`);
  }
}

/**
 * Evaluates an incoming message against an organization's active AI Routing Rules.
 * If a rule matches and contactId is provided, automatically assigns the agent,
 * sends the transfer message, disables AI bot for this contact, and notifies Pusher.
 */
export async function evaluateAiRouting(params: {
  organizationId: string;
  messageText: string;
  contactId?: string;
  contact?: any;
  simulateOnly?: boolean;
}): Promise<AiRoutingEvaluationResult> {
  const { organizationId, messageText, contactId, contact, simulateOnly } = params;

  if (!messageText || !messageText.trim()) {
    return { matched: false };
  }

  const cleanText = messageText.trim();
  const lowerText = cleanText.toLowerCase();

  try {
    // 1. Fetch active routing rules ordered by priority
    const rules = await (prisma as any).aiRoutingRule.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!rules || rules.length === 0) {
      return { matched: false };
    }

    // 2. Direct Keyword & Topic Term matching pass (Fast high-confidence match)
    for (const rule of rules) {
      // Check configured keywords
      const allTriggers: string[] = [];
      if (rule.keywords && Array.isArray(rule.keywords)) {
        allTriggers.push(...rule.keywords);
      }
      
      // Also extract significant topic tokens (words with >= 4 characters)
      if (rule.topic) {
        const topicWords = rule.topic
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w: string) => w.length >= 4 && !["about", "inquiries", "questions", "customer", "their", "where", "which", "would", "could", "should"].includes(w));
        allTriggers.push(...topicWords);
      }

      for (const rawKw of allTriggers) {
        const kw = String(rawKw).trim().toLowerCase();
        if (!kw) continue;

        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (regex.test(lowerText) || lowerText.includes(kw)) {
          logger.flow.info(
            `[AIRoutingEngine] Direct match! Rule "${rule.name}" triggered by trigger term "${kw}" for agent "${rule.agent?.name || rule.agent?.email}"`
          );

          return await handleMatchedRule({
            rule,
            organizationId,
            contactId,
            contact,
            matchType: "keyword",
            reasoning: `Customer message matched topic/keyword term "${kw}" in rule "${rule.name}"`,
            simulateOnly: !!simulateOnly,
          });
        }
      }
    }

    // 3. AI Semantic Intent Classification pass
    // Use LLM to analyze customer intent against all rules
    const rulesSummary = rules
      .map(
        (r: any, idx: number) =>
          `[Rule ${idx + 1}]\nRule ID: ${r.id}\nRule Name: ${r.name}\nTopic/Intent: ${r.topic}\nKeywords: ${r.keywords?.join(", ") || "None"}\nAssigned Agent: ${r.agent?.name || r.agent?.email || "Agent"}`
      )
      .join("\n\n");

    const prompt = `You are an AI Routing specialist for an automated customer engagement platform.
Your task is to analyze the customer's message and determine if it matches any of the business routing rules below.

Routing Rules:
${rulesSummary}

Customer Message:
"${cleanText}"

Instructions:
1. Understand the true intent of the customer (e.g., inquiry about pricing, buying, product details, support, account, technical problem, complaint, etc.).
2. If the customer's intent clearly aligns with one of the routing rules' Topic/Intent, respond with JSON:
{"match": true, "ruleId": "<EXACT_RULE_ID>", "reasoning": "<1 sentence explanation of why the intent matched>"}
3. If the message does NOT clearly match any rule (e.g. general greeting like "hi", "hello", or off-topic question), respond with JSON:
{"match": false, "ruleId": null, "reasoning": "No matching routing rule found."}
4. Output ONLY valid JSON, nothing else.`;

    let aiResultText = "";
    
    // Resolve AI keys from Environment, Organization, or SystemConfig
    let geminiKey = process.env.GEMINI_API_KEY || "";
    let openaiKey = process.env.OPENAI_API_KEY || "";

    const [org, sysConfig] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { aiApiKeys: true, aiProviderApiKey: true, aiProvider: true },
      }),
      prisma.systemConfig.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { aiProviderApiKey: true, aiProvider: true },
      }),
    ]);

    const orgKeys = (org?.aiApiKeys && typeof org.aiApiKeys === "object") ? (org.aiApiKeys as Record<string, string>) : {};
    
    if (!geminiKey) {
      geminiKey = orgKeys["gemini"] || (org?.aiProvider === "gemini" ? org?.aiProviderApiKey : null) || (sysConfig?.aiProvider === "gemini" ? sysConfig?.aiProviderApiKey : null) || "";
    }
    if (!openaiKey) {
      openaiKey = orgKeys["openai"] || (org?.aiProvider === "openai" ? org?.aiProviderApiKey : null) || (sysConfig?.aiProvider === "openai" ? sysConfig?.aiProviderApiKey : null) || "";
    }

    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        });
        const resp = await model.generateContent(prompt);
        aiResultText = resp.response.text();
      } catch (geminiErr: any) {
        logger.flow.warn(`[AIRoutingEngine] Gemini classification error: ${geminiErr.message}`);
      }
    }

    // Fallback to OpenAI if Gemini was not available or failed
    if (!aiResultText && openaiKey) {
      try {
        const { getAIResponse } = await import("@/lib/ai/openai");
        aiResultText =
          (await getAIResponse(prompt, {
            organizationId,
            systemPrompt: "You are an AI intent classifier. Output ONLY valid JSON.",
          })) || "";
      } catch (openAiErr: any) {
        logger.flow.warn(`[AIRoutingEngine] OpenAI classification error: ${openAiErr.message}`);
      }
    }

    if (aiResultText) {
      try {
        const cleanedJson = aiResultText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed.match && parsed.ruleId) {
          const matchedRule = rules.find((r: any) => r.id === parsed.ruleId);
          if (matchedRule) {
            logger.flow.info(
              `[AIRoutingEngine] AI Semantic Match! Rule "${matchedRule.name}" matched for agent "${matchedRule.agent?.name || matchedRule.agent?.email}". Reasoning: ${parsed.reasoning}`
            );

            return await handleMatchedRule({
              rule: matchedRule,
              organizationId,
              contactId,
              contact,
              matchType: "ai_intent",
              reasoning: parsed.reasoning || `AI detected intent matching rule "${matchedRule.name}"`,
              simulateOnly: !!simulateOnly,
            });
          }
        }
      } catch (parseErr: any) {
        logger.flow.warn(`[AIRoutingEngine] Failed to parse AI intent JSON: ${parseErr.message}`);
      }
    }

    // No rule matched -> keep conversation with AI
    logger.flow.info(`[AIRoutingEngine] No routing rule matched for message: "${cleanText}". Keeping with AI.`);
    return {
      matched: false,
      reasoning: "No routing rule matched the customer's intent. Conversation stays with AI.",
    };
  } catch (err: any) {
    logger.flow.error(`[AIRoutingEngine] Error in evaluateAiRouting: ${err.message}`);
    return { matched: false, reasoning: `Error: ${err.message}` };
  }
}

/**
 * Internal helper to execute actions when a rule matches (update contact, send message, notify Pusher)
 */
async function handleMatchedRule(params: {
  rule: any;
  organizationId: string;
  contactId?: string;
  contact?: any;
  matchType: "keyword" | "ai_intent";
  reasoning: string;
  simulateOnly: boolean;
}): Promise<AiRoutingEvaluationResult> {
  const { rule, organizationId, contactId, contact, matchType, reasoning, simulateOnly } = params;

  let transferMessageSent = false;

  if (!simulateOnly && contactId) {
    const assignedAgentId = rule.agentId;
    const previousAgentId = contact?.assignedAgentId || null;

    try {
      // 1. Update Contact: Assign to human agent, turn off AI bot so human can take over
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          assignedAgentId,
          assignmentType: "ai_routing",
          assignedAt: new Date(),
          isAiBotEnabled: false,
          assignedUsers: {
            set: [{ id: assignedAgentId }],
          },
        },
      });

      // 2. Add to chatAssignmentHistory
      await prisma.chatAssignmentHistory.create({
        data: {
          organizationId,
          contactId,
          agentId: assignedAgentId,
          previousAgentId,
          assignmentType: "ai_routing",
        },
      });

      // 3. Send configurable transfer message to customer
      const transferMessage = rule.transferMessage || "We will connect you to our agent.";
      if (transferMessage.trim()) {
        await sendUnifiedMessage({
          contactId,
          message: transferMessage.trim(),
          skipWindowCheck: true,
        });
        transferMessageSent = true;
      }

      // 4. Notify Pusher in real-time
      await notifyRoutingPusher({
        organizationId,
        contactId,
        newAgentId: assignedAgentId,
        previousAgentId,
        assignedByName: `AI Routing: ${rule.name}`,
      });

      logger.flow.success(
        `[AIRoutingEngine] Successfully routed contact ${contactId} to agent ${rule.agent?.name || assignedAgentId}. Transfer message sent.`
      );
    } catch (assignErr: any) {
      logger.flow.error(`[AIRoutingEngine] Failed applying routing assignment: ${assignErr.message}`);
    }
  }

  return {
    matched: true,
    rule: {
      id: rule.id,
      name: rule.name,
      topic: rule.topic,
      keywords: rule.keywords || [],
      agentId: rule.agentId,
      transferMessage: rule.transferMessage,
      isActive: rule.isActive,
    },
    assignedAgent: rule.agent,
    matchType,
    reasoning,
    transferMessageSent,
  };
}
