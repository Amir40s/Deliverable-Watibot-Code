import { NextRequest, NextResponse } from "next/server";

// Keep backward-compatible logo URL alive for older clients/bookmarks.
// We redirect to a committed static asset in /public.
export async function GET(req: NextRequest) {
  const target = new URL("/logo11122.png", req.url);
  return NextResponse.redirect(target, { status: 307 });
}

