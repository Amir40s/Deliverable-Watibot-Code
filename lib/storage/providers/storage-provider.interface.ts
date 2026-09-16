export interface MediaUploadPayload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  category?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'profile';
  organizationId?: string;
}

export interface MediaUploadResult {
  url: string;
  relativePath: string;
  provider: 'local' | 'cloudinary' | string;
  originalName: string;
  generatedFilename: string;
  fileSize: number;
  mimeType: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'profile';
}

export interface StorageProvider {
  name: string;
  upload(payload: MediaUploadPayload): Promise<MediaUploadResult>;
  delete(relativePathOrUrl: string): Promise<boolean>;
  getPublicUrl(relativePath: string): string;
}
