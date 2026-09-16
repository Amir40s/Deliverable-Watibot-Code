'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { getActivityLogs, type ActivityLogEntry, type ActivityLogFilters } from '@/app/actions/activity-log';
import { getAgents } from '@/app/actions/agents';

import {
  Search, Calendar, Download, ChevronDown, FileText, CheckCircle2,
  RefreshCw, Info
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { useLocale, useTranslations } from 'next-intl';

const MODULE_STYLES: Record<string, { bg: string; text: string }> = {
  Flows: { bg: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-1 dark:ring-blue-500/20', text: 'blue' },
  Campaigns: { bg: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-1 dark:ring-purple-500/20', text: 'purple' },
  Contacts: { bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-1 dark:ring-emerald-500/20', text: 'emerald' },
  Users: { bg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-1 dark:ring-sky-500/20', text: 'sky' },
  Agents: { bg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-1 dark:ring-sky-500/20', text: 'sky' },
  Analytics: { bg: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-1 dark:ring-orange-500/20', text: 'orange' },
  System: { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-1 dark:ring-slate-700', text: 'slate' },
  'Live Chat': { bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-1 dark:ring-indigo-500/20', text: 'indigo' },
  Integrations: { bg: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-1 dark:ring-teal-500/20', text: 'teal' },
  Billing: { bg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-1 dark:ring-amber-500/20', text: 'amber' },
  Authentication: { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-1 dark:ring-slate-700', text: 'slate' },
  Permissions: { bg: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-1 dark:ring-rose-500/20', text: 'rose' },
};

const DEFAULT_MODULE = { bg: 'bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-1 dark:ring-slate-700', text: 'slate' };

type TabKey = 'allLogs' | 'liveChat' | 'loginActivity' | 'userManagement';

type AgentOption = {
  id: string;
  name: string | null;
  email: string;
};

const TABS: Array<{ key: TabKey; module?: string }> = [
  { key: 'allLogs' },
  { key: 'liveChat', module: 'Live Chat' },
  { key: 'loginActivity', module: 'Authentication' },
  { key: 'userManagement', module: 'Agents' },
];

const ALL_MODULES = [
  { key: 'liveChat', value: 'Live Chat' },
  { key: 'flows', value: 'Flows' },
  { key: 'contacts', value: 'Contacts' },
  { key: 'campaigns', value: 'Campaigns' },
  { key: 'agents', value: 'Agents' },
  { key: 'tags', value: 'Tags' },
  { key: 'quickReplies', value: 'Quick Replies' },
  { key: 'welcomeMessages', value: 'Welcome Messages' },
  { key: 'knowledgeBase', value: 'Knowledge Base' },
  { key: 'authentication', value: 'Authentication' },
] as const;

const ALL_ACTIONS = [
  { key: 'created', value: 'Created' },
  { key: 'updated', value: 'Updated' },
  { key: 'deleted', value: 'Deleted' },
  { key: 'imported', value: 'Imported' },
  { key: 'activated', value: 'Activated' },
  { key: 'deactivated', value: 'Deactivated' },
  { key: 'scheduled', value: 'Scheduled' },
  { key: 'triggered', value: 'Triggered' },
  { key: 'loggedIn', value: 'Logged In' },
  { key: 'loggedOut', value: 'Logged Out' },
] as const;

function UserAvatar({ name, email }: { name?: string | null; email?: string | null }) {
  const label = name?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || '?';
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-blue-500'];
  const idx = (label.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', colors[idx])}>
      {label}
    </div>
  );
}

function Pagination({ page, totalPages, setPage, isRtl }: { page: number; totalPages: number; setPage: (p: number) => void; isRtl: boolean }) {
  const getPages = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex gap-1 items-center">
      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70">
        {isRtl ? '>' : '<'}
      </button>
      {getPages().map((p, i) => (
        <React.Fragment key={i}>
          {p === '...' ? (
            <span className="w-7 h-7 flex items-end justify-center text-slate-400 text-xs pb-1">...</span>
          ) : (
            <button
              onClick={() => setPage(p as number)}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded border text-xs font-semibold transition-colors",
                page === p ? "border-[#00B074] text-[#00B074] bg-[#00B074]/5 dark:bg-[#00B074]/10 dark:text-emerald-300" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70"
              )}
            >
              {p}
            </button>
          )}
        </React.Fragment>
      ))}
      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70">
        {isRtl ? '<' : '>'}
      </button>
    </div>
  );
}

export default function ActivityLogPage() {
  const t = useTranslations('ActivityLogPage');
  const locale = useLocale();
  const dir = ['ar', 'ur', 'hi', 'bn'].includes(locale) ? 'rtl' : 'ltr';
  const isRtl = dir === 'rtl';
  const resolvedLocale = locale === 'en' ? 'en-US' : locale;
  const numberFormatter = React.useMemo(() => new Intl.NumberFormat(resolvedLocale), [resolvedLocale]);
  const percentFormatter = React.useMemo(() => new Intl.NumberFormat(resolvedLocale, {
    maximumFractionDigits: 1,
  }), [resolvedLocale]);

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kpis, setKpis] = useState({ total: 0, success: 0, warning: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<TabKey>('allLogs');
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);

  const formatDate = useCallback((dateInput: Date | string) => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return t('notAvailable');
    return date.toLocaleDateString(resolvedLocale, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [resolvedLocale, t]);

  const formatTime = useCallback((dateInput: Date | string) => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return t('notAvailable');
    return date.toLocaleTimeString(resolvedLocale, { hour: '2-digit', minute: '2-digit' });
  }, [resolvedLocale, t]);

  const getModuleLabel = useCallback((module: string) => {
    const match = ALL_MODULES.find(item => item.value.toLowerCase() === module.toLowerCase());
    if (match) return t(`modules.${match.key}`);
    const normalized = module.toLowerCase();
    if (normalized.includes('contact')) return t('modules.contacts');
    if (normalized.includes('campaign')) return t('modules.campaigns');
    if (normalized.includes('flow')) return t('modules.flows');
    if (normalized.includes('agent') || normalized.includes('user')) return t('modules.agents');
    if (normalized.includes('tag')) return t('modules.tags');
    if (normalized.includes('quick')) return t('modules.quickReplies');
    if (normalized.includes('knowledge')) return t('modules.knowledgeBase');
    if (normalized.includes('auth') || normalized.includes('login')) return t('modules.authentication');
    if (normalized.includes('chat') || normalized.includes('message')) return t('modules.liveChat');
    return module;
  }, [t]);

  const getActionLabel = useCallback((action: string) => {
    const match = ALL_ACTIONS.find(item => item.value.toLowerCase() === action.toLowerCase());
    return match ? t(`actions.${match.key}`) : action;
  }, [t]);

  const resultText = loading
    ? t('loadingLogs')
    : t('showingResults', {
      start: total === 0 ? 0 : (page - 1) * limit + 1,
      end: Math.min(page * limit, total),
      total: numberFormatter.format(total),
    });

  useEffect(() => {
    getAgents().then(res => setAgents(res || [])).catch(() => {});
  }, []);

  const load = useCallback(async (f: ActivityLogFilters) => {
    setLoading(true);
    try {
      const res = await getActivityLogs(f);
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setKpis(res.kpis ?? { total: 0, success: 0, warning: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  const applyFilters = useCallback(() => {
    const activeTabModule = TABS.find(tab => tab.key === activeTab)?.module;
    const moduleFilter = activeTabModule || filterModule;

    startTransition(() => {
      load({
        module: moduleFilter !== 'all' ? moduleFilter : undefined,
        action: filterAction !== 'all' ? filterAction : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        userName: filterUser !== 'all' ? filterUser : undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      });
    });
  }, [activeTab, filterModule, filterAction, filterUser, filterStatus, search, dateFrom, dateTo, page, limit, load]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    applyFilters();
  };

  const handleReset = () => {
    setSearch('');
    setFilterModule('all');
    setFilterAction('all');
    setFilterUser('all');
    setFilterStatus('all');
    setDateFrom('');
    setDateTo('');
    setActiveTab('allLogs');
    setPage(1);
  };

  const exportCSV = () => {
    const headers = [
      t('csv.time'),
      t('csv.user'),
      t('csv.email'),
      t('csv.action'),
      t('csv.module'),
      t('csv.target'),
      t('csv.details'),
      t('csv.status')
    ];
    const rows = logs.map(l => [
      new Date(l.createdAt).toISOString(),
      l.userName || '',
      l.userEmail || '',
      l.action,
      l.module,
      l.target || '',
      l.details || '',
      l.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mod = (m: string) => MODULE_STYLES[m] || DEFAULT_MODULE;

  return (
    <DashboardLayoutClient mainClassName="min-h-screen bg-[#fafbfc] dark:bg-slate-950 p-4 sm:p-8" hideChatbot={false}>
      <div dir={dir} className="max-w-[1400px] mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-8 gap-4">
          <div className="text-start">
            <h1 className="text-[22px] font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{t('title')}</h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative w-64 md:w-80">
              <Search className={cn("absolute top-2.5 w-4 h-4 text-slate-400", isRtl ? "right-3" : "left-3")} />
              <input
                dir={dir}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className={cn(
                  "w-full py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-[#00B074] focus:border-[#00B074] outline-none transition-all placeholder:text-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500",
                  isRtl ? "pr-9 pl-4 text-right" : "pl-9 pr-4 text-left"
                )}
              />
            </form>
          </div>
        </div>

        {/* Tabs & Export */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-6 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={cn(
                  "pb-3 text-[13px] font-semibold transition-all whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-b-2 border-[#00B074] text-[#00B074]"
                    : "border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {t(`tabs.${tab.key}`)}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 mb-2 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70">
            <Download className="w-3.5 h-3.5" /> {t('exportLogs')} <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
          {/* Total Events */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:bg-slate-900/80 dark:border-slate-800 dark:shadow-none">
            <div className="text-start">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">{t('totalEvents')}</p>
              <p className="text-[28px] font-black text-slate-800 dark:text-white leading-none">{numberFormatter.format(kpis.total)}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t('selectedPeriod')}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          {/* Success */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:bg-slate-900/80 dark:border-slate-800 dark:shadow-none">
            <div className="text-start">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">{t('statuses.success')}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-[28px] font-black text-slate-800 dark:text-white leading-none">{numberFormatter.format(kpis.success)}</p>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">({kpis.total ? percentFormatter.format((kpis.success / kpis.total) * 100) : 0}%)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-50 text-[#00B074] dark:bg-[#00B074]/10 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col xl:flex-row gap-8">
            
            {/* Table Area */}
          <div className="flex-1 min-w-0">
            {/* Table Top Controls */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-[11px] text-slate-500 font-medium">
                {resultText}
              </span>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => applyFilters()} className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70" title={t('refresh')}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">{t('show')}</span>
                  <select
                    dir={dir}
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="border border-slate-200 rounded text-xs font-semibold py-1 px-2 text-slate-700 bg-white outline-none cursor-pointer dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={1000000}>{t('all')}</option>
                  </select>
                </div>
                {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} isRtl={isRtl} />}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {[t('columns.time'), t('columns.user'), t('columns.action'), t('columns.module'), t('columns.status')].map(h => (
                      <th key={h} className="pb-3 text-[11px] font-bold text-slate-900 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn("divide-y divide-slate-100/60 dark:divide-slate-800 transition-opacity duration-200", loading && "opacity-50 pointer-events-none")}>
                  {logs.length === 0 && !loading ? (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm"><Info className="w-5 h-5 mx-auto mb-2 opacity-50" /> {t('noActivityFound')}</td></tr>
                  ) : logs.map(log => {
                    const mStyle = mod(log.module);
                    return (
                      <tr 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        className={cn(
                          "hover:bg-slate-50/50 dark:hover:bg-slate-900/80 cursor-pointer transition-colors group",
                          selectedLog?.id === log.id && "bg-slate-50 dark:bg-slate-900/90"
                        )}
                      >
                        {/* Time */}
                        <td className="py-4 pr-4 align-top w-[140px]">
                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">{formatDate(log.createdAt)}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatTime(log.createdAt)}</p>
                        </td>
                        
                        {/* User */}
                        <td className="py-4 pr-4 align-top w-[180px]">
                          <div className={cn("flex items-start gap-2.5", isRtl ? "flex-row-reverse text-right" : "")}>
                            <UserAvatar name={log.userName} email={log.userEmail} />
                            <div>
                              <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{log.userName || t('systemUser')}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate max-w-[120px]">
                                {log.userName === session?.user?.name && (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') ? t('roles.admin') : t('roles.user')}
                              </p>
                            </div>
                          </div>
                        </td>

                      
                        <td className="py-4 pr-4 align-top">
                          <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100">{getActionLabel(log.action)}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5 max-w-[150px] truncate">{log.target || '—'}</p>
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', mStyle.bg)}>
                            {getModuleLabel(log.module)}
                          </span>
                        </td>
                        <td className="py-4 pr-2 align-top">
                          {log.status === 'success' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#00B074] dark:bg-[#00B074]/10 dark:text-emerald-300 dark:ring-1 dark:ring-emerald-500/20">{t('statuses.success')}</span>
                          )}
                          {log.status === 'warning' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-1 dark:ring-amber-500/20">{t('statuses.warning')}</span>
                          )}
                          {log.status === 'failed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300 dark:ring-1 dark:ring-red-500/20">{t('statuses.failed')}</span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
 
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <span className="text-[11px] text-slate-500 font-medium">
                  {resultText}
                </span>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => applyFilters()} className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70" title={t('refresh')}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">{t('show')}</span>
                    <select
                      dir={dir}
                      value={limit}
                      onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                      className="border border-slate-200 rounded text-xs font-semibold py-1 px-2 text-slate-700 bg-white outline-none cursor-pointer dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={1000000}>{t('all')}</option>
                    </select>
                  </div>
                  <Pagination page={page} totalPages={totalPages} setPage={setPage} isRtl={isRtl} />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full xl:w-[280px] shrink-0 space-y-6">
            
            {/* Filters Box */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-[13px] text-slate-900 dark:text-slate-100">{t('filters')}</h3>
                <button onClick={handleReset} className="text-[11px] font-semibold text-[#00B074] hover:underline">{t('reset')}</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block text-start">{t('dateRange')}</label>
                  <div className="relative">
                    <Calendar className={cn("absolute top-2.5 w-3.5 h-3.5 text-slate-400", isRtl ? "right-3" : "left-3")} />
                    <input
                      dir={dir}
                      type="date" 
                      value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                      className={cn(
                        "w-full py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#00B074] mb-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:[color-scheme:dark]",
                        isRtl ? "pr-8 pl-3 text-right" : "pl-8 pr-3 text-left"
                      )}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className={cn("absolute top-2.5 w-3.5 h-3.5 text-slate-400", isRtl ? "right-3" : "left-3")} />
                    <input
                      dir={dir}
                      type="date" 
                      value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                      className={cn(
                        "w-full py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#00B074] dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:[color-scheme:dark]",
                        isRtl ? "pr-8 pl-3 text-right" : "pl-8 pr-3 text-left"
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block text-start">{t('columns.user')}</label>
                  <select
                    dir={dir}
                    value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1); }}
                    className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#00B074] appearance-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200", isRtl ? "text-right" : "text-left")}
                  >
                    <option value="all">{t('allUsers')}</option>
                    {agents.map(a => <option key={a.id} value={a.name || a.email}>{a.name || a.email}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block text-start">{t('columns.module')}</label>
                  <select
                    dir={dir}
                    value={filterModule} onChange={e => { setFilterModule(e.target.value); setPage(1); }}
                    className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#00B074] appearance-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200", isRtl ? "text-right" : "text-left")}
                  >
                    <option value="all">{t('allModules')}</option>
                    {ALL_MODULES.map(m => <option key={m.value} value={m.value}>{t(`modules.${m.key}`)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block text-start">{t('columns.action')}</label>
                  <select
                    dir={dir}
                    value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                    className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#00B074] appearance-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200", isRtl ? "text-right" : "text-left")}
                  >
                    <option value="all">{t('allActions')}</option>
                    {ALL_ACTIONS.map(a => <option key={a.value} value={a.value}>{t(`actions.${a.key}`)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block text-start">{t('columns.status')}</label>
                  <select
                    dir={dir}
                    value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#00B074] appearance-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200", isRtl ? "text-right" : "text-left")}
                  >
                    <option value="all">{t('allStatus')}</option>
                    <option value="success">{t('statuses.success')}</option>
                    <option value="warning">{t('statuses.warning')}</option>
                    <option value="failed">{t('statuses.failed')}</option>
                  </select>
                </div>

                <div>
                </div>

                <button 
                  onClick={() => { setPage(1); applyFilters(); }}
                  className="w-full py-2.5 bg-[#00B074] hover:bg-[#009662] text-white text-xs font-bold rounded-lg transition-colors mt-2"
                >
                  {t('applyFilters')}
                </button>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Log Details Box */}
            <div>
              <h3 className="font-bold text-[13px] text-slate-900 dark:text-slate-100 mb-4">{t('logDetails')}</h3>
              {selectedLog ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-2 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
                  <p><span className="font-semibold text-slate-500 dark:text-slate-400">{t('detailLabels.user')}:</span> {selectedLog.userName || selectedLog.userEmail || t('systemUser')}</p>
                  <p><span className="font-semibold text-slate-500 dark:text-slate-400">{t('detailLabels.action')}:</span> {getActionLabel(selectedLog.action)}</p>
                  <p><span className="font-semibold text-slate-500 dark:text-slate-400">{t('detailLabels.module')}:</span> {getModuleLabel(selectedLog.module)}</p>
                  <p><span className="font-semibold text-slate-500 dark:text-slate-400">{t('detailLabels.target')}:</span> {selectedLog.target || '—'}</p>
                </div>
              ) : (
                <div className="py-8 text-center text-[11px] text-slate-500 dark:text-slate-500 px-4">
                  {t('selectLogPrompt')}
                </div>
              )}
            </div>



          </div>
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
