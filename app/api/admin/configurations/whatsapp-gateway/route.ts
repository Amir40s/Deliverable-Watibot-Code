import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redactSystemConfig } from '@/lib/api/system-config'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let config = (await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    })) as any

    if (config && config.subAlertCheckTime === undefined) {
      try {
        const rows: any = await prisma.$queryRawUnsafe(
          `SELECT "subAlertCheckTime", "subAlertTimezone", "subAlert5DaysEnabled", "subAlert5DaysTemplate", "subAlert1DayEnabled", "subAlert1DayTemplate" FROM "SystemConfig" WHERE id = $1 LIMIT 1`,
          config.id
        )
        if (rows && rows[0]) {
          config = { ...config, ...rows[0] }
        }
      } catch (_) {}
    }

    return NextResponse.json(redactSystemConfig(config) || {})
  } catch (error) {
    console.error('Failed to fetch WhatsApp gateway settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const existingConfig = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    // Validate enabled alert configurations
    if (body.subAlert5DaysEnabled && (!body.subAlert5DaysTemplate || !body.subAlert5DaysTemplate.trim())) {
      return NextResponse.json({ error: '5 Days Before Expiry alert is enabled, but no WhatsApp template is selected.' }, { status: 400 })
    }
    if (body.subAlert1DayEnabled && (!body.subAlert1DayTemplate || !body.subAlert1DayTemplate.trim())) {
      return NextResponse.json({ error: '1 Day Before Expiry alert is enabled, but no WhatsApp template is selected.' }, { status: 400 })
    }

    const data: any = {
      whatsappNumber: body.whatsappNumber || null,
      metaAccessToken: (body.metaAccessToken && body.metaAccessToken !== '********') ? body.metaAccessToken : (existingConfig?.metaAccessToken ?? null),
      whatsappBusinessId: body.whatsappBusinessId || null,
      whatsappBusinessName: body.whatsappBusinessName || null,
      whatsappPhoneNumberId: body.whatsappPhoneNumberId || null,
      whatsapp_token_info_data: body.whatsapp_token_info_data || (existingConfig?.whatsapp_token_info_data ?? null),
      whatsappOtpTemplate: body.whatsappOtpTemplate || null,
      whatsappPasswordResetTemplate: body.whatsappPasswordResetTemplate || null,
      whatsappSubscriptionAlertTemplate: body.whatsappSubscriptionAlertTemplate || null,
      subAlertCheckTime: body.subAlertCheckTime !== undefined ? body.subAlertCheckTime : (existingConfig?.subAlertCheckTime || "12:00 PM"),
      subAlertTimezone: body.subAlertTimezone !== undefined ? body.subAlertTimezone : (existingConfig?.subAlertTimezone || "Asia/Karachi"),
      subAlert5DaysEnabled: body.subAlert5DaysEnabled !== undefined ? Boolean(body.subAlert5DaysEnabled) : (existingConfig?.subAlert5DaysEnabled ?? false),
      subAlert5DaysTemplate: body.subAlert5DaysTemplate !== undefined ? body.subAlert5DaysTemplate : (existingConfig?.subAlert5DaysTemplate ?? null),
      subAlert1DayEnabled: body.subAlert1DayEnabled !== undefined ? Boolean(body.subAlert1DayEnabled) : (existingConfig?.subAlert1DayEnabled ?? false),
      subAlert1DayTemplate: body.subAlert1DayTemplate !== undefined ? body.subAlert1DayTemplate : (existingConfig?.subAlert1DayTemplate ?? null),
    }

    let config: any

    if (existingConfig) {
      try {
        config = await prisma.systemConfig.update({
          where: { id: existingConfig.id },
          data: data
        })
      } catch (err: any) {
        if (err?.message && err.message.includes('subAlert')) {
          const {
            subAlertCheckTime,
            subAlertTimezone,
            subAlert5DaysEnabled,
            subAlert5DaysTemplate,
            subAlert1DayEnabled,
            subAlert1DayTemplate,
            ...baseData
          } = data

          config = await prisma.systemConfig.update({
            where: { id: existingConfig.id },
            data: baseData
          })

          await prisma.$executeRawUnsafe(
            `UPDATE "SystemConfig" SET 
              "subAlertCheckTime" = $1,
              "subAlertTimezone" = $2,
              "subAlert5DaysEnabled" = $3,
              "subAlert5DaysTemplate" = $4,
              "subAlert1DayEnabled" = $5,
              "subAlert1DayTemplate" = $6
            WHERE id = $7`,
            subAlertCheckTime,
            subAlertTimezone,
            subAlert5DaysEnabled,
            subAlert5DaysTemplate,
            subAlert1DayEnabled,
            subAlert1DayTemplate,
            existingConfig.id
          )

          config = {
            ...config,
            subAlertCheckTime,
            subAlertTimezone,
            subAlert5DaysEnabled,
            subAlert5DaysTemplate,
            subAlert1DayEnabled,
            subAlert1DayTemplate,
          }
        } else {
          throw err
        }
      }
    } else {
      try {
        config = await prisma.systemConfig.create({
          data: {
            ...data,
            platformName: "Wati Bot",
            supportEmail: "info@watibot.pro"
          }
        })
      } catch (err: any) {
        if (err?.message && err.message.includes('subAlert')) {
          const {
            subAlertCheckTime,
            subAlertTimezone,
            subAlert5DaysEnabled,
            subAlert5DaysTemplate,
            subAlert1DayEnabled,
            subAlert1DayTemplate,
            ...baseData
          } = data

          config = await prisma.systemConfig.create({
            data: {
              ...baseData,
              platformName: "Wati Bot",
              supportEmail: "info@watibot.pro"
            }
          })

          await prisma.$executeRawUnsafe(
            `UPDATE "SystemConfig" SET 
              "subAlertCheckTime" = $1,
              "subAlertTimezone" = $2,
              "subAlert5DaysEnabled" = $3,
              "subAlert5DaysTemplate" = $4,
              "subAlert1DayEnabled" = $5,
              "subAlert1DayTemplate" = $6
            WHERE id = $7`,
            subAlertCheckTime,
            subAlertTimezone,
            subAlert5DaysEnabled,
            subAlert5DaysTemplate,
            subAlert1DayEnabled,
            subAlert1DayTemplate,
            config.id
          )

          config = {
            ...config,
            subAlertCheckTime,
            subAlertTimezone,
            subAlert5DaysEnabled,
            subAlert5DaysTemplate,
            subAlert1DayEnabled,
            subAlert1DayTemplate,
          }
        } else {
          throw err
        }
      }
    }

    revalidatePath('/admin/configurations', 'layout')
    return NextResponse.json(redactSystemConfig(config))
  } catch (error: any) {
    console.error('Failed to save WhatsApp gateway settings:', error)
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 })
  }
}
