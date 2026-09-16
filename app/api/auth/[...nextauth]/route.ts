import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import GoogleProvider from 'next-auth/providers/google';
import { NextRequest } from 'next/server';

const handler = async (req: NextRequest, ctx: any) => {
    const config = await prisma.systemConfig.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    const providers = [...authOptions.providers];

    // Handle Google Dynamic Config — DB first, .env as fallback
    const googleClientId = config?.googleClientId || process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = config?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if ((config?.googleLoginEnabled ?? true) && googleClientId && googleClientSecret) {
        const googleIndex = providers.findIndex(p => p.id === 'google');
        const googleProvider = GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "openid email profile",
                    access_type: "offline",
                    prompt: "consent",
                    response_type: "code"
                }
            }
        });
        
        if (googleIndex > -1) providers[googleIndex] = googleProvider;
        else providers.push(googleProvider);
    }

    // In App Router, NextAuth handles the response automatically when called this way
    return await NextAuth(req, ctx, {
        ...authOptions,
        providers
    });
};

export { handler as GET, handler as POST };
