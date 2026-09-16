import { prisma } from "@/lib/prisma";
import { sendUnifiedMessage } from "@/lib/messaging/api";
import { logger } from "@/lib/logger";
import { processWelcomeMessages } from "@/lib/welcome-messages/engine";
import { addTagToShopifyOrder } from "@/lib/shopify/api";
import { handleActiveShopifyConversationState, initiateShopifyAutomationWorkflow } from "@/lib/flows/shopifyAutomationFlows";
import { createHash } from "crypto";
import { resolveContactVariables } from "@/lib/messaging/contactVariables";

const log = (msg: string) => logger.flow.info(msg);
const META_GRAPH_API_VERSION = "v21.0";

/**
 * Helper to send messages with automatic translation based on context language.
 * Handles text messages and interactive elements (buttons, lists).
 */
async function sendTranslatedMessage(params: any, context: FlowContext) {
  const targetLang = context.language;
  
  // Handle Meta Private Replies: Pass commentId if present, then clear it so it's only used once
  const privateReplyCommentId = context.metadata?.commentId;
  if (privateReplyCommentId) {
    params.commentId = privateReplyCommentId;
  }

  // Pass metadata and contact so website_widget collector, channel and context are preserved
  params.metadata = context.metadata;
  if (context.contact) {
    params.existingContact = context.contact;
  }
  if (context.metadata?.channel) {
    params.channel = context.metadata.channel;
  }

  // Automatic flow message translation is disabled.
  // The user explicitly requested to keep flow messages in the exact language configured in the flow.
  // Only the AI module dynamically responds in the user's language.
  const result = await sendUnifiedMessage(params);

  if (privateReplyCommentId) {
    // Clear it from context so subsequent messages in the same flow use regular PSID/IGSID.
    delete context.metadata.commentId;
  }

  return result;
}

export interface FlowContext {
  contactId: string;
  organizationId: string;
  msgId?: string;
  text?: string;
  translatedText?: string;
  language?: string;  
  variables: Record<string, any>;
  contact?: any;
  metadata?: any;
}

