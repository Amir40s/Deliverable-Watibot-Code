import { NextRequest, NextResponse } from 'next/server';
import { resumeFlowExecution } from '@/lib/flows/engine';
import { logger } from '@/lib/logger';
import { Receiver } from '@upstash/qstash';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || 'mock_key',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || 'mock_key',
});

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('upstash-signature');
    const body = await req.text();

    if (!signature) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Verify QStash signature in production
    if (process.env.NODE_ENV === 'production') {
        const isValid = await receiver.verify({
            signature,
            body,
        }).catch(() => false);

        if (!isValid) {
            logger.webhook.error('Invalid QStash signature for resume');
            return new NextResponse('Invalid signature', { status: 401 });
        }
    }

    const { executionId, nodeId, organizationId, sourceHandle } = JSON.parse(body);

    logger.webhook.info(`[Queue] Resuming execution ${executionId} from node ${nodeId}`);
    
    await resumeFlowExecution(executionId, nodeId, organizationId, sourceHandle);

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    logger.webhook.error('[Queue] Error resuming execution:' + String(error));
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
