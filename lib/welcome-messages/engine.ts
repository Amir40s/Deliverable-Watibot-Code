import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendUnifiedMessage } from "@/lib/messaging/api";
import { WelcomeCondition } from "@/app/actions/welcome-messages";
import { resolveContactVariables } from "@/lib/messaging/contactVariables";

export async function processWelcomeMessages(params: {
  organizationId: string;
  contactId: string;
  messageText: string;
  contact: any;
}) {
  const { organizationId, contactId } = params;
  let { contact, messageText } = params;

  // 0. Detect Language for translation
  let detectedLanguage = "en";
  if (messageText && messageText.length >= 3) {
    try {
      const { detectLanguage } = await import("@/lib/ai/openai");
      detectedLanguage = await detectLanguage(messageText);
      logger.flow.info(
        `[WelcomeMessageEngine] Detected language: ${detectedLanguage}`,
      );
    } catch (e) { }
  }

  try {
    // 1. Fetch contact with tags if not already present
    // We need tags for the 'has_tag' condition
    if (!contact.tags) {
      const enrichedContact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: { tags: true }
      });
      if (enrichedContact) {
        contact = enrichedContact;
        params.contact = enrichedContact; // Update params for evaluateCondition
      }
    }

    // 2. Fetch all active welcome messages for this organization
    const contactPlatform = contact?.platform || 'WHATSAPP';

    // Fetch organization to get timezone
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true }
    });
    const orgTimezone = org?.timezone || 'UTC';

    const welcomeMessages = await prisma.welcomeMessage.findMany({
      where: {
        organizationId,
        isActive: true,
        platform: {
          in: [contactPlatform, 'ALL']
        }
      },
      orderBy: {
        priority: "desc",
      },
    });

    if (welcomeMessages.length === 0) {
      logger.flow.info(`[WelcomeMessageEngine] No active welcome messages found for org ${organizationId}`);
      return false;
    }

    logger.flow.info(`[WelcomeMessageEngine] Found ${welcomeMessages.length} active welcome messages. Using timezone: ${orgTimezone}`);

    // 2. Evaluate each message
    for (const msg of welcomeMessages) {
      const conditions = (msg.conditions as any) as WelcomeCondition[];
      const logic = msg.conditionLogic || "OR";

      if (conditions.length === 0) {
        // No conditions means it always fires (if it's the highest priority active one)
        await triggerWelcomeMessage(msg, contactId, detectedLanguage);
        return true;
      }

      const results = await Promise.all(
        conditions.map((cond) => evaluateCondition(cond, { ...params, timezone: orgTimezone }))
      );

      const isMatch =
        logic === "AND"
          ? results.every((r) => r === true)
          : results.some((r) => r === true);

      if (isMatch) {
        await triggerWelcomeMessage(msg, contactId, detectedLanguage);
        return true; // Only fire one (the highest priority match)
      } else {
        logger.flow.info(`[WelcomeMessageEngine] Message "${msg.name}" conditions not matched. Results: ${JSON.stringify(results)}`);
      }
    }
  } catch (error) {
    logger.flow.error(`[WelcomeMessageEngine] Error: ${error}`);
  }

  return false;
}

