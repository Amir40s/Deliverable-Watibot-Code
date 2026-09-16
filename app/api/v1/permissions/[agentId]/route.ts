import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { type Prisma } from "@/lib/generated/prisma";
import { asBodyObject, formatAgent, readJsonObject } from "@/lib/api/mobile-route-utils";

const ALLOWED_ACCESS = new Set(["full", "edit", "delete", "view", "none", "custom"]);

function sanitizePermissions(value: unknown) {
  const source = asBodyObject(value) ?? {};
  return Object.entries(source).reduce<Record<string, string>>((acc, [key, access]) => {
    const normalized = String(access);
    if (ALLOWED_ACCESS.has(normalized)) acc[key] = normalized;
    return acc;
  }, {});
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.user.findFirst({
    where: { id: agentId, organizationId: org.id },
  });
  if (!existing) return apiError(404, "Agent not found.");

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const patch = sanitizePermissions(body.permissions ?? body);
  if (!Object.keys(patch).length) return apiError(400, "No valid permissions provided.");

  const current = asBodyObject(existing.permissions) ?? {};
  const permissions = { ...current, ...patch };

  const agent = await prisma.user.update({
    where: { id: agentId },
    data: { permissions: permissions as Prisma.InputJsonValue },
    include: {
      department: true,
      deviceSettings: { orderBy: { lastActiveAt: "desc" }, take: 1 },
      _count: { select: { assignedContacts: true, sentMessages: true } },
    },
  });

  return NextResponse.json({
    status: 200,
    success: true,
    permissions,
    agent: formatAgent(agent),
  });
}
