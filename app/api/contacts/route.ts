import { NextResponse } from'next/server';
import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';
import prisma from'@/lib/prisma';

export async function PUT(request: Request) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) return new NextResponse('Unauthorized', { status: 401 });

 try {
 const body = await request.json();
 const { id, tagIds } = body;

 if (!id) {
 return new NextResponse('Contact ID is required', { status: 400 });
 }

 // We already have a server action that does this safely with org checking
 await updateContact(id, { tagIds });

 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('API Error updating contact:', error);
 return new NextResponse((error as Error).message ||'Internal Server Error', { status: 500 });
 }
}