async function evaluateCondition(cond: WelcomeCondition, params: any): Promise<boolean> {
  const { contact, messageText, contactId, timezone } = params;

  // 1. Determine the correct 'now' based on timezone
  let now = new Date();
  let effectiveTimezone = timezone || 'UTC';

  // Smart fallback: If it's a Pakistani number and no timezone is set, use Asia/Karachi
  if ((effectiveTimezone === 'UTC' || !effectiveTimezone) && contact.waId?.startsWith('92')) {
    effectiveTimezone = 'Asia/Karachi';
  }

  if (effectiveTimezone !== 'UTC' && effectiveTimezone) {
    try {
      // Use Intl to get the current time in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: effectiveTimezone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
      });

      const parts = formatter.formatToParts(new Date());
      const dateParts: any = {};
      parts.forEach(p => dateParts[p.type] = p.value);

      // Construct a Date object representing the time in that timezone
      // Note: This Date object's UTC values will be wrong, but its local values will be correct for our needs
      now = new Date(
        parseInt(dateParts.year),
        parseInt(dateParts.month) - 1,
        parseInt(dateParts.day),
        parseInt(dateParts.hour),
        parseInt(dateParts.minute),
        parseInt(dateParts.second)
      );
    } catch (e) {
      logger.flow.error(`[WelcomeMessageEngine] Failed to format timezone ${effectiveTimezone}: ${e}`);
    }
  }

  const logResult = (isMatch: boolean, details?: string) => {
    logger.flow.info(`[WelcomeMessageEngine] Condition "${cond.type}" ${isMatch ? "MATCHED" : "FAILED"}${details ? `: ${details}` : ""} (Timezone: ${effectiveTimezone}, Local Hour: ${now.getHours()})`);
  };

  switch (cond.type) {
    case "first_message": {
      // Check if this is the first message from this contact
      const count = await prisma.message.count({ where: { contactId: contact.id } });
      const isMatch = count <= 1;
      logResult(isMatch, `Message count: ${count}`);
      return isMatch;
    }

    case "first_message_of_day": {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // We check the second most recent inbound message (the one before the current one)
      // because the current message has already been saved to the DB by the webhook.
      const previousInbound = await prisma.message.findFirst({
        where: {
          contactId: contact.id,
          direction: 'inbound',
        },
        orderBy: { createdAt: 'desc' },
        skip: 1 // Skip the current message
      });

      if (!previousInbound) {
        logger.flow.info(`[WelcomeMessageEngine] No previous inbound messages. This is the first of the day.`);
        return true;
      }

      const isFirstOfDay = previousInbound.createdAt < startOfDay;
      logger.flow.info(`[WelcomeMessageEngine] Previous inbound message was at ${previousInbound.createdAt.toISOString()}. Start of day: ${startOfDay.toISOString()}. Is first of day: ${isFirstOfDay}`);
      return isFirstOfDay;
    }

    case "user_inactive": {
      const previousInbound = await prisma.message.findFirst({
        where: { contactId: contact.id, direction: 'inbound' },
        orderBy: { createdAt: 'desc' },
        skip: 1
      });
      if (!previousInbound) return false;

      const minutes = Number(cond.value) || 0;
      const diff = (now.getTime() - new Date(previousInbound.createdAt).getTime()) / (1000 * 60);
      return diff >= minutes;
    }

    case "returning_user": {
      const previousInbound = await prisma.message.findFirst({
        where: { contactId: contact.id, direction: 'inbound' },
        orderBy: { createdAt: 'desc' },
        skip: 1
      });
      if (!previousInbound) return false;
      const hours = Number(cond.value) || 0;
      const diff = (now.getTime() - new Date(previousInbound.createdAt).getTime()) / (1000 * 60 * 60);
      return diff >= hours;
    }

    case "new_user": {
      // Created in the last 24 hours and very few messages
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const msgCount = await prisma.message.count({ where: { contactId: contact.id } });
      const isMatch = new Date(contact.createdAt) > oneDayAgo && msgCount <= 2;
      logResult(isMatch, `Created: ${contact.createdAt}, MsgCount: ${msgCount}`);
      return isMatch;
    }

    case "has_tag": {
      const tagName = String(cond.value).toLowerCase();
      const tags = (contact.tags || []) as any[];
      const isMatch = tags.some(t => t.name.toLowerCase() === tagName);
      logResult(isMatch, `Tags: [${tags.map(t => t.name).join(', ')}], Target: ${tagName}`);
      return isMatch;
    }

    case "user_location": {
      const targetCountry = String(cond.value).toLowerCase();
      const { countries } = await import("@/lib/countries");
      const waId = contact.waId || "";

      // Extract country ISO code from phone number
      const matchingCountry = countries
        .filter(c => waId.startsWith(c.code.replace(/[^\d]/g, "")))
        .sort((a, b) => b.code.length - a.code.length)[0];

      const userISO = matchingCountry?.flag 
        ? matchingCountry.flag.split('/').pop()?.replace('.png', '').toLowerCase() || ""
        : "";
      const isMatch = userISO === targetCountry || matchingCountry?.name?.toLowerCase() === targetCountry;
      logResult(isMatch, `User Phone: ${waId}, Detected Country: ${matchingCountry?.name} (${userISO}), Target: ${targetCountry}`);
      return isMatch;
    }

    case "time_of_day": {
      const hour = now.getHours();
      const val = String(cond.value).toLowerCase();
      let isMatch = false;
      if (val === "morning") isMatch = hour >= 5 && hour < 12;
      else if (val === "afternoon") isMatch = hour >= 12 && hour < 17;
      else if (val === "evening") isMatch = hour >= 17 || hour < 5;
      logResult(isMatch, `Current hour: ${hour}, Target: ${val}`);
      return isMatch;
    }

    case "time_range": {
      const value = String(cond.value);
      if (!value.includes(',')) return false;
      const [start, end] = value.split(',');
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const nowVal = now.getHours() * 60 + now.getMinutes();
      const startVal = sH * 60 + sM;
      const endVal = eH * 60 + eM;
      const isMatch = startVal <= endVal
        ? (nowVal >= startVal && nowVal <= endVal)
        : (nowVal >= startVal || nowVal <= endVal);
      logResult(isMatch, `Current time: ${now.getHours()}:${now.getMinutes()}, Range: ${start}-${end}`);
      return isMatch;
    }

    case "date_range": {
      const value = String(cond.value);
      if (!value.includes(',')) return false;
      const [start, end] = value.split(',');
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      const isMatch = now >= startDate && now <= endDate;
      logResult(isMatch, `Current date: ${now.toISOString().split('T')[0]}, Range: ${start}-${end}`);
      return isMatch;
    }

    case "date_time_range": {
      const value = String(cond.value);
      const parts = value.split(',');
      if (parts.length < 4) return false;
      const [dS, dE, tS, tE] = parts;

      // 1. Check Date
      const startDate = new Date(dS);
      const endDate = new Date(dE);
      endDate.setHours(23, 59, 59, 999);
      const dateOk = now >= startDate && now <= endDate;
      if (!dateOk) return false;

      // 2. Check Time
      const [sH, sM] = tS.split(':').map(Number);
      const [eH, eM] = tE.split(':').map(Number);
      const nowVal = now.getHours() * 60 + now.getMinutes();
      const startVal = sH * 60 + sM;
      const endVal = eH * 60 + eM;
      return startVal <= endVal
        ? (nowVal >= startVal && nowVal <= endVal)
        : (nowVal >= startVal || nowVal <= endVal);
    }

    case "day_type": {
      const day = now.getDay();
      const val = String(cond.value).toLowerCase();
      const isWeekend = day === 0 || day === 6;
      let isMatch = false;
      if (val === "weekend") isMatch = isWeekend;
      else if (val === "weekday") isMatch = !isWeekend;
      logResult(isMatch, `Day: ${day}, Target: ${val}`);
      return isMatch;
    }

    case "after_x_messages": {
      const msgCount = await prisma.message.count({ where: { contactId: contact.id } });
      return msgCount >= (Number(cond.value) || 0);
    }

    case "after_flow":
    case "after_flow_ends": {
      const flowId = String(cond.value);
      const execution = await prisma.flowExecution.findFirst({
        where: { contactId: contactId, flowId, status: 'completed' }
      });
      const isMatch = !!execution;
      logResult(isMatch, `Flow: ${flowId}, Status: completed`);
      return isMatch;
    }

    case "after_flow_starts": {
      const flowId = String(cond.value);
      const execution = await prisma.flowExecution.findFirst({
        where: { contactId: contactId, flowId }
      });
      const isMatch = !!execution;
      logResult(isMatch, `Flow: ${flowId}, Started: ${isMatch}`);
      return isMatch;
    }

    case "before_flow_starts": {
      const flowId = String(cond.value);
      const execution = await prisma.flowExecution.findFirst({
        where: { contactId: contactId, flowId }
      });
      const isMatch = !execution;
      logResult(isMatch, `Flow: ${flowId}, Never started: ${isMatch}`);
      return isMatch;
    }

    case "after_failed_flow": {
      const flowId = String(cond.value);
      const execution = await prisma.flowExecution.findFirst({
        where: { contactId: contactId, flowId, status: 'failed' }
      });
      const isMatch = !!execution;
      logResult(isMatch, `Flow: ${flowId}, Status: failed`);
      return isMatch;
    }

    case "keyword": {
      const rawVal = String(cond.value || "");
      const keywords = rawVal.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const msgLower = messageText.toLowerCase();
      const isMatch = keywords.length > 0 
        ? keywords.some(kw => msgLower.includes(kw))
        : msgLower.includes(rawVal.toLowerCase());
      logResult(isMatch, `Message: "${messageText}", Keywords: "${rawVal}"`);
      return isMatch;
    }

    case "user_sends_message": {
      const rawVal = String(cond.value || "");
      const targets = rawVal.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const msgTrim = messageText.trim().toLowerCase();
      const isMatch = targets.length > 0 
        ? targets.some(tm => msgTrim === tm)
        : msgTrim === rawVal.trim().toLowerCase();
      logResult(isMatch, `Message: "${messageText}", Target Messages: "${rawVal}"`);
      return isMatch;
    }

    default:
      return false;
  }
}

