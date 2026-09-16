'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { deletePipelineStage } from '@/app/actions/pipeline';
import type { PipelineStageData } from './PipelineColumn';

interface DeleteStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: PipelineStageData | null;
  onSuccess: () => void;
}

export function DeleteStageModal({
  isOpen,
  onClose,
  stage,
  onSuccess,
}: DeleteStageModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!stage) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deletePipelineStage(stage.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Stage "${stage.name}" deleted`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error('Failed to delete stage');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] p-6 rounded-3xl bg-white dark:bg-[#0B132B] border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
            Delete Stage &ldquo;{stage.name}&rdquo;?
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Are you sure you want to remove this stage from the pipeline?
            <br />
            <br />
            <strong className="text-slate-700 dark:text-slate-200">Note:</strong> None of your contacts or their tags will be deleted. Any contacts currently in this stage will simply become unassigned or move to their other matching stages.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isDeleting ? 'Deleting...' : 'Delete Stage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
