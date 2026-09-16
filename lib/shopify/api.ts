import { prisma } from "@/lib/prisma";

async function refreshShopifyToken(shop: string, key: string, organizationId: string) {
    try {
        const shopifyAppUrl = process.env.SHOPIFY_APP_URL || "https://watibotapp.vercel.app";
        console.log(`>>> [Refresh] Requesting background token refresh for ${shop} from ${shopifyAppUrl}...`);
        
        const res = await fetch(`${shopifyAppUrl}/api/refresh-token?shop=${shop}&key=${key}`);
        if (!res.ok) {
            const err = await res.text();
            console.error(`>>> [Refresh] Failed:`, err);
            return null;
        }
        
        // Wait a bit for DB to sync
        await new Promise(resolve => setTimeout(resolve, 1000));

        const updatedOrg = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { shopifyAccessToken: true }
        });

        return updatedOrg?.shopifyAccessToken;
    } catch (e: any) {
        console.error(`>>> [Refresh] Error:`, e.message);
        return null;
    }
}

export async function callShopifyAPI(params: {
    organizationId: string;
    endpoint: string;
    method?: string;
    body?: any;
}) {
    const { organizationId, endpoint, method = "GET", body } = params;

    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { shopifyStoreUrl: true, shopifyAccessToken: true, shopifyIntegrationToken: true }
    });

    if (!org?.shopifyStoreUrl || !org?.shopifyAccessToken) {
        throw new Error("Shopify not configured");
    }

    const executeFetch = async (token: string) => {
        return fetch(`https://${org.shopifyStoreUrl}/admin/api/2024-07/${endpoint}`, {
            method,
            headers: {
                "X-Shopify-Access-Token": token,
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined
        });
    };

    let response = await executeFetch(org.shopifyAccessToken);

    if (response.status === 401 && org.shopifyIntegrationToken) {
        console.log(`>>> [ShopifyAPI] 401 Detected for ${org.shopifyStoreUrl}. Refreshing...`);
        const newToken = await refreshShopifyToken(org.shopifyStoreUrl, org.shopifyIntegrationToken, organizationId);
        
        if (newToken) {
            console.log(">>> [ShopifyAPI] Retrying with refreshed token...");
            response = await executeFetch(newToken);
        }
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Shopify API Error (${response.status}): ${errText}`);
    }

    return response.json();
}

export async function addTagToShopifyOrder(params: {
    organizationId: string;
    orderId: string;
    tag: string;
}) {
    const { organizationId, orderId, tag } = params;
    const cleanOrderId = String(orderId).replace(/gid:\/\/shopify\/Order\//g, "").replace(/\D/g, "") || String(orderId);

    // 1. Get current tags
    const orderData = await callShopifyAPI({
        organizationId,
        endpoint: `orders/${cleanOrderId}.json?fields=tags`,
    });

    const currentTags = orderData.order?.tags || "";
    const tagsArray = currentTags ? currentTags.split(",").map((t: string) => t.trim()) : [];

    const tagExists = tagsArray.some((t: string) => t.toLowerCase() === tag.toLowerCase());

    if (!tagExists) {
        tagsArray.push(tag);
        const newTags = tagsArray.join(", ");

        // 2. Update tags
        await callShopifyAPI({
            organizationId,
            endpoint: `orders/${cleanOrderId}.json`,
            method: "PUT",
            body: {
                order: {
                    tags: newTags,
                },
            },
        });
        console.log(`>>> [ShopifyAction] Tag "${tag}" added to order ${cleanOrderId}`);
    }
}

export async function cancelShopifyOrder(params: {
    organizationId: string;
    orderId: string;
    reason?: string;
}) {
    const { organizationId, orderId, reason = "customer" } = params;
    const cleanOrderId = String(orderId).replace(/gid:\/\/shopify\/Order\//g, "").replace(/\D/g, "") || String(orderId);

    return callShopifyAPI({
        organizationId,
        endpoint: `orders/${cleanOrderId}/cancel.json`,
        method: "POST",
        body: {
            reason,
        },
    });
}

export async function closeShopifyOrder(params: {
    organizationId: string;
    orderId: string;
}) {
    const { organizationId, orderId } = params;
    const cleanOrderId = String(orderId).replace(/gid:\/\/shopify\/Order\//g, "").replace(/\D/g, "") || String(orderId);

    return callShopifyAPI({
        organizationId,
        endpoint: `orders/${cleanOrderId}/close.json`,
        method: "POST",
    });
}

export async function openShopifyOrder(params: {
    organizationId: string;
    orderId: string;
}) {
    const { organizationId, orderId } = params;
    const cleanOrderId = String(orderId).replace(/gid:\/\/shopify\/Order\//g, "").replace(/\D/g, "") || String(orderId);

    return callShopifyAPI({
        organizationId,
        endpoint: `orders/${cleanOrderId}/open.json`,
        method: "POST",
    });
}

export async function removeTagFromShopifyOrder(params: {
    organizationId: string;
    orderId: string;
    tag: string;
}) {
    const { organizationId, orderId, tag } = params;
    const cleanOrderId = String(orderId).replace(/gid:\/\/shopify\/Order\//g, "").replace(/\D/g, "") || String(orderId);

    const orderData = await callShopifyAPI({
        organizationId,
        endpoint: `orders/${cleanOrderId}.json?fields=tags`,
    });

    const currentTags = orderData.order?.tags || "";
    const tagsArray = currentTags ? currentTags.split(",").map((t: string) => t.trim()) : [];

    const newTagsArray = tagsArray.filter((t: string) => t.toLowerCase() !== tag.toLowerCase());

    if (tagsArray.length !== newTagsArray.length) {
        const newTags = newTagsArray.join(", ");

        await callShopifyAPI({
            organizationId,
            endpoint: `orders/${cleanOrderId}.json`,
            method: "PUT",
            body: {
                order: {
                    tags: newTags,
                },
            },
        });
        console.log(`>>> [ShopifyAction] Tag "${tag}" removed from order ${cleanOrderId}`);
    }
}


