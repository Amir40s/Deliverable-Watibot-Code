import { NextResponse } from 'next/server';
import { processWindowReminders } from '@/lib/automation/window-reminder-worker';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || undefined;

    console.log('[API/Cron/WindowReminders] Triggering WhatsApp window expiry reminder check...');
    const result = await processWindowReminders(orgId);

    return NextResponse.json({
      success: result.success,
      summary: {
        organizationsChecked: result.organizationsChecked,
        candidatesEvaluated: result.candidatesEvaluated,
        remindersSent: result.remindersSent,
        remindersFailed: result.remindersFailed,
        remindersSkipped: result.remindersSkipped
      },
      errors: result.errors
    });
  } catch (error: any) {
    console.error('[API/Cron/WindowReminders] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
