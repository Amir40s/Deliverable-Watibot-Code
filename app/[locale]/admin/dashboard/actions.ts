"use server"

import { prisma } from "@/lib/prisma"
import { getDateBounds, type DateFilterParams } from "@/lib/admin/dashboard-date-filter"
import { getVendors } from "@/app/[locale]/admin/vendors/actions"

// In-memory cache to prevent redundant heavy aggregations on concurrent dashboard hits
const cache = new Map<string, { data: any; expiry: number }>()

function getCached<T>(key: string): T | null {
    const item = cache.get(key)
    if (item && item.expiry > Date.now()) return item.data
    return null
}

function setCached<T>(key: string, data: T, ttlMs = 15000) {
    cache.set(key, { data, expiry: Date.now() + ttlMs })
}

// Timeout wrapper: guarantees a query never hangs longer than timeoutMs
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000, fallbackValue: T): Promise<T> {
    let timer: NodeJS.Timeout
    const timeoutPromise = new Promise<T>((resolve) => {
        timer = setTimeout(() => {
            console.warn(`[AdminDashboard] Query exceeded ${timeoutMs}ms timeout limit, falling back.`)
            resolve(fallbackValue)
        }, timeoutMs)
    })
    try {
        const result = await Promise.race([promise, timeoutPromise])
        clearTimeout(timer!)
        return result
    } catch (err) {
        clearTimeout(timer!)
        return fallbackValue
    }
}

