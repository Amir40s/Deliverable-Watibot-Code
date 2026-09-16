"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Shuffle,
  RotateCw,
  Users,
  Check,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Info,
  Loader2,
  Save,
  Sliders,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getAssignmentSettings,
  updateAssignmentSettings,
  updateAgentAvailability,
} from "@/app/actions/assignment-rules";

interface AgentItem {
  id: string;
  name: string | null;
  email: string;
  isAutoAssignEligible?: boolean;
  availabilityStatus?: string;
}

interface RoundRobinRoutingSectionProps {
  dir?: "ltr" | "rtl";
}

export default function RoundRobinRoutingSection({
  dir = "ltr",
}: RoundRobinRoutingSectionProps) {
  const isRtl = dir === "rtl";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [batchSize, setBatchSize] = useState(2);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [routingScope, setRoutingScope] = useState<"NEW_ONLY" | "ALL">("NEW_ONLY");
  const [agentWeights, setAgentWeights] = useState<Record<string, number>>({});
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [currentCount, setCurrentCount] = useState(0);
  const [lastAgentId, setLastAgentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAssignmentSettings();
      if (data) {
        setEnabled(data.roundRobinFallbackEnabled ?? true);
        setBatchSize(data.roundRobinBatchSize || 2);
        setCurrentCount(data.roundRobinCurrentCount || 0);
        setLastAgentId(data.roundRobinLastAgentId || null);
        setAgents((data.agents as any) || []);

        const config = data.roundRobinConfig || {};
        if (config.mode === "custom") {
          setMode("custom");
        } else {
          setMode("equal");
        }
        if (config.routingScope === "ALL") {
          setRoutingScope("ALL");
        } else {
          setRoutingScope("NEW_ONLY");
        }
        if (config.agentWeights) {
          setAgentWeights(config.agentWeights);
        }
      }
    } catch (err: any) {
      console.error("Failed to load round robin settings:", err);
      toast.error("Failed to load round-robin settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeAgents = useMemo(() => {
    return agents.filter((a) => a.isAutoAssignEligible !== false);
  }, [agents]);

  // Live simulation of how 10 chats flow across the agents
  const simulationFlow = useMemo(() => {
    if (activeAgents.length === 0) return [];
    const sampleChats = Array.from({ length: 10 }, (_, i) => i + 1);
    const flow: Array<{ chatNumber: number; agentName: string; agentIndex: number; batchProgress: string }> = [];

    let currentAgentIdx = 0;
    let currentAgentCount = 0;

    sampleChats.forEach((chatNum) => {
      const agent = activeAgents[currentAgentIdx % activeAgents.length];
      const targetBatch = mode === "custom" && agentWeights[agent.id] ? Number(agentWeights[agent.id]) : batchSize;

      currentAgentCount++;
      flow.push({
        chatNumber: chatNum,
        agentName: agent.name || agent.email.split("@")[0],
        agentIndex: currentAgentIdx % activeAgents.length,
        batchProgress: `${currentAgentCount}/${targetBatch}`,
      });

      if (currentAgentCount >= targetBatch) {
        currentAgentIdx++;
        currentAgentCount = 0;
      }
    });

    return flow;
  }, [activeAgents, batchSize, mode, agentWeights]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAssignmentSettings({
        roundRobinFallbackEnabled: enabled,
        roundRobinBatchSize: Math.max(1, batchSize),
        roundRobinConfig: {
          mode,
          routingScope,
          agentWeights: mode === "custom" ? agentWeights : {},
        },
      });
      toast.success("Round-Robin routing settings saved successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAgentEligible = async (agentId: string, currentEligible: boolean) => {
    const newEligible = !currentEligible;
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, isAutoAssignEligible: newEligible } : a))
    );
    try {
      await updateAgentAvailability(agentId, { isAutoAssignEligible: newEligible });
      toast.success(`Agent ${newEligible ? "included in" : "excluded from"} round-robin rotation`);
    } catch {
      toast.error("Failed to update agent eligibility");
      loadData();
    }
  };

  const handleAgentWeightChange = (agentId: string, value: number) => {
    setAgentWeights((prev) => ({
      ...prev,
      [agentId]: Math.max(1, value),
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs p-5 sm:p-6 space-y-6 text-start">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-center font-bold">
              <Shuffle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Round-Robin & Batch Rotation Routing
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                  {enabled ? "Active Fallback" : "Disabled"}
                </span>
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ps-10">
            Automatically distribute unassigned conversations across active agents in consecutive batches or custom quotas.
          </p>
        </div>

        {/* Master Enabled Toggle */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border",
              enabled
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] border-emerald-200 dark:border-emerald-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
            )}
          >
            {enabled ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00B074]" />
                Enabled
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                Disabled
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Rotation Rule
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-[#00B074]" />
          <p className="text-xs font-semibold">Loading round-robin routing parameters...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* CHAT ELIGIBILITY & ROUTING SCOPE (FRESH / NEW CHATS VS ALL) */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Chat Eligibility & Routing Scope
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Define which incoming conversations qualify for Round-Robin automatic assignment:
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
                <Sparkles className="w-3 h-3 text-[#00B074]" />
                {routingScope === "NEW_ONLY" ? "Only Fresh / New Chats" : "All Unassigned Chats"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRoutingScope("NEW_ONLY")}
                className={cn(
                  "p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col gap-1.5 relative",
                  routingScope === "NEW_ONLY"
                    ? "border-[#00B074] bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-[#00B074]"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00B074]" />
                    Only Fresh / New Chats (Recommended)
                  </span>
                  {routingScope === "NEW_ONLY" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00B074]" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed ps-6">
                  Apply round-robin strictly to brand new, first-time customer chats. Existing or returning conversations with previous chat history will <strong>NOT</strong> be auto-assigned.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRoutingScope("ALL")}
                className={cn(
                  "p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col gap-1.5 relative",
                  routingScope === "ALL"
                    ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 shadow-xs ring-1 ring-purple-600"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <RotateCw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    All Unassigned Chats (Include Returning / Old)
                  </span>
                  {routingScope === "ALL" ? (
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed ps-6">
                  Apply round-robin to all unassigned chats, including returning customers who message again after a previous conversation.
                </p>
              </button>
            </div>
          </div>

          {/* ROTATION MODE & CONSECUTIVE BATCH SIZE CONFIG */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Mode and Batch Stepper (col-span-6) */}
            <div className="lg:col-span-6 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Consecutive Chat Batch Capacity
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  How many consecutive conversations each agent receives before rotating to the next agent:
                </p>
              </div>

              {/* Batch Size Stepper & Quick Presets */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBatchSize((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center font-black text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-black text-sm text-slate-900 dark:text-white">
                    {batchSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBatchSize((prev) => Math.min(50, prev + 1))}
                    className="w-8 h-8 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center font-black text-sm cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBatchSize(preset)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                        batchSize === preset
                          ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      {preset === 1 ? "1 Chat (1-by-1)" : `${preset} Chats in Batch`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selector */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode("equal")}
                  className={cn(
                    "flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                    mode === "equal"
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Equal Batch ({batchSize} per agent)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className={cn(
                    "flex-1 p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                    mode === "custom"
                      ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Custom Agent Quotas
                </button>
              </div>
            </div>

            {/* Right: Interactive Visual Simulation Flow (col-span-6) */}
            <div className="lg:col-span-6 p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live 10-Chat Distribution Flow Preview
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {activeAgents.length} participating agent{activeAgents.length !== 1 ? "s" : ""}
                </span>
              </div>

              {activeAgents.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold p-4 text-center">
                  No active eligible agents currently participating in round-robin.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    When <strong className="text-slate-900 dark:text-white">10 chats</strong> arrive sequentially:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                    {simulationFlow.map((item) => (
                      <div
                        key={item.chatNumber}
                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/60 shadow-xs space-y-0.5 text-center"
                      >
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 block">
                          Chat #{item.chatNumber}
                        </span>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                          {item.agentName}
                        </p>
                        <span className="text-[9px] font-bold text-slate-400 block">
                          ({item.batchProgress})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PARTICIPATING AGENTS ROTATION TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Participating Agents ({activeAgents.length} of {agents.length} Enabled)
              </label>
              <span className="text-xs text-slate-400 font-medium">
                Uncheck an agent to temporarily exclude them from rotation.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => {
                const isChecked = agent.isAutoAssignEligible !== false;
                const agentWeight = agentWeights[agent.id] || batchSize;

                return (
                  <div
                    key={agent.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-start",
                      isChecked
                        ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/50 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleAgentEligible(agent.id, isChecked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-600 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {agent.name || agent.email}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {agent.email}
                        </p>
                      </div>
                    </div>

                    {/* Per-agent custom batch input if mode === custom */}
                    {mode === "custom" && isChecked ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400">Batch:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={agentWeight}
                          onChange={(e) => handleAgentWeightChange(agent.id, parseInt(e.target.value, 10) || 1)}
                          className="w-12 h-7 px-1 text-xs font-black text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md shrink-0">
                        {isChecked ? `${batchSize} chats/turn` : "Excluded"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
