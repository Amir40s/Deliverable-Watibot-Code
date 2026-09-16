"use client"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Button } from "@/components/ui/button"
import { BarChart3, Info, TrendingUp, ShieldAlert, Users, MessageSquare, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function MessagingLimitsPage() {
 return (
 <DashboardLayoutClient mainClassName="pb-16">
 <div className="flex flex-col gap-12">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
 <div className="space-y-1.5">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
 <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Quota Management</span>
 </div>
 <h2 className="text-4xl font-bold tracking-tight text-foreground">
 Messaging Limits
 </h2>
 <p className="text-muted-foreground text-sm font-medium max-w-2xl">
 Monitor and distribute your conversation quota across admin and support teams.
 </p>
 </div>
 <Button variant="outline" className="h-11 px-6 rounded-xl border-border/50 text-foreground font-bold text-[11px] uppercase tracking-widest gap-2 bg-card shadow-sm hover:bg-muted/10">
 <Info className="w-4 h-4" />
 Usage Policy
 </Button>
 </div>

 {/* Main Alert State */}
 <div className="p-10 bg-muted/10 border-2 border-dashed border-border/50 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4">
 <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center">
 <ShieldAlert className="w-8 h-8 text-amber-600" />
 </div>
 <div className="space-y-1">
 <h3 className="text-xl font-bold tracking-tight">Active Plan Required</h3>
 <p className="text-sm text-muted-foreground font-medium">You don&apos;t have an active messaging package assigned to this workspace.</p>
 </div>
 <Button className="h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 rounded-xl font-bold text-[11px] uppercase tracking-widest gap-2 transition-all">
 <Plus className="w-4 h-4" />
 View Available Plans
 </Button>
 </div>

 {/* Metrics Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 {[
 { label: "Total Capacity", value: "0", icon: BarChart3, color: "emerald", desc: "Global account limit" },
 { label: "Unassigned", value: "0", icon: Users, color: "blue", desc: "Available for distribution" },
 { label: "Remaining", value: "0", icon: MessageSquare, color: "purple", desc: "Net balance available" },
 ].map((metric, i) => (
 <Card key={i} className="border-border/50 bg-card shadow-sm rounded-[32px] overflow-hidden group hover:border-emerald-500/30 transition-all">
 <CardContent className="p-8 space-y-6">
 <div className={cn(
 "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
 metric.color === "emerald" ? "bg-emerald-500/10 text-emerald-600" :
 metric.color === "blue" ? "bg-blue-500/10 text-blue-600" :
 "bg-purple-500/10 text-purple-600"
 )}>
 <metric.icon className="w-6 h-6" />
 </div>
 <div className="space-y-1">
 <p className="text-4xl font-bold tracking-tighter">{metric.value}</p>
 <div className="space-y-0.5">
 <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{metric.label}</h4>
 <p className="text-[10px] text-muted-foreground font-medium">{metric.desc}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
 {/* Admin Allocation */}
 <Card className="border-border/50 bg-card shadow-sm rounded-[40px] overflow-hidden">
 <div className="p-10 border-b border-border/50 bg-muted/20">
 <h3 className="text-xl font-bold tracking-tight">Admin Distribution</h3>
 <p className="text-xs font-medium text-muted-foreground mt-1">Allocation specifically for system administrators.</p>
 </div>
 <CardContent className="p-10 space-y-10">
 <div className="flex items-center justify-between p-6 bg-muted/10 rounded-3xl border border-border/50">
 <div className="space-y-0.5">
 <p className="text-sm font-bold">Primary Admin</p>
 <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Superuser level</p>
 </div>
 <div className="flex gap-4">
 <div className="text-center space-y-1.5">
 <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Assigned</span>
 <div className="w-24 h-10 flex items-center justify-center bg-card rounded-xl text-sm font-bold border border-border/50 shadow-inner">0</div>
 </div>
 <div className="text-center space-y-1.5">
 <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Left</span>
 <div className="w-24 h-10 flex items-center justify-center bg-card rounded-xl text-sm font-bold border border-border/50 shadow-inner">0</div>
 </div>
 </div>
 </div>

 <div className="space-y-4">
 <div className="flex justify-between items-center px-1">
 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Allocation Slider</label>
 <span className="text-[10px] font-bold text-emerald-600">0% Assigned</span>
 </div>
 <div className="relative h-2 bg-muted rounded-full w-full overflow-hidden">
 <div className="absolute left-0 top-0 h-full bg-emerald-600/20 w-0 transition-all duration-500" />
 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform" />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Quick Settings / Meta Info */}
 <div className="flex flex-col gap-8">
 <Card className="border-border/50 bg-emerald-950/5 dark:bg-emerald-500/3 shadow-sm rounded-[40px] overflow-hidden border-2 flex-1">
 <CardContent className="p-10 space-y-6">
 <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center">
 <Info className="w-6 h-6 text-emerald-600" />
 </div>
 <div className="space-y-4">
 <h3 className="text-lg font-bold tracking-tight">Understanding Quotas</h3>
 <p className="text-xs text-muted-foreground font-medium leading-relaxed">
 Messaging limits are reset at the start of your billing cycle. Unassigned quota remains in your global pool for on-demand allocation to agents.
 </p>
 <div className="pt-4 border-t border-emerald-500/10">
 <Button variant="link" className="p-0 h-auto text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700">
 Manage Billing Cycle →
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>

 <Button className="h-16 bg-foreground text-background hover:bg-foreground/90 rounded-[28px] font-bold uppercase tracking-[0.3em] text-xs shadow-2xl transition-all">
 Synchronize All Limits
 </Button>
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
