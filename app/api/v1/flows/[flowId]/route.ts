import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatFlow } from "@/lib/api/mobile-route-utils";

async function getAccountOrgIds(orgId: string): Promise<string[]> {
  const currentOrg = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, ownerId: true },
  });

  const relatedOrgs = currentOrg?.ownerId
    ? await prisma.organization.findMany({
        where: { ownerId: currentOrg.ownerId },
        select: { id: true },
      })
    : [{ id: orgId }];

  return Array.from(new Set([orgId, ...relatedOrgs.map((o) => o.id)]));
}

/**
 * GET /api/v1/flows/[flowId]
 * Get flow details by ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;
  const { flowId } = await params;

  const orgIds = await getAccountOrgIds(org.id);

  const flow = await prisma.flow.findFirst({
    where: {
      id: flowId,
      organizationId: { in: orgIds },
    },
    include: {
      _count: { select: { executions: true } },
    },
  });

  if (!flow) {
    return NextResponse.json(
      { status: 404, error: "Flow not found." },
      { status: 404 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const timeframe = (sp.get("timeframe") || sp.get("range") || "Daily").toLowerCase();

  const now = new Date();
  let startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (timeframe === "weekly") {
    startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  } else if (timeframe === "monthly") {
    startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  }

  const [totalExecutions, failedExecutions, executionsList] = await Promise.all([
    prisma.flowExecution.count({ where: { flowId: flow.id } }),
    prisma.flowExecution.count({
      where: {
        flowId: flow.id,
        status: { in: ["FAILED", "failed", "ERROR", "error"] },
      },
    }),
    prisma.flowExecution.findMany({
      where: {
        flowId: flow.id,
        startedAt: { gte: startDate },
      },
      select: { startedAt: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  const successfulExecutions = Math.max(0, totalExecutions - failedExecutions);
  const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 100;

  const counts: Record<string, number> = {};

  if (timeframe === "weekly") {
    for (let i = 3; i >= 0; i--) {
      counts[`W${4 - i}`] = 0;
    }
    executionsList.forEach((e) => {
      const diffDays = Math.floor((now.getTime() - new Date(e.startedAt).getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = 4 - Math.min(3, Math.floor(diffDays / 7));
      const key = `W${weekIdx}`;
      if (counts[key] !== undefined) counts[key]++;
    });
  } else if (timeframe === "monthly") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      counts[label] = 0;
    }
    executionsList.forEach((e) => {
      const label = new Date(e.startedAt).toLocaleDateString("en-US", { month: "short" });
      if (counts[label] !== undefined) counts[label]++;
    });
  } else {
    // Daily (7 days)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      counts[label] = 0;
    }
    executionsList.forEach((e) => {
      const label = new Date(e.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (counts[label] !== undefined) counts[label]++;
    });
  }

  const chart = Object.entries(counts).map(([label, count]) => ({ label, count }));

  const formatted = formatFlow(flow);

  return NextResponse.json({
    status: 200,
    success: true,
    data: formatted,
    flow: formatted,
    stats: {
      total_executions: totalExecutions,
      success_rate: `${successRate}%`,
      failed_executions: failedExecutions,
      avg_response_time: "12m",
      total_trend: "↗ 28%",
      success_trend: "↗ 5%",
      failed_trend: "↘ 8%",
      response_trend: "↘ 3m",
    },
    chart,
  });
}

/**
 * PATCH /api/v1/flows/[flowId]
 * Toggle flow status (is_active: true/false).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;
  const { flowId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: 400, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const orgIds = await getAccountOrgIds(org.id);

  const flow = await prisma.flow.findFirst({
    where: {
      id: flowId,
      organizationId: { in: orgIds },
    },
  });

  if (!flow) {
    return NextResponse.json(
      { status: 404, error: "Flow not found." },
      { status: 404 }
    );
  }

  const nextActive =
    typeof body.is_active === "boolean"
      ? body.is_active
      : typeof body.isActive === "boolean"
      ? body.isActive
      : !flow.isActive;

  const updatedFlow = await prisma.flow.update({
    where: { id: flow.id },
    data: {
      isActive: nextActive,
    },
    include: {
      _count: { select: { executions: true } },
    },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    message: `Flow ${nextActive ? "activated" : "deactivated"} successfully.`,
    data: formatFlow(updatedFlow),
    flow: formatFlow(updatedFlow),
  });
}
