import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activityLog';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ webhookId: string }> | { webhookId: string } }
) {
  try {
    const resolvedParams = await params;
    const webhookId = resolvedParams.webhookId;
    
    // Attempt to extract secret key from headers or query params
    const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key');
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret');
    
    const providedSecret = authHeader?.replace('Bearer ', '') || querySecret;

    // Collect headers for detailed logging
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Parse payload safely
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      body = { _rawText: rawBody };
    }

    console.log('\n==================== [ExternalWebhook INBOUND] ====================');
    console.log(`[ExternalWebhook] Timestamp: ${new Date().toISOString()}`);
    console.log(`[ExternalWebhook] Webhook ID: ${webhookId}`);
    console.log(`[ExternalWebhook] Method: ${req.method} | URL: ${req.url}`);
    console.log(`[ExternalWebhook] Headers:`, JSON.stringify(headersObj, null, 2));
    console.log(`[ExternalWebhook] Body Payload:\n`, typeof body === 'object' ? JSON.stringify(body, null, 2) : rawBody);
    console.log('===================================================================\n');

    if (!providedSecret) {
      console.warn(`[ExternalWebhook] Missing authentication secret for webhook ID: ${webhookId}`);
      return NextResponse.json({ error: 'Missing authentication secret' }, { status: 401 });
    }

    // Find the webhook
    const webhook = await prisma.externalWebhook.findUnique({
      where: { id: webhookId },
      include: { organization: true }
    });

    if (!webhook || !webhook.isActive) {
      console.warn(`[ExternalWebhook] Webhook not found or inactive. ID: ${webhookId}, Found: ${!!webhook}, Active: ${webhook?.isActive}`);
      return NextResponse.json({ error: 'Webhook not found or inactive' }, { status: 404 });
    }

    // Authenticate
    if (webhook.secretKey !== providedSecret) {
      console.warn(`[ExternalWebhook] Invalid secret key for webhook: ${webhook.name} (${webhookId})`);
      return NextResponse.json({ error: 'Invalid secret key' }, { status: 403 });
    }

    console.log(`[ExternalWebhook] Authenticated: "${webhook.name}" (Org: ${webhook.organizationId} - ${webhook.organization?.name || 'N/A'})`);

    const action = body.action || body.type;

    if (!action) {
      console.warn(`[ExternalWebhook] Missing action/type in payload:`, body);
      return NextResponse.json({ error: 'Missing action/type in payload' }, { status: 400 });
    }

    console.log(`[ExternalWebhook] Action to execute: "${action}"`);

    // Log the incoming webhook activity
    await logActivity({
      organizationId: webhook.organizationId,
      action: 'Inbound Webhook Received',
      module: 'Webhooks',
      target: webhook.name,
      details: `Action: ${action} | Payload: ${JSON.stringify(body).slice(0, 500)}`,
      status: 'success',
    });

    // Dispatch action to respective CRM service based on `action` payload.
    const isMessageAction = [
      'send_message',
      'send_template',
      'send_media',
      'send_audio',
      'send_image',
      'send_video',
      'send_document'
    ].includes(action);

    if (isMessageAction) {
      const phoneStr = body.phone?.replace(/[^0-9]/g, '');
      if (!phoneStr) {
        console.warn(`[ExternalWebhook] Missing phone number in payload:`, body);
        return NextResponse.json({ error: 'Missing phone number' }, { status: 400 });
      }

      console.log(`[ExternalWebhook] Processing ${action} for phone: ${phoneStr}`);

      // 1. Find or create contact
      let contact = await prisma.contact.findFirst({
        where: {
          organizationId: webhook.organizationId,
          waId: phoneStr,
          platform: 'WHATSAPP'
        }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            organizationId: webhook.organizationId,
            waId: phoneStr,
            platform: 'WHATSAPP',
            isAutoCreated: true,
            name: body.name || phoneStr
          }
        });
        console.log(`[ExternalWebhook] Created new contact: ${contact.id} (${phoneStr})`);
      } else {
        console.log(`[ExternalWebhook] Found existing contact: ${contact.id} (${phoneStr})`);
      }

      if (contact && (contact.isWebhookEnabled === false || (contact.disabledWebhookIds && contact.disabledWebhookIds.includes(webhookId)))) {
        console.log(`[ExternalWebhook] Contact ${contact.id} (${phoneStr}) has webhook automation disabled. Rejecting inbound webhook.`);
        return NextResponse.json({ error: 'Webhook automation is disabled for this contact' }, { status: 403 });
      }

      // 2. Dispatch
      const { 
        internalSendWhatsAppMessage, 
        internalSendMediaMessage,
        internalSendTemplateMessage 
      } = await import('@/lib/whatsapp/api');

      if (action === 'send_template') {
        const templateName = body.template_name;
        const lang = body.language || 'en_US';
        let components: any[] = [];

        if (body.parameters?.body && Array.isArray(body.parameters.body)) {
            components.push({
                type: 'body',
                parameters: body.parameters.body.map((val: any) => ({
                    type: 'text',
                    text: String(val)
                }))
            });
        }

        console.log(`[ExternalWebhook] Sending template "${templateName}" (${lang}) to contact ${contact.id} with components:`, JSON.stringify(components, null, 2));
        const res = await internalSendTemplateMessage(contact.id, templateName, lang, components);
        console.log(`[ExternalWebhook] Template send result:`, JSON.stringify(res, null, 2));
      } else {
        const mediaUrl = body.media_url || body.audio_url || body.image_url || body.video_url || body.document_url || body.file_url || body.url;
        const caption = body.message || body.caption || '';

        // Check if this should be sent as a live voice message (Push-to-talk / Voice Note)
        const isVoice = action === 'send_audio' || 
                        action === 'send_voice' || 
                        body.is_voice === true || 
                        body.voice === true || 
                        body.type === 'voice' || 
                        body.type === 'audio' ||
                        Boolean(body.audio_url);

        const mediaType = isVoice 
          ? 'voice' 
          : (action === 'send_video' ? 'video' : (action === 'send_document' ? 'document' : 'image'));

        if (mediaUrl) {
          console.log(`[ExternalWebhook] Dispatching media (${mediaUrl}) as [${mediaType}] (isLiveVoice: ${isVoice}) to contact ${contact.id}`);
          const res = await internalSendMediaMessage(
            contact.id,
            mediaType,
            mediaUrl,
            caption || (isVoice ? '__voice__' : '')
          );
          console.log(`[ExternalWebhook] Media send result:`, JSON.stringify(res, null, 2));
        } else {
          console.log(`[ExternalWebhook] Sending text message to contact ${contact.id}: "${caption}"`);
          const res = await internalSendWhatsAppMessage(
            contact.id,
            caption,
            contact,
            undefined,
            true // skip window check locally, let Meta handle validation
          );
          console.log(`[ExternalWebhook] WhatsApp message send result:`, JSON.stringify(res, null, 2));
        }
      }
    } else if (action === 'create_contact' || action === 'update_contact') {
      const waId = body.phone?.replace(/[^0-9]/g, '') || body.contact_id;
      if (!waId) {
        console.warn(`[ExternalWebhook] Missing phone or contact_id for action "${action}"`);
        return NextResponse.json({ error: 'Missing phone or contact_id' }, { status: 400 });
      }

      const data: any = {
        name: body.name,
      };
      if (body.email) data.email = body.email;
      if (body.custom_fields) data.customAttributes = body.custom_fields;

      let contact = await prisma.contact.findFirst({
        where: { organizationId: webhook.organizationId, waId }
      });

      if (contact) {
        console.log(`[ExternalWebhook] Updating contact ${contact.id} (${waId}) with:`, data);
        await prisma.contact.update({
          where: { id: contact.id },
          data
        });
      } else if (action === 'create_contact') {
        console.log(`[ExternalWebhook] Creating new contact for waId: ${waId}`);
        await prisma.contact.create({
          data: {
            ...data,
            organizationId: webhook.organizationId,
            waId,
            platform: 'WHATSAPP'
          }
        });
      }
    } else if (action === 'delete_contact') {
      const waId = body.phone?.replace(/[^0-9]/g, '') || body.contact_id;
      if (!waId) return NextResponse.json({ error: 'Missing phone or contact_id' }, { status: 400 });
      
      console.log(`[ExternalWebhook] Deleting contact with waId/id: ${waId}`);
      const contact = await prisma.contact.findFirst({
        where: { organizationId: webhook.organizationId, waId }
      });
      
      if (contact) {
        await prisma.contact.delete({ where: { id: contact.id } });
        console.log(`[ExternalWebhook] Successfully deleted contact ${contact.id}`);
      } else {
        console.log(`[ExternalWebhook] Contact ${waId} not found for deletion`);
      }
    } else if (action === 'add_note') {
      const waId = body.phone?.replace(/[^0-9]/g, '') || body.contact_id;
      if (!waId || !body.note) return NextResponse.json({ error: 'Missing phone/contact_id or note' }, { status: 400 });

      console.log(`[ExternalWebhook] Adding note to contact ${waId}: "${body.note}"`);
      const contact = await prisma.contact.findFirst({
        where: { organizationId: webhook.organizationId, waId }
      });

      if (contact) {
        const newNotes = contact.notes ? `${contact.notes}\n${body.note}` : body.note;
        await prisma.contact.update({
          where: { id: contact.id },
          data: { notes: newNotes }
        });
        console.log(`[ExternalWebhook] Note added successfully to contact ${contact.id}`);
      }
    } else if (action === 'assign_tag' || action === 'remove_tag') {
      const waId = body.phone?.replace(/[^0-9]/g, '') || body.contact_id;
      const tagId = body.tag_id;
      if (!waId || !tagId) return NextResponse.json({ error: 'Missing phone/contact_id or tag_id' }, { status: 400 });
      
      console.log(`[ExternalWebhook] ${action} (Tag ID: ${tagId}) for contact ${waId}`);
      const contact = await prisma.contact.findFirst({
        where: { organizationId: webhook.organizationId, waId }
      });

      if (contact) {
        if (action === 'assign_tag') {
           await prisma.contact.update({
             where: { id: contact.id },
             data: { tags: { connect: { id: tagId } } }
           });
           console.log(`[ExternalWebhook] Tag ${tagId} connected to contact ${contact.id}`);
        } else {
           await prisma.contact.update({
             where: { id: contact.id },
             data: { tags: { disconnect: { id: tagId } } }
           });
           console.log(`[ExternalWebhook] Tag ${tagId} disconnected from contact ${contact.id}`);
        }
      }
    } else if (action === 'start_flow') {
      const phoneStr = body.phone?.replace(/[^0-9]/g, '') || body.contact_id;
      if (!phoneStr || !body.flow_id) return NextResponse.json({ error: 'Missing phone/contact_id or flow_id' }, { status: 400 });

      console.log(`[ExternalWebhook] Starting flow ${body.flow_id} for ${phoneStr}`);
      let contact = await prisma.contact.findFirst({
        where: { organizationId: webhook.organizationId, waId: phoneStr }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: { organizationId: webhook.organizationId, waId: phoneStr, platform: 'WHATSAPP', isAutoCreated: true }
        });
        console.log(`[ExternalWebhook] Created contact ${contact.id} for flow`);
      }

      const { internalSendFlowMessage } = await import('@/lib/whatsapp/api');
      const flowRes = await internalSendFlowMessage(contact.id, {
        flowId: body.flow_id,
        flowData: body.variables || {}
      }, contact);
      console.log(`[ExternalWebhook] Flow dispatch result:`, JSON.stringify(flowRes, null, 2));
    } else if (action === 'start_campaign') {
      console.log(`[ExternalWebhook] Campaign start requested: ${body.campaign_id}`);
    } else {
      console.warn(`[ExternalWebhook] Unhandled action: "${action}"`);
    }

    console.log(`[ExternalWebhook] Successfully completed request for webhook ID: ${webhookId}\n`);
    return NextResponse.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error: any) {
    console.error('[ExternalWebhook] Error processing inbound webhook:', error);
    
    const errorMessage = error.message || 'Internal server error';
    const statusCode = errorMessage.includes('Meta API Error') ? 400 : 500;

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
