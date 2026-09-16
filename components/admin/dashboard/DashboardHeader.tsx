"use client"

import Link from "next/link"
import { Activity } from "lucide-react"
import { DateFilterDropdown } from "./DateFilterDropdown"
import type { DateFilterParams } from "@/lib/admin/dashboard-date-filter"

interface DashboardHeaderProps {
    currentParams?: DateFilterParams;
    onFilterChange?: (params: DateFilterParams) => void;
    isLoading?: boolean;
}

export function DashboardHeader({ currentParams = { filter: 'all' }, onFilterChange = () => {}, isLoading }: DashboardHeaderProps) {
    return (
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Super Admin Dashboard</h1>
                    <p className="text-sm font-semibold text-slate-500 mt-0.5">Platform overview and real-time analytics</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <DateFilterDropdown
                        currentParams={currentParams}
                        onFilterChange={onFilterChange}
                        isLoading={isLoading}
                    />

                    <Link
                        href="/admin/system-status"
                        className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-xs font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-xs hover:border-[#00a884] hover:text-[#00a884] transition-all"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00a884]"></span>
                        </span>
                        <Activity className="w-3.5 h-3.5" />
                        <span>System Status & Memory</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
