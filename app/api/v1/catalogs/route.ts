import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { type Prisma } from "@/lib/generated/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import {
  asBodyObject,
  formatCatalogProduct,
  optionalNumber,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

const GRAPH_API_VERSION = "v21.0";

type CatalogSettings = {
  is_connected: boolean;
  whatsapp_number: string | null;
  whatsapp_business_name: string | null;
  whatsapp_business_id: string | null;
  whatsapp_phone_number_id: string | null;
  meta_business_id: string | null;
  has_catalog_token: boolean;
};

function normalizeCatalogSettings(org: {
  whatsappNumber: string | null;
  whatsappBusinessName: string | null;
  whatsappBusinessId: string | null;
  whatsappPhoneNumberId: string | null;
  metaAccessToken: string | null;
  metaCatalogAccessToken: string | null;
  metaBusinessId: string | null;
}): CatalogSettings & { activeToken: string | null } {
  return {
    is_connected: !!org.whatsappBusinessId && !!org.whatsappPhoneNumberId && !!org.metaAccessToken,
    whatsapp_number: org.whatsappNumber,
    whatsapp_business_name: org.whatsappBusinessName,
    whatsapp_business_id: org.whatsappBusinessId,
    whatsapp_phone_number_id: org.whatsappPhoneNumberId,
    meta_business_id: org.metaBusinessId,
    has_catalog_token: !!org.metaCatalogAccessToken,
    activeToken: org.metaCatalogAccessToken || org.metaAccessToken,
  };
}

async function fetchLinkedCatalogs(whatsappBusinessId: string, token: string) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${whatsappBusinessId}/product_catalogs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12000),
    },
  );
  const data = asBodyObject(await res.json()) ?? {};
  const error = asBodyObject(data.error);

  if (!res.ok || error) {
    throw new Error(optionalString(error?.message) || "Failed to fetch linked Meta catalogs.");
  }

  return Array.isArray(data.data) ? data.data : [];
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const status = (sp.get("status") || "").trim();
  const platform = (sp.get("platform") || "").trim();

  const settingsOrg = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      whatsappNumber: true,
      whatsappBusinessName: true,
      whatsappBusinessId: true,
      whatsappPhoneNumberId: true,
      metaAccessToken: true,
      metaCatalogAccessToken: true,
      metaBusinessId: true,
    },
  });

  if (!settingsOrg) return apiError(404, "Project not found.");

  const settingsWithToken = normalizeCatalogSettings(settingsOrg);
  const { activeToken, ...wabaSettings } = settingsWithToken;
  const warnings: string[] = [];
  let linkedCatalogs: unknown[] = [];

  if (wabaSettings.is_connected && wabaSettings.whatsapp_business_id && activeToken) {
    try {
      linkedCatalogs = await fetchLinkedCatalogs(wabaSettings.whatsapp_business_id, activeToken);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Failed to fetch linked Meta catalogs.");
    }
  }

  const where: Prisma.ProductWhereInput = {
    organizationId: org.id,
    ...(status ? { status } : {}),
    ...(platform ? { platform } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    waba_settings: wabaSettings,
    linked_catalogs: linkedCatalogs,
    total_linked_catalogs: linkedCatalogs.length,
    total,
    products: products.map(formatCatalogProduct),
    warnings,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name)?.trim();
  const price = optionalNumber(body.price);

  if (!name) return apiError(400, "Field 'name' is required.");
  if (price === undefined) return apiError(400, "Field 'price' is required.");
  if (price < 0) return apiError(400, "Field 'price' cannot be negative.");

  const product = await prisma.product.create({
    data: {
      organizationId: org.id,
      name,
      description: optionalString(body.description)?.trim() || null,
      price,
      currency: optionalString(body.currency)?.trim() || "PKR",
      sku: optionalString(body.sku)?.trim() || `prod_${Date.now()}`,
      imageUrl: optionalString(body.image_url)?.trim() || optionalString(body.imageUrl)?.trim() || null,
      status: optionalString(body.status)?.trim() || "active",
      platform: "manual",
    },
  });

  return NextResponse.json({
    status: 201,
    success: true,
    product: formatCatalogProduct(product),
  }, { status: 201 });
}
