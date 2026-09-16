"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from 'next-intl';
import { useSession, signOut } from "next-auth/react"
import useSWR from "swr";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Megaphone,
  GitBranch,
  BarChart3,
  Zap,
  Headphones,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bell,
  MessageCircle,
  Settings,
  Facebook,
  ShieldCheck,
  Calendar,
  LogOut,
  Clock,
  Database,
  Code2,
  Puzzle,
  Focus,
  LayoutGrid,
  Instagram,
  Clapperboard,
  MessageSquarePlus,
  Volume2,
  Target,
  ScrollText,
  ShoppingBag,
  Webhook,
  FolderOpen,
  GitCommitHorizontal,
  Activity,
  Store,
  CalendarCheck,
} from "lucide-react"
import { useUserStatus } from "@/hooks/useUserStatus"
import { cn } from "@/lib/utils";
import { canView, canEdit, canDelete, canFull } from '@/lib/permissionLevels';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import ThemeToggle from "@/components/admin/ThemeToggle"

// CONFIG: Change --dashboard-font in globals.css to change the dashboard font globally
const SIDEBAR_FONT = "font-[family-name:var(--dashboard-font)]";

const sidebarGroups = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard", module: "dashboard", access: "view" },
    ]
  },
  {
    title: "Conversations",
    items: [
      { name: "Live Chat", icon: MessageSquare, href: "/live-chat", module: "chat", access: "view" },
      { name: "History", icon: Clock, href: "/live-chat?tab=history", module: "chat", access: "view" },
    ]
  },
  {
    title: "CRM",
    items: [
      { name: "Contacts", icon: Users, href: "/dashboard/contacts", module: "contacts", access: "view" },
      { name: "Audience", icon: Users, href: "/dashboard/audience", module: "audience", access: "view" },
      { name: "Pipeline", icon: GitCommitHorizontal, href: "/dashboard/pipeline", module: "contacts", access: "view" },
    ]
  },
  {
    title: "Messaging",
    items: [
      { name: "Templates", icon: FileText, href: "/templates", module: "templates", access: "view" },
      { name: "Media Library", icon: FolderOpen, href: "/dashboard/media-library", module: "media_library", access: "view" },
      { name: "Quick Replies", icon: Zap, href: "/manage/quick-replies", module: "quick_replies", access: "view" },
      { name: "Quick Message", icon: MessageSquarePlus, href: "/dashboard/welcome-messages", module: "quick_message", access: "view" },
      { name: "Bulk Broadcasting", icon: Megaphone, href: "/campaign", module: "drip_campaign", access: "view" },
    ]
  },
  {
    title: "Automation",
    items: [
      { name: "Flow", icon: GitBranch, href: "/dashboard/flows", module: "flow", access: "view" },
      { name: "Knowledge Base", icon: Database, href: "/dashboard/knowledge-base", module: "knowledge_base", access: "view" },
      { name: "24h Window Reminders", icon: Clock, href: "/dashboard/window-reminders", module: "flow", access: "view" },
    ]
  },
  {
    title: "Commerce",
    items: [
      { name: "Catalogs", icon: ShoppingBag, href: "/catalogs", module: "catalogs", requireAdmin: true, access: "view" },
      { name: "Ad Manager", icon: BarChart3, href: "/manage/ad-manager", module: "ad_manager", access: "view" },
    ]
  },
  {
    title: "SOCIAL MEDIA",
    items: [
      { name: "Facebook Automation", icon: Facebook, href: "/dashboard/facebook-automation", module: "facebook_posts", access: "view" },
      { name: "Instagram Automation", icon: Instagram, href: "/dashboard/instagram-automation", module: "instagram_posts", access: "view" },
    ]
  },
  {
    title: "Manage",
    items: [
      { name: "Manage", icon: LayoutGrid, href: "/manage/reports", module: "reports", access: "view" },
    ]
  },
  {
    title: "Settings",
    items: [
      { name: "Settings", icon: Settings, href: "/dashboard/settings", module: "settings", access: "view" },
      { name: "Integrations", icon: Puzzle, href: "/dashboard/integrations", module: "integrations", access: "view" },
      { name: "Webhooks", icon: Webhook, href: "/dashboard/webhooks", module: "integrations", access: "view" },
      // { name: "Quota", icon: Database, href: "/dashboard/quota", module: "quota", access: "view" },
      { name: "Developer", icon: Code2, href: "/developer", module: "developer", access: "view" },
      { name: "All Projects", icon: Focus, href: "/projects", module: "projects", access: "view" },
    ]
  },
]

