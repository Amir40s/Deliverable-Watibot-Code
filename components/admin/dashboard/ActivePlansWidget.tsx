"use client"

import React from "react"
import { motion } from "framer-motion"
import { Layers, Zap, Clock, AlertOctagon, CheckCircle2 } from "lucide-react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { Badge } from "@/components/ui/badge"

interface PlanItem {
    name: string;
    value: number;
    percentage: number;
}

interface SubscriptionAnalyticsData {
    hasData?: boolean;
    total: number;
    activeCount: number;
    trialCount: number;
    expiredCount: number;
    activePercentage: number;
    trialPercentage: number;
    expiredPercentage: number;
    distribution: PlanItem[];
}

const TIER_COLORS = [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#00a884", // Teal / Emerald
    "#ec4899", // Pink
    "#f97316", // Orange
    "#06b6d4", // Cyan
    "#64748b"  // Slate
]

export function ActivePlansWidget({ data }: { data?: SubscriptionAnalyticsData }) {
    const stats = {
        hasData: Boolean(data?.hasData),
        total: Number(data?.total || 0),
        activeCount: Number(data?.activeCount || 0),
        trialCount: Number(data?.trialCount || 0),
        expiredCount: Number(data?.expiredCount || 0),
        activePercentage: Number(data?.activePercentage || 0),
        trialPercentage: Number(data?.trialPercentage || 0),
        expiredPercentage: Number(data?.expiredPercentage || 0),
        distribution: data?.distribution || []
    }

    const plans = stats.distribution || []

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
            {/* Header */}
            <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Active Plans Breakdown</h3>
                            <p className="text-xs font-semibold text-slate-500">Tier distribution and subscription statuses</p>
                        </div>
                    </div>

                    <Badge variant="outline" className="text-[11px] font-black px-2.5 py-1 rounded-full border-slate-200 dark:border-slate-700">
                        {stats.total} Total Subscriptions
                    </Badge>
                </div>

                {/* Status Summary Badges */}
                <div className="grid grid-cols-3 gap-2.5 my-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Active</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-lg font-black text-emerald-900 dark:text-emerald-200 tabular-nums">{stats.activeCount}</span>
                            <span className="text-[11px] font-bold text-emerald-600/80 dark:text-emerald-400/80">{stats.activePercentage}%</span>
                        </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 mb-1">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Trial</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-lg font-black text-amber-900 dark:text-amber-200 tabular-nums">{stats.trialCount}</span>
                            <span className="text-[11px] font-bold text-amber-600/80 dark:text-amber-400/80">{stats.trialPercentage}%</span>
                        </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 mb-1">
                            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Expired / Off</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-lg font-black text-slate-800 dark:text-slate-200 tabular-nums">{stats.expiredCount}</span>
                            <span className="text-[11px] font-bold text-slate-400">{stats.expiredPercentage}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Granular Plan Distribution List & Donut Chart */}
            <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full space-y-2.5">
                    {plans.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-400 italic py-2">No subscription plan records found</p>
                    ) : (
                        plans.map((p, idx) => {
                            const color = TIER_COLORS[idx % TIER_COLORS.length]
                            return (
                                <div key={p.name} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                            {p.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-900 dark:text-white font-black tabular-nums">{p.value}</span>
                                            <span className="text-[11px] font-semibold text-slate-400">({p.percentage}%)</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${p.percentage}%` }}
                                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: color }}
                                        />
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {plans.length > 0 && (
                    <div className="w-28 h-28 relative shrink-0 flex items-center justify-center">
                        <ResponsiveContainer width={112} height={112}>
                            <PieChart>
                                <Tooltip
                                    formatter={(value: any, name: any) => [`${value} Subscribers`, name]}
                                    contentStyle={{ borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                                />
                                <Pie
                                    data={plans}
                                    innerRadius={32}
                                    outerRadius={48}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {plans.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={TIER_COLORS[idx % TIER_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{plans[0]?.value || 0}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[60px]">
                                {plans[0]?.name || "Top"}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
