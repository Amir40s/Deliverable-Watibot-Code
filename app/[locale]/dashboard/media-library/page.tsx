import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { MediaLibraryClient } from '@/components/media-library/MediaLibraryClient';

export default function MediaLibraryPage() {
  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)]">
      <MediaLibraryClient />
    </DashboardLayoutClient>
  );
}
