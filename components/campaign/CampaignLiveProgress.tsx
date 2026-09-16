"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Clock, Play, Pause, AlertCircle, Sparkles, Send, User, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CampaignStatusData {
  id: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "PAUSED" | "FAILED" | string;
  sentCount: number;
  totalRecipients: number;
  lastSentTo: { name: string; waId: string } | null;
  lastSentAt: string | null;
  nextSendAt: string | null;
  nextRecipient: { name: string; waId: string } | null;
  lastError: string | null;
  lockedAt?: string | null;
  executionDurationMs?: number;
  formattedDuration?: string;
}

export default function CampaignLiveProgress({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const lastContactRef = useRef<string | null>(null);

  // Poll status endpoint
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/v1/campaigns/${campaignId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const result: CampaignStatusData = await res.json();

        if (isMounted) {
          setData(result);
          setLoading(false);

          // Pulse animation if lastSentTo changed
          if (result.lastSentTo?.waId && lastContactRef.current !== result.lastSentTo.waId) {
            lastContactRef.current = result.lastSentTo.waId;
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 1200);
          }
        }
      } catch (err) {
        console.error("[CampaignLiveProgress] Poll error:", err);
      }
    };

    fetchStatus();

    // Only poll every 2s while campaign is actively PROCESSING or PENDING
    if (data?.status && data.status !== "PROCESSING" && data.status !== "PENDING") {
      return () => {
        isMounted = false;
      };
    }

    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [campaignId, data?.status]);

  // Ticking countdown timer
  useEffect(() => {
    if (!data?.nextSendAt || (data.status !== "PROCESSING" && data.status !== "PENDING")) {
      setSecondsLeft(null);
      return;
    }

    const updateCountdown = () => {
      const targetTime = new Date(data.nextSendAt!).getTime();
      const diffMs = targetTime - Date.now();
      const secs = Math.max(0, Math.ceil(diffMs / 1000));
      setSecondsLeft(secs);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [data?.nextSendAt, data?.status]);

  if (loading) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-850 rounded-full mb-6"></div>
      </div>
    );
  }

  if (!data) return null;

  const total = data.totalRecipients || 1;
  const sent = Math.min(data.sentCount || 0, total);
  const percent = Math.min(100, Math.round((sent / total) * 100));

  const isProcessing = data.status === "PROCESSING" || data.status === "PENDING";
  const isPartial = data.status === "PARTIAL_SENT" || (data.status === "SENT" && sent < total);
  const isCompleted = data.status === "SENT" && sent >= total;
  const isPaused = data.status === "PAUSED";
  const isFailed = data.status === "FAILED";

  const handleRetryUnsent = async () => {
    try {
      const res = await retryUnsentCampaignMessages(campaignId);
      if (res.success) {
        toast.success("Resumed campaign dispatch for remaining contacts.");
        setData((prev) => prev ? { ...prev, status: "PENDING" } : null);
      } else {
        toast.error(res.error || "Failed to retry campaign.");
      }
    } catch (err) {
      toast.error("Failed to retry campaign.");
    }
  };

  return (
    <div className="w-full bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-[28px] p-6 md:p-8 shadow-sm space-y-6 transition-all duration-300">
      
      {/* Top Header: Badge & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850/60 pb-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300",
            isProcessing && "bg-[#00a884]/10 text-[#00a884] ring-4 ring-[#00a884]/10 animate-pulse",
            isCompleted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            isPartial && "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20",
            isPaused && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            isFailed && "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          )}>
            {isProcessing && <Send className="w-5 h-5 animate-spin-slow" />}
            {isCompleted && <CheckCircle2 className="w-5 h-5" />}
            {isPartial && <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            {isPaused && <Pause className="w-5 h-5" />}
            {isFailed && <AlertCircle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">Live Campaign Delivery</span>
              {isProcessing && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a884] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00a884]"></span>
                </span>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {isProcessing && "Campaign Broadcast In Progress"}
              {isCompleted && "Campaign Broadcast Completed"}
              {isPartial && `Campaign Broadcast Incomplete (${sent}/${total} Dispatched)`}
              {isPaused && "Campaign Paused"}
              {isFailed && "Campaign Delivery Interrupted"}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(isPartial || isFailed || (!isProcessing && sent < total)) && (
            <button
              onClick={handleRetryUnsent}
              className="flex items-center gap-2 bg-[#00a884] hover:bg-[#008f70] text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resume / Retry Unsent ({total - sent})
            </button>
          )}

          {/* Time Consumed Badge */}
          {data.formattedDuration && (
            <div className="flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 px-3.5 py-1.5 rounded-2xl shadow-sm">
              <Clock className="w-4 h-4 text-[#00a884]" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Time Consumed: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">{data.formattedDuration}</span>
              </div>
            </div>
          )}

          {/* Live Countdown Badge */}
          {isProcessing && secondsLeft !== null && (
            <div className="flex items-center gap-2.5 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 px-4 py-2 rounded-2xl shadow-sm">
              <Clock className="w-4 h-4 text-[#00a884] animate-bounce" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Next send in <span className="font-mono text-[#00a884] text-sm">{secondsLeft}s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Counter */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
            Delivery Progress
          </span>
          <span className="font-mono text-slate-800 dark:text-white text-sm">
            {sent.toLocaleString()} / {total.toLocaleString()} sent ({percent}%)
          </span>
        </div>

        <div className="relative w-full h-3.5 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-800">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r shadow-sm",
              isProcessing && "from-[#00a884] to-emerald-400 animate-pulse",
              isCompleted && "from-emerald-500 to-teal-400",
              isPaused && "from-amber-500 to-yellow-400",
              isFailed && "from-rose-500 to-red-400"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Last Sent & Next Up Cards */}
      <div className="grid md:grid-cols-2 gap-4 pt-2">
        {/* Last Sent Card */}
        <div className={cn(
          "p-4 rounded-2xl border transition-all duration-500 flex flex-col justify-between space-y-2",
          isPulsing
            ? "bg-[#00a884]/10 border-[#00a884]/40 ring-4 ring-[#00a884]/20 scale-[1.01]"
            : "bg-white/80 dark:bg-slate-950/50 border-slate-200/60 dark:border-slate-850 shadow-sm"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Last Sent Contact
            </span>
            {data.lastSentAt && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {new Date(data.lastSentAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {data.lastSentTo ? (
            <div className="flex items-center gap-3 pt-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {data.lastSentTo.name}
                </p>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
                  {data.lastSentTo.waId}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic pt-1">
              No messages dispatched yet
            </p>
          )}
        </div>

        {/* Next Recipient Card */}
        <div className="p-4 bg-white/80 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-850 rounded-2xl shadow-sm flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Play className="w-3.5 h-3.5 fill-current" />
              Next Up
            </span>
          </div>

          {data.nextRecipient ? (
            <div className="flex items-center gap-3 pt-1">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {data.nextRecipient.name}
                </p>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
                  {data.nextRecipient.waId}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic pt-1">
              {isCompleted ? "All recipients processed" : "Resolving next recipient..."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
