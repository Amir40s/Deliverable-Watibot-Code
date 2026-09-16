import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await syncInstagramWebhookAction();
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 400 });
  }
}

export async function GET() {
  try {
    const res = await syncInstagramWebhookAction();
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 400 });
  }
}
