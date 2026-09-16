"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ShieldCheck, UserCog, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import AdminStaffClient from "@/components/admin/staff/AdminStaffClient"
import UserVendorSettingsForm from "@/components/admin/settings/UserVendorSettingsForm"
import type { AdminStaffUser } from "@/lib/admin/rbac"

interface UserVendorPageClientProps {
  initialStaff: AdminStaffUser[]
  availableVendors?: { id: string; name: string; slug: string; whatsappNumber?: string | null; status: string }[]
}

export default function UserVendorPageClient({
  initialStaff,
  availableVendors = [],
}: UserVendorPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const initialTab = searchParams.get("tab") === "vendor-settings" ? "vendor-settings" : "staff"
  const [activeTab, setActiveTab] = useState<"staff" | "vendor-settings">(initialTab)

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "vendor-settings" || tab === "staff") {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = (tab: "staff" | "vendor-settings") => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "staff") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const queryString = params.toString()
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false })
  }

  return (
    <div className="w-full min-h-screen transition-colors duration-300 relative plus-jakarta-forced space-y-6 pb-12">
      {/* Enterprise SaaS Page Header with Tabs */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 transition-colors shadow-sm">
        <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[#00a884] font-bold uppercase tracking-wider text-[11px]">Configurations</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                User & Vendor Control
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              Admin Staff & Vendor Governance
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20">
                <Sparkles size={12} />
                RBAC v2.0
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-3xl">
              Manage platform sub-admins, configure granular module permissions with vendor scoping, and control global registration rules.
            </p>
          </div>

          {/* Tab Navigation Pill Bar */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink-0 self-start md:self-auto">
            <button
              onClick={() => handleTabChange("staff")}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 outline-none",
                activeTab === "staff"
                  ? "bg-white dark:bg-slate-900 text-[#00a884] shadow-sm border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <ShieldCheck size={16} className={activeTab === "staff" ? "text-[#00a884]" : "text-slate-400"} />
              <span>Admin Staff & Roles</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black",
                  activeTab === "staff"
                    ? "bg-[#00a884]/15 text-[#00a884]"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                )}
              >
                {initialStaff.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange("vendor-settings")}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 outline-none",
                activeTab === "vendor-settings"
                  ? "bg-white dark:bg-slate-900 text-[#00a884] shadow-sm border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <UserCog size={16} className={activeTab === "vendor-settings" ? "text-[#00a884]" : "text-slate-400"} />
              <span>Vendor Registration</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="w-full">
        {activeTab === "staff" ? (
          <div className="w-full">
            <AdminStaffClient initialStaff={initialStaff} availableVendors={availableVendors} hideHeader={true} />
          </div>
        ) : (
          <div className="w-full max-w-[1300px]">
            <UserVendorSettingsForm />
          </div>
        )}
      </div>
    </div>
  )
}
