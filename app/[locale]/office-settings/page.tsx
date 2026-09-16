"use client"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Clock, Info, Building2, Calendar, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function OfficeSettingsPage() {
 return (
 <DashboardLayoutClient mainClassName="pb-12">
 <div className="flex flex-col gap-10">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="space-y-1">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Business Ops</span>
 </div>
 <h2 className="text-3xl font-bold tracking-tight text-foreground">
 Office Settings
 </h2>
 <p className="text-muted-foreground text-sm font-medium">
 Configure your business availability and operational hours.
 </p>
 </div>
 <Button variant="outline" className="h-10 px-6 rounded-xl border-border/50 text-foreground font-bold text-[10px] uppercase tracking-widest gap-2 bg-card shadow-sm hover:bg-muted/10">
 <Info className="w-4 h-4" />
 Help Center
 </Button>
 </div>

 <div className="max-w-3xl mx-auto w-full">
 <Card className="border-border/50 bg-card shadow-2xl rounded-[40px] overflow-hidden">
 <CardContent className="p-10 md:p-14 space-y-10">
 <div className="flex items-center gap-5">
 <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
 <Building2 className="w-7 h-7 text-emerald-600" />
 </div>
 <div>
 <h3 className="text-xl font-bold tracking-tight">Set General Business Hours</h3>
 <p className="text-xs text-muted-foreground font-medium mt-0.5">Define your working window for automated responses and agent availability.</p>
 </div>
 </div>

 <div className="flex items-center justify-between p-6 bg-emerald-500/3 border border-emerald-500/10 rounded-3xl group transition-all hover:bg-emerald-500/5">
 <div className="space-y-1">
 <p className="text-sm font-bold text-foreground">Business is open</p>
 <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Live Operational Status</p>
 </div>
 <Switch className="data-[state=checked]:bg-emerald-600 shadow-lg shadow-emerald-500/10" />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-3">
 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Open Time Schedule</label>
 <div className="relative group">
 <Input 
 defaultValue="09:00 AM" 
 className="h-14 bg-muted/10 border-border/50 rounded-2xl px-6 text-sm font-bold focus-visible:ring-emerald-500/20 shadow-inner"
 />
 <Clock className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
 </div>
 </div>

 <div className="space-y-3">
 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Close Time Schedule</label>
 <div className="relative group">
 <Input 
 defaultValue="05:00 PM" 
 className="h-14 bg-muted/10 border-border/50 rounded-2xl px-6 text-sm font-bold focus-visible:ring-emerald-500/20 shadow-inner"
 />
 <Clock className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
 </div>
 </div>
 </div>

 <div className="space-y-8 pt-4">
 <div className="p-6 bg-muted/10 rounded-[32px] border border-border/50 flex items-start gap-4">
 <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
 <Info className="w-5 h-5 text-blue-600" />
 </div>
 <div className="space-y-1">
 <p className="text-[11px] font-bold text-foreground leading-relaxed">
 Auto-Responder Behavior
 </p>
 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
 Outside of these hours, the system will automatically trigger &quot;Away Messages&quot; if configured in your automation workflow.
 </p>
 </div>
 </div>

 <Button className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[24px] font-bold uppercase tracking-[0.3em] text-xs shadow-2xl shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]">
 Save Operational Schedule
 </Button>

 <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 italic px-8 leading-loose">
 Unified Schedule Applies to: <span className="text-foreground">Monday thru Sunday</span>
 </p>
 </div>
 </CardContent>
 </Card>

 <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
 <div className="flex items-center gap-4 group cursor-pointer">
 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Calendar className="w-5 h-5 text-emerald-600" />
 </div>
 <div>
 <h4 className="text-xs font-bold uppercase tracking-widest">Holiday Overrides</h4>
 <p className="text-[10px] font-medium text-muted-foreground">Manage exceptions for specific dates.</p>
 </div>
 </div>
 <div className="flex items-center gap-4 group cursor-pointer">
 <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
 <ShieldCheck className="w-5 h-5 text-blue-600" />
 </div>
 <div>
 <h4 className="text-xs font-bold uppercase tracking-widest">Timezone Sync</h4>
 <p className="text-[10px] font-medium text-muted-foreground">Current: Asia/Karachi (UTC+5)</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
