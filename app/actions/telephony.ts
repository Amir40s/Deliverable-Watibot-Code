'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';
import { revalidatePath } from 'next/cache';

export async function getTwilioCapabilityToken() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return {
      success: true,
      token: null,
      isConfigured: false,
      identity: session.user.id,
      organizationId: session.user.organizationId,
    };
  }

  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: session.user.id }
    );

    token.addGrant(voiceGrant);

    return {
      success: true,
      token: token.toJwt(),
      isConfigured: true,
      identity: session.user.id,
      organizationId: session.user.organizationId,
    };
  } catch (err: any) {
    console.error('Failed to generate Twilio capability token:', err);
    return { success: false, error: err.message || 'Failed to generate token' };
  }
}

export async function getTelnyxCapabilityToken() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  const telnyxApiKey = process.env.TELNYX_API_KEY;
  const sipUsername = process.env.TELNYX_SIP_USERNAME;
  const sipPassword = process.env.TELNYX_SIP_PASSWORD;
  const connectionId = process.env.TELNYX_CONNECTION_ID;

  if (!sipUsername || !sipPassword) {
    return {
      success: true,
      isConfigured: false,
      identity: session.user.id,
      organizationId: session.user.organizationId,
    };
  }

  return {
    success: true,
    isConfigured: true,
    sipUsername,
    sipPassword,
    connectionId,
    identity: session.user.id,
    organizationId: session.user.organizationId,
  };
}

export async function logCallActivity(data: {
  contactId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  durationSeconds: number;
  status: 'COMPLETED' | 'MISSED' | 'REJECTED' | 'FAILED';
  notes?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const contact = await prisma.contact.findFirst({
      where: {
        id: data.contactId,
        organizationId: session.user.organizationId,
      },
    });

    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    const minutes = Math.floor(data.durationSeconds / 60);
    const seconds = data.durationSeconds % 60;
    const durationFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    let contentText = '';
    if (data.status === 'COMPLETED') {
      contentText = `📞 ${data.direction === 'INBOUND' ? 'Received' : 'Outbound'} Call (Duration: ${durationFormatted})`;
    } else if (data.status === 'MISSED') {
      contentText = `📞 Missed Call from +${contact.waId}`;
    } else if (data.status === 'REJECTED') {
      contentText = `📞 Call Declined (+${contact.waId})`;
    } else {
      contentText = `📞 Call Attempt Failed (+${contact.waId})`;
    }

    if (data.notes && data.notes.trim()) {
      contentText += `\nNote: ${data.notes.trim()}`;
    }

    const message = await prisma.message.create({
      data: {
        contactId: contact.id,
        direction: data.direction,
        type: 'SYSTEM',
        content: contentText,
        status: 'DELIVERED',
      },
    });

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastMessage: contentText,
        lastMessageAt: new Date(),
      },
    });

    revalidatePath('/live-chat');
    revalidatePath('/dashboard/pipeline');

    return { success: true, message };
  } catch (err: any) {
    console.error('Failed to log call activity:', err);
    return { success: false, error: err.message || 'Failed to log call' };
  }
}
