"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Clock,
  Globe,
  Tag as TagIcon,
  CalendarRange,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Search,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  ShieldCheck,
  UserCheck,
  X,
  SlidersHorizontal,
  HelpCircle,
  AlertTriangle,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getAgentAssignmentRules,
  createAgentAssignmentRule,
  updateAgentAssignmentRule,
  deleteAgentAssignmentRule,
  toggleAgentAssignmentRule,
  getAssignmentSelectorData,
  getAgentAssignedChatsCount,
  unassignAllAgentChatsAction,
  type AssignmentType,
} from "@/app/actions/agent-chat-assignment-rules";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface TagItem {
  id: string;
  name: string;
  color?: string | null;
}

interface ChatItem {
  id: string;
  name: string | null;
  waId: string;
  whatsappName: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | Date | null;
}

interface AssignmentRuleItem {
  id: string;
  organizationId: string;
  agentId: string;
  assignmentType: AssignmentType;
  specificChatIds: string[];
  tagIds: string[];
  startDate: string | Date | null;
  endDate: string | Date | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  resolvedTags?: TagItem[];
  resolvedChats?: ChatItem[];
}

interface AgentChatAssignmentSectionProps {
  agent: {
    id: string;
    name: string | null;
    email: string;
    createdAt?: string | Date | null;
    status?: string;
  };
  dir?: "ltr" | "rtl";
}

const ASSIGNMENT_TYPES_INFO: Record<
  AssignmentType,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: typeof MessageSquare;
    badgeColor: string;
    dotColor: string;
  }
