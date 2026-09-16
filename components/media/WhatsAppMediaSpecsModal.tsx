"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Search, Image as ImageIcon, Video, Music, Mic, FileText,
  Sparkles, Layers, Info, CheckCircle2, AlertTriangle, ShieldCheck
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface MediaSpecItem {
  type: string
  category: "images" | "video" | "audio" | "stickers" | "other"
  recommendedSize: string
  aspectRatio: string
  maxFileSize: string
  notes: string
  badgeColor?: string
}

export const MEDIA_SPECS: MediaSpecItem[] = [
  {
    type: "Image (Standard Send)",
    category: "images",
    recommendedSize: "Up to ~1600 × 1052 px",
    aspectRatio: "Varies",
    maxFileSize: "5 MB",
    notes: "Compressed automatically by Meta Cloud API.",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
  },
  {
    type: "Image (HD Send)",
    category: "images",
    recommendedSize: "Up to 4096 × 2692 px",
    aspectRatio: "Varies",
    maxFileSize: "5 MB",
    notes: "Better clarity & crisp quality, still compressed.",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
  },
  {
    type: "Image (as Document)",
    category: "images",
    recommendedSize: "Original resolution",
    aspectRatio: "Any",
    maxFileSize: "Up to 2 GB",
    notes: "Zero compression applied. Preserves raw EXIF & quality.",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800"
  },
  {
    type: "Profile Picture",
    category: "images",
    recommendedSize: "1080 × 1080 px",
    aspectRatio: "1:1",
    maxFileSize: "N/A",
    notes: "Keep subject centered (automatically cropped to circle).",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
  },
  {
    type: "Carousel Images (API)",
    category: "images",
    recommendedSize: "1125 × 600 px",
    aspectRatio: "1.91:1",
    maxFileSize: "5 MB (<1 MB recommended)",
    notes: "Must be consistent dimension across all cards in template.",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
  },
  {
    type: "Link Preview (OG Image)",
    category: "images",
    recommendedSize: "1200 × 630 px",
    aspectRatio: "1.91:1",
    maxFileSize: "< 600 KB",
    notes: "Significantly affects link click-through rate & preview speed.",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
  },
  {
    type: "Video (Standard)",
    category: "video",
    recommendedSize: "MP4 (H.264 + AAC)",
    aspectRatio: "Varies",
    maxFileSize: "16 MB",
    notes: "Auto-compressed by Meta (~720p maximum resolution).",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
  },
  {
    type: "Video (as Document)",
    category: "video",
    recommendedSize: "MP4 (H.264 + AAC)",
    aspectRatio: "Any",
    maxFileSize: "Up to 2 GB",
    notes: "No compression applied (supports full 4K UHD videos).",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800"
  },
  {
    type: "Status (Image/Video)",
    category: "video",
    recommendedSize: "1080 × 1920 px",
    aspectRatio: "9:16",
    maxFileSize: "~16 MB (video)",
    notes: "Vertical portrait layout. Avoid top & bottom UI zones.",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800"
  },
  {
    type: "Audio Files",
    category: "audio",
    recommendedSize: "MP3, AAC, WAV, M4A",
    aspectRatio: "N/A",
    maxFileSize: "Up to 2 GB",
    notes: "Best sent as document for uncompressed playback.",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
  },
  {
    type: "Voice Notes",
    category: "audio",
    recommendedSize: "Recorded in-app (OPUS/OGG)",
    aspectRatio: "N/A",
    maxFileSize: "Practically unlimited",
    notes: "Keep under 2 minutes for optimal customer engagement.",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
  },
  {
    type: "Stickers (Static)",
    category: "stickers",
    recommendedSize: "512 × 512 px (WebP)",
    aspectRatio: "1:1",
    maxFileSize: "100 KB",
    notes: "Transparent PNG/WebP background recommended.",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
  },
  {
    type: "Stickers (Animated)",
    category: "stickers",
    recommendedSize: "512 × 512 px (WebP)",
    aspectRatio: "1:1",
    maxFileSize: "500 KB",
    notes: "Max duration 10 seconds. Frame rate 15-30 fps.",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
  }
]

interface WhatsAppMediaSpecsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WhatsAppMediaSpecsModal({ isOpen, onClose }: WhatsAppMediaSpecsModalProps) {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")

  const filteredSpecs = MEDIA_SPECS.filter((spec) => {
    const matchCat = category === "all" || spec.category === category
    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      spec.type.toLowerCase().includes(q) ||
      spec.recommendedSize.toLowerCase().includes(q) ||
      spec.notes.toLowerCase().includes(q) ||
      spec.maxFileSize.toLowerCase().includes(q)

    return matchCat && matchSearch
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-white dark:bg-slate-900 font-sans">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/10 dark:bg-[#00a884]/20 text-[#00a884] flex items-center justify-center font-bold shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                WhatsApp Cloud API Media Specifications
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-semibold mt-0.5">
                Official Meta Cloud API formats, aspect ratios, and file size limitations
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* SEARCH & CATEGORY FILTERS */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search specs by media type, format, max size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs font-semibold"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              {[
                { id: "all", label: "All Types" },
                { id: "images", label: "Images" },
                { id: "video", label: "Videos" },
                { id: "audio", label: "Audio" },
                { id: "stickers", label: "Stickers" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCategory(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                    category === tab.id
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SPECS TABLE */}
        <div className="max-h-[480px] overflow-y-auto p-6 pt-0">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Media Type</th>
                  <th className="py-3 px-4">Recommended Format / Dim</th>
                  <th className="py-3 px-4">Aspect Ratio</th>
                  <th className="py-3 px-4">Max File Size</th>
                  <th className="py-3 px-4">Notes & Requirements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredSpecs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                      No matching media specifications found.
                    </td>
                  </tr>
                ) : (
                  filteredSpecs.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.type}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono text-[11px]">
                        {item.recommendedSize}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.aspectRatio}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-black border", item.badgeColor)}>
                          {item.maxFileSize}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-500 dark:text-slate-400 leading-relaxed min-w-[220px]">
                        {item.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00a884]" />
            Official Meta WhatsApp Business Cloud API Limits
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-95"
          >
            Close
          </button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
