import { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma';

export interface AgentAccessCheckResult {
  allowed: boolean;
  error?: string;
  contact?: any;
}

/**
 * Determines whether a logged in session is an Admin (ADMIN or SUPER_ADMIN).
 */
export function isAdminUser(session: Session | null | undefined): boolean {
  if (!session?.user?.role) return false;
  return session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
}

/**
 * Builds Prisma filter condition to restrict conversation queries based on agent permissions.
 * Admins can access all conversations within their organization.
 * Live Agents (role: 'USER') can ONLY access conversations assigned to them.
 */
export function buildAgentConversationWhere(session: Session): Prisma.ContactWhereInput {
  const orgId = session.user.organizationId;
  if (!orgId) {
    throw new Error('Unauthorized: Organization ID is missing');
  }

  const baseWhere: Prisma.ContactWhereInput = {
    organizationId: orgId,
  };

  if (isAdminUser(session)) {
    return baseWhere;
  }

  // Live Agent: Must be explicitly assigned
  const agentId = session.user.id;
  return {
    ...baseWhere,
    OR: [
      { assignedAgentId: agentId },
      { assignedUsers: { some: { id: agentId } } },
    ],
  };
}

/**
 * Verifies that the logged-in session has permission to access or modify a specific conversation/contact.
 * Throws or returns { allowed: false } if permission check fails.
 */
export async function verifyAgentConversationAccess(
  session: Session | null | undefined,
  contactId: string
): Promise<AgentAccessCheckResult> {
  if (!session?.user?.id || !session.user.organizationId) {
    return { allowed: false, error: 'Unauthorized: Session missing' };
  }

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      organizationId: session.user.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      assignedAgentId: true,
      assignedUsers: {
        select: { id: true, email: true },
      },
    },
  });

  if (!contact) {
    return { allowed: false, error: 'Conversation not found. Please refresh the page or select the conversation from the list.' };
  }

  if (isAdminUser(session)) {
    return { allowed: true, contact };
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  const isAssigned =
    contact.assignedAgentId === userId ||
    contact.assignedUsers.some(u => u.id === userId || (userEmail && u.email === userEmail));

  if (!isAssigned) {
    return {
      allowed: false,
      error: 'Forbidden: You do not have permission to access this conversation.',
      contact,
    };
  }

  return { allowed: true, contact };
}
