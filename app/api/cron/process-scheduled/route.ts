import { NextResponse } from'next/server';

export async function GET(req: Request) {
  try {
    console.log('[API/Cron] Triggering scheduled message processing...');
    const result = await processScheduledMessages();
    const dripResult = await processScheduledMessages('DRIP');
    
    const totalProcessed = (result.processed ?? 0) + (dripResult.processed ?? 0);
    console.log(`[API/Cron] Completed. Total processed: ${totalProcessed}`);
    
    return NextResponse.json({ 
      success: true, 
      summary: {
        total: totalProcessed,
        scheduled: result.processed,
        drip: dripResult.processed
      },
      status: {
        scheduled: result.success ? 'success' : 'partial_failure',
        drip: dripResult.success ? 'success' : 'partial_failure'
      }
    });
  } catch (error) {
    console.error('[API/Cron] Fatal Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal Server Error' 
    }, { status: 500 });
  }
}

// Support POST too if needed
export async function POST(req: Request) {
 return GET(req);
}
