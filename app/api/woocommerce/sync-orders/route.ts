import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { fetchWooCommerceOrders } from '@/lib/woocommerce';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        woocommerceStoreUrl: true,
        woocommerceConsumerKey: true,
        woocommerceConsumerSecret: true,
      }
    });

    if (!organization?.woocommerceStoreUrl || !organization.woocommerceConsumerKey || !organization.woocommerceConsumerSecret) {
      return NextResponse.json({ error: 'WooCommerce not properly configured' }, { status: 400 });
    }

    // Fetch orders from WooCommerce
    const orders = await fetchWooCommerceOrders(
      organization.woocommerceStoreUrl,
      organization.woocommerceConsumerKey,
      organization.woocommerceConsumerSecret
    );

    console.log(`[WooCommerceOrderSync] Fetched ${orders.length} orders`);

    // Sync orders to database
    let syncedCount = 0;
    for (const order of orders) {
      // Find the phone number (could be in customer or billing)
      const phone = order.billing?.phone || order.customer?.phone || order.shipping?.phone || null;
      const email = order.billing?.email || order.customer?.email || order.shipping?.email || null;

      await prisma.wooCommerceOrder.upsert({
        where: { 
          organizationId_wooOrderId: {
            organizationId: organization.id,
            wooOrderId: order.id.toString()
          }
        },
        update: {
          orderNumber: order.number.toString(),
          totalPrice: order.total.toString(),
          currency: order.currency,
          customerPhone: phone,
          customerEmail: email,
          status: order.status,
          lineItems: order.line_items || null,
          updatedAt: new Date(order.date_modified || order.date_created || Date.now()),
        },
        create: {
          organizationId: organization.id,
          wooOrderId: order.id.toString(),
          orderNumber: order.number.toString(),
          totalPrice: order.total.toString(),
          currency: order.currency,
          customerPhone: phone,
          customerEmail: email,
          status: order.status,
          lineItems: order.line_items || null,
          createdAt: new Date(order.date_created || Date.now()),
          updatedAt: new Date(order.date_modified || order.date_created || Date.now()),
        }
      });
      syncedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      count: syncedCount 
    });
  } catch (error: any) {
    console.error('[WooCommerceOrderSync] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
