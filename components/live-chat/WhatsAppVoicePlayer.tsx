"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, Mic, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppVoicePlayerProps {
  messageId: string;
  mediaUrl: string;
  isOutbound?: boolean;
}

// Deterministic waveform bar heights generator based on messageId
function generateWaveformHeights(seed: string, count = 28): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 1.37) * 10000) % 1;
    // Normalized height between 20% and 95%
    const heightPercent = Math.floor(20 + pseudoRandom * 75);
    heights.push(heightPercent);
  }
  return heights;
}

export function WhatsAppVoicePlayer({
  messageId,
  mediaUrl,
  isOutbound = false,
}: WhatsAppVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayed, setIsPlayed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [hasError, setHasError] = useState(false);

  const posStorageKey = `wa_voice_pos_${messageId}`;
  const playedStorageKey = `wa_voice_played_${messageId}`;

  // Deterministic waveform pattern for this voice message
  const waveformHeights = useMemo(() => {
    return generateWaveformHeights(messageId || mediaUrl || 'default-voice', 26);
  }, [messageId, mediaUrl]);

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      const savedPos = localStorage.getItem(posStorageKey);
      if (savedPos !== null) {
        const parsedPos = parseFloat(savedPos);
        if (!isNaN(parsedPos) && parsedPos > 0) {
          setCurrentTime(parsedPos);
        }
      }
      const savedPlayed = localStorage.getItem(playedStorageKey);
      if (savedPlayed === 'true') {
        setIsPlayed(true);
      }
    } catch (e) {
      console.error('Failed to load voice playback state:', e);
    }
  }, [posStorageKey, playedStorageKey]);

  // Handle global single active audio event (pause others when a new audio starts playing)
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

  // Format seconds into mm:ss or m:ss
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
      } else if (audioDuration === Infinity || !isFinite(audioDuration)) {
        // Fix for Chrome MediaRecorder HTML5 Audio duration Infinity bug
        const tempAudio = audioRef.current;
        const handleTimeUpdateTemp = () => {
          tempAudio.removeEventListener('timeupdate', handleTimeUpdateTemp);
          if (isFinite(tempAudio.duration) && tempAudio.duration > 0) {
            setDuration(tempAudio.duration);
          }
          tempAudio.currentTime = 0;
        };
        tempAudio.addEventListener('timeupdate', handleTimeUpdateTemp);
        tempAudio.currentTime = 1e101;
      }

      // Restore saved playback position if available
      try {
        const savedPos = localStorage.getItem(posStorageKey);
        if (savedPos) {
          const pos = parseFloat(savedPos);
          if (!isNaN(pos) && pos > 0 && isFinite(audioRef.current.duration) && pos < audioRef.current.duration) {
            audioRef.current.currentTime = pos;
            setCurrentTime(pos);
          }
        }
      } catch (e) {}
      setIsLoading(false);
      setHasError(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      setCurrentTime(curr);

      // Dynamically catch duration when it resolves to a finite value
      const d = audioRef.current.duration;
      if (isFinite(d) && d > 0 && (!isFinite(duration) || duration <= 0)) {
        setDuration(d);
      }

      // Save position to localStorage
      try {
        localStorage.setItem(posStorageKey, curr.toString());
      } catch (e) {}

      // Mark as partially played once started
      if (curr > 0.3 && !isPlayed) {
        setIsPlayed(true);
        try {
          localStorage.setItem(playedStorageKey, 'true');
        } catch (e) {}
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setIsPlayed(true);
    try {
      localStorage.setItem(playedStorageKey, 'true');
      localStorage.setItem(posStorageKey, '0');
    } catch (e) {}
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
      // Dispatch event to pause other playing audio
      window.dispatchEvent(
        new CustomEvent('wa_voice_play', { detail: { messageId } })
      );

      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsPlayed(true);
          try {
            localStorage.setItem(playedStorageKey, 'true');
          } catch (e) {}
        })
        .catch((err) => {
          console.error('Voice playback failed:', err);
          // If play failed due to interaction policy or format, update status
          setIsPlaying(false);
        });
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!waveformContainerRef.current || !audioRef.current || !duration || hasError) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = clickRatio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    try {
      localStorage.setItem(posStorageKey, newTime.toString());
    } catch (e) {}
  };

  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const rates: Array<1 | 1.5 | 2> = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-1 rounded-2xl w-full min-w-[210px] max-w-[290px] select-none transition-all",
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
          "flex items-center gap-2.5 px-3 py-2 rounded-2xl border shadow-xs transition-colors overflow-hidden",
          isOutbound
            ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40"
            : "bg-slate-100/90 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60"
        )}
      >
        {/* Play/Pause / Loading Button */}
        <button
          onClick={togglePlayPause}
          disabled={hasError}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm relative group",
            hasError
              ? "bg-rose-500 text-white cursor-not-allowed"
              : isPlayed || isPlaying
                ? "bg-[#00A884] hover:bg-[#008f70] text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
          title={hasError ? "Audio failed to load" : isPlaying ? "Pause voice note" : "Play voice note"}
        >
          {hasError ? (
            <AlertCircle className="w-4 h-4 text-white" />
          ) : isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        {/* Waveform & Timeline Area */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
          {/* Interactive Waveform Track */}
          <div
            ref={waveformContainerRef}
            onClick={handleWaveformClick}
            className="relative h-6 flex items-center gap-[2.5px] cursor-pointer py-1 group overflow-hidden"
            title="Click to seek"
          >
            {waveformHeights.map((h, index) => {
              const barPercent = (index / waveformHeights.length) * 100;
              const isPast = progressPercent >= barPercent;

              return (
                <div
                  key={index}
                  className="flex-1 h-full flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "w-full max-w-[3px] rounded-full transition-colors duration-150",
                      isPast
                        ? "bg-[#00A884] dark:bg-[#00d0a4]"
                        : "bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500"
                    )}
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Time & Mic Status Line */}
          <div className="flex items-center justify-between text-[11px] font-semibold tracking-tight text-slate-600 dark:text-slate-300">
            <span>
              {isPlaying || currentTime > 0
                ? formatTime(currentTime)
                : formatTime(duration)}
            </span>

            <div className="flex items-center gap-1.5">
              {/* Playback Speed Pill */}
              {isPlaying && (
                <button
                  onClick={toggleSpeed}
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00A884]/15 hover:bg-[#00A884]/25 text-[#00A884] dark:text-[#00d0a4] transition-colors"
                  title="Playback speed"
                >
                  {playbackRate}x
                </button>
              )}

              {/* WhatsApp Green Mic Icon */}
              <Mic
                className={cn(
                  "w-3.5 h-3.5 transition-colors",
                  isPlayed || isPlaying
                    ? "text-[#00A884] fill-[#00A884]"
                    : "text-slate-400 dark:text-slate-500"
                )}
              />
            </div>
          </div>
        </div>

        {/* Mute/Unmute Toggle */}
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
  );
}
