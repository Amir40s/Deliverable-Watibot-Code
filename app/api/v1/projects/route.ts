import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatProject } from "@/lib/api/mobile-route-utils";

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const currentProject = await prisma.organization.findUnique({
    where: { id: org.id },
    select: { ownerId: true },
  });

  const projects = await prisma.organization.findMany({
    where: currentProject?.ownerId ? { ownerId: currentProject.ownerId } : { id: org.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    active_project_id: org.id,
    total: projects.length,
    projects: projects.map((project) => formatProject(project, org.id)),
  });
}
