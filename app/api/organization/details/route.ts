import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        woocommerceStoreUrl: true,
        woocommerceWebhookSecret: true,
        woocommerceConsumerKey: true,
        woocommerceConsumerSecret: true,
        woocommerceOrderAutomationEnabled: true,
        woocommerceAutomation: true,
        shopifyIntegrationToken: true,
      }
    });

    return NextResponse.json(organization);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
