import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isPlatformAdminUser, getDefaultAdminRoute } from "@/lib/admin/rbac";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    console.log(`[Route Guard Home] session user: ${session.user.id}, role: ${session.user.role}, onboardingCompleted: ${session.user.onboardingCompleted}`);
    const isImpersonating = !!(session.user.originalAdminId && session.user.originalAdminId !== session.user.id);
    if (isPlatformAdminUser(session.user) && !isImpersonating) {
      redirect(getDefaultAdminRoute(session.user));
    } else {
      redirect('/dashboard');
    }
  }
  const config = await prisma.systemConfig.findFirst({
    orderBy: { createdAt: 'asc' }
  });

  if (config?.homePageType === 'EXTERNAL' && config.externalHomePageUrl) {
    redirect(config.externalHomePageUrl);
  }

  redirect('/login');
}
