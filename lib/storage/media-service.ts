import { StorageProvider, MediaUploadPayload, MediaUploadResult } from './providers/storage-provider.interface';
import { LocalStorageProvider } from './providers/local-provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-provider';
import { R2StorageProvider } from './providers/r2-provider';

export class MediaService {
  private static instance: MediaService;
  private providers: Map<string, StorageProvider> = new Map();
  private defaultProviderName: string = 'r2';

  private constructor() {
    // Register supported providers
    const r2 = new R2StorageProvider();
    const local = new LocalStorageProvider();
    const cloudinary = new CloudinaryStorageProvider();

    this.providers.set(r2.name, r2);
    this.providers.set(local.name, local);
    this.providers.set(cloudinary.name, cloudinary);

    const envDriver = (process.env.STORAGE_DRIVER || 'r2').toLowerCase();
    if (this.providers.has(envDriver)) {
      this.defaultProviderName = envDriver;
    } else {
      this.defaultProviderName = 'r2';
    }
  }

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  private async getActiveProviderName(): Promise<string> {
    try {
      const { prisma } = await import('@/lib/prisma');
      const sysConfig = await prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { storageDriver: true },
      }).catch(() => null);
      if (sysConfig?.storageDriver && this.providers.has(sysConfig.storageDriver)) {
        return sysConfig.storageDriver;
      }
    } catch {
      // fallback
    }
    return process.env.STORAGE_DRIVER || this.defaultProviderName || 'r2';
  }

  /**
   * Uploads a file buffer through the configured active storage provider (defaulting to Cloudflare R2).
   */
  public async upload(payload: MediaUploadPayload, providerName?: string): Promise<MediaUploadResult> {
    const targetName = providerName || await this.getActiveProviderName();
    const provider = this.providers.get(targetName) || this.providers.get('r2') || this.providers.get('local');
    if (!provider) {
      throw new Error(`Storage provider '${targetName}' not initialized`);
    }

    try {
      return await provider.upload(payload);
    } catch (err: any) {
      console.warn(`[MediaService] Provider '${targetName}' upload failed, falling back to local storage:`, err?.message || err);
      const localProvider = this.providers.get('local');
      if (localProvider && targetName !== 'local') {
        return await localProvider.upload(payload);
      }
      throw err;
    }
  }

  /**
   * Deletes a file from the specified provider (or default provider).
   */
  public async delete(relativePathOrUrl: string, providerName: string = 'r2'): Promise<boolean> {
    const provider = this.providers.get(providerName) || this.providers.get('r2') || this.providers.get('local');
    if (!provider) return false;
    return await provider.delete(relativePathOrUrl);
  }

  /**
   * Resolves the public URL for a relative path or legacy URL.
   */
  public resolveUrl(relativePathOrUrl: string, providerName: string = 'r2'): string {
    if (!relativePathOrUrl) return '';
    if (relativePathOrUrl.startsWith('http://') || relativePathOrUrl.startsWith('https://')) {
      return relativePathOrUrl;
    }

    const provider = this.providers.get(providerName) || this.providers.get('r2') || this.providers.get('local');
    return provider ? provider.getPublicUrl(relativePathOrUrl) : relativePathOrUrl;
  }
}

export const mediaService = MediaService.getInstance();
