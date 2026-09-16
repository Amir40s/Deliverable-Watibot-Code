'use server';

import { prisma } from '@/lib/prisma';

export interface LogActivityParams {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: string;         // e.g. "Created", "Updated", "Deleted", "Triggered"
  module: string;         // e.g. "Flows", "Contacts", "Templates"
  target?: string | null; // e.g. "Welcome Flow", "John Doe"
  details?: string | null; // Extra context
  status?: 'success' | 'warning' | 'failed';
}

/**
 * Fire-and-forget activity log writer.
 * Never throws — failure to log must NEVER break the main action.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        userEmail: params.userEmail ?? null,
        userName: params.userName ?? null,
        action: params.action,
        module: params.module,
        target: params.target ?? null,
        details: params.details ?? null,
        status: params.status ?? 'success',
      },
    });
  } catch (err) {
    // Silently ignore — logging must never crash the app
    console.warn('[ActivityLog] Failed to write log:', err);
  }
}
