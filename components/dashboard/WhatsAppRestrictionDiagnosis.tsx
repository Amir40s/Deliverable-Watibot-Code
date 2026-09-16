'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  checkWhatsAppHealthStatus,
  type WhatsAppHealthDiagnosis,

interface Props {
  initialDiagnosis?: WhatsAppHealthDiagnosis | null;
  onDiagnosisUpdated?: (updated: WhatsAppHealthDiagnosis) => void;
  className?: string;
}

export function WhatsAppRestrictionDiagnosis({
  initialDiagnosis,
  onDiagnosisUpdated,
  className,
}: Props) {
  const [diagnosis, setDiagnosis] = useState<WhatsAppHealthDiagnosis | null>(
    initialDiagnosis || null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (initialDiagnosis) {
      setDiagnosis(initialDiagnosis);
    }
  }, [initialDiagnosis]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const fresh = await checkWhatsAppHealthStatus(true);
      setDiagnosis(fresh);
      if (onDiagnosisUpdated) onDiagnosisUpdated(fresh);

      if (fresh.overallStatus === 'HEALTHY') {
        toast.success('WhatsApp Account Health verified: All resources active.');
      } else if (fresh.overallStatus === 'BANNED') {
        toast.error(`WhatsApp Ban Detected: ${fresh.primaryIssue || fresh.headline}`);
      } else {
        toast.warning(`WhatsApp Restriction Detected: ${fresh.primaryIssue || fresh.headline}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to refresh WhatsApp health status');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!diagnosis || diagnosis.isQrConnection || isDismissed) {
    return null;
  }

  const isBanned = diagnosis.overallStatus === 'BANNED';
  const isRestricted =
    diagnosis.overallStatus === 'RESTRICTED' || diagnosis.overallStatus === 'DISABLED';
  const isHealthy = diagnosis.overallStatus === 'HEALTHY';

  // Format relative last checked time
  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' (' + d.toLocaleDateString() + ')';
    } catch {
      return isoString;
    }
  };

  const renderStatusBadge = (
    status: string,
    label: string
  ) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {label}
          </span>
        );
      case 'RESTRICTED':
      case 'REJECTED':
      case 'FLAGGED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {label}
          </span>
        );
      case 'BANNED':
      case 'DISABLED':
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            {label}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {label}
          </span>
        );
      case 'NOT_LINKED':
      case 'NA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {label || 'Not Linked (Optional)'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            {label || 'Unable to Verify'}
          </span>
        );
    }
  };

  const getStatusIconColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
      case 'RESTRICTED':
      case 'REJECTED':
      case 'FLAGGED':
        return 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
      case 'BANNED':
      case 'DISABLED':
      case 'SUSPENDED':
        return 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
      default:
        return 'text-slate-400 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm transition-all overflow-hidden mb-6',
        isBanned
          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
          : isRestricted
          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800',
        className
      )}
    >
      {/* 1. TOP DIAGNOSIS BANNER */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md',
                isBanned
                  ? 'bg-rose-600 text-white shadow-rose-600/20'
                  : isRestricted
                  ? 'bg-amber-500 text-white shadow-amber-500/20'
                  : 'bg-[#00B074] text-white shadow-emerald-500/20'
              )}
            >
              {isBanned ? (
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              ) : isRestricted ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Restriction / Ban Diagnosis
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white',
                    isBanned
                      ? 'bg-rose-600'
                      : isRestricted
                      ? 'bg-amber-600'
                      : 'bg-[#00B074]'
                  )}
                >
                  Overall Status: {diagnosis.overallLabel}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 leading-snug">
                {diagnosis.headline}
              </h3>

              {diagnosis.primaryIssue && (
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                  <span className="font-extrabold text-slate-900 dark:text-white">Actual Issue: </span>
                  {diagnosis.primaryIssue}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons & Refresh */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-[#00B074]')} />
              <span>{isRefreshing ? 'Checking Meta...' : 'Refresh Status'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm transition-all cursor-pointer"
              aria-label="Toggle diagnosis breakdown"
              title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-white shadow-sm transition-all cursor-pointer"
              aria-label="Dismiss diagnosis banner"
              title="Close banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Visual Badges Row */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex-wrap text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                diagnosis.phone.status === 'ACTIVE'
                  ? 'bg-emerald-500'
                  : diagnosis.phone.status === 'RESTRICTED'
                  ? 'bg-amber-500'
                  : diagnosis.phone.status === 'BANNED'
                  ? 'bg-rose-500'
                  : 'bg-slate-400'
              )}
            />
            <span className="text-slate-500 dark:text-slate-400">Phone Number:</span>
            <span className="text-slate-800 dark:text-slate-200 uppercase text-[11px] font-extrabold">
              {diagnosis.phone.status}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                diagnosis.waba.status === 'ACTIVE'
                  ? 'bg-emerald-500'
                  : diagnosis.waba.status === 'RESTRICTED' || diagnosis.waba.status === 'REJECTED'
                  ? 'bg-amber-500'
                  : diagnosis.waba.status === 'DISABLED' || diagnosis.waba.status === 'SUSPENDED'
                  ? 'bg-rose-500'
                  : 'bg-slate-400'
              )}
            />
            <span className="text-slate-500 dark:text-slate-400">WABA:</span>
            <span className="text-slate-800 dark:text-slate-200 uppercase text-[11px] font-extrabold">
              {diagnosis.waba.status}
            </span>
          </div>

   

          <span className="ml-auto text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
            Last Checked: {formatTime(diagnosis.lastChecked)}
          </span>
        </div>
      </div>

      {/* 2. DETAILED ACCOUNT HEALTH BREAKDOWN TABLE */}
      {isExpanded && (
        <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              WhatsApp Account Health Breakdown
            </h4>
            <span className="text-[10.5px] font-semibold text-slate-400">
              Independently verified from Meta Graph API
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10.5px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-2.5 pr-4">Resource Level</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Meta Status</th>
                  <th className="py-2.5 pl-4">Diagnostic Details & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* 1. Phone Number Row */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 pr-4 align-top">
                    <div className="flex items-start gap-2.5">
                      <div className={cn('p-1.5 rounded-lg border shrink-0 mt-0.5', getStatusIconColor(diagnosis.phone.status))}>
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-800 dark:text-white">
                          WhatsApp Phone Number
                        </span>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {diagnosis.phone.displayNumber || (diagnosis.phone.id ? `ID: ${diagnosis.phone.id}` : 'No phone connected')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    {renderStatusBadge(diagnosis.phone.status, diagnosis.phone.label)}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {diagnosis.phone.rawStatus || 'NONE'}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 align-top">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {diagnosis.phone.reason || (
                        diagnosis.phone.status === 'ACTIVE'
                          ? 'Phone number is active and capable of sending & receiving messages.'
                          : 'No detailed reason returned by Meta.'
                      )}
                    </p>
                    {diagnosis.phone.qualityRating && (
                      <span className="inline-block text-[10px] font-bold text-slate-400 mt-1">
                        Quality Rating: <span className="font-extrabold uppercase text-emerald-600 dark:text-emerald-400">{diagnosis.phone.qualityRating}</span>
                      </span>
                    )}
                  </td>
                </tr>

                {/* 2. WABA Row */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 pr-4 align-top">
                    <div className="flex items-start gap-2.5">
                      <div className={cn('p-1.5 rounded-lg border shrink-0 mt-0.5', getStatusIconColor(diagnosis.waba.status))}>
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-800 dark:text-white">
                          WhatsApp Business Account (WABA)
                        </span>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {diagnosis.waba.id ? `WABA ID: ${diagnosis.waba.id}` : 'No WABA ID'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    {renderStatusBadge(diagnosis.waba.status, diagnosis.waba.label)}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {diagnosis.waba.accountReviewStatus || diagnosis.waba.rawStatus || 'NONE'}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 align-top">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {diagnosis.waba.reason || (
                        diagnosis.waba.status === 'ACTIVE'
                          ? 'WABA account review is approved and unrestricted.'
                          : 'No detailed reason returned by Meta.'
                      )}
                    </p>
                    {diagnosis.waba.status === 'REJECTED' && (
                      <p className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300 mt-1 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        Important: A WABA Review Rejection is an account compliance status. It does NOT mean the phone number is banned.
                      </p>
                    )}
                  </td>
                </tr>

             
              </tbody>
            </table>
          </div>
 
        </div>
      )}
    </div>
  );
}
