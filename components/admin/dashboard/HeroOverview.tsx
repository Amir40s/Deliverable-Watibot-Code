"use client"

import { motion } from "framer-motion"
import { Server, Clock, Store, MessageSquare, ArrowUpRight, ArrowDownRight, Contact } from "lucide-react"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"

const generateSparkline = () => Array.from({ length: 10 }, () => ({ value: Math.random() * 100 }))

interface MetricCardProps {
    title: string
    value: string | number
    trend?: string | null
    isPositive?: boolean
    icon: any
    colorClass: string
    bgClass: string
    delay: number
}

function MetricCard({ title, value, trend, isPositive, icon: Icon, colorClass, bgClass, delay }: MetricCardProps) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    const data = trend ? generateSparkline() : null
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", bgClass, colorClass)}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <div className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border", 
                        isPositive ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20" : "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20"
                    )}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trend}%
                    </div>
                )}
            </div>
            
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1">{title}</p>
                    <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight tabular-nums">{value}</h4>
                </div>
                {mounted && data && (
                    <div className="w-20 h-10 opacity-50 group-hover:opacity-100 transition-opacity min-w-[80px] min-h-[40px]">
                        <ResponsiveContainer width={80} height={40} minWidth={0} minHeight={0}>
                            <LineChart data={data}>
                                <Line type="monotone" dataKey="value" stroke={isPositive ? "#059669" : "#e11d48"} strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
            
            {/* Subtle Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </motion.div>
    )
}

export function HeroOverview({ data }: { data: any }) {
    if (!data || !data.hasData) return null

    const metrics = [
        { title: "Total Vendors", value: (data.totalVendors ?? 0).toLocaleString(), trend: data.vendorGrowth, isPositive: Number(data.vendorGrowth) >= 0, icon: Server, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
        { title: "Active Vendors", value: (data.activeVendors ?? 0).toLocaleString(), icon: Store, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        { title: "Trial Vendors", value: (data.trialVendors ?? 0).toLocaleString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { title: "Total Contacts", value: (data.totalContacts ?? 0).toLocaleString(), icon: Contact, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
        
        { title: "Messages Sent/Rcvd", value: (data.totalMessages ?? 0).toLocaleString(), trend: data.messageGrowth, isPositive: Number(data.messageGrowth) >= 0, icon: MessageSquare, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-500/10" },
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
                <MetricCard 
                    key={m.title} 
                    title={m.title} 
                    value={m.value} 
                    trend={m.trend} 
                    isPositive={m.isPositive} 
                    icon={m.icon} 
                    colorClass={m.color} 
                    bgClass={m.bg} 
                    delay={i * 0.05} 
                />
            ))}
        </div>
    )
}
