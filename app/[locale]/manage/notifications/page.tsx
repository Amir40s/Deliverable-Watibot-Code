"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import ManageLayout from "@/components/layouts/ManageLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle2, Trash2, MessageCircle, Send, Users,
  PlusCircle, AlertTriangle, DollarSign, Settings2,
  ChevronLeft, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { getActivityLogs, type ActivityLogEntry, type ActivityLogFilters } from "@/app/actions/activity-log"
import { toast } from "sonner"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from "@/components/ui/dialog"
import { useLocale, useTranslations } from "next-intl"

type TabKey = "all" | "contacts" | "messages" | "campaigns" | "flows" | "system"
type DateRangeFilter = "7d" | "30d" | "all"
type StatusFilter = "all" | "unread"

const TABS: Array<{ key: TabKey; moduleFilter: string }> = [
  { key: "all", moduleFilter: "all" },
  { key: "contacts", moduleFilter: "contact" },
  { key: "messages", moduleFilter: "whatsapp,message,chat" },
  { key: "campaigns", moduleFilter: "campaign" },
  { key: "flows", moduleFilter: "flow,automation" },
  { key: "system", moduleFilter: "agent,tag,system,setting,billing,integration,user" },
]

const ITEMS_PER_PAGE = 8

function getModuleStyle(module: string) {
  const m = module.toUpperCase();
  if (m.includes('CONTACT')) return { icon: Users, color: "bg-amber-100", textCol: "text-amber-500", hex: "#f59e0b" };
  if (m.includes('MESSAGE') || m.includes('CHAT')) return { icon: MessageCircle, color: "bg-[#00B074]", textCol: "text-white", hex: "#10b981" };
  if (m.includes('CAMPAIGN')) return { icon: Send, color: "bg-indigo-500", textCol: "text-white", hex: "#6366f1" };
  if (m.includes('FLOW') || m.includes('AUTOMATION')) return { icon: AlertTriangle, color: "bg-red-100", textCol: "text-red-500", hex: "#ef4444" };
  if (m.includes('BILLING') || m.includes('PAYMENT')) return { icon: DollarSign, color: "bg-emerald-100", textCol: "text-emerald-500", hex: "#10b981" };
  if (m.includes('INTEGRATION') || m.includes('API')) return { icon: PlusCircle, color: "bg-blue-500", textCol: "text-white", hex: "#3b82f6" };
  return { icon: Settings2, color: "bg-slate-100", textCol: "text-slate-500", hex: "#64748b" };
}

