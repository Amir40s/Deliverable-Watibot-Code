"use client"

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendConnectedFacebookMessage } from '@/app/actions/facebook-page'
import { sendConnectedInstagramMessage } from '@/app/actions/instagram-page'
import { MessageSquare, Image as ImageIcon, FileText, Video, Mic, MapPin, Smile, Reply, X, Send, Smartphone, MessageCircle, Facebook, Instagram } from 'lucide-react'
import { format12HourTime } from '@/lib/utils'

interface InboundMessageToastProps {
  toastId: string | number
  payload: {
    messageId?: string
    contactId?: string
    contactName?: string
    contactNumber?: string
    content?: string
    platform?: string
    type?: string
    createdAt?: string
  }
}

export function InboundMessageToast({ toastId, payload }: InboundMessageToastProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const isWhatsapp = !payload.platform || payload.platform === 'WHATSAPP'
  const isFacebook = payload.platform === 'FACEBOOK' || payload.platform === 'FACEBOOK_COMMENT'
  const isInstagram = payload.platform === 'INSTAGRAM' || payload.platform === 'INSTAGRAM_COMMENT'

  const PlatformIcon = isWhatsapp ? MessageCircle : isFacebook ? Facebook : isInstagram ? Instagram : Smartphone
  const platformColor = isWhatsapp ? 'text-green-500' : isFacebook ? 'text-blue-500' : isInstagram ? 'text-pink-500' : 'text-slate-500'

  const senderName = payload.contactName || payload.contactNumber || 'Unknown Contact'
  const displayId = payload.contactNumber && payload.contactNumber !== senderName ? `(${payload.contactNumber})` : ''
  const timeString = format12HourTime(new Date())

let msgPreview = payload.content || 'Sent a message'
  let TypeIcon = MessageSquare
  
  if (payload.type === 'image') {
    TypeIcon = ImageIcon
    msgPreview = payload.content && payload.content !== '[Image]' ? payload.content : 'Sent an image'
  } else if (payload.type === 'video') {
    TypeIcon = Video
    msgPreview = payload.content && payload.content !== '[Video]' ? payload.content : 'Sent a video'
  } else if (payload.type === 'audio') {
    TypeIcon = Mic
    msgPreview = payload.content && payload.content !== '[Audio]' ? payload.content : 'Sent a voice message'
  } else if (payload.type === 'document') {
    TypeIcon = FileText
    msgPreview = payload.content && payload.content !== '[Document]' ? payload.content : 'Sent a document'
  } else if (payload.type === 'location') {
    TypeIcon = MapPin
    msgPreview = 'Sent a location'
  } else if (payload.type === 'sticker') {
    TypeIcon = Smile
    msgPreview = 'Sent a sticker'
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !payload.contactId) return
    
    setIsSending(true)
    try {
      if (isWhatsapp) {
        await sendWhatsAppMessage(payload.contactId, replyText.trim())
      } else if (isFacebook) {
        await sendConnectedFacebookMessage(payload.contactId, replyText.trim())
      } else if (isInstagram) {
        await sendConnectedInstagramMessage(payload.contactId, replyText.trim())
      }
      toast.success('Reply sent successfully')
      toast.dismiss(toastId)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reply')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-3.5 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] border border-slate-200/60 dark:border-slate-800/80 pointer-events-auto plus-jakarta-forced">
       <div className="flex items-start justify-between w-full">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-slate-50 dark:bg-slate-800 ${platformColor}`}>
            <PlatformIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-black text-slate-900 dark:text-slate-100 line-clamp-1 leading-tight">
              {senderName} <span className="text-xs font-semibold text-slate-400 font-normal">{displayId}</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500 mt-0.5">
              {isWhatsapp ? 'WhatsApp' : isFacebook ? 'Facebook' : isInstagram ? 'Instagram' : 'WatiBot'} • {timeString}
            </span>
          </div>
        </div>
        {!isReplying && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 -mr-1 -mt-1" 
            onClick={() => toast.dismiss(toastId)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

       <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2.5">
          <TypeIcon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 break-words line-clamp-3 leading-relaxed">
            {msgPreview}
          </p>
        </div>
      </div>

       {!isReplying ? (
        <Button 
          onClick={() => setIsReplying(true)}
          className="w-full h-10 text-[13px] font-black rounded-xl gap-2 transition-all shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Reply className="w-4 h-4" />
          Reply via {isWhatsapp ? 'WhatsApp' : isFacebook ? 'Messenger' : 'Instagram'}
        </Button>
      ) : (
        <div className="flex items-center gap-2 mt-1 animate-in slide-in-from-top-2 fade-in duration-200">
          <Input 
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendReply()
              }
            }}
            placeholder="Type your reply..."
            className="h-10 text-[13px] font-medium rounded-xl focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-700 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            disabled={isSending}
          />
          <Button 
            size="icon" 
            className="h-10 w-10 shrink-0 rounded-xl shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleSendReply}
            disabled={!replyText.trim() || isSending}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
