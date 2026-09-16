'useclient';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ImageIcon, Video, FileText, Download, ZoomIn, Play, AlertCircle, ExternalLink } from 'lucide-react';

interface ChatMediaBubbleProps {
  msg: any;
  isOutbound: boolean;
  selectedContact?: any;
  onOpenLightbox?: (url: string, type: 'image' | 'video' | 'sticker' | 'document', caption?: string, senderName?: string, timestamp?: string) => void;
  onDownload?: (url: string, filename?: string) => void;
  formatTime?: (date: any) => string;
  getProxiedUrl?: (url: string | null) => string;
}

export function ChatImageBubble({
  msg,
  isOutbound,
  selectedContact,
  onOpenLightbox,
  onDownload,
  formatTime,
  getProxiedUrl
}: ChatMediaBubbleProps) {
  const rawObj = (msg.rawBody as any) || {};
  const rawMediaId = rawObj.image?.id || rawObj.sticker?.id || rawObj.id;

  const candidateUrls: string[] = [];
  if (msg.mediaUrl) candidateUrls.push(msg.mediaUrl);
  if (rawObj.mediaUrl) candidateUrls.push(rawObj.mediaUrl);
  if (rawObj.media_url) candidateUrls.push(rawObj.media_url);
  if (rawObj.image?.link) candidateUrls.push(rawObj.image.link);
  if (rawObj.sticker?.link) candidateUrls.push(rawObj.sticker.link);
  if (rawObj.image?.url) candidateUrls.push(rawObj.image.url);
  if (rawMediaId && typeof rawMediaId === 'string' && /^\d+$/.test(rawMediaId)) {
    candidateUrls.push(`/api/media/${rawMediaId}`);
  }

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasFailedAll, setHasFailedAll] = useState(candidateUrls.length === 0);

  const currentRawUrl = candidateUrls[candidateIndex] || '';
  const currentUrl = currentRawUrl ? (getProxiedUrl ? getProxiedUrl(currentRawUrl) : currentRawUrl) : '';

  const handleImageError = () => {
    if (candidateIndex < candidateUrls.length - 1) {
      setCandidateIndex(prev => prev + 1);
    } else {
      setHasFailedAll(true);
    }
  };

  const senderName = isOutbound ? 'You' : (selectedContact?.name || selectedContact?.waId || 'Contact');
  const timeFormatted = formatTime ? formatTime(msg.createdAt) : undefined;
  const isSticker = msg.type === 'sticker';
  const cleanCaption = msg.content &&
    msg.content.toLowerCase() !== '[image]' &&
    msg.content.toLowerCase() !== '[sticker]' &&
    msg.content.toLowerCase() !== '[photo]'
    ? msg.content.replace(/^\[(image|sticker|photo)\]\s*/i, '').trim()
    : '';

  if (hasFailedAll || !currentUrl) {
    return (
      <div className="flex flex-col gap-1.5 p-3 min-w-[200px] max-w-[280px] rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate">{isSticker ? 'Sticker' : 'Photo Attachment'}</span>
            <span className="text-[10px] text-slate-400">Media unavailable</span>
          </div>
        </div>
        {cleanCaption && (
          <p className="text-[13px] leading-snug pt-1 border-t border-black/5 dark:border-white/5 text-slate-700 dark:text-slate-200 break-words">
            {cleanCaption}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "relative rounded-[10px] overflow-hidden max-w-[280px] cursor-pointer group select-none transition-all",
          isSticker && 'max-w-[150px] border-none'
        )}
        onClick={() => {
          if (onOpenLightbox) {
            onOpenLightbox(currentUrl, isSticker ? 'sticker' : 'image', cleanCaption, senderName, timeFormatted);
          }
        }}
      >
        <img
          src={currentUrl}
          alt={isSticker ? "WhatsApp Sticker" : "WhatsApp Image"}
          className={cn(
            "w-full h-auto max-h-[300px] min-h-[100px] bg-black/5 object-cover transition-all duration-300 group-hover:scale-[1.02]",
            isSticker && 'object-contain min-h-[80px]'
          )}
          onError={handleImageError}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
          <div className="p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-sm transition-all hover:scale-110">
            <ZoomIn className="w-5 h-5" />
          </div>
          {onDownload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(currentUrl, isSticker ? 'sticker.webp' : 'photo.jpg');
              }}
              className="p-2.5 bg-black/60 hover:bg-emerald-600 rounded-full text-white backdrop-blur-sm transition-all hover:scale-110 cursor-pointer"
              title="Download Photo"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      {cleanCaption && (
        <p className={cn(
          "text-[14px] leading-snug px-2 py-1.5 whitespace-pre-wrap break-words border-t border-black/10 dark:border-white/10 mt-1",
          isOutbound ? "text-black dark:text-black font-semibold" : "text-gray-800 dark:text-gray-200"
        )}>
          {cleanCaption}
        </p>
      )}
    </div>
  );
}

