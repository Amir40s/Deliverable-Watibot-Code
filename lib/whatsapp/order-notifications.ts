import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { internalSendWhatsAppMessage } from "@/lib/whatsapp/api";

export interface NotificationTemplateOptions {
  templateName?: string; // 'none' | 'default' | '<approved_template_name>'
  languageCode?: string;
  templateComponents?: any[];
  customParams?: Record<string, string>;
}

/**
 * Standardize phone numbers to international WhatsApp waId format.
 * Particularly handles Pakistan numbers: '03290901775' -> '923290901775'.
 */
export function normalizeWhatsAppNumber(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  let digits = String(rawPhone).replace(/[^0-9]/g, "");
  if (!digits) return "";

  // 11 digits starting with 0 (e.g., 03290901775) -> Pakistan standard 923290901775
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "92" + digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith("3")) {
    // 3290901775 -> 923290901775
    digits = "92" + digits;
  }

  return digits;
}

/**
 * Find or create a WhatsApp Contact corresponding to the customer's real phone number.
 * CRITICAL: If an order or appointment was placed via a Website Widget (visitor chat 'web_vis_...'),
 * the notification MUST NOT be sent to the website visitor chat. It must be dispatched to the
 * customer's actual WhatsApp phone number.
 */
async function resolveWhatsAppContactForCustomer(
  organizationId: string,
  customerPhone?: string | null,
  customerName?: string | null,
  existingLinkedContact?: any
) {
  const normalizedPhone = normalizeWhatsAppNumber(customerPhone);
  const rawDigits = customerPhone ? String(customerPhone).replace(/[^0-9]/g, "") : "";

  // 1. If we have a phone number provided by the customer, find or create the WhatsApp contact
  if (normalizedPhone) {
    let waContact = await prisma.contact.findFirst({
      where: {
        organizationId,
        platform: "WHATSAPP",
        OR: [
          { waId: normalizedPhone },
          { waId: `+${normalizedPhone}` },
          ...(rawDigits ? [{ waId: rawDigits }, { waId: `+${rawDigits}` }] : []),
        ],
      },
      include: { organization: true },
    });

    if (!waContact) {
      console.log(
        `[OrderNotifications] 🆕 Creating new WhatsApp contact for customer phone: ${normalizedPhone} (${customerName || "Customer"})`
      );
      waContact = await prisma.contact.create({
        data: {
          organizationId,
          waId: normalizedPhone,
          name: customerName || `+${normalizedPhone}`,
          whatsappName: customerName || `+${normalizedPhone}`,
          platform: "WHATSAPP",
        },
        include: { organization: true },
      });
    }

    return waContact;
  }

  // 2. Fallback: only if existing contact is a genuine WhatsApp contact (not a website widget)
  if (
    existingLinkedContact &&
    existingLinkedContact.platform === "WHATSAPP" &&
    !existingLinkedContact.waId?.startsWith("web_")
  ) {
    return existingLinkedContact;
  }

  return null;
}

/**
 * Format and send an automated WhatsApp message to the customer when an Order status changes.
 * Dispatches to the customer's phone number on WhatsApp.
 */
