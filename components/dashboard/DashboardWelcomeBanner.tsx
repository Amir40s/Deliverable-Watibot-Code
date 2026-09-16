"use client"

import type * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface WelcomeBannerProps {
  userName: string
  whatsappConnected?: boolean
  totalQuota: number
  usedQuota: number
  isLoading?: boolean
}

export function DashboardWelcomeBanner({
  userName,
  whatsappConnected,
  totalQuota,
  usedQuota,
  isLoading,
}: WelcomeBannerProps) {
  if (isLoading) {
    return (
      <Card className="bg-primary-foreground border-white/10 py-6 px-8 relative overflow-hidden min-h-[120px] flex flex-col justify-center animate-pulse">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10 w-full px-4">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="h-8 w-64 bg-white/10 rounded-xl" />
            <div className="h-4 w-32 bg-white/5 rounded-lg" />
          </div>
          <div className="flex items-center gap-8 md:gap-12 bg-white/5 backdrop-blur-md rounded-2xl py-4 px-6 border border-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-3 w-12 bg-white/10 rounded" />
                <div className="h-6 w-16 bg-white/20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-r from-[#133d1c] to-[#08210e] border-none py-6 px-8 shadow-2xl relative overflow-hidden group min-h-[120px] flex flex-col justify-center transition-all hover:shadow-emerald-900/10 rounded-[28px]">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10 w-full px-2">
        {/* Greeting Section */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <h2 className="text-3xl md:text-[34px] font-black tracking-tight text-white leading-tight">
            Welcome Back<br />
            <span className="text-[#98ec65]">
              {userName || "asaankhata"}!
            </span>
          </h2>
        </div>

        {/* Status Metrics */}
        <div className="flex items-center gap-8 md:gap-10 bg-[#0c2612]/80 backdrop-blur-md rounded-2xl py-3.5 px-6 border border-emerald-800/30">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-[10px] font-extrabold tracking-widest text-[#a0c0a5] uppercase">Status</span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#133d1c]/80 rounded-full border border-emerald-500/35">
              <div className="w-1.5 h-1.5 bg-[#00B074] rounded-full animate-pulse" />
              <span className="text-[#00B074] text-[10px] font-black tracking-wider">LIVE</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-[10px] font-extrabold tracking-widest text-[#a0c0a5] uppercase">Quality</span>
            <div className="px-3 py-1 bg-[#133d1c]/80 rounded-full border border-emerald-500/35">
              <span className="text-[#00B074] text-[10px] font-black tracking-wider">HIGH</span>
            </div>
          </div>

          <Link
            href="/dashboard/quota"
            className="flex flex-col items-center gap-1 text-center transition-all hover:scale-105 active:scale-95 group cursor-pointer"
          >
            <span className="text-[10px] font-extrabold tracking-widest text-[#a0c0a5] group-hover:text-[#98ec65] transition-colors uppercase">
              Quota
            </span>
            <span className="text-white text-3xl font-black tracking-tighter leading-none group-hover:text-[#98ec65] transition-colors">
              {totalQuota || 19212}
            </span>
          </Link>
        </div>
      </div>
    </Card>
  )
}
