import { 
    getExecutiveOverview, 
    getRevenueAnalytics,
    getSubscriptionAnalytics,
    getWhatsAppAnalytics,
    getPlatformHealth,
    getRecentVendors,
    getTopVendors,
    getLiveActivity,
    getSystemLogs
} from "./actions"
import { AdminDashboardClient } from "@/components/admin/dashboard/AdminDashboardClient"
import type { DateFilterParams } from "@/lib/admin/dashboard-date-filter"

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
    const resolvedParams = await Promise.resolve(searchParams || {})
    const filter = typeof resolvedParams.filter === 'string' ? resolvedParams.filter : 'all'
    const startDate = typeof resolvedParams.startDate === 'string' ? resolvedParams.startDate : undefined
    const endDate = typeof resolvedParams.endDate === 'string' ? resolvedParams.endDate : undefined

    const dateParams: DateFilterParams = { filter, startDate, endDate }

    const [
        executive,
        revenue,
        whatsapp,
        subscriptions,
        health,
        recentVendors,
        topVendors,
        activity,
        logs
    ] = await Promise.all([
        getExecutiveOverview(dateParams).catch(() => ({ hasData: false })),
        getRevenueAnalytics(dateParams).catch(() => ({ hasData: false, data: [] })),
        getWhatsAppAnalytics(dateParams).catch(() => ({ hasData: false })),
        getSubscriptionAnalytics(dateParams).catch(() => ({ hasData: false })),
        getPlatformHealth().catch(() => ({ hasData: false })),
        getRecentVendors(dateParams).catch(() => ({ hasData: false, data: [] })),
        getTopVendors(dateParams).catch(() => ({ hasData: false })),
        getLiveActivity(dateParams).catch(() => ({ hasData: false, data: [] })),
        getSystemLogs(dateParams).catch(() => ({ hasData: false, data: [] }))
    ])

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 plus-jakarta-forced animate-in fade-in duration-500">
            <AdminDashboardClient
                initialParams={dateParams}
                initialData={{
                    executive,
                    revenue,
                    whatsapp,
                    subscriptions,
                    health,
                    recentVendors,
                    topVendors,
                    activity,
                    logs
                }}
            />
        </div>
    )
}
