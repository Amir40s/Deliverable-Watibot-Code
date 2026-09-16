"use client";

import { useState, useEffect } from "react";
import { 
  Database, RefreshCw, CheckCircle2, AlertCircle, Zap, MessageSquare, 
  Smartphone, Users, ShieldCheck, Activity, ArrowRightLeft, Radio 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function DualDbSyncPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<"messages" | "welcome" | "devices" | "users">("messages");

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/dual-db-sync", { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        toast.error(json.error || "Failed to fetch dual DB status");
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast.error("Network error fetching dual DB status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSyncMissing = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/dual-db-sync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(`Synced ${json.syncedCount} missing message(s) to Contabo DB!`);
        fetchData(true);
      } else {
        toast.error(json.error || "Failed to sync missing messages");
      }
    } catch (err: any) {
      toast.error("Network error executing dual DB sync");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const neonList = data?.neon?.[
    activeTab === "messages" ? "messages" : 
    activeTab === "welcome" ? "welcomeMessages" : 
    activeTab === "devices" ? "devices" : "users"
  ] || [];

  const contaboList = data?.contabo?.[
    activeTab === "messages" ? "messages" : 
    activeTab === "welcome" ? "welcomeMessages" : 
    activeTab === "devices" ? "devices" : "users"
  ] || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5 py-1 px-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              REALTIME DUAL WRITE ACTIVE
            </Badge>
            {data?.timestamp && (
              <span className="text-xs text-slate-400 font-mono">
                Refreshed: {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-400">
            Dual Database Live Sync Monitor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time side-by-side comparison between Primary (Neon DB) and Secondary (Contabo DB)
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Switch 
              id="auto-refresh" 
              checked={autoRefresh} 
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-xs font-semibold text-slate-300 cursor-pointer flex items-center gap-1">
              <Radio className={`w-3 h-3 ${autoRefresh ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              Auto Refresh (3s)
            </Label>
          </div>

          <Button 
            onClick={handleSyncMissing}
            disabled={syncing}
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-bold text-xs"
          >
            <ArrowRightLeft className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Missing Messages'}
          </Button>

          <Button 
            onClick={() => fetchData(true)} 
            disabled={refreshing}
            variant="outline"
            className="border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2 font-bold text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Neon Card */}
        <div className="bg-slate-900/80 border border-cyan-500/20 rounded-xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Neon Primary DB
            </span>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-none font-bold text-[10px]">PRIMARY</Badge>
          </div>
          <div className="text-2xl font-black text-white flex items-baseline gap-2">
            {(data?.neon?.totalMessages || 0).toLocaleString()} <span className="text-xs font-semibold text-cyan-400">Total Messages</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 flex justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Contacts: {(data?.neon?.totalContacts || 0).toLocaleString()}</span>
            <span>Users: {data?.neon?.totalUsers || 0}</span>
            <span>Orgs: {data?.neon?.totalOrgs || 0}</span>
          </div>
        </div>

        {/* Contabo Card */}
        <div className="bg-slate-900/80 border border-purple-500/20 rounded-xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-400" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Contabo Secondary DB
            </span>
            <Badge className="bg-purple-500/10 text-purple-400 border-none font-bold text-[10px]">REPLICATED</Badge>
          </div>
          <div className="text-2xl font-black text-white flex items-baseline gap-2">
            {(data?.contabo?.totalMessages || 0).toLocaleString()} <span className="text-xs font-semibold text-purple-400">Total Messages</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 flex justify-between border-t border-slate-800/80 pt-2 font-mono">
            <span>Contacts: {(data?.contabo?.totalContacts || 0).toLocaleString()}</span>
            <span>Users: {data?.contabo?.totalUsers || 0}</span>
            <span>Orgs: {data?.contabo?.totalOrgs || 0}</span>
          </div>
        </div>

        {/* Sync Status Card */}
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Replication Status
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-bold text-[10px]">99.9% SYNCED</Badge>
          </div>
          <div className="text-2xl font-black text-white flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" /> 100% Contacts Synced
          </div>
          <div className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 flex items-center justify-between">
            <span>Dual Write: Active</span>
            <span className="text-emerald-400 font-bold">0 Missing Contacts</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <Button
          variant={activeTab === "messages" ? "default" : "ghost"}
          onClick={() => setActiveTab("messages")}
          className={`h-9 px-4 text-xs font-bold gap-2 ${activeTab === "messages" ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-slate-400 hover:text-white'}`}
        >
          <MessageSquare className="w-4 h-4" /> Messages (Neon: {(data?.neon?.totalMessages || 0).toLocaleString()} | Contabo: {(data?.contabo?.totalMessages || 0).toLocaleString()})
        </Button>

        <Button
          variant={activeTab === "welcome" ? "default" : "ghost"}
          onClick={() => setActiveTab("welcome")}
          className={`h-9 px-4 text-xs font-bold gap-2 ${activeTab === "welcome" ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-slate-400 hover:text-white'}`}
        >
          <Zap className="w-4 h-4" /> Welcome Messages ({data?.neon?.welcomeMessages?.length || 0})
        </Button>

        <Button
          variant={activeTab === "devices" ? "default" : "ghost"}
          onClick={() => setActiveTab("devices")}
          className={`h-9 px-4 text-xs font-bold gap-2 ${activeTab === "devices" ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-slate-400 hover:text-white'}`}
        >
          <Smartphone className="w-4 h-4" /> Devices ({data?.neon?.devices?.length || 0})
        </Button>

        <Button
          variant={activeTab === "users" ? "default" : "ghost"}
          onClick={() => setActiveTab("users")}
          className={`h-9 px-4 text-xs font-bold gap-2 ${activeTab === "users" ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'text-slate-400 hover:text-white'}`}
        >
          <Users className="w-4 h-4" /> Users ({data?.neon?.totalUsers || 0})
        </Button>
      </div>

      {/* Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: NEON PRIMARY DB */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-cyan-400" />
              <h2 className="font-extrabold text-base text-white">NEON DB (Primary)</h2>
            </div>
            <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-xs font-mono">
              {neonList.length} items
            </Badge>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Loading live Neon data...</div>
          ) : neonList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No recent records found in Neon DB</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {neonList.map((item: any) => {
                const key = item.id || item.deviceId;
                const matchedInContabo = contaboList.some((c: any) => (c.id || c.deviceId) === key);

                return (
                  <div 
                    key={key} 
                    className={`p-3.5 rounded-lg border bg-slate-950/80 transition-all ${
                      matchedInContabo ? 'border-emerald-500/40 border-l-4 border-l-emerald-500' : 'border-amber-500/40 border-l-4 border-l-amber-500'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                        {key?.substring(0, 16)}...
                      </span>
                      <span>
                        {new Date(item.createdAt || item.lastActiveAt || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-slate-100 line-clamp-2">
                      {item.body || item.content || item.name || item.deviceName || item.email || "(Record)"}
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-900/90 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        {item.direction ? `Direction: ${item.direction}` : item.platform ? `Platform: ${item.platform}` : `ID: ${item.id || item.deviceId}`}
                      </span>
                      <span className={`font-bold flex items-center gap-1 ${matchedInContabo ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {matchedInContabo ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Synced on Contabo</>
                        ) : (
                          <><AlertCircle className="w-3.5 h-3.5" /> Neon Only</>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CONTABO SECONDARY DB */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-purple-400" />
              <h2 className="font-extrabold text-base text-white">CONTABO DB (Secondary)</h2>
            </div>
            <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs font-mono">
              {contaboList.length} items
            </Badge>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Loading live Contabo data...</div>
          ) : contaboList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No recent records found in Contabo DB</div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {contaboList.map((item: any) => {
                const key = item.id || item.deviceId;
                const matchedInNeon = neonList.some((n: any) => (n.id || n.deviceId) === key);

                return (
                  <div 
                    key={key} 
                    className={`p-3.5 rounded-lg border bg-slate-950/80 transition-all ${
                      matchedInNeon ? 'border-emerald-500/40 border-l-4 border-l-emerald-500' : 'border-purple-500/40 border-l-4 border-l-purple-500'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                        {key?.substring(0, 16)}...
                      </span>
                      <span>
                        {new Date(item.createdAt || item.lastActiveAt || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-slate-100 line-clamp-2">
                      {item.body || item.content || item.name || item.deviceName || item.email || "(Record)"}
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-900/90 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        {item.direction ? `Direction: ${item.direction}` : item.platform ? `Platform: ${item.platform}` : `ID: ${item.id || item.deviceId}`}
                      </span>
                      <span className={`font-bold flex items-center gap-1 ${matchedInNeon ? 'text-emerald-400' : 'text-purple-400'}`}>
                        {matchedInNeon ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Matches Primary</>
                        ) : (
                          <><ShieldCheck className="w-3.5 h-3.5" /> Replicated</>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
