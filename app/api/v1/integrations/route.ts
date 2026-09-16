import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { toEpoch, toIso } from "@/lib/api/mobile-formatters";
import { type Prisma } from "@/lib/generated/prisma";
import { callShopifyAPI } from "@/lib/shopify/api";
import {
  asBodyObject,
  maskSecret,
  optionalBoolean,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

function formatOrder(order: unknown, source: "shopify" | "woocommerce") {
  const item = asBodyObject(order) ?? {};
  return {
    id: item.id,
    source,
    external_order_id: source === "shopify" ? item.shopifyOrderId : item.wooOrderId,
    order_number: item.orderNumber,
    total_price: item.totalPrice,
    currency: item.currency,
    customer_phone: item.customerPhone,
    customer_email: item.customerEmail,
    status: item.status,
    payment_status: item.paymentStatus ?? null,
    fulfillment_status: item.fulfillmentStatus ?? null,
    tags: item.tags ?? null,
    line_items: item.lineItems ?? null,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

function formatProduct(product: unknown) {
  const item = asBodyObject(product) ?? {};
  return {
    id: item.id,
    source: item.platform,
    external_product_id: item.shopifyProductId,
    name: item.name,
    description: item.description,
    price: Number(item.price ?? 0),
    currency: item.currency,
    image_url: item.imageUrl,
    sku: item.sku,
    status: item.status,
    created_at: toEpoch(item.createdAt),
    created_at_iso: toIso(item.createdAt),
    updated_at: toEpoch(item.updatedAt),
    updated_at_iso: toIso(item.updatedAt),
  };
}

function getWooCustomers(orders: unknown[]) {
  const customers = new Map<string, { id: string; phone: string | null; email: string | null; order_count: number; last_order_at: Date | null }>();
  for (const order of orders) {
    const item = asBodyObject(order) ?? {};
    const customerPhone = optionalString(item.customerPhone) || null;
    const customerEmail = optionalString(item.customerEmail) || null;
    const key = customerPhone || customerEmail;
    if (!key) continue;
    const current = customers.get(key) || {
      id: key,
      phone: customerPhone,
      email: customerEmail,
      order_count: 0,
      last_order_at: null,
    };
    current.order_count += 1;
    const createdAt = item.createdAt instanceof Date ? item.createdAt : new Date(String(item.createdAt ?? ""));
    if (!Number.isNaN(createdAt.getTime()) && (!current.last_order_at || createdAt > current.last_order_at)) {
      current.last_order_at = createdAt;
    }
    customers.set(key, current);
  }

  return Array.from(customers.values()).map((customer) => ({
    ...customer,
    last_order_at: toEpoch(customer.last_order_at),
    last_order_at_iso: toIso(customer.last_order_at),
  }));
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const [settings, shopifyOrders, wooOrders, products] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      select: {
        shopifyIntegrationToken: true,
        shopifyStoreUrl: true,
        shopifyAccessToken: true,
        shopifyOrderAutomationEnabled: true,
        shopifyOrderTemplate: true,
        shopifyOrderTemplateLanguage: true,
        shopifyAutomation: true,
        woocommerceStoreUrl: true,
        woocommerceConsumerKey: true,
        woocommerceConsumerSecret: true,
        woocommerceOrderAutomationEnabled: true,
        woocommerceAutomation: true,
        woocommerceWebhookSecret: true,
      },
    }),
    prisma.shopifyOrder.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.wooCommerceOrder.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, platform: { in: ["shopify", "woocommerce"] } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  if (!settings) return apiError(404, "Project not found.");

  let finalShopifyOrders: any[] = shopifyOrders.map((order) => formatOrder(order, "shopify"));
  let finalShopifyProducts: any[] = products
    .filter((product) => product.platform?.toLowerCase() === "shopify")
    .map(formatProduct);

  if (settings.shopifyStoreUrl && settings.shopifyAccessToken) {
    try {
      const ordersRes = await callShopifyAPI({
        organizationId: org.id,
        endpoint: "orders.json?status=any&limit=50",
      });
      if (ordersRes?.orders && Array.isArray(ordersRes.orders)) {
        finalShopifyOrders = ordersRes.orders.map((o: any) => ({
          id: o.id?.toString() ?? "",
          source: "shopify",
          external_order_id: o.id?.toString() ?? "",
          order_number: o.order_number?.toString() ?? "",
          total_price: o.total_price?.toString() ?? "0.00",
          currency: o.currency ?? "USD",
          customer_phone: o.phone || o.customer?.phone || "",
          customer_email: o.email || o.customer?.email || "",
          status: o.financial_status || "pending",
          payment_status: o.financial_status || "pending",
          fulfillment_status: o.fulfillment_status || "unfulfilled",
          created_at: toEpoch(o.created_at),
          created_at_iso: toIso(o.created_at),
        }));
      }
    } catch (e: any) {
      console.error("[v1/integrations] Live Shopify orders fetch error:", e.message);
    }

    try {
      const productsRes = await callShopifyAPI({
        organizationId: org.id,
        endpoint: "products.json?limit=50",
      });
      if (productsRes?.products && Array.isArray(productsRes.products)) {
        finalShopifyProducts = productsRes.products.map((p: any) => ({
          id: p.id?.toString() ?? "",
          source: "shopify",
          external_product_id: p.id?.toString() ?? "",
          name: p.title ?? "Product",
          description: p.body_html || p.description || "",
          price: Number(p.variants?.[0]?.price ?? 0),
          currency: "USD",
          image_url: p.image?.src || p.images?.[0]?.src || null,
          sku: p.variants?.[0]?.sku || "",
          status: p.status ?? "active",
          created_at: toEpoch(p.created_at),
          created_at_iso: toIso(p.created_at),
        }));
      }
    } catch (e: any) {
      console.error("[v1/integrations] Live Shopify products fetch error:", e.message);
    }
  }

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    integrations: {
      shopify: {
        connected: !!settings.shopifyStoreUrl,
        store_url: settings.shopifyStoreUrl,
        integration_token: maskSecret(settings.shopifyIntegrationToken),
        access_token: maskSecret(settings.shopifyAccessToken),
        order_automation_enabled: settings.shopifyOrderAutomationEnabled,
        order_template: settings.shopifyOrderTemplate,
        order_template_language: settings.shopifyOrderTemplateLanguage,
        automation: settings.shopifyAutomation ?? {},
        orders: finalShopifyOrders,
        products: finalShopifyProducts,
      },
      woocommerce: {
        connected: !!settings.woocommerceStoreUrl,
        store_url: settings.woocommerceStoreUrl,
        consumer_key: maskSecret(settings.woocommerceConsumerKey),
        consumer_secret: maskSecret(settings.woocommerceConsumerSecret),
        webhook_secret: maskSecret(settings.woocommerceWebhookSecret),
        order_automation_enabled: settings.woocommerceOrderAutomationEnabled,
        automation: settings.woocommerceAutomation ?? {},
        orders: wooOrders.map((order) => formatOrder(order, "woocommerce")),
        products: products.filter((product) => product.platform?.toLowerCase() === "woocommerce").map(formatProduct),
        customers: getWooCustomers(wooOrders),
      },
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const integration = optionalString(body.integration)?.toLowerCase();
  if (integration !== "shopify" && integration !== "woocommerce") {
    return apiError(400, "Field 'integration' must be 'shopify' or 'woocommerce'.");
  }

  const automation = asBodyObject(body.automation);
  const data: Prisma.OrganizationUpdateInput =
    integration === "shopify"
      ? {
          ...(body.store_url !== undefined || body.shopify_store_url !== undefined
            ? { shopifyStoreUrl: optionalString(body.store_url) || optionalString(body.shopify_store_url) || null }
            : {}),
          ...(body.access_token !== undefined || body.shopify_access_token !== undefined
            ? { shopifyAccessToken: optionalString(body.access_token) || optionalString(body.shopify_access_token) || null }
            : {}),
          ...(body.generate_integration_token === true
            ? { shopifyIntegrationToken: `wb_sh_${randomBytes(24).toString("hex")}` }
            : {}),
          ...(body.order_automation_enabled !== undefined
            ? { shopifyOrderAutomationEnabled: optionalBoolean(body.order_automation_enabled) ?? false }
            : {}),
          ...(body.order_template !== undefined ? { shopifyOrderTemplate: optionalString(body.order_template) || "order_confirmation" } : {}),
          ...(body.order_template_language !== undefined
            ? { shopifyOrderTemplateLanguage: optionalString(body.order_template_language) || "en_US" }
            : {}),
          ...(automation ? { shopifyAutomation: automation as Prisma.InputJsonValue } : {}),
        }
      : {
          ...(body.store_url !== undefined || body.woocommerce_store_url !== undefined
            ? { woocommerceStoreUrl: optionalString(body.store_url) || optionalString(body.woocommerce_store_url) || null }
            : {}),
          ...(body.consumer_key !== undefined
            ? { woocommerceConsumerKey: optionalString(body.consumer_key) || null }
            : {}),
          ...(body.consumer_secret !== undefined
            ? { woocommerceConsumerSecret: optionalString(body.consumer_secret) || null }
            : {}),
          ...(body.webhook_secret !== undefined
            ? { woocommerceWebhookSecret: optionalString(body.webhook_secret) || null }
            : {}),
          ...(body.order_automation_enabled !== undefined
            ? { woocommerceOrderAutomationEnabled: optionalBoolean(body.order_automation_enabled) ?? false }
            : {}),
          ...(automation ? { woocommerceAutomation: automation as Prisma.InputJsonValue } : {}),
        };

  await prisma.organization.update({
    where: { id: org.id },
    data,
  });

  return NextResponse.json({
    status: 200,
    success: true,
    message: `${integration} integration updated.`,
  });
}
