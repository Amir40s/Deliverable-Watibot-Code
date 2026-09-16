import { NextResponse } from "next/server";
import {
  BackupError,
  createGlobalBackup,
  rememberGlobalBackupSnapshot,
} from "@/lib/admin/global-backup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDbParam = searchParams.get("targetDb") || "neon";
    const targetDb = targetDbParam === "contabo" ? "contabo" : "neon";

    const backup = await createGlobalBackup(targetDb);
    await rememberGlobalBackupSnapshot(backup, "generated");
    const date = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify(backup);
    const contentLength = Buffer.byteLength(body, "utf8");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="watibot-global-backup-${targetDb}-${date}.json"`,
        "Content-Length": String(contentLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    const status = error instanceof BackupError ? error.status : 500;
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate backup" },
      { status },
    );
  }
}
