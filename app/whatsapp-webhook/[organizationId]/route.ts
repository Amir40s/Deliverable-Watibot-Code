import { NextRequest } from'next/server';
import { handleWhatsAppWebhookGet, handleWhatsAppWebhookPost } from'@/app/api/webhooks/whatsapp/route';

export async function GET(req: NextRequest) {
 return handleWhatsAppWebhookGet(req);
}

export async function POST(req: NextRequest) {
 return handleWhatsAppWebhookPost(req);
}
