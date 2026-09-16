"use client"

import SocialLoginSettings from "@/components/admin/settings/SocialLoginSettings"

export default function SocialLoginPage() {
  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#fafbfc] dark:bg-slate-950 min-h-screen transition-colors duration-300 relative overflow-hidden plus-jakarta-forced">
      
      {/* Header Section Redesigned to be Premium, Clean & Cohesive */}
      <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/80 transition-colors">
        <div className="w-full px-8 py-6">
          <div className="space-y-1">
            <p className="text-[#00a884] font-black uppercase tracking-widest text-[9px]">CONFIGURATIONS</p>
            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              Integrations
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Connect and manage the services your platform uses for login, media, payments, email, backups, and realtime updates.
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-10 w-full px-8 py-8 max-w-[1300px]">
        <SocialLoginSettings />
      </div>

    </div>
  )
}
