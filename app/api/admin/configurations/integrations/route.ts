import { NextResponse } from'next/server'
import { prisma } from'@/lib/prisma'
import { getPusherServer } from'@/lib/pusher'
import { redactSystemConfig } from'@/lib/api/system-config'

export const dynamic ='force-dynamic'

// Helper to sanitize script tags (basic)
function sanitizeFooterCode(code: string | undefined): string | undefined {
 if (!code) return code
 return String(code).trim()
}

export async function GET() {
 try {
 const config = await prisma.systemConfig.findFirst({
 orderBy: { createdAt:'asc' }
 })
 return NextResponse.json(redactSystemConfig(config) || {
 campaignMessageDelay: 0,
 enableResponseMessages: true,
 jobProcessingMode:'CRON',
 webhookStorageMethod:'SYNC'
 })
 } catch (error) {
 return NextResponse.json({ error:'Failed to fetch settings' }, { status: 500 })
 }
}

export async function POST(request: Request) {
 try {
 const body = await request.json()
 
 // Sanitize footer fields
 if (body.footerCodeAll !== undefined) body.footerCodeAll = sanitizeFooterCode(body.footerCodeAll)
 if (body.footerCodeLoggedIn !== undefined) body.footerCodeLoggedIn = sanitizeFooterCode(body.footerCodeLoggedIn)

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

 // System broadcast for Pusher credential updates
 if (body.pusherAppId || body.pusherKey || body.pusherSecret || body.pusherCluster) {
 try {
 const pusher = getPusherServer({
 appId: config.pusherAppId ||'',
 key: config.pusherKey ||'',
 secret: config.pusherSecret ||'',
 cluster: config.pusherCluster ||'mt1'
 });
 
 await pusher.trigger('system-channel','pusher-config-updated', {
 timestamp: new Date().toISOString(),
 updatedFields: Object.keys(body).filter(k => k.startsWith('pusher'))
 });
 console.log('Pusher configuration update broadcasted');
 } catch (pError) {
 console.error('Failed to broadcast Pusher update:', pError);
 // We don't fail the whole request if broadcast fails
 }
 }

 return NextResponse.json(redactSystemConfig(config))
 } catch (error: any) {
 console.error('Failed to save integration settings:', error)
 return NextResponse.json({ error: error.message ||'Failed to save settings' }, { status: 500 })
 }
}
