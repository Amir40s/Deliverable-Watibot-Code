'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  TrendingUp,
  Info,
  Sparkles,
  Send,
  CheckCheck,
  MessageSquare,
  Eye,
  UserCheck,
  UserX,
  Calendar,
  Megaphone,
  Zap,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHealthAuditData, runManualHealthAudit, HealthAuditResponse } from '@/app/actions/health-audit';
import Link from 'next/link';
import ManageLayout from '@/components/layouts/ManageLayout';
import WatiBotLoader from '@/components/WatiBotLoader';

export default function HealthAuditPage() {
  const t = useTranslations('HealthAudit');
  const locale = useLocale();

  const [range, setRange] = useState<'7d' | '14d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<HealthAuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Load audit data
  const loadData = async (selectedRange = range, forceReanalyze = false) => {
    setIsLoading(true);
    try {
      const res = forceReanalyze
        ? await runManualHealthAudit(selectedRange)
        : await getHealthAuditData(selectedRange);
      setData(res);
    } catch (error) {
      console.error('Failed to load health audit data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(range);
  }, [range]);

  const handleRangeChange = (newRange: '7d' | '14d' | '30d' | '90d') => {
    setRange(newRange);
  };

  const handleReanalyze = () => {
    startTransition(async () => {
      await loadData(range, true);
    });
  };

  const handleExport = () => {
    window.print();
  };

  // Score styling helpers
  const score = data?.aiAnalysis?.healthScore ?? 0;
  const getScoreTheme = (s: number) => {
    if (s >= 85) {
      return {
        text: 'text-emerald-500 dark:text-emerald-400',
        stroke: '#10b981',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      };
    }
    if (s >= 70) {
      return {
        text: 'text-sky-500 dark:text-sky-400',
        stroke: '#0284c7',
        bg: 'bg-sky-50 dark:bg-sky-950/30',
        border: 'border-sky-200 dark:border-sky-800',
        badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
      };
    }
    if (s >= 55) {
      return {
        text: 'text-amber-500 dark:text-amber-400',
        stroke: '#f59e0b',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      };
    }
    return {
      text: 'text-rose-500 dark:text-rose-400',
      stroke: '#f43f5e',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-800',
      badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    };
  };

  const scoreTheme = getScoreTheme(score);

  // Meta rating styling
  const metaRating = data?.metaQuality?.officialRating;
  const getMetaTheme = (rating?: string) => {
    switch (rating) {
      case 'GREEN':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-500',
          label: 'High Quality (GREEN)',
        };
      case 'YELLOW':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          dot: 'bg-amber-500',
          label: 'Medium Quality (YELLOW)',
        };
      case 'RED':
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          dot: 'bg-rose-500',
          label: 'Low Quality (RED)',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200',
          dot: 'bg-slate-400',
          label: data?.metaQuality?.displayRating || 'Unrated / N/A',
        };
    }
  };

  const metaTheme = getMetaTheme(metaRating);

  // Risk styling
  const riskLevel = data?.aiAnalysis?.riskLevel || 'LOW';
  const getRiskTheme = (r: string) => {
    switch (r) {
      case 'CRITICAL':
        return {
          badge: 'bg-rose-500 text-white',
          border: 'border-rose-500/30',
          desc: 'Imminent danger of WhatsApp spam blocks or tier downgrades.',
        };
      case 'HIGH':
        return {
          badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
          border: 'border-rose-300 dark:border-rose-800',
          desc: 'High bounce rate or negative feedback detected. Action required.',
        };
      case 'MEDIUM':
        return {
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
          border: 'border-amber-300 dark:border-amber-800',
          desc: 'Moderate engagement. Optimization suggested to prevent rate limits.',
        };
      default:
        return {
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
          border: 'border-emerald-300 dark:border-emerald-800',
          desc: 'Low risk profile. Sender reputation is in good standing.',
        };
    }
  };

  const riskTheme = getRiskTheme(riskLevel);

  if (isLoading && !data) {
    return <WatiBotLoader fullScreen={true} />;
  }

  return (
    <ManageLayout contentClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen pb-24 plus-jakarta-forced max-w-none">
      <div className="space-y-6 max-w-[1600px] mx-auto text-slate-800 dark:text-slate-100">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-1 text-start">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {t('title')}
                </h1>
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40 text-[10px] font-black uppercase tracking-wider">
                  AI Telemetry Audit
                </Badge>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls: Filters, Re-analyze, Export */}
        <div className="flex flex-wrap items-center gap-2.5 justify-start md:justify-end">
          {/* Date range picker */}
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            {(['7d', '14d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  range === r
                    ? 'bg-[#00B074] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Re-analyze Button */}
          <Button
            onClick={handleReanalyze}
            disabled={isLoading || isPending}
            className="h-9 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isPending ? 'animate-spin' : ''}`} />
            <span>{isLoading || isPending ? t('analyzing') : t('reAnalyze')}</span>
          </Button>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            variant="outline"
            className="h-9 px-3.5 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('exportReport')}</span>
          </Button>

          {/* Link to reports */}
          <Link
            href={`/${locale}/manage/reports`}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="View Full Reports"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#00B074]" />
            <span className="hidden md:inline">Reports</span>
          </Link>
        </div>
      </div>

      {/* 2. DUAL SCORE SHOWCASE (AI Estimated Score vs Meta Quality Rating) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-start">
        {/* Card 1: AI Estimated Health Score (Primary 6 cols) */}
        <Card className="lg:col-span-6 p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#00B074] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('aiScoreBadge')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-widest">
                  {data?.aiAnalysis?.engine === 'ai' ? 'LLM Evaluated' : 'Heuristic Model'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                WhatsApp Messaging Health
              </h2>
            </div>
            <Badge className={`text-xs font-black uppercase px-3 py-1 rounded-full ${scoreTheme.badge}`}>
              {data?.aiAnalysis?.healthStatus || 'GOOD'}
            </Badge>
          </div>

          {/* Visual Gauge + Dimension Highlights */}
          <div className="my-6 flex flex-col sm:flex-row items-center gap-6">
            {/* SVG Circular Radial Gauge */}
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                  fill="none"
                  className="dark:stroke-slate-800"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke={scoreTheme.stroke}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray="263.89"
                  strokeDashoffset={263.89 * (1 - Math.min(100, Math.max(0, score)) / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black tracking-tight ${scoreTheme.text}`}>
                  {score}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Out of 100
                </span>
              </div>
            </div>

            {/* Quality Dimensions List */}
            <div className="space-y-2 flex-1 w-full text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80">
                <div className="font-bold text-slate-700 dark:text-slate-200 flex justify-between">
                  <span>{t('dimensions.deliveryQuality')}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">{data?.metrics.deliveryRate ?? 0}%</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {data?.aiAnalysis?.deliveryQuality || 'Delivery transmission standard'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80">
                <div className="font-bold text-slate-700 dark:text-slate-200 flex justify-between">
                  <span>{t('dimensions.engagementQuality')}</span>
                  <span className="text-sky-600 dark:text-sky-400 font-black">{data?.metrics.readRate ?? 0}% Read</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {data?.aiAnalysis?.engagementQuality || 'Audience open behavior'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80">
                <div className="font-bold text-slate-700 dark:text-slate-200 flex justify-between">
                  <span>{t('dimensions.userResponseQuality')}</span>
                  <span className="text-purple-600 dark:text-purple-400 font-black">{data?.metrics.replyRate ?? 0}% Reply</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {data?.aiAnalysis?.userResponseQuality || 'Customer two-way replies'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-[#00B074]" />
            <span>{t('aiScoreDisclaimer')}</span>
          </div>
        </Card>

        {/* Card 2: Meta Official Quality Rating (3 cols) */}
        <Card className="lg:col-span-3 p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
              {t('metaQualityBadge')}
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Official Meta Tier
            </h3>
          </div>

          <div className="my-5 space-y-4">
            <div className={`p-4 rounded-2xl border ${metaTheme.bg} space-y-2`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${metaTheme.dot} animate-pulse`} />
                <span className="text-base font-black uppercase tracking-wide">
                  {metaRating || 'UNKNOWN'}
                </span>
              </div>
              <p className="text-xs font-semibold leading-snug">
                {metaTheme.label}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium">Business Name:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                  {data?.metaQuality.verifiedName || 'WhatsApp Account'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium">Number:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {data?.metaQuality.phoneNumber || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-medium">Channel:</span>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {data?.metaQuality.connectionMethod === 'qr' ? 'WhatsApp Web (QR)' : 'Meta Cloud API'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            <span>{t('metaQualityDisclaimer')}</span>
          </div>
        </Card>

        {/* Card 3: AI Risk Level & Vulnerability (3 cols) */}
        <Card className="lg:col-span-3 p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              {t('riskLevel')}
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Spam & Block Risk
            </h3>
          </div>

          <div className="my-5 space-y-4">
            <div className={`p-4 rounded-2xl border ${riskTheme.border} bg-slate-50 dark:bg-slate-950/40 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Risk Assessment:</span>
                <Badge className={`text-xs font-black uppercase px-2.5 py-0.5 ${riskTheme.badge}`}>
                  {riskLevel} RISK
                </Badge>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                {riskTheme.desc}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Delivery Failure Rate:</span>
                <span className={`font-black ${data?.metrics.failureRate && data.metrics.failureRate > 5 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                  {data?.metrics.failureRate ?? 0}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Non-Response Rate:</span>
                <span className="font-black text-slate-700 dark:text-slate-200">
                  {data?.metrics.ignoreRate ?? 0}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Active Campaigns:</span>
                <span className="font-black text-slate-700 dark:text-slate-200">
                  {data?.metrics.activeCampaignsCount ?? 0} Live
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-slate-400">
            Last audited: {data?.aiAnalysis?.analyzedAt ? new Date(data.aiAnalysis.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
          </div>
        </Card>
      </div>

      {/* 3. CORE METRICS GRID (6 KPI Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 text-start">
        {/* Messages Sent */}
        <Card className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold truncate">{t('metrics.totalSent')}</span>
            <Send className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">
            {data?.metrics.totalSent.toLocaleString() || 0}
          </div>
          <p className="text-[10px] font-semibold text-slate-400">All Outbound Messages</p>
        </Card>

        {/* Delivery Rate */}
        <Card className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold truncate">{t('metrics.deliveryRate')}</span>
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
            {data?.metrics.deliveryRate ?? 0}%
          </div>
          <p className="text-[10px] font-semibold text-slate-400">
            {data?.metrics.deliveredCount.toLocaleString() || 0} delivered
          </p>
        </Card>

        {/* Read Rate */}
        <Card className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold truncate">{t('metrics.readRate')}</span>
            <Eye className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          </div>
          <div className="text-lg font-black text-purple-600 dark:text-purple-400">
            {data?.metrics.readRate ?? 0}%
          </div>
          <p className="text-[10px] font-semibold text-slate-400">
            {data?.metrics.readCount.toLocaleString() || 0} read
          </p>
        </Card>

        {/* Reply Rate */}
        <Card className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold truncate">{t('metrics.replyRate')}</span>
            <UserCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          </div>
          <div className="text-lg font-black text-sky-600 dark:text-sky-400">
            {data?.metrics.replyRate ?? 0}%
          </div>
          <p className="text-[10px] font-semibold text-slate-400">
            {data?.metrics.repliedUsersCount.toLocaleString() || 0} replied
          </p>
        </Card>

        {/* Ignore / Non-Response Rate */}
        <Card className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold truncate">{t('metrics.ignoreRate')}</span>
            <UserX className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          </div>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400">
            {data?.metrics.ignoreRate ?? 0}%
          </div>
          <p className="text-[10px] font-semibold text-slate-400">
            {data?.metrics.notRepliedUsersCount.toLocaleString() || 0} unreplied
          </p>
        </Card>

        {/* Failed Messages */}
        <Card className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold truncate">{t('metrics.failed')}</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          </div>
          <div className="text-lg font-black text-rose-600 dark:text-rose-400">
            {data?.metrics.failedCount.toLocaleString() || 0}
          </div>
          <p className="text-[10px] font-semibold text-slate-400">
            {data?.metrics.failureRate ?? 0}% failure rate
          </p>
        </Card>
      </div>

      {/* 4. DRIVERS & RISK FACTORS MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-start">
        {/* Key Positive Drivers */}
        <Card className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <h4 className="text-sm font-black uppercase tracking-wider">
              {t('factors.positivesTitle')}
            </h4>
          </div>
          <ul className="space-y-2 text-xs">
            {data?.aiAnalysis?.positiveFactors && data.aiAnalysis.positiveFactors.length > 0 ? (
              data.aiAnalysis.positiveFactors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>{factor}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">No specific positive drivers flagged.</li>
            )}
          </ul>
        </Card>

        {/* Reputation Risk Drivers */}
        <Card className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h4 className="text-sm font-black uppercase tracking-wider">
              {t('factors.risksTitle')}
            </h4>
          </div>
          <ul className="space-y-2 text-xs">
            {data?.aiAnalysis?.riskFactors && data.aiAnalysis.riskFactors.length > 0 ? (
              data.aiAnalysis.riskFactors.map((factor, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>{factor}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">No immediate vulnerabilities detected.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* 5. AI RECOMMENDATIONS PANEL */}
      <Card className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-start">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              {t('recommendations.title')}
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              {t('recommendations.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {data?.aiAnalysis?.recommendations && data.aiAnalysis.recommendations.length > 0 ? (
            data.aiAnalysis.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <Badge
                      className={`text-[9px] font-black uppercase px-2 py-0.5 ${
                        rec.priority === 'high'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300'
                          : rec.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300'
                      }`}
                    >
                      {rec.priority.toUpperCase()} PRIORITY
                    </Badge>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    {rec.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {rec.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>Impact:</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{rec.impact}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-6 text-slate-400 text-xs italic">
              No recommendations required at this time. Maintain healthy messaging habits.
            </div>
          )}
        </div>
      </Card>

      {/* 6. DAILY ENGAGEMENT TRAJECTORY */}
      <Card className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-start">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              {t('trends.title')}
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              {t('trends.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Sent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Delivered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Read
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Replied
            </span>
          </div>
        </div>

        {/* Custom Responsive SVG Chart */}
        <div className="h-64 w-full pt-4">
          {data?.trends && data.trends.length > 0 ? (
            <div className="w-full h-full flex items-end gap-1 sm:gap-2 pb-6 relative border-b border-slate-200 dark:border-slate-800">
              {data.trends.map((item, i) => {
                const maxVal = Math.max(1, ...data.trends.map((t) => Math.max(t.sent, t.delivered, t.read, t.replied)));
                const sentH = Math.max(4, Math.round((item.sent / maxVal) * 180));
                const delH = Math.max(4, Math.round((item.delivered / maxVal) * 180));
                const readH = Math.max(2, Math.round((item.read / maxVal) * 180));
                const replyH = Math.max(2, Math.round((item.replied / maxVal) * 180));

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col p-2 bg-slate-900 text-white rounded-lg shadow-xl text-[10px] z-30 whitespace-nowrap pointer-events-none">
                      <span className="font-bold border-b border-slate-700 pb-0.5 mb-1">{item.date}</span>
                      <span>Sent: {item.sent}</span>
                      <span className="text-emerald-400">Delivered: {item.delivered} ({item.deliveryRate}%)</span>
                      <span className="text-purple-400">Read: {item.read} ({item.readRate}%)</span>
                      <span className="text-sky-400">Replied: {item.replied}</span>
                    </div>

                    {/* Bar Cluster */}
                    <div className="flex items-end gap-0.5 w-full justify-center">
                      <div className="w-1.5 sm:w-2 bg-slate-300 dark:bg-slate-700 rounded-t-xs" style={{ height: `${sentH}px` }} />
                      <div className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-xs" style={{ height: `${delH}px` }} />
                      <div className="w-1.5 sm:w-2 bg-purple-500 rounded-t-xs" style={{ height: `${readH}px` }} />
                      <div className="w-1.5 sm:w-2 bg-sky-500 rounded-t-xs" style={{ height: `${replyH}px` }} />
                    </div>

                    {/* Date label */}
                    <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center mt-1">
                      {i % Math.ceil(data.trends.length / 10) === 0 ? item.date : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
              No trend telemetry available for this period.
            </div>
          )}
        </div>
      </Card>

      {/* 7. CAMPAIGN PERFORMANCE BREAKDOWN */}
      <Card className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-start">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-500" />
            {t('campaigns.title')}
          </h3>
          <p className="text-xs font-semibold text-slate-400">
            {t('campaigns.subtitle')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">{t('campaigns.name')}</th>
                <th className="py-3 px-3 text-center">{t('campaigns.sent')}</th>
                <th className="py-3 px-3 text-center">{t('campaigns.delivered')}</th>
                <th className="py-3 px-3 text-center">{t('campaigns.read')}</th>
                <th className="py-3 px-3 text-center">{t('campaigns.replied')}</th>
                <th className="py-3 px-3 text-center">{t('campaigns.deliveryRate')}</th>
                <th className="py-3 px-3 text-center">{t('campaigns.readRate')}</th>
                <th className="py-3 px-3 text-right">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {data?.campaigns && data.campaigns.length > 0 ? (
                data.campaigns.map((camp, idx) => {
                  const campHealth =
                    camp.deliveryRate >= 95 && camp.readRate >= 60
                      ? { label: 'Optimal', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' }
                      : camp.deliveryRate >= 80
                      ? { label: 'Normal', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300' }
                      : { label: 'Needs Attention', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' };

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-xs">{camp.name}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-200">
                        {camp.sent.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                        {camp.delivered.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-purple-600 dark:text-purple-400 font-bold">
                        {camp.read.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center text-sky-600 dark:text-sky-400 font-bold">
                        {camp.replied.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-black">
                        {camp.deliveryRate}%
                      </td>
                      <td className="py-3 px-3 text-center font-black">
                        {camp.readRate}%
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 ${campHealth.badge}`}>
                          {campHealth.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 italic">
                    {t('campaigns.noCampaigns')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </ManageLayout>
  );
}
