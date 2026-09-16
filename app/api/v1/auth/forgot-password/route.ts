import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
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

    const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return apiError(400, "Valid email is required.");
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({
        status: 200,
        success: true,
        message: "If an account exists with that email, a reset code has been sent.",
      });
    }

    await prisma.passwordResetToken.deleteMany({
      where: { email: user.email },
    });

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        token,
        expires,
      },
    });

    try {
      await sendPasswordResetEmail(user.email, token, user?.name || "User");
    } catch (e) {
      console.error("Failed to send email:", e);
    }

    return NextResponse.json({
      status: 200,
      success: true,
      message: "If an account exists with that email, a reset code has been sent.",
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ status: 500, error: "Internal server error" }, { status: 500 });
  }
}
