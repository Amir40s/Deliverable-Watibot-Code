import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createOrder, cancelOrder, createAppointment, rescheduleAppointment, cancelAppointment, getAvailableTimeSlots } from "@/lib/ai/commerce-tools";
import { createHash } from "crypto";

export interface OrderCustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  postal_code?: string;
}

export interface StructuredOrderData {
  status?: "none" | "collecting_information" | "awaiting_confirmation" | "confirmed" | "cancelled";
  product?: string;
  quantity?: number | string;
  price?: number | string;
  currency?: string;
  customer?: OrderCustomerInfo;
  notes?: string;
  order_id?: string;
  order_number?: string;
  [key: string]: any;
}

export interface StructuredAppointmentData {
  status?: "none" | "collecting_information" | "awaiting_confirmation" | "confirmed" | "cancelled" | "reschedule_requested";
  service?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  staff?: string;
  price?: number | string;
  currency?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  notes?: string;
  appointment_id?: string;
  appointment_number?: string;
  [key: string]: any;
}

export interface CommerceProcessOptions {
  organizationId: string;
  contactId: string;
  fallbackPhone?: string;
  agentId?: string | null;
  intent?: string;
  order?: StructuredOrderData | null;
  appointment?: StructuredAppointmentData | null;
  rawCustomerMessage?: string;
}

export interface CommerceProcessResult {
  orderHandled: boolean;
  orderAction?: "created" | "duplicate_prevented" | "cancelled" | "state_updated" | "none";
  orderResult?: any;
  appointmentHandled: boolean;
  appointmentAction?: "created" | "duplicate_prevented" | "rescheduled" | "cancelled" | "state_updated" | "none";
  appointmentResult?: any;
}

function computeHash(input: string): string {
  return createHash("sha256").update(input.trim().toLowerCase()).digest("hex");
}

/**
 * Backend Commerce Automation Handler:
 * - Detects order/appointment states
 * - Enforces idempotency (strictly prevents duplicate orders & bookings on repeated 'yes'/'ok')
 * - Validates and saves confirmed orders to DB (prisma.order)
 * - Validates and saves confirmed appointments to DB (prisma.appointment)
 * - Handles cancellations and reschedulings
 * - Updates contact.customAttributes with pending or confirmed references
 */
