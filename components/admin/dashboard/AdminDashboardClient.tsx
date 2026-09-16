"use client"

import React, { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DashboardHeader } from "./DashboardHeader"
import { HeroOverview } from "./HeroOverview"
import { WabaAnalyticsWidget } from "./WabaAnalyticsWidget"
import { ActivePlansWidget } from "./ActivePlansWidget"
import { RevenueAnalytics, PlatformHealth } from "./AnalyticsWidgets"
import { RecentVendorsTable, TopVendorsLeaderboard, LiveActivityFeed, SystemLogsWidget } from "./Tables"
import type { DateFilterParams } from "@/lib/admin/dashboard-date-filter"

interface AdminDashboardClientProps {
    initialParams: DateFilterParams;
    initialData: {
        executive: any;
        revenue: any;
        whatsapp: any;
        subscriptions: any;
        health: any;
        recentVendors: any;
        topVendors: any;
        activity: any;
        logs: any;
    };
}

export function AdminDashboardClient({ initialParams, initialData }: AdminDashboardClientProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [currentParams, setCurrentParams] = useState<DateFilterParams>(initialParams)
    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()
    const [isFetching, setIsFetching] = useState(false)

    React.useEffect(() => {
        setData(initialData)
        setCurrentParams(initialParams)
    }, [initialData, initialParams])

    const handleFilterChange = async (newParams: DateFilterParams) => {
        setCurrentParams(newParams)
        setIsFetching(true)

        // 1. Update browser URL without full page reload
        const query = new URLSearchParams()
        if (newParams.filter && newParams.filter !== 'all') {
            query.set('filter', newParams.filter)
        }
        if (newParams.filter === 'custom') {
            if (newParams.startDate) query.set('startDate', newParams.startDate)
            if (newParams.endDate) query.set('endDate', newParams.endDate)
        }

        const queryString = query.toString()
        const newUrl = queryString ? `${pathname}?${queryString}` : pathname
        window.history.pushState(null, '', newUrl)

        // 2. Fetch fresh dynamic data from the dashboard API
        try {
            const apiUrl = `/api/v1/admin/dashboard${queryString ? `?${queryString}` : ''}`
            const res = await fetch(apiUrl)
            if (res.ok) {
                const json = await res.json()
                startTransition(() => {
                    setData({
                        executive: json.executive || initialData.executive,
                        revenue: json.revenue || initialData.revenue,
                        whatsapp: json.whatsapp || initialData.whatsapp,
                        subscriptions: json.subscriptions || initialData.subscriptions,
                        health: json.health || initialData.health,
                        recentVendors: json.recentVendors || initialData.recentVendors,
                        topVendors: json.topVendors || initialData.topVendors,
                        activity: json.recentActivity || initialData.activity,
                        logs: json.systemLogs || initialData.logs,
                    })
                })
            }
        } catch (err) {
            console.error("Failed to re-fetch dashboard analytics:", err)
        } finally {
            setIsFetching(false)
        }
    }

    const isLoading = isPending || isFetching

    return (
        <div className="space-y-6">
            {/* Header with Global Date Filter Dropdown */}
            <DashboardHeader
                currentParams={currentParams}
                onFilterChange={handleFilterChange}
                isLoading={isLoading}
            />

            {/* Subtle loading indicator */}
            {isLoading && (
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden -mt-4">
                    <div className="w-full h-full bg-[#00a884] animate-pulse" />
                </div>
            )}

            <div className={`space-y-6 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                {/* 1. HERO OVERVIEW (Dynamic metrics) */}
                <HeroOverview data={data.executive} />

                {/* 2. WABA & ACTIVE PLANS BREAKDOWN (New High-Impact Analytics Section) */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <WabaAnalyticsWidget data={data.whatsapp} />
                    <ActivePlansWidget data={data.subscriptions} />
                </div>

                {/* 3. REVENUE & PLATFORM HEALTH */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        <RevenueAnalytics dataObj={data.revenue} />
                    </div>
                    <div className="xl:col-span-1">
                        <PlatformHealth data={data.health} />
                    </div>
                </div>

                {/* 4. RECENT VENDORS & TOP VENDORS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <RecentVendorsTable vendorsObj={data.recentVendors} />
                    </div>
                    <div className="lg:col-span-1">
                        <TopVendorsLeaderboard vendorsObj={data.topVendors} />
                    </div>
                </div>

                {/* 5. LIVE ACTIVITY FEED & SYSTEM LOGS */}
                {(data.activity?.hasData || data.logs?.hasData) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <LiveActivityFeed activitiesObj={data.activity} />
                        <SystemLogsWidget logsObj={data.logs} />
                    </div>
                )}
            </div>
        </div>
    )
}
