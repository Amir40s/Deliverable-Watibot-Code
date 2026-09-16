'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchWooCommerceOrders, fetchWooCommerceProducts, updateWooCommerceOrder, addNoteToWooCommerceOrder } from '@/lib/woocommerce';
import { logActivity } from "@/lib/activityLog";
import { revalidatePath } from 'next/cache';
import { internalSendTemplateMessage } from '@/lib/whatsapp/api';

export async function getWooCommerceOrders() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) return [];

        const org = await prisma.organization.findUnique({
            where: { id: session.user.organizationId },
            select: {
                woocommerceStoreUrl: true,
                woocommerceConsumerKey: true,
                woocommerceConsumerSecret: true,
            }
        });

        if (!org?.woocommerceStoreUrl || !org?.woocommerceConsumerKey || !org?.woocommerceConsumerSecret) {
            return [];
        }

        const rawOrders = await fetchWooCommerceOrders(
            org.woocommerceStoreUrl,
            org.woocommerceConsumerKey,
            org.woocommerceConsumerSecret,
            1,
            100
        );

        return (rawOrders || []).map((order: any) => {
            const phone = order.billing?.phone || order.customer?.phone || order.shipping?.phone || '';
            const email = order.billing?.email || order.customer?.email || order.shipping?.email || '';
            const firstName = order.billing?.first_name || order.shipping?.first_name || order.customer?.first_name || '';
            const lastName = order.billing?.last_name || order.shipping?.last_name || order.customer?.last_name || '';
            const customerName = `${firstName} ${lastName}`.trim() || (email ? email.split('@')[0] : 'Customer');

            const lineItems = (order.line_items || []).map((li: any) => ({
                id: li.id?.toString() || Math.random().toString(),
                productId: li.product_id?.toString() || '',
                variantId: li.variation_id?.toString() || '',
                title: li.name || 'Product',
                name: li.name || 'Product',
                quantity: Number(li.quantity) || 1,
                price: li.price?.toString() || (Number(li.total || 0) / (Number(li.quantity) || 1)).toFixed(2),
                total: li.total?.toString() || '0.00',
                sku: li.sku || '',
                imageUrl: li.image?.src || '',
            }));

            const itemsCount = lineItems.reduce((acc: number, item: any) => acc + item.quantity, 0) || (lineItems.length || 1);
            const productsSummary = lineItems.map((li: any) => `${li.title || li.name || 'Product'} x${li.quantity || 1}`).join(', ');

            // Normalization
            const rawStatus = String(order.status || 'pending').toLowerCase();
            const financialStatus = ["completed", "processing"].includes(rawStatus) ? "paid" : ["refunded", "cancelled", "failed"].includes(rawStatus) ? "refunded" : "pending";
            const fulfillmentStatus = rawStatus === "completed" ? "fulfilled" : "unfulfilled";

            return {
                id: order.id.toString(),
                wooOrderId: order.id.toString(),
                orderNumber: (order.number || order.id).toString(),
                name: `#${order.number || order.id}`,
                customerName,
                customerPhone: phone,
                customerEmail: email,
                totalPrice: order.total?.toString() || '0.00',
                subtotalPrice: order.discount_total ? (Number(order.total || 0) + Number(order.discount_total || 0)).toFixed(2) : order.total?.toString() || '0.00',
                totalShipping: order.shipping_total?.toString() || '0.00',
                totalTax: order.total_tax?.toString() || '0.00',
                totalDiscounts: order.discount_total?.toString() || '0.00',
                currency: order.currency || 'USD',
                status: order.status,
                paymentStatus: financialStatus,
                financialStatus: financialStatus,
                fulfillmentStatus: fulfillmentStatus,
                paymentMethod: order.payment_method_title || order.payment_method || 'Online Payment',
                paymentGateways: [order.payment_method_title || order.payment_method || 'Online Payment'].filter(Boolean),
                shippingAddress: order.shipping || null,
                billingAddress: order.billing || null,
                shippingLines: order.shipping_lines || [],
                tags: order.meta_data?.find((m: any) => m.key === "watibot_tag")?.value || '',
                lineItems,
                productsSummary,
                itemsCount,
                channel: 'WooCommerce',
                deliveryMethod: order.shipping_lines?.[0]?.method_title || 'Standard Shipping',
                deliveryStatus: rawStatus === 'completed' ? 'Delivered' : '',
                note: order.customer_note || '',
                createdAt: order.date_created || new Date().toISOString(),
                updatedAt: order.date_modified || new Date().toISOString(),
            };
        });
    } catch (error) {
        console.error('Error fetching live WooCommerce orders:', error);
        return [];
    }
}

