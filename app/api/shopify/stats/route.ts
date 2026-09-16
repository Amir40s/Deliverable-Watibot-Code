import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');
    const token = req.headers.get('x-watibot-token');

    if (!shop || !token) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { shopifyIntegrationToken: token },
          ...(token.length >= 30 ? [{ shopifyIntegrationToken: { startsWith: token } }] : [])
        ]
      },
    });
    if (!organization) {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 401 });
    }
    const normalizeShopUrl = (url: string) =>
    url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
    const requestedShop = normalizeShopUrl(shop);
    const connectedShop = organization.shopifyStoreUrl ? normalizeShopUrl(organization.shopifyStoreUrl) : null;
    if (!connectedShop || connectedShop !== requestedShop) {
      return NextResponse.json({ error: 'Shopify store is disconnected' }, { status: 401 });
    }
    const productsCount = await prisma.product.count({
      where: { organizationId: organization.id, platform: 'shopify' }
    });
    const totalOrders = await prisma.shopifyOrder.count({
      where: { organizationId: organization.id }
    });
    const completedOrders = await prisma.shopifyOrder.count({
      where: { organizationId: organization.id, fulfillmentStatus: 'fulfilled' }
    });
    const failedOrders = await prisma.shopifyOrder.count({
      where: { organizationId: organization.id, status: 'cancelled' }
    });
    const totalCustomers = 0;
    const activeOrders = Math.max(0, totalOrders - completedOrders - failedOrders);
    return NextResponse.json({
      stats: {
        orders: totalOrders,
        products: productsCount,
        customers: totalCustomers,
        activeOrders: activeOrders,
        completedOrders: completedOrders,
        failedOrders: failedOrders
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
