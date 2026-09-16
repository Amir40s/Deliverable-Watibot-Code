'use server';

import { prisma } from '@/lib/prisma';
import { logActivity } from "@/lib/activityLog";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { internalSendTemplateMessage } from '@/lib/whatsapp/api';

export async function getShopifyIntegrationKey() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { 
      shopifyIntegrationToken: true, 
      shopifyStoreUrl: true,
      shopifyAccessToken: true 
    },
  });

  return org;
}

export async function manualRefreshShopifyToken() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) throw new Error("Unauthorized");

    const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { shopifyStoreUrl: true, shopifyIntegrationToken: true }
    });

    if (!org?.shopifyStoreUrl || !org?.shopifyIntegrationToken) {
        throw new Error("Shopify not fully configured. Please ensure your store is linked and you have an integration key.");
    }

    const success = await refreshShopifyToken(org.shopifyStoreUrl, org.shopifyIntegrationToken);
    
    if (success) {
        return { success: true, message: "Shopify token refreshed successfully." };
    } else {
        throw new Error("Failed to refresh Shopify token. Please try opening the app from Shopify admin.");
    }
}

async function refreshShopifyToken(shop: string, key: string) {
    try {
        // Use the environment variable for the Shopify App URL
        const shopifyAppUrl = process.env.SHOPIFY_APP_URL || "https://watibotapp.vercel.app";
        console.log(`>>> [Refresh] Requesting background token refresh for ${shop} from ${shopifyAppUrl}...`);
        
        const res = await fetch(`${shopifyAppUrl}/api/refresh-token?shop=${shop}&key=${key}`);
        if (!res.ok) {
            const err = await res.text();
            console.error(`>>> [Refresh] Failed:`, err);
            return false;
        }

        // Wait for the background process (Shopify App) to update our database
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`>>> [Refresh] SUCCESSFUL`);
        return true;
    } catch (e: any) {
        console.error(`>>> [Refresh] Error:`, e.message);
        return false;
    }
}

