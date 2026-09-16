import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log('Incoming Shopify connection request...');
  try {
    const body = await req.json();
    const { token, shop, accessToken } = body;
    
    console.log('>>> [Connect] RAW BODY RECEIVED:', JSON.stringify(body, null, 2));
    console.log(`>>> [Connect] Extracted -> Token: ${token?.substring(0, 10)}, Shop: ${shop}, AT: ${accessToken ? 'PRESENT' : 'MISSING'}`);

    if (!token || !shop) {
      return NextResponse.json({ error: 'Token and shop are required' }, { status: 400 });
    }

    // Find the organization with this token (exact or prefix match)
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { shopifyIntegrationToken: token },
          ...(token.length >= 30 ? [{ shopifyIntegrationToken: { startsWith: token } }] : [])
        ]
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Invalid integration token' }, { status: 401 });
    }

    // If there was an old store linked, wipe its data to avoid mixing
    if (organization.shopifyStoreUrl && organization.shopifyStoreUrl !== shop) {
      console.log(`>>> [Connect] Different store detected (${organization.shopifyStoreUrl} -> ${shop}). Wiping old data...`);
      
      // 1. Delete old Shopify Orders
      await prisma.shopifyOrder.deleteMany({
        where: { organizationId: organization.id }
      });

      // 2. Delete old Shopify Products
      await prisma.product.deleteMany({
        where: { 
          organizationId: organization.id,
          platform: 'shopify'
        }
      });
    }

    console.log(`>>> [Connect] RECEIVED IN CRM: Shop=${shop}, Token=${token.substring(0, 10)}...`);
    console.log(`>>> [Connect] ACCESS TOKEN RECEIVED: ${accessToken ? 'YES' : 'NO'}`);

    // Link the store URL and Token to this organization
    try {
      console.log(`>>> [Connect] UPDATING ORG: ${organization.name} (ID: ${organization.id})`);
      
      const updatedOrg = await prisma.organization.update({
        where: { id: organization.id },
        data: { 
          shopifyStoreUrl: shop,
          shopifyAccessToken: accessToken,
          shopifyOrderAutomationEnabled: false
        },
      });
      
      console.log(`>>> [Connect] DB UPDATE SUCCESSFUL for ${updatedOrg.name}. Token is now: ${updatedOrg.shopifyAccessToken ? 'SAVED' : 'NOT SAVED'}`);
    } catch (dbError: any) {
      console.error(`>>> [Connect] DB UPDATE FAILED:`, dbError.message);
      return NextResponse.json({ error: 'Database save failed: ' + dbError.message }, { status: 500 });
    }
    console.log(`>>> [Connect] Starting initial sync...`);
      console.log(`>>> [Connect] Skipping direct Shopify sync and webhook registration. These are now handled by the Shopify App itself to avoid API token errors.`);

    return NextResponse.json({ 
      success: true, 
      organizationName: organization.name 
    });
  } catch (error: any) {
    console.error('Shopify connection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
