import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getWindowReminderSettings } from '@/app/actions/window-reminders';
import WindowRemindersClient from '@/components/automation/window-reminders/WindowRemindersClient';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';

export const metadata = {
  title: 'WhatsApp 24h Window Reminders | WatiBot Automation',
  description: 'Manage automated WhatsApp 24-hour customer service window expiry warning rules and history.'
};

export default async function WindowRemindersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect('/auth/signin');
  }

  const orgId = session.user.organizationId;

  // Preload initial settings, recent contacts for testing, and available templates
  
  const [settingsRes, sampleContacts, templatesRes] = await Promise.all([
    getWindowReminderSettings(),
    prisma.contact.findMany({
      where: { organizationId: orgId },
      take: 25,
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        name: true,
        waId: true,
        lastInboundMessageAt: true,
        windowExpiresAt: true,
        windowStatus: true
      }
    }),
    getMessageTemplates().catch(() => ({ success: false, data: [] }))
  ]);

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)]">
      <WindowRemindersClient
        initialSettings={settingsRes.success ? settingsRes : null}
        sampleContacts={sampleContacts || []}
        templates={(templatesRes?.success && Array.isArray(templatesRes.data) ? templatesRes.data : [])}
      />
    </DashboardLayoutClient>
  );
}
