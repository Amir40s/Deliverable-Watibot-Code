"use client"

import React, { useEffect, useState } from "react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { 
  BarChart3, 
  TrendingUp, 
  RefreshCcw, 
  DollarSign, 
  Users, 
  MousePointer2, 
  Eye, 
  AlertCircle,
  ExternalLink,
  Target,
  LogOut,
  Megaphone,
  MoreVertical,
  CreditCard,
  ChevronDown,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { 
    getFacebookPages,
    saveFacebookPageId,
    getAdAccounts, 
    saveAdAccountId, 
    getAdInsights, 
    getAdAccountDetails, 
    getAdCampaigns,
    getAdAudienceBreakdown,
    getAdLeads,
    createSimpleAdCampaign,
    disconnectAdAccount 
} from "@/app/actions/facebook-ads"
import { toast } from "sonner"
import ConnectAdsButton from "@/components/dashboard/ConnectAdsButton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations, useLocale } from "next-intl"

export default function AdManagerPage() {
  const t = useTranslations("AdManager")
  const tc = useTranslations("CampaignsPage")
  const locale = useLocale()
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr"

  const { data: session } = useSession()
  
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState<any[]>([])
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [insights, setInsights] = useState<any>(null)
  const [accountDetails, setAccountDetails] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [audience, setAudience] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [datePreset, setDatePreset] = useState("last_30d")
  const [activeTab, setActiveTab] = useState("campaigns")
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({})
  const [expandedAdSets, setExpandedAdSets] = useState<Record<string, boolean>>({})
  const [isAccountLoading, setIsAccountLoading] = useState(false)

  const toggleCampaignExpand = (id: string) => {
    setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleAdSetExpand = (id: string) => {
    setExpandedAdSets(prev => ({ ...prev, [id]: !prev[id] }))
  }
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCampaign, setNewCampaign] = useState({
      name: "",
      budget: 500,
      locations: "PK",
      headline: "",
      body: "",
      imageUrl: "https://placehold.co/1200x628?text=Ad+Image"
  })

  const loadData = async (forcePageId?: string) => {
    setLoading(true)
    try {
      const fbPages = await getFacebookPages()
      setPages(fbPages)

      const savedPageId = forcePageId || (session?.user as any)?.organization?.facebookPageId
      const savedAccountId = (session?.user as any)?.organization?.facebookAdAccountId
      const pageIdToUse = savedPageId || (fbPages.length > 0 ? fbPages[0].id : null)

      if (pageIdToUse) {
        setSelectedPageId(pageIdToUse)
        // Fetch ad accounts scoped to the selected page
        const accounts = await getAdAccounts(pageIdToUse)
        setAdAccounts(accounts)

        const accountIdToUse = savedAccountId || (accounts.length > 0 ? accounts[0].id : null)
        if (accountIdToUse) {
          setSelectedAccountId(accountIdToUse)
          await fetchAllStats(accountIdToUse, pageIdToUse, datePreset)
        }
      } else {
        // No page found, still fetch all ad accounts as fallback
        const accounts = await getAdAccounts()
        setAdAccounts(accounts)
      }
    } catch (error: any) {
      console.error("Failed to load ad data", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllStats = async (accountId: string, pageId: string, preset: string) => {
    try {
      // Execute all calls but handle individual failures
      const [statsResult, detailsResult, campsResult, audResult, leadsResult] = await Promise.allSettled([
        getAdInsights({ adAccountId: accountId, datePreset: preset }),
        getAdAccountDetails(accountId),
        getAdCampaigns(accountId, preset),
        getAdAudienceBreakdown(accountId, preset),
        getAdLeads(pageId)
      ]);

      if (statsResult.status === 'fulfilled') setInsights(statsResult.value[0] || null);
      if (detailsResult.status === 'fulfilled') setAccountDetails(detailsResult.value);
      if (campsResult.status === 'fulfilled') setCampaigns(campsResult.value);
      if (audResult.status === 'fulfilled') setAudience(audResult.value);
      if (leadsResult.status === 'fulfilled') setLeads(leadsResult.value);

      // Log errors for debugging but don't crash the UI
      [statsResult, detailsResult, campsResult, audResult, leadsResult].forEach((res, i) => {
          if (res.status === 'rejected') {
              console.warn(`Ad API Call ${i} failed:`, res.reason);
          }
      });

    } catch (error) {
      console.error("Critical failure fetching ad insights", error)
      toast.error(t("loadDataFailed"))
    }
  }

  const handleCreateCampaign = async () => {
    if (!selectedAccountId || !selectedPageId) {
        toast.error(t("selectPageError"))
        return
    }
    if (!newCampaign.name || !newCampaign.body) {
        toast.error(t("fillRequiredFields"))
        return
    }

    setCreating(true)
    try {
        await createSimpleAdCampaign({
            adAccountId: selectedAccountId,
            pageId: selectedPageId,
            name: newCampaign.name,
            budget: newCampaign.budget,
            locations: [newCampaign.locations],
            headline: newCampaign.headline,
            body: newCampaign.body,
            imageUrl: newCampaign.imageUrl
        })
        toast.success(t("createSuccess"))
        setIsCreateModalOpen(false)
        await fetchAllStats(selectedAccountId, selectedPageId, datePreset)
    } catch (e: any) {
        toast.error(`${t("createFailed")}: ${e.message}`)
    } finally {
        setCreating(false)
    }
  }

  useEffect(() => {
    loadData()

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'WHATSAPP_CONNECTED' || event.data.type === 'FACEBOOK_CONNECTED') {
        loadData()
        toast.success(t("connectedSuccess"))
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handlePageChange = async (id: string) => {
    setIsAccountLoading(true)
    setSelectedPageId(id)
    setSelectedAccountId(null)
    setAdAccounts([])
    try {
      // Re-fetch ad accounts scoped to the newly selected page
      const accounts = await getAdAccounts(id)
      setAdAccounts(accounts)
      // Auto-select first account for this page
      const firstAccount = accounts[0]?.id || null
      if (firstAccount) {
        setSelectedAccountId(firstAccount)
        await fetchAllStats(firstAccount, id, datePreset)
      }
      await saveFacebookPageId(id)
      toast.success(t("pageSwitched"))
    } catch (e) {
      console.error(e)
    } finally {
      setIsAccountLoading(false)
    }
  }

  const handleAccountChange = async (id: string) => {
    setIsAccountLoading(true)
    setSelectedAccountId(id)
    if (selectedPageId) {
        await fetchAllStats(id, selectedPageId, datePreset)
    }
    try {
        await saveAdAccountId(id)
        toast.success(t("accSwitched"))
    } catch (e) {
        console.error(e)
    } finally {
        setIsAccountLoading(false)
    }
  }

  const handleDateChange = async (preset: string) => {
    setIsAccountLoading(true)
    setDatePreset(preset)
    if (selectedAccountId && selectedPageId) {
      await fetchAllStats(selectedAccountId, selectedPageId, preset)
    }
    setIsAccountLoading(false)
  }

  const handleDisconnect = async () => {
    if (!confirm(t("disconnectConfirm"))) return
    try {
        await disconnectAdAccount()
        setSelectedAccountId(null)
        setInsights(null)
        setCampaigns([])
        toast.success(t("disconnectSuccess"))
    } catch (e) {
        toast.error(t("disconnectFailed"))
    }
  }

  if (loading) {
    return (
      <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen plus-jakarta-forced max-w-none">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      </DashboardLayoutClient>
    )
  }

  if (!selectedAccountId) {
    return (
      <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen plus-jakarta-forced max-w-none">
        <div className="max-w-[800px] mx-auto mt-20 text-center space-y-6 px-4">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
            <Target className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("facebookAdManager")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {t("connectDesc")}
          </p>
          <div className="pt-4">
            <ConnectAdsButton />
          </div>
        </div>
      </DashboardLayoutClient>
    )
  }

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen plus-jakarta-forced max-w-none">
      <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4 md:px-8 pt-4">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className={cn("text-start", dir === "rtl" ? "sm:text-right" : "sm:text-left")}>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t("title")}</h1>
              {accountDetails && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-semibold">
                  {accountDetails.name} ({accountDetails.currency})
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">Manage your connected Facebook Ad Account</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleDisconnect}
              className="h-10 px-4 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
            >
              <LogOut className={cn("w-4 h-4", dir === "rtl" ? "ml-2" : "mr-2")} />
              {t("disconnect")}
            </Button>
            
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t("choosePage")}:</span>
            <Select value={selectedPageId || ""} onValueChange={handlePageChange} disabled={isAccountLoading}>
              <SelectTrigger className="w-[200px] h-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder={t("selectPagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {pages.map(page => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t("adAccount")}:</span>
            <Select value={selectedAccountId || ""} onValueChange={handleAccountChange} disabled={isAccountLoading}>
              <SelectTrigger className="w-[200px] h-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 relative">
                {isAccountLoading && <RefreshCcw className="w-3.5 h-3.5 mr-2 animate-spin absolute right-8 text-slate-400" />}
                <SelectValue placeholder={t("selectAdAccountPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {adAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t("timePeriod")}:</span>
            <Select value={datePreset} onValueChange={handleDateChange} disabled={isAccountLoading}>
              <SelectTrigger className="w-[150px] h-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder={t("timePeriod")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("today")}</SelectItem>
                <SelectItem value="yesterday">{t("yesterday")}</SelectItem>
                <SelectItem value="last_7d">{t("last7d")}</SelectItem>
                <SelectItem value="last_30d">{t("last30d")}</SelectItem>
                <SelectItem value="this_month">{t("thisMonth")}</SelectItem>
                <SelectItem value="maximum">{t("lifetime")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isAccountLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            {/* Unified Stats Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Stat 1: Total Spend */}
          <div className="p-6 flex items-center gap-4 text-start">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-500 tracking-wide block mb-1 truncate">{t("totalSpend")}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none block">
                {accountDetails?.currency} {parseFloat(insights?.spend || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Stat 2: Impressions */}
          <div className="p-6 flex items-center gap-4 text-start">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-500 tracking-wide block mb-1 truncate">{t("impressions")}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none block">
                {parseInt(insights?.impressions || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Stat 3: Link Clicks */}
          <div className="p-6 flex items-center gap-4 text-start">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <MousePointer2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-500 tracking-wide block mb-1 truncate">{t("linkClicks")}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none block">
                {parseInt(insights?.inline_link_clicks || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Stat 4: Active Balance */}
          <div className="p-6 flex items-center gap-4 text-start">
            <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-500 tracking-wide block mb-1 truncate">{t("activeBalance")}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none block">
                {accountDetails?.currency} {parseFloat(accountDetails?.balance || 0) / 100}
              </span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="campaigns" className="space-y-6" onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-2xl h-14 shadow-sm">
                <TabsTrigger value="campaigns" className="rounded-xl px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold">{t("campaignsTab")}</TabsTrigger>
                <TabsTrigger value="audience" className="rounded-xl px-6 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-600 font-bold">{t("audienceTab")}</TabsTrigger>
                {/* <TabsTrigger value="leads" className="rounded-xl px-6 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 font-bold">{t("leadsTab")}</TabsTrigger> */}
            </TabsList>
            
            {activeTab === 'campaigns' && (
                <Button variant="ghost" size="sm" asChild>
                    <a href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${selectedAccountId}`} target="_blank" className="text-blue-600 font-bold">
                        {t("title")} <ExternalLink className="w-3 h-3 ml-2" />
                    </a>
                </Button>
            )}
          </div>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            <Card className="border-none shadow-xl rounded-2xl bg-white dark:bg-slate-900 overflow-hidden text-start">
                <CardHeader className="p-8 border-b border-slate-50 dark:border-slate-800">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-blue-500" />
                        {t("activeCampaigns")}
                        </CardTitle>
                        <CardDescription>{t("campsDesc")}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                            <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500", dir === "rtl" ? "text-right" : "text-left")}>{t("campaignName")}</th>
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">{tc("tableStatus")}</th>
                            <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500", dir === "rtl" ? "text-left" : "text-right")}>{t("totalSpend")}</th>
                            <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500", dir === "rtl" ? "text-left" : "text-right")}>{t("reached")}</th>
                            <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500", dir === "rtl" ? "text-left" : "text-right")}>{t("clicks")}</th>
                            <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500", dir === "rtl" ? "text-left" : "text-right")}>{t("ctr")}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {campaigns.length === 0 ? (
                            <tr>
                            <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic">{t("noCampaignsFound")}</td>
                            </tr>
                        ) : (
                            campaigns.map((camp) => {
                            const cInsights = camp.insights?.data?.[0] || {}
                            const hasAdSets = camp.adsets?.data?.length > 0;
                            const isExpanded = expandedCampaigns[camp.id];

                            return (
                                <React.Fragment key={camp.id}>
                                <tr className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-sm", isExpanded && "bg-slate-50/50 dark:bg-slate-800/20")}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => toggleCampaignExpand(camp.id)}
                                            className={cn("w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors", !hasAdSets && "invisible")}
                                        >
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                        </button>
                                        <div className="flex flex-col text-start">
                                            <span className="font-semibold text-slate-900 dark:text-white">{camp.name}</span>
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{t("id")}: {camp.id}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <Badge className={cn(
                                        "rounded-md font-semibold text-[10px] border-none shadow-none",
                                        camp.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {camp.status}
                                    </Badge>
                                </td>
                                <td className={cn("px-4 py-4 font-semibold text-slate-900 dark:text-white", dir === "rtl" ? "text-left" : "text-right")}>
                                    {accountDetails?.currency} {parseFloat(cInsights.spend || 0).toLocaleString()}
                                </td>
                                <td className={cn("px-4 py-4 text-slate-600 dark:text-slate-400", dir === "rtl" ? "text-left" : "text-right")}>
                                    {parseInt(cInsights.reach || 0).toLocaleString()}
                                </td>
                                <td className={cn("px-4 py-4 text-slate-600 dark:text-slate-400", dir === "rtl" ? "text-left" : "text-right")}>
                                    {parseInt(cInsights.inline_link_clicks || 0).toLocaleString()}
                                </td>
                                <td className={cn("px-4 py-4", dir === "rtl" ? "text-left" : "text-right")}>
                                    <span className="font-bold text-blue-600">{parseFloat(cInsights.ctr || 0).toFixed(2)}%</span>
                                </td>
                                </tr>
                                
                                {isExpanded && hasAdSets && (
                                    <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                                        <td colSpan={6} className="p-0">
                                            <div className="px-12 py-4 shadow-inner border-t border-slate-100 dark:border-slate-800">
                                                <h4 className="text-xs font-bold text-slate-400 mb-3">{t("adSets")}</h4>
                                                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                                                <th className="px-4 py-2 text-left font-semibold">{t("name")}</th>
                                                                <th className="px-4 py-2 text-center font-semibold">{t("status")}</th>
                                                                <th className="px-4 py-2 text-right font-semibold">{t("budget")}</th>
                                                                <th className="px-4 py-2 text-right font-semibold">{t("spend")}</th>
                                                                <th className="px-4 py-2 text-right font-semibold">{t("reached")}</th>
                                                                <th className="px-4 py-2 text-right font-semibold">{t("clicks")}</th>
                                                                <th className="px-4 py-2 text-right font-semibold">{t("ctr")}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                            {camp.adsets.data.map((adset: any) => {
                                                                const asInsights = adset.insights?.data?.[0] || {}
                                                                const hasAds = adset.ads?.data?.length > 0;
                                                                const isAdSetExpanded = expandedAdSets[adset.id];

                                                                return (
                                                                    <React.Fragment key={adset.id}>
                                                                    <tr className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-800/30", isAdSetExpanded && "bg-slate-50/30 dark:bg-slate-800/20")}>
                                                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                                                            <div className="flex items-center gap-2">
                                                                                <button 
                                                                                    onClick={() => toggleAdSetExpand(adset.id)}
                                                                                    className={cn("w-5 h-5 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors", !hasAds && "invisible")}
                                                                                >
                                                                                    {isAdSetExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                                                                                </button>
                                                                                {adset.name}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <Badge variant="outline" className={cn(
                                                                                "text-[9px] font-bold",
                                                                                adset.status === "ACTIVE" ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"
                                                                            )}>
                                                                                {adset.status}
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                                                                            {adset.daily_budget ? `${accountDetails?.currency} ${(parseInt(adset.daily_budget)/100).toLocaleString()}` : '-'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                                                                            {accountDetails?.currency} {parseFloat(asInsights.spend || 0).toLocaleString()}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                                                                            {parseInt(asInsights.reach || 0).toLocaleString()}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                                                                            {parseInt(asInsights.inline_link_clicks || 0).toLocaleString()}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                                                                            {parseFloat(asInsights.ctr || 0).toFixed(2)}%
                                                                        </td>
                                                                    </tr>
                                                                    {isAdSetExpanded && hasAds && (
                                                                        <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                                                                            <td colSpan={7} className="p-0 border-t border-slate-100 dark:border-slate-800">
                                                                                <div className="pl-12 pr-4 py-3">
                                                                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                                                                                        <table className="w-full text-xs">
                                                                                            <thead>
                                                                                                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                                                                                    <th className="px-4 py-2 text-left font-semibold">{t("adName") || "Ad Name"}</th>
                                                                                                    <th className="px-4 py-2 text-center font-semibold">{t("status")}</th>
                                                                                                    <th className="px-4 py-2 text-right font-semibold">{t("spend")}</th>
                                                                                                    <th className="px-4 py-2 text-right font-semibold">{t("reached")}</th>
                                                                                                    <th className="px-4 py-2 text-right font-semibold">{t("clicks")}</th>
                                                                                                    <th className="px-4 py-2 text-right font-semibold">{t("ctr")}</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                                                                {adset.ads.data.map((ad: any) => {
                                                                                                    const adInsights = ad.insights?.data?.[0] || {}
                                                                                                    return (
                                                                                                        <tr key={ad.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                                                                                            <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">{ad.name}</td>
                                                                                                            <td className="px-4 py-2 text-center">
                                                                                                                <Badge variant="outline" className={cn(
                                                                                                                    "text-[8px]",
                                                                                                                    ad.status === "ACTIVE" ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"
                                                                                                                )}>
                                                                                                                    {ad.status}
                                                                                                                </Badge>
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">
                                                                                                                {accountDetails?.currency} {parseFloat(adInsights.spend || 0).toLocaleString()}
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">
                                                                                                                {parseInt(adInsights.reach || 0).toLocaleString()}
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">
                                                                                                                {parseInt(adInsights.inline_link_clicks || 0).toLocaleString()}
                                                                                                            </td>
                                                                                                            <td className="px-4 py-2 text-right font-bold text-blue-600">
                                                                                                                {parseFloat(adInsights.ctr || 0).toFixed(2)}%
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    )
                                                                                                })}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                    </React.Fragment>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            )
                            })
                        )}
                        </tbody>
                    </table>
                    </div>
                </CardContent>
            </Card>
          </TabsContent>

          {/* Audience Tab */}
          <TabsContent value="audience">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Gender Breakdown */}
                <Card className="border-none shadow-xl rounded-[32px] bg-white dark:bg-slate-900 p-8 text-start">
                    <CardTitle className="text-xl mb-6 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-500" />
                        {t("genderBreakdown")}
                    </CardTitle>
                    <div className="space-y-6">
                        {['male', 'female', 'unknown'].map(gender => {
                            const genderData = audience.filter(a => a.gender === gender);
                            const totalReach = audience.reduce((acc, a) => acc + parseInt(a.reach), 0);
                            const reach = genderData.reduce((acc, a) => acc + parseInt(a.reach), 0);
                            const percentage = totalReach > 0 ? (reach / totalReach) * 100 : 0;
                            
                            if (reach === 0 && gender === 'unknown') return null;

                            return (
                                <div key={gender} className="space-y-2">
                                    <div className="flex justify-between items-center text-sm font-bold tracking-wider">
                                        <span className="text-slate-505 capitalize">{t(gender)}</span>
                                        <span className="text-slate-900 dark:text-white">{percentage.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={percentage} className="h-3 rounded-full bg-slate-100 dark:bg-slate-800" 
                                        style={{ "--progress-background": gender === 'male' ? '#3B82F6' : gender === 'female' ? '#EC4899' : '#94A3B8' } as any}
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                        <span>{reach.toLocaleString()} {t("reached")}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>

                {/* Age Breakdown */}
                <Card className="border-none shadow-xl rounded-[32px] bg-white dark:bg-slate-900 p-8 text-start">
                    <CardTitle className="text-xl mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        {t("ageInsights")}
                    </CardTitle>
                    <div className="space-y-4">
                        {Array.from(new Set(audience.map(a => a.age))).sort().map(ageGroup => {
                            const ageData = audience.filter(a => a.age === ageGroup);
                            const totalSpend = audience.reduce((acc, a) => acc + parseFloat(a.spend), 0);
                            const spend = ageData.reduce((acc, a) => acc + parseFloat(a.spend), 0);
                            const reach = ageData.reduce((acc, a) => acc + parseInt(a.reach), 0);
                            const percentage = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;

                            return (
                                <div key={ageGroup} className="flex items-center gap-4">
                                    <span className="w-16 text-xs font-bold text-slate-500">{ageGroup}</span>
                                    <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative">
                                        <div 
                                            className="h-full bg-blue-500/20 border-r-2 border-blue-500 transition-all duration-1000" 
                                            style={{ width: `${percentage}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-bold">
                                            <span className="text-blue-600">{reach.toLocaleString()} {t("reached")}</span>
                                            <span className="text-slate-400">{accountDetails?.currency} {spend.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>
          </TabsContent>

         
        </Tabs>
          </>
        )}

        {/* Create Campaign Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogContent dir={dir} className="max-w-[500px] rounded-[32px] p-8 border-none shadow-2xl">
                <DialogHeader className={cn("text-start", dir === "rtl" ? "text-right" : "text-left")}>
                    <DialogTitle className="text-2xl font-black flex items-center gap-2">
                        <Megaphone className="w-6 h-6 text-blue-600" />
                        {t("createCampaignTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("createCampaignDesc")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4 text-start">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-400">{t("campaignName")}</Label>
                        <Input 
                            placeholder={t("campaignNamePlaceholder")} 
                            className="rounded-xl border-slate-200 h-12"
                            value={newCampaign.name}
                            onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-400">{t("dailyBudget")} ({accountDetails?.currency})</Label>
                            <Input 
                                type="number"
                                className="rounded-xl border-slate-200 h-12"
                                value={newCampaign.budget}
                                onChange={e => setNewCampaign({...newCampaign, budget: parseInt(e.target.value)})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-400">{t("targetCountry")}</Label>
                            <Select 
                                value={newCampaign.locations} 
                                onValueChange={val => setNewCampaign({...newCampaign, locations: val})}
                            >
                                <SelectTrigger className="rounded-xl border-slate-200 h-12">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PK">{t("pakistan")}</SelectItem>
                                    <SelectItem value="IN">{t("india")}</SelectItem>
                                    <SelectItem value="US">{t("usa")}</SelectItem>
                                    <SelectItem value="GB">{t("uk")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-400">{t("adBody")}</Label>
                        <Textarea 
                            placeholder={t("adBodyPlaceholder")} 
                            className="rounded-xl border-slate-200 min-h-[100px]"
                            value={newCampaign.body}
                            onChange={e => setNewCampaign({...newCampaign, body: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-400">{t("adImageUrl")}</Label>
                        <Input 
                            placeholder={t("adImagePlaceholder")} 
                            className="rounded-xl border-slate-200 h-12"
                            value={newCampaign.imageUrl}
                            onChange={e => setNewCampaign({...newCampaign, imageUrl: e.target.value})}
                        />
                        <p className="text-[10px] text-slate-400 italic">{t("imgSizeNote")}</p>
                    </div>
                </div>

                <DialogFooter className={cn("pt-4 flex items-center justify-end gap-3", dir === "rtl" ? "flex-row-reverse" : "flex-row")}>
                    <Button 
                        variant="ghost" 
                        onClick={() => setIsCreateModalOpen(false)}
                        className="rounded-xl"
                    >
                        {t("cancel")}
                    </Button>
                    <Button 
                        onClick={handleCreateCampaign}
                        disabled={creating}
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-500/20"
                    >
                        {creating ? (
                            <>
                                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                                {t("creating")}
                            </>
                        ) : (
                            t("launchCampaign")
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </DashboardLayoutClient>
  )
}
