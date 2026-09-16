import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider, MediaUploadPayload, MediaUploadResult } from './storage-provider.interface';
import { validateFile } from '../media-validator';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export class R2StorageProvider implements StorageProvider {
  name = 'r2';
  private client: S3Client | null = null;
  private lastConfigHash: string = '';
  private bucket: string = '';
  private publicUrl: string = '';

  private async getClient(): Promise<{ client: S3Client; bucket: string; publicUrl: string }> {
    try {
      const sysConfig = await prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
      }).catch(() => null);

      const accountId = sysConfig?.r2AccountId || process.env.R2_ACCOUNT_ID || '5402d58bce617b15e37beed221f05e9f';
      const accessKeyId = sysConfig?.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID || '2243bb7d353a36b4c2cf57e63c27f833';
      const secretAccessKey = sysConfig?.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY || 'f9b456e74798502a2c6fc67df621ebbece81725d9c3738ae645b5c94f1e52f93';
      this.bucket = sysConfig?.r2BucketName || process.env.R2_BUCKET_NAME || 'watibot-media';
      this.publicUrl = (sysConfig?.r2PublicUrl || process.env.R2_PUBLIC_URL || 'https://pub-6f7723931262447abd4de599730f9cb9.r2.dev').replace(/\/+$/, '');
      const endpoint = sysConfig?.r2Endpoint || process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

      const configHash = `${accountId}:${accessKeyId}:${secretAccessKey}:${this.bucket}:${this.publicUrl}:${endpoint}`;

      if (!this.client || this.lastConfigHash !== configHash) {
        this.client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.lastConfigHash = configHash;
      }
    } catch (e) {
      console.warn('[R2StorageProvider] Failed to fetch DB config, using env defaults:', e);
      if (!this.client) {
        const accountId = process.env.R2_ACCOUNT_ID || '5402d58bce617b15e37beed221f05e9f';
        const accessKeyId = process.env.R2_ACCESS_KEY_ID || '2243bb7d353a36b4c2cf57e63c27f833';
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'f9b456e74798502a2c6fc67df621ebbece81725d9c3738ae645b5c94f1e52f93';
        this.bucket = process.env.R2_BUCKET_NAME || 'watibot-media';
        this.publicUrl = (process.env.R2_PUBLIC_URL || 'https://pub-6f7723931262447abd4de599730f9cb9.r2.dev').replace(/\/+$/, '');
        const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

        this.client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      }
    }

    return { client: this.client!, bucket: this.bucket, publicUrl: this.publicUrl };
  }

  async upload(payload: MediaUploadPayload): Promise<MediaUploadResult> {
    const { client, bucket, publicUrl } = await this.getClient();
    const { buffer, filename, mimeType } = payload;
    const fileSize = buffer.length;

    // Validate file
    const validation = validateFile(filename, mimeType, fileSize);
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    const category = payload.category || validation.category;
    const ext = validation.cleanExtension || filename.split('.').pop()?.toLowerCase() || 'bin';

    // Generate unique UUID-based filename (or clean watibot.apk for APK uploads)
    const isApk = ext === 'apk' || filename.toLowerCase().endsWith('.apk');
    const uuid = crypto.randomUUID();
    const generatedFilename = isApk ? 'watibot.apk' : `${uuid}.${ext}`;

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const categoryFolder = category === 'profile' ? 'profiles' : `${category}s`;
    const relativePath = isApk ? 'downloads/watibot.apk' : `${categoryFolder}/${year}/${month}/${generatedFilename}`;

    const cleanMime = (mimeType || '').split(';')[0].trim() || 'application/octet-stream';

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: relativePath,
        Body: buffer,
        ContentType: cleanMime,
        ContentDisposition: isApk ? 'attachment; filename="watibot.apk"' : undefined,
      })
    );

    const fileUrl = `${publicUrl}/${relativePath}`;

    return {
      url: fileUrl,
      relativePath,
      provider: 'r2',
      originalName: filename,
      generatedFilename,
      fileSize,
      mimeType: cleanMime,
      category,
    };
  }

  async delete(relativePathOrUrl: string): Promise<boolean> {
    try {
      const { client, bucket, publicUrl } = await this.getClient();
      let key = relativePathOrUrl;
      if (key.startsWith(publicUrl)) {
        key = key.replace(publicUrl, '').replace(/^\/+/, '');
      } else if (key.startsWith('http://') || key.startsWith('https://')) {
        const urlObj = new URL(key);
        key = urlObj.pathname.replace(/^\/+/, '');
      }

      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      return true;
    } catch (e) {
      console.error('[R2StorageProvider] Delete failed:', e);
      return false;
    }
  }

  getPublicUrl(relativePath: string): string {
    const publicUrl = this.publicUrl || (process.env.R2_PUBLIC_URL || 'https://pub-6f7723931262447abd4de599730f9cb9.r2.dev').replace(/\/+$/, '');
    const cleanPath = relativePath.replace(/^\/+/, '');
    return `${publicUrl}/${cleanPath}`;
  }
}
