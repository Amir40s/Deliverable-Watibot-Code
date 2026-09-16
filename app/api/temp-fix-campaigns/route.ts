import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export async function GET(req: Request) {
  try {
    const secret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') !== 'false';
    const orgId = url.searchParams.get('org_id') || undefined;

     const stuckCampaigns = await prisma.scheduledMessage.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        status: { in: ['PENDING', 'PROCESSING', 'FAILED'] },
        scheduledAt: { lte: new Date() },
      },
      include: {
        group: { include: { contacts: true } }
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const results = [];

    for (const campaign of stuckCampaigns) {
      const sentRecords = await prisma.message.findMany({
        where: {
          rawBody: {
            path: ['campaign', 'scheduledMessageId'],
            equals: campaign.id
          }
        },
        select: { contactId: true }
      });

      const sentCount = sentRecords.length;

      if (sentCount > 0) {
        const totalContacts = campaign.group?.contacts?.length ?? 1;
        const result: any = {
          id: campaign.id,
          status: campaign.status,
          scheduledAt: campaign.scheduledAt,
          sentCount,
          totalContacts,
          action: sentCount > 0 ? 'MARK_SENT' : 'SKIP',
        };

        if (!dryRun) {
          await prisma.scheduledMessage.update({
            where: { id: campaign.id },
            data: {
              status: 'SENT',
              lockedAt: null,
              lastError: `Fixed by emergency script: ${sentCount}/${totalContacts} contacts received message.`,
            } as any,
          });
          result.fixed = true;
        }

        results.push(result);
      }
    }

    return NextResponse.json({
      dryRun,
      totalStuckCampaigns: stuckCampaigns.length,
      campaignsWithSentMessages: results.length,
      results,
      message: dryRun
        ? 'DRY RUN - no changes made. Set ?dry_run=false to fix.'
        : `Fixed ${results.length} campaigns that were stuck but already sent.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
