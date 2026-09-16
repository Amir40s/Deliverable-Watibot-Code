import { NextRequest, NextResponse } from'next/server';
import { prisma } from'@/lib/prisma';
import { generateSecureToken } from'@/lib/auth-utils';
import { sendPasswordResetEmail } from'@/lib/email';
import { z } from'zod';

const forgotPasswordSchema = z.object({
 identifier: z.string().min(3, 'Email or phone number is required'),
});

function normalizePhoneNumber(value: string) {
 return value.replace(/[\s()-]/g, '').replace(/^00/, '+');
}

function isEmail(value: string) {
 return value.includes('@');
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { identifier } = forgotPasswordSchema.parse(body);
 const trimmedIdentifier = identifier.trim();
 const isEmailIdentifier = isEmail(trimmedIdentifier);
 const normalizedPhone = isEmailIdentifier ? '' : normalizePhoneNumber(trimmedIdentifier);

 // Generate 6-digit code early
 const token = Math.floor(100000 + Math.random() * 900000).toString();
 const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

 const user = isEmailIdentifier
 ? await prisma.user.findUnique({ where: { email: trimmedIdentifier.toLowerCase() } })
 : await prisma.user.findFirst({
 where: {
 phoneNumber: {
 in: [
 normalizedPhone,
 trimmedIdentifier,
 trimmedIdentifier.startsWith('+') ? trimmedIdentifier : `+${normalizedPhone.replace(/^\+/, '')}`,
 ]
 },
 },
 });

 // If user doesn't exist, we still want to return a "success" message for security.
 // We do NOT return a devCode here because the token wasn't saved (no user to reset for).
 if (!user) {
 return NextResponse.json({
 message:'If an account exists with that email, a reset code has been sent.',
 });
 }

 // Delete any existing tokens for this email
 await prisma.passwordResetToken.deleteMany({
 where: { email: user.email },
 });

 // Store new token
 await prisma.passwordResetToken.create({
 data: {
 email: user.email,
 token,
 expires,
 },
 });

 const sysConfig = await prisma.systemConfig.findFirst({
   orderBy: { createdAt: 'desc' }
 });

 if (isEmailIdentifier) {
   try {
     await sendPasswordResetEmail(user.email, token, user?.name ||'User');
   } catch (e) {
     console.error('Failed to send email:', e);
   }
 } else {
   if (!user?.phoneNumber) {
     return NextResponse.json({ error: 'Phone number not found for this account' }, { status: 404 });
   }

   if (!sysConfig?.whatsappPasswordResetTemplate) {
     return NextResponse.json({ error: 'WhatsApp password reset template is not configured in Admin > WhatsApp Gateway' }, { status: 400 });
   }

   try {
     const { sendSystemWhatsAppTemplate } = await import('@/lib/whatsapp/system');
     await sendSystemWhatsAppTemplate(
       user.phoneNumber,
       sysConfig.whatsappPasswordResetTemplate,
       [{ type: 'text', text: token }]
     );
   } catch (wsError) {
     console.error('Failed to send WhatsApp password reset token:', wsError);
     return NextResponse.json({ error: 'Failed to send WhatsApp reset code' }, { status: 502 });
   }
 }

 return NextResponse.json({
 message:'If an account exists with that email, a reset code has been sent.',
 identifier: trimmedIdentifier,
 });
 } catch (error: any) {
 if (error instanceof z.ZodError) {
 return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
 }
 console.error('Forgot password error:', error);
 return NextResponse.json({ error:'Internal server error' }, { status: 500 });
 }
}
