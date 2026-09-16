"use client";

import { ShieldCheck, Eye, Edit3, Ban, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface PermissionStats {
  total: number;
  full: number;
  edit: number;
  view: number;
  none: number;
}

interface PermissionOverviewStatsProps {
  stats: PermissionStats;
  isRtl?: boolean;
}

export default function PermissionOverviewStats({
  stats,
  isRtl = false,
}: PermissionOverviewStatsProps) {
  const total = stats.total || 1;
  const fullPercent = Math.round((stats.full / total) * 100);
  const editPercent = Math.round((stats.edit / total) * 100);
  const viewPercent = Math.round((stats.view / total) * 100);
  const nonePercent = Math.round((stats.none / total) * 100);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4 text-start">
      {/* Top Header & Distribution Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Permission Allocation Distribution
          </span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {stats.full} of {stats.total} modules granted full access ({fullPercent}%)
          </span>
        </div>

        {/* Thin Multi-color Progress Distribution Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          {stats.full > 0 && (
            <div
              style={{ width: `${fullPercent}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
              title={`Full Access: ${stats.full} (${fullPercent}%)`}
            />
          )}
          {stats.edit > 0 && (
            <div
              style={{ width: `${editPercent}%` }}
              className="h-full bg-amber-500 transition-all duration-300"
              title={`Edit Access: ${stats.edit} (${editPercent}%)`}
            />
          )}
          {stats.view > 0 && (
            <div
              style={{ width: `${viewPercent}%` }}
              className="h-full bg-blue-500 transition-all duration-300"
              title={`View Only: ${stats.view} (${viewPercent}%)`}
            />
          )}
          {stats.none > 0 && (
            <div
              style={{ width: `${nonePercent}%` }}
              className="h-full bg-rose-500 transition-all duration-300"
              title={`No Access: ${stats.none} (${nonePercent}%)`}
            />
          )}
        </div>
      </div>

      {/* 4 Compact Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total Modules */}
        <div className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
              {stats.total}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              Total Modules
            </p>
          </div>
        </div>

        {/* Card 2: Full Access */}
        <div className="p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-[#00B074] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 leading-none">
              {stats.full}
            </div>
            <p className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider mt-1">
              Full Access
            </p>
          </div>
        </div>

        {/* Card 3: View Only */}
        <div className="p-3.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-blue-700 dark:text-blue-400 leading-none">
              {stats.view}
            </div>
            <p className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider mt-1">
              View Only
            </p>
          </div>
        </div>

        {/* Card 4: No Access */}
        <div className="p-3.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Ban className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xl font-black text-rose-700 dark:text-rose-400 leading-none">
              {stats.none}
            </div>
            <p className="text-[10px] font-bold text-rose-600/80 dark:text-rose-400/80 uppercase tracking-wider mt-1">
              No Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
