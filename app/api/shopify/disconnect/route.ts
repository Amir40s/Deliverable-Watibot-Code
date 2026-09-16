import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { NextResponse } from 'next/server';

type ShopifyDisconnectPayload = {
  shop?: string;
  token?: string;
};

export async function POST(req: Request) {
  try {
    const { shop, token } = (await req.json()) as ShopifyDisconnectPayload;
    const rawShop = typeof shop === 'string' ? shop.trim() : '';
    const rawToken = typeof token === 'string' ? token.trim() : '';

    if (!rawShop && !rawToken) {
      return NextResponse.json({ error: 'Shop or token is required' }, { status: 400 });
    }

    console.log(`>>> CRM Disconnecting shop: ${rawShop || 'token-only'}${rawToken ? ' with token' : ''}`);

    const normalizeShopUrl = (url: string) =>
      url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/g, '');

    const normalizedShop = rawShop ? normalizeShopUrl(rawShop) : '';
    const shopMatches = rawShop
      ? Array.from(new Set([rawShop, normalizedShop, `https://${normalizedShop}`].filter(Boolean)))
      : [];

    const whereClause: Prisma.OrganizationWhereInput = {
      OR: [
        ...shopMatches.map((shopifyStoreUrl) => ({ shopifyStoreUrl })),
        ...(rawToken ? [{ shopifyIntegrationToken: rawToken }] : [])
      ],
    };

    // Find the organizations first so we can delete their related data
    const organizations = await prisma.organization.findMany({
      where: whereClause,
      select: { id: true }
    });

    const orgIds = organizations.map(org => org.id);

    if (orgIds.length > 0) {
      // 1. Delete Shopify Orders
      await prisma.shopifyOrder.deleteMany({
        where: { organizationId: { in: orgIds } }
      });

      // 2. Delete Shopify Products
      await prisma.product.deleteMany({
        where: { 
          organizationId: { in: orgIds },
          platform: 'shopify'
        }
      });

      // 3. Clear integration fields
      await prisma.organization.updateMany({
        where: { id: { in: orgIds } },
        data: { 
          shopifyStoreUrl: null,
          shopifyAccessToken: null,
          shopifyIntegrationToken: null,
          shopifyOrderAutomationEnabled: false,
          shopifyOrderTemplate: "order_confirmation",
          shopifyOrderTemplateLanguage: "en_US"
        },
      });
    }

    console.log(`>>> CRM Disconnect result: ${orgIds.length} organizations cleared and data wiped`);

    return NextResponse.json({ 
      success: true, 
      message: 'Disconnected from Shopify and data wiped successfully',
      count: orgIds.length
    });
  } catch (error) {
    console.error('CRM disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