export function findMatchingInteractionInNodes(
  nodes: any[],
  buttonId?: string,
  messageText?: string,
  translatedText?: string,
  pausedNodeId?: string
): { node: any; sourceHandle: string; interaction?: any } | null {
  if (!nodes || !Array.isArray(nodes)) return null;

  const rawButtonId = buttonId ? buttonId.split("::")[0].trim() : undefined;
  const effLower = messageText ? messageText.toLowerCase().trim() : "";
  const transLower = translatedText ? translatedText.toLowerCase().trim() : "";

  // Extract numeric choice if user replied with e.g. "1", "2", "#1", "1.", "1️⃣", etc.
  let numericIndex: number | null = null;
  const numEmojiMap: Record<string, number> = {
    '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5,
    '6️⃣': 6, '7️⃣': 7, '8️⃣': 8, '9️⃣': 9, '🔟': 10
  };
  if (effLower in numEmojiMap) {
    numericIndex = numEmojiMap[effLower];
  } else {
    const numMatch = effLower.match(/^(?:#|no\.?|num\.?)?\s*(\d{1,2})\.?$/i);
    if (numMatch) {
      numericIndex = parseInt(numMatch[1], 10);
    }
  }

  // Sort nodes so the paused node comes first if specified
  const sortedNodes = pausedNodeId
    ? [...nodes].sort((a, b) => (a.id === pausedNodeId ? -1 : b.id === pausedNodeId ? 1 : 0))
    : nodes;

  for (const node of sortedNodes) {
    const isInteractive =
      node.type === "message" ||
      node.type === "media" ||
      node.type === "list" ||
      node.type === "single_product" ||
      node.type === "multi_product" ||
      node.type === "catalogue" ||
      node.type === "carousel" ||
      node.type === "template" ||
      node.type === "quick_reply";

    if (!isInteractive) continue;

    const buttons = node.data?.buttons || [];
    const cardButtons = (node.data?.cards || []).flatMap((c: any) => c.buttons || []);
    const sections = node.data?.sections || [];
    const listItems = sections.flatMap((s: any) => s.rows || s.items || []);
    const sectionHandles = sections.map((s: any) => ({ id: s.id, title: s.title }));
    const allInteractions = [...buttons, ...cardButtons, ...listItems, ...sectionHandles];

    // 1. Direct Button ID match
    if (rawButtonId) {
      if (rawButtonId.startsWith("url_")) {
        const url = rawButtonId.replace("url_", "");
        const matchingButton = buttons.find((b: any) => b.url === url);
        if (matchingButton) {
          return { node, sourceHandle: matchingButton.id, interaction: matchingButton };
        }
      }

      const matchingInteraction = allInteractions.find(
        (i: any) =>
          i &&
          ((i.id && String(i.id).trim().toLowerCase() === rawButtonId.toLowerCase()) ||
            (i.payload && String(i.payload).trim().toLowerCase() === rawButtonId.toLowerCase()) ||
            (i.text && String(i.text).trim().toLowerCase() === rawButtonId.toLowerCase()) ||
            (i.title && String(i.title).trim().toLowerCase() === rawButtonId.toLowerCase()))
      );
      if (matchingInteraction) {
        return {
          node,
          sourceHandle: matchingInteraction.id || rawButtonId,
          interaction: matchingInteraction,
        };
      }
    }

    // 2. Numeric Choice match (e.g. user typed "1", "2", etc.)
    if (numericIndex !== null && numericIndex > 0) {
      const interactionList = [...buttons, ...cardButtons, ...listItems];
      const targetIdx = numericIndex - 1;
      if (targetIdx >= 0 && targetIdx < interactionList.length) {
        const selected = interactionList[targetIdx];
        if (selected) {
          return {
            node,
            sourceHandle: selected.id || (selected as any).title || String(numericIndex),
            interaction: selected,
          };
        }
      }
    }

    // 3. Exact or Normalized Text match
    if (effLower) {
      const matchingButton = [...buttons, ...cardButtons].find(
        (b: any) =>
          (b.text && b.text.toLowerCase().trim() === effLower) ||
          (transLower && b.text && b.text.toLowerCase().trim() === transLower) ||
          (b.id && String(b.id).toLowerCase().trim() === effLower)
      );

      const matchingListItem = listItems.find(
        (i: any) =>
          (i.title && i.title.toLowerCase().trim() === effLower) ||
          (transLower && i.title && i.title.toLowerCase().trim() === transLower) ||
          (i.id && String(i.id).toLowerCase().trim() === effLower)
      );

      if (matchingButton) {
        return { node, sourceHandle: matchingButton.id, interaction: matchingButton };
      }
      if (matchingListItem) {
        return {
          node,
          sourceHandle: matchingListItem.id || matchingListItem.title || messageText,
          interaction: matchingListItem,
        };
      }
    }
  }

  return null;
}

/**
 * Traverses edges to collect all downstream node IDs from a start node.
 * If onlySourceHandle is provided, it only follows edges originating from that specific handle.
 */
export function getDownstreamNodeIds(
  startNodeId: string,
  edges: any[],
  onlySourceHandle?: string,
  visited = new Set<string>()
): Set<string> {
  const downstream = new Set<string>();
  const queue: string[] = [];

  const initialEdges = edges.filter(
    (e) =>
      e.source === startNodeId &&
      (!onlySourceHandle ||
        !e.sourceHandle ||
        String(e.sourceHandle).trim().toLowerCase() === String(onlySourceHandle).trim().toLowerCase())
  );

  for (const edge of initialEdges) {
    if (edge.target && !visited.has(edge.target)) {
      queue.push(edge.target);
      downstream.add(edge.target);
      visited.add(edge.target);
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const nextEdges = edges.filter((e) => e.source === curr);
    for (const edge of nextEdges) {
      if (edge.target && !visited.has(edge.target)) {
        queue.push(edge.target);
        downstream.add(edge.target);
        visited.add(edge.target);
      }
    }
  }

  return downstream;
}

/**
 * Invalidates and prunes stale variables that belonged to discarded branches
 * when a user navigates back and chooses a different option/branch.
 */
export function pruneInvalidatedBranchVariables(
  startNodeId: string,
  newSourceHandle: string,
  nodes: any[],
  edges: any[],
  currentVariables: Record<string, any>
): Record<string, any> {
  if (!currentVariables || typeof currentVariables !== "object") {
    return {};
  }

  const updatedVariables = { ...currentVariables };
  const allOutgoingEdges = edges.filter((e) => e.source === startNodeId);

  // Identify all other handles from this node
  const cleanNewHandle = String(newSourceHandle || "").trim().toLowerCase();
  const otherHandles = allOutgoingEdges
    .filter(
      (e) =>
        e.sourceHandle &&
        String(e.sourceHandle).trim().toLowerCase() !== cleanNewHandle
    )
    .map((e) => e.sourceHandle);

  // Nodes reachable via the newly chosen handle
  const newPathNodeIds = getDownstreamNodeIds(startNodeId, edges, newSourceHandle);

  // Nodes reachable only through the discarded handles
  const discardedNodeIds = new Set<string>();
  for (const handle of otherHandles) {
    const reachable = getDownstreamNodeIds(startNodeId, edges, handle);
    for (const nodeId of reachable) {
      if (!newPathNodeIds.has(nodeId)) {
        discardedNodeIds.add(nodeId);
      }
    }
  }

  // Clear variables tied to any discarded node
  for (const nodeId of discardedNodeIds) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const varKeys = [
      node.data?.variableName,
      node.data?.attribute,
      node.data?.variable,
      node.data?.latitudeAttribute,
      node.data?.longitudeAttribute,
      node.data?.key,
      node.data?.field,
    ].filter(Boolean);

    for (const key of varKeys) {
      delete updatedVariables[key];
    }
  }

  return updatedVariables;
}

export async function processIncomingMessage(
  organizationId: string,
  contactId: string,
  messageText: string,
  contact?: any,
  buttonId?: string,
  metadata?: any,
) {
  try {
    logger.flow.separator();
    logger.flow.info(
      `[FlowEngine] Processing message for contact ${contactId} in org ${organizationId}`,
    );

    // Fetch organization and contact settings for AI Bot
    const dbContact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { 
        name: true,
        waId: true,
        platform: true,
        aiAgentId: true,
        isAiBotEnabled: true,
        lastInboundMessageAt: true,
        organization: {
          select: { isAiBotEnabled: true, aiVoiceResponseEnabled: true, agentRoutingMode: true, aiProvider: true, aiApiKeys: true, aiProviderApiKey: true }
        }
      }
    });

    if (dbContact) {
      const lastInboundTime = dbContact.lastInboundMessageAt
        ? new Date(dbContact.lastInboundMessageAt).getTime()
        : null;
      
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (!lastInboundTime || (now - lastInboundTime) >= twentyFourHours) {
        logger.flow.warn(`[FlowEngine] 24-hour window expired — flow skipped. Contact: ${contactId}, Last Inbound: ${lastInboundTime ? new Date(lastInboundTime).toISOString() : 'Never'}`);
        return;
      }
    }
    const isAiBotEnabledGlobal = dbContact?.organization?.isAiBotEnabled ?? false;
    const isAiBotEnabledContact = dbContact?.isAiBotEnabled ?? true;
    const isAiBotEnabled = isAiBotEnabledGlobal && isAiBotEnabledContact;

    if (!isAiBotEnabled) {
      logger.flow.info(
        `[FlowEngine] Bot/Automation (AI fallback) is disabled for contact ${contactId} in org ${organizationId}. Standard flows/triggers will still be processed.`,
      );
    }

    // Intercept active conversational state (Check Status, Check Price, Check Order)
    const activeStateHandled = await handleActiveShopifyConversationState(
      organizationId,
      contactId,
      messageText
    );
    if (activeStateHandled) {
      logger.flow.success(`[FlowEngine] Active Shopify Conversation State executed. Stopping further processing.`);
      return;
    }

    // 0. Check for Shopify Automation Button Clicks (Prioritize over flows)
    const shopifyHandled = await handleShopifyAutomationResponse(
      organizationId,
      contactId,
      messageText,
      buttonId,
    );
    if (shopifyHandled) {
      logger.flow.success(`[FlowEngine] Shopify Automation Task executed. Stopping further processing.`);
      return;
    }

    // 0. Check for WooCommerce Automation Button Clicks
    const woocommerceHandled = await handleWooCommerceAutomationResponse(
      organizationId,
      contactId,
      messageText,
      buttonId,
    );
    if (woocommerceHandled) {
      logger.flow.success(`[FlowEngine] WooCommerce Automation Task executed. Stopping further processing.`);
      return;
    }


    // 0. Detect Conversation Start / New Session
    // Check message history for the gap between the last two inbound messages
    logger.flow.info(`[FlowEngine] Checking message history...`);
    const lastTwoInbound = await prisma.message.findMany({
      where: {
        contactId: contactId,
        direction: "inbound",
      },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { createdAt: true },
    });
    logger.flow.info(
      `[FlowEngine] History check done. Found ${lastTwoInbound.length} messages.`,
    );

    // If it's the first message ever, or gap > 1 hour, it's a new session
    const oneHourMs = 60 * 60 * 1000;
    const isNewSession =
      lastTwoInbound.length < 2 ||
      lastTwoInbound[0].createdAt.getTime() -
        lastTwoInbound[1].createdAt.getTime() >
        oneHourMs;

    let moved = false;

    // 1. Find all active flows for this organization and platform
    const contactPlatform = contact?.platform || "WHATSAPP";
    const effectivePlatform = metadata?.platform || contactPlatform;
    logger.flow.info(
      `[FlowEngine] Fetching active flows for organization ${organizationId} and platform ${effectivePlatform}...`,
    );

    const activeFlows = await prisma.flow
      .findMany({
        where: {
          organizationId,
          isActive: true,
          platform: {
            in: [effectivePlatform, "ALL", "SHOPIFY"],
          },
        },
      })
      .catch((err) => {
        logger.flow.error(
          `[FlowEngine] Failed to fetch active flows: ${err.message}`,
        );
        return [];
      });
    logger.flow.info(
      `[FlowEngine] Found ${activeFlows.length} active flows for organization.`,
    );

    // 0. Parse incoming message and handle voice transcription for triggers
    let parsedInput: any = messageText;
    try {
      if (messageText.startsWith("{")) {
        parsedInput = JSON.parse(messageText);
      }
    } catch (e) {}

    let effectiveText = messageText;
    if (
      typeof parsedInput === "object" &&
      parsedInput.type === "media" &&
      parsedInput.mediaType === "audio" &&
      parsedInput.mediaId
    ) {
      // 1. Check for native Meta transcription first (Free & Instant)
      if (parsedInput.transcription?.text) {
        effectiveText = parsedInput.transcription.text;
        logger.flow.success(
          `[FlowEngine] Using native Meta voice transcription: "${effectiveText}"`,
        );
      } else {
        // 2. Transcribe with Gemini / OpenAI (or fallback to Wit.ai)
        try {
          logger.flow.info(
            `[FlowEngine] Detected voice trigger. Transcribing...`,
          );
          const { downloadWhatsAppMedia } = await import("@/lib/whatsapp/api");
          const { transcribeAudio } = await import("@/lib/ai/openai");

          const { buffer } = await downloadWhatsAppMedia(
            parsedInput.mediaId,
            organizationId,
          );

          const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { aiApiKeys: true, aiProvider: true, aiProviderApiKey: true }
          });

          const transcription = await transcribeAudio(buffer, {
            fileName: `${parsedInput.mediaId}.ogg`,
            mimeType: 'audio/ogg',
            apiKeys: (org?.aiApiKeys as Record<string, string>) || {},
            apiKey: org?.aiProviderApiKey || undefined,
            provider: (org?.aiProvider as any) || 'auto'
          }).catch(async () => {
            const { transcribeAudioWithWit } = await import("@/lib/ai/wit");
            return await transcribeAudioWithWit(buffer);
          });

          if (transcription) {
            effectiveText = transcription;
            logger.flow.success(
              `[FlowEngine] Voice trigger transcribed: "${effectiveText}"`,
            );
          }
        } catch (err: any) {
          logger.flow.error(
            `[FlowEngine] Voice trigger transcription failed: ${err.message}`,
          );
        }
      }
    }

    // Detect language for the session
    let currentLanguage = "en";
    let translatedText = effectiveText;

    if (effectiveText && effectiveText.length >= 3) {
      try {
        const { detectLanguage, translateText } =
          await import("@/lib/ai/openai");
        currentLanguage = await detectLanguage(effectiveText);

        logger.flow.info(`[FlowEngine] Detected language: ${currentLanguage}`);

        if (currentLanguage !== "en") {
          translatedText = await translateText(effectiveText, "en");
          logger.flow.info(
            `[FlowEngine] Translated input for matching: "${translatedText}"`,
          );
        }
      } catch (e: any) {
        logger.flow.error(
          `[FlowEngine] Language detection failed: ${e.message}`,
        );
      }
    }

    // 1.1 Check for paused flow executions for this contact (highest priority to handle button clicks and active sessions)
    const pausedExecution = await prisma.flowExecution.findFirst({
      where: {
        contactId,
        status: "paused",
        flow: { organizationId },
      },
      include: { flow: true },
      orderBy: { startedAt: "desc" },
    });

    const isButtonClick = !!buttonId;
    const forceRestartKeywords = ["cricket", "iftar"];
    const shouldResume =
      pausedExecution &&
      (isButtonClick ||
        !forceRestartKeywords.includes(effectiveText.toLowerCase().trim()));

    // 0.5 Handle New Modular Welcome Message System
    let welcomeTriggered = false;

    if (shouldResume && pausedExecution) {
      logger.flow.info(
        `[FlowEngine] Found paused execution for flow "${pausedExecution.flow.name}". Resuming...`,
      );

      // Single session rule: Mark all other paused executions as completed
      await prisma.flowExecution.updateMany({
        where: {
          contactId,
          status: "paused",
          id: { not: pausedExecution.id },
        },
        data: { status: "completed", endedAt: new Date() },
      });

      // Resume execution context
      let context: FlowContext = (pausedExecution.context as any) || { variables: {} };
      if (!context.variables) context.variables = {};

      // Update context language only if it's currently English or not set
      const isEnglishOrAuto =
        !context.language ||
        context.language === "en" ||
        context.language === "auto";
      if (
        isEnglishOrAuto &&
        currentLanguage &&
        currentLanguage !== "en" &&
        currentLanguage !== "auto"
      ) {
        context.language = currentLanguage;
      }

      const nodes = (pausedExecution.flow.nodes as any[]) || [];
      const edges = (pausedExecution.flow.edges as any[]) || [];

      // Check if the incoming message / buttonId matches ANY interactive node in the flow (e.g. Step 2, Step 3, etc.)
      const matchedInteraction = findMatchingInteractionInNodes(
        nodes,
        buttonId,
        effectiveText,
        translatedText,
        (pausedExecution.context as any)?.pausedNodeId
      );

      if (matchedInteraction) {
        logger.flow.info(
          `[FlowEngine] Dynamic branch selection matched node "${matchedInteraction.node.id}" (${matchedInteraction.node.type}) handle "${matchedInteraction.sourceHandle}" in flow "${pausedExecution.flow.name}".`
        );

        // Dynamically clear/invalidate downstream variables from discarded branches
        context.variables = pruneInvalidatedBranchVariables(
          matchedInteraction.node.id,
          matchedInteraction.sourceHandle,
          nodes,
          edges,
          context.variables
        );

        const pausedNodeId = matchedInteraction.node.id;
        const pausedNode = matchedInteraction.node;
        const sourceHandle = matchedInteraction.sourceHandle;
        const interaction = matchedInteraction.interaction;

        if (interaction) {
          try {
            await logExecutionStep(
              pausedExecution.id,
              pausedNode.id,
              pausedNode.type,
              "interaction",
              {
                buttonId: sourceHandle,
                text: interaction.text || interaction.title,
                type: pausedNode.type === "list" ? "list_item" : "button",
              },
            );

            if (
              interaction.tagIds &&
              Array.isArray(interaction.tagIds) &&
              interaction.tagIds.length > 0
            ) {
              logger.flow.info(
                `[FlowEngine] Applying ${interaction.tagIds.length} tags from interaction for contact ${contactId}`,
              );
              await prisma.contact.update({
                where: { id: contactId },
                data: {
                  tags: {
                    connect: interaction.tagIds.map((id: string) => ({ id })),
                  },
                },
              });
            }

            const agentIds =
              interaction.agentIds ||
              (interaction.agentId ? [interaction.agentId] : []);
            if (agentIds.length > 0) {
              logger.flow.info(
                `[FlowEngine] Assigning contact ${contactId} to ${agentIds.length} agents from interaction`,
              );
              await prisma.contact.update({
                where: { id: contactId },
                data: {
                  assignedUsers: {
                    set: agentIds.map((id: string) => ({ id })),
                  },
                },
              });
            }
          } catch (err: any) {
            logger.flow.error(
              `[FlowEngine] Failed to apply tags/agent from interaction: ${err.message}`,
            );
          }
        }

        await prisma.flowExecution.update({
          where: { id: pausedExecution.id },
          data: {
            status: "running",
            context: {
              ...context,
              pausedNodeId,
            } as any,
          },
        });

        const didMove = await executeFlowFromNode(
          pausedExecution.flowId,
          pausedNodeId,
          nodes,
          edges,
          { ...context, text: effectiveText, translatedText },
          pausedExecution.id,
          sourceHandle,
        );
        await scheduleAiFallbackIfNeeded(pausedExecution.id, organizationId);

        if (didMove) {
          return;
        } else {
          logger.flow.warn(
            `[FlowEngine] Resumption at node ${pausedNodeId} failed to trigger any path. Checking for other triggers...`,
          );
          await prisma.flowExecution.update({
            where: { id: pausedExecution.id },
            data: { status: "paused" },
          });
        }
      } else {
        // Not a button click or list selection matching any interactive node;
        // Check if the current paused node is an input or question node waiting for text/media
        let pausedNodeId = (pausedExecution.context as any)?.pausedNodeId;
        let pausedNode = nodes.find((n) => n.id === pausedNodeId);

        // Format validation for ask_question
        if (pausedNode && pausedNode.type === "ask_question") {
          const format = pausedNode.data?.format || "any";
          let isValid = true;
          const textValue = effectiveText.trim();

          if (format === "number") {
            isValid = /^#?\d+$/.test(textValue);
          } else if (format === "date") {
            isValid =
              /^\d{1,2}[-./]\d{1,2}[-./]\d{4}$/.test(textValue) ||
              !isNaN(Date.parse(textValue));
          } else if (format === "email") {
            isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue);
          }

          if (!isValid) {
            logger.flow.info(
              `[FlowEngine] Irrelevant input format "${format}" for question node. Input: "${effectiveText}". Keeping flow paused for retry.`,
            );
            await prisma.flowExecution.update({
              where: { id: pausedExecution.id },
              data: { status: "paused" },
            });
            return;
          }
        }

        if (
          pausedNode &&
          (pausedNode.type === "input" ||
            pausedNode.type === "askInput" ||
            pausedNode.type === "ask_question" ||
            pausedNode.type === "ask_address" ||
            pausedNode.type === "ask_location" ||
            pausedNode.type === "ask_media")
        ) {
          let parsedInput: any = messageText;
          try {
            if (messageText.startsWith("{")) {
              parsedInput = JSON.parse(messageText);
            }
          } catch (e) {}

          if (
            pausedNode.type === "ask_location" &&
            typeof parsedInput === "object" &&
            parsedInput.type === "location"
          ) {
            const latAttr = pausedNode.data?.latitudeAttribute;
            const longAttr = pausedNode.data?.longitudeAttribute;
            if (latAttr) context.variables[latAttr] = parsedInput.latitude;
            if (longAttr) context.variables[longAttr] = parsedInput.longitude;
            logger.flow.info(
              `[FlowEngine] Stored location attributes: ${latAttr}=${parsedInput.latitude}, ${longAttr}=${parsedInput.longitude}`,
            );
          } else if (
            pausedNode.type === "ask_media" &&
            typeof parsedInput === "object" &&
            parsedInput.type === "media"
          ) {
            const varName = pausedNode.data?.attribute;
            if (varName) {
              context.variables[varName] = parsedInput.mediaUrl;
              logger.flow.info(
                `[FlowEngine] Stored media URL in variable "${varName}"`,
              );
            }
          } else {
            const varName =
              pausedNode.data?.variableName ||
              pausedNode.data?.attribute ||
              pausedNode.data?.variable;
            if (varName) {
              let valueToStore =
                typeof parsedInput === "string"
                  ? parsedInput
                  : parsedInput.caption || parsedInput.mediaUrl || messageText;

              if (
                typeof parsedInput === "object" &&
                parsedInput.type === "media" &&
                parsedInput.mediaType === "audio" &&
                parsedInput.mediaId
              ) {
                if (parsedInput.transcription?.text) {
                  valueToStore = parsedInput.transcription.text;
                } else {
                  try {
                    const { downloadWhatsAppMedia } = await import("@/lib/whatsapp/api");
                    const { transcribeAudio } = await import("@/lib/ai/openai");
                    const { buffer } = await downloadWhatsAppMedia(
                      parsedInput.mediaId,
                      organizationId,
                    );
                    const org = await prisma.organization.findUnique({
                      where: { id: organizationId },
                      select: { aiApiKeys: true, aiProvider: true, aiProviderApiKey: true }
                    });
                    const transcription = await transcribeAudio(buffer, {
                      fileName: `${parsedInput.mediaId}.ogg`,
                      mimeType: 'audio/ogg',
                      apiKeys: (org?.aiApiKeys as Record<string, string>) || {},
                      apiKey: org?.aiProviderApiKey || undefined,
                      provider: (org?.aiProvider as any) || 'auto'
                    }).catch(async () => {
                      const { transcribeAudioWithWit } = await import("@/lib/ai/wit");
                      return await transcribeAudioWithWit(buffer);
                    });
                    if (transcription) valueToStore = transcription;
                  } catch (err: any) {
                    logger.flow.error(
                      `[FlowEngine] Voice transcription failed: ${err.message}`,
                    );
                  }
                }
              }

              context.variables[varName] = valueToStore;
              logger.flow.info(
                `[FlowEngine] Stored input in variable "${varName}"`,
              );
            }
          }

          await prisma.flowExecution.update({
            where: { id: pausedExecution.id },
            data: { status: "running", context: context as any },
          });

          const didMove = await executeFlowFromNode(
            pausedExecution.flowId,
            pausedNodeId,
            nodes,
            edges,
            { ...context, text: effectiveText, translatedText },
            pausedExecution.id,
          );
          await scheduleAiFallbackIfNeeded(pausedExecution.id, organizationId);

          if (didMove) {
            return;
          } else {
            logger.flow.warn(
              `[FlowEngine] Resumption at node ${pausedNodeId} failed to trigger any path. Keeping paused.`,
            );
            await prisma.flowExecution.update({
              where: { id: pausedExecution.id },
              data: { status: "paused" },
            });
          }
        } else {
          // Paused node was interactive and the user typed text that didn't match any option
          logger.flow.info(
            `[FlowEngine] User response did not match interactive options for node "${pausedNodeId}". Keeping flow paused and checking fallback triggers.`,
          );
          await prisma.flowExecution.update({
            where: { id: pausedExecution.id },
            data: { status: "paused" },
          });
        }
      }
    }

    // 1.2 Check if an interactive click/list selection matches any active flow node (handles re-selecting items from previous steps or completed flows)
    if (isButtonClick || effectiveText) {
      for (const flow of activeFlows) {
        const flowNodes = (flow.nodes as any[]) || [];
        const flowEdges = (flow.edges as any[]) || [];
        const match = findMatchingInteractionInNodes(
          flowNodes,
          buttonId,
          effectiveText,
          translatedText
        );
        if (match) {
          logger.flow.info(
            `[FlowEngine] Interactive selection "${buttonId || effectiveText}" matched node "${match.node.id}" (${match.node.type}) in active flow "${flow.name}". Executing flow branch.`
          );

          await prisma.flowExecution.updateMany({
            where: {
              contactId,
              status: "paused",
            },
            data: { status: "completed", endedAt: new Date() },
          });

          // Inherit valid historical variables from previous execution of this flow if any
          const lastExecution = await prisma.flowExecution.findFirst({
            where: { contactId, flowId: flow.id },
            orderBy: { startedAt: "desc" },
          });

          let initialVariables: Record<string, any> =
            (lastExecution?.context as any)?.variables || metadata?.variables || {};

          // Invalidate any downstream variables from discarded paths
          initialVariables = pruneInvalidatedBranchVariables(
            match.node.id,
            match.sourceHandle,
            flowNodes,
            flowEdges,
            initialVariables
          );

          const execution = await prisma.flowExecution.create({
            data: {
              flowId: flow.id,
              contactId,
              status: "running",
              logs: [],
              context: {
                variables: initialVariables,
                firstMessage: effectiveText,
                language: currentLanguage,
                pausedNodeId: match.node.id,
              },
            },
          });

          // Apply tags and agent assignment if present
          if (match.interaction) {
            try {
              if (match.interaction.tagIds && Array.isArray(match.interaction.tagIds) && match.interaction.tagIds.length > 0) {
                await prisma.contact.update({
                  where: { id: contactId },
                  data: {
                    tags: {
                      connect: match.interaction.tagIds.map((id: string) => ({ id })),
                    },
                  },
                });
              }
              const agentIds = match.interaction.agentIds || (match.interaction.agentId ? [match.interaction.agentId] : []);
              if (agentIds.length > 0) {
                await prisma.contact.update({
                  where: { id: contactId },
                  data: {
                    assignedUsers: {
                      set: agentIds.map((id: string) => ({ id })),
                    },
                  },
                });
              }
            } catch (e: any) {
              logger.flow.error(`[FlowEngine] Failed to apply tags/agent for interactive trigger: ${e.message}`);
            }
          }

          const flowContext: FlowContext = {
            contactId,
            organizationId,
            text: effectiveText,
            language: currentLanguage,
            variables: initialVariables,
            contact,
            metadata,
          };

          const didMove = await executeFlowFromNode(
            flow.id,
            match.node.id,
            flowNodes,
            flowEdges,
            flowContext,
            execution.id,
            match.sourceHandle
          );
          await scheduleAiFallbackIfNeeded(execution.id, organizationId);
          if (didMove) {
            return;
          }
        }
      }
    }

    logger.flow.info(`[FlowEngine] Handing off to WelcomeMessageEngine...`);
    welcomeTriggered = await processWelcomeMessages({
      organizationId,
      contactId,
      messageText: effectiveText,
      contact: { ...contact, isNewSession },
    });

    if (welcomeTriggered) {
      logger.flow.info(`[FlowEngine] Modular Welcome Message triggered and sent.`);
    }

    // 1.5 Check for STORY_REPLY triggers (very high priority)
    if (metadata?.isStoryReply) {
      for (const flow of activeFlows) {
        const triggerNode = (flow.nodes as any[])?.find(
          (n) => n.type === "trigger",
        );
        if (triggerNode?.data?.triggerType === "story_reply") {
          // Check if specific stories are selected
          const selectedStoryIds = triggerNode.data?.selectedStoryIds || [];
          const incomingStoryId = metadata.storyId;

          if (
            selectedStoryIds.length === 0 ||
            selectedStoryIds.includes(incomingStoryId)
          ) {
            logger.flow.trigger(
              `🚀 STORY REPLY TRIGGER MATCH: ${flow.name} (${flow.id})`,
            );
            await startFlow(
              flow,
              contactId,
              organizationId,
              effectiveText,
              contact,
              currentLanguage,
              metadata,
            );
            return;
          }
        }
      }
    }

    // 1.6 Check for FACEBOOK_COMMENT or INSTAGRAM_COMMENT triggers
    if (metadata?.platform === 'FACEBOOK_COMMENT' || metadata?.platform === 'INSTAGRAM_COMMENT') {
      for (const flow of activeFlows) {
        const triggerNode = (flow.nodes as any[])?.find(
          (n) => n.type === "trigger",
        );
        if (!triggerNode) continue;

        const triggerType = triggerNode.data?.triggerType;
        if (
          (metadata.platform === 'FACEBOOK_COMMENT' && triggerType === 'facebook_comment') ||
          (metadata.platform === 'INSTAGRAM_COMMENT' && triggerType === 'instagram_comment')
        ) {
          const selectedPostIds = triggerNode.data?.selectedPostIds || [];
          const incomingPostId = metadata.postId;

          if (
            selectedPostIds.length === 0 ||
            (incomingPostId && selectedPostIds.includes(incomingPostId))
          ) {
            logger.flow.trigger(
              `🚀 COMMENT TRIGGER MATCH: ${flow.name} (${flow.id}) for post ${incomingPostId || 'ALL'}`
            );
            await startFlow(
              flow,
              contactId,
              organizationId,
              effectiveText,
              contact,
              currentLanguage,
              metadata,
            );
            return;
          }
        }
      }
    }

    // 2. Check for KEYWORD triggers first (highest priority)
    if (effectiveText) {
      for (const flow of activeFlows) {
        const triggerNode = (flow.nodes as any[])?.find(
          (n) => n.type === "trigger",
        );
        if (!triggerNode) continue;

        const triggerType = triggerNode.data?.triggerType || "keyword";
        if (triggerType === "keyword") {
                      const configuredAdId = triggerNode.data?.facebookAdId;
          const incomingAdId = metadata?.referral?.source_id || metadata?.referral?.ad_id;

          if (configuredAdId) {
              if (configuredAdId === incomingAdId) {
                  logger.flow.trigger(`🚀 FACEBOOK AD TRIGGER MATCH: ${flow.name} (${flow.id}) for Ad ${configuredAdId}`);
                  await startFlow(
                    flow,
                    contactId,
                    organizationId,
                    effectiveText,
                    contact,
                    currentLanguage,
                    metadata,
                  );
                  return;
              } else {
                  logger.flow.info(`[FlowEngine] Flow "${flow.name}" requires Ad ID ${configuredAdId}, but incoming message is from Ad ID ${incomingAdId || 'None'}. Skipping.`);
                  continue;
              }
          }

          const isRegexEnabled = triggerNode.data?.isRegexEnabled || false;
          const regexPattern = triggerNode.data?.regexPattern || "";

          if (isRegexEnabled && regexPattern) {
            try {
              const regex = new RegExp(regexPattern, "i");
              if (regex.test(effectiveText)) {
                logger.flow.trigger(
                  `🚀 REGEX TRIGGER MATCH: ${flow.name} (${flow.id})`,
                );
                await startFlow(
                  flow,
                  contactId,
                  organizationId,
                  effectiveText,
                  contact,
                  currentLanguage,
                  metadata,
                );
                return;
              }
            } catch (err: any) {
              logger.flow.error(
                `[FlowEngine] Invalid Regex pattern in flow ${flow.name}: ${err.message}`,
              );
            }
          } else {
            const matchMode = triggerNode.data?.matchMode || "contains";
            const rawKeywords = (triggerNode.data?.keyword || "").toLowerCase();
            const effectiveTextLower = effectiveText.toLowerCase();

            if (matchMode === "whole") {
              const tokenize = (text: string) =>
                text
                  .toLowerCase()
                  .split(/[\s,.;:!?]+/)
                  .filter(Boolean);
              const triggerPhrases = rawKeywords
                .split(",")
                .map((k: string) => k.trim())
                .filter(Boolean);
              const inputWords = tokenize(effectiveText);

              logger.flow.info(
                `[FlowEngine] Checking whole match phrases for flow "${flow.name}": [${triggerPhrases.join(", ")}] against "${effectiveTextLower}"`,
              );
              for (const phrase of triggerPhrases) {
                const phraseWords = tokenize(phrase);
                if (
                  inputWords.length > 0 &&
                  inputWords.every((word) => phraseWords.includes(word))
                ) {
                  logger.flow.trigger(
                    `🚀 WHOLE MATCH TRIGGER: ${flow.name} (${flow.id})`,
                  );
                  await startFlow(
                    flow,
                    contactId,
                    organizationId,
                    effectiveText,
                    contact,
                    currentLanguage,
                    metadata,
                  );
                  return;
                }
              }
            } else {
               const keywords = rawKeywords
                .split(",")
                .map((k: string) => k.trim())
                .filter(Boolean);
              logger.flow.info(
                `[FlowEngine] Checking "Contains" keywords for flow "${flow.name}": [${keywords.join(", ")}] against "${effectiveTextLower}"`,
              );

              const matchesTrigger = (text: string) =>
                keywords.some((k: string) => text.toLowerCase().includes(k));

              if (
                matchesTrigger(effectiveText) ||
                (translatedText && matchesTrigger(translatedText))
              ) {
                logger.flow.trigger(
                  `🚀 CONTAINS MATCH TRIGGER: ${flow.name} (${flow.id})`,
                );
                await startFlow(
                  flow,
                  contactId,
                  organizationId,
                  effectiveText,
                  contact,
                  currentLanguage,
                  metadata,
                );
                return;
              }
            }
          }
        }
      }
    }

    // 3. Check for paused flow executions for this contact (medium priority)
    // Handled in high-priority step above.
    const duplicatePausedExecution = null;

    if (duplicatePausedExecution) {
      logger.flow.info(
        `[FlowEngine] Found paused execution for flow "${pausedExecution!.flow.name}"`,
      );

      // Single session rule: Mark all other paused executions as completed
      await prisma.flowExecution.updateMany({
        where: {
          contactId,
          status: "paused",
          id: { not: pausedExecution!.id },
        },
        data: { status: "completed", endedAt: new Date() },
      });
      let context: FlowContext = pausedExecution!.context as any;
      const isEnglishOrAuto =
        !context.language ||
        context.language === "en" ||
        context.language === "auto";
      if (
        isEnglishOrAuto &&
        currentLanguage &&
        currentLanguage !== "en" &&
        currentLanguage !== "auto"
      ) {
        context.language = currentLanguage;
      }
      const nodes = pausedExecution!.flow.nodes as any[];
      const edges = pausedExecution!.flow.edges as any[];
      const pausedNodeId = (pausedExecution!.context as any).pausedNodeId;
      const pausedNode = nodes.find((n) => n.id === pausedNodeId);

      let sourceHandle: string | undefined = undefined;

      if (
        pausedNode &&
        (pausedNode.type === "input" ||
          pausedNode.type === "askInput" ||
          pausedNode.type === "ask_question" ||
          pausedNode.type === "ask_address" ||
          pausedNode.type === "ask_location" ||
          pausedNode.type === "ask_media" ||
          pausedNode.type === "message" ||
          pausedNode.type === "media" ||
          pausedNode.type === "carousel")
      ) {
        let parsedInput: any = messageText;
        try {
          if (messageText.startsWith("{")) {
            parsedInput = JSON.parse(messageText);
          }
        } catch (e) {}

        if (!context.variables) context.variables = {};

        if (
          pausedNode.type === "ask_location" &&
          typeof parsedInput === "object" &&
          parsedInput.type === "location"
        ) {
          const latAttr = pausedNode.data?.latitudeAttribute;
          const longAttr = pausedNode.data?.longitudeAttribute;
          if (latAttr) context.variables[latAttr] = parsedInput.latitude;
          if (longAttr) context.variables[longAttr] = parsedInput.longitude;
          logger.flow.info(
            `[FlowEngine] Stored location attributes: ${latAttr}=${parsedInput.latitude}, ${longAttr}=${parsedInput.longitude}`,
          );
        } else if (
          pausedNode.type === "ask_media" &&
          typeof parsedInput === "object" &&
          parsedInput.type === "media"
        ) {
          const varName = pausedNode.data?.attribute;
          if (varName) {
            context.variables[varName] = parsedInput.mediaUrl;
            logger.flow.info(
              `[FlowEngine] Stored media URL in variable "${varName}"`,
            );
          }
        } else {
          const varName =
            pausedNode.data?.variableName ||
            pausedNode.data?.attribute ||
            pausedNode.data?.variable;
          if (varName) {
            const valueToStore =
              typeof parsedInput === "string"
                ? parsedInput
                : parsedInput.caption || parsedInput.mediaUrl || messageText;

            context.variables[varName] = valueToStore;
            logger.flow.info(
              `[FlowEngine] Stored input in variable "${varName}"`,
            );
          }
        }
      }
      if (
        pausedNode &&
        (pausedNode.type === "message" ||
          pausedNode.type === "media" ||
          pausedNode.type === "list" ||
          pausedNode.type === "single_product" ||
          pausedNode.type === "multi_product" ||
          pausedNode.type === "catalogue" ||
          pausedNode.type === "carousel")
      ) {
        if (buttonId) {
          if (buttonId.startsWith("url_")) {
            const url = buttonId.split("::")[0].replace("url_", "");
            const buttons = pausedNode.data?.buttons || [];
            // Find the button that has this URL
            const matchingButton = buttons.find((b: any) => b.url === url);
            if (matchingButton) {
              sourceHandle = matchingButton.id;
            } else {
              sourceHandle = buttonId;
            }
          } else {
            // Strip the unique suffix (e.g. ::1) if present
            sourceHandle = buttonId.split("::")[0];
          }
        } else if (effectiveText) {
          // Fallback: Check if message text matches any button label or list item title
          const buttons = pausedNode.data?.buttons || [];
          const listItems = (pausedNode.data?.sections || []).flatMap(
            (s: any) => s.rows || s.items || [],
          );

          const matchingButton = buttons.find(
            (b: any) =>
              b.text?.toLowerCase().trim() ===
                effectiveText.toLowerCase().trim() ||
              (translatedText &&
                b.text?.toLowerCase().trim() ===
                  translatedText.toLowerCase().trim()),
          );

          const matchingListItem = listItems.find(
            (i: any) =>
              i.title?.toLowerCase().trim() ===
                effectiveText.toLowerCase().trim() ||
              (translatedText &&
                i.title?.toLowerCase().trim() ===
                  translatedText.toLowerCase().trim()),
          );

          if (matchingButton) {
            sourceHandle = matchingButton.id;
            logger.flow.info(
              `[FlowEngine] Matched text "${effectiveText}" to button label. Using handle: ${sourceHandle}`,
            );
          } else if (matchingListItem) {
            sourceHandle = matchingListItem.id || matchingListItem.title;
            logger.flow.info(
              `[FlowEngine] Matched text "${effectiveText}" to list item title. Using handle: ${sourceHandle}`,
            );
          }
        }

        if (sourceHandle) {
          logger.flow.info(
            `[FlowEngine] Resuming from interaction: ${sourceHandle}`,
          );

          // Apply Tags from Interaction (Button/List Item)
          try {
            const buttons = pausedNode.data?.buttons || [];
            const cardButtons = (pausedNode.data?.cards || []).flatMap(
              (c: any) => c.buttons || [],
            );
            const listItems = (pausedNode.data?.sections || []).flatMap(
              (s: any) => s.rows || s.items || [],
            );
            const allInteractions = [...buttons, ...cardButtons, ...listItems];

            const interaction = allInteractions.find(
              (i: any) => i.id === sourceHandle,
            );
            if (interaction) {
              // Log the interaction for analytics
              await logExecutionStep(
                pausedExecution!.id,
                pausedNode.id,
                pausedNode.type,
                "interaction",
                {
                  buttonId: sourceHandle,
                  text: interaction.text || interaction.title,
                  type: pausedNode.type === "list" ? "list_item" : "button",
                },
              );

              // Apply Tags
              if (
                interaction.tagIds &&
                Array.isArray(interaction.tagIds) &&
                interaction.tagIds.length > 0
              ) {
                logger.flow.info(
                  `[FlowEngine] Applying ${interaction.tagIds.length} tags from interaction for contact ${contactId}`,
                );
                await prisma.contact.update({
                  where: { id: contactId },
                  data: {
                    tags: {
                      connect: interaction.tagIds.map((id: string) => ({ id })),
                    },
                  },
                });
              }

              // Assign Agent
              // Assign Agent
              const agentIds =
                interaction.agentIds ||
                (interaction.agentId ? [interaction.agentId] : []);
              if (agentIds.length > 0) {
                logger.flow.info(
                  `[FlowEngine] Assigning contact ${contactId} to ${agentIds.length} agents from interaction`,
                );
                await prisma.contact.update({
                  where: { id: contactId },
                  data: {
                    assignedUsers: {
                      set: agentIds.map((id: string) => ({ id })),
                    },
                  },
                });
              }
            }
          } catch (err: any) {
            logger.flow.error(
              `[FlowEngine] Failed to apply tags/agent from interaction: ${err.message}`,
            );
          }
        }
      }

      // Update status back to running
      await prisma.flowExecution.update({
        where: { id: pausedExecution!.id },
        data: { status: "running", context: context as any },
      });

      // logger.flow.info(`[FlowEngine] Resuming execution from node ${pausedNodeId}`);
      // Move to NEXT node after the paused node
      const didMove = await executeFlowFromNode(
        pausedExecution!.flowId,
        pausedNodeId,
        nodes,
        edges,
        { ...context, text: effectiveText, translatedText },
        pausedExecution!.id,
        sourceHandle,
      );
      await scheduleAiFallbackIfNeeded(pausedExecution!.id, organizationId);

      if (didMove) {
        return;
      } else {
        logger.flow.warn(
          `[FlowEngine] Resumption at node ${pausedNodeId} failed to trigger any path. Checking for new triggers...`,
        );
        // If resumption failed to move the flow forward, we DON'T return.
        // Instead, we let the logic fall through to check for new keyword triggers.
        // We also clear the status back to paused or handle cleanup?
        // Actually, if it didn't move, it's safer to keep it paused at that node but allow new triggers to override it.
        await prisma.flowExecution.update({
          where: { id: pausedExecution!.id },
          data: { status: "paused" },
        });

        if (buttonId) {
          logger.flow.info(
            `[FlowEngine] Interactive button did not match any path. Staying at current node.`,
          );
          return;
        }
      }
    }

    if (welcomeTriggered) {
      logger.flow.info(`[FlowEngine] Welcome message sent. Skipping ANY trigger and AI Fallback.`);
      return;
    }

    // 4. Check for 'ANY message' triggers (lowest priority)
    for (const flow of activeFlows) {
      const triggerNode = (flow.nodes as any[])?.find(
        (n) => n.type === "trigger",
      );
      if (!triggerNode) continue;

      const triggerType = triggerNode.data?.triggerType || "keyword";
      if (triggerType === "any") {
        logger.flow.trigger(
          `🚀 ANY MESSAGE TRIGGER: ${flow.name} (${flow.id})`,
        );
        await startFlow(
          flow,
          contactId,
          organizationId,
          effectiveText,
          contact,
          currentLanguage,
          metadata,
        );
        return;
      }
    }

    // 5. Final Fallback: If no triggers matched, let AI handle it
    if (isAiBotEnabled) {
      // ── AI Message Limit Enforcement ──────────────────────────────────────────
      const { checkAiMessageLimit, incrementAiUsage } = await import("@/lib/ai/ai-limit");
      const limitCheck = await checkAiMessageLimit(organizationId);
      if (!limitCheck.allowed) {
        logger.flow.warn(`[FlowEngine] AI message limit reached for organization ${organizationId} (${limitCheck.usage}/${limitCheck.limit}). Skipping AI response.`);
        const flowContext: FlowContext = {
          contactId,
          organizationId,
          text: effectiveText,
          variables: {},
          language: currentLanguage,
          metadata: metadata
        };
        await sendTranslatedMessage({
          contactId,
          message: limitCheck.message || "You have reached your AI message limit.\nPlease contact your administrator.",
          skipWindowCheck: true,
          skipTranslation: true,
        }, flowContext);
        return;
      }

      // ── AI Routing: Check if customer intent matches any routing rule ─────────────
      try {
        const { evaluateAiRouting } = await import("@/lib/ai/ai-routing-engine");
        const routingResult = await evaluateAiRouting({
          organizationId,
          messageText: effectiveText || "",
          contactId,
          contact: dbContact,
          simulateOnly: false,
        });

        if (routingResult.matched) {
          logger.flow.success(
            `[FlowEngine] Chat routed via AI Routing Rule "${routingResult.rule?.name}" to agent "${routingResult.assignedAgent?.name || routingResult.assignedAgent?.email}". Conversation handed over to human agent.`
          );
          return;
        }
      } catch (routingErr: any) {
        logger.flow.warn(`[FlowEngine] AI Routing evaluation error: ${routingErr.message}`);
      }

      logger.flow.info(`[FlowEngine] Final Fallback: No triggers matched. Checking Sales Agent for: "${effectiveText}"`);

      let aiResponse: string = "";
      let interactiveData: any = undefined;
      let aiDetails: any = null;
      const aiStartTime = Date.now();

      // ── Sales Agent (stateful order collection) ────────────────────────────
      // Try the sales agent first. It handles active order collection sessions.
      // If it returns null → fall through to regular KB Q&A and configured AI tools.
      const { runSalesAgent } = await import("@/lib/ai/sales-agent");
      const agentResponse = await runSalesAgent(effectiveText || "", contactId, organizationId, buttonId);

      if (agentResponse !== null) {
        // Sales agent handled this message
        logger.flow.success(`[FlowEngine] Sales Agent handled message for contact ${contactId}`);
        if (typeof agentResponse === 'object') {
          aiResponse = agentResponse.message;
          interactiveData = agentResponse.interactiveData;
        } else {
          aiResponse = agentResponse;
        }
        aiDetails = {
          text: aiResponse,
          rawAiOutput: aiResponse,
          provider: "sales_agent",
          model: "order-flow",
          agentName: "Sales Agent",
          durationMs: Date.now() - aiStartTime,
        };
      } else {
        // No order intent / no active state → use normal KB Q&A
        logger.flow.info(`[FlowEngine] Sales Agent passed. Falling back to KB Q&A.`);
        
        const recentMessages = await prisma.message.findMany({
          where: { contactId: contactId },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: { direction: true, content: true, mediaUrl: true, type: true }
        });

        const messagesForHistory = recentMessages.reverse();
        if (messagesForHistory.length > 0 && messagesForHistory[messagesForHistory.length - 1].direction === 'inbound') {
          messagesForHistory.pop();
        }

        const { getAppBaseUrl } = await import("@/lib/storage/media");
        const appBase = getAppBaseUrl();

        const chatHistory = messagesForHistory.map(msg => {
          let text = msg.content || '';
          if (msg.mediaUrl) {
            const fullMediaUrl = msg.mediaUrl.startsWith('http://') || msg.mediaUrl.startsWith('https://')
              ? msg.mediaUrl
              : `${appBase}${msg.mediaUrl.startsWith('/') ? '' : '/'}${msg.mediaUrl}`;
            if (text === '[Image]' || text === '[Document]' || text === '[Video]' || text === '[Audio]') {
              text = `[Attachment ${msg.type || 'file'}: ${fullMediaUrl}]`;
            } else if (!text.includes(fullMediaUrl)) {
              text = `${text} [Attachment: ${fullMediaUrl}]`;
            }
          }
          return {
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: text
          };
        });

        // Resolve AI Agent according to routing mode
        let targetAgentId = dbContact?.aiAgentId || undefined;
        if (!targetAgentId && dbContact?.organization?.agentRoutingMode === "auto") {
          try {
            const { routeMessageToAgent } = await import("@/lib/ai/router");
            const routedId = await routeMessageToAgent(effectiveText || "Hello", organizationId, dbContact?.platform);
            if (routedId) {
              targetAgentId = routedId;
              logger.flow.info(`[FlowEngine] Intent router selected agent: ${routedId}`);
            }
          } catch (err: any) {
            logger.flow.warn(`[FlowEngine] Intent router error: ${err.message}`);
          }
        }

        const tools = [
          {
            type: "function" as const,
            function: {
              name: "startOrderBookingFlow",
              description: "Call this function when the user expresses clear intent to place an order, buy a product, or says yes/haan/confirm to a purchase suggestion.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The full name of the customer if mentioned in the message" },
                  product: { type: "string", description: "The name of the product they want to order if mentioned in the message" },
                  quantity: { type: "string", description: "The quantity of units they want to order if mentioned in the message" },
                  phone: { type: "string", description: "The phone/WhatsApp number of the customer if mentioned in the message" },
                  address: { type: "string", description: "The delivery address of the customer if mentioned in the message" }
                }
              }
            }
          }
        ];

        const toolHandlers = {
          startOrderBookingFlow: async (args: any) => {
            logger.flow.info(`[SalesAgent] Tool triggered: startOrderBookingFlow with args: ${JSON.stringify(args)}`);
            const { setAgentState } = await import("@/lib/ai/sales-agent");
            let phase: any = "collecting_name";
            if (args.name) {
              if (args.phone) {
                if (args.address) {
                  if (args.product) {
                    if (args.quantity) {
                      phase = "confirming";
                    } else {
                      phase = "collecting_quantity";
                    }
                  } else {
                    phase = "collecting_product";
                  }
                } else {
                  phase = "collecting_address";
                }
              } else {
                phase = "collecting_phone";
              }
            }

            const state = {
              phase,
              collected: {
                name: args.name || undefined,
                phone: args.phone || undefined,
                address: args.address || undefined,
                product: args.product || undefined,
                quantity: args.quantity ? String(args.quantity) : undefined,
              }
            };

            await setAgentState(contactId, state);
            return {
              status: "success",
              message: `Order booking flow successfully started. Active phase is ${phase}. Please prompt the user for the next missing detail to proceed.`,
            };
          }
        };

        const { buildConfiguredAITools } = await import("@/lib/ai/configured-tools");
        const configuredTools = await buildConfiguredAITools({
          organizationId,
          contactId,
          baseTools: tools,
          baseToolHandlers: toolHandlers,
        });

        const { getAIResponseWithDetails } = await import("@/lib/ai/openai");
        
        aiDetails = await getAIResponseWithDetails(effectiveText || "Hello", {
          organizationId: organizationId,
          contactId: contactId,
          aiAgentId: targetAgentId,
          history: chatHistory,
          tools: configuredTools.tools,
          toolHandlers: configuredTools.toolHandlers,
        });

        aiResponse = aiDetails?.text || "";
      }

      if (!aiResponse) {
        logger.flow.info(`[FlowEngine] AI Generated response is empty or null (API not connected/failed). Stopping execution without sending.`);
        try {
          const { logAIAgentExecution } = await import("@/app/actions/ai-executions");
          await logAIAgentExecution({
            organizationId,
            contactId,
            contactName: contact?.name,
            contactPhone: contact?.waId || dbContact?.waId,
            userPrompt: effectiveText || "Hello",
            provider: aiDetails?.provider || "openai",
            model: aiDetails?.model || "gpt-4o-mini",
            durationMs: Date.now() - aiStartTime,
            status: "failed",
            error: "AI Provider API returned empty response or API key invalid.",
          });
        } catch {}
        return;
      }

      const { processAIJsonResponse } = await import("@/lib/ai/lead-saver");
      const processedAI = await processAIJsonResponse({
        rawAiResponse: aiDetails?.rawAiOutput || aiResponse,
        organizationId,
        contactId,
        fallbackPhone: contact?.waId || dbContact?.waId,
        userPrompt: effectiveText || "Hello",
        aiAgentId: aiDetails?.agentId,
        aiAgentName: aiDetails?.agentName,
        provider: aiDetails?.provider,
        model: aiDetails?.model,
        systemPromptUsed: aiDetails?.systemPrompt,
        retrievedChunks: aiDetails?.retrievedChunks || [],
        durationMs: aiDetails?.durationMs || (Date.now() - aiStartTime),
      });
      aiResponse = processedAI.textMessage;

      logger.flow.success(`[FlowEngine] AI Generated Response: "${aiResponse.substring(0, 100)}..."`);

      // Configurable AI Agent Response Delay (Simulate human response time)
      const agentDelaySeconds = typeof (aiDetails as any)?.delaySeconds === 'number' ? (aiDetails as any).delaySeconds : 0;
      if (agentDelaySeconds > 0) {
        const cappedDelay = Math.min(agentDelaySeconds, 120);
        logger.flow.info(`[FlowEngine] AI Agent response delay configured (${agentDelaySeconds}s). Waiting ${cappedDelay}s before dispatching...`);
        await new Promise((resolve) => setTimeout(resolve, cappedDelay * 1000));
      }

      const flowContext: FlowContext = {
        contactId,
        organizationId,
        text: effectiveText,
        variables: {},
        language: currentLanguage,
        metadata: metadata
      };

      // Determine incoming message category: 'text' | 'voice' | 'media'
      let incomingCategory: 'text' | 'voice' | 'media' = 'text';

      if (
        metadata?.isVoice === true ||
        metadata?.msgType === 'audio' ||
        metadata?.mediaType === 'audio' ||
        (typeof parsedInput === 'object' && parsedInput !== null && parsedInput.type === 'media' && parsedInput.mediaType === 'audio')
      ) {
        incomingCategory = 'voice';
      } else if (
        metadata?.isMedia === true ||
        ['image', 'video', 'document', 'sticker'].includes(metadata?.msgType) ||
        ['image', 'video', 'document', 'sticker'].includes(metadata?.mediaType) ||
        (typeof parsedInput === 'object' && parsedInput !== null && parsedInput.type === 'media' && ['image', 'video', 'document', 'sticker'].includes(parsedInput.mediaType))
      ) {
        incomingCategory = 'media';
      } else {
        try {
          const lastInboundMsg = await prisma.message.findFirst({
            where: { contactId, direction: 'inbound' },
            orderBy: { createdAt: 'desc' },
            select: { type: true, rawBody: true }
          });
          if (lastInboundMsg) {
            if (lastInboundMsg.type === 'audio' || (lastInboundMsg.rawBody as any)?.voice) {
              incomingCategory = 'voice';
            } else if (['image', 'video', 'document', 'sticker'].includes(lastInboundMsg.type)) {
              incomingCategory = 'media';
            }
          }
        } catch {}
      }

      // Check configured response format for this category
      const orgAiKeys = (dbContact?.organization?.aiApiKeys && typeof dbContact.organization.aiApiKeys === 'object')
        ? (dbContact.organization.aiApiKeys as Record<string, any>)
        : {};
      const configuredFormats = orgAiKeys.aiResponseFormat as {
        text?: 'text' | 'voice';
        voice?: 'text' | 'voice';
        media?: 'text' | 'voice';
      } | undefined;

      const isVoiceResponseEnabled = dbContact?.organization?.aiVoiceResponseEnabled ?? false;

      let shouldRespondWithVoice = false;
      if (configuredFormats && typeof configuredFormats === 'object') {
        const configuredFormat = configuredFormats[incomingCategory];
        if (configuredFormat === 'voice') {
          shouldRespondWithVoice = true;
        } else if (configuredFormat === 'text') {
          shouldRespondWithVoice = false;
        } else {
          // If not configured for this specific category, default voice notes to voice if voice enabled, text for others
          shouldRespondWithVoice = isVoiceResponseEnabled && incomingCategory === 'voice';
        }
      } else {
        // Fallback for legacy configurations without granular settings:
        shouldRespondWithVoice = isVoiceResponseEnabled;
      }

      logger.flow.info(`[FlowEngine] Incoming message category: ${incomingCategory.toUpperCase()} | Configured AI reply format: ${shouldRespondWithVoice ? 'VOICE' : 'TEXT'}`);

      if (shouldRespondWithVoice) {
        try {
          const { saveMediaLocally } = await import("@/lib/storage/media");
          const { generateSpeech } = await import("@/lib/ai/openai");
          
          const audioBuffer = await generateSpeech(aiResponse, {
            organizationId,
            language: currentLanguage,
            provider: (dbContact?.organization?.aiProvider as any) || undefined,
            apiKeys: (dbContact?.organization?.aiApiKeys as Record<string, string>) || undefined,
            apiKey: dbContact?.organization?.aiProviderApiKey || undefined
          });
          logger.flow.info(`[FlowEngine] Generated voice reply using active provider (${dbContact?.organization?.aiProvider || 'auto'}) for incoming ${incomingCategory} message`);

          const audioUrl = await saveMediaLocally(audioBuffer, `voice-${Date.now()}.ogg`, 'audio/ogg');
          
          await sendTranslatedMessage(
            {
              contactId: contactId,
              message: aiResponse,
              mediaUrl: audioUrl,
              contentType: 'voice',
              skipWindowCheck: true,
              skipTranslation: true,
            },
            flowContext,
          );
        } catch (err: any) {
          logger.flow.error(`[FlowEngine] Voice generation failed: ${err.message}. Gracefully falling back to text response.`);
          console.error(`\n🚨 ==================== [VOICE GENERATION FAILED] ====================`);
          console.error(`Error: ${err.message}`);
          console.error(`Contact: ${dbContact?.name || dbContact?.waId || contactId}`);
          console.error(`Incoming Type: ${incomingCategory} -> Fallback to Text`);
          console.error(`=====================================================================\n`);

          try {
            const { logActivity } = await import("@/lib/activityLog");
            await logActivity({
              organizationId,
              action: "Voice Generation Failed - Fallback to Text",
              module: "AI Voice",
              target: dbContact?.name || dbContact?.waId || "WhatsApp Audio Reply",
              details: `${err.message} (Incoming message type: ${incomingCategory})`,
              status: "failed",
            });
          } catch {}

          const sendParams: any = { contactId, message: aiResponse, skipWindowCheck: true, skipTranslation: true };
          if (interactiveData) {
            sendParams.interactiveData = interactiveData;
          }
          await sendTranslatedMessage(sendParams, flowContext);
        }
      } else {
        const sendParams: any = { contactId, message: aiResponse, skipWindowCheck: true, skipTranslation: true };
        if (interactiveData) {
          sendParams.interactiveData = interactiveData;
        }
        await sendTranslatedMessage(sendParams, flowContext);
      }

      if (processedAI.media && processedAI.media.length > 0) {
        try {
          const { sendAIMediaResponses } = await import("@/lib/ai/ai-media-handler");
          await sendAIMediaResponses({
            organizationId,
            contactId,
            mediaList: processedAI.media,
            flowContext,
          });
        } catch (mediaErr: any) {
          logger.flow.error(`[FlowEngine] Error dispatching AI media: ${mediaErr.message}`);
        }
      }

      await incrementAiUsage(organizationId).catch(() => {});
      return;
    }


    logger.flow.info(`[FlowEngine] No triggers matched and AI fallback is disabled.`);

  } catch (error: any) {
    logger.flow.error(`FATAL ENGINE ERROR: ${error.message}`);
    console.error(error);
  }
}

