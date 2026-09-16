"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { MessageSquare, UserPlus, Zap, Clock } from "lucide-react"

const ACTIVITIES = [
 {
 id: "1",
 type: "message",
 title: "New Inbound Message",
 description: "From +44 7700 900077",
 time: "2 mins ago",
 status: "received",
 icon: MessageSquare,
 color: "text-emerald-500 bg-emerald-500/10"
 },
 {
 id: "2",
 type: "contact",
 title: "New Contact Registered",
 description: "Sarah Jenkins joined via WhatsApp",
 time: "15 mins ago",
 status: "success",
 icon: UserPlus,
 color: "text-blue-500 bg-blue-500/10"
 },
 {
 id: "3",
 type: "flow",
 title: "Flow Triggered",
 description: "'Onboarding Flow' executed for 12 users",
 time: "1 hour ago",
 status: "active",
 icon: Zap,
 color: "text-purple-500 bg-purple-500/10"
 }
]

export function RecentActivity({ className }: { className?: string }) {
 return (
 <div className={cn("aesthetic-glass rounded-3xl p-6 h-full flex flex-col", className)}>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 mb-1">Live Feed</h3>
 <h2 className="text-xl font-bold text-white tracking-tight leading-none">Recent Activity</h2>
 </div>
 <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
 </span>
 Live
 </div>
 </div>

 <div className="space-y-4 flex-1">
 {ACTIVITIES.map((activity) => (
 <div key={activity.id} className="group relative flex gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
 <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110",
 activity.type === "message" ? "bg-emerald-500 text-white shadow-emerald-500/20" :
 activity.type === "contact" ? "bg-blue-500 text-white shadow-blue-500/20" :
 "bg-purple-500 text-white shadow-purple-500/20"
 )}>
 <activity.icon className="w-6 h-6" strokeWidth={2} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2 mb-0.5">
 <h4 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
 {activity.title}
 </h4>
 <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 shrink-0 tracking-tighter">
 {activity.time}
 </span>
 </div>
 <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
 {activity.description}
 </p>
 </div>
 </div>
 ))}
 </div>

 <button className="mt-8 w-full py-2.5 text-[10px] font-bold tracking-[0.25em] text-slate-400 hover:text-emerald-600 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-emerald-500/30 transition-all bg-slate-50/50 dark:bg-slate-800/20">
 View All Activity
 </button>
 </div>
 )
}
