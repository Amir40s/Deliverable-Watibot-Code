import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import {
  formatQuickReply,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";
import { clampLimit } from "@/lib/api/mobile-formatters";

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const type = (sp.get("type") || "").trim();

  const quickReplies = await prisma.quickReply.findMany({
    where: {
      organizationId: org.id,
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total: quickReplies.length,
    quick_replies: quickReplies.map(formatQuickReply),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name) || optionalString(body.trigger);
  const content = optionalString(body.content) || optionalString(body.message);
  const type = optionalString(body.type) || "text";

  if (!name) return apiError(400, "Field 'name' is required.");
  if (type === "text" && !content) return apiError(400, "Field 'content' is required for text quick replies.");

  const rawFileUrls = Array.isArray(body.file_urls) ? body.file_urls : (Array.isArray(body.fileUrls) ? body.fileUrls : null);
  const fileUrl = rawFileUrls
    ? (rawFileUrls.length > 1 ? JSON.stringify(rawFileUrls) : (rawFileUrls[0] || null))
    : (optionalString(body.file_url) || optionalString(body.fileUrl) || null);

  const rawFileNames = Array.isArray(body.file_names) ? body.file_names : (Array.isArray(body.fileNames) ? body.fileNames : null);
  const fileName = rawFileNames
    ? (rawFileNames.length > 1 ? JSON.stringify(rawFileNames) : (rawFileNames[0] || null))
    : (optionalString(body.file_name) || optionalString(body.fileName) || null);

  const quickReply = await prisma.quickReply.create({
    data: {
      organizationId: org.id,
      name,
      type,
      content,
      fileUrl,
      fileName,
    },
  });

  return NextResponse.json({
    status: 201,
    success: true,
    quick_reply: formatQuickReply(quickReply),
  }, { status: 201 });
}