export async function startFlow(
  flow: any,
  contactId: string,
  organizationId: string,
  messageText: string,
  contact?: any,
  language: string = "en",
  metadata?: any,
) {
   await prisma.flowExecution.updateMany({
    where: {
      contactId,
      status: "paused",
    },
    data: { status: "completed", endedAt: new Date() },
  });

  const initialVariables: Record<string, any> = metadata?.variables || {};
  if (metadata?.isStoryReply) {
    initialVariables["story.id"] = metadata.storyId;
    initialVariables["story.url"] = metadata.storyUrl;
  }

  const execution = await prisma.flowExecution.create({
    data: {
      flowId: flow.id,
      contactId,
      status: "running",
      logs: [],
      context: {
        variables: initialVariables,
        firstMessage: messageText,
        language,
      },
    },
  });

  const context: FlowContext = {
    contactId,
    organizationId,
    text: messageText,
    language,
    variables: initialVariables,
    contact,
    metadata,
  };

  const triggerNode = (flow.nodes as any[]).find((n) => n.type === "trigger");
  await executeFlowFromNode(
    flow.id,
    triggerNode!.id,
    flow.nodes as any[],
    flow.edges as any[],
    context,
    execution.id,
  );
  await scheduleAiFallbackIfNeeded(execution.id, organizationId);
}

