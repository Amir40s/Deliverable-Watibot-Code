import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import {
  formatCatalogProduct,
  optionalNumber,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.product.findFirst({
    where: { id: productId, organizationId: org.id },
  });
  if (!existing) return apiError(404, "Catalog product not found.");

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name)?.trim();
  const price = body.price !== undefined ? optionalNumber(body.price) : undefined;

  if (body.name !== undefined && !name) return apiError(400, "Field 'name' cannot be empty.");
  if (body.price !== undefined && price === undefined) return apiError(400, "Field 'price' must be a number.");
  if (price !== undefined && price < 0) return apiError(400, "Field 'price' cannot be negative.");

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(body.description !== undefined ? { description: optionalString(body.description)?.trim() || null } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(body.currency !== undefined ? { currency: optionalString(body.currency)?.trim() || existing.currency } : {}),
      ...(body.sku !== undefined ? { sku: optionalString(body.sku)?.trim() || existing.sku } : {}),
      ...(body.image_url !== undefined || body.imageUrl !== undefined
        ? { imageUrl: optionalString(body.image_url)?.trim() || optionalString(body.imageUrl)?.trim() || null }
        : {}),
      ...(body.status !== undefined ? { status: optionalString(body.status)?.trim() || existing.status } : {}),
      ...(body.platform !== undefined ? { platform: optionalString(body.platform)?.trim() || existing.platform } : {}),
    },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    product: formatCatalogProduct(product),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.product.findFirst({
    where: { id: productId, organizationId: org.id },
    select: { id: true },
  });
  if (!existing) return apiError(404, "Catalog product not found.");

  await prisma.product.delete({ where: { id: productId } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: productId,
  });
}
