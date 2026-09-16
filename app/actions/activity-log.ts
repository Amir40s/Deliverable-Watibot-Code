'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export type ActivityLogEntry = {
  id: string;
  userEmail: string | null;
  userName: string | null;
  action: string;
  module: string;
  target: string | null;
  details: string | null;
  status: string;
  createdAt: Date;
};

export type ActivityLogFilters = {
  module?: string;
  action?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  userName?: string;
};

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return { logs: [], total: 0, totalPages: 0, kpis: { total: 0, success: 0, warning: 0, failed: 0 } };
  }

  const orgId = session.user.organizationId;
  const isAdmin =
    session.user.role === 'ADMIN' ||
    session.user.role === 'SUPER_ADMIN' ||
    session.user.role === 'OWNER';

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {
    organizationId: orgId,
    // Agents only see their own logs
    ...(isAdmin ? {} : { userId: session.user.id }),
  };

  if (filters.module && filters.module !== 'all') {
    const modules = filters.module.split(',').map(m => m.trim());
    if (modules.length > 1) {
      where.OR = [
        ...(where.OR || []),
        { OR: modules.map(m => ({ module: { contains: m, mode: 'insensitive' } })) }
      ];
    } else {
      where.module = { contains: filters.module, mode: 'insensitive' };
    }
  }
  if (filters.action && filters.action !== 'all') {
    where.action = filters.action;
  }
  if (filters.userName && filters.userName !== 'all') {
    where.userName = filters.userName;
  }
  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  }
  if (filters.search) {
    where.OR = [
      { userName: { contains: filters.search, mode: 'insensitive' } },
      { userEmail: { contains: filters.search, mode: 'insensitive' } },
      { target: { contains: filters.search, mode: 'insensitive' } },
      { details: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.dateFrom) {
    where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { ...(where.createdAt || {}), lte: end };
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  // KPI counts (same scope — admin sees all, agent sees own)
  const baseWhere = { organizationId: orgId, ...(isAdmin ? {} : { userId: session.user.id }) };
  const [totalAll, successCount, warningCount, failedCount] = await Promise.all([
    prisma.activityLog.count({ where: baseWhere }),
    prisma.activityLog.count({ where: { ...baseWhere, status: 'success' } }),
    prisma.activityLog.count({ where: { ...baseWhere, status: 'warning' } }),
    prisma.activityLog.count({ where: { ...baseWhere, status: 'failed' } }),
  ]);

  return {
    logs: logs as ActivityLogEntry[],
    total,
    totalPages: Math.ceil(total / limit),
    kpis: { total: totalAll, success: successCount, warning: warningCount, failed: failedCount },
    isAdmin,
  };
}

export async function getActivityLogsForCharts(days: number = 30) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return [];
  }

  const orgId = session.user.organizationId;
  const isAdmin =
    session.user.role === 'ADMIN' ||
    session.user.role === 'SUPER_ADMIN' ||
    session.user.role === 'OWNER';

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const where: any = {
    organizationId: orgId,
    createdAt: { gte: dateFrom },
    ...(isAdmin ? {} : { userId: session.user.id }),
  };

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      action: true,
      module: true,
      createdAt: true
    }
  });

  return logs;
}
