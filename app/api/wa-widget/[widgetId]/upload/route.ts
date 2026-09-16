import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaService } from "@/lib/storage/media-service";

function setCorsHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  return setCorsHeaders(res);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  try {
    const { widgetId } = await params;

    // Validate widget & active organization
    const org = await prisma.organization.findFirst({
      where: { OR: [{ slug: widgetId }, { id: widgetId }] },
      select: { id: true, status: true }
    });

    if (!org) {
      const errRes = NextResponse.json({ error: "Widget not found" }, { status: 404 });
      return setCorsHeaders(errRes);
    }

    if (org.status !== "active") {
      const errRes = NextResponse.json({ error: "Widget is inactive" }, { status: 403 });
      return setCorsHeaders(errRes);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      const errRes = NextResponse.json({ error: "No file provided" }, { status: 400 });
      return setCorsHeaders(errRes);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload using mediaService
    const result = await mediaService.upload({
      buffer,
      filename: file.name || `upload_${Date.now()}`,
      mimeType: file.type || "application/octet-stream",
      organizationId: org.id
    });

    const res = NextResponse.json({
      success: true,
      url: result.url,
      relativePath: result.relativePath,
      originalName: result.originalName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      category: result.category
    });
    return setCorsHeaders(res);

  } catch (error: any) {
    console.error("[wa-widget upload error]", error);
    const message = error?.message || "File upload failed";
    const errRes = NextResponse.json({ error: message }, { status: 500 });
    return setCorsHeaders(errRes);
  }
}
