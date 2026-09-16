import { NextResponse } from "next/server";
import { BackupError, getGlobalBackupStatus } from "@/lib/admin/global-backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getGlobalBackupStatus();

    const dbUrl = process.env.DATABASE_URL || "";
    let dbName = "Unknown";
    console.log("[BACKUP STATUS] DATABASE_URL raw:", dbUrl);
    try {
      if (dbUrl) {
        const url = new URL(dbUrl);
        dbName = url.pathname.slice(1);
      }
    } catch (e: any) { 
      console.error("[BACKUP STATUS] URL parse error:", e);
    }
    console.log("[BACKUP STATUS] Parsed dbName:", dbName);

    return NextResponse.json({
      success: true,
      status,
      databaseName: dbName,
    });
  } catch (error: any) {
    console.error("[BACKUP STATUS] GET error:", error);
    const status = error instanceof BackupError ? error.status : 500;

    return NextResponse.json(
      { success: false, error: error?.message || "Failed to check backup status" },
      { status },
    );
  }
}
