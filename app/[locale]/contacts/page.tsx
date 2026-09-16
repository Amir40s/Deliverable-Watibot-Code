"use client"
import ContactFilters from "@/components/contacts/ContactFilters"
import ContactTable from "@/components/contacts/ContactTable"
import { Plus, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { useSession } from "next-auth/react"
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay"
import { Smartphone } from "lucide-react"

export default function ContactsPage() {
 const { data: session } = useSession();
 return (
 <DashboardLayoutClient mainClassName="pb-16 antialiased relative z-10 min-h-screen">
 {session?.user && !session.user.whatsappConnected && (
 <LockedPageOverlay
 title="Contacts Access Locked"
 description="To manage your contacts and sync them with WhatsApp, you must first link your WhatsApp Business Account. This will allow you to see profile pictures, statuses, and last seen data."
 icon={<Smartphone className="w-10 h-10" />}
 ctaText="Link WhatsApp via Meta"
 />
 )}
 {/* Background Blobs - Mirroring Admin Style */}
 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
 <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none -z-10" />

 {/* Header Section */}
 <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="space-y-2">
 <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Database Management</span>
 </div>
 <h2 className="text-3xl md:text-4xl font-bold text-[#111827] dark:text-white tracking-tight">
 Contacts.
 </h2>
 <p className="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-xl">
 Manage your relationship network with precision and speed.
 </p>
 </div>

 <Button variant="outline" className="h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 text-[#374151] dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest gap-2 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 transition-all">
 <Info className="w-4 h-4 text-emerald-600" />
 Help Center
 </Button>
 </div>

 <div className="flex flex-col lg:flex-row gap-8">
 {/* Left Panel - Control Center */}
 <div className="w-full lg:w-64 shrink-0 space-y-6">
 <div className="space-y-3">
 <Button className="w-full bg-[#10b981] hover:bg-[#059669] text-white h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-all border-b-2 border-emerald-700 active:border-b-0 active:translate-y-0.5">
 <Plus className="w-4 h-4" />
 <span className="uppercase tracking-widest">Add Contact</span>
 </Button>

 <div className="grid grid-cols-1 gap-2.5">
 <Button variant="ghost" className="w-full h-11 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-white justify-start px-5 hover:bg-white/60 transition-all group">
 <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
 <Plus className="w-3.5 h-3.5 text-blue-600" />
 </div>
 <span className="uppercase tracking-widest text-[10px]">Bulk Import</span>
 </Button>
 <Button variant="ghost" className="w-full h-11 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-white justify-start px-5 hover:bg-white/60 transition-all group">
 <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center mr-2 group-hover:scale-110 transition-transform">
 <Plus className="w-3.5 h-3.5 text-purple-600" />
 </div>
 <span className="uppercase tracking-widest text-[10px]">Manage Lists</span>
 </Button>
 </div>
 </div>

 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm flex flex-col">
 <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800">
 <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-0">Activity Log</h3>
 </div>
 <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
 <div className="w-16 h-16 rounded-[24px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 group transition-all">
 <Info className="w-6 h-6 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform" />
 </div>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
 No recent activity<br />history found
 </p>
 </div>
 </div>
 </div>

 {/* Main Content Area */}
 <div className="flex-1 min-w-0 space-y-6">
 <ContactFilters />
 <ContactTable />
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
