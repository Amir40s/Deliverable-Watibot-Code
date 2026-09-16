import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            role: string;
            organizationId?: string;
            organizationName?: string;
            onboardingCompleted: boolean;
            onboardingStep: number;
            whatsappConnected: boolean;
            instagramConnected: boolean;
            facebookConnected: boolean;
            tiktokConnected: boolean;
            permissions?: any;
            status: string;
            trialStartDate: Date | null;
            trialLimitDays: number | null;
            trialDaysRemaining: number | null;
            plan?: string;
            planModulesAccess?: Record<string, boolean>;
            originalAdminId?: string;
            originalAdminEmail?: string;
            knowledgeBaseManagement?: 'user' | 'admin';
            aiMessageLimit?: number;
            isAiLimitUnlimited?: boolean;
        } & DefaultSession['user'];
    }

    interface User extends DefaultUser {
        role: string;
        organizationId?: string;
        onboardingCompleted: boolean;
        onboardingStep: number;
        whatsappConnected: boolean;
        instagramConnected: boolean;
        facebookConnected: boolean;
        tiktokConnected: boolean;
        permissions?: Record<string, boolean> | null;
        status: string;
        trialStartDate: Date | null;
        trialLimitDays: number | null;
        trialDaysRemaining: number | null;
        plan?: string;
        planModulesAccess?: Record<string, boolean>;
        originalAdminId?: string;
        originalAdminEmail?: string;
        knowledgeBaseManagement?: 'user' | 'admin';
        aiMessageLimit?: number;
        isAiLimitUnlimited?: boolean;
    }
}

declare module 'next-auth/jwt' {
    interface JWT extends DefaultJWT {
        id: string;
        role: string;
        organizationId?: string;
        organizationName?: string;
        onboardingCompleted: boolean;
        onboardingStep: number;
        whatsappConnected: boolean;
        instagramConnected: boolean;
        facebookConnected: boolean;
        tiktokConnected: boolean;
        permissions?: Record<string, boolean> | null;
        status: string;
        trialStartDate: Date | null;
        trialLimitDays: number | null;
        trialDaysRemaining: number | null;
        plan?: string;
        planModulesAccess?: Record<string, boolean>;
        originalAdminId?: string;
        originalAdminEmail?: string;
        knowledgeBaseManagement?: 'user' | 'admin';
        aiMessageLimit?: number;
        isAiLimitUnlimited?: boolean;
    }
}
