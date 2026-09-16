"use client"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Button } from "@/components/ui/button"
import { Grid, Plus, Calendar, Clock, Layout, Info } from "lucide-react"
import { Card } from "@/components/ui/card"

export default function RightBarPage() {
 return (
 <DashboardLayoutClient mainClassName="pb-16">
 <div className="flex flex-col gap-10">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
 <div className="space-y-1.5">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
 <Grid className="w-3.5 h-3.5 text-emerald-600" />
 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Interface Customization</span>
 </div>
 <h2 className="text-4xl font-bold tracking-tight text-foreground">
 RightBar Widgets
 </h2>
 <p className="text-muted-foreground text-sm font-medium">
 Configure contextual helper widgets for the live chat interface.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-3">
 <Button variant="outline" className="h-11 px-6 rounded-xl border-border/50 text-foreground font-bold text-[11px] uppercase tracking-widest gap-2 bg-card shadow-sm hover:bg-muted/10 transition-all">
 <Calendar className="w-4 h-4 text-muted-foreground" />
 Add Schedule
 </Button>
 <Button variant="outline" className="h-11 px-6 rounded-xl border-border/50 text-foreground font-bold text-[11px] uppercase tracking-widest gap-2 bg-card shadow-sm hover:bg-muted/10 transition-all">
 <Clock className="w-4 h-4 text-muted-foreground" />
 Add Trial
 </Button>
 <Button className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 rounded-xl font-bold text-[11px] uppercase tracking-widest gap-2 transition-all hover:scale-[1.02]">
 <Plus className="w-4 h-4" />
 Add Widget
 </Button>
 </div>
 </div>

 {/* Empty State Card */}
 <Card className="border-border/50 bg-card shadow-sm rounded-[40px] overflow-hidden p-20 flex flex-col items-center justify-center text-center space-y-6">
 <div className="w-20 h-20 rounded-[32px] bg-muted/10 flex items-center justify-center border border-border/50">
 <Layout className="w-10 h-10 text-muted-foreground/30 stroke-[1.5]" />
 </div>
 <div className="space-y-2">
 <h3 className="text-xl font-bold tracking-tight">Infrastructure Empty</h3>
 <p className="text-sm text-muted-foreground font-medium max-w-sm">
 Widgets appear on the right side of your live chat. Start by adding a schedule or custom action button.
 </p>
 </div>
 <div className="pt-4">
 <Button className="h-12 px-8 bg-foreground text-background hover:bg-foreground/90 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all">
 Begin Integration
 </Button>
 </div>
 </Card>

 {/* Footer / Meta Info */}
 <div className="max-w-2xl">
 <div className="p-6 bg-emerald-500/3 rounded-3xl border border-emerald-500/10 flex items-start gap-4">
 <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center shrink-0">
 <Info className="w-5 h-5 text-emerald-600" />
 </div>
 <div className="space-y-1">
 <p className="text-[11px] font-bold text-foreground leading-relaxed">
 Widget Visibility Control
 </p>
 <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
 You can control widget visibility based on contact tags or team assignments. Configure individual widget settings after adding them.
 </p>
 </div>
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
