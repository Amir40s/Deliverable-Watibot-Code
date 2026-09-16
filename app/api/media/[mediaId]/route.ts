import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type MetaMediaResponse = {
  url?: string;
  mime_type?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  } & Record<string, unknown>;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params;
    const { searchParams } = new URL(req.url);
    const queryOrgId = searchParams.get('orgId');
    
    const session = await getServerSession(authOptions);
    
    // Use session orgId by default, fallback to query orgId if it's a valid session user
    const orgId = session?.user?.organizationId || queryOrgId;

    if (!orgId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 1. Fetch Organization for Meta Access Token
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { metaAccessToken: true, instagramAccessToken: true, facebookPageId: true }
    });

    if (!org?.metaAccessToken) {
      return new NextResponse('Media access denied. Organization not properly configured.', { status: 403 });
    }

    // 2. Get Media Download URL from Meta
    const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const tokens = [org.metaAccessToken, org.instagramAccessToken].filter((token): token is string => Boolean(token));
    let metaData: MetaMediaResponse | null = null;
    let usedToken = '';

    for (const token of tokens) {
      const metaRes = await fetch(metaUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const candidate = await metaRes.json() as MetaMediaResponse;
      metaData = candidate;
      if (!candidate.error && candidate.url) {
        usedToken = token;
        break;
      }
    }

    if (!metaData || metaData.error || !metaData.url) {
      logger.webhook.warn('Meta media unavailable:' + JSON.stringify(metaData?.error));
      return new NextResponse('Media is unavailable or expired.', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    // 3. Fetch the actual media from the Meta download URL
    const downloadRes = await fetch(metaData.url, {
      headers: { 'Authorization': `Bearer ${usedToken}` }
    });

    if (!downloadRes.ok) {
      logger.webhook.warn(`Meta media download failed for ${mediaId}: ${downloadRes.status}`);
      return new NextResponse('Media is unavailable or expired.', {
        status: downloadRes.status === 403 || downloadRes.status === 404 ? 404 : downloadRes.status,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    // 4. Stream the response back to the client AND save to Cloudinary in background
    const contentType = downloadRes.headers.get('Content-Type') || 'application/octet-stream';
    const buffer = await downloadRes.arrayBuffer();
    const nodeBuffer = Buffer.from(buffer);

    // Save to Cloudinary in background (Vercel compatible)
    const { getExtensionFromMimeType, saveMediaLocally } = await import('@/lib/storage/media');
    try {
      const ext = getExtensionFromMimeType(contentType);
      // We don't await this to keep the response fast, but it will persist for next time
      saveMediaLocally(nodeBuffer, `${mediaId}.${ext}`).catch(err => {
         logger.webhook.error('Background Cloudinary upload failed:' + String(err));
      });
    } catch (err) {
      logger.webhook.error('Failed to initiate background upload:' + String(err));
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Disposition': `inline; filename="${mediaId}"`
      }
    });

  } catch (error) {
    logger.webhook.error('Media Proxy Error:' + String(error));
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
