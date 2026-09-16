import { NextRequest, NextResponse } from'next/server';
import { type Prisma, UserRole } from'@/lib/generated/prisma';
import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';
import { prisma } from'@/lib/prisma';
import { z } from'zod';

const onboardingSchema = z.object({
 step: z.number(),
 completed: z.boolean().optional(),
 data: z.object({
 organizationName: z.string().optional(),
 industry: z.string().optional(),
 companySize: z.string().optional(),
 countryCode: z.string().optional(),
 whatsappNumber: z.string().optional(),
 timezone: z.string().optional(),
 }).optional(),
});

export async function POST(req: NextRequest) {
 try {
 const session = await getServerSession(authOptions);

 if (!session?.user?.id) {
 return NextResponse.json({ error:'Unauthorized' }, { status: 401 });
 }

 const body = await req.json();
 const validatedData = onboardingSchema.parse(body);
 const { step, completed, data } = validatedData;

 // Update user onboarding status; optionally set organizationId + role when creating new org
 let newOrgId: string | undefined;
 let newOrgRole: UserRole | undefined;

 // If organization data is provided (from Step 2 in frontend), process it
 if (data?.organizationName) {
 const user = await prisma.user.findUnique({
 where: { id: session.user.id },
 include: { organization: true },
 });

 if (user?.organization && user.organizationId) {
 // Update existing organization
 const fullWhatsAppNumber = data.countryCode && data.whatsappNumber
 ?`+${data.countryCode}${data.whatsappNumber}`
 : data.whatsappNumber;

 await prisma.organization.update({
 where: { id: user.organizationId },
 data: {
 name: data.organizationName,
 industry: data.industry,
 companySize: data.companySize,
 whatsappNumber: fullWhatsAppNumber,
 timezone: data.timezone,
 },
 });
 } else {
 // Create new organization if it doesn't exist
 const slug = data.organizationName
 .toLowerCase()
 .replace(/[^a-z0-9]+/g,'-')
 .replace(/(^-|-$)/g,'');

 const fullWhatsAppNumber = data.countryCode && data.whatsappNumber
 ?`+${data.countryCode}${data.whatsappNumber}`
 : data.whatsappNumber;

 const org = await prisma.organization.create({
 data: {
 name: data.organizationName,
 slug:`${slug}-${Date.now()}`,
 industry: data.industry,
 companySize: data.companySize,
 whatsappNumber: fullWhatsAppNumber,
 timezone: data.timezone,
 plan:'free',
 status:'active',
 isAiBotEnabled: false,
 },
 });
 newOrgId = org.id;
 newOrgRole = UserRole.ADMIN;
 }
 }

 const userUpdateData: Prisma.UserUncheckedUpdateInput = {
 onboardingStep: step,
 onboardingCompleted: completed ?? false,
 ...(newOrgId != null && newOrgRole != null && { organizationId: newOrgId, role: newOrgRole }),
 };

 if (completed) {
   const currentUser = await prisma.user.findUnique({
     where: { id: session.user.id },
     select: { status: true }
   });
   if (currentUser?.status === 'PENDING') {
     userUpdateData.status = 'ACTIVE';
   }
 }

  // Onboarding updates step and completed status

 // If we have a whatsapp number from the onboarding data, save it to the user's phoneNumber field as well
 const fullWhatsAppNumber = data?.countryCode && data?.whatsappNumber
 ?`+${data.countryCode}${data.whatsappNumber}`
 : data?.whatsappNumber;

 if (fullWhatsAppNumber) {
 userUpdateData.phoneNumber = fullWhatsAppNumber;
 }

 const updatedUser = await prisma.user.update({
 where: { id: session.user.id },
 data: userUpdateData,
 });

 console.log(`[Onboarding API Response] userId: ${updatedUser.id}, onboardingCompleted from DB: ${updatedUser.onboardingCompleted}, onboardingStep: ${updatedUser.onboardingStep}, status: ${updatedUser.status}`);

 return NextResponse.json({
 message:'Onboarding progress updated',
 user: {
 id: updatedUser.id,
 onboardingStep: updatedUser.onboardingStep,
 onboardingCompleted: updatedUser.onboardingCompleted,
 status: updatedUser.status,
 }
 });
 } catch (error: unknown) {
 if (error instanceof z.ZodError) {
 return NextResponse.json({ error:'Validation error', details: error.issues }, { status: 400 });
 }
 console.error('Onboarding API error:', {
 message: error instanceof Error ? error.message : String(error),
 stack: error instanceof Error ? error.stack : undefined,
 code: error && typeof error ==='object' &&'code' in error ? (error as { code?: string }).code : undefined,
 meta: error && typeof error ==='object' &&'meta' in error ? (error as { meta?: unknown }).meta : undefined
 });
 return NextResponse.json({ error:'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
 }
}
