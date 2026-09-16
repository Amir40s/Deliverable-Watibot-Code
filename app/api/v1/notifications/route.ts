import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { formatActivityLog } from "@/lib/api/mobile-route-utils";
import { type Prisma } from "@/lib/generated/prisma";

const TAB_MODULES: Record<string, string[]> = {
  all: [],
  unread: [],
  broadcast: ["broadcast", "campaign"],
  ai: ["ai", "flow", "bot", "automation"],
  team: ["team", "agent", "user", "member"],
  billing: ["billing", "payment", "plan"],
  system: ["system", "whatsapp", "setting", "integration", "tag"],
  security: ["security", "auth", "login", "device"],
  analytics: ["analytics", "report"],
  contacts: ["contact"],
  messages: ["whatsapp", "message", "chat"],
  campaigns: ["campaign", "broadcast"],
  flows: ["flow", "automation", "ai"],
};

function parseSince(value: string | null) {
  if (!value) return undefined;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1) || 1);
  const limit = clampLimit(sp.get("limit"), 20, 100);
  const tab = (sp.get("tab") || "all").toLowerCase();
  const unreadSince = parseSince(sp.get("unread_since") || sp.get("last_read_at"));
  const days = sp.get("days") === "all" ? null : Math.max(1, Number(sp.get("days") || 7) || 7);
  const dateFrom = unreadSince || (days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined);

  const where: Prisma.ActivityLogWhereInput = { organizationId: org.id };
  const moduleFilters = TAB_MODULES[tab];
  if (moduleFilters?.length) {
    where.OR = moduleFilters.map((item) => ({ module: { contains: item, mode: "insensitive" } }));
  }
  if (dateFrom) where.createdAt = { gte: dateFrom };

  const [logs, total, latestLogs] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const summary = latestLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.module] = (acc[log.module] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    unread_since: unreadSince?.toISOString() ?? null,
    unread_count: await prisma.activityLog.count({
      where: { organizationId: org.id, isRead: false },
    }),
    summary: Object.entries(summary).map(([module, count]) => ({
      module,
      count,
      percent: latestLogs.length ? Number(((count / latestLogs.length) * 100).toFixed(1)) : 0,
    })),
    notifications: logs.map(formatActivityLog),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const body = await req.json();
    
    if (body.mark_all) {
      await prisma.activityLog.updateMany({
        where: { organizationId: org.id, isRead: false },
        data: { isRead: true },
      });
      
      return NextResponse.json({
        status: 200,
        success: true,
        message: "All notifications marked as read",
      });
    } else if (body.id) {
      const log = await prisma.activityLog.findFirst({
        where: { id: body.id, organizationId: org.id },
      });
      
      if (!log) {
        return NextResponse.json({ status: 404, success: false, error: "Notification not found" }, { status: 404 });
      }
      
      await prisma.activityLog.update({
        where: { id: body.id },
        data: { isRead: true },
      });
      
      return NextResponse.json({
        status: 200,
        success: true,
        message: "Notification marked as read",
      });
    }
    
    return NextResponse.json({ status: 400, success: false, error: "Invalid request payload" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ status: 500, success: false, error: "Internal server error" }, { status: 500 });
  }
}
