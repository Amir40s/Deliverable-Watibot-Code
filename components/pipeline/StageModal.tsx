'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag as TagIcon, Sparkles, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createPipelineStage, updatePipelineStage } from '@/app/actions/pipeline';
import { createTag } from '@/app/actions/tags';
import type { PipelineStageData } from './PipelineColumn';

interface TagOption {
  id: string;
  name: string;
  color?: string | null;
}

interface StageModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage?: PipelineStageData | null;
  availableTags: TagOption[];
  pipelineId?: string;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#059669', // Dark Emerald
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#F43F5E', // Rose
  '#64748B', // Slate
];

export function StageModal({
  isOpen,
  onClose,
  stage,
  availableTags: initialTags,
  pipelineId,
  onSuccess,
}: StageModalProps) {
  const isEditing = !!stage;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10B981');
  const [selectedTagId, setSelectedTagId] = useState<string>('none');
  const [availableTags, setAvailableTags] = useState<TagOption[]>(initialTags);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick inline new tag state
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isSavingNewTag, setIsSavingNewTag] = useState(false);

  useEffect(() => {
    setAvailableTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color || '#10B981');
      setSelectedTagId(stage.tagId || 'none');
    } else {
      setName('');
      setColor('#10B981');
      setSelectedTagId('none');
    }
    setIsCreatingTag(false);
    setNewTagName('');
  }, [stage, isOpen]);

  const handleCreateTagInline = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setIsSavingNewTag(true);
    try {
      const res = await createTag(trimmed, color, 'Journey');
      if (res && (res as any).tag) {
        const createdTag = (res as any).tag;
        setAvailableTags((prev) => [...prev, createdTag]);
        setSelectedTagId(createdTag.id);
        setIsCreatingTag(false);
        setNewTagName('');
        toast.success(`Tag "#${createdTag.name}" created and selected`);
      } else if (res && (res as any).error) {
        toast.error((res as any).error);
      }
    } catch (err: any) {
      toast.error('Failed to create tag');
    } finally {
      setIsSavingNewTag(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Stage name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const tagId = selectedTagId === 'none' ? null : selectedTagId;

      if (isEditing && stage) {
        const res = await updatePipelineStage(stage.id, {
          name: name.trim(),
          color,
          tagId,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success('Stage updated successfully');
          onSuccess();
          onClose();
        }
      } else {
        const res = await createPipelineStage({
          pipelineId,
          name: name.trim(),
          color,
          tagId,
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success('Stage created successfully');
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTag = availableTags.find((t) => t.id === selectedTagId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 rounded-3xl bg-white dark:bg-[#0B132B] border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <div
              style={{ backgroundColor: color }}
              className="w-3.5 h-3.5 rounded-full ring-4 ring-slate-100 dark:ring-slate-800"
            />
            {isEditing ? 'Edit Journey Stage' : 'Add Journey Stage'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Stage Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Stage Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Qualified, Follow-up, Closed Won"
              className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm focus-visible:ring-emerald-500"
              autoFocus
            />
          </div>

          {/* Color Palette */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Stage Color Accent
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs"
                >
                  {color.toLowerCase() === c.toLowerCase() && (
                    <Check className="w-4 h-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-7 h-7 rounded-full border-0 cursor-pointer overflow-hidden p-0"
                />
                <span className="text-xs font-mono text-slate-400">{color.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Associated Tag (Condition Rule) */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5 text-emerald-500" />
                Associated Tag (Auto-Movement Rule)
              </Label>
              {!isCreatingTag && (
                <button
                  type="button"
                  onClick={() => setIsCreatingTag(true)}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Tag
                </button>
              )}
            </div>

            {isCreatingTag ? (
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter new tag name (e.g. vip-client)"
                    className="h-8 text-xs bg-white dark:bg-slate-900 border-emerald-300"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateTagInline}
                    disabled={isSavingNewTag || !newTagName.trim()}
                    className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shrink-0"
                  >
                    {isSavingNewTag ? 'Saving...' : 'Add'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCreatingTag(false)}
                    className="h-8 px-2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
                  <SelectValue placeholder="Select a tag..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  <SelectItem value="none" className="text-xs text-slate-500">
                    No Associated Tag (Manual Only)
                  </SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          style={{ backgroundColor: tag.color || '#10B981' }}
                          className="w-2 h-2 rounded-full"
                        />
                        <span>#{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Rule explanation alert */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-[11.5px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                How this stage works:
              </div>
              {selectedTagId !== 'none' && selectedTag ? (
                <p>
                  Any contact tagged with{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    #{selectedTag.name}
                  </strong>{' '}
                  anywhere in the CRM (Live Chat, Bot Flows, or Contacts Table) will automatically appear in this stage.
                </p>
              ) : (
                <p>
                  This stage will only be updated when contacts are manually moved into it.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Stage'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
