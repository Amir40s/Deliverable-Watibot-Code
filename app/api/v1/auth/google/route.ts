import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, avatar, googleId } = body;

    if (!email) {
      return NextResponse.json(
        { status: 400, error: 'Email is required for Google authentication.' },
        { status: 400 }
      );
    }

    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { organization: true },
    });

    if (!user) {
      const projectApiKey = `wbpk_${crypto.randomBytes(12).toString('hex')}`;
      const displayName = `${name || 'User'}'s Workspace`;
      const slug = `workspace-${Date.now()}`;

      user = await prisma.$transaction(async (tx) => {
        const newOrg = await tx.organization.create({
          data: {
            name: displayName,
            slug: slug,
            plan: 'free',
            status: 'active',
            shopifyIntegrationToken: projectApiKey,
          },
        });

        const newUser = await tx.user.create({
          data: {
            name: name || 'Google User',
            email: email.toLowerCase().trim(),
            image: avatar || null,
            role: 'ADMIN',
            status: 'PENDING',
            organizationId: newOrg.id,
          },
          include: { organization: true },
        });

        await tx.organization.update({
          where: { id: newOrg.id },
          data: { ownerId: newUser.id },
        });

        return newUser;
      });
    }
    let projectApiKey = user.organization?.shopifyIntegrationToken;
    if (!projectApiKey && user.organizationId) {
      projectApiKey = `wbpk_${crypto.randomBytes(12).toString('hex')}`;
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { shopifyIntegrationToken: projectApiKey },
      });
    }

    return NextResponse.json({
      status: 200,
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        organizationId: user.organizationId,
        status: user.status,
      },
      projectApiKey: projectApiKey,
    });
  } catch (error: any) {
    console.error('Google Auth API error:', error);
    return NextResponse.json(
      { status: 500, error: error?.message || 'Failed to authenticate with Google.' },
      { status: 500 }
    );
  }
}
