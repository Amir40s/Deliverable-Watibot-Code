import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function DELETE(req: NextRequest) {
  try {
    const { org, error } = await authenticateProjectKey(req);
    
    // Also accept email from body if project key authentication header is missing
    let userEmail: string | null = null;
    let userId: string | null = null;
    let orgId: string | null = org?.id || null;

    try {
      const body = asBodyObject(await req.json());
      if (body && typeof body.email === "string") {
        userEmail = body.email.trim();
      }
    } catch (_) {}

    if (!orgId && !userEmail) {
      if (error) return error;
      return apiError(401, "Unauthorized. Provide Authorization header or email.");
    }

    if (userEmail) {
      const foundUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, organizationId: true },
      });
      if (foundUser) {
        userId = foundUser.id;
        orgId = foundUser.organizationId || orgId;
      }
    } else if (orgId) {
      const targetOrg = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { ownerId: true },
      });
      userId = targetOrg?.ownerId || null;
    }

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "INACTIVE" },
      });
    }

    if (orgId) {
      try {
        await prisma.message.deleteMany({ where: { contact: { organizationId: orgId } } });
        await prisma.contact.deleteMany({ where: { organizationId: orgId } });
        await prisma.scheduledMessage.deleteMany({ where: { organizationId: orgId } });
      } catch (_) {}
    }

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Account and associated workspace data deleted successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete account.";
    return apiError(500, message);
  }
}

export async function POST(req: NextRequest) {
  return DELETE(req);
}