export function ChatVideoBubble({
  msg,
  isOutbound,
  selectedContact,
  onOpenLightbox,
  onDownload,
  formatTime,
  getProxiedUrl
}: ChatMediaBubbleProps) {
  const rawObj = (msg.rawBody as any) || {};
  const rawMediaId = rawObj.video?.id || rawObj.id;

  const candidateUrls: string[] = [];
  if (msg.mediaUrl) candidateUrls.push(msg.mediaUrl);
  if (rawObj.mediaUrl) candidateUrls.push(rawObj.mediaUrl);
  if (rawObj.media_url) candidateUrls.push(rawObj.media_url);
  if (rawObj.video?.link) candidateUrls.push(rawObj.video.link);
  if (rawObj.video?.url) candidateUrls.push(rawObj.video.url);
  if (rawMediaId && typeof rawMediaId === 'string' && /^\d+$/.test(rawMediaId)) {
    candidateUrls.push(`/api/media/${rawMediaId}`);
  }

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasFailedAll, setHasFailedAll] = useState(candidateUrls.length === 0);

  const currentRawUrl = candidateUrls[candidateIndex] || '';
  const currentUrl = currentRawUrl ? (getProxiedUrl ? getProxiedUrl(currentRawUrl) : currentRawUrl) : '';

  const handleVideoError = () => {
    if (candidateIndex < candidateUrls.length - 1) {
      setCandidateIndex(prev => prev + 1);
    } else {
      setHasFailedAll(true);
    }
  };

  const senderName = isOutbound ? 'You' : (selectedContact?.name || selectedContact?.waId || 'Contact');
  const timeFormatted = formatTime ? formatTime(msg.createdAt) : undefined;
  const cleanCaption = msg.content &&
    msg.content.toLowerCase() !== '[video]'
    ? msg.content.replace(/^\[video\]\s*/i, '').trim()
    : '';

  if (hasFailedAll || !currentUrl) {
    return (
      <div className="flex flex-col gap-1.5 p-3 min-w-[200px] max-w-[280px] rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate">Video Attachment</span>
            <span className="text-[10px] text-slate-400">Media unavailable</span>
          </div>
        </div>
        {cleanCaption && (
          <p className="text-[13px] leading-snug pt-1 border-t border-black/5 dark:border-white/5 text-slate-700 dark:text-slate-200 break-words">
            {cleanCaption}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-1">
      <div
        className="relative rounded-md overflow-hidden bg-gray-900 border border-black/5 max-w-[280px] group cursor-pointer"
        onClick={() => {
          if (onOpenLightbox) {
            onOpenLightbox(currentUrl, 'video', cleanCaption, senderName, timeFormatted);
          }
        }}
      >
        <video
          src={currentUrl}
          className="w-full rounded-md max-h-[260px] object-cover pointer-events-none"
          onError={handleVideoError}
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform border border-white/20">
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </div>
          {onDownload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(currentUrl, 'video.mp4');
              }}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 hover:bg-emerald-600 text-white opacity-0 group-hover:opacity-100 backdrop-blur-sm transition-all hover:scale-110 cursor-pointer"
              title="Download Video"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {cleanCaption && (
        <p className="text-[14px] px-2 py-1.5 whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
          {cleanCaption}
        </p>
      )}
    </div>
  );
}

export function ChatDocumentBubble({
  msg,
  isOutbound,
  getProxiedUrl
}: {
  msg: any;
  isOutbound: boolean;
  getProxiedUrl?: (url: string | null) => string;
}) {
  const rawObj = (msg.rawBody as any) || {};
  const rawMediaId = rawObj.document?.id || rawObj.id;
  const resolvedDocUrl = msg.mediaUrl || rawObj.mediaUrl || rawObj.media_url || rawObj.document?.link || (rawMediaId && typeof rawMediaId === 'string' && /^\d+$/.test(rawMediaId) ? `/api/media/${rawMediaId}` : '');
  const finalDisplayUrl = resolvedDocUrl ? (getProxiedUrl ? getProxiedUrl(resolvedDocUrl) : resolvedDocUrl) : '';
  const docName = msg.content?.replace(/^\[document\]\s*/i, '') || rawObj.document?.filename || 'Document';

  if (!finalDisplayUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-slate-500 text-xs">
        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="font-semibold">{docName}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 min-w-[200px]">
      <a
        href={finalDisplayUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={docName}
        className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/30 rounded-lg transition-colors border border-black/5 dark:border-white/5 cursor-pointer"
      >
        <div className="w-10 h-10 bg-primary rounded flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
            {docName}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase flex items-center gap-1 font-bold">
            <Download className="w-3 h-3 inline" /> Download
          </p>
        </div>
      </a>
    </div>
  );
}

export function UnsupportedMessageBubble({ msg }: { msg: any }) {
  const content = String(msg?.content || '');
  let detailText = content.replace(/^\[Unsupported:\s*/i, '').replace(/\]$/, '').trim();
  if (!detailText || detailText.toLowerCase() === 'unsupported') {
    detailText = 'Message type is currently not supported by WhatsApp Cloud API.';
  }

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 max-w-[320px]">
      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Notice</span>
        <p className="text-[12px] text-amber-700 dark:text-amber-300/90 leading-snug break-words">
          {detailText}
        </p>
      </div>
    </div>
  );
}
