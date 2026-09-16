"use client"

import React from "react"
import { Lock, Smartphone, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface LockedPageOverlayProps {
 title?: string
 description?: string
 icon?: React.ReactNode
 ctaText?: string
 ctaLink?: string
 className?: string
 children?: React.ReactNode
}

export function LockedPageOverlay({
 title = "Connection Required",
 description = "To access this feature, you must first connect your account in the settings. This will enable real-time messaging and automations.",
 icon = <Smartphone className="w-8 h-8" />,
 ctaText = "Connect Now",
 ctaLink = "/dashboard/settings",
 className,
 children
}: LockedPageOverlayProps) {
 return (
 <div className={cn(
 "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all duration-500 animate-in fade-in",
 className
 )}>
 {/* Ambient Background Glow */}
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00B074]/10 rounded-full blur-[120px] pointer-events-none" />

 <div className="w-full max-w-[440px] bg-white/90 dark:bg-slate-900/90 rounded-[32px] border border-white/20 dark:border-slate-800/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] p-10 text-center relative overflow-hidden backdrop-blur-xl">
 
 {/* Subtle Inner Border Gradient */}
 <div className="absolute inset-0 rounded-[32px] p-[1px] bg-gradient-to-b from-white/50 to-transparent dark:from-slate-700/50 dark:to-transparent pointer-events-none" />

 <div className="relative z-10 flex flex-col items-center gap-8">
 {/* Icon Container with Glow */}
 <div className="relative group">
 <div className="absolute inset-0 bg-[#00B074]/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500" />
 <div className="relative w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 transition-transform duration-500 group-hover:scale-105">
 <div className="text-[#00B074] dark:text-emerald-400">
 {React.cloneElement(icon as React.ReactElement<any>, { className: "w-10 h-10" })}
 </div>
 </div>
 
 
 </div>

 <div className="space-y-3">
 
 <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
 {title}
 </h2>
 <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-[320px] mx-auto font-medium">
 {description}
 </p>
 </div>

 <div className="w-full mt-2">
 {children ? (
 children
 ) : (
 <Link href={ctaLink} className="w-full">
 <Button className="w-full h-14 bg-[#00B074] hover:bg-[#064a42] text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-[#00B074]/20 hover:shadow-[#00B074]/40 flex items-center justify-center gap-3 group overflow-hidden relative">
 <span className="relative z-10">{ctaText}</span>
 <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
 
 {/* Button Shine Effect */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />
 </Button>
 </Link>
 )} 
 <p className="mt-4 text-[11px] text-slate-400 font-medium">
 Need help? <Link href="/support" className="text-[#00B074] hover:underline">Contact our team</Link>
 </p>
 </div>
 </div>
 </div>

 <style jsx global>{`
 @keyframes bounce-subtle {
 0%, 100% { transform: translateY(0); }
 50% { transform: translateY(-4px); }
 }
 .animate-bounce-subtle {
 animation: bounce-subtle 3s infinite ease-in-out;
 }
 @keyframes shine {
 from { transform: translateX(-100%); }
 to { transform: translateX(100%); }
 }
 .animate-shine {
 animation: shine 1.5s infinite;
 }
`}</style>
 </div>
 )
}
