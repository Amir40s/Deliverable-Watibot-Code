import { NextResponse } from "next/server";
import { emptyDatabase } from "@/lib/admin/global-backup";

export async function POST() {
  try {
    const result = await emptyDatabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to empty database:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to empty database" },
      { status: 500 }
    );
  }
}
