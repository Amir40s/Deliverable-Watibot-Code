import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'
import { redactSystemConfig } from'@/lib/api/system-config'

export const dynamic ='force-dynamic'

export async function GET() {
 try {
 const config = await prisma.systemConfig.findFirst({
 orderBy: { createdAt:'asc' }
 })
 return NextResponse.json(redactSystemConfig(config) || {})
 } catch (error) {
 return NextResponse.json({ error:'Failed to fetch misc settings' }, { status: 500 })
 }
}

export async function POST(request: Request) {
 try {
 const body = await request.json()
 
 // Basic sanitation for headCode
 if (body.headCode !== undefined) {
 body.headCode = String(body.headCode).trim()
 }

 const existingConfig = await prisma.systemConfig.findFirst({
 orderBy: { createdAt:'asc' }
 })

 let config

 if (existingConfig) {
 config = await prisma.systemConfig.update({
 where: { id: existingConfig.id },
 data: body
 })
 } else {
 config = await prisma.systemConfig.create({
 data: {
 ...body,
 platformName: "Wati Bot",
 supportEmail: "info@watibot.pro"
 }
 })
 }

 return NextResponse.json(redactSystemConfig(config))
 } catch (error: any) {
 console.error('Failed to save misc settings:', error)
 return NextResponse.json({ error: error.message ||'Failed to save settings' }, { status: 500 })
 }
}