async function triggerWelcomeMessage(
  msg: any,
  contactId: string,
  targetLang?: string,
) {
  logger.flow.info(
    `[WelcomeMessageEngine] Triggering message: ${msg.name} for contact ${contactId} (Lang: ${targetLang || "en"})`,
  );

  // Perform Assignments early so they apply even if messages are delayed
  if (msg.assignTagId || msg.assignAgentId) {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(msg.assignAgentId && {
          assignedUsers: {
            connect: { id: msg.assignAgentId }
          }
        }),
        ...(msg.assignTagId && {
          tags: {
            connect: { id: msg.assignTagId }
          }
        })
      }
    }).catch(e => logger.flow.error(`[WelcomeMessageEngine] Assignment failed: ${e.message}`));
  }

  // Log the trigger
  await prisma.welcomeMessage
    .update({
      where: { id: msg.id },
      data: {
        triggerLog: {
          lastTriggeredAt: new Date().toISOString(),
          lastContactId: contactId,
        },
      },
    })
    .catch(() => { });

  // Fetch full contact details for variable resolution
  const targetContact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      name: true,
      whatsappName: true,
      firstName: true,
      lastName: true,
      waId: true,
      email: true,
      customAttributes: true,
    }
  });

  const sequenceItems = Array.isArray(msg.sequenceItems) ? msg.sequenceItems : [];

  if (sequenceItems.length > 0) {
    logger.flow.info(`[WelcomeMessageEngine] Sending sequence of ${sequenceItems.length} items`);
    for (const item of sequenceItems) {
      const fireItem = async () => {
        let content = resolveContactVariables(item.content, targetContact);

        // Translate if needed
        if (targetLang && targetLang !== "en" && targetLang !== "auto" && content) {
          try {
            const { translateText } = await import("@/lib/ai/openai");
            logger.flow.info(
              `[WelcomeMessageEngine] Translating sequence item to: ${targetLang}`,
            );
            content = await translateText(content, targetLang);
          } catch (e: any) {
            logger.flow.error(
              `[WelcomeMessageEngine] Translation failed: ${e.message}`,
            );
          }
        }

        // Prepare Interactive Buttons for this sequence item if present
        let interactiveData: any = undefined;
        if (item.buttons && Array.isArray(item.buttons) && item.buttons.length > 0) {
          interactiveData = {
            type: "button",
            body: { text: content || " " },
            action: {
              buttons: item.buttons.map((btn: any) => ({
                id: btn.id || `btn_${Math.random().toString(36).substring(2, 7)}`,
                text: btn.text,
                type: btn.type === "QUICK_REPLY" ? "reply" : (btn.type === "URL" ? "url" : "phone"),
                url: btn.url,
                phone_number: btn.phone_number
              }))
            }
          };
        }

        await sendUnifiedMessage({
          contactId,
          message: content,
          mediaUrl: item.mediaUrl,
          contentType: item.mediaType || item.type || "IMAGE",
          skipWindowCheck: true,
          interactiveData,
        });
      };

      if (item.delaySeconds > 0) {
        setTimeout(fireItem, item.delaySeconds * 1000);
      } else {
        await fireItem();
      }
    }
  } else {
    const fire = async () => {
      let content = resolveContactVariables(msg.content, targetContact);

      // Translate if needed
      if (targetLang && targetLang !== "en" && targetLang !== "auto" && content) {
        try {
          const { translateText } = await import("@/lib/ai/openai");
          logger.flow.info(
            `[WelcomeMessageEngine] Translating welcome message to: ${targetLang}`,
          );
          content = await translateText(content, targetLang);
        } catch (e: any) {
          logger.flow.error(
            `[WelcomeMessageEngine] Translation failed: ${e.message}`,
          );
        }
      }

      // Prepare Template Components if in template mode
      let templateComponents: any[] = [];
      if (msg.templateName && Array.isArray(msg.templateParams)) {
        templateComponents = [
          {
            type: "body",
            parameters: msg.templateParams.map((p: string) => ({
              type: "text",
              text: resolveContactVariables(p, targetContact),
            })),
          },
        ];
      }

      // Prepare Interactive Data for regular messages with buttons
      let interactiveData: any = undefined;
      if (!msg.templateName && msg.buttons && Array.isArray(msg.buttons) && msg.buttons.length > 0) {
        interactiveData = {
          type: "button",
          body: { text: content || " " },
          action: {
            buttons: msg.buttons.map((btn: any) => ({
              id: btn.id,
              text: btn.text,
              type: btn.type === "QUICK_REPLY" ? "reply" : (btn.type === "URL" ? "url" : "phone"),
              url: btn.url,
              phone_number: btn.phone_number
            }))
          }
        };
      }

      await sendUnifiedMessage({
        contactId,
        message: content,
        mediaUrl: msg.mediaUrl,
        contentType: msg.mediaType,
        skipWindowCheck: true,
        templateName: msg.templateName,
        templateLanguage: msg.templateLanguage,
        templateComponents: templateComponents.length > 0 ? templateComponents : undefined,
        interactiveData,
      });
    };

    if (msg.delaySeconds > 0) {
      setTimeout(fire, msg.delaySeconds * 1000);
    } else {
      await fire();
    }
  }
}
