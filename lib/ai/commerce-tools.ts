import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── Unique ID Generators ─────────────────────────────────────────────────────

export function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${datePart}-${randomPart}`;
}

export function generateAppointmentNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `APT-${datePart}-${randomPart}`;
}

// ─── Helpers: Get Business Profile ───────────────────────────────────────────

export async function getBusinessProfile(organizationId: string) {
  let profile = await prisma.businessProfile.findUnique({
    where: { organizationId },
  });

  if (!profile) {
    // Fallback: create default business profile for organization
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, businessDescription: true, businessAddress: true },
    });
    profile = await prisma.businessProfile.create({
      data: {
        organizationId,
        storeName: org?.name || 'My Business',
        description: org?.businessDescription || '',
        currency: 'PKR',
        deliveryCharges: 0,
        deliveryTime: '2-4 working days',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        openingTime: '09:00',
        closingTime: '18:00',
        slotDuration: 30,
      },
    });
  }

  return profile;
}

// ─── ORDER ACTIONS & VALIDATORS ───────────────────────────────────────────────

/**
 * Search products belonging strictly to the organization
 */
export async function searchProducts(
  organizationId: string,
  args: { query?: string; category?: string }
) {
  try {
    const whereClause: any = {
      organizationId,
      status: 'active',
      isAvailable: true,
    };

    if (args.category && args.category.trim()) {
      whereClause.category = {
        contains: args.category.trim(),
        mode: 'insensitive',
      };
    }

    if (args.query && args.query.trim()) {
      const words = args.query.trim().split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        whereClause.AND = words.map((w) => ({
          OR: [
            { name: { contains: w, mode: 'insensitive' } },
            { description: { contains: w, mode: 'insensitive' } },
            { category: { contains: w, mode: 'insensitive' } },
          ],
        }));
      } else if (words.length === 1) {
        whereClause.OR = [
          { name: { contains: words[0], mode: 'insensitive' } },
          { description: { contains: words[0], mode: 'insensitive' } },
          { category: { contains: words[0], mode: 'insensitive' } },
        ];
      }
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      take: 15,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        category: true,
        stock: true,
        variants: true,
        imageUrl: true,
      },
    });

    return {
      success: true,
      count: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        currency: p.currency,
        category: p.category,
        stock: p.stock,
        variants: p.variants || [],
        imageUrl: p.imageUrl,
      })),
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] searchProducts error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get details for a single product
 */
export async function getProductDetails(
  organizationId: string,
  args: { productId?: string; productName?: string }
) {
  try {
    let product = null;

    if (args.productId) {
      product = await prisma.product.findFirst({
        where: { id: args.productId, organizationId },
      });
    } else if (args.productName) {
      product = await prisma.product.findFirst({
        where: {
          organizationId,
          name: { contains: args.productName.trim(), mode: 'insensitive' },
        },
      });
    }

    if (!product) {
      return { success: false, message: 'Product not found.' };
    }

    return {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        currency: product.currency,
        category: product.category,
        stock: product.stock,
        variants: product.variants || [],
        isAvailable: product.isAvailable && product.stock > 0,
      },
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] getProductDetails error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Check stock for a specific product and variant
 */
export async function checkStock(
  organizationId: string,
  args: { productName: string; variant?: string }
) {
  try {
    const product = await prisma.product.findFirst({
      where: {
        organizationId,
        name: { contains: args.productName.trim(), mode: 'insensitive' },
      },
    });

    if (!product) {
      return { inStock: false, message: `Product "${args.productName}" was not found.` };
    }

    let availableStock = product.stock;
    if (args.variant && Array.isArray(product.variants)) {
      const vMatch = (product.variants as any[]).find(
        (v) =>
          v.name?.toLowerCase().includes(args.variant?.toLowerCase()) ||
          v.size?.toLowerCase() === args.variant?.toLowerCase() ||
          v.color?.toLowerCase() === args.variant?.toLowerCase()
      );
      if (vMatch && typeof vMatch.stock === 'number') {
        availableStock = vMatch.stock;
      }
    }

    return {
      inStock: availableStock > 0,
      availableStock,
      productName: product.name,
      price: Number(product.price),
      currency: product.currency,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] checkStock error: ${error.message}`);
    return { inStock: false, error: error.message };
  }
}

