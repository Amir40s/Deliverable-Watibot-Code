"use client"

import Link from "next/link"
import Image from "next/image"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ExternalLink, Search, Plus,
  Grid, CheckCircle2, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback, useEffect, useState, useMemo, type ReactElement } from "react"
import { getIntegrationStatus } from "@/app/actions/organization"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

const RTL_LOCALES = new Set(["ar", "ur"])
const LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  ur: "ur-PK",
  hi: "hi-IN",
  bn: "bn-BD",
  en: "en-US",
}

type IntegrationStatus = "Connected" | "Available"
type IntegrationCategory = "Analytics" | "Others" | "E-commerce"

type IntegrationItem = {
  id: "google-sheets" | "shopify" | "woocommerce"
  name: string
  description: string
  status: IntegrationStatus
  icon: () => ReactElement
  bg: string
  categories: IntegrationCategory[]
  connectedDate: string
  isMock: boolean
  href: string
}

// ── BRAND ICONS ──────────────────────────────────────────────────────────────
const BRAND_ICONS = {
  GOOGLE_SHEETS: () => (
    <Image src="/Google_Sheets_logo.png" alt="Google Sheets" width={28} height={28} className="w-7 h-7 shrink-0 object-contain" />
  ),
  SHOPIFY: () => (
    <Image src="/shopify-icon.png" alt="Shopify" width={28} height={28} className="w-7 h-7 shrink-0 object-contain" />
  ),
  WOOCOMMERCE: () => (
    <Image src="/woocomrce.png" alt="WooCommerce" width={28} height={28} className="w-7 h-7 shrink-0 object-contain" />
  ),
}

