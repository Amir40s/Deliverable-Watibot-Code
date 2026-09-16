"use client"

import React from "react"
import { motion } from "framer-motion"
import { Smartphone, CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck, Activity } from "lucide-react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { cn } from "@/lib/utils"

interface WabaAnalyticsData {
    hasData?: boolean;
    active: number;
    disconnected: number;
    pending: number;
    expired: number;
    total: number;
    healthScore: number;
}

export function WabaAnalyticsWidget({ data }: { data?: WabaAnalyticsData }) {
    const stats = {
        hasData: Boolean(data?.hasData),
        active: Number(data?.active || 0),
        disconnected: Number(data?.disconnected || 0),
        pending: Number(data?.pending || 0),
        expired: Number(data?.expired || 0),
        total: Number(data?.total || 0),
        healthScore: Number(data?.healthScore || 0)
    }

    const segments = [
        { name: "Active", count: stats.active, color: "#10b981", icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
        { name: "Pending", count: stats.pending, color: "#f59e0b", icon: Clock, bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
        { name: "Expired Tokens", count: stats.expired, color: "#f43f5e", icon: AlertTriangle, bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
        { name: "Disconnected", count: stats.disconnected, color: "#64748b", icon: XCircle, bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
    ]

    const chartData = segments.filter(s => s.count > 0).map(s => ({
        name: s.name,
        value: s.count,
        color: s.color
    }))

    const sumCounts = stats.active + stats.pending + stats.expired + stats.disconnected
    const totalCalculated = sumCounts > 0 ? sumCounts : (stats.total > 0 ? stats.total : 0)

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#00a884] flex items-center justify-center">
                            <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">WABA Connection Status</h3>
                            <p className="text-xs font-semibold text-slate-500">WhatsApp Business Account health</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Status Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
                {segments.map((seg) => {
                    const Icon = seg.icon
                    const pct = totalCalculated > 0 ? Math.round((seg.count / totalCalculated) * 100) : 0
                    return (
                        <div
                            key={seg.name}
                            className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 hover:shadow-xs transition-all"
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{seg.name}</span>
                                <div className={cn("w-5 h-5 rounded-md flex items-center justify-center shrink-0", seg.bg, seg.text)}>
                                    <Icon className="w-3 h-3" />
                                </div>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-xl font-black text-slate-800 dark:text-slate-100 tabular-nums">{seg.count}</span>
                                <span className="text-[11px] font-bold text-slate-400">{pct}%</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Visual Breakdown Bar & Donut Row */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row items-center gap-6">
                {/* Visual Segmented Progress Bar */}
                <div className="flex-1 w-full space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
                            Fleet Connection Distribution
                        </span>
                        <span>{totalCalculated > 0 ? totalCalculated : stats.total} Total Registered</span>
                    </div>

                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5">
                        {segments.map((seg) => {
                            const widthPct = totalCalculated > 0 ? (seg.count / totalCalculated) * 100 : 0
                            if (widthPct === 0) return null
                            return (
                                <motion.div
                                    key={seg.name}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${widthPct}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: seg.color }}
                                    title={`${seg.name}: ${seg.count} (${Math.round(widthPct)}%)`}
                                />
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-400 pt-1">
                        {segments.map((seg) => (
                            <div key={seg.name} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                                <span>{seg.name}:</span>
                                <span className="text-slate-900 dark:text-white">{seg.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Donut Chart */}
                {chartData.length > 0 && (
                    <div className="w-28 h-28 relative shrink-0 flex items-center justify-center">
                        <ResponsiveContainer width={112} height={112}>
                            <PieChart>
                                <Tooltip
                                    formatter={(value: any, name: any) => [`${value} Accounts`, name]}
                                    contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                                />
                                <Pie
                                    data={chartData}
                                    innerRadius={32}
                                    outerRadius={48}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{stats.active}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Active</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
