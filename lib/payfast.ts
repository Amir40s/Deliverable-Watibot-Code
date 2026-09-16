import crypto from "crypto";

type PayFastEnvironment = "sandbox" | "production";

export type PayFastSettings = {
  enabled: boolean;
  merchantId: string;
  merchantName: string;
  securedKey: string;
  environment: PayFastEnvironment;
  tokenUrl: string;
  checkoutUrl: string;
  currencyCode: string;
  storeId: string;
  defaultCustomerMobile: string;
};

type RawSystemConfig = Record<string, any> | null | undefined;

const DEFAULT_URLS: Record<PayFastEnvironment, { tokenUrl: string; checkoutUrl: string }> = {
  sandbox: {
    tokenUrl: "https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken",
    checkoutUrl: "https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction",
  },
  production: {
    tokenUrl: "https://ipg1.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken",
    checkoutUrl: "https://ipg1.apps.net.pk/Ecommerce/api/Transaction/PostTransaction",
  },
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveEnvironment(value: unknown): PayFastEnvironment {
  return clean(value).toLowerCase() === "production" ? "production" : "sandbox";
}

export function resolvePayFastSettings(config: RawSystemConfig): PayFastSettings {
  const environment = resolveEnvironment(config?.payfastEnvironment || process.env.PAYFAST_ENVIRONMENT);
  const defaults = DEFAULT_URLS[environment];

  const merchantId =
    clean(config?.payfastMerchantId) ||
    clean(process.env.PAYFAST_MERCHANT_ID) ||
    clean(process.env.GOFASTPAY_MERCHANT_ID);
  const securedKey =
    clean(config?.payfastSecuredKey) ||
    clean(process.env.PAYFAST_SECURED_KEY) ||
    clean(process.env.GOFASTPAY_SECURED_KEY) ||
    clean(process.env.GOFASTPAY_SIGNING_SECRET);
  const hasDbCredentials = Boolean(clean(config?.payfastMerchantId) || clean(config?.payfastSecuredKey));
  const envEnabled =
    process.env.PAYFAST_ENABLED === "true" ||
    process.env.GOFASTPAY_ENABLED === "true" ||
    (!hasDbCredentials && Boolean(merchantId && securedKey));

  return {
    enabled: Boolean(config?.payfastEnabled ?? envEnabled),
    merchantId,
    merchantName: clean(config?.payfastMerchantName) || clean(process.env.PAYFAST_MERCHANT_NAME) || "Watibot",
    securedKey,
    environment,
    tokenUrl:
      clean(config?.payfastTokenUrl) ||
      clean(process.env.PAYFAST_TOKEN_URL) ||
      (environment === "sandbox" ? clean(process.env.GOFASTPAY_TOKEN_URL) : "") ||
      defaults.tokenUrl,
    checkoutUrl:
      clean(config?.payfastCheckoutUrl) ||
      clean(process.env.PAYFAST_CHECKOUT_URL) ||
      clean(process.env.GOFASTPAY_CHECKOUT_URL) ||
      defaults.checkoutUrl,
    currencyCode: clean(config?.payfastCurrencyCode || process.env.PAYFAST_CURRENCY_CODE || "PKR").toUpperCase(),
    storeId: clean(config?.payfastStoreId || process.env.PAYFAST_STORE_ID),
    defaultCustomerMobile: clean(config?.payfastDefaultCustomerMobile || process.env.PAYFAST_DEFAULT_CUSTOMER_MOBILE),
  };
}

export function assertPayFastConfigured(settings: PayFastSettings) {
  if (!settings.enabled) {
    throw new Error("PayFast is not available");
  }
  if (!settings.merchantId || !settings.securedKey || !settings.tokenUrl || !settings.checkoutUrl) {
    throw new Error("PayFast is not configured. Add Merchant ID, Secured Key, token URL, and checkout URL in Super Admin.");
  }
}

export function createPayFastBasketId() {
  return `WB-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function normalizePayFastMobile(rawValue: string) {
  const digits = clean(rawValue).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92") && digits.length >= 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("3") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

export async function getPayFastAccessToken(params: {
  settings: PayFastSettings;
  basketId: string;
  amount: string;
  currencyCode: string;
}) {
  const body = new URLSearchParams({
    MERCHANT_ID: params.settings.merchantId,
    SECURED_KEY: params.settings.securedKey,
    BASKET_ID: params.basketId,
    TXNAMT: params.amount,
    CURRENCY_CODE: params.currencyCode,
  });

  const response = await fetch(params.settings.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Watibot PayFast Checkout",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const responseText = await response.text();
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = {};
  }

  const token = clean(payload.ACCESS_TOKEN || payload.access_token || payload.token);
  if (!response.ok || !token) {
    throw new Error(payload?.message || payload?.status_msg || responseText || "Unable to get PayFast access token.");
  }

  return token;
}

export function buildPayFastCheckoutFields(params: {
  settings: PayFastSettings;
  token: string;
  basketId: string;
  amount: string;
  currencyCode: string;
  customerEmail: string;
  customerMobile: string;
  description: string;
  successUrl: string;
  failureUrl: string;
  checkoutUrl: string;
  merchantCustomerId?: string;
}) {
  const fields: Record<string, string> = {
    CURRENCY_CODE: params.currencyCode,
    MERCHANT_ID: params.settings.merchantId,
    MERCHANT_NAME: params.settings.merchantName,
    TOKEN: params.token,
    BASKET_ID: params.basketId,
    TXNAMT: params.amount,
    ORDER_DATE: new Date().toISOString().replace("T", " ").slice(0, 19),
    SUCCESS_URL: params.successUrl,
    FAILURE_URL: params.failureUrl,
    CHECKOUT_URL: params.checkoutUrl,
    CUSTOMER_EMAIL_ADDRESS: params.customerEmail,
    CUSTOMER_MOBILE_NO: params.customerMobile,
    SIGNATURE: crypto.randomBytes(12).toString("hex"),
    VERSION: "WATIBOT-1.0",
    TXNDESC: params.description,
    PROCCODE: "00",
    TRAN_TYPE: "ECOMM_PURCHASE",
    STORE_ID: params.settings.storeId,
    RECURRING_TXN: "",
  };

  if (params.merchantCustomerId) {
    fields.MERCHANT_CUSTOMER_ID = params.merchantCustomerId;
  }

  return fields;
}

export function getPayloadValue(payload: Record<string, any>, keys: string[]) {
  const entries = Object.entries(payload);
  for (const key of keys) {
    const direct = payload[key];
    if (direct !== undefined && direct !== null) return String(direct);

    const found = entries.find(([entryKey]) => entryKey.toLowerCase() === key.toLowerCase());
    if (found && found[1] !== undefined && found[1] !== null) return String(found[1]);
  }
  return "";
}

export function getPayFastErrCode(payload: Record<string, any>) {
  return getPayloadValue(payload, ["err_code", "ERR_CODE", "status_code", "STATUS_CODE", "code", "CODE"]);
}

export function isPayFastSuccess(payload: Record<string, any>) {
  const errCode = getPayFastErrCode(payload);
  const status = getPayloadValue(payload, ["status", "payment_status", "status_msg"]).toLowerCase();
  return errCode === "000" || errCode === "00" || status === "success" || status === "paid";
}

export function verifyPayFastValidationHash(params: {
  settings: PayFastSettings;
  basketId: string;
  errCode: string;
  validationHash: string;
}) {
  const incoming = clean(params.validationHash).toLowerCase();
  if (!incoming) return false;

  const source = `${params.basketId}|${params.settings.securedKey}|${params.settings.merchantId}|${params.errCode}`;
  const expected = crypto.createHash("sha256").update(source).digest("hex");
  if (incoming.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
}