export async function getShopifyOrders() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return [];

    const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { shopifyStoreUrl: true, shopifyAccessToken: true, shopifyIntegrationToken: true }
    });

    if (!org?.shopifyStoreUrl || !org?.shopifyAccessToken) return [];

    const fetchOrders = async (token: string) => {
        return fetch(
            `https://${org.shopifyStoreUrl}/admin/api/2024-07/orders.json?status=any&limit=50`,
            {
                headers: {
                    "X-Shopify-Access-Token": token,
                    "Content-Type": "application/json",
                },
            }
        );
    }

    try {
        let response = await fetchOrders(org.shopifyAccessToken);

        // AUTO-REFRESH LOGIC
        if (response.status === 401 && org.shopifyIntegrationToken) {
            console.log(">>> [Shopify] Token expired. Attempting background refresh...");
            const refreshed = await refreshShopifyToken(org.shopifyStoreUrl, org.shopifyIntegrationToken);
            
            if (refreshed) {
                // Get the updated token from DB
                const updatedOrg = await prisma.organization.findUnique({
                    where: { id: session.user.organizationId },
                    select: { shopifyAccessToken: true }
                });
                
                if (updatedOrg?.shopifyAccessToken) {
                    console.log(">>> [Shopify] Retrying with new token...");
                    response = await fetchOrders(updatedOrg.shopifyAccessToken);
                }
            }
        }

        if (!response.ok) throw new Error("Shopify API Error");
        const data = await response.json();
        
        return (data.orders || []).map((order: any) => {
            const customerName = `${order.customer?.first_name || order.shipping_address?.first_name || ''} ${order.customer?.last_name || order.shipping_address?.last_name || ''}`.trim() || (order.customer?.email ? order.customer.email.split('@')[0] : 'Customer');
            const itemsCount = order.line_items?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 1), 0) || (order.line_items?.length || 1);
            const channel = order.source_name === 'pos' 
                ? 'POS' 
                : (order.source_name === 'shopify_draft_order' || order.source_identifier === 'draft' 
                    ? 'Draft Orders' 
                    : 'Online Store');
            const deliveryMethod = order.shipping_lines?.[0]?.title || (channel === 'Draft Orders' ? 'Shipping' : 'Standard');
            const hasTracking = (order.fulfillments || []).some((f: any) => f.tracking_number || f.tracking_company || f.tracking_url);
            const deliveryStatus = hasTracking ? 'Tracking added' : '';

            const lineItems = (order.line_items || []).map((li: any) => ({
                id: li.id?.toString() || Math.random().toString(),
                productId: li.product_id?.toString() || "",
                variantId: li.variant_id?.toString() || "",
                title: li.title || li.name || "Product",
                variantTitle: li.variant_title || "",
                quantity: Number(li.quantity) || 1,
                price: li.price || "0.00",
                total: (Number(li.price || 0) * (Number(li.quantity) || 1)).toFixed(2),
                sku: li.sku || "",
                vendor: li.vendor || "",
                grams: li.grams || 0,
                discount: li.total_discount || "0.00",
                imageUrl: li.image?.src || li.product_image?.src || "",
            }));
            const productsSummary = lineItems.map((li: any) => `${li.title || li.name || 'Product'} x${li.quantity || 1}`).join(', ');

            return {
                id: order.id.toString(),
                orderNumber: order.order_number?.toString() || order.name?.replace('#', '') || order.id.toString(),
                name: order.name || `#${order.order_number || order.id}`,
                customerName,
                customerPhone: order.phone || order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || "",
                customerEmail: order.email || order.customer?.email || order.contact_email || "",
                customerOrdersCount: order.customer?.orders_count || 0,
                customerTotalSpent: order.customer?.total_spent || "0.00",
                totalPrice: order.total_price || "0.00",
                subtotalPrice: order.subtotal_price || order.total_line_items_price || order.total_price || "0.00",
                totalTax: order.total_tax || "0.00",
                totalDiscounts: order.total_discounts || "0.00",
                totalShipping: order.total_shipping_price_set?.shop_money?.amount || order.shipping_lines?.[0]?.price || "0.00",
                currency: order.currency || "USD",
                paymentStatus: order.financial_status || "pending",
                financialStatus: order.financial_status || "pending",
                fulfillmentStatus: order.fulfillment_status || "unfulfilled",
                paymentGateways: order.payment_gateway_names || (order.gateway ? [order.gateway] : []),
                shippingAddress: order.shipping_address || null,
                billingAddress: order.billing_address || null,
                shippingLines: order.shipping_lines || [],
                discountCodes: order.discount_codes || [],
                fulfillments: order.fulfillments || [],
                note: order.note || "",
                cancelledAt: order.cancelled_at,
                cancelReason: order.cancel_reason,
                tags: order.tags || "",
                itemsCount,
                channel,
                deliveryMethod,
                deliveryStatus,
                lineItems,
                productsSummary,
                createdAt: order.created_at,
                orderStatusUrl: order.order_status_url || "",
            };
        });
    } catch (e: any) {
        console.error("Live Order Fetch Failed:", e.message);
        return [];
    }
}

export async function getShopifyProducts() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return [];

    const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { shopifyStoreUrl: true, shopifyAccessToken: true, shopifyIntegrationToken: true }
    });

    if (!org?.shopifyStoreUrl || !org?.shopifyAccessToken) return [];

    const fetchProducts = async (token: string) => {
        return fetch(
            `https://${org.shopifyStoreUrl}/admin/api/2024-07/products.json?limit=50`,
            {
                headers: {
                    "X-Shopify-Access-Token": token,
                    "Content-Type": "application/json",
                },
            }
        );
    }

    try {
        let response = await fetchProducts(org.shopifyAccessToken);

        // AUTO-REFRESH LOGIC
        if (response.status === 401 && org.shopifyIntegrationToken) {
            console.log(">>> [Shopify] Token expired (Products). Attempting background refresh...");
            const refreshed = await refreshShopifyToken(org.shopifyStoreUrl, org.shopifyIntegrationToken);
            
            if (refreshed) {
                const updatedOrg = await prisma.organization.findUnique({
                    where: { id: session.user.organizationId },
                    select: { shopifyAccessToken: true }
                });
                
                if (updatedOrg?.shopifyAccessToken) {
                    console.log(">>> [Shopify] Retrying products with new token...");
                    response = await fetchProducts(updatedOrg.shopifyAccessToken);
                }
            }
        }

        if (!response.ok) throw new Error("Shopify API Error");
        const data = await response.json();

        return (data.products || []).map((p: any) => ({
            id: p.id.toString(),
            name: p.title,
            price: p.variants[0]?.price || "0.00",
            currency: "", // Shopify products list doesn't show currency directly here easily
            sku: p.variants[0]?.sku || "N/A",
            imageUrl: p.image?.src || p.images[0]?.src || null,
            status: p.status,
            updatedAt: p.updated_at
        }));
    } catch (error: any) {
        console.error("Live Product Fetch Failed:", error.message);
        return [];
    }
}

