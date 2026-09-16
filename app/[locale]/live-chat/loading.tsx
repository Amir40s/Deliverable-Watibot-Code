"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"

export default function LiveChatLoading() {
 return (
 <DashboardLayoutClient mainFullBleed={true}>
 <div className="flex h-[calc(100dvh-64px)] overflow-hidden bg-white dark:bg-[#0B0F1A]">
 {/* Sidebar Skeleton */}
 <div className="w-[320px] border-r border-border flex flex-col h-full">
 <div className="p-4 space-y-4">
 <Skeleton className="h-10 w-full rounded-xl" />
 <div className="flex gap-2">
 <Skeleton className="h-8 w-16" />
 <Skeleton className="h-8 w-16" />
 <Skeleton className="h-8 w-16" />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-4 space-y-6">
 {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
 <div key={i} className="flex gap-3">
 <Skeleton className="h-12 w-12 rounded-full shrink-0" />
 <div className="flex-1 space-y-2 py-1">
 <div className="flex justify-between">
 <Skeleton className="h-3 w-24" />
 <Skeleton className="h-2 w-8" />
 </div>
 <Skeleton className="h-2 w-full" />
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Main Chat Area Skeleton */}
 <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-950/50">
 <div className="h-16 border-b border-border bg-white dark:bg-slate-900 px-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Skeleton className="h-10 w-10 rounded-full" />
 <div className="space-y-1">
 <Skeleton className="h-3 w-32" />
 <Skeleton className="h-2 w-16" />
 </div>
 </div>
 <div className="flex gap-2">
 <Skeleton className="h-8 w-8 rounded-lg" />
 <Skeleton className="h-8 w-8 rounded-lg" />
 </div>
 </div>

 <div className="flex-1 p-6 space-y-8">
 <div className="flex flex-col gap-6">
 <div className="flex justify-start">
 <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-none" />
 </div>
 <div className="flex justify-end">
 <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-none bg-emerald-500/10" />
 </div>
 <div className="flex justify-start">
 <Skeleton className="h-10 w-32 rounded-2xl rounded-tl-none" />
 </div>
 <div className="flex justify-end">
 <Skeleton className="h-24 w-80 rounded-2xl rounded-tr-none bg-emerald-500/10" />
 </div>
 </div>
 </div>

 <div className="h-20 bg-white dark:bg-slate-900 border-t border-border p-4 flex gap-4 items-center">
 <Skeleton className="h-10 w-10 rounded-full" />
 <Skeleton className="h-10 flex-1 rounded-xl" />
 <Skeleton className="h-10 w-10 rounded-full" />
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
