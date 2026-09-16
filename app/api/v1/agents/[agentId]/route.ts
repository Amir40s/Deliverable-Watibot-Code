import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus, type Prisma } from "@/lib/generated/prisma";
import { hashPassword } from "@/lib/auth-utils";
import {
  formatAgent,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

const agentInclude = {
  department: true,
  deviceSettings: { orderBy: { lastActiveAt: "desc" as const }, take: 1 },
  _count: { select: { assignedContacts: true, sentMessages: true } },
};

function normalizeRole(value: unknown): UserRole | undefined {
  if (value === undefined) return undefined;
  const role = String(value || "USER").toUpperCase();
  if (role === "AGENT" || role === "MANAGER") return UserRole.USER;
  if (role === "VIEWER") return UserRole.GUEST;
  return Object.values(UserRole).includes(role as UserRole) ? role as UserRole : UserRole.USER;
}

function normalizeStatus(value: unknown): UserStatus | undefined {
  if (value === undefined) return undefined;
  const status = String(value || "ACTIVE").toUpperCase();
  return Object.values(UserStatus).includes(status as UserStatus) ? status as UserStatus : UserStatus.ACTIVE;
}

async function resolveDepartmentId(orgId: string, departmentId?: string, departmentName?: string) {
  if (departmentId) {
    const department = await prisma.department.findFirst({ where: { id: departmentId, organizationId: orgId } });
    return department?.id ?? null;
  }
  if (departmentName) {
    const department = await prisma.department.findFirst({
      where: { organizationId: orgId, name: { equals: departmentName, mode: "insensitive" } },
    });
    return department?.id ?? null;
  }
  return undefined;
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

  const email = optionalString(body.email)?.trim().toLowerCase();
  if (email && email !== existing.email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict) return apiError(409, "User with this email already exists.");
  }

  const departmentId = await resolveDepartmentId(
    org.id,
    optionalString(body.department_id) || optionalString(body.departmentId),
    optionalString(body.department_name) || optionalString(body.departmentName),
  );
  const role = normalizeRole(body.role);
  const status = normalizeStatus(body.status);
  const password = optionalString(body.password);
  if (password !== undefined && password.length < 8) {
    return apiError(400, "Password must be at least 8 characters long.");
  }

  const agent = await prisma.user.update({
    where: { id: agentId },
    data: {
      ...(body.name !== undefined ? { name: optionalString(body.name)?.trim() || null } : {}),
      ...(email ? { email } : {}),
      ...(body.phone_number !== undefined || body.phoneNumber !== undefined
        ? { phoneNumber: optionalString(body.phone_number) || optionalString(body.phoneNumber) || null }
        : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(departmentId !== undefined ? { departmentId } : {}),
      ...(body.permissions !== undefined ? { permissions: body.permissions as Prisma.InputJsonValue } : {}),
      ...(password ? { password: await hashPassword(password) } : {}),
    },
    include: agentInclude,
  });

  return NextResponse.json({
    status: 200,
    success: true,
    agent: formatAgent(agent),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const existing = await prisma.user.findFirst({
    where: { id: agentId, organizationId: org.id },
    select: { id: true },
  });
  if (!existing) return apiError(404, "Agent not found.");

  await prisma.user.delete({ where: { id: agentId } });

  return NextResponse.json({
    status: 200,
    success: true,
    deleted: true,
    id: agentId,
  });
}
