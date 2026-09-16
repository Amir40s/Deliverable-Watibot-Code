"use client"

import { useState } from "react"
import Image from "next/image"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Copy, Link as LinkIcon, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const slides = [
 "/assets/Screenshot_2026-04-15_at_1.06.59_PM-b4a68353-9d5e-4a6c-be3f-6729f3dfce71.png",
 "/assets/Screenshot_2026-04-15_at_1.06.27_PM-0a21cfbd-8628-40e4-abc9-4e1e2397eecd.png",
 "/assets/Screenshot_2026-04-15_at_1.06.35_PM-c9fdda69-10a4-4270-8a6d-3b06808df17e.png",
 "/assets/Screenshot_2026-04-15_at_1.07.07_PM-6432e2cd-7d01-4d35-8d1f-e5eca1047c86.png",
 "/assets/Screenshot_2026-04-15_at_1.07.13_PM-62517e31-6d26-4915-840c-5ac864d17707.png",
 "/assets/Screenshot_2026-04-15_at_1.07.19_PM-380c1669-4fa7-44fd-ace2-8fc25a41d1b1.png",
]

const GoogleSheetsLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="none">
 <path d="M15.5 2H6.5C5.11929 2 4 3.11929 4 4.5V19.5C4 20.8807 5.11929 22 6.5 22H17.5C18.8807 22 20 20.8807 20 19.5V6.5L15.5 2Z" fill="#0F9D58"/>
 <path d="M15.5 2V6.5H20L15.5 2Z" fill="#0A7E46"/>
 <path d="M7 11.5H17V17.5H7V11.5Z" fill="#FFFFFF"/>
 <path d="M7 11.5H10.5V17.5H7V11.5Z" fill="#E0E0E0"/>
 <path d="M7 14.5H17" stroke="#0F9D58" strokeWidth="1" strokeLinecap="square"/>
 <path d="M10.5 11.5V17.5" stroke="#0F9D58" strokeWidth="1" strokeLinecap="square"/>
 </svg>
)

export default function GoogleSheetsIntegrationPage() {
 const [currentSlide, setCurrentSlide] = useState(0)
 const [activeTab, setActiveTab] = useState<"description" | "get-started">("description")

 const prev = () => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)
 const next = () => setCurrentSlide((p) => (p + 1) % slides.length)

 return (
 <DashboardLayoutClient mainClassName="p-0 bg-white dark:bg-slate-950 antialiased h-[calc(100vh-64px)] overflow-hidden transition-colors duration-300">
 <div className="h-full overflow-y-auto p-8">
 <div className="max-w-[1200px] mx-auto space-y-8 ">
 {/* Header Section */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="space-y-1">
 <div className="flex items-center gap-3">
 <GoogleSheetsLogo className="w-8 h-8" />
 <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
 Google Sheets Integration
 </h2>
 <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 tracking-widest text-[10px] px-2 py-0.5 ml-2 rounded-md">
 FREE
 </Badge>
 </div>
 <p className="text-slate-500 dark:text-slate-400 font-medium">
 Sync contacts from Google Sheets to WatiBot automatically, without uploading CSVs.
 </p>
 </div>
 
 {/* Action buttons could go here */}
 </div>

 {/* Main Content Area */}
 <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-sm space-y-8">
 
 {/* Tabs */}
 <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-gray-100 dark:border-slate-800 self-start w-fit">
 <button
 type="button"
 className={cn(
 "px-6 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all",
 activeTab === "description"
 ? "bg-white dark:bg-slate-900 text-[#00B074] dark:text-emerald-400 shadow-sm"
 : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
 )}
 onClick={() => setActiveTab("description")}
 >
 Description
 </button>
 <button
 type="button"
 className={cn(
 "px-6 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all",
 activeTab === "get-started"
 ? "bg-white dark:bg-slate-900 text-[#00B074] dark:text-emerald-400 shadow-sm"
 : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
 )}
 onClick={() => setActiveTab("get-started")}
 >
 Get Started
 </button>
 </div>

 {/* Tab Content */}
 <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
 {activeTab === "description" && (
 <div className="space-y-6">
 <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 max-w-4xl p-6">
 <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-md">
 {/* Fallback pattern in case image path breaks */}
 <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-950">
 <Image
 src={slides[currentSlide]}
 alt={`Google Sheets integration slide ${currentSlide + 1}`}
 fill
 className="object-contain z-10"
 unoptimized
 />
 </div>
 </div>
 
 <Button
 type="button"
 variant="outline"
 size="icon"
 className="absolute left-10 top-1/2 z-20 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 shadow-lg border-0 h-10 w-10 rounded-full"
 onClick={prev}
 >
 <ChevronLeft className="h-5 w-5" />
 </Button>
 <Button
 type="button"
 variant="outline"
 size="icon"
 className="absolute right-10 top-1/2 z-20 -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 shadow-lg border-0 h-10 w-10 rounded-full"
 onClick={next}
 >
 <ChevronRight className="h-5 w-5" />
 </Button>
 </div>
 </div>
 )}

 {activeTab === "get-started" && (
 <div className="max-w-4xl">
 <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shadow-sm overflow-hidden text-slate-900 dark:text-white">
 {/* Card Body */}
 <div className="p-8">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
 <div className="relative flex items-center justify-center">
 <LinkIcon className="h-6 w-6 -rotate-45" />
 <div className="absolute -bottom-1.5 -right-1.5 bg-slate-50 dark:bg-slate-800 rounded-full">
 <CheckCircle2 className="h-4 w-4" />
 </div>
 </div>
 </div>
 <div>
 <h3 className="text-lg font-bold tracking-tight">API Key Configuration</h3>
 <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
 Connect your Google Sheet securely using this API key.
 </p>
 </div>
 </div>

 <div className="pl-[60px]">
 <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
 <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
 <h4 className="text-xs font-bold text-slate-400 tracking-widest">Secret Key</h4>
 </div>
 
 <div className="p-5 flex flex-col md:flex-row items-center gap-4">
 <div className="relative flex-1 w-full">
 <Input 
 type="text" 
 disabled 
 defaultValue="********************************" 
 className="bg-slate-50 dark:bg-slate-950 font-mono text-slate-600 dark:text-slate-400 border-none pr-12 h-12 rounded-lg w-full" 
 />
 <Button
 variant="ghost" 
 size="icon"
 className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00B074] dark:hover:text-emerald-400 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 w-8 h-8 rounded-md"
 title="Copy to clipboard"
 >
 <Copy className="h-4 w-4" />
 </Button>
 </div>
 <Button className="w-full md:w-auto bg-[#00B074] hover:bg-[#009662] text-white font-bold h-12 px-8 rounded-xl text-xs tracking-widest shadow-lg shadow-[#00B074]/20 transition-all shrink-0">
 Regenerate Key
 </Button>
 </div>
 </div>
 <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
 Warning: Once generated, the API key cannot be viewed again for security reasons.
 </p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
