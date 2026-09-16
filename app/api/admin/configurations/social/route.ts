import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redactSystemConfig } from '@/lib/api/system-config'
import { resolvePayFastSettings } from '@/lib/payfast'

export const dynamic = 'force-dynamic'

type FacebookAutoCommentConfig = {
  facebookAutoCommentEnabled: boolean;
  facebookAutoCommentReplyText: string;
  tiktokClientKey: string;
  tiktokClientSecret: string;
  tiktokRedirectUri: string;
  tiktokOauthScopes: string;
  tiktokIsBusinessApi: boolean;
  instagramAppId?: string;
  instagramAppSecret?: string;
  instagramConfigId?: string;
};

type BackupScheduleRow = {
  backupEmail: string | null;
  backupScheduleTime: string | null;
};

function normalizeBackupTime(value: unknown) {
  if (typeof value !== 'string') return '15:00';
  const trimmed = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : '15:00';
}

async function readBackupSchedule(configId?: string | null) {
  try {
    const rows = configId
      ? await prisma.$queryRawUnsafe<BackupScheduleRow[]>(
          `SELECT "backupEmail", "backupScheduleTime" FROM "SystemConfig" WHERE "id" = $1 LIMIT 1`,
          configId,
        )
      : await prisma.$queryRawUnsafe<BackupScheduleRow[]>(
          `SELECT "backupEmail", "backupScheduleTime" FROM "SystemConfig" ORDER BY "updatedAt" DESC LIMIT 1`,
        );

    return {
      backupEmail: rows[0]?.backupEmail || null,
      backupScheduleTime: normalizeBackupTime(rows[0]?.backupScheduleTime || '15:00'),
    };
  } catch {
    return {
      backupEmail: null,
      backupScheduleTime: '15:00',
    };
  }
}

async function writeBackupSchedule(configId: string, backupEmail: string | null, backupScheduleTime: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "SystemConfig" SET "backupEmail" = $1, "backupScheduleTime" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
    backupEmail,
    backupScheduleTime,
    configId,
  );
}