/**
 * Calculate order summary & total using Knowledge Base data, prices, and delivery rules
 */
export async function calculateOrderSummary(
  organizationId: string,
  args: {
    items: Array<{ productName: string; variant?: string; quantity: number; unitPrice?: number; price?: number }>;
    deliveryAddress?: string;
    deliveryFee?: number;
    currency?: string;
  }
) {
  try {
    const profile = await getBusinessProfile(organizationId);
    let subtotal = 0;
    const validatedItems = [];

    for (const item of args.items || []) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      let unitPrice = Number(item.unitPrice || (item as any).price || 0);
      let productId: string | null = null;

      // Check if product exists in catalog (optional enhancement)
      const product = await prisma.product.findFirst({
        where: {
          organizationId,
          name: { contains: item.productName.trim(), mode: 'insensitive' },
        },
      });

      if (product) {
        productId = product.id;
        if (!unitPrice || unitPrice <= 0) {
          unitPrice = Number(product.price);
        }
        if (item.variant && Array.isArray(product.variants)) {
          const vMatch = (product.variants as any[]).find(
            (v) =>
              v.name?.toLowerCase().includes(item.variant?.toLowerCase()) ||
              v.size?.toLowerCase() === item.variant?.toLowerCase() ||
              v.color?.toLowerCase() === item.variant?.toLowerCase()
          );
          if (vMatch && typeof vMatch.price === 'number') {
            unitPrice = vMatch.price;
          }
        }
      }

      const itemSubtotal = unitPrice * qty;
      subtotal += itemSubtotal;

      validatedItems.push({
        productId: productId || undefined,
        productName: product?.name || item.productName.trim(),
        variant: item.variant || null,
        quantity: qty,
        unitPrice,
        subtotal: itemSubtotal,
      });
    }

    const deliveryFee = Number(args.deliveryFee ?? profile?.deliveryCharges ?? 0);
    const totalAmount = subtotal + deliveryFee;
    const currency = args.currency || profile?.currency || 'PKR';

    return {
      success: true,
      items: validatedItems,
      subtotal,
      deliveryFee,
      totalAmount,
      currency,
      deliveryTime: profile?.deliveryTime || '2-4 working days',
      summaryText: `Subtotal: ${currency} ${subtotal}\nDelivery: ${currency} ${deliveryFee}\nTotal: ${currency} ${totalAmount}`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] calculateOrderSummary error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Validated Order Creation from Knowledge Base & WhatsApp AI conversation
 */
export async function createOrder(
  organizationId: string,
  contactId: string | undefined,
  args: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: string;
    items: Array<{ productName: string; variant?: string; quantity: number; unitPrice?: number; price?: number }>;
    deliveryFee?: number;
    paymentMethod?: string;
    notes?: string;
  }
) {
  try {
    if (!args.customerName?.trim()) {
      return { success: false, error: 'Customer name is required.' };
    }
    if (!args.customerPhone?.trim()) {
      return { success: false, error: 'Customer phone number is required.' };
    }
    if (!args.deliveryAddress?.trim()) {
      return { success: false, error: 'Delivery address is required.' };
    }
    if (!args.items || args.items.length === 0) {
      return { success: false, error: 'At least one product item or package is required.' };
    }

    const calc = await calculateOrderSummary(organizationId, {
      items: args.items,
      deliveryAddress: args.deliveryAddress,
      deliveryFee: args.deliveryFee,
    });

    if (!calc.success || !calc.items) {
      return { success: false, error: calc.error || 'Failed to calculate order details.' };
    }

    // Verify stock availability only if tracked in database
    for (const item of calc.items) {
      if (item.productId) {
        const prod = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, stock: true },
        });
        if (prod && typeof prod.stock === 'number' && prod.stock > 0 && prod.stock < item.quantity) {
          return {
            success: false,
            error: `Insufficient stock for "${prod.name}". Available stock: ${prod.stock}.`,
          };
        }
      }
    }

    const profile = await getBusinessProfile(organizationId);
    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        organizationId,
        contactId: contactId || null,
        customerName: args.customerName.trim(),
        customerPhone: args.customerPhone.trim(),
        customerEmail: args.customerEmail?.trim() || null,
        deliveryAddress: args.deliveryAddress.trim(),
        items: calc.items as any,
        subtotal: calc.subtotal,
        deliveryFee: calc.deliveryFee,
        totalAmount: calc.totalAmount,
        currency: calc.currency,
        paymentMethod: args.paymentMethod || 'Cash on Delivery',
        paymentStatus: 'PENDING',
        status: 'PENDING',
        notes: args.notes || null,
        source: 'AI_CHAT',
      },
    });

    // Decrement stock only if productId is present
    for (const item of calc.items) {
      if (item.productId) {
        try {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        } catch (err: any) {
          logger.flow.warn(`[CommerceTools] Stock decrement warning: ${err.message}`);
        }
      }
    }

    logger.flow.success(`[CommerceTools] Order created successfully from Knowledge Base: ${orderNumber}`);

    // Auto-dispatch to POS Webhook
    try {
      const { dispatchPOSOrderWebhook } = await import('@/lib/pos/webhook');
      dispatchPOSOrderWebhook({
        organizationId,
        orderId: order.id,
        contactId,
      }).catch((err) => {
        logger.flow.warn(`[CommerceTools] POS Webhook warning: ${err.message}`);
      });
    } catch {}

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      items: calc.items,
      subtotal: calc.subtotal,
      deliveryFee: calc.deliveryFee,
      totalAmount: calc.totalAmount,
      currency: calc.currency,
      status: order.status,
      confirmationMessage: `✅ Order confirmed! Order ID: ${order.orderNumber}. Total: ${calc.currency} ${calc.totalAmount}. Our team will contact you shortly at ${order.customerPhone} for delivery updates.`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] createOrder error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel Order
 */
