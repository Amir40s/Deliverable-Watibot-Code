import { logger } from '@/lib/logger';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';

/**
 * Configures Cloudinary using DB settings or environment variables.
 */
export async function configureCloudinary() {
    try {
        const sysConfig = await prisma.systemConfig.findFirst({ 
            orderBy: { createdAt: 'asc' } 
        }).catch(() => null);

        cloudinary.config({
            cloud_name: sysConfig?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME,
            api_key: sysConfig?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY,
            api_secret: sysConfig?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });
    } catch (error) {
        logger.webhook.error('[Cloudinary] Config failed, using defaults:' + String(error));
        // Fallback to env variables if already set globally or just let it fail later
    }
}

import fs from 'fs';
import path from 'path';

export function getAppBaseUrl(): string {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return rawUrl.replace(/\/$/, '');
}

import { mediaService } from './media-service';

/**
 * Saves a media buffer to configured storage provider (defaulting to local VPS disk or specified provider).
 * @param buffer - The media content.
 * @param filename - The desired filename.
 * @param mimeType - Optional mime type.
 * @param providerName - Optional provider override ('cloudinary' | 'local').
 * @returns The public URL of the saved file.
 */
export async function saveMediaLocally(buffer: Buffer, filename: string, mimeType: string = 'application/octet-stream', providerName?: string): Promise<string> {
    try {
        const result = await mediaService.upload({
            buffer,
            filename,
            mimeType
        }, providerName);
        logger.webhook.info(`[MediaStorage] Saved file ${filename} via ${result.provider}: ${result.url}`);
        return result.url;
    } catch (error: any) {
        logger.webhook.error(`[MediaStorage] Failed to upload file ${filename}: ${error?.message || error}`);
        throw error;
    }
}

/**
 * Maps common mime types to file extensions.
 */
export function getExtensionFromMimeType(mimeType: string): string {
    const cleanMime = (mimeType || '').split(';')[0].trim().toLowerCase();
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/3gp': '3gp',
        'video/quicktime': 'mov',
        'audio/aac': 'aac',
        'audio/amr': 'amr',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
        'text/csv': 'csv',
        'application/zip': 'zip',
        'application/x-zip-compressed': 'zip',
    };

    return map[cleanMime] || map[mimeType] || 'bin';
}

/**
 * Accurately determines the standard MIME type from a filename or URL.
 */
export function getMimeTypeFromFileNameOrUrl(fileNameOrUrl?: string, defaultMime?: string): string {
    if (!fileNameOrUrl) return defaultMime || 'application/octet-stream';
    const clean = fileNameOrUrl.split('?')[0].trim().toLowerCase();
    const ext = clean.split('.').pop() || '';

    const mimeMap: Record<string, string> = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt: 'application/vnd.ms-powerpoint',
        txt: 'text/plain; charset=utf-8',
        csv: 'text/csv; charset=utf-8',
        rtf: 'application/rtf',
        zip: 'application/zip',
        rar: 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        json: 'application/json',
        xml: 'application/xml',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        '3gp': 'video/3gpp',
        mkv: 'video/x-matroska',
        avi: 'video/x-msvideo',
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        opus: 'audio/ogg',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        aac: 'audio/aac',
        amr: 'audio/amr',
    };

    if (mimeMap[ext]) {
        return mimeMap[ext];
    }
    if (defaultMime && defaultMime.includes('/')) {
        return defaultMime;
    }
    return 'application/octet-stream';
}

/**
 * Downloads media from Meta and saves it to Cloudinary.
 * @param mediaId - The WhatsApp media ID.
 * @param accessToken - The Meta Access Token.
 * @returns The secure URL from Cloudinary, or null if failed.
 */
export async function downloadAndSaveMedia(mediaId: string, accessToken: string): Promise<string | null> {
    try {
        // Step 1: Get the download URL
        const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
        const metaRes = await fetch(metaUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!metaRes.ok) {
            const errorText = await metaRes.text().catch(() => '');
            logger.webhook.error(`[MediaStorage] Failed to get media URL for ID ${mediaId}: ${metaRes.status} ${errorText}`);
            return null;
        }

        const metaData = await metaRes.json();
        const downloadUrl = metaData?.url;
        const mimeType = metaData?.mime_type || 'application/octet-stream';

        if (!downloadUrl) {
            logger.webhook.error(`[MediaStorage] No URL returned for media ID ${mediaId}`);
            return null;
        }

        // Step 2: Download the media
        const downloadRes = await fetch(downloadUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!downloadRes.ok) {
            logger.webhook.error(`[MediaStorage] Failed to download media from URL: ${downloadRes.status}`);
            return null;
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = getExtensionFromMimeType(mimeType);
        
        // Save to active configured storage provider (defaulting to Cloudflare R2 / Cloudinary / S3)
        const savedUrl = await saveMediaLocally(buffer, `${mediaId}.${ext}`, mimeType);
        return savedUrl || null;
    } catch (error: any) {
        logger.webhook.error(`[MediaStorage] downloadAndSaveMedia failed for ${mediaId}: ${error?.message || error}`);
        return null;
    }
}

