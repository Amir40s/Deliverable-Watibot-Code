import { prisma } from "@/lib/prisma";
import { sendUnifiedMessage } from "@/lib/messaging/api";
import { callShopifyAPI } from "@/lib/shopify/api";
import { logger } from "@/lib/logger";

export interface ConversationState {
  workflowId: string;
  step: string;
  data?: Record<string, any>;
  expiresAt: number;
}

export interface WorkflowResult {
  nextState: ConversationState | null;
  message: string;
}

// Registry of interactive workflows
export const shopifyWorkflows: Record<
  string,
  {
    initiate: (contactId: string, orgId: string) => Promise<WorkflowResult>;
    processStep: (
      contactId: string,
      orgId: string,
      messageText: string,
      currentState: ConversationState
    ) => Promise<WorkflowResult>;
  }
> = {
  check_status: {
    initiate: async (contactId, orgId) => {
      return {
        nextState: {
          workflowId: "check_status",
          step: "awaiting_order_number",
          data: {},
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minute expiry
        },
        message: "Sure! Please enter your **Order Number** (e.g., #1055 or 1055) so I can retrieve your status immediately.",
      };
    },
    processStep: async (contactId, orgId, messageText, currentState) => {
      const input = messageText.trim();
      const cleanedNum = input.replace(/#/g, "").trim();

      if (!cleanedNum) {
        return {
          nextState: currentState,
          message: "Please enter a valid order number (e.g., #1055).",
        };
      }

      logger.flow.info(`[ShopifyWorkflows] CheckStatus: searching order ${cleanedNum}`);

      let order: any = null;

      // 1. Try Live Shopify API search by name
      try {
        const res = await callShopifyAPI({
          organizationId: orgId,
          endpoint: `orders.json?name=${encodeURIComponent(cleanedNum)}&status=any`,
        });
        if (res.orders && res.orders.length > 0) {
          order = res.orders[0];
        } else {
          // Retry with hash prefix
          const resHash = await callShopifyAPI({
            organizationId: orgId,
            endpoint: `orders.json?name=${encodeURIComponent("#" + cleanedNum)}&status=any`,
          });
          if (resHash.orders && resHash.orders.length > 0) {
            order = resHash.orders[0];
          }
        }
      } catch (err: any) {
        logger.flow.error(`[ShopifyWorkflows] Shopify API search failed, falling back to local DB: ${err.message}`);
      }

      // 2. Fallback to Local Prisma ShopifyOrder DB
      if (!order) {
        try {
          const localOrder = await prisma.shopifyOrder.findFirst({
            where: {
              organizationId: orgId,
              orderNumber: cleanedNum,
            },
          });
          if (localOrder) {
            order = {
              name: "#" + localOrder.orderNumber,
              created_at: localOrder.createdAt,
              total_price: localOrder.totalPrice,
              currency: localOrder.currency,
              financial_status: localOrder.paymentStatus,
              fulfillment_status: localOrder.fulfillmentStatus,
            };
          }
        } catch (err: any) {
          logger.flow.error(`[ShopifyWorkflows] Local DB search failed: ${err.message}`);
        }
      }

      if (!order) {
        return {
          nextState: {
            ...currentState,
            expiresAt: Date.now() + 15 * 60 * 1000,
          },
          message: `I couldn't locate any order with number **#${cleanedNum}** in our system. 

Please double check the order number on your receipt and reply with the correct one.`,
        };
      }

      // Format payment and fulfillment status nicely
      const paymentStatus = (order.financial_status || "Pending").toUpperCase();
      const fulfillmentStatus = (order.fulfillment_status || "Unfulfilled").toUpperCase();
      const dateString = new Date(order.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      let responseMsg = `📦 **Order Status for ${order.name}**\n`;
      responseMsg += `---------------------------------\n`;
      responseMsg += `📅 **Order Date:** ${dateString}\n`;
      responseMsg += `💵 **Total Amount:** ${order.total_price} ${order.currency || "USD"}\n`;
      responseMsg += `💳 **Payment Status:** ${paymentStatus}\n`;
      responseMsg += `🚚 **Fulfillment:** ${fulfillmentStatus}\n`;

      if (order.fulfillments && order.fulfillments.length > 0) {
        const trackingUrl = order.fulfillments[0].tracking_url;
        const carrier = order.fulfillments[0].tracking_company;
        if (trackingUrl) {
          responseMsg += `🔗 **Tracking (${carrier || "Carrier"}):** ${trackingUrl}\n`;
        }
      }

      responseMsg += `\nIf you need anything else, just ask!`;

      return {
        nextState: null, // Ends conversation state
        message: responseMsg,
      };
    },
  },

  check_price: {
    initiate: async (contactId, orgId) => {
      return {
        nextState: {
          workflowId: "check_price",
          step: "awaiting_product_query",
          data: {},
          expiresAt: Date.now() + 15 * 60 * 1000,
        },
        message: "I can check product prices and availability for you! What product name or keyword are you looking for?",
      };
    },
    processStep: async (contactId, orgId, messageText, currentState) => {
      const query = messageText.trim();
      if (!query) {
        return {
          nextState: currentState,
          message: "Please enter a product name to search.",
        };
      }

      logger.flow.info(`[ShopifyWorkflows] CheckPrice: searching products matching "${query}"`);

      let products: any[] = [];

      // 1. Try Live Shopify API search
      try {
        const res = await callShopifyAPI({
          organizationId: orgId,
          endpoint: `products.json?title=${encodeURIComponent(query)}&limit=3`,
        });
        if (res.products && res.products.length > 0) {
          products = res.products;
        }
      } catch (err: any) {
        logger.flow.error(`[ShopifyWorkflows] Shopify API search failed, falling back to local DB: ${err.message}`);
      }

      // 2. Fallback to Local Prisma Product DB
      if (products.length === 0) {
        try {
          const localProducts = await prisma.product.findMany({
            where: {
              organizationId: orgId,
              name: { contains: query, mode: "insensitive" },
            },
            take: 3,
          });
          products = localProducts.map((p) => ({
            title: p.name,
            status: p.status,
            variants: [{ price: p.price.toString() }],
          }));
        } catch (err: any) {
          logger.flow.error(`[ShopifyWorkflows] Local DB product search failed: ${err.message}`);
        }
      }

      if (products.length === 0) {
        return {
          nextState: {
            ...currentState,
            expiresAt: Date.now() + 15 * 60 * 1000,
          },
          message: `We couldn't find any products matching **"${query}"**. 

Please try searching with a different keyword or name.`,
        };
      }

      let responseMsg = `🔍 **Search Results for "${query}"**\n`;
      responseMsg += `---------------------------------\n\n`;

      products.forEach((p: any) => {
        const price = p.variants?.[0]?.price || "N/A";
        const stockStatus = p.status === "active" || p.status === "ACTIVE" ? "🟢 In Stock" : "🔴 Out of Stock";
        responseMsg += `🏷️ **${p.title}**\n💰 **Price:** ${price} USD\n📦 **Status:** ${stockStatus}\n\n`;
      });

      responseMsg += `Let me know if you'd like to check another product!`;

      return {
        nextState: null,
        message: responseMsg,
      };
    },
  },

  check_order: {
    initiate: async (contactId, orgId) => {
      // 1. Try automatic search using Contact's WhatsApp Phone Number
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { waId: true, email: true },
      });

      if (contact) {
        const cleanPhone = contact.waId.replace(/\D/g, "");
        logger.flow.info(`[ShopifyWorkflows] CheckOrder: initiating automatic phone lookup for: ${cleanPhone}`);

        // Try local DB search first
        let localOrder = await prisma.shopifyOrder.findFirst({
          where: {
            organizationId: orgId,
            customerPhone: { contains: cleanPhone },
          },
          orderBy: { createdAt: "desc" },
        });

        if (localOrder) {
          const dateString = new Date(localOrder.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          return {
            nextState: null,
            message: `🎉 **Found Your Latest Order Automatically!**\n\n` +
              `📦 **Order Number:** #${localOrder.orderNumber}\n` +
              `📅 **Order Date:** ${dateString}\n` +
              `💵 **Total Amount:** ${localOrder.totalPrice} ${localOrder.currency || "USD"}\n` +
              `💳 **Payment:** ${(localOrder.paymentStatus || "Pending").toUpperCase()}\n` +
              `🚚 **Fulfillment:** ${(localOrder.fulfillmentStatus || "Unfulfilled").toUpperCase()}\n\n` +
              `If this is not the order you were looking for, reply with your specific **Order Number**!`,
          };
        }
      }

      // 2. If automatic lookup fails, fallback to conversational prompt
      return {
        nextState: {
          workflowId: "check_order",
          step: "awaiting_email_or_order",
          data: {},
          expiresAt: Date.now() + 15 * 60 * 1000,
        },
        message: "I couldn't locate your orders automatically using this phone number. \n\nCould you please provide the **Email Address** or **Order Number** used during checkout?",
      };
    },
    processStep: async (contactId, orgId, messageText, currentState) => {
      const input = messageText.trim();
      if (!input) {
        return {
          nextState: currentState,
          message: "Please enter your Email Address or Order Number to proceed.",
        };
      }

      logger.flow.info(`[ShopifyWorkflows] CheckOrder: searching order using user input: "${input}"`);

      let order: any = null;

      if (input.includes("@")) {
        // Query by Email
        try {
          const res = await callShopifyAPI({
            organizationId: orgId,
            endpoint: `orders.json?email=${encodeURIComponent(input)}&limit=1`,
          });
          if (res.orders && res.orders.length > 0) {
            order = res.orders[0];
          }
        } catch (e: any) {
          logger.flow.error(`[ShopifyWorkflows] Email lookup failed on Shopify API: ${e.message}`);
        }

        if (!order) {
          try {
            const localOrder = await prisma.shopifyOrder.findFirst({
              where: {
                organizationId: orgId,
                customerEmail: { equals: input, mode: "insensitive" },
              },
              orderBy: { createdAt: "desc" },
            });
            if (localOrder) {
              order = {
                name: "#" + localOrder.orderNumber,
                created_at: localOrder.createdAt,
                total_price: localOrder.totalPrice,
                currency: localOrder.currency,
                financial_status: localOrder.paymentStatus,
                fulfillment_status: localOrder.fulfillmentStatus,
              };
            }
          } catch (e: any) {
            logger.flow.error(`[ShopifyWorkflows] Email lookup failed on Local DB: ${e.message}`);
          }
        }
      } else {
        // Query by Order Number (fallback)
        const cleanedNum = input.replace(/#/g, "").trim();
        try {
          const res = await callShopifyAPI({
            organizationId: orgId,
            endpoint: `orders.json?name=${encodeURIComponent(cleanedNum)}&status=any`,
          });
          if (res.orders && res.orders.length > 0) {
            order = res.orders[0];
          }
        } catch (e: any) {}
      }

      if (!order) {
        return {
          nextState: {
            ...currentState,
            expiresAt: Date.now() + 15 * 60 * 1000,
          },
          message: `I still couldn't find any orders matching **"${input}"**. 

Please double check the details and send them again, or ask a team member to assist you!`,
        };
      }

      const dateString = new Date(order.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      return {
        nextState: null,
        message: `🎉 **Found Your Order!**\n\n` +
          `📦 **Order Number:** ${order.name}\n` +
          `📅 **Order Date:** ${dateString}\n` +
          `💵 **Total Amount:** ${order.total_price} ${order.currency || "USD"}\n` +
          `💳 **Payment:** ${(order.financial_status || "Pending").toUpperCase()}\n` +
          `🚚 **Fulfillment:** ${(order.fulfillment_status || "Unfulfilled").toUpperCase()}\n\n` +
          `Let me know if there's anything else I can help you with!`,
      };
    },
  },
};

/**
 * Initiates the given Shopify workflow and sends the initial response
 */
export async function initiateShopifyAutomationWorkflow(
  orgId: string,
  contactId: string,
  workflowId: string
) {
  try {
    const workflow = shopifyWorkflows[workflowId];
    if (!workflow) {
      logger.flow.error(`[ShopifyWorkflows] Unknown workflowId: ${workflowId}`);
      return;
    }

    const { nextState, message } = await workflow.initiate(contactId, orgId);

    // Save context state in Contact customAttributes
    if (nextState) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { customAttributes: true },
      });
      const currentAttrs = (contact?.customAttributes as Record<string, any>) || {};
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          customAttributes: {
            ...currentAttrs,
            watibot_automation_state: nextState as any,
          },
        },
      });
    }

    // Dispatch the first prompt text message to user
    await sendUnifiedMessage({
      contactId,
      message,
      skipWindowCheck: true,
    });
  } catch (err: any) {
    logger.flow.error(`[ShopifyWorkflows] Failed to initiate workflow ${workflowId}: ${err.message}`);
  }
}

