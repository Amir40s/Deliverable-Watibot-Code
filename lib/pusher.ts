import PusherServer from 'pusher';
export { getPusherClient } from './pusher-client';

// Server-side Pusher instance
export const getPusherServer = (_config: {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
}) => {
  return null as any;
};

export const getPusherServerWithFallback = (systemConfig?: any) => {
  const appId = systemConfig?.pusherAppId || process.env.PUSHER_APP_ID || '';
  const key = systemConfig?.pusherKey || process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || '';
  const secret = systemConfig?.pusherSecret || process.env.PUSHER_SECRET || '';
  const cluster = systemConfig?.pusherCluster || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'ap2';

  if (!appId || !key || !secret) {
    return null;
  }

  return new PusherServer({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
};

export const pusherServer = getPusherServerWithFallback();

export const triggerPusherOrgEvent = async (orgId: string, eventName: string, payload: any, systemConfig?: any) => {
  try {
    let sysConfig = systemConfig;
    if (!sysConfig?.pusherAppId || !sysConfig?.pusherSecret) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const dbConfig = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'desc' } });
        if (dbConfig) {
          sysConfig = {
            ...sysConfig,
            pusherAppId: dbConfig.pusherAppId,
            pusherKey: dbConfig.pusherKey,
            pusherSecret: dbConfig.pusherSecret,
            pusherCluster: dbConfig.pusherCluster,
          };
        }
      } catch (e) {
        // Fallback to env
      }
    }

    const pusher = getPusherServerWithFallback(sysConfig);
    if (!pusher || !orgId) {
      console.warn(`[Pusher] Skip triggering ${eventName} for org-${orgId}: Pusher missing credentials.`);
      return;
    }

    // Ensure standardized keys for both web and mobile clients
    let formattedPayload: any = {
      ...payload,
      id: payload.id || payload.messageId || payload.dbMessageId || payload.wamid || `msg_${Date.now()}`,
      messageId: payload.messageId || payload.id || payload.wamid,
      contactId: payload.contactId || payload.contact_id,
      contact_id: payload.contactId || payload.contact_id,
      created_at_iso: payload.created_at_iso || payload.createdAt || new Date().toISOString(),
      createdAt: payload.createdAt || payload.created_at_iso || new Date().toISOString(),
    };

    const stringified = JSON.stringify(formattedPayload);
    // Pusher free/standard limit is 10KB (10240 bytes). If payload exceeds 9KB, strip heavy raw bodies.
    if (stringified.length > 9000) {
      const { rawBody, raw_body, message_content, ...leanPayload } = formattedPayload;
      formattedPayload = leanPayload;
    }

    await pusher.trigger(`org-${orgId}`, eventName, formattedPayload);
    console.log(`[Pusher] Successfully triggered ${eventName} on org-${orgId}`);

    // Trigger Pusher Beams Cloud Push for background / closed app delivery
    if (eventName === 'message:inbound' || eventName === 'message:new' || eventName === 'notification:new') {
      try {
        const { publishBeamsNotification } = await import('@/lib/pusher-beams');
        const contactName = formattedPayload.contactName || formattedPayload.customerName || formattedPayload.senderName || formattedPayload.title || 'New Message';
        let messageText = 'You received a new message.';
        if (typeof formattedPayload.content === 'string') {
          messageText = formattedPayload.content;
        } else if (typeof formattedPayload.text === 'string') {
          messageText = formattedPayload.text;
        } else if (typeof formattedPayload.body === 'string') {
          messageText = formattedPayload.body;
        } else if (typeof formattedPayload.message === 'string') {
          messageText = formattedPayload.message;
        } else if (typeof formattedPayload.message?.content === 'string') {
          messageText = formattedPayload.message.content;
        }
        const contactId = formattedPayload.contactId || 
          formattedPayload.contact_id || 
          formattedPayload.contact?.id || 
          formattedPayload.data?.contactId || 
          formattedPayload.data?.contact_id || 
          '';

        const interests: string[] = [`org-${orgId}-admins`];
        const assignedAgentId = formattedPayload.assignedAgentId || 
          formattedPayload.assigned_agent_id || 
          formattedPayload.contact?.assignedAgentId || 
          formattedPayload.contact?.assigned_agent_id || 
          formattedPayload.data?.assignedAgentId || 
          formattedPayload.data?.assigned_agent_id;

        if (assignedAgentId && typeof assignedAgentId === 'string' && assignedAgentId.trim()) {
          interests.push(`user-${assignedAgentId.trim()}`);
        }
        const assignedUserIds = formattedPayload.assignedUserIds || 
          formattedPayload.assigned_user_ids || 
          formattedPayload.contact?.assignedUserIds || 
          formattedPayload.contact?.assigned_user_ids || 
          formattedPayload.contact?.assignedUsers;

        if (Array.isArray(assignedUserIds)) {
          for (const u of assignedUserIds) {
            const uid = typeof u === 'string' ? u : (u && typeof u === 'object' ? (u.id as string) : null);
            if (uid && typeof uid === 'string' && !interests.includes(`user-${uid.trim()}`)) {
              interests.push(`user-${uid.trim()}`);
            }
          }
        }

        await publishBeamsNotification({
          interests,
          title: contactName,
          body: messageText,
          contactId,
          contactName,
        });
      } catch (beamsErr) {
        console.warn('[PusherBeams] Background push trigger error:', beamsErr);
      }
    }
  } catch (err) {
    console.error(`[Pusher] Failed to trigger event ${eventName} for org-${orgId}:`, err);
  }
};

// Client-side Pusher helper is exported from ./pusher-client