export async function syncShopifyProducts() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) throw new Error("Unauthorized");

    const organization = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { id: true, shopifyStoreUrl: true }
    });

    if (!organization?.shopifyStoreUrl) throw new Error("Shopify store not linked");

    // Force wipe old data first
    await prisma.shopifyOrder.deleteMany({
        where: { organizationId: organization.id }
    });

    await prisma.product.deleteMany({
        where: { 
            organizationId: organization.id,
            platform: 'shopify'
        }
    });
    
    revalidatePath('/dashboard/integrations/shopify');
    return { success: true, message: "Old data wiped. Please use the Shopify App to pull new data." };
}

export async function generateShopifyIntegrationKey() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error('Unauthorized');
  }

  const newToken = `wb_sh_${randomBytes(24).toString('hex')}`;

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { shopifyIntegrationToken: newToken },
  });

  revalidatePath('/dashboard/integrations/shopify');
  return newToken;
}

export async function getShopifyAutomationSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { 
      shopifyOrderAutomationEnabled: true, 
      shopifyOrderTemplate: true,
      shopifyOrderTemplateLanguage: true
    },
  });

  return org;
}

export async function updateShopifyAutomationSettings(enabled: boolean, template: string, language: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { 
      shopifyOrderAutomationEnabled: enabled,
      shopifyOrderTemplate: template,
      shopifyOrderTemplateLanguage: language
    },
  });

  revalidatePath('/dashboard/integrations/shopify');
  
  await logActivity({
    organizationId: session.user.organizationId, userId: session.user.id, userEmail: session.user.email, userName: session.user.name,
    action: 'Created', module: 'Integrations', target: 'Shopify Store', status: 'success'
  });
  return { success: true };
}

export async function getShopifyCustomers() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return [];

    const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { shopifyStoreUrl: true, shopifyAccessToken: true, shopifyIntegrationToken: true }
    });

    if (!org?.shopifyStoreUrl || !org?.shopifyAccessToken) return [];

    const fetchCustomers = async (token: string) => {
        return fetch(
            `https://${org.shopifyStoreUrl}/admin/api/2024-07/customers.json?limit=50`,
            {
                headers: {
                    "X-Shopify-Access-Token": token,
                    "Content-Type": "application/json",
                },
            }
        );
    }

    try {
        let response = await fetchCustomers(org.shopifyAccessToken);

        // AUTO-REFRESH LOGIC
        if (response.status === 401 && org.shopifyIntegrationToken) {
            console.log(">>> [Shopify] Token expired (Customers). Attempting background refresh...");
            const refreshed = await refreshShopifyToken(org.shopifyStoreUrl, org.shopifyIntegrationToken);
            
            if (refreshed) {
                const updatedOrg = await prisma.organization.findUnique({
                    where: { id: session.user.organizationId },
                    select: { shopifyAccessToken: true }
                });
                
                if (updatedOrg?.shopifyAccessToken) {
                    console.log(">>> [Shopify] Retrying customers with new token...");
                    response = await fetchCustomers(updatedOrg.shopifyAccessToken);
                }
            }
        }

        if (!response.ok) throw new Error("Shopify API Error");
        const data = await response.json();

        return (data.customers || []).map((c: any) => {
            const firstName = c.first_name || c.default_address?.first_name || "";
            const lastName = c.last_name || c.default_address?.last_name || "";
            const fullName = `${firstName} ${lastName}`.trim();
            const name = fullName || (c.email ? c.email.split('@')[0] : 'Customer');
            const phone = c.phone || c.default_address?.phone || "";
            const email = c.email || "";
            const city = c.default_address?.city || "";
            const country = c.default_address?.country || c.default_address?.country_name || "";
            const location = [city, country].filter(Boolean).join(", ");
            const totalSpent = c.total_spent || "0.00";
            const currency = c.currency || "";
            const lastOrderName = c.last_order_name || (c.last_order_id ? `#${c.last_order_id}` : "");

            return {
                id: c.id.toString(),
                name,
                firstName,
                lastName,
                phone,
                email,
                location,
                orderCount: c.orders_count || 0,
                totalSpent,
                currency,
                lastOrderName,
                lastOrderId: c.last_order_id ? c.last_order_id.toString() : null,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
            };
        });
    } catch (error: any) {
        console.error("Live Customer Fetch Failed:", error.message);
        return [];
    }
}