// 1. Executive Overview
export async function getExecutiveOverview(params?: DateFilterParams) {
    const cacheKey = `executiveOverview_${params?.filter || 'all'}_${params?.startDate || ''}_${params?.endDate || ''}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        let prevFrom: Date | null = null;
        let prevTo: Date | null = null;
        if (from && to) {
            const duration = to.getTime() - from.getTime();
            prevTo = new Date(from.getTime() - 1);
            prevFrom = new Date(prevTo.getTime() - duration);
        } else {
            const today = new Date(new Date().setHours(0, 0, 0, 0));
            prevTo = today;
            prevFrom = new Date(new Date().setDate(new Date().getDate() - 30));
        }

        const prevCondition = prevFrom && prevTo ? { createdAt: { gte: prevFrom, lte: prevTo } } : {};

        const [
            totalVendors, 
            activeVendors, 
            trialVendors,
            vendorsPrevPeriod,
            totalMessages,
            messagesPrevPeriod,
            totalContacts,
            activeSubscriptions
        ] = await withTimeout(
            Promise.all([
                prisma.organization.count({ where: { users: { some: {} }, ...dateCondition } }),
                prisma.organization.count({ where: { status: 'active', users: { some: {} }, ...dateCondition } }),
                prisma.organization.count({ where: { status: 'trial', users: { some: {} }, ...dateCondition } }),
                prisma.organization.count({ where: { users: { some: {} }, ...prevCondition } }),
                prisma.message.count({ where: { ...dateCondition } }),
                prisma.message.count({ where: { ...prevCondition } }),
                prisma.contact.count({ where: { ...dateCondition } }),
                prisma.subscription.findMany({ 
                    where: { 
                        status: { has: 'active' },
                        ...(from && to ? { startDate: { lte: to }, endDate: { gte: from } } : {})
                    }, 
                    select: { amount: true, frequency: true } 
                })
            ]),
            8000,
            [0, 0, 0, 0, 0, 0, 0, []] as any
        );

        let mrr = 0;
        activeSubscriptions.forEach((sub: any) => {
            if (sub.frequency?.toLowerCase() === 'monthly') mrr += Number(sub.amount || 0);
            if (sub.frequency?.toLowerCase() === 'yearly') mrr += Number(sub.amount || 0) / 12;
        });

        const arr = mrr * 12;
        
        const hasHistoricalVendors = vendorsPrevPeriod > 0;
        const vendorGrowth = hasHistoricalVendors ? ((activeVendors - vendorsPrevPeriod) / vendorsPrevPeriod) * 100 : null;

        const hasHistoricalMessages = messagesPrevPeriod > 0;
        const messageGrowth = hasHistoricalMessages ? ((totalMessages - messagesPrevPeriod) / messagesPrevPeriod) * 100 : null;

        const result = {
            totalVendors, 
            activeVendors, 
            trialVendors,
            totalContacts,
            totalMessages,
            mrr, 
            arr,
            vendorGrowth: vendorGrowth !== null ? vendorGrowth.toFixed(1) : null,
            messageGrowth: messageGrowth !== null ? messageGrowth.toFixed(1) : null,
            hasData: true
        };

        setCached(cacheKey, result, 15000);
        return result;
    } catch (error) {
        console.error("Failed getExecutiveOverview:", error);
        return { hasData: false };
    }
}

// 2. Revenue Analytics
export async function getRevenueAnalytics(params?: DateFilterParams) {
    const cacheKey = `revenueAnalytics_${params?.filter || 'all'}_${params?.startDate || ''}_${params?.endDate || ''}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const subscriptions = await prisma.subscription.findMany({
            where: { amount: { gt: 0 }, ...dateCondition },
            select: { createdAt: true, amount: true, frequency: true },
            orderBy: { createdAt: 'asc' }
        });

        if (subscriptions.length === 0) {
            const [orgs, dbPlans] = await Promise.all([
                prisma.organization.findMany({
                    where: { users: { some: {} }, ...dateCondition },
                    select: { createdAt: true, plan: true }
                }),
                prisma.plan.findMany({
                    select: { slug: true, monthlyPrice: true, yearlyPrice: true }
                }).catch(() => [])
            ]);

            const priceMap = new Map<string, number>();
            dbPlans.forEach(p => priceMap.set(p.slug.toLowerCase().trim(), Number(p.monthlyPrice || p.yearlyPrice || 0)));

            const revenueMap = new Map<string, number>();
            orgs.forEach(org => {
                const planKey = (org.plan || '').toLowerCase().trim();
                const price = priceMap.get(planKey) || (planKey.includes('enterprise') ? 199 : planKey.includes('pro') ? 49 : 0);
                if (price > 0) {
                    const d = org.createdAt;
                    const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
                    revenueMap.set(key, (revenueMap.get(key) || 0) + price);
                }
            });

            if (revenueMap.size > 0) {
                const data = Array.from(revenueMap.entries()).map(([month, revenue]) => ({
                    month,
                    revenue: Math.floor(revenue)
                }));
                const result = { hasData: true, data };
                setCached(cacheKey, result, 15000);
                return result;
            }

            return { hasData: false, data: [] };
        }

        const isDaily = params?.filter === 'today' || params?.filter === 'yesterday';
        const isWeekly = params?.filter === '7days' || (from && to && (to.getTime() - from.getTime()) <= 31 * 86400000);

        const revenueMap = new Map<string, number>();

        subscriptions.forEach(sub => {
            const date = sub.createdAt;
            const amount = sub.frequency?.toLowerCase() === 'yearly' ? Number(sub.amount) / 12 : Number(sub.amount);
            
            let key = '';
            if (isDaily) {
                key = `${String(date.getHours()).padStart(2, '0')}:00`;
            } else if (isWeekly) {
                key = date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            } else {
                key = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
            }

            revenueMap.set(key, (revenueMap.get(key) || 0) + amount);
        });

        const data = Array.from(revenueMap.entries()).map(([label, revenue]) => ({
            month: label,
            revenue: Math.floor(revenue)
        }));

        const result = { hasData: data.length > 0, data };
        setCached(cacheKey, result, 15000);
        return result;
    } catch (e) {
        return { hasData: false, data: [] };
    }
}

