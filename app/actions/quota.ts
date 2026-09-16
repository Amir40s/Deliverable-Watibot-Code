'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkQuota, ResourceLimit } from '@/lib/quota';

export async function getQuotaStatus(resource: ResourceLimit) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { allowed: false, limit: 0, current: 0 };
  }
  return checkQuota(session.user.organizationId, resource);
}
