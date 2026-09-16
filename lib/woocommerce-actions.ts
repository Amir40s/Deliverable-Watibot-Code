import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  updateWooCommerceOrder,
  addNoteToWooCommerceOrder,
} from "./woocommerce";
export async function handleWooCommerceButtonAction({
  organizationId,
  waId,
  buttonText,
}: {
  organizationId: string;
  waId: string;
  buttonText: string;
}) {
  logger.webhook.info(
    `[WooCommerceAction] Processing button click: "${buttonText}" for waId: ${waId} in org: ${organizationId}`,
  );
  const normalizedText = buttonText.toLowerCase().trim();
  try {
    const lastOrder = await prisma.wooCommerceOrder.findFirst({
      where: {
        organizationId,
        customerPhone: { contains: waId.replace(/\+/g, "") },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!lastOrder) {
      logger.webhook.warn(
        `[WooCommerceAction] No recent WooCommerce order found for waId: ${waId}`,
      );
      return { success: false, message: "No order found" };
    }
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        woocommerceStoreUrl: true,
        woocommerceConsumerKey: true,
        woocommerceConsumerSecret: true,
        woocommerceAutomation: true,
      },
    });

    if (
      !org?.woocommerceStoreUrl ||
      !org?.woocommerceConsumerKey ||
      !org?.woocommerceConsumerSecret
    ) {
      logger.webhook.error(
        `[WooCommerceAction] WooCommerce credentials missing for Org: ${organizationId}`,
      );
      return { success: false, message: "Credentials missing" };
    }

    const automation = (org.woocommerceAutomation as any) || {};
    let dynamicActionTaken = false;

    // 1. Check for Dynamic Button Mappings from Settings
    for (const moduleId in automation) {
      const module = automation[moduleId];
      if (module.active && module.buttonActions && module.buttonActions[buttonText]) {
        const mapping = module.buttonActions[buttonText];
        if (mapping.action === "add_tag" && mapping.value) {
          logger.webhook.info(`[WooCommerceAction] Executing dynamic action: Add Tag [${mapping.value}] for button [${buttonText}]`);
          
          try {
            // 1. Update Remote WooCommerce (Status & Meta Data)
            await updateWooCommerceOrder(
              org.woocommerceStoreUrl,
              org.woocommerceConsumerKey,
              org.woocommerceConsumerSecret,
              lastOrder.wooOrderId,
              { 
                status: "processing", // Auto-confirm on button click
                meta_data: [
                  {
                    key: "watibot_tag",
                    value: mapping.value
                  }
                ]
              },
            );

            // 2. Add Note to WooCommerce
            await addNoteToWooCommerceOrder(
              org.woocommerceStoreUrl,
              org.woocommerceConsumerKey,
              org.woocommerceConsumerSecret,
              lastOrder.wooOrderId,
              `WhatsApp Action: Added Tag [${mapping.value}]`,
            );
          } catch (apiErr: any) {
            logger.webhook.error(`[WooCommerceAction] Remote API failed but will update local DB: ${apiErr.message}`);
          }

          // 3. Update Local DB (Always try to update local DB for UI feedback)
          const currentTags = lastOrder.tags ? lastOrder.tags.split(',').map(t => t.trim()) : [];
          if (!currentTags.includes(mapping.value)) {
            currentTags.push(mapping.value);
          }
          
          await prisma.wooCommerceOrder.update({
            where: { id: lastOrder.id },
            data: { 
              status: "processing",
              tags: currentTags.join(', ')
            },
          });

          dynamicActionTaken = true;
        } else if (mapping.action === "cancel_order") {
          logger.webhook.info(`[WooCommerceAction] Executing dynamic action: Cancel Order for button [${buttonText}]`);
          try {
            await updateWooCommerceOrder(
              org.woocommerceStoreUrl,
              org.woocommerceConsumerKey,
              org.woocommerceConsumerSecret,
              lastOrder.wooOrderId,
              { status: "cancelled" },
            );
            await addNoteToWooCommerceOrder(
              org.woocommerceStoreUrl,
              org.woocommerceConsumerKey,
              org.woocommerceConsumerSecret,
              lastOrder.wooOrderId,
              "Order cancelled via WhatsApp by customer.",
            );
          } catch (apiErr: any) {
            logger.webhook.error(`[WooCommerceAction] Remote API failed but will update local DB: ${apiErr.message}`);
          }
          await prisma.wooCommerceOrder.update({
            where: { id: lastOrder.id },
            data: { status: "cancelled" },
          });
          dynamicActionTaken = true;
        }
      }
    }

    // 2. Fallback to Hardcoded Logic if no dynamic action was taken
    if (!dynamicActionTaken) {
      if (
        normalizedText === "yes" ||
        normalizedText.includes("confirm") ||
        normalizedText.includes("haan")
      ) {
        await prisma.wooCommerceOrder.update({
          where: { id: lastOrder.id },
          data: { status: "processing" },
        });
        await updateWooCommerceOrder(
          org.woocommerceStoreUrl,
          org.woocommerceConsumerKey,
          org.woocommerceConsumerSecret,
          lastOrder.wooOrderId,
          { status: "processing" },
        );

        await addNoteToWooCommerceOrder(
          org.woocommerceStoreUrl,
          org.woocommerceConsumerKey,
          org.woocommerceConsumerSecret,
          lastOrder.wooOrderId,
          "Order confirmed via WhatsApp by customer (Yes).",
        );
      } else if (
        normalizedText === "no" ||
        normalizedText.includes("cancel") ||
        normalizedText.includes("nahi")
      ) {
        await addNoteToWooCommerceOrder(
          org.woocommerceStoreUrl,
          org.woocommerceConsumerKey,
          org.woocommerceConsumerSecret,
          lastOrder.wooOrderId,
          "Customer selected 'No' / requested cancellation via WhatsApp.",
        );
      } else {
        await addNoteToWooCommerceOrder(
          org.woocommerceStoreUrl,
          org.woocommerceConsumerKey,
          org.woocommerceConsumerSecret,
          lastOrder.wooOrderId,
          `Customer clicked button: "${buttonText}" on WhatsApp.`,
        );
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.webhook.error(
      `[WooCommerceAction] Error handling WooCommerce button: ${error.message}`,
    );
    return { success: false, error: error.message };
  }
}