// 3. Subscription & Active Plans Analytics
export async function getSubscriptionAnalytics(params?: DateFilterParams) {
    const cacheKey = `subAnalytics_${params?.filter || 'all'}_${params?.startDate || ''}_${params?.endDate || ''}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const [orgs, dbPlans] = await Promise.all([
            prisma.organization.findMany({
                where: { users: { some: {} }, ...dateCondition },
                select: { plan: true, status: true }
            }),
            prisma.plan.findMany({
                select: { name: true, slug: true }
            }).catch(() => [])
        ]);

        if (orgs.length === 0) {
            return { 
                hasData: false, 
                distribution: [], 
                activeCount: 0, 
                trialCount: 0, 
                expiredCount: 0, 
                total: 0,
                activePercentage: 0,
                trialPercentage: 0,
                expiredPercentage: 0
            };
        }

        const planNameMap = new Map<string, string>();
        dbPlans.forEach(p => {
            planNameMap.set(p.slug.toLowerCase(), p.name);
        });

        const formatPlanName = (rawPlan: string | null) => {
            if (!rawPlan) return 'Free';
            const lower = rawPlan.toLowerCase();
            if (planNameMap.has(lower)) return planNameMap.get(lower)!;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        };

        const planCounts: Record<string, number> = {};
        let activeCount = 0;
        let trialCount = 0;
        let expiredCount = 0;

        orgs.forEach(o => {
            const planFormatted = formatPlanName(o.plan);
            planCounts[planFormatted] = (planCounts[planFormatted] || 0) + 1;

            const st = (o.status || '').toLowerCase();
            if (st === 'active') {
                activeCount++;
            } else if (st === 'trial') {
                trialCount++;
            } else {
                expiredCount++;
            }
        });

        const total = orgs.length;
        const distribution = Object.entries(planCounts).map(([name, count]) => ({
            name,
            value: count,
            percentage: total > 0 ? Math.round((count / total) * 100) : 0
        })).sort((a, b) => b.value - a.value);

        const result = {
            hasData: true,
            total,
            activeCount,
            trialCount,
            expiredCount,
            activePercentage: total > 0 ? Math.round((activeCount / total) * 100) : 0,
            trialPercentage: total > 0 ? Math.round((trialCount / total) * 100) : 0,
            expiredPercentage: total > 0 ? Math.round((expiredCount / total) * 100) : 0,
            distribution
        };

        setCached(cacheKey, result, 15000);
        return result;
    } catch (e) {
        return { 
            hasData: false, 
            distribution: [], 
            activeCount: 0, 
            trialCount: 0, 
            expiredCount: 0, 
            total: 0,
            activePercentage: 0,
            trialPercentage: 0,
            expiredPercentage: 0
        };
    }
}

// 4. WhatsApp / WABA Analytics
export async function getWhatsAppAnalytics(params?: DateFilterParams) {
    const cacheKey = `waAnalytics_${params?.filter || 'all'}_${params?.startDate || ''}_${params?.endDate || ''}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const orgs = await prisma.organization.findMany({
            where: { users: { some: {} }, ...dateCondition },
            select: {
                id: true,
                status: true,
                whatsappPhoneNumberId: true,
                whatsappNumber: true,
                whatsappConnectionMethod: true,
                whatsapp_onboarding_raw_data: true,
                createdAt: true,
            }
        });

        if (!orgs || orgs.length === 0) {
            return { 
                hasData: false,
                active: 0,
                disconnected: 0,
                pending: 0,
                expired: 0,
                total: 0,
                healthScore: 0,
                connected: 0,
                verified: 0
            };
        }

        const total = orgs.length;

        let active = 0;
        let pending = 0;
        let expired = 0;

        for (const org of orgs) {
            const raw = (org.whatsapp_onboarding_raw_data as any) || {};
            const rawStatus = (raw?.phone_info?.status || '').toUpperCase();

            if (rawStatus === 'LIVE' || rawStatus === 'CONNECTED' || rawStatus === 'APPROVED') {
                active++;
            } else if (rawStatus === 'PENDING') {
                pending++;
            } else if (rawStatus === 'BANNED' || rawStatus === 'DISABLED' || rawStatus === 'RESTRICTED') {
                expired++;
            } else if (org.whatsappPhoneNumberId || org.whatsappNumber) {
                active++;
            }
        }

        // Disconnected: all remaining registered accounts
        const disconnected = Math.max(0, total - active - pending - expired);
        const healthScore = total > 0 ? Math.round((active / total) * 100) : 0;

        const result = {
            hasData: total > 0,
            active,
            disconnected,
            pending,
            expired,
            total,
            healthScore,
            connected: active,
            verified: active
        };

        setCached(cacheKey, result, 15000);
        return result;
    } catch (e) {
        console.error("Error fetching WhatsApp analytics:", e);
        return { 
            hasData: false, 
            active: 0, 
            disconnected: 0, 
            pending: 0, 
            expired: 0, 
            total: 0, 
            healthScore: 0, 
            connected: 0, 
            verified: 0 
        };
    }
}