export async function processShopifyEvent(
  organizationId: string,
  contactId: string,
  eventType: string,
  orderData: any,
  contact?: any,
) {
  try {
    logger.flow.info(
      `[FlowEngine] Processing Shopify Event "${eventType}" for contact ${contactId}`,
    );

     const activeFlows = await prisma.flow.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    for (const flow of activeFlows) {
      const triggerNode = (flow.nodes as any[])?.find(
        (n) => n.type === "trigger",
      );
      if (!triggerNode) continue;
      const triggerType = triggerNode.data?.triggerType;
      const triggerEvent = triggerNode.data?.shopifyEvent;
      if (triggerType === "shopify_event" && triggerEvent === eventType) {
        logger.flow.trigger(
          `🚀 SHOPIFY TRIGGER MATCH: ${flow.name} (${flow.id}) for event ${eventType}`,
        );
        const initialVariables: Record<string, any> = {
          "order.id": orderData.id?.toString(),
          "order.number": orderData.order_number?.toString() || orderData.name,
          "order.name": orderData.name,
          "order.total": orderData.total_price,
          "order.currency": orderData.currency,
          "customer.firstName": orderData.customer?.first_name || "Customer",
          "customer.lastName": orderData.customer?.last_name || "",
          "customer.email": orderData.customer?.email || orderData.email,
          "customer.phone": orderData.customer?.phone || orderData.phone,
          "shop.url": orderData.shop_url || orderData.shop,
          "shop.name":
            orderData.shop_name ||
            orderData.shop?.replace(".myshopify.com", "") ||
            "Our Shop",

          // Draft Order & Checkout specific
          "order.invoice_url": orderData.invoice_url,
          "order.checkout_url":
            orderData.checkout_url || orderData.abandoned_checkout_url,
          invoice_url: orderData.invoice_url,
          checkout_url:
            orderData.checkout_url || orderData.abandoned_checkout_url,

          // Aliases for easier use in editor (with underscores)
          customer_name:
            `${orderData.customer?.first_name || ""} ${orderData.customer?.last_name || ""}`.trim() ||
            "Customer",
          order_number: orderData.order_number?.toString() || orderData.name,
          total_price: orderData.total_price,

          // Add nested objects for nodes that expect them
          order: {
            id: orderData.id?.toString(),
            name: orderData.name,
            number: orderData.order_number?.toString() || orderData.name,
            total: orderData.total_price,
            currency: orderData.currency,
            invoice_url: orderData.invoice_url,
            status: orderData.cancelled_at ? "cancelled" : "open",
            items: orderData.line_items
              ?.map((item: any) => `${item.title || item.name || 'Product'} x${item.quantity || 1}`)
              .join(", "),
          },
          customer: {
            firstName: orderData.customer?.first_name || "Customer",
            lastName: orderData.customer?.last_name || "",
            email: orderData.customer?.email || orderData.email,
            phone: orderData.customer?.phone || orderData.phone,
          },
        };

        // Start the flow
        await startFlow(
          flow,
          contactId,
          organizationId,
          `Shopify Event: ${eventType}`,
          contact,
          "en",
          { shopifyEvent: eventType, orderData, variables: initialVariables },
        );
        return true;
      }
    }
  } catch (error: any) {
    logger.flow.error(`[FlowEngine] Shopify Event Error: ${error.message}`);
  }
  return false;
}