const manageSubItems = [
  { name: "Reports", icon: BarChart3, href: "/manage/reports", module: "reports", access: "view" },
  { name: "Health Audit", icon: Activity, href: "/manage/health-audit", module: "reports", access: "view" },
  { name: "Agents", icon: Headphones, href: "/manage/agents", module: "agents", access: "view" },
  { name: "Permissions", icon: ShieldCheck, href: "/manage/permissions", module: "permissions", access: "view" },
  { name: "Tags", icon: Tag, href: "/manage/tags", module: "tags", access: "view" },
  { name: "Notification Preferences", icon: Bell, href: "/manage/notifications", module: "notifications", access: "view" },
  { name: "Activity Log", icon: ScrollText, href: "/manage/activity-log", module: "reports", access: "view" },
]

interface SidebarProps {
  isCollapsed: boolean
  toggleSidebar: () => void
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cleanPathname = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const sidebarRef = useRef<HTMLElement>(null)
  const { data: session } = useSession();

  const [isManageOpen, setIsManageOpen] = useState(false);
  const t = useTranslations('Sidebar');
  const locale = useLocale();
  const dir = ['ar', 'ur', 'hi', 'bn'].includes(locale) ? 'rtl' : 'ltr';

  const getTranslatedLabel = (key: string) => {
    try {
      if (t.has(key as any)) {
        const translated = t(key as any);
        if (translated && !translated.startsWith('Sidebar.')) {
          return translated;
        }
      }
      return key;
    } catch {
      return key;
    }
  };

  // Real-Time Sidebar Counts Fetching (lightweight unread count endpoint)
  const { data: countsData } = useSWR('/api/sidebar/counts', fetcher, {
    refreshInterval: 20000,
    dedupingInterval: 10000,
    revalidateOnFocus: false,
  });

  const counts = countsData?.counts || {};

  const formatBadgeCount = (count?: number | null) => {
    if (count === undefined || count === null || count <= 0) return null;
    return count.toString();
  };

  const getBadgeValue = (itemName: string): number | null => {
    if (itemName === "Live Chat") {
      return counts.chat ?? null;
    }
    return null;
  };

  const isManageActive = cleanPathname.startsWith("/manage/") &&
    !cleanPathname.startsWith("/manage/quick-replies") &&
    !cleanPathname.startsWith("/manage/ad-campaign") &&
    !cleanPathname.startsWith("/manage/ad-manager") &&
    !cleanPathname.startsWith("/manage/leads-report");

  useEffect(() => {
    if (isManageActive) {
      setIsManageOpen(true)
    }
  }, [pathname, isManageActive])

