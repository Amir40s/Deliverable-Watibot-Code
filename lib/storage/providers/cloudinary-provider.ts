import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, MediaUploadPayload, MediaUploadResult } from './storage-provider.interface';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export class CloudinaryStorageProvider implements StorageProvider {
  name = 'cloudinary';

  private async configure(): Promise<boolean> {
    try {
      const sysConfig = await prisma.systemConfig.findFirst({
        orderBy: { createdAt: 'asc' }
      }).catch(() => null);

      const cloud_name = sysConfig?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME;
      const api_key = sysConfig?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY;
      const api_secret = sysConfig?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET;

      if (!cloud_name || !api_key || !api_secret) {
        return false;
      }

      cloudinary.config({
        cloud_name,
        api_key,
        api_secret,
        secure: true,
      });
      return true;
    } catch (e) {
      console.error('[CloudinaryStorageProvider] Config failed:', e);
      return false;
    }
  }

  async upload(payload: MediaUploadPayload): Promise<MediaUploadResult> {
    const isConfigured = await this.configure();
    if (!isConfigured) {
      throw new Error('Cloudinary credentials are not configured or incomplete');
    }
    const { buffer, filename, mimeType } = payload;
    const fileSize = buffer.length;
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isVideo = ['mp4', '3gp', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
    const isAudio = ['mp3', 'ogg', 'm4a', 'wav', 'aac', 'opus', 'amr', 'flac'].includes(ext);
    const isOggOrOpus = ['ogg', 'opus'].includes(ext);
    const isRaw = !isImage && !isVideo && !isAudio;

    const uuid = crypto.randomUUID();
    const generatedFilename = `${uuid}.${ext}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: uuid,
          folder: 'watibot/media',
          resource_type: isRaw ? 'raw' : isOggOrOpus ? 'auto' : (isVideo || isAudio) ? 'video' : 'auto',
          type: 'upload',
          access_mode: 'public',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            const url = result?.secure_url || '';
            resolve({
              url,
              relativePath: result?.public_id || `watibot/media/${uuid}`,
              provider: 'cloudinary',
              originalName: filename,
              generatedFilename,
              fileSize,
              mimeType,
              category: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document'
            });
          }
        }
      );
      uploadStream.end(buffer);
    });
  }

  async delete(relativePathOrUrl: string): Promise<boolean> {
    try {
      await this.configure();
      const publicId = relativePathOrUrl.replace(/^.*\/watibot\/media\//, 'watibot/media/').replace(/\.[^/.]+$/, '');
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (err) {
      console.error('[CloudinaryStorageProvider] Delete failed:', err);
      return false;
    }
  }

  getPublicUrl(relativePath: string): string {
    if (relativePath.startsWith('http')) return relativePath;
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/${relativePath}`;
  }
}
