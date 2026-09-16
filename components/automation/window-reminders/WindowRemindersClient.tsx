'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  FileText,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  Zap,
  ShieldCheck,
  Timer,
  ChevronRight,
  User,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import RuleModal from './RuleModal';
import {
  getWindowReminderSettings,
  toggleWindowReminders,
  deleteWindowReminderRule,
  toggleWindowReminderRule,
  getWindowReminderLogs,
  getContactWindowDetails,
  testSimulateWindow,
  triggerManualWorkerRun
} from '@/app/actions/window-reminders';

interface WindowRemindersClientProps {
  initialSettings: any;
  sampleContacts: any[];
  templates: any[];
}

export default function WindowRemindersClient({
  initialSettings,
  sampleContacts,
  templates
}: WindowRemindersClientProps) {
  const [isEnabled, setIsEnabled] = useState<boolean>(initialSettings?.isEnabled ?? true);
  const [rules, setRules] = useState<any[]>(initialSettings?.rules || []);
  const [stats, setStats] = useState<any>(initialSettings?.stats || {
    totalRules: 0,
    activeRules: 0,
    sentToday: 0,
    failedCount: 0
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<any | null>(null);

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPagination, setLogsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [logStatusFilter, setLogStatusFilter] = useState('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Simulator State
  const [selectedContactId, setSelectedContactId] = useState<string>(sampleContacts[0]?.id || '');
  const [simulatedContactData, setSimulatedContactData] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [simLogOutput, setSimLogOutput] = useState<string[]>([]);

  const addSimLog = (msg: string) => {
    setSimLogOutput(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const refreshSettings = async () => {
    try {
      const res = await getWindowReminderSettings();
      if (res.success) {
        setIsEnabled(res.isEnabled ?? true);
        setRules(res.rules || []);
        setStats(res.stats || stats);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMasterToggle = async (val: boolean) => {
    setIsEnabled(val);
    try {
      const res = await toggleWindowReminders(val);
      if (res.success) {
        toast.success(val ? 'WhatsApp 24h Window Reminders enabled' : 'WhatsApp 24h Window Reminders disabled');
      } else {
        setIsEnabled(!val);
        toast.error(res.error || 'Failed to toggle setting');
      }
    } catch (err: any) {
      setIsEnabled(!val);
      toast.error(err?.message || 'Failed to toggle setting');
    }
  };

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      const newActive = !currentActive;
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: newActive } : r));
      const res = await toggleWindowReminderRule(ruleId, newActive);
      if (res.success) {
        toast.success(`Rule ${newActive ? 'activated' : 'deactivated'}`);
        refreshSettings();
      } else {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: currentActive } : r));
        toast.error(res.error || 'Failed to update rule');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this reminder rule?')) return;
    try {
      const res = await deleteWindowReminderRule(ruleId);
      if (res.success) {
        toast.success('Reminder rule deleted');
        refreshSettings();
      } else {
        toast.error(res.error || 'Failed to delete rule');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error deleting rule');
    }
  };

  const fetchLogs = async (page = 1) => {
    setLogsLoading(true);
    try {
      const res = await getWindowReminderLogs({
        page,
        limit: 10,
        status: logStatusFilter,
        search: logSearchQuery
      });
      if (res.success) {
        setLogs(res.data || []);
        setLogsPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [logStatusFilter, logSearchQuery]);

  // Load simulator details when contact changes
  const fetchSimContactDetails = async (contactId: string) => {
    if (!contactId) return;
    setSimLoading(true);
    try {
      const res = await getContactWindowDetails(contactId);
      if (res.success) {
        setSimulatedContactData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  useEffect(() => {
    if (selectedContactId) {
      fetchSimContactDetails(selectedContactId);
    }
  }, [selectedContactId]);

  const handleRunSimulationScenario = async (scenario: any) => {
    if (!selectedContactId) {
      toast.error('Please select a contact to test');
      return;
    }
    setSimLoading(true);
    try {
      const res = await testSimulateWindow(selectedContactId, scenario);
      if (res.success) {
        toast.success(res.message);
        addSimLog(`Applied simulation: ${scenario}`);
        await fetchSimContactDetails(selectedContactId);
      } else {
        toast.error(res.error || 'Simulation failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Simulation error');
    } finally {
      setSimLoading(false);
    }
  };

  const handleManualWorkerRun = async () => {
    setWorkerRunning(true);
    addSimLog('Triggering background worker evaluation pass...');
    try {
      const res = await triggerManualWorkerRun();
      if (res.success && res.data) {
        const d = res.data;
        toast.success(`Worker evaluated ${d.candidatesEvaluated} contacts. Sent: ${d.remindersSent}, Skipped: ${d.remindersSkipped}, Failed: ${d.remindersFailed}`);
        addSimLog(`Worker finished. Sent: ${d.remindersSent}, Skipped (Idempotent): ${d.remindersSkipped}, Failed: ${d.remindersFailed}`);
        refreshSettings();
        if (selectedContactId) fetchSimContactDetails(selectedContactId);
        fetchLogs(1);
      } else {
        toast.error(res.error || 'Worker run failed');
        addSimLog(`Worker error: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Worker run failed');
      addSimLog(`Worker exception: ${err?.message}`);
    } finally {
      setWorkerRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-3.5 sm:p-6 max-w-7xl space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white flex flex-wrap items-center gap-2">
                <span>WhatsApp 24h Window Automation</span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 shrink-0">
                  Meta Compliant
                </Badge>
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Track Meta 24-hour customer service windows and automatically send multi-tier expiry warnings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 z-10 w-full md:w-auto">
          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between sm:justify-start gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                Automation {isEnabled ? 'Active' : 'Disabled'}
              </span>
              <span className="text-[10px] text-slate-400">Master Switch</span>
            </div>
            <Switch checked={isEnabled} onCheckedChange={handleMasterToggle} />
          </div>

          <Button
            onClick={() => {
              setRuleToEdit(null);
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-2xl h-11 px-5 text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[3]" />
            Add Reminder Rule
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Automation Engine</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {isEnabled ? 'Enabled & Active' : 'Suspended'}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                30s background scan
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isEnabled ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              <Zap className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Warning Rules</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.activeRules} <span className="text-xs text-slate-400 font-normal">/ {stats.totalRules} rules</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-tier reminders</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Timer className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dispatched Today</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.sentToday}
              </p>
              <p className="text-[11px] text-emerald-600/80 font-medium">Idempotent sends</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Failed / Errors</p>
              <p className={`text-2xl font-black ${stats.failedCount > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                {stats.failedCount}
              </p>
              <p className="text-[11px] text-slate-500">Auto-logged with details</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="rules" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <TabsTrigger value="rules" className="rounded-xl px-5 py-2 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
              <Clock className="w-3.5 h-3.5 mr-2 text-emerald-500" />
              Reminder Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-xl px-5 py-2 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
              <FileText className="w-3.5 h-3.5 mr-2 text-blue-500" />
              Execution Logs & History
            </TabsTrigger>
            <TabsTrigger value="simulator" className="rounded-xl px-5 py-2 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
              <Sparkles className="w-3.5 h-3.5 mr-2 text-amber-500" />
              Testing Sandbox & Simulator
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualWorkerRun}
              disabled={workerRunning}
              className="rounded-xl h-9 text-xs font-semibold border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${workerRunning ? 'animate-spin text-emerald-500' : ''}`} />
              {workerRunning ? 'Running Evaluation...' : 'Run Worker Now'}
            </Button>
          </div>
        </div>

        {/* TAB 1: RULES MANAGEMENT */}
        <TabsContent value="rules" className="space-y-4">
          {rules.length === 0 ? (
            <Card className="p-12 text-center rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Reminder Rules Configured</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                Create automated rules to warn customers before their 24-hour WhatsApp customer service window expires.
              </p>
              <Button
                onClick={() => {
                  setRuleToEdit(null);
                  setIsModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl h-10 px-6 text-xs shadow-md"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create First Reminder Rule
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule) => (
                <Card
                  key={rule.id}
                  className={`rounded-2xl border transition-all ${
                    rule.isActive
                      ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm hover:shadow-md'
                      : 'border-slate-200 dark:border-slate-800/50 bg-slate-50/70 dark:bg-slate-900/30 opacity-70'
                  }`}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold text-[11px] px-2.5 py-0.5">
                            {rule.minutesBeforeExpiry} min before expiry
                          </Badge>
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {rule.messageType}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white pt-1">
                          {rule.name}
                        </CardTitle>
                      </div>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleRule(rule.id, rule.isActive)}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2 space-y-4">
                    {/* Message Preview Box */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        {rule.messageType === 'TEMPLATE' ? (
                          <>
                            <FileText className="w-3 h-3 text-blue-500" />
                            Template: {rule.templateName} ({rule.templateLanguage})
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3 h-3 text-emerald-500" />
                            Message Content
                          </>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                        {rule.textContent || rule.templateName || 'No content specified'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Updated {new Date(rule.updatedAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRuleToEdit(rule);
                            setIsModalOpen(true);
                          }}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: EXECUTION LOGS */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
            <CardHeader className="p-5 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Automated Reminder Execution History
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Comprehensive audit trail of all window expiry warning dispatches.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search contact or rule..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="h-9 text-xs pl-8 rounded-xl"
                  />
                </div>

                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {['ALL', 'SENT', 'FAILED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setLogStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        logStatusFilter === st
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {logsLoading ? (
                <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  Loading execution logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No execution logs found matching criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-5">Contact</th>
                        <th className="py-3 px-5">Reminder Rule</th>
                        <th className="py-3 px-5">Window Expiry</th>
                        <th className="py-3 px-5">Executed At</th>
                        <th className="py-3 px-5">Status</th>
                        <th className="py-3 px-5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-5 font-semibold text-slate-900 dark:text-slate-100">
                            <div>{log.contact?.name || log.contact?.waId}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{log.contact?.waId}</div>
                          </td>
                          <td className="py-3 px-5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{log.rule?.name}</div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              {log.rule?.minutesBeforeExpiry}m before expiry
                            </div>
                          </td>
                          <td className="py-3 px-5 text-slate-500">
                            {new Date(log.windowExpiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-5 text-slate-500">
                            {new Date(log.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-5">
                            {log.status === 'SENT' ? (
                              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                SENT
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                <XCircle className="w-3 h-3 mr-1" />
                                FAILED
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-5 text-slate-500 max-w-xs truncate">
                            {log.error ? (
                              <span className="text-rose-500 font-mono text-[11px]">{log.error}</span>
                            ) : log.messageId ? (
                              <span className="text-slate-400 font-mono text-[10px]">ID: {log.messageId.slice(0, 14)}...</span>
                            ) : (
                              'Dispatched'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {logsPagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>Showing page {logsPagination.page} of {logsPagination.totalPages}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logsPagination.page <= 1}
                      onClick={() => fetchLogs(logsPagination.page - 1)}
                      className="h-8 rounded-lg text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logsPagination.page >= logsPagination.totalPages}
                      onClick={() => fetchLogs(logsPagination.page + 1)}
                      className="h-8 rounded-lg text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SIMULATOR & TEST LAB */}
        <TabsContent value="simulator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Contact Picker & Status Visualizer */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-500" />
                  Select Test Contact
                </h3>
                <p className="text-xs text-slate-500">
                  Pick any contact to simulate window scenarios & observe worker behavior.
                </p>
              </div>

              <div className="space-y-2">
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {sampleContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.waId} ({c.waId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Window Status Display */}
              {simulatedContactData && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Live Window Status</span>
                    {simulatedContactData.windowStatus === 'ACTIVE' ? (
                      <Badge className="bg-emerald-500 text-white font-bold text-[10px]">🟢 24h ACTIVE</Badge>
                    ) : simulatedContactData.windowStatus === 'EXPIRING_SOON' ? (
                      <Badge className="bg-amber-500 text-white font-bold text-[10px]">🟡 EXPIRING SOON</Badge>
                    ) : (
                      <Badge variant="destructive" className="font-bold text-[10px]">🔴 EXPIRED</Badge>
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Inbound:</span>
                      <span className="font-medium">
                        {simulatedContactData.lastInboundMessageAt
                          ? new Date(simulatedContactData.lastInboundMessageAt).toLocaleTimeString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Window Expires:</span>
                      <span className="font-medium">
                        {simulatedContactData.windowExpiresAt
                          ? new Date(simulatedContactData.windowExpiresAt).toLocaleTimeString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Time Remaining:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.floor(simulatedContactData.remainingSeconds / 3600)}h {Math.floor((simulatedContactData.remainingSeconds % 3600) / 60)}m {simulatedContactData.remainingSeconds % 60}s
                      </span>
                    </div>
                  </div>

                  {/* Checklist of rules for this window */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Current Window Reminder Checklist:
                    </div>
                    {simulatedContactData.rules?.map((r: any) => (
                      <div key={r.ruleId} className="flex items-center justify-between text-xs py-1">
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          {r.isSent ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          {r.ruleName} ({r.minutesBeforeExpiry}m)
                        </span>
                        <span className={`text-[10px] font-bold ${r.isSent ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            {/* Middle: Scenario Simulation Buttons */}
            <Card className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-500" />
                  Simulate Timestamp Scenarios
                </h3>
                <p className="text-xs text-slate-500">
                  Click any scenario below to immediately shift the contact's window timestamp.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => handleRunSimulationScenario('active_24h')}
                  disabled={simLoading}
                  className="justify-start h-12 text-xs font-semibold rounded-xl border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  24h Active (Fresh Inbound)
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleRunSimulationScenario('remaining_60m')}
                  disabled={simLoading}
                  className="justify-start h-12 text-xs font-semibold rounded-xl border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                  60 Minutes Remaining
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleRunSimulationScenario('remaining_50m')}
                  disabled={simLoading}
                  className="justify-start h-12 text-xs font-semibold rounded-xl border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                  50 Minutes Remaining
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleRunSimulationScenario('remaining_30m')}
                  disabled={simLoading}
                  className="justify-start h-12 text-xs font-semibold rounded-xl border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                  30 Minutes Remaining
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleRunSimulationScenario('remaining_10m')}
                  disabled={simLoading}
                  className="justify-start h-12 text-xs font-semibold rounded-xl border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
                  10 Minutes Remaining
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleRunSimulationScenario('expired')}
                  disabled={simLoading}
                  className="justify-start h-12 text-xs font-semibold rounded-xl border-slate-300 dark:border-slate-700"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-500 mr-2" />
                  Window Expired
                </Button>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="secondary"
                  onClick={() => handleRunSimulationScenario('reset_reply')}
                  disabled={simLoading}
                  className="w-full h-11 text-xs font-bold rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Simulate New Customer Reply (Window Reset)
                </Button>
              </div>
            </Card>

            {/* Right: Live Console Output */}
            <Card className="rounded-3xl border-slate-800 bg-slate-950 text-white p-5 flex flex-col justify-between shadow-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    SIMULATION TEST LOGS
                  </span>
                  <button
                    onClick={() => setSimLogOutput([])}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>

                <div className="font-mono text-[11px] space-y-1.5 text-slate-300 min-h-[220px] max-h-[300px] overflow-y-auto">
                  {simLogOutput.length === 0 ? (
                    <div className="text-slate-600 italic py-8 text-center">
                      Run a scenario or trigger worker to see execution logs...
                    </div>
                  ) : (
                    simLogOutput.map((l, idx) => (
                      <div key={idx} className="leading-tight py-0.5 border-b border-slate-900/50">
                        {l}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Button
                onClick={handleManualWorkerRun}
                disabled={workerRunning}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl h-10 text-xs mt-4"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${workerRunning ? 'animate-spin' : ''}`} />
                Evaluate Active Rules Now
              </Button>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rule Add/Edit Modal */}
      <RuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ruleToEdit={ruleToEdit}
        templates={templates}
        onSaved={refreshSettings}
      />
    </div>
  );
}
