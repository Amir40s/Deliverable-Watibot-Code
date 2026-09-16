import { NextResponse } from 'next/server';
import { getActivityLogs } from '@/app/actions/activity-log';

export async function GET() {
  try {
    const data = await getActivityLogs({ limit: 5 });
    return NextResponse.json(data || { logs: [], total: 0 });
  } catch (error) {
    console.error('Failed to fetch recent notifications:', error);
    return NextResponse.json({ logs: [], total: 0 }, { status: 500 });
  }
}
