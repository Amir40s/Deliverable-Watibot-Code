import path from 'path';

export interface ValidationOptions {
  maxImageSizeMb?: number;
  maxAudioSizeMb?: number;
  maxVideoSizeMb?: number;
  maxDocSizeMb?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  cleanExtension: string;
}

// Strictly prohibited executable extensions
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'php3', 'php4', 'php5', 'phps',
  'js', 'vbs', 'ps1', 'msi', 'cpl', 'dll', 'so', 'jar', 'scr', 'com', 'htc',
  'asp', 'aspx', 'cgi', 'pl', 'py', 'rb', 'wsf', 'vbe', 'jse'
]);

const CATEGORY_MAP: Record<string, 'image' | 'video' | 'audio' | 'document' | 'sticker'> = {
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', ico: 'image', cur: 'image',
  // Videos
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video', webm: 'video', '3gp': 'video',
  // Audio
  mp3: 'audio', ogg: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', opus: 'audio', amr: 'audio', flac: 'audio',
  // Documents & Packages
  pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
  ppt: 'document', pptx: 'document', txt: 'document', csv: 'document', zip: 'document',
  apk: 'document', ipa: 'document'
};

const DEFAULT_LIMITS = {
  maxImageSizeMb: 15,
  maxAudioSizeMb: 25,
  maxVideoSizeMb: 100,
  maxDocSizeMb: 200
};

/**
 * Validates a file's extension, size, and security constraints.
 */
export function validateFile(
  filename: string,
  mimeType: string,
  fileSize: number,
  options: ValidationOptions = {}
): ValidationResult {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (!ext || BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Executable or dangerous file extension (.${ext}) is strictly prohibited.`,
      category: 'document',
      cleanExtension: ext
    };
  }

  // Determine category
  let category: 'image' | 'video' | 'audio' | 'document' | 'sticker' = CATEGORY_MAP[ext] || 'document';

  // Override by mime-type if applicable
  const cleanMime = (mimeType || '').toLowerCase();
  if (cleanMime.startsWith('image/')) category = category === 'sticker' ? 'sticker' : 'image';
  else if (cleanMime.startsWith('video/')) category = 'video';
  else if (cleanMime.startsWith('audio/')) category = 'audio';

  // Check size limits
  let maxBytes = limits.maxDocSizeMb * 1024 * 1024;
  if (category === 'image') maxBytes = limits.maxImageSizeMb * 1024 * 1024;
  else if (category === 'audio') maxBytes = limits.maxAudioSizeMb * 1024 * 1024;
  else if (category === 'video') maxBytes = limits.maxVideoSizeMb * 1024 * 1024;

  if (fileSize > maxBytes) {
    const limitMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds maximum allowed limit of ${limitMb}MB for ${category} files.`,
      category,
      cleanExtension: ext
    };
  }

  return {
    valid: true,
    category,
    cleanExtension: ext
  };
}

/**
 * Normalizes and checks if a target path stays safely within the base directory.
 */
export function isSafePath(baseDir: string, targetPath: string): boolean {
  const normalizedBase = path.resolve(baseDir);
  const normalizedTarget = path.resolve(targetPath);
  return normalizedTarget.startsWith(normalizedBase);
}
