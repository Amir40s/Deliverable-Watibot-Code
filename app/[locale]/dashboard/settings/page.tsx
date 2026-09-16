"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Check, Info, Copy, RefreshCw, ShieldCheck, Clock, Loader2, 
    Instagram, Facebook, ExternalLink, Activity, ShieldAlert, 
    Smartphone, CheckCircle2, QrCode, AlertTriangle, AlertOctagon,
    MessageSquare, Trash2, ArrowRight, Zap, Radio, Globe, Shield
} from "lucide-react";
import { WhatsAppColorIcon, FacebookColorIcon, InstagramColorIcon } from "@/components/icons/SocialIcons";
import WhatsAppStatusCard from "@/components/dashboard/WhatsAppStatusCard";
import { MotionCardWrapper } from "@/components/ui/motion-card-wrapper";
import { PillButton } from "@/components/ui/pill-button";
import { DashboardIntegrationCard } from "@/components/dashboard/DashboardIntegrationCard";
import ConnectFacebookButton from "@/components/dashboard/ConnectFacebookButton";
import { toast } from "sonner";
import { disconnectInstagramAccount, disconnectFacebookAccount, getConnectedInstagramProfile } from "@/app/actions/organization";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { NotificationPopupToggle } from "@/components/dashboard/NotificationPopupToggle";
import WhatsAppBusinessInfoSidebar from "@/components/dashboard/WhatsAppBusinessInfoSidebar";
import { WhatsAppRestrictionDiagnosis } from "@/components/dashboard/WhatsAppRestrictionDiagnosis";
import { WhatsAppChannelsWidget } from "@/components/settings/WhatsAppChannelsWidget";

const SIDEBAR_FONT = "font-['Plus_Jakarta_Sans',sans-serif]";
const RTL_LOCALES = new Set(["ar", "ur"]);
const LOCALE_MAP: Record<string, string> = {
    ar: "ar",
    ur: "ur-PK",
    hi: "hi-IN",
    bn: "bn-BD",
    en: "en-US",
};

type OnboardingProgress = {
    progress: number;
    steps: unknown[];
    whatsappBusinessId?: string | null;
    whatsappPhoneNumberId?: string | null;
    whatsappNumber?: string | null;
    whatsappBusinessName?: string | null;
    whatsappConnectionMethod?: string | null;
    metaAccessToken?: string | null;
    whatsappTokenInfo?: unknown;
    webhookVerifyToken?: string | null;
    whatsapp_onboarding_raw_data?: any;
};

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

function getTokenInfo(value: unknown) {
    const defaultScopes = ["whatsapp_business_management", "whatsapp_business_messaging", "whatsapp_business_manage_events", "public_profile"];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { scopes: defaultScopes, expiresAt: null };
    }

    const record = value as Record<string, unknown>;
    const parsedScopes = Array.isArray(record.scopes)
        ? record.scopes.filter((scope): scope is string => typeof scope === "string")
        : [];

    return {
        scopes: parsedScopes.length > 0 ? parsedScopes : defaultScopes,
        expiresAt:
            typeof record.expires_at === "string" || record.expires_at instanceof Date
                ? record.expires_at
                : null,
    };
}

function formatRelativeTime(date: string | Date, locale: string) {
    const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
        { amount: 60, unit: "second" },
        { amount: 60, unit: "minute" },
        { amount: 24, unit: "hour" },
        { amount: 7, unit: "day" },
        { amount: 4.34524, unit: "week" },
        { amount: 12, unit: "month" },
        { amount: Number.POSITIVE_INFINITY, unit: "year" },
    ];

    let duration = seconds;
    for (const division of divisions) {
        if (Math.abs(duration) < division.amount) {
            return formatter.format(Math.round(duration), division.unit);
        }
        duration /= division.amount;
    }

    return formatter.format(0, "second");
}

