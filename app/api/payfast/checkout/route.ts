import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanSlugAliases } from "@/lib/plan-slugs";
import {
  assertPayFastConfigured,
  buildPayFastCheckoutFields,
  createPayFastBasketId,
  getPayFastAccessToken,
  normalizePayFastMobile,
  resolvePayFastSettings,
} from "@/lib/payfast";

export const dynamic = "force-dynamic";

function resolveReturnLocale(locale: unknown) {
  const value = typeof locale === "string" ? locale.trim() : "";
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(value) ? value : "en";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planSlug, billingCycle, locale } = await req.json();
    if (!planSlug || !billingCycle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const targetPlan = await prisma.plan.findFirst({
      where: { slug: { in: getPlanSlugAliases(planSlug) } },
    });

    if (!targetPlan) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    const priceAmount =
      billingCycle === 'monthly' ? targetPlan.monthlyPrice
      : billingCycle === 'quarterly' ? (targetPlan as any).quarterlyPrice
      : targetPlan.yearlyPrice;

    if (!priceAmount || Number(priceAmount) === 0) {
      return NextResponse.json(
        { error: "Free plans should be activated internally without PayFast" },
        { status: 400 }
      );
    }

    const config = (await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: "desc" },
    })) as any;
    const settings = resolvePayFastSettings(config);
    assertPayFastConfigured(settings);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        phoneNumber: true,
        organization: {
          select: { whatsappNumber: true },
        },
      },
    });

    const customerEmail = user?.email || session.user.email || config?.adminEmail || config?.supportEmail || "";
    if (!customerEmail) {
      return NextResponse.json({ error: "Customer email is required for PayFast checkout." }, { status: 400 });
    }

    const customerMobile = normalizePayFastMobile(
      user?.phoneNumber || user?.organization?.whatsappNumber || settings.defaultCustomerMobile
    );
    if (!customerMobile) {
      return NextResponse.json(
        {
          error:
            "Customer mobile number is required for PayFast checkout. Add a user phone number or PayFast fallback mobile in Super Admin.",
        },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const returnLocale = resolveReturnLocale(locale);
    const basketId = createPayFastBasketId();
    const amount = Number(priceAmount).toFixed(2);
    const currencyCode = (targetPlan.currency || settings.currencyCode || "PKR").toUpperCase();

    const token = await getPayFastAccessToken({
      settings,
      basketId,
      amount,
      currencyCode,
    });

    await prisma.paymentTransaction.create({
      data: {
        provider: "PayFast",
        basketId,
        organizationId: session.user.organizationId,
        userId: session.user.id,
        planSlug: targetPlan.slug,
        billingCycle,
        amount: Number(amount),
        currency: currencyCode,
        status: "pending",
      },
    });

    const callbackBaseUrl = `${origin}/api/webhooks/payfast`;
    const successUrl = `${callbackBaseUrl}?redirect=success&locale=${encodeURIComponent(returnLocale)}`;
    const failureUrl = `${callbackBaseUrl}?redirect=failure&locale=${encodeURIComponent(returnLocale)}`;

    const formFields = buildPayFastCheckoutFields({
      settings,
      token,
      basketId,
      amount,
      currencyCode,
      customerEmail,
      customerMobile,
      description: `Watibot ${targetPlan.name} Plan (${billingCycle})`,
      successUrl,
      failureUrl,
      checkoutUrl: callbackBaseUrl,
      merchantCustomerId: session.user.organizationId,
    });

    return NextResponse.json({
      provider: "payfast",
      formAction: settings.checkoutUrl,
      formMethod: "POST",
      formFields,
    });
  } catch (error: any) {
    console.error("PayFast Checkout Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
