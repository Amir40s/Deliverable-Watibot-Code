
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    try {
        if (deviceId) {
            const device = await prisma.deviceSetting.findUnique({
                where: { deviceId }
            });
            return NextResponse.json(device);
        }

        const devices = await prisma.deviceSetting.findMany({
            where: { userId: session.user.id },
            orderBy: { lastActiveAt: 'desc' }
        });
        return NextResponse.json(devices);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { deviceId, deviceName } = await req.json();
        if (!deviceId) {
            return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
        }

        const userExists = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true },
        });

        if (!userExists) {
            return NextResponse.json({ error: "User session expired or user not found" }, { status: 401 });
        }

        const device = await prisma.deviceSetting.upsert({
            where: { deviceId },
            update: { 
                userId: session.user.id,
                deviceName, 
                lastActiveAt: new Date() 
            },
            create: {
                deviceId,
                deviceName,
                userId: session.user.id,
                notificationsEnabled: true,
                lastActiveAt: new Date()
            }
        });

        return NextResponse.json(device);
    } catch (error: any) {
        console.error("Device registration error:", error?.message || error);
        return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id, notificationsEnabled } = await req.json();
        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const device = await prisma.deviceSetting.update({
            where: { id, userId: session.user.id },
            data: { notificationsEnabled }
        });

        return NextResponse.json(device);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        await prisma.deviceSetting.delete({
            where: { id, userId: session.user.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete device" }, { status: 500 });
    }
}
