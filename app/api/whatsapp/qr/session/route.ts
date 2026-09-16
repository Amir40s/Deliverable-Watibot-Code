import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { startQRLinking } from '@/lib/whatsapp/qr/service';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const qrSession = await startQRLinking(session.user.organizationId);
    return NextResponse.json({ success: true, session: qrSession }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to start QR linking session' },
      { status: 500 }
    );
  }
}
