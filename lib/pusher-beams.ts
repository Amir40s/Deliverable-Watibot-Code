import axios from 'axios';

const DEFAULT_INSTANCE_ID = 'b6106d47-6d42-4553-adc3-8dd9dccef681';

export interface BeamsNotificationParams {
  interests: string[];
  title: string;
  body: string;
  contactId?: string;
  contactName?: string;
  deepLink?: string;
  icon?: string;
}

export async function publishBeamsNotification(params: BeamsNotificationParams) {
  try {
    let instanceId = process.env.PUSHER_BEAMS_INSTANCE_ID || DEFAULT_INSTANCE_ID;
    let secretKey = process.env.PUSHER_BEAMS_SECRET_KEY || process.env.PUSHER_BEAMS_PRIMARY_KEY || '';

    if (!secretKey) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const dbConfig = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'desc' } });
        if (dbConfig) {
          const raw = dbConfig as any;
          if (raw.pusherBeamsInstanceId) instanceId = raw.pusherBeamsInstanceId;
          if (raw.pusherBeamsSecretKey) secretKey = raw.pusherBeamsSecretKey;
        }
      } catch (_) {}
    }

    if (!secretKey) {
      console.warn('[PusherBeams] PUSHER_BEAMS_SECRET_KEY is not set. Skipping push notification.');
      return { success: false, error: 'Missing PUSHER_BEAMS_SECRET_KEY' };
    }

    const { interests, title, body: rawBody, contactId, contactName } = params;
    if (!interests || interests.length === 0) {
      return { success: false, error: 'No interests provided' };
    }

    const body = (rawBody && rawBody.length > 500) ? rawBody.slice(0, 497) + '...' : (rawBody || '');

    const payload = {
      interests,
      fcm: {
        notification: {
          title,
          body,
          icon: 'launcher_icon',
          sound: 'default',
          android_channel_id: 'watibot_messages_channel',
        },
        data: {
          title,
          body,
          contactId: contactId || '',
          contact_id: contactId || '',
          contactName: contactName || '',
          type: 'message:new',
        },
      },
      apns: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          badge: 1,
        },
        data: {
          contactId: contactId || '',
          contactName: contactName || '',
          type: 'message:new',
        },
      },
    };

    const url = `https://${instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${instanceId}/publishes/interests`;

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      timeout: 5000,
    });

    console.log(`[PusherBeams] Published push to interests [${interests.join(', ')}]: publishId=${response.data?.publishId}`);
    return { success: true, publishId: response.data?.publishId };
  } catch (error: any) {
    console.error('[PusherBeams] Failed to publish notification:', error?.response?.data || error?.message || error);
    return { success: false, error: error?.message || 'Publish failed' };
  }
}
