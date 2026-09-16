import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { fetchWooCommerceProducts } from '@/lib/woocommerce';
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

    // Fetch products from WooCommerce
    const products = await fetchWooCommerceProducts(
      organization.woocommerceStoreUrl,
      organization.woocommerceConsumerKey,
      organization.woocommerceConsumerSecret
    );

    console.log(`[WooCommerceSync] Fetched ${products.length} products`);

    const extractFirstImage = (html: string) => {
      if (!html) return null;
      // More robust regex for src attribute
      const match = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
      return match ? match[1] : null;
    };

    // Sync products to database
    let syncedCount = 0;
    for (const product of products) {
      const fallbackFromDesc = extractFirstImage(product.description || '');
      const fallbackFromShortDesc = extractFirstImage(product.short_description || '');
      const imageUrl = product.images?.[0]?.src || fallbackFromDesc || fallbackFromShortDesc;

      console.log(`[WooCommerceSync] Syncing product: ${product.name}`);
      console.log(` - Official Image: ${product.images?.[0]?.src || 'none'}`);
      console.log(` - Fallback (Desc): ${fallbackFromDesc || 'none'}`);
      console.log(` - Fallback (Short): ${fallbackFromShortDesc || 'none'}`);
      console.log(` - Final Image URL: ${imageUrl || 'none'}`);

      await prisma.product.upsert({
        where: { 
          organizationId_shopifyProductId: {
            organizationId: organization.id,
            shopifyProductId: product.id.toString()
          }
        },
        update: {
          name: product.name,
          description: product.description,
          price: parseFloat(product.price) || 0,
          currency: 'USD',
          imageUrl: imageUrl,
          sku: product.sku || null,
          status: product.status === 'publish' ? 'active' : 'inactive',
          platform: 'woocommerce',
        },
        create: {
          organizationId: organization.id,
          shopifyProductId: product.id.toString(),
          name: product.name,
          description: product.description,
          price: parseFloat(product.price) || 0,
          currency: 'USD',
          imageUrl: imageUrl,
          sku: product.sku || null,
          status: product.status === 'publish' ? 'active' : 'inactive',
          platform: 'woocommerce',
        }
      });
      syncedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      count: syncedCount 
    });
  } catch (error: any) {
    console.error('[WooCommerceSync] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