export async function cancelOrder(
  organizationId: string,
  args: { orderNumber: string; reason?: string }
) {
  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber: args.orderNumber.trim(), organizationId },
    });

    if (!order) {
      return { success: false, error: `Order #${args.orderNumber} not found.` };
    }

    if (order.status === 'CANCELLED') {
      return { success: true, message: `Order #${args.orderNumber} is already cancelled.` };
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        notes: args.reason ? `${order.notes || ''}\nCancellation Reason: ${args.reason}`.trim() : order.notes,
      },
    });

    // Re-increment stock if order was pending
    if (Array.isArray(order.items)) {
      for (const item of order.items as any[]) {
        if (item.productId && item.quantity) {
          try {
            await prisma.product.update({
              where: { id: item.productId },
              data: { stock: { increment: Number(item.quantity) } },
            });
          } catch {}
        }
      }
    }

    return {
      success: true,
      orderNumber: updated.orderNumber,
      status: 'CANCELLED',
      message: `Order #${updated.orderNumber} has been successfully cancelled.`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] cancelOrder error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ─── APPOINTMENT ACTIONS & VALIDATORS ─────────────────────────────────────────

/**
 * Get active services for organization
 */
export async function getServices(organizationId: string) {
  try {
    const services = await prisma.businessService.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: Number(s.price),
        currency: s.currency,
        durationMinutes: s.durationMinutes,
        staff: s.staff,
        category: s.category,
      })),
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] getServices error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Helper to compute day name from date string "YYYY-MM-DD"
 */
