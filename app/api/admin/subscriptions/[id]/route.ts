
import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'

export async function PUT(
 request: Request,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 const { id } = await params
 const body = await request.json()
 const subscription = await prisma.subscription.update({
 where: {
 id: id
 },
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
 console.error('Failed to update subscription:', error)
 return NextResponse.json({ error:'Failed to update subscription', details: (error as Error).message }, { status: 500 })
 }
}

export async function DELETE(
 request: Request,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 const { id } = await params
 await prisma.subscription.delete({
 where: {
 id: id
 }
 })
 return NextResponse.json({ success: true })
 } catch (error) {
 console.error('Failed to delete subscription:', error)
 return NextResponse.json({ error:'Failed to delete subscription', details: (error as Error).message }, { status: 500 })
 }
}
