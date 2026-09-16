"use client"

import { Check, ChevronDown, Globe2, Loader2, LogOut, Monitor, Moon, Sun, Menu } from "lucide-react"
import { useTheme } from "next-themes"
import { useSession, signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AdminLanguage = {
  id: string
  name: string
  flag: string | null
  native: string
}

const languages: AdminLanguage[] = [
  {
    id: "en",
    name: "English",
    flag: "https://flagcdn.com/w40/us.png",
    native: "EN",
  },
  {
    id: "ur",
    name: "Urdu",
    flag: "https://flagcdn.com/w40/pk.png",
    native: "اردو",
  },
  {
    id: "hi",
    name: "Hindi",
    flag: "https://flagcdn.com/w40/in.png",
    native: "हिंदी",
  },
  {
    id: "ar",
    name: "Arabic",
    flag: "https://flagcdn.com/w40/sa.png",
    native: "العربية",
  },
  {
    id: "bn",
    name: "Bangla",
    flag: "https://flagcdn.com/w40/bd.png",
    native: "বাংলা",
  },
]

const localizedAdminPathPattern = /^\/(en|ur|hi|ar|bn)(?=\/|$)/

function getCurrentLocale(pathname: string) {
  const segment = pathname.split("/")[1]
  return languages.some((language) => language.id === segment) ? segment : "en"
}

export default function AdminHeader() {
 const { setTheme, theme, resolvedTheme } = useTheme()
 const { data: session } = useSession()
 const pathname = usePathname()
 const router = useRouter()
 const currentLocale = getCurrentLocale(pathname)

 const [mounted, setMounted] = useState(false)
 const [isReturning, setIsReturning] = useState(false)
 const [selectedLang, setSelectedLang] = useState<AdminLanguage>(
    languages.find((language) => language.id === currentLocale) || languages[0]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setSelectedLang(languages.find((language) => language.id === currentLocale) || languages[0])
  }, [currentLocale])

  const activeTheme = resolvedTheme || theme
  const isDarkTheme = activeTheme === "dark"

  const normalizedPathname = pathname.replace(localizedAdminPathPattern, "")

  const getPageTitle = () => {
    if (normalizedPathname === "/admin/dashboard") return "Dashboard";
    if (normalizedPathname.startsWith("/admin/vendors")) return "Vendors";
    if (normalizedPathname.startsWith("/admin/booked-calls")) return "Booked Calls";
    if (normalizedPathname.startsWith("/admin/backup")) return "Backup & Restore";
    if (normalizedPathname.startsWith("/admin/subscriptions/auto")) return "Auto Subscriptions";
    if (normalizedPathname.startsWith("/admin/subscriptions/manual")) return "Manual Subscriptions";
    if (normalizedPathname.startsWith("/admin/configurations/general")) return "General Configurations";
    if (normalizedPathname.startsWith("/admin/configurations/users")) return "User & Vendor Configs";
    if (normalizedPathname.startsWith("/admin/configurations/plans")) return "Subscription Plans";
    if (normalizedPathname.startsWith("/admin/configurations/social")) return "Social Login Configs";
    if (normalizedPathname.startsWith("/admin/configurations/tutorial-videos")) return "Tutorial Videos";
    if (normalizedPathname.startsWith("/admin/configurations/whatsapp-gateway")) return "WhatsApp Gateway";
    if (normalizedPathname.startsWith("/admin/profile")) return "Profile Settings";
    return "Admin Panel";
  };

  const switchLanguage = (language: AdminLanguage) => {
    setSelectedLang(language)

    const segments = pathname.split("/")
    if (languages.some((item) => item.id === segments[1])) {
      segments[1] = language.id
    } else {
      segments.splice(1, 0, language.id)
    }

    router.push(segments.join("/") || `/${language.id}`)
  }

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

  return (
    <header className="h-12 bg-white dark:bg-[#0B0E14] flex items-center justify-between px-3 sm:px-6 transition-all duration-300 z-40 sticky top-0 border-b border-[#E5E7EB] dark:border-white/5 font-[family-name:var(--dashboard-font)]">
      
      {/* Left - Title */}
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
          className="md:hidden p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center"
          aria-label="Toggle Sidebar Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <h1 className="text-xs font-bold text-slate-800 dark:text-white tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right - Actions & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        
        {session?.user?.originalAdminId && session.user.id !== session.user.originalAdminId && (
          <Button
            onClick={handleReturnToAdmin}
            disabled={isReturning}
            className="h-8.5 px-2.5 sm:px-3.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black tracking-wide rounded-xl shadow-md flex items-center gap-1.5 active:scale-[0.98] border-none shrink-0"
          >
            {isReturning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5 -rotate-180" />
            )}
            <span className="hidden sm:inline">Return to Admin</span>
          </Button>
        )}

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-slate-800 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none outline-none"
              aria-label="Change language"
            >
              {selectedLang.flag ? (
                <img
                  src={selectedLang.flag}
                  alt={selectedLang.name}
                  className="w-4.5 h-3 object-cover rounded-sm flex-shrink-0"
                />
              ) : (
                <span className="text-[10px] text-slate-800 dark:text-slate-200 font-extrabold pr-0.5">{selectedLang.native}</span>
              )}
              <span className="hidden sm:inline">{selectedLang.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-2xl shadow-xl mt-2 p-1 border-slate-100 dark:border-slate-800">
            {languages.map((language) => (
              <DropdownMenuItem
                key={language.id}
                onClick={() => switchLanguage(language)}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-bold cursor-pointer",
                  language.id === currentLocale
                    ? "bg-[#00a884]/10 text-[#00a884]"
                    : "text-slate-600 dark:text-slate-300"
                )}
              >
                <span className="w-5 flex items-center justify-center">
                  {language.flag ? (
                    <img src={language.flag} alt={language.name} className="w-4.5 h-3 rounded-sm object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold">{language.native}</span>
                  )}
                </span>
                <span>{language.name}</span>
                {language.id === currentLocale && <Check className="ml-auto w-3.5 h-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
          className="p-2 rounded-full text-[#6B7280] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95 outline-none"
          title={mounted && isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={mounted && isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
        >
          {!mounted ? (
            <Moon className="w-5 h-5 opacity-0" />
          ) : isDarkTheme ? (
            <Sun className="w-5 h-5 text-yellow-400" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

        {/* Profile Avatar & Details */}
        <div className="flex items-center gap-2.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800/80 active:scale-[0.98] transition-all outline-none text-start cursor-pointer">
          <div className="w-8.5 h-8.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#f1f5f9] dark:bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {session?.user?.name?.charAt(0) || "A"}
                </span>
              </div>
            )}
            <div className="absolute bottom-0 end-0 w-2.5 h-2.5 bg-[#00a884] rounded-full border-2 border-white dark:border-[#0B0E14]" />
          </div>
          <div className="hidden sm:flex flex-col text-start justify-center leading-none">
             <span className="text-[11px] font-black text-slate-800 dark:text-gray-200 tracking-tight">
               {session?.user?.name || "Admin"}
             </span>
             <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500 mt-0.5 tracking-wider uppercase">
               {session?.user?.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : session?.user?.role || 'ADMIN'}
             </span>
          </div>
        </div>

      </div>
    </header>
  )
}
