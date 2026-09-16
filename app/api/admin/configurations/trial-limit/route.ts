
import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'
import fs from'fs'
import path from'path'

export const dynamic ='force-dynamic'

// Use a simple log file in the tmp directory to catch errors
const LOG_FILE = path.join(process.cwd(),'tmp','api_error.log')

function logError(msg: string, err: any) {
 const timestamp = new Date().toISOString()
 const logEntry =`[${timestamp}] ${msg}: ${err?.message || err}\n${err?.stack ||''}\n\n`
 try {
 const tmpDir = path.join(process.cwd(),'tmp')
 if (!fs.existsSync(tmpDir)) {
 fs.mkdirSync(tmpDir, { recursive: true })
 }
 fs.appendFileSync(LOG_FILE, logEntry)
 } catch (e) {
 console.error('Failed to write to log file:', e)
 }
}

export async function GET() {
 try {
 const config = await prisma.systemConfig.findFirst()
 const trialLimitDays = config?.trialLimitDays ?? 15

 // Fetch all trial users with their organizations
 const trialUsers = await prisma.user.findMany({
 where: { status:'TRIAL' },
 include: {
 organization: {
 select: {
 id: true,
 name: true,
 slug: true,
 whatsappNumber: true,
 plan: true,
 createdAt: true,
 status: true
 }
 }
 },
 orderBy: { createdAt:'desc' }
 })

 return NextResponse.json({ 
 trialLimitDays,
 trialUsers: trialUsers.map(user => {
 const effectiveLimit = user.trialLimitDays ?? trialLimitDays
 const startDate = user.trialStartDate || user.createdAt
 const diffTime = Math.abs(new Date().getTime() - new Date(startDate).getTime())
 const daysUsed = Math.floor(diffTime / (1000 * 60 * 60 * 24))
 const daysRemaining = Math.max(0, effectiveLimit - daysUsed)

 // Prepare a "vendor" object compatible with VendorDetailsSheet
 const vendor = user.organization ? {
 id: user.organization.id,
 title: user.organization.name,
 username: user.organization.slug,
 whatsappNumber: user.organization.whatsappNumber,
 plan: user.organization.plan,
 status: user.status, // Use user status as it's the source of truth for trial
 createdAt: user.organization.createdAt.toISOString(),
 adminUser: {
 id: user.id,
 name: user.name,
 email: user.email,
 status: user.status
 }
 } : null;

 return {
 id: user.id,
 name: user.name,
 email: user.email,
 createdAt: user.createdAt,
 status: user.status,
 effectiveLimit,
 daysUsed,
 daysRemaining,
 percentUsed: Math.min(100, Math.round((daysUsed / effectiveLimit) * 100)),
 vendor
 }
 })
 })
 } catch (error) {
 logError('GET Trial Limit Failed', error)
 return NextResponse.json({ error:'Failed to fetch settings' }, { status: 500 })
 }
}

export async function PATCH(request: Request) {
 try {
 const body = await request.json()
 const { userId, status } = body

 if (!userId || !status) {
 return NextResponse.json({ error:'User ID and status are required' }, { status: 400 })
 }

 await prisma.user.update({
 where: { id: userId },
 data: { 
 status: status,
 // If moving to ACTIVE, we might want to preserve trialStartDate for history 
 // but usually status change is enough.
 }
 })

 return NextResponse.json({ success: true })
 } catch (error) {
 logError('PATCH User Status Failed', error)
 return NextResponse.json({ error:'Failed to update user status' }, { status: 500 })
 }
}

export async function POST(request: Request) {
 try {
 const body = await request.json()
 const { trialLimitDays } = body

 if (typeof trialLimitDays !=='number' || trialLimitDays < 0) {
 return NextResponse.json({ error:'Invalid trial limit days' }, { status: 400 })
 }

 // Try to find the first config record
 let config = await prisma.systemConfig.findFirst()

 if (config) {
 // Update existing
 await prisma.systemConfig.update({
 where: { id: config.id },
 data: { trialLimitDays }
 })
 } else {
 // Create new if none exists
 await prisma.systemConfig.create({
 data: {
 trialLimitDays,
 platformName: "Wati Bot",
 supportEmail: "info@watibot.pro",
 systemTimezone: "Karachi",
 defaultLanguage: "en",
 currencyCode: "USD",
 currencyName: "U.S. Dollar",
 currencySymbol: "$"
 }
 })
 }

 return NextResponse.json({ success: true, trialLimitDays })
 } catch (error) {
 logError('POST Trial Limit Failed', error)
 console.error('Failed to save trial settings:', error)
 return NextResponse.json({ 
 error:'Failed to save settings', 
 details: error instanceof Error ? error.message : String(error) 
 }, { status: 500 })
 }
}
