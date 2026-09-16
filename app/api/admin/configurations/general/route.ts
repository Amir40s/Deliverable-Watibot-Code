import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redactSystemConfig } from '@/lib/api/system-config';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    const redacted = redactSystemConfig(config);
    return NextResponse.json(redacted ? {
      ...redacted,
      supportPhone: config?.whatsappNumber ?? null,
    } : {});
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const existingConfig = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    const updateData = {
      logoLightTheme: body.logoLightTheme !== undefined ? body.logoLightTheme : existingConfig?.logoLightTheme,
      smallLogo: body.smallLogo !== undefined ? body.smallLogo : existingConfig?.smallLogo,
      favicon: body.favicon !== undefined ? body.favicon : existingConfig?.favicon,
      platformName: body.platformName !== undefined ? body.platformName : existingConfig?.platformName,
      seoDescription: body.seoDescription !== undefined ? body.seoDescription : existingConfig?.seoDescription,
      supportEmail: body.supportEmail !== undefined ? body.supportEmail : existingConfig?.supportEmail,
      whatsappNumber: (body.whatsappNumber !== undefined || body.supportPhone !== undefined) ? (body.whatsappNumber ?? body.supportPhone ?? null) : existingConfig?.whatsappNumber,
      officeAddress: body.officeAddress !== undefined ? body.officeAddress : existingConfig?.officeAddress,
      systemTimezone: body.systemTimezone !== undefined ? body.systemTimezone : existingConfig?.systemTimezone,
      defaultLanguage: body.defaultLanguage !== undefined ? body.defaultLanguage : existingConfig?.defaultLanguage,
      userTerms: body.userTerms !== undefined ? body.userTerms : existingConfig?.userTerms,
      privacyPolicy: body.privacyPolicy !== undefined ? body.privacyPolicy : existingConfig?.privacyPolicy,
      termsOfService: body.termsOfService !== undefined ? body.termsOfService : existingConfig?.termsOfService,
      vendorTerms: body.vendorTerms !== undefined ? body.vendorTerms : existingConfig?.vendorTerms,
      lightThemeColors: body.lightThemeColors !== undefined ? body.lightThemeColors : existingConfig?.lightThemeColors,
      darkThemeColors: body.darkThemeColors !== undefined ? body.darkThemeColors : existingConfig?.darkThemeColors,
      trialLimitDays: body.trialLimitDays !== undefined ? body.trialLimitDays : existingConfig?.trialLimitDays,
      apkDownloadUrl: body.apkDownloadUrl !== undefined ? body.apkDownloadUrl : existingConfig?.apkDownloadUrl,
      playStoreUrl: body.playStoreUrl !== undefined ? body.playStoreUrl : existingConfig?.playStoreUrl,
      appStoreUrl: body.appStoreUrl !== undefined ? body.appStoreUrl : existingConfig?.appStoreUrl,
    };

    let config;

    if (existingConfig) {
      config = await prisma.systemConfig.update({
        where: { id: existingConfig.id },
        data: updateData
      });
      // Synchronize all other systemConfig rows if any exist
      await prisma.systemConfig.updateMany({
        where: { id: { not: existingConfig.id } },
        data: updateData
      }).catch(() => {});
    } else {
      config = await prisma.systemConfig.create({
        data: updateData
      });
    }

    try {
      await prisma.systemAuditLog.create({
        data: {
          userId: session.user.id,
          userEmail: session.user.email,
          userName: session.user.name,
          action: existingConfig ? "Updated Configuration" : "Created Configuration",
          module: "Global Configurations",
          details: "Global system configuration was updated via the dashboard.",
        }
      });
    } catch (logErr) {
      console.warn("Failed to log configuration update:", logErr);
    }

    const redacted = redactSystemConfig(config);
    return NextResponse.json(redacted ? {
      ...redacted,
      supportPhone: config.whatsappNumber ?? null,
    } : {});
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
