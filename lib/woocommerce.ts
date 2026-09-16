import axios from 'axios';
import crypto from 'crypto';

export interface WooCommerceOrder {
  id: number;
  number: string;
  total: string;
  currency: string;
  status: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  billing?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  shipping?: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    total: string;
  }>;
}

/**
 * Test the WooCommerce connection by fetching the latest orders.
 */
export async function testWooCommerceConnection(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
) {
  try {
    const cleanUrl = storeUrl.replace(/\/$/, '');
    const apiUrl = `${cleanUrl}/wp-json/wc/v3/orders`;

    const response = await axios.get(apiUrl, {
      params: {
        per_page: 1,
      },
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('[WooCommerce] Connection test failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Create webhooks in WooCommerce for order events.
 */
export async function createWooCommerceWebhooks(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  webhookSecret: string,
  organizationId: string,
  providedBaseUrl?: string
) {
  const cleanUrl = storeUrl.replace(/\/$/, '');
  const apiUrl = `${cleanUrl}/wp-json/wc/v3/webhooks`;
const baseUrl = (providedBaseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000').replace(/\/$/, '');
  const deliveryUrl = `${baseUrl}/api/webhooks/woocommerce?token=${organizationId}`;

  const webhooksToCreate = [
    { name: 'Watibot: Order Created', topic: 'order.created' },
    { name: 'Watibot: Order Updated', topic: 'order.updated' },
    { name: 'Watibot: Order Deleted', topic: 'order.deleted' },
  ];

  const results = [];

  for (const hook of webhooksToCreate) {
    try {
      const response = await axios.post(apiUrl, {
        name: hook.name,
        topic: hook.topic,
        delivery_url: deliveryUrl,
        secret: webhookSecret,
        status: 'active',
      }, {
        auth: {
          username: consumerKey,
          password: consumerSecret,
        },
      });
      results.push({ topic: hook.topic, success: true, id: response.data.id });
    } catch (error: any) {
      console.error(`[WooCommerce] Failed to create webhook ${hook.topic}:`, error.response?.data || error.message);
      results.push({ topic: hook.topic, success: false, error: error.response?.data?.message || error.message });
    }
  }

  return results;
}

/**
 * Verify WooCommerce webhook signature.
 */
export function verifyWooCommerceWebhook(
  body: string,
  signature: string,
  secret: string
) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return hash === signature;
}

/**
 * Fetch products from WooCommerce.
 */
export async function fetchWooCommerceProducts(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  page = 1,
  perPage = 100
) {
  try {
    const cleanUrl = storeUrl.replace(/\/$/, '');
    const apiUrl = `${cleanUrl}/wp-json/wc/v3/products`;

    const response = await axios.get(apiUrl, {
      params: {
        page,
        per_page: perPage,
      },
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('[WooCommerce] Fetch products failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Fetch orders from WooCommerce.
 */
export async function fetchWooCommerceOrders(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  page = 1,
  perPage = 50
) {
  try {
    const cleanUrl = storeUrl.replace(/\/$/, '');
    const apiUrl = `${cleanUrl}/wp-json/wc/v3/orders`;

    const response = await axios.get(apiUrl, {
      params: {
        page,
        per_page: perPage,
      },
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('[WooCommerce] Fetch orders failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}
 
export async function updateWooCommerceOrder(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  orderId: string,
  data: any
) {
  try {
    const cleanUrl = storeUrl.replace(/\/$/, '');
    const apiUrl = `${cleanUrl}/wp-json/wc/v3/orders/${orderId}`;

    const response = await axios.put(apiUrl, data, {
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(`[WooCommerce] Update order ${orderId} failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

export async function addNoteToWooCommerceOrder(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  orderId: string,
  note: string,
  isCustomerNote = false
) {
  try {
    const cleanUrl = storeUrl.replace(/\/$/, '');
    const apiUrl = `${cleanUrl}/wp-json/wc/v3/orders/${orderId}/notes`;

    const response = await axios.post(apiUrl, {
      note,
      customer_note: isCustomerNote
    }, {
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(`[WooCommerce] Add note to order ${orderId} failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}