export default function NotificationCenterPage() {
  const t = useTranslations("NotificationsPage")
  const locale = useLocale()
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr"
  const isRtl = dir === "rtl"

  const [activeTab, setActiveTab] = useState<TabKey>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("7d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const percentFormatter = useMemo(() => new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
    maximumFractionDigits: 1
  }), [locale])

  const formatRelativeTime = useCallback((dateInput: Date | string) => {
    const date = new Date(dateInput)
    if (Number.isNaN(date.getTime())) return t("unknownTime")

    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
    const absSeconds = Math.abs(diffSeconds)
    const formatter = new Intl.RelativeTimeFormat(locale === "en" ? "en-US" : locale, { numeric: "auto" })

    if (absSeconds < 60) return formatter.format(diffSeconds, "second")
    const diffMinutes = Math.round(diffSeconds / 60)
    if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute")
    const diffHours = Math.round(diffMinutes / 60)
    if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour")
    const diffDays = Math.round(diffHours / 24)
    if (Math.abs(diffDays) < 30) return formatter.format(diffDays, "day")
    const diffMonths = Math.round(diffDays / 30)
    if (Math.abs(diffMonths) < 12) return formatter.format(diffMonths, "month")
    return formatter.format(Math.round(diffMonths / 12), "year")
  }, [locale, t])

  const getModuleLabel = useCallback((module: string) => {
    const normalized = module.toLowerCase()
    if (normalized.includes("contact")) return t("modules.contacts")
    if (normalized.includes("message") || normalized.includes("chat") || normalized.includes("whatsapp")) return t("modules.messages")
    if (normalized.includes("campaign")) return t("modules.campaigns")
    if (normalized.includes("flow") || normalized.includes("automation")) return t("modules.flows")
    if (normalized.includes("billing") || normalized.includes("payment")) return t("modules.billing")
    if (normalized.includes("integration") || normalized.includes("api")) return t("modules.integrations")
    if (normalized.includes("agent") || normalized.includes("tag") || normalized.includes("system") || normalized.includes("setting") || normalized.includes("user")) return t("modules.system")
    return module
  }, [t])

  const getStatusLabel = useCallback((status: string) => {
    const normalized = status.toLowerCase()
    if (normalized === "warning") return t("status.warning")
    if (normalized === "failed" || normalized === "error") return t("status.failed")
    if (normalized === "success") return t("status.success")
    return status
  }, [t])

  useEffect(() => {
    const handleReadState = () => {
      const lrStr = localStorage.getItem('notificationsLastReadAt');
      if (lrStr) setLastReadAt(parseInt(lrStr, 10));
    };
    handleReadState(); // Initial load
    window.addEventListener('notificationsMarkedAsRead', handleReadState);
    return () => window.removeEventListener('notificationsMarkedAsRead', handleReadState);
  }, []);
  
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const moduleFilter = TABS.find(tab => tab.key === activeTab)?.moduleFilter ?? "all"

      const filters: ActivityLogFilters = {
        limit: ITEMS_PER_PAGE,
        page: currentPage,
        module: moduleFilter
      };

      if (statusFilter === "unread" && lastReadAt > 0) {
         filters.dateFrom = new Date(lastReadAt).toISOString();
      }

      if (dateRangeFilter !== "all") {
         const d = new Date();
         if (dateRangeFilter === "7d") d.setDate(d.getDate() - 7);
         if (dateRangeFilter === "30d") d.setDate(d.getDate() - 30);
         const rangeDateStr = d.toISOString();
         if (filters.dateFrom) {
            filters.dateFrom = new Date(Math.max(new Date(filters.dateFrom).getTime(), d.getTime())).toISOString();
         } else {
            filters.dateFrom = rangeDateStr;
         }
      }

      const res = await getActivityLogs(filters);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentPage, dateRangeFilter, statusFilter, lastReadAt]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  const unreadCount = logs.filter(log => new Date(log.createdAt).getTime() > lastReadAt).length;

  const summaryData = useMemo(() => {
    const summaryMap: Record<string, { count: number, hex: string }> = {};
    logs.forEach(log => {
      const m = log.module.toUpperCase();
      if (!summaryMap[m]) {
        summaryMap[m] = { count: 0, hex: getModuleStyle(m).hex };
      }
      summaryMap[m].count++;
    });

    return Object.keys(summaryMap).map(key => ({
      name: getModuleLabel(key),
      value: summaryMap[key].count,
      color: summaryMap[key].hex,
      percent: logs.length > 0 ? `${percentFormatter.format((summaryMap[key].count / logs.length) * 100)}%` : "0%"
    }));
  }, [getModuleLabel, logs, percentFormatter]);

  const handleClearFilters = () => {
    setActiveTab("all")
    setDateRangeFilter("7d")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  const paginationStart = total === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const paginationEnd = Math.min(currentPage * ITEMS_PER_PAGE, total)

  return (
    <ManageLayout
      title={t("title")}
      description={t("description")}
      contentClassName="max-w-full plus-jakarta-forced"
    >
      <div dir={dir} className="space-y-6 pb-10">

        {/* Top Actions & Tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-end gap-3 w-full">
            <Button 
              onClick={() => {
                localStorage.setItem('notificationsLastReadAt', Date.now().toString());
                window.dispatchEvent(new Event('notificationsMarkedAsRead'));
                toast.success(t("allMarkedAsRead"));
              }}
              variant="outline" 
              className="text-slate-600 dark:text-slate-300 font-semibold h-9 rounded-xl border-slate-200 dark:border-slate-800 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t("markAllAsRead")}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold h-9 rounded-xl border-red-100 dark:border-red-900/30 gap-2">
                  <Trash2 className="w-4 h-4" />
                  {t("clearAll")}
                </Button>
              </DialogTrigger>
              <DialogContent dir={dir} className="max-w-md">
                <DialogHeader className="text-start">
                  <DialogTitle>{t("clearDialogTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("clearDialogDescription")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className={cn("mt-4", isRtl ? "flex-row-reverse" : "")}>
                  <DialogClose asChild>
                    <Button variant="outline" className="font-semibold rounded-xl">{t("cancel")}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button 
                      variant="destructive" 
                      className="font-semibold bg-red-600 hover:bg-red-700 rounded-xl"
                      onClick={() => {
                        setLogs([]);
                        setTotal(0);
                        toast.success(t("allCleared"));
                      }}
                    >
                      {t("clearAll")}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                className={cn(
                  "flex items-center gap-2 pb-3 border-b-2 text-sm font-bold transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-[#00B074] text-[#00B074]" 
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {t(`tabs.${tab.key}`)}
                {tab.key === "all" && (lastReadAt === 0 ? total > 0 : unreadCount > 0) && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none",
                    activeTab === tab.key
                      ? "bg-[#00B074] text-white" 
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
                  )}>
                    {lastReadAt === 0 ? total : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (8 cols): Notification List */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex flex-col rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px] relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 z-10">
                  <div className="w-8 h-8 border-4 border-[#00B074] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                  <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-semibold">{t("noNotifications")}</p>
                </div>
              ) : (
                logs.map((log, idx) => {
                  const style = getModuleStyle(log.module);
                  const Icon = style.icon;
                  return (
                    <div 
                      key={log.id} 
                      className={cn(
                        "p-5 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group relative",
                        isRtl && "flex-row-reverse text-right",
                        idx !== logs.length - 1 && "border-b border-slate-100 dark:border-slate-800/60"
                      )}
                    >
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", style.color, style.textCol)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h4 className="text-[14.5px] font-bold text-slate-900 dark:text-white leading-tight">
                          {log.action}
                        </h4>
                        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                          {(() => {
                            const actor = log.userName || log.userEmail || null;
                            const main = log.details || log.target || '';
                            if (actor) return main ? `${actor} · ${main}` : actor;
                            return main || t("systemActivityFallback");
                          })()}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="inline-flex text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {getModuleLabel(log.module)}
                          </span>
                          {log.status !== 'success' && (
                             <span className={cn("inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md", 
                               log.status === 'warning' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                             )}>
                               {getStatusLabel(log.status)}
                             </span>
                          )}
                        </div>
                      </div>

                      <div className={cn("flex flex-col gap-3 shrink-0 pt-1", isRtl ? "items-start" : "items-end")}>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                        <div className={cn("flex items-center w-full mt-1", isRtl ? "justify-start" : "justify-end")}>
                          {new Date(log.createdAt).getTime() > lastReadAt && <div className="w-2.5 h-2.5 rounded-full bg-[#00B074]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between px-2 py-2">
                <p className="text-xs font-bold text-slate-500">
                  {t("showingNotifications", { start: paginationStart, end: paginationEnd, total })}
                </p>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" size="icon" className="w-8 h-8 rounded-lg border-slate-200"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </Button>
                  
                  {/* Simplified pagination numbers for demo */}
                  <Button variant="outline" size="sm" className="w-8 h-8 rounded-lg border-[#00B074] text-[#00B074] font-bold">{currentPage}</Button>
                  
                  <Button 
                    variant="outline" size="icon" className="w-8 h-8 rounded-lg border-slate-200"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Notification Summary Donut */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardContent className="p-5">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 text-start">{t("summaryTitle")}</h3>
                <div className={cn("flex items-center", isRtl ? "flex-row-reverse" : "")}>
                  <div className="w-32 h-32 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summaryData.length > 0 ? summaryData : [{ value: 1, color: '#e2e8f0' }]}
                          innerRadius={45}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {(summaryData.length > 0 ? summaryData : [{ value: 1, color: '#e2e8f0' }]).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">{logs.length}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{t("visible")}</span>
                    </div>
                  </div>
                  
                  <div className={cn("flex-1 flex flex-col gap-2", isRtl ? "pr-4" : "pl-4")}>
                    {summaryData.length === 0 ? (
                      <span className="text-xs text-slate-400">{t("noData")}</span>
                    ) : (
                      summaryData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-[11px] font-bold">
                          <div className={cn("flex items-center gap-2", isRtl ? "flex-row-reverse" : "")}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                          </div>
                          <div className={cn("flex items-center gap-1.5", isRtl ? "flex-row-reverse" : "")}>
                            <span className="text-slate-900 dark:text-white">{item.value}</span>
                            <span className="text-slate-400 font-medium">({item.percent})</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filter Notifications */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{t("filterTitle")}</h3>
                  <button onClick={handleClearFilters} className="text-[11px] font-bold text-blue-500 hover:text-blue-600">{t("clearFilters")}</button>
                </div>
                

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 text-start block">{t("category")}</label>
                  <Select value={activeTab} onValueChange={(val) => {
                    setActiveTab(val as TabKey);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger dir={dir} className={cn("h-9 bg-white dark:bg-slate-950 rounded-xl text-xs font-semibold border-slate-200 focus:ring-1 focus:ring-emerald-500", isRtl ? "text-right" : "text-left")}>
                      <SelectValue placeholder={t("selectCategory")} />
                    </SelectTrigger>
                    <SelectContent dir={dir} className={isRtl ? "text-right" : "text-left"}>
                      {TABS.map(tab => (
                        <SelectItem key={tab.key} value={tab.key}>{tab.key === "all" ? t("allCategories") : t(`tabs.${tab.key}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 text-start block">{t("dateRange")}</label>
                  <Select value={dateRangeFilter} onValueChange={(val) => { setDateRangeFilter(val as DateRangeFilter); setCurrentPage(1); }}>
                    <SelectTrigger dir={dir} className={cn("h-9 bg-white dark:bg-slate-950 rounded-xl text-xs font-semibold border-slate-200 focus:ring-1 focus:ring-emerald-500", isRtl ? "text-right" : "text-left")}>
                      <SelectValue placeholder={t("selectRange")} />
                    </SelectTrigger>
                    <SelectContent dir={dir} className={isRtl ? "text-right" : "text-left"}>
                      <SelectItem value="7d">{t("ranges.last7Days")}</SelectItem>
                      <SelectItem value="30d">{t("ranges.last30Days")}</SelectItem>
                      <SelectItem value="all">{t("ranges.allTime")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 text-start block">{t("statusLabel")}</label>
                  <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val as StatusFilter); setCurrentPage(1); }}>
                    <SelectTrigger dir={dir} className={cn("h-9 bg-white dark:bg-slate-950 rounded-xl text-xs font-semibold border-slate-200 focus:ring-1 focus:ring-emerald-500", isRtl ? "text-right" : "text-left")}>
                      <SelectValue placeholder={t("selectStatus")} />
                    </SelectTrigger>
                    <SelectContent dir={dir} className={isRtl ? "text-right" : "text-left"}>
                      <SelectItem value="all">{t("allStatus")}</SelectItem>
                      <SelectItem value="unread">{t("status.unread")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </CardContent>
            </Card>
 

          </div>
        </div>

      </div>
    </ManageLayout>
  )
}
