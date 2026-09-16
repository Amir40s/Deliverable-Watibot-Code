import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  internalSendWhatsAppMessage,
  internalSendTemplateMessage,
} from "@/lib/whatsapp/api";
import { processShopifyEvent } from "@/lib/flows/engine";
import { scheduleShopifyMessage } from "@/lib/flows/queue";

const processingOrders = new Set<string>();

const getNestedValue = (obj: any, path: string) => {
  if (!path) return "";
  return path.split(".").reduce((o, i) => (o ? o[i] : undefined), obj);
};

const getDelayMinutes = (config: any): number => {
  if (!config) return 0;
  
  if (
    config.delayDays !== undefined ||
    config.delayHours !== undefined ||
    config.delayMinutes !== undefined ||
    config.delaySeconds !== undefined
  ) {
    const days = Number(config.delayDays) || 0;
    const hours = Number(config.delayHours) || 0;
    const minutes = Number(config.delayMinutes) || 0;
    const seconds = Number(config.delaySeconds) || 0;
    
    return (days * 1440) + (hours * 60) + minutes + (seconds / 60);
  }
  
  if (config.delay && config.delay > 0) {
    return config.delay * 60;
  }
  
  return 0;
};

const doesStatusMatch = (payload: any, conditionStatus: string): boolean => {
  if (!conditionStatus) return false;
  
  const normalizedCondition = conditionStatus.toLowerCase().replace(/[\s-]+/g, "_");
  
  const orderStatus = String(payload.cancelled_at ? "cancelled" : payload.closed_at ? "closed" : "open");
  if (orderStatus === normalizedCondition) return true;
  
  const financialStatus = String(payload.financial_status || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (financialStatus === normalizedCondition) return true;
  
  const fulfillmentStatus = String(payload.fulfillment_status || "unfulfilled").toLowerCase().replace(/[\s-]+/g, "_");
  if (fulfillmentStatus === normalizedCondition) return true;
  
  const returnStatus = String(payload.return_status || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (returnStatus === normalizedCondition) return true;
  
  return false;
};

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const token = req.headers.get("x-watibot-token") || url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { shopifyIntegrationToken: token },
          ...(token.length >= 30 ? [{ shopifyIntegrationToken: { startsWith: token } }] : [])
        ]
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const bodyObj = await req.json();
    
    // Support both proxied webhooks (wrapped) and direct Shopify webhooks (headers)
    const rawTopic = bodyObj.topic || req.headers.get("x-shopify-topic") || "";
    const shop = bodyObj.shop || req.headers.get("x-shopify-shop-domain") || "";
    const payload = bodyObj.payload || bodyObj;
    
    // Improved Normalization
    let topic = rawTopic.toLowerCase();
    if (topic.includes('orders_')) topic = topic.replace('orders_', 'orders/');
    if (topic.includes('checkouts_')) topic = topic.replace('checkouts_', 'checkouts/');
    if (topic.includes('draft_orders_')) topic = topic.replace('draft_orders_', 'draft_orders/');
    if (!topic.includes('/')) topic = topic.replace('_', '/');

    const orderNumber = payload?.order_number?.toString() || payload?.name || "N/A";
    
    console.log(`[ShopifyWebhook] Normalized Topic: ${topic}, Shop: ${shop}, Order: ${orderNumber}`);

    if (
      topic === "orders/create" ||
      topic === "orders/updated" ||
      topic === "orders/cancelled" ||
      topic === "orders/fulfilled" ||
      topic.startsWith("checkouts/") ||
      topic.startsWith("draft_orders/")
    ) {
      const orderId = String(payload.id || payload.token || payload.checkout_id || "N/A");
      const processingKey = `${topic}:${orderId}`;

      if (processingOrders.has(processingKey)) {
        console.log(
          `[ShopifyWebhook] Event ${processingKey} already being processed. Skipping.`,
        );
        return NextResponse.json({ success: true });
      }
      processingOrders.add(processingKey);

      const totalPrice = payload.total_price || payload.total_price_set?.shop_money?.amount || "0.00";
      const currency = payload.currency || payload.presentment_currency || "USD";
      const phone =
        payload.customer?.phone ||
        payload.shipping_address?.phone ||
        payload.billing_address?.phone ||
        payload.phone;
      const email = payload.customer?.email;

      console.log(
        `[ShopifyWebhook] Detected Phone: ${phone || "NONE"}, Email: ${email || "NONE"}`,
      );

      try {
        console.log(`[ShopifyWebhook] Starting processing for order ${orderId}...`);

        let contact;
        try {
          const waId = (phone || "").replace(/\D/g, "");
          if (waId) {
            contact = await prisma.contact.findUnique({
              where: {
                organizationId_platform_waId: {
                  organizationId: organization.id,
                  platform: "WHATSAPP",
                  waId: waId,
                },
              },
            });

            if (!contact) {
              contact = await prisma.contact.create({
                data: {
                  organizationId: organization.id,
                  waId: waId,
                  name:
                    `${payload.customer?.first_name || ""} ${payload.customer?.last_name || ""}`.trim() ||
                    "Shopify Customer",
                  firstName: payload.customer?.first_name,
                  lastName: payload.customer?.last_name,
                  email: email,
                  platform: "WHATSAPP",
                  isAutoCreated: true,
                },
              });
            }
          }
        } catch (contactErr) {
          console.error(`[ShopifyWebhook] Contact Sync Error:`, contactErr);
        }

        if (contact) {
            let firstProductName = payload.line_items?.[0]?.name || payload.line_items?.[0]?.title || "";
            let productTitle = payload.line_items?.[0]?.title || firstProductName;
            let handle = productTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            let productUrl = handle ? `https://${shop}/products/${handle}` : "";
            let paymentMethod = payload.payment_gateway_names?.[0] || payload.gateway || "";

            const enrichedPayload = {
              ...payload,
              shop_url: shop,
              product_name: firstProductName,
              product_url: productUrl,
              payment_method: paymentMethod
            };

            const flowTriggered = await processShopifyEvent(
              organization.id,
              contact.id,
              topic,
              enrichedPayload,
              contact,
            );

            if (!flowTriggered) {
              let automationKey = "";
              const t = topic.toLowerCase();

              if (t === "orders/create") {
                automationKey = "order_confirmation";
              } else if (t === "orders/cancelled") {
                automationKey = "order_cancellation";
              } else if (t === "orders/fulfilled") {
                automationKey = "order_fulfillment";
              } else if (t === "orders/updated") {
                automationKey = "order_notification";
              } else if (t.startsWith("checkouts/")) {
                automationKey = "abandoned_checkout";
              } else if (t.startsWith("draft_orders/")) {
                if (!payload.order_id) {
                    automationKey = "draft_order_recovery";
                }
              }

               const shopConfigs: any[] = await prisma.$queryRawUnsafe(
                 `SELECT automation FROM shopify.shopify_watibot_config WHERE shop = $1`,
                 shop,
               );
               const automation = shopConfigs?.[0]?.automation;

               if (automation && automationKey) {
                 const config = automation?.[automationKey];
                 if (config?.active !== false && config?.template) {
                      const systemTrackerContent = `[System] Shopify Automation '${automationKey}' sent for order ${orderId}`;
                      
                      const existingTracker = await prisma.message.findFirst({
                        where: {
                          contactId: contact.id,
                          content: systemTrackerContent
                        }
                      });

                      if (!existingTracker) {
                        let templateToUse = config.template;
                        if (templateToUse === 'order_confirm') templateToUse = 'order_confirmation';
                        
                        let params: any[] = [];
                        if (config.variableMappings) {
                          const keys = Object.keys(config.variableMappings).map(Number);
                          const maxKey = keys.length > 0 ? Math.max(...keys) : 0;
                          
                          for (let i = 1; i <= maxKey; i++) {
                            const mappingKey = i.toString();
                            const mappingPath = config.variableMappings[mappingKey];
                            let textVal = " ";
                            if (mappingPath) {
                              if (mappingPath.startsWith("custom:")) {
                                textVal = mappingPath.substring(7);
                              } else {
                                textVal = getNestedValue(enrichedPayload, mappingPath)?.toString() || " ";
                              }
                            }
                            params.push({ type: "text", text: textVal });
                          }
                        }

                        let lang = config.language || "en_US";
                        if (lang === "en") lang = "en_US";

                        const components = [{ type: "body", parameters: params }];

                        const customerDelayMinutes = getDelayMinutes(config);
                        if (customerDelayMinutes > 0) {
                          console.log(`[ShopifyWebhook] Scheduling message for ${contact.waId} with ${customerDelayMinutes}m delay`);
                          await scheduleShopifyMessage({
                            contactId: contact.id,
                            templateName: templateToUse,
                            language: lang,
                            components,
                            delayMinutes: customerDelayMinutes,
                            organizationId: organization.id
                          });
                        } else {
                          await internalSendTemplateMessage(
                            contact.id,
                            templateToUse,
                            lang,
                            components,
                          );
                          console.log(`[ShopifyWebhook] Message SENT: ${templateToUse} to ${contact.waId}`);
                        }

                        // Mark as sent permanently for this order
                        await prisma.message.create({
                          data: {
                            contactId: contact.id,
                            type: 'system',
                            direction: 'outbound',
                            status: 'sent',
                            content: systemTrackerContent,
                            rawBody: { orderId, automationKey } as any
                          }
                        }).catch(e => console.error("Failed to save tracker:", e));
                      }

                    }

                    // Admin Notification
                    const adminConfig = automation?.["admin_notification"];
                    if (adminConfig?.active !== false && adminConfig?.template && adminConfig?.adminPhone) {
                        let adminTemplateToUse = adminConfig.template;
                        if (adminTemplateToUse === 'order_confirm') adminTemplateToUse = 'order_confirmation';

                        const adminWaId = adminConfig.adminPhone.replace(/\D/g, "");
                        let adminContact = await prisma.contact.findUnique({
                            where: {
                                organizationId_platform_waId: {
                                    organizationId: organization.id,
                                    platform: "WHATSAPP",
                                    waId: adminWaId,
                                },
                            },
                        });

                        if (!adminContact) {
                            adminContact = await prisma.contact.create({
                                data: {
                                    organizationId: organization.id,
                                    waId: adminWaId,
                                    name: "Store Admin",
                                    platform: "WHATSAPP",
                                    isAutoCreated: true,
                                },
                            });
                        }

                        const adminSystemTrackerContent = `[System] Shopify Admin Notification '${automationKey}' sent for order ${orderId}`;
                        
                        const existingAdminTracker = await prisma.message.findFirst({
                          where: {
                            contactId: adminContact.id,
                            content: adminSystemTrackerContent
                          }
                        });

                        if (!existingAdminTracker) {
                            let adminParams: any[] = [];
                        if (adminConfig.variableMappings) {
                            const keys = Object.keys(adminConfig.variableMappings).map(Number);
                            const maxKey = keys.length > 0 ? Math.max(...keys) : 0;
                            
                            for (let i = 1; i <= maxKey; i++) {
                                const mappingKey = i.toString();
                                const mappingPath = adminConfig.variableMappings[mappingKey];
                                let textVal = " ";
                                if (mappingPath) {
                                  if (mappingPath.startsWith("custom:")) {
                                    textVal = mappingPath.substring(7);
                                  } else {
                                    textVal = getNestedValue(enrichedPayload, mappingPath)?.toString() || " ";
                                  }
                                }
                                adminParams.push({ type: "text", text: textVal });
                            }
                        }

                        const adminComponents = [{ type: "body", parameters: adminParams }];

                        const adminDelayMinutes = getDelayMinutes(adminConfig);
                        if (adminDelayMinutes > 0) {
                            await scheduleShopifyMessage({
                                contactId: adminContact.id,
                                templateName: adminTemplateToUse,
                                language: adminConfig.language || "en_US",
                                components: adminComponents,
                                delayMinutes: adminDelayMinutes,
                                organizationId: organization.id
                            });
                        } else {
                            await internalSendTemplateMessage(
                                adminContact.id,
                                adminTemplateToUse,
                                adminConfig.language || "en_US",
                                adminComponents,
                            );
                        }

                        // Mark admin notification as sent permanently for this order
                        await prisma.message.create({
                          data: {
                            contactId: adminContact.id,
                            type: 'system',
                            direction: 'outbound',
                            status: 'sent',
                            content: adminSystemTrackerContent,
                            rawBody: { orderId, automationKey } as any
                          }
                        }).catch(e => console.error("Failed to save admin tracker:", e));
                    }

                    }
                  }

              if (automation) {
                const rewindConfig = automation?.["rewind"];
                if (
                  rewindConfig?.active !== false &&
                  rewindConfig?.template &&
                  rewindConfig?.conditionStatus &&
                  (t.startsWith("orders/") || t.startsWith("checkouts/") || t.startsWith("draft_orders/"))
                ) {
                  const conditionStatus = rewindConfig.conditionStatus;
                  if (doesStatusMatch(payload, conditionStatus)) {
                    const normalizedCondition = conditionStatus.toLowerCase().replace(/[\s-]+/g, "_");
                    const rewindTrackerContent = `[System] Shopify Automation 'rewind' sent for order ${orderId} for status ${normalizedCondition}`;

                    const existingRewindTracker = await prisma.message.findFirst({
                      where: {
                        contactId: contact.id,
                        content: rewindTrackerContent
                      }
                    });

                    if (!existingRewindTracker) {
                      let templateToUse = rewindConfig.template;
                      if (templateToUse === 'order_confirm') templateToUse = 'order_confirmation';

                      let params: any[] = [];
                      if (rewindConfig.variableMappings) {
                        const keys = Object.keys(rewindConfig.variableMappings).map(Number);
                        const maxKey = keys.length > 0 ? Math.max(...keys) : 0;

                        for (let i = 1; i <= maxKey; i++) {
                          const mappingKey = i.toString();
                          const mappingPath = rewindConfig.variableMappings[mappingKey];
                          let textVal = " ";
                          if (mappingPath) {
                            if (mappingPath.startsWith("custom:")) {
                              textVal = mappingPath.substring(7);
                            } else {
                              textVal = getNestedValue(enrichedPayload, mappingPath)?.toString() || " ";
                            }
                          }
                          params.push({ type: "text", text: textVal });
                        }
                      }

                      let lang = rewindConfig.language || "en_US";
                      if (lang === "en") lang = "en_US";

                      const components = [{ type: "body", parameters: params }];

                      const rewindDelayMinutes = getDelayMinutes(rewindConfig);
                      if (rewindDelayMinutes > 0) {
                        console.log(`[ShopifyWebhook] Scheduling REWIND message for ${contact.waId} with ${rewindDelayMinutes}m delay`);
                        await scheduleShopifyMessage({
                          contactId: contact.id,
                          templateName: templateToUse,
                          language: lang,
                          components,
                          delayMinutes: rewindDelayMinutes,
                          organizationId: organization.id
                        });
                      } else {
                        await internalSendTemplateMessage(
                          contact.id,
                          templateToUse,
                          lang,
                          components,
                        );
                        console.log(`[ShopifyWebhook] REWIND message SENT: ${templateToUse} to ${contact.waId}`);
                      }

                      // Mark as sent permanently for this order and status
                      await prisma.message.create({
                        data: {
                          contactId: contact.id,
                          type: 'system',
                          direction: 'outbound',
                          status: 'sent',
                          content: rewindTrackerContent,
                          rawBody: { orderId, automationKey: "rewind", status: normalizedCondition } as any
                        }
                      }).catch(e => console.error("Failed to save rewind tracker:", e));
                    }
                  }
                }
              }
            }
        }

        // Sync to DB
        try {
            await prisma.shopifyOrder.upsert({
                where: {
                  organizationId_shopifyOrderId: {
                    organizationId: organization.id,
                    shopifyOrderId: orderId,
                  },
                },
                update: {
                  orderNumber,
                  totalPrice,
                  currency,
                  customerPhone: phone,
                  customerEmail: email,
                  status: payload.cancelled_at ? "cancelled" : payload.closed_at ? "closed" : "open",
                  paymentStatus: payload.financial_status,
                  fulfillmentStatus: payload.fulfillment_status || "unfulfilled",
                  lineItems: payload.line_items || null,
                },
                create: {
                  organizationId: organization.id,
                  shopifyOrderId: orderId,
                  orderNumber,
                  totalPrice,
                  currency,
                  customerPhone: phone,
                  customerEmail: email,
                  status: payload.cancelled_at ? "cancelled" : payload.closed_at ? "closed" : "open",
                  paymentStatus: payload.financial_status,
                  fulfillmentStatus: payload.fulfillment_status || "unfulfilled",
                  lineItems: payload.line_items || null,
                },
              });
        } catch (dbErr) {
            console.error(`[ShopifyWebhook] DB Sync Error:`, dbErr);
        }

      } catch (err: any) {
        console.error(`[ShopifyWebhook] Processing Error:`, err.message);
      } finally {
        setTimeout(() => processingOrders.delete(processingKey), 10000);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ShopifyWebhook] Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