/**
 * Checks for ongoing active conversation state, processes it, and returns true if handled
 */
export async function handleActiveShopifyConversationState(
  orgId: string,
  contactId: string,
  messageText: string
): Promise<boolean> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customAttributes: true },
    });

    const attrs = contact?.customAttributes as Record<string, any> | null;
    const state = attrs?.watibot_automation_state as ConversationState | null;

    if (!state) return false;

    // Check expiration (15 min TTL)
    if (Date.now() > state.expiresAt) {
      logger.flow.info(`[ShopifyWorkflows] Expired conversation state detected for contact: ${contactId}. Cleaning up.`);
      const updatedAttrs = { ...attrs };
      delete updatedAttrs.watibot_automation_state;
      await prisma.contact.update({
        where: { id: contactId },
        data: { customAttributes: updatedAttrs },
      });
      return false;
    }

    const workflow = shopifyWorkflows[state.workflowId];
    if (!workflow) return false;

    logger.flow.info(`[ShopifyWorkflows] Intercepted message for active workflow "${state.workflowId}" at step "${state.step}"`);

    const { nextState, message } = await workflow.processStep(contactId, orgId, messageText, state);

    // Update state context in customAttributes
    const updatedAttrs = { ...attrs };
    if (nextState) {
      updatedAttrs.watibot_automation_state = nextState as any;
    } else {
      delete updatedAttrs.watibot_automation_state;
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: { customAttributes: updatedAttrs },
    });

    // Send unified response message back
    await sendUnifiedMessage({
      contactId,
      message,
      skipWindowCheck: true,
    });

    return true;
  } catch (err: any) {
    logger.flow.error(`[ShopifyWorkflows] Error processing active conversation state: ${err.message}`);
    return false;
  }
}
