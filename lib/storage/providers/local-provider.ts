import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider, MediaUploadPayload, MediaUploadResult } from './storage-provider.interface';
import { validateFile, isSafePath } from '../media-validator';

export function getAppBaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return rawUrl.replace(/\/$/, '');
}

export function getLocalStorageRoot(): string {
  if (process.env.LOCAL_STORAGE_DIR) {
    return path.resolve(process.env.LOCAL_STORAGE_DIR);
  }
  // Default dedicated folder outside Next.js build or fallback
  return path.resolve(process.cwd(), 'storage', 'media');
}

export class LocalStorageProvider implements StorageProvider {
  name = 'local';

  async upload(payload: MediaUploadPayload): Promise<MediaUploadResult> {
    const { buffer, filename, mimeType } = payload;
    const fileSize = buffer.length;

    // Validate file
    const validation = validateFile(filename, mimeType, fileSize);
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    const category = payload.category || validation.category;
    const ext = validation.cleanExtension || filename.split('.').pop()?.toLowerCase() || 'bin';

    // Generate unique UUID-based filename
    const uuid = crypto.randomUUID();
    const generatedFilename = `${uuid}.${ext}`;

    // Structure path: /<category>s/YYYY/MM/<uuid>.<ext>
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Categorized subfolder name (images, videos, audio, documents, stickers, profiles)
    const categoryFolder = category === 'profile' ? 'profiles' : `${category}s`;
    const parts = [categoryFolder, year, month, generatedFilename];
    const relativePath = parts.join('/');

    const baseStorageDir = getLocalStorageRoot();
    const fullPath = path.resolve(baseStorageDir, ...parts);
    const targetDir = path.dirname(fullPath);

    // Verify safe path
    if (!isSafePath(baseStorageDir, fullPath)) {
      throw new Error('Directory traversal attempt detected');
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    // Write file to disk
    await fs.promises.writeFile(fullPath, buffer);

    const publicUrl = this.getPublicUrl(relativePath);

    return {
      url: publicUrl,
      relativePath,
      provider: 'local',
      originalName: filename,
      generatedFilename,
      fileSize,
      mimeType,
      category
    };
  }

  async delete(relativePath: string): Promise<boolean> {
    try {
      const baseStorageDir = getLocalStorageRoot();
      const cleanParts = relativePath.replace(/^(\/|\\)+/, '').split(/[\/\\]+/);
      const fullPath = path.resolve(baseStorageDir, ...cleanParts);

      if (!isSafePath(baseStorageDir, fullPath)) {
        throw new Error('Unsafe delete path');
      }

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[LocalStorageProvider] Delete failed:', err);
      return false;
    }
  }

  getPublicUrl(relativePath: string): string {
    const baseUrl = getAppBaseUrl();
    const cleanPath = relativePath.replace(/^\/+/, '');
    return `${baseUrl}/api/media/files/${cleanPath}`;
  }
}