function getDayName(dateString: string): string {
  const parts = dateString.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Check availability & available time slots for a given date
 */
export async function getAvailableTimeSlots(
  organizationId: string,
  args: { date: string; serviceName?: string; staffName?: string }
) {
  try {
    const profile = await getBusinessProfile(organizationId);

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.date)) {
      return {
        success: false,
        error: 'Invalid date format. Please use YYYY-MM-DD (e.g. 2026-09-08).',
      };
    }

    const dayName = getDayName(args.date);
    const workingDays = profile.workingDays || [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    if (!workingDays.includes(dayName)) {
      return {
        success: false,
        isClosed: true,
        message: `Sorry, we are closed on ${dayName}s. We are open on: ${workingDays.join(', ')}.`,
      };
    }

    // Operating hours
    const opening = profile.openingTime || '09:00';
    const closing = profile.closingTime || '18:00';
    const interval = profile.slotDuration || 30;

    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);

    const openTotalM = openH * 60 + openM;
    const closeTotalM = closeH * 60 + closeM;

    // Fetch existing confirmed/pending appointments on this date
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        organizationId,
        date: args.date,
        status: { in: ['CONFIRMED', 'PENDING'] },
        ...(args.staffName ? { staffName: { contains: args.staffName, mode: 'insensitive' } } : {}),
      },
      select: { time: true, durationMinutes: true },
    });

    const bookedTimes = new Set(existingAppointments.map((a) => a.time));

    // Generate candidate slots
    const availableSlots: string[] = [];
    for (let m = openTotalM; m + interval <= closeTotalM; m += interval) {
      const slotHour = String(Math.floor(m / 60)).padStart(2, '0');
      const slotMin = String(m % 60).padStart(2, '0');
      const slotTime = `${slotHour}:${slotMin}`;

      if (!bookedTimes.has(slotTime)) {
        availableSlots.push(slotTime);
      }
    }

    return {
      success: true,
      date: args.date,
      day: dayName,
      availableSlots,
      count: availableSlots.length,
      workingHours: `${opening} to ${closing}`,
      message:
        availableSlots.length > 0
          ? `Available slots on ${dayName} (${args.date}): ${availableSlots.slice(0, 8).join(', ')}`
          : `All slots are booked on ${dayName} (${args.date}). Please select another date.`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] getAvailableTimeSlots error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Backend validated Appointment Creation
 */
export async function createAppointment(
  organizationId: string,
  contactId: string | undefined,
  args: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    serviceName: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    staffName?: string;
    notes?: string;
    price?: number;
    durationMinutes?: number;
    currency?: string;
  }
) {
  try {
    if (!args.customerName?.trim()) {
      return { success: false, error: 'Customer name is required.' };
    }
    if (!args.customerPhone?.trim()) {
      return { success: false, error: 'Customer phone number is required.' };
    }
    if (!args.serviceName?.trim()) {
      return { success: false, error: 'Service name is required.' };
    }
    if (!args.date?.trim() || !args.time?.trim()) {
      return { success: false, error: 'Appointment date and time are required.' };
    }

    // Verify service (optional lookup from table, does not block booking)
    const service = await prisma.businessService.findFirst({
      where: {
        organizationId,
        name: { contains: args.serviceName.trim(), mode: 'insensitive' },
        isActive: true,
      },
    });

    const servicePrice = typeof (args as any).price === 'number'
      ? (args as any).price
      : (service ? Number(service.price) : 0);
    const duration = (args as any).durationMinutes || (service ? service.durationMinutes : 30);
    const currency = (args as any).currency || service?.currency || 'PKR';

    // Verify slots availability & collision
    const collision = await prisma.appointment.findFirst({
      where: {
        organizationId,
        date: args.date.trim(),
        time: args.time.trim(),
        status: { in: ['CONFIRMED', 'PENDING'] },
        ...(args.staffName ? { staffName: { contains: args.staffName, mode: 'insensitive' } } : {}),
      },
    });

    if (collision) {
      return {
        success: false,
        error: `Slot ${args.time} on ${args.date} is already booked. Please choose another time slot.`,
      };
    }

    const appointmentNumber = generateAppointmentNumber();

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber,
        organizationId,
        contactId: contactId || null,
        serviceId: service?.id || null,
        serviceName: service?.name || args.serviceName.trim(),
        customerName: args.customerName.trim(),
        customerPhone: args.customerPhone.trim(),
        customerEmail: args.customerEmail?.trim() || null,
        staffName: args.staffName?.trim() || service?.staff || null,
        date: args.date.trim(),
        time: args.time.trim(),
        durationMinutes: duration,
        price: servicePrice,
        currency,
        status: 'CONFIRMED',
        notes: args.notes || null,
        source: 'AI_CHAT',
      },
    });

    logger.flow.success(`[CommerceTools] Appointment created: ${appointmentNumber}`);

    return {
      success: true,
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: appointment.time,
      durationMinutes: appointment.durationMinutes,
      price: Number(appointment.price),
      currency: appointment.currency,
      status: appointment.status,
      confirmationMessage: `✅ Appointment confirmed! Reference ID: ${appointment.appointmentNumber}. Service: ${appointment.serviceName} on ${appointment.date} at ${appointment.time}. We look forward to seeing you!`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] createAppointment error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Reschedule an Appointment
 */
