
import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'
import { redactSystemConfig } from'@/lib/api/system-config'

export const dynamic ='force-dynamic'

export async function GET() {
 try {
 const config = await prisma.systemConfig.findFirst({
 orderBy: { createdAt:'desc' }
 })
 return NextResponse.json(redactSystemConfig(config) || {
 enableVendorRegistration: true,
 vendorEmailActivation: false,
 sendWelcomeEmail: false,
 })
 } catch (error) {
 console.error('Failed to fetch user settings:', error)
 return NextResponse.json({ error:'Failed to fetch settings' }, { status: 500 })
 }
}

export async function POST(request: Request) {
 try {
 const body = await request.json()
 const existingConfig = await prisma.systemConfig.findFirst()

 let config

 const updateData = {
 enableVendorRegistration: Boolean(body.enableVendorRegistration),
 vendorEmailActivation: Boolean(body.vendorEmailActivation),
 sendWelcomeEmail: Boolean(body.sendWelcomeEmail),
 }

 if (existingConfig) {
 config = await prisma.systemConfig.update({
 where: { id: existingConfig.id },
 data: updateData
 })
 } else {
 config = await prisma.systemConfig.create({
 data: updateData
 })
 }

 return NextResponse.json(redactSystemConfig(config))
 } catch (error) {
 console.error('Failed to save user settings:', error)
 return NextResponse.json({ error:'Failed to save settings' }, { status: 500 })
 }
}