export default function IntegrationsPage() {
  const t = useTranslations("IntegrationsPage")
  const locale = useLocale()
  const isRtl = RTL_LOCALES.has(locale)
  const intlLocale = LOCALE_MAP[locale] ?? locale
  const [dbStatus, setDbStatus] = useState({
    shopifyConnected: false,
    googleSheetsConnected: false,
    woocommerceConnected: false,
  })

  // Filter States
  const [activeTab, setActiveTab] = useState("All Integrations")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<IntegrationCategory | "All">("All")
  const [statusFilter, setStatusFilter] = useState<IntegrationStatus | "All">("All")

  // Modal / Integration Details State
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationItem | null>(null)
  const [webhookUrlInput, setWebhookUrlInput] = useState("")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [connectingModal, setConnectingModal] = useState(false)

  const refreshIntegrationStatus = useCallback(async () => {
    try {
      const result = await getIntegrationStatus()
      setDbStatus(result)
    } catch (err) {
      console.error("Failed to load integrations status:", err)
    }
  }, [])

  useEffect(() => {
    refreshIntegrationStatus()
  }, [refreshIntegrationStatus])

  const formatCategory = (category: string) => {
    const categoryMap: Record<string, string> = {
      "All": t("filters.all"),
      "Analytics": t("categories.analytics"),
      "Others": t("categories.others"),
      "E-commerce": t("categories.ecommerce"),
    }
    return categoryMap[category] ?? category
  }

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      "All": t("filters.all"),
      "Connected": t("status.connected"),
      "Available": t("status.available"),
    }
    return statusMap[status] ?? status
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString))
  }

  // ── INTEGRATIONS DATA DEFINITION ───────────────────────────────────────────
  const integrationsData = useMemo<IntegrationItem[]>(() => {
    return [
      {
        id: "google-sheets",
        name: "Google Sheets",
        description: t("integrations.googleSheets.description"),
        status: dbStatus.googleSheetsConnected ? "Connected" : "Available",
        icon: BRAND_ICONS.GOOGLE_SHEETS,
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        categories: ["Analytics", "Others"],
        connectedDate: "2024-05-12",
        isMock: false,
        href: "/dashboard/integrations/google-sheets",
      },
      {
        id: "shopify",
        name: "Shopify",
        description: t("integrations.shopify.description"),
        status: dbStatus.shopifyConnected ? "Connected" : "Available",
        icon: BRAND_ICONS.SHOPIFY,
        bg: "bg-[#95BF47]/10 dark:bg-[#95BF47]/20",
        categories: ["E-commerce"],
        connectedDate: "2024-05-19",
        isMock: false,
        href: "/dashboard/integrations/shopify",
      },
      {
        id: "woocommerce",
        name: "WooCommerce",
        description: t("integrations.woocommerce.description"),
        status: dbStatus.woocommerceConnected ? "Connected" : "Available",
        icon: BRAND_ICONS.WOOCOMMERCE,
        bg: "bg-purple-50 dark:bg-purple-950/20",
        categories: ["E-commerce"],
        connectedDate: "2024-05-21",
        isMock: false,
        href: "/dashboard/integrations/woocommerce",
      },
    ]
  }, [dbStatus, t])

  // Calculate Stat Counts dynamically
  const connectedCount = useMemo(() => {
    return integrationsData.filter(x => x.status === "Connected").length
  }, [integrationsData])

  const availableCount = useMemo(() => {
    return integrationsData.filter(x => x.status === "Available").length
  }, [integrationsData])

  const totalCount = integrationsData.length

  // ── FILTERING & SORTING LOGIC ──────────────────────────────────────────────
  const filteredIntegrations = useMemo(() => {
    return integrationsData.filter(item => {
      // 1. Search Query
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      // 2. Active Tab (Left Horizontal Filter)
      if (activeTab === "Connected") {
        if (item.status !== "Connected") return false
      } else if (activeTab !== "All Integrations") {
        // Active tab matches a category
        const tabCategoryMap: Partial<Record<string, IntegrationCategory>> = {
          "E-commerce": "E-commerce",
          "Analytics": "Analytics",
          "Others": "Others"
        }
        const targetCat = tabCategoryMap[activeTab]
        if (targetCat && !item.categories.includes(targetCat)) return false
      }

      // 3. Dropdown Category
      if (categoryFilter !== "All") {
        if (!item.categories.includes(categoryFilter)) return false
      }

      // 4. Dropdown Status
      if (statusFilter !== "All") {
        if (item.status !== statusFilter) return false
      }

      return true
    }).sort((a, b) => {
      // Default: sort by Connected first, then available
      if (a.status === "Connected" && b.status === "Available") return -1
      if (a.status === "Available" && b.status === "Connected") return 1
      return 0
    })
  }, [integrationsData, searchQuery, activeTab, categoryFilter, statusFilter])

  // Connected List for Connected Grid Section
  const connectedList = useMemo(() => {
    return filteredIntegrations.filter(x => x.status === "Connected")
  }, [filteredIntegrations])

  // Available List for Available Grid Section
  const availableList = useMemo(() => {
    return filteredIntegrations.filter(x => x.status === "Available")
  }, [filteredIntegrations])

  // Handle open mock connection modal
  const handleOpenMockModal = (integration: IntegrationItem) => {
    setSelectedIntegration(integration)
    setWebhookUrlInput(integration.status === "Connected" ? `https://api.watibot.com/v1/webhooks/${integration.id}` : "")
    setApiKeyInput(integration.status === "Connected" ? "••••••••••••••••••••••••" : "")
  }

  // Handle Save / Toggle Connection state
  const handleToggleConnection = async () => {
    if (!selectedIntegration) return
    setConnectingModal(true)
    
    // Simulate real network call delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const isNowConnected = selectedIntegration.status !== "Connected"
    
    setConnectingModal(false)
    setSelectedIntegration(null)
    
    toast.success(
      isNowConnected 
        ? t("toasts.connected", { name: selectedIntegration.name })
        : t("toasts.disconnected", { name: selectedIntegration.name })
    )
  }

  const renderConnectionLabel = (item: IntegrationItem) => {
    const isConnected = item.status === "Connected"

    return (
      <span
        className={cn(
          "mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
          isConnected
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isConnected ? "bg-[#00B074]" : "bg-slate-400"
          )}
        />
        {isConnected ? t("status.connected") : t("status.disconnected")}
      </span>
    )
  }

  return (
    <DashboardLayoutClient mainClassName="p-0 bg-slate-50/50 dark:bg-slate-950/20 antialiased h-[calc(100vh-64px)] overflow-hidden transition-colors duration-300">
      <div dir={isRtl ? "rtl" : "ltr"} className="h-full overflow-y-auto p-6 md:p-8 text-start">
        <div className="max-w-[1600px] mx-auto space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <Grid className="w-6 h-6 text-[#00B074]" />
                {t("title")}
              </h2>
              <p className="text-slate-450 dark:text-slate-400 text-[13px] font-semibold">
                {t("subtitle")}
              </p>
            </div>
            

          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Stat 1 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{t("stats.totalIntegrations")}</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{totalCount}</h3>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">{t("stats.allTime")}</span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl flex items-center justify-center">
                <Grid className="w-6 h-6 text-emerald-500" />
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{t("stats.connectedIntegrations")}</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{connectedCount}</h3>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">{t("stats.currentlyActive")}</span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#00B074]" />
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{t("stats.availableIntegrations")}</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{availableCount}</h3>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">{t("stats.exploreAndConnect")}</span>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Core Panel Content */}
          <div className="space-y-6">
            
            {/* Tab Category Bar + Dropdowns Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
                
                {/* Tabs Row */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-100 dark:border-slate-800/60">
                  {["All Integrations", "Connected", "Others"].map(tab => {
                    const active = activeTab === tab
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "px-4 py-2.5 rounded-xl text-[13px] font-bold shrink-0 transition-all border-b-2 border-transparent relative cursor-pointer",
                          active 
                            ? "text-[#00B074] bg-emerald-50/40 dark:bg-emerald-950/10 font-extrabold" 
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                        )}
                      >
                        {tab === "All Integrations" ? t("tabs.allIntegrations") : tab === "Connected" ? t("tabs.connected") : t("tabs.others")}
                        {active && (
                          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00B074] rounded-full" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Sub-Filters / Search row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                  
                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search className={cn("w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400", isRtl ? "right-3.5" : "left-3.5")} />
                    <input 
                      type="text"
                      placeholder={t("searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={cn(
                        "w-full py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[13px] font-medium border border-transparent focus:border-slate-200 dark:focus:border-slate-700 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400",
                        isRtl ? "pr-10 pl-4" : "pl-10 pr-4"
                      )}
                    />
                  </div>

                  {/* Dropdowns Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    
                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[12px] font-bold text-slate-650 dark:text-slate-350">
                      <span>{t("filters.category")}:</span>
                      <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as IntegrationCategory | "All")}
                        className="bg-transparent font-black text-slate-800 dark:text-white outline-none cursor-pointer"
                      >
                        <option value="All">{t("filters.all")}</option>
                        <option value="E-commerce">{t("categories.ecommerce")}</option>
                        <option value="Others">{t("categories.others")}</option>
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[12px] font-bold text-slate-650 dark:text-slate-350">
                      <span>{t("filters.status")}:</span>
                      <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as IntegrationStatus | "All")}
                        className="bg-transparent font-black text-slate-800 dark:text-white outline-none cursor-pointer"
                      >
                        <option value="All">{t("filters.all")}</option>
                        <option value="Connected">{t("status.connected")}</option>
                        <option value="Available">{t("status.available")}</option>
                      </select>
                    </div>

                    

                  </div>

                </div>

              </div>

              {/* ── SECTION 1: CONNECTED INTEGRATIONS ── */}
              {connectedList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[14px] font-black text-slate-700 dark:text-slate-300">
                      {t("sections.connectedIntegrations", { count: connectedList.length })}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {connectedList.map(item => {
                      const Icon = item.icon
                      return (
                        <div 
                          key={item.id}
                          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[210px] group relative"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3.5">
                                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm", item.bg)}>
                                  <Icon />
                                </div>
                                <div className="space-y-0.5">
                                  <h3 className="text-[15px] font-black text-slate-800 dark:text-white group-hover:text-[#00B074] transition-colors">
                                    {item.name}
                                  </h3>
                                  {renderConnectionLabel(item)}
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <p className="text-[12.5px] font-semibold text-slate-450 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/40">
                            {item.connectedDate && (
                              <span className="text-[11px] font-bold text-slate-400">
                                {t("connectedOn", { date: formatDate(item.connectedDate) })}
                              </span>
                            )}
                            
                            {item.isMock ? (
                              <button 
                                onClick={() => handleOpenMockModal(item)}
                                className="ml-auto flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-bold text-slate-700 dark:text-slate-300 hover:text-[#00B074] hover:border-[#00B074] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
                              >
                                {t("buttons.manage")}
                              </button>
                            ) : (
                              <Button asChild variant="outline" className="ms-auto h-9 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-[12px] hover:text-[#00B074] hover:border-[#00B074] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95">
                                <Link href={item.href || "#"} className="flex items-center justify-center gap-1">
                                  {t("buttons.manage")}
                                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── SECTION 2: AVAILABLE INTEGRATIONS ── */}
              {availableList.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[14px] font-black text-slate-700 dark:text-slate-300">
                      {t("sections.availableIntegrations", { count: availableList.length })}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {availableList.map(item => {
                      const Icon = item.icon
                      return (
                        <div 
                          key={item.id}
                          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[210px] group relative"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3.5">
                                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm opacity-90", item.bg)}>
                                  <Icon />
                                </div>
                                <div className="space-y-0.5">
                                  <h3 className="text-[15px] font-black text-slate-800 dark:text-white group-hover:text-[#00B074] transition-colors">
                                    {item.name}
                                  </h3>
                                  {renderConnectionLabel(item)}
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <p className="text-[12.5px] font-semibold text-slate-450 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/40">
                            {/* Tags list inside card */}
                            <div className="flex gap-1">
                              {item.categories.map(cat => (
                                <span key={cat} className="text-[9.5px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                  {formatCategory(cat)}
                                </span>
                              ))}
                            </div>
                            
                            {item.isMock ? (
                              <button 
                                onClick={() => handleOpenMockModal(item)}
                                className="ms-auto flex items-center justify-center gap-1.5 px-4.5 py-2 bg-[#00B074] text-white border border-transparent rounded-xl text-[12px] font-bold hover:opacity-90 transition-all shadow-sm active:scale-95 cursor-pointer"
                              >
                                {t("buttons.connect")}
                              </button>
                            ) : (
                              <Button asChild variant="default" className="ms-auto h-9 bg-[#00B074] text-white hover:opacity-90 border border-transparent font-bold rounded-xl text-[12px] transition-all shadow-sm active:scale-95">
                                <Link href={item.href || "#"} className="flex items-center justify-center gap-1">
                                  {t("buttons.connect")}
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {filteredIntegrations.length === 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <Grid className="w-12 h-12 text-slate-350 mx-auto stroke-1" />
                  <h4 className="text-[16px] font-black text-slate-800 dark:text-white">{t("empty.title")}</h4>
                  <p className="text-[12.5px] font-semibold text-slate-450 dark:text-slate-400 max-w-sm mx-auto">
                    {t("empty.description", { search: searchQuery || t("empty.anySearch"), tab: activeTab === "All Integrations" ? t("tabs.allIntegrations") : activeTab === "Connected" ? t("tabs.connected") : t("tabs.others") })}
                  </p>
                  <button 
                    onClick={() => {
                      setSearchQuery("")
                      setCategoryFilter("All")
                      setStatusFilter("All")
                      setActiveTab("All Integrations")
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    {t("buttons.resetFilters")}
                  </button>
                </div>
              )}

            </div>

          {/* MOCK INTEGRATION CONNECTION SETTINGS MODAL */}
          <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
            <DialogContent
              dir={isRtl ? "rtl" : "ltr"}
              className="border border-slate-100 dark:border-slate-800 max-w-lg rounded-2xl bg-white dark:bg-slate-950 text-start"
            >
              {selectedIntegration && (
                <>
                  <DialogHeader className="space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm", selectedIntegration.bg)}>
                        {(() => {
                          const DialogIcon = selectedIntegration.icon
                          return <DialogIcon />
                        })()}
                      </div>
                      <div className="space-y-0.5">
                        <DialogTitle className="text-[18px] font-black text-slate-800 dark:text-white flex items-center gap-2">
                          {selectedIntegration.name}
                          <Badge className={cn(
                            "border-0 text-[10px] px-2 py-0.5 rounded-md tracking-wider font-extrabold",
                            selectedIntegration.status === "Connected" 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" 
                              : "bg-slate-100 text-slate-550 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {formatStatus(selectedIntegration.status)}
                          </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-[12.5px] font-semibold text-slate-400 dark:text-slate-500">
                          {t("modal.description")}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="py-4 space-y-4 text-[13px]">
                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-650 dark:text-slate-350">
                        {t("modal.webhookReceiverUrl")}
                      </label>
                      <input 
                        type="text" 
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        placeholder={`https://api.watibot.com/v1/webhooks/${selectedIntegration.id}`}
                        disabled={selectedIntegration.status !== "Connected"}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl font-medium outline-none text-slate-700 dark:text-slate-300 disabled:opacity-50"
                      />
                      <p className="text-[10px] font-semibold text-slate-450">
                        {t("modal.webhookHelp")}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-extrabold text-slate-650 dark:text-slate-350">
                        {t("modal.apiSecurityKey")}
                      </label>
                      <input 
                        type="password" 
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={t("modal.apiSecretPlaceholder")}
                        disabled={selectedIntegration.status !== "Connected"}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl font-medium outline-none text-slate-700 dark:text-slate-300 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/60 gap-3">
                    <button
                      onClick={() => setSelectedIntegration(null)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      {t("buttons.cancel")}
                    </button>
                    
                    <button
                      onClick={handleToggleConnection}
                      disabled={connectingModal}
                      className={cn(
                        "flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50",
                        selectedIntegration.status === "Connected"
                          ? "bg-red-500 hover:bg-red-600 shadow-red-500/10"
                          : "bg-[#00B074] hover:opacity-90 shadow-emerald-500/15"
                      )}
                    >
                      {connectingModal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t("buttons.processing")}
                        </>
                      ) : (
                        selectedIntegration.status === "Connected" ? t("buttons.disconnectIntegration") : t("buttons.connectIntegration")
                      )}
                    </button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </DashboardLayoutClient>
  )
}
