import { NextResponse } from "next/server";
import { BackupError, restoreGlobalBackup } from "@/lib/admin/global-backup";

export const dynamic = "force-dynamic";

const RESTORE_CONFIRMATION = "RESTORE GLOBAL BACKUP";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("backup");
    const confirmation = String(formData.get("confirmation") || "");

    if (confirmation !== RESTORE_CONFIRMATION) {
      return NextResponse.json(
        {
          success: false,
          error: `Type ${RESTORE_CONFIRMATION} to confirm restore.`,
        },
        { status: 400 },
      );
    }

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "Please upload a backup JSON file." },
        { status: 400 },
      );
    }

    const targetDbParam = String(formData.get("targetDb") || "neon");
    const targetDb = targetDbParam === "contabo" ? "contabo" : "neon";

    const text = await file.text();
    const parsed = JSON.parse(text);
    const result = await restoreGlobalBackup(parsed, targetDb);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof BackupError ? error.status : 500;
    const message =
      error instanceof SyntaxError
        ? "Backup file is not valid JSON."
        : error?.message || "Failed to restore backup";

    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}
