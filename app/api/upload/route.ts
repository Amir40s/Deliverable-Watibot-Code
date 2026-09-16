
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { mediaService } from '@/lib/storage/media-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for large APK uploads

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await mediaService.upload({
      buffer,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      organizationId: session.user.organizationId
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      relativePath: result.relativePath,
      provider: result.provider,
      originalName: result.originalName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      category: result.category
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    const message = error?.message || 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
