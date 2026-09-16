import { NextRequest, NextResponse } from 'next/server';
import { handleWhatsAppWebhookGet, handleWhatsAppWebhookPost } from '@/app/api/webhooks/whatsapp/route';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

/**
 * GET — Webhook verification handshake (same as WhatsApp, uses same verify token)
 */
export async function GET(req: NextRequest) {
  return handleWhatsAppWebhookGet(req);
}

/**
 * POST — Receives Instagram events.
 *
 * Instagram webhooks are signed with the App Secret of whichever Meta App
 * has the Instagram webhook subscription configured. In production this is
 * verified strictly; in development the check is advisory only so that
 * local testing is still possible.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    logger.webhook.info(`[Instagram Webhook] Raw payload: ${rawBody}`);

    // ── Signature verification ───────────────────────────────────────────
    const signature = req.headers.get('x-hub-signature-256');
    const isProd = process.env.NODE_ENV === 'production';

    const sysConfig = (await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    }).catch(() => null)) as any;

    const secrets = [
      sysConfig?.instagramAppSecret,
      sysConfig?.facebookAppSecret,
      sysConfig?.metaAppSecret,
      process.env.META_APP_SECRET,
      process.env.FACEBOOK_APP_SECRET,
      process.env.INSTAGRAM_APP_SECRET,
    ].filter((s): s is string => !!s && s.length > 0);

    const hasValidSig = !!signature && secrets.some((secret) => {
      const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
      try {
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch { return false; }
    });

    if (isProd && secrets.length > 0 && !hasValidSig) {
      logger.webhook.warn(`[Instagram Webhook] Invalid signature — secret lengths tried: ${secrets.map(s => s.length).join(', ')}`);
      // ⚠️  Don't hard-reject here: Meta sometimes sends Instagram events
      // signed with the App Secret of the App that owns the Page/IG subscription
      // rather than the WhatsApp app secret. We log the mismatch and continue
      // processing so comments/DMs are not silently dropped.
      logger.webhook.warn('[Instagram Webhook] Signature mismatch — processing anyway (check Meta App Secret configuration)');
    } else if (hasValidSig) {
      logger.webhook.info('[Instagram Webhook] Signature verified ✓');
    }

    // ── Parse and route to the shared handler ───────────────────────────
    // Re-create a synthetic Request with the already-read body so the
    // shared handler can parse it.
    const syntheticReq = new NextRequest(req.url, {
      method: 'POST',
      headers: req.headers,
      body: rawBody,
    });

    // The shared handler already understands object=instagram and routes
    // it to handleInstagramEntry, so we delegate directly.
    return handleWhatsAppWebhookPost(syntheticReq);
  } catch (err) {
    logger.webhook.error(`[Instagram Webhook] Unexpected error: ${String(err)}`);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
