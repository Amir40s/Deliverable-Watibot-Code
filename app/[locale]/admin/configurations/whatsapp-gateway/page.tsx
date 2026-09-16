"use client"

import WhatsAppGatewayForm from "@/components/admin/settings/WhatsAppGatewayForm"

export default function WhatsAppGatewayPage() {
  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#fafbfc] dark:bg-slate-950 min-h-screen transition-colors duration-300 relative overflow-hidden plus-jakarta-forced">
      
      {/* Decorative Mesh Glow Circles */}
      <div className="absolute top-20 left-10 w-96 h-96 rounded-full bg-[#00a884]/10 dark:bg-[#00a884]/[0.02] blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[450px] h-[450px] rounded-full bg-blue-500/10 dark:bg-blue-500/[0.02] blur-[120px] pointer-events-none" />

      {/* Header Section Redesigned to be Premium, Clean & Cohesive */}
      <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/80 transition-colors">
        <div className="w-full px-8 h-20 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[#00a884] font-black uppercase tracking-widest text-[9px]">CONFIGURATIONS</p>
            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              WhatsApp Gateway Configuration
            </h1>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-10 w-full px-8 py-8 max-w-[1300px]">
        <WhatsAppGatewayForm />
      </div>

    </div>
  )
}
