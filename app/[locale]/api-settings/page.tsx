"use client"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Copy, RefreshCw, Image, FileText, Info, Code, Terminal, ExternalLink, ShieldCheck, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from "@/components/ui/card"
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

export default function ApiSettingsPage() {
 return (
 <DashboardLayoutClient mainClassName="pb-16">
 <div className="flex flex-col gap-12">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
 <div className="space-y-1.5">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
 <Terminal className="w-3.5 h-3.5 text-emerald-600" />
 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Developer Hub</span>
 </div>
 <h2 className="text-4xl font-bold tracking-tight text-foreground">
 API & Integrations
 </h2>
 <p className="text-muted-foreground text-sm font-medium max-w-2xl">
 Configure your programmatic access and third-party syncs. High-performance endpoints for high-volume messaging.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <Button variant="outline" className="h-11 px-6 rounded-xl border-border/50 text-foreground font-bold text-[11px] uppercase tracking-widest gap-2 bg-card shadow-sm hover:bg-muted/10">
 <Info className="w-4 h-4" />
 API Docs
 </Button>
 <Button className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 rounded-xl font-bold text-[11px] uppercase tracking-widest gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
 <Plus className="w-4 h-4" />
 Create Key
 </Button>
 </div>
 </div>

 {/* API Keys Section */}
 <div className="space-y-6">
 <div className="flex items-center justify-between px-2">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
 <ShieldCheck className="w-4 h-4 text-emerald-600" />
 </div>
 <h3 className="text-lg font-bold tracking-tight">Access Tokens</h3>
 </div>
 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">0 active keys</span>
 </div>

 <Card className="border-border/50 bg-card shadow-sm rounded-[32px] overflow-hidden">
 <Table>
 <TableHeader className="bg-muted/30 border-b border-border/50">
 <TableRow className="hover:bg-transparent">
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest text-muted-foreground px-8">API Identity</TableHead>
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Generation Date</TableHead>
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Expiry Schedule</TableHead>
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest text-muted-foreground text-right px-8">Current State</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 <TableRow>
 <TableCell colSpan={4} className="h-40 text-center">
 <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground/50">
 <Code className="w-10 h-10 stroke-1" />
 <p className="text-xs font-bold uppercase tracking-widest">No API keys found for this account.</p>
 </div>
 </TableCell>
 </TableRow>
 </TableBody>
 </Table>
 </Card>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
 {/* Google Sheets Card */}
 <Card className="border-border/50 bg-card shadow-sm rounded-[40px] overflow-hidden flex flex-col">
 <CardHeader className="p-10 pb-6 space-y-4">
 <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
 <FileText className="w-7 h-7 text-emerald-600" />
 </div>
 <div>
 <CardTitle className="text-2xl font-bold tracking-tight">Google Sheets Sync</CardTitle>
 <CardDescription className="text-sm font-medium mt-1">Automatically export messaging data to your spreadsheet.</CardDescription>
 </div>
 </CardHeader>
 <CardContent className="p-10 pt-0 flex-1 space-y-8">
 <div className="space-y-6">
 <div className="space-y-2.5">
 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Spreadsheet Identity</label>
 <div className="relative group">
 <Input placeholder="Enter sheet ID..." className="h-14 bg-muted/10 border-border/50 rounded-2xl px-6 text-sm font-medium focus-visible:ring-emerald-500/20 shadow-inner" />
 <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
 <Copy className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-emerald-600 transition-colors" />
 </div>
 </div>
 <p className="text-[10px] text-muted-foreground font-medium px-1 italic">Found between /d/ and /edit in your sheet URL.</p>
 </div>

 <div className="space-y-2.5">
 <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Target Worksheet</label>
 <Input placeholder="Sheet1" className="h-14 bg-muted/10 border-border/50 rounded-2xl px-6 text-sm font-medium focus-visible:ring-emerald-500/20" />
 </div>

 <div className="flex items-center justify-between p-6 bg-muted/10 rounded-2xl border border-border/50">
 <div className="space-y-0.5">
 <p className="text-xs font-bold tracking-tight">Active Real-time Sync</p>
 <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Live data streaming</p>
 </div>
 <Switch className="data-[state=checked]:bg-emerald-600 shadow-lg" />
 </div>
 </div>

 <div className="pt-4 flex gap-4">
 <Button variant="outline" className="flex-1 h-14 rounded-2xl border-border/50 font-bold text-[10px] uppercase tracking-widest gap-2 hover:bg-muted/10">
 <RefreshCw className="w-3.5 h-3.5" />
 Validate
 </Button>
 <Button className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-600/20">
 Save Config
 </Button>
 </div>

 <div className="p-6 bg-emerald-500/3 rounded-3xl border border-emerald-500/10 space-y-4">
 <div className="flex items-center gap-2">
 <Info className="w-4 h-4 text-emerald-600" />
 <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Setup Requirement</p>
 </div>
 <ul className="space-y-2 text-[11px] text-muted-foreground font-bold italic">
 <li className="flex gap-2 leading-relaxed text-emerald-700/80 dark:text-emerald-400/80">
 <div className="w-1 h-1 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
 Option A: Set Spreadsheet to <span className="text-foreground uppercase font-bold tracking-tighter mx-1">"Anyone with the link can edit"</span>
 </li>
 <li className="flex gap-2 leading-relaxed">
 <div className="w-1 h-1 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
 Option B: Share your sheet with the system bot email provided by your administrator as an <span className="text-foreground uppercase font-bold tracking-tighter mx-1">Editor</span>
 </li>
 </ul>
 </div>
 </CardContent>
 </Card>

 {/* Quick Start Card */}
 <Card className="border-border/50 bg-slate-950 shadow-2xl rounded-[40px] overflow-hidden flex flex-col text-white">
 <CardHeader className="p-10 pb-6 space-y-4 border-b border-white/5 bg-white/5">
 <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
 <Terminal className="w-7 h-7 text-emerald-400" />
 </div>
 <div className="flex justify-between items-start">
 <div>
 <CardTitle className="text-2xl font-bold tracking-tight">Endpoint Quick Start</CardTitle>
 <CardDescription className="text-sm font-medium mt-1 text-slate-400">Seamless integration via RESTful API.</CardDescription>
 </div>
 <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-bold px-3 py-1 uppercase tracking-widest">v1.2 Stable</Badge>
 </div>
 </CardHeader>
 <CardContent className="p-0 flex-1 flex flex-col">
 <div className="bg-black/40 flex-1 p-0 font-mono text-sm leading-relaxed overflow-hidden">
 <div className="flex items-center gap-2 px-6 py-3 bg-white/5 border-b border-white/5">
 <div className="flex gap-1.5">
 <div className="w-2 h-2 rounded-full bg-red-500/50" />
 <div className="w-2 h-2 rounded-full bg-amber-500/50" />
 <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
 </div>
 <span className="text-[10px] font-bold text-slate-500 ml-2 uppercase tracking-widest">curl - Terminal</span>
 </div>
 <div className="p-10 overflow-x-auto text-emerald-400/80">
 <pre className="selection:bg-emerald-500/30">
 <code>
 {`curl -X POST "https://api.watibot.com/v1/send" \\
 -H "Authorization: Bearer <API_KEY>" \\
 -H "Content-Type: application/json" \\
 -d'{
 "phone": "15551234567",
 "message": "Hello from WatiBot!"
 }'`}
 </code>
 </pre>
 </div>
 </div>
 <div className="p-10 bg-white/5 border-t border-white/5 mt-auto">
 <Button variant="ghost" className="w-full h-14 rounded-2xl border border-white/10 text-white font-bold text-[12px] uppercase tracking-[0.2em] gap-3 hover:bg-white/10 transition-all">
 View Production Reference
 <ExternalLink className="w-4 h-4" />
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* API References List */}
 <div className="space-y-8 pt-6">
 <div className="flex items-center gap-3 px-2">
 <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
 <Terminal className="w-5 h-5 text-orange-600" />
 </div>
 <div>
 <h3 className="text-xl font-bold tracking-tight">Core Messaging Ops</h3>
 <p className="text-xs font-medium text-muted-foreground">Standardized endpoints for all message types.</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 {[
 { title: "Standard Text", icon: Terminal, desc: "High volume plain text messaging.", color: "blue" },
 { title: "Smart Media", icon: Image, desc: "Automatic optimization for assets.", color: "purple" },
 { title: "Interactive UI", icon: FileText, desc: "Buttons, Lists, and Flow triggers.", color: "emerald" },
 ].map((item, i) => (
 <Card key={i} className="group border-border/50 bg-card hover:border-emerald-500/30 transition-all rounded-[32px] overflow-hidden p-8 space-y-4 shadow-sm">
 <div className={cn(
 "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
 item.color === "blue" ? "bg-blue-500/10 text-blue-600" :
 item.color === "purple" ? "bg-purple-500/10 text-purple-600" :
 "bg-emerald-500/10 text-emerald-600"
 )}>
 <item.icon className="w-6 h-6" />
 </div>
 <div className="space-y-1">
 <h4 className="font-bold tracking-tight">{item.title}</h4>
 <p className="text-xs font-medium text-muted-foreground leading-relaxed">{item.desc}</p>
 </div>
 <div className="pt-2">
 <Badge variant="outline" className="bg-muted/10 text-[9px] font-bold uppercase tracking-widest px-0 hover:bg-transparent text-muted-foreground group-hover:text-foreground transition-colors border-0">Documentation →</Badge>
 </div>
 </Card>
 ))}
 </div>
 </div>

 {/* Legend Table */}
 <Card className="border-border/50 bg-card shadow-sm rounded-[40px] overflow-hidden">
 <div className="p-10 border-b border-border/50 bg-muted/20">
 <h3 className="text-xl font-bold tracking-tight">Feature Capability Matrix</h3>
 <p className="text-xs font-medium text-muted-foreground mt-1">Operational constraints per message category.</p>
 </div>
 <div className="overflow-x-auto">
 <Table>
 <TableHeader className="bg-muted/30 border-b border-border/50">
 <TableRow className="hover:bg-transparent">
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest px-10">Message Model</TableHead>
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest">Optimized Payload</TableHead>
 <TableHead className="h-14 font-bold text-[10px] uppercase tracking-widest text-right px-10">Meta Compliance</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {[
 { model: "Freeform Conversation", payload: "Dynamic Strings", compliance: "Session Only" },
 { model: "Smart Template", payload: "Validated Variables", compliance: "Pre-approved" },
 { model: "Web-View Interaction", payload: "JSON State", compliance: "Dynamic" },
 ].map((row, i) => (
 <TableRow key={i} className="hover:bg-muted/10 transition-all border-b border-border/50 last:border-0">
 <TableCell className="h-20 px-10 font-bold">{row.model}</TableCell>
 <TableCell className="h-20 italic text-muted-foreground font-medium">{row.payload}</TableCell>
 <TableCell className="h-20 px-10 text-right">
 <Badge variant="outline" className="border-border/50 rounded-lg text-[9px] font-bold uppercase tracking-widest">{row.compliance}</Badge>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 </Card>
 </div>
 </DashboardLayoutClient>
 )
}

