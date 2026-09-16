import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { addTagToShopifyOrder } from "./api";

/**
 * Handles button clicks from Shopify-related WhatsApp messages.
 * This is called when a user interacts with a button like "Confirm Order" or "Track Order".
 */
export async function handleShopifyButtonAction({
  organizationId,
  waId,
  buttonText,
}: {
  organizationId: string;
  waId: string;
  buttonText: string;
}) {
  logger.webhook.info(
    `[ShopifyAction] Processing button click: "${buttonText}" for waId: ${waId} in org: ${organizationId}`
  );

  const normalizedText = buttonText.toLowerCase().trim();

  try {
    const lastOrder = await prisma.shopifyOrder.findFirst({
      where: { 
        organizationId, 
        customerPhone: { contains: waId.slice(-10) } 
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastOrder) {
      logger.webhook.warn(`[ShopifyAction] No recent Shopify order found for waId: ${waId}`);
      return { success: false, message: "No order found" };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { shopifyStoreUrl: true, shopifyAccessToken: true, shopifyAutomation: true }
    });

    const shopifyAutomation = (org?.shopifyAutomation as Record<string, any>) ?? {};
    let matchedMapping: any = null;

    for (const moduleId of Object.keys(shopifyAutomation)) {
      const moduleConfig = shopifyAutomation[moduleId] ?? {};
      const buttonMappings = moduleConfig.buttonMappings ?? [];
      const mapping = buttonMappings.find(
        (m: any) => m.buttonText?.toLowerCase().trim() === normalizedText
      );
      if (mapping) {
        matchedMapping = mapping;
        break;
      }
    }

    if (matchedMapping && matchedMapping.action !== "none") {
      logger.webhook.info(`[ShopifyAction] Found custom mapping action "${matchedMapping.action}" for button "${buttonText}"`);
      const { addTagToShopifyOrder, removeTagFromShopifyOrder, cancelShopifyOrder, closeShopifyOrder, openShopifyOrder } = await import("./api");

      const tagValue = matchedMapping.value?.trim();

      if (matchedMapping.action === "add_tag" && tagValue) {
        await addTagToShopifyOrder({
          organizationId,
          orderId: lastOrder.shopifyOrderId,
          tag: tagValue
        });
      } else if (matchedMapping.action === "remove_tag" && tagValue) {
        await removeTagFromShopifyOrder({
          organizationId,
          orderId: lastOrder.shopifyOrderId,
          tag: tagValue
        });
      } else if (matchedMapping.action === "cancel_order") {
        await cancelShopifyOrder({
          organizationId,
          orderId: lastOrder.shopifyOrderId,
          reason: "customer"
        });
        await prisma.shopifyOrder.update({
          where: { id: lastOrder.id },
          data: { status: "cancelled" },
        });
      } else if (matchedMapping.action === "add_tag_and_change_status" && tagValue) {
        await addTagToShopifyOrder({
          organizationId,
          orderId: lastOrder.shopifyOrderId,
          tag: tagValue
        });

        const statusVal = matchedMapping.statusValue || "cancelled";
        if (statusVal === "cancelled") {
          await cancelShopifyOrder({
            organizationId,
            orderId: lastOrder.shopifyOrderId,
            reason: "customer"
          });
          await prisma.shopifyOrder.update({
            where: { id: lastOrder.id },
            data: { status: "cancelled" },
          });
        } else if (statusVal === "archived") {
          await closeShopifyOrder({
            organizationId,
            orderId: lastOrder.shopifyOrderId
          });
        } else if (statusVal === "open") {
          await openShopifyOrder({
            organizationId,
            orderId: lastOrder.shopifyOrderId
          });
        }
      }
    } else {
      logger.webhook.info(`[ShopifyAction] No custom mapping found for button "${buttonText}". Using default fallback logic.`);
      if (normalizedText.includes("confirm") || normalizedText === "yes" || normalizedText === "haan") {
        await prisma.shopifyOrder.update({
          where: { id: lastOrder.id },
          data: { status: "confirmed" },
        });
        logger.webhook.info(`[ShopifyAction] Order ${lastOrder.orderNumber} marked as confirmed in DB.`);
        
        await addTagToShopifyOrder({
          organizationId,
          orderId: lastOrder.shopifyOrderId,
          tag: "Confirmed"
        });
      } else if (normalizedText.includes("cancel") || normalizedText === "no" || normalizedText === "nahi") {
        logger.webhook.info(`[ShopifyAction] Processing cancellation request for Order ${lastOrder.orderNumber}...`);
        
        try {
          const { cancelShopifyOrder, addTagToShopifyOrder } = await import("./api");
          await cancelShopifyOrder({
            organizationId,
            orderId: lastOrder.shopifyOrderId,
            reason: "customer"
          });

          await addTagToShopifyOrder({
            organizationId,
            orderId: lastOrder.shopifyOrderId,
            tag: "Cancelled via WhatsApp"
          }).catch((tagErr) => {
            logger.webhook.warn(`[ShopifyAction] Failed to add Cancelled tag to Shopify Order ${lastOrder.orderNumber}: ${tagErr.message}`);
          });

          logger.webhook.info(`[ShopifyAction] Remote Shopify Order ${lastOrder.orderNumber} successfully cancelled.`);
        } catch (apiErr: any) {
          logger.webhook.error(`[ShopifyAction] Remote Shopify API cancellation failed: ${apiErr.message}`);
        }

        await prisma.shopifyOrder.update({
          where: { id: lastOrder.id },
          data: { status: "cancelled" },
        });
      } else if (normalizedText.includes("track")) {
        logger.webhook.info(`[ShopifyAction] Tracking request received for Order ${lastOrder.orderNumber}.`);
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.webhook.error(`[ShopifyAction] Error handling button: ${error.message}`);
    return { success: false, error: error.message };
  }
}
