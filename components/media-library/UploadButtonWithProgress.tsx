"use client";

import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { toast } from 'sonner';

export interface UploadSuccessPayload {
  url: string;
  name: string;
  type: 'image' | 'gif' | 'audio' | 'video' | 'document';
  relativePath?: string;
  dbItem?: any;
}

interface UploadButtonWithProgressProps {
  onUploadSuccess?: (payload: UploadSuccessPayload) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  buttonText?: string;
  className?: string;
  activeTypeTab?: 'image' | 'gif' | 'audio' | 'video' | 'document' | 'all';
}

export function UploadButtonWithProgress({
  onUploadSuccess,
  onUploadError,
  accept,
  buttonText = "Upload File to Server",
  className,
  activeTypeTab = 'all'
}: UploadButtonWithProgressProps) {
  const [uploadState, setUploadState] = useState<'idle' | 'preparing' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startUpload = async (file: File) => {
    setUploadState('preparing');
    setUploadProgress(0);
    setErrorMessage(null);
    setLastFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Step 1: Upload with real-time progress monitoring
      const uploadRes = await axios.post('/api/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          if (total > 0) {
            const percentCompleted = Math.min(99, Math.round((progressEvent.loaded * 100) / total));
            setUploadProgress(percentCompleted);
            if (percentCompleted >= 99) {
              setUploadState('processing');
            } else {
              setUploadState('uploading');
            }
          }
        }
      });

      setUploadProgress(100);
      setUploadState('processing');

      const { url, relativePath, provider, fileSize, mimeType } = uploadRes.data;
      if (!url) {
        throw new Error('No URL returned from upload endpoint');
      }

      // Step 2: Resolve media category type
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let mediaType: 'image' | 'gif' | 'audio' | 'video' | 'document' = 'document';

      if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(ext)) {
        mediaType = 'image';
      } else if (ext === 'gif') {
        mediaType = 'gif';
      } else if (['mp4', '3gp', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) {
        mediaType = 'video';
      } else if (['mp3', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'amr'].includes(ext)) {
        mediaType = 'audio';
      }

      if (activeTypeTab !== 'all') {
        if (activeTypeTab === 'gif' && ext === 'gif') mediaType = 'gif';
      }

      // Step 3: Register in Media Library DB
      const dbRes = await axios.post('/api/media-library', {
        url,
        name: file.name,
        type: mediaType,
        relativePath,
        storageProvider: provider,
        mimeType: mimeType || file.type,
        fileSize: fileSize || file.size
      });

      setUploadState('success');
      toast.success(`Successfully uploaded ${file.name}!`);

      onUploadSuccess?.({
        url,
        name: file.name,
        type: mediaType,
        relativePath,
        dbItem: dbRes.data
      });

      // Smooth auto-reset back to normal state after 2 seconds
      setTimeout(() => {
        setUploadState('idle');
        setUploadProgress(0);
        setLastFile(null);
      }, 2000);

    } catch (error: any) {
      console.error('[UploadProgress] Upload error:', error);
      const errText = error.response?.data?.error || error.message || 'Error uploading file';
      setErrorMessage(errText);
      setUploadState('error');
      toast.error(errText);
      onUploadError?.(errText);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startUpload(file);
    }
  };

  const handleClick = () => {
    if (uploadState === 'error' && lastFile) {
      startUpload(lastFile);
    } else if (uploadState === 'idle') {
      fileInputRef.current?.click();
    }
  };

  const isBusy = uploadState === 'preparing' || uploadState === 'uploading' || uploadState === 'processing';

  return (
    <div className="relative inline-flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />

      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className={cn(
          "relative overflow-hidden px-5 py-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all duration-300 active:scale-[0.98] select-none cursor-pointer min-w-[210px] h-[44px]",
          uploadState === 'error'
            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25"
            : uploadState === 'success'
            ? "bg-emerald-600 text-white shadow-emerald-600/25"
            : "bg-[#00B074] hover:bg-[#009864] text-white shadow-[#00B074]/20",
          isBusy && "cursor-not-allowed opacity-95",
          className
        )}
      >
        {/* Smooth Fill Progress Layer */}
        {isBusy && (
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/25 dark:bg-black/25 transition-all duration-300 ease-out"
            style={{ width: `${uploadState === 'processing' ? 100 : Math.max(5, uploadProgress)}%` }}
          />
        )}

        {/* Content Label */}
        <span className="relative z-10 flex items-center justify-center gap-2 font-semibold tracking-wide">
          {uploadState === 'idle' && (
            <>
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span>{buttonText}</span>
            </>
          )}

          {uploadState === 'preparing' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Preparing...</span>
            </>
          )}

          {uploadState === 'uploading' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Uploading... {uploadProgress}%</span>
            </>
          )}

          {uploadState === 'processing' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Processing...</span>
            </>
          )}

          {uploadState === 'success' && (
            <>
              <Check className="w-4 h-4 text-white stroke-[3] shrink-0 animate-in zoom-in-50 duration-200" />
              <span>Upload Complete ✓</span>
            </>
          )}

          {uploadState === 'error' && (
            <>
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Failed. Click to Retry</span>
            </>
          )}
        </span>
      </button>

      {/* Real-time Sub Progress Indicator Bar */}
      {isBusy && (
        <div className="w-full mt-2 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-[#00B074] transition-all duration-200 ease-out rounded-full"
            style={{ width: `${uploadState === 'processing' ? 100 : uploadProgress}%` }}
          />
        </div>
      )}

      {/* Subtitle Error details if failed */}
      {uploadState === 'error' && errorMessage && (
        <span className="mt-1 text-[10px] text-rose-500 font-medium max-w-[210px] truncate">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
