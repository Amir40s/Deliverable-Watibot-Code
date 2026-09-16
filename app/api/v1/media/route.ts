import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { formatMediaLibraryItem } from '@/lib/api/mobile-route-utils';
import { clampLimit } from '@/lib/api/mobile-formatters';
import type { Prisma } from '@/lib/generated/prisma';
import { saveMediaLocally } from '@/lib/storage/media';

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

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return apiError(400, "No file uploaded.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filename = `${timestamp}-${cleanName}`;

    const finalUrl = await saveMediaLocally(buffer, filename, file.type || 'application/octet-stream');

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isVideo = ['mp4', 'mkv', 'avi', 'mov', 'webm', '3gp'].includes(ext);
    const isAudio = ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'amr', 'flac'].includes(ext);
    const mediaType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';

    return NextResponse.json({
      status: 201,
      success: true,
      url: finalUrl,
      media_url: finalUrl,
      type: mediaType,
      media_type: mediaType,
      filename,
      name: file.name
    }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || 'Upload failed';
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
