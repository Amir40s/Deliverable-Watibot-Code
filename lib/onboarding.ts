import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Check if user needs onboarding
 * Returns true if user should be redirected to onboarding
 */
export async function checkOnboardingStatus(): Promise<{
    needsOnboarding: boolean;
    currentStep: number;
    user: unknown;
}> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return {
            needsOnboarding: false,
            currentStep: 0,
            user: null,
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            onboardingCompleted: true,
            onboardingStep: true,
            organizationId: true,
            organization: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    });

    if (!user) {
        return {
            needsOnboarding: false,
            currentStep: 0,
            user: null,
        };
    }

    return {
        needsOnboarding: !user.onboardingCompleted,
        currentStep: user.onboardingStep,
        user,
    };
}

/**
 * Update user's onboarding progress
 */
export async function updateOnboardingProgress(
    userId: string,
    step: number,
    completed: boolean = false
): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: {
            onboardingStep: step,
            onboardingCompleted: completed,
        },
    });
}
