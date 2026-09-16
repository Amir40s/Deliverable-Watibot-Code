import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth-utils';
import { logActivity } from '@/lib/activityLog';

export const authOptions: NextAuthOptions = {
    adapter: undefined as any,
    session: {
        strategy: "jwt",
        maxAge: -1,
    },
    providers: [],
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                impersonationToken: { label: 'Token', type: 'text' },
                originalAdminId: { label: 'Original Admin ID', type: 'text' },
                originalAdminEmail: { label: 'Original Admin Email', type: 'text' }
            },
            async authorize(credentials) {
                // 1. Handle Impersonation
                if (credentials?.impersonationToken && credentials?.email) {
                    const identifier = `impersonation:${credentials.email}`
                    const tokenRecord = await prisma.verificationToken.findFirst({
                        where: {
                            identifier,
                            token: credentials.impersonationToken,
                            expires: { gt: new Date() }
                        }
                    })

                    if (!tokenRecord) {
                        throw new Error('Invalid or expired impersonation token')
                    }

                    // Impersonation successful - delete the token
                    await prisma.verificationToken.delete({
                        where: {
                            identifier_token: {
                                identifier,
                                token: credentials.impersonationToken
                            }
                        }
                    })

                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email },
                        include: { organization: true }
                    })

                    if (!user) throw new Error('User not found')

                    // Update last login
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { lastLoginAt: new Date() },
                    });

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        role: user.role,
                        organizationId: user.organizationId || undefined,
                        onboardingCompleted: user.onboardingCompleted,
                        onboardingStep: user.onboardingStep,
                        whatsappConnected: !!user.organization?.whatsappPhoneNumberId,
                        instagramConnected: !!user.organization?.instagramBusinessId,
                        facebookConnected: !!user.organization?.facebookPageId,
                        tiktokConnected: !!user.organization?.tiktokCreatorId,
                        permissions: user.permissions as Record<string, boolean> | null,
                        status: user.status,
                        trialStartDate: user.trialStartDate,
                        trialLimitDays: user.trialLimitDays,
                        trialDaysRemaining: null,
                        plan: user.organization?.plan || 'free',
                        planModulesAccess: (user.organization?.vendorConfig as any)?.modulesAccess || {},
                        knowledgeBaseManagement: ((user.organization?.vendorConfig as any)?.knowledgeBaseManagement || 'user') as 'user' | 'admin',
                        aiMessageLimit: typeof (user.organization?.vendorConfig as any)?.aiMessageLimit === 'number' ? (user.organization?.vendorConfig as any).aiMessageLimit : 5000,
                        isAiLimitUnlimited: !!(user.organization?.vendorConfig as any)?.isAiLimitUnlimited,
                        originalAdminId: credentials.originalAdminId || undefined,
                        originalAdminEmail: credentials.originalAdminEmail || undefined,
                    };
                }

                // 2. Handle Regular Login
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Invalid credentials');
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email,
                    },
                    include: {
                        organization: true,
                    },
                });

                if (!user || !user.password) {
                    throw new Error('Invalid credentials');
                }

                const isPasswordValid = await verifyPassword(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    throw new Error('Invalid credentials');
                }

                // INACTIVE users are completely blocked from logging in
                if (user.status === 'INACTIVE') {
                    throw new Error('Your account has been deactivated. Please contact support.');
                }

                // Update last login
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                });

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                    organizationId: user.organizationId || undefined,
                    onboardingCompleted: user.onboardingCompleted,
                    onboardingStep: user.onboardingStep,
                    whatsappConnected: !!user.organization?.whatsappPhoneNumberId,
                    instagramConnected: !!user.organization?.instagramBusinessId,
                    facebookConnected: !!user.organization?.facebookPageId,
                    tiktokConnected: !!user.organization?.tiktokCreatorId,
                    permissions: user.permissions as Record<string, boolean> | null,
                    status: user.status,
                    trialStartDate: user.trialStartDate,
                    trialLimitDays: user.trialLimitDays,
                    trialDaysRemaining: null,
                    plan: user.organization?.plan || 'free',
                    planModulesAccess: (user.organization?.vendorConfig as any)?.modulesAccess || {},
                    knowledgeBaseManagement: ((user.organization?.vendorConfig as any)?.knowledgeBaseManagement || 'user') as 'user' | 'admin',
                    aiMessageLimit: typeof (user.organization?.vendorConfig as any)?.aiMessageLimit === 'number' ? (user.organization?.vendorConfig as any).aiMessageLimit : 5000,
                    isAiLimitUnlimited: !!(user.organization?.vendorConfig as any)?.isAiLimitUnlimited,
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            if (user && user.id) {
                try {
                    const isPlatformAdmin = user.role === 'SUPER_ADMIN' || (user.role === 'ADMIN' && (!user.organizationId || !!(user.permissions as any)?.modules));
                    if (!isPlatformAdmin) {
                        const { ensureVendorAccount } = await import('@/lib/auth-vendor');
                        await ensureVendorAccount(user.id, user.name, user.email);
                    }
                } catch (err) {
                    console.error('[NextAuth] Error in signIn callback ensureVendorAccount:', err);
                }
            }
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            // 1. Initial sign in
            if (user) {
                const effectiveUserId = (user.id || token.sub) as string;
                let orgId = user.organizationId;
                const isPlatformAdmin = user.role === 'SUPER_ADMIN' || (user.role === 'ADMIN' && (!user.organizationId || !!(user.permissions as any)?.modules));
                if (!orgId && effectiveUserId && !isPlatformAdmin) {
                    try {
                        const { ensureVendorAccount } = await import('@/lib/auth-vendor');
                        orgId = (await ensureVendorAccount(effectiveUserId, user.name, user.email)) || undefined;
                    } catch (err) {
                        console.error('[NextAuth] Error creating vendor in jwt callback:', err);
                    }
                }

                const currentDbUser = await prisma.user.findUnique({
                    where: { id: effectiveUserId },
                    select: { 
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        organizationId: true, 
                        role: true, 
                        status: true, 
                        onboardingCompleted: true, 
                        onboardingStep: true, 
                        permissions: true, 
                        trialStartDate: true, 
                        trialLimitDays: true 
                    }
                }).catch(() => null);

                token.id = user.id || (token.sub as string);
                token.name = user.name || currentDbUser?.name || (token.name as string) || undefined;
                token.email = user.email || currentDbUser?.email || (token.email as string) || undefined;
                token.picture = (user as any).image || currentDbUser?.image || (token.picture as string) || undefined;
                token.role = currentDbUser?.role || user.role;
                token.organizationId = currentDbUser?.organizationId || orgId || user.organizationId;
                token.onboardingCompleted = true;
                token.onboardingStep = 3;
                token.permissions = (currentDbUser?.permissions || user.permissions) as Record<string, boolean> | null;
                token.status = currentDbUser?.status || user.status || 'PENDING';
                token.trialStartDate = currentDbUser?.trialStartDate || user.trialStartDate;
                token.trialLimitDays = currentDbUser?.trialLimitDays || user.trialLimitDays;
                token.plan = (user as any).plan;
                token.knowledgeBaseManagement = (user as any).knowledgeBaseManagement || 'user';
                token.aiMessageLimit = typeof (user as any).aiMessageLimit === 'number' ? (user as any).aiMessageLimit : 5000;
                token.isAiLimitUnlimited = !!(user as any).isAiLimitUnlimited;
                if ((user as any).originalAdminId && (user as any).originalAdminId !== user.id) {
                    token.originalAdminId = (user as any).originalAdminId;
                    token.originalAdminEmail = (user as any).originalAdminEmail;
                } else {
                    delete token.originalAdminId;
                    delete token.originalAdminEmail;
                }

                // If user has no organizationId in user table, check if they own an organization
                if (!token.organizationId && effectiveUserId) {
                    const ownedOrg = await prisma.organization.findFirst({
                        where: { ownerId: effectiveUserId },
                        select: { id: true, name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true, vendorConfig: true }
                    }).catch(() => null);
                    if (ownedOrg) {
                        token.organizationId = ownedOrg.id;
                        token.organizationName = ownedOrg.name;
                        token.whatsappConnected = !!ownedOrg.whatsappPhoneNumberId;
                        token.instagramConnected = !!ownedOrg.instagramBusinessId;
                        token.facebookConnected = !!ownedOrg.facebookPageId;
                        token.tiktokConnected = !!ownedOrg.tiktokCreatorId;
                        token.plan = ownedOrg.plan ?? 'free';
                        token.planModulesAccess = (ownedOrg.vendorConfig as any)?.modulesAccess || {};
                        token.knowledgeBaseManagement = (ownedOrg.vendorConfig as any)?.knowledgeBaseManagement || 'user';
                        token.aiMessageLimit = typeof (ownedOrg.vendorConfig as any)?.aiMessageLimit === 'number' ? (ownedOrg.vendorConfig as any).aiMessageLimit : 5000;
                        token.isAiLimitUnlimited = !!(ownedOrg.vendorConfig as any)?.isAiLimitUnlimited;
                        prisma.user.update({
                            where: { id: effectiveUserId },
                            data: { organizationId: ownedOrg.id }
                        }).catch(() => {});
                    }
                }

                // Calculate remaining days on initial sign in
                if (token.status === 'TRIAL') {
                    const systemConfig = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'desc' } });
                    const limit = (token.trialLimitDays as number) ?? systemConfig?.trialLimitDays ?? 15;
                    const startDate = (token.trialStartDate as Date) || new Date();
                    const diffTime = Math.abs(new Date().getTime() - new Date(startDate).getTime());
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    token.trialDaysRemaining = Math.max(0, limit - diffDays);
                } else {
                    token.trialDaysRemaining = null;
                }

                if (token.organizationId && !token.organizationName) {
                    const org = await prisma.organization.findUnique({
                        where: { id: token.organizationId },
                        select: { name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true, vendorConfig: true },
                    }).catch(() => null);
                    token.organizationName = org?.name ?? undefined;
                    token.whatsappConnected = !!org?.whatsappPhoneNumberId;
                    token.instagramConnected = !!org?.instagramBusinessId;
                    token.facebookConnected = !!org?.facebookPageId;
                    token.tiktokConnected = !!org?.tiktokCreatorId;
                    token.plan = org?.plan ?? 'free';
                    token.planModulesAccess = (org?.vendorConfig as any)?.modulesAccess || {};
                    token.knowledgeBaseManagement = (org?.vendorConfig as any)?.knowledgeBaseManagement || 'user';
                    token.aiMessageLimit = typeof (org?.vendorConfig as any)?.aiMessageLimit === 'number' ? (org?.vendorConfig as any).aiMessageLimit : 5000;
                    token.isAiLimitUnlimited = !!(org?.vendorConfig as any)?.isAiLimitUnlimited;
                }
                console.log(`[NextAuth JWT Initial] userId: ${token.id}, name: ${token.name}, orgId: ${token.organizationId}`);
            }

            const targetUserId = (token.id || token.sub) as string | undefined;

            // 2. Handle session update (e.g. after onboarding or profile edit or project switch)
            if (trigger === 'update') {
                if (session && typeof session === 'object') {
                    if ((session as any).onboardingCompleted !== undefined) {
                        token.onboardingCompleted = (session as any).onboardingCompleted;
                    }
                    if ((session as any).onboardingStep !== undefined) {
                        token.onboardingStep = (session as any).onboardingStep;
                    }
                }

                if (targetUserId) {
                    const updatedUser = await prisma.user.findUnique({
                        where: { id: targetUserId },
                        select: {
                            name: true,
                            image: true,
                            email: true,
                            onboardingCompleted: true,
                            onboardingStep: true,
                            organizationId: true,
                            role: true,
                            permissions: true,
                            status: true,
                            trialStartDate: true,
                            trialLimitDays: true,
                        },
                    }).catch(() => null);

                    if (updatedUser) {
                        token.id = targetUserId;
                        if (updatedUser.name) token.name = updatedUser.name;
                        if (updatedUser.email) token.email = updatedUser.email;
                        if (updatedUser.image) token.picture = updatedUser.image;
                        token.onboardingCompleted = updatedUser.onboardingCompleted;
                        token.onboardingStep = updatedUser.onboardingStep;
                        token.organizationId = updatedUser.organizationId || undefined;
                        token.role = updatedUser.role;
                        token.permissions = updatedUser.permissions as Record<string, boolean> | null;
                        token.status = updatedUser.status;
                        token.trialStartDate = updatedUser.trialStartDate;
                        token.trialLimitDays = updatedUser.trialLimitDays;
                        token.lastPermissionCheck = Date.now();

                        // If user has no organizationId in user table, self-heal with owned organization
                        if (!token.organizationId) {
                            const ownedOrg = await prisma.organization.findFirst({
                                where: { ownerId: targetUserId },
                                select: { id: true, name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true, vendorConfig: true }
                            }).catch(() => null);
                            if (ownedOrg) {
                                token.organizationId = ownedOrg.id;
                                token.organizationName = ownedOrg.name;
                                prisma.user.update({
                                    where: { id: targetUserId },
                                    data: { organizationId: ownedOrg.id }
                                }).catch(() => {});
                            }
                        }

                        // Calculate remaining days on update
                        if (token.status === 'TRIAL') {
                            const systemConfig = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'desc' } });
                            const limit = (token.trialLimitDays as number) ?? systemConfig?.trialLimitDays ?? 15;
                            const startDate = (token.trialStartDate as Date) || new Date();
                            const diffTime = Math.abs(new Date().getTime() - new Date(startDate).getTime());
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            token.trialDaysRemaining = Math.max(0, limit - diffDays);
                        } else {
                            token.trialDaysRemaining = null;
                        }
                        if (token.organizationId) {
                            const org = await prisma.organization.findUnique({
                                where: { id: token.organizationId },
                                select: { name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true, vendorConfig: true },
                            }).catch(() => null);
                            if (org) {
                                token.organizationName = org.name;
                                token.whatsappConnected = !!org.whatsappPhoneNumberId;
                                token.instagramConnected = !!org.instagramBusinessId;
                                token.facebookConnected = !!org.facebookPageId;
                                token.tiktokConnected = !!org.tiktokCreatorId;
                                token.plan = org.plan;
                                token.planModulesAccess = (org.vendorConfig as any)?.modulesAccess || {};
                                token.knowledgeBaseManagement = (org.vendorConfig as any)?.knowledgeBaseManagement || 'user';
                                token.aiMessageLimit = typeof (org.vendorConfig as any)?.aiMessageLimit === 'number' ? (org.vendorConfig as any).aiMessageLimit : 5000;
                                token.isAiLimitUnlimited = !!(org.vendorConfig as any)?.isAiLimitUnlimited;
                            }
                        }
                        console.log(`[NextAuth JWT Trigger Update] userId: ${targetUserId}, name: ${token.name}, orgId: ${token.organizationId}`);
                    }
                }
            } else if (targetUserId) {
                // 3. Periodic Background session check: refetch user details, permissions, and active project
                const now = Date.now();
                const lastCheck = (token.lastPermissionCheck as number) || 0;
                // Throttling: If checked within last 30s and already populated, avoid hitting DB
                if (token.role && (now - lastCheck) < 30000) {
                    return token;
                }
                token.lastPermissionCheck = now;

                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: targetUserId },
                        select: { 
                            name: true,
                            email: true,
                            image: true,
                            permissions: true, 
                            role: true, 
                            status: true, 
                            onboardingCompleted: true, 
                            onboardingStep: true, 
                            organizationId: true,
                            trialStartDate: true,
                            trialLimitDays: true
                        }
                    });
                    if (dbUser) {
                        token.id = targetUserId;
                        if (dbUser.name) token.name = dbUser.name;
                        if (dbUser.email) token.email = dbUser.email;
                        if (dbUser.image) token.picture = dbUser.image;
                        if (token.originalAdminId && token.originalAdminId === targetUserId) {
                            delete token.originalAdminId;
                            delete token.originalAdminEmail;
                        }
                        token.permissions = dbUser.permissions as Record<string, boolean> | null;
                        token.role = dbUser.role;
                        token.status = dbUser.status;
                        token.onboardingCompleted = dbUser.onboardingCompleted;
                        token.onboardingStep = dbUser.onboardingStep;
                        token.trialStartDate = dbUser.trialStartDate;
                        token.trialLimitDays = dbUser.trialLimitDays;

                        let effectiveOrgId = dbUser.organizationId;
                        if (!effectiveOrgId) {
                            // Self-healing check: check if user owns an organization
                            const ownedOrg = await prisma.organization.findFirst({
                                where: { ownerId: targetUserId },
                                select: { id: true, name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true, vendorConfig: true }
                            }).catch(() => null);
                            if (ownedOrg) {
                                effectiveOrgId = ownedOrg.id;
                                token.organizationName = ownedOrg.name;
                                token.whatsappConnected = !!ownedOrg.whatsappPhoneNumberId;
                                token.instagramConnected = !!ownedOrg.instagramBusinessId;
                                token.facebookConnected = !!ownedOrg.facebookPageId;
                                token.tiktokConnected = !!ownedOrg.tiktokCreatorId;
                                token.plan = ownedOrg.plan ?? 'free';
                                token.planModulesAccess = (ownedOrg.vendorConfig as any)?.modulesAccess || {};
                                token.knowledgeBaseManagement = (ownedOrg.vendorConfig as any)?.knowledgeBaseManagement || 'user';
                                token.aiMessageLimit = typeof (ownedOrg.vendorConfig as any)?.aiMessageLimit === 'number' ? (ownedOrg.vendorConfig as any).aiMessageLimit : 5000;
                                token.isAiLimitUnlimited = !!(ownedOrg.vendorConfig as any)?.isAiLimitUnlimited;
                                prisma.user.update({
                                    where: { id: targetUserId },
                                    data: { organizationId: ownedOrg.id }
                                }).catch(() => {});
                            }
                        }

                        token.organizationId = effectiveOrgId || undefined;

                        if (effectiveOrgId) {
                            const org = await prisma.organization.findUnique({
                                where: { id: effectiveOrgId },
                                select: { name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true, vendorConfig: true },
                            }).catch(() => null);
                            if (org) {
                                token.organizationName = org.name;
                                token.whatsappConnected = !!org.whatsappPhoneNumberId;
                                token.instagramConnected = !!org.instagramBusinessId;
                                token.facebookConnected = !!org.facebookPageId;
                                token.tiktokConnected = !!org.tiktokCreatorId;
                                token.plan = org.plan;
                                token.planModulesAccess = (org.vendorConfig as any)?.modulesAccess || {};
                                token.knowledgeBaseManagement = (org.vendorConfig as any)?.knowledgeBaseManagement || 'user';
                                token.aiMessageLimit = typeof (org.vendorConfig as any)?.aiMessageLimit === 'number' ? (org.vendorConfig as any).aiMessageLimit : 5000;
                                token.isAiLimitUnlimited = !!(org.vendorConfig as any)?.isAiLimitUnlimited;
                            }
                        }

                        // Re-calculate trial days on background check
                        if (token.status === 'TRIAL') {
                            const systemConfig = await prisma.systemConfig.findFirst({ orderBy: { createdAt: 'desc' } });
                            const limit = (token.trialLimitDays as number) ?? systemConfig?.trialLimitDays ?? 15;
                            const startDate = (token.trialStartDate as Date) || new Date();
                            const diffTime = Math.abs(new Date().getTime() - new Date(startDate).getTime());
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            token.trialDaysRemaining = Math.max(0, limit - diffDays);
                        } else {
                            token.trialDaysRemaining = null;
                        }
                    }
                } catch (err) {
                    console.error('[NextAuth JWT background check error, retaining existing token state]:', err);
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = (token.id || token.sub) as string;
                if (token.name) session.user.name = token.name as string;
                if (token.email) session.user.email = token.email as string;
                if (token.picture || (token as any).image) session.user.image = (token.picture || (token as any).image) as string;
                session.user.role = (token.role as string) || 'USER';
                session.user.organizationId = token.organizationId as string | undefined;
                session.user.organizationName = token.organizationName as string | undefined;
                session.user.onboardingCompleted = true;
                session.user.onboardingStep = 3;
                session.user.whatsappConnected = !!token.whatsappConnected;
                session.user.instagramConnected = !!token.instagramConnected;
                session.user.facebookConnected = !!token.facebookConnected;
                session.user.tiktokConnected = !!token.tiktokConnected;
                session.user.permissions = token.permissions as Record<string, boolean> | null;
                session.user.status = (token.status as string) || 'PENDING';
                session.user.trialStartDate = (token.trialStartDate as Date) || null;
                session.user.trialLimitDays = (token.trialLimitDays as number) || null;
                session.user.trialDaysRemaining = (token.trialDaysRemaining as number) ?? null;
                session.user.plan = (token.plan as string) || 'free';
                session.user.planModulesAccess = (token.planModulesAccess as Record<string, boolean>) || {};
                session.user.originalAdminId = token.originalAdminId as string | undefined;
                session.user.originalAdminEmail = token.originalAdminEmail as string | undefined;
                session.user.knowledgeBaseManagement = (token.knowledgeBaseManagement as 'user' | 'admin') || 'user';
                session.user.aiMessageLimit = typeof token.aiMessageLimit === 'number' ? token.aiMessageLimit : 5000;
                session.user.isAiLimitUnlimited = !!token.isAiLimitUnlimited;

                // Fallback: If organizationName or whatsapp connection is not populated, resolve from DB
                if (session.user.organizationId && (!session.user.organizationName || !session.user.whatsappConnected)) {
                    const org = await prisma.organization.findUnique({
                        where: { id: session.user.organizationId },
                        select: { name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true },
                    }).catch(() => null);
                    if (org?.name) session.user.organizationName = org.name;
                    if (org?.plan) session.user.plan = org.plan;
                    session.user.whatsappConnected = !!org?.whatsappPhoneNumberId;
                    session.user.instagramConnected = !!org?.instagramBusinessId;
                    session.user.facebookConnected = !!org?.facebookPageId;
                    session.user.tiktokConnected = !!org?.tiktokCreatorId;
                }

                // Extra safety: If organizationId is still missing, attempt to resolve owned organization
                if (!session.user.organizationId && session.user.id) {
                    const org = await prisma.organization.findFirst({
                        where: { ownerId: session.user.id },
                        select: { id: true, name: true, whatsappPhoneNumberId: true, instagramBusinessId: true, facebookPageId: true, tiktokCreatorId: true, plan: true },
                    }).catch(() => null);
                    if (org) {
                        session.user.organizationId = org.id;
                        session.user.organizationName = org.name;
                        session.user.plan = org.plan || session.user.plan;
                        session.user.whatsappConnected = !!org.whatsappPhoneNumberId;
                        session.user.instagramConnected = !!org.instagramBusinessId;
                        session.user.facebookConnected = !!org.facebookPageId;
                        session.user.tiktokConnected = !!org.tiktokCreatorId;
                    }
                }
            }
            return session;
        },
    },
    events: {
        async createUser(message) {
            try {
                const user = message.user;
                if (user && user.id) {
                    const { ensureVendorAccount } = await import('@/lib/auth-vendor');
                    await ensureVendorAccount(user.id, user.name, user.email);
                }
            } catch (error) {
                console.error('[NextAuth] Error in createUser event:', error);
            }
        },
        async signIn(message) {
            try {
                const user = message.user;
                if (user && user.organizationId) {
                    await logActivity({
                        organizationId: user.organizationId,
                        userId: user.id,
                        userEmail: user.email,
                        userName: user.name,
                        action: 'Logged In',
                        module: 'Authentication',
                        target: 'System',
                        status: 'success'
                    });
                }
            } catch (error) {
                console.error('Error logging signIn event:', error);
            }
        },
        async signOut(message) {
            try {
                const token = message.token;
                if (token && token.organizationId) {
                    await logActivity({
                        organizationId: token.organizationId,
                        userId: token.id,
                        userEmail: token.email,
                        userName: token.name,
                        action: 'Logged Out',
                        module: 'Authentication',
                        target: 'System',
                        status: 'success'
                    });
                }
            } catch (error) {
                console.error('Error logging signOut event:', error);
            }
        }
    },
    pages: {
        signIn: '/login',
        signOut: '/login',
        error: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: false,
};
