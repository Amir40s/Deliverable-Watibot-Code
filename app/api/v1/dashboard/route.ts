import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { formatMobileContact, formatMobileMessage } from "@/lib/api/mobile-formatters";

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const requestedUserId =
      req.headers.get("x-watibot-user-id") ||
      req.headers.get("x-user-id") ||
      req.nextUrl.searchParams.get("userId") ||
      req.nextUrl.searchParams.get("user_id");

    let currentUser = null;
    if (requestedUserId) {
      currentUser = await prisma.user.findFirst({
        where: { id: requestedUserId, organizationId: org.id },
        select: { id: true, name: true, email: true, phoneNumber: true, createdAt: true, role: true, image: true, permissions: true }
      });
    }

    if (!currentUser) {
      currentUser = await prisma.user.findFirst({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, phoneNumber: true, createdAt: true, role: true, image: true, permissions: true }
      });
    }

    const isAdminOrOwner = Boolean(
      currentUser &&
      (currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN" || currentUser.id === org.ownerId)
    );
    const isAgent = Boolean(currentUser && !isAdminOrOwner);

    const agentContactFilter = isAgent && currentUser
      ? {
          OR: [
            { assignedAgentId: currentUser.id },
            { assignedUsers: { some: { id: currentUser.id } } },
          ],
        }
      : {};

    const [
      totalContacts,
      activeContacts,
      whatsappContacts,
      instagramContacts,
      facebookContacts,
      tiktokContacts,
      liveChats,
      unreadChats,
      totalMessages,
      inboundMessages,
      outboundMessages,
      campaignsSent,
      activeFlows,
      totalFlows,
      quickReplies,
      welcomeMessages,
      tags,
      recentContacts,
      recentMessages,
      metaQuotaUsed,
    ] = await Promise.all([
      prisma.contact.count({ where: { organizationId: org.id, ...agentContactFilter } }),
      prisma.contact.count({ where: { organizationId: org.id, ...agentContactFilter } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "WHATSAPP", ...agentContactFilter } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "INSTAGRAM", ...agentContactFilter } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "FACEBOOK", ...agentContactFilter } }),
      prisma.contact.count({ where: { organizationId: org.id, platform: "TIKTOK", ...agentContactFilter } }),
      prisma.contact.count({
        where: {
          organizationId: org.id,
          messages: { some: { type: { notIn: ["comment", "comment_reply"] } } },
          ...agentContactFilter,
        },
      }),
      prisma.contact.count({
        where: {
          organizationId: org.id,
          unreadCount: { gt: 0 },
          ...agentContactFilter,
        },
      }),
      prisma.message.count({ where: { contact: { organizationId: org.id, ...agentContactFilter } } }),
      prisma.message.count({ where: { contact: { organizationId: org.id, ...agentContactFilter }, direction: "inbound" } }),
      prisma.message.count({ where: { contact: { organizationId: org.id, ...agentContactFilter }, direction: "outbound" } }),
      isAgent ? 0 : prisma.scheduledMessage.count({ where: { organizationId: org.id, type: "DRIP" } }),
      isAgent ? 0 : prisma.flow.count({ where: { organizationId: org.id, isActive: true } }),
      isAgent ? 0 : prisma.flow.count({ where: { organizationId: org.id } }),
      isAgent ? 0 : prisma.quickReply.count({ where: { organizationId: org.id } }),
      isAgent ? 0 : prisma.welcomeMessage.count({ where: { organizationId: org.id, isActive: true } }),
      isAgent ? 0 : prisma.tag.count({ where: { organizationId: org.id } }),
      prisma.contact.findMany({
        where: { organizationId: org.id, ...agentContactFilter },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
        include: {
          tags: true,
          groups: { include: { group: true } },
          assignedUsers: { select: { id: true, name: true, email: true } },
          aiAgent: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.message.findMany({
        where: { contact: { organizationId: org.id, ...agentContactFilter } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          contact: { select: { id: true, name: true, waId: true, platform: true } },
          sender: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.message.count({
        where: {
          contact: { organizationId: org.id, ...agentContactFilter },
          direction: "outbound",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const fullOrg = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { whatsapp_onboarding_raw_data: true, vendorConfig: true }
    });

    const vendorCfg = (fullOrg?.vendorConfig || org.vendorConfig) as Record<string, unknown> | null;
    const rawData = fullOrg?.whatsapp_onboarding_raw_data as Record<string, unknown> | null;
    const metaLimitTier = (
      typeof rawData?.messaging_limit_tier === 'string' ? rawData.messaging_limit_tier :
      typeof rawData?.metaQuotaLimit === 'string' ? rawData.metaQuotaLimit :
      typeof vendorCfg?.metaQuotaLimit === 'string' ? vendorCfg.metaQuotaLimit : "TIER_250"
    );

    const phoneInfo = (rawData?.phone_info || rawData?.phone) as Record<string, unknown> | null;
    let liveQuality = typeof phoneInfo?.quality_rating === 'string' ? phoneInfo.quality_rating : null;

    if (org.whatsappPhoneNumberId && org.metaAccessToken) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${org.whatsappPhoneNumberId}?fields=quality_rating&access_token=${org.metaAccessToken}`,
          { cache: 'no-store' }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.quality_rating) {
            liveQuality = data.quality_rating;
          }
        }
      } catch (e) {
        // Fallback to liveQuality from stored raw data
      }
    }

    const isQr = Boolean(
      (org as any).whatsappConnectionMethod === "qr" ||
      org.whatsappPhoneNumberId?.startsWith("qr_")
    );
    const isWhatsAppConnected = isQr
      ? Boolean(org.whatsappNumber)
      : Boolean(org.metaAccessToken && org.whatsappPhoneNumberId);

    const resolvedQualityRating = isQr ? "QR_LINKED" : (liveQuality || "GREEN");

    return NextResponse.json({
      status: 200,
      success: true,
      project: {
        id: org.id,
        name: (org as any).whatsappBusinessName ?? org.name,
        display_name: (org as any).whatsappBusinessName ?? org.name,
        company_name: org.name,
        email: org.businessEmail ?? currentUser?.email ?? null,
        slug: org.slug,
        plan: org.plan,
        timezone: (org as any).timezone ?? "UTC",
        logo: org.logo ?? (org as any).businessLogo ?? null,
        whatsapp_connected: isWhatsAppConnected,
        whatsapp_connection_method: isQr ? "qr" : "manual",
        connection_method: isQr ? "qr" : "manual",
        whatsapp_number: org.whatsappNumber ?? null,
        whatsapp_business_name: (org as any).whatsappBusinessName ?? org.name,
        whatsapp_phone_number_id: org.whatsappPhoneNumberId ?? null,
        whatsapp_business_id: org.whatsappBusinessId ?? null,
        phone_id: org.whatsappPhoneNumberId ?? null,
        waba_id: org.whatsappBusinessId ?? null,
        category: (org as any).businessVertical ?? org.industry ?? "OTHER",
        business_vertical: (org as any).businessVertical ?? org.industry ?? "OTHER",
        business_address: org.businessAddress ?? null,
        business_description: org.businessDescription ?? null,
        quality_rating: resolvedQualityRating,
        qualityRating: resolvedQualityRating,
        meta_quota_limit: metaLimitTier,
        meta_quota_used: metaQuotaUsed,
        user_name: currentUser?.name ?? null,
        user_email: currentUser?.email ?? null,
        user_phone: currentUser?.phoneNumber ?? null,
        user_role: currentUser?.role ?? null,
        user_created_at: currentUser?.createdAt ? currentUser.createdAt.toISOString() : null,
        user_avatar: currentUser?.image ?? org.logo ?? null,
        user_permissions: (currentUser?.permissions as any) ?? {},
      },
      dashboard: {
        metrics: {
          contacts: totalContacts,
          active_contacts: activeContacts,
          live_chats: liveChats,
          unread_chats: unreadChats,
          messages: totalMessages,
          inbound_messages: inboundMessages,
          outbound_messages: outboundMessages,
          meta_quota_used: metaQuotaUsed,
          meta_quota_limit: metaLimitTier,
          campaigns_sent: campaignsSent,
          active_flows: activeFlows,
          total_flows: totalFlows,
          quick_replies: quickReplies,
          active_welcome_messages: welcomeMessages,
          audience_segments: tags,
        },
        channels: {
          whatsapp: whatsappContacts,
          instagram: instagramContacts,
          facebook: facebookContacts,
          tiktok: tiktokContacts,
        },
        recent_conversations: recentContacts.map((contact) => formatMobileContact(contact, org.id)),
        recent_messages: recentMessages.map(formatMobileMessage),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard data.";
    return NextResponse.json({ status: 500, error: message }, { status: 500 });
  }
}