export async function sendOrderStatusNotification(
  orderId: string,
  newStatus: string,
  templateOptions?: NotificationTemplateOptions
) {
  try {
    // If explicitly set to 'none', skip sending
    if (templateOptions?.templateName === "none") {
      logger.flow.info(`[OrderStatusNotification] Notification skipped as templateName is 'none'.`);
      return { success: true, skipped: true };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        contact: {
          include: { organization: true },
        },
        organization: true,
      },
    });

    if (!order) {
      logger.flow.warn(`[OrderStatusNotification] Order #${orderId} not found.`);
      return { success: false, error: "Order not found" };
    }

    // Resolve WhatsApp contact using customer's phone number
    const contact = await resolveWhatsAppContactForCustomer(
      order.organizationId,
      order.customerPhone,
      order.customerName,
      order.contact
    );

    if (!contact) {
      logger.flow.warn(
        `[OrderStatusNotification] No WhatsApp contact could be resolved for order ${order.orderNumber} (Phone: ${order.customerPhone})`
      );
      return {
        success: false,
        error: `No valid WhatsApp phone number found for order #${order.orderNumber} (${order.customerPhone || "missing phone"}).`,
      };
    }

    // If order was previously linked to a web visitor, re-link to the customer's WhatsApp contact
    if (order.contactId !== contact.id) {
      await prisma.order
        .update({
          where: { id: order.id },
          data: { contactId: contact.id },
        })
        .catch(() => {});
    }

    const orgName = order.organization?.name || "Our Store";
    const customerName = order.customerName || "Customer";
    const orderNumber = order.orderNumber;
    const totalAmountStr = `${order.currency} ${Number(order.totalAmount)}`;

    // ─── OPTION 1: USER CHOSE AN APPROVED META WHATSAPP TEMPLATE ────────────
    if (
      templateOptions?.templateName &&
      templateOptions.templateName !== "default" &&
      templateOptions.templateName !== "none"
    ) {
      const templateName = templateOptions.templateName.trim();
      const lang = templateOptions.languageCode?.trim() || "en";

      // 1. Use the exact template components provided (with admin-selected values)
      let components: any[] | undefined = templateOptions.templateComponents;

      // 2. If components were not explicitly passed, fallback to customParams or basic body params
      if (!components || components.length === 0) {
        if (templateOptions.customParams && Object.keys(templateOptions.customParams).length > 0) {
          const bodyParameters = Object.values(templateOptions.customParams).map((text) => ({
            type: "text",
            text: String(text),
          }));
          components = [{ type: "body", parameters: bodyParameters }];
        }
      }

      const { internalSendTemplateMessage } = await import("@/lib/whatsapp/api");
      const templateResult = await internalSendTemplateMessage(
        contact.id,
        templateName,
        lang,
        components
      );

      logger.flow.info(
        `[OrderStatusNotification] Dispatched Template "${templateName}" (${lang}) for Order #${orderNumber} to customer WhatsApp (${contact.waId})`
      );

      return { success: true, result: templateResult };
    }

    // ─── OPTION 2: DEFAULT RICH TEXT NOTIFICATION ───────────────────────────
    let emoji = "📦";
    let statusHeadline = "";
    let statusDetails = "";

    const normalizedStatus = newStatus.toUpperCase().trim();

    switch (normalizedStatus) {
      case "CONFIRMED":
        emoji = "✅";
        statusHeadline = "Order Confirmed!";
        statusDetails = `Great news! Your order has been *Confirmed* by *${orgName}*.\nWe are now preparing your items for delivery.`;
        break;
      case "PROCESSING":
        emoji = "⚙️";
        statusHeadline = "Order in Processing";
        statusDetails = `Your order is currently being *packed & processed* at our dispatch center.`;
        break;
      case "SHIPPED":
        emoji = "🚚";
        statusHeadline = "Order Shipped!";
        statusDetails = `Your order has been *Shipped* and is on its way to you!\n${
          order.deliveryAddress ? `📍 *Destination:* ${order.deliveryAddress}` : ""
        }`;
        break;
      case "DELIVERED":
        emoji = "🎉";
        statusHeadline = "Order Delivered!";
        statusDetails = `Your order has been successfully *Delivered*!\nWe hope you enjoy your purchase. Thank you for choosing *${orgName}*!`;
        break;
      case "CANCELLED":
        emoji = "❌";
        statusHeadline = "Order Cancelled";
        statusDetails = `Your order has been *Cancelled*.\nIf you have any questions or wish to place a new order, simply reply to this message.`;
        break;
      case "PENDING":
      default:
        emoji = "⏳";
        statusHeadline = "Order Pending";
        statusDetails = `Your order is currently *Pending Review*. We will notify you as soon as it is confirmed.`;
        break;
    }

    let itemsText = "";
    if (Array.isArray(order.items) && order.items.length > 0) {
      itemsText = (order.items as any[])
        .map((it) => `• ${it.quantity || 1}x ${it.productName || it.name || "Item"}${it.variant ? ` (${it.variant})` : ""}`)
        .join("\n");
    }

    const message = `${emoji} *${statusHeadline}*

Hello *${customerName}*,

${statusDetails}

📋 *Order Details:*
• *Order ID:* *${orderNumber}*
• *Status:* *${newStatus}*
${itemsText ? `• *Items:*\n${itemsText}\n` : ""}• *Total Amount:* ${totalAmountStr}
${order.deliveryAddress ? `• *Address:* ${order.deliveryAddress}\n` : ""}
If you need any assistance, feel free to reply right here on WhatsApp!

— *${orgName}*`;

    const result = await internalSendWhatsAppMessage(
      contact.id,
      message,
      contact,
      undefined,
      true
    );

    logger.flow.info(
      `[OrderStatusNotification] Sent WhatsApp notification for Order #${orderNumber} (${newStatus}) to ${contact.waId}`
    );

    return { success: true, result };
  } catch (error: any) {
    logger.flow.error(
      `[OrderStatusNotification] Failed to send notification for order ${orderId}: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Format and send an automated WhatsApp message to the customer when an Appointment status changes or reschedules.
 * Dispatches to the customer's phone number on WhatsApp.
 */
export async function sendAppointmentStatusNotification(
  appointmentId: string,
  newStatus: string,
  templateOptions?: NotificationTemplateOptions
) {
  try {
    if (templateOptions?.templateName === "none") {
      logger.flow.info(`[AppointmentStatusNotification] Notification skipped as templateName is 'none'.`);
      return { success: true, skipped: true };
    }

    const apt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        contact: {
          include: { organization: true },
        },
        organization: true,
      },
    });

    if (!apt) {
      logger.flow.warn(`[AppointmentStatusNotification] Appointment #${appointmentId} not found.`);
      return { success: false, error: "Appointment not found" };
    }

    // Resolve WhatsApp contact using customer's phone number
    const contact = await resolveWhatsAppContactForCustomer(
      apt.organizationId,
      apt.customerPhone,
      apt.customerName,
      apt.contact
    );

    if (!contact) {
      logger.flow.warn(
        `[AppointmentStatusNotification] No WhatsApp contact found for appointment ${apt.appointmentNumber} (Phone: ${apt.customerPhone})`
      );
      return {
        success: false,
        error: `No valid WhatsApp phone number found for booking #${apt.appointmentNumber} (${apt.customerPhone || "missing phone"}).`,
      };
    }

    if (apt.contactId !== contact.id) {
      await prisma.appointment
        .update({
          where: { id: apt.id },
          data: { contactId: contact.id },
        })
        .catch(() => {});
    }

    const orgName = apt.organization?.name || "Our Team";
    const customerName = apt.customerName || "Customer";
    const aptNumber = apt.appointmentNumber;

    // ─── OPTION 1: USER CHOSE AN APPROVED META WHATSAPP TEMPLATE ────────────
    if (
      templateOptions?.templateName &&
      templateOptions.templateName !== "default" &&
      templateOptions.templateName !== "none"
    ) {
      const templateName = templateOptions.templateName.trim();
      const lang = templateOptions.languageCode?.trim() || "en";

      // Map parameters: {{1}}=Name, {{2}}=Booking ID, {{3}}=Service, {{4}}=Date, {{5}}=Time, {{6}}=Status
      const bodyParameters = [
        { type: "text", text: customerName },
        { type: "text", text: aptNumber },
        { type: "text", text: apt.serviceName },
        { type: "text", text: apt.date },
        { type: "text", text: apt.time },
        { type: "text", text: newStatus },
      ];

      const components = [
        {
          type: "body",
          parameters: bodyParameters,
        },
      ];

      const templateResult = await sendTemplateMessage(
        contact.id,
        templateName,
        lang,
        components,
        `Appointment #${aptNumber} status update: ${newStatus}`,
        true
      );

      logger.flow.info(
        `[AppointmentStatusNotification] Dispatched Template "${templateName}" (${lang}) for Appointment #${aptNumber} to customer WhatsApp (${contact.waId})`
      );

      return templateResult;
    }

    // ─── OPTION 2: DEFAULT RICH TEXT NOTIFICATION ───────────────────────────
    let emoji = "🗓️";
    let statusHeadline = "";
    let statusDetails = "";

    const normalizedStatus = newStatus.toUpperCase().trim();

    switch (normalizedStatus) {
      case "CONFIRMED":
        emoji = "✅";
        statusHeadline = "Appointment Confirmed!";
        statusDetails = `Your appointment for *${apt.serviceName}* has been *Confirmed*!\nWe look forward to welcoming you on *${apt.date}* at *${apt.time}*.`;
        break;
      case "RESCHEDULED":
        emoji = "🔄";
        statusHeadline = "Appointment Rescheduled!";
        statusDetails = `Your appointment for *${apt.serviceName}* has been *Rescheduled* to a new time slot:\n📅 *New Date:* ${apt.date}\n⏰ *New Time:* ${apt.time}`;
        break;
      case "COMPLETED":
        emoji = "🌟";
        statusHeadline = "Appointment Completed!";
        statusDetails = `Thank you for visiting *${orgName}* today! Your booking for *${apt.serviceName}* has been marked as *Completed*.\nWe hope you had a great experience!`;
        break;
      case "CANCELLED":
        emoji = "❌";
        statusHeadline = "Appointment Cancelled";
        statusDetails = `Your appointment for *${apt.serviceName}* on *${apt.date}* at *${apt.time}* has been *Cancelled*.\nPlease reply to this chat if you would like to reschedule.`;
        break;
      case "PENDING":
      default:
        emoji = "⏳";
        statusHeadline = "Appointment Pending";
        statusDetails = `Your booking request for *${apt.serviceName}* is currently *Pending Confirmation*. We will confirm your slot shortly.`;
        break;
    }

    const message = `${emoji} *${statusHeadline}*

Hello *${customerName}*,

${statusDetails}

📋 *Booking Details:*
• *Booking ID:* *${aptNumber}*
• *Service:* *${apt.serviceName}*
• *Date:* *${apt.date}*
• *Time:* *${apt.time}*
• *Status:* *${newStatus}*
${(apt as any).location ? `• *Location:* ${(apt as any).location}\n` : ""}
If you have any questions or need to make adjustments, please reply to this message.

— *${orgName}*`;

    const result = await internalSendWhatsAppMessage(
      contact.id,
      message,
      contact,
      undefined,
      true
    );

    logger.flow.info(
      `[AppointmentStatusNotification] Sent WhatsApp notification for Appointment #${aptNumber} (${newStatus}) to ${contact.waId}`
    );

    return { success: true, result };
  } catch (error: any) {
    logger.flow.error(
      `[AppointmentStatusNotification] Failed to send notification for appointment ${appointmentId}: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}