export async function processWooCommerceEvent(
  organizationId: string,
  contactId: string,
  eventType: string,
  orderData: any,
  contact?: any,
) {
  try {
    logger.flow.info(
      `[FlowEngine] Processing WooCommerce Event "${eventType}" for contact ${contactId}`,
    );

    // 1. Find all active flows
    const activeFlows = await prisma.flow.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    for (const flow of activeFlows) {
      const triggerNode = (flow.nodes as any[])?.find(
        (n) => n.type === "trigger",
      );
      if (!triggerNode) continue;

      const triggerType = triggerNode.data?.triggerType;
      const triggerEvent = triggerNode.data?.woocommerceEvent;

      if (triggerType === "woocommerce_event" && triggerEvent === eventType) {
        logger.flow.trigger(
          `🚀 WOOCOMMERCE TRIGGER MATCH: ${flow.name} (${flow.id}) for event ${eventType}`,
        );

        // Map order data to variables
        const initialVariables: Record<string, any> = {
          "order.id": orderData.id?.toString(),
          "order.number": orderData.number?.toString(),
          "order.total": orderData.total,
          "order.currency": orderData.currency,
          "order.status": orderData.status,
          "order.payment_method": orderData.payment_method_title,
          "order.shipping_total": orderData.shipping_total,
          "order.date": orderData.date_created,
          "customer.firstName": orderData.billing?.first_name || "Customer",
          "customer.lastName": orderData.billing?.last_name || "",
          "customer.email": orderData.billing?.email,
          "customer.phone": orderData.billing?.phone,
          "billing.address": `${orderData.billing?.address_1}, ${orderData.billing?.city}, ${orderData.billing?.state} ${orderData.billing?.postcode}`,
          "shipping.address": `${orderData.shipping?.address_1}, ${orderData.shipping?.city}, ${orderData.shipping?.state} ${orderData.shipping?.postcode}`,
          order: {
            id: orderData.id?.toString(),
            number: orderData.number?.toString(),
            total: orderData.total,
            currency: orderData.currency,
            status: orderData.status,
            payment_method: orderData.payment_method_title,
            items: orderData.line_items
              ?.map((item: any) => `${item.name} (x${item.quantity})`)
              .join(", "),
            shipping_address: `${orderData.shipping?.address_1}, ${orderData.shipping?.city}, ${orderData.shipping?.state} ${orderData.shipping?.postcode}`,
          },
          customer: {
            firstName: orderData.billing?.first_name || "Customer",
            lastName: orderData.billing?.last_name || "",
            email: orderData.billing?.email,
            phone: orderData.billing?.phone,
          },
        };

        // Start the flow
        await startFlow(
          flow,
          contactId,
          organizationId,
          `WooCommerce Event: ${eventType}`,
          contact,
          "en",
          {
            woocommerceEvent: eventType,
            orderData,
            variables: initialVariables,
          },
        );
        return true;
      }
    }
  } catch (error: any) {
    logger.flow.error(`[FlowEngine] WooCommerce Event Error: ${error.message}`);
  }
  return false;
}

