import { NextRequest, NextResponse } from'next/server';
import { prisma } from'@/lib/prisma';
import { hashPassword } from'@/lib/auth-utils';
import { z } from'zod';

const resetPasswordSchema = z.object({
 identifier: z.string().min(3),
 code: z.string().length(6,'Code must be 6 digits'),
 password: z.string().min(8,'Password must be at least 8 characters'),
});

function normalizePhoneNumber(value: string) {
 return value.replace(/[\s()-]/g, '').replace(/^00/, '+');
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { identifier, code, password } = resetPasswordSchema.parse(body);
 const trimmedIdentifier = identifier.trim();
 const isEmailIdentifier = trimmedIdentifier.includes('@');

 const user = isEmailIdentifier
 ? await prisma.user.findUnique({ where: { email: trimmedIdentifier.toLowerCase() } })
 : await prisma.user.findFirst({
	 where: {
		 phoneNumber: {
			 in: [
				 trimmedIdentifier,
				 normalizePhoneNumber(trimmedIdentifier),
				 trimmedIdentifier.startsWith('+') ? trimmedIdentifier : `+${normalizePhoneNumber(trimmedIdentifier).replace(/^\+/, '')}`,
			 ]
		 }
	 }
 });

 if (!user) {
 return NextResponse.json({ error:'Invalid or expired reset code' }, { status: 400 });
 }

 const email = user.email;

 const resetToken = await prisma.passwordResetToken.findFirst({
 where: {
 email,
 token: code,
 used: false,
 expires: { gt: new Date() },
 },
 });

 if (!resetToken) {
 console.log(`❌ Reset attempt failed for ${email}: Invalid or expired code "${code}"`);
 return NextResponse.json(
 { error:'Invalid or expired reset code' },
 { status: 400 }
 );
 }

 const hashedPassword = await hashPassword(password);
 const now = new Date();

 const claimedToken = await prisma.passwordResetToken.updateMany({
 where: {
 id: resetToken.id,
 used: false,
 expires: { gt: now },
 },
 data: {
 used: true,
 },
 });

 if (claimedToken.count !== 1) {
 return NextResponse.json(
 { error:'Invalid or expired reset code' },
 { status: 400 }
 );
 }

 await prisma.user.update({
 where: { email },
 data: { password: hashedPassword },
 });

 return NextResponse.json({
 message:'Password reset successful. You can now log in with your new password.',
 });
 } catch (error: any) {
 if (error instanceof z.ZodError) {
 return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
 }
 console.error('Reset password error:', error);
 return NextResponse.json({ error:'Internal server error' }, { status: 500 });
 }
}
