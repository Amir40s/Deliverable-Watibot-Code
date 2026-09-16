import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface POSWebhookPayload {
  event: "order.confirmed" | "order.test";
  timestamp: string;
  order: {
    id: string;
    orderNumber: string;
    organizationId: string;
    status: string;
    source: string;
    customer: {
      name: string;
      phone: string;
      email?: string | null;
      address: string;
    };
    items: any[];
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    currency: string;
    paymentMethod: string;
    paymentStatus: string;
    notes?: string | null;
    createdAt?: string;
  };
  agent?: {
    id: string;
    name: string;
    agentType?: string;
  };
}

/**
 * Dispatches an order to the agent's configured POS Webhook endpoint.
 * Triggers automatically when a customer confirms an order in the Ordering System.
 */
export async function dispatchPOSOrderWebhook(params: {
  organizationId: string;
  orderId: string;
  agentId?: string | null;
  contactId?: string | null;
}): Promise<{ success: boolean; status?: number; error?: string }> {
  const { organizationId, orderId, agentId, contactId } = params;

  try {
    // 1. Fetch Order from database
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        contact: {
          select: {
            id: true,
            aiAgentId: true,
          },
        },
      },
    });

    if (!order) {
      logger.flow.warn(`[POSWebhook] Order ${orderId} not found in DB. Skipping POS dispatch.`);
      return { success: false, error: "Order not found" };
    }

    // 2. Identify the active AI Agent
    const resolvedAgentId = agentId || order.contact?.aiAgentId || null;
    let agent: any = null;

    if (resolvedAgentId) {
      agent = await prisma.aIAgent.findUnique({
        where: { id: resolvedAgentId },
      });
    }

    // Fallback: Check if organization has an ordering agent with POS webhook enabled
    if (!agent || !agent.posWebhookEnabled || !agent.posWebhookUrl) {
      const orgAgentWithPOS = await prisma.aIAgent.findFirst({
        where: {
          organizationId,
          posWebhookEnabled: true,
          posWebhookUrl: { not: null },
        },
      });
      if (orgAgentWithPOS) {
        agent = orgAgentWithPOS;
      }
    }

    if (!agent || !agent.posWebhookEnabled || !agent.posWebhookUrl?.trim()) {
      logger.flow.info(`[POSWebhook] No active POS webhook configured for agent/org on order ${order.orderNumber}. Skipping.`);
      return { success: false, error: "POS Webhook not enabled" };
    }

    const webhookUrl = agent.posWebhookUrl.trim();
    const webhookSecret = agent.posWebhookSecret?.trim() || "";

    // 3. Construct POS standardized payload
    const items = Array.isArray(order.items) ? order.items : [];
    const payload: POSWebhookPayload = {
      event: "order.confirmed",
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        organizationId: order.organizationId,
        status: order.status,
        source: order.source || "AI_CHAT",
        customer: {
          name: order.customerName,
          phone: order.customerPhone,
          email: order.customerEmail || null,
          address: order.deliveryAddress,
        },
        items,
        subtotal: Number(order.subtotal || 0),
        deliveryFee: Number(order.deliveryFee || 0),
        totalAmount: Number(order.totalAmount || 0),
        currency: order.currency || "PKR",
        paymentMethod: order.paymentMethod || "Cash on Delivery",
        paymentStatus: order.paymentStatus || "PENDING",
        notes: order.notes || null,
        createdAt: order.createdAt.toISOString(),
      },
      agent: {
        id: agent.id,
        name: agent.name,
        agentType: agent.agentType,
      },
    };

    const payloadString = JSON.stringify(payload);

    // 4. Construct Headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "WatiBot-POS-Dispatcher/1.0",
      "X-POS-Event": "order.confirmed",
      "X-POS-Order-Number": order.orderNumber,
    };

    if (webhookSecret) {
      const hmac = createHmac("sha256", webhookSecret).update(payloadString).digest("hex");
      headers["X-POS-Signature"] = hmac;
      headers["Authorization"] = `Bearer ${webhookSecret}`;
    }

    logger.flow.info(`[POSWebhook] Dispatching Order #${order.orderNumber} to POS endpoint: ${webhookUrl}`);

    // 5. Send POST request with 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const isSuccess = response.ok;
    const responseText = await response.text().catch(() => "");

    logger.flow.info(
      `[POSWebhook] Order #${order.orderNumber} POS dispatch result: HTTP ${response.status} (${isSuccess ? "SUCCESS" : "FAILED"}). Body: ${responseText.slice(0, 300)}`
    );

    // 6. Record in Activity Log
    try {
      const { logActivity } = await import("@/lib/activityLog");
      await logActivity({
        organizationId,
        action: `POS Webhook: Order #${order.orderNumber}`,
        module: "POS System",
        target: webhookUrl,
        details: isSuccess
          ? `Dispatched Order #${order.orderNumber} successfully (HTTP ${response.status})`
          : `POS endpoint responded with HTTP ${response.status}: ${responseText.slice(0, 200)}`,
        status: isSuccess ? "success" : "failed",
      });
    } catch {}

    return {
      success: isSuccess,
      status: response.status,
      error: isSuccess ? undefined : `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
    };
  } catch (error: any) {
    const errorMsg = error?.name === "AbortError" ? "Request timed out after 10s" : error?.message || "Unknown error";
    logger.flow.error(`[POSWebhook] Error dispatching order ${orderId} to POS: ${errorMsg}`);

    try {
      const { logActivity } = await import("@/lib/activityLog");
      await logActivity({
        organizationId,
        action: "POS Webhook Failed",
        module: "POS System",
        target: "External POS",
        details: `Failed to deliver order webhook: ${errorMsg}`,
        status: "failed",
      });
    } catch {}

    return { success: false, error: errorMsg };
  }
}

/**
 * Tests a POS Webhook endpoint by sending a sample order payload.
 */
export async function testPOSWebhookEndpoint(params: {
  webhookUrl: string;
  secret?: string | null;
  organizationId?: string;
}): Promise<{ success: boolean; status?: number; responseText?: string; error?: string }> {
  const { webhookUrl, secret } = params;

  if (!webhookUrl || !webhookUrl.startsWith("http")) {
    return { success: false, error: "Please provide a valid HTTP/HTTPS Webhook URL." };
  }

  const samplePayload: POSWebhookPayload = {
    event: "order.test",
    timestamp: new Date().toISOString(),
    order: {
      id: "test_order_" + Date.now(),
      orderNumber: "ORD-TEST-9999",
      organizationId: params.organizationId || "org_test",
      status: "CONFIRMED",
      source: "AI_CHAT",
      customer: {
        name: "Test Customer",
        phone: "+1234567890",
        email: "test@example.com",
        address: "123 Test Street, Suite 400",
      },
      items: [
        {
          productName: "Sample Product / Menu Item",
          quantity: 2,
          unitPrice: 25.0,
          subtotal: 50.0,
        },
      ],
      subtotal: 50.0,
      deliveryFee: 5.0,
      totalAmount: 55.0,
      currency: "USD",
      paymentMethod: "Cash on Delivery",
      paymentStatus: "PENDING",
      notes: "Sample test order generated from AI Agent Studio",
      createdAt: new Date().toISOString(),
    },
    agent: {
      id: "agent_test",
      name: "AI Ordering Agent",
      agentType: "ordering_collector",
    },
  };

  const payloadString = JSON.stringify(samplePayload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "WatiBot-POS-Tester/1.0",
    "X-POS-Event": "order.test",
    "X-POS-Order-Number": "ORD-TEST-9999",
  };

  if (secret?.trim()) {
    const hmac = createHmac("sha256", secret.trim()).update(payloadString).digest("hex");
    headers["X-POS-Signature"] = hmac;
    headers["Authorization"] = `Bearer ${secret.trim()}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const bodyText = await res.text().catch(() => "");
    return {
      success: res.ok,
      status: res.status,
      responseText: bodyText.slice(0, 300),
      error: res.ok ? undefined : `POS responded with HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
    };
  } catch (err: any) {
    const errorMsg = err?.name === "AbortError" ? "Request timed out after 8s" : err?.message || "Connection failed";
    return { success: false, error: errorMsg };
  }
}
