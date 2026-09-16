import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const filename = body.filename || 'app.apk';
    const ext = filename.split('.').pop()?.toLowerCase() || 'apk';
    const cleanMime = body.mimeType || 'application/vnd.android.package-archive';

    const sysConfig = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    }).catch(() => null);

    const accountId = sysConfig?.r2AccountId || process.env.R2_ACCOUNT_ID || '5402d58bce617b15e37beed221f05e9f';
    const accessKeyId = sysConfig?.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID || '2243bb7d353a36b4c2cf57e63c27f833';
    const secretAccessKey = sysConfig?.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY || 'f9b456e74798502a2c6fc67df621ebbece81725d9c3738ae645b5c94f1e52f93';
    const bucket = sysConfig?.r2BucketName || process.env.R2_BUCKET_NAME || 'watibot-media';
    const publicUrl = (sysConfig?.r2PublicUrl || process.env.R2_PUBLIC_URL || 'https://pub-6f7723931262447abd4de599730f9cb9.r2.dev').replace(/\/+$/, '');
    const endpoint = sysConfig?.r2Endpoint || process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const uuid = crypto.randomUUID();
    const isApk = ext === 'apk' || filename.toLowerCase().endsWith('.apk');
    const generatedFilename = isApk ? 'watibot.apk' : `${uuid}.${ext}`;
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const relativePath = isApk ? 'downloads/watibot.apk' : `documents/${year}/${month}/${generatedFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: relativePath,
      ContentType: cleanMime,
      ContentDisposition: isApk ? 'attachment; filename="watibot.apk"' : undefined,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    const finalPublicUrl = `${publicUrl}/${relativePath}`;

    return NextResponse.json({
      presignedUrl,
      publicUrl: finalPublicUrl,
      relativePath,
      cleanMime
    });
  } catch (error: any) {
    console.error('[Presigned Upload API] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate upload URL' }, { status: 500 });
  }
}
