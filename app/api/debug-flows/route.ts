
import { NextResponse } from'next/server';
import { prisma } from'@/lib/prisma';
import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';

export async function GET() {
 try {
 if (process.env.NODE_ENV ==='production') {
 return NextResponse.json({ error:'Not found' }, { status: 404 });
 }

 const session = await getServerSession(authOptions);
 if (!session?.user) {
 return NextResponse.json({ error:'Unauthorized' }, { status: 401 });
 }
 if (session.user.role !=='SUPER_ADMIN') {
 return NextResponse.json({ error:'Forbidden' }, { status: 403 });
 }

 const orgs = await prisma.organization.findMany({
 select: {
 id: true,
 name: true,
 whatsappPhoneNumberId: true,
 whatsappBusinessId: true,
 whatsappNumber: true
 }
 });

 const flows = await prisma.flow.findMany({
 where: { isActive: true },
 select: {
 id: true,
 name: true,
 organizationId: true,
 isActive: true,
 trigger: true,
 nodes: true,
 updatedAt: true
 }
 });

 const executions = await prisma.flowExecution.findMany({
 orderBy: { startedAt:'desc' },
 take: 10,
 include: {
 flow: {
 select: { name: true }
 }
 }
 });

 return NextResponse.json({
 organizations: orgs,
 activeFlows: flows,
 recentExecutions: executions,
 timestamp: new Date().toISOString()
 });
 } catch (error: any) {
 return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
