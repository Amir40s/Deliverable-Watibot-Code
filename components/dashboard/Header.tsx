"use client"
import {
    Download,
    Copy,
    User,
    CreditCard,
    Settings,
    Users,
    MessageCircle,
    LogOut,
    Menu,
    Sun,
    Moon,
    Monitor,
    Plus,
    Clock,
    ChevronDown,
    Bell,
    Send,
    Loader2
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useSession, signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { ActivityLogEntry } from "@/app/actions/activity-log";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from 'next-intl';
import { PLAN_CONFIG_UPDATED_EVENT, PLAN_CONFIG_UPDATED_STORAGE_KEY } from "@/lib/plan-refresh";
import { NotificationPopupToggle } from "@/components/dashboard/NotificationPopupToggle";
import { useUserStatus } from "@/hooks/useUserStatus";
import useSWR, { useSWRConfig } from "swr";

const notificationsFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return { logs: [], total: 0 };
    return res.json();
};

export default function Header() {
    const { data: session } = useSession()
    const { theme, setTheme, resolvedTheme } = useTheme()
    const pathname = usePathname()
    const router = useRouter()
    const t = useTranslations('Header');
    const currentLocale = pathname.split('/')[1] || 'en';
    const [mounted, setMounted] = useState(false);

    const {
        plan: currentPlan,
        status: currentStatus,
        trialDaysRemaining: trialDays,
        organizationName: orgName,
        whatsappConnected: isWhatsappConnected,
        whatsappQualityRating,
        whatsappStatus,
        whatsappConnectionMethod,
        userName: statusUserName,
        userRole: statusUserRole,
        userImage: statusUserImage,
        revalidate: revalidateUserStatus
    } = useUserStatus();

    const userName = statusUserName || session?.user?.name || session?.user?.organizationName || session?.user?.email?.split('@')[0] || null;
    const userRole = statusUserRole || session?.user?.role || null;
    const userImage = statusUserImage || session?.user?.image || null;

    const { mutate: globalMutate } = useSWRConfig();

    const { data: notificationsData, mutate: mutateNotifications } = useSWR(
        session?.user?.id ? '/api/notifications/recent' : null,
        notificationsFetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            dedupingInterval: 60000,
        }
    );

    const [recentNotifications, setRecentNotifications] = useState<ActivityLogEntry[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isReturning, setIsReturning] = useState(false)
    const activeTheme = resolvedTheme || theme
    const isDarkTheme = activeTheme === "dark"

    const handleReturnToAdmin = async () => {
        setIsReturning(true)
        try {
            const { returnToAdmin } = await import("@/app/actions/impersonate")
            const result = await returnToAdmin()
            if (result.error) {
                toast.error(result.error)
                return
            }
            if (result.success && result.email && result.token) {
                toast.loading("Returning to administrator session...")
                const { signIn } = await import("next-auth/react")
                await signIn("credentials", {
                    email: result.email,
                    impersonationToken: result.token,
                    callbackUrl: `/${currentLocale}/admin/dashboard`,
                    redirect: true,
                })
            }
        } catch {
            toast.error("Failed to return to administrator session")
        } finally {
            setIsReturning(false)
        }
    }

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
            flag: "https://flagcdn.com/w40/pk.png",
            native: "اردو"
        },
        {
            id: "hi",
            name: "Hindi",
            flag: "https://flagcdn.com/w40/in.png",
            native: "हिंदी"
        },
        {
            id: "ar",
            name: "Arabic",
            flag: "https://flagcdn.com/w40/sa.png",
            native: "العربية"
        },
        {
            id: "bn",
            name: "Bangla",
            flag: "https://flagcdn.com/w40/bd.png",
            native: "বাংলা"
        }
    ]

    const [selectedLang, setSelectedLang] = useState<{
        id: string;
        name: string;
        flag: string | null;
        native: string;
    }>(languages.find(l => l.id === currentLocale) || languages[0])
    const [isLangOpen, setIsLangOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const logs = notificationsData?.logs || [];
        setRecentNotifications(logs);
    }, [notificationsData]);

    useEffect(() => {
        if (recentNotifications.length > 0) {
            const lastReadStr = localStorage.getItem('notificationsLastReadAt');
            const lastRead = lastReadStr ? parseInt(lastReadStr, 10) : 0;
            const unread = recentNotifications.filter(log => new Date(log.createdAt).getTime() > lastRead).length;
            setUnreadCount(lastRead > 0 ? unread : (notificationsData?.total || recentNotifications.length));
        }
    }, [recentNotifications, notificationsData?.total]);

    useEffect(() => {
        if (currentStatus === 'INACTIVE') {
            signOut({ callbackUrl: '/login?error=Your account is inactive. Please contact support.' });
        }
    }, [currentStatus]);

    useEffect(() => {
        const handleMarkedRead = () => setUnreadCount(0);
        const handleRefreshAccountStatus = () => {
            revalidateUserStatus();
            mutateNotifications();
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key === PLAN_CONFIG_UPDATED_STORAGE_KEY) {
                handleRefreshAccountStatus();
            }
        };
        window.addEventListener('notificationsMarkedAsRead', handleMarkedRead);
        window.addEventListener(PLAN_CONFIG_UPDATED_EVENT, handleRefreshAccountStatus);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('notificationsMarkedAsRead', handleMarkedRead);
            window.removeEventListener(PLAN_CONFIG_UPDATED_EVENT, handleRefreshAccountStatus);
            window.removeEventListener('storage', handleStorage);
        };
    }, [revalidateUserStatus, mutateNotifications]);

    const displayPlan = currentPlan || session?.user?.plan || 'free';
    const displayStatus = currentStatus || session?.user?.status || 'PENDING';
    const displayTrialDays = trialDays !== null ? trialDays : (session?.user?.trialDaysRemaining ?? 0);

    return (
        <header className="h-14 bg-white dark:bg-[#0B0E14] flex items-center justify-between px-3 sm:px-6 transition-all duration-300 z-40 relative border-b border-[#E5E7EB] dark:border-white/5">
            <div className="flex items-center gap-3">
                 <button
                    onClick={() => {
                        const isOpen = document.body.classList.contains('sidebar-open');
                        if (isOpen) {
                            document.body.classList.remove('sidebar-open');
                        } else {
                            document.body.classList.add('sidebar-open');
                        }
                    }}
                    className="md:hidden p-1.5 -ms-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    aria-label="Toggle Sidebar Menu"
                >
                    <Menu className="w-4.5 h-4.5" />
                </button>

                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 tracking-widest leading-none mb-1 hidden sm:block">{t('activeProject')}</span>
                    <span className="text-xs font-extrabold text-primary dark:text-white truncate max-w-[70px] sm:max-w-[120px] leading-none">
                        {orgName || session?.user?.organizationName || '...'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-4.5">
                {session?.user?.originalAdminId && session.user.id !== session.user.originalAdminId && (
                    <Button
                        onClick={handleReturnToAdmin}
                        disabled={isReturning}
                        className="h-8 px-2 sm:px-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-black tracking-wide rounded-xl shadow-md flex items-center gap-1 active:scale-[0.98] border-none shrink-0"
                    >
                        {isReturning ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <LogOut className="w-3 h-3 -rotate-180" />
                        )}
                        <span className="hidden sm:inline">Return to Admin</span>
                    </Button>
                )}
                <div className="hidden lg:flex items-center gap-2.5 text-[10px] font-medium text-[#6B7280] dark:text-gray-400">
                     
                    {whatsappConnectionMethod !== 'qr' && whatsappQualityRating && (
                        <div className="flex items-center gap-1">
                            <span>Quality Rating:</span>
                            <span className={cn(
                                "font-bold px-1.5 py-0.5 rounded-full text-[9px]",
                                ['GREEN', 'HIGH'].includes(whatsappQualityRating?.toUpperCase() || '') ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                ['YELLOW', 'MEDIUM'].includes(whatsappQualityRating?.toUpperCase() || '') ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                ['RED', 'LOW'].includes(whatsappQualityRating?.toUpperCase() || '') ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                                {whatsappQualityRating?.toUpperCase() === 'GREEN' ? 'High' :
                                 whatsappQualityRating?.toUpperCase() === 'YELLOW' ? 'Medium' :
                                 whatsappQualityRating?.toUpperCase() === 'RED' ? 'Low' :
                                 (whatsappQualityRating || 'N/A')}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <span>{whatsappConnectionMethod === 'qr' ? 'WhatsApp Status :' : t('whatsappStatus')}</span>
                        {['BANNED', 'DISABLED', 'BLOCKED', 'SUSPENDED'].includes(whatsappStatus?.toUpperCase() || '') ? (
                            <span className="text-rose-500 font-bold uppercase tracking-wider">{whatsappStatus}</span>
                        ) : ['FLAGGED', 'RESTRICTED', 'PENDING', 'UNVERIFIED', 'RATE_LIMITED'].includes(whatsappStatus?.toUpperCase() || '') ? (
                            <span className="text-amber-500 font-bold uppercase tracking-wider">{whatsappStatus}</span>
                        ) : ['CONNECTED', 'APPROVED', 'LIVE'].includes(whatsappStatus?.toUpperCase() || '') || isWhatsappConnected ? (
                            <span className="text-[#00a884] font-bold uppercase tracking-wider">
                                {whatsappConnectionMethod === 'qr' ? 'LIVE (QR)' : t('live')}
                            </span>
                        ) : (
                            <span className="text-rose-500 font-bold">{whatsappStatus || t('disconnected')}</span>
                        )}
                    </div>
                </div>

                {(session?.user?.id || orgName || currentPlan) && (
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-2.5 text-[10px] font-medium text-[#6B7280] dark:text-gray-400">
                            <div className="flex items-center gap-1">
                                <span>{t('currentPlan')}</span>
                                <span className={cn(
                                    "font-bold tracking-wider px-1.5 py-0.5 rounded-full text-[9px] plus-jakarta-forced flex items-center justify-center min-w-[42px] min-h-[16px]",
                                    currentPlan === null ? "bg-slate-100 text-slate-500 dark:bg-slate-800" :
                                    currentPlan.toLowerCase() === 'free' ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" :
                                        currentPlan.toLowerCase() === 'standard' ? "bg-primary/20 text-primary-foreground dark:bg-primary/30 dark:text-primary" :
                                            currentPlan.toLowerCase() === 'premium' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                                                "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                )}>
                                    {currentPlan === null ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                    ) : (
                                        currentPlan
                                    )}
                                </span>
                                {currentPlan !== null && currentPlan.toLowerCase() === 'free' && (
                                    <span className="text-[#9CA3AF] tracking-tight plus-jakarta-forced text-[9px]">{displayStatus === 'TRIAL' ? '(TRIAL)' : '(Free-Forever)'}</span>
                                )}
                            </div>
                        </div>

                        {displayPlan === 'free' && displayStatus === 'TRIAL' && (displayTrialDays ?? 0) > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">
                                    <Clock className="w-3 h-3" />
                                    <span className="text-[10px] font-bold">{displayTrialDays} days left</span>
                                </div>
                                <div className="w-20 h-1 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-500",
                                            (displayTrialDays ?? 0) <= 3 ? "bg-red-500" : "bg-primary"
                                        )}
                                        style={{
                                            width: `${Math.min(100, (displayTrialDays ?? 0) / (session?.user?.trialLimitDays ?? 15) * 100)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Language Selector Pill */}
                <div className="relative z-50">
                    <div 
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-800 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-[10.5px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
                    >
                        {selectedLang.flag ? (
                            <img src={selectedLang.flag} alt={selectedLang.name} className="w-4 h-2.5 object-cover rounded-sm flex-shrink-0" />
                        ) : (
                            <span className="text-[9.5px] text-slate-800 dark:text-slate-200 font-extrabold pr-0.5">{selectedLang.native}</span>
                        )}
                        <span className="hidden sm:inline">{selectedLang.name}</span>
                        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isLangOpen && (
                        <>
                            {/* Backdrop overlay to close when clicking outside */}
                            <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)} />
                            
                            {/* Dropdown Menu Panel */}
                            <div className="absolute end-0 mt-2 w-[140px] bg-white dark:bg-[#111b21] border border-slate-100 dark:border-slate-800 rounded-2xl p-1.5 shadow-xl shadow-slate-100/60 dark:shadow-none z-50 animate-fade-in">
                                {languages.map((lang) => (
                                    <div
                                        key={lang.id}
                                        onClick={() => {
                                            setSelectedLang(lang)
                                            setIsLangOpen(false)
                                            // Route to new language path
                                            const newPath = pathname.replace(`/${currentLocale}`, `/${lang.id}`);
                                            router.push(newPath);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-[11px] font-bold select-none",
                                            lang.id === currentLocale
                                                ? "bg-[#00B074]/10 dark:bg-[#00B074]/20 text-[#00B074] dark:text-[#00B074]"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        <div className="w-4.5 flex items-center justify-center flex-shrink-0">
                                            {lang.flag ? (
                                                <img src={lang.flag} alt={lang.name} className="w-4 h-2.5 object-cover rounded-sm flex-shrink-0" />
                                            ) : (
                                                <span className={cn(
                                                    "text-[10px] font-black tracking-tight leading-none",
                                                    lang.id === currentLocale ? "text-[#00B074]" : "text-slate-800 dark:text-slate-200"
                                                )}>{lang.native}</span>
                                            )}
                                        </div>
                                        <span className={cn(
                                            "font-semibold",
                                            lang.id === currentLocale ? "text-[#00B074] font-bold" : "text-slate-500 dark:text-slate-400"
                                        )}>{lang.name}</span>
                                        {lang.id === currentLocale && (
                                            <span className="ms-auto text-[#00B074]">✓</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <NotificationPopupToggle variant="pill" className="hidden sm:flex" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button 
                            className="relative p-1.5 rounded-full text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95 outline-none"
                            title="Notifications"
                        >
                            <Bell className="w-4.5 h-4.5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 end-1 min-w-[12px] h-[12px] px-[2.5px] bg-red-500 border-2 border-white dark:border-[#0B0E14] text-white text-[7.5px] font-bold flex items-center justify-center rounded-full">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 mt-2 p-0 rounded-2xl bg-white dark:bg-[#111b21] border border-gray-100 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden plus-jakarta-forced">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('notifications')}</span>
                            <Link href="/manage/notifications" className="text-[10px] font-bold text-primary hover:underline">View All</Link>
                        </div>
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                            <NotificationPopupToggle variant="header" />
                        </div>
                        <div className="flex flex-col max-h-[300px] overflow-y-auto">
                            {recentNotifications.length > 0 ? (
                                recentNotifications.slice(0, 5).map((log) => (
                                    <Link key={log.id} href="/manage/notifications" className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800/50 cursor-pointer">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                            <Bell className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate capitalize">{log.action.toLowerCase()}</span>
                                            <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                                {(log.userName || log.userEmail || log.target || 'System')}{log.details ? ` · ${log.details}` : ''}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium mt-1">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-4 text-center text-xs text-slate-500">No recent notifications</div>
                            )}
                        </div>
                        {recentNotifications.length > 0 && (
                            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <DropdownMenuItem asChild>
                                    <button 
                                        onClick={() => {
                                            localStorage.setItem('notificationsLastReadAt', Date.now().toString());
                                            setUnreadCount(0);
                                            window.dispatchEvent(new Event('notificationsMarkedAsRead'));
                                            toast.success("All notifications marked as read");
                                        }}
                                        className="w-full py-2 flex items-center justify-center text-xs font-bold text-[#00B074] bg-[#00B074]/10 hover:bg-[#00B074]/20 dark:bg-[#00B074]/15 dark:hover:bg-[#00B074]/25 rounded-lg transition-colors cursor-pointer"
                                    >
                                        {t('markAllAsRead')}
                                    </button>
                                </DropdownMenuItem>
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <button
                    onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}
                    className="p-1.5 rounded-full text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                    title={mounted && isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
                    aria-label={mounted && isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
                >
                    {!mounted ? (
                        <Moon className="w-4.5 h-4.5 opacity-0" />
                    ) : isDarkTheme ? (
                        <Sun className="w-4.5 h-4.5 text-yellow-400" />
                    ) : (
                        <Moon className="w-4.5 h-4.5" />
                    )}
                </button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800/80 active:scale-[0.98] transition-all outline-none text-start cursor-pointer">
                            <div className="w-7.5 h-7.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                                {(userImage || session?.user?.image) ? (
                                    <img src={(userImage || session?.user?.image)!} alt={userName || session?.user?.name || ""} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[#f1f5f9] dark:bg-slate-800 flex items-center justify-center">
                                        <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                    </div>
                                )}
                                <div className="absolute bottom-0 end-0 w-2 h-2 bg-[#00a884] rounded-full border-2 border-white dark:border-[#0B0E14]" />
                            </div>
                            <div className="hidden sm:flex flex-col text-start justify-center leading-none">
                                <span className="text-[10px] font-black text-slate-800 dark:text-gray-200 tracking-tight">
                                    {userName || session?.user?.name || session?.user?.organizationName || session?.user?.email?.split('@')[0] || "User"}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 dark:text-gray-500 mt-0.5 tracking-wider uppercase">
                                    {(userRole || session?.user?.role) === 'SUPER_ADMIN' ? 'SUPER ADMIN' : (userRole || session?.user?.role || 'USER')}
                                </span>
                            </div>
                            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mt-2 p-2 rounded-2xl bg-white dark:bg-[#111b21] border border-gray-100 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200 plus-jakarta-forced">
                        <DropdownMenuItem asChild>
                            <Link
                                href={session?.user?.role === 'SUPER_ADMIN' ? "/admin/profile" : "/profile"}
                                className="flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group"
                            >
                                <Settings className="w-4 h-4 text-primary" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[#374151] dark:text-gray-200">My Profile</span>
                                    <span className="text-[10px] text-gray-500">Account details & settings</span>
                                </div>
                            </Link>
                        </DropdownMenuItem>

                        {session?.user?.role === 'SUPER_ADMIN' && (
                            <DropdownMenuItem asChild>
                                <Link href="/admin/configurations/general" className="flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <Settings className="w-4 h-4 text-emerald-500" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-[#374151] dark:text-gray-200">Configurations</span>
                                        <span className="text-[10px] text-gray-500">Platform-wide settings</span>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                        )}

                        <div className="h-px bg-gray-100 dark:bg-slate-800 my-2 mx-1" />

                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 transition-colors group"
                        >
                            <LogOut className="w-4 h-4" />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold">Sign Out</span>
                                <span className="text-[10px] text-red-600/60">Terminate current session</span>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
