/**
 * Utility helpers for WhatsApp Audio & Voice Note handling.
 */

export function isVoiceMessage(msg: any): boolean {
  if (!msg) return false;

  // Direct type indicator
  if (msg.type === 'voice') return true;

  const raw = msg.rawBody || {};

  // 1. Direct voice flags on rawBody
  if (raw.voice === true || raw.isVoice === true) return true;
  if (raw.audio && raw.audio.voice === true) return true;
  if (raw.body && raw.body.voice === true) return true;

  // 2. Cloud media / probe metadata
  if (raw.meta?.cloud_media_upload?.voice === true) return true;
  if (raw.meta?.cloud_media_upload?.voice_probe?.codec === 'opus') return true;

  // 3. Content placeholder fallback (e.g. "[Voice Message]")
  if (typeof msg.content === 'string') {
    const trimmed = msg.content.trim().toLowerCase();
    if (
      trimmed === '[voice message]' ||
      trimmed === '[voice]' ||
      trimmed === 'voice message' ||
      trimmed === '__voice__' ||
      trimmed.startsWith('🎤 voice message')
    ) {
      return true;
    }
  }

  // 4. MIME type indicator (Opus audio in ogg/opus container is WhatsApp standard voice note)
  const mimeType = raw.audio?.mime_type || raw.mime_type || raw.meta?.cloud_media_upload?.mime_type || '';
  if (typeof mimeType === 'string' && (mimeType.includes('opus') || mimeType.includes('audio/ogg'))) {
    // If voice is explicitly set to false, respect it
    if (raw.voice === false || raw.audio?.voice === false || raw.body?.voice === false) {
      return false;
    }
    return true;
  }

  // 5. Media URL / filename indicators
  if (typeof msg.mediaUrl === 'string') {
    const urlLower = msg.mediaUrl.toLowerCase();
    if (urlLower.includes('ac_opus') || urlLower.includes('voice.ogg') || urlLower.includes('voice_message')) {
      return true;
    }
  }

  // If type is audio and not explicitly disabled
  if (msg.type === 'audio') {
    if (raw.voice === false || raw.audio?.voice === false || raw.body?.voice === false) {
      return false;
    }
    return true;
  }

  return false;
}

export function getAudioMediaUrl(msg: any): string {
  if (!msg) return '';

  // 1. Direct mediaUrl on Message model
  if (typeof msg.mediaUrl === 'string' && msg.mediaUrl.trim().length > 0) {
    return msg.mediaUrl.trim();
  }

  const raw = msg.rawBody || {};

  // 2. Body link (e.g., Wachamp or unified structure)
  if (typeof raw.body?.link === 'string' && raw.body.link.trim().length > 0) {
    return raw.body.link.trim();
  }

  // 3. Audio object link or url (Meta Cloud API / webhooks)
  if (typeof raw.audio?.link === 'string' && raw.audio.link.trim().length > 0) {
    return raw.audio.link.trim();
  }
  if (typeof raw.audio?.url === 'string' && raw.audio.url.trim().length > 0) {
    return raw.audio.url.trim();
  }
  if (typeof raw.video?.link === 'string' && raw.video.link.trim().length > 0) {
    return raw.video.link.trim();
  }

  // 4. Root link
  if (typeof raw.link === 'string' && raw.link.trim().length > 0) {
    return raw.link.trim();
  }

  // 5. If msg.content is a direct URL
  if (typeof msg.content === 'string') {
    const trimmed = msg.content.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/api/media/')) {
      return trimmed;
    }
  }

  return '';
}

export function getAudioFilename(msg: any, defaultName = 'audio.mp3'): string {
  if (!msg) return defaultName;

  const raw = msg.rawBody || {};
  if (typeof raw.audio?.filename === 'string' && raw.audio.filename.trim()) {
    return raw.audio.filename.trim();
  }
  if (typeof raw.filename === 'string' && raw.filename.trim()) {
    return raw.filename.trim();
  }

  const url = getAudioMediaUrl(msg);
  if (url) {
    const cleanUrl = url.split('?')[0];
    const extracted = cleanUrl.split('/').pop();
    if (extracted && extracted.includes('.')) {
      return extracted;
    }
  }

  return defaultName;
}
