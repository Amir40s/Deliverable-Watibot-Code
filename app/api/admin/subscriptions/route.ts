
import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'

export const dynamic ='force-dynamic'

export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      }
    });

    const orgMap = new Map(orgs.map(o => [o.id, o.name]));

    const dbPlans = await prisma.plan.findMany({
      select: { name: true, slug: true }
    });

    const planMap = new Map<string, string>();
    for (const p of dbPlans) {
      planMap.set(p.slug.toLowerCase().trim(), p.name);
    }

    const mapped = subscriptions.map((sub: any) => {
      const rawPlan = (sub.plan || "free").toLowerCase().trim();
      const planName = planMap.get(rawPlan) || rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);
      return {
        ...sub,
        vendor: orgMap.get(sub.vendor) || sub.vendor,
        planName
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
 try {
 const body = await request.json()
 const subscription = await prisma.subscription.create({
 data: {
 vendor: body.vendor,
 isAuto: body.isAuto,
 plan: body.plan,
 startDate: new Date(body.startDate),
 endDate: new Date(body.endDate),
 amount: body.amount,
 currency: body.currency,
 frequency: body.frequency,
 status: body.status,
 }
 })
 return NextResponse.json(subscription)
 } catch (error) {
 console.error('Failed to create subscription:', error)
 return NextResponse.json({ error:'Failed to create subscription' }, { status: 500 })
 }
}
