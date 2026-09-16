import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { triggerManualAlertCheck, findEligibleSubscriptionAlerts } from '@/lib/automation/subscription-alert-worker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await prisma.subscriptionAlertLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const counts = {
      sent: await prisma.subscriptionAlertLog.count({ where: { status: 'SENT' } }),
      pending: await prisma.subscriptionAlertLog.count({ where: { status: 'PENDING' } }),
      failed: await prisma.subscriptionAlertLog.count({ where: { status: 'FAILED' } }),
    };

    // Also get currently eligible candidates for quick preview
    const candidates = await findEligibleSubscriptionAlerts().catch(() => []);

    return NextResponse.json({
      logs,
      counts,
      candidatesCount: candidates.length,
      candidates: candidates.map(c => ({
        organizationName: c.organizationName,
        recipientPhone: c.recipientPhone,
        alertType: c.alertType,
        daysRemaining: c.daysRemaining,
        endDate: c.endDate,
      }))
    });
  } catch (error: any) {
    console.error('Failed to fetch subscription alert logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'trigger_check';

    if (action === 'trigger_check') {
      const result = await triggerManualAlertCheck();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to execute alert check action:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger alert check' }, { status: 500 });
  }
}