export async function processCommerceAutomation(
  options: CommerceProcessOptions
): Promise<CommerceProcessResult> {
  const {
    organizationId,
    contactId,
    fallbackPhone,
    agentId,
    order,
    appointment,
  } = options;

  const result: CommerceProcessResult = {
    orderHandled: false,
    orderAction: "none",
    appointmentHandled: false,
    appointmentAction: "none",
  };

  if (!organizationId || !contactId) {
    return result;
  }

  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        waId: true,
        name: true,
        customAttributes: true,
      },
    });

    if (!contact) return result;

    const existingAttrs = (contact.customAttributes as Record<string, any>) || {};
    let attrsNeedUpdate = false;
    const updatedAttrs = { ...existingAttrs };

    // ─── 1. ORDER AUTOMATION PROCESSING ───────────────────────────────────────
    if (order && typeof order === "object") {
      const orderStatus = String(order.status || "").toLowerCase().trim();
      const customerInfo = order.customer || {};
      const customerName = String(customerInfo.name || contact.name || "Customer").trim();
      const customerPhone = String(customerInfo.phone || contact.waId || fallbackPhone || "").trim();
      const deliveryAddress = String(customerInfo.address || existingAttrs.deliveryAddress || "").trim();
      const productName = String(order.product || "Product").trim();
      const quantity = Math.max(1, parseInt(String(order.quantity || 1), 10) || 1);
      const unitPrice = order.price !== undefined ? parseFloat(String(order.price)) : undefined;

      if (orderStatus === "confirmed") {
        result.orderHandled = true;

        // Idempotency: Compute order signature to strictly prevent duplicate orders
        const orderSignature = `${contactId}_${productName}_${quantity}_${deliveryAddress}_${unitPrice || ""}`;
        const currentOrderHash = computeHash(orderSignature);

        const lastConfirmedHash = existingAttrs.lastConfirmedOrderHash;
        const lastConfirmedTime = existingAttrs.lastConfirmedOrderAt
          ? new Date(existingAttrs.lastConfirmedOrderAt).getTime()
          : 0;
        const isRecentConfirmation = Date.now() - lastConfirmedTime < 15 * 60 * 1000; // 15 minutes window

        if (lastConfirmedHash === currentOrderHash && isRecentConfirmation && existingAttrs.lastConfirmedOrderNumber) {
          logger.flow.warn(
            `[CommerceHandler] Idempotency triggered: Order already confirmed (${existingAttrs.lastConfirmedOrderNumber}) for contact ${contactId}. Preventing duplicate creation.`
          );
          result.orderAction = "duplicate_prevented";
          result.orderResult = {
            orderNumber: existingAttrs.lastConfirmedOrderNumber,
            isDuplicate: true,
          };
        } else {
          // Double check database for existing identical pending/confirmed order in last 10 minutes
          const recentDbOrder = await prisma.order.findFirst({
            where: {
              organizationId,
              contactId,
              status: { in: ["PENDING", "CONFIRMED"] },
              createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
              deliveryAddress: deliveryAddress ? { equals: deliveryAddress, mode: "insensitive" } : undefined,
            },
            orderBy: { createdAt: "desc" },
          });

          if (recentDbOrder && recentDbOrder.orderNumber) {
            // Verify if same product
            const items = Array.isArray(recentDbOrder.items) ? (recentDbOrder.items as any[]) : [];
            const hasSameProduct = items.some(
              (it) => String(it.productName || it.name || "").toLowerCase() === productName.toLowerCase()
            );

            if (hasSameProduct || recentDbOrder.status === "PENDING") {
              logger.flow.warn(
                `[CommerceHandler] Re-using/updating existing recent order ${recentDbOrder.orderNumber} for contact ${contactId} to prevent duplicate.`
              );

              // Update existing order with finalized details
              await prisma.order.update({
                where: { id: recentDbOrder.id },
                data: {
                  customerName: customerName || recentDbOrder.customerName,
                  customerPhone: customerPhone || recentDbOrder.customerPhone,
                  deliveryAddress: deliveryAddress || recentDbOrder.deliveryAddress,
                  items: [
                    {
                      productName,
                      quantity,
                      unitPrice: unitPrice ?? 0,
                    },
                  ],
                  status: "CONFIRMED",
                  notes: order.notes || recentDbOrder.notes,
                },
              });

              result.orderAction = "duplicate_prevented";
              result.orderResult = {
                orderNumber: recentDbOrder.orderNumber,
                orderId: recentDbOrder.id,
                isDuplicate: true,
              };

              // Update contact attributes
              updatedAttrs.lastConfirmedOrderNumber = recentDbOrder.orderNumber;
              updatedAttrs.lastConfirmedOrderId = recentDbOrder.id;
              updatedAttrs.lastConfirmedOrderHash = currentOrderHash;
              updatedAttrs.lastConfirmedOrderAt = new Date().toISOString();
              delete updatedAttrs.pendingOrder;
              attrsNeedUpdate = true;

              // Auto-dispatch to POS Webhook if configured for agent
              try {
                const { dispatchPOSOrderWebhook } = await import("@/lib/pos/webhook");
                dispatchPOSOrderWebhook({
                  organizationId,
                  orderId: recentDbOrder.id,
                  agentId,
                  contactId,
                }).catch((posErr) => {
                  logger.flow.warn(`[CommerceHandler] POS webhook dispatch warning: ${posErr.message}`);
                });
              } catch {}
            }
          }

          if (result.orderAction !== "duplicate_prevented") {
            // Create New Order in DB
            const created = await createOrder(organizationId, contactId, {
              customerName: customerName || "Customer",
              customerPhone: customerPhone || "N/A",
              customerEmail: customerInfo.email || undefined,
              deliveryAddress: deliveryAddress || "Address to be confirmed",
              items: [
                {
                  productName,
                  quantity,
                  unitPrice,
                },
              ],
              notes: order.notes || undefined,
            });

            if (created && created.success) {
              result.orderAction = "created";
              result.orderResult = created;

              updatedAttrs.lastConfirmedOrderNumber = created.orderNumber;
              updatedAttrs.lastConfirmedOrderId = created.orderId;
              updatedAttrs.lastConfirmedOrderHash = currentOrderHash;
              updatedAttrs.lastConfirmedOrderAt = new Date().toISOString();
              if (deliveryAddress) updatedAttrs.deliveryAddress = deliveryAddress;
              delete updatedAttrs.pendingOrder;
              attrsNeedUpdate = true;

              logger.flow.success(
                `[CommerceHandler] Successfully created Order #${created.orderNumber} for contact ${contactId}`
              );

              // Auto-dispatch to POS Webhook if configured for agent
              if (created.orderId) {
                try {
                  const { dispatchPOSOrderWebhook } = await import("@/lib/pos/webhook");
                  dispatchPOSOrderWebhook({
                    organizationId,
                    orderId: created.orderId,
                    agentId,
                    contactId,
                  }).catch((posErr) => {
                    logger.flow.warn(`[CommerceHandler] POS webhook dispatch warning: ${posErr.message}`);
                  });
                } catch {}
              }

              // Auto-sync confirmed order row to linked Google Sheet if configured
              try {
                const { getOrganizationSpreadsheet } = await import("@/lib/ai/lead-saver");
                const sheetTarget = await getOrganizationSpreadsheet(organizationId);
                if (sheetTarget?.spreadsheetId) {
                  const { appendToGoogleSheet } = await import("@/lib/flows/integrations/google-sheets");
                  await appendToGoogleSheet(
                    sheetTarget.spreadsheetId,
                    sheetTarget.sheetName || "Orders",
                    {
                      Timestamp: new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
                      "Order Number": created.orderNumber,
                      Customer: customerName,
                      Phone: customerPhone,
                      Address: deliveryAddress,
                      Product: productName,
                      Quantity: String(quantity),
                      Total: `${created.currency || "USD"} ${created.totalAmount}`,
                      Status: "CONFIRMED",
                    },
                    organizationId
                  );
                }
              } catch (sheetErr: any) {
                logger.flow.warn(`[CommerceHandler] Sheet sync warning: ${sheetErr.message}`);
              }
            } else {
              logger.flow.error(`[CommerceHandler] Order creation failed: ${created?.error}`);
            }
          }
        }
      } else if (orderStatus === "cancelled") {
        result.orderHandled = true;
        result.orderAction = "cancelled";
        delete updatedAttrs.pendingOrder;
        attrsNeedUpdate = true;

        if (existingAttrs.lastConfirmedOrderNumber) {
          await cancelOrder(organizationId, {
            orderNumber: existingAttrs.lastConfirmedOrderNumber,
            reason: "Customer cancelled via AI chat",
          });
        }
      } else if (orderStatus === "collecting_information" || orderStatus === "awaiting_confirmation") {
        result.orderHandled = true;
        result.orderAction = "state_updated";
        updatedAttrs.pendingOrder = {
          ...order,
          lastUpdated: new Date().toISOString(),
        };
        if (deliveryAddress) updatedAttrs.deliveryAddress = deliveryAddress;
        attrsNeedUpdate = true;
      }
    }

    // ─── 2. APPOINTMENT AUTOMATION PROCESSING ─────────────────────────────────
    if (appointment && typeof appointment === "object") {
      const aptStatus = String(appointment.status || "").toLowerCase().trim();
      const customerInfo = appointment.customer || {};
      const customerName = String(customerInfo.name || contact.name || "Customer").trim();
      const customerPhone = String(customerInfo.phone || contact.waId || fallbackPhone || "").trim();
      const serviceName = String(appointment.service || "Consultation").trim();
      const aptDate = String(appointment.date || "").trim();
      const aptTime = String(appointment.time || "").trim();

      if (aptStatus === "confirmed" && aptDate && aptTime) {
        result.appointmentHandled = true;

        const aptSignature = `${contactId}_${serviceName}_${aptDate}_${aptTime}`;
        const currentAptHash = computeHash(aptSignature);

        const lastConfirmedAptHash = existingAttrs.lastConfirmedAppointmentHash;
        const lastConfirmedAptTime = existingAttrs.lastConfirmedAppointmentAt
          ? new Date(existingAttrs.lastConfirmedAppointmentAt).getTime()
          : 0;
        const isRecentApt = Date.now() - lastConfirmedAptTime < 15 * 60 * 1000;

        if (lastConfirmedAptHash === currentAptHash && isRecentApt && existingAttrs.lastConfirmedAppointmentNumber) {
          logger.flow.warn(
            `[CommerceHandler] Idempotency: Appointment already confirmed (${existingAttrs.lastConfirmedAppointmentNumber}) for contact ${contactId}. Preventing duplicate.`
          );
          result.appointmentAction = "duplicate_prevented";
          result.appointmentResult = {
            appointmentNumber: existingAttrs.lastConfirmedAppointmentNumber,
            isDuplicate: true,
          };
        } else {
          // Check collision in DB
          const collision = await prisma.appointment.findFirst({
            where: {
              organizationId,
              date: aptDate,
              time: aptTime,
              status: { in: ["CONFIRMED", "PENDING"] },
              contactId: { not: contactId },
            },
          });

          if (collision) {
            logger.flow.warn(`[CommerceHandler] Appointment collision on ${aptDate} at ${aptTime}`);
            result.appointmentAction = "none";
            result.appointmentResult = {
              error: `Slot ${aptTime} on ${aptDate} is already booked.`,
            };
          } else {
            const booked = await createAppointment(organizationId, contactId, {
              customerName: customerName || "Customer",
              customerPhone: customerPhone || "N/A",
              customerEmail: customerInfo.email || undefined,
              serviceName,
              date: aptDate,
              time: aptTime,
              staffName: appointment.staff || undefined,
              notes: appointment.notes || undefined,
              price: appointment.price ? parseFloat(String(appointment.price)) : undefined,
            });

            if (booked && booked.success) {
              result.appointmentAction = "created";
              result.appointmentResult = booked;

              updatedAttrs.lastConfirmedAppointmentNumber = booked.appointmentNumber;
              updatedAttrs.lastConfirmedAppointmentId = booked.appointmentId;
              updatedAttrs.lastConfirmedAppointmentHash = currentAptHash;
              updatedAttrs.lastConfirmedAppointmentAt = new Date().toISOString();
              delete updatedAttrs.pendingAppointment;
              attrsNeedUpdate = true;

              logger.flow.success(
                `[CommerceHandler] Successfully booked Appointment #${booked.appointmentNumber} for contact ${contactId}`
              );
            }
          }
        }
      } else if (aptStatus === "reschedule_requested" && appointment.appointment_number && aptDate && aptTime) {
        result.appointmentHandled = true;
        result.appointmentAction = "rescheduled";
        const rescheduled = await rescheduleAppointment(organizationId, {
          appointmentNumber: appointment.appointment_number,
          newDate: aptDate,
          newTime: aptTime,
        });
        result.appointmentResult = rescheduled;
        delete updatedAttrs.pendingAppointment;
        attrsNeedUpdate = true;
      } else if (aptStatus === "cancelled") {
        result.appointmentHandled = true;
        result.appointmentAction = "cancelled";
        delete updatedAttrs.pendingAppointment;
        attrsNeedUpdate = true;

        if (existingAttrs.lastConfirmedAppointmentNumber) {
          await cancelAppointment(organizationId, {
            appointmentNumber: existingAttrs.lastConfirmedAppointmentNumber,
            reason: "Customer cancelled via AI chat",
          });
        }
      } else if (aptStatus === "collecting_information" || aptStatus === "awaiting_confirmation") {
        result.appointmentHandled = true;
        result.appointmentAction = "state_updated";
        updatedAttrs.pendingAppointment = {
          ...appointment,
          lastUpdated: new Date().toISOString(),
        };
        attrsNeedUpdate = true;
      }
    }

    if (attrsNeedUpdate) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { customAttributes: updatedAttrs as any },
      });
    }

    return result;
  } catch (err: any) {
    logger.flow.error(`[CommerceHandler] Error processing commerce automation: ${err.message}`);
    return result;
  }
}
