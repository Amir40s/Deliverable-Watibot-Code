import { prisma } from "@/lib/prisma";

let cachedConfig: any = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds memory cache

export async function getSystemConfig() {
    const now = Date.now();
    if (cachedConfig && (now - lastFetchTime) < CACHE_TTL_MS) {
        return cachedConfig;
    }

    try {
        const config = await prisma.systemConfig.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        if (config) {
            cachedConfig = config;
            lastFetchTime = now;
        }
        return config || cachedConfig;
    } catch (error) {
        console.error("[Config] Failed to fetch system config:", error);
        return cachedConfig;
    }
}
