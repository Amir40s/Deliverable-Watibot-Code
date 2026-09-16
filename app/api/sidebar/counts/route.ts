import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.user.organizationId;
  const userRole = session.user.role?.toUpperCase() || "";
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "OWNER";

  let canViewAll = isAdmin;
  if (!isAdmin && session.user.id) {
    const userPerms = (session.user.permissions || {}) as Record<string, any>;
    canViewAll = userPerms.chat_super === true ||
      userPerms.view_all_chats === 'full' ||
      userPerms.view_all_chats === 'view';
  }

  const liveChatWhere: any = {
    organizationId,
    unreadCount: { gt: 0 },
  };

  if (!canViewAll && session.user.id) {
    liveChatWhere.OR = [
      { assignedAgentId: session.user.id },
      { assignedUsers: { some: { id: session.user.id } } },
    ];
  }

  try {
    const liveChatUnread = await prisma.contact.aggregate({
      where: liveChatWhere,
      _sum: {
        unreadCount: true,
      },
    }).catch(() => ({ _sum: { unreadCount: 0 } }));

    return NextResponse.json({
      success: true,
      counts: {
        chat: liveChatUnread?._sum?.unreadCount || 0,
        history: 0,
        contacts: 0,
        audience: 0,
        templates: 0,
        mediaLibrary: 0,
        quickReplies: 0,
        quickMessages: 0,
        dripCampaign: 0,
        flows: 0,
        knowledgeBase: 0,
      },
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      }
    });
  } catch (error: any) {
    console.error("[Sidebar Counts API Error]:", error);
    return NextResponse.json({
      success: true,
      counts: {
        chat: 0,
        history: 0,
        contacts: 0,
        audience: 0,
        templates: 0,
        mediaLibrary: 0,
        quickReplies: 0,
        quickMessages: 0,
        dripCampaign: 0,
        flows: 0,
        knowledgeBase: 0,
      }
    });
  }
}
