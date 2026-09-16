import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      shopifyStoreUrl: true,
      shopifyIntegrationToken: true,
      shopifyAccessToken: true
    }
  });

  return NextResponse.json({
    message: "CRM Shopify Integration Diagnostic",
    total_organizations: orgs.length,
    organizations: orgs.map(o => ({
      name: o.name,
      id: o.id,
      token_prefix: o.shopifyIntegrationToken ? o.shopifyIntegrationToken.substring(0, 10) + '...' : 'NONE',
      has_access_token: !!o.shopifyAccessToken,
      store: o.shopifyStoreUrl || 'NONE'
    }))
  });
}
