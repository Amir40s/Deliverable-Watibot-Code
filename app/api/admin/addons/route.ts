import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
    try {
        const installedAddons = await prisma.installedAddon.findMany()
        return NextResponse.json(installedAddons)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch addons' }, { status: 500 })
    }
}
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { addonId, action } = body

        if (action === 'install') {
            const addon = await prisma.installedAddon.upsert({
                where: { addonId },
                update: {
                    status: 'ACTIVE',
                    updatedAt: new Date()
                },
                create: {
                    addonId,
                    name: body.name || addonId,
                    installedVersion: body.version || '1.0.0',
                    status: 'ACTIVE'
                }
            })
            return NextResponse.json(addon)
        }
        if (action === 'sync') {
            console.log('Syncing all addons...')
            return NextResponse.json({ success: true, message: 'Sync task started' })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error: any) {
        console.error('Addon action failed:', error)
        return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 })
    }
}
