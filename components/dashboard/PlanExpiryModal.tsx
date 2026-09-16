"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, ArrowRight, X } from "lucide-react";

interface PlanExpiryModalProps {
  isExpired: boolean;
  planName?: string;
}

export function PlanExpiryModal({ isExpired, planName }: PlanExpiryModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isExpired) return;
    const dismissed = sessionStorage.getItem("plan_expired_modal_dismissed");
    if (!dismissed) {
      setIsOpen(true);
    }
  }, [isExpired]);

  const handleClose = () => {
    sessionStorage.setItem("plan_expired_modal_dismissed", "true");
    setIsOpen(false);
  };

  if (!isOpen || !isExpired) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          {/* Warning Icon Badge */}
          <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-800">
              Subscription Expired
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Your {planName || "WatiBot"} Plan Has Expired
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
              Your WhatsApp Business API connection is currently <strong className="text-rose-600 dark:text-rose-400">suspended</strong>. Inbound & outbound messages cannot be processed until your plan is renewed.
            </p>
          </div>

          {/* Details Box */}
          <div className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">WhatsApp API Status:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Suspended (Expired)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Auto-Reconnect:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Instant upon renewal
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
            <Link
              href="/dashboard/billing"
              onClick={handleClose}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Renew Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleClose}
              className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
