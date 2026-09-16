import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatMediaLibraryItem } from "@/lib/api/mobile-route-utils";

/**
 * GET /api/v1/media-library/:id
 *
 * Get details for a single media item.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const item = await prisma.mediaLibraryItem.findUnique({
    where: { id },
  });

  if (!item || item.organizationId !== org.id) {
    return apiError(404, "Media item not found.");
  }

  const formatted = formatMediaLibraryItem(item);

  return NextResponse.json({
    status: 200,
    success: true,
    data: formatted,
    media_item: formatted,
  });
}

/**
 * DELETE /api/v1/media-library/:id
 *
 * Delete a media item from the library.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const item = await prisma.mediaLibraryItem.findUnique({
    where: { id },
  });

  if (!item || item.organizationId !== org.id) {
    return apiError(404, "Media item not found.");
  }

  await prisma.mediaLibraryItem.delete({
    where: { id },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    message: "Media item deleted successfully",
  });
}