export async function executeFlowFromNode(
  flowId: string,
  currentNodeId: string,
  nodes: any[],
  edges: any[],
  context: FlowContext,
  executionId: string,
  sourceHandle?: string,
): Promise<boolean> {
  let outgoingEdges = edges.filter((e) => e.source === currentNodeId);
  logger.flow.info(
    `[executeFlowFromNode] Node: ${currentNodeId}, Type: ${
      nodes.find((n) => n.id === currentNodeId)?.type
    }, Outgoing edges found: ${outgoingEdges.length}. Total nodes in flow: ${nodes.length}`,
  );
  logger.flow.info(
    `[FlowEngine] Current nodes: ${nodes.map((n) => `${n.id}(${n.type})`).join(", ")}`,
  );
  const originalCount = outgoingEdges.length;
  outgoingEdges.forEach((e) =>
    logger.flow.info(
      `  - Edge to ${e.target} has sourceHandle: "${e.sourceHandle}"`,
    ),
  );

  // If we're coming from a node with multiple handles (like Condition, List, Message with Buttons),
  // we should try to match the sourceHandle if provided.
  if (sourceHandle) {
    const cleanSourceHandle = String(sourceHandle).trim().toLowerCase();
    logger.flow.info(
      `[FlowEngine] Resuming at node ${currentNodeId}. User clicked button/handle: "${cleanSourceHandle}"`,
    );

    // Log all available handles for debugging
    outgoingEdges.forEach((e) => {
      logger.flow.info(
        `  -> Available path on this node: "${e.sourceHandle}" (target: ${e.target})`,
      );
    });

    const specificEdges = outgoingEdges.filter((e) => {
      const edgeHandle = String(e.sourceHandle || "")
        .trim()
        .toLowerCase();
      // Match by ID (sourceHandle)
      if (edgeHandle === cleanSourceHandle) return true;

      // Also try to match by the "Title" of the interaction if we can find it in the current node
      const currentNode = nodes.find((n) => n.id === currentNodeId);
      if (
        currentNode &&
        (currentNode.type === "message" ||
          currentNode.type === "media" ||
          currentNode.type === "list" ||
          currentNode.type === "carousel" ||
          currentNode.type === "single_product" ||
          currentNode.type === "multi_product" ||
          currentNode.type === "catalogue" ||
          currentNode.type === "template" ||
          currentNode.type === "quick_reply")
      ) {
        const buttons = currentNode.data?.buttons || [];
        const cardButtons = (currentNode.data?.cards || []).flatMap(
          (c: any) => c.buttons || [],
        );
        const listItems = (currentNode.data?.sections || []).flatMap(
          (s: any) => s.rows || s.items || [],
        );
        const allInteractions = [...buttons, ...cardButtons, ...listItems];

        for (const i of allInteractions) {
          const iId = String(i.id || "").trim().toLowerCase();
          const iText = String(i.text || i.title || "").trim().toLowerCase();

          // Did the user click/type this interaction?
          const userMatchedThis = (cleanSourceHandle === iId) || (cleanSourceHandle === iText);

          // Does the edge handle match this interaction's ID or Title?
          const edgeMatchesThis = (edgeHandle === iId) || (edgeHandle === iText);

          if (userMatchedThis && edgeMatchesThis) return true;
        }
      }

      return false;
    });

    if (specificEdges.length > 0) {
      logger.flow.success(
        `[FlowEngine] MATCH FOUND! Following path for interaction "${cleanSourceHandle}"`,
      );
      outgoingEdges = [specificEdges[0]];
    } else {
      // If we have a sourceHandle (button click) but NO edge matches it,
      // check for a generic fallback
      const fallbackEdge = outgoingEdges.find(
        (e) =>
          e.sourceHandle === "right" ||
          !e.sourceHandle ||
          e.sourceHandle === "default",
      );
      if (fallbackEdge) {
        logger.flow.success(
          `[FlowEngine] No specific match for "${cleanSourceHandle}", using generic fallback.`,
        );
        outgoingEdges = [fallbackEdge];
      } else {
        logger.flow.warn(
          `[FlowEngine] No path found for interaction "${cleanSourceHandle}". Stopping flow.`,
        );
        return false;
      }
    }
  }

  if (outgoingEdges.length === 0) {
    // We reached an end node or an interactive node with no paths
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    const isWaitingNode =
      currentNode &&
      ([
        "input",
        "ask_question",
        "ask_address",
        "ask_location",
        "ask_media",
      ].includes(currentNode.type) ||
        currentNode.type === "list" ||
        ((currentNode.type === "message" || currentNode.type === "media") &&
          currentNode.data?.buttons?.length > 0));

    if (!isWaitingNode) {
      logger.flow.info(
        `[executeFlowFromNode] Reached end of flow at node ${currentNodeId}. Marking as completed.`,
      );
      await prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: "completed", endedAt: new Date() },
      });
    }
    return true; // We "moved" to the end
  }

  let moved = false;
  for (let i = 0; i < outgoingEdges.length; i++) {
    const edge = outgoingEdges[i];
    const nextNode = nodes.find((n) => n.id === edge.target);
    if (!nextNode) continue;

    // If this is not the first branch being processed, add a slight delay (1000ms)
    // to prevent messages from being delivered out of order or overwhelming the client.
    if (i > 0) {
      logger.flow.info(
        `[executeFlowFromNode] Multiple branches detected. Waiting 1000ms before starting branch ${i + 1}...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    try {
      if (nextNode.type === "message") {
        const messageType = nextNode.data?.messageType || "text";

        if (messageType === "template") {
          const templateName = nextNode.data?.templateName;
          const templateLanguage = nextNode.data?.templateLanguage || "en";
          const templateParams = nextNode.data?.templateParams || {};

          if (!templateName) throw new Error("Template name missing");

          const parameters: any[] = [];
          const keys = Object.keys(templateParams).sort(
            (a, b) => parseInt(a) - parseInt(b),
          );

          for (const key of keys) {
            const processedValue = await getProcessedText(
              templateParams[key],
              context,
            );
            parameters.push({ type: "text", text: processedValue });
          }

          const components =
            parameters.length > 0 ? [{ type: "body", parameters }] : undefined;

          await sendTranslatedMessage(
            {
              contactId: context.contactId,
              templateName,
              templateLanguage,
              templateComponents: components,
              message: `Template: ${templateName}`,
              skipWindowCheck: true,
            },
            context,
          );
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "completed",
            { templateName },
          );
        } else {
          // Check for delay in message node data
          const nodeDelay = parseFloat(nextNode.data?.delay || "0");
          if (nodeDelay > 0) {
            logger.flow.info(
              `[FlowEngine] Waiting for node delay: ${nodeDelay}s`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, nodeDelay * 1000),
            );
          }

          const processedMessage = await getProcessedText(
            nextNode.data?.message || "",
            context,
          );
          const buttons = nextNode.data?.buttons || [];

          if (buttons.length > 0) {
            // Localize button titles
            const processedButtons = await Promise.all(
              buttons.map(async (b: any) => {
                let title = b.text;
                /*
                            if (b.text && context.language !== 'en' && context.language !== 'auto') {
                                try {
                                    const { translateText } = await import('@/lib/ai/translate');
                                    const textToTranslate = b.text;
                                    title = await translateText(textToTranslate, context.language ?? 'en');
                                } catch (err) {}
                            }
                            */
                return { ...b, text: title };
              }),
            );

            // Send interactive message
            const interactiveData = {
              type: "button",
              body: { text: processedMessage },
              action: {
                buttons: processedButtons,
              },
            };

            // We need to implement internalSendInteractiveMessage or use internalSendWhatsAppMessage with custom structure
            // For now, let's assume internalSendWhatsAppMessage can handle it if we pass the structure
            await sendTranslatedMessage(
              {
                contactId: context.contactId,
                message: processedMessage,
                interactiveData,
                skipWindowCheck: true,
              },
              context,
            );
            await logExecutionStep(
              executionId,
              nextNode.id,
              nextNode.type,
              "completed",
              { sent: processedMessage, buttons },
            );

            // PAUSE execution to wait for button click
            logger.flow.info(
              `[executeFlowFromNode] Pausing flow at node ${nextNode.id} for button click`,
            );
            await prisma.flowExecution.update({
              where: { id: executionId },
              data: {
                status: "paused",
                context: { ...context, pausedNodeId: nextNode.id } as any,
              },
            });
            moved = true;
            continue; // Continue to NEXT edge instead of returning
          } else {
            await sendTranslatedMessage(
              {
                contactId: context.contactId,
                message: processedMessage,
                skipWindowCheck: true,
              },
              context,
            );
            await new Promise((resolve) => setTimeout(resolve, 800));
            await logExecutionStep(
              executionId,
              nextNode.id,
              nextNode.type,
              "completed",
              { sent: processedMessage },
            );
          }
        }

        // Recurse to next nodes (only if not paused)
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "delay") {
        const duration = nextNode.data?.duration || 0;
        const unit = nextNode.data?.unit || "seconds";
        let seconds = duration;
        if (unit === "minutes") seconds *= 60;
        if (unit === "hours") seconds *= 3600;

        logger.flow.info(
          `[FlowEngine] Delay node reached. Scheduling resumption in ${seconds}s`,
        );

        // Mark execution as paused for delay
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: {
            status: "paused",
            context: { ...context, pausedNodeId: nextNode.id } as any,
          },
        });

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "paused",
          { duration, unit },
        );

        // Schedule resumption (handles local dev automatically)
        const { scheduleFlowResumption } = await import("@/lib/flows/queue");
        await scheduleFlowResumption({
          executionId,
          nodeId: nextNode.id,
          organizationId: context.organizationId,
          seconds,
        });

        return true; // Stop current execution thread, will be resumed by QStash
      } else if (nextNode.type === "input" || nextNode.type === "askInput") {
        // PAUSE EXECUTION
        logger.flow.info(
          `[executeFlowFromNode] Pausing flow at node ${nextNode.id} for user input`,
        );

        await prisma.flowExecution.update({
          where: { id: executionId },
          data: {
            status: "paused",
            context: {
              ...context,
              pausedNodeId: nextNode.id,
            } as any,
          },
        });

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "paused",
        );
        moved = true;
        continue; // Stop current execution thread branch
      } else if (nextNode.type === "condition") {
        const result = evaluateCondition(nextNode.data, context);
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { result },
        );

        const handle = result ? "true" : "false";
        // Recurse SPECIFICALLY for the correct handle
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
          handle,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "quick_reply") {
        let content = nextNode.data?.quickReplyContent || "";
        if (!content && nextNode.data?.quickReplyId) {
          try {
            const qr = await prisma.quickReply.findUnique({ where: { id: nextNode.data.quickReplyId } });
            if (qr) content = qr.content || qr.fileName || "";
          } catch (e) {}
        }
        if (content) {
          const processedMessage = await getProcessedText(content, context);
          await sendTranslatedMessage(
            {
              contactId: context.contactId,
              message: processedMessage,
              skipWindowCheck: true,
            },
            context,
          );
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "completed",
            { sent: processedMessage },
          );
        }
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "media") {
        const contentType = nextNode.data?.contentType || "image";
        const fileUrl = nextNode.data?.fileUrl;
        const caption = nextNode.data?.message;
        const buttons = nextNode.data?.buttons || [];
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (fileUrl) {
          if (delay > 0) {
            logger.flow.info(`[FlowEngine] Waiting for media delay: ${delay}s`);
            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
          }

          await sendTranslatedMessage(
            {
              contactId: context.contactId,
              message: caption,
              mediaUrl: fileUrl,
              interactiveData:
                buttons.length > 0
                  ? {
                      type: "button",
                      body: { text: caption || " " },
                      action: { buttons },
                    }
                  : undefined,
              skipWindowCheck: true,
            },
            context,
          );
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "completed",
            { contentType, fileUrl, caption, buttonCount: buttons.length },
          );

          // If it has buttons, we PAUSE here and wait for reply
          if (buttons.length > 0) {
            logger.flow.info(
              `[FlowEngine] Media Node ${nextNode.id} has buttons. Pausing execution.`,
            );
            await prisma.flowExecution.update({
              where: { id: executionId },
              data: {
                status: "paused",
                context: {
                  ...context,
                  pausedNodeId: nextNode.id,
                } as any,
              },
            });
            moved = true;
            continue; // Stop traversal for this branch
          }
        }

        // Recurse to next nodes (only if no buttons)
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "list") {
        const header = nextNode.data?.header;
        const body = await getProcessedText(nextNode.data?.body || "", context);
        const footer = nextNode.data?.footer;
        const buttonText = nextNode.data?.buttonText;
        const sections = nextNode.data?.sections || [];
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (delay > 0) {
          logger.flow.info(`[FlowEngine] Waiting for list delay: ${delay}s`);
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }

        // TODO: Implement List Message for Instagram/TikTok if supported
        const { internalSendListMessage } = await import("@/lib/whatsapp/api");
        await internalSendListMessage(
          context.contactId,
          header,
          body,
          footer,
          buttonText,
          sections,
          context.contact,
        );
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { header, body, sectionCount: sections.length },
        );

        // ALWAYS pause for list nodes
        logger.flow.info(
          `[FlowEngine] List Node ${nextNode.id} sent. Pausing execution.`,
        );
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: {
            status: "paused",
            context: {
              ...context,
              pausedNodeId: nextNode.id,
            } as any,
          },
        });
        moved = true;
        continue; // ALWAYS pause for list nodes branch
      } else if (nextNode.type === "single_product") {
        const body = await getProcessedText(nextNode.data?.body || "", context);
        const footer = nextNode.data?.footer;
        const product = nextNode.data?.product;
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (product) {
          if (delay > 0) {
            logger.flow.info(
              `[FlowEngine] Waiting for product delay: ${delay}s`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
          }

          const { internalSendProductMessage } =
            await import("@/lib/whatsapp/api");
          // We need a catalog_id. Usually this is stored in organization or node data.
          // For now let's check if it's in node data or assume a default from organization if available.
          const catalogId =
            nextNode.data?.catalogId ||
            context.contact?.organization?.whatsappCatalogId;

          await internalSendProductMessage(
            context.contactId,
            body,
            footer,
            catalogId,
            product.retailer_id,
            context.contact,
          );
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "completed",
            { productId: product.retailer_id },
          );
        }

        if (outgoingEdges.length > 0) {
          await prisma.flowExecution.update({
            where: { id: executionId },
            data: {
              status: "paused",
              context: { ...context, pausedNodeId: nextNode.id } as any,
            },
          });
          moved = true;
          continue;
        }
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "multi_product") {
        const header = nextNode.data?.header;
        const body = await getProcessedText(nextNode.data?.body || "", context);
        const footer = nextNode.data?.footer;
        const sections = nextNode.data?.sections || [];
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (delay > 0) {
          logger.flow.info(
            `[FlowEngine] Waiting for multi-product delay: ${delay}s`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }

        const { internalSendMultiProductMessage } =
          await import("@/lib/whatsapp/api");
        const catalogId =
          nextNode.data?.catalogId ||
          context.contact?.organization?.whatsappCatalogId;

        await internalSendMultiProductMessage(
          context.contactId,
          header,
          body,
          footer,
          catalogId,
          sections,
          context.contact,
        );
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { sectionCount: sections.length },
        );

        if (outgoingEdges.length > 0) {
          await prisma.flowExecution.update({
            where: { id: executionId },
            data: {
              status: "paused",
              context: { ...context, pausedNodeId: nextNode.id } as any,
            },
          });
          moved = true;
          continue;
        }
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type?.toLowerCase() === "template") {
        const templateName = nextNode.data?.templateName;
        const templateLanguage =
          nextNode.data?.language || nextNode.data?.templateLanguage || "en_US";
        const templateParams =
          nextNode.data?.variables || nextNode.data?.templateParams || {};

        logger.flow.info(
          `[FlowEngine] Match Found! Executing Template Node: ${nextNode.id} (Template: ${templateName}, Lang: ${templateLanguage}, Params: ${JSON.stringify(templateParams)})`,
        );

        if (!templateName) {
          logger.flow.error(
            `[FlowEngine] Template name missing for node ${nextNode.id}`,
          );
          throw new Error("Template name missing");
        }

        const parameters: any[] = [];
        const keys = Object.keys(templateParams).sort(
          (a, b) => parseInt(a) - parseInt(b),
        );

        for (const key of keys) {
          const processedValue = await getProcessedText(
            templateParams[key],
            context,
          );
          parameters.push({ type: "text", text: processedValue });
        }

        const components =
          parameters.length > 0 ? [{ type: "body", parameters }] : undefined;

        await sendTranslatedMessage(
          {
            contactId: context.contactId,
            templateName,
            templateLanguage,
            templateComponents: components,
            message: `Template: ${templateName}`,
            skipWindowCheck: true,
          },
          context,
        );

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { templateName },
        );

        const hasButtons = (nextNode.data?.buttons || []).length > 0;
        const hasOutgoingEdges = edges.some((e) => e.source === nextNode.id);

        if (hasButtons && hasOutgoingEdges) {
          logger.flow.info(
            `[executeFlowFromNode] Pausing flow at template node ${nextNode.id} for button click`,
          );
          await prisma.flowExecution.update({
            where: { id: executionId },
            data: {
              status: "paused",
              context: { ...context, pausedNodeId: nextNode.id } as any,
            },
          });
          moved = true;
          continue;
        }

        // Recurse to next nodes
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "order_info") {
        // Retrieve order info from context
        let order = context.variables?.order;
        const orderNumberVar = nextNode.data?.orderNumberVariable;
        const specificOrderNumber = orderNumberVar
          ? context.variables?.[orderNumberVar]
          : null;

        // If a specific order number was provided (e.g. from an Ask Order Number node), fetch it!
        if (specificOrderNumber) {
          logger.flow.info(
            `[FlowEngine] Fetching specific order #${specificOrderNumber} as requested by variable "${orderNumberVar}"`,
          );

          // Cleanup the order number (remove # if present)
          const cleanOrderNumber = String(specificOrderNumber)
            .replace("#", "")
            .trim();

          const specificOrder = await prisma.shopifyOrder.findFirst({
            where: {
              organizationId: context.organizationId,
              orderNumber: { contains: cleanOrderNumber },
            },
            orderBy: { createdAt: "desc" },
          });

          if (specificOrder) {
            logger.flow.info(
              `[FlowEngine] Found specific order ${specificOrder.orderNumber} in DB.`,
            );
            order = {
              id: specificOrder.shopifyOrderId,
              number: specificOrder.orderNumber,
              total: specificOrder.totalPrice,
              currency: specificOrder.currency,
              status: specificOrder.status,
            };

            // Update context
            context.variables["order"] = order;
            context.variables["order.number"] = order.number;
            context.variables["order.total"] = order.total;
            context.variables["order.currency"] = order.currency;
            context.variables["order.status"] = order.status;
          } else {
            logger.flow.warn(
              `[FlowEngine] Could not find order #${cleanOrderNumber} in DB.`,
            );
          }
        }
        // Fallback: If not found in context (e.g. flow triggered by keyword), try to fetch latest order for this contact
        else if ((!order || !order.number) && context.contactId) {
          logger.flow.info(
            `[FlowEngine] Order info missing in context, attempting DB lookup for contact ${context.contactId}`,
          );
          const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
            select: { waId: true, organizationId: true },
          });

          if (contact) {
            // Try to match by waId (cleaned phone)
            const latestOrder = await prisma.shopifyOrder.findFirst({
              where: {
                organizationId: contact.organizationId,
                customerPhone: { contains: contact.waId },
              },
              orderBy: { createdAt: "desc" },
            });

            if (latestOrder) {
              logger.flow.info(
                `[FlowEngine] Found latest order ${latestOrder.orderNumber} in DB for contact.`,
              );
              order = {
                id: latestOrder.shopifyOrderId,
                number: latestOrder.orderNumber,
                total: latestOrder.totalPrice,
                currency: latestOrder.currency,
                status: latestOrder.status,
              };
              // Update context so subsequent nodes (like message nodes) can use {{order.number}}
              context.variables["order"] = order;
              context.variables["order.number"] = order.number;
              context.variables["order.total"] = order.total;
              context.variables["order.currency"] = order.currency;
              context.variables["order.status"] = order.status;
            }
          }
        }

        const orderId = order?.id || order?.number || "unknown";
        logger.flow.info(
          `[FlowEngine] Order Info Node Resolved: ${JSON.stringify(order || {})}`,
        );

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { orderId },
        );

        // Recurse to next nodes
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "shopify_action") {
        const action = nextNode.data?.action || "none";
        logger.flow.info(`[FlowEngine] Shopify Action Node: ${action}`);

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { action },
        );

        // Recurse to next nodes
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "carousel") {
        const cards = nextNode.data?.cards || [];
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (cards.length > 0) {
          if (delay > 0) {
            logger.flow.info(
              `[FlowEngine] Waiting for carousel delay: ${delay}s`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
          }

          const elements = await Promise.all(
            cards.map(async (card: any) => ({
              title: await getProcessedText(card.title || "", context),
              subtitle: await getProcessedText(card.subtitle || "", context),
              image_url: card.image_url,
              buttons: card.buttons?.map((btn: any) => {
                if (btn.url) {
                  return {
                    type: "web_url",
                    url: btn.url,
                    title: btn.text,
                  };
                }
                return {
                  type: "postback",
                  title: btn.text,
                  payload: btn.id || btn.text,
                };
              }),
            })),
          );

          const interactiveData = {
            type: "template",
            payload: {
              template_type: "generic",
              elements,
            },
          };

          const sentCarouselMessage = await sendTranslatedMessage(
            {
              contactId: context.contactId,
              message: "Carousel",
              interactiveData,
              skipWindowCheck: true,
            },
            context,
          );
          if (sentCarouselMessage?.id) {
            const existingRawBody =
              typeof sentCarouselMessage.rawBody === "object" &&
              sentCarouselMessage.rawBody
                ? sentCarouselMessage.rawBody
                : {};
            await prisma.message.update({
              where: { id: sentCarouselMessage.id },
              data: {
                type: "template",
                rawBody: {
                  ...existingRawBody,
                  sentPayload: {
                    message: {
                      attachment: {
                        type: "template",
                        payload: interactiveData.payload,
                      },
                    },
                  },
                } as any,
              },
            });
          }
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "completed",
            { cardCount: cards.length },
          );

          // ALWAYS pause for carousel nodes if they have postback buttons
          const hasPostback = cards.some((c: any) =>
            c.buttons?.some((b: any) => !b.url),
          );
          if (hasPostback) {
            logger.flow.info(
              `[FlowEngine] Carousel Node ${nextNode.id} has postback buttons. Pausing execution.`,
            );
            await prisma.flowExecution.update({
              where: { id: executionId },
              data: {
                status: "paused",
                context: { ...context, pausedNodeId: nextNode.id } as any,
              },
            });
            moved = true;
            continue;
          }
        }
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (
        ["ask_question", "ask_address", "ask_location", "ask_media"].includes(
          nextNode.type,
        )
      ) {
        const question = await getProcessedText(
          nextNode.data?.question || "",
          context,
        );
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (delay > 0) {
          logger.flow.info(
            `[FlowEngine] Waiting for ${nextNode.type} delay: ${delay}s`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }

        if (question) {
          await sendTranslatedMessage(
            {
              contactId: context.contactId,
              message: question,
              skipWindowCheck: true,
            },
            context,
          );
        }

        // PAUSE EXECUTION
        logger.flow.info(
          `[executeFlowFromNode] Pausing flow at node ${nextNode.id} for ${nextNode.type} input`,
        );
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: {
            status: "paused",
            context: { ...context, pausedNodeId: nextNode.id } as any,
          },
        });
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "paused",
          { question },
        );
        moved = true;
        continue;
      } else if (nextNode.type === "public_reply") {
        const message = await getProcessedText(nextNode.data?.message || "", context);
        const commentId = context.metadata?.commentId;

        if (commentId && message) {
          try {
            if (context.metadata?.platform === 'FACEBOOK_COMMENT') {
              const { replyToFacebookComment } = await import('@/lib/facebook/api');
              await replyToFacebookComment({
                organizationId: context.organizationId,
                commentId,
                message
              });
            } else if (context.metadata?.platform === 'INSTAGRAM_COMMENT') {
              const { replyToInstagramComment } = await import('@/lib/instagram/api');
              await replyToInstagramComment({
                organizationId: context.organizationId,
                commentId,
                message
              });
            }
            
            await logExecutionStep(
              executionId,
              nextNode.id,
              nextNode.type,
              "completed",
              { message }
            );
          } catch (err: any) {
             logger.flow.error(`[FlowEngine] Public reply failed: ${err.message}`);
          }
        }

        // Recurse to next nodes
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "catalogue") {
        const body = await getProcessedText(nextNode.data?.body || "", context);
        const footer = nextNode.data?.footer;
        const delay = parseFloat(nextNode.data?.delay || "0");

        if (delay > 0) {
          logger.flow.info(
            `[FlowEngine] Waiting for catalogue delay: ${delay}s`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }

        const { internalSendCatalogueMessage } =
          await import("@/lib/whatsapp/api");
        await internalSendCatalogueMessage(
          context.contactId,
          body,
          footer,
          context.contact,
        );
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
        );

        if (outgoingEdges.length > 0) {
          await prisma.flowExecution.update({
            where: { id: executionId },
            data: {
              status: "paused",
              context: { ...context, pausedNodeId: nextNode.id } as any,
            },
          });
          moved = true;
          continue;
        }
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) return true;
      } else if (nextNode.type === "set_attribute") {
        const attribute = nextNode.data?.attribute || nextNode.data?.variable;
        const value = await getProcessedText(
          String(nextNode.data?.value || ""),
          context,
        );
        if (attribute) {
          if (!context.variables) context.variables = {};
          context.variables[attribute] = value;
          logger.flow.info(
            `[FlowEngine] Set attribute: ${attribute} = ${value}`,
          );
        }
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { attribute, value },
        );
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) return true;
      } else if (nextNode.type === "google_sheets") {
        logger.flow.info(
          `[executeFlowFromNode] Executing Google Sheets node: ${nextNode.id}`,
        );
        const spreadsheetId = nextNode.data?.spreadsheetId;
        const sheetName = nextNode.data?.sheetName || "Sheet1";
        const mappings = nextNode.data?.mappings || [];

        // Prepare row data from variables
        const rowData: Record<string, any> = {};
        if (mappings.length > 0) {
          for (const mapping of mappings) {
            const column = mapping.column || mapping.attribute; // Fallback to attribute name if column is empty
            if (column && mapping.attribute) {
              rowData[column] = await getProcessedText(
                mapping.attribute,
                context,
              );
            }
          }
        } else {
          // Fallback: If no mappings defined, take all variables
          Object.assign(rowData, context.variables);
        }

        logger.flow.info(
          `[executeFlowFromNode] Writing to Google Sheets: ${spreadsheetId}`,
        );

        try {
          const { appendToGoogleSheet } =
            await import("./integrations/google-sheets");
          await appendToGoogleSheet(
            spreadsheetId,
            sheetName,
            rowData,
            context.organizationId,
          );
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "completed",
            { rowData },
          );
        } catch (err: any) {
          logger.flow.error(`[GoogleSheets Error] ${err.message}`);
          await logExecutionStep(
            executionId,
            nextNode.id,
            nextNode.type,
            "failed",
            { error: err.message },
          );
        }

        // Proceed to next node
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "add-tag" || nextNode.type === "add_tag") {
        const tagIds = nextNode.data?.tagIds || [];
        if (tagIds.length > 0) {
          logger.flow.info(
            `[FlowEngine] Applying ${tagIds.length} tags from AddTag node for contact ${context.contactId}`,
          );
          await prisma.contact.update({
            where: { id: context.contactId },
            data: {
              tags: {
                connect: tagIds.map((id: string) => ({ id })),
              },
            },
          });
        }
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { tagIds },
        );

        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (
        nextNode.type === "conversions_api" ||
        nextNode.type === "conversions-api"
      ) {
        logger.flow.info(
          `[executeFlowFromNode] Sending Meta Conversions API event from node: ${nextNode.id}`,
        );

        const result = await sendMetaConversionsApiEvent(
          nextNode.data || {},
          context,
          executionId,
          nextNode.id,
        );

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          result,
        );

        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "whatsapp_forms") {
        logger.flow.info(
          `[executeFlowFromNode] Sending Meta Flow from node: ${nextNode.id}`,
        );

        const flowIdValue = String(nextNode.data?.flowId || "").trim();
        if (!flowIdValue) {
          throw new Error("WhatsApp Form node missing flowId");
        }

        const flowActionRaw = String(
          nextNode.data?.action || "navigate",
        ).toLowerCase();
        const flowAction =
          flowActionRaw === "data_exchange" ? "data_exchange" : "navigate";

        let flowData: Record<string, unknown> | undefined;
        const selectedAttribute = String(nextNode.data?.attribute || "").trim();
        if (selectedAttribute) {
          const variableValue = context.variables?.[selectedAttribute];
          if (variableValue !== undefined) {
            flowData = { [selectedAttribute]: variableValue };
          }
        }

        await sendTranslatedMessage(
          {
            contactId: context.contactId,
            message:
              nextNode.data?.body ||
              nextNode.data?.buttonTitle ||
              "Please complete this form.",
            flowPayload: {
              flowId: flowIdValue,
              flowToken: nextNode.data?.flowToken,
              flowMode: nextNode.data?.status || "published",
              flowAction,
              flowCta: nextNode.data?.buttonTitle || "Open Form",
              flowScreen: nextNode.data?.screenName,
              flowData,
              headerText: nextNode.data?.header,
              bodyText: nextNode.data?.body,
              footerText: nextNode.data?.footer,
            },
            skipWindowCheck: true,
          },
          context,
        );

        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          {
            flowId: flowIdValue,
            flowAction,
          },
        );

        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      } else if (nextNode.type === "ai_knowledge") {
        const { organizationId } = context;
        const agentId = nextNode.data?.agentId || undefined;
        const agentName = nextNode.data?.agentName || "Default Agent";
        
        logger.flow.info(`[FlowEngine] Reached AI Knowledge node ${nextNode.id} (Agent: ${agentName})`);

        // Get AI Response
        const { getAIResponse } = await import("@/lib/ai/openai");
        
        // Fetch chat history
        const recentMessages = await prisma.message.findMany({
          where: { contactId: context.contactId },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: { direction: true, content: true, mediaUrl: true, type: true }
        });
        const messagesForHistory = recentMessages.reverse();
        if (messagesForHistory.length > 0 && messagesForHistory[messagesForHistory.length - 1].direction === 'inbound') {
          messagesForHistory.pop();
        }
        const { getAppBaseUrl } = await import("@/lib/storage/media");
        const appBase = getAppBaseUrl();

        const chatHistory = messagesForHistory.map(msg => {
          let text = msg.content || '';
          if (msg.mediaUrl) {
            const fullMediaUrl = msg.mediaUrl.startsWith('http://') || msg.mediaUrl.startsWith('https://')
              ? msg.mediaUrl
              : `${appBase}${msg.mediaUrl.startsWith('/') ? '' : '/'}${msg.mediaUrl}`;
            if (text === '[Image]' || text === '[Document]' || text === '[Video]' || text === '[Audio]') {
              text = `[Attachment ${msg.type || 'file'}: ${fullMediaUrl}]`;
            } else if (!text.includes(fullMediaUrl)) {
              text = `${text} [Attachment: ${fullMediaUrl}]`;
            }
          }
          return {
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: text
          };
        });

        // Determine prompt
        const prompt = context.text || "Hello";

        // Build configured tools
        const { buildConfiguredAITools } = await import("@/lib/ai/configured-tools");
        const configuredTools = await buildConfiguredAITools({
          organizationId,
          contactId: context.contactId,
          baseTools: [],
          baseToolHandlers: {},
        });

        // Run AI Q&A
        const nodeStartTime = Date.now();
        const { getAIResponseWithDetails } = await import("@/lib/ai/openai");
        const aiDetails = await getAIResponseWithDetails(prompt, {
          organizationId,
          contactId: context.contactId,
          aiAgentId: agentId,
          history: chatHistory,
          tools: configuredTools.tools,
          toolHandlers: configuredTools.toolHandlers,
        });

        if (aiDetails?.text) {
          const { processAIJsonResponse } = await import("@/lib/ai/lead-saver");
          const processedAI = await processAIJsonResponse({
            rawAiResponse: aiDetails.rawAiOutput || aiDetails.text,
            organizationId,
            contactId: context.contactId,
            fallbackPhone: context.contact?.waId,
            aiAgentId: aiDetails.agentId || agentId,
            aiAgentName: aiDetails.agentName || agentName,
            provider: aiDetails.provider,
            model: aiDetails.model,
            systemPromptUsed: aiDetails.systemPrompt,
            retrievedChunks: aiDetails.retrievedChunks || [],
            durationMs: aiDetails.durationMs || (Date.now() - nodeStartTime),
            userPrompt: prompt,
          });

          // Configurable AI Agent Response Delay
          const nodeDelaySeconds = typeof (aiDetails as any)?.delaySeconds === 'number' ? (aiDetails as any).delaySeconds : 0;
          if (nodeDelaySeconds > 0) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(nodeDelaySeconds, 120) * 1000));
          }

          await sendTranslatedMessage(
            {
              contactId: context.contactId,
              message: processedAI.textMessage,
              skipWindowCheck: true,
            },
            context
          );

          if (processedAI.media && processedAI.media.length > 0) {
            try {
              const { sendAIMediaResponses } = await import("@/lib/ai/ai-media-handler");
              await sendAIMediaResponses({
                organizationId,
                contactId: context.contactId,
                mediaList: processedAI.media,
                flowContext: context,
              });
            } catch (mediaErr: any) {
              logger.flow.error(`[FlowEngine] Error dispatching node AI media: ${mediaErr.message}`);
            }
          }
        }

        // Log the step
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { agentId, agentName, response: aiDetails?.text || "" }
        );

        // Find the outgoing edge for "general" handle or standard fallback
        const outgoingEdge = outgoingEdges.find(
          (e) => e.sourceHandle === "general" || e.sourceHandle === "right" || !e.sourceHandle || e.sourceHandle === "default"
        );

        if (outgoingEdge) {
          const subMoved = await executeFlowFromNode(
            flowId,
            outgoingEdge.target,
            nodes,
            edges,
            context,
            executionId,
          );
          if (subMoved) moved = true;
        } else {
          // If no outgoing edge is connected, stop execution (completed)
          await prisma.flowExecution.update({
            where: { id: executionId },
            data: { status: "completed", endedAt: new Date() },
          });
          moved = true;
        }
        continue;
      } else if (nextNode.type === "request_intervention") {
        const agentIds = nextNode.data?.agentIds || [];

        logger.flow.info(
          `[FlowEngine] Requesting intervention for contact ${context.contactId}. Agents: ${agentIds.join(", ")}`,
        );

        await prisma.contact.update({
          where: { id: context.contactId },
          data: {
            isAiBotEnabled: false,
            assignedUsers:
              agentIds.length > 0
                ? {
                    set: agentIds.map((id: string) => ({ id })),
                  }
                : undefined,
          },
        });

        // 2. Trigger Pusher notifications
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
            const { getPusherServer } = await import("@/lib/pusher");
            const pusher = getPusherServer({
              appId: systemConfig.pusherAppId,
              key: systemConfig.pusherKey,
              secret: systemConfig.pusherSecret,
              cluster: systemConfig.pusherCluster,
            });

            // Notify org channel about the intervention
            await pusher.trigger(
              `org-${context.organizationId}`,
              "contact:intervened",
              {
                contactId: context.contactId,
                agentIds,
                contactName: context.contact?.name || context.contact?.waId,
              },
            );

            // Notify individual assigned agents
            for (const agentId of agentIds) {
              await pusher.trigger(`user-${agentId}`, "chat:assigned", {
                contactId: context.contactId,
                contactName: context.contact?.name || context.contact?.waId,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (pusherErr) {
          logger.flow.warn(
            `[FlowEngine] Pusher notification failed: ${pusherErr}`,
          );
        }

        // 3. Log the step
        await logExecutionStep(
          executionId,
          nextNode.id,
          nextNode.type,
          "completed",
          { agentIds },
        );

        // 4. Mark execution as completed and STOP traversal
        await prisma.flowExecution.update({
          where: { id: executionId },
          data: { status: "completed" },
        });

        moved = true;
        continue;
      } else {
        // For other nodes like 'trigger' (default traversal)
        const subMoved = await executeFlowFromNode(
          flowId,
          nextNode.id,
          nodes,
          edges,
          context,
          executionId,
        );
        if (subMoved) moved = true;
      }
    } catch (error: any) {
      logger.flow.error(
        `Error executing node ${nextNode.id}: ${error.message}`,
      );
      await logExecutionStep(
        executionId,
        nextNode.id,
        nextNode.type,
        "failed",
        { error: error.message },
      );
    }
  }

  // Final return statement for executeFlowFromNode
  return moved || outgoingEdges.length > 0;
}

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizeMetaEventName(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "purchase") return "Purchase";
  if (normalized === "contact") return "Contact";
  if (normalized === "completeregistration") return "CompleteRegistration";
  return "Lead";
}

