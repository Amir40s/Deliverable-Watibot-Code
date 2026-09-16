import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activatePlanForOrganization } from "@/lib/subscription";
import {
  getPayFastErrCode,
  getPayloadValue,
  isPayFastSuccess,
  resolvePayFastSettings,
  verifyPayFastValidationHash,
} from "@/lib/payfast";

export const dynamic = "force-dynamic";

async function parsePayFastRequest(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await req.json()) as Record<string, any>;
  }

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);
  if (Array.from(params.keys()).length > 0) {
    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(rawBody) as Record<string, any>;
  } catch {
    return {};
  }
}

function resolveReturnLocale(req: Request) {
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") || "en";
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : "en";
}

function redirectToDashboard(req: Request, checkout: "success" | "cancelled" | "failed") {
  const url = new URL(req.url);
  const redirectUrl = new URL(`/${resolveReturnLocale(req)}/dashboard`, url.origin);
  redirectUrl.searchParams.set("checkout", checkout);
  redirectUrl.searchParams.set("provider", "payfast");
  return NextResponse.redirect(redirectUrl);
}

async function handlePayFastPayload(payload: Record<string, any>) {
  const basketId = getPayloadValue(payload, ["basket_id", "BASKET_ID"]);
  if (!basketId) {
    return { processed: false, success: false, status: 400, error: "Missing PayFast basket ID" };
  }

  const payment = await prisma.paymentTransaction.findUnique({
    where: { basketId },
  });

  if (!payment) {
    return { processed: false, success: false, status: 404, error: "Unknown PayFast payment" };
  }

  const config = (await prisma.systemConfig.findFirst({ orderBy: { updatedAt: "desc" } })) as any;
  const settings = resolvePayFastSettings(config);
  const success = isPayFastSuccess(payload);
  const errCode = getPayFastErrCode(payload);
  const validationHash = getPayloadValue(payload, ["validation_hash", "VALIDATION_HASH"]);

  if (success && !verifyPayFastValidationHash({ settings, basketId, errCode, validationHash })) {
    return { processed: false, success: false, status: 401, error: "Invalid PayFast validation hash" };
  }

  const gatewayTransactionId = getPayloadValue(payload, [
    "transaction_id",
    "TRANSACTION_ID",
    "txn_id",
    "TXN_ID",
    "transaction_reference",
    "TRANSACTION_REFERENCE",
  ]);

  if (!success) {
    if (payment.status !== "paid") {
      await prisma.paymentTransaction.update({
        where: { basketId },
        data: {
          status: "failed",
          gatewayTransactionId: gatewayTransactionId || payment.gatewayTransactionId,
          rawPayload: payload,
        },
      });
    }
    return { processed: true, success: false, status: 200 };
  }

  if (payment.status === "paid") {
    return { processed: true, success: true, status: 200 };
  }

  await prisma.paymentTransaction.update({
    where: { basketId },
    data: {
      status: "paid",
      gatewayTransactionId: gatewayTransactionId || payment.gatewayTransactionId,
      rawPayload: payload,
    },
  });

  await activatePlanForOrganization(payment.organizationId, payment.planSlug, {
    billingCycle: payment.billingCycle,
    amount: Number(payment.amount),
    currency: payment.currency,
    provider: 'PayFast',
  });

  return { processed: true, success: true, status: 200 };
}

export async function POST(req: Request) {
  try {
    const payload = await parsePayFastRequest(req);
    const result = await handlePayFastPayload(payload);

    if (!result.processed && result.status >= 400) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ received: true, success: result.success }, { status: 200 });
  } catch (error: any) {
    console.error("PayFast Webhook Error:", error);
    return NextResponse.json({ error: "Internal webhook error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const payload = Object.fromEntries(url.searchParams.entries());
  const requestedRedirect = url.searchParams.get("redirect");

  try {
    const result = await handlePayFastPayload(payload);
    if (requestedRedirect) {
      if (result.success) return redirectToDashboard(req, "success");
      return redirectToDashboard(req, requestedRedirect === "failure" ? "cancelled" : "failed");
    }

    if (!result.processed && result.status >= 400) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ received: true, success: result.success }, { status: 200 });
  } catch (error: any) {
    console.error("PayFast Return Error:", error);
    if (requestedRedirect) {
      return redirectToDashboard(req, "failed");
    }
    return NextResponse.json({ error: "Internal return error" }, { status: 500 });
  }
}
