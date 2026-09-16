import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";
import { asBodyObject } from "@/lib/api/mobile-route-utils";

export async function GET(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  const currentOrg = await prisma.organization.findUnique({
    where: { id: org.id },
    select: { vendorConfig: true },
  });

  const vendorConfig = asBodyObject(currentOrg?.vendorConfig) ?? {};
  const notificationSettings = asBodyObject(vendorConfig.notification_settings) ?? {};

  return NextResponse.json({
    status: 200,
    success: true,
    settings: {
      push_notifications_enabled: notificationSettings.push_notifications_enabled ?? true,
      sound_enabled: notificationSettings.sound_enabled ?? true,
      broadcast_alerts_enabled: notificationSettings.broadcast_alerts_enabled ?? true,
      system_alerts_enabled: notificationSettings.system_alerts_enabled ?? true,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateProjectKey(req);
  if (auth.error) return auth.error;
  const { org } = auth;

  try {
    const body = await req.json();

    const currentOrg = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { vendorConfig: true },
    });

    const vendorConfig = asBodyObject(currentOrg?.vendorConfig) ?? {};
    const updatedSettings = {
      push_notifications_enabled: body.push_notifications_enabled ?? true,
      sound_enabled: body.sound_enabled ?? true,
      broadcast_alerts_enabled: body.broadcast_alerts_enabled ?? true,
      system_alerts_enabled: body.system_alerts_enabled ?? true,
    };

    const newVendorConfig = {
      ...vendorConfig,
      notification_settings: updatedSettings,
    };

    await prisma.organization.update({
      where: { id: org.id },
      data: { vendorConfig: newVendorConfig },
    });

    return NextResponse.json({
      status: 200,
      success: true,
      message: "Notification preferences updated successfully",
      settings: updatedSettings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 500, success: false, error: error.message || "Failed to update notification settings" },
      { status: 500 }
    );
  }
}