async function sendMetaConversionsApiEvent(
  nodeData: Record<string, unknown>,
  context: FlowContext,
  executionId: string,
  nodeId: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: context.organizationId },
    select: {
      metaAccessToken: true,
      facebookAdsAccessToken: true,
    },
  });

  const accessToken = org?.facebookAdsAccessToken || org?.metaAccessToken;
  if (!accessToken) {
    throw new Error("Meta access token is missing. Connect Meta Ads or Facebook first.");
  }

  const rawEventSourceId = await getProcessedText(
    String(nodeData.eventSourceId || nodeData.datasetId || nodeData.pixelId || ""),
    context,
  );
  const eventSourceId = rawEventSourceId.trim();
  if (!eventSourceId) {
    throw new Error("Meta Dataset / Pixel ID is required.");
  }

  const contact =
    context.contact ||
    (await prisma.contact.findUnique({
      where: { id: context.contactId },
      select: {
        id: true,
        waId: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
      },
    }));

  const userData: Record<string, string[]> = {
    external_id: [sha256(context.contactId)],
  };

  const phone = String(contact?.waId || "").replace(/\D/g, "");
  if (phone) userData.ph = [sha256(phone)];
  if (contact?.email) userData.em = [sha256(String(contact.email))];
  if (contact?.firstName) userData.fn = [sha256(String(contact.firstName))];
  if (contact?.lastName) userData.ln = [sha256(String(contact.lastName))];

  const conversionType = await getProcessedText(
    String(nodeData.conversionType || nodeData.eventName || "Lead"),
    context,
  );
  const eventName = normalizeMetaEventName(conversionType);
  const amountText = await getProcessedText(String(nodeData.amount || ""), context);
  const value = Number(amountText.replace(/,/g, "").trim());
  const currency = String(nodeData.currency || "").trim().toUpperCase();
  const customData: Record<string, unknown> = {};

  if (Number.isFinite(value) && amountText.trim() !== "") {
    customData.value = value;
    if (currency) customData.currency = currency;
  }

  const actionSource = String(nodeData.actionSource || "business_messaging").trim();
  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: `${executionId}-${nodeId}`,
    action_source: actionSource,
    user_data: userData,
  };

  if (Object.keys(customData).length > 0) {
    event.custom_data = customData;
  }

  const payload: Record<string, unknown> = { data: [event] };
  const testEventCode = String(nodeData.testEventCode || "").trim();
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(eventSourceId)}/events?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result?.error) {
    throw new Error(result?.error?.message || `Meta Conversions API failed with status ${response.status}`);
  }

  return {
    eventName,
    eventSourceId,
    actionSource,
    eventId: event.event_id,
    response: result,
  };
}

async function logExecutionStep(
  executionId: string,
  nodeId: string,
  nodeType: string,
  status: string,
  data?: any,
) {
  try {
    const execution = await prisma.flowExecution.findUnique({
      where: { id: executionId },
      select: { logs: true },
    });

    if (!execution) return;

    const logs = Array.isArray(execution.logs) ? execution.logs : [];
    logs.push({
      nodeId,
      nodeType,
      status,
      timestamp: new Date().toISOString(),
      data,
    });

    await prisma.flowExecution.update({
      where: { id: executionId },
      data: { logs },
    });
  } catch (err) {
    console.error("[FlowEngine] Failed to log step:", err);
  }
}

async function getProcessedText(
  text: string,
  context: FlowContext,
): Promise<string> {
  const contact = await prisma.contact.findUnique({
    where: { id: context.contactId },
  });

  if (!text || !contact) return text || "";

  logger.flow.info(
    `[FlowEngine] Processing text: "${text.slice(0, 30)}..." with ${Object.keys(context.variables || {}).length} variables`,
  );

  const processed = resolveContactVariables(text, contact, {
    customVariables: context.variables,
  });

  // Automatic Translation based on detected language - DISABLED
  /*
    if (context.language && context.language !== 'en' && processed.length > 0) {
        try {
            const { translateText } = await import('@/lib/ai/translate');
            logger.flow.info(`[FlowEngine] Translating response to ${context.language}`);
            processed = await translateText(processed, context.language);
        } catch (e: any) {
            logger.flow.error(`[FlowEngine] Translation failed: ${e.message}`);
        }
    }
    */

  return processed;
}

function evaluateCondition(data: any, context: FlowContext): boolean {
  const field = data.field;
  const operator = data.operator;
  const value = String(data.value || "").toLowerCase();
  let actualValue = "";
  if (field === "message.text") {
    actualValue = String(context.text || "").toLowerCase();
  } else if (field === "variable") {
    // Handle variable check
    const varName = data.variableName;
    actualValue = String(context.variables?.[varName] || "").toLowerCase();
  }
  switch (operator) {
    case "equals":
      return actualValue === value;
    case "contains":
      return actualValue.includes(value);
    case "startsWith":
      return actualValue.startsWith(value);
    case "endsWith":
      return actualValue.endsWith(value);
    default:
      return false;
  }
}

export async function resumeFlowExecution(
  executionId: string,
  nodeId: string,
  organizationId: string,
  sourceHandle?: string,
) {
  try {
    const execution = await prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: { flow: true },
    });

    if (!execution || execution.status === "completed") {
      logger.flow.info(
        `[FlowEngine] Execution ${executionId} not found or already completed. Skipping resume.`,
      );
      return;
    }

    const nodes = execution.flow.nodes as any[];
    const edges = execution.flow.edges as any[];
    const context = execution.context as any;

    if (!execution.contactId) {
      logger.flow.error(
        `[FlowEngine] Execution ${executionId} has no contactId. Cannot resume.`,
      );
      return;
    }

    const contact = await prisma.contact.findFirst({
      where: { id: execution.contactId, organizationId },
    });

    const flowContext: FlowContext = {
      contactId: execution.contactId,
      organizationId,
      variables: context.variables || {},
      language: context.language || "en",
      contact,
    };

    // Update status back to running
    await prisma.flowExecution.update({
      where: { id: executionId },
      data: { status: "running" },
    });

    await executeFlowFromNode(
      execution.flowId,
      nodeId,
      nodes,
      edges,
      flowContext,
      executionId,
      sourceHandle,
    );
    await scheduleAiFallbackIfNeeded(executionId, organizationId);
  } catch (error: any) {
    logger.flow.error(
      `[FlowEngine] Failed to resume execution ${executionId}: ${error.message}`,
    );
  }
}

/**
 * Handles responses to Shopify Automation templates (e.g., clicking 'Yes' on a draft order recovery)
 */
async function handleShopifyAutomationResponse(
  organizationId: string,
  contactId: string,
  messageText: string,
  buttonId?: string
): Promise<boolean> {
  try {
    // 1. Get the organization and shop URL
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { shopifyStoreUrl: true }
    });

    if (!org?.shopifyStoreUrl) return false;

    // 1.5 Get the contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { waId: true }
    });

    // 2. Find the last template message sent to this contact
    const lastTemplateMsg = await prisma.message.findFirst({
      where: {
        contactId,
        direction: 'outbound',
        type: 'template',
        content: { startsWith: 'Template:' }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastTemplateMsg?.content) return false;

    // 3. Extract template name
    // Format: "Template: name (params)"
    const templateName = lastTemplateMsg.content.split('(')[0]?.replace('Template:', '').trim();
    if (!templateName) return false;

    // 4. Fetch the Shopify Automation config
    const shopConfigs: any[] = await prisma.$queryRawUnsafe(
      `SELECT automation FROM shopify.shopify_watibot_config WHERE shop = $1`,
      org.shopifyStoreUrl
    );
    const automation = shopConfigs?.[0]?.automation;
    if (!automation) return false;

    // 5. Find which automation uses this template
    let matchedConfig: any = null;
    for (const key in (automation as any)) {
      if (automation[key]?.template === templateName && automation[key]?.active !== false) {
        matchedConfig = automation[key];
        break;
      }
    }

    if (!matchedConfig || !matchedConfig.buttonMappings) return false;

    // 6. Match input text or buttonId against button mappings
    const input = (messageText || "").trim().toLowerCase();
    const mapping = (matchedConfig.buttonMappings as any[]).find((m: any) => 
      m.buttonText?.toLowerCase() === input || 
      m.value?.toLowerCase() === input ||
      m.id === buttonId
    );

    if (!mapping) return false;

    logger.flow.info(`[FlowEngine] Matched Shopify button "${input}" to action "${mapping.action}"`);

    // 7. Execute the action
    if (mapping.action === 'add_tag' || mapping.action === 'add_tag_and_change_status') {
      const tagName = mapping.tag || mapping.value || "Shopify Action";
      
      // Get or create the tag
      let tag = await prisma.tag.findFirst({
        where: { organizationId, name: tagName }
      });
      
      if (!tag) {
        tag = await prisma.tag.create({
          data: { organizationId, name: tagName, color: "#10B981" }
        });
      }

      // Add tag to contact
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          tags: { connect: { id: tag.id } }
        }
      });
      
      logger.flow.success(`[FlowEngine] Added tag "${tagName}" to contact ${contactId}`);

      // 8. Add tag to Shopify Order (if applicable)
      if (org.shopifyStoreUrl) {
        // Try to find the latest order for this contact
        const lastOrder = await prisma.shopifyOrder.findFirst({
          where: { organizationId, customerPhone: { contains: (contact as any)?.waId || "" } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, shopifyOrderId: true, orderNumber: true }
        });

        if (lastOrder) {
          await addTagToShopifyOrder({
            organizationId,
            orderId: lastOrder.shopifyOrderId,
            tag: tagName
          });
          
          if (mapping.action === 'add_tag_and_change_status') {
            const targetStatus = mapping.statusValue || 'cancelled';
            try {
              const { cancelShopifyOrder, closeShopifyOrder, openShopifyOrder } = await import("@/lib/shopify/api");
              if (targetStatus === 'cancelled') {
                await cancelShopifyOrder({
                  organizationId,
                  orderId: lastOrder.shopifyOrderId,
                  reason: "customer"
                });
                await prisma.shopifyOrder.update({
                  where: { id: lastOrder.id },
                  data: { status: "cancelled" }
                });
                logger.flow.success(`[FlowEngine] Cancelled Shopify Order ${lastOrder.orderNumber}`);
              } else if (targetStatus === 'archived') {
                await closeShopifyOrder({
                  organizationId,
                  orderId: lastOrder.shopifyOrderId,
                });
                await prisma.shopifyOrder.update({
                  where: { id: lastOrder.id },
                  data: { status: "closed" }
                });
                logger.flow.success(`[FlowEngine] Closed/Archived Shopify Order ${lastOrder.orderNumber}`);
              } else if (targetStatus === 'open') {
                await openShopifyOrder({
                  organizationId,
                  orderId: lastOrder.shopifyOrderId,
                });
                await prisma.shopifyOrder.update({
                  where: { id: lastOrder.id },
                  data: { status: "open" }
                });
                logger.flow.success(`[FlowEngine] Reopened Shopify Order ${lastOrder.orderNumber}`);
              }
            } catch (apiErr: any) {
              logger.flow.error(`[FlowEngine] Remote Shopify API status change failed: ${apiErr.message}`);
            }
          }
        }
      }

      return true;
    } 
    
    if (mapping.action === 'cancel_order') {
      if (org.shopifyStoreUrl) {
        const lastOrder = await prisma.shopifyOrder.findFirst({
          where: { organizationId, customerPhone: { contains: (contact as any)?.waId || "" } },
          orderBy: { createdAt: 'desc' }
        });

        if (lastOrder) {
          try {
            const { cancelShopifyOrder, addTagToShopifyOrder } = await import("@/lib/shopify/api");
            await cancelShopifyOrder({
              organizationId,
              orderId: lastOrder.shopifyOrderId,
              reason: "customer"
            });
            await addTagToShopifyOrder({
              organizationId,
              orderId: lastOrder.shopifyOrderId,
              tag: "Cancelled via WhatsApp"
            }).catch(() => {});
            logger.flow.success(`[FlowEngine] Synced order status to cancelled with remote Shopify Order ${lastOrder.orderNumber}`);
          } catch (apiErr: any) {
            logger.flow.error(`[FlowEngine] Remote Shopify API order cancellation failed: ${apiErr.message}`);
          }

          await prisma.shopifyOrder.update({
            where: { id: lastOrder.id },
            data: { status: "cancelled" }
          });
        }
      }
      return true;
    }

    if (mapping.action === 'start_flow') {
      const flowId = mapping.flowId;
      if (flowId) {
        const flow = await prisma.flow.findUnique({ where: { id: flowId } });
        if (flow) {
          const contact = await prisma.contact.findUnique({ where: { id: contactId } });
          await startFlow(flow, contactId, organizationId, `Shopify Button: ${input}`, contact);
          logger.flow.success(`[FlowEngine] Started flow "${flow.name}" via Shopify button`);
          return true;
        }
      }
    }

    if (['check_status', 'check_price', 'check_order'].includes(mapping.action)) {
      await initiateShopifyAutomationWorkflow(organizationId, contactId, mapping.action);
      logger.flow.success(`[FlowEngine] Initiated Shopify Interactive Flow: ${mapping.action}`);
      return true;
    }

    return false;
  } catch (err) {
    logger.flow.error(`[FlowEngine] Error in handleShopifyAutomationResponse: ${err}`);
    return false;
  }
}

