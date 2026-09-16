
import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'
import { redactSystemConfig } from'@/lib/api/system-config'

export const dynamic ='force-dynamic'

export async function GET() {
 try {
 const config = await prisma.systemConfig.findFirst({
 orderBy: { createdAt:'asc' }
 })
 return NextResponse.json(redactSystemConfig(config) || {
 currencyCode: "USD",
 currencySymbol: "$",
 currencyName: "U.S. Dollar"
 })
 } catch (error) {
 return NextResponse.json({ error:'Failed to fetch settings' }, { status: 500 })
 }
}

export async function POST(request: Request) {
 try {
 const body = await request.json()
 const existingConfig = await prisma.systemConfig.findFirst({
 orderBy: { createdAt:'asc' }
 })

 let config

 if (existingConfig) {
 config = await prisma.systemConfig.update({
 where: { id: existingConfig.id },
 data: {
 currencyCode: body.currencyCode,
 currencySymbol: body.currencySymbol,
 currencyName: body.currencyName
 }
 })
 } else {
 config = await prisma.systemConfig.create({
 data: {
 currencyCode: body.currencyCode,
 currencySymbol: body.currencySymbol,
 currencyName: body.currencyName,
 platformName: "Wati Bot",
 supportEmail: "info@watibot.pro"
 }
 })
 }

 return NextResponse.json(redactSystemConfig(config))
 } catch (error: any) {
 console.error('Failed to save currency settings:', error)
 return NextResponse.json({ error: error.message ||'Failed to save settings' }, { status: 500 })
 }
}
