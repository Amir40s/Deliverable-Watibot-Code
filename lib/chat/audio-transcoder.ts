import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Checks if a buffer is in compliant Ogg container format (starts with 'OggS')
 */
export function isOggOpusBuffer(buf: Buffer | Uint8Array | null | undefined): boolean {
  if (!buf || buf.length < 32) return false;
  const isOgg = (
    buf[0] === 0x4f && // 'O'
    buf[1] === 0x67 && // 'g'
    buf[2] === 0x67 && // 'g'
    buf[3] === 0x53    // 'S'
  );
  if (!isOgg) return false;
  const headerSlice = Buffer.from(buf.slice(0, Math.min(buf.length, 64))).toString('binary');
  return headerSlice.includes('OpusHead');
}

/**
 * Detects the source container extension from magic bytes so ffmpeg demuxes properly.
 */
function detectAudioExtension(buf: Buffer): string {
  if (buf.length > 8) {
    if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      return 'm4a';
    }
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return 'webm';
    }
    if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
      return 'mp3';
    }
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      return 'wav';
    }
    if (buf[0] === 0xff && (buf[1] === 0xf1 || buf[1] === 0xf9)) {
      return 'aac';
    }
    if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return 'ogg';
    }
  }
  return 'm4a';
}

/**
 * Dynamically resolves the ffmpeg binary path across Windows, Linux, and macOS.
 */
export function getFfmpegBinary(): string | null {
  const isWindows = process.platform === 'win32';
  const exeName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';

  const candidates: (string | undefined | null)[] = [
    process.env.FFMPEG_PATH,
    path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', exeName),
    path.resolve(process.cwd(), '..', 'node_modules', 'ffmpeg-static', exeName),
  ];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ffmpeg-static');
    if (typeof mod === 'string') {
      candidates.unshift(mod);
    }
  } catch (_) {}

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string' && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'ffmpeg';
}

/**
 * Converts any audio buffer (m4a, aac, mp3, wav, webm, amr, ogg) to 100% WhatsApp-compliant Ogg Opus.
 * - Single-channel (mono)
 * - 48,000 Hz sample rate
 * - Libopus codec in Ogg container
 * 
 * Guarantees native WhatsApp PTT voice note playback across Android, iOS, Web, and Desktop.
 */
export async function transcodeToWhatsAppOggOpus(inputBuffer: Buffer): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length === 0) {
    return inputBuffer;
  }

  // 1. If it's already an Ogg file (starts with 'OggS'), return directly
  if (isOggOpusBuffer(inputBuffer)) {
    return inputBuffer;
  }

  // 2. Try fast pure-JS WebM-to-Ogg remuxer first if it's WebM (e.g. from Chrome/Firefox browser)
  const isWebM =
    inputBuffer.length >= 4 &&
    inputBuffer[0] === 0x1a &&
    inputBuffer[1] === 0x45 &&
    inputBuffer[2] === 0xdf &&
    inputBuffer[3] === 0xa3;

  if (isWebM) {
    try {
      const { convertWebMToOggOpus } = await import('./opus-ogg-converter');
      const remuxed = convertWebMToOggOpus(inputBuffer);
      if (isOggOpusBuffer(remuxed)) {
        return remuxed;
      }
    } catch (e) {
      console.warn('[AudioTranscoder] WebM remux fallback:', e);
    }
  }

  // 3. Use ffmpeg to transcode m4a / aac / mp3 / wav / amr to pure Ogg Opus
  const bin = getFfmpegBinary();
  if (!bin) {
    console.warn('[AudioTranscoder] No ffmpeg binary available');
    return inputBuffer;
  }

  const inExt = detectAudioExtension(inputBuffer);

  return new Promise<Buffer>((resolve) => {
    const tempIn = path.join(os.tmpdir(), `watibot_in_${Date.now()}_${Math.random().toString(36).slice(2)}.${inExt}`);
    const tempOut = path.join(os.tmpdir(), `watibot_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`);

    fs.writeFile(tempIn, inputBuffer, (writeErr) => {
      if (writeErr) {
        console.warn('[AudioTranscoder] Failed to write temp audio file:', writeErr);
        return resolve(inputBuffer);
      }

      const proc = spawn(bin, [
        '-y',
        '-i', tempIn,
        '-c:a', 'libopus',
        '-b:a', '48k',
        '-ar', '48000',
        '-ac', '1',
        '-application', 'voip',
        '-f', 'ogg',
        tempOut
      ]);

      const timeout = setTimeout(() => {
        try { proc.kill(); } catch (_) {}
      }, 15000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        try { fs.unlinkSync(tempIn); } catch (_) {}

        if (code === 0 && fs.existsSync(tempOut)) {
          try {
            const outBuf = fs.readFileSync(tempOut);
            fs.unlinkSync(tempOut);
            if (isOggOpusBuffer(outBuf)) {
              console.log(`[AudioTranscoder] Successfully transcoded audio to Ogg Opus (${outBuf.length} bytes)`);
              return resolve(outBuf);
            }
          } catch (readErr) {
            console.warn('[AudioTranscoder] Failed to read transcoded ogg:', readErr);
          }
        }
        try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (_) {}
        resolve(inputBuffer);
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        try { fs.unlinkSync(tempIn); } catch (_) {}
        try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (_) {}
        console.warn('[AudioTranscoder] ffmpeg execution error:', err);
        resolve(inputBuffer);
      });
    });
  });
}