export default function SettingsPage() {
    const t = useTranslations("DashboardSettingsPage");
    const locale = useLocale();
    const intlLocale = LOCALE_MAP[locale] ?? locale;
    const isRtl = RTL_LOCALES.has(locale);
    const { data: session } = useSession();
    
    const [activeTab, setActiveTab] = useState<"whatsapp" | "facebook" | "instagram">("whatsapp");
    const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
    const [isRefreshingInfo, setIsRefreshingInfo] = useState(false);
    const [connectionStats, setConnectionStats] = useState<DashboardStats | null>(null);
    const [isLoadingConnections, setIsLoadingConnections] = useState(true);
    const [isInstagramDisconnecting, setIsInstagramDisconnecting] = useState(false);
    const [isFacebookDisconnecting, setIsFacebookDisconnecting] = useState(false);
    const [igProfile, setIgProfile] = useState<{ id: string; username: string | null; name: string | null; profilePic: string | null; } | null>(null);

    const formatTokenExpiry = useCallback((date: string | Date) => {
        return new Intl.DateTimeFormat(intlLocale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
        }).format(new Date(date));
    }, [intlLocale]);

    const fetchProgress = useCallback(async () => {
        try {
            const data = await getOnboardingProgress();
            setOnboarding(data);
        } catch (err) {
            console.error("Failed to fetch onboarding progress:", err);
        }
    }, []);

    const loadConnectionStats = useCallback(async () => {
        setIsLoadingConnections(true);
        try {
            const [stats, ig] = await Promise.all([
                getDashboardStats(),
                getConnectedInstagramProfile().catch(() => null),
            ]);
            setConnectionStats(stats);
            if (ig) setIgProfile(ig);
        } catch (err) {
            console.error("Failed to load connection stats:", err);
        } finally {
            setIsLoadingConnections(false);
        }
    }, []);

    const handleRefreshInfo = async () => {
        setIsRefreshingInfo(true);
        try {
            const res = await refreshTokenInfo();
            if (res.success) {
                toast.success(t("toasts.tokenInfoUpdated"));
                fetchProgress();
            } else {
                toast.error(res.error || t("toasts.refreshTokenFailed"));
            }
        } catch {
            toast.error(t("toasts.refreshInfoError"));
        } finally {
            setIsRefreshingInfo(false);
        }
    };

    const handleDisconnectInstagram = async () => {
        if (!confirm(t("confirm.disconnectInstagram"))) return;
        setIsInstagramDisconnecting(true);
        try {
            await disconnectInstagramAccount();
            toast.success(t("toasts.instagramDisconnected"));
            loadConnectionStats();
        } catch (error) {
            toast.error(getErrorMessage(error, t("toasts.instagramDisconnectFailed")));
        } finally {
            setIsInstagramDisconnecting(false);
        }
    };

    const handleDisconnectFacebook = async () => {
        if (!confirm(t("confirm.disconnectFacebook"))) return;
        setIsFacebookDisconnecting(true);
        try {
            await disconnectFacebookAccount();
            toast.success(t("toasts.facebookDisconnected"));
            loadConnectionStats();
        } catch (error) {
            toast.error(getErrorMessage(error, t("toasts.facebookDisconnectFailed")));
        } finally {
            setIsFacebookDisconnecting(false);
        }
    };

    useEffect(() => {
        fetchProgress();
        loadConnectionStats();

        const handleConnected = (event: MessageEvent) => {
            if (event.data?.type === 'WHATSAPP_CONNECTED') {
                fetchProgress();
            }
        };

        window.addEventListener('message', handleConnected);
        return () => {
            window.removeEventListener('message', handleConnected);
        };
    }, [fetchProgress, loadConnectionStats]);

    const tokenInfo = getTokenInfo(onboarding?.whatsappTokenInfo);

    return (
        <DashboardLayoutClient mainClassName="pb-12">
            <div dir={isRtl ? "rtl" : "ltr"} className={cn("flex flex-col gap-8 w-full text-start", SIDEBAR_FONT)}>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">
                            {t("title")}
                        </h2>
                        <p className="text-muted-foreground text-sm font-medium">
                            {t("subtitle")}
                        </p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/40 dark:bg-muted/20 border border-border/60 rounded-2xl w-fit backdrop-blur-md mb-2">
                    <button
                        onClick={() => setActiveTab("whatsapp")}
                        type="button"
                        className={cn(
                            "flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            activeTab === "whatsapp" 
                                ? "bg-card text-foreground shadow-sm border border-emerald-500/40 font-extrabold ring-1 ring-emerald-500/20" 
                                : "text-muted-foreground hover:text-foreground hover:bg-card/40 border border-transparent"
                        )}
                    >
                        <WhatsAppColorIcon className="w-5 h-5 shrink-0" />
                        <span>WhatsApp</span>
                        {(onboarding?.progress === 100 || onboarding?.whatsappNumber) && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab("facebook")}
                        type="button"
                        className={cn(
                            "flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            activeTab === "facebook" 
                                ? "bg-card text-foreground shadow-sm border border-blue-500/40 font-extrabold ring-1 ring-blue-500/20" 
                                : "text-muted-foreground hover:text-foreground hover:bg-card/40 border border-transparent"
                        )}
                    >
                        <FacebookColorIcon className="w-5 h-5 shrink-0" />
                        <span>Facebook</span>
                        {(connectionStats?.facebookPageId || session?.user?.facebookConnected) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab("instagram")}
                        type="button"
                        className={cn(
                            "flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            activeTab === "instagram" 
                                ? "bg-card text-foreground shadow-sm border border-pink-500/40 font-extrabold ring-1 ring-pink-500/20" 
                                : "text-muted-foreground hover:text-foreground hover:bg-card/40 border border-transparent"
                        )}
                    >
                        <InstagramColorIcon className="w-5 h-5 shrink-0" />
                        <span>Instagram</span>
                        {(connectionStats?.instagramBusinessId || session?.user?.instagramConnected) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab Content Panels */}
                <div className="space-y-6">
                    {/* WhatsApp Tab */}
                    {activeTab === "whatsapp" && (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-3 duration-200">
                            <div className="xl:col-span-2 space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold tracking-tight text-foreground">Core Channels</h3>
                                        <Badge variant="secondary" className="text-[9px] font-bold bg-primary/10 text-primary uppercase">Primary</Badge>
                                    </div>
                                    <WhatsAppStatusCard onConnectionStateChange={() => { fetchProgress(); loadConnectionStats(); }} />
                                </div>

                                <WhatsAppChannelsWidget />

                                <MotionCardWrapper className="h-auto">
                                    <div className="bg-card p-[0.8px] rounded-3xl flex flex-col border border-border/50">
                                        <div className="px-4 py-2 flex justify-between items-center">
                                            <h3 className="text-muted-foreground font-medium text-xs">
                                                {onboarding?.whatsappConnectionMethod === 'qr' || (onboarding?.whatsappPhoneNumberId && onboarding.whatsappPhoneNumberId.startsWith('qr_'))
                                                    ? "WhatsApp Web Gateway (Multi-Device)"
                                                    : t("whatsappGateway.title")}
                                            </h3>
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] font-semibold",
                                                connectionStats?.isBmDisabled || connectionStats?.isWhatsAppBanned
                                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                            )}>
                                                {onboarding?.whatsappConnectionMethod === 'qr' || (onboarding?.whatsappPhoneNumberId && onboarding.whatsappPhoneNumberId.startsWith('qr_'))
                                                    ? "ACTIVE (QR)"
                                                    : (connectionStats?.isBmDisabled
                                                        ? "BM DISABLED"
                                                        : (connectionStats?.isWhatsAppBanned ? "WHATSAPP BANNED" : t("whatsappGateway.badge")))}
                                            </Badge>
                                        </div>
                                        <div
                                            className="bg-card rounded-3xl p-6 flex-1 flex flex-col gap-6"
                                            style={{ boxShadow: "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px" }}
                                        >
                                            {onboarding?.whatsappConnectionMethod === 'qr' || (onboarding?.whatsappPhoneNumberId && onboarding.whatsappPhoneNumberId.startsWith('qr_')) ? (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Connected Phone Number</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-mono font-bold">{onboarding?.whatsappNumber || "N/A"}</span>
                                                                {onboarding?.whatsappNumber && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Device Profile Name</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-semibold">{onboarding?.whatsappBusinessName || "WhatsApp Web Device"}</span>
                                                                {onboarding?.whatsappBusinessName && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Connection Protocol</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Baileys WebSocket (Multi-Device)</span>
                                                                <Badge variant="secondary" className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">DIRECT</Badge>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Session Security</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs text-muted-foreground truncate">End-to-End Encrypted Auth Keys</span>
                                                                <Badge variant="secondary" className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">SECURE</Badge>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-3 pt-2">
                                                        <PillButton
                                                            variant="primary"
                                                            label={isRefreshingInfo ? t("buttons.syncing") : "Sync & Test Device"}
                                                            icon={isRefreshingInfo ? Loader2 : RefreshCw}
                                                            className={cn("h-9 px-6 text-xs", isRefreshingInfo && "[&_svg]:animate-spin")}
                                                            onClick={handleRefreshInfo}
                                                            disabled={isRefreshingInfo}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {(connectionStats?.whatsappHealthDiagnosis || connectionStats?.isBmDisabled || connectionStats?.isWhatsAppBanned) && (
                                                        <WhatsAppRestrictionDiagnosis
                                                            initialDiagnosis={connectionStats?.whatsappHealthDiagnosis || {
                                                                lastChecked: new Date().toISOString(),
                                                                overallStatus: connectionStats?.isWhatsAppBanned ? 'BANNED' : 'DISABLED',
                                                                overallLabel: connectionStats?.isWhatsAppBanned ? 'Restriction Detected' : 'Business Disabled',
                                                                affectedResources: connectionStats?.isBmDisabled ? ['BUSINESS_PORTFOLIO'] : ['UNKNOWN'],
                                                                primaryIssue: connectionStats?.whatsappBanReason || 'Account restricted by Meta',
                                                                headline: connectionStats?.whatsappBanReason || 'Meta restriction detected on your account.',
                                                                phone: {
                                                                    id: connectionStats?.whatsappPhoneNumberId || null,
                                                                    displayNumber: connectionStats?.whatsappNumber || null,
                                                                    status: connectionStats?.whatsappStatus === 'BANNED' ? 'BANNED' : (connectionStats?.isWhatsAppBanned ? 'RESTRICTED' : 'ACTIVE'),
                                                                    label: connectionStats?.whatsappStatus || (connectionStats?.isWhatsAppBanned ? 'Restricted' : 'Active'),
                                                                    rawStatus: connectionStats?.whatsappStatus || null,
                                                                    qualityRating: connectionStats?.whatsappQuality || null,
                                                                    verifiedName: connectionStats?.whatsappVerifiedName || null,
                                                                    reason: connectionStats?.whatsappBanReason || null,
                                                                    lastChecked: new Date().toISOString(),
                                                                },
                                                                waba: {
                                                                    id: connectionStats?.whatsappBusinessId || null,
                                                                    name: connectionStats?.whatsappBusinessName || null,
                                                                    status: connectionStats?.isWhatsAppBanned && connectionStats?.whatsappBanReason?.includes('WABA') ? 'REJECTED' : 'ACTIVE',
                                                                    label: connectionStats?.whatsappBanReason?.includes('WABA') ? 'Review Rejected' : 'Active',
                                                                    rawStatus: null,
                                                                    accountReviewStatus: null,
                                                                    reason: connectionStats?.whatsappBanReason || null,
                                                                    lastChecked: new Date().toISOString(),
                                                                },
                                                                business: {
                                                                    id: connectionStats?.bmId || null,
                                                                    name: connectionStats?.bmName || null,
                                                                    status: connectionStats?.isBmDisabled ? 'DISABLED' : 'ACTIVE',
                                                                    label: connectionStats?.isBmDisabled ? 'Business Portfolio Disabled' : 'Active',
                                                                    rawStatus: null,
                                                                    verificationStatus: null,
                                                                    isDisabled: !!connectionStats?.isBmDisabled,
                                                                    reason: connectionStats?.isBmDisabled ? 'Business Manager has been disabled by Meta.' : null,
                                                                    lastChecked: new Date().toISOString(),
                                                                }
                                                            }}
                                                            onDiagnosisUpdated={(fresh) => {
                                                                setConnectionStats((prev) => prev ? {
                                                                    ...prev,
                                                                    whatsappHealthDiagnosis: fresh,
                                                                    isWhatsAppBanned: fresh.overallStatus === 'BANNED' || fresh.overallStatus === 'RESTRICTED' || fresh.overallStatus === 'DISABLED',
                                                                    isBmDisabled: fresh.business.status === 'DISABLED',
                                                                    whatsappBanReason: fresh.headline || fresh.primaryIssue,
                                                                } : prev);
                                                            }}
                                                        />
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Attached Business Manager (BM)</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-semibold truncate" title={connectionStats?.bmName || undefined}>
                                                                    {connectionStats?.bmName || "Meta Business Manager"}
                                                                </span>
                                                                <Badge variant="secondary" className={cn(
                                                                    "text-[9px] font-bold shrink-0",
                                                                    connectionStats?.isBmDisabled
                                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                                )}>
                                                                    {connectionStats?.isBmDisabled ? "BM DISABLED" : "BM ACTIVE"}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">WhatsApp Account Health</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-semibold truncate">
                                                                    {connectionStats?.isWhatsAppBanned ? "Restricted / Banned" : (connectionStats?.whatsappStatus || "Connected")}
                                                                </span>
                                                                <Badge variant="secondary" className={cn(
                                                                    "text-[9px] font-bold shrink-0",
                                                                    connectionStats?.isWhatsAppBanned
                                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                                )}>
                                                                    {connectionStats?.isWhatsAppBanned ? "BANNED" : "HEALTHY"}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest">{t("whatsappGateway.wabaId")}</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-mono truncate">{onboarding?.whatsappBusinessId || t("whatsappGateway.notConnected")}</span>
                                                                {onboarding?.whatsappBusinessId && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-muted-foreground tracking-widest">{t("whatsappGateway.phoneNumberId")}</p>
                                                            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                                <span className="text-xs font-mono truncate">{onboarding?.whatsappPhoneNumberId || t("whatsappGateway.notConnected")}</span>
                                                                {onboarding?.whatsappPhoneNumberId && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest">{t("whatsappGateway.systemAccessToken")}</p>
                                                        <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between min-h-[42px]">
                                                            <span className="text-xs font-mono truncate">
                                                                {onboarding?.metaAccessToken ? `${onboarding.metaAccessToken.slice(0, 10)}...${onboarding.metaAccessToken.slice(-4)}` : t("whatsappGateway.notConnected")}
                                                            </span>
                                                            {onboarding?.metaAccessToken ? (
                                                                <Badge variant="secondary" className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{t("whatsappGateway.encrypted")}</Badge>
                                                            ) : (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {onboarding?.metaAccessToken && (
                                                        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
                                                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                                                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{t("whatsappGateway.accessTokenInfo")}</p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 px-2 text-[10px] font-bold tracking-widest text-muted-foreground hover:text-foreground"
                                                                    onClick={handleRefreshInfo}
                                                                    disabled={isRefreshingInfo}
                                                                >
                                                                    <RefreshCw className={cn("w-3 h-3 me-1.5", isRefreshingInfo && "animate-spin")} />
                                                                    {isRefreshingInfo ? t("buttons.syncing") : t("buttons.refreshInfo")}
                                                                </Button>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-1">{t("whatsappGateway.permissionScopes")}</p>
                                                                    <p className="text-[11px] leading-relaxed text-muted-foreground break-words font-medium">
                                                                        {tokenInfo?.scopes?.join(", ") || t("whatsappGateway.notAvailable")}
                                                                    </p>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                                                            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">{t("whatsappGateway.expiryAt")}</p>
                                                                        </div>
                                                                        <div className="space-y-0.5">
                                                                            <p className={cn(
                                                                                "text-[11px] font-medium",
                                                                                tokenInfo?.expiresAt && new Date(tokenInfo.expiresAt) < new Date()
                                                                                    ? "text-red-500"
                                                                                    : "text-foreground"
                                                                            )}>
                                                                                {tokenInfo?.expiresAt
                                                                                    ? formatTokenExpiry(tokenInfo.expiresAt)
                                                                                    : t("whatsappGateway.neverExpires")}
                                                                            </p>
                                                                            {tokenInfo?.expiresAt && (
                                                                                <p className="text-[10px] text-muted-foreground font-medium italic">
                                                                                    ({formatRelativeTime(tokenInfo.expiresAt, intlLocale)})
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-end gap-3 pt-2">
                                                        <PillButton
                                                            variant="primary"
                                                            label={isRefreshingInfo ? t("buttons.syncing") : t("buttons.testConnection")}
                                                            icon={isRefreshingInfo ? Loader2 : Check}
                                                            className={cn("h-9 px-6 text-xs", isRefreshingInfo && "[&_svg]:animate-spin")}
                                                            onClick={handleRefreshInfo}
                                                            disabled={isRefreshingInfo}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </MotionCardWrapper>

                                {/* Notification Popup Preferences Card */}
                                <MotionCardWrapper className="h-auto">
                                    <NotificationPopupToggle variant="settings" />
                                </MotionCardWrapper>
                            </div>

                            <div className="xl:col-span-1 space-y-8">
                                <MotionCardWrapper className="h-auto">
                                    <div className="aesthetic-glass p-1 rounded-3xl flex flex-col">
                                        <div className="px-4 py-2 flex justify-between items-center border-b border-border/50">
                                            <h3 className="text-muted-foreground/60 font-bold tracking-widest text-[10px] dark:text-muted-foreground/40">{t("businessStatus.title")}</h3>
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full animate-pulse",
                                                    onboarding?.progress === 100 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]"
                                                )} />
                                                <span className={cn(
                                                    "text-[10px] font-bold tracking-widest",
                                                    onboarding?.progress === 100 ? "text-emerald-400" : "text-orange-400"
                                                )}>
                                                    {onboarding?.progress === 100 ? t("businessStatus.active") : t("businessStatus.onboarding")}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-[10px] font-bold text-muted-foreground/40 tracking-widest">{t("businessStatus.progress")}</p>
                                                <p className="text-sm font-bold text-foreground">{onboarding?.progress ?? 0}%</p>
                                            </div>
                                            <div className="w-full h-3 bg-muted/20 rounded-full overflow-hidden mb-8 border border-border/50">
                                                <div
                                                    className="h-full bg-foreground rounded-full shadow-[0_0_12px_rgba(0,0,0,0.12)] transition-all duration-1000 dark:shadow-[0_0_12px_rgba(255,255,255,0.12)]"
                                                    style={{ width: `${onboarding?.progress ?? 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </MotionCardWrapper>

                                {/* WhatsApp Business Info & Overall Health Sidebar */}
                                <WhatsAppBusinessInfoSidebar
                                    onboarding={onboarding}
                                    onRefreshInfo={handleRefreshInfo}
                                    isRefreshingInfo={isRefreshingInfo}
                                />
                            </div>
                        </div>
                    )}

                    {/* Facebook Tab */}
                    {activeTab === "facebook" && (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-3 duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
                            {/* Main Facebook Hub Card */}
                            <div className="xl:col-span-2 space-y-6">
                                <div className="bg-card/85 dark:bg-card/60 backdrop-blur-xl rounded-3xl border border-border/70 p-6 sm:p-8 relative overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    {/* Ambient subtle glow */}
                                    <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-500/10 via-transparent to-transparent pointer-events-none rounded-tr-3xl" />

                                    {/* Card Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/50 relative z-10">
                                        <div className="flex items-center gap-3.5">
                                            <FacebookColorIcon className="w-12 h-12 shrink-0 drop-shadow-md" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                                                        Facebook Page Sync
                                                    </h3>
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                        Meta Graph API
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {t("cards.facebookDescription")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {(connectionStats?.facebookPageId || session?.user?.facebookConnected) ? (
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                    </span>
                                                    Live & Connected
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/60">
                                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                                    Not Connected
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="pt-6 relative z-10">
                                        {(connectionStats?.facebookPageId || session?.user?.facebookConnected) ? (
                                            <div className="space-y-6">
                                                {/* Connected Identity Card */}
                                                <div className="p-5 rounded-2xl bg-gradient-to-b from-muted/40 to-muted/20 border border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="relative shrink-0">
                                                            <FacebookColorIcon className="w-14 h-14 shrink-0 drop-shadow-md" />
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center text-white">
                                                                <Check className="w-3 h-3 stroke-[3]" />
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-base font-extrabold text-foreground truncate">
                                                                    {connectionStats?.facebookPageName || t("cards.facebookPage")}
                                                                </h4>
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                    Verified Page
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span className="font-mono bg-background/80 px-2 py-0.5 rounded-md border border-border/50 text-[11px] font-medium text-foreground">
                                                                    ID: {connectionStats?.facebookPageId}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (connectionStats?.facebookPageId) {
                                                                            navigator.clipboard.writeText(connectionStats.facebookPageId);
                                                                            toast.success("Page ID copied to clipboard");
                                                                        }
                                                                    }}
                                                                    className="p-1 hover:bg-background/80 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                                    title="Copy Page ID"
                                                                >
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {connectionStats?.facebookPageId && (
                                                        <a
                                                            href={`https://facebook.com/${connectionStats.facebookPageId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-background border border-border/60 hover:border-border text-foreground hover:bg-muted/40 transition-all shrink-0 shadow-xs"
                                                        >
                                                            <span>View Page</span>
                                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Feature Capabilities Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                                            <MessageSquare className="w-4 h-4" />
                                                            <span className="text-xs font-bold uppercase tracking-wider">Messenger Sync</span>
                                                        </div>
                                                        <p className="text-xs text-foreground font-semibold">2-Way Live Sync</p>
                                                        <p className="text-[11px] text-muted-foreground">Instant customer messaging & replies</p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                                            <ShieldCheck className="w-4 h-4" />
                                                            <span className="text-xs font-bold uppercase tracking-wider">Webhooks</span>
                                                        </div>
                                                        <p className="text-xs text-foreground font-semibold">Realtime Webhook</p>
                                                        <p className="text-[11px] text-muted-foreground">Subscribed to messages & postbacks</p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                                                            <Zap className="w-4 h-4" />
                                                            <span className="text-xs font-bold uppercase tracking-wider">Automation</span>
                                                        </div>
                                                        <p className="text-xs text-foreground font-semibold">AI & Bot Flows</p>
                                                        <p className="text-[11px] text-muted-foreground">Auto-responder & lead capture enabled</p>
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50">
                                                    <Link
                                                        href={`/${locale}/live-chat`}
                                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-sm shadow-blue-500/25 transition-all"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                        <span>Open Live Chat</span>
                                                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        onClick={handleDisconnectFacebook}
                                                        disabled={isFacebookDisconnecting}
                                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-rose-500/30 bg-rose-500/5 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 transition-all disabled:opacity-60"
                                                    >
                                                        {isFacebookDisconnecting ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>{t("buttons.disconnecting")}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>{t("buttons.disconnect")}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6 py-2">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mb-2">
                                                            <MessageSquare className="w-4 h-4" />
                                                        </div>
                                                        <h5 className="text-xs font-bold text-foreground">Centralized Inbox</h5>
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            Manage Page customer conversations directly within the unified Live Chat window.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold mb-2">
                                                            <Zap className="w-4 h-4" />
                                                        </div>
                                                        <h5 className="text-xs font-bold text-foreground">AI Bot Triggers</h5>
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            Automate answers, lead generation, and FAQ handling with 24/7 intelligent AI bots.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold mb-2">
                                                            <ShieldCheck className="w-4 h-4" />
                                                        </div>
                                                        <h5 className="text-xs font-bold text-foreground">Official Meta Sync</h5>
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            Secure Page token exchange with granular access scopes directly through Meta Login.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pt-2 max-w-md">
                                                    <ConnectFacebookButton
                                                        label={t("buttons.connectFacebook")}
                                                        channel="facebook"
                                                        onSuccess={loadConnectionStats}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar: Webhook & Developer Specs */}
                            <div className="xl:col-span-1 space-y-6">
                                <div className="bg-card/85 dark:bg-card/60 backdrop-blur-xl rounded-3xl border border-border/70 p-6 space-y-5 shadow-sm">
                                    <div className="flex items-center justify-between pb-3 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                            <Radio className="w-4 h-4 text-blue-500" />
                                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                                Webhook Settings
                                            </h4>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            Meta Platform
                                        </span>
                                    </div>

                                    {/* Callback URL */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Callback URL
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/api/webhooks/facebook`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Facebook Webhook URL copied!");
                                                }}
                                                className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>Copy</span>
                                            </button>
                                        </div>
                                        <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                            <span className="text-xs font-mono truncate block text-foreground">
                                                {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/facebook` : "/api/webhooks/facebook"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Verify Token */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Verify Token
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onboarding?.webhookVerifyToken) {
                                                        navigator.clipboard.writeText(onboarding.webhookVerifyToken);
                                                        toast.success("Verify Token copied!");
                                                    }
                                                }}
                                                className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>Copy</span>
                                            </button>
                                        </div>
                                        <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                            <span className="text-xs font-mono truncate block text-foreground">
                                                {onboarding?.webhookVerifyToken || "Not Set"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Subscribed Fields */}
                                    <div className="space-y-2 pt-2 border-t border-border/50">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Subscribed Page Fields
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {["messages", "messaging_postbacks", "messaging_optins", "message_deliveries"].map((field) => (
                                                <span
                                                    key={field}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium bg-muted/40 border border-border/60 text-foreground"
                                                >
                                                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Helper callout */}
                                    <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1.5">
                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                            <Info className="w-3.5 h-3.5 shrink-0" />
                                            <span className="text-xs font-bold">Auto-Subscription Active</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            When you connect your Facebook Page, Watibot automatically subscribes your page to real-time message feeds via Meta Graph API.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Instagram Tab */}
                    {activeTab === "instagram" && (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-3 duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
                            {/* Main Instagram Hub Card */}
                            <div className="xl:col-span-2 space-y-6">
                                <div className="bg-card/85 dark:bg-card/60 backdrop-blur-xl rounded-3xl border border-border/70 p-6 sm:p-8 relative overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    {/* Ambient top right glow */}
                                    <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-pink-500/10 via-amber-500/5 to-transparent pointer-events-none rounded-tr-3xl" />

                                    {/* Card Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/50 relative z-10">
                                        <div className="flex items-center gap-3.5">
                                            <InstagramColorIcon className="w-12 h-12 shrink-0 drop-shadow-md" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                                                        Instagram Professional Sync
                                                    </h3>
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                                        Meta Graph API
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {t("cards.instagramDescription")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {(connectionStats?.instagramBusinessId || session?.user?.instagramConnected) ? (
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                    </span>
                                                    Live & Connected
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/60">
                                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                                    Not Connected
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="pt-6 relative z-10">
                                        {(connectionStats?.instagramBusinessId || session?.user?.instagramConnected) ? (
                                            <div className="space-y-6">
                                                {/* Connected Identity Card */}
                                                <div className="p-5 rounded-2xl bg-gradient-to-b from-muted/40 to-muted/20 border border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="relative shrink-0">
                                                            {igProfile?.profilePic ? (
                                                                <img 
                                                                    src={igProfile.profilePic} 
                                                                    alt={igProfile.name || "Instagram"} 
                                                                    className="w-14 h-14 rounded-2xl object-cover border border-pink-500/30 shadow-md"
                                                                />
                                                            ) : (
                                                                <InstagramColorIcon className="w-14 h-14 shrink-0 drop-shadow-md" />
                                                            )}
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center text-white">
                                                                <Check className="w-3 h-3 stroke-[3]" />
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-base font-extrabold text-foreground truncate">
                                                                    {igProfile?.name || t("cards.instagramBusiness")}
                                                                </h4>
                                                                {igProfile?.username && (
                                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                                                        @{igProfile.username}
                                                                    </span>
                                                                )}
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                    Professional Account
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span className="font-mono bg-background/80 px-2 py-0.5 rounded-md border border-border/50 text-[11px] font-medium text-foreground">
                                                                    ID: {igProfile?.id || connectionStats?.instagramBusinessId}
                                                                </span>
                                                                {(igProfile?.id || connectionStats?.instagramBusinessId) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const idToCopy = igProfile?.id || connectionStats?.instagramBusinessId;
                                                                            if (idToCopy) {
                                                                                navigator.clipboard.writeText(idToCopy);
                                                                                toast.success("Instagram Business ID copied!");
                                                                            }
                                                                        }}
                                                                        className="p-1 hover:bg-background/80 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                                        title="Copy Business ID"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {(igProfile?.username || connectionStats?.instagramBusinessId) && (
                                                        <a
                                                            href={igProfile?.username ? `https://instagram.com/${igProfile.username}` : `https://instagram.com`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-background border border-border/60 hover:border-border text-foreground hover:bg-muted/40 transition-all shrink-0 shadow-xs"
                                                        >
                                                            <span>Open Profile</span>
                                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Feature Capabilities Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
                                                            <MessageSquare className="w-4 h-4" />
                                                            <span className="text-xs font-bold uppercase tracking-wider">Direct Messages</span>
                                                        </div>
                                                        <p className="text-xs text-foreground font-semibold">DMs & Story Replies</p>
                                                        <p className="text-[11px] text-muted-foreground">Realtime two-way inbox messaging</p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                            <Zap className="w-4 h-4" />
                                                            <span className="text-xs font-bold uppercase tracking-wider">Story Mentions</span>
                                                        </div>
                                                        <p className="text-xs text-foreground font-semibold">Story & Ad Leads</p>
                                                        <p className="text-[11px] text-muted-foreground">Capture leads when mentioned in stories</p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                                            <ShieldCheck className="w-4 h-4" />
                                                            <span className="text-xs font-bold uppercase tracking-wider">Security</span>
                                                        </div>
                                                        <p className="text-xs text-foreground font-semibold">Meta Graph v21.0</p>
                                                        <p className="text-[11px] text-muted-foreground">Official business account permissions</p>
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50">
                                                    <Link
                                                        href={`/${locale}/live-chat`}
                                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:brightness-105 text-white shadow-sm shadow-pink-500/25 transition-all"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                        <span>Open Live Chat</span>
                                                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        onClick={handleDisconnectInstagram}
                                                        disabled={isInstagramDisconnecting}
                                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-rose-500/30 bg-rose-500/5 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 transition-all disabled:opacity-60"
                                                    >
                                                        {isInstagramDisconnecting ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>{t("buttons.disconnecting")}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>{t("buttons.disconnect")}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6 py-2">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold mb-2">
                                                            <MessageSquare className="w-4 h-4" />
                                                        </div>
                                                        <h5 className="text-xs font-bold text-foreground">Instagram Direct (DMs)</h5>
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            Sync your Instagram DM conversations, media, and replies in one single dashboard.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-2">
                                                            <Zap className="w-4 h-4" />
                                                        </div>
                                                        <h5 className="text-xs font-bold text-foreground">Story Replies & Leads</h5>
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            Automatically trigger welcome sequences when users reply to stories or ads.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1.5">
                                                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold mb-2">
                                                            <ShieldCheck className="w-4 h-4" />
                                                        </div>
                                                        <h5 className="text-xs font-bold text-foreground">Professional Account</h5>
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                            Connect using your Meta Business account with full messaging permission compliance.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pt-2 max-w-md">
                                                    <ConnectFacebookButton
                                                        label={t("buttons.connectInstagram")}
                                                        channel="instagram"
                                                        onSuccess={loadConnectionStats}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar: Webhook Configuration */}
                            <div className="xl:col-span-1 space-y-6">
                                <div className="bg-card/85 dark:bg-card/60 backdrop-blur-xl rounded-3xl border border-border/70 p-6 space-y-5 shadow-sm">
                                    <div className="flex items-center justify-between pb-3 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                            <Radio className="w-4 h-4 text-pink-500" />
                                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                                                {t("webhook.title")}
                                            </h4>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                                            {t("webhook.badge")}
                                        </span>
                                    </div>

                                    {/* Callback URL */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {t("webhook.callbackUrl")}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/api/webhooks/instagram`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success(t("webhook.callbackCopied"));
                                                }}
                                                className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>{t("buttons.copy")}</span>
                                            </button>
                                        </div>
                                        <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                            <span className="text-xs font-mono truncate block text-foreground">
                                                {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/instagram` : "/api/webhooks/instagram"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic">
                                            {t("webhook.callbackHelp")}
                                        </p>
                                    </div>

                                    {/* Verify Token */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {t("webhook.verifyToken")}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onboarding?.webhookVerifyToken) {
                                                        navigator.clipboard.writeText(onboarding.webhookVerifyToken);
                                                        toast.success(t("webhook.verifyCopied"));
                                                    }
                                                }}
                                                className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>{t("buttons.copy")}</span>
                                            </button>
                                        </div>
                                        <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                            <span className="text-xs font-mono truncate block text-foreground">
                                                {onboarding?.webhookVerifyToken || t("webhook.notSet")}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic">
                                            {t("webhook.verifyHelp")}
                                        </p>
                                    </div>

                                    {/* Tip callout */}
                                    <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                            <Info className="w-3.5 h-3.5 shrink-0" />
                                            <span className="text-xs font-bold">{t("webhook.tipTitle")}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            {t("webhook.tipIntro")} <b>{t("webhook.instagramConfiguration")}</b>. {t("webhook.tipMiddle")} <b>{t("webhook.messages")}</b>, <b>{t("webhook.comments")}</b>.
                                        </p>
                                        <div className="space-y-1 pt-1">
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                <span>Direct Messages & Lead DMs</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                <span>Story Mentions & Catalogs</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayoutClient>
    );
}