> = {
  SPECIFIC_CHAT: {
    label: "Specific Conversations",
    shortLabel: "Specific Chats",
    description: "Manually assign one or multiple specific customer conversations to this agent.",
    icon: MessageSquare,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  AFTER_AGENT_CREATION: {
    label: "New Chats After Agent Creation",
    shortLabel: "Creation Timestamp",
    description: "Automatically route new conversations received after this agent was onboarded.",
    icon: UserCheck,
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
    dotColor: "bg-purple-500",
  },
  ALL_CHATS: {
    label: "All Conversations (Catch-All)",
    shortLabel: "All Chats",
    description: "Assign all incoming and live chats to this agent unconditionally.",
    icon: Globe,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
  TAG_BASED: {
    label: "Tag Based Assignment",
    shortLabel: "Tag Match",
    description: "Assign chats containing one or more specific category or pipeline tags.",
    icon: TagIcon,
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  DATETIME_RANGE: {
    label: "Scheduled Assignment Window",
    shortLabel: "Schedule",
    description: "Assign chats received within a specific date range and operating hourly window.",
    icon: CalendarRange,
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800",
    dotColor: "bg-indigo-500",
  },
};

export default function AgentChatAssignmentSection({
  agent,
  dir = "ltr",
}: AgentChatAssignmentSectionProps) {
  const isRtl = dir === "rtl";
  const [rules, setRules] = useState<AssignmentRuleItem[]>([]);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [recentChats, setRecentChats] = useState<ChatItem[]>([]);
  const [orgTimezone, setOrgTimezone] = useState<string>("UTC");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form State
  const [formType, setFormType] = useState<AssignmentType>("TAG_BASED");
  const [formSpecificChatIds, setFormSpecificChatIds] = useState<string[]>([]);
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [formStartDate, setFormStartDate] = useState<string>("");
  const [formEndDate, setFormEndDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("09:00");
  const [formEndTime, setFormEndTime] = useState<string>("18:00");
  const [formTimezone, setFormTimezone] = useState<string>("UTC");
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formApplyExisting, setFormApplyExisting] = useState<boolean>(false);
  const [chatSearchQuery, setChatSearchQuery] = useState<string>("");
  const [tagSearchQuery, setTagSearchQuery] = useState<string>("");

  const [assignedChatsCount, setAssignedChatsCount] = useState<number>(0);
  const [isUnassigningAll, setIsUnassigningAll] = useState<boolean>(false);

  const agentDisplayName = agent?.name || agent?.email?.split("@")[0] || "Agent";

  const formattedAgentCreatedAt = useMemo(() => {
    if (!agent?.createdAt) return "N/A";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(agent.createdAt));
    } catch {
      return String(agent.createdAt);
    }
  }, [agent?.createdAt]);

  const loadData = useCallback(async () => {
    if (!agent?.id) return;
    setIsLoading(true);
    try {
      const [rulesData, selectorData, countData] = await Promise.all([
        getAgentAssignmentRules(agent.id),
        getAssignmentSelectorData(),
        getAgentAssignedChatsCount(agent.id),
      ]);
      setRules((rulesData as any) || []);
      setAvailableTags(selectorData.tags || []);
      setRecentChats(selectorData.recentChats || []);
      setOrgTimezone(selectorData.orgTimezone || "UTC");
      setAssignedChatsCount(countData || 0);
    } catch (error) {
      console.error("Failed to load assignment rules:", error);
      toast.error("Failed to load assignment rules");
    } finally {
      setIsLoading(false);
    }
  }, [agent?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingRuleId(null);
    setFormType("TAG_BASED");
    setFormSpecificChatIds([]);
    setFormTagIds([]);
    setFormStartDate("");
    setFormEndDate("");
    setFormStartTime("09:00");
    setFormEndTime("18:00");
    setFormTimezone(orgTimezone || "UTC");
    setFormPriority(rules.length + 1);
    setFormIsActive(true);
    setFormApplyExisting(false);
    setChatSearchQuery("");
    setTagSearchQuery("");
    setIsModalOpen(true);
  };

  const openEditModal = (rule: AssignmentRuleItem) => {
    setEditingRuleId(rule.id);
    setFormType(rule.assignmentType);
    setFormSpecificChatIds(rule.specificChatIds || []);
    setFormTagIds(rule.tagIds || []);
    setFormStartDate(
      rule.startDate ? new Date(rule.startDate).toISOString().split("T")[0] : ""
    );
    setFormEndDate(
      rule.endDate ? new Date(rule.endDate).toISOString().split("T")[0] : ""
    );
    setFormStartTime(rule.startTime || "09:00");
    setFormEndTime(rule.endTime || "18:00");
    setFormTimezone(rule.timezone || orgTimezone || "UTC");
    setFormPriority(rule.priority || 1);
    setFormIsActive(rule.isActive !== false);
    setFormApplyExisting(false);
    setChatSearchQuery("");
    setTagSearchQuery("");
    setIsModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (formType === "SPECIFIC_CHAT" && formSpecificChatIds.length === 0) {
      toast.error("Please select at least one specific chat");
      return;
    }
    if (formType === "TAG_BASED" && formTagIds.length === 0) {
      toast.error("Please select at least one tag");
      return;
    }
    if (formType === "DATETIME_RANGE") {
      if (!formStartDate || !formEndDate) {
        toast.error("Please specify both Start Date and End Date");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingRuleId) {
        await updateAgentAssignmentRule(editingRuleId, {
          assignmentType: formType,
          specificChatIds: formSpecificChatIds,
          tagIds: formTagIds,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          startTime: formStartTime || null,
          endTime: formEndTime || null,
          timezone: formTimezone || "UTC",
          priority: formPriority,
          isActive: formIsActive,
        });
        toast.success("Assignment rule updated successfully");
      } else {
        await createAgentAssignmentRule({
          agentId: agent.id,
          assignmentType: formType,
          specificChatIds: formSpecificChatIds,
          tagIds: formTagIds,
          startDate: formStartDate || null,
          endDate: formEndDate || null,
          startTime: formStartTime || null,
          endTime: formEndTime || null,
          timezone: formTimezone || "UTC",
          priority: formPriority,
          isActive: formIsActive,
          applyToExistingChats: formApplyExisting,
        });
        toast.success("Assignment rule created successfully");
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save assignment rule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassignAllChats = async () => {
    if (!agent?.id || assignedChatsCount === 0) return;
    const confirmMessage = `Are you sure you want to unassign all ${assignedChatsCount} active chat(s) from ${agentDisplayName}?\n\nThese chats will become unassigned and will immediately stop appearing in this agent's live chat inbox, counters, and popup notifications.`;
    if (!confirm(confirmMessage)) return;

    setIsUnassigningAll(true);
    try {
      const res = await unassignAllAgentChatsAction(agent.id);
      toast.success(`Successfully unassigned ${res.count} chat(s) from ${agentDisplayName}`);
      setAssignedChatsCount(0);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to unassign chats");
    } finally {
      setIsUnassigningAll(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    let unassignChats = false;
    if (assignedChatsCount > 0) {
      const confirmed = confirm(
        `Are you sure you want to delete this assignment rule?\n\nClick OK to proceed.`
      );
      if (!confirmed) return;
      unassignChats = confirm(
        `Do you ALSO want to unassign the ${assignedChatsCount} active chat(s) currently assigned to ${agentDisplayName}?\n\n• Click OK to delete rule AND unassign all chats from this agent.\n• Click Cancel to ONLY delete rule (keep current chats assigned).`
      );
    } else {
      if (!confirm("Are you sure you want to delete this assignment rule?")) return;
    }

    try {
      const res = await deleteAgentAssignmentRule(id, unassignChats);
      toast.success(
        unassignChats && (res.unassignedCount ?? 0) > 0
          ? `Assignment rule removed and ${res.unassignedCount} chat(s) unassigned`
          : "Assignment rule removed"
      );
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (unassignChats) {
        setAssignedChatsCount(0);
      }
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete rule");
    }
  };


  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const newActive = !currentActive;
    // Optimistic update
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: newActive } : r))
    );
    try {
      await toggleAgentAssignmentRule(id, newActive);
      toast.success(newActive ? "Rule activated" : "Rule paused");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update rule status");
      loadData();
    }
  };

  const filteredChats = useMemo(() => {
    if (!chatSearchQuery) return recentChats;
    const q = chatSearchQuery.toLowerCase();
    return recentChats.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.whatsappName?.toLowerCase().includes(q) ||
        c.waId?.toLowerCase().includes(q)
    );
  }, [recentChats, chatSearchQuery]);

  const filteredAvailableTags = useMemo(() => {
    if (!tagSearchQuery) return availableTags;
    const q = tagSearchQuery.toLowerCase();
    return availableTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [availableTags, tagSearchQuery]);

  const generateRuleSummary = (rule: {
    assignmentType: AssignmentType;
    specificChatIds?: string[];
    tagIds?: string[];
    resolvedTags?: TagItem[];
    resolvedChats?: ChatItem[];
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    startTime?: string | null;
    endTime?: string | null;
    timezone?: string | null;
  }) => {
    switch (rule.assignmentType) {
      case "SPECIFIC_CHAT":
        const chatCount = rule.specificChatIds?.length || 0;
        return `Specific conversations (${chatCount} conversation${chatCount !== 1 ? "s" : ""} selected) will be routed to ${agentDisplayName}.`;
      case "AFTER_AGENT_CREATION":
        return `Conversations received after ${formattedAgentCreatedAt} will be routed to ${agentDisplayName}.`;
      case "ALL_CHATS":
        return `All incoming customer conversations will be assigned to ${agentDisplayName}.`;
      case "TAG_BASED":
        const tagNames = rule.resolvedTags?.map((t) => t.name).join(", ");
        return tagNames
          ? `Conversations tagged with "${tagNames}" will automatically be assigned to ${agentDisplayName}.`
          : `Conversations with selected tags will automatically be assigned to ${agentDisplayName}.`;
      case "DATETIME_RANGE":
        const sDate = rule.startDate
          ? new Date(rule.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "Start Date";
        const eDate = rule.endDate
          ? new Date(rule.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "End Date";
        return `Conversations received between ${sDate} and ${eDate} (${rule.startTime || "00:00"} – ${rule.endTime || "23:59"} ${rule.timezone || "UTC"}) will be routed to ${agentDisplayName}.`;
      default:
        return `Matching conversations will be assigned to ${agentDisplayName}.`;
    }
  };

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-5 text-start">
      {/* HEADER BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Live Chat Assignment
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074] border border-emerald-200 dark:border-emerald-800">
                {activeCount} Active Rule{activeCount !== 1 ? "s" : ""}
              </span>
            </h3>

            {/* Currently Assigned Chats Badge */}
            <span
              className={cn(
                "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border transition-all",
                assignedChatsCount > 0
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              )}
            >
              {assignedChatsCount} Assigned Chat{assignedChatsCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Define which customer conversations should automatically be assigned to <strong className="text-slate-700 dark:text-slate-200">{agentDisplayName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {assignedChatsCount > 0 && (
            <button
              type="button"
              onClick={handleUnassignAllChats}
              disabled={isUnassigningAll}
              title={`Unassign all ${assignedChatsCount} chats currently assigned to this agent`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {isUnassigningAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserX className="w-3.5 h-3.5" />
              )}
              <span>Unassign All Chats ({assignedChatsCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-bold shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Assignment Rule
          </button>
        </div>
      </div>

      {/* CONFLICT RESOLUTION HELPER BANNER */}
      <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Deterministic Priority:</strong> When a new chat arrives, assignment rules across all agents are evaluated in priority order (Priority #1 first). Once a match is found, the chat is immediately assigned and subsequent rules are skipped.
        </p>
      </div>

      {/* RULES LIST CONTAINER */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-[#00B074]" />
          <p className="text-xs font-semibold">Loading assignment rules...</p>
        </div>
      ) : rules.length === 0 ? (
        /* ENTERPRISE COMPACT EMPTY STATE */
        <div className="py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074] border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
              No Assignment Rules Configured
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              Create rules to automatically route conversations to {agentDisplayName} based on tags, timing, or specific chats.
            </p>
          </div>

          {/* Active Assigned Chats Warning in Empty State */}
          {assignedChatsCount > 0 && (
            <div className="w-full max-w-lg p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-start mt-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    {assignedChatsCount} Chat{assignedChatsCount !== 1 ? "s" : ""} Still Assigned
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                    Although no routing rules are configured, this agent currently has {assignedChatsCount} active conversation(s) assigned to them in the database from previous routing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUnassignAllChats}
                disabled={isUnassigningAll}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isUnassigningAll ? "Unassigning..." : "Unassign All"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Assignment Rule
          </button>
        </div>
      ) : (

        /* RULE CARDS LIST */
        <div className="grid grid-cols-1 gap-3">
          {rules.map((rule) => {
            const info = ASSIGNMENT_TYPES_INFO[rule.assignmentType] || ASSIGNMENT_TYPES_INFO.TAG_BASED;
            const Icon = info.icon;
            const summaryText = generateRuleSummary(rule);

            return (
              <div
                key={rule.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-start",
                  rule.isActive
                    ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                    : "bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/50 opacity-70"
                )}
              >
                {/* Left Rule Content */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
                      info.badgeColor
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                          info.badgeColor
                        )}
                      >
                        {info.shortLabel}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        Priority #{rule.priority}
                      </span>
                      {rule.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00B074]" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Paused
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                      {summaryText}
                    </p>

                    {/* Tag Badges list */}
                    {rule.assignmentType === "TAG_BASED" && rule.resolvedTags && rule.resolvedTags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {rule.resolvedTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200/80 dark:border-amber-800/80"
                          >
                            <TagIcon className="w-2.5 h-2.5" />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
                  {/* Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(rule.id, rule.isActive)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      rule.isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] hover:bg-emerald-100/60"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
                    )}
                    title="Toggle active status"
                  >
                    {rule.isActive ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00B074]" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        Inactive
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(rule)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT RULE MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/30">
            <div className="space-y-0.5 text-start">
              <DialogTitle className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00B074]" />
                {editingRuleId ? "Edit Assignment Rule" : "Create Assignment Rule"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium">
                Assign specific conversations to <strong className="text-slate-700 dark:text-slate-300">{agentDisplayName}</strong> based on matching criteria.
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-6 text-start">
            {/* 1. ASSIGNMENT TYPE SELECTOR */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                1. Select Assignment Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(ASSIGNMENT_TYPES_INFO) as AssignmentType[]).map((type) => {
                  const info = ASSIGNMENT_TYPES_INFO[type];
                  const Icon = info.icon;
                  const isSelected = formType === type;

                  return (
                    <div
                      key={type}
                      onClick={() => setFormType(type)}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-2.5",
                        isSelected
                          ? "border-[#00B074] bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/40"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border",
                          info.badgeColor
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center justify-between">
                          {info.label}
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#00B074]" />}
                        </h5>
                        <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium leading-tight">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. TYPE CONFIGURATION */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                2. Rule Configuration
              </label>

              {/* SPECIFIC CHAT PICKER */}
              {formType === "SPECIFIC_CHAT" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search conversations by customer name or phone number..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-2 space-y-1 bg-slate-50/50 dark:bg-slate-950/50">
                    {filteredChats.length === 0 ? (
                      <p className="p-4 text-center text-xs font-bold text-slate-400">
                        No conversations found
                      </p>
                    ) : (
                      filteredChats.map((chat) => {
                        const isChecked = formSpecificChatIds.includes(chat.id);
                        return (
                          <div
                            key={chat.id}
                            onClick={() => {
                              setFormSpecificChatIds((prev) =>
                                isChecked
                                  ? prev.filter((id) => id !== chat.id)
                                  : [...prev, chat.id]
                              );
                            }}
                            className={cn(
                              "p-2 rounded-lg flex items-center justify-between cursor-pointer text-xs font-semibold transition-colors",
                              isChecked
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074]"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
                                {(chat.name || chat.whatsappName || chat.waId).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-bold">
                                  {chat.name || chat.whatsappName || chat.waId}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {chat.waId}
                                </p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-4 h-4 rounded text-[#00B074] focus:ring-[#00B074] cursor-pointer"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-semibold">
                    {formSpecificChatIds.length} conversation{formSpecificChatIds.length !== 1 ? "s" : ""} selected.
                  </p>
                </div>
              )}

              {/* AFTER AGENT CREATION */}
              {formType === "AFTER_AGENT_CREATION" && (
                <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-xs">
                    <UserCheck className="w-4 h-4" />
                    Agent Creation Starting Point
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                    Agent account created on: <strong className="text-purple-700 dark:text-purple-400">{formattedAgentCreatedAt}</strong>.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Any new customer message received after {formattedAgentCreatedAt} will automatically be assigned to {agentDisplayName}. Existing older conversations prior to this timestamp remain unaffected.
                  </p>
                </div>
              )}

              {/* ALL CHATS */}
              {formType === "ALL_CHATS" && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Catch-All Assignment Warning
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    All incoming and newly created conversations across the organization will be assigned to <strong className="text-slate-900 dark:text-white">{agentDisplayName}</strong>.
                  </p>
                </div>
              )}

              {/* TAG BASED PICKER */}
              {formType === "TAG_BASED" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search tags..."
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 max-h-40 overflow-y-auto">
                    {filteredAvailableTags.length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold p-2">
                        No tags found.
                      </p>
                    ) : (
                      filteredAvailableTags.map((tag) => {
                        const isSelected = formTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              setFormTagIds((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== tag.id)
                                  : [...prev, tag.id]
                              );
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                              isSelected
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                            )}
                          >
                            <TagIcon className="w-3 h-3" />
                            {tag.name}
                            {isSelected && <Check className="w-3 h-3 ms-1" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* DATE & TIME RANGE */}
              {formType === "DATETIME_RANGE" && (
                <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                        Timezone
                      </label>
                      <input
                        type="text"
                        value={formTimezone}
                        onChange={(e) => setFormTimezone(e.target.value)}
                        placeholder="e.g. UTC, Asia/Karachi"
                        className="w-full h-9 px-3 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* 3. LIVE PREVIEW SUMMARY */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-[#00B074] tracking-wider block">
                Rule Summary Preview
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {generateRuleSummary({
                  assignmentType: formType,
                  specificChatIds: formSpecificChatIds,
                  tagIds: formTagIds,
                  resolvedTags: availableTags.filter((t) => formTagIds.includes(t.id)),
                  startDate: formStartDate,
                  endDate: formEndDate,
                  startTime: formStartTime,
                  endTime: formEndTime,
                  timezone: formTimezone,
                })}
              </p>
            </div>
          </div>

          <DialogFooter className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveRule}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingRuleId ? "Save Changes" : "Create Assignment Rule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
