import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLocalStorageRoot } from '@/lib/storage/providers/local-provider';
import { isSafePath } from '@/lib/storage/media-validator';

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/ogg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json',
  zip: 'application/zip'
};

export async function GET(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await props.params;
    const subPaths = params.path || [];
    
    if (!subPaths.length) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    const relativePath = subPaths.join('/');
    const baseStorageDir = getLocalStorageRoot();
    const fullFilePath = path.join(baseStorageDir, relativePath);

    // Path traversal guard
    if (!isSafePath(baseStorageDir, fullFilePath) || !fs.existsSync(fullFilePath)) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    const stat = await fs.promises.stat(fullFilePath);
    if (!stat.isFile()) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const ext = path.extname(fullFilePath).replace('.', '').toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const fileSize = stat.size;

    // Handle HTTP Range Requests (Status 206) for Video/Audio Streaming
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` }
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(fullFilePath, { start, end });
      const webStream = (fileStream as any).toWeb ? (fileStream as any).toWeb() : require('stream').Readable.toWeb(fileStream);

      return new NextResponse(webStream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    // Standard Full File Response (Status 200)
    const fileStream = fs.createReadStream(fullFilePath);
    const webStream = (fileStream as any).toWeb ? (fileStream as any).toWeb() : require('stream').Readable.toWeb(fileStream);

    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });

  } catch (error: any) {
    console.error('[MediaRoute GET Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