// ─── Full Automation (New) ────────────────────────────────────────────────────

export async function getShopifyFullAutomation() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { shopifyStoreUrl: true, shopifyAutomation: true },
  });

  if (!org?.shopifyStoreUrl) {
    return (org?.shopifyAutomation as Record<string, any>) ?? {};
  }

  try {
    const shopConfigs: any[] = await prisma.$queryRawUnsafe(
      `SELECT automation FROM shopify.shopify_watibot_config WHERE LOWER(shop) = LOWER($1)`,
      org.shopifyStoreUrl
    );
    const automation = shopConfigs?.[0]?.automation;
    return (automation as Record<string, any>) ?? {};
  } catch (err: any) {
    console.error(">>> [CRM getShopifyFullAutomation] Failed to query shopify_watibot_config:", err.message);
    return (org?.shopifyAutomation as Record<string, any>) ?? {};
  }
}

export async function updateShopifyFullAutomation(moduleId: string, data: Record<string, any>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { shopifyStoreUrl: true, shopifyAutomation: true },
  });

  const currentOrgAutomation = (org?.shopifyAutomation as Record<string, any>) ?? {};
  
  // 1. Get current automation from shopify.shopify_watibot_config if store is linked
  let currentShopifyAutomation: Record<string, any> = {};
  if (org?.shopifyStoreUrl) {
    try {
      const shopConfigs: any[] = await prisma.$queryRawUnsafe(
        `SELECT automation FROM shopify.shopify_watibot_config WHERE LOWER(shop) = LOWER($1)`,
        org.shopifyStoreUrl
      );
      if (shopConfigs && shopConfigs.length > 0) {
        currentShopifyAutomation = (shopConfigs[0].automation as Record<string, any>) ?? {};
      }
    } catch (err: any) {
      console.error(">>> [CRM updateShopifyFullAutomation] Failed to query current shopify_watibot_config:", err.message);
    }
  }

  // Merge updates on top of shopify_watibot_config current state (or fallback to org state)
  const baseAutomation = Object.keys(currentShopifyAutomation).length > 0 ? currentShopifyAutomation : currentOrgAutomation;
  const updated = {
    ...baseAutomation,
    [moduleId]: {
      ...(baseAutomation[moduleId] ?? {}),
      ...data,
    },
  };

  // 2. Update shopify_watibot_config if store is linked
  if (org?.shopifyStoreUrl) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE shopify.shopify_watibot_config SET automation = CAST($1 AS json) WHERE LOWER(shop) = LOWER($2)`,
        JSON.stringify(updated),
        org.shopifyStoreUrl
      );
    } catch (err: any) {
      console.error(">>> [CRM updateShopifyFullAutomation] Failed to update shopify_watibot_config:", err.message);
    }
  }

  // 3. Keep organization.shopifyAutomation in sync
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { shopifyAutomation: updated },
  });

  revalidatePath("/dashboard/integrations/shopify");
  return { success: true };
}

export async function getShopifyFlows() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return [];

  const flows = await prisma.flow.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });

  return flows;
}

export async function sendPendingOrdersWhatsAppBroadcast({
  orders,
  templateName,
  templateLanguage = "en",
  variableMappings = {},
}: {
  orders: any[];
  templateName: string;
  templateLanguage?: string;
  variableMappings?: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const organization = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, shopifyStoreUrl: true, metaAccessToken: true, whatsappPhoneNumberId: true },
  });

  if (!organization?.whatsappPhoneNumberId || !organization?.metaAccessToken) {
    throw new Error("WhatsApp is not configured for your organization. Please configure WhatsApp first.");
  }

  let lang = templateLanguage || "en";
  if (lang === "en") lang = "en_US";

  let sentCount = 0;
  let failedCount = 0;
  const results: any[] = [];

  for (const order of orders) {
    const rawPhone = order.customerPhone || "";
    const cleanWaId = rawPhone.replace(/[^0-9]/g, "");

    if (!cleanWaId || cleanWaId.length < 7) {
      failedCount++;
      results.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: rawPhone,
        status: "failed",
        error: "Invalid or missing phone number",
      });
      continue;
    }

    try {
      // Find or create Contact in DB
      let contact = await prisma.contact.findUnique({
        where: {
          organizationId_platform_waId: {
            organizationId: organization.id,
            platform: "WHATSAPP",
            waId: cleanWaId,
          },
        },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId: organization.id,
            waId: cleanWaId,
            name: order.customerName || "Shopify Customer",
            email: order.customerEmail || undefined,
            platform: "WHATSAPP",
            isAutoCreated: true,
          },
        });
      }

      // Build parameters based on variableMappings
      const keys = Object.keys(variableMappings).map(Number).filter((n) => !isNaN(n));
      const maxKey = keys.length > 0 ? Math.max(...keys) : 0;
      const params: any[] = [];

      for (let i = 1; i <= maxKey; i++) {
        const mappingKey = i.toString();
        const mappingPath = variableMappings[mappingKey];
        let textVal = " ";

        if (mappingPath) {
          if (mappingPath.startsWith("custom:")) {
            textVal = mappingPath.substring(7);
          } else {
            switch (mappingPath) {
              case "customer.first_name":
                textVal = order.customerName ? order.customerName.split(" ")[0] : "Customer";
                break;
              case "customer.last_name":
                textVal = order.customerName ? order.customerName.split(" ").slice(1).join(" ") : "";
                break;
              case "order_number":
                textVal = `#${order.orderNumber}`;
                break;
              case "total_price":
                textVal = `${order.currency || "$"} ${order.totalPrice}`;
                break;
              case "currency":
                textVal = order.currency || "USD";
                break;
              case "shop_url":
                textVal = organization.shopifyStoreUrl || "";
                break;
              case "customer.phone":
                textVal = order.customerPhone || cleanWaId;
                break;
              case "product_name":
                textVal = order.lineItems?.[0]?.title || order.productsSummary || "Product";
                break;
              default:
                textVal = " ";
            }
          }
        }
        params.push({ type: "text", text: textVal || " " });
      }

      const components = params.length > 0 ? [{ type: "body", parameters: params }] : undefined;

      await internalSendTemplateMessage(
        contact.id,
        templateName,
        lang,
        components
      );

      sentCount++;
      results.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: cleanWaId,
        status: "sent",
      });
    } catch (err: any) {
      console.error(`[PendingOrdersBroadcast] Failed for order #${order.orderNumber}:`, err.message);
      failedCount++;
      results.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: cleanWaId,
        status: "failed",
        error: err.message || "Failed to send template",
      });
    }
  }

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: "Sent Broadcast",
    module: "Shopify Integration",
    target: `Pending Order Reminders (${sentCount} sent, ${failedCount} failed)`,
    status: failedCount === 0 ? "success" : sentCount > 0 ? "warning" : "failed",
  });

  return {
    success: true,
    sentCount,
    failedCount,
    total: orders.length,
    results,
  };
}

