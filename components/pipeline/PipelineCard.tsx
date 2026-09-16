'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, Clock, GripVertical, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface PipelineContact {
  id: string;
  waId: string;
  name?: string | null;
  whatsappName?: string | null;
  email?: string | null;
  profilePic?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: Date | string | null;
  unreadCount?: number;
  platform?: string;
  notes?: string | null;
  createdAt?: Date | string | null;
  tags: Array<{ id: string; name: string; color: string | null }>;
  assignedUsers?: Array<{ id: string; name: string | null; email: string; image?: string | null }>;
}

interface PipelineCardProps {
  contact: PipelineContact;
  stageId: string;
  onOpenChat: (contact: PipelineContact) => void;
  onOpenProfile: (contact: PipelineContact) => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  '92': 'pk',
  '91': 'in',
  '880': 'bd',
  '971': 'ae',
  '44': 'gb',
  '1': 'us',
  '62': 'id',
  '55': 'br',
  '234': 'ng',
  '63': 'ph',
  '20': 'eg',
  '27': 'za',
  '33': 'fr',
  '49': 'de',
  '61': 'au',
  '86': 'cn',
  '81': 'jp',
  '966': 'sa',
  '60': 'my',
  '65': 'sg',
  '34': 'es',
  '39': 'it',
  '52': 'mx',
  '94': 'lk',
  '977': 'np',
};

function getCountryFlag(waId: string) {
  if (!waId) return null;
  const p3 = waId.substring(0, 3);
  if (COUNTRY_FLAGS[p3]) return `https://flagcdn.com/w40/${COUNTRY_FLAGS[p3]}.png`;
  const p2 = waId.substring(0, 2);
  if (COUNTRY_FLAGS[p2]) return `https://flagcdn.com/w40/${COUNTRY_FLAGS[p2]}.png`;
  const p1 = waId.substring(0, 1);
  if (COUNTRY_FLAGS[p1]) return `https://flagcdn.com/w40/${COUNTRY_FLAGS[p1]}.png`;
  return null;
}

function PipelineCardContent({
  contact,
  onOpenChat,
  onOpenProfile,
  isDragging,
  isOverlay,
  dragHandleProps,
}: {
  contact: PipelineContact;
  onOpenChat: (contact: PipelineContact) => void;
  onOpenProfile: (contact: PipelineContact) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: Record<string, any>;
}) {
  const displayName = contact.name || contact.whatsappName || `+${contact.waId}`;
  const flagUrl = getCountryFlag(contact.waId);

  const [showInlineReply, setShowInlineReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentLastMessage, setCurrentLastMessage] = useState(contact.lastMessage);

  const handleSendQuickReply = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const res = await sendWhatsAppMessage(contact.id, replyText.trim());
      if (res.success) {
        toast.success(`Quick reply sent to ${displayName}`);
        setCurrentLastMessage(replyText.trim());
        setReplyText('');
        setShowInlineReply(false);
      } else {
        toast.error(res.error || 'Failed to send quick reply');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error sending quick reply');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className={cn(
        'group relative bg-white dark:bg-[#111C2E] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-shadow duration-150 select-none',
        isDragging && 'opacity-25 border-dashed border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/30 shadow-none',
        isOverlay &&
          'shadow-2xl ring-2 ring-emerald-500/70 border-emerald-500/60 rotate-2 scale-[1.02] cursor-grabbing bg-white dark:bg-[#111C2E] z-50'
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Specific Pointer Drag Handle */}
          {dragHandleProps ? (
            <div
              {...dragHandleProps}
              title="Hold and drag to move lead"
              className="p-1 rounded-lg text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors shrink-0 touch-none"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 text-slate-300 dark:text-slate-600 shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          <div className="relative shrink-0">
            <Avatar className="h-9 w-9 rounded-xl border border-slate-100 dark:border-slate-800">
              <AvatarImage src={contact.profilePic || undefined} alt={displayName} />
              <AvatarFallback className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {flagUrl && (
              <img
                src={flagUrl}
                alt="flag"
                className="absolute -bottom-1 -right-1 w-3.5 h-2.5 rounded-sm object-cover shadow-xs border border-white dark:border-slate-900"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(contact);
              }}
              className="font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              title={displayName}
            >
              {displayName}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
              <Phone className="w-3 h-3 shrink-0" />
              <span>+{contact.waId}</span>
            </div>
          </div>
        </div>

        {(contact.unreadCount ?? 0) > 0 && (
          <span className="shrink-0 bg-emerald-500 text-white font-bold text-[10px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {contact.unreadCount}
          </span>
        )}
      </div>

      {/* Customer Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {contact.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              style={{
                backgroundColor: tag.color ? `${tag.color}15` : '#10B98115',
                color: tag.color || '#10B981',
                borderColor: tag.color ? `${tag.color}30` : '#10B98130',
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md border truncate max-w-[120px]"
            >
              #{tag.name}
            </span>
          ))}
          {contact.tags.length > 3 && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 self-center">
              +{contact.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Customer Last Message Preview */}
      {currentLastMessage && (
        <div className="bg-slate-50/90 dark:bg-slate-900/70 rounded-xl p-2.5 my-2 border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-[#00B074] shrink-0 mt-0.5" />
          <p className="line-clamp-2 leading-tight font-medium break-words flex-1">
            {currentLastMessage}
          </p>
        </div>
      )}

      {/* Inline Quick Reply Input Box */}
      {showInlineReply && (
        <form
          onSubmit={handleSendQuickReply}
          onClick={(e) => e.stopPropagation()}
          className="my-2.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-1.5">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type quick reply..."
              className="h-8 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-[#00B074]"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSending || !replyText.trim()}
              className="h-8 w-8 shrink-0 bg-[#00B074] hover:bg-[#00B074]/90 text-white rounded-xl border-none cursor-pointer"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </form>
      )}

      {/* Footer bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>
            {contact.lastMessageAt
              ? new Date(contact.lastMessageAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : 'New'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setShowInlineReply(!showInlineReply);
            }}
            className="h-7 px-2 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            Quick Reply
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChat(contact);
            }}
            className="h-7 px-2 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg gap-1 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Full Chat
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PipelineCardOverlay({
  contact,
  onOpenChat,
  onOpenProfile,
}: Pick<PipelineCardProps, 'contact' | 'onOpenChat' | 'onOpenProfile'>) {
  return (
    <PipelineCardContent
      contact={contact}
      onOpenChat={onOpenChat}
      onOpenProfile={onOpenProfile}
      isOverlay
    />
  );
}

export function PipelineCard({
  contact,
  stageId,
  onOpenChat,
  onOpenProfile,
}: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({
    id: contact.id,
    data: {
      type: 'card',
      contactId: contact.id,
      stageId,
      contact,
    },
    disabled: false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    willChange: isDragging ? 'transform, opacity' : undefined,
  };

  const showDropIndicatorBefore = isOver && active?.id !== contact.id;

  const dragHandleProps = {
    ref: setActivatorNodeRef,
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative touch-none">
      {showDropIndicatorBefore && (
        <div className="absolute -top-1.5 left-0 right-0 h-1 bg-emerald-500 rounded-full shadow-md z-20 pointer-events-none" />
      )}

      <PipelineCardContent
        contact={contact}
        onOpenChat={onOpenChat}
        onOpenProfile={onOpenProfile}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
      />
    </div>
  );
}
