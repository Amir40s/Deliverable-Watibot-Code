import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { triggerPusherOrgEvent } from "@/lib/pusher";
import { formatActivityLog } from "@/lib/api/mobile-route-utils";

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const body = await req.json();
    const action = body.action || "New System Alert";
    const moduleName = body.module || "System";
    const details = body.details || "A new alert notification has been triggered.";
    const target = body.target || null;
    const status = body.status || "success";

    // 1. Write Activity Log / Notification into PostgreSQL Database
    const log = await prisma.activityLog.create({
      data: {
        organizationId: org.id,
        action,
        module: moduleName,
        details,
        target,
        status,
        isRead: false,
      },
    });

    const formattedNotification = formatActivityLog(log);

    // 2. Broadcast via Pusher Realtime Event to Mobile & Web Clients
    await triggerPusherOrgEvent(org.id, "notification:new", formattedNotification);

    return NextResponse.json(
      {
        status: 201,
        success: true,
        message: "Notification created and sent successfully",
        notification: formattedNotification,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/v1/notifications/send] Error:", error);
    return NextResponse.json(
      { status: 500, success: false, error: error.message || "Failed to send notification" },
      { status: 500 }
    );
  }
}