// 5. Live Activity Feed
export async function getLiveActivity(params?: DateFilterParams) {
    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const logs = await prisma.activityLog.findMany({
            where: { ...dateCondition },
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { organization: { select: { name: true } }, user: { select: { name: true, email: true } } }
        });
        return { hasData: logs.length > 0, data: logs };
    } catch (e) {
        return { hasData: false, data: [] };
    }
}

// 6. Recent Vendors
export async function getRecentVendors(params?: DateFilterParams) {
    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const vendors = await prisma.organization.findMany({
            take: 5,
            where: { users: { some: {} }, ...dateCondition },
            orderBy: { createdAt: 'desc' },
            include: { users: { take: 1, select: { name: true, email: true } } }
        });
        
        if (vendors.length === 0) return { hasData: false, data: [] };

        return {
            hasData: true,
            data: vendors.map(v => ({
                id: v.id,
                name: v.name,
                contactPerson: v.users[0]?.name || v.users[0]?.email || 'N/A',
                plan: v.plan || 'Free',
                status: v.status || 'UNKNOWN',
                createdAt: v.createdAt,
                revenue: '-'
            }))
        };
    } catch (e) {
        return { hasData: false, data: [] };
    }
}

// 7. Platform Health
export async function getPlatformHealth() {
    try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbPing = Date.now() - start;

        return {
            hasData: true,
            apiStatus: "Operational",
            dbStatus: "Operational",
            dbPing: `${dbPing}ms`,
        };
    } catch (e) {
        return { hasData: false };
    }
}

// 8. System Logs (Errors & Failures only)
export async function getSystemLogs(params?: DateFilterParams) {
    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const logs = await prisma.activityLog.findMany({
            where: { status: { in: ['failed', 'error', 'warning'] }, ...dateCondition },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });
        return { hasData: logs.length > 0, data: logs };
    } catch (e) {
        return { hasData: false, data: [] };
    }
}

export async function getAiAnalytics() { return { hasData: false } }
export async function getMessageAnalytics() { return { hasData: false } }

// 9. Top Vendors
export async function getTopVendors(params?: DateFilterParams) {
    const cacheKey = `topVendors_${params?.filter || 'all'}_${params?.startDate || ''}_${params?.endDate || ''}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return cached;

    try {
        const { from, to } = getDateBounds(params);
        const dateCondition = from && to ? { createdAt: { gte: from, lte: to } } : {};

        const vendors = await withTimeout(
            prisma.organization.findMany({
                take: 5,
                where: { users: { some: {} }, ...dateCondition },
                orderBy: { contacts: { _count: 'desc' } },
                select: { id: true, name: true, _count: { select: { contacts: true, users: true } } }
            }),
            8000,
            [] as any[]
        );
        if (!vendors || vendors.length === 0) return { hasData: false };
        
        const result = {
            hasData: true,
            data: vendors.map((v, i) => ({
                rank: i + 1,
                id: v.id,
                name: v.name,
                revenue: `${v._count.contacts} Contacts`,
                growth: `${v._count.users} Users`
            }))
        };
        setCached(cacheKey, result, 15000);
        return result;
    } catch (e) {
        return { hasData: false };
    }
}
