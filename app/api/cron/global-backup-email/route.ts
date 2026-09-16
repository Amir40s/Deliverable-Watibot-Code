import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createGlobalBackupForUser,
  rememberGlobalBackupSnapshot,
} from "@/lib/admin/global-backup";
import { sendGlobalBackupEmail } from "@/lib/email";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type BackupScheduleRow = {
  id: string;
  backupEmail: string | null;
  adminEmail: string | null;
  smtpFrom: string | null;
  backupScheduleTime: string | null;
  backupLastSentKey: string | null;
};

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return authorization === `Bearer ${cronSecret}` || headerSecret === cronSecret;
}

function normalizeBackupTime(value: unknown) {
  if (typeof value !== "string") return "15:00";
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : "15:00";
}

function getPakistanDateTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const currentDate = `${parts.year}-${parts.month}-${parts.day}`;
  const currentTime = `${parts.hour}:${parts.minute}`;
  return { currentDate, currentTime };
}

async function readBackupSchedule() {
  const rows = await prisma.$queryRawUnsafe<BackupScheduleRow[]>(`
    SELECT
      "id",
      "backupEmail",
      "adminEmail",
      "smtpFrom",
      "backupScheduleTime",
      "backupLastSentKey"
    FROM "SystemConfig"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `);

  return rows[0] || null;
}

async function rememberBackupEmailSent(configId: string, sentKey: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "SystemConfig" SET "backupLastSentKey" = $1, "backupLastSentAt" = NOW() WHERE "id" = $2`,
    sentKey,
    configId,
  );
}

async function handleCronBackupEmail(request: Request) {
  let isAuthorized = isAuthorizedCronRequest(request);

  if (!isAuthorized) {
    // Fallback: Check if the request is from a logged-in admin or super admin
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const config = await readBackupSchedule();
    const backupEmail = config?.backupEmail || process.env.BACKUP_EMAIL || config?.adminEmail || config?.smtpFrom;
    const scheduleTime = normalizeBackupTime(config?.backupScheduleTime);
    const { currentDate, currentTime } = getPakistanDateTimeParts();
    const sentKey = `${currentDate}:${scheduleTime}`;

    if (!force && currentTime !== scheduleTime) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Not scheduled time yet",
        currentTime,
        scheduleTime,
        timezone: "Asia/Karachi",
      });
    }

    if (!force && config?.backupLastSentKey === sentKey) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "Backup already emailed for this scheduled time",
        sentKey,
        scheduleTime,
        timezone: "Asia/Karachi",
      });
    }

    if (!backupEmail) {
      return NextResponse.json(
        { success: false, error: "Backup email is not configured" },
        { status: 400 },
      );
    }

    const backup = await createGlobalBackupForUser({
      id: "system-cron",
      email: backupEmail,
      name: "Daily Global Backup",
    });

    const date = new Date().toISOString().slice(0, 10);
    const filename = `watibot-global-backup-${date}.json`;
    const backupBody = JSON.stringify(backup);
    const sendResult = await sendGlobalBackupEmail({
      to: backupEmail,
      filename,
      backupBody,
      summary: backup.summary,
      createdAt: backup.createdAt,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || "Backup generated but email could not be sent",
        },
        { status: 500 },
      );
    }

    await rememberGlobalBackupSnapshot(backup, "generated");
    if (config?.id) {
      await rememberBackupEmailSent(config.id, sentKey);
    }

    return NextResponse.json({
      success: true,
      message: "Daily global backup emailed successfully",
      to: backupEmail,
      filename,
      scheduleTime,
      timezone: "Asia/Karachi",
      summary: backup.summary,
    });
  } catch (error: any) {
    console.error("[Cron/GlobalBackupEmail] Failed:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to email global backup" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleCronBackupEmail(request);
}

export async function POST(request: Request) {
  return handleCronBackupEmail(request);
}
