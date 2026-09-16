'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  MoreVertical,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Tag as TagIcon,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PipelineCard, type PipelineContact } from './PipelineCard';
import { cn } from '@/lib/utils';

export interface PipelineStageData {
  id: string;
  name: string;
  order: number;
  color: string;
  tagId?: string | null;
  tag?: { id: string; name: string; color: string | null } | null;
  ruleType: string;
  leads: PipelineContact[];
}

interface PipelineColumnProps {
  stage: PipelineStageData;
  index: number;
  totalStages: number;
  onEditStage: (stage: PipelineStageData) => void;
  onDeleteStage: (stage: PipelineStageData) => void;
  onMoveStage: (stageId: string, direction: 'left' | 'right') => void;
  onOpenChat: (contact: PipelineContact) => void;
  onOpenProfile: (contact: PipelineContact) => void;
}

export function PipelineColumn({
  stage,
  index,
  totalStages,
  onEditStage,
  onDeleteStage,
  onMoveStage,
  onOpenChat,
  onOpenProfile,
}: PipelineColumnProps) {
  const stageColor = stage.color || '#10B981';
  const leadIds = stage.leads.map((lead) => lead.id);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${stage.id}`,
    data: { type: 'column', stageId: stage.id },
  });

  return (
    <div
      className={cn(
        'w-[320px] shrink-0 flex flex-col bg-slate-100/80 dark:bg-[#0B132B]/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 max-h-full transition-all duration-200 shadow-xs select-none',
        isOver &&
          'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500/80 shadow-lg scale-[1.01]'
      )}
    >
      <div
        style={{ backgroundColor: stageColor }}
        className="h-1.5 w-full rounded-t-2xl shrink-0"
      />

      <div className="p-3 pb-2.5 flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/60 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            style={{ backgroundColor: `${stageColor}20`, color: stageColor }}
            className="w-3 h-3 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-slate-900"
          >
            <div style={{ backgroundColor: stageColor }} className="w-1.5 h-1.5 rounded-full" />
          </div>
          <h3 className="font-bold text-[14px] text-slate-800 dark:text-slate-100 truncate">
            {stage.name}
          </h3>
          <span
            style={{ backgroundColor: `${stageColor}15`, color: stageColor }}
            className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
          >
            {stage.leads.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {index > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveStage(stage.id, 'left');
              }}
              title="Move Column Left"
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {index < totalStages - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveStage(stage.id, 'right');
              }}
              title="Move Column Right"
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem onClick={() => onEditStage(stage)} className="gap-2 text-xs">
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                Edit Stage
              </DropdownMenuItem>
              {index > 0 && (
                <DropdownMenuItem onClick={() => onMoveStage(stage.id, 'left')} className="gap-2 text-xs">
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                  Move Left
                </DropdownMenuItem>
              )}
              {index < totalStages - 1 && (
                <DropdownMenuItem onClick={() => onMoveStage(stage.id, 'right')} className="gap-2 text-xs">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  Move Right
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteStage(stage)}
                className="gap-2 text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Stage
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {stage.tag && (
        <div className="px-3.5 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-1.5 border-b border-slate-200/40 dark:border-slate-800/40 text-[10.5px] text-slate-500 dark:text-slate-400">
          <TagIcon className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">
            Auto-assigns: <strong className="font-semibold text-slate-700 dark:text-slate-200">#{stage.tag.name}</strong>
          </span>
        </div>
      )}

      <div
        ref={setNodeRef}
        className="flex-1 p-3 space-y-2.5 overflow-y-auto min-h-[160px] max-h-[calc(100vh-270px)] scrollbar-thin"
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {stage.leads.length === 0 ? (
            <div
              className={cn(
                'h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed rounded-xl transition-all duration-200',
                isOver
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 text-slate-400'
              )}
            >
              <Users className="w-5 h-5 mb-1.5 opacity-60" />
              <p className="text-[12px] font-medium">
                {isOver ? 'Drop lead here to assign' : 'No leads in this stage'}
              </p>
              <p className="text-[10px] opacity-70 mt-0.5">
                {isOver ? 'Release to move' : 'Drag cards here or tag contacts'}
              </p>
            </div>
          ) : (
            stage.leads.map((contact) => (
              <PipelineCard
                key={contact.id}
                contact={contact}
                stageId={stage.id}
                onOpenChat={onOpenChat}
                onOpenProfile={onOpenProfile}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
