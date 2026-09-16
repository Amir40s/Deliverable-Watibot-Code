"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Radio,
  Zap,
  Terminal,
  Trash2,
  Layers,
  Clock,
  Sparkles,
  Info,
  Sliders,
  Play,
  Pause,
  Copy,
  ExternalLink,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SystemStatusData {
  timestamp: string;
  health: {
    status: "healthy" | "warning" | "critical";
    heapPercentage: number;
    hostRamPercentage: number;
    eventLoopLagMs: number;
    riskFactors: string[];
    isGcAvailable: boolean;
  };
  nodeProcess: {
    pid: number;
    version: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    activeHandles: number | null;
    activeRequests: number | null;
    cpuUsage: {
      userMs: number;
      systemMs: number;
    };
  };
  memory: {
    heapUsed: number;
    heapUsedFormatted: string;
    heapTotal: number;
    heapTotalFormatted: string;
    heapLimit: number;
    heapLimitFormatted: string;
    heapHeadroom: number;
    heapHeadroomFormatted: string;
    rss: number;
    rssFormatted: string;
    external: number;
    externalFormatted: string;
    arrayBuffers: number;
    arrayBuffersFormatted: string;
    detachedContexts: number;
    nativeContexts: number;
    spaces: {
      name: string;
      sizeFormatted: string;
      usedFormatted: string;
      availableFormatted: string;
    }[];
  };
  os: {
    hostname: string;
    platform: string;
    release: string;
    totalMem: number;
    totalMemFormatted: string;
    freeMem: number;
    freeMemFormatted: string;
    usedMem: number;
    usedMemFormatted: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
    loadAvg: number[];
    cpuCount: number;
    cpuModel: string;
    cpuSpeedMhz: number;
  };
  database: {
    primary: {
      status: string;
      latencyMs: number;
      pool: {
        total: number;
        idle: number;
        waiting: number;
      };
    };
    secondary: {
      status: string;
      latencyMs: number;
    };
    dualDbWriteEnabled: boolean;
  };
  whatsapp: {
    activeSocketsCount: number;
    activeOrgIds: string[];
    pendingSessionsCount: number;
    reconnectAttemptsCount: number;
    campaignWorkerRunning: boolean;
  };
  logs: {
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    estimatedTotalLines: number;
    tailLines: string[];
  };
}

