import { NextRequest, NextResponse } from'next/server';
import { prisma } from'@/lib/prisma';
import { hashPassword } from'@/lib/auth-utils';
import { z } from'zod';

// Validation schema
const registerSchema = z.object({
  name: z.string().min(2,'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8,'Password must be at least 8 characters'),
  organizationName: z.string().optional(),
  phoneNumber: z.string().optional(),
  verificationMethod: z.enum(['email', 'phone']).default('email'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Fetch system configuration
    const sysConfig = await prisma.systemConfig.findFirst({
      orderBy: { createdAt:'desc' }
    });

    // Validate input
    const validatedData = registerSchema.parse(body);
    const { name, email, password, organizationName, phoneNumber, verificationMethod } = validatedData;

    if (verificationMethod === 'phone' && !phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for phone/WhatsApp verification' },
        { status: 400 }
      );
    }

 // Check if vendor registration is enabled (if organization name is provided)
 if (organizationName && sysConfig && !sysConfig.enableVendorRegistration) {
 return NextResponse.json(
 { error:'Vendor registration is currently disabled by administrator' },
 { status: 403 }
 );
 }

 // Check for disposable emails if disallowed
 if (sysConfig?.disallowDisposableEmails) {
 const disposableDomains = ['mailinator.com','guerillamail.com','10minutemail.com','temp-mail.org'];
 const emailDomain = email.split('@')[1]?.toLowerCase();
 if (disposableDomains.includes(emailDomain)) {
 return NextResponse.json(
 { error:'Disposable email addresses are not allowed' },
 { status: 400 }
 );
 }
 }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.emailVerified || existingUser.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  const hasWhatsAppGateway = !!(sysConfig?.metaAccessToken && sysConfig?.whatsappPhoneNumberId);

  const orgDisplayName = (organizationName || name || email.split('@')[0] || 'My Company').trim();
  const slugBase = orgDisplayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'company';
  const slug = `${slugBase}-${Date.now()}`;

  // Generate 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  // Create or update Organization and User inside a single transaction
  const { user, organizationId } = await prisma.$transaction(async (tx) => {
    if (existingUser && !existingUser.emailVerified && existingUser.status === 'PENDING') {
      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          password: hashedPassword,
          phoneNumber: phoneNumber || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          createdAt: true,
        },
      });

      if (existingUser.organizationId) {
        await tx.organization.update({
          where: { id: existingUser.organizationId },
          data: { name: orgDisplayName },
        });
      }

      return { user: updatedUser, organizationId: existingUser.organizationId };
    }

    const organization = await tx.organization.create({
      data: {
        name: orgDisplayName,
        slug: slug,
        plan: 'free',
        status: 'active',
        isAiBotEnabled: false,
      },
    });

    const newUser = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phoneNumber: phoneNumber || null,
        role: 'ADMIN',
        status: 'PENDING',
        onboardingCompleted: true,
        onboardingStep: 3,
        organizationId: organization.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        createdAt: true,
      },
    });

    await tx.organization.update({
      where: { id: organization.id },
      data: { ownerId: newUser.id }
    });

    return { user: newUser, organizationId: organization.id };
  });

  const requiresVerification = sysConfig?.vendorEmailActivation ?? true;

  // Removed welcome email from here. It will now be sent after successful verification.

  if (!requiresVerification) {
    return NextResponse.json(
      {
        message: 'User registered successfully',
        user,
        verification: { required: false },
      },
      { status: 201 }
    );
  }

  // Delete any existing verification tokens for this email first
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Store verification token
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
    // Try to send verification email (will log code if credentials not configured)
    const { sendVerificationEmail } = await import('@/lib/email');
    emailSent = await sendVerificationEmail(email, verificationCode, name);
  } else if (verificationMethod === 'phone' && phoneNumber) {
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
        phoneNumber,
        sysConfig.whatsappOtpTemplate,
        [{ type: 'text', text: verificationCode }]
      );
      if (success) {
        whatsappSent = true;
      }
    } catch (wsError) {
      console.error('Failed to send verification WhatsApp OTP template:', wsError);
    }

    if (!whatsappSent) {
      return NextResponse.json(
        {
          error: 'Unable to send WhatsApp verification template. Please verify your OTP template and gateway settings in Admin > WhatsApp Gateway.',
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    {
      message: 'User registered successfully',
      user,
      verification: {
        required: true,
        method: verificationMethod,
        emailSent,
        whatsappSent,
        // Only show code if both failed (for development)
        code: (!emailSent && !whatsappSent) ? verificationCode : undefined,
      },
    },
    { status: 201 }
  );
 } catch (error: unknown) {
 if (error instanceof z.ZodError) {
 return NextResponse.json(
 { error:'Validation error', details: error.issues },
 { status: 400 }
 );
 }

 console.error('Registration error:', error);
 return NextResponse.json(
 { error:'An error occurred during registration' },
 { status: 500 }
 );
 }
}
