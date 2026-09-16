"use client"

import { motion } from "framer-motion"
import { LogIn, Edit, Zap, AlertTriangle, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

function getInitials(name: string) {
    return name ? name.substring(0, 2).toUpperCase() : "V"
}

function EmptyState({ title, description }: { title: string, description: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center p-6 opacity-60">
            <LayoutDashboard className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-bold text-slate-500">{title}</p>
            <p className="text-xs font-semibold text-slate-400 mt-1 max-w-[200px]">{description}</p>
        </div>
    )
}

// -----------------------------------------------------
// 1. RECENT VENDORS TABLE
// -----------------------------------------------------
export function RecentVendorsTable({ vendorsObj }: { vendorsObj: any }) {
    const hasVendors = Boolean(vendorsObj?.hasData && Array.isArray(vendorsObj?.data) && vendorsObj.data.length > 0)

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[300px]">
            <div className="p-5 border-b border-slate-200/60 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight">Recent Vendors</h3>
                    <p className="text-xs font-semibold text-slate-500">Latest signups on the platform</p>
                </div>
                {hasVendors && <button className="text-xs font-bold text-[#00a884] hover:underline">View All</button>}
            </div>
            <div className="flex-1 overflow-x-auto">
                {!hasVendors ? (
                    <EmptyState title="No Vendors Found" description="New signups will appear here." />
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800 text-[10px] font-black tracking-wider text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/20">
                                <th className="px-5 py-3">Vendor</th>
                                <th className="px-5 py-3">Plan</th>
                                <th className="px-5 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {vendorsObj.data.map((v: any, i: number) => (
                                <motion.tr 
                                    key={v.id || i} 
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                                >
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00a884]/10 to-emerald-600/10 text-[#00a884] font-black text-xs flex items-center justify-center shrink-0">
                                                {getInitials(v.name)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{v.name || 'Vendor'}</p>
                                                <p className="text-[11px] text-slate-500 font-semibold">{v.contactPerson || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 capitalize">{v.plan || 'Free'}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border",
                                            v.status?.toLowerCase() === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"
                                        )}>
                                            {v.status || "ACTIVE"}
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

// -----------------------------------------------------
// 2. TOP VENDORS LEADERBOARD
// -----------------------------------------------------
export function TopVendorsLeaderboard({ vendorsObj }: { vendorsObj: any }) {
    const hasLeaderboard = Boolean(vendorsObj?.hasData && Array.isArray(vendorsObj?.data) && vendorsObj.data.length > 0)

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[300px]">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">Top Performing Vendors</h3>
            <p className="text-xs font-semibold text-slate-500 mb-5">Ranked by total contacts</p>
            
            {!hasLeaderboard ? (
                <EmptyState title="No Leaderboard" description="Not enough data to calculate top vendors." />
            ) : (
                <div className="space-y-4">
                    {vendorsObj.data.map((v: any, i: number) => (
                        <div key={v.id || i} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[10px] flex items-center justify-center">
                                    #{v.rank || i + 1}
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#00a884] transition-colors cursor-pointer">{v.name || 'Vendor'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{v.revenue}</p>
                                <p className="text-[10px] font-bold text-emerald-500 tracking-wider">{v.growth}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// -----------------------------------------------------
// 3. LIVE ACTIVITY FEED
// -----------------------------------------------------
export function LiveActivityFeed({ activitiesObj }: { activitiesObj: any }) {
    if (!activitiesObj?.hasData) return null

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Activity Feed
            </h3>
            <p className="text-xs font-semibold text-slate-500 mb-5">Real-time platform events</p>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                {activitiesObj.data.map((a: any, i: number) => (
                    <motion.div key={a.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <Zap className="w-2.5 h-2.5" />
                        </div>
                        
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{a.action || "Event"}</span>
                                <span className="text-[10px] font-bold text-slate-400">{new Date(a.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                                {a.organization?.name ? <span className="font-bold text-[#00a884]">{a.organization.name}</span> : 'System'}{" "}
                                <span className="text-slate-500">{a.details || "performed an action"}</span>
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

// -----------------------------------------------------
// 4. SYSTEM LOGS
// -----------------------------------------------------
export function SystemLogsWidget({ logsObj }: { logsObj: any }) {
    if (!logsObj?.hasData) return null

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full text-slate-300">
            <h3 className="text-sm font-black text-white tracking-tight mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> System Logs
            </h3>
            
            <div className="space-y-3 font-mono text-[10px] leading-relaxed overflow-y-auto">
                {logsObj.data.map((log: any, i: number) => {
                    const isWarn = log.status === 'warning';
                    const badgeText = isWarn ? '[WARN]' : '[ERROR]';
                    const badgeColor = isWarn ? 'text-amber-400' : 'text-rose-400';

                    return (
                        <div key={i} className="flex gap-3 items-start border-b border-slate-800 pb-2 last:border-0">
                            <span className="text-slate-500 shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
                            <span className={`font-bold shrink-0 ${badgeColor}`}>{badgeText}</span>
                            <span className="break-all">{log.action}: {log.details}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
