"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
    LayoutDashboard,
    Building2,
    CreditCard,
    Settings,
    UserCog,
    LucideIcon,
    Zap,
    History,
    Receipt,
    Share2,
    MessageCircle,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    ChevronLeft,
    LogOut,
    Video,
    DatabaseBackup,
    PhoneCall,
    Clock,
    QrCode,
    Radio,
    Activity,
    ShieldCheck
} from "lucide-react"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { verifyAdminPermission, mapPathToModule } from "@/lib/admin/rbac"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const localizedAdminPathPattern = /^\/(en|ur|hi|ar|bn)(?=\/|$)/

interface AdminSidebarProps {
    isCollapsed: boolean
    toggleSidebar: () => void
}

interface SubMenuItem {
    name: string
    href: string
    icon: LucideIcon
}

interface MenuItem {
    name: string
    icon: LucideIcon
    href: string
    submenu?: SubMenuItem[]
}

interface MenuGroup {
    label: string
    items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
    {
        label: "Main",
        items: [
            { name: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
            { name: "System Status", icon: Activity, href: "/admin/system-status" },
            { name: "Vendors", icon: Building2, href: "/admin/vendors" },
            { name: "Booked Calls", icon: PhoneCall, href: "/admin/booked-calls" },
            { name: "Backup & Restore", icon: DatabaseBackup, href: "/admin/backup" },
        ]
    },
    {
        label: "Subscriptions",
        items: [
            {
                name: "Subscriptions",
                icon: CreditCard,
                href: "/admin/subscriptions",
                submenu: [
                    { name: "Auto", icon: Zap, href: "/admin/subscriptions/auto" },
                    { name: "Manual/Prepaid", icon: History, href: "/admin/subscriptions/manual" },
                ]
            },
        ]
    },

    {
        label: "Configurations",
        items: [
            {
                name: "Configurations",
                icon: Settings,
                href: "/admin/configurations",
                submenu: [
                    { name: "General", icon: Settings, href: "/admin/configurations/general" },
                    { name: "Admin Staff & Roles", icon: ShieldCheck, href: "/admin/staff" },
                    { name: "User & Vendor", icon: UserCog, href: "/admin/configurations/users" },
                    { name: "Subscription Plans", icon: Receipt, href: "/admin/configurations/plans" },
                    { name: "Trial Limits", icon: Clock, href: "/admin/configurations/trail-limit" },
                    { name: "Social Login", icon: Share2, href: "/admin/configurations/social" },
                    { name: "Upload Video", icon: Video, href: "/admin/configurations/tutorial-videos" },
                    { name: "WhatsApp Gateway", icon: MessageCircle, href: "/admin/configurations/whatsapp-gateway" },
                 ]
            },
        ]
    },

]

export default function AdminSidebar({ isCollapsed, toggleSidebar }: AdminSidebarProps) {
    const pathname = usePathname()
    const normalizedPathname = pathname.replace(localizedAdminPathPattern, "")
    const { data: session } = useSession()
    const [expandedMenus, setExpandedMenus] = useState<string[]>(["Configurations", "Subscriptions"])

    const generalConfigFetcher = async (url: string) => {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        return res.json();
    };

    const { data: generalConfig, mutate: mutateGeneralConfig } = useSWR('/api/admin/configurations/general', generalConfigFetcher, {
        revalidateOnFocus: true,
        dedupingInterval: 5000,
    });

    const rawPlatformName = generalConfig?.platformName !== undefined 
        ? generalConfig.platformName 
        : "";

    const branding = {
        platformName: rawPlatformName ? rawPlatformName.trim() : "",
        logoUrl: (isCollapsed 
            ? (generalConfig?.smallLogo || generalConfig?.logoLightTheme) 
            : (generalConfig?.logoLightTheme || generalConfig?.smallLogo)
        )?.trim?.() || null
    };

    useEffect(() => {
        const handleConfigUpdate = () => {
            mutateGeneralConfig();
        };
        window.addEventListener("general_config_updated", handleConfigUpdate);
        return () => {
            window.removeEventListener("general_config_updated", handleConfigUpdate);
        };
    }, [mutateGeneralConfig]);

    const filteredMenuGroups = useMemo(() => {
        if (!session?.user) return menuGroups;
        const role = String(session.user.role || "").toUpperCase();
        if (role === "SUPER_ADMIN") return menuGroups;

        return menuGroups
            .map((group) => {
                const filteredItems = group.items.filter((item) => {
                    const mod = mapPathToModule(item.href);
                    if (!mod) return true;
                    return verifyAdminPermission(session.user, mod, "read").allowed;
                });
                return { ...group, items: filteredItems };
            })
            .filter((group) => group.items.length > 0);
    }, [session?.user]);

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        )
    }

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-slate-200 dark:border-white/5 antialiased",
                "bg-sidebar shadow-xl font-[family-name:var(--dashboard-font)]",
                "transition-[width] duration-150 ease-out",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            {/* Brand Header - Clean Logo only */}
            <div className={cn("h-20 flex items-center px-4 border-b border-slate-200 dark:border-white/10", isCollapsed ? "justify-center" : "justify-between")}>
                <div className={cn("flex items-center overflow-hidden transition-[opacity,width] duration-150 ease-out", isCollapsed ? "w-0 opacity-0" : "flex-1 min-w-0 opacity-100")}>
                    {branding.logoUrl ? (
                        <div className={cn(
                            "flex items-center",
                            isCollapsed 
                                ? "w-10 h-10 shrink-0 justify-center" 
                                : "w-full h-14 max-w-[190px] justify-start"
                        )}>
                            <img
                                src={branding.logoUrl}
                                alt={branding.platformName || "Logo"}
                                className={cn(
                                    "object-contain",
                                    isCollapsed
                                        ? "w-full h-full"
                                        : "w-auto h-full max-h-14 max-w-[190px] object-left"
                                )}
                                onError={(e) => {
                                    e.currentTarget.src = "/logo11122.png";
                                }}
                            />
                        </div>
                    ) : (
                        <div className={cn(
                            "shrink-0 flex items-center",
                            isCollapsed ? "w-10 h-10 justify-center" : "h-14 w-40 justify-start"
                        )}>
                            <img src="/logo11122.png" alt="Logo" className="w-full h-full object-contain object-left" />
                        </div>
                    )}
                </div>
                <button
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>

            {/* Menu Items - Scrollable Area */}
            <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-6 scrollbar-hide py-4">
                {filteredMenuGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        <div className={cn(
                            "mb-2 px-4 text-[11px] font-semibold text-slate-400 dark:text-white/60 tracking-wider transition-opacity duration-150",
                            isCollapsed ? "opacity-0 h-0 overflow-hidden mb-0" : "opacity-100"
                        )}>
                            {group.label}
                        </div>

                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const hasSubmenu = item.submenu && item.submenu.length > 0
                                const isExpanded = expandedMenus.includes(item.name)
                                const isActive = normalizedPathname === item.href || (hasSubmenu && item.submenu?.some(sub => sub.href === normalizedPathname))

                                const activeStyle = "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold"
                                const inactiveStyle = "text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"

                                if (hasSubmenu) {
                                    return (
                                        <div key={item.name} className="space-y-1">
                                            <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => toggleMenu(item.name)}
                                                            className={cn(
                                                                "w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200",
                                                                isActive ? activeStyle : inactiveStyle,
                                                                isExpanded && !isActive && "bg-slate-50 dark:bg-white/10 text-slate-900 dark:text-white",
                                                                isCollapsed ? "justify-center" : "justify-between"
                                                            )}
                                                        >
                                                            <item.icon className="w-5 h-5 shrink-0" />

                                                            <div className={cn(
                                                                "flex items-center justify-between flex-1 ml-3 overflow-hidden transition-[opacity,width] duration-150",
                                                                isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100"
                                                            )}>
                                                                <span className="text-sm font-medium truncate">{item.name}</span>
                                                                {isExpanded ? (
                                                                    <ChevronUp className="w-4 h-4 opacity-70" />
                                                                ) : (
                                                                    <ChevronDown className="w-4 h-4 opacity-70" />
                                                                )}
                                                            </div>
                                                        </button>
                                                    </TooltipTrigger>
                                                    {isCollapsed && (
                                                        <TooltipContent side="right" className="bg-[#1F2937] text-white border-white/5 font-semibold">
                                                            <p>{item.name}</p>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </TooltipProvider>

                                            <div className={cn(
                                                "overflow-hidden transition-[max-height,opacity] duration-150 ease-out",
                                                isExpanded ? "max-h-[800px] opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
                                            )}>
                                                <div className={cn(
                                                    "space-y-1 transition-all duration-150",
                                                    isCollapsed ? "ml-0 pl-0 border-none flex flex-col items-center" : "ms-4 ps-3 border-s border-slate-200 dark:border-white/10 mt-1"
                                                )}>
                                                    {item.submenu!.map((sub) => {
                                                        const isSubActive = normalizedPathname === sub.href
                                                        const NavItem = (
                                                            <Link
                                                                href={sub.href}
                                                                className={cn(
                                                                    "flex items-center rounded-lg transition-all duration-200",
                                                                    isSubActive
                                                                        ? "bg-primary/15 text-primary dark:bg-primary/20 font-bold"
                                                                        : "text-slate-500 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white",
                                                                    isCollapsed ? "justify-center py-3" : "px-3 py-2 gap-3"
                                                                )}
                                                            >
                                                                <sub.icon className={cn(
                                                                    "shrink-0",
                                                                    isCollapsed ? "w-4 h-4" : "w-4 h-4",
                                                                    isSubActive ? "text-primary" : "text-slate-400"
                                                                )} />
                                                                <span className={cn(
                                                                    "text-xs font-semibold whitespace-nowrap transition-[opacity,width] duration-150",
                                                                    isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
                                                                )}>
                                                                    {sub.name}
                                                                </span>
                                                            </Link>
                                                        )

                                                        if (isCollapsed) {
                                                            return (
                                                                <TooltipProvider key={sub.name} delayDuration={0}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            {NavItem}
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="right" className="bg-[#1F2937] text-white border-white/5 font-semibold">
                                                                            <p>{sub.name}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )
                                                        }

                                                        return <div key={sub.name}>{NavItem}</div>
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                const NavItem = (
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center px-3 py-3 rounded-xl transition-all duration-200",
                                            isActive ? activeStyle : inactiveStyle,
                                            isCollapsed ? "justify-center" : ""
                                        )}
                                    >
                                        <item.icon className="w-5 h-5 shrink-0" />

                                        <div className={cn(
                                            "ml-3 overflow-hidden transition-[opacity,width] duration-150",
                                            isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100"
                                        )}>
                                            <span className="text-sm font-medium truncate">{item.name}</span>
                                        </div>
                                    </Link>
                                )

                                if (isCollapsed) {
                                    return (
                                        <TooltipProvider key={item.name} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {NavItem}
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="bg-[#1F2937] text-white border-white/5 font-semibold">
                                                    <p>{item.name}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )
                                }

                                return <div key={item.name}>{NavItem}</div>
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Admin Footer Section - Matches Image */}
            <div className="shrink-0 p-4 space-y-4">
                {/* Admin Profile Link */}
                <Link
                    href="/admin/profile"
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border border-transparent",
                        normalizedPathname === "/admin/profile"
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold"
                            : "text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white",
                        isCollapsed ? "justify-center" : ""
                    )}
                >
                    <UserCog className="w-5 h-5 shrink-0" />
                    <span className={cn(
                        "text-sm font-medium whitespace-nowrap transition-[opacity,width] duration-150",
                        isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
                    )}>
                        Admin Profile
                    </span>
                </Link>

                {!isCollapsed && (
                    <div className="bg-slate-50 dark:bg-[#1E293B] rounded-2xl p-4 flex items-center justify-between border border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                                        {session?.user?.name?.charAt(0) || "A"}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{session?.user?.name || "WatiBot Admin"}</span>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">{session?.user?.email || "admin@watibot.com"}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    )
}
