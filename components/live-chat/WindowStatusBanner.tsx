'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getContactWindowDetails } from '@/app/actions/window-reminders';
import { useUserStatus } from '@/hooks/useUserStatus';

interface WindowStatusBannerProps {
  contact: any;
  onOpenTemplateModal: () => void;
  canReplyChat?: boolean;
}

export function WindowStatusBanner({
  contact,
  onOpenTemplateModal,
  canReplyChat = true
}: WindowStatusBannerProps) {
  const { whatsappConnectionMethod } = useUserStatus();
  const isQr = whatsappConnectionMethod === 'qr';

  const [now, setNow] = useState(Date.now());
  const [windowDetails, setWindowDetails] = useState<any | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const checklistRef = useRef<HTMLDivElement>(null);

  // Live timer tick every second
  useEffect(() => {
    if (isQr) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isQr]);

  // Close checklist on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (checklistRef.current && !checklistRef.current.contains(event.target as Node)) {
        setIsChecklistOpen(false);
      }
    };
    if (isChecklistOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChecklistOpen]);

  // Fetch full reminder checklist on contact change
  useEffect(() => {
    if (!isQr && contact?.id) {
      getContactWindowDetails(contact.id)
        .then((res) => {
          if (res.success) setWindowDetails(res.data);
        })
        .catch(console.error);
    }
  }, [isQr, contact?.id, contact?.lastInboundMessageAt, contact?.windowExpiresAt]);

  const { remainingSeconds, windowStatus, formattedTime } = useMemo(() => {
    if (isQr) {
      return {
        remainingSeconds: 86400,
        windowStatus: 'ACTIVE',
        formattedTime: 'Unlimited',
      };
    }

    let expiresAtTime = 0;
    if (contact?.windowExpiresAt) {
      expiresAtTime = new Date(contact.windowExpiresAt).getTime();
    } else if (contact?.lastInboundMessageAt) {
      expiresAtTime = new Date(contact.lastInboundMessageAt).getTime() + 24 * 60 * 60 * 1000;
    }

    if (!expiresAtTime) {
      return {
        remainingSeconds: 0,
        windowStatus: 'EXPIRED',
        formattedTime: '00:00:00'
      };
    }

    const diffMs = expiresAtTime - now;
    if (diffMs <= 0) {
      return {
        remainingSeconds: 0,
        windowStatus: 'EXPIRED',
        formattedTime: 'Expired'
      };
    }

    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const formatted = `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    const status = totalSecs <= 3600 ? 'EXPIRING_SOON' : 'ACTIVE';

    return {
      remainingSeconds: totalSecs,
      windowStatus: status,
      formattedTime: formatted
    };
  }, [isQr, contact?.windowExpiresAt, contact?.lastInboundMessageAt, now]);

  if (!contact || isQr) return null;

  if (windowStatus === 'EXPIRED') {
    return (
      <div className="shrink-0 bg-rose-50/95 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-900/60 px-4 py-2 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                🔴 WhatsApp Customer Service Window Expired
              </span>
              <Badge className="bg-rose-200 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 text-[9px] font-bold px-1.5 py-0">
                Template Required
              </Badge>
            </div>
            <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 mt-0.5">
              Normal free-form messages cannot be sent. You must send a Meta-approved template to restart the 24-hour window.
            </p>
          </div>
        </div>

        {canReplyChat && (
          <Button
            size="sm"
            onClick={onOpenTemplateModal}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl h-8 px-3.5 text-xs shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            USE TEMPLATE
          </Button>
        )}
      </div>
    );
  }

  if (windowStatus === 'EXPIRING_SOON') {
    return (
      <div className="relative shrink-0 bg-amber-50/95 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 px-4 py-2 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                🟡 24h Window Expiring Soon
              </span>
              <Badge className="bg-amber-500 text-white text-[10px] font-mono font-bold px-2 py-0">
                {formattedTime} remaining
              </Badge>
            </div>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5">
              Automated expiry warnings are triggered. If the customer does not reply, the window will close.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          {windowDetails?.rules && windowDetails.rules.length > 0 && (
            <div className="relative" ref={checklistRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChecklistOpen(!isChecklistOpen)}
                className="h-8 text-[11px] font-semibold border-amber-300 dark:border-amber-800 bg-white/50 dark:bg-slate-900/50 rounded-xl"
              >
                <Clock className="w-3 h-3 mr-1 text-amber-600" />
                Reminders ({windowDetails.rules.filter((r: any) => r.isSent).length}/{windowDetails.rules.length})
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>

              {isChecklistOpen && (
                <div className="absolute right-0 top-10 w-80 p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 z-50 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-b pb-2">
                    <span>Window Reminder Status</span>
                    <button onClick={() => setIsChecklistOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    {windowDetails.rules.map((r: any) => (
                      <div key={r.ruleId} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          {r.isSent ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          {r.ruleName} ({r.minutesBeforeExpiry}m)
                        </span>
                        <Badge variant={r.isSent ? 'default' : 'secondary'} className="text-[9px]">
                          {r.isSent ? 'SENT' : r.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {canReplyChat && (
            <Button
              size="sm"
              onClick={onOpenTemplateModal}
              variant="outline"
              className="border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-100 rounded-xl h-8 px-3 text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              Template
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ACTIVE Window
  return (
    <div className="relative shrink-0 bg-emerald-50/90 dark:bg-emerald-950/30 border-b border-emerald-200/70 dark:border-emerald-900/50 px-4 py-1.5 flex items-center justify-between z-20 backdrop-blur-md">
     <div className="flex items-center justify-center gap-2.5 text-center">
  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
    24h Window Active
  </span>

  <span className="text-slate-400 text-xs">•</span>

  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
    Expires in {formattedTime}
  </span>
</div>

      {windowDetails?.rules && windowDetails.rules.length > 0 && (
        <div className="relative" ref={checklistRef}>
          <button
            onClick={() => setIsChecklistOpen(!isChecklistOpen)}
            className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{windowDetails.rules.filter((r: any) => r.isSent).length}/{windowDetails.rules.length} Reminders Sent</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {isChecklistOpen && (
            <div className="absolute right-0 top-7 w-80 p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 z-50 space-y-3 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-b pb-2">
                <span>24-Hour Window Reminders</span>
                <button onClick={() => setIsChecklistOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                {windowDetails.rules.map((r: any) => (
                  <div key={r.ruleId} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      {r.isSent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {r.ruleName} ({r.minutesBeforeExpiry}m)
                    </span>
                    <Badge variant={r.isSent ? 'default' : 'secondary'} className="text-[9px]">
                      {r.isSent ? 'SENT' : r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
