"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import {
  Database,
  Users,
  Megaphone,
  MessageSquare,
  Zap,
  Headphones,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Info,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PLAN_CONFIG_UPDATED_EVENT, PLAN_CONFIG_UPDATED_STORAGE_KEY } from "@/lib/plan-refresh"

const rtlLocales = ["ar", "ur", "hi", "bn"]
const resourceColorClasses = {
  emerald: {
    icon: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600",
    value: "text-emerald-600",
    progress: "bg-emerald-100 dark:bg-emerald-950/40"
  },
  blue: {
    icon: "bg-blue-50 dark:bg-blue-950/20 text-blue-600",
    value: "text-blue-600",
    progress: "bg-blue-100 dark:bg-blue-950/40"
  },
  purple: {
    icon: "bg-purple-50 dark:bg-purple-950/20 text-purple-600",
    value: "text-purple-600",
    progress: "bg-purple-100 dark:bg-purple-950/40"
  },
  amber: {
    icon: "bg-amber-50 dark:bg-amber-950/20 text-amber-600",
    value: "text-amber-600",
    progress: "bg-amber-100 dark:bg-amber-950/40"
  },
  rose: {
    icon: "bg-rose-50 dark:bg-rose-950/20 text-rose-600",
    value: "text-rose-600",
    progress: "bg-rose-100 dark:bg-rose-950/40"
  }
} as const

type ResourceColor = keyof typeof resourceColorClasses
type ResourceItem = {
  key: string
  name: string
  icon: LucideIcon
  limit: number
  used: number
  color: ResourceColor
  description: string
}

