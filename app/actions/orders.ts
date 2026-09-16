"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateOrderNumber } from "@/lib/ai/commerce-tools";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }
  return session.user.organizationId;
}

export async function getOrdersList(params: {
  status?: string;
  search?: string;
  dateRange?: string; // "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM"
  customDate?: string; // "YYYY-MM-DD"
  agentId?: string; // "ALL" or agent id
  page?: number;
  limit?: number;
} = {}) {
  try {
    const organizationId = await getOrgId();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const andConditions: any[] = [{ organizationId }];

    // Status filter
    if (params.status && params.status !== "ALL") {
      andConditions.push({ status: params.status });
    }

    // Search filter
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      andConditions.push({
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { deliveryAddress: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    // Date filter
    const now = new Date();
    if (params.dateRange === "TODAY") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      andConditions.push({ createdAt: { gte: start, lte: end } });
    } else if (params.dateRange === "YESTERDAY") {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      andConditions.push({ createdAt: { gte: start, lte: end } });
    } else if (params.dateRange === "LAST_7_DAYS") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      andConditions.push({ createdAt: { gte: start } });
    } else if (params.dateRange === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      andConditions.push({ createdAt: { gte: start } });
    } else if (params.dateRange === "CUSTOM" && params.customDate) {
      const [year, month, day] = params.customDate.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      andConditions.push({ createdAt: { gte: start, lte: end } });
    }

    // Agent filter (matches AI Agent or Assigned Team Member on contact or in order notes)
    if (params.agentId && params.agentId !== "ALL") {
      andConditions.push({
        OR: [
          { contact: { aiAgentId: params.agentId } },
          { contact: { assignedAgentId: params.agentId } },
          { notes: { contains: params.agentId, mode: "insensitive" } },
        ],
      });
    }

    const where = { AND: andConditions };

    const [orders, totalCount, statsData, aiAgents, teamMembers] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              waId: true,
              name: true,
              profilePic: true,
              aiAgentId: true,
              aiAgent: { select: { id: true, name: true } },
              assignedAgentId: true,
              assignedAgent: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        select: { status: true, totalAmount: true },
      }),
      prisma.aIAgent.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { organizationId },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Compute stats
    let totalRevenue = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let deliveredCount = 0;

    for (const o of statsData) {
      const amount = Number(o.totalAmount || 0);
      totalRevenue += amount;
      if (o.status === "PENDING") pendingCount++;
      if (o.status === "CONFIRMED") confirmedCount++;
      if (o.status === "DELIVERED") deliveredCount++;
    }

    const agentsList = [
      ...aiAgents.map((a) => ({ id: a.id, name: a.name, type: "AI" as const })),
      ...teamMembers.map((u) => ({ id: u.id, name: u.name || u.email, type: "USER" as const })),
    ];

    return {
      success: true,
      orders: orders.map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        totalAmount: Number(o.totalAmount),
        items: Array.isArray(o.items) ? (o.items as any[]) : [],
      })),
      agents: agentsList,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalOrders: statsData.length,
        totalRevenue,
        pendingCount,
        confirmedCount,
        deliveredCount,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOrderDetails(id: string) {
  try {
    const organizationId = await getOrgId();
    const order = await prisma.order.findFirst({
      where: { id, organizationId },
      include: {
        contact: {
          select: {
            id: true,
            waId: true,
            name: true,
            profilePic: true,
            aiAgent: { select: { id: true, name: true } },
            assignedAgent: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!order) return { success: false, error: "Order not found." };

    return {
      success: true,
      order: {
        ...order,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        totalAmount: Number(order.totalAmount),
        items: Array.isArray(order.items) ? (order.items as any[]) : [],
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  notes?: string,
  templateOptions?: {
    templateName?: string;
    languageCode?: string;
    templateComponents?: any[];
    customParams?: Record<string, string>;
  }
) {
  try {
    const organizationId = await getOrgId();
    const existing = await prisma.order.findFirst({
      where: { id: orderId, organizationId },
    });

    if (!existing) return { success: false, error: "Order not found." };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(notes ? { notes: `${existing.notes || ""}\n${notes}`.trim() } : {}),
      },
    });

    // Automatically send updated WhatsApp status message or selected Template to customer with Order ID
    let notificationResult: any = null;
    if (templateOptions?.templateName !== "none") {
      const { sendOrderStatusNotification } = await import("@/lib/whatsapp/order-notifications");
      notificationResult = await sendOrderStatusNotification(orderId, status, templateOptions).catch((err) => {
        console.error(`[updateOrderStatus] WhatsApp notification failed: ${err.message}`);
        return { success: false, error: err.message };
      });
    }

    // Auto-dispatch to POS Webhook if status is CONFIRMED
    if (status === "CONFIRMED") {
      try {
        const { dispatchPOSOrderWebhook } = await import("@/lib/pos/webhook");
        dispatchPOSOrderWebhook({
          organizationId,
          orderId: updated.id,
          contactId: updated.contactId,
        }).catch((err) => {
          console.warn(`[updateOrderStatus] POS Webhook warning: ${err.message}`);
        });
      } catch {}
    }

    revalidatePath("/dashboard/orders");
    const serializedOrder = {
      ...updated,
      subtotal: Number(updated.subtotal),
      deliveryFee: Number(updated.deliveryFee),
      totalAmount: Number(updated.totalAmount),
      items: Array.isArray(updated.items) ? updated.items : [],
    };
    return { success: true, order: serializedOrder, notification: notificationResult };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateOrderStatus(
  orderIds: string[],
  status: string,
  templateOptions?: {
    templateName?: string;
    languageCode?: string;
    templateComponents?: any[];
    customParams?: Record<string, string>;
  }
) {
  try {
    const organizationId = await getOrgId();
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, error: "No orders selected." };
    }

    const updated = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        organizationId,
      },
      data: {
        status,
      },
    });

    // Automatically send WhatsApp status notifications or selected Template to all selected orders
    const { sendOrderStatusNotification } = await import("@/lib/whatsapp/order-notifications");
    Promise.allSettled(orderIds.map((id) => sendOrderStatusNotification(id, status, templateOptions))).catch((err) => {
      console.error(`[bulkUpdateOrderStatus] WhatsApp notification failed: ${err.message}`);
    });

    revalidatePath("/dashboard/orders");
    return { success: true, count: updated.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteOrder(orderId: string) {
  try {
    const organizationId = await getOrgId();
    await prisma.order.delete({
      where: { id: orderId, organizationId },
    });
    revalidatePath("/dashboard/orders");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkDeleteOrders(orderIds: string[]) {
  try {
    const organizationId = await getOrgId();
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, error: "No orders selected." };
    }

    const deleted = await prisma.order.deleteMany({
      where: {
        id: { in: orderIds },
        organizationId,
      },
    });

    revalidatePath("/dashboard/orders");
    return { success: true, count: deleted.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createManualOrder(data: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  items: Array<{
    productId?: string;
    productName: string;
    variant?: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryFee?: number;
  paymentMethod?: string;
  notes?: string;
}) {
  try {
    const organizationId = await getOrgId();
    const orderNumber = generateOrderNumber();

    const items = data.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      subtotal: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const deliveryFee = Number(data.deliveryFee || 0);
    const totalAmount = subtotal + deliveryFee;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        organizationId,
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone.trim(),
        customerEmail: data.customerEmail?.trim() || null,
        deliveryAddress: data.deliveryAddress.trim(),
        items: items as any,
        subtotal,
        deliveryFee,
        totalAmount,
        currency: "PKR",
        paymentMethod: data.paymentMethod || "Cash on Delivery",
        status: "CONFIRMED",
        notes: data.notes || null,
        source: "MANUAL",
      },
    });

    // Send WhatsApp confirmation to customer with Order ID
    const { sendOrderStatusNotification } = await import("@/lib/whatsapp/order-notifications");
    sendOrderStatusNotification(order.id, "CONFIRMED").catch((err) => {
      console.error(`[createManualOrder] WhatsApp notification failed: ${err.message}`);
    });

    // Auto-dispatch to POS Webhook
    try {
      const { dispatchPOSOrderWebhook } = await import("@/lib/pos/webhook");
      dispatchPOSOrderWebhook({
        organizationId,
        orderId: order.id,
        contactId: order.contactId,
      }).catch((err) => {
        console.warn(`[createManualOrder] POS Webhook warning: ${err.message}`);
      });
    } catch {}

    revalidatePath("/dashboard/orders");
    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Server action to test a POS webhook URL with sample order data
 */
export async function testPOSWebhookAction(
  webhookUrl: string,
  secret?: string
): Promise<{ success: boolean; status?: number; responseText?: string; error?: string }> {
  try {
    const organizationId = await getOrgId();
    const { testPOSWebhookEndpoint } = await import("@/lib/pos/webhook");
    return await testPOSWebhookEndpoint({ webhookUrl, secret, organizationId });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
