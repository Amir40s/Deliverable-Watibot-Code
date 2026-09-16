import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { clampLimit } from "@/lib/api/mobile-formatters";
import { formatFlow } from "@/lib/api/mobile-route-utils";

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 500, 1000);
  const active = sp.get("active");
  const platform = (sp.get("platform") || "").trim();

  let flows: any[] = [];
  let totalActive = 0;
  let totalDraft = 0;
  let totalExecutions = 0;
  let completedExecutions = 0;

  try {
    // Collect all organization IDs owned by this account owner
    const currentOrg = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { id: true, ownerId: true },
    });

    const relatedOrgs = currentOrg?.ownerId
      ? await prisma.organization.findMany({
          where: { ownerId: currentOrg.ownerId },
          select: { id: true },
        })
      : [{ id: org.id }];

    const orgIds = Array.from(new Set([org.id, ...relatedOrgs.map((o) => o.id)]));

    flows = await prisma.flow.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(active === "true" ? { isActive: true } : {}),
        ...(active === "false" ? { isActive: false } : {}),
        ...(platform && platform !== "ALL" ? { platform } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        _count: { select: { executions: true } },
        executions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { startedAt: true },
        },
      },
    });

    totalActive = await prisma.flow.count({
      where: { organizationId: { in: orgIds }, isActive: true },
    });

    totalDraft = await prisma.flow.count({
      where: { organizationId: { in: orgIds }, isActive: false },
    });

    totalExecutions = await prisma.flowExecution.count({
      where: { flow: { organizationId: { in: orgIds } } },
    });

    completedExecutions = await prisma.flowExecution.count({
      where: {
        flow: { organizationId: { in: orgIds } },
        status: { notIn: ["FAILED", "failed", "ERROR", "error"] },
      },
    });
  } catch (err) {
    console.error("Prisma flows fetch error:", err);
  }

  const totalFlows = totalActive + totalDraft;
  const successRate =
    totalExecutions > 0
      ? Math.round((completedExecutions / totalExecutions) * 100)
      : 100;

  const formattedFlows = flows.map(formatFlow);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total: totalFlows,
    stats: {
      total_flows: totalFlows,
      active_flows: totalActive,
      draft_flows: totalDraft,
      total_executions: totalExecutions,
      success_rate: `${successRate}%`,
    },
    flows: formattedFlows,
    data: formattedFlows,
  });
}