/**
 * Fulfills an individual Shopify order via Shopify REST Admin API (2024-07).
 */
export async function fulfillShopifyOrder(
  orderId: string,
  options?: {
    trackingNumber?: string;
    trackingCompany?: string;
    trackingUrl?: string;
    notifyCustomer?: boolean;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { shopifyStoreUrl: true, shopifyAccessToken: true, shopifyIntegrationToken: true },
  });

  if (!org?.shopifyStoreUrl || !org?.shopifyAccessToken) {
    throw new Error("Shopify store is not connected or access token is missing.");
  }

  let token = org.shopifyAccessToken;

  const getFulfillmentOrders = async (tok: string) => {
    return fetch(
      `https://${org.shopifyStoreUrl}/admin/api/2024-07/orders/${orderId}/fulfillment_orders.json`,
      {
        headers: {
          "X-Shopify-Access-Token": tok,
          "Content-Type": "application/json",
        },
      }
    );
  };

  let foRes = await getFulfillmentOrders(token);

  // Auto-refresh token if 401
  if (foRes.status === 401 && org.shopifyIntegrationToken) {
    console.log(`>>> [Shopify Fulfill] Token expired for ${org.shopifyStoreUrl}. Refreshing...`);
    const refreshed = await refreshShopifyToken(org.shopifyStoreUrl, org.shopifyIntegrationToken);
    if (refreshed) {
      const updatedOrg = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { shopifyAccessToken: true },
      });
      if (updatedOrg?.shopifyAccessToken) {
        token = updatedOrg.shopifyAccessToken;
        foRes = await getFulfillmentOrders(token);
      }
    }
  }

  if (!foRes.ok) {
    const errText = await foRes.text();
    console.error(`[FulfillShopifyOrder] Failed to get fulfillment_orders for #${orderId}:`, errText);
    throw new Error(`Shopify API error (${foRes.status}): ${errText}`);
  }

  const foData = await foRes.json();
  const fulfillmentOrders = foData.fulfillment_orders || [];

  const openFulfillmentOrders = fulfillmentOrders.filter((fo: any) =>
    ["open", "in_progress", "scheduled"].includes(fo.status)
  );

  if (openFulfillmentOrders.length === 0) {
    const closedFo = fulfillmentOrders.filter((fo: any) => fo.status === "closed");
    if (closedFo.length > 0) {
      return { success: true, message: "Order is already fulfilled in Shopify." };
    }
    throw new Error("No open fulfillment requests found for this order on Shopify.");
  }

  const lineItemsByFulfillmentOrder = openFulfillmentOrders.map((fo: any) => ({
    fulfillment_order_id: fo.id,
  }));

  const payload: any = {
    fulfillment: {
      line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
      notify_customer: options?.notifyCustomer ?? false,
    },
  };

  if (options?.trackingNumber) {
    payload.fulfillment.tracking_info = {
      number: options.trackingNumber,
      company: options.trackingCompany || "Other",
      ...(options.trackingUrl ? { url: options.trackingUrl } : {}),
    };
  }

  const createFulfillment = async (tok: string) => {
    return fetch(
      `https://${org.shopifyStoreUrl}/admin/api/2024-07/fulfillments.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": tok,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
  };

  let createRes = await createFulfillment(token);

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`[FulfillShopifyOrder] Failed to create fulfillment for #${orderId}:`, errText);
    throw new Error(`Failed to fulfill order #${orderId} on Shopify: ${errText}`);
  }

  const createData = await createRes.json();
  revalidatePath("/dashboard/integrations/shopify");

  return { success: true, fulfillment: createData.fulfillment };
}

