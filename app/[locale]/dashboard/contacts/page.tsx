
import { ContactTable, type Contact } from '@/components/contacts/contact-table';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { ContactsHeader } from '@/components/contacts/ContactsHeader';

const contactStatsCache = new Map<string, { stats: number[]; expiresAt: number }>();

async function getCachedContactStats(orgId: string, session: any) {
  const now = Date.now();
  const cached = contactStatsCache.get(orgId);
  if (cached && cached.expiresAt > now) {
    return cached.stats;
  }

  const nowDate = new Date();
  const thirtyDaysAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(nowDate.getTime() - 60 * 24 * 60 * 60 * 1000);

  const baseWhere: any = { organizationId: orgId };
  const canViewAll = hasPermission(session, ['contacts_view', 'contacts_super', 'contacts']);
  if (session?.user?.role === 'USER' && !canViewAll) {
    baseWhere.AND = [{ assignedUsers: { some: { id: session.user.id } } }];
  }

  const [
    totalCount,
    blockedCount,
    newImports,
    prevTotal,
    prevBlocked,
    prevNewImports
  ] = await Promise.all([
    // Current period counts
    prisma.contact.count({ where: baseWhere }).catch(() => 0),
    prisma.contact.count({ where: { ...baseWhere, isBlocked: true } }).catch(() => 0),
    prisma.contact.count({ where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    // Previous period counts (for trend)
    prisma.contact.count({ where: { ...baseWhere, createdAt: { lt: thirtyDaysAgo } } }).catch(() => 0),
    prisma.contact.count({ where: { ...baseWhere, isBlocked: true, createdAt: { lt: thirtyDaysAgo } } }).catch(() => 0),
    prisma.contact.count({ where: { ...baseWhere, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }).catch(() => 0),
  ]);

  const activeCount = Math.max(0, totalCount - blockedCount);
  const prevActive = Math.max(0, prevTotal - prevBlocked);

  const stats = [
    totalCount,
    activeCount,
    newImports,
    blockedCount,
    prevTotal,
    prevActive,
    prevNewImports,
    prevBlocked
  ];

  contactStatsCache.set(orgId, { stats, expiresAt: now + 60000 });
  return stats;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    groupId?: string;
    platform?: string;
    isBlocked?: string;
    dateFrom?: string;
    dateTo?: string;
    tagIds?: string;
    limit?: string;
  }>;
}) {
  const params = (await searchParams) || {};
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 20;
  const search = params.search || '';
  const groupId = params.groupId;
  const platform = params.platform;
  const isBlocked = params.isBlocked === 'true' ? true : params.isBlocked === 'false' ? false : undefined;
  const dateFrom = params.dateFrom;
  const dateTo = params.dateTo;
  const tagIds = params.tagIds ? params.tagIds.split(',') : undefined;

  const session = await getServerSession(authOptions);
  const orgId = session?.user?.organizationId;

  // Fetch contacts + stats in parallel with caching
  const [{ contacts, total, totalPages }, statsData] = await Promise.all([
    getContacts(page, limit, search, groupId, platform, isBlocked, dateFrom, dateTo, tagIds),
    orgId ? getCachedContactStats(orgId, session) : Promise.resolve([0, 0, 0, 0, 0, 0, 0, 0]),
  ]);

  const [
    totalCount, activeCount, newImports, blockedCount,
    prevTotal, prevActive, prevNewImports, prevBlocked,
  ] = statsData as number[];

  const calcTrend = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '0%';
    const pct = ((curr - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const trends = {
    total: calcTrend(totalCount, prevTotal),
    active: calcTrend(activeCount, prevActive),
    newImports: calcTrend(newImports, prevNewImports),
    blocked: calcTrend(blockedCount, prevBlocked),
  };


  return (
    <DashboardLayoutClient mainClassName="pb-16 antialiased bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex flex-col gap-4 w-full">
        {/* Header with stats */}
        <ContactsHeader
          total={totalCount}
          activeCount={activeCount}
          newImports={newImports}
          blockedCount={blockedCount}
        />

        {/* Table */}
        <div className="flex flex-col">
          <ContactTable
            initialContacts={contacts as Contact[]}
            total={total ?? 0}
            totalPages={totalPages ?? 1}
            currentPage={page}
            limit={limit}
          />
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
