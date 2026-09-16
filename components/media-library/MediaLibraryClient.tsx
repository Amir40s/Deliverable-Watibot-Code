"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UploadCloud, 
  Trash2, 
  Copy, 
  Check, 
  Image as ImageIcon, 
  Music, 
  Film, 
  FileText, 
  Loader2, 
  Sparkles, 
  HardDrive, 
  ExternalLink,
  Eye,
  RefreshCw,
  Plus,
  Download
} from 'lucide-react';
import { cn, downloadMedia } from '@/lib/utils';
import axios from 'axios';
import { toast } from 'sonner';
import { UploadButtonWithProgress } from './UploadButtonWithProgress';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'gif' | 'audio' | 'video' | 'document';
  name: string;
  createdAt: string;
}

export function MediaLibraryClient() {
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'gif' | 'audio' | 'video' | 'document'>('all');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMediaItems = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/media-library');
      setMediaItems(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch media library items', error);
      toast.error('Failed to load media library items');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaItems();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Step 1: Upload file to local VPS server disk via /api/upload
      const uploadRes = await axios.post('/api/upload', formData);
      const { url } = uploadRes.data;

      if (!url) {
        throw new Error('No URL returned from upload route');
      }

      // Step 2: Determine type
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

      // Step 3: Record item in DB
      const dbRes = await axios.post('/api/media-library', {
        url,
        name: file.name,
        type: mediaType,
      });

      const newMedia = dbRes.data;
      setMediaItems((prev) => [newMedia, ...prev]);
      toast.success(`Successfully uploaded ${file.name} to server!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || error.message || 'Error uploading file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteItem = async () => {
    if (!deletingItemId) return;
    try {
      await axios.delete(`/api/media-library/${deletingItemId}`);
      setMediaItems((prev) => prev.filter((item) => item.id !== deletingItemId));
      toast.success('Media removed from library');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item');
    } finally {
      setDeletingItemId(null);
    }
  };

  const copyToClipboard = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    toast.success('Media URL copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredItems = mediaItems.filter((item) => {
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const counts = {
    all: mediaItems.length,
    image: mediaItems.filter((i) => i.type === 'image').length,
    gif: mediaItems.filter((i) => i.type === 'gif').length,
    audio: mediaItems.filter((i) => i.type === 'audio').length,
    video: mediaItems.filter((i) => i.type === 'video').length,
    document: mediaItems.filter((i) => i.type === 'document').length,
  };

  const tabs = [
    { id: 'all', label: 'All Files', count: counts.all },
    { id: 'image', label: 'Images', icon: ImageIcon, count: counts.image },
    { id: 'gif', label: 'GIFs', icon: Sparkles, count: counts.gif },
    { id: 'video', label: 'Videos', icon: Film, count: counts.video },
    { id: 'audio', label: 'Audio', icon: Music, count: counts.audio },
    { id: 'document', label: 'Documents', icon: FileText, count: counts.document },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Media Library
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-3.5 h-3.5" /> Local Server Storage (Contabo VPS)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Manage, preview, and upload media files directly to your VPS server disk.
          </p>

          {/* Media Size Limits Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Upload Limits:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ImageIcon className="w-3 h-3" /> Images: Max 15MB
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Music className="w-3 h-3" /> Audio: Max 25MB
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Film className="w-3 h-3" /> Videos: Max 100MB
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileText className="w-3 h-3" /> Docs: Max 50MB
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchMediaItems}
            className="p-3 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all"
            title="Refresh Library"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>

          <UploadButtonWithProgress
            onUploadSuccess={(payload) => {
              if (payload.dbItem) {
                setMediaItems((prev) => [payload.dbItem, ...prev]);
              } else {
                fetchMediaItems();
              }
            }}
            buttonText="Upload File to Server"
          />
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                activeTab === tab.id
                  ? "bg-[#00B074] text-white shadow-md shadow-[#00B074]/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/5"
              )}
            >
              {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00B074]"
          />
        </div>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B074] animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="min-h-[360px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Media Files Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Upload images, videos, audio clips, or documents to store them on your local VPS server.
            </p>
          </div>
          <button
            onClick={handleUploadClick}
            className="px-5 py-2.5 bg-[#00B074] hover:bg-[#009864] text-white rounded-2xl font-semibold text-xs flex items-center gap-2 shadow-md shadow-[#00B074]/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Upload First File
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl p-2.5 hover:border-[#00B074] dark:hover:border-[#00B074] transition-all shadow-sm hover:shadow-md flex flex-col h-52 overflow-hidden"
            >
              {/* Media Preview Container */}
              <div className="relative h-32 w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                {item.type === 'image' || item.type === 'gif' ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : item.type === 'video' ? (
                  <div className="flex flex-col items-center gap-1.5 text-[#00B074]">
                    <Film className="w-10 h-10" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Video</span>
                  </div>
                ) : item.type === 'audio' ? (
                  <div className="flex flex-col items-center gap-1.5 text-[#00B074]">
                    <Music className="w-10 h-10" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Audio</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-[#00B074]">
                    <FileText className="w-10 h-10" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Document</span>
                  </div>
                )}

                {/* Actions Overlay on Hover */}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="p-2 rounded-xl bg-white/20 hover:bg-white text-white hover:text-slate-900 transition-all cursor-pointer"
                    title="Preview File"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(item)}
                    className="p-2 rounded-xl bg-white/20 hover:bg-white text-white hover:text-slate-900 transition-all cursor-pointer"
                    title="Copy Public URL"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setDeletingItemId(item.id)}
                    className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white transition-all cursor-pointer"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Date */}
              <div className="mt-2.5 flex flex-col justify-between flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.name}>
                  {item.name}
                </span>
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span className="uppercase font-bold text-[#00B074]">{item.type}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItemId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete File?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete this file from your library?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeletingItemId(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteItem}
                className="flex-1 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="space-y-0.5 min-w-0 pr-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{previewItem.name}</h3>
                <p className="text-[11px] text-slate-400 truncate">{previewItem.url}</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/5 dark:bg-slate-950/40 rounded-2xl min-h-[250px]">
              {previewItem.type === 'image' || previewItem.type === 'gif' ? (
                <img src={previewItem.url} alt={previewItem.name} className="max-h-[60vh] max-w-full object-contain rounded-xl" />
              ) : previewItem.type === 'video' ? (
                <video src={previewItem.url} controls className="max-h-[60vh] w-full rounded-xl" />
              ) : previewItem.type === 'audio' ? (
                <audio src={previewItem.url} controls className="w-full" />
              ) : (
                <div className="text-center space-y-3">
                  <FileText className="w-16 h-16 text-[#00B074] mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Document preview available via direct URL.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={previewItem.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00B074] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Direct URL
              </a>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadMedia(previewItem.url, previewItem.name)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" /> Download
                </button>
                <button
                  onClick={() => copyToClipboard(previewItem)}
                  className="px-4 py-2 bg-[#00B074] hover:bg-[#009864] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-[#00B074]/20"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
