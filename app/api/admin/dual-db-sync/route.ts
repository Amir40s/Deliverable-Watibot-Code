import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, getSecondaryPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secondary = getSecondaryPrisma();

    // 1. Neon DB (Primary) Data & Total Counts
    const [
      neonDevices,
      neonWelcomeMsgs,
      neonMessages,
      neonUsers,
      totalNeonMessages,
      totalNeonContacts,
      totalNeonUsers,
      totalNeonOrgs,
    ] = await Promise.all([
      prisma.deviceSetting.findMany({ orderBy: { lastActiveAt: 'desc' }, take: 15 }),
      prisma.welcomeMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
      prisma.message.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.message.count(),
      prisma.contact.count(),
      prisma.user.count(),
      prisma.organization.count(),
    ]);

    // 2. Contabo DB (Secondary) Data & Total Counts
    let contaboDevices: any[] = [];
    let contaboWelcomeMsgs: any[] = [];
    let contaboMessages: any[] = [];
    let contaboUsers: any[] = [];
    let totalContaboMessages = 0;
    let totalContaboContacts = 0;
    let totalContaboUsers = 0;
    let totalContaboOrgs = 0;
    let secondaryStatus = "disconnected";

    if (secondary) {
      try {
        [
          contaboDevices,
          contaboWelcomeMsgs,
          contaboMessages,
          contaboUsers,
          totalContaboMessages,
          totalContaboContacts,
          totalContaboUsers,
          totalContaboOrgs,
        ] = await Promise.all([
          (secondary as any).deviceSetting.findMany({ orderBy: { lastActiveAt: 'desc' }, take: 15 }),
          (secondary as any).welcomeMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
          (secondary as any).message.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
          (secondary as any).user.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
          (secondary as any).message.count(),
          (secondary as any).contact.count(),
          (secondary as any).user.count(),
          (secondary as any).organization.count(),
        ]);
        secondaryStatus = "connected";
      } catch (err: any) {
        console.error("Error querying secondary DB:", err);
        secondaryStatus = `error: ${err.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dualWriteEnabled: process.env.DUAL_DB_WRITE === 'true' || process.env.DUAL_DB_WRITE === '1',
      secondaryStatus,
      neon: {
        devices: neonDevices,
        welcomeMessages: neonWelcomeMsgs,
        messages: neonMessages,
        users: neonUsers,
        totalMessages: totalNeonMessages,
        totalContacts: totalNeonContacts,
        totalUsers: totalNeonUsers,
        totalOrgs: totalNeonOrgs,
      },
      contabo: {
        devices: contaboDevices,
        welcomeMessages: contaboWelcomeMsgs,
        messages: contaboMessages,
        users: contaboUsers,
        totalMessages: totalContaboMessages,
        totalContacts: totalContaboContacts,
        totalUsers: totalContaboUsers,
        totalOrgs: totalContaboOrgs,
      }
    });
  } catch (error: any) {
    console.error("Dual DB Sync API error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secondary = getSecondaryPrisma();
  if (!secondary) {
    return NextResponse.json({ error: "Secondary database (Contabo) is not configured" }, { status: 400 });
  }

  try {
    // 1. Fetch recent messages from Neon (up to 500 recent messages) to check for missing items
    const neonMessages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const neonMessageIds = neonMessages.map(m => m.id);

    // 2. Query Contabo to see which IDs exist
    const contaboMessages = await (secondary as any).message.findMany({
      where: { id: { in: neonMessageIds } },
      select: { id: true },
    });

    const contaboSet = new Set(contaboMessages.map((m: any) => m.id));
    const missingMessages = neonMessages.filter(m => !contaboSet.has(m.id));

    let syncedCount = 0;
    const errors: string[] = [];

    // 3. For each missing message, ensure dependencies exist on Contabo and upsert message
    for (const msg of missingMessages) {
      try {
        if (msg.contactId) {
          const contact = await prisma.contact.findUnique({ where: { id: msg.contactId } });
          if (contact) {
            if (contact.organizationId) {
              const org = await prisma.organization.findUnique({ where: { id: contact.organizationId } });
              if (org) {
                await (secondary as any).organization.upsert({
                  where: { id: org.id },
                  update: org,
                  create: org,
                });
              }
            }
            if (contact.organizationId && contact.platform && contact.waId) {
              await (secondary as any).contact.upsert({
                where: {
                  organizationId_platform_waId: {
                    organizationId: contact.organizationId,
                    platform: contact.platform,
                    waId: contact.waId,
                  }
                },
                update: { ...contact, id: contact.id },
                create: contact,
              });
            } else {
              await (secondary as any).contact.upsert({
                where: { id: contact.id },
                update: contact,
                create: contact,
              });
            }
          }
        }

        if (msg.senderId) {
          const user = await prisma.user.findUnique({ where: { id: msg.senderId } });
          if (user) {
            await (secondary as any).user.upsert({
              where: { id: user.id },
              update: user,
              create: user,
            });
          }
        }

        let payload = { ...msg };
        if (msg.replyToId) {
          const replyExists = await (secondary as any).message.findUnique({ where: { id: msg.replyToId } });
          if (!replyExists) {
            payload.replyToId = null;
          }
        }

        if (msg.wamid) {
          await (secondary as any).message.upsert({
            where: { wamid: msg.wamid },
            update: { ...payload, id: msg.id },
            create: payload,
          });
        } else {
          await (secondary as any).message.upsert({
            where: { id: msg.id },
            update: payload,
            create: payload,
          });
        }

        syncedCount++;
      } catch (err: any) {
        console.error(`Failed to sync message ${msg.id} to Contabo:`, err);
        errors.push(`Msg ${msg.id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalChecked: neonMessages.length,
      missingFound: missingMessages.length,
      syncedCount,
      errors,
    });
  } catch (err: any) {
    console.error("POST Dual DB Sync error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

