import { NextRequest, NextResponse } from'next/server';
import { prisma } from'@/lib/prisma';
import { sendVerificationEmail } from'@/lib/email';

export async function POST(req: NextRequest) {
 try {
  const { email, method } = await req.json();

  if (!email) {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    );
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  if (user.status === 'ACTIVE') {
    return NextResponse.json(
      { error: 'Email already verified' },
      { status: 400 }
    );
  }

  // Delete any existing verification tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Generate new 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  // Store new verification token
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: verificationCode,
      expires: expiresAt,
    },
  });

  const sysConfig = await prisma.systemConfig.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  let emailSent = false;
  let whatsappSent = false;

  const hasWhatsAppGateway = !!(sysConfig?.metaAccessToken && sysConfig?.whatsappPhoneNumberId);

  if (method === 'phone' && user.phoneNumber) {
    if (!hasWhatsAppGateway) {
      return NextResponse.json(
        {
          error: 'WhatsApp Gateway is not configured. Set Meta access token and Phone Number ID in Admin > WhatsApp Gateway before using phone verification.',
        },
        { status: 400 }
      );
    }

    const { sendSystemWhatsAppTemplate } = await import('@/lib/whatsapp/system');

    if (!sysConfig?.whatsappOtpTemplate) {
      return NextResponse.json(
        {
          error: 'No OTP template is configured. Set whatsappOtpTemplate in Admin > WhatsApp Gateway before using phone verification.',
        },
        { status: 400 }
      );
    }

    try {
      const success = await sendSystemWhatsAppTemplate(
        user.phoneNumber,
        sysConfig.whatsappOtpTemplate,
        [{ type: 'text', text: verificationCode }]
      );
      if (success) {
        whatsappSent = true;
      }
    } catch (wsError) {
      console.error('Failed to resend verification WhatsApp OTP template:', wsError);
    }

    if (!whatsappSent) {
      return NextResponse.json(
        {
          error: 'Unable to resend WhatsApp verification template. Please verify your OTP template and gateway settings in Admin > WhatsApp Gateway.',
        },
        { status: 502 }
      );
    }
  }

  // Email verification remains the only email-based path.
  if (method === 'email') {
    emailSent = await sendVerificationEmail(email, verificationCode, user.name || 'User');
  }

  return NextResponse.json(
    {
      message: 'Verification code sent',
      emailSent,
      whatsappSent,
      // Only show code if sending failed (for development)
      code: (!emailSent && !whatsappSent) ? verificationCode : undefined,
    },
    { status: 200 }
  );
 } catch (error: unknown) {
 console.error('Resend verification error:', error);
 return NextResponse.json(
 { error:'An error occurred while resending verification code' },
 { status: 500 }
 );
 }
}
