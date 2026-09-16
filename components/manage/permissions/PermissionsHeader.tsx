"use client";

import { ShieldCheck, RotateCcw, Save, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PermissionsHeaderProps {
  title?: string;
  subtitle?: string;
  hasUnsavedChanges: boolean;
  unsavedCount: number;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
  isRtl?: boolean;
}

export default function PermissionsHeader({
  title = "Role & Permissions",
  subtitle = "Manage user access, module permissions, and live chat assignment rules.",
  hasUnsavedChanges,
  unsavedCount,
  isSaving,
  onSave,
  onReset,
  isRtl = false,
}: PermissionsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="space-y-1 text-start">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#00B074] border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              {title}
              {hasUnsavedChanges && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  {unsavedCount} Unsaved
                </span>
              )}
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium ps-11">
          {subtitle}
        </p>
      </div>

      <div className={cn("flex items-center gap-2.5 shrink-0", isRtl ? "flex-row-reverse" : "")}>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasUnsavedChanges || isSaving}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Changes
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-bold shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
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
  );
}
