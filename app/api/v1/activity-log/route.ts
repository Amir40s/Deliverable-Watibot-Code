import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { formatActivityLog } from "@/lib/api/mobile-route-utils";
import { type Prisma } from "@/lib/generated/prisma";

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const limit = clampLimit(sp.get("limit"), 20, 100);
  const activityModule = sp.get("module");
  const action = sp.get("action");
  const status = sp.get("status");
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const dateFrom = parseDate(sp.get("date_from"));
  const dateTo = parseDate(sp.get("date_to"), true);

  const where: Prisma.ActivityLogWhereInput = { organizationId: org.id };
  if (activityModule && activityModule !== "all") {
    const modules = activityModule.split(",").map((item) => item.trim()).filter(Boolean);
    if (modules.length > 1) {
      where.OR = modules.map((item) => ({ module: { contains: item, mode: "insensitive" } }));
    } else {
      where.module = { contains: activityModule, mode: "insensitive" };
    }
  }
  if (action && action !== "all") where.action = action;
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      ...(where.OR || []),
      { userName: { contains: search, mode: "insensitive" } },
      { userEmail: { contains: search, mode: "insensitive" } },
      { target: { contains: search, mode: "insensitive" } },
      { details: { contains: search, mode: "insensitive" } },
    ];
  }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const [logs, total, totalAll, successCount, warningCount, failedCount] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.count({ where: { organizationId: org.id } }),
    prisma.activityLog.count({ where: { organizationId: org.id, status: "success" } }),
    prisma.activityLog.count({ where: { organizationId: org.id, status: "warning" } }),
    prisma.activityLog.count({ where: { organizationId: org.id, status: "failed" } }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    kpis: {
      total: totalAll,
      success: successCount,
      warning: warningCount,
      failed: failedCount,
    },
    logs: logs.map(formatActivityLog),
  });
}
