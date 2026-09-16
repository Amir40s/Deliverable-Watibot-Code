import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getPlanSlugAliases } from "@/lib/plan-slugs";

export async function POST(req: Request) {
 try {
 // Fetch Stripe Configuration from Database
 const config = await prisma.systemConfig.findFirst({
 orderBy: { updatedAt:'desc' }
 });

 const stripeSecretKey = config?.stripeSecretKey || process.env.STRIPE_SECRET_KEY;

 if (!stripeSecretKey) {
 console.error("Stripe Secret Key not found in DB or ENV");
 return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
 }

 const stripe = new Stripe(stripeSecretKey, {
 apiVersion: "2026-03-25.dahlia",
 });

 const session = await getServerSession(authOptions);
 
 // Auth Validation
 if (!session || !session.user || !session.user.organizationId) {
 return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }

 const { planSlug, billingCycle } = await req.json();

 if (!planSlug || !billingCycle) {
 return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
 }

 // Attempt to locate the dynamic target plan, accepting legacy short slugs too.
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
 return NextResponse.json({ error: "Free plans should be activated internally without Stripe" }, { status: 400 });
 }

 const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

 const checkoutSession = await stripe.checkout.sessions.create({
 payment_method_types: ["card"],
 mode: "subscription",
 customer_email: session.user.email || undefined,
 line_items: [
 {
 price_data: {
 currency: targetPlan.currency.toLowerCase(),
 product_data: {
 name:`Watibot ${targetPlan.name} Plan`,
 description:`Subscription to Watibot ${targetPlan.name} Plan (${billingCycle})`,
 },
 unit_amount: Math.round(Number(priceAmount) * 100), // convert to cents 
 recurring: {
 interval: billingCycle === 'yearly' ? 'year' : 'month',
 interval_count: billingCycle === 'quarterly' ? 3 : 1,
 },
 },
 quantity: 1,
 },
 ],
 metadata: {
 organizationId: session.user.organizationId,
 planSlug: targetPlan.slug,
 billingCycle: billingCycle,
 userId: session.user.id
 },
 success_url:`${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
 cancel_url:`${origin}/dashboard?checkout=cancelled`,
 });

 return NextResponse.json({ url: checkoutSession.url });

 } catch (error: any) {
 console.error("Stripe Checkout Error:", error);
 return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
 }
}
