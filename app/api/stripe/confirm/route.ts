import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activatePlanForOrganization } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function getExpandedSubscription(subscription: Stripe.Checkout.Session["subscription"]) {
  if (!subscription || typeof subscription === "string") return null;
  return subscription as Stripe.Subscription;
}

function getSessionAmount(session: Stripe.Checkout.Session) {
  if (typeof session.amount_total === "number") {
    return session.amount_total / 100;
  }

  const subscription = getExpandedSubscription(session.subscription);
  const unitAmount = subscription?.items.data[0]?.price.unit_amount;
  return typeof unitAmount === "number" ? unitAmount / 100 : 0;
}

export async function POST(req: Request) {
  try {
    const userSession = await getServerSession(authOptions);

    if (!userSession?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();

    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid Stripe session" }, { status: 400 });
    }

    const config = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const stripeSecretKey = config?.stripeSecretKey || process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    });

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const organizationId = checkoutSession.metadata?.organizationId;
    const planSlug = checkoutSession.metadata?.planSlug;
    const billingCycle = checkoutSession.metadata?.billingCycle || "monthly";

    if (organizationId !== userSession.user.organizationId) {
      return NextResponse.json({ error: "Stripe session does not belong to this account" }, { status: 403 });
    }

    if (!planSlug) {
      return NextResponse.json({ error: "Stripe session is missing plan metadata" }, { status: 400 });
    }

    if (checkoutSession.mode !== "subscription") {
      return NextResponse.json({ error: "Stripe session is not a subscription checkout" }, { status: 400 });
    }

    const subscription = getExpandedSubscription(checkoutSession.subscription);
    const isPaidCheckout =
      checkoutSession.status === "complete" &&
      checkoutSession.payment_status === "paid";

    if (!isPaidCheckout) {
      return NextResponse.json({ error: "Stripe checkout has not completed payment" }, { status: 409 });
    }

    await activatePlanForOrganization(organizationId, planSlug, {
      billingCycle,
      amount: getSessionAmount(checkoutSession),
      currency: (checkoutSession.currency || subscription?.currency || "USD").toUpperCase(),
      provider: "Stripe",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quota");

    return NextResponse.json({
      success: true,
      planSlug,
      billingCycle,
    });
  } catch (error: unknown) {
    console.error("Stripe Confirm Error:", error);
    const message = error instanceof Error ? error.message : "Unable to confirm Stripe payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
