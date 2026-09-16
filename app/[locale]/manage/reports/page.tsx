"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import ManageLayout from "@/components/layouts/ManageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { format, startOfMonth, subDays, startOfDay, endOfDay } from "date-fns"
import { pdf } from "@react-pdf/renderer"
import ReportPDF from "@/components/reports/ReportPDF"
import { toast } from "sonner"
import WatiBotLoader from "@/components/WatiBotLoader"
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  Smartphone,
  TrendingUp,
  Users,
  Send,
  Calendar,
  ChevronRight,
  Zap,
  Clock,
  Bot,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Globe,
  Target,
  Flame,
  UserPlus
} from "lucide-react"
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts"

type ReportsTab = "overview" | "campaigns" | "automations" | "flows" | "templates" | "agents";

const TABS = [
  { id: "overview", labelKey: "tab.overview" },
  { id: "campaigns", labelKey: "tab.campaigns" },
  { id: "automations", labelKey: "tab.automations" },
  { id: "flows", labelKey: "tab.flows" },
  { id: "templates", labelKey: "tab.templates" },
  { id: "agents", labelKey: "tab.agentPerformance" }
] as const;

const RANGE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "month", label: "This Month" }
] as const;

// Heatmap slots configuration
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"];

// Color mapping for heatmap strength
const getHeatmapColor = (strength: number) => {
  switch (strength) {
    case 6: return "bg-[#00B074]"; // max active
    case 5: return "bg-[#00B074]/80";
    case 4: return "bg-[#00B074]/60";
    case 3: return "bg-[#00B074]/40";
    case 2: return "bg-[#00B074]/20";
    case 1: return "bg-[#00B074]/10";
    default: return "bg-slate-100/60 dark:bg-slate-800/40";
  }
};

