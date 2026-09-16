"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { getEmbeddableVideoUrl, isDirectVideoAsset } from "@/lib/tutorial-videos"

interface VideoModalProps {
 isOpen: boolean
 onOpenChange: (open: boolean) => void
 videoUrl: string
}

export function VideoModal({ isOpen, onOpenChange, videoUrl }: VideoModalProps) {
 if (!videoUrl) return null

 const playerUrl = getEmbeddableVideoUrl(videoUrl)
 const isDirectVideo = isDirectVideoAsset(playerUrl)

 return (
 <Dialog open={isOpen} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-black border-none rounded-2xl">
 <div className="relative aspect-video w-full bg-black flex items-center justify-center group">
      <button 
        onClick={() => onOpenChange(false)}
        aria-label="Close video"
        className="absolute top-4 right-4 z-50 text-white/80 hover:text-white bg-black/60 hover:bg-black/80 rounded-full p-2 transition-all shadow-md"
      >
        <X className="w-5 h-5" />
      </button>
      {isDirectVideo ? (
        <video
          src={playerUrl}
          className="w-full h-full object-contain"
          title="Video Player"
          controls
          autoPlay
          playsInline
        />
      ) : (
        <iframe
          src={playerUrl}
          className="w-full h-full"
          title="Video Player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      )}
 </div>
 </DialogContent>
 </Dialog>
 )
}
