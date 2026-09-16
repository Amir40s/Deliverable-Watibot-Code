"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2,
  Image as ImageIcon, 
  Video as VideoIcon, 
  Check
} from "lucide-react";
import { cn, downloadMedia } from "@/lib/utils";
import { toast } from "sonner";

export interface MediaLightboxData {
  url: string;
  type?: 'image' | 'video' | 'sticker' | 'gif' | string;
  caption?: string | null;
  senderName?: string;
  timestamp?: string;
  fileName?: string;
}

interface MediaLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MediaLightboxData | null;
}

export function MediaLightboxModal({ isOpen, onClose, data }: MediaLightboxModalProps) {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure portal target exists on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset state when data changes or opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsDownloading(false);
      setDownloadSuccess(false);
    }
  }, [isOpen, data?.url]);

  // Keyboard navigation & ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleResetZoom();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, zoom]);

  if (!isOpen || !data || !data.url || !mounted) return null;

  const isVideo = data.type === 'video' || data.url.match(/\.(mp4|webm|mov)(\?|#|$)/i);
  const isSticker = data.type === 'sticker';

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.3, 4));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.3, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isVideo) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1 || isVideo) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1 || isVideo) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      toast.info("Starting download...");
      const fileExt = isVideo ? ".mp4" : isSticker ? ".webp" : ".jpg";
      const customName = data.fileName || `${data.senderName ? data.senderName.replace(/\s+/g, '_') : 'chat'}_${isVideo ? 'video' : 'photo'}_${Date.now()}${fileExt}`;
      await downloadMedia(data.url, customName);
      setIsDownloading(false);
      setDownloadSuccess(true);
      toast.success("Download started!");
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      setIsDownloading(false);
      toast.error("Failed to download file directly");
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] bg-[#0b141a]/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div 
        className="w-full h-16 bg-[#111b21] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 text-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            {isVideo ? (
              <VideoIcon className="w-5 h-5 text-emerald-400" />
            ) : (
              <ImageIcon className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-slate-100">
              {data.senderName || (isVideo ? "Video" : isSticker ? "Sticker" : "Photo")}
            </span>
            {data.timestamp && (
              <span className="text-xs text-slate-400 truncate">{data.timestamp}</span>
            )}
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isVideo && (
            <>
              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white disabled:opacity-30 transition-all"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-2 text-slate-300 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 4}
                  className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white disabled:opacity-30 transition-all"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleRotate}
                className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all"
                title="Rotate Clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetZoom}
                className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all hidden sm:block"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Download Button (WhatsApp Style) */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md hover:shadow-emerald-900/30"
            title="Download Media"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Downloaded</span>
              </>
            ) : (
              <>
                <Download className={cn("w-4 h-4", isDownloading && "animate-bounce")} />
                <span>{isDownloading ? "Downloading..." : "Download"}</span>
              </>
            )}
          </button>

          <div className="h-6 w-px bg-white/20 mx-1" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white rounded-lg transition-all flex items-center justify-center shrink-0"
            title="Close (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Media Content Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full flex items-center justify-center relative overflow-hidden p-4 sm:p-8"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          // If user clicks outside the media, close modal
          if (e.target === containerRef.current) {
            onClose();
          }
        }}
      >
        {isVideo ? (
          <div className="relative max-w-5xl max-h-full w-full flex items-center justify-center">
            <video
              src={data.url}
              controls
              autoPlay
              playsInline
              className="max-h-[80vh] max-w-full rounded-xl shadow-2xl bg-black border border-white/10 outline-none"
            />
          </div>
        ) : (
          <div 
            className={cn(
              "relative flex items-center justify-center transition-transform duration-75 ease-out max-h-full max-w-full",
              zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
            )}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "center center"
            }}
          >
            <img
              src={data.url}
              alt={data.caption || "Media preview"}
              draggable={false}
              className={cn(
                "max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl select-none transition-opacity duration-300",
                isSticker && "max-h-[50vh]"
              )}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/image-error.png';
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Caption Bar */}
      {data.caption && (
        <div 
          className="w-full bg-gradient-to-t from-[#0b141a] via-[#0b141a]/90 to-transparent p-4 flex justify-center shrink-0 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#111b21]/90 border border-white/10 text-slate-200 px-5 py-2.5 rounded-xl max-w-2xl text-center text-sm leading-relaxed shadow-lg backdrop-blur-sm whitespace-pre-wrap break-words">
            {data.caption}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