export default function QuotaPage() {
  const t = useTranslations("QuotaPage")
  const locale = useLocale()
  const dir = rtlLocales.includes(locale) ? "rtl" : "ltr"
  const isRtl = dir === "rtl"
  const numberFormatter = new Intl.NumberFormat(locale)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadStats = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const data = await getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error("Failed to load quota stats", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats(true)
  }, [loadStats])

  useEffect(() => {
    const refreshQuotaStats = () => {
      if (document.visibilityState === "visible") {
        loadStats()
      }
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PLAN_CONFIG_UPDATED_STORAGE_KEY) {
        refreshQuotaStats()
      }
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshQuotaStats()
      }
    }

    window.addEventListener(PLAN_CONFIG_UPDATED_EVENT, refreshQuotaStats)
    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", refreshQuotaStats)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    const interval = window.setInterval(refreshQuotaStats, 30000)

    return () => {
      window.removeEventListener(PLAN_CONFIG_UPDATED_EVENT, refreshQuotaStats)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", refreshQuotaStats)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.clearInterval(interval)
    }
  }, [loadStats])

  if (isLoading) {
    return (
      <DashboardLayoutClient>
        <div dir={dir} className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse flex flex-col items-center gap-4 text-center">
            <Database className="w-12 h-12 text-emerald-500/20" />
            <p className="text-slate-400 font-medium">{t("loading")}</p>
          </div>
        </div>
      </DashboardLayoutClient>
    )
  }

  const remainingQuota = stats ? stats.totalQuota - stats.usedQuota : 0
  const quotaPercentage = stats?.totalQuota ? Math.min(100, (stats.usedQuota / stats.totalQuota) * 100) : 0

  const resources: ResourceItem[] = [
    {
      key: "contacts",
      name: t("resources.contacts.name"),
      icon: Users,
      limit: stats?.limits.contacts ?? 0,
      used: stats?.usage.contacts ?? 0,
      color: "emerald",
      description: t("resources.contacts.description")
    },
    {
      key: "dripCampaign",
      name: t("resources.dripCampaign.name"),
      icon: Megaphone,
      limit: stats?.limits.campaigns ?? 0,
      used: stats?.usage.campaigns ?? 0,
      color: "blue",
      description: t("resources.dripCampaign.description")
    },
    {
      key: "liveChat",
      name: t("resources.liveChat.name"),
      icon: MessageSquare,
      limit: stats?.limits.botReplies ?? 0,
      used: stats?.usage.botReplies ?? 0,
      color: "purple",
      description: t("resources.liveChat.description")
    },
    {
      key: "botFlows",
      name: t("resources.botFlows.name"),
      icon: Zap,
      limit: stats?.limits.botFlows ?? 0,
      used: stats?.usage.botFlows ?? 0,
      color: "amber",
      description: t("resources.botFlows.description")
    },
    {
      key: "agents",
      name: t("resources.agents.name"),
      icon: Headphones,
      limit: stats?.limits.teamMembers ?? 0,
      used: stats?.usage.teamMembers ?? 0,
      color: "rose",
      description: t("resources.agents.description")
    }
  ]

  return (
    <DashboardLayoutClient>
      <div dir={dir} className="max-w-6xl mx-auto space-y-8 pb-10 text-start">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 font-bold tracking-widest text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t("planStatus")}
            </div>
            <h1 className="text-3xl font-bold text-[#123E40] dark:text-white tracking-tight">
              {t("title")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-md">
              {t("subtitle")}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-3 shadow-sm flex items-center gap-4">
            <span className="text-[10px] font-bold tracking-widest text-slate-400">{t("currentPlan")}</span>
            <span className="text-emerald-600 font-bold tracking-tight text-sm px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-full border border-emerald-100 dark:border-emerald-900/50">
              {stats?.servicePlan || t("unknownPlan")}
            </span>
          </div>
        </div>

        <Card className="border-none shadow-xl bg-gradient-to-br from-[#123E40] to-[#0A2526] text-white overflow-hidden relative group">
          <div className={cn("absolute top-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity", isRtl ? "left-0" : "right-0")}>
            <TrendingUp className={cn("w-32 h-32", isRtl ? "-rotate-12" : "rotate-12")} />
          </div>
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="text-lg font-bold opacity-80 tracking-[0.2em] text-[12px]">{t("aggregateBalance")}</CardTitle>
            <CardDescription className="text-white/60 text-sm tracking-tight">{t("aggregateDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-1">
                <span dir="ltr" className="text-5xl font-bold tracking-tighter tabular-nums">{numberFormatter.format(stats?.totalQuota ?? 0)}</span>
                <p className="text-[10px] font-bold tracking-widest text-white/50">{t("totalQuota")}</p>
              </div>
              <div className="space-y-1">
                <span dir="ltr" className="text-5xl font-bold tracking-tighter tabular-nums text-emerald-400">{numberFormatter.format(remainingQuota)}</span>
                <p className="text-[10px] font-bold tracking-widest text-white/50">{t("remainingBalance")}</p>
              </div>
              <div className="space-y-1">
                <span dir="ltr" className="text-5xl font-bold tracking-tighter tabular-nums text-white/30">{numberFormatter.format(stats?.usedQuota ?? 0)}</span>
                <p className="text-[10px] font-bold tracking-widest text-white/50">{t("usedToDate")}</p>
              </div>
            </div>
            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-[10px] font-bold tracking-widest text-white/60">
                <span>{t("overallUsageProgress")}</span>
                <span dir="ltr">{numberFormatter.format(Math.round(quotaPercentage))}%</span>
              </div>
              <Progress value={quotaPercentage} className="h-2 bg-white/10" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => {
            const isUnlimited = resource.limit === -1
            const percentage = isUnlimited || resource.limit <= 0 ? 0 : Math.min(100, (resource.used / resource.limit) * 100)
            const remaining = isUnlimited ? "∞" : resource.limit - resource.used
            const colorClasses = resourceColorClasses[resource.color]

            return (
              <Card key={resource.key} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:shadow-md group overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                      colorClasses.icon
                    )}>
                      <resource.icon className="w-6 h-6" />
                    </div>
                    <div className="text-end">
                      <span className="text-[9px] font-bold tracking-widest text-slate-400 block mb-1">{t("remaining")}</span>
                      <span dir="ltr" className={cn(
                        "text-xl font-bold tracking-tight",
                        remaining === 0 ? "text-rose-600" : colorClasses.value
                      )}>
                        {typeof remaining === "number" ? numberFormatter.format(remaining) : remaining}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <CardTitle className="text-lg font-bold tracking-tight text-[#123E40] dark:text-white">{resource.name}</CardTitle>
                    <CardDescription className="text-[11px] leading-tight mt-1">{resource.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest">{t("used")}</span>
                      <span dir="ltr" className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">{numberFormatter.format(resource.used)}</span>
                    </div>
                    <div className="flex flex-col text-end">
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest">{t("totalLimit")}</span>
                      <span dir={isUnlimited ? dir : "ltr"} className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">{isUnlimited ? t("unlimited") : numberFormatter.format(resource.limit)}</span>
                    </div>
                  </div>
                  {!isUnlimited && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[9px] font-bold tracking-widest text-slate-400">
                        <span>{t("utilization")}</span>
                        <span dir="ltr">{numberFormatter.format(Math.round(percentage))}%</span>
                      </div>
                      <Progress value={percentage} className={cn("h-1.5", colorClasses.progress)} />
                    </div>
                  )}
                  {isUnlimited && (
                    <div className="pt-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-2 flex items-center gap-2">
                        <Info className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-500 tracking-wide">{t("unlimitedAccess")}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <AlertCircle className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1 space-y-1 text-center md:text-start">
            <h4 className="text-[14px] font-bold text-[#123E40] dark:text-blue-400 tracking-tight">{t("needMoreCapacity")}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              {t("resetDescription")}
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-change-plan"))}
            className="bg-[#123E40] hover:bg-[#1A5A5C] text-white px-8 py-3 rounded-xl text-xs font-bold tracking-[0.2em] transition-all shadow-lg shadow-teal-900/20 active:scale-95"
          >
            {t("upgradePlan")}
          </button>
        </div> */}
      </div>
    </DashboardLayoutClient>
  )
}
