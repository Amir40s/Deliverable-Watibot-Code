'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { internalSendInstagramMessage } from '@/lib/instagram/api';
import type { Prisma } from '@/lib/generated/prisma';

export async function sendConnectedInstagramMessage(contactId: string, message: string, skipSessionCheck: boolean = false, mediaUrl?: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.organizationId || !session.user.id) {
            return { success: false, error: 'Unauthorized' };
        }

        const trimmed = message.trim();
        if (!trimmed && !mediaUrl) {
            return { success: false, error: 'Message cannot be empty.' };
        }

        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { organization: true },
        });

        if (!contact || contact.organizationId !== session.user.organizationId) {
            return { success: false, error: 'Contact not found.' };
        }

        if (contact.platform !== 'INSTAGRAM') {
            return { success: false, error: 'Selected contact is not an Instagram chat.' };
        }

        const newMessage = await internalSendInstagramMessage(contactId, trimmed, contact, session.user.id, undefined, mediaUrl);
        return { success: true, data: newMessage };
    } catch (error: unknown) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send Instagram message.',
        };
    }
}

export async function getInstagramChatContacts() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return [];

    const where: Prisma.ContactWhereInput = {
        organizationId: session.user.organizationId,
        platform: 'INSTAGRAM',
    };

    if (session.user.role === 'USER') {
        where.assignedUsers = {
            some: { id: session.user.id },
        };
    }

    return prisma.contact.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
    });
}

export async function getInstagramChatMessages(contactId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return [];

    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, organizationId: true, platform: true },
    });
    if (!contact || contact.organizationId !== session.user.organizationId || contact.platform !== 'INSTAGRAM') {
        return [];
    }

    return prisma.message.findMany({
        where: {
            contactId,
            type: { notIn: ['comment', 'comment_reply'] },
        },
        orderBy: { createdAt: 'asc' },
    });
}