export default function ReportsPage() {
  const { data: session } = useSession()
  const t = useTranslations('reports')
  const [data, setData] = useState<ReportsData | null>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setQuota] = useState<{ used: number; total: number } | null>(null)
  const [activeTab, setActiveTab] = useState<ReportsTab>("overview")
  const [selectedRange, setSelectedRange] = useState<(typeof RANGE_OPTIONS)[number]["id"]>("month")
  const [selectedAgentId, setSelectedAgentId] = useState("all")
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: new Date(),
    label: "This Month"
  })

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await getOrganizationUsers()
      setAgents(users)
    }
    fetchUsers()
  }, [])

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const stats = await getDashboardStats()
        setQuota({ used: stats.usedQuota, total: stats.totalQuota })
      } catch (err) {
        console.error("Failed to fetch quota stats:", err)
      }
    }
    fetchQuota()
  }, [])

  useEffect(() => {
    const now = new Date()
    if (selectedRange === "today") {
      setDateRange({ start: startOfDay(now), end: endOfDay(now), label: "Today" })
      return
    }
    if (selectedRange === "yesterday") {
      const y = subDays(now, 1)
      setDateRange({ start: startOfDay(y), end: endOfDay(y), label: "Yesterday" })
      return
    }
    if (selectedRange === "7d") {
      setDateRange({ start: subDays(now, 7), end: now, label: "Last 7 Days" })
      return
    }
    if (selectedRange === "30d") {
      setDateRange({ start: subDays(now, 30), end: now, label: "Last 30 Days" })
      return
    }
    setDateRange({ start: startOfMonth(now), end: now, label: "This Month" })
  }, [selectedRange])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const result = await getReportsData({
          startDate: dateRange.start,
          endDate: dateRange.end,
          agentId: selectedAgentId === "all" ? undefined : selectedAgentId
        })
        setData(result)
        setError(null)
      } catch (err: any) {
        console.error("Failed to fetch reports data:", err)
        setError(err?.message || "Could not load reports data.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [dateRange, selectedAgentId])

  const handleExportPDF = async () => {
    if (!data) return

    setIsExporting(true)
    const toastId = toast.loading("Generating report PDF...")
    try {
      const doc = (
        <ReportPDF
          data={data}
          dateRange={dateRange}
          orgName={session?.user?.organizationName || "WatiBot"}
        />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `WatiBot-Report-${format(dateRange.start, "yyyyMMdd")}-${format(dateRange.end, "yyyyMMdd")}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Report exported", { id: toastId })
    } catch (err) {
      console.error("PDF export failed:", err)
      toast.error("Failed to export PDF", { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  // Real Current vs Real Previous data for Line chart (No Math.random())
  const multiLineChartData = useMemo(() => {
    const labels = data?.conversationVelocity?.labels || [];
    const values = data?.conversationVelocity?.values || [];
    const prevValues = data?.conversationVelocity?.previousValues || [];
    if (labels.length === 0 || (labels.length === 1 && labels[0] === "No Data")) {
      return [];
    }
    return labels.map((label, index) => {
      const currentVal = values[index] || 0;
      const previousVal = prevValues[index] || 0;
      return {
        name: label,
        Messages: currentVal,
        MessagesLastPeriod: previousVal
      };
    });
  }, [data]);

  // Real traffic composition Donut Chart
  const channelData = useMemo(() => {
    if (data?.channelSplit && data.channelSplit.length > 0) {
      return data.channelSplit.map(ch => ({
        name: ch.label,
        value: ch.value,
        count: ch.count,
        color: ch.label === 'AI Assistant' ? '#10b981' :
               ch.label === 'Human Agents' ? '#6366f1' :
               ch.label === 'Inbound Customers' ? '#0ea5e9' : '#f59e0b'
      }));
    }
    return [];
  }, [data]);

  if (isLoading && !data) {
    return <WatiBotLoader fullScreen={true} />
  }

  return (
    <ManageLayout contentClassName="pb-20 bg-[#F8FAFC] dark:bg-slate-950 min-h-screen plus-jakarta-forced max-w-none">
      {session?.user && !session.user.whatsappConnected && (
        <LockedPageOverlay
          title="Analytics Restricted"
          description="Performance reports require live WhatsApp interactions. Connect your account to view accurate analytics."
          icon={<Smartphone className="h-10 w-10" />}
          ctaText="Connect WhatsApp"
        />
      )}

      <div className="max-w-[1600px] mx-auto space-y-8 pb-20 px-4 md:px-8 pt-6">
        {/* Page Header */}
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-3">
              {/* Export Report */}
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="h-10 px-5 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-bold text-xs shadow-sm hover:bg-slate-50 flex items-center gap-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-slate-500" />}
                {t('exportReport')}
              </Button>

              {/* Agent Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 px-3 h-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <UserCheck className="w-4 h-4 text-slate-400" />
                    <span>
                      {selectedAgentId === "all"
                        ? "All Agents"
                        : agents.find((a) => a.id === selectedAgentId)?.name || "Agent"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px]">
                  <DropdownMenuLabel>Filter by Agent</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className={cn("cursor-pointer", selectedAgentId === "all" ? "bg-slate-100 dark:bg-slate-800 font-bold" : "")}
                    onClick={() => setSelectedAgentId("all")}
                  >
                    All Agents / System
                  </DropdownMenuItem>
                  {agents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      className={cn("cursor-pointer", selectedAgentId === agent.id ? "bg-slate-100 dark:bg-slate-800 font-bold" : "")}
                      onClick={() => setSelectedAgentId(agent.id)}
                    >
                      <span className="truncate">{agent.name || agent.email}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date Range Display */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 px-3 h-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>
                      {format(dateRange.start, "yyyy-MM-dd") === format(dateRange.end, "yyyy-MM-dd")
                        ? format(dateRange.start, "MMM dd, yyyy")
                        : `${format(dateRange.start, "MMM dd")} – ${format(dateRange.end, "MMM dd, yyyy")}`}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>{t('ranges.selectRange')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {RANGE_OPTIONS.map((range) => (
                    <DropdownMenuItem
                      key={range.id}
                      className={cn("cursor-pointer", selectedRange === range.id ? "bg-slate-100 dark:bg-slate-800 font-bold" : "")}
                      onClick={() => setSelectedRange(range.id)}
                    >
                      {t(`ranges.${range.id}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-6 border-b border-slate-200/60 dark:border-slate-800/80 pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative pb-3 text-sm font-bold tracking-wider transition-all cursor-pointer",
                activeTab === tab.id
                  ? "text-slate-900 border-b-2 border-slate-900 dark:text-white dark:border-white"
                  : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {activeTab === "overview" ? (
          <div className="space-y-8">
            {/* Top KPI Metrics Row (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* CARD 1: Total Conversations */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between p-5 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block">{t('cards.totalConversations')}</span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{data?.kpis.totalConversations.value || "0"}</h3>
                      {data?.kpis.totalConversations.trend && (
                        <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded", data.kpis.totalConversations.isUp ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074]" : "bg-red-50 dark:bg-red-950/40 text-red-600")}>
                          {data.kpis.totalConversations.trend === 'Live' ? t('cards.live') : data.kpis.totalConversations.trend}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              {/* CARD 2: AI Messages */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between p-5 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block">{t('cards.aiMessages')}</span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{data?.kpis.aiMessages?.value || "0"}</h3>
                      {data?.kpis.aiMessages?.trend && (
                        <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded", data.kpis.aiMessages.isUp ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074]" : "bg-red-50 dark:bg-red-950/40 text-red-600")}>
                          {data.kpis.aiMessages.trend}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      {data?.kpis.aiMessages?.percentage || 0}% of conversational replies
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              {/* CARD 3: Human Messages */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between p-5 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block">{t('cards.humanMessages')}</span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{data?.kpis.humanMessages?.value || "0"}</h3>
                      {data?.kpis.humanMessages?.trend && (
                        <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded", data.kpis.humanMessages.isUp ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600" : "bg-red-50 dark:bg-red-950/40 text-red-600")}>
                          {data.kpis.humanMessages.trend}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                      {data?.kpis.humanMessages?.percentage || 0}% of conversational replies
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              {/* CARD 4: AI Automation Rate */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between p-5 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block">{t('cards.automationRate')}</span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                        {data?.kpis.automationRate?.value || "0.0%"}
                      </h3>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                        {t('cards.active')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      {data?.aiVsHuman?.totalHandled.toLocaleString() || 0} chats automated
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
              </Card>

            </div>

            {/* AI vs Human Messaging Breakdown Module */}
            <Card className="bg-gradient-to-br from-white via-white to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-[24px] overflow-hidden p-6 md:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                      {t('charts.aiVsHumanTitle')}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      Live Telemetry
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t('charts.aiVsHumanSubtitle')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{t('cards.totalOutbound')}</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {data?.aiVsHuman?.totalOutbound.toLocaleString() || "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Proportion Breakdown Bar */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Bot className="w-4 h-4" />
                    <span>{t('charts.aiAgent')}: {data?.aiVsHuman?.aiPercentage ?? 0}% ({data?.aiVsHuman?.aiCount.toLocaleString() ?? 0} msgs)</span>
                  </div>
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Users className="w-4 h-4" />
                    <span>{t('charts.humanAgent')}: {data?.aiVsHuman?.humanPercentage ?? 0}% ({data?.aiVsHuman?.humanCount.toLocaleString() ?? 0} msgs)</span>
                  </div>
                </div>

                {/* Stacked Percentage Progress Bar */}
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-l-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.max((data?.aiVsHuman?.aiCount ?? 0) > 0 ? 2 : 0, data?.aiVsHuman?.aiPercentage ?? 0)}%` }}
                    title={`AI: ${data?.aiVsHuman?.aiPercentage ?? 0}%`}
                  />
                  <div
                    className={cn(
                      "h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 shadow-sm",
                      (data?.aiVsHuman?.broadcastPercentage ?? 0) > 0 ? "" : "rounded-r-full"
                    )}
                    style={{ width: `${Math.max((data?.aiVsHuman?.humanCount ?? 0) > 0 ? 2 : 0, data?.aiVsHuman?.humanPercentage ?? 0)}%` }}
                    title={`Human: ${data?.aiVsHuman?.humanPercentage ?? 0}%`}
                  />
                  {(data?.aiVsHuman?.broadcastPercentage ?? 0) > 0 && (
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-r-full transition-all duration-700 shadow-sm"
                      style={{ width: `${data?.aiVsHuman?.broadcastPercentage ?? 0}%` }}
                      title={`Broadcasts: ${data?.aiVsHuman?.broadcastPercentage ?? 0}%`}
                    />
                  )}
                </div>

                {/* Breakdown Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  {/* AI Assistant Metric */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('charts.aiAgent')}</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-950 dark:text-white">
                        {data?.aiVsHuman?.aiCount.toLocaleString() || "0"}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {data?.aiVsHuman?.aiPercentage || 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                      <span>Speed: {data?.aiVsHuman?.aiAvgResponseTime || "< 2s"}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", data?.aiVsHuman?.aiIsUp ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50" : "bg-red-50 text-red-600 dark:bg-red-950/50")}>
                        {data?.aiVsHuman?.aiTrend || "0%"}
                      </span>
                    </div>
                  </div>

                  {/* Human Agent Metric */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('charts.humanAgent')}</span>
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-950 dark:text-white">
                        {data?.aiVsHuman?.humanCount.toLocaleString() || "0"}
                      </span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {data?.aiVsHuman?.humanPercentage || 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                      <span>Avg: {data?.aiVsHuman?.humanAvgResponseTime || "0s"}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", data?.aiVsHuman?.humanIsUp ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50" : "bg-red-50 text-red-600 dark:bg-red-950/50")}>
                        {data?.aiVsHuman?.humanTrend || "0%"}
                      </span>
                    </div>
                  </div>

                  {/* Automation Rate Metric */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('cards.automationRate')}</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-950 dark:text-white">
                        {data?.aiVsHuman?.automationRate?.toFixed(1) || "0.0"}%
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Autonomous
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                      {data?.aiVsHuman?.totalHandled?.toLocaleString() || 0} chats automated
                    </p>
                  </div>

                  {/* Inbound Customers Metric */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('charts.inboundCustomer')}</span>
                      <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-950 dark:text-white">
                        {data?.aiVsHuman?.inboundCount.toLocaleString() || "0"}
                      </span>
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                        Inbound
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                      {data?.aiVsHuman?.broadcastCount && data.aiVsHuman.broadcastCount > 0
                        ? `${data.aiVsHuman.broadcastCount.toLocaleString()} campaign broadcasts`
                        : 'Customer inbound inquiries'}
                    </p>
                  </div>
                </div>

                {/* Verification guarantee pill */}
                <div className="flex items-center gap-2 pt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>All AI, Human, and Inbound messages verified from database telemetry and counted without duplication.</span>
                </div>
              </div>
            </Card>

            {/* Charts Row 1: Conversations Trend & Traffic Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
              {/* Conversations Trend (8 Columns) */}
              <Card className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                    {t('charts.conversationsTrend')}
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    Live telemetry comparison
                  </span>
                </div>
                
                <div className="flex items-center gap-6 mb-4 text-[11px] font-bold tracking-wider">
                  <div className="flex items-center gap-1.5 text-emerald-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    {t('charts.thisPeriod')}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300" />
                    {t('charts.lastPeriod')}
                  </div>
                </div>

                {multiLineChartData.length > 0 ? (
                  <div className="h-[280px] w-full mt-2 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={multiLineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dx={-10} />
                        <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                        <Line type="monotone" dataKey="Messages" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="MessagesLastPeriod" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} activeDot={{ r: 4 }} dot={{ r: 2, fill: '#94a3b8', strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-sm font-semibold text-slate-400">
                    No data available for the selected period
                  </div>
                )}
              </Card>

              {/* Message Distribution (4 Columns) */}
              <Card className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    {t('charts.messageDistribution')}
                  </h3>
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                </div>
                
                {channelData.some(d => d.value > 0 || (d.count && d.count > 0)) ? (
                  <>
                    <div className="relative h-[220px] flex items-center justify-center mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={channelData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={95}
                            paddingAngle={5}
                            dataKey="count"
                            stroke="none"
                            cornerRadius={4}
                          >
                            {channelData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          {channelData.reduce((a, b) => a + (b.count || 0), 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-widest mt-1">{t('charts.total')}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5 mt-4">
                      {channelData.map(ch => (
                        <div key={ch.name} className="flex items-center justify-between text-[12px] font-bold">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: ch.color }} />
                            <span className="text-slate-600 dark:text-slate-300 truncate">
                              {ch.name === 'AI Assistant' ? t('charts.aiAgent') :
                               ch.name === 'Human Agents' ? t('charts.humanAgent') :
                               ch.name === 'Inbound Customers' ? t('charts.inboundCustomer') :
                               ch.name === 'Broadcast Campaigns' ? t('charts.broadcastCampaigns') : ch.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-slate-400 font-semibold text-xs">{ch.count.toLocaleString()}</span>
                            <span className="text-slate-900 dark:text-white text-xs w-9 text-right font-black">
                              {ch.value}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm font-semibold text-slate-400">
                    {t('charts.noDirectionData')}
                  </div>
                )}
              </Card>
            </div>

            {/* Charts Row 2: Message Health, Peak Activity, Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
              
              {/* Message Health & Engagement (4 Columns) */}
              <Card className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {t('charts.messageHealth')}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Live WhatsApp delivery telemetry
                      </p>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <div className="space-y-4 flex-1">
                      {/* Delivery Rate */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{t('charts.deliveryRate')}</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{data?.messageHealth?.deliveryRate ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#10b981] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, data?.messageHealth?.deliveryRate ?? 0)}%` }} />
                        </div>
                      </div>
                      
                      {/* Read Rate */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{t('charts.readRate')}</span>
                          <span className="text-xs font-black text-purple-600 dark:text-purple-400">{data?.messageHealth?.readRate ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, data?.messageHealth?.readRate ?? 0)}%` }} />
                        </div>
                      </div>

                      {/* Reply Rate */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{t('charts.replyRate')}</span>
                          <span className="text-xs font-black text-sky-600 dark:text-sky-400">{data?.messageHealth?.replyRate ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, data?.messageHealth?.replyRate ?? 0)}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Donut Progress */}
                    <div className="relative w-28 h-28 shrink-0">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                        <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="10" fill="none" className="dark:stroke-slate-800" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#10b981"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray="251.2"
                          strokeDashoffset={251.2 * (1 - Math.min(1, (data?.messageHealth?.deliveryRate ?? 0) / 100))}
                          strokeLinecap="round"
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          {data?.messageHealth?.deliveryRate ?? 0}%
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Delivered</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                    <span>{data?.messageHealth?.deliveredCount.toLocaleString() || 0} delivered</span>
                    <span>{data?.messageHealth?.readCount.toLocaleString() || 0} read</span>
                    <span>{data?.messageHealth?.replyCount.toLocaleString() || 0} replies</span>
                  </div>
                  <Link
                    href="/manage/health-audit"
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 transition-colors text-xs font-bold"
                  >
                    <span>Open Full WhatsApp Health Audit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>

              {/* Peak Activity Hours (4 Columns) */}
              <Card className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {t('charts.peakActivityHours')}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Real message volume distribution by day & time
                      </p>
                    </div>
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  
                  {/* Heatmap Grid */}
                  <div className="w-full">
                    <div className="flex justify-between pl-8 mb-2">
                      {HOUR_LABELS.map((time, i) => (
                        <div key={i} className="text-[9px] font-bold text-slate-400 tracking-wider">
                          {t(`hours.${time.toLowerCase().replace(' ', '')}`)}
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-1">
                      {WEEKDAYS.map((day, rowIdx) => (
                        <div key={day} className="flex items-center gap-2">
                          <div className="w-6 text-[10px] font-bold text-slate-500">
                            {t(`weekdays.${day.toLowerCase()}`)}
                          </div>
                          <div className="flex-1 flex gap-1">
                            {(data?.activityHeatmap?.matrix?.[rowIdx] || [0, 0, 0, 0, 0, 0]).map((strength, colIdx) => (
                              <div
                                key={`${rowIdx}-${colIdx}`}
                                className={cn("flex-1 h-5 rounded-sm transition-colors", getHeatmapColor(strength))}
                                title={`${day} ${HOUR_LABELS[colIdx]}: ${data?.activityHeatmap?.rawCounts?.[rowIdx]?.[colIdx] || 0} messages`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6">
                  <span className="text-[10px] font-bold text-slate-400">{t('charts.lowActivity')}</span>
                  <div className="flex-1 h-1.5 mx-4 bg-gradient-to-r from-emerald-50 to-[#00B074] rounded-full" />
                  <span className="text-[10px] font-bold text-slate-400">{t('charts.highActivity')}</span>
                </div>
              </Card>

              {/* Top Performers (4 Columns) */}
              <Card className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {t('charts.topPerformers')}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Most active agents and automated channels
                      </p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>

                  <div className="space-y-4">
                    {(data?.topPerformers || []).length > 0 ? (
                      data!.topPerformers.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-400 w-4">{index + 1}</span>
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold">
                              {item.type.includes('AI') ? (
                                <Bot className="w-4 h-4 text-emerald-500" />
                              ) : item.type.includes('Agent') ? (
                                <Users className="w-4 h-4 text-indigo-500" />
                              ) : item.type.includes('Flow') ? (
                                <Zap className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Send className="w-4 h-4 text-amber-500" />
                              )}
                            </div>
                            <div className="max-w-[150px] truncate">
                              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{item.name}</p>
                              <p className="text-[11px] font-semibold text-slate-500 truncate">{item.sublabel || item.type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900 dark:text-white">{typeof item.metric === 'number' ? item.metric.toLocaleString() : item.metric}</span>
                            <p className="text-[10px] font-bold text-slate-400">{t('charts.sent')}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs font-semibold text-slate-400">
                        {t('charts.noTopPerformers')}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

            </div>

            {/* Row 3: Lead Sources %, Country %, and Mature vs Lost Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
              
              {/* Lead Source Breakdown (5 Columns) */}
              <Card className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {t('charts.leadSourcesTitle')}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {t('charts.leadSourcesDesc')}
                      </p>
                    </div>
                    <Target className="w-4 h-4 text-sky-500" />
                  </div>

                  {(data?.leadSources || []).length > 0 ? (
                    <>
                      <div className="relative h-48 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data?.leadSources}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="count"
                              stroke="none"
                              cornerRadius={4}
                            >
                              {(data?.leadSources || []).map((entry, index) => (
                                <Cell key={`lead-src-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderRadius: '12px',
                                border: 'none',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                              formatter={(val: any, name: any) => [`${val} contacts`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {(data?.leadSources || []).reduce((a, b) => a + (b.count || 0), 0).toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('charts.allLeads')}</span>
                        </div>
                      </div>

                      <div className="space-y-2 mt-3">
                        {(data?.leadSources || []).map((src) => (
                          <div key={src.name} className="flex items-center justify-between text-[12px] font-bold">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                              <span className="text-slate-700 dark:text-slate-300 truncate">{src.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-slate-400 font-semibold text-xs">{src.count.toLocaleString()}</span>
                              <span className="text-slate-900 dark:text-white text-xs w-11 text-right font-black">
                                {src.percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 flex items-center justify-center text-xs font-semibold text-slate-400">
                      No lead source attribution data available
                    </div>
                  )}
                </div>
              </Card>

              {/* Lead Maturity & Pipeline Conversion (3 Columns) */}
              <Card className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {t('charts.leadMaturityTitle')}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {t('charts.leadMaturityDesc')}
                      </p>
                    </div>
                    <Flame className="w-4 h-4 text-emerald-500" />
                  </div>

                  <div className="space-y-5">
                    {/* Big Conversion Rate */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">
                        {t('charts.conversionRate')}
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <h4 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                          {data?.leadMaturity?.conversionRate ?? 0}%
                        </h4>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {t('charts.matureLeads')}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-3">
                        <div
                          className="bg-[#00B074] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, data?.leadMaturity?.conversionRate ?? 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Breakdown Items */}
                    <div className="space-y-3">
                      {/* Mature */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('charts.matureLeads')}</span>
                        </div>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {data?.leadMaturity?.matureCount?.toLocaleString() || 0}
                        </span>
                      </div>

                      {/* In Progress */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100/80 dark:border-sky-900/30">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('charts.inProgressLeads')}</span>
                        </div>
                        <span className="text-sm font-black text-sky-600 dark:text-sky-400">
                          {data?.leadMaturity?.inProgressCount?.toLocaleString() || 0}
                        </span>
                      </div>

                      {/* Lost */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100/80 dark:border-rose-900/30">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('charts.lostLeads')}</span>
                        </div>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                          {data?.leadMaturity?.lostCount?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Country % Distribution (4 Columns) */}
              <Card className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                        {t('charts.countryDistributionTitle')}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {t('charts.countryDistributionDesc')}
                      </p>
                    </div>
                    <Globe className="w-4 h-4 text-emerald-500" />
                  </div>

                  {(data?.countryDistribution || []).length > 0 ? (
                    <div className="space-y-3.5">
                      {(data?.countryDistribution || []).slice(0, 7).map((c) => (
                        <div key={c.country} className="space-y-1">
                          <div className="flex items-center justify-between text-[12px] font-bold">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base leading-none">{c.flag}</span>
                              <span className="text-slate-800 dark:text-slate-200 truncate">{c.country}</span>
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">{c.code}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-slate-400 font-semibold text-xs">{c.count.toLocaleString()}</span>
                              <span className="text-slate-900 dark:text-white text-xs font-black w-10 text-right">{c.percentage}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, c.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 flex items-center justify-center text-xs font-semibold text-slate-400">
                      No country distribution data available
                    </div>
                  )}
                </div>
              </Card>

            </div>

          </div>
        ) : activeTab === "agents" ? (
          /* Agent Performance & Deep Tracking Tab */
          <div className="space-y-6 mt-6">
            {/* Agent Team Overview Strip (4 Metric Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Assigned Today */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block uppercase">
                      {t('table.assignedToday')}
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                        {(data?.agents || []).reduce((acc, a) => acc + (a.assignedToday || 0), 0).toLocaleString()}
                      </h3>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                        Today
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Leads routed to team today
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              {/* Assigned Yesterday */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block uppercase">
                      {t('table.assignedYesterday')}
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                        {(data?.agents || []).reduce((acc, a) => acc + (a.assignedYesterday || 0), 0).toLocaleString()}
                      </h3>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Yesterday
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Previous day distribution
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              {/* Mature Leads Won */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block uppercase">
                      {t('charts.matureLeads')}
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                        {(data?.agents || []).reduce((acc, a) => acc + (a.matureLeads || 0), 0).toLocaleString()}
                      </h3>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074]">
                        Won
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      Total qualified & closed sales
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              {/* Team Conversion % */}
              <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] p-5 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest block uppercase">
                      {t('charts.conversionRate')}
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                        {(() => {
                          const m = (data?.agents || []).reduce((acc, a) => acc + (a.matureLeads || 0), 0);
                          const l = (data?.agents || []).reduce((acc, a) => acc + (a.lostLeads || 0), 0);
                          return (m + l) > 0 ? ((m / (m + l)) * 100).toFixed(1) : "0.0";
                        })()}%
                      </h3>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-600">
                        Team
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Mature vs lost conversion
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-950/20 text-sky-500 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
              </Card>

            </div>

            {/* Deep Agent Tracking Table */}
            <Card className="rounded-[24px] border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  {t('charts.agentPerformanceMetrics')}
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-slate-400">{t('charts.agentPerformanceDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4 text-slate-400">{t('table.agent')}</th>
                        <th className="px-4 py-4 text-slate-400 text-center">{t('table.assignedToday')}</th>
                        <th className="px-4 py-4 text-slate-400 text-center">{t('table.assignedYesterday')}</th>
                        <th className="px-4 py-4 text-slate-400 text-center">{t('table.assignedPeriod')}</th>
                        <th className="px-4 py-4 text-slate-400 text-center">{t('table.messagesSent')}</th>
                        <th className="px-4 py-4 text-slate-400 text-center">AVG RESPONSE</th>
                        <th className="px-4 py-4 text-slate-400 text-center">{t('table.matureVsLost')}</th>
                        <th className="px-4 py-4 text-slate-400 text-center">{t('table.conversionRate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.agents || []).map((agent) => (
                        <tr key={agent.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-sm font-bold text-[#00B074]">
                                {agent.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{agent.name}</p>
                                <p className="text-xs text-slate-400 font-semibold">{agent.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                              {agent.assignedToday || 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                              {agent.assignedYesterday || 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-200">
                            {agent.assignedInPeriod || agent.chatsAssigned}
                          </td>
                          <td className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-200">
                            {agent.messagesSent.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {agent.avgResponseTime}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="inline-flex items-center gap-1.5 text-xs font-bold">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                                {agent.matureLeads || 0}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">/</span>
                              <span className="text-rose-500 font-black">
                                {agent.lostLeads || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-14 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#00B074] h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, agent.conversionRate || 0)}%` }}
                                />
                              </div>
                              <span className="text-xs font-black text-slate-900 dark:text-white w-9 text-right">
                                {agent.conversionRate || 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(data?.agents || []).length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-xs font-semibold text-slate-400 tracking-widest">
                            {t('table.noAgent')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : activeTab === "flows" ? (
          <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {t('charts.flowExecutions')}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">{t('charts.flowExecutionsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 text-slate-400">{t('table.flowName')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.status')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.totalExecutions')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.failed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.flows || []).map((flow) => (
                      <tr key={flow.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{flow.name}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn("px-2.5 py-1 text-[10px] font-bold rounded-full", flow.isActive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>
                            {flow.isActive ? t('cards.active') : t('table.status')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-200">{flow.totalExecutions}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-red-600">{flow.failedExecutions}</td>
                      </tr>
                    ))}
                    {(data?.flows || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-xs font-semibold text-slate-400 tracking-widest">
                          {t('table.noFlows')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : activeTab.toLowerCase() === "templates" ? (
          <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {t('charts.templatesPerformance')}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">{t('charts.templatesPerformanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 text-slate-400">{t('table.templateName')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.status')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.sent')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.delivered')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.read')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.templates || []).length > 0 ? (data?.templates || []).map((template) => (
                      <tr key={template.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{template.name}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn("px-2.5 py-1 text-[10px] font-bold rounded-full", template.status === 'Approved' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30")}>
                            {template.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-200">{template.sent.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-emerald-600">{template.delivered.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-purple-600">{template.read.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">{t('table.noTemplates')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : activeTab.toLowerCase() === "automations" ? (
          <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {t('charts.automationsOverview')}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">{t('charts.automationsOverviewDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 text-slate-400">{t('table.automationName')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.status')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.triggers')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.actionsExecuted')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.failed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.automations || []).length > 0 ? (data?.automations || []).map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn("px-2.5 py-1 text-[10px] font-bold rounded-full", item.status === 'Active' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-200">{item.triggers.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-emerald-600">{item.actions.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-red-600">{item.failed.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">{t('table.noAutomations')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : activeTab.toLowerCase() === "campaigns" ? (
          <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 shadow-sm rounded-[24px] overflow-hidden flex flex-col justify-between">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {t('charts.campaignsPerformance')}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-slate-400">{t('charts.campaignsPerformanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-y border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 text-slate-400">{t('table.campaignName')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.status')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.recipients')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.sent')}</th>
                      <th className="px-4 py-4 text-slate-400 text-center">{t('table.delivered')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.campaigns || []).length > 0 ? (data?.campaigns || []).map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn("px-2.5 py-1 text-[10px] font-bold rounded-full", item.status === 'Completed' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : item.status === 'Running' ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-200">{item.recipients.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-slate-600">{item.sent.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center text-sm font-bold text-emerald-600">{item.delivered.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">{t('table.noCampaigns')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Fallback State */
          <Card className="rounded-[24px] border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[350px]">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] rounded-full mb-4">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{activeTab} Analytics</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Detailed metrics for {activeTab} are compiled from live database telemetry.
            </p>
          </Card>
        )}
      </div>
    </ManageLayout>
  )
}
