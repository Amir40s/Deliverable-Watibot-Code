"use client";

import { useState, useEffect, useRef } from 'react';
import { 
 Dialog, 
 DialogContent, 
 DialogHeader, 
 DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
 Search, 
 CloudUpload, 
 Trash2, 
 X, 
 Image as ImageIcon, 
 Music, 
 Film, 
 FileText,
 Loader2,
 Check,
 Sparkles,
 Pencil,
 LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { UploadButtonWithProgress } from '@/components/media-library/UploadButtonWithProgress';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'gif' | 'audio' | 'video' | 'document';
  name: string;
  createdAt: string;
}

interface MediaLibraryModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelect?: (url: string, name?: string, type?: string) => void;
 onSelectMultiple?: (items: { url: string; name: string; type: string }[]) => void;
 multiple?: boolean;
 contentType?: 'image' | 'gif' | 'video' | 'audio' | 'document' | 'all';
}

export function MediaLibraryModal({ isOpen, onClose, onSelect, onSelectMultiple, multiple = false, contentType = 'all' }: MediaLibraryModalProps) {
 const { data: session } = useSession();

 const [activeTab, setActiveTab] = useState<'all' | 'image' | 'gif' | 'audio' | 'video' | 'document'>(contentType);
 const [selectedItems, setSelectedItems] = useState<{ url: string; name: string; type: string }[]>([]);
 const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
 const [search, setSearch] = useState('');
 const [isUploading, setIsUploading] = useState(false);
 const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
 const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Pagination States
 const [currentPage, setCurrentPage] = useState(1);
 const [showAll, setShowAll] = useState(false);
 const itemsPerPage = 10;

 const formatDate = (dateStr: string) => {
   try {
     const date = new Date(dateStr);
     return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
   } catch (e) {
     return '';
   }
 };

  useEffect(() => {
   if (isOpen) {
     setActiveTab(contentType);
   }
 }, [contentType, isOpen]);

 // Reset page on tab or search change
 useEffect(() => {
   setCurrentPage(1);
 }, [activeTab, search]);

  const fetchMediaItems = async () => {
    try {
      const response = await axios.get('/api/media-library');
      setMediaItems(response.data);
    } catch (error) {
      console.error('Failed to fetch media library items', error);
      toast.error('Failed to load media library');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
      fetchMediaItems();
    }
  }, [isOpen]);

  const isItemSelected = (url: string) => selectedItems.some(i => i.url === url);

  const handleItemClick = (item: MediaItem) => {
    if (multiple) {
      if (isItemSelected(item.url)) {
        setSelectedItems(prev => prev.filter(i => i.url !== item.url));
      } else {
        setSelectedItems(prev => [...prev, { url: item.url, name: item.name, type: item.type }]);
      }
    } else {
      onSelect?.(item.url, item.name, item.type);
      onClose();
    }
  };
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
     const response = await axios.post('/api/upload', formData);
     const result = response.data;
     if (result.url) {
       const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
       const resolvedType = fileExt === 'gif' ? 'gif' : (activeTab === 'all' ? (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document') : activeTab);

        const newMediaPayload = {
          url: result.url,
          type: resolvedType,
          name: file.name,
        };

        const dbResponse = await axios.post('/api/media-library', newMediaPayload);
        const newMedia = dbResponse.data;

        const updatedItems = [newMedia, ...mediaItems];
        setMediaItems(updatedItems);
        toast.success("Media uploaded and added to library");

        // Auto-select uploaded file
        onSelect?.(result.url, file.name, resolvedType);
       onClose();
     } else {
       toast.error(result.error || "Upload failed");
     }
   } catch (error: any) {
     toast.error(error.response?.data?.error || "Error uploading file");
   } finally {
     setIsUploading(false);
     if (fileInputRef.current) fileInputRef.current.value = '';
   }
 };

 const handleDeleteItem = (e: React.MouseEvent, id: string) => {
   e.stopPropagation();
   setDeletingItemId(id);
 };

  const confirmDeleteItem = async () => {
    if (deletingItemId) {
      try {
        await axios.delete(`/api/media-library/${deletingItemId}`);
        const updated = mediaItems.filter(item => item.id !== deletingItemId);
        setMediaItems(updated);
        toast.success("Item removed from library");
        setDeletingItemId(null);
      } catch (error) {
        console.error('Failed to delete item', error);
        toast.error('Failed to remove item');
      }
    }
  };

 const handleRenameClick = (e: React.MouseEvent, item: MediaItem) => {
   e.stopPropagation();
   setEditingItem({ id: item.id, name: item.name });
 };

  const confirmRenameItem = async () => {
    // Note: Rename API not implemented yet, just updating local state for now.
    if (editingItem && editingItem.name.trim()) {
      const updated = mediaItems.map(item => {
        if (item.id === editingItem.id) {
          return { ...item, name: editingItem.name.trim() };
        }
        return item;
      });
      setMediaItems(updated);
      toast.success("Item renamed locally");
      setEditingItem(null);
    }
  };

 // Filter items by tab and search query
 const filteredItems = mediaItems.filter(item => {
   const matchesTab = activeTab === 'all' || item.type === activeTab;
   const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
   return matchesTab && matchesSearch;
 });

 // Paginated Slicing
 const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
 const paginatedItems = showAll 
   ? filteredItems 
   : filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

 const counts = {
   all: mediaItems.length,
   image: mediaItems.filter(i => i.type === 'image').length,
   gif: mediaItems.filter(i => i.type === 'gif').length,
   audio: mediaItems.filter(i => i.type === 'audio').length,
   video: mediaItems.filter(i => i.type === 'video').length,
   document: mediaItems.filter(i => i.type === 'document').length,
 };

 const tabs = [
   { id: 'all', label: 'All Files', icon: LayoutGrid, count: counts.all },
   { id: 'image', label: 'Image', icon: ImageIcon, count: counts.image },
   { id: 'gif', label: 'GIF', icon: Sparkles, count: counts.gif },
   { id: 'audio', label: 'Audio', icon: Music, count: counts.audio },
   { id: 'video', label: 'Video', icon: Film, count: counts.video },
   { id: 'document', label: 'Document', icon: FileText, count: counts.document },
 ];

  return (
   <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
   <DialogContent className="w-[95vw] md:w-full max-w-4xl h-[90vh] md:h-[80vh] max-h-[90vh] md:max-h-[85vh] p-0 overflow-hidden bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-[32px] shadow-2xl plus-jakarta-forced flex flex-col transition-all duration-300">
    {/* Native hidden file input */}
    <input 
      type="file" 
      ref={fileInputRef} 
      onChange={handleFileUpload} 
      className="hidden" 
      accept={
        activeTab === 'image' ? 'image/*' : 
        activeTab === 'gif' ? 'image/gif' :
        activeTab === 'video' ? 'video/*' : 
        activeTab === 'audio' ? 'audio/*' : 
        '*/*'
      }
    />

    {/* Header Section */}
    <div className="p-6 md:p-8 pb-3 border-b border-slate-100 dark:border-slate-900/50 shrink-0">
     <div className="flex items-center justify-between mb-5">
      <div>
        <DialogTitle className="text-2xl font-extrabold text-[#00B074] dark:text-emerald-400 font-sans tracking-tight">
          Media Library
        </DialogTitle>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">
          {mediaItems.length} items total in your workspace library
        </p>

        {/* Media Size Limits Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Limits:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ImageIcon className="w-2.5 h-2.5" /> Images: 15MB
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Music className="w-2.5 h-2.5" /> Audio: 25MB
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Film className="w-2.5 h-2.5" /> Videos: 100MB
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <FileText className="w-2.5 h-2.5" /> Docs: 50MB
          </span>
        </div>
      </div>
     </div>

     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
      <div className="relative flex-1">
       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
       <Input 
         placeholder="Search media by file name..." 
         value={search}
         onChange={(e) => setSearch(e.target.value)}
         className="pl-11 h-11 bg-slate-50 dark:bg-slate-900/40 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 focus:border-[#00B074] dark:focus:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 placeholder-slate-400 transition-all focus-visible:ring-0"
       />
      </div>
      <UploadButtonWithProgress
        buttonText="Upload New"
        activeTypeTab={activeTab}
        onUploadSuccess={(payload) => {
          if (payload.dbItem) {
            setMediaItems((prev) => [payload.dbItem, ...prev]);
            onSelect?.(payload.url, payload.name);
            onClose();
          } else {
            fetchMediaItems();
          }
        }}
      />
     </div>

     {/* Tabs Navigation */}
     <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1.5 -mb-3">
      {tabs.map((tab) => (
       <button
         key={tab.id}
         onClick={() => setActiveTab(tab.id as any)}
         className={cn(
          "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border border-transparent select-none cursor-pointer",
          activeTab === tab.id 
           ? "bg-[#00B074]/10 text-[#00B074] dark:bg-emerald-500/10 dark:text-emerald-400" 
           : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
         )}
       >
        <tab.icon className="w-4 h-4" />
        <span>{tab.label}</span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-md font-extrabold leading-none",
          activeTab === tab.id
            ? "bg-[#00B074]/20 text-[#00B074] dark:bg-emerald-500/20 dark:text-emerald-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
        )}>
          {tab.count}
        </span>
       </button>
      ))}
     </div>
    </div>

    {/* Content Area */}
    <div className="flex-1 flex flex-col justify-between p-6 md:p-8 bg-slate-50/30 dark:bg-slate-900/10 min-h-0">
     <div className="flex-1 overflow-y-auto pr-1">
      {paginatedItems.length === 0 ? (
        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4 border border-slate-100/50 dark:border-slate-800">
            <ImageIcon className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">No files found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] leading-relaxed font-bold">
            Upload a new file from your computer or search with a different keyword.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4.5">
          {paginatedItems.map((item) => {
            const selected = isItemSelected(item.url);
            return (
            <div 
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={cn(
                "group relative bg-white dark:bg-slate-950 rounded-2xl p-2 border border-slate-100 dark:border-slate-900 hover:border-[#00B074] dark:hover:border-emerald-500 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-44 overflow-hidden",
                multiple && selected && "border-[#00B074] dark:border-emerald-500 ring-2 ring-[#00B074]/20 shadow-md"
              )}
            >
              {/* Thumbnail Preview */}
              <div className="relative h-28 w-full bg-slate-50 dark:bg-slate-900/60 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                {/* Multi-select checkbox indicator */}
                {multiple && (
                  <div className={cn(
                    "absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10",
                    selected
                      ? "bg-[#00B074] text-white shadow-md ring-2 ring-white dark:ring-slate-900"
                      : "bg-white/85 dark:bg-slate-900/85 border border-slate-300 dark:border-slate-600 text-transparent"
                  )}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}

                {item.type === 'image' || item.type === 'gif' ? (
                  <img 
                    src={item.url} 
                    alt={item.name} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : item.type === 'audio' ? (
                  <Music className="w-10 h-10 text-[#00B074]/80 dark:text-emerald-400" />
                ) : item.type === 'video' ? (
                  <Film className="w-10 h-10 text-[#00B074]/80 dark:text-emerald-400" />
                ) : (
                  <FileText className="w-10 h-10 text-[#00B074]/80 dark:text-emerald-400" />
                )}

                 <div className="absolute top-1.5 right-1.5 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border border-white/20 dark:border-white/5 p-1 rounded-xl flex items-center gap-1 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={(e) => handleRenameClick(e, item)}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-[#00B074] dark:hover:text-emerald-400 transition-all shrink-0 cursor-pointer"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-all shrink-0 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Selection Check Overlay on Hover (Single mode) */}
                {!multiple && (
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-[#00B074] text-white flex items-center justify-center font-extrabold shadow-lg scale-90 group-hover:scale-100 transition-transform">
                      <Check className="w-4.5 h-4.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Title / Info Bar */}
              <div className="mt-2.5 flex flex-col min-w-0 px-1">
                <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 truncate leading-tight" title={item.name}>
                  {item.name}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-extrabold">
                  {formatDate(item.createdAt)}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}
     </div>

      {/* Multi-Select Action Bar */}
      {multiple && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50 -mx-6 -mb-6 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {selectedItems.length > 0 ? `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} selected` : 'Click items to select multiple'}
            </span>
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="text-xs text-rose-500 hover:underline font-semibold cursor-pointer ml-2"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-xl font-semibold text-xs h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedItems.length === 0}
              onClick={() => {
                onSelectMultiple?.(selectedItems);
                onClose();
              }}
              className="bg-[#00B074] hover:bg-[#009662] text-white rounded-xl px-5 font-bold text-xs h-9 shadow-md shadow-[#00B074]/15 disabled:opacity-50"
            >
              Done {selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
            </Button>
          </div>
        </div>
      )}

     {/* Pagination Bar */}
     {filteredItems.length > 10 && (
       <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
         <div className="flex items-center gap-2">
           <Button
             variant="outline"
             size="sm"
             onClick={() => setShowAll(!showAll)}
             className={cn(
               "h-9 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 transition-all cursor-pointer",
               showAll 
                 ? "bg-[#00B074] hover:bg-[#00B074]/90 text-white border-none shadow-sm shadow-[#00B074]/15" 
                 : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
             )}
           >
             {showAll ? "Show Paged" : "Show All"}
           </Button>
           <span className="text-xs font-bold text-slate-400 dark:text-slate-500 pl-1">
             {showAll 
               ? `Showing all ${filteredItems.length} items` 
               : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredItems.length)} of ${filteredItems.length}`}
           </span>
         </div>

         {!showAll && totalPages > 1 && (
           <div className="flex items-center gap-1.5">
             <Button
               variant="outline"
               size="sm"
               disabled={currentPage === 1}
               onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
               className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 cursor-pointer"
             >
               Previous
             </Button>
             {Array.from({ length: totalPages }).map((_, index) => {
               const pageNum = index + 1;
               // Limit visible page buttons if too many
               if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                 if (pageNum === 2 || pageNum === totalPages - 1) {
                   return <span key={pageNum} className="text-slate-450 px-1 text-xs">...</span>;
                 }
                 return null;
               }
               return (
                 <Button
                   key={pageNum}
                   variant={currentPage === pageNum ? "default" : "outline"}
                   size="sm"
                   onClick={() => setCurrentPage(pageNum)}
                   className={cn(
                     "w-9 h-9 p-0 rounded-xl font-bold transition-all cursor-pointer",
                     currentPage === pageNum 
                       ? "bg-[#00B074] hover:bg-[#00B074]/90 text-white border-none shadow-sm shadow-[#00B074]/15" 
                       : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                   )}
                 >
                   {pageNum}
                 </Button>
               );
             })}
             <Button
               variant="outline"
               size="sm"
               disabled={currentPage === totalPages}
               onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
               className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-40 cursor-pointer"
             >
               Next
             </Button>
           </div>
         )}
       </div>
     )}
    </div>

    {/* Gorgeous Custom Delete Confirmation Overlay */}
    {deletingItemId && (
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 max-w-sm w-full mx-4 shadow-2xl text-center scale-95 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-7 h-7 text-red-500" />
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Delete File?</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed font-bold">
            Are you sure you want to remove this file from your library? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setDeletingItemId(null)}
              className="flex-1 h-11 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDeleteItem}
              className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-600/20 transition-all active:scale-95 cursor-pointer"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Gorgeous Custom Rename/Edit Overlay */}
    {editingItem && (
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 max-w-sm w-full mx-4 shadow-2xl text-center scale-95 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-[#00B074]/10 dark:bg-emerald-950/20 flex items-center justify-center mx-auto mb-6">
            <Pencil className="w-7 h-7 text-[#00B074] dark:text-emerald-400" />
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Rename File</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-bold">
            Enter a new name for your uploaded media file.
          </p>
          <Input 
            value={editingItem.name}
            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            className="mb-6 h-11 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-[14px] font-semibold focus-visible:ring-1 focus-visible:ring-[#00B074]/20"
          />
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setEditingItem(null)}
              className="flex-1 h-11 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmRenameItem}
              className="flex-1 h-11 rounded-xl bg-[#00B074] hover:bg-[#00B074]/90 text-white font-bold shadow-lg shadow-[#00B074]/20 transition-all active:scale-95 cursor-pointer"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    )}
   </DialogContent>
  </Dialog>
 );
}
