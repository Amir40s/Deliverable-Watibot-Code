import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { crmKey, shopUrl } = await req.json();

    if (!crmKey || !shopUrl) {
      return NextResponse.json({ error: 'CRM Key and Shop URL are required' }, { status: 400 });
    }

    // Find the organization with this CRM Key (either ID or Integration Token)
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: crmKey },
          { shopifyIntegrationToken: crmKey }
        ]
      }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Invalid CRM Key' }, { status: 401 });
    }

    // Generate a webhook secret if not already set
    const webhookSecret = organization.woocommerceWebhookSecret || crypto.randomBytes(32).toString('hex');

    // Link the store URL to this organization
    await prisma.organization.update({
      where: { id: organization.id },
      data: { 
        woocommerceStoreUrl: shopUrl,
        woocommerceWebhookSecret: webhookSecret,
      },
    });

    return NextResponse.json({ 
      success: true, 
      organizationName: organization.name,
      webhookSecret: webhookSecret
    });
  } catch (error: any) {
    console.error('[WooCommerceConnect] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
