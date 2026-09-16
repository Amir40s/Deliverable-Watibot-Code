"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Server, Activity, Database, Smartphone, Clock, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

function EmptyState({ title, description }: { title: string, description: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60">
            <LayoutDashboard className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-bold text-slate-500">{title}</p>
            <p className="text-xs font-semibold text-slate-400 mt-1 max-w-[200px]">{description}</p>
        </div>
    )
}

// -----------------------------------------------------
// 1. REVENUE ANALYTICS CHART
// -----------------------------------------------------
export function RevenueAnalytics({ dataObj }: { dataObj: any }) {
    const [range, setRange] = useState("1y")
    const hasData = dataObj?.hasData && dataObj?.data?.length > 0

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Revenue Analytics</h3>
                    <p className="text-xs font-semibold text-slate-500">Monthly Recurring Revenue over time</p>
                </div>
                {hasData && (
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {['1y'].map(r => (
                            <button 
                                key={r}
                                onClick={() => setRange(r)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                    range === r ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex-1 w-full min-h-0 relative">
                {!hasData ? (
                    <EmptyState title="No Revenue Data" description="Not enough historical subscription data to generate this chart." />
                ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <AreaChart data={dataObj.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00a884" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#00a884" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `$${val/1000}k`} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                                itemStyle={{ color: '#0f172a' }}
                                formatter={(val: any) => [`$${(val || 0).toLocaleString()}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#00a884" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={1000} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}

// -----------------------------------------------------
// 2. PLATFORM HEALTH
// -----------------------------------------------------
export function PlatformHealth({ data }: { data: any }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">Platform Health</h3>
            <p className="text-xs font-semibold text-slate-500 mb-6">Real-time system status</p>
            
            {!data?.hasData ? (
                <EmptyState title="Health Data Unavailable" description="Could not fetch real-time metrics." />
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            <div>
                                <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">API</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{data.apiStatus}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <Database className="w-4 h-4 text-emerald-500" />
                            <div>
                                <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Database</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{data.dbStatus}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> DB Latency (Ping)</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{data.dbPing}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: '15%' }} className="h-full bg-emerald-500" transition={{ duration: 1 }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// -----------------------------------------------------
// 3. WHATSAPP & SUBSCRIPTION ANALYTICS
// -----------------------------------------------------
export function DualDonutAnalytics({ whatsapp, subscriptions }: { whatsapp: any, subscriptions: any }) {
    // If neither have data, we just render null to hide the whole section natively from page
    if (!whatsapp?.hasData && !subscriptions?.hasData) return null

    const waData = whatsapp?.hasData ? [
        { name: 'Connected', value: whatsapp.connected, color: '#00a884' },
        { name: 'Disconnected', value: whatsapp.disconnected, color: '#f43f5e' }
    ] : []

    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6']

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center min-h-[200px]">
                {!whatsapp?.hasData ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <EmptyState title="No WhatsApp Connections" description="Connect WhatsApp numbers to see stats." />
                    </div>
                ) : (
                    <>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight mb-4 flex items-center gap-2"><Smartphone className="w-4 h-4 text-[#00a884]"/> WhatsApp Connections</h3>
                            <div className="space-y-3">
                                {waData.map((d, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="text-slate-500">{d.name}</span>
                                            <span className="text-slate-800 dark:text-slate-200">{d.value}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                                            <div className="h-full rounded-full" style={{ width: `${(d.value / (whatsapp.connected + whatsapp.disconnected)) * 100}%`, backgroundColor: d.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
                                <div>Verified: <span className="text-emerald-500">{whatsapp.verified}</span></div>
                                <div>Pending: <span className="text-amber-500">{whatsapp.pending}</span></div>
                            </div>
                        </div>
                        <div className="w-32 h-32 hidden sm:block">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie data={waData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                                        {waData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </div>

            {/* Subscriptions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center min-h-[200px]">
                {!subscriptions?.hasData ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <EmptyState title="No Subscriptions" description="Active subscription data will appear here." />
                    </div>
                ) : (
                    <>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight mb-4">Subscription Distribution</h3>
                            <div className="space-y-2">
                                {subscriptions.distribution.map((d: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs font-bold">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-slate-500 flex-1">{d.name}</span>
                                        <span className="text-slate-800 dark:text-slate-200">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-32 h-32 hidden sm:block">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie data={subscriptions.distribution} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                                        {subscriptions.distribution.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