/**
 * Fulfills multiple Shopify orders in bulk and updates Shopify accordingly.
 */
export async function bulkFulfillShopifyOrders(
  orderIds: string[],
  options?: {
    notifyCustomer?: boolean;
    trackingCompany?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  if (!orderIds || orderIds.length === 0) {
    return { success: true, fulfilledCount: 0, failedCount: 0, total: 0, results: [] };
  }

  let fulfilledCount = 0;
  let failedCount = 0;
  const results: { orderId: string; status: "fulfilled" | "failed"; error?: string }[] = [];

  for (const orderId of orderIds) {
    try {
      await fulfillShopifyOrder(orderId, {
        notifyCustomer: options?.notifyCustomer ?? false,
        trackingCompany: options?.trackingCompany,
      });
      fulfilledCount++;
      results.push({ orderId, status: "fulfilled" });
    } catch (err: any) {
      console.error(`[BulkFulfillShopify] Failed for order ${orderId}:`, err.message);
      failedCount++;
      results.push({ orderId, status: "failed", error: err.message || "Fulfillment failed" });
    }
  }

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: "Bulk Fulfilled",
    module: "Shopify Integration",
    target: `Bulk fulfilled ${fulfilledCount} orders on Shopify (${failedCount} failed)`,
    status: failedCount === 0 ? "success" : fulfilledCount > 0 ? "warning" : "failed",
  });

  revalidatePath("/dashboard/integrations/shopify");

  return {
    success: true,
    fulfilledCount,
    failedCount,
    total: orderIds.length,
    results,
  };
}

