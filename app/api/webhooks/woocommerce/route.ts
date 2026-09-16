import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { verifyWooCommerceWebhook } from '@/lib/woocommerce';

function resolveFieldValue(fieldPath: string, payload: any) {
  if (fieldPath === 'number') return payload.number;
  if (fieldPath === 'total') return payload.total;
  if (fieldPath === 'currency') return payload.currency;
  if (fieldPath === 'billing.first_name') return payload.billing?.first_name;
  if (fieldPath === 'billing.last_name') return payload.billing?.last_name;
  if (fieldPath === 'billing.phone') return payload.billing?.phone;
  if (fieldPath === 'billing.email') return payload.billing?.email;
  if (fieldPath === 'shipping.address_1') return payload.shipping?.address_1;
  if (fieldPath === 'shipping.city') return payload.shipping?.city;
  if (fieldPath === 'payment_method_title') return payload.payment_method_title;
  if (fieldPath === 'status') return payload.status;
  if (fieldPath === 'items_summary') {
    return payload.line_items?.map((item: any) => `${item.name} (x${item.quantity})`).join(', ');
  }
  return fieldPath; // Fallback to literal
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    const signature = req.headers.get('x-wc-webhook-signature');
    const topic = req.headers.get('x-wc-webhook-topic');
    const source = req.headers.get('x-wc-webhook-source');
    const userAgent = req.headers.get('user-agent') || '';

    // If headers are missing, check if it's a WooCommerce "ping"
    if (!signature || !topic || !source) {
      const isWooCommerce = userAgent.includes('WooCommerce') || userAgent.includes('Hookshot');
      
      if (isWooCommerce && token) {
        // Find the organization to verify the token
        const organization = await prisma.organization.findFirst({
          where: { 
            OR: [
              { id: token },
              { shopifyIntegrationToken: token }
            ]
          }
        });

        if (organization) {
          console.log(`[WooCommerceWebhook] Acknowledging headerless request (likely setup ping) for org: ${organization.id}`);
          return NextResponse.json({ success: true, message: 'Endpoint verified' });
        }
      }

      console.warn(`[WooCommerceWebhook] 401: Missing headers. 
        - Signature: ${!!signature}
        - Topic: ${topic}
        - Source: ${source}
        - UA: ${userAgent}
        - All Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}
      `);
      return NextResponse.json({ error: 'Missing required headers' }, { status: 401 });
    }

    const rawBody = await req.text();
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      // For pings or form-encoded requests, payload might not be JSON
      console.log(`[WooCommerceWebhook] Non-JSON payload received for topic ${topic}`);
      payload = {};
    }

    // Find the organization
    let organization;
    
    if (token) {
      organization = await prisma.organization.findFirst({
        where: { 
          OR: [
            { id: token },
            { shopifyIntegrationToken: token }
          ]
        }
      });
    }

    if (!organization && source) {
      const normalizedSource = source.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '').toLowerCase();
      console.log(`[WooCommerceWebhook] Searching for store matching: "${normalizedSource}"`);
      
      organization = await prisma.organization.findFirst({
        where: { 
          woocommerceStoreUrl: {
              contains: normalizedSource,
              mode: 'insensitive'
          }
        }
      });
    }

    if (!organization) {
      console.warn(`[WooCommerceWebhook] 401: Organization not found. Source: ${source}, Token: ${token}`);
      return NextResponse.json({ error: 'Organization not found' }, { status: 401 });
    }

    if (!organization.woocommerceWebhookSecret) {
      console.warn(`[WooCommerceWebhook] 401: Secret missing for org: ${organization.id}`);
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 401 });
    }

    // Verify signature
    const isValid = verifyWooCommerceWebhook(rawBody, signature, organization.woocommerceWebhookSecret);
    if (!isValid) {
      console.warn(`[WooCommerceWebhook] 401: Signature mismatch. 
        - Org: ${organization.id}
        - Secret ends with: ...${organization.woocommerceWebhookSecret.slice(-4)}
        - Signature: ${signature}
      `);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log(`[WooCommerceWebhook] Received Topic: ${topic} from ${source}`);

    const isOrderEvent = 
      topic === 'order.created' || 
      topic === 'order.updated' || 
      topic === 'orders/create' || 
      topic === 'orders/update';

    if (isOrderEvent) {
      console.log('>>> WooCommerce Webhook Payload:', JSON.stringify(payload, null, 2));
      const orderId = payload.id.toString();
      const orderNumber = payload.number.toString();
      const totalPrice = payload.total;
      const currency = payload.currency;
      const phone = payload.billing?.phone || payload.shipping?.phone || payload.customer?.phone;
      const email = payload.billing?.email || payload.customer?.email;

      // 1. Sync the order in our database
      await prisma.wooCommerceOrder.upsert({
        where: { 
          organizationId_wooOrderId: {
            organizationId: organization.id,
            wooOrderId: orderId
          }
        },
        update: {
          orderNumber,
          totalPrice,
          currency,
          customerPhone: phone,
          customerEmail: email,
          status: payload.status,
          paymentStatus: payload.date_paid ? 'paid' : 'pending',
          lineItems: payload.line_items || null,
        },
        create: {
          organizationId: organization.id,
          wooOrderId: orderId,
          orderNumber,
          totalPrice,
          currency,
          customerPhone: phone,
          customerEmail: email,
          status: payload.status,
          paymentStatus: payload.date_paid ? 'paid' : 'pending',
          lineItems: payload.line_items || null,
        }
      });

      if (phone) {
        // 2. Normalize phone number and Find/Create Contact
        const { normalizePhoneNumber } = await import('@/lib/phone');
        const waId = normalizePhoneNumber(phone);
        
        let contact = await prisma.contact.findUnique({
          where: {
            organizationId_platform_waId: {
              organizationId: organization.id,
              platform: 'WHATSAPP',
              waId: waId
            }
          }
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              organizationId: organization.id,
              waId: waId,
              name: `${payload.billing?.first_name || ''} ${payload.billing?.last_name || ''}`.trim() || 'WooCommerce Customer',
              firstName: payload.billing?.first_name,
              lastName: payload.billing?.last_name,
              email: email,
              platform: 'WHATSAPP',
              isAutoCreated: true
            }
          });
        }

        // 3. Direct Automation Logic (AiSensy-style)
        try {
          const automationConfig = organization.woocommerceAutomation as any;
          if (automationConfig) {
            let automationKey = '';
            
            // Map WooCommerce topic/status to automation keys
            if (topic === 'order.created' || topic === 'orders/create') {
              automationKey = 'order_confirmation';
            } else if (topic === 'order.updated' || topic === 'orders/update') {
              if (payload.status === 'completed' || payload.status === 'processing') {
                automationKey = 'order_fulfillment';
              } else if (payload.status === 'cancelled') {
                automationKey = 'order_cancellation';
              } else if (payload.status === 'pending') {
                automationKey = 'abandoned_checkout';
              }
            }

            const config = automationConfig[automationKey];
            if (config && config.active && config.template) {
              console.log(`[WooCommerceAutomation] Triggering direct template for ${automationKey}`);
              
              const systemTrackerContent = `[System] WooCommerce Automation '${automationKey}' sent for order ${orderId}`;
              
              const existingTracker = await prisma.message.findFirst({
                where: {
                  contactId: contact.id,
                  content: systemTrackerContent
                }
              });

              const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
              const existingMsg = await prisma.message.findFirst({
                  where: {
                      contactId: contact.id,
                      content: { contains: `Template: ${config.template}` },
                      createdAt: { gte: oneMinuteAgo },
                      // Ensure it's for the same order if we are blocking it
                      rawBody: {
                        path: ['orderId'],
                        equals: orderId
                      }
                  },
              });

              if (!existingTracker && !existingMsg) {
                const components: any[] = [];
                
                // 1. Handle Header Parameters
                if (config.structure?.header > 0) {
                  const hParams = [];
                  for (let i = 1; i <= config.structure.header; i++) {
                    const val = config.mappings?.[i.toString()] || ' ';
                    const resolvedVal = resolveFieldValue(val, payload);
                    hParams.push({ type: 'text', text: String(resolvedVal || ' ') });
                  }
                  components.push({ type: 'header', parameters: hParams });
                }

                // 2. Handle Body Parameters
                if (config.structure?.body > 0) {
                  const bParams = [];
                  const startIdx = (config.structure?.header || 0) + 1;
                  const endIdx = (config.structure?.header || 0) + config.structure.body;
                  
                  for (let i = startIdx; i <= endIdx; i++) {
                    const val = config.mappings?.[i.toString()] || ' ';
                    const resolvedVal = resolveFieldValue(val, payload);
                    bParams.push({ type: 'text', text: String(resolvedVal || ' ') });
                  }
                  components.push({ type: 'body', parameters: bParams });
                }

                // Fallback for legacy configs without structure
                if (components.length === 0 && config.mappings && !config.structure) {
                  const parameters = Object.keys(config.mappings)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map(key => ({ type: 'text', text: String(resolveFieldValue(config.mappings[key], payload) || ' ') }));
                  
                  if (parameters.length > 0) {
                    components.push({ type: 'body', parameters });
                  }
                }

                console.log(`[WooCommerceAutomation] Sending template "${config.template}" with ${components.length} components`);
                console.log(`[WooCommerceAutomation] Components JSON: ${JSON.stringify(components)}`);

                if (config.delay && config.delay > 0) {
                  const { scheduleWooCommerceMessage } = await import('@/lib/flows/queue');
                  await scheduleWooCommerceMessage({
                    contactId: contact.id,
                    templateName: config.template,
                    language: config.language || 'en_US',
                    components,
                    delayHours: config.delay,
                    organizationId: organization.id
                  });
                  console.log(`[WooCommerceAutomation] Scheduled template for ${automationKey} with ${config.delay}h delay`);
                } else {
                  const { sendUnifiedMessage } = await import('@/lib/messaging/api');
                  await sendUnifiedMessage({
                    contactId: contact.id,
                    templateName: config.template,
                    templateLanguage: config.language || 'en_US',
                    templateComponents: components.length > 0 ? components : undefined,
                    message: `Automated ${automationKey} notification`,
                    skipWindowCheck: true,
                  });
                  console.log(`[WooCommerceAutomation] Successfully sent direct template for ${automationKey}`);
                }
                
                // Mark as sent permanently for this order
                await prisma.message.create({
                  data: {
                    contactId: contact.id,
                    type: 'internal_log',
                    direction: 'internal',
                    status: 'sent',
                    content: systemTrackerContent,
                    rawBody: { orderId, automationKey } as any
                  }
                }).catch(e => console.error("Failed to save woo tracker:", e));
              }
            }

    
            const adminConfig = automationConfig?.['admin_notification'];
            if (automationKey && adminConfig && adminConfig.active && adminConfig.template && adminConfig.adminPhone) {
              await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 800)));
              console.log(`[WooCommerceAutomation] Triggering admin notification for ${automationKey}`);
              const { normalizePhoneNumber } = await import('@/lib/phone');
              const adminWaId = normalizePhoneNumber(adminConfig.adminPhone);
              
              let adminContact = await prisma.contact.findUnique({
                where: {
                  organizationId_platform_waId: {
                    organizationId: organization.id,
                    platform: 'WHATSAPP',
                    waId: adminWaId
                  }
                }
              });

              if (!adminContact) {
                adminContact = await prisma.contact.create({
                  data: {
                    organizationId: organization.id,
                    waId: adminWaId,
                    name: 'Store Admin',
                    platform: 'WHATSAPP',
                    isAutoCreated: true
                  }
                });
              }

              const adminSystemTrackerContent = `[System] WooCommerce Admin Notification '${automationKey}' sent for order ${orderId}`;
              
              const existingAdminTracker = await prisma.message.findFirst({
                where: {
                  contactId: adminContact.id,
                  content: adminSystemTrackerContent
                }
              });

              const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
              const existingAdminMsg = await prisma.message.findFirst({
                  where: {
                      contactId: adminContact.id,
                      content: { contains: `Template: ${adminConfig.template}` },
                      createdAt: { gte: oneMinuteAgo },
                      rawBody: {
                        path: ['orderId'],
                        equals: orderId
                      }
                  },
              });

              const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
              const recentAdminNotification = await prisma.message.findFirst({
                where: {
                  contactId: adminContact.id,
                  type: 'internal_log',
                  createdAt: { gte: fifteenSecondsAgo },
                  rawBody: {
                    path: ['orderId'],
                    equals: orderId
                  }
                }
              });

              if (!existingAdminTracker && !existingAdminMsg && !recentAdminNotification) {
                const adminComponents: any[] = [];
                
                // 1. Handle Header Parameters
                if (adminConfig.structure?.header > 0) {
                  const hParams = [];
                  for (let i = 1; i <= adminConfig.structure.header; i++) {
                    const val = adminConfig.mappings?.[i.toString()] || ' ';
                    const resolvedVal = resolveFieldValue(val, payload);
                    hParams.push({ type: 'text', text: String(resolvedVal || ' ') });
                  }
                  adminComponents.push({ type: 'header', parameters: hParams });
                }

                // 2. Handle Body Parameters
                if (adminConfig.structure?.body > 0) {
                  const bParams = [];
                  const startIdx = (adminConfig.structure?.header || 0) + 1;
                  const endIdx = (adminConfig.structure?.header || 0) + adminConfig.structure.body;
                  
                  for (let i = startIdx; i <= endIdx; i++) {
                    const val = adminConfig.mappings?.[i.toString()] || ' ';
                    const resolvedVal = resolveFieldValue(val, payload);
                    bParams.push({ type: 'text', text: String(resolvedVal || ' ') });
                  }
                  adminComponents.push({ type: 'body', parameters: bParams });
                }

                // Fallback for legacy configs without structure
                if (adminComponents.length === 0 && adminConfig.mappings && !adminConfig.structure) {
                  const parameters = Object.keys(adminConfig.mappings)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map(key => ({ type: 'text', text: String(resolveFieldValue(adminConfig.mappings[key], payload) || ' ') }));
                  
                  if (parameters.length > 0) {
                    adminComponents.push({ type: 'body', parameters });
                  }
                }

                if (adminConfig.delay && adminConfig.delay > 0) {
                  const { scheduleWooCommerceMessage } = await import('@/lib/flows/queue');
                  await scheduleWooCommerceMessage({
                    contactId: adminContact.id,
                    templateName: adminConfig.template,
                    language: adminConfig.language || 'en_US',
                    components: adminComponents,
                    delayHours: adminConfig.delay,
                    organizationId: organization.id
                  });
                  console.log(`[WooCommerceAutomation] Scheduled admin template with ${adminConfig.delay}h delay`);
                } else {
                  const { sendUnifiedMessage } = await import('@/lib/messaging/api');
                  await sendUnifiedMessage({
                    contactId: adminContact.id,
                    templateName: adminConfig.template,
                    templateLanguage: adminConfig.language || 'en_US',
                    templateComponents: adminComponents.length > 0 ? adminComponents : undefined,
                    message: `Automated ${automationKey} admin notification`,
                    skipWindowCheck: true,
                  });
                  console.log(`[WooCommerceAutomation] Successfully sent admin template`);
                }
                
                // Mark as sent permanently for this order
                await prisma.message.create({
                  data: {
                    contactId: adminContact.id,
                    type: 'internal_log',
                    direction: 'internal',
                    status: 'sent',
                    content: adminSystemTrackerContent,
                    rawBody: { orderId, automationKey } as any
                  }
                }).catch(e => console.error("Failed to save admin woo tracker:", e));
              }
            }
          }
        } catch (autoErr) {
          console.error('[WooCommerceAutomation] Error in direct automation:', autoErr);
        }

        // 4. Trigger Flow Engine (Secondary)
        const { processWooCommerceEvent } = await import('@/lib/flows/engine');
        await processWooCommerceEvent(
          organization.id,
          contact.id,
          topic,
          payload,
          contact
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WooCommerceWebhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
