"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, X, Zap } from "lucide-react";

interface PlanExpiryBannerProps {
  isExpired: boolean;
  daysRemaining?: number;
  endDate?: string | null;
  planName?: string;
}

export function PlanExpiryBanner({ isExpired, daysRemaining = 0, endDate, planName }: PlanExpiryBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  // Render for expired status
  if (isExpired) {
    return (
      <div className="mb-6 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-amber-500/10 dark:from-rose-950/40 dark:via-rose-900/20 dark:to-amber-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4 sm:p-5 relative shadow-sm transition-all animate-in fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-700 dark:text-rose-400 tracking-tight">
                  PLAN EXPIRED — WHATSAPP API SUSPENDED
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                Your {planName || "current"} plan has expired. WhatsApp API messaging is suspended until renewed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-rose-200/50 dark:border-rose-800/40">
            <Link
              href="/dashboard/billing"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md shadow-rose-600/20 transition-all"
            >
              Renew Plan Now
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            
          </div>
        </div>
      </div>
    );
  }

  // Render for warning status (<= 7 days left)
  if (daysRemaining <= 7) {
    const isCritical = daysRemaining <= 3;
    return (
      <div className={`mb-6 rounded-2xl p-4 sm:p-5 relative shadow-sm border transition-all ${
        isCritical 
          ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 border-amber-300 dark:border-amber-800/60" 
          : "bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/50"
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-800 dark:text-amber-300 tracking-tight">
                  ⚠️ Your {planName || "Subscription"} Plan Expires in {daysRemaining} Day{daysRemaining === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                Renew before expiration to prevent any disruption to your WhatsApp API connectivity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/50 dark:border-amber-800/40">
            <Link
              href="/dashboard/billing"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md shadow-amber-600/20 transition-all"
            >
              Renew Plan
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-amber-500/10 transition-colors"
              title="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
