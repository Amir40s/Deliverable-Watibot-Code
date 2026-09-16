import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { apiError } from "@/lib/api/project-auth";

function asBodyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(req: NextRequest) {
  try {
    const parsed = asBodyObject(await req.json());
    if (!parsed) return apiError(400, "Invalid JSON body.");

    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    const organizationName = typeof parsed.organizationName === "string" ? parsed.organizationName.trim() : "";
    const phoneNumber = typeof parsed.phoneNumber === "string" ? parsed.phoneNumber.trim() : "";
    const verificationMethod = typeof parsed.verificationMethod === "string" ? parsed.verificationMethod : "email";

    if (!name || name.length < 2) return apiError(400, "Name must be at least 2 characters.");
    if (!email || !email.includes("@")) return apiError(400, "Invalid email address.");
    if (!password || password.length < 8) return apiError(400, "Password must be at least 8 characters.");

    const sysConfig = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (verificationMethod === 'phone' && !phoneNumber) {
      return apiError(400, "Phone number is required for WhatsApp verification.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError(400, "User with this email already exists.");
    }

    const hashedPassword = await hashPassword(password);

    let organizationId: string | undefined;
    let projectApiKey: string | null = null;

    if (organizationName) {
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      projectApiKey = `wbpk_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          slug: `${slug}-${Date.now()}`,
          plan: "free",
          status: "active",
          isAiBotEnabled: false,
          shopifyIntegrationToken: projectApiKey, // Generating a new project key
        },
      });
      organizationId = organization.id;
    }

    // Determine verification requirement
    const requiresVerification = true; // Forcing true as requested for OTP flow

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phoneNumber: phoneNumber || null,
        role: organizationId ? "ADMIN" : "USER",
        status: "PENDING",
        organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        status: true,
      },
    });

    if (!requiresVerification) {
      return NextResponse.json({
        status: 201,
        success: true,
        message: "User registered successfully",
        user,
        projectApiKey: projectApiKey,
        requiresVerification: false,
      }, { status: 201 });
    }

    // Generate Verification Token
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationCode,
        expires: expiresAt,
      },
    });

    let emailSent = false;
    let whatsappSent = false;

    if (verificationMethod === 'email') {
      const { sendVerificationEmail } = await import('@/lib/email');
      emailSent = await sendVerificationEmail(email, verificationCode, name);
    } else if (verificationMethod === 'phone' && phoneNumber) {
      const { sendSystemWhatsAppTemplate } = await import('@/lib/whatsapp/system');
      if (sysConfig?.whatsappOtpTemplate) {
        try {
          const success = await sendSystemWhatsAppTemplate(
            phoneNumber,
            sysConfig.whatsappOtpTemplate,
            [{ type: 'text', text: verificationCode }]
          );
          if (success) whatsappSent = true;
        } catch (wsError) {
          console.error('Failed to send verification WhatsApp OTP:', wsError);
        }
      }
    }

    return NextResponse.json({
      status: 201,
      success: true,
      message: "User registered successfully",
      user,
      projectApiKey: projectApiKey, // They won't be able to do much if PENDING, but good to return
      requiresVerification: true,
      verificationMethod: verificationMethod,
      emailSent,
      whatsappSent,
    }, { status: 201 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
