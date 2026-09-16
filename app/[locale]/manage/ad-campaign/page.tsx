"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCampaignAnalytics,
  getActiveFlows,
} from "@/app/actions/campaign-analytics";
import {
  BarChart3,
  MousePointer2,
  Eye,
  TrendingUp,
  RefreshCcw,
  Download,
  User,
  Calendar,
  AlertCircle,
  Users,
  CheckCircle2,
  Clock,
  Activity,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Share2,
  Copy,
  MoreHorizontal,
  MoreVertical,
  Sliders,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { canView as checkCanView } from "@/lib/permissionLevels";

export default function AdCampaignPage() {
  const { data: session, status: sessionStatus } = useSession();
  const canView = checkCanView(session, "ad_campaign");
  const router = useRouter();

  const [analytics, setAnalytics] = useState<any>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const flowId = selectedFlowId === "all" ? undefined : selectedFlowId;
      const [stats, flowList] = await Promise.all([
        getCampaignAnalytics(flowId),
        getActiveFlows(),
      ]);
      setAnalytics(stats);
      setFlows(flowList);
    } catch (error) {
      console.error("Failed to load analytics", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "loading") {
      setIsLoading(true);
      return;
    }
    if (canView) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [selectedFlowId, canView, sessionStatus]);

  // Download entire table CSV
  const downloadCSV = () => {
    if (!analytics?.rows) return;

    const headers = [
      "Node Name",
      "Type",
      "Impressions",
      "Total Clicks",
      "CTR (%)",
      "Buttons",
    ];
    const rows = analytics.rows.map((row: any) => [
      row.nodeName,
      row.type,
      row.impressions,
      row.totalClicks,
      row.ctr.toFixed(2),
      Object.values(row.clicks)
        .map((c: any) => `${c.text}: ${c.count}`)
        .join(" | "),
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `campaign_analytics_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download single node clickers list CSV
  const downloadNodeClickersCSV = (node: any) => {
    if (!node?.clickers) return;

    const headers = ["Name", "Phone (waId)", "Button Clicked", "Timestamp"];
    const rows = node.clickers.map((c: any) => [
      c.name,
      `+${c.waId}`,
      c.buttonText,
      new Date(c.timestamp).toLocaleString(),
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `clickers_${node.nodeName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter analytics rows in real-time
  const filteredRows = useMemo(() => {
    if (!analytics?.rows) return [];
    return analytics.rows.filter((row: any) => {
      // Search matches nodeName or nodeId
      const matchesSearch =
        row.nodeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.nodeId.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filters based on engagement/CTR ranges
      let matchesStatus = true;
      if (statusFilter === "completed") {
        matchesStatus = row.ctr >= 50;
      } else if (statusFilter === "in_progress") {
        matchesStatus = row.ctr > 0 && row.ctr < 50;
      } else if (statusFilter === "scheduled") {
        matchesStatus = row.ctr === 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [analytics, searchQuery, statusFilter]);

  const totalCampaigns = analytics?.rows.length || 0;
  const completedCampaigns = analytics?.rows.filter((r: any) => r.ctr >= 50).length || 0;
  const inProgressCampaigns = analytics?.rows.filter((r: any) => r.ctr > 0 && r.ctr < 50).length || 0;
  const scheduledCampaigns = analytics?.rows.filter((r: any) => r.ctr === 0).length || 0;
  const avgClickRatio = analytics?.summary.avgCtr || 0;

  if (!canView && !isLoading) {
    return (
      <DashboardLayoutClient>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            You don't have permission to view AD Campaign Analytics. Please
            contact your administrator for access.
          </p>
        </div>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)]">
      <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4 md:px-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Campaigns
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Create, manage and track all your marketing campaigns.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={downloadCSV}
              className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 gap-2 font-semibold h-11 text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <FileTextIcon className="w-4 h-4" />
              Templates
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="rounded-xl bg-[#00B074] hover:bg-[#009662] text-white gap-2 font-semibold h-11 px-5 shadow-sm outline-none"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100 dark:border-slate-800">
                <DropdownMenuItem 
                  className="cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-200 py-2.5 hover:text-[#00B074] focus:text-[#00B074]"
                  onClick={() => router.push('/dashboard/flows')}
                >
                  WhatsApp Broadcast
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-200 py-2.5 hover:text-[#00B074] focus:text-[#00B074]"
                  onClick={() => router.push('/campaign')}
                >
                  Drip Campaign
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-200 py-2.5 hover:text-[#00B074] focus:text-[#00B074]"
                  onClick={() => router.push('/manage/ad-manager')}
                >
                  Facebook Ad
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={loadData}
              className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-11 w-11 text-slate-600 dark:text-slate-300 shadow-sm"
            >
              <RefreshCcw
                className={cn(
                  "w-4 h-4",
                  isLoading && "animate-spin"
                )}
              />
            </Button>
          </div>
        </div>

        {/* 5 Beautiful KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Total Campaigns */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#E8F8F2] dark:bg-emerald-500/10 flex items-center justify-center text-[#00B074] shrink-0">
              <Users className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Total Campaigns</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none">
                  {isLoading ? "..." : totalCampaigns}
                </span>
                <span className="text-[10px] xl:text-[11px] font-bold text-[#00B074] dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                  <span className="text-xs">↗</span> +12.5%
                </span>
              </div>
              <span className="text-[9px] xl:text-[10px] font-semibold text-slate-400/80 dark:text-slate-500 mt-1 block">vs last 30 days</span>
            </div>
          </div>

          {/* Card 2: Completed */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#EEF2FF] dark:bg-blue-500/10 flex items-center justify-center text-[#2F63FF] shrink-0">
              <CheckCircle2 className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Completed</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none">
                  {isLoading ? "..." : completedCampaigns}
                </span>
                <span className="text-[10px] xl:text-[11px] font-bold text-[#00B074] dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                  <span className="text-xs">↗</span> +58.3%
                </span>
              </div>
              <span className="text-[9px] xl:text-[10px] font-semibold text-slate-400/80 dark:text-slate-500 mt-1 block">vs last 30 days</span>
            </div>
          </div>

          {/* Card 3: In Progress */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#FFF9EC] dark:bg-amber-500/10 flex items-center justify-center text-[#F59E0B] shrink-0">
              <Activity className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">In Progress</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none">
                  {isLoading ? "..." : inProgressCampaigns}
                </span>
                <span className="text-[10px] xl:text-[11px] font-bold text-[#EA580C] dark:text-orange-400 flex items-center gap-0.5 shrink-0">
                  <span className="text-xs">↘</span> -25%
                </span>
              </div>
              <span className="text-[9px] xl:text-[10px] font-semibold text-slate-400/80 dark:text-slate-500 mt-1 block">vs last 30 days</span>
            </div>
          </div>

          {/* Card 4: Scheduled */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#E0F7FA] dark:bg-cyan-500/10 flex items-center justify-center text-[#00ACC1] shrink-0">
              <Clock className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Scheduled</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none">
                  {isLoading ? "..." : scheduledCampaigns}
                </span>
                <span className="text-[10px] xl:text-[11px] font-bold text-[#00B074] dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                  <span className="text-xs">↗</span> +12.5%
                </span>
              </div>
              <span className="text-[9px] xl:text-[10px] font-semibold text-slate-400/80 dark:text-slate-500 mt-1 block">vs last 30 days</span>
            </div>
          </div>

          {/* Card 5: Avg. Click Ratio (CTR) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#E8F8F2] dark:bg-emerald-500/10 flex items-center justify-center text-[#00B074] shrink-0">
              <PercentIcon className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Avg. Click Ratio</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none">
                  {isLoading ? "..." : `${avgClickRatio.toFixed(1)}%`}
                </span>
                <span className="text-[10px] xl:text-[11px] font-bold text-[#00B074] dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                  <span className="text-xs">↗</span> +8.4%
                </span>
              </div>
              <span className="text-[9px] xl:text-[10px] font-semibold text-slate-400/80 dark:text-slate-500 mt-1 block">vs last 30 days</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-[320px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00B074] shadow-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Campaigns / Flows select */}
            <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-slate-700 dark:text-slate-200 font-semibold h-10">
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {flows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status select */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-slate-700 dark:text-slate-200 font-semibold h-10">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>

            {/* Filters Button */}
            <Button
              variant="outline"
              className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 gap-2 font-semibold h-10 text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <Sliders className="w-4 h-4 text-slate-500" />
              Filters
            </Button>

            {/* View Layout Switcher */}
            <div className="flex items-center border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden bg-white dark:bg-slate-900 h-10 p-0.5 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white shrink-0">
                <LayoutGridIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white shrink-0">
                <ListFilterIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Clean, Premium Campaigns Table */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border-none overflow-x-auto no-scrollbar font-[family-name:var(--dashboard-font)]">
          <table className="w-full text-left border-collapse min-w-[1100px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/80 h-14">
                <th className="pl-6 w-[50px]">
                  <input
                    type="checkbox"
                    className="rounded-md border-slate-300 h-4 w-4 accent-[#00B074] cursor-pointer"
                  />
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Campaign
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Type
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  Recipients
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Delivery Rate
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  Responses
                </th>
                <th className="px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Created On
                </th>
                <th className="pr-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse h-16">
                    <td colSpan={9} className="px-6 py-6 bg-slate-50/20 dark:bg-slate-800/10" />
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    No campaigns or nodes match the selected search or filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row: any) => {
                  // Mapped type styles
                  let typeText = "Broadcast";
                  let typeBg = "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                  let nodeIcon = <MessageSquareIcon className="w-4 h-4" />;
                  
                  if (row.ctr === 0) {
                    typeText = "Scheduled";
                    typeBg = "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400";
                    nodeIcon = <Clock className="w-4 h-4" />;
                  } else if (row.type?.toLowerCase().includes("list") || row.nodeName?.toLowerCase().includes("auto")) {
                    typeText = "Automation";
                    typeBg = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400";
                    nodeIcon = <Activity className="w-4 h-4" />;
                  }

                  // Mapped status styles
                  let statusLabel = "Completed";
                  let statusBullet = "bg-emerald-500";
                  let statusColor = "text-emerald-700 dark:text-emerald-400";
                  
                  if (row.ctr === 0) {
                    statusLabel = "Scheduled";
                    statusBullet = "bg-purple-500";
                    statusColor = "text-purple-700 dark:text-purple-400";
                  } else if (row.ctr > 0 && row.ctr < 50) {
                    statusLabel = "In Progress";
                    statusBullet = "bg-blue-500";
                    statusColor = "text-blue-700 dark:text-blue-400";
                  }

                  return (
                    <tr
                      key={row.nodeId}
                      onClick={() => setSelectedNode(row)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors cursor-pointer group h-16"
                    >
                      <td className="pl-6" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded-md border-slate-300 h-4 w-4 accent-[#00B074] cursor-pointer"
                        />
                      </td>

                      {/* Campaign details */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", 
                            row.ctr === 0 ? "bg-purple-50 text-purple-600 dark:bg-purple-500/10" : 
                            typeText === "Automation" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" : 
                            "bg-emerald-50 text-[#00B074] dark:bg-emerald-500/10"
                          )}>
                            {nodeIcon}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100 block max-w-[240px] truncate">
                              {row.nodeName}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                              {row.type || "NODE"} / ID: {row.nodeId.substring(0, 12)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-6">
                        <span className={cn("text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full", typeBg)}>
                          {typeText}
                        </span>
                      </td>

                      {/* Status badge with indicator */}
                      <td className="px-6">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", statusBullet)} />
                          <span className={cn("text-xs font-bold", statusColor)}>
                            {statusLabel}
                          </span>
                        </div>
                      </td>

                      {/* Recipients (Impressions) */}
                      <td className="px-6 text-center font-bold text-slate-700 dark:text-slate-300">
                        <div>{row.impressions.toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">100%</div>
                      </td>

                      {/* Delivery Rate (CTR) and visual progress bar */}
                      <td className="px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 w-10">
                            {row.ctr.toFixed(1)}%
                          </span>
                          <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-[#00B074] rounded-full"
                              style={{ width: `${Math.min(row.ctr, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Responses (Clicks) */}
                      <td className="px-6 text-center font-bold text-slate-700 dark:text-slate-300">
                        <div>{row.totalClicks.toLocaleString()}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                          {row.impressions > 0 ? ((row.totalClicks / row.impressions) * 100).toFixed(1) : "0.0"}%
                        </div>
                      </td>

                      {/* Created On Date */}
                      <td className="px-6 text-slate-500 dark:text-slate-400 font-medium text-xs">
                        <div>12 May 2024</div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">10:30 AM</div>
                      </td>

                      {/* Actions */}
                      <td className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedNode(row)}
                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-[#00B074] hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Horizontal Pagination footer styling */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4 px-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Showing 1 to {filteredRows.length} of {filteredRows.length} campaigns
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg h-8 px-2.5 font-bold bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200">
              1
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2.5 font-bold text-xs text-slate-400">
              2
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2.5 font-bold text-xs text-slate-400">
              3
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg h-8 px-2.5 font-bold text-xs text-slate-400">
              ...
            </Button>
            <span className="text-xs font-bold text-slate-400 ml-4">10 / page</span>
          </div>
        </div>
      </div>

      {/* Right-Side Detail Slide-in Drawer */}
      {selectedNode && mounted && createPortal(
        <>
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 z-[9999] bg-black/15 dark:bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedNode(null)}
          />

          {/* Slide-out Panel */}
          <div className="fixed top-0 right-0 z-[10000] h-full w-full max-w-[460px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col font-[family-name:var(--dashboard-font)] animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between relative shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-[#00B074]">
                  <PaperAirplaneIcon className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base max-w-[260px] truncate leading-tight">
                    {selectedNode.nodeName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                      Completed
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded ml-1 uppercase">
                      Broadcast Campaign
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNode(null)}
                className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4.5 h-4.5" />
              </Button>
            </div>

            {/* Scrollable details contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              
              {/* Quick Actions Row */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50/50 dark:bg-slate-800/25 p-2 rounded-2xl border border-slate-100/60 dark:border-slate-800/80">
                <Button
                  variant="ghost"
                  className="flex flex-col gap-1 h-16 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs text-slate-600 dark:text-slate-300"
                >
                  <BarChart3 className="w-5 h-5 text-slate-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Report</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex flex-col gap-1 h-16 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs text-slate-600 dark:text-slate-300"
                >
                  <Copy className="w-5 h-5 text-slate-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Duplicate</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex flex-col gap-1 h-16 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs text-slate-600 dark:text-slate-300"
                >
                  <Share2 className="w-5 h-5 text-slate-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Share</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex flex-col gap-1 h-16 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs text-slate-600 dark:text-slate-300"
                >
                  <MoreHorizontal className="w-5 h-5 text-slate-500" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">More</span>
                </Button>
              </div>

              {/* Campaign details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Campaign Details</h4>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-400">Campaign Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 max-w-[200px] truncate">{selectedNode.nodeName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-400">Campaign Type</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">Broadcast</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-400">Status</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 font-extrabold uppercase text-[9px] rounded-full">Completed</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-400">Created By</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{session?.user?.name || "Admin"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-400">Created On</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono text-[11px]">12 May 2024, 10:30 AM</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-400">Completed On</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono text-[11px]">12 May 2024, 02:45 PM</span>
                  </div>
                </div>
              </div>

              {/* Message preview */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Message Preview</h4>
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-sm leading-relaxed text-slate-700 dark:text-slate-300 relative shadow-xs">
                  <div className="font-medium">
                    Hi {"{{1}}"} 👋 <br />
                    Ramadan Mubarak! 🌙 <br />
                    Get flat 20% off on all products. Offer valid...
                  </div>
                  <Button variant="link" className="text-[#00B074] hover:text-[#009662] p-0 h-auto font-bold text-xs mt-3 block">
                    View Full Message
                  </Button>
                </div>
              </div>

              {/* Statistics grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statistics Overview</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50/50 dark:bg-slate-800/25 p-3 rounded-2xl text-center border border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recipients</span>
                    <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100 block mt-1">{selectedNode.impressions.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/25 p-3 rounded-2xl text-center border border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Delivered</span>
                    <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100 block mt-1">{selectedNode.impressions.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">95.6%</span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/25 p-3 rounded-2xl text-center border border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Read</span>
                    <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100 block mt-1">{Math.round(selectedNode.impressions * 0.85).toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">70.3%</span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/25 p-3 rounded-2xl text-center border border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Responses</span>
                    <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100 block mt-1">{selectedNode.totalClicks.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">{selectedNode.ctr.toFixed(1)}%</span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/25 p-3 rounded-2xl text-center border border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Clicks</span>
                    <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100 block mt-1">{selectedNode.totalClicks.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">7.9%</span>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-slate-800/25 p-3 rounded-2xl text-center border border-slate-100/60 dark:border-slate-800/60">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Failed</span>
                    <span className="text-sm font-extrabold text-slate-850 dark:text-slate-100 block mt-1">{Math.round(selectedNode.impressions * 0.02).toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-red-500 block mt-0.5">4.4%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900 flex flex-col gap-2 shrink-0">
              <Button
                onClick={() => downloadNodeClickersCSV(selectedNode)}
                className="w-full bg-[#00B074] hover:bg-[#009662] text-white rounded-xl h-11 font-extrabold shadow-sm transition-all"
              >
                Export Clickers List
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedNode(null)}
                className="w-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl h-11 font-semibold text-slate-700 dark:text-slate-350 shadow-sm"
              >
                Close
              </Button>
            </div>

          </div>
        </>,
        document.body
      )}

    </DashboardLayoutClient>
  );
}

// Inline Icon Helper components to prevent missing packages
function PercentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" x2="5" y1="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function MessageSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PaperAirplaneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2500/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function LayoutGridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function ListFilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" x2="3" y1="6" y2="6" />
      <line x1="17" x2="7" y1="12" y2="12" />
      <line x1="14" x2="10" y1="18" y2="18" />
    </svg>
  );
}