export async function getWooCommerceProducts() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) return [];

        const org = await prisma.organization.findUnique({
            where: { id: session.user.organizationId },
            select: {
                woocommerceStoreUrl: true,
                woocommerceConsumerKey: true,
                woocommerceConsumerSecret: true,
            }
        });

        if (!org?.woocommerceStoreUrl || !org?.woocommerceConsumerKey || !org?.woocommerceConsumerSecret) {
            return [];
        }

        const rawProducts = await fetchWooCommerceProducts(
            org.woocommerceStoreUrl,
            org.woocommerceConsumerKey,
            org.woocommerceConsumerSecret,
            1,
            100
        );

        return (rawProducts || []).map((p: any) => ({
            id: p.id.toString(),
            name: p.name,
            title: p.name,
            price: p.price?.toString() || '0.00',
            currency: '',
            sku: p.sku || 'N/A',
            imageUrl: p.images?.[0]?.src || null,
            status: p.status,
            updatedAt: p.date_modified || new Date().toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching live WooCommerce products:', error);
        return [];
    }
}

export async function getWooCommerceCustomers() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId) return [];

        const orders = await getWooCommerceOrders();

        const customersMap: Record<string, {
            id: string
            name?: string
            phone: string | null
            email: string | null
            orderCount: number
            totalSpent: number
            lastOrderAt: string | Date | null
        }> = {};

        for (const order of orders) {
            const phone = order.customerPhone;
            const email = order.customerEmail;
            if (!phone && !email) continue;

            const key = phone || email || "";
            if (!customersMap[key]) {
                customersMap[key] = {
                    id: key,
                    name: order.customerName,
                    phone: phone || null,
                    email: email || null,
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrderAt: null
                };
            }

            customersMap[key].orderCount += 1;
            customersMap[key].totalSpent += Number(order.totalPrice) || 0;
            
            const orderDate = new Date(order.createdAt);
            if (!customersMap[key].lastOrderAt || orderDate > new Date(customersMap[key].lastOrderAt)) {
                customersMap[key].lastOrderAt = order.createdAt;
            }
        }

        return Object.values(customersMap).sort((a: any, b: any) => {
            const dateA = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
            const dateB = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
            return dateB - dateA;
        });
    } catch (error) {
        console.error('Error computing live WooCommerce customers:', error);
        return [];
    }
}

/**
 * Fulfills / Completes an individual WooCommerce order.
 */
export async function fulfillWooCommerceOrder(
  orderId: string,
  options?: {
    note?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      woocommerceStoreUrl: true,
      woocommerceConsumerKey: true,
      woocommerceConsumerSecret: true,
    },
  });

  if (!org?.woocommerceStoreUrl || !org?.woocommerceConsumerKey || !org?.woocommerceConsumerSecret) {
    throw new Error("WooCommerce store is not connected or API credentials are missing.");
  }

  const updatedOrder = await updateWooCommerceOrder(
    org.woocommerceStoreUrl,
    org.woocommerceConsumerKey,
    org.woocommerceConsumerSecret,
    orderId,
    { status: "completed" }
  );

  if (options?.note) {
    try {
      await addNoteToWooCommerceOrder(
        org.woocommerceStoreUrl,
        org.woocommerceConsumerKey,
        org.woocommerceConsumerSecret,
        orderId,
        options.note,
        true
      );
    } catch (noteErr) {
      console.warn("Could not add customer note to order:", noteErr);
    }
  }

  revalidatePath("/dashboard/integrations/woocommerce");

  return {
    success: true,
    message: `Order #${orderId} marked as completed in WooCommerce!`,
    order: updatedOrder,
  };
}

/**
 * Fulfills / Completes multiple WooCommerce orders in bulk.
 */
