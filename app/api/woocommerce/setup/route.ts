import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { testWooCommerceConnection, createWooCommerceWebhooks } from '@/lib/woocommerce';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shopName, shopUrl, consumerKey, consumerSecret } = await req.json();

    if (!shopUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Test connection
    try {
      await testWooCommerceConnection(shopUrl, consumerKey, consumerSecret);
    } catch (error: any) {
      return NextResponse.json({ error: `Connection failed: ${error.message}` }, { status: 400 });
    }

    // 2. Generate a webhook secret if not exists
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // 3. Save to database
    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        woocommerceStoreUrl: shopUrl,
        woocommerceConsumerKey: consumerKey,
        woocommerceConsumerSecret: consumerSecret,
        woocommerceWebhookSecret: webhookSecret,
      }
    });

    // 4. Determine base URL (prefer the current request's host to support tunnels)
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const detectedBaseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log(`[WooCommerceSetup] Using Base URL for webhooks: ${detectedBaseUrl}`);

    // 5. Create webhooks automatically
    const webhookResults = await createWooCommerceWebhooks(
      shopUrl,
      consumerKey,
      consumerSecret,
      webhookSecret,
      organization.id,
      detectedBaseUrl
    );

    return NextResponse.json({ 
      success: true, 
      webhookSecret,
      webhookResults 
    });
  } catch (error: any) {
    console.error('[WooCommerceSetup] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
