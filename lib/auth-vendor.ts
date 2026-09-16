import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function ensureVendorAccount(userId: string, name?: string | null, email?: string | null) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true, name: true, email: true, status: true, role: true, permissions: true }
    });

    if (!existingUser) return null;

    // Platform admin check: Never create a vendor organization for Super Admins or Admin Staff!
    const isPlatformAdmin = existingUser.role === 'SUPER_ADMIN' || (existingUser.role === 'ADMIN' && (!existingUser.organizationId || !!(existingUser.permissions as any)?.modules));
    if (isPlatformAdmin) {
      return null;
    }

    // If user already has an organizationId, return it immediately
    if (existingUser.organizationId) {
      return existingUser.organizationId;
    }

    const displayName = (name || existingUser.name || email?.split('@')[0] || existingUser.email?.split('@')[0] || 'My Company').trim();
    const slugBase = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'company';
    const slug = `${slugBase}-${Date.now()}`;
    const projectApiKey = `wbpk_${crypto.randomBytes(12).toString('hex')}`;

    // Execute Organization creation and User update inside a single Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: displayName,
          slug: slug,
          plan: 'free',
          status: 'active',
          isAiBotEnabled: false,
          shopifyIntegrationToken: projectApiKey,
        }
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          organizationId: organization.id,
          role: 'ADMIN',
          status: 'PENDING',
          onboardingCompleted: true,
          onboardingStep: 3,
        }
      });

      await tx.organization.update({
        where: { id: organization.id },
        data: { ownerId: updatedUser.id }
      });

      return { organization, updatedUser };
    });

    return result.organization.id;
  } catch (error) {
    console.error('[ensureVendorAccount] Transactional vendor creation error:', error);
    throw error;
  }
}