export async function rescheduleAppointment(
  organizationId: string,
  args: { appointmentNumber: string; newDate: string; newTime: string }
) {
  try {
    const apt = await prisma.appointment.findFirst({
      where: { appointmentNumber: args.appointmentNumber.trim(), organizationId },
    });

    if (!apt) {
      return { success: false, error: `Appointment #${args.appointmentNumber} not found.` };
    }

    // Check slot collision on new date & time
    const collision = await prisma.appointment.findFirst({
      where: {
        organizationId,
        id: { not: apt.id },
        date: args.newDate.trim(),
        time: args.newTime.trim(),
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    if (collision) {
      return {
        success: false,
        error: `Slot ${args.newTime} on ${args.newDate} is already booked.`,
      };
    }

    const updated = await prisma.appointment.update({
      where: { id: apt.id },
      data: {
        date: args.newDate.trim(),
        time: args.newTime.trim(),
        status: 'CONFIRMED',
      },
    });

    return {
      success: true,
      appointmentNumber: updated.appointmentNumber,
      serviceName: updated.serviceName,
      date: updated.date,
      time: updated.time,
      message: `Appointment #${updated.appointmentNumber} rescheduled to ${updated.date} at ${updated.time}.`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] rescheduleAppointment error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel an Appointment
 */
export async function cancelAppointment(
  organizationId: string,
  args: { appointmentNumber: string; reason?: string }
) {
  try {
    const apt = await prisma.appointment.findFirst({
      where: { appointmentNumber: args.appointmentNumber.trim(), organizationId },
    });

    if (!apt) {
      return { success: false, error: `Appointment #${args.appointmentNumber} not found.` };
    }

    const updated = await prisma.appointment.update({
      where: { id: apt.id },
      data: {
        status: 'CANCELLED',
        notes: args.reason ? `${apt.notes || ''}\nCancellation: ${args.reason}`.trim() : apt.notes,
      },
    });

    return {
      success: true,
      appointmentNumber: updated.appointmentNumber,
      status: 'CANCELLED',
      message: `Appointment #${updated.appointmentNumber} has been cancelled.`,
    };
  } catch (error: any) {
    logger.flow.error(`[CommerceTools] cancelAppointment error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ─── DYNAMIC BUSINESS KNOWLEDGE PROMPT INJECTOR ──────────────────────────────

export async function getBusinessKnowledgePrompt(
  organizationId: string,
  options?: { hasCustomPersona?: boolean; agentName?: string }
): Promise<string> {
  try {
    const profile = await getBusinessProfile(organizationId);

    // Fetch verified Knowledge Base entries (scraped website pages, uploaded documents, knowledge texts)
    const kbEntries = await prisma.knowledgeBase.findMany({
      where: { organizationId, status: 'synced' },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        title: true,
        content: true,
        sourceUrl: true,
        fileName: true,
      },
    });

    let kbText = '';
    if (kbEntries.length > 0) {
      kbText = '\n#### 📚 VERIFIED BUSINESS KNOWLEDGE BASE (Scraped Website & Documents):\n' +
        kbEntries.map((kb, idx) => {
          const src = kb.sourceUrl ? `(Source Website: ${kb.sourceUrl})` : kb.fileName ? `(Document: ${kb.fileName})` : '(Knowledge Document)';
          return `--- [KB Item ${idx + 1}]: ${kb.title} ${src} ---\n${kb.content.slice(0, 2000)}`;
        }).join('\n\n');
    }

    // Fetch active products if any
    const products = await prisma.product.findMany({
      where: { organizationId, status: 'active', isAvailable: true },
      take: 50,
      select: {
        name: true,
        price: true,
        currency: true,
        category: true,
        stock: true,
        variants: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch active services if any
    const services = await prisma.businessService.findMany({
      where: { organizationId, isActive: true },
      take: 50,
      select: {
        name: true,
        price: true,
        currency: true,
        durationMinutes: true,
        staff: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    const storeName = profile.storeName || 'Our Business';
    const currency = profile.currency || 'PKR';

    // Format products
    const productList = products.map((p, idx) => {
      let variantStr = '';
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        const varItems = (p.variants as any[]).map(v => 
          `${v.name || ''} (Size: ${v.size || 'N/A'}, Color: ${v.color || 'N/A'}, Price: ${currency} ${v.price ?? p.price}, Stock: ${v.stock ?? p.stock})`
        );
        variantStr = ` | Variants: [${varItems.join('; ')}]`;
      }
      return `${idx + 1}. ${p.name} - ${currency} ${p.price} (Category: ${p.category || 'General'}, Stock: ${p.stock})${variantStr}${p.description ? ` - ${p.description}` : ''}`;
    }).join('\n');

    // Format services
    const serviceList = services.map((s, idx) => {
      return `${idx + 1}. ${s.name} - ${currency} ${s.price} (Duration: ${s.durationMinutes} mins${s.staff ? `, Staff: ${s.staff}` : ''})${s.description ? ` - ${s.description}` : ''}`;
    }).join('\n');

    // Format FAQs
    let faqText = '';
    if (Array.isArray(profile.faqs) && (profile.faqs as any[]).length > 0) {
      faqText = '\n### Frequently Asked Questions (FAQs):\n' + 
        (profile.faqs as any[]).map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
    }

    const headerSection = options?.hasCustomPersona
      ? `### 🏢 OPERATIONAL BUSINESS DATA & POLICIES
Reference the following operational data, products, packages, pricing, and policies if relevant to the conversation:`
      : `### 🏢 OFFICIAL BUSINESS KNOWLEDGE PROFILE & OPERATIONAL DATA
You are the dedicated, professional AI customer assistant for "${storeName}".
All responses must strictly adhere to the verified business facts, products, packages, services, pricing, and policies described in your Knowledge Base and operational data below.
Never invent items, prices, variants, or policies that contradict the Knowledge Base.`;

    const generalInfo = options?.hasCustomPersona
      ? `#### General Operational Info:
- Currency: ${currency}
- Delivery Charges: ${currency} ${profile.deliveryCharges ?? 0}
- Delivery Areas: ${profile.deliveryAreas || 'Nationwide delivery'}
- Delivery Turnaround Time: ${profile.deliveryTime || '2-4 working days'}
- Payment Methods: ${(profile.paymentMethods || ['Cash on Delivery']).join(', ')}
- Return / Exchange Policy: ${profile.returnPolicy || 'Items can be exchanged within 7 days with receipt.'}`
      : `#### General Business Info:
- Store/Business Name: ${storeName}
- Business Type: ${profile.businessType || 'Hybrid'}
- Description: ${profile.description || 'N/A'}
- Currency: ${currency}
- Delivery Charges: ${currency} ${profile.deliveryCharges ?? 0}
- Delivery Areas: ${profile.deliveryAreas || 'Nationwide delivery'}
- Delivery Turnaround Time: ${profile.deliveryTime || '2-4 working days'}
- Payment Methods: ${(profile.paymentMethods || ['Cash on Delivery']).join(', ')}
- Return / Exchange Policy: ${profile.returnPolicy || 'Items can be exchanged within 7 days with receipt.'}`;

    return `
${headerSection}
${kbText}

${generalInfo}
${profile.customInstructions ? `- Business Instructions: ${profile.customInstructions}` : ''}
${faqText}

${products.length > 0 ? `#### 📦 Available Catalog Products (${products.length} active):\n${productList}` : ''}
${services.length > 0 ? `#### ✂️ Available Services (${services.length} active):\n${serviceList}` : ''}

#### 🕒 Operating Schedule:
- Operating Days: ${(profile.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).join(', ')}
- Operating Hours: ${profile.openingTime || '09:00'} to ${profile.closingTime || '18:00'}
- Default Slot Interval: ${profile.slotDuration || 30} minutes

### 🎯 CRITICAL RULES FOR ORDER & APPOINTMENT CONVERSATIONS:
1. KNOWLEDGE BASE IS YOUR PRIMARY SOURCE OF TRUTH:
   - Reference and offer the exact products, packages, services, and prices described in the Knowledge Base (scraped website data, uploaded documents, and agent instructions).
2. TAKING ORDERS:
   - Step 1: Identify the product/package, variant (size/color), and quantity from the Knowledge Base.
   - Step 2: Request customer's Full Name, Phone Number, and Full Delivery Address.
   - Step 3: Present the order summary with unit price from Knowledge Base, delivery charges, and total amount.
   - Step 4: Ask for explicit confirmation ("Kya main aapka order confirm kar doon?").
   - Step 5: After confirmation, invoke 'create_order' with customerName, customerPhone, deliveryAddress, and items (including unitPrice).
3. BOOKING APPOINTMENTS:
   - Step 1: Identify the requested service or consultation from the Knowledge Base.
   - Step 2: Query open slots for that date using 'get_available_time_slots'.
   - Step 3: Offer available slots and ask customer to choose one.
   - Step 4: Collect customer name and phone number.
   - Step 5: Present appointment summary and ask for confirmation.
   - Step 6: After confirmation, invoke 'create_appointment' with customerName, customerPhone, serviceName, date, and time.
4. LANGUAGE MATCHING:
   - Respond in the exact language & script the customer uses (English, Roman Urdu, Urdu, etc.).
`;
  } catch (err: any) {
    logger.flow.error(`[CommerceTools] getBusinessKnowledgePrompt error: ${err.message}`);
    return '';
  }
}

// ─── OPENAI TOOL DEFINITIONS & HANDLERS ───────────────────────────────────────

export function buildCommerceAITools(organizationId: string, contactId?: string) {
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "search_products",
        description: "Search the business's product catalog by keyword or category to check prices, variants, sizes, colors, and stock.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Keyword to search product name or description" },
            category: { type: "string", description: "Optional category filter" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_product_details",
        description: "Get full specifications, available sizes/colors/variants, and price for a specific product.",
        parameters: {
          type: "object",
          properties: {
            productId: { type: "string", description: "The product ID" },
            productName: { type: "string", description: "The product name" },
          },
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "check_stock",
        description: "Check stock availability for a specific product and variant.",
        parameters: {
          type: "object",
          properties: {
            productName: { type: "string", description: "The product name" },
            variant: { type: "string", description: "The specific size, color, or variant" },
          },
          required: ["productName"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "calculate_order_summary",
        description: "Calculate subtotal, delivery charges, and total amount for customer items/packages from the Knowledge Base before final confirmation.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "List of items or packages from the Knowledge Base the customer wishes to order",
              items: {
                type: "object",
                properties: {
                  productName: { type: "string", description: "Name of the product or package from Knowledge Base" },
                  unitPrice: { type: "number", description: "Unit price of the item from Knowledge Base" },
                  variant: { type: "string", description: "Optional variant (size, color, etc.)" },
                  quantity: { type: "number", description: "Quantity to order" },
                },
                required: ["productName", "quantity"],
              },
            },
            deliveryAddress: { type: "string", description: "Customer delivery address" },
            deliveryFee: { type: "number", description: "Optional delivery fee from Knowledge Base rules" },
            currency: { type: "string", description: "Currency code e.g. PKR" },
          },
          required: ["items"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_order",
        description: "Save and place the confirmed order into the database. ONLY call this AFTER the customer has explicitly confirmed the order summary.",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Customer full name" },
            customerPhone: { type: "string", description: "Customer phone/WhatsApp number" },
            customerEmail: { type: "string", description: "Customer email if provided" },
            deliveryAddress: { type: "string", description: "Complete delivery address" },
            items: {
              type: "array",
              description: "Items/packages from Knowledge Base to order",
              items: {
                type: "object",
                properties: {
                  productName: { type: "string", description: "Name of the product or package from Knowledge Base" },
                  unitPrice: { type: "number", description: "Unit price from Knowledge Base" },
                  variant: { type: "string" },
                  quantity: { type: "number" },
                },
                required: ["productName", "quantity"],
              },
            },
            deliveryFee: { type: "number", description: "Delivery fee" },
            paymentMethod: { type: "string", description: "Payment method (e.g. Cash on Delivery)" },
            notes: { type: "string", description: "Optional customer instructions or notes" },
          },
          required: ["customerName", "customerPhone", "deliveryAddress", "items"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "cancel_order",
        description: "Cancel an existing order by order number.",
        parameters: {
          type: "object",
          properties: {
            orderNumber: { type: "string", description: "The order number e.g. ORD-20260907-1234" },
            reason: { type: "string", description: "Reason for cancellation" },
          },
          required: ["orderNumber"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_services",
        description: "Get list of all services, descriptions, prices, and durations offered by the business.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_available_time_slots",
        description: "Get all available appointment time slots for a given date (YYYY-MM-DD), taking working hours and already booked appointments into account.",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Target date in YYYY-MM-DD format (e.g. 2026-09-08)" },
            serviceName: { type: "string", description: "Optional service name" },
            staffName: { type: "string", description: "Optional staff name" },
          },
          required: ["date"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_appointment",
        description: "Book and save a confirmed appointment in the database. ONLY call this AFTER the customer has explicitly confirmed the service, date, and time slot.",
        parameters: {
          type: "object",
          properties: {
            customerName: { type: "string", description: "Customer full name" },
            customerPhone: { type: "string", description: "Customer phone/WhatsApp number" },
            customerEmail: { type: "string", description: "Customer email if provided" },
            serviceName: { type: "string", description: "Service or consultation from Knowledge Base to book" },
            date: { type: "string", description: "Appointment date in YYYY-MM-DD format" },
            time: { type: "string", description: "Appointment time in HH:MM format e.g. 14:00" },
            price: { type: "number", description: "Optional price from Knowledge Base" },
            staffName: { type: "string", description: "Optional requested provider/staff member" },
            notes: { type: "string", description: "Optional appointment notes" },
          },
          required: ["customerName", "customerPhone", "serviceName", "date", "time"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "reschedule_appointment",
        description: "Reschedule an existing appointment to a new date and time.",
        parameters: {
          type: "object",
          properties: {
            appointmentNumber: { type: "string", description: "Appointment number e.g. APT-20260907-1234" },
            newDate: { type: "string", description: "New date in YYYY-MM-DD format" },
            newTime: { type: "string", description: "New time in HH:MM format" },
          },
          required: ["appointmentNumber", "newDate", "newTime"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "cancel_appointment",
        description: "Cancel an existing appointment.",
        parameters: {
          type: "object",
          properties: {
            appointmentNumber: { type: "string", description: "Appointment number e.g. APT-20260907-1234" },
            reason: { type: "string", description: "Reason for cancellation" },
          },
          required: ["appointmentNumber"],
        },
      },
    },
  ];

  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    search_products: async (args) => searchProducts(organizationId, args),
    get_product_details: async (args) => getProductDetails(organizationId, args),
    check_stock: async (args) => checkStock(organizationId, args),
    calculate_order_summary: async (args) => calculateOrderSummary(organizationId, args),
    create_order: async (args) => createOrder(organizationId, contactId, args),
    cancel_order: async (args) => cancelOrder(organizationId, args),
    get_services: async () => getServices(organizationId),
    get_available_time_slots: async (args) => getAvailableTimeSlots(organizationId, args),
    create_appointment: async (args) => createAppointment(organizationId, contactId, args),
    reschedule_appointment: async (args) => rescheduleAppointment(organizationId, args),
    cancel_appointment: async (args) => cancelAppointment(organizationId, args),
  };

  return { tools, toolHandlers };
}

