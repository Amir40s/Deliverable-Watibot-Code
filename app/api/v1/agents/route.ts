import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus, type Prisma } from "@/lib/generated/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { clampLimit } from "@/lib/api/mobile-formatters";
import {
  formatAgent,
  formatDepartment,
  optionalString,
  readJsonObject,
} from "@/lib/api/mobile-route-utils";

const agentInclude = {
  department: true,
  deviceSettings: { orderBy: { lastActiveAt: "desc" as const }, take: 1 },
  _count: { select: { assignedContacts: true, sentMessages: true } },
};

function normalizeRole(value: unknown): UserRole {
  const role = String(value || "USER").toUpperCase();
  if (role === "AGENT" || role === "MANAGER") return UserRole.USER;
  if (role === "VIEWER") return UserRole.GUEST;
  return Object.values(UserRole).includes(role as UserRole) ? role as UserRole : UserRole.USER;
}

function normalizeStatus(value: unknown): UserStatus {
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
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const sp = req.nextUrl.searchParams;
  const limit = clampLimit(sp.get("limit"), 50, 100);
  const search = (sp.get("search") || sp.get("q") || "").trim();
  const status = (sp.get("status") || "").trim().toUpperCase();
  const role = (sp.get("role") || "").trim().toUpperCase();
  const departmentId = sp.get("department_id");

  const where: Prisma.UserWhereInput = {
    organizationId: org.id,
    role: { not: UserRole.SUPER_ADMIN },
    ...(status ? { status: normalizeStatus(status) } : {}),
    ...(role ? { role: normalizeRole(role) } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [agents, total, departments] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: agentInclude,
    }),
    prisma.user.count({ where }),
    prisma.department.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    }),
  ]);

  return NextResponse.json({
    status: 200,
    success: true,
    project_id: org.id,
    total,
    agents: agents.map(formatAgent),
    departments: departments.map(formatDepartment),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const { body, error } = await readJsonObject(req);
  if (error) return error;
  if (!body) return apiError(400, "Invalid JSON body.");

  const name = optionalString(body.name)?.trim();
  const email = optionalString(body.email)?.trim().toLowerCase();
  const password = optionalString(body.password);
  if (!name) return apiError(400, "Field 'name' is required.");
  if (!email) return apiError(400, "Field 'email' is required.");
  if (!password) return apiError(400, "Field 'password' is required.");
  if (password.length < 8) return apiError(400, "Password must be at least 8 characters long.");

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return apiError(409, "User with this email already exists.");

  const departmentId = await resolveDepartmentId(
    org.id,
    optionalString(body.department_id) || optionalString(body.departmentId),
    optionalString(body.department_name) || optionalString(body.departmentName),
  );

  const agent = await prisma.user.create({
    data: {
      name,
      email,
      password: await hashPassword(password),
      phoneNumber: optionalString(body.phone_number) || optionalString(body.phoneNumber),
      role: normalizeRole(body.role),
      status: normalizeStatus(body.status),
      organizationId: org.id,
      departmentId,
      permissions: (body.permissions ?? {}) as Prisma.InputJsonValue,
      onboardingCompleted: true,
    },
    include: agentInclude,
  });

  return NextResponse.json({
    status: 201,
    success: true,
    agent: formatAgent(agent),
  }, { status: 201 });
}
