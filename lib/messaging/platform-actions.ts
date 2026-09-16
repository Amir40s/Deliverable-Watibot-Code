import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function handlePlatformButtonAction(params: {
  organizationId: string;
  waId: string;
  buttonText: string;
  contextWamid?: string;
}) {
  const { organizationId, waId, buttonText, contextWamid } = params;

  // 1. Fetch Organization to see active integrations
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      shopifyStoreUrl: true,
      woocommerceStoreUrl: true
    }
  });

  if (!org) return;

  // 2. Try to route by Context (replied-to message)
  if (contextWamid) {
    const originalMsg = await prisma.message.findUnique({
      where: { wamid: contextWamid },
      select: { content: true }
    });
    
    if (originalMsg?.content) {
      const lowerContent = originalMsg.content.toLowerCase();
      if (lowerContent.includes('shopify') || lowerContent.includes('order #')) {
          logger.webhook.info(`[PlatformAction] Routing to Shopify via context: ${contextWamid}`);
          const { handleShopifyButtonAction } = await import('@/lib/shopify/actions');
          return handleShopifyButtonAction(params);
      }
      if (lowerContent.includes('woo') || lowerContent.includes('wc-')) {
          logger.webhook.info(`[PlatformAction] Routing to WooCommerce via context: ${contextWamid}`);
          const { handleWooCommerceButtonAction } = await import('@/lib/woocommerce-actions');
          return handleWooCommerceButtonAction(params);
      }
    }
  }

  const [lastShopifyOrder, lastWooOrder] = await Promise.all([
    prisma.shopifyOrder.findFirst({
      where: { 
        organizationId: organizationId,
        customerPhone: { contains: waId.slice(-10) } 
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.wooCommerceOrder.findFirst({
      where: { 
        organizationId: organizationId,
        customerPhone: { contains: waId.slice(-10) } 
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ]);

  const shopifyTime = lastShopifyOrder?.createdAt.getTime() || 0;
  const wooTime = lastWooOrder?.createdAt.getTime() || 0;

  // 3. Trigger the appropriate handler
  if (shopifyTime > wooTime && org.shopifyStoreUrl) {
    logger.webhook.info(`[PlatformAction] Routing to Shopify for org ${organizationId}`);
    const { handleShopifyButtonAction } = await import('@/lib/shopify/actions');
    return handleShopifyButtonAction(params);
  } else if (wooTime > 0 && org.woocommerceStoreUrl) {
    logger.webhook.info(`[PlatformAction] Routing to WooCommerce for org ${organizationId}`);
    const { handleWooCommerceButtonAction } = await import('@/lib/woocommerce-actions');
    return handleWooCommerceButtonAction(params);
  } else {
    // If no order found, try both but silently (fallback)
    logger.webhook.info(`[PlatformAction] No recent order found for ${waId}. Trying both handlers silently.`);
    
    if (org.shopifyStoreUrl) {
      const { handleShopifyButtonAction } = await import('@/lib/shopify/actions');
      handleShopifyButtonAction(params).catch(() => {});
    }
    
    if (org.woocommerceStoreUrl) {
      const { handleWooCommerceButtonAction } = await import('@/lib/woocommerce-actions');
      handleWooCommerceButtonAction(params).catch(() => {});
    }
  }
}
