import { getWelcomeMessages } from '@/app/actions/welcome-messages';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { WelcomeMessagesClient } from '@/components/welcome-messages/WelcomeMessagesClient';

export default async function WelcomeMessagesPage() {
  const { messages } = await getWelcomeMessages();
  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)]">
      <WelcomeMessagesClient initialMessages={messages} />
    </DashboardLayoutClient>
  );
}