export default function SystemStatusPage() {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "memory" | "host" | "services" | "logs" | "guide">("overview");
  const [pollInterval, setPollInterval] = useState<number>(5); // seconds, 0 = paused
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState<number>(5);
  const [logFilter, setLogFilter] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/system-status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setSecondsUntilNextPoll(pollInterval);
    } catch (err: any) {
      console.error("SystemStatus fetch error:", err);
      if (isManual) toast.error("Failed to refresh system metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pollInterval]);

  // Polling management
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (pollInterval <= 0) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    setSecondsUntilNextPoll(pollInterval);
    const interval = setInterval(() => {
      setSecondsUntilNextPoll((prev) => {
        if (prev <= 1) {
          fetchStatus();
          return pollInterval;
        }
        return prev - 1;
      });
    }, 1000);

    pollTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [pollInterval, fetchStatus]);

  // Action handlers
  const handleAction = async (action: "gc" | "clear-sockets" | "truncate-log") => {
    setIsActionLoading(action);
    try {
      const res = await fetch("/api/admin/system-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchStatus(true);
      } else {
        toast.warning(json.message || "Action could not be executed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute diagnostic action");
    } finally {
      setIsActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-10 h-10 text-[#00a884] animate-spin" />
        <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">
          Gathering Node.js process & system memory diagnostics...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Unable to load system status</h2>
        <Button onClick={() => fetchStatus(true)}>Retry Diagnostics</Button>
      </div>
    );
  }

  // Filtered log lines
  const filteredLogs = data.logs.tailLines.filter((line) =>
    logFilter ? line.toLowerCase().includes(logFilter.toLowerCase()) : true
  );

  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#f8fafc] dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 plus-jakarta-forced transition-colors">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-[#00a884] flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50 shadow-sm">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  System Health & Resource Diagnostics
                </h1>
                <Badge
                  className={
                    data.health.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : data.health.status === "warning"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  }
                >
                  {data.health.status === "healthy"
                    ? "Normal"
                    : data.health.status === "warning"
                    ? "Warning / Slow"
                    : "CRITICAL (504 Timeout Risk)"}
                </Badge>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time Node.js heap memory, host RAM, event loop lag, DB latency & error logs
              </p>
            </div>
          </div>

          {/* Controls & Polling */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold">
              <span className="px-2.5 text-slate-500 dark:text-slate-400">Auto-refresh:</span>
              {[2, 5, 10, 30].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setPollInterval(sec)}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    pollInterval === sec
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {sec}s
                </button>
              ))}
              <button
                onClick={() => setPollInterval(0)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  pollInterval === 0
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                title="Pause auto-refresh"
              >
                {pollInterval === 0 ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>

            {pollInterval > 0 && (
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                in {secondsUntilNextPoll}s
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 flex items-center gap-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800/80 scrollbar-none py-1">
          {[
            { id: "overview", label: "Overview & Health", icon: Activity },
            { id: "memory", label: "Node & Heap Memory", icon: Cpu },
            { id: "host", label: "Host OS & CPU", icon: Server },
            { id: "services", label: "DB & WhatsApp Sockets", icon: Database },
            { id: "logs", label: `Error Log (${data.logs.sizeFormatted})`, icon: Terminal },
            { id: "guide", label: "504 Prevention Guide", icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                  active
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* 504 Timeout Alert Card if degraded/critical */}
        {data.health.riskFactors.length > 0 && (
          <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-300">
                Performance Risk Factors Detected (Can Lead to 504 Gateway Time-out):
              </h3>
              <ul className="mt-1.5 space-y-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
                {data.health.riskFactors.map((rf, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {rf}
                  </li>
                ))}
              </ul>
            </div>
            {data.logs.sizeBytes > 10 * 1024 * 1024 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction("truncate-log")}
                disabled={isActionLoading === "truncate-log"}
                className="shrink-0 text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear 34MB Log
              </Button>
            )}
          </div>
        )}

        {/* 4 Primary Top Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Heap Memory */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Node Heap Memory</span>
              <Badge
                className={
                  data.health.heapPercentage > 80
                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    : data.health.heapPercentage > 60
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                }
              >
                {data.health.heapPercentage}%
              </Badge>
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {data.memory.heapUsedFormatted}
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              Allocated: {data.memory.heapTotalFormatted} / Limit: {data.memory.heapLimitFormatted}
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.health.heapPercentage > 80
                    ? "bg-rose-500"
                    : data.health.heapPercentage > 60
                    ? "bg-amber-500"
                    : "bg-[#00a884]"
                }`}
                style={{ width: `${Math.min(data.health.heapPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* 2. Process Physical RAM (RSS) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Process RAM (RSS)</span>
              <HardDrive className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {data.memory.rssFormatted}
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              Buffers: {data.memory.arrayBuffersFormatted} | External: {data.memory.externalFormatted}
            </div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resident memory in OS RAM
            </div>
          </div>

          {/* 3. Event Loop Lag (ms) - Critical for 504 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Event Loop Delay</span>
              <Badge
                className={
                  data.health.eventLoopLagMs > 100
                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse"
                    : data.health.eventLoopLagMs > 30
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                }
              >
                {data.health.eventLoopLagMs > 100 ? "FROZEN" : data.health.eventLoopLagMs > 30 ? "BUSY" : "OPTIMAL"}
              </Badge>
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {data.health.eventLoopLagMs} ms
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              Active Handles: {data.nodeProcess.activeHandles ?? "N/A"} | Requests: {data.nodeProcess.activeRequests ?? "N/A"}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-3">
              {data.health.eventLoopLagMs < 20
                ? "Fast event loop response"
                : "High lag causes HTTP request timeout!"}
            </div>
          </div>

          {/* 4. Host Total & Free RAM */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Host OS Memory</span>
              <Server className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {data.os.freeMemFormatted} <span className="text-xs font-bold text-slate-400 font-normal">free</span>
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              Used: {data.os.usedMemFormatted} of {data.os.totalMemFormatted} ({data.health.hostRamPercentage}%)
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(data.health.hostRamPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Actions Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#00a884]" />
                  Emergency Diagnostic Tools
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Use these tools when the site starts feeling slow or unresponsive before a 504 happens.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("gc")}
                  disabled={isActionLoading === "gc"}
                  className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
                  Trigger Garbage Collection
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("clear-sockets")}
                  disabled={isActionLoading === "clear-sockets"}
                  className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
                  Reset WhatsApp Sockets ({data.whatsapp.activeSocketsCount})
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction("truncate-log")}
                  disabled={isActionLoading === "truncate-log"}
                  className="rounded-xl text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Truncate Error Log ({data.logs.sizeFormatted})
                </Button>
              </div>
            </div>

            {/* Quick Status Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Primary DB Status */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#00a884]" />
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">Primary Database</h4>
                  </div>
                  <Badge
                    className={
                      data.database.primary.status === "healthy"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    }
                  >
                    {data.database.primary.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Ping Latency</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.database.primary.latencyMs >= 0 ? `${data.database.primary.latencyMs} ms` : "Failed"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Connection Pool (Total)</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.database.primary.pool.total}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Pool Idle / Waiting</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.database.primary.pool.idle} idle / {data.database.primary.pool.waiting} waiting
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Secondary DB (Contabo)</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.database.secondary.status} ({data.database.secondary.latencyMs >= 0 ? `${data.database.secondary.latencyMs}ms` : "N/A"})
                    </span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Baileys Worker */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">WhatsApp & Background Sockets</h4>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    {data.whatsapp.activeSocketsCount} Sockets
                  </Badge>
                </div>
                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Active Baileys Sockets</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.whatsapp.activeSocketsCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Pending QR Sessions</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.whatsapp.pendingSessionsCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Active Reconnect Loops</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.whatsapp.reconnectAttemptsCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Campaign Worker Daemon</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {data.whatsapp.campaignWorkerRunning ? "Active" : "Stopped"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Node Process & Uptime */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">Node.js Process</h4>
                  </div>
                  <Badge variant="outline" className="font-mono text-slate-600 dark:text-slate-300">
                    PID {data.nodeProcess.pid}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Node Uptime</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.nodeProcess.uptimeFormatted}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">Node Version</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.nodeProcess.version} ({data.nodeProcess.arch})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500">OS Host Uptime</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.os.uptimeFormatted}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">CPU Load (1m, 5m, 15m)</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.os.loadAvg.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NODE & HEAP MEMORY */}
        {activeTab === "memory" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                V8 Heap & Process Memory Detailed Breakdown
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
                When heap used approaches the V8 heap limit, Node freezes the event loop for garbage collection, resulting in Nginx 504 Gateway Timeouts.
              </p>

              {/* Progress gauge */}
              <div className="space-y-2 mb-8">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">
                    Heap Used: {data.memory.heapUsedFormatted} ({data.health.heapPercentage}%)
                  </span>
                  <span className="text-slate-400">
                    Headroom Remaining: {data.memory.heapHeadroomFormatted} (Max Limit: {data.memory.heapLimitFormatted})
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.health.heapPercentage > 80
                        ? "bg-rose-500"
                        : data.health.heapPercentage > 60
                        ? "bg-amber-500"
                        : "bg-[#00a884]"
                    }`}
                    style={{ width: `${Math.min(data.health.heapPercentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* V8 Spaces */}
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">V8 Heap Spaces</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.memory.spaces.map((space) => (
                  <div
                    key={space.name}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60"
                  >
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 capitalize">
                      {space.name.replace(/_/g, " ")}
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {space.usedFormatted}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                      Allocated: {space.sizeFormatted}
                    </div>
                  </div>
                ))}
              </div>

              {/* Leak Indicators */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-xs font-bold text-slate-500">Detached Contexts (Closure Leaks)</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {data.memory.detachedContexts}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Should ideally be 0. High numbers mean closures or event listeners are not being freed.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
                  <div className="text-xs font-bold text-slate-500">Native Contexts</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {data.memory.nativeContexts}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Number of active top-level V8 execution contexts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HOST OS & CPU */}
        {activeTab === "host" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                Server Host & Operating System Metrics
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
                Host specs, physical memory availability, and CPU core utilization.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Host Info */}
                <div className="space-y-3 text-xs font-semibold">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Host Name</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{data.os.hostname}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">OS Platform & Kernel</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.os.platform} ({data.os.release})
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">CPU Model</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                      {data.os.cpuModel}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">CPU Cores & Speed</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {data.os.cpuCount} Cores @ {data.os.cpuSpeedMhz} MHz
                    </span>
                  </div>
                </div>

                {/* OS RAM Usage Breakdown */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-3">Host RAM Allocation</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Used: {data.os.usedMemFormatted}</span>
                      <span className="text-slate-500">Total: {data.os.totalMemFormatted}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${data.health.hostRamPercentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Free Physical RAM:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {data.os.freeMemFormatted}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DATABASE & WHATSAPP SERVICES */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                Connected Services & Active WhatsApp Sockets
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
                Active connections, database pools, and Baileys sessions running in server memory.
              </p>

              <div className="space-y-6">
                {/* Active WhatsApp Org IDs */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Active Baileys Sockets ({data.whatsapp.activeOrgIds.length})
                  </h4>
                  {data.whatsapp.activeOrgIds.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      No active WhatsApp Baileys sockets in memory.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.whatsapp.activeOrgIds.map((orgId) => (
                        <Badge
                          key={orgId}
                          variant="outline"
                          className="px-3 py-1 font-mono text-xs bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        >
                          Org: {orgId}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dual DB Write Status */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">Dual DB Write Status</h4>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        Synchronizes writes between Neon (Primary) and Contabo (Secondary) PostgreSQL.
                      </p>
                    </div>
                    <Badge
                      className={
                        data.database.dualDbWriteEnabled
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                      }
                    >
                      {data.database.dualDbWriteEnabled ? "ENABLED" : "DISABLED"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ERROR LOGS VIEWER */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">watibot-error.log Tail</h3>
                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    Size: {data.logs.sizeFormatted} | ~{data.logs.estimatedTotalLines.toLocaleString()} lines
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing last {filteredLogs.length} lines from disk.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter logs..."
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleAction("truncate-log")}
                  disabled={isActionLoading === "truncate-log"}
                  className="rounded-xl text-xs font-bold shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Clear Log
                </Button>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-slate-300 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-sans text-xs">
                  No log entries matched your filter.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLogs.map((line, idx) => {
                    const isError = line.includes("Error") || line.includes("FAILED") || line.includes("CRITICAL");
                    const isWarn = line.includes("Warning") || line.includes("warn") || line.includes("width(-1)");
                    return (
                      <div
                        key={idx}
                        className={`py-0.5 px-1.5 rounded transition-colors ${
                          isError
                            ? "bg-rose-950/40 text-rose-300 border-l-2 border-rose-500"
                            : isWarn
                            ? "bg-amber-950/20 text-amber-300/90 border-l-2 border-amber-500"
                            : "text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        <span className="text-slate-600 mr-2 select-none">{idx + 1}</span>
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: 504 TIMEOUT PREVENTION GUIDE */}
        {activeTab === "guide" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Why 504 Gateway Time-out Happens & How to Permanently Prevent It
                </h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  A 504 Gateway Timeout occurs when Nginx waits for Node.js to respond, but Node takes longer than the timeout threshold (default 60 seconds).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Increase Node Memory Limit */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">
                      1. Increase Node.js Heap Size (Crucial)
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    By default, Node.js caps heap memory at ~1.4 GB. When running WhatsApp Baileys + Next.js SSR, memory fills up and triggers GC thrashing.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px]">
                    NODE_OPTIONS=&quot;--max-old-space-size=4096 --expose-gc&quot;
                  </div>
                </div>

                {/* 2. Configure Nginx Timeouts */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">
                      2. Nginx Proxy Timeout
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    In your Ubuntu Nginx configuration (`/etc/nginx/sites-available/watibot`), ensure proxy read timeout is at least 120s:
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px]">
                    proxy_read_timeout 120s;
                    <br />
                    proxy_connect_timeout 120s;
                  </div>
                </div>

                {/* 3. Rotate watibot-error.log */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">
                      3. Error Log Bloat & Disk I/O
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    When `watibot-error.log` reaches 34+ MB, synchronous disk writes block the event loop. Truncating or rotating the log eliminates I/O bottlenecks.
                  </p>
                </div>

                {/* 4. PM2 Auto-Restart on Memory Limit */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">
                      4. PM2 Max Memory Restart
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    If using PM2 to manage the production process, configure `max_memory_restart: &quot;3500M&quot;` so PM2 reloads gracefully before freezing.
                  </p>
                  <div className="p-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px]">
                    pm2 start server.js --max-memory-restart 3500M
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
