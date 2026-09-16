import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrganizationPlanExpiryStatus } from '@/lib/subscription';

export async function GET(req: Request) {
  try {
    console.log('[API/Cron] Checking organization subscription plan expiries...');
    const orgs = await prisma.organization.findMany({
      where: {
        status: { not: 'expired' }
      },
      select: { id: true, name: true }
    });

    let expiredCount = 0;
    for (const org of orgs) {
      const expiry = await getOrganizationPlanExpiryStatus(org.id);
      if (expiry?.isExpired) {
        expiredCount++;
        console.log(`[API/Cron] Plan EXPIRED & API suspended for Organization: ${org.name} (${org.id})`);
      }
    }

    console.log(`[API/Cron] Expiry check complete. Checked: ${orgs.length}, Newly Expired: ${expiredCount}`);

    return NextResponse.json({
      success: true,
      summary: {
        checked: orgs.length,
        expiredCount,
      }
    });
  } catch (error) {
    console.error('[API/Cron] Expiry check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error'
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
