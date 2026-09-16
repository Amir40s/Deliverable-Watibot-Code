import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth-utils";
import { apiError } from "@/lib/api/project-auth";
import { sendTwoFactorEmail } from "@/lib/email";

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(req: NextRequest) {
  try {
    const parsed = asBodyObject(await req.json());
    if (!parsed) return apiError(400, "Invalid JSON body.");
    
    const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    const code = typeof parsed.code === "string" ? parsed.code.trim() : (typeof parsed.twoFactorCode === "string" ? parsed.twoFactorCode.trim() : "");
    const resend = parsed.resend === true || parsed.action === 'resend-2fa';

    if (!email) {
      return apiError(400, "Email is required.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || !user.password) {
      return apiError(401, "Invalid credentials.");
    }

    if (user.status === 'INACTIVE') {
      return apiError(403, "Your account has been deactivated. Please contact support.");
    }

    if (user.status === 'PENDING') {
      return apiError(403, "Your account is pending verification.");
    }

    const userPerms = (user.permissions as any) || {};
    const is2FAEnabled = Boolean(userPerms.twoFactorEnabled ?? userPerms.two_factor_enabled);

    // 1. Resend 2FA Code
    if (resend && is2FAEnabled) {
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const identifier = `2fa:${user.email}`;

      await prisma.verificationToken.deleteMany({ where: { identifier } });
      await prisma.verificationToken.create({
        data: {
          identifier,
          token: newOtp,
          expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        }
      });

      await sendTwoFactorEmail(user.email, newOtp, user.name || 'User');

      return NextResponse.json({
        status: 200,
        success: true,
        requires2FA: true,
        email: user.email,
        message: "A new verification code has been sent to your email."
      });
    }

    // 2. Validate Password (unless verifying with valid OTP code)
    if (!code) {
      if (!password) {
        return apiError(400, "Password is required.");
      }
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return apiError(401, "Invalid credentials.");
      }

      // If 2FA is enabled, trigger OTP and prompt for code
      if (is2FAEnabled) {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const identifier = `2fa:${user.email}`;

        await prisma.verificationToken.deleteMany({ where: { identifier } });
        await prisma.verificationToken.create({
          data: {
            identifier,
            token: otpCode,
            expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          }
        });

        await sendTwoFactorEmail(user.email, otpCode, user.name || 'User');

        return NextResponse.json({
          status: 200,
          success: true,
          requires2FA: true,
          email: user.email,
          message: "Two-factor verification code sent to your email."
        });
      }
    } else {
      // 3. Verifying 2FA Code
      const identifier = `2fa:${user.email}`;
      const validToken = await prisma.verificationToken.findFirst({
        where: {
          identifier,
          token: code,
          expires: { gt: new Date() }
        }
      });

      if (!validToken) {
        return apiError(400, "Invalid or expired verification code. Please check your email or request a new code.");
      }

      // Delete used token
      await prisma.verificationToken.deleteMany({ where: { identifier } });
    }

    // 4. Issue API Key & Log in User
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let projectApiKey = user.organization?.shopifyIntegrationToken || null;

    if (!projectApiKey) {
      projectApiKey = `wbpk_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
      if (user.organizationId) {
        await prisma.organization.update({
          where: { id: user.organizationId },
          data: { shopifyIntegrationToken: projectApiKey },
        });
      } else {
        const sysOrg = await prisma.organization.create({
          data: {
            name: `${user.name || "Admin"}'s Workspace`,
            slug: `workspace-${Date.now()}`,
            plan: "free",
            status: "active",
            shopifyIntegrationToken: projectApiKey,
            ownerId: user.id,
          },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { organizationId: sysOrg.id },
        });
      }
    }

    return NextResponse.json({
      status: 200,
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        organizationId: user.organizationId,
        status: user.status,
        permissions: (user.permissions as any) ?? {},
      },
      projectApiKey: projectApiKey,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to login.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
