import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { formatKnowledgeBase } from "@/lib/api/mobile-route-utils";

function buildFileTypeFilter(fileType: string): Prisma.KnowledgeBaseWhereInput {
  const normalized = fileType.replace(/^\./, "");
  if (!normalized) return {};

  if (["sheet", "sheets", "google_sheet", "google-sheets"].includes(normalized)) {
    return { sourceUrl: { startsWith: "googlesheets://", mode: "insensitive" } };
  }

  return { fileName: { endsWith: `.${normalized}`, mode: "insensitive" } };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const status = (sp.get("status") || "").trim();
  const fileType = (sp.get("file_type") || "").trim().toLowerCase();

  const where: Prisma.KnowledgeBaseWhereInput = {
    organizationId: org.id,
    ...(status ? { status } : {}),
    ...buildFileTypeFilter(fileType),
  };

  const [total, entries] = await Promise.all([
    prisma.knowledgeBase.count({ where }),
    prisma.knowledgeBase.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        _count: { select: { chunks: true } },
      },
    }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total,
    knowledge_base: entries.map(formatKnowledgeBase),
  });
}
