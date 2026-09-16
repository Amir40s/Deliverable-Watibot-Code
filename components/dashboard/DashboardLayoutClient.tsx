"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import Sidebar from "@/components/dashboard/Sidebar"
import Header from "@/components/dashboard/Header"
import { registerDevice, getDeviceId } from "@/lib/device"
import { requestNotificationPermission } from "@/lib/notifications"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { usePusher } from "@/components/providers/PusherProvider"
import { useLocale } from "next-intl"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { InboundMessageToast } from "@/components/dashboard/InboundMessageToast"
import { Lock, ShieldAlert } from "lucide-react"
import { getPopupNotificationsEnabled } from "@/lib/notifications-toggle"
import { useUserStatus } from "@/hooks/useUserStatus"
import { ExpiredPackageStore } from "@/components/dashboard/ExpiredPackageStore"
import { isPlatformAdminUser, getDefaultAdminRoute } from "@/lib/admin/rbac"
import { canView } from "@/lib/permissionLevels"

const FloatingChatbotButton = dynamic(() => import("@/components/dashboard/FloatingChatbotButton"), { ssr: false })
import { CallModal } from "@/components/live-chat/CallModal"

export default function DashboardLayoutClient({
  children,
  mainClassName = "",
  mainFullBleed = false,
  hideNav = false,
  hideChatbot = true,
}: {
  children: React.ReactNode
  mainClassName?: string
  mainFullBleed?: boolean
  isFullScreen?: boolean
  hideNav?: boolean
  hideChatbot?: boolean
}) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  const { pusher } = usePusher()
  const [deviceNotificationsEnabled, setDeviceNotificationsEnabled] = useState(true);
  const locale = useLocale();
  const dir = ['ar', 'ur', 'hi', 'bn'].includes(locale) ? 'rtl' : 'ltr';
  const notifiedMessageIdsRef = useRef(new Set<string>());
  const lastNotificationAtRef = useRef(0);
  const activeToastIdsRef = useRef<Array<string | number>>([]);

  // Route to Module Mapping for Access Control
  const cleanPathname = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const basePath = cleanPathname.split('?')[0];

  const routeToModuleMap: Record<string, string> = {
    "/dashboard": "dashboard",
    "/live-chat": "chat",
    "/dashboard/contacts": "contacts",
    "/dashboard/audience": "audience",
    "/dashboard/pipeline": "contacts",
    "/templates": "templates",
    "/dashboard/media-library": "media_library",
    "/manage/quick-replies": "quick_replies",
    "/dashboard/welcome-messages": "quick_message",
    "/campaign": "drip_campaign",
    "/dashboard/flows": "flow",
    "/dashboard/knowledge-base": "knowledge_base",
    "/dashboard/business-knowledge": "dashboard",
    "/dashboard/orders": "dashboard",
    "/dashboard/appointments": "dashboard",
    "/catalogs": "dashboard",
    "/manage/ad-manager": "ad_manager",
    "/dashboard/facebook-posts": "facebook_posts",
    "/dashboard/instagram-posts": "instagram_posts",
    "/dashboard/facebook-automation": "facebook_posts",
    "/dashboard/instagram-automation": "instagram_posts",
    "/manage/reports": "reports",
    "/manage/health-audit": "reports",
    "/dashboard/settings": "settings",
    "/dashboard/integrations": "integrations",
    "/dashboard/webhooks": "integrations",
    "/dashboard/quota": "quota",
    "/developer": "developer",
    "/projects": "projects",
    "/manage/agents": "agents",
    "/manage/permissions": "permissions",
    "/manage/tags": "tags",
    "/manage/notifications": "notifications",
    "/manage/activity-log": "reports"
  };

  let activeModule: string | undefined = undefined;
  for (const [route, moduleKey] of Object.entries(routeToModuleMap)) {
    if (basePath === route || (route !== "/" && basePath.startsWith(route + "/"))) {
      activeModule = moduleKey;
      break;
    }
  }

  const planModules = (session?.user?.planModulesAccess as Record<string, boolean>) || {};
  const isBlockedByPlan = sessionStatus === 'authenticated' && activeModule ? planModules[activeModule] === false : false;

  const { userStatus } = useUserStatus();

  const isPlanExpired =
    !!userStatus &&
    (userStatus.planExpiry?.isExpired ||
      userStatus.status === 'EXPIRED' ||
      userStatus.status === 'SUSPENDED' ||
      (userStatus.status === 'TRIAL' && (userStatus.trialDaysRemaining ?? 0) <= 0));

  const isAllowedWhenExpired =
    basePath === "/dashboard" ||
    basePath === "/" ||
    basePath.startsWith("/dashboard/billing");

  const isExpiredBlocked = sessionStatus === 'authenticated' && isPlanExpired && !isAllowedWhenExpired;

  const userRole = (session?.user?.role || "").toUpperCase();
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isAdminOrOwner = userRole === "ADMIN" || isSuperAdmin;
  const isImpersonating = !!(session?.user?.originalAdminId && session.user.originalAdminId !== session.user.id);
  const isPlatformAdmin = isPlatformAdminUser(session?.user) && !isImpersonating;
  const kbManagement = session?.user?.knowledgeBaseManagement || "user";
  const isBlockedByAdminKb = sessionStatus === 'authenticated' && activeModule === 'knowledge_base' && kbManagement === 'admin' && !isSuperAdmin && !isImpersonating;

  const isBlockedByPermission =
    sessionStatus === 'authenticated' &&
    !isAdminOrOwner &&
    activeModule &&
    !canView(session, activeModule);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && isPlatformAdmin) {
      const defaultRoute = getDefaultAdminRoute(session?.user);
      router.replace(`/${locale}${defaultRoute}`);
    }
  }, [sessionStatus, isPlatformAdmin, locale, router, session?.user]);

  useEffect(() => {
    if (isBlockedByAdminKb) {
      toast.error("Access to the Knowledge Base is managed by your administrator.");
      router.replace(`/${locale}/dashboard`);
    }
  }, [isBlockedByAdminKb, locale, router]);

  useEffect(() => {
    if (isExpiredBlocked) {
      toast.error("Your package subscription has expired. Please buy a package to access this tab.", { id: 'expired-redirect' });
      router.replace(`/${locale}/dashboard/billing`);
    }
  }, [isExpiredBlocked, locale, router]);

  const playIncomingAlert = useCallback(() => {
    try {
      const audio = new Audio('/sounds/message-alert.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => { });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleOpenPlan = () => {
      router.push(`/${locale}/dashboard/billing/upgrade`)
    }
    window.addEventListener('open-change-plan', handleOpenPlan)
    return () => window.removeEventListener('open-change-plan', handleOpenPlan)
  }, [locale, router])

  useEffect(() => {
    if (!session?.user?.id) return;

    // Register active device immediately on load
    registerDevice().catch(console.error);

    // Heartbeat every 2 minutes to keep online status fresh in database
    const interval = setInterval(() => {
      registerDevice().catch(console.error);
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [session?.user?.id])

  useEffect(() => {
    const fetchDeviceSettings = async () => {
      const deviceId = getDeviceId();
      try {
        const res = await fetch(`/api/manage/devices?deviceId=${deviceId}`);
        if (res.ok) {
          const device = await res.json();
          if (device) setDeviceNotificationsEnabled(device.notificationsEnabled);
        }
      } catch (error) {
        console.error("Failed to fetch device settings:", error);
      }
    }
    if (session?.user?.id) fetchDeviceSettings();
  }, [session?.user?.id])

  // Hydration-safe: read localStorage only after mount so server and client initial render match
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  // Sync collapsed state to body class
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed')
    } else {
      document.body.classList.remove('sidebar-collapsed')
    }
  }, [isCollapsed])

  // Ask notification permission once on dashboard pages and show welcome notification.
  useEffect(() => {
    if (!pathname?.includes('/dashboard')) return
    if (!('Notification' in window)) return

    const permissionState = Notification.permission

    if (permissionState === 'granted') {
      const hasWelcomed = sessionStorage.getItem('dashboardNotificationWelcomed') === 'true'
      if (!hasWelcomed) {
        try {
          new Notification('Welcome to WatiBot', {
            body: 'Notifications are enabled. You will now receive live message alerts.',
            icon: '/favicon.ico'
          })
        } catch (e) {
          console.error("Failed to show welcome notification:", e);
        }
        sessionStorage.setItem('dashboardNotificationWelcomed', 'true')
      }
      return
    }

    const requestPermissionOnGesture = () => {
      if (Notification.permission === 'default') {
        requestNotificationPermission()
          .then((permission) => {
            if (permission === 'granted') {
              try {
                new Notification('Welcome to WatiBot', {
                  body: 'Notifications are enabled. You will now receive live message alerts.',
                  icon: '/favicon.ico'
                })
              } catch (e) {
                console.error("Failed to show welcome notification on gesture:", e);
              }
              sessionStorage.setItem('dashboardNotificationWelcomed', 'true')
            }
          })
          .catch(() => { })
      }
    }

    if (permissionState === 'default') {
      window.addEventListener('click', requestPermissionOnGesture, { once: true })
    }

    return () => {
      window.removeEventListener('click', requestPermissionOnGesture)
    }
  }, [pathname])

  useEffect(() => {
    if (!pusher || !session?.user?.organizationId) return
    const channelName = `org-${session.user.organizationId}`
    const channel = pusher.subscribe(channelName)

    const onWebhookTriggered = (payload: { title?: string; body?: string }) => {
      // Bypassed: General webhook notifications are disabled to prevent double notification alerts.
    }

    const onMessageInbound = (payload: {
      messageId?: string;
      contactId?: string;
      contactName?: string;
      contactNumber?: string;
      content?: string;
      platform?: string;
      assignedAgentId?: string;
      assigned_agent_id?: string;
      assignedUserIds?: string[];
      assigned_user_ids?: string[];
    }) => {
      if (!deviceNotificationsEnabled) return;
      if (!payload?.messageId) return;

      // Scoping check for Agents: If agent does not have permission to view all chats,
      // they should ONLY receive alerts and events for chats assigned to them.
      const userRole = session?.user?.role?.toUpperCase() || "";
      const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "OWNER";
      const userPerms = (session?.user?.permissions || {}) as Record<string, any>;
      const canViewAllChats = isAdmin ||
        userPerms.chat_super === true ||
        userPerms.view_all_chats === 'full' ||
        userPerms.view_all_chats === 'view';

      if (!canViewAllChats && session?.user?.id) {
        const assignedAgentId = payload.assignedAgentId || payload.assigned_agent_id;
        const assignedUserIds = payload.assignedUserIds || payload.assigned_user_ids || [];
        const isAssignedToMe = (assignedAgentId && assignedAgentId === session.user.id) ||
          (Array.isArray(assignedUserIds) && assignedUserIds.includes(session.user.id));
        if (!isAssignedToMe) {
          return;
        }
      }

      // Deduplicate notifications
      if (notifiedMessageIdsRef.current.has(payload.messageId)) return;
      notifiedMessageIdsRef.current.add(payload.messageId);
      if (notifiedMessageIdsRef.current.size > 500) {
        const allIds = Array.from(notifiedMessageIdsRef.current);
        notifiedMessageIdsRef.current = new Set(allIds.slice(allIds.length - 250));
      }

      // Dispatch custom event ALWAYS so pages (like live-chat) update unread counts and chat list in real time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('message:inbound', { detail: payload }));
      }

      // Check Notification Popup Toggle preference (ON / OFF)
      const isPopupsEnabled = getPopupNotificationsEnabled();
      if (!isPopupsEnabled) {
        // Popups OFF: skip sound alert and popup card rendering entirely
        return;
      }

      const now = Date.now();
      if (now - lastNotificationAtRef.current >= 1200) {
        lastNotificationAtRef.current = now;
        playIncomingAlert();
      }

      const isWhatsapp = !payload.platform || payload.platform === 'WHATSAPP';
      const isInstagram = payload.platform === 'INSTAGRAM';
      const isFacebook = payload.platform === 'FACEBOOK';
      const isTiktok = payload.platform === 'TIKTOK';

      const platformLabel = isWhatsapp
        ? 'WhatsApp'
        : isInstagram
          ? 'Instagram'
          : isFacebook
            ? 'Facebook'
            : isTiktok
              ? 'TikTok'
              : 'WatiBot';

      const rawNumber = payload.contactNumber || payload.contactId || '';
      const isPhone = /^\+?[0-9]{7,15}$/.test(rawNumber);
      const displayId = isPhone
        ? (rawNumber.startsWith('+') ? rawNumber : `+${rawNumber}`)
        : '';

      const hasName = !!(
        payload.contactName &&
        payload.contactName.trim() !== '' &&
        payload.contactName !== rawNumber &&
        payload.contactName !== payload.contactId
      );
      const senderName = (hasName && payload.contactName) ? payload.contactName : 'New Contact';

      let title = '';
      let body = '';

      if (isWhatsapp) {
        if (displayId) {
          title = hasName ? senderName : displayId;
          body = hasName ? `${displayId}: ${payload.content || 'Sent a message'}` : (payload.content || 'New WhatsApp message');
        } else {
          title = senderName;
          body = payload.content || 'New WhatsApp message';
        }
      } else {
        title = hasName ? `${senderName} (${platformLabel})` : `${platformLabel} Message`;
        body = payload.content || 'New message';
      }

      // Performance Optimization: Prevent unlimited popup stacking (Limit visible popups to max 3)
      if (activeToastIdsRef.current.length >= 3) {
        const oldestId = activeToastIdsRef.current.shift();
        if (oldestId !== undefined) {
          toast.dismiss(oldestId);
        }
      }

      const toastId = toast.custom((t) => (
        <InboundMessageToast toastId={t} payload={payload} />
      ), {
        duration: 4500,
        onDismiss: () => {
          activeToastIdsRef.current = activeToastIdsRef.current.filter(id => id !== toastId);
        },
        onAutoClose: () => {
          activeToastIdsRef.current = activeToastIdsRef.current.filter(id => id !== toastId);
        },
        className: 'w-full !p-0 !bg-transparent !border-0 !shadow-none',
      });
      activeToastIdsRef.current.push(toastId);

      // 2. Show native browser notification (in background)
      if ('Notification' in window) {
        const permissionState = Notification.permission;
        if (permissionState === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: '/favicon.ico',
              silent: false,
              tag: 'inbound-msg',
              requireInteraction: false
            });
          } catch (e) {
            console.error("Failed to show native notification:", e);
          }
        } else if (permissionState === 'default') {
          requestNotificationPermission()
            .then((permission) => {
              if (permission === 'granted') {
                try {
                  new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    silent: false,
                    tag: 'inbound-msg',
                    requireInteraction: false
                  });
                } catch (e) {
                  console.error("Failed to show native notification:", e);
                }
              } else {
                toast.warning(`Native notification blocked: user chose "${permission}"`);
              }
            })
            .catch((err: any) => {
              toast.error("Failed to request permission: " + (err?.message || String(err)));
            });
        } else {
          toast.warning(`Native notification skipped: Browser permission is "${permissionState}". Please change it to "Allow" in your address bar.`);
        }
      } else {
        toast.error("Native notifications are not supported in this browser context (must be a secure HTTPS/localhost environment).");
      }
    };

    const onContactRead = (payload: { contactId: string }) => {
      // Dispatch custom event so pages (like live-chat) can respond immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('contact:read', { detail: payload }));
      }
    };

    const onMessageDelete = (payload: { messageId: string; contactId: string; newLatestMessage: any }) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('message:delete', { detail: payload }));
      }
    };

    const onAssignmentUpdated = (payload: any) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chat-assignment-updated', { detail: payload }));
      }
    };

    channel.bind('webhook:triggered', onWebhookTriggered)
    channel.bind('message:inbound', onMessageInbound)
    channel.bind('contact:read', onContactRead)
    channel.bind('message:delete', onMessageDelete)
    channel.bind('chat-assignment-updated', onAssignmentUpdated)
    return () => {
      channel.unbind('webhook:triggered', onWebhookTriggered)
      channel.unbind('message:inbound', onMessageInbound)
      channel.unbind('contact:read', onContactRead)
      channel.unbind('message:delete', onMessageDelete)
      channel.unbind('chat-assignment-updated', onAssignmentUpdated)
      pusher.unsubscribe(channelName)
    }
  }, [pusher, session?.user?.organizationId, deviceNotificationsEnabled, playIncomingAlert])

  const toggleSidebar = () => {
    // On mobile, the collapse button should close the sidebar completely
    if (window.innerWidth < 768) {
      document.body.classList.remove('sidebar-open')
      return
    }

    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))

    if (newState) {
      document.body.classList.add('sidebar-collapsed')
    } else {
      document.body.classList.remove('sidebar-collapsed')
    }
  }

  return (
    <div dir={dir} className="h-dvh bg-background dark:bg-[#0B0F1A] transition-colors duration-300 relative overflow-hidden text-slate-900 dark:text-slate-100 plus-jakarta-forced">
      {!hideNav && <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />}

      <div
        className={cn(
          "flex flex-col h-full transition-all duration-300 ease-in-out",
          "ms-0",
          !hideNav && (isCollapsed ? "md:ps-20" : "md:ps-64"),
          "max-md:ms-0" // Reset margin on mobile
        )}
      >
        {!hideNav && <Header />}
        <main className={cn(
          "flex-1 relative z-10 min-h-0 overflow-y-auto w-full",
          mainFullBleed ? "p-0" : "px-6 py-4",
          mainClassName
        )}>
          {isExpiredBlocked ? (
            <ExpiredPackageStore />
          ) : isBlockedByPlan ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
              <div className="p-4 bg-red-500/10 text-red-500 rounded-full mb-4 animate-bounce">
                <Lock className="w-12 h-12" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                Feature Locked
              </h1>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 text-sm">
                This feature is not available in your organization's current subscription tier. Upgrade your plan to get immediate access to this module.
              </p>
              <button
                onClick={() => router.push(`/${locale}/dashboard/billing/upgrade`)}
                className="px-6 py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                Upgrade Plan
              </button>
            </div>
          ) : isBlockedByPermission ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
              <div className="p-4 bg-amber-500/10 text-amber-500 rounded-full mb-4">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                Access Restricted
              </h1>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 text-sm">
                You do not have permission to access this module. Please contact your workspace administrator to request access.
              </p>
              <button
                onClick={() => router.push(`/${locale}/dashboard`)}
                className="px-6 py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {!hideChatbot && <FloatingChatbotButton />}
      <CallModal organizationId={session?.user?.organizationId} />
    </div>
  )
}
