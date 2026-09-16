import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cancelQRLinking, startQRLinking } from '@/lib/whatsapp/qr/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await cancelQRLinking(id, session.user.organizationId).catch(() => {});
    const newSession = await startQRLinking(session.user.organizationId);
    return NextResponse.json({ success: true, session: newSession });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to regenerate session' },
      { status: 500 }
    );
  }
}