export async function bulkFulfillWooCommerceOrders(
  orderIds: string[],
  options?: {
    note?: string;
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
      await fulfillWooCommerceOrder(orderId, options);
      fulfilledCount++;
      results.push({ orderId, status: "fulfilled" });
    } catch (err: any) {
      console.error(`[BulkFulfillWooCommerce] Failed for order ${orderId}:`, err.message);
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
    module: "WooCommerce Integration",
    target: `Bulk completed ${fulfilledCount} orders on WooCommerce (${failedCount} failed)`,
    status: failedCount === 0 ? "success" : fulfilledCount > 0 ? "warning" : "failed",
  });

  revalidatePath("/dashboard/integrations/woocommerce");

  return {
    success: true,
    fulfilledCount,
    failedCount,
    total: orderIds.length,
    results,
  };
}

/**
 * Sends predefined WhatsApp Template Reminders to selected pending WooCommerce orders.
 */
export async function sendWooCommercePendingOrdersWhatsAppBroadcast({
  orders,
  templateName,
  templateLanguage = "en_US",
  variableMappings = {},
}: {
  orders: any[];
  templateName: string;
  templateLanguage?: string;
  variableMappings?: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error("Unauthorized");

  if (!orders || orders.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0, total: 0, results: [] };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { woocommerceStoreUrl: true },
  });

  const storeDomain = org?.woocommerceStoreUrl ? org.woocommerceStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : "WooCommerce Store";

  let sentCount = 0;
  let failedCount = 0;
  const results: { orderNumber: string; customerName: string; phone: string; status: "sent" | "failed"; error?: string }[] = [];

  const lang = templateLanguage || "en_US";

  for (const order of orders) {
    const rawPhone = order.customerPhone || "";
    const cleanWaId = rawPhone ? rawPhone.replace(/[^0-9]/g, "") : "";

    if (!cleanWaId || cleanWaId.length < 7) {
      failedCount++;
      results.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        phone: rawPhone || "No phone",
        status: "failed",
        error: "Missing or invalid phone number",
      });
      continue;
    }

    try {
      let contact = await prisma.contact.findFirst({
        where: {
          organizationId: session.user.organizationId,
          waId: cleanWaId,
        },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId: session.user.organizationId,
            waId: cleanWaId,
            name: order.customerName || `WooCommerce Customer #${order.orderNumber}`,
            email: order.customerEmail || undefined,
            platform: "WHATSAPP",
            isAutoCreated: true,
          },
        });
      }

      // Build parameters based on variableMappings
      const keys = Object.keys(variableMappings).map(Number).filter((n) => !isNaN(n));
      const maxKey = keys.length > 0 ? Math.max(...keys) : 0;
      const params: { type: "text"; text: string }[] = [];

      for (let i = 1; i <= maxKey; i++) {
        const mappingKey = i.toString();
        const varPath = variableMappings[mappingKey];
        let textVal = " ";

        if (varPath) {
          if (varPath.startsWith("custom:")) {
            textVal = varPath.substring(7);
          } else {
            switch (varPath) {
              case "customer.first_name":
              case "customer_name":
              case "billing.first_name":
                textVal = order.customerName ? order.customerName.split(" ")[0] : "Customer";
                break;
              case "customer.last_name":
              case "billing.last_name":
                textVal = order.customerName ? order.customerName.split(" ").slice(1).join(" ") : "";
                break;
              case "order_number":
              case "number":
                textVal = `#${order.orderNumber}`;
                break;
              case "total_price":
              case "total":
                textVal = `${order.currency || "$"}${order.totalPrice}`;
                break;
              case "currency":
                textVal = order.currency || "USD";
                break;
              case "shop_url":
              case "store_url":
                textVal = storeDomain;
                break;
              case "customer.phone":
              case "billing.phone":
                textVal = order.customerPhone || cleanWaId;
                break;
              case "product_name":
                textVal = order.lineItems?.[0]?.name || order.lineItems?.[0]?.title || order.productsSummary || "Order Items";
                break;
              default:
                textVal = varPath;
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
      console.error(`[WooCommerceBroadcast] Failed for order #${order.orderNumber}:`, err.message);
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
    module: "WooCommerce Integration",
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
