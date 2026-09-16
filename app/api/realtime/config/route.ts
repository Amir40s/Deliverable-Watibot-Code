import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET() {
  try {
    const config = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        pusherKey: true,
        pusherCluster: true,
        apiDocsUrl: true,
      },
    }).catch(() => null);

    const pusherKey = config?.pusherKey || process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || '7b85058f842c0377c19e';
    const pusherCluster = config?.pusherCluster || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'ap2';

    return NextResponse.json({
      pusherKey,
      pusherCluster,
      notificationSoundUrl: config?.apiDocsUrl || null,
    });
  } catch (error) {
    return NextResponse.json({
      pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || '7b85058f842c0377c19e',
      pusherCluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'ap2',
      notificationSoundUrl: null,
    });
  }
}

