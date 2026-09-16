"use client"
import {
  Users,
  CreditCard,
  ListChecks,
  Megaphone,
  FileText,
  GitBranch,
  MessageSquare,
  Settings,
  Building2,
  Zap,
  Crown,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  Gift,
  ArrowRight,
  Video,
  Smartphone,
  Play,
  Sparkles,
  Bell,
  Calendar,
  BookOpen,
  HelpCircle,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Briefcase,
  RefreshCw
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { cn } from "@/lib/utils"
import { KYCModal } from "@/components/dashboard/KYCModal"
import { EditProfileModal } from "@/components/dashboard/EditProfileModal"
import { VideoModal } from "@/components/dashboard/VideoModal"
import { WCCModal } from "@/components/dashboard/WCCModal"
import { AdCreditsModal } from "@/components/dashboard/AdCreditsModal"
import { ChangePlanModal } from "@/components/dashboard/ChangePlanModal"
import { WelcomeModal } from "@/components/dashboard/WelcomeModal"
import { ScheduleCallModal } from "@/components/dashboard/ScheduleCallModal"
import { MiniSparkline } from "@/components/dashboard/MiniSparkline"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import ConnectFacebookButton from "@/components/dashboard/ConnectFacebookButton"
import { disconnectInstagramAccount, disconnectFacebookAccount } from "@/app/actions/organization"
import WatiBotLoader from "@/components/WatiBotLoader"
import { useTranslations, useLocale } from 'next-intl';
import { isDirectVideoAsset, getYouTubeThumbnailUrl, type TutorialVideo } from "@/lib/tutorial-videos"
import { WhatsAppLinkGenerator } from "@/components/dashboard/WhatsAppLinkGenerator"
import { WhatsAppWidgetBuilder } from "@/components/dashboard/WhatsAppWidgetBuilder"
import { PLAN_CONFIG_UPDATED_EVENT, PLAN_CONFIG_UPDATED_STORAGE_KEY } from "@/lib/plan-refresh"
import { PlanExpiryModal } from "@/components/dashboard/PlanExpiryModal"
import { PlanExpiryBanner } from "@/components/dashboard/PlanExpiryBanner"
import { WhatsAppRestrictionDiagnosis } from "@/components/dashboard/WhatsAppRestrictionDiagnosis"

// Sample sparkline data to match screenshot colors
const sparklineData = {
  conversations: [{ value: 30 }, { value: 40 }, { value: 35 }, { value: 50 }, { value: 45 }, { value: 60 }, { value: 55 }],
  contacts: [{ value: 20 }, { value: 35 }, { value: 25 }, { value: 45 }, { value: 35 }, { value: 55 }, { value: 50 }],
  campaigns: [{ value: 15 }, { value: 25 }, { value: 20 }, { value: 35 }, { value: 30 }, { value: 45 }, { value: 40 }],
  responseRate: [{ value: 40 }, { value: 50 }, { value: 45 }, { value: 60 }, { value: 55 }, { value: 70 }, { value: 65 }],
  messages: [{ value: 45 }, { value: 55 }, { value: 60 }, { value: 75 }, { value: 70 }, { value: 85 }, { value: 80 }]
}

function formatTimeAgo(dateString: string | Date | undefined) {
  if (!dateString) return ""
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getMetaQuotaDisplay(tier: string | null | undefined) {
  if (!tier) return "Checking...";
  const t = tier.trim().toUpperCase();
  switch (t) {
    case 'TIER_50': case '50': return "50";
    case 'TIER_250': case '250': return "250";
    case 'TIER_1K': case '1K': case '1000': return "1,000";
    case 'TIER_2K': case '2K': case '2000': return "2,000";
    case 'TIER_10K': case '10K': case '10000': return "10,000";
    case 'TIER_100K': case '100K': case '100000': return "100,000";
    case 'TIER_UNLIMITED': case 'UNLIMITED': return "Unlimited";
    default: {
      const num = parseInt(t.replace(/\D/g, ''), 10);
      return !isNaN(num) && num > 0 ? num.toLocaleString() : t.replace('TIER_', '');
    }
  }
}

function getMetaQuotaNumber(tier: string | null | undefined) {
  if (!tier) return 0;
  const t = tier.trim().toUpperCase();
  switch (t) {
    case 'TIER_50': case '50': return 50;
    case 'TIER_250': case '250': return 250;
    case 'TIER_1K': case '1K': case '1000': return 1000;
    case 'TIER_2K': case '2K': case '2000': return 2000;
    case 'TIER_10K': case '10K': case '10000': return 10000;
    case 'TIER_100K': case '100K': case '100000': return 100000;
    case 'TIER_UNLIMITED': case 'UNLIMITED': return -1;
    default: {
      const num = parseInt(t.replace(/\D/g, ''), 10);
      return !isNaN(num) && num > 0 ? num : 0;
    }
  }
}

function getDynamicColorClass(pct: number) {
  if (pct >= 90) return "bg-rose-500 dark:bg-rose-600";
  if (pct >= 75) return "bg-amber-500 dark:bg-amber-600";
  return "bg-[#00a884]";
}

function getDynamicTextColorClass(pct: number) {
  if (pct >= 90) return "text-rose-500 dark:text-rose-400";
  if (pct >= 75) return "text-amber-500 dark:text-amber-400";
  return "text-[#00a884]";
}

function getDynamicIconBgClass(pct: number) {
  if (pct >= 90) return "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800";
  if (pct >= 75) return "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800";
  return "bg-[#00a884]/10 dark:bg-[#00a884]/20 border-[#00a884]/20 dark:border-[#00a884]/30";
}

function DashboardContent() {
  const router = useRouter()
  const { data: session } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN" && !session?.user?.originalAdminId

  useEffect(() => {
    if (isSuperAdmin) {
      router.replace('/admin/dashboard')
    }
  }, [isSuperAdmin, router])

  const [isKYCOpen, setIsKYCOpen] = useState(false)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isWCCOpen, setIsWCCOpen] = useState(false)
  const [isAdCreditsOpen, setIsAdCreditsOpen] = useState(false)
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)
  const [isScheduleCallOpen, setIsScheduleCallOpen] = useState(false)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [currentVideoUrl, setCurrentVideoUrl] = useState("")
  const [tutorialVideos, setTutorialVideos] = useState<TutorialVideo[]>([])
  const [showAllTutorials, setShowAllTutorials] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const [isProfileExpanded, setIsProfileExpanded] = useState(false)
  const t = useTranslations('Dashboard')
  const locale = useLocale()
  const processedCheckoutRef = useRef<string | null>(null)

  const [generalConfig, setGeneralConfig] = useState<{
    apkDownloadUrl?: string | null;
    playStoreUrl?: string | null;
    appStoreUrl?: string | null;
    smallLogo?: string | null;
    favicon?: string | null;
    logoLightTheme?: string | null;
    platformName?: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchGeneralConfig = () => {
      fetch("/api/admin/configurations/general")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) setGeneralConfig(data);
        })
        .catch(() => {});
    };
    fetchGeneralConfig();
    window.addEventListener("general_config_updated", fetchGeneralConfig);
    return () => window.removeEventListener("general_config_updated", fetchGeneralConfig);
  }, []);

  // Show welcome popup on first login if WhatsApp is not connected (once per user per browser)
  useEffect(() => {
    if (!session?.user?.email || !stats) return
    
    const key = `watibot_welcome_shown_${session.user.email}`

    // If WhatsApp is already connected, mark as shown and never show
    if (stats.whatsappConnected) {
      localStorage.setItem(key, '1')
      setIsWelcomeOpen(false)
      return
    }

    if (!localStorage.getItem(key)) {
      setIsWelcomeOpen(true)
      localStorage.setItem(key, '1')
    }
  }, [session?.user?.email, stats])

  const liveChatLimit = stats?.limits?.botReplies ?? 10000;
  const liveChatUsed = stats?.usage?.botReplies ?? 0;
  const liveChatRemaining = Math.max(0, liveChatLimit - liveChatUsed);
  const liveChatPercentage = liveChatLimit > 0 ? (liveChatRemaining / liveChatLimit) * 100 : 0;
  const isPremiumActive = stats?.servicePlan && stats.servicePlan.toLowerCase() !== "free";

  const [selectedLang, setSelectedLang] = useState({
    id: "en",
    name: "English",
    flag: "https://flagcdn.com/w40/us.png",
    native: "🇺🇸"
  })
  const [isLangOpen, setIsLangOpen] = useState(false)

  const languages = [
    {
      id: "en",
      name: "English",
      flag: "https://flagcdn.com/w40/us.png",
      native: "🇺🇸"
    },
    {
      id: "ur",
      name: "Urdu",
      flag: null,
      native: "اردو"
    },
    {
      id: "hi",
      name: "Hindi",
      flag: null,
      native: "हिंदी"
    },
    {
      id: "ar",
      name: "Arabic",
      flag: null,
      native: "العربية"
    },
    {
      id: "bn",
      name: "Bangla",
      flag: null,
      native: "বাংলা"
    }
  ]

  const [isTikTokConnecting, setIsTikTokConnecting] = useState(false)
  const [isTikTokDisconnecting, setIsTikTokDisconnecting] = useState(false)
  const [isInstagramDisconnecting, setIsInstagramDisconnecting] = useState(false)
  const [isFacebookDisconnecting, setIsFacebookDisconnecting] = useState(false)

  const handleConnectTikTok = async () => {
    setIsTikTokConnecting(true)
    try {
      const { getTikTokConnectUrl } = await import("@/app/actions/tiktok")
      const { url } = await getTikTokConnectUrl()
      const width = 680
      const height = 760
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      const popup = window.open(
        url,
        "ConnectTikTok",
        `width=${width},height=${height},top=${top},left=${left}`
      )

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups and try again.")
      }

      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === "TIKTOK_CONNECTED") {
          window.removeEventListener("message", onMessage)
          toast.success("TikTok account connected successfully!")
          loadData()
        }
        if (event.data?.type === "TIKTOK_CONNECTION_ERROR") {
          window.removeEventListener("message", onMessage)
          toast.error(event.data?.error || "Failed to connect TikTok account")
        }
      }

      window.addEventListener("message", onMessage)
    } catch (error: any) {
      toast.error(error?.message || "Unable to start TikTok connection.")
    } finally {
      setIsTikTokConnecting(false)
    }
  }

  const handleDisconnectTikTok = async () => {
    if (!confirm("Disconnect TikTok account from this workspace?")) return
    setIsTikTokDisconnecting(true)
    try {
      const { disconnectTikTokAccount } = await import("@/app/actions/tiktok")
      await disconnectTikTokAccount()
      toast.success("TikTok disconnected successfully")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Failed to disconnect TikTok")
    } finally {
      setIsTikTokDisconnecting(false)
    }
  }

  const handleDisconnectInstagram = async () => {
    if (!confirm("Disconnect Instagram account from this workspace?")) return
    setIsInstagramDisconnecting(true)
    try {
      await disconnectInstagramAccount()
      toast.success("Instagram disconnected successfully")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Failed to disconnect Instagram")
    } finally {
      setIsInstagramDisconnecting(false)
    }
  }

  const [isSyncingInstagramWebhook, setIsSyncingInstagramWebhook] = useState(false)

  const handleSyncInstagramWebhook = async () => {
    setIsSyncingInstagramWebhook(true)
    try {
      const res = await fetch("/api/webhooks/instagram/sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync webhook")
      }
      toast.success("Instagram webhook synchronized with Meta successfully!")
    } catch (error: any) {
      toast.error(error?.message || "Failed to sync Instagram webhook")
    } finally {
      setIsSyncingInstagramWebhook(false)
    }
  }

  const handleDisconnectFacebook = async () => {
    if (!confirm("Disconnect Facebook account from this workspace?")) return
    setIsFacebookDisconnecting(true)
    try {
      await disconnectFacebookAccount()
      toast.success("Facebook disconnected successfully")
      loadData()
    } catch (error: any) {
      toast.error(error?.message || "Failed to disconnect Facebook")
    } finally {
      setIsFacebookDisconnecting(false)
    }
  }

  const searchParams = useSearchParams()

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const statsData = await getDashboardStats()
      setStats(statsData)
    } catch (error) {
      console.error("Failed to load dashboard data", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout")
    const stripeSessionId = searchParams.get("session_id")
    const checkoutKey = `${checkoutStatus || ""}:${stripeSessionId || searchParams.get("provider") || ""}`

    if (checkoutStatus && processedCheckoutRef.current === checkoutKey) return
    if (checkoutStatus) processedCheckoutRef.current = checkoutKey

    if (checkoutStatus === "success") {
      const syncCheckout = async () => {
        const toastId = toast.loading("Syncing payment...", {
          description: "Verifying your checkout and updating your account.",
        })

        try {
          if (stripeSessionId) {
            const response = await fetch("/api/stripe/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: stripeSessionId }),
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
              throw new Error(data.error || "Unable to sync Stripe checkout.")
            }

            localStorage.setItem(PLAN_CONFIG_UPDATED_STORAGE_KEY, Date.now().toString())
            window.dispatchEvent(new CustomEvent(PLAN_CONFIG_UPDATED_EVENT))
          }

          await loadData()
          toast.success("Payment Successful!", {
            id: toastId,
            description: "Your account plan and quotas are now updated.",
            duration: 6000,
          })
        } catch (error: unknown) {
          console.error("Failed to sync checkout", error)
          const message = error instanceof Error ? error.message : "Please refresh in a moment or contact support."
          toast.error("Payment received, but plan sync failed", {
            id: toastId,
            description: message,
            duration: 8000,
          })
          loadData()
        } finally {
          const newUrl = window.location.pathname
          window.history.replaceState({}, "", newUrl)
        }
      }

      syncCheckout()
    } else if (checkoutStatus === "cancelled") {
      toast.error("Payment Cancelled", {
        description: "No changes were made to your subscription.",
      })
      const newUrl = window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [searchParams, loadData])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  const lastRefreshedAtRef = useRef(0)

  useEffect(() => {
    const refreshDashboardStats = (minIntervalMs = 10000) => {
      const now = Date.now()
      if (document.visibilityState === "visible" && (now - lastRefreshedAtRef.current) >= minIntervalMs) {
        lastRefreshedAtRef.current = now
        loadData()
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PLAN_CONFIG_UPDATED_STORAGE_KEY) {
        refreshDashboardStats(0)
      }
    }

    const handlePlanUpdated = () => {
      refreshDashboardStats(0)
    }

    const handleVisibilityChange = () => {
      refreshDashboardStats(15000)
    }

    window.addEventListener(PLAN_CONFIG_UPDATED_EVENT, handlePlanUpdated)
    window.addEventListener("storage", handleStorage)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    const interval = window.setInterval(() => refreshDashboardStats(0), 30000)

    return () => {
      window.removeEventListener(PLAN_CONFIG_UPDATED_EVENT, handlePlanUpdated)
      window.removeEventListener("storage", handleStorage)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.clearInterval(interval)
    }
  }, [loadData])

  const [hasFetchedTutorials, setHasFetchedTutorials] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadTutorialVideos = async () => {
      try {
        let response = await fetch("/api/tutorials", {
          cache: "no-store",
        })
        if (!response.ok) {
          response = await fetch("/api/admin/configurations/tutorial-videos?public=1", {
            cache: "no-store",
          })
        }
        if (!response.ok) return

        const data = await response.json()
        if (isMounted && Array.isArray(data.videos)) {
          setTutorialVideos(data.videos)
          setHasFetchedTutorials(true)
        }
      } catch (error) {
        console.error("Failed to load tutorial videos", error)
      }
    }

    loadTutorialVideos()

    return () => {
      isMounted = false
    }
  }, [])

  const tutorialVideosForDashboard = tutorialVideos
  const visibleTutorialVideos = showAllTutorials ? tutorialVideosForDashboard : tutorialVideosForDashboard.slice(0, 4)
  const hasMoreTutorials = tutorialVideosForDashboard.length > 4

  const openTutorialVideo = (videoUrl?: string) => {
    if (!videoUrl) {
      toast.info("No video configured for this tutorial yet. Configure videos in Admin Panel -> Tutorial Videos.")
      return
    }
    setCurrentVideoUrl(videoUrl)
    setIsVideoModalOpen(true)
  }

  const renderTutorialThumbnail = (video: TutorialVideo) => {
    const customThumb = video.thumbnailUrl
    const youtubeThumb = getYouTubeThumbnailUrl(video.videoUrl)
    const displayThumb = customThumb || youtubeThumb
    const showVideoPreview = isDirectVideoAsset(video.videoUrl)

    return (
      <div
        onClick={() => openTutorialVideo(video.videoUrl)}
        className="bg-slate-900 dark:bg-slate-950 aspect-video rounded-2xl relative flex items-center justify-center cursor-pointer group overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-300"
      >
        {displayThumb ? (
          <img
            src={displayThumb}
            alt={video.title}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : showVideoPreview ? (
          <video
            src={video.videoUrl}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            preload="metadata"
            playsInline
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#00a884]/20 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
            <Video className="w-8 h-8 text-[#00a884]/60 mb-1" />
          </div>
        )}
        <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/20 transition-colors" />
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform relative z-10">
          <Play className="w-3.5 h-3.5 text-[#00a884] fill-[#00a884] ml-0.5" />
        </div>
        {video.duration && (
          <span className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-[9.5px] font-black text-white px-1.5 py-0.5 rounded-md z-10">
            {video.duration}
          </span>
        )}
      </div>
    )
  }

  if (isLoading && !stats) {
    return <WatiBotLoader />
  }

  return (
    <DashboardLayoutClient mainClassName="bg-[#fafbfc] dark:bg-slate-950 min-h-screen" hideChatbot={false}>
      {/* 1. TOP HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 relative z-30">
        <div>
          <span className="text-slate-400 dark:text-slate-500 text-xs font-bold flex items-center gap-1">
            Hey {session?.user?.name || " "}
          </span>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mt-1">
            {t('welcome')}
          </h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold tracking-tight mt-0.5">
            {t('subtitle')}
          </p>
        </div>

        {/* ACTION BUTTONS - right side opposite the welcome heading */}
        <div className="flex flex-wrap gap-3 shrink-0">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none text-xs font-extrabold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none">
            <Calendar className="w-4.5 h-4.5 text-[#00a884]" />
            {t('scheduleDemo')}
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none text-xs font-extrabold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none">
            <BookOpen className="w-4.5 h-4.5 text-[#00a884]" />
            {t('setupGuide')}
          </button>
          <button
            onClick={() => {
              openTutorialVideo(tutorialVideosForDashboard[0]?.videoUrl)
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none text-xs font-extrabold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none"
          >
            <Video className="w-4.5 h-4.5 text-[#00a884]" />
            {t('watchTutorials')}
          </button>
        </div>
      </div>
      {/* EXPIRY NOTIFICATIONS */}
      <PlanExpiryModal 
        isExpired={!!stats?.planExpiry?.isExpired} 
        planName={stats?.servicePlan} 
      />
      
      <PlanExpiryBanner 
        isExpired={!!stats?.planExpiry?.isExpired} 
        daysRemaining={stats?.planExpiry?.daysRemaining ?? 0}
        endDate={stats?.planExpiry?.endDate}
        planName={stats?.servicePlan}
      />

      {/* WHATSAPP RESTRICTION / BAN DIAGNOSIS MODULE */}
      {(stats?.whatsappHealthDiagnosis || stats?.isWhatsAppBanned || stats?.isBmDisabled) && (
        <WhatsAppRestrictionDiagnosis
          initialDiagnosis={stats?.whatsappHealthDiagnosis || {
            lastChecked: new Date().toISOString(),
            overallStatus: stats?.isWhatsAppBanned ? 'BANNED' : 'DISABLED',
            overallLabel: stats?.isWhatsAppBanned ? 'Restriction Detected' : 'Business Disabled',
            affectedResources: stats?.isBmDisabled ? ['BUSINESS_PORTFOLIO'] : ['UNKNOWN'],
            primaryIssue: stats?.whatsappBanReason || 'Account restricted by Meta',
            headline: stats?.whatsappBanReason || 'Meta restriction detected on your account.',
            phone: {
              id: stats?.whatsappPhoneNumberId || null,
              displayNumber: stats?.whatsappNumber || null,
              status: stats?.whatsappStatus === 'BANNED' ? 'BANNED' : (stats?.isWhatsAppBanned ? 'RESTRICTED' : 'ACTIVE'),
              label: stats?.whatsappStatus || (stats?.isWhatsAppBanned ? 'Restricted' : 'Active'),
              rawStatus: stats?.whatsappStatus || null,
              qualityRating: stats?.whatsappQuality || null,
              verifiedName: stats?.whatsappVerifiedName || null,
              reason: stats?.whatsappBanReason || null,
              lastChecked: new Date().toISOString(),
            },
            waba: {
              id: stats?.whatsappBusinessId || null,
              name: stats?.whatsappBusinessName || null,
              status: stats?.isWhatsAppBanned && stats?.whatsappBanReason?.includes('WABA') ? 'REJECTED' : 'ACTIVE',
              label: stats?.whatsappBanReason?.includes('WABA') ? 'Review Rejected' : 'Active',
              rawStatus: null,
              accountReviewStatus: null,
              reason: stats?.whatsappBanReason || null,
              lastChecked: new Date().toISOString(),
            },
            business: {
              id: stats?.bmId || null,
              name: stats?.bmName || null,
              status: stats?.isBmDisabled ? 'DISABLED' : 'ACTIVE',
              label: stats?.isBmDisabled ? 'Business Portfolio Disabled' : 'Active',
              rawStatus: null,
              verificationStatus: null,
              isDisabled: !!stats?.isBmDisabled,
              reason: stats?.isBmDisabled ? 'Business Manager has been disabled by Meta.' : null,
              lastChecked: new Date().toISOString(),
            }
          }}
          onDiagnosisUpdated={(fresh) => {
            setStats((prev) => prev ? {
              ...prev,
              whatsappHealthDiagnosis: fresh,
              isWhatsAppBanned: fresh.overallStatus === 'BANNED' || fresh.overallStatus === 'RESTRICTED' || fresh.overallStatus === 'DISABLED',
              isBmDisabled: fresh.business.status === 'DISABLED',
              whatsappBanReason: fresh.headline || fresh.primaryIssue,
            } : prev);
          }}
        />
      )}

      {/* 4. FULL-WIDTH 5 STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {/* Total Conversations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-4 shadow-sm dark:shadow-none flex flex-col justify-between h-[130px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase leading-tight">{t('totalConversations')}</span>
          </div>
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {isLoading ? "..." : (stats?.engagement ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-full relative z-0">
            <MiniSparkline data={sparklineData.conversations} color="#00a884" />
          </div>
        </div>

        {/* All Messages (Outbound & Inbound) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-4 shadow-sm dark:shadow-none flex flex-col justify-between h-[130px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase leading-tight">All Messages</span>
          </div>
          <div className="flex items-baseline justify-between z-10 gap-1">
            <span className="text-2xl xl:text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {isLoading ? "..." : (stats?.totalMessages ?? ((stats?.outboundMessages ?? stats?.engagement ?? 0) + (stats?.inboundMessages ?? 0))).toLocaleString()}
            </span>
            <div className="flex flex-col text-end text-[8.5px] font-black leading-tight">
              <span className="text-emerald-600 dark:text-emerald-400">Out: {(stats?.outboundMessages ?? stats?.engagement ?? 0).toLocaleString()}</span>
              <span className="text-cyan-600 dark:text-cyan-400">In: {(stats?.inboundMessages ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="h-8 w-full relative z-0">
            <MiniSparkline data={sparklineData.messages} color="#06b6d4" />
          </div>
        </div>

        {/* Active Contacts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-4 shadow-sm dark:shadow-none flex flex-col justify-between h-[130px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase leading-tight">{t('activeContacts')}</span>
          </div>
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {isLoading ? "..." : (stats?.activeContacts ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-full relative z-0">
            <MiniSparkline data={sparklineData.contacts} color="#a855f7" />
          </div>
        </div>

        {/* Campaign Sent */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-4 shadow-sm dark:shadow-none flex flex-col justify-between h-[130px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase leading-tight">{t('campaignSent')}</span>
          </div>
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {isLoading ? "..." : (stats?.campaigns ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-full relative z-0">
            <MiniSparkline data={sparklineData.campaigns} color="#3b82f6" />
          </div>
        </div>

        {/* Active Flows */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] p-4 shadow-sm dark:shadow-none flex flex-col justify-between h-[130px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase leading-tight">{t('activeFlows')}</span>
          </div>
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
              {isLoading ? "..." : (stats?.automation ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-full relative z-0">
            <MiniSparkline data={sparklineData.responseRate} color="#f97316" />
          </div>
        </div>
      </div>

      {/* 5. SPLIT LAYOUT SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">

        {/* LEFT COLUMN: wider col-span-2 */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {/* A. Growth Integrations Hub */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-7 shadow-sm dark:shadow-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  {t('growthIntegrationsHub')}
                </h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-0.5">
                  {t('growthSubtitle')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#e6f4ee] px-3 py-1 rounded-full border border-[#00a884]/15">
                <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-pulse" />
                <span className="text-[#00a884] text-[10px] font-black tracking-wider">{t('connectionStatus')}</span>
              </div>
            </div>

            {/* Grid of 3 integrations cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 xl:gap-6 2xl:gap-8">

              {/* Instagram */}
              <div className="bg-[#fafbfc] dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between min-h-[245px] shadow-[0_2px_12px_rgba(0,0,0,0.015)] dark:shadow-none">
                <div className="flex flex-col">
                  {/* IG Logo Image */}
                  <div className="w-12 h-12 rounded-[18px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden shrink-0">
                    <img src="/instagram-logo.png" alt="Instagram" className="w-9 h-9 object-contain" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">{t('instagramBusiness')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 leading-normal">
                    {t('syncInstagram')}
                  </p>
                  {stats?.instagramBusinessId && (
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate mt-1">
                      {t('id')} {stats.instagramBusinessId}
                    </p>
                  )}
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  {stats?.instagramBusinessId ? (
                    <>
                      <button
                        onClick={handleDisconnectInstagram}
                        disabled={isInstagramDisconnecting}
                        className="w-full py-2.5 px-1 bg-red-600 hover:bg-red-700 text-white text-[11px] xl:text-[10px] 2xl:text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.98] select-none whitespace-nowrap disabled:opacity-60 flex items-center justify-center"
                      >
                        {isInstagramDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('disconnect')}
                      </button>
                      <button
                        onClick={handleSyncInstagramWebhook}
                        disabled={isSyncingInstagramWebhook}
                        className="w-full py-2 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                        title="Re-register webhook callback with Meta"
                      >
                        {isSyncingInstagramWebhook ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-emerald-600" />
                        )}
                        Sync Webhook
                      </button>
                    </>
                  ) : (
                    <ConnectFacebookButton
                      label={t('connectInstagram')}
                      channel="instagram"
                      onSuccess={loadData}
                      className="w-full py-2.5 px-1 bg-[#e1306c] hover:bg-[#c13584] text-white text-[11px] xl:text-[10px] 2xl:text-xs font-black rounded-xl transition-all shadow-sm shadow-[#e1306c]/10 hover:shadow-md active:scale-[0.98] select-none whitespace-nowrap flex items-center justify-center gap-1.5"
                    />
                  )}
                  <div className="flex items-center gap-1.5 justify-center">
                    {stats?.instagramBusinessId ? (
                      <div className="flex items-center gap-1 text-[#00a884]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">{t('connected')}</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                        <span className="text-rose-500 text-[10px] font-bold">{t('notConnected')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Facebook */}
              <div className="bg-[#fafbfc] dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between min-h-[245px] shadow-[0_2px_12px_rgba(0,0,0,0.015)] dark:shadow-none">
                <div className="flex flex-col">
                  {/* FB Logo Image */}
                  <div className="w-12 h-12 rounded-[18px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden shrink-0">
                    <img src="/facebook-logo.png" alt="Facebook" className="w-9 h-9 object-contain" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">{t('facebookPage')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 leading-normal">
                    {t('syncFacebook')}
                  </p>
                  {stats?.facebookPageName && (
                    <p className="text-slate-400 dark:text-slate-500 text-[11px] font-bold leading-normal mt-1.5">
                      {stats.facebookPageName}
                    </p>
                  )}
                  {stats?.facebookPageId && (
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate mt-1">
                      {t('id')} {stats.facebookPageId}
                    </p>
                  )}
                </div>
                <div className="mt-5 flex flex-col gap-2.5">
                  {stats?.facebookPageId ? (
                    <button
                      onClick={handleDisconnectFacebook}
                      disabled={isFacebookDisconnecting}
                      className="w-full py-2.5 px-1 bg-red-600 hover:bg-red-700 text-white text-[11px] xl:text-[10px] 2xl:text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.98] select-none whitespace-nowrap disabled:opacity-60 flex items-center justify-center"
                    >
                      {isFacebookDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('disconnect')}
                    </button>
                  ) : (
                    <ConnectFacebookButton
                      label={t('connectFacebook')}
                      channel="facebook"
                      onSuccess={loadData}
                      className="w-full py-2.5 px-1 bg-[#1877f2] hover:bg-[#166fe5] text-white text-[11px] xl:text-[10px] 2xl:text-xs font-black rounded-xl transition-all shadow-sm shadow-[#1877f2]/10 hover:shadow-md active:scale-[0.98] select-none whitespace-nowrap flex items-center justify-center gap-1.5"
                    />
                  )}
                  <div className="flex items-center gap-1.5 justify-center">
                    {stats?.facebookPageId ? (
                      <div className="flex items-center gap-1 text-[#00a884]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">{t('connected')}</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                        <span className="text-rose-500 text-[10px] font-bold">{t('notConnected')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* WhatsApp Business API */}
              <div className="bg-[#fafbfc] dark:bg-slate-950/60 border-2 border-[#00a884] rounded-3xl p-4 sm:p-5 flex flex-col justify-between min-h-[245px] relative overflow-hidden shadow-[0_4px_20px_rgba(0,168,132,0.06)]">
                <div className="absolute top-0 right-0 bg-[#00a884] text-white text-[8px] font-black tracking-widest px-3.5 py-1 rounded-bl-[14px]">
                  {t('recommended')}
                </div>

                <div className="flex flex-col">
                  {/* WhatsApp Logo Image */}
                  <div className="w-12 h-12 rounded-[18px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden shrink-0">
                    <img src="/whatsapp-logo.png" alt="WhatsApp" className="w-9 h-9 object-contain" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">{t('whatsappBusinessApi')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1.5 leading-normal">
                    {t('sendAutomated')}
                  </p>

                  {stats?.whatsappConnected && stats?.whatsappNumber && (
                    <p className="text-[10px] font-bold text-[#00a884] mt-1.5 truncate">
                      {stats.whatsappNumber}
                    </p>
                  )}
                </div>
                <div className="mt-5 flex flex-col gap-2.5">
                  {stats?.whatsappConnected ? (
                    <Link href="/dashboard/settings" className="w-full">
                      <button className="w-full py-2.5 px-1 bg-[#00a884] hover:bg-[#008f70] text-white text-[11px] xl:text-[10px] 2xl:text-xs font-black rounded-xl transition-all shadow-sm shadow-[#00a884]/10 hover:shadow-md active:scale-[0.98] select-none whitespace-nowrap text-center">
                        {t('manageGateway')}
                      </button>
                    </Link>
                  ) : (
                    <ConnectFacebookButton
                      label={t('activateNow')}
                      channel="whatsapp"
                      onSuccess={loadData}
                      className="w-full py-2.5 px-1 bg-[#00a884] hover:bg-[#008f70] text-white text-[11px] xl:text-[10px] 2xl:text-xs font-black rounded-xl transition-all shadow-sm shadow-[#00a884]/10 hover:shadow-md active:scale-[0.98] select-none whitespace-nowrap flex items-center justify-center gap-1.5"
                    />
                  )}
                  <div className="flex items-center gap-1.5 justify-center">
                    {stats?.whatsappConnected ? (
                      <div className="flex items-center gap-1 text-[#00a884]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">{t('connected')}</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-amber-500 text-[10px] font-bold">{t('pending')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
 
       

          {/* B. Ads & Campaign Setup Center */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-7 shadow-sm dark:shadow-none">
            <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              {t('adsAndCampaignSetupCenter')}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-0.5 mb-6">
              {t('adsCampaignSetupDescription')}
            </p>

            <div className="flex flex-col lg:flex-row items-center gap-8 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 mt-4">

              {/* Meta Account Connect Row */}
              <div className="flex items-center gap-5 pr-8 border-b lg:border-b-0 lg:border-r border-slate-200/60 dark:border-slate-800 pb-6 lg:pb-0 shrink-0 w-full lg:w-auto min-w-[340px]">
                {/* Meta Logo Image */}
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-[20px] flex items-center justify-center shrink-0 overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                  <img src="/meta-icon.png" alt="Meta" className="w-10 h-10 object-contain" />
                </div>

                {/* Text and Button details */}
                <div className="flex flex-col items-start gap-1.5 flex-1">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">{t('metaAdAccount')}</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-[11px] font-bold leading-normal max-w-[280px]">
                    {t('metaAdAccountDescription')}
                  </p>
                  {stats?.facebookPageId ? (
                    <div className="flex flex-col gap-2 w-full mt-2">
                      <div className="flex items-center gap-1 text-[#00a884]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-black">Connected</span>
                      </div>
                      <button
                        onClick={handleDisconnectFacebook}
                        disabled={isFacebookDisconnecting}
                        className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black rounded-xl transition-all shadow-sm active:scale-[0.98] select-none whitespace-nowrap disabled:opacity-60 flex items-center justify-center"
                      >
                        {isFacebookDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : t('disconnect')}
                      </button>
                    </div>
                  ) : (
                    <ConnectFacebookButton
                      label={t('connectMetaAccount')}
                      channel="facebook"
                      onSuccess={loadData}
                      className="mt-2 py-2 px-4 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-[#00a884]/10 hover:shadow-md active:scale-[0.98] select-none whitespace-nowrap flex items-center justify-center gap-1.5"
                    />
                  )}
                </div>
              </div>

              {/* 4 setup items arranged in horizontal flex row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full flex-1 justify-items-center items-center py-2">

                {/* 1. Create & Manage Campaigns */}
                <div className="flex flex-col items-center text-center gap-2 max-w-[130px] group">
                  <div className="w-11 h-11 rounded-full bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884] transition-transform duration-200 group-hover:scale-110 shadow-sm">
                    {/* Paper Airplane / Rocket SVG */}
                    <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-[10.5px] font-black text-slate-700 dark:text-slate-300 leading-normal tracking-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {t('createAndManageCampaigns')}
                  </span>
                </div>

                {/* 2. Detailed Ad Analytics */}
                <div className="flex flex-col items-center text-center gap-2 max-w-[130px] group">
                  <div className="w-11 h-11 rounded-full bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884] transition-transform duration-200 group-hover:scale-110 shadow-sm">
                    {/* Growth Chart / Stats SVG */}
                    <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-[10.5px] font-black text-slate-700 dark:text-slate-300 leading-normal tracking-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {t('detailedAdAnalytics')}
                  </span>
                </div>

                {/* 3. Audience Targeting */}
                <div className="flex flex-col items-center text-center gap-2 max-w-[130px] group">
                  <div className="w-11 h-11 rounded-full bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884] transition-transform duration-200 group-hover:scale-110 shadow-sm">
                    {/* Audience Targeting SVG */}
                    <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-[10.5px] font-black text-slate-700 dark:text-slate-300 leading-normal tracking-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {t('audienceTargeting')}
                  </span>
                </div>

                {/* 4. Track & Optimize Performance */}
                <div className="flex flex-col items-center text-center gap-2 max-w-[130px] group">
                  <div className="w-11 h-11 rounded-full bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884] transition-transform duration-200 group-hover:scale-110 shadow-sm">
                    {/* Performance SVG */}
                    <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M22 7L13.5 15.5L8.5 10.5L2 17M22 7h-6M22 7v6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-[10.5px] font-black text-slate-700 dark:text-slate-300 leading-normal tracking-tight group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {t('trackAndOptimizePerformance')}
                  </span>
                </div>

              </div>

            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-7 shadow-sm dark:shadow-none">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  {t('platformWalkthroughTutorials')}
                </h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-0.5">
                  {t('platformWalkthroughSubtitle')}
                </p>
              </div>
              {tutorialVideosForDashboard.length > 0 && (
                <button
                  onClick={() => {
                    if (hasMoreTutorials && !showAllTutorials) {
                      setShowAllTutorials(true)
                      return
                    }
                    if (showAllTutorials) {
                      setShowAllTutorials(false)
                      return
                    }
                    openTutorialVideo(tutorialVideosForDashboard[0]?.videoUrl)
                  }}
                  className="text-[#00a884] text-xs font-black select-none hover:underline"
                >
                  {hasMoreTutorials
                    ? (showAllTutorials ? "Show Less" : t('viewAll'))
                    : t('viewAll')}
                </button>
              )}
            </div>

            {visibleTutorialVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {visibleTutorialVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex flex-col gap-2 group cursor-pointer"
                    onClick={() => openTutorialVideo(video.videoUrl)}
                  >
                    {renderTutorialThumbnail(video)}
                    <span className="text-[12px] font-black text-slate-700 dark:text-slate-200 tracking-tight leading-snug line-clamp-2 group-hover:text-[#00a884] transition-colors">
                      {video.title}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                <Video className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No tutorial videos published yet.</p>
              </div>
            )}
          </div>

        </div>

        <div className="flex flex-col gap-6">


          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm dark:shadow-none flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                Meta Profile
              </h2>
            </div>

            {stats?.whatsappConnected && (
              <div className="relative mb-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col text-start">
                    <span className="text-xl font-medium text-slate-800 dark:text-slate-100 tracking-tight pr-8">
                      {stats.whatsappBusinessName || stats.whatsappNumber || "WhatsApp Business"}
                    </span>

                    {(stats.businessVertical || "BUSINESS") && (
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                        {stats.businessVertical || "BUSINESS"}
                      </span>
                    )}

                    <span className="text-2xl font-bold text-[#006064] dark:text-teal-400 mt-3">
                      {stats.whatsappNumber ? `+${stats.whatsappNumber.replace(/\D/g, '')}` : ''}
                    </span>

                    <div className="flex items-center gap-1.5 mt-1.5 group cursor-pointer" onClick={() => {
                      if (stats.whatsappNumber) {
                        navigator.clipboard.writeText(`wa.me/${stats.whatsappNumber.replace(/\D/g, '')}`);
                      }
                    }}>
                      <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                        wa.me/{stats.whatsappNumber ? stats.whatsappNumber.replace(/\D/g, '') : ''}
                      </span>
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {(stats.businessLogo && !logoError) && (
                    <div className="relative mt-2 mr-2 shrink-0">
                      <div className="w-20 h-20 rounded-full border border-amber-200/50 dark:border-amber-900/50 bg-[#fff8e1] dark:bg-amber-900/20 flex items-center justify-center overflow-hidden shadow-sm">
                        <img
                          src={stats.businessLogo}
                          alt="Business Profile"
                          className="w-full h-full object-cover"
                          onError={() => setLogoError(true)}
                        />
                      </div>
                      <Link href="/dashboard/settings" className="absolute -top-1 -right-2 w-7 h-7 bg-[#f0fdf4] dark:bg-teal-900/30 rounded-full flex items-center justify-center text-[#00a884] dark:text-teal-400 hover:bg-[#dcfce7] transition-colors shadow-sm z-10 border border-white dark:border-slate-800">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>

                <div
                  className="mt-5 flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity w-fit text-[#006064] dark:text-teal-400 select-none"
                  onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                >
                  <span className="text-sm font-medium">
                    {isProfileExpanded ? "Hide Profile" : "View Profile"}
                  </span>
                  <svg
                    className={cn("w-4 h-4 transition-transform duration-200", isProfileExpanded && "rotate-180")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isProfileExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-4 text-start animate-in fade-in slide-in-from-top-2 duration-200">

                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {stats?.whatsappConnectionMethod === 'qr' ? "WhatsApp Device Details" : "Meta API Details"}
                        </span>
                        {stats?.whatsappConnectionMethod === 'qr' && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            QR Linked Device
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/50 pb-2 mb-0.5">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            {stats?.whatsappConnectionMethod === 'qr' ? "Device Name:" : "Display Name:"}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {stats?.whatsappVerifiedName || stats?.whatsappBusinessName || "Connected Account"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">Status:</span>
                          {(() => {
                            const rawStatus = stats?.whatsappStatus || (stats?.whatsappConnected ? "CONNECTED" : "DISCONNECTED");
                            const statusUpper = rawStatus.toUpperCase();
                            let colorClass = "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400";
                            
                            if (statusUpper === 'CONNECTED' || statusUpper === 'APPROVED' || statusUpper === 'LIVE') {
                              colorClass = "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400";
                            } else if (statusUpper === 'BANNED' || statusUpper === 'DISABLED' || statusUpper === 'BLOCKED') {
                              colorClass = "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400";
                            }
                            
                            return (
                              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", colorClass)}>
                                {stats?.whatsappConnectionMethod === 'qr' ? 'LIVE (QR)' : rawStatus}
                              </span>
                            );
                          })()}
                        </div>

                        {stats?.whatsappConnectionMethod === 'qr' ? (
                          <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-0.5">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">Connection Mode:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">WhatsApp Web (Multi-Device)</span>
                          </div>
                        ) : (
                          <>
                            {stats?.whatsappQuality && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Quality:</span>
                                {(() => {
                                  const rawQuality = stats?.whatsappQuality || (stats?.whatsappConnected ? "GREEN" : "N/A");
                                  const qualityUpper = rawQuality.toUpperCase();
                                  let displayQuality = rawQuality;
                                  let colorClass = "bg-slate-50 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400";

                                  if (qualityUpper === 'GREEN' || qualityUpper === 'HIGH') {
                                    displayQuality = "HIGH";
                                    colorClass = "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400";
                                  } else if (qualityUpper === 'YELLOW' || qualityUpper === 'MEDIUM') {
                                    displayQuality = "MEDIUM";
                                    colorClass = "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400";
                                  } else if (qualityUpper === 'RED' || qualityUpper === 'LOW') {
                                    displayQuality = "LOW";
                                    colorClass = "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400";
                                  }

                                  return (
                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", colorClass)}>
                                      {displayQuality}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}

                            {stats?.whatsappPhoneNumberId && (
                              <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-0.5">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Phone ID:</span>
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                                  onClick={() => {
                                    navigator.clipboard.writeText(stats.whatsappPhoneNumberId || "");
                                    toast.success("Phone ID copied");
                                  }}
                                >
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{stats.whatsappPhoneNumberId}</span>
                                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              </div>
                            )}

                            {stats?.whatsappBusinessId && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">WABA ID:</span>
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                                  onClick={() => {
                                    navigator.clipboard.writeText(stats.whatsappBusinessId || "");
                                    toast.success("WABA ID copied");
                                  }}
                                >
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{stats.whatsappBusinessId}</span>
                                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              </div>
                            )}

                            {stats?.bmName && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Business Manager:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={stats.bmName}>
                                    {stats.bmName}
                                  </span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                    stats.isBmDisabled
                                      ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                                      : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                  )}>
                                    {stats.isBmDisabled ? "BM DISABLED" : "BM ACTIVE"}
                                  </span>
                                </div>
                              </div>
                            )}

                            {(stats?.isBmDisabled || stats?.isWhatsAppBanned) && (
                              <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex flex-col gap-1.5 text-start">
                                {stats?.whatsappHealthDiagnosis ? (
                                  <>
                                    {stats.whatsappHealthDiagnosis.phone.status !== 'ACTIVE' && (
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        <Smartphone className="w-3.5 h-3.5 shrink-0" />
                                        <span>Phone Number: {stats.whatsappHealthDiagnosis.phone.label}</span>
                                      </div>
                                    )}
                                    {stats.whatsappHealthDiagnosis.waba.status !== 'ACTIVE' && (
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                                        <span>WABA: {stats.whatsappHealthDiagnosis.waba.label}</span>
                                      </div>
                                    )}
                                    {stats.whatsappHealthDiagnosis.business.status !== 'ACTIVE' && (
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>Business: {stats.whatsappHealthDiagnosis.business.label}</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {stats?.isBmDisabled && (
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>BM Disabled by Meta</span>
                                      </div>
                                    )}
                                    {stats?.isWhatsAppBanned && (
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                        <span>{stats?.whatsappBanReason || "WhatsApp Account Banned / Restricted"}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                <a
                                  href="https://business.facebook.com/accountquality"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-rose-700 dark:text-rose-300 underline font-medium hover:opacity-80 mt-0.5 inline-flex items-center gap-1"
                                >
                                  <span>Open Meta Account Quality</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </>
                        )}

                        {stats?.businessVertical && (
                          <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-0.5">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">Category:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{stats.businessVertical}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {stats?.businessDescription && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</span>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{stats.businessDescription}</p>
                        </div>
                      )}
                      {stats?.businessEmail && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email</span>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{stats.businessEmail}</p>
                        </div>
                      )}
                      {stats?.businessAddress && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Address</span>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{stats.businessAddress}</p>
                        </div>
                      )}
                      {stats?.businessWebsites && stats.businessWebsites.length > 0 && stats.businessWebsites.some((w: string) => w.trim() !== "") && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Websites</span>
                          <div className="flex flex-col gap-1.5">
                            {stats.businessWebsites.filter((w: string) => w.trim() !== "").map((web: string, i: number) => (
                              <a key={i} href={web.startsWith('http') ? web : `https://${web}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#006064] dark:text-teal-400 hover:underline flex items-center gap-1">
                                {web}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>


                  </div>
                )}
              </div>
            )}

            {/* Used count & bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{liveChatUsed.toLocaleString()}</span>
                  <span className="text-sm font-bold text-slate-400">/ {liveChatLimit === -1 ? '∞' : liveChatLimit.toLocaleString()} {t('remaining')}</span>
                </div>
                <span className="text-[10px] font-black text-slate-400">
                  {(() => {
                    const pct = liveChatLimit === -1 ? 0 : (liveChatUsed / Math.max(liveChatLimit, 1)) * 100;
                    return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2);
                  })()}% used
                </span>
              </div>
              <div className="relative w-full">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", liveChatLimit === -1 ? "bg-[#00a884]" : getDynamicColorClass(Math.min(100, (liveChatUsed / Math.max(liveChatLimit, 1)) * 100)))}
                    style={{ width: liveChatLimit === -1 ? '100%' : `${Math.min(100, (liveChatUsed / Math.max(liveChatLimit, 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-1">
                  <span>0</span>
                  <span>{liveChatLimit === -1 ? '∞' : liveChatLimit.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Other Quotas</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { label: 'Contacts', used: stats?.usage?.contacts || 0, limit: stats?.limits?.contacts || 0 },
                  { label: 'Flows', used: stats?.usage?.botFlows || 0, limit: stats?.limits?.botFlows || 0 },
                  { label: 'Campaigns', used: stats?.usage?.campaigns || 0, limit: stats?.limits?.campaigns || 0 },
                  { label: 'Agents', used: stats?.usage?.teamMembers || 0, limit: stats?.limits?.teamMembers || 0 },
                ].map((item, i) => {
                  const pct = item.limit > 0 ? Math.min(100, (item.used / item.limit) * 100) : 0;
                  const isUnlimited = item.limit === -1;
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {item.used} / {isUnlimited ? '∞' : item.limit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", isUnlimited ? "bg-[#00a884]" : getDynamicColorClass(pct))}
                          style={{ width: isUnlimited ? '100%' : `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Current Package</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{stats?.servicePlan || "Basic"} Plan</span>
                </div>
                {stats?.planExpiry?.isExpired ? (
                  <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full">
                    Expired
                  </span>
                ) : (stats?.planExpiry?.daysRemaining ?? 0) <= 7 ? (
                  <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                    {stats?.planExpiry?.daysRemaining} Days Left
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase text-[#00a884] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                    {stats?.planExpiry?.daysRemaining} Days Left
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline text-[10px]">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {stats?.planExpiry?.isExpired ? "Plan Expired" : `${stats?.planExpiry?.daysRemaining ?? 0} Days Remaining`}
                  </span>
                  <span className="font-semibold text-slate-400">
                    {stats?.planExpiry?.endDate ? `Expires: ${new Date(stats.planExpiry.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      stats?.planExpiry?.isExpired ? "bg-rose-500" :
                      (stats?.planExpiry?.daysRemaining ?? 0) <= 7 ? "bg-amber-500" : "bg-[#00a884]"
                    )}
                    style={{
                      width: stats?.planExpiry?.isExpired ? "100%" : `${Math.min(100, Math.max(5, ((stats?.planExpiry?.daysRemaining ?? 0) / 30) * 100))}%`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Remaining</span>
                <span className="text-xl font-black text-[#00a884] mt-0.5">{liveChatLimit === -1 ? '∞' : liveChatRemaining.toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Total Quota</span>
                <span className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{liveChatLimit === -1 ? '∞' : liveChatLimit.toLocaleString()}</span>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <button
              onClick={() => setIsChangePlanOpen(true)}
              className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-xl shadow-sm transition-all active:scale-[0.98] select-none flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Upgrade Plan
            </button>
          </div>

          <WhatsAppLinkGenerator defaultPhone={stats?.whatsappNumber || ""} />
          <WhatsAppWidgetBuilder defaultPhone={stats?.whatsappNumber || ""} businessName={stats?.whatsappBusinessName || ""} />
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm dark:shadow-none">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                {t('recentConversations')}
              </h3>
              <Link href="/live-chat">
                <button className="text-[#00a884] text-[10.5px] font-semibold select-none hover:underline">
                  {t('viewAll')}
                </button>
              </Link>
            </div>

            {/* List of conversations */}
            <div className="flex flex-col gap-3">
              {stats?.recentConversations && stats.recentConversations.length > 0 ? (
                stats.recentConversations.slice(0, 4).map((convo) => {
                  const hasUnread = convo.unreadCount > 0;
                  const timeAgo = formatTimeAgo(convo.lastMessageAt);
                  const initials = (convo.name || convo.id || "C").charAt(0).toUpperCase();

                  // Map platform color/badge/style
                  let platformBgColor = "bg-green-500";
                  if (convo.platform === "INSTAGRAM") platformBgColor = "bg-orange-500";
                  else if (convo.platform === "FACEBOOK") platformBgColor = "bg-blue-600";
                  else if (convo.platform === "TIKTOK") platformBgColor = "bg-black";

                  return (
                    <Link key={convo.id} href={`/live-chat?contactId=${convo.id}`}>
                      <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-2xl transition-colors cursor-pointer text-start">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                            {convo.profilePic ? (
                              <img src={convo.profilePic} alt={convo.name || "User"} className="w-full h-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>

                          <div className="flex flex-col text-start min-w-0">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight truncate max-w-[120px]">
                              {convo.name || "WhatsApp User"}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[140px]">
                              {convo.lastMessage || "No messages yet"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-[9px] text-slate-400 font-medium">
                            {timeAgo}
                          </span>
                          {hasUnread && (
                            <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-pulse" />
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                /* Fallback dummy data if no contacts exist in the database yet */
                <>
                  {/* Person 1 */}
                  <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-2xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop" alt=" " className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight"> </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[140px]">Hi, I'm interested in your products</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-medium">2m ago</span>
                      <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full" />
                    </div>
                  </div>

                  {/* Person 2 */}
                  <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-2xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop" alt="Sarah Khan" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Sarah Khan</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[140px]">Please share the details</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-medium">15m ago</span>
                    </div>
                  </div>

                  {/* Person 3 */}
                  <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-2xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop" alt="Usman Ahmed" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Usman Ahmed</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[140px]">How can I integrate with API?</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-medium">1h ago</span>
                    </div>
                  </div>

                  {/* Person 4 */}
                  <div className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 rounded-2xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                        <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop" alt="Zainab Noor" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Zainab Noor</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[140px]">Thanks for the quick response!</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-[9px] text-slate-400 font-medium">2h ago</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* A. Scan to download Mobile App */}
          {(() => {
            const rawApkUrl = generalConfig?.apkDownloadUrl;
            const fullApkUrl = rawApkUrl
              ? (rawApkUrl.startsWith("http") ? rawApkUrl : (typeof window !== "undefined" ? `${window.location.origin}${rawApkUrl}` : `https://watibot.pro${rawApkUrl}`))
              : (typeof window !== "undefined" ? `${window.location.origin}/downloads/watibot.apk` : "https://watibot.pro/downloads/watibot.apk");
            const playUrl = generalConfig?.playStoreUrl || rawApkUrl || "/downloads/watibot.apk";
            const appStoreUrl = generalConfig?.appStoreUrl || "https://apps.apple.com";
            const isDirectApk = !generalConfig?.playStoreUrl;
            const qrLogo = generalConfig?.favicon || generalConfig?.smallLogo || generalConfig?.logoLightTheme || "/favicon.ico";

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm dark:shadow-none">
                <h3 className="text-xs font-black text-slate-800 dark:text-white tracking-tight mb-4">{t('scanToDownloadMobileApp')}</h3>

                <div className="flex items-center gap-5">
                  {/* QR Code */}
                  <div className="relative w-[100px] h-[100px] bg-white border border-slate-100 rounded-xl p-1 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullApkUrl)}`}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                    {/* Brand Favicon overlay inside center of QR code */}
                    <div className="absolute w-[24px] h-[24px] rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm p-0.5">
                      <img src={qrLogo} alt={generalConfig?.platformName || "Favicon"} className="w-full h-full rounded-full object-contain" />
                    </div>
                  </div>

                  {/* Badges column */}
                  <div className="flex flex-col gap-2.5">
                    <a
                      href={playUrl}
                      target={isDirectApk ? undefined : "_blank"}
                      download={isDirectApk ? "watibot.apk" : undefined}
                      rel="noreferrer"
                      className="hover:opacity-90 transition-opacity"
                      title={isDirectApk ? "Download Android APK" : "Google Play Store"}
                    >
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                        alt="Google Play / Android APK"
                        className="h-9 w-auto object-contain"
                      />
                    </a>
                    <a
                      href={appStoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:opacity-90 transition-opacity"
                      title="Download on the App Store"
                    >
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                        alt="App Store"
                        className="h-9 w-auto object-contain"
                      />
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}



        </div>

      </div>

      {/* KYC, Profile, and other core modals kept perfectly intact for functionality */}
      <KYCModal isOpen={isKYCOpen} onOpenChange={setIsKYCOpen} />
      <EditProfileModal isOpen={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} onSuccess={loadData} />
      <VideoModal isOpen={isVideoModalOpen} onOpenChange={setIsVideoModalOpen} videoUrl={currentVideoUrl} />
      <WCCModal isOpen={isWCCOpen} onOpenChange={setIsWCCOpen} />
      <AdCreditsModal isOpen={isAdCreditsOpen} onOpenChange={setIsAdCreditsOpen} />
      <ChangePlanModal isOpen={isChangePlanOpen} onOpenChange={setIsChangePlanOpen} />
      <WelcomeModal isOpen={isWelcomeOpen} onOpenChange={setIsWelcomeOpen} onScheduleCall={() => setIsScheduleCallOpen(true)} />
      <ScheduleCallModal isOpen={isScheduleCallOpen} onOpenChange={setIsScheduleCallOpen} />
    </DashboardLayoutClient>
  )
}

export default function DashboardPage() {
  return <DashboardContent />
}
