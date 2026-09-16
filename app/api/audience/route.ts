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

  try {
    const activeChatWhere = {
      organizationId,
      lastMessage: { not: null },
      NOT: { lastMessage: "" },
    };

    // 1. Fetch tags with associated Live Chat contacts
    const tags = await prisma.tag.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: {
        contacts: {
          where: {
            lastMessage: { not: null },
            NOT: { lastMessage: "" },
          },
          orderBy: { lastMessageAt: "desc" },
          select: {
            id: true,
            name: true,
            waId: true,
            profilePic: true,
            lastMessage: true,
            lastMessageAt: true,
            lastInboundMessageAt: true,
            createdAt: true,
            updatedAt: true,
            isBlocked: true,
            isAiBotEnabled: true,
            tags: {
              select: {
                id: true,
                name: true,
                color: true,
                category: true,
              },
            },
          },
        },
      },
    });

    // 2. Fetch untagged Live Chat users (contacts with 0 tags)
    const untaggedContacts = await prisma.contact.findMany({
      where: {
        ...activeChatWhere,
        tags: { none: {} },
      },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        name: true,
        waId: true,
        profilePic: true,
        lastMessage: true,
        lastMessageAt: true,
        lastInboundMessageAt: true,
        createdAt: true,
        updatedAt: true,
        isBlocked: true,
        isAiBotEnabled: true,
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
            category: true,
          },
        },
      },
    });

    // 3. Compute distinct summary metrics for Live Chat Users
    const totalContactsCount = await prisma.contact.count({
      where: activeChatWhere,
    });

    const contactsTagCounts = await prisma.contact.findMany({
      where: activeChatWhere,
      select: {
        id: true,
        _count: {
          select: { tags: true },
        },
      },
    });

    const multipleTagsCount = contactsTagCounts.filter(
      (c) => c._count.tags >= 2
    ).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalContacts: totalContactsCount,
        totalTags: tags.length,
        untaggedContacts: untaggedContacts.length,
        multipleTagsContacts: multipleTagsCount,
      },
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color || "#10B981",
        category: t.category || "General",
        contactCount: t.contacts.length,
        contacts: t.contacts.map(c => ({
          ...c,
          avatar: c.profilePic || null,
        })),
      })),
      untaggedContacts: untaggedContacts.map(c => ({
        ...c,
        avatar: c.profilePic || null,
      })),
    });
  } catch (error: any) {
    console.error("[Audience API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch live chat audience data" },
      { status: 500 }
    );
  }
}
