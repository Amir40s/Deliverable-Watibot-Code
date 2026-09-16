import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    let apiKey = searchParams.get("apiKey") || searchParams.get("token");

    if (!apiKey) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        apiKey = authHeader.substring(7);
      } else {
        apiKey = 
          req.headers.get("X-WatiBot-Project-API-Key") || 
          req.headers.get("X-WatiBot-Campaign-API-Key") ||
          req.headers.get("X-CRM-Token") ||
          "";
      }
    }

    if (!apiKey) {
      return NextResponse.json({ status: 400, error: "API Key (token) is required." }, { status: 400 });
    }

    // Authenticate the organization
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        businessDescription: true,
      },
    });

    const org = organizations.find((o) => {
      try {
        const data = JSON.parse(o.businessDescription || "{}");
        return data.campaignApiKey === apiKey || data.projectApiKey === apiKey;
      } catch {
        return false;
      }
    });

    if (!org) {
      return NextResponse.json({ status: 401, error: "Invalid API Key." }, { status: 401 });
    }

    // Fetch CRM Stats & Details
    const [
      totalContacts,
      recentContacts,
      totalMessages,
      recentMessages,
      totalQuickReplies,
      totalWelcomeMessages,
      totalShopifyOrders,
      totalWooCommerceOrders,
      whatsappContacts,
      instagramContacts,
      facebookContacts,
    ] = await Promise.all([
      prisma.contact.count({ where: { organizationId: org.id } }),
      prisma.contact.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          waId: true,
          name: true,
          platform: true,
          createdAt: true,
          lastMessage: true,
          lastMessageAt: true,
        },
      }),
      prisma.message.count({ where: { contact: { organizationId: org.id } } }),
      prisma.message.findMany({
        where: { contact: { organizationId: org.id } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          direction: true,
          status: true,
          content: true,
          createdAt: true,
          platform: true,
          contact: {
            select: {
              name: true,
              waId: true,
            },
          },
        },
      }),
      prisma.quickReply.count({ where: { organizationId: org.id } }),
      prisma.welcomeMessage.count({ where: { organizationId: org.id } }),
      prisma.shopifyOrder.count({ where: { organizationId: org.id } }),
      prisma.wooCommerceOrder.count({ where: { organizationId: org.id } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "WHATSAPP" } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "INSTAGRAM" } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "FACEBOOK" } }),
    ]);

    return NextResponse.json(
      {
        status: 200,
        success: true,
        tokenScope: apiKey.startsWith("wbck_") ? "Campaign API Key" : "Project API Key",
        organization: {
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          status: org.status,
          createdAt: org.createdAt,
        },
        crmSummary: {
          contacts: {
            total: totalContacts,
            whatsapp: whatsappContacts,
            instagram: instagramContacts,
            facebook: facebookContacts,
          },
          messages: {
            total: totalMessages,
          },
          quickReplies: {
            total: totalQuickReplies,
          },
          welcomeMessages: {
            total: totalWelcomeMessages,
          },
          eCommerce: {
            shopifyOrders: totalShopifyOrders,
            woocommerceOrders: totalWooCommerceOrders,
          },
        },
        recentActivities: {
          contacts: recentContacts,
          messages: recentMessages,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[CRM-Details-API] Error retrieving details:", error);
    return NextResponse.json({ status: 500, error: error.message || "Internal server error." }, { status: 500 });
  }
}