/**
 * Handles responses to WooCommerce Automation templates (e.g., customer clicks 'Confirm' or any configured button)
 */
async function handleWooCommerceAutomationResponse(
  organizationId: string,
  contactId: string,
  messageText: string,
  buttonId?: string
): Promise<boolean> {
  try {
    // 1. Get the organization and WooCommerce store details
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        woocommerceStoreUrl: true,
        woocommerceConsumerKey: true,
        woocommerceConsumerSecret: true,
        woocommerceAutomation: true
      }
    });

    if (!org) return false;

    const woocommerceAutomation = org.woocommerceAutomation as any;
    if (!woocommerceAutomation) return false;

    // 2. Get the contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { waId: true }
    });

    // 3. Find the last template message sent to this contact
    const lastTemplateMsg = await prisma.message.findFirst({
      where: {
        contactId,
        direction: 'outbound',
        type: 'template',
        content: { startsWith: 'Template:' }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!lastTemplateMsg?.content) return false;

    // 4. Extract template name
    // Format: "Template: name (params)"
    const templateName = lastTemplateMsg.content.split('(')[0]?.replace('Template:', '').trim();
    if (!templateName) return false;

    // 5. Find which WooCommerce automation module uses this template
    let matchedConfig: any = null;
    let matchedModuleId = '';
    for (const key in woocommerceAutomation) {
      if (woocommerceAutomation[key]?.template === templateName && woocommerceAutomation[key]?.active !== false) {
        matchedConfig = woocommerceAutomation[key];
        matchedModuleId = key;
        break;
      }
    }

    if (!matchedConfig || !matchedConfig.buttonActions) return false;

    // 6. Match input text or buttonId against button actions
    const input = (messageText || "").trim().toLowerCase();
    const buttonIdText = buttonId ? buttonId.trim().toLowerCase() : "";

    let mapping: any = null;
    let clickedButtonText = "";
    for (const btnText in matchedConfig.buttonActions) {
      if (
        btnText.toLowerCase() === input ||
        btnText.toLowerCase() === buttonIdText ||
        (matchedConfig.buttonActions[btnText]?.id && matchedConfig.buttonActions[btnText].id.toLowerCase() === buttonIdText)
      ) {
        mapping = matchedConfig.buttonActions[btnText];
        clickedButtonText = btnText;
        break;
      }
    }

    if (!mapping) return false;

    logger.flow.info(`[FlowEngine] Matched WooCommerce button "${clickedButtonText || input}" to action "${mapping.action}"`);

    // 7. Execute the action
    if (mapping.action === 'add_tag') {
      const tagName = mapping.value || "WooCommerce Action";

      // Get or create the tag
      let tag = await prisma.tag.findFirst({
        where: { organizationId, name: tagName }
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: { organizationId, name: tagName, color: "#10B981" }
        });
      }

      // Add tag to contact
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          tags: { connect: { id: tag.id } }
        }
      });

      logger.flow.success(`[FlowEngine] Added tag "${tagName}" to contact ${contactId}`);

      // Add tag to WooCommerce Order (if applicable)
      const cleanWaId = contact?.waId ? contact.waId.replace(/\+/g, "") : "";
      if (cleanWaId) {
        const lastOrder = await prisma.wooCommerceOrder.findFirst({
          where: { organizationId, customerPhone: { contains: cleanWaId } },
          orderBy: { createdAt: 'desc' }
        });

        if (lastOrder) {
          const currentTags = lastOrder.tags ? lastOrder.tags.split(',').map((t: string) => t.trim()) : [];
          if (!currentTags.includes(tagName)) {
            currentTags.push(tagName);
            await prisma.wooCommerceOrder.update({
              where: { id: lastOrder.id },
              data: { tags: currentTags.join(', ') }
            });
          }

          // Sync with WooCommerce Store remote API
          if (org.woocommerceStoreUrl && org.woocommerceConsumerKey && org.woocommerceConsumerSecret) {
            try {
              const { updateWooCommerceOrder, addNoteToWooCommerceOrder } = await import('@/lib/woocommerce');
              await updateWooCommerceOrder(
                org.woocommerceStoreUrl,
                org.woocommerceConsumerKey,
                org.woocommerceConsumerSecret,
                lastOrder.wooOrderId,
                {
                  meta_data: [
                    {
                      key: "watibot_tag",
                      value: tagName
                    }
                  ]
                }
              );
              await addNoteToWooCommerceOrder(
                org.woocommerceStoreUrl,
                org.woocommerceConsumerKey,
                org.woocommerceConsumerSecret,
                lastOrder.wooOrderId,
                `WhatsApp Action: Added Tag [${tagName}]`
              );
              logger.flow.success(`[FlowEngine] Synced tag [${tagName}] with remote WooCommerce Order ${lastOrder.wooOrderId}`);
            } catch (apiErr: any) {
              logger.flow.error(`[FlowEngine] Remote WooCommerce API tag update failed: ${apiErr.message}`);
            }
          }
        }
      }

      return true;
    }

    if (mapping.action === 'remove_tag') {
      const tagName = mapping.value;
      if (tagName) {
        // Disconnect tag from contact
        const tag = await prisma.tag.findFirst({
          where: { organizationId, name: tagName }
        });
        if (tag) {
          await prisma.contact.update({
            where: { id: contactId },
            data: {
              tags: { disconnect: { id: tag.id } }
            }
          });
        }

        // Update WooCommerce Order (if applicable)
        const cleanWaId = contact?.waId ? contact.waId.replace(/\+/g, "") : "";
        if (cleanWaId) {
          const lastOrder = await prisma.wooCommerceOrder.findFirst({
            where: { organizationId, customerPhone: { contains: cleanWaId } },
            orderBy: { createdAt: 'desc' }
          });

          if (lastOrder && lastOrder.tags) {
            const currentTags = lastOrder.tags.split(',').map((t: string) => t.trim());
            const newTags = currentTags.filter((t: string) => t !== tagName);
            await prisma.wooCommerceOrder.update({
              where: { id: lastOrder.id },
              data: { tags: newTags.join(', ') }
            });

            // Sync with remote WooCommerce Store API to remove tag
            if (org.woocommerceStoreUrl && org.woocommerceConsumerKey && org.woocommerceConsumerSecret) {
              try {
                const { updateWooCommerceOrder, addNoteToWooCommerceOrder } = await import('@/lib/woocommerce');
                await updateWooCommerceOrder(
                  org.woocommerceStoreUrl,
                  org.woocommerceConsumerKey,
                  org.woocommerceConsumerSecret,
                  lastOrder.wooOrderId,
                  {
                    meta_data: [
                      {
                        key: "watibot_tag",
                        value: "" // Clear meta data tag
                      }
                    ]
                  }
                );
                await addNoteToWooCommerceOrder(
                  org.woocommerceStoreUrl,
                  org.woocommerceConsumerKey,
                  org.woocommerceConsumerSecret,
                  lastOrder.wooOrderId,
                  `WhatsApp Action: Removed Tag [${tagName}]`
                );
                logger.flow.success(`[FlowEngine] Synced tag removal [${tagName}] with remote WooCommerce Order ${lastOrder.wooOrderId}`);
              } catch (apiErr: any) {
                logger.flow.error(`[FlowEngine] Remote WooCommerce API tag removal failed: ${apiErr.message}`);
              }
            }
          }
        }
      }
      return true;
    }

    if (mapping.action === 'cancel_order') {
      const cleanWaId = contact?.waId ? contact.waId.replace(/\+/g, "") : "";
      if (cleanWaId) {
        const lastOrder = await prisma.wooCommerceOrder.findFirst({
          where: { organizationId, customerPhone: { contains: cleanWaId } },
          orderBy: { createdAt: 'desc' }
        });
        if (lastOrder) {
          await prisma.wooCommerceOrder.update({
            where: { id: lastOrder.id },
            data: { status: "cancelled" }
          });
          if (org.woocommerceStoreUrl && org.woocommerceConsumerKey && org.woocommerceConsumerSecret) {
            try {
              const { updateWooCommerceOrder, addNoteToWooCommerceOrder } = await import('@/lib/woocommerce');
              await updateWooCommerceOrder(
                org.woocommerceStoreUrl,
                org.woocommerceConsumerKey,
                org.woocommerceConsumerSecret,
                lastOrder.wooOrderId,
                { status: "cancelled" }
              );
              await addNoteToWooCommerceOrder(
                org.woocommerceStoreUrl,
                org.woocommerceConsumerKey,
                org.woocommerceConsumerSecret,
                lastOrder.wooOrderId,
                "Order cancelled via WhatsApp by customer."
              );
              logger.flow.success(`[FlowEngine] Synced order status to cancelled with remote WooCommerce Order ${lastOrder.wooOrderId}`);
            } catch (apiErr: any) {
              logger.flow.error(`[FlowEngine] Remote WooCommerce API order cancellation failed: ${apiErr.message}`);
            }
          }
        }
      }
      return true;
    }

    if (mapping.action === 'start_flow') {
      const flowId = mapping.flowId || mapping.value;
      if (flowId) {
        const flow = await prisma.flow.findUnique({ where: { id: flowId } });
        if (flow) {
          const dbContactObj = await prisma.contact.findUnique({ where: { id: contactId } });
          await startFlow(flow, contactId, organizationId, `WooCommerce Button: ${clickedButtonText || input}`, dbContactObj);
          logger.flow.success(`[FlowEngine] Started flow "${flow.name}" via WooCommerce button`);
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    logger.flow.error(`[FlowEngine] Error in handleWooCommerceAutomationResponse: ${err}`);
    return false;
  }
}

export async function scheduleAiFallbackIfNeeded(executionId: string, organizationId: string) {
  try {
    const execution = await prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: { flow: true }
    });
    if (!execution || execution.status !== "paused") return;

    const context = execution.context as any;
    const pausedNodeId = context?.pausedNodeId;
    if (!pausedNodeId) return;

    const nodes = execution.flow.nodes as any[];
    const pausedNode = nodes.find(n => n.id === pausedNodeId);
    if (!pausedNode) return;

    const fallbackEnabled = pausedNode.data?.fallbackEnabled;
    if (!fallbackEnabled) return;

    const fallbackKbId = pausedNode.data?.fallbackKbId;
    const fallbackDelay = parseInt(pausedNode.data?.fallbackDelay || "0", 10);
    const fallbackUnit = pausedNode.data?.fallbackUnit || "seconds";
    
    let delaySeconds = fallbackDelay;
    if (fallbackUnit === "minutes") delaySeconds *= 60;
    if (fallbackUnit === "hours") delaySeconds *= 3600;

    if (delaySeconds <= 0) return;

    logger.flow.info(`[FlowEngine] AI Fallback enabled for node ${pausedNodeId}. Scheduling in ${delaySeconds}s.`);

    const { scheduleAiFallbackTrigger } = await import("@/lib/flows/queue");
    await scheduleAiFallbackTrigger({
      executionId,
      nodeId: pausedNodeId,
      organizationId,
      seconds: delaySeconds,
    });
  } catch (err: any) {
    logger.flow.error(`[FlowEngine] Error in scheduleAiFallbackIfNeeded: ${err.message}`);
  }
}

export async function triggerAiFallback(
  executionId: string,
  nodeId: string,
  organizationId: string
) {
  try {
    logger.flow.info(`[FlowEngine] Triggering AI Fallback for execution ${executionId}, node ${nodeId}`);

    const execution = await prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: { flow: true }
    });

    if (!execution || !execution.contactId || execution.status !== "paused") {
      logger.flow.info(`[FlowEngine] Execution is no longer paused or contactId is missing. Cancelling AI fallback.`);
      return;
    }

    const context = execution.context as any;
    if (context?.pausedNodeId !== nodeId) {
      logger.flow.info(`[FlowEngine] Execution has moved. Cancelling AI fallback.`);
      return;
    }

    const nodes = execution.flow.nodes as any[];
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      logger.flow.error(`[FlowEngine] Node ${nodeId} not found in flow.`);
      return;
    }

    if (!node.data?.fallbackEnabled) {
      logger.flow.info(`[FlowEngine] Fallback is disabled on node. Cancelling.`);
      return;
    }

    const fallbackKbId = (node.data?.fallbackKbId as string) || undefined;
    const nodeQuestion = node.data?.question || node.data?.message || "";
    
    const prompt = `The customer is currently paused at the flow step "${node.data?.name || node.type}" where they were asked: "${nodeQuestion}". They did not respond. Based on the business knowledge base, ask a helpful follow-up question related to this step to keep them engaged or help them complete the step. Be friendly, polite, and concise.`;

    const recentMessages = await prisma.message.findMany({
      where: { contactId: execution.contactId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { direction: true, content: true, mediaUrl: true, type: true }
    });

    const messagesForHistory = recentMessages.reverse();
    const { getAppBaseUrl } = await import("@/lib/storage/media");
    const appBase = getAppBaseUrl();

    const chatHistory = messagesForHistory.map(msg => {
      let text = msg.content || '';
      if (msg.mediaUrl) {
        const fullMediaUrl = msg.mediaUrl.startsWith('http://') || msg.mediaUrl.startsWith('https://')
          ? msg.mediaUrl
          : `${appBase}${msg.mediaUrl.startsWith('/') ? '' : '/'}${msg.mediaUrl}`;
        if (text === '[Image]' || text === '[Document]' || text === '[Video]' || text === '[Audio]') {
          text = `[Attachment ${msg.type || 'file'}: ${fullMediaUrl}]`;
        } else if (!text.includes(fullMediaUrl)) {
          text = `${text} [Attachment: ${fullMediaUrl}]`;
        }
      }
      return {
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: text
      };
    });

    const fallbackStartTime = Date.now();
    const { getAIResponseWithDetails } = await import("@/lib/ai/openai");
    const aiDetails = await getAIResponseWithDetails(prompt, {
      organizationId,
      contactId: execution.contactId,
      aiAgentId: fallbackKbId,
      history: chatHistory,
    });

    if (aiDetails?.text) {
      logger.flow.success(`[FlowEngine] AI Fallback response generated: "${aiDetails.text}"`);

      const { processAIJsonResponse } = await import("@/lib/ai/lead-saver");
      const processedAI = await processAIJsonResponse({
        rawAiResponse: aiDetails.rawAiOutput || aiDetails.text,
        organizationId,
        contactId: execution.contactId,
        aiAgentId: aiDetails.agentId || fallbackKbId,
        aiAgentName: aiDetails.agentName || "Fallback Agent",
        provider: aiDetails.provider,
        model: aiDetails.model,
        systemPromptUsed: aiDetails.systemPrompt,
        retrievedChunks: aiDetails.retrievedChunks || [],
        durationMs: aiDetails.durationMs || (Date.now() - fallbackStartTime),
        userPrompt: prompt,
      });

      // Configurable AI Agent Response Delay
      const fallbackDelaySeconds = typeof (aiDetails as any)?.delaySeconds === 'number' ? (aiDetails as any).delaySeconds : 0;
      if (fallbackDelaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(fallbackDelaySeconds, 120) * 1000));
      }

      await sendTranslatedMessage(
        {
          contactId: execution.contactId,
          message: processedAI.textMessage,
          skipWindowCheck: true,
        },
        context
      );

      if (processedAI.media && processedAI.media.length > 0) {
        try {
          const { sendAIMediaResponses } = await import("@/lib/ai/ai-media-handler");
          await sendAIMediaResponses({
            organizationId,
            contactId: execution.contactId,
            mediaList: processedAI.media,
            flowContext: context,
          });
        } catch (mediaErr: any) {
          logger.flow.error(`[FlowEngine] Error dispatching fallback AI media: ${mediaErr.message}`);
        }
      }

      await logExecutionStep(
        executionId,
        nodeId,
        node.type,
        "fallback_triggered",
        { fallbackMsg: processedAI.textMessage }
      );
    }
  } catch (err: any) {
    logger.flow.error(`[FlowEngine] Error in triggerAiFallback: ${err.message}`);
  }
}
