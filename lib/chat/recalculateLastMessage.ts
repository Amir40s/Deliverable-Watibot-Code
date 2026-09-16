import { prisma } from "@/lib/prisma";

/**
 * Format message preview string based on message content and type
 */
export function formatMessagePreview(message: { content?: string | null; type?: string | null }): string {
  if (message.content && message.content.trim() !== '') {
    return message.content.trim();
  }

  const rawType = (message.type || 'text').toLowerCase();
  switch (rawType) {
    case 'image':
      return '[Image]';
    case 'video':
      return '[Video]';
    case 'audio':
      return '[Audio]';
    case 'voice':
    case 'ptt':
      return '[Voice Message]';
    case 'document':
      return '[Document]';
    case 'sticker':
      return '[Sticker]';
    case 'location':
      return '[Location]';
    case 'contact':
    case 'vcard':
      return '[Contact]';
    case 'interactive':
      return '[Interactive Message]';
    case 'template':
      return '[Template Message]';
    default:
      return `[${rawType}]`;
  }
}

/**
 * Recalculate and persist the latest remaining non-internal message for a contact.
 */
export async function recalculateContactLastMessage(contactId: string) {
  const latestRemainingMessage = await prisma.message.findFirst({
    where: {
      contactId,
      type: { notIn: ['comment', 'comment_reply', 'internal_log'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  let lastMessageText: string | null = null;
  let lastMessageAt: Date = new Date();

  if (latestRemainingMessage) {
    lastMessageText = formatMessagePreview(latestRemainingMessage);
    lastMessageAt = latestRemainingMessage.createdAt;
  } else {
    // If no remaining messages exist for this contact, fetch contact's creation date
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { createdAt: true },
    });
    if (contact?.createdAt) {
      lastMessageAt = contact.createdAt;
    }
  }

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      lastMessage: lastMessageText,
      lastMessageAt: lastMessageAt,
    },
  });

  return {
    contactId,
    lastMessage: lastMessageText,
    lastMessageAt,
    latestRemainingMessage,
    updatedContact,
  };
}
