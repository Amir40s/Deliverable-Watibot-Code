import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatAgent } from "@/lib/api/mobile-route-utils";

const MODULES = [
  "dashboard",
  "chat",
  "contacts",
  "audience",
  "facebook_posts",
  "instagram_posts",
  "reports",
  "agents",
  "permissions",
  "tags",
  "notifications",
  "quick_replies",
  "templates",
  "drip_campaign",
  "scheduler",
  "ad_campaign",
  "ad_manager",
  "flow",
  "leads_report",
  "quick_message",
  "knowledge_base",
  "settings",
  "integrations",
  "quota",
  "developer",
  "projects",
];

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const users = await prisma.user.findMany({
    where: { organizationId: org.id, role: { not: "SUPER_ADMIN" } },
    orderBy: { createdAt: "desc" },
    include: {
      department: true,
      deviceSettings: { orderBy: { lastActiveAt: "desc" }, take: 1 },
      _count: { select: { assignedContacts: true, sentMessages: true } },
    },
  });

  const roleCounts = users.reduce<Record<string, number>>((acc, user) => {
    const role = user.role === "USER" ? "AGENT" : user.role;
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    modules: MODULES.map((module) => ({
      key: module,
      name: module.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
      access_levels: ["full", "edit", "delete", "view", "none", "custom"],
    })),
    role_counts: roleCounts,
    users: users.map(formatAgent),
  });
}