  // Real-Time System Branding Fetching (Platform Name & Logo)
  const { data: generalConfig, mutate: mutateGeneralConfig } = useSWR('/api/admin/configurations/general', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60000,
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

  const userRole = session?.user?.role?.toUpperCase() || "";
  const isSuperAdmin = userRole === "SUPER_ADMIN"
  const isAdminOrOwner = userRole === "ADMIN" || isSuperAdmin
  const isImpersonating = !!(session?.user?.originalAdminId && session.user.originalAdminId !== session.user.id);
  const kbManagement = session?.user?.knowledgeBaseManagement || "user";
  const { whatsappConnectionMethod } = useUserStatus();
  const isQr = whatsappConnectionMethod === "qr" || (session?.user as any)?.whatsappConnectionMethod === "qr";

  const visibleGroups = !session ? sidebarGroups : (() => {
    return sidebarGroups.map(group => {
      if (group.title === "SYSTEM" && !isSuperAdmin) return null;
      const visibleItems = group.items.filter(item => {
        const typedItem = item as { permissions?: string[], requireAdmin?: boolean, module?: string, access?: string };
        const module = typedItem.module ?? typedItem.permissions?.[0]?.split('_')[0] ?? '';

        // QR Mode Guard: Meta Templates are only for Official Cloud API accounts
        if (module === "templates" && isQr) {
          return false;
        }
        
        // Manage Parent Button Guard: Only show if user has access to at least one subitem
        if (item.name === "Manage") {
          const hasAnySubItem = manageSubItems.some((sub: any) => {
            const planModules = (session?.user?.planModulesAccess as Record<string, boolean>) || {};
            if (sub.module && planModules[sub.module] === false) return false;
            if (sub.requireAdmin && !isAdminOrOwner) return false;
            if (isAdminOrOwner) return true;
            return canView(session, sub.module ?? '');
          });
          return hasAnySubItem;
        }

        // Knowledge Base Admin Management Guard:
        // If Admin manages KB, hide from normal user sessions.
        // If Admin is impersonating the user ("Sign In As User") or is Super Admin, keep it visible!
        if (module === "knowledge_base" && kbManagement === "admin" && !isImpersonating && !isSuperAdmin) {
          return false;
        }

        // Enforce Plan limits first - if plan disabled it, nobody (even admin/owner) can see it
        const planModules = (session?.user?.planModulesAccess as Record<string, boolean>) || {};
        if (module && planModules[module] === false) return false;

        if (typedItem.requireAdmin && !isAdminOrOwner) return false;
        if (isAdminOrOwner) return true;
        const access = typedItem.access ?? 'view';
        switch (access) {
          case 'view': return canView(session, module);
          case 'edit': return canEdit(session, module);
          case 'delete': return canDelete(session, module);
          case 'full': return canFull(session, module);
          default: return false;
        }
      });
      if (visibleItems.length === 0) return null;
      return { ...group, items: visibleItems };
    }).filter(Boolean) as typeof sidebarGroups;
  })();

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "fixed start-0 top-0 bottom-0 z-50 flex flex-col border-e border-slate-200 dark:border-white/5 antialiased transition-[width] duration-150 ease-out",
        "bg-sidebar shadow-xl",
        SIDEBAR_FONT,
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header - Clean Logo only */}
      <div className={cn("h-20 flex items-center px-4 border-b border-slate-200 dark:border-white/10", isCollapsed ? "justify-center" : "justify-between")}>
        <div className={cn("flex items-center overflow-hidden", isCollapsed ? "justify-center" : "flex-1 min-w-0")}>
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
              <img src={"/logo11122.png"} alt="Logo" className="w-full h-full object-contain object-left" />
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-100 dark:border-white/5 transition-all shadow-sm active:scale-[0.97] flex items-center justify-center"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed
            ? (dir === 'rtl' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />)
            : (dir === 'rtl' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />)
          }
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-6 custom-scrollbar py-4">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <div className={cn(
              "mb-2 px-4 text-[11px] font-semibold text-slate-400 dark:text-white/60 tracking-wider transition-opacity duration-150",
              isCollapsed ? "opacity-0 h-0 overflow-hidden mb-0" : "opacity-100"
            )}>
              {getTranslatedLabel(group.title)}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                let isActive = false;
                if (item.name === "Manage") {
                  isActive = isManageActive;
                } else if (item.href === "/live-chat?tab=history") {
                  isActive = cleanPathname === "/live-chat" && searchParams.get("tab") === "history";
                } else if (item.href === "/live-chat") {
                  isActive = cleanPathname === "/live-chat" && searchParams.get("tab") !== "history";
                } else {
                  isActive = cleanPathname === item.href;
                }

                const rawVal = getBadgeValue(item.name);
                const badgeText = formatBadgeCount(rawVal);

                const NavItem = (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-3 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold"
                        : "text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white",
                      isCollapsed ? "justify-center relative" : "justify-between"
                    )}
                  >
                    <div className="flex items-center">
                      <div className="relative">
                        <item.icon className="w-5 h-5 shrink-0" />
                        {isCollapsed && badgeText && (
                          <span className="absolute -top-1.5 -end-2 min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-black bg-[#25D366] text-white flex items-center justify-center shadow-md shrink-0">
                            {badgeText}
                          </span>
                        )}
                      </div>

                      {!isCollapsed && (
                        <div className="ms-3 overflow-hidden transition-[opacity,width] duration-150">
                          <span className="text-sm font-medium whitespace-nowrap">{getTranslatedLabel(item.name)}</span>
                        </div>
                      )}
                    </div>

                    {!isCollapsed && badgeText && (
                      <span className="ms-auto min-w-[22px] h-[22px] px-2 rounded-full text-[11px] font-extrabold bg-[#25D366] text-white flex items-center justify-center transition-all shrink-0 shadow-sm">
                        {badgeText}
                      </span>
                    )}
                  </Link>
                )

                if (isCollapsed) {
                  return (
                    <div key={item.name} className="flex flex-col items-center">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {item.name === "Manage" ? (
                              <button
                                onClick={() => setIsManageOpen(!isManageOpen)}
                                className={cn(
                                  "flex items-center justify-center p-3 rounded-xl transition-all duration-200 cursor-pointer w-10 h-10",
                                  isActive
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold"
                                    : "text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                                )}
                              >
                                <item.icon className="w-5 h-5 shrink-0" />
                              </button>
                            ) : (
                              NavItem
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="right" className="bg-[#1F2937] text-white border-white/5 font-semibold flex items-center gap-2">
                            <p>{item.name}</p>
                            {badgeText && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#25D366] text-white">
                                {badgeText}
                              </span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Stacked sub-items when collapsed */}
                      {item.name === "Manage" && isManageOpen && (
                        <div className="mt-1.5 space-y-1.5 flex flex-col items-center border-s-2 border-slate-200/50 dark:border-white/10 py-1 ps-1 ms-0.5">
                          {manageSubItems.map((sub: any) => {
                            const planModules = (session?.user?.planModulesAccess as Record<string, boolean>) || {};
                            const isModuleDisabledByPlan = sub.module && planModules[sub.module] === false;
                            const hasSubPerm = !isModuleDisabledByPlan && (isAdminOrOwner || canView(session, sub.module ?? ''));
                            if (!hasSubPerm) return null;

                            const isSubActive = cleanPathname === sub.href;

                            return (
                              <TooltipProvider key={sub.name} delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link
                                      href={sub.href}
                                      className={cn(
                                        "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                                        isSubActive
                                          ? "bg-[#00B074]/15 text-[#00B074] shadow-sm font-bold"
                                          : "text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white"
                                      )}
                                    >
                                      <sub.icon className="w-4 h-4 shrink-0" />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="bg-[#1F2937] text-white border-white/5 font-semibold">
                                    <p>{t(sub.name, { defaultValue: sub.name })}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                if (item.name === "Manage") {
                  return (
                    <div key={item.name} className="space-y-1">
                      {/* Manage Parent Button */}
                      <button
                        onClick={() => setIsManageOpen(!isManageOpen)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer",
                          isActive
                            ? "bg-[#00B074]/10 text-[#00B074] font-bold"
                            : "text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        <div className="flex items-center">
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span className="ms-3 text-sm font-medium whitespace-nowrap">{t('Manage', { defaultValue: 'Manage' })}</span>
                        </div>
                        {isManageOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {/* Indented Dropdown List */}
                      {isManageOpen && (
                        <div className="mt-1 ms-4 ps-3 border-s border-slate-200 dark:border-white/10 space-y-1">
                          {manageSubItems.map((sub: any) => {
                            const planModules = (session?.user?.planModulesAccess as Record<string, boolean>) || {};
                            const isModuleDisabledByPlan = sub.module && planModules[sub.module] === false;
                            const hasSubPerm = !isModuleDisabledByPlan && (isAdminOrOwner || canView(session, sub.module ?? ''));
                            if (!hasSubPerm) return null;

                            const isSubActive = cleanPathname === sub.href;

                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={cn(
                                  "flex items-center px-3 py-2 rounded-lg transition-all duration-200",
                                  isSubActive
                                    ? "bg-[#00B074]/15 text-[#00B074] dark:bg-[#00B074]/20 font-bold"
                                    : "text-slate-500 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white"
                                )}
                              >
                                <sub.icon className={cn(
                                  "w-4 h-4 shrink-0",
                                  isSubActive ? "text-[#00B074]" : "text-slate-400"
                                )} />
                                <span className="ms-3 text-xs font-semibold whitespace-nowrap">{t(sub.name, { defaultValue: sub.name })}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                return <div key={item.name}>{NavItem}</div>
              })}
            </div>
          </div>
        ))}
      </nav>


      {/* Theme Toggle & Logout - Fixed at bottom */}
      <div className="shrink-0 border-t border-slate-200 dark:border-white/10 p-3 space-y-1">
        <ThemeToggle isCollapsed={isCollapsed} />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200",
            "text-slate-600 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white",
            isCollapsed ? "justify-center" : ""
          )}
          title={isCollapsed ? t('logout', { defaultValue: 'Log out' }) : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className={cn(
            "ms-3 text-sm font-medium truncate transition-[opacity,width] duration-150",
            isCollapsed ? "w-0 opacity-0 ms-0 overflow-hidden" : "opacity-100"
          )}>
            {t('logout', { defaultValue: 'Log out' })}
          </span>
        </button>
      </div>

      {/* Bottom Collapse Toggle for Collapsed State */}
      {isCollapsed && (
        <div className="p-4 flex justify-center border-t border-white/10">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </aside>
  )
}
