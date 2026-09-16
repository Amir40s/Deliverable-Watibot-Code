"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music2, Download, Loader2, Volume2, VolumeX } from 'lucide-react';
import { cn, downloadMedia } from '@/lib/utils';

interface NormalAudioPlayerProps {
  messageId: string;
  mediaUrl: string;
  filename?: string;
  isOutbound?: boolean;
}

export function NormalAudioPlayer({
  messageId,
  mediaUrl,
  filename = 'Audio Attachment',
  isOutbound = false,
}: NormalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Handle global single active audio event
  useEffect(() => {
    const handleGlobalVoicePlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ messageId: string }>;
      if (customEvent.detail?.messageId !== messageId) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    };

    window.addEventListener('wa_voice_play', handleGlobalVoicePlay);
    return () => {
      window.removeEventListener('wa_voice_play', handleGlobalVoicePlay);
    };
  }, [messageId]);

  const formatTime = (secs: number) => {
    if (!secs || !isFinite(secs) || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      }
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      setCurrentTime(curr);
      const d = audioRef.current.duration;
      if (isFinite(d) && d > 0 && (!isFinite(duration) || duration <= 0)) {
        setDuration(d);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleError = () => {
    setIsLoading(false);
    setIsPlaying(false);
    setHasError(true);
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || hasError) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      window.dispatchEvent(
        new CustomEvent('wa_voice_play', { detail: { messageId } })
      );

      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('Audio playback failed:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !audioRef.current || !duration || hasError) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = clickRatio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const cleanDisplayTitle = filename.replace(/^\[(audio|voice)\]\s*/i, '') || 'Audio Attachment';

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-2 rounded-2xl w-full min-w-[220px] max-w-[310px] select-none",
        isOutbound ? "text-slate-900 dark:text-slate-100" : "text-slate-900 dark:text-slate-100"
      )}
    >
      <audio
        ref={audioRef}
        src={mediaUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />

      <div
        className={cn(
          "flex flex-col gap-2 p-2.5 rounded-xl border shadow-xs transition-colors",
          isOutbound
            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"
            : "bg-slate-100/90 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60"
        )}
      >
        {/* Header with Music Icon, File Title, and Download Action */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/15 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200" title={cleanDisplayTitle}>
                {cleanDisplayTitle}
              </p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Audio File
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadMedia(mediaUrl, cleanDisplayTitle.includes('.') ? cleanDisplayTitle : `${cleanDisplayTitle}.mp3`);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all shrink-0"
            title="Download Audio"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Player Controls & Timeline */}
        <div className="flex items-center gap-2 pt-1">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            disabled={hasError}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs",
              hasError
                ? "bg-rose-500 text-white"
                : isPlaying
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-200 transition-colors"
            )}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Progress Bar Track */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div
              ref={progressBarRef}
              onClick={handleSeek}
              className="relative w-full h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 cursor-pointer overflow-hidden group"
            >
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
