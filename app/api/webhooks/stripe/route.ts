import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { activatePlanForOrganization } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
 console.log("Stripe Webhook received");
 
 try {
 // Fetch Configuration from Database
 const config = await prisma.systemConfig.findFirst({
 orderBy: { updatedAt:'desc' }
 });

 const stripeSecretKey = config?.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
 const webhookSecret = config?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

 if (!stripeSecretKey || !webhookSecret) {
 console.error("Stripe keys or Webhook Secret missing in DB and ENV");
 return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
 }

 const stripe = new Stripe(stripeSecretKey, {
 apiVersion: "2026-03-25.dahlia",
 });

 const body = await req.text();
 const headersList = await headers();
 const signature = headersList.get("stripe-signature") as string;

 if (!signature) {
 console.error("No stripe-signature header found");
 return NextResponse.json({ error: "No signature" }, { status: 400 });
 }

 let event: Stripe.Event;

 try {
 event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
 } catch (err: any) {
 console.error(`Webhook signature verification failed.`, err.message);
 return NextResponse.json({ error: err.message }, { status: 400 });
 }

 if (event.type ==='checkout.session.completed') {
 const session = event.data.object as Stripe.Checkout.Session;
 
 const organizationId = session.metadata?.organizationId;
 const planSlug = session.metadata?.planSlug;
 const billingCycle = session.metadata?.billingCycle;
 
  if (organizationId && planSlug) {
    // Activate the organization plan, set limits, and create/update subscription linked to organization
    await activatePlanForOrganization(organizationId, planSlug, {
      billingCycle: billingCycle || 'monthly',
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || 'USD',
      provider: 'Stripe',
    });
  }
 }

 return NextResponse.json({ received: true }, { status: 200 });
 } catch (error: any) {
 console.error("Stripe Webhook Error:", error);
 return NextResponse.json({ error: "Internal webhook error" }, { status: 500 });
 }
}
