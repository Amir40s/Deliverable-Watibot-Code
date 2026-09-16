'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getTagAssignmentRules,
  createTagAssignmentRule,
  deleteTagAssignmentRule,
  reorderTagAssignmentRules,
  getAssignmentSettings,
  updateAssignmentSettings,
  updateAgentAvailability,
} from '@/app/actions/assignment-rules';
import { getTags } from '@/app/actions/tags';
import { getAgents } from '@/app/actions/agents';
import {
  Settings2,
  Tag,
  UserCheck,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface TagRule {
  id: string;
  tagId: string;
  agentId: string;
  priority: number;
  tag: { id: string; name: string; color: string | null };
  agent: { id: string; name: string | null; email: string; status: string; availabilityStatus: string | null };
}

interface AgentItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  isAutoAssignEligible?: boolean;
  availabilityStatus?: string;
  department?: { name: string } | null;
}

export function AssignmentRulesPanel() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<TagRule[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [settings, setSettings] = useState({
    autoAssignmentEnabled: true,
    roundRobinFallbackEnabled: true,
  });

  // Modal State for New Rule
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesData, tagsData, agentsData, settingsData] = await Promise.all([
        getTagAssignmentRules(),
        getTags(),
        getAgents(),
        getAssignmentSettings(),
      ]);

      setRules(rulesData as any[]);
      setTags(tagsData || []);
      setAgents(agentsData as any[]);
      if (settingsData) {
        setSettings(settingsData);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load assignment rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Global Settings Toggles
  const handleToggleAutoAssign = async (checked: boolean) => {
    const newSettings = { ...settings, autoAssignmentEnabled: checked };
    setSettings(newSettings);
    try {
      await updateAssignmentSettings(newSettings);
      toast.success(checked ? 'Automatic assignment enabled' : 'Automatic assignment disabled');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update settings');
    }
  };

  const handleToggleRoundRobin = async (checked: boolean) => {
    const newSettings = { ...settings, roundRobinFallbackEnabled: checked };
    setSettings(newSettings);
    try {
      await updateAssignmentSettings(newSettings);
      toast.success(checked ? 'Round-Robin fallback enabled' : 'Round-Robin fallback disabled');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update settings');
    }
  };

  // Handle Adding New Tag Assignment Rule
  const handleCreateRule = async () => {
    if (!selectedTagId || !selectedAgentId) {
      toast.error('Please select both a Tag and an Agent');
      return;
    }

    setIsSubmittingRule(true);
    try {
      await createTagAssignmentRule(selectedTagId, selectedAgentId);
      toast.success('Tag assignment rule created');
      setIsAddRuleOpen(false);
      setSelectedTagId('');
      setSelectedAgentId('');
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create rule');
    } finally {
      setIsSubmittingRule(false);
    }
  };

  // Handle Delete Rule
  const handleDeleteRule = async (id: string) => {
    try {
      await deleteTagAssignmentRule(id);
      toast.success('Rule deleted');
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete rule');
    }
  };

  // Handle Reordering Priority
  const handleMoveRule = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    setRules(newRules);

    try {
      await reorderTagAssignmentRules(newRules.map(r => r.id));
      toast.success('Rule priority updated');
    } catch (err: any) {
      toast.error('Failed to update priority order');
      fetchData();
    }
  };

  // Handle Agent Auto-Assign Eligibility & Availability Status
  const handleToggleAgentEligible = async (agentId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    setAgents(prev =>
      prev.map(a => (a.id === agentId ? { ...a, isAutoAssignEligible: nextVal } : a))
    );

    try {
      await updateAgentAvailability(agentId, { isAutoAssignEligible: nextVal });
      toast.success('Agent auto-assign eligibility updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update agent eligibility');
      fetchData();
    }
  };

  const handleChangeAvailabilityStatus = async (agentId: string, status: any) => {
    setAgents(prev =>
      prev.map(a => (a.id === agentId ? { ...a, availabilityStatus: status } : a))
    );

    try {
      await updateAgentAvailability(agentId, { availabilityStatus: status });
      toast.success(`Agent status updated to ${status}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#00B074] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Global Assignment Control Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-start justify-between">
          <div className="space-y-1.5 pr-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#00B074]" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Automatic Assignment</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Enable automatic evaluation of incoming conversations against customer tag rules and round-robin fallback.
            </p>
          </div>
          <Switch
            checked={settings.autoAssignmentEnabled}
            onCheckedChange={handleToggleAutoAssign}
            className="data-[state=checked]:bg-[#00B074]"
          />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-start justify-between">
          <div className="space-y-1.5 pr-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Round-Robin Fallback</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Automatically distribute conversations sequentially to active, available agents when no tag rule matches.
            </p>
          </div>
          <Switch
            checked={settings.roundRobinFallbackEnabled}
            onCheckedChange={handleToggleRoundRobin}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>
      </div>

      {/* 2. Tag-Based Assignment Rules Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#00B074]" />
              <h3 className="font-black text-slate-900 dark:text-white text-lg">Tag Assignment Rules</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Higher-priority rules (top of table) take precedence when a customer has multiple tags.
            </p>
          </div>

          <Button
            onClick={() => setIsAddRuleOpen(true)}
            className="bg-[#00B074] hover:bg-[#00B074]/90 text-white font-bold text-xs rounded-xl h-10 px-4 flex items-center gap-2 border-none shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Tag Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No tag assignment rules configured yet.</p>
            <Button
              onClick={() => setIsAddRuleOpen(true)}
              variant="outline"
              className="text-xs font-bold rounded-xl"
            >
              Create Your First Rule
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Priority</th>
                  <th className="py-3.5 px-6">Customer Tag</th>
                  <th className="py-3.5 px-6">Assigned Live Agent</th>
                  <th className="py-3.5 px-6 text-center">Order</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rules.map((rule, idx) => (
                  <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 font-black text-slate-900 dark:text-white">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-[#00B074]">
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        style={{ backgroundColor: rule.tag.color || '#10B981' }}
                        className="text-white font-bold text-xs px-2.5 py-1 rounded-md"
                      >
                        {rule.tag.name}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {rule.agent.name || rule.agent.email}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">{rule.agent.email}</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          disabled={idx === 0}
                          onClick={() => handleMoveRule(idx, 'up')}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          disabled={idx === rules.length - 1}
                          onClick={() => handleMoveRule(idx, 'down')}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button
                        onClick={() => handleDeleteRule(rule.id)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Live Agents Availability & Auto-Assign Pool Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-500" />
            <h3 className="font-black text-slate-900 dark:text-white text-lg">Agent Availability & Pool Configuration</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Configure which agents participate in automatic assignment and update their active availability status.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">Agent</th>
                <th className="py-3.5 px-6">Account Status</th>
                <th className="py-3.5 px-6 text-center">Auto-Assign Pool</th>
                <th className="py-3.5 px-6">Availability Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {agents.map(agent => (
                <tr key={agent.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {agent.name || agent.email}
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">{agent.email}</div>
                  </td>
                  <td className="py-4 px-6">
                    <Badge
                      className={
                        agent.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 font-bold'
                      }
                    >
                      {agent.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Switch
                      checked={agent.isAutoAssignEligible ?? true}
                      onCheckedChange={() => handleToggleAgentEligible(agent.id, agent.isAutoAssignEligible ?? true)}
                      className="data-[state=checked]:bg-[#00B074]"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <Select
                      value={agent.availabilityStatus || 'ONLINE'}
                      onValueChange={val => handleChangeAvailabilityStatus(agent.id, val)}
                    >
                      <SelectTrigger className="w-36 h-9 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONLINE">🟢 Online</SelectItem>
                        <SelectItem value="BUSY">🟡 Busy</SelectItem>
                        <SelectItem value="OFFLINE">⚪ Offline</SelectItem>
                        <SelectItem value="UNAVAILABLE">🔴 Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Tag Rule Modal */}
      <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#00B074]" />
              New Tag Assignment Rule
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Customer Tag</label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger className="h-10 text-xs font-medium rounded-xl">
                  <SelectValue placeholder="Choose a tag..." />
                </SelectTrigger>
                <SelectContent>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: t.color || '#10B981' }}
                        />
                        <span>{t.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Assign To Live Agent</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-10 text-xs font-medium rounded-xl">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name ? `${a.name} (${a.email})` : a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsAddRuleOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRule}
              disabled={isSubmittingRule || !selectedTagId || !selectedAgentId}
              className="bg-[#00B074] hover:bg-[#00B074]/90 text-white font-bold text-xs rounded-xl h-10 px-5"
            >
              {isSubmittingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