function parseFacebookAutoCommentConfig(rawValue: string | null | undefined): FacebookAutoCommentConfig {
  if (!rawValue) {
    return {
      facebookAutoCommentEnabled: false,
      facebookAutoCommentReplyText: '',
      tiktokClientKey: process.env.TIKTOK_CLIENT_ID || '',
      tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      tiktokRedirectUri: '',
      tiktokOauthScopes: 'user.info.basic,video.list',
      tiktokIsBusinessApi: true,
      instagramAppId: '',
      instagramAppSecret: '',
      instagramConfigId: '',
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<FacebookAutoCommentConfig>;
    return {
      facebookAutoCommentEnabled: !!parsed.facebookAutoCommentEnabled,
      facebookAutoCommentReplyText: typeof parsed.facebookAutoCommentReplyText === 'string'
        ? parsed.facebookAutoCommentReplyText
        : '',
      tiktokClientKey: parsed.tiktokClientKey || process.env.TIKTOK_CLIENT_ID || '',
      tiktokClientSecret: parsed.tiktokClientSecret || process.env.TIKTOK_CLIENT_SECRET || '',
      tiktokRedirectUri: typeof parsed.tiktokRedirectUri === 'string' ? parsed.tiktokRedirectUri : '',
      tiktokOauthScopes: typeof parsed.tiktokOauthScopes === 'string' ? parsed.tiktokOauthScopes : 'user.info.basic,video.list',
      tiktokIsBusinessApi: parsed.tiktokIsBusinessApi !== undefined ? !!parsed.tiktokIsBusinessApi : true,
      instagramAppId: parsed.instagramAppId || '',
      instagramAppSecret: parsed.instagramAppSecret || '',
      instagramConfigId: parsed.instagramConfigId || '',
    };
  } catch {
    return {
      facebookAutoCommentEnabled: false,
      facebookAutoCommentReplyText: '',
      tiktokClientKey: process.env.TIKTOK_CLIENT_ID || '',
      tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      tiktokRedirectUri: '',
      tiktokOauthScopes: 'user.info.basic,video.list',
      tiktokIsBusinessApi: false,
      instagramAppId: '',
      instagramAppSecret: '',
      instagramConfigId: '',
    };
  }
}

export async function GET() {
  try {
    let config;
    try {
      config = await prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' }
      });
    } catch (dbError) {
      console.warn('[AdminConfig] Primary fetch failed, likely due to missing columns. Falling back to safe fetch.');
      config = await (prisma.systemConfig as any).findFirst({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          facebookAppId: true,
          embeddedSignupConfigId: true,
          googleLoginEnabled: true,
        }
      });
    }

    const autoCommentConfig = parseFacebookAutoCommentConfig(config?.metaAppName);

    // Fallbacks from environment variables (.env) if database fields are empty/null
    const googleClientId = config?.googleClientId || process.env.GOOGLE_CLIENT_ID || '';
    const googleClientSecret = config?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    
    const cloudinaryCloudName = config?.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME || '';
    const cloudinaryApiKey = config?.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY || '';
    const cloudinaryApiSecret = config?.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET || '';
    
    const facebookAppId = config?.facebookAppId || '';
    const facebookAppSecret = config?.facebookAppSecret || '';
    const embeddedSignupConfigId = config?.embeddedSignupConfigId || '';
    const instagramAppId = (config as any)?.instagramAppId || autoCommentConfig?.instagramAppId || '';
    const instagramAppSecret = (config as any)?.instagramAppSecret || autoCommentConfig?.instagramAppSecret || '';
    const instagramConfigId = config?.instagramConfigId || autoCommentConfig?.instagramConfigId || '';
    
    console.log(`[AdminConfig][GET] Read Social Configuration. DB facebookAppId: ${config?.facebookAppId || 'NONE'}, Resolved: ${facebookAppId || 'NONE'}, instagramAppId: ${instagramAppId || 'NONE'}`);

    
    const aiProvider = config?.aiProvider || 'openai';
    const aiProviderApiKey = config?.aiProviderApiKey || process.env.OPENAI_API_KEY || '';
    
    const smtpHost = config?.smtpHost || process.env.EMAIL_SERVER_HOST || '';
    const smtpPort = config?.smtpPort ? String(config.smtpPort) : (process.env.EMAIL_SERVER_PORT || '');
    const smtpUser = config?.smtpUser || process.env.EMAIL_SERVER_USER || '';
    const smtpPassword = config?.smtpPassword || process.env.EMAIL_SERVER_PASSWORD || '';
    const smtpFrom = config?.smtpFrom || process.env.EMAIL_FROM || '';
    const adminEmail = config?.adminEmail || config?.smtpFrom || process.env.EMAIL_FROM || '';
    const backupSchedule = await readBackupSchedule(config?.id);
    const backupEmail = backupSchedule.backupEmail || config?.adminEmail || process.env.BACKUP_EMAIL || '';
    const backupScheduleTime = backupSchedule.backupScheduleTime;

    const stripePublishableKey = config?.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY || '';
    const stripeSecretKey = config?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
    const stripeWebhookSecret = config?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
    const payfastSettings = resolvePayFastSettings(config as any);

    const storageDriver = config?.storageDriver || process.env.STORAGE_DRIVER || 'r2';
    const r2AccountId = config?.r2AccountId || process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = config?.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = config?.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '';
    const r2BucketName = config?.r2BucketName || process.env.R2_BUCKET_NAME || '';
    const r2PublicUrl = config?.r2PublicUrl || process.env.R2_PUBLIC_URL || '';
    const r2Endpoint = config?.r2Endpoint || process.env.R2_ENDPOINT || '';

    const pusherAppId = config?.pusherAppId || process.env.PUSHER_APP_ID || '';
    const pusherKey = config?.pusherKey || process.env.PUSHER_KEY || '';
    const pusherSecret = config?.pusherSecret || process.env.PUSHER_SECRET || '';
    const pusherCluster = config?.pusherCluster || process.env.PUSHER_CLUSTER || '';

    return NextResponse.json(config ? {
      ...config,
      storageDriver,
      r2AccountId,
      r2AccessKeyId,
      r2SecretAccessKey,
      r2BucketName,
      r2PublicUrl,
      r2Endpoint,
      googleClientId,
      googleClientSecret,
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
      facebookAppId,
      facebookAppSecret,
      embeddedSignupConfigId,
      instagramAppId,
      instagramAppSecret,
      instagramConfigId,
      aiProvider,
      aiProviderApiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom,
      adminEmail,
      backupEmail,
      backupScheduleTime,
      stripePublishableKey,
      stripeSecretKey,
      stripeWebhookSecret,
      payfastEnabled: payfastSettings.enabled,
      payfastMerchantId: payfastSettings.merchantId,
      payfastMerchantName: payfastSettings.merchantName,
      payfastSecuredKey: payfastSettings.securedKey,
      payfastEnvironment: payfastSettings.environment,
      payfastTokenUrl: payfastSettings.tokenUrl,
      payfastCheckoutUrl: payfastSettings.checkoutUrl,
      payfastCurrencyCode: payfastSettings.currencyCode,
      payfastStoreId: payfastSettings.storeId,
      payfastDefaultCustomerMobile: payfastSettings.defaultCustomerMobile,
      pusherAppId,
      pusherKey,
      pusherSecret,
      pusherCluster,
      notificationSoundUrl: config.apiDocsUrl ?? null,
      ...autoCommentConfig,
    } : {
      googleLoginEnabled: true,
      storageDriver,
      r2AccountId,
      r2AccessKeyId,
      r2SecretAccessKey,
      r2BucketName,
      r2PublicUrl,
      r2Endpoint,
      googleClientId,
      googleClientSecret,
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret,
      facebookAppId,
      facebookAppSecret,
      embeddedSignupConfigId,
      instagramAppId,
      instagramAppSecret,
      instagramConfigId,
      aiProvider,
      aiProviderApiKey,
      aiTemperature: 0.1,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom,
      adminEmail,
      backupEmail,
      backupScheduleTime,
      stripePublishableKey,
      stripeSecretKey,
      stripeWebhookSecret,
      payfastEnabled: payfastSettings.enabled,
      payfastMerchantId: payfastSettings.merchantId,
      payfastMerchantName: payfastSettings.merchantName,
      payfastSecuredKey: payfastSettings.securedKey,
      payfastEnvironment: payfastSettings.environment,
      payfastTokenUrl: payfastSettings.tokenUrl,
      payfastCheckoutUrl: payfastSettings.checkoutUrl,
      payfastCurrencyCode: payfastSettings.currencyCode,
      payfastStoreId: payfastSettings.storeId,
      payfastDefaultCustomerMobile: payfastSettings.defaultCustomerMobile,
      pusherAppId,
      pusherKey,
      pusherSecret,
      pusherCluster,
      notificationSoundUrl: null,
      tiktokClientKey: process.env.TIKTOK_CLIENT_ID || '',
      tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      tiktokRedirectUri: '',
      tiktokOauthScopes: 'user.info.basic,video.list',
      facebookAutoCommentEnabled: false,
      facebookAutoCommentReplyText: '',
    });
  } catch (error) {
    console.error('[AdminConfig] Critical failure in GET:', error);
    return NextResponse.json({ error: 'Failed to fetch settings. Please ensure your database is synced.' }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json()
    const existingConfig = await prisma.systemConfig.findFirst({ orderBy: { updatedAt: 'desc' } }) as any;

    const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    
    if (hasField('facebookAppId')) {
      console.log(`[AdminConfig][POST] Writing Social Configuration. Old facebookAppId: ${existingConfig?.facebookAppId || 'NONE'}, New facebookAppId: ${body.facebookAppId || 'NONE'}`);
    }
    const stringField = (key: string, fallback: string | null = null) =>
      hasField(key) ? (body[key] || null) : (existingConfig?.[key] ?? fallback);
    const secretField = (key: string) =>
      hasField(key) ? (body[key] || existingConfig?.[key] || null) : (existingConfig?.[key] ?? null);
    const boolField = (key: string, fallback = false) =>
      hasField(key) ? !!body[key] : (existingConfig?.[key] ?? fallback);
    const numberField = (key: string, fallback: number | null = null) => {
      if (!hasField(key)) return existingConfig?.[key] ?? fallback;
      return body[key] === '' || body[key] === null || body[key] === undefined ? null : Number(body[key]);
    };

    const existingBackupSchedule = await readBackupSchedule(existingConfig?.id);
    const backupEmailValue = hasField('backupEmail') ? (body.backupEmail || null) : existingBackupSchedule.backupEmail;
    const backupScheduleTimeValue = hasField('backupScheduleTime')
      ? normalizeBackupTime(body.backupScheduleTime)
      : existingBackupSchedule.backupScheduleTime;

    const data = {
      storageDriver: stringField('storageDriver', 'r2') || 'r2',
      r2AccountId: stringField('r2AccountId'),
      r2AccessKeyId: stringField('r2AccessKeyId'),
      r2SecretAccessKey: secretField('r2SecretAccessKey'),
      r2BucketName: stringField('r2BucketName'),
      r2PublicUrl: stringField('r2PublicUrl'),
      r2Endpoint: stringField('r2Endpoint'),
      googleLoginEnabled: boolField('googleLoginEnabled', false),
      googleClientId: stringField('googleClientId'),
      googleClientSecret: secretField('googleClientSecret'),
      googleCallbackUrl: stringField('googleCallbackUrl'),
      facebookAppId: stringField('facebookAppId'),
      facebookAppSecret: secretField('facebookAppSecret'),
      embeddedSignupConfigId: stringField('embeddedSignupConfigId'),
      metaWebhookVerifyToken: secretField('metaWebhookVerifyToken'),
      cloudinaryCloudName: stringField('cloudinaryCloudName'),
      cloudinaryApiKey: stringField('cloudinaryApiKey'),
      cloudinaryApiSecret: secretField('cloudinaryApiSecret'),
      aiProvider: stringField('aiProvider', 'openai') || 'openai',
      aiProviderApiKey: secretField('aiProviderApiKey'),
      aiSystemPrompt: stringField('aiSystemPrompt'),
      aiTemperature: hasField('aiTemperature')
        ? Math.min(Math.max(Number(body.aiTemperature), 0), 1)
        : (existingConfig?.aiTemperature ?? 0.1),
      adminEmail: stringField('adminEmail'),
      smtpHost: stringField('smtpHost'),
      smtpPort: numberField('smtpPort'),
      smtpUser: stringField('smtpUser'),
      smtpPassword: secretField('smtpPassword'),
      smtpFrom: stringField('smtpFrom'),
      stripePublishableKey: stringField('stripePublishableKey'),
      stripeSecretKey: secretField('stripeSecretKey'),
      stripeWebhookSecret: secretField('stripeWebhookSecret'),
      payfastEnabled: boolField('payfastEnabled', false),
      payfastMerchantId: stringField('payfastMerchantId'),
      payfastMerchantName: stringField('payfastMerchantName'),
      payfastSecuredKey: secretField('payfastSecuredKey'),
      payfastEnvironment: stringField('payfastEnvironment', 'sandbox') || 'sandbox',
      payfastTokenUrl: stringField('payfastTokenUrl'),
      payfastCheckoutUrl: stringField('payfastCheckoutUrl'),
      payfastCurrencyCode: stringField('payfastCurrencyCode', 'PKR') || 'PKR',
      payfastStoreId: stringField('payfastStoreId'),
      payfastDefaultCustomerMobile: stringField('payfastDefaultCustomerMobile'),
      instagramConfigId: stringField('instagramConfigId'),
      apiDocsUrl: hasField('notificationSoundUrl') ? (body.notificationSoundUrl || null) : (existingConfig?.apiDocsUrl ?? null),
      metaAppName: (() => {
        const existingMetaApp = parseFacebookAutoCommentConfig(existingConfig?.metaAppName);
        return JSON.stringify({
          facebookAutoCommentEnabled: hasField('facebookAutoCommentEnabled')
            ? !!body.facebookAutoCommentEnabled
            : existingMetaApp.facebookAutoCommentEnabled,
          facebookAutoCommentReplyText: hasField('facebookAutoCommentReplyText')
            ? (body.facebookAutoCommentReplyText || '')
            : existingMetaApp.facebookAutoCommentReplyText,
          tiktokClientKey: hasField('tiktokClientKey') ? (body.tiktokClientKey || '') : existingMetaApp.tiktokClientKey,
          tiktokClientSecret: hasField('tiktokClientSecret') ? (body.tiktokClientSecret || existingMetaApp.tiktokClientSecret || '') : existingMetaApp.tiktokClientSecret,
          tiktokRedirectUri: hasField('tiktokRedirectUri') ? (body.tiktokRedirectUri || '') : existingMetaApp.tiktokRedirectUri,
          tiktokOauthScopes: hasField('tiktokOauthScopes') ? (body.tiktokOauthScopes || 'user.info.basic,video.list') : existingMetaApp.tiktokOauthScopes,
          tiktokIsBusinessApi: hasField('tiktokIsBusinessApi') ? !!body.tiktokIsBusinessApi : existingMetaApp.tiktokIsBusinessApi,
          instagramAppId: hasField('instagramAppId') ? (body.instagramAppId || '') : (existingMetaApp.instagramAppId || ''),
          instagramAppSecret: hasField('instagramAppSecret') ? (body.instagramAppSecret || existingMetaApp.instagramAppSecret || '') : (existingMetaApp.instagramAppSecret || ''),
          instagramConfigId: hasField('instagramConfigId') ? (body.instagramConfigId || '') : (existingMetaApp.instagramConfigId || ''),
        });
      })(),
      pusherAppId: stringField('pusherAppId'),
      pusherKey: stringField('pusherKey'),
      pusherCluster: stringField('pusherCluster'),
      pusherSecret: secretField('pusherSecret'),
    }

    let config;
    try {
      if (existingConfig) {
        config = await prisma.systemConfig.update({ where: { id: existingConfig.id }, data: data as any });
      } else {
        config = await prisma.systemConfig.create({ data: { ...data, platformName: "Wati Bot", supportEmail: "info@watibot.pro" } as any });
      }
    } catch (saveError: any) {
      if (saveError.message?.includes('Unknown argument')) {
        const safeData = { ...data };
        delete (safeData as any).instagramAppId;
        delete (safeData as any).instagramAppSecret;
        delete (safeData as any).instagramConfigId;
        delete (safeData as any).backupEmail;
        if (existingConfig) {
          config = await prisma.systemConfig.update({ where: { id: existingConfig.id }, data: safeData as any });
        } else {
          config = await prisma.systemConfig.create({ data: { ...safeData, platformName: "Wati Bot", supportEmail: "info@watibot.pro" } as any });
        }
      } else {
        throw saveError;
      }
    }

    if (hasField('backupEmail') || hasField('backupScheduleTime')) {
      await writeBackupSchedule(config.id, backupEmailValue, backupScheduleTimeValue);
    }

    revalidatePath('/dashboard', 'layout');
    revalidatePath('/admin/configurations', 'layout');
    return NextResponse.json(redactSystemConfig({
      ...config,
      backupEmail: backupEmailValue,
      backupScheduleTime: backupScheduleTimeValue,
    }))
  } catch (error: any) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 })
  }
}
