import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import {
  formatQuickReply,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

function decodePathKey(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

async function findQuickReplyByKey(quickReplyKey: string, organizationId: string) {
  const key = decodePathKey(quickReplyKey);

  return prisma.quickReply.findFirst({
    where: {
      organizationId,
      OR: [
        { id: key },
        { name: { equals: key, mode: "insensitive" } },
      ],
    },
  });
}

function quickReplyNotFound(quickReplyKey: string) {
  return NextResponse.json(
    {
      status: 404,
      error: "Quick reply not found.",
      lookup_key: decodePathKey(quickReplyKey),
      hint: "Use the current quick reply name or id from GET /api/v1/quick-replies.",
    },
    { status: 404 }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quickReplyId: string }> }
) {
  const { quickReplyId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await findQuickReplyByKey(quickReplyId, org.id);
  if (!existing) return quickReplyNotFound(quickReplyId);

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  let nextFileUrl = undefined;
  if (body.file_urls !== undefined || body.fileUrls !== undefined) {
    const raw = Array.isArray(body.file_urls) ? body.file_urls : (Array.isArray(body.fileUrls) ? body.fileUrls : []);
    nextFileUrl = raw.length > 1 ? JSON.stringify(raw) : (raw[0] || null);
  } else if (body.file_url !== undefined || body.fileUrl !== undefined) {
    nextFileUrl = optionalString(body.file_url) || optionalString(body.fileUrl) || null;
  }

  let nextFileName = undefined;
  if (body.file_names !== undefined || body.fileNames !== undefined) {
    const raw = Array.isArray(body.file_names) ? body.file_names : (Array.isArray(body.fileNames) ? body.fileNames : []);
    nextFileName = raw.length > 1 ? JSON.stringify(raw) : (raw[0] || null);
  } else if (body.file_name !== undefined || body.fileName !== undefined) {
    nextFileName = optionalString(body.file_name) || optionalString(body.fileName) || null;
  }

  const updated = await prisma.quickReply.update({
    where: { id: existing.id },
    data: {
      ...(body.name !== undefined || body.trigger !== undefined
        ? { name: optionalString(body.name) || optionalString(body.trigger) || existing.name }
        : {}),
      ...(body.type !== undefined ? { type: optionalString(body.type) || existing.type } : {}),
      ...(body.content !== undefined || body.message !== undefined
        ? { content: optionalString(body.content) || optionalString(body.message) || null }
        : {}),
      ...(nextFileUrl !== undefined ? { fileUrl: nextFileUrl } : {}),
      ...(nextFileName !== undefined ? { fileName: nextFileName } : {}),
    },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    quick_reply: formatQuickReply(updated),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ quickReplyId: string }> }
) {
  const { quickReplyId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await findQuickReplyByKey(quickReplyId, org.id);
  if (!existing) return quickReplyNotFound(quickReplyId);

  await prisma.quickReply.delete({ where: { id: existing.id } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: existing.id,
    key: decodePathKey(quickReplyId),
  });
}
