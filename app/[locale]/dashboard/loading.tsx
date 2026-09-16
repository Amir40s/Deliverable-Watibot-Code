"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"

export default function DashboardLoading() {
 return (
 <DashboardLayoutClient mainClassName="bg-[#F0F2F5] dark:bg-slate-950 min-h-screen">
 <div className="flex flex-col lg:flex-row gap-6 pb-20 items-start">
 {/* Main Content Column (Left) */}
 <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
 
 {/* Status Header Skeleton */}
 <div className="bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-2xl p-4 h-32 flex items-center justify-between gap-6">
 <div className="space-y-3">
 <Skeleton className="h-3 w-24 bg-slate-100 dark:bg-slate-800" />
 <Skeleton className="h-10 w-64 bg-slate-100 dark:bg-slate-800" />
 <Skeleton className="h-2 w-32 bg-slate-100 dark:bg-slate-800" />
 </div>
 <div className="flex gap-10 pr-4">
 <div className="flex flex-col items-center gap-2">
 <Skeleton className="h-2 w-10" />
 <Skeleton className="h-6 w-12 rounded-full" />
 </div>
 <div className="flex flex-col items-center gap-2">
 <Skeleton className="h-2 w-10" />
 <Skeleton className="h-6 w-12 rounded-full" />
 </div>
 </div>
 </div>

 {/* Metrics Grid Skeleton */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {[1, 2, 3, 4, 5, 6].map((i) => (
 <div key={i} className="bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-2xl p-4 h-40 space-y-4">
 <div className="flex justify-between items-start">
 <div className="space-y-2">
 <Skeleton className="h-2 w-16" />
 <Skeleton className="h-4 w-24" />
 </div>
 <Skeleton className="h-8 w-8 rounded-xl" />
 </div>
 <Skeleton className="h-8 w-20" />
 <Skeleton className="h-14 w-full" />
 </div>
 ))}
 </div>
 </div>

 {/* Sidebar Column (Right) */}
 <div className="w-full lg:w-[300px] flex flex-col gap-6 shrink-0 pt-0">
 {/* Profile Card Skeleton */}
 <div className="bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-2xl p-5 h-32 flex items-center justify-between">
 <div className="space-y-3">
 <Skeleton className="h-4 w-24" />
 <Skeleton className="h-8 w-32" />
 </div>
 <Skeleton className="h-16 w-16 rounded-full" />
 </div>

 {/* Plan Cards Skeleton */}
 <div className="flex flex-col gap-4">
 {[1, 2, 3].map(i => (
 <div key={i} className="bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-2xl p-4 h-40 space-y-4">
 <div className="flex justify-between">
 <div className="space-y-2">
 <Skeleton className="h-2 w-12" />
 <Skeleton className="h-4 w-20" />
 </div>
 <Skeleton className="h-8 w-8 rounded-full" />
 </div>
 <Skeleton className="h-6 w-24" />
 <Skeleton className="h-10 w-full rounded-xl" />
 </div>
 ))}
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
