import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const requestedUserId =
      req.headers.get("x-watibot-user-id") ||
      req.headers.get("x-user-id") ||
      req.nextUrl.searchParams.get("userId") ||
      req.nextUrl.searchParams.get("user_id");

    let targetUser = null;
    if (requestedUserId) {
      targetUser = await prisma.user.findFirst({
        where: { id: requestedUserId, organizationId: org.id },
        select: { id: true, name: true, email: true, phoneNumber: true, role: true, createdAt: true, image: true, permissions: true }
      });
    }

    if (!targetUser) {
      targetUser = await prisma.user.findFirst({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, phoneNumber: true, role: true, createdAt: true, image: true, permissions: true }
      });
    }

    const userPerms = (targetUser?.permissions as any) || {};
    const is2FAEnabled = Boolean(userPerms.twoFactorEnabled ?? userPerms.two_factor_enabled);

    return NextResponse.json({
      status: 200,
      success: true,
      profile: {
        id: targetUser?.id ?? '',
        name: targetUser?.name ?? '',
        email: targetUser?.email ?? org.businessEmail ?? '',
        phone: targetUser?.phoneNumber ?? org.whatsappNumber ?? '',
        phoneNumber: targetUser?.phoneNumber ?? org.whatsappNumber ?? '',
        companyName: org.name,
        role: targetUser?.role ?? 'ADMIN',
        createdAt: targetUser?.createdAt ? targetUser.createdAt.toISOString() : org.createdAt.toISOString(),
        image: targetUser?.image ?? org.logo ?? '',
        avatar: targetUser?.image ?? org.logo ?? '',
        twoFactorEnabled: is2FAEnabled,
        two_factor_enabled: is2FAEnabled,
        permissions: userPerms,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error?.message || 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const body = await req.json();
    const { name, email, phoneNumber, phone, companyName, organizationName, timezone, image, avatar, profilePic, password, newPassword, new_password, twoFactorEnabled, two_factor_enabled, userId, user_id } = body;

    const requestedUserId =
      req.headers.get("x-watibot-user-id") ||
      req.headers.get("x-user-id") ||
      userId ||
      user_id;

    let targetUser = null;
    if (requestedUserId) {
      targetUser = await prisma.user.findFirst({
        where: { id: requestedUserId, organizationId: org.id },
        select: { id: true, name: true, email: true, phoneNumber: true, role: true, createdAt: true, image: true, permissions: true }
      });
    }

    if (!targetUser) {
      targetUser = await prisma.user.findFirst({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, phoneNumber: true, role: true, createdAt: true, image: true, permissions: true }
      });
    }

    if (!targetUser) {
      return NextResponse.json({ status: 404, error: "User not found" }, { status: 404 });
    }

    const isOrgAdmin = targetUser.role === 'ADMIN' || targetUser.role === 'SUPER_ADMIN' || (targetUser.role as string) === 'OWNER';

    const newPhone = phoneNumber ?? phone;
    const newCompanyName = companyName ?? organizationName;
    const newImage = image ?? avatar ?? profilePic;
    const targetPassword = password ?? newPassword ?? new_password;
    const target2FA = twoFactorEnabled !== undefined ? twoFactorEnabled : two_factor_enabled;

    let hashedPassword: string | undefined = undefined;
    if (targetPassword && typeof targetPassword === 'string' && targetPassword.trim().length > 0) {
      if (targetPassword.trim().length < 6) {
        return NextResponse.json({ status: 400, error: 'Password must be at least 6 characters long' }, { status: 400 });
      }
      hashedPassword = await hashPassword(targetPassword.trim());
    }

    // 1. Update Organization Name only if admin/owner
    if (isOrgAdmin && newCompanyName && newCompanyName.trim().length > 0) {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          name: newCompanyName.trim(),
          ...(timezone ? { timezone: timezone.trim() } : {}),
          ...(newImage !== undefined ? { logo: newImage.trim() } : {})
        }
      });
    }

    // 2. Update Target User Record (their own account)
    const currentPerms = (targetUser.permissions as any) || {};
    const updatedPerms = target2FA !== undefined
      ? { ...currentPerms, twoFactorEnabled: Boolean(target2FA), twoFactorMethod: 'EMAIL' }
      : currentPerms;
    const final2FA = Boolean(updatedPerms.twoFactorEnabled);

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        ...(name && name.trim().length > 0 ? { name: name.trim() } : {}),
        ...(email && email.trim().length > 0 ? { email: email.trim() } : {}),
        ...(newPhone !== undefined ? { phoneNumber: newPhone.trim() } : {}),
        ...(newImage !== undefined ? { image: newImage.trim() } : {}),
        ...(hashedPassword ? { password: hashedPassword } : {}),
        ...(target2FA !== undefined ? { permissions: updatedPerms } : {}),
      },
      select: { id: true, name: true, email: true, phoneNumber: true, role: true, createdAt: true, image: true, permissions: true }
    });

    const updatedOrg = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { name: true, logo: true }
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser?.id ?? '',
        name: updatedUser?.name ?? '',
        email: updatedUser?.email ?? '',
        phone: updatedUser?.phoneNumber ?? '',
        phoneNumber: updatedUser?.phoneNumber ?? '',
        companyName: updatedOrg?.name ?? org.name,
        role: updatedUser?.role ?? 'ADMIN',
        createdAt: updatedUser?.createdAt ? updatedUser.createdAt.toISOString() : org.createdAt.toISOString(),
        image: updatedUser?.image ?? updatedOrg?.logo ?? '',
        avatar: updatedUser?.image ?? updatedOrg?.logo ?? '',
        twoFactorEnabled: final2FA,
        two_factor_enabled: final2FA,
        permissions: updatedPerms,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
