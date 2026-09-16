"use client";

import { AlertCircle, RotateCcw, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnsavedChangesBarProps {
  hasUnsavedChanges: boolean;
  unsavedCount: number;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
  isRtl?: boolean;
}

export default function UnsavedChangesBar({
  hasUnsavedChanges,
  unsavedCount,
  isSaving,
  onSave,
  onReset,
  isRtl = false,
}: UnsavedChangesBarProps) {
  if (!hasUnsavedChanges) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h5 className="text-xs sm:text-sm font-black truncate">
              {unsavedCount} Unsaved Permission Change{unsavedCount !== 1 ? "s" : ""}
            </h5>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              Remember to save your changes to apply them to the user.
            </p>
          </div>
        </div>

        <div className={cn("flex items-center gap-2 shrink-0 self-end sm:self-center", isRtl ? "flex-row-reverse" : "")}>
          <button
            type="button"
            onClick={onReset}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-black shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
