import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const token = req.headers.get('x-watibot-token');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { products } = await req.json();
    console.log(`[ProductSync] Syncing ${products.length} products for org ${organization.id}`);

    // 1. Delete all existing Shopify products for this organization to ensure a clean sync
    await prisma.product.deleteMany({
      where: { 
        organizationId: organization.id,
        platform: 'shopify'
      }
    });

    // 2. Insert new products
    const syncPromises = products.map((p: any) => {
      const variant = p.variants.edges[0]?.node;
      const image = p.images.edges[0]?.node;

      return prisma.product.create({
        data: {
          organizationId: organization.id,
          shopifyProductId: p.id,
          name: p.title,
          description: p.description,
          price: variant?.price || 0,
          sku: variant?.sku,
          imageUrl: image?.url,
          status: p.status.toLowerCase(),
          platform: 'shopify'
        }
      });
    });

    await Promise.all(syncPromises);

    return NextResponse.json({ success: true, count: products.length });
  } catch (error: any) {
    console.error('[ProductSync] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
