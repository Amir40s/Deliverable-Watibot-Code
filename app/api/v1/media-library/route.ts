import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { formatMediaLibraryItem, readJsonObject, optionalString } from "@/lib/api/mobile-route-utils";
import { clampLimit } from "@/lib/api/mobile-formatters";

/**
 * GET /api/v1/media-library
 *
 * Fetch media items in the workspace library.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const type = (sp.get("type") || "").trim().toLowerCase();
  const page = Math.max(Number(sp.get("page") ?? 1), 1);
  const offset = sp.get("offset") ? Math.max(Number(sp.get("offset")), 0) : (page - 1) * limit;

  const where: Prisma.MediaLibraryItemWhereInput = {
    organizationId: org.id,
    ...(type && type !== "all" ? { type } : {}),
    ...(search
      ? {
          name: { contains: search, mode: "insensitive" },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.mediaLibraryItem.count({ where }),
    prisma.mediaLibraryItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
  ]);

  const formattedItems = items.map(formatMediaLibraryItem);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total,
    count: formattedItems.length,
    data: formattedItems,
    media_items: formattedItems,
  });
}

/**
 * POST /api/v1/media-library
 *
 * Add a new media item to the library.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name) || optionalString(body.title) || optionalString(body.fileName);
  const url = optionalString(body.url) || optionalString(body.mediaUrl) || optionalString(body.fileUrl);
  const type = (optionalString(body.type) || optionalString(body.mediaType) || "image").toLowerCase();

  if (!name) return apiError(400, "Field 'name' is required.");
  if (!url) return apiError(400, "Field 'url' is required.");

  const newMedia = await prisma.mediaLibraryItem.create({
    data: {
      organizationId: org.id,
      name,
      url,
      type,
    },
  });

  const formatted = formatMediaLibraryItem(newMedia);

  return NextResponse.json(
    {
      status: 201,
      success: true,
      data: formatted,
      media_item: formatted,
    },
    { status: 201 }
  );
}
