"use client";

import { useState, useEffect } from "react";
import {
  Check,
  Save,
  Loader2,
  Zap,
  MessageSquare,
  Users,
  Database,
  Undo2,
  DollarSign,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import WatiBotLoader from "@/components/WatiBotLoader";
import { Button } from "@/components/ui/button";
import { PLAN_CONFIG_UPDATED_EVENT, PLAN_CONFIG_UPDATED_STORAGE_KEY } from "@/lib/plan-refresh";

interface PlanConfig {
  id: string;
  slug: string;
  name: string;
  isEnabled: boolean;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  maxContacts: number;
  maxBotFlows: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxBotReplies: number;
  aiChatBotEnabled: boolean;
  apiWebhookAccess: boolean;
  modulesAccess: Record<string, boolean>;
}

const PLAN_THEMES: Record<
  string,
  {
    borderActive: string;
    bgActive: string;
    iconBgActive: string;
    accentBar: string;
    labelColor: string;
    btnBgClass: string;
    badgeActive: string;
    hoverGlow: string;
  }
> = {
  free: {
    borderActive: "border-[#00a884] ring-4 ring-[#00a884]/5",
    bgActive: "bg-[#00a884]/5 dark:bg-[#00a884]/[0.02]",
    iconBgActive: "bg-[#00a884]/15 text-[#00a884]",
    accentBar: "bg-[#00a884]",
    labelColor: "text-[#00a884]",
    btnBgClass: "bg-[#00a884] hover:bg-[#009675]",
    badgeActive: "bg-[#00a884]/20 text-[#00a884]",
    hoverGlow: "hover:shadow-[#00a884]/10 border-[#00a884]",
  },
  standard: {
    borderActive: "border-indigo-500 ring-4 ring-indigo-500/5",
    bgActive: "bg-indigo-50/50 dark:bg-indigo-950/[0.02]",
    iconBgActive: "bg-indigo-500/15 text-indigo-650 dark:text-indigo-400",
    accentBar: "bg-indigo-600",
    labelColor: "text-indigo-600",
    btnBgClass: "bg-indigo-600 hover:bg-indigo-700",
    badgeActive: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    hoverGlow: "hover:shadow-indigo-500/10 border-indigo-500",
  },
  premium: {
    borderActive: "border-purple-500 ring-4 ring-purple-500/5",
    bgActive: "bg-purple-50/50 dark:bg-purple-950/[0.02]",
    iconBgActive: "bg-purple-500/15 text-purple-650 dark:text-purple-400",
    accentBar: "bg-purple-600",
    labelColor: "text-purple-600",
    btnBgClass: "bg-purple-600 hover:bg-purple-700",
    badgeActive: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    hoverGlow: "hover:shadow-purple-500/10 border-purple-500",
  },
  ultimate: {
    borderActive: "border-amber-500 ring-4 ring-amber-500/5",
    bgActive: "bg-amber-50/30 dark:bg-amber-950/[0.02]",
    iconBgActive: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    accentBar: "bg-amber-500",
    labelColor: "text-amber-550",
    btnBgClass: "bg-amber-500 hover:bg-amber-650",
    badgeActive: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    hoverGlow: "hover:shadow-amber-500/10 border-amber-500",
  },
};

export default function SubscriptionPlansList() {
  const [initialPlans, setInitialPlans] = useState<PlanConfig[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string>("free");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/admin/configurations/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
        setInitialPlans(data);
      }
    } catch (e) {
      toast.error("Failed to fetch subscription plans");
    } finally {
      setIsLoading(false);
    }
  };

  const currentPlan = plans.find((p) => p.slug === expandedPlan);
  const currentInitialPlan = initialPlans.find((p) => p.slug === expandedPlan);

  const hasChanges = JSON.stringify(currentPlan) !== JSON.stringify(currentInitialPlan);

  // Warn before unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleSave = async () => {
    if (!currentPlan || !hasChanges) return;

    setIsSaving(true);
    const toastId = toast.loading(`Saving ${currentPlan.name}...`);

    try {
      const payload = {
        id: currentPlan.id,
        name: currentPlan.name,
        isEnabled: currentPlan.isEnabled,
        monthlyPrice: parseFloat(String(currentPlan.monthlyPrice)) || 0,
        quarterlyPrice: parseFloat(String(currentPlan.quarterlyPrice)) || 0,
        yearlyPrice: parseFloat(String(currentPlan.yearlyPrice)) || 0,
        maxContacts: parseInt(String(currentPlan.maxContacts)) || 0,
        maxBotFlows: parseInt(String(currentPlan.maxBotFlows)) || 0,
        maxCampaigns: parseInt(String(currentPlan.maxCampaigns)) || 0,
        maxTeamMembers: parseInt(String(currentPlan.maxTeamMembers)) || 0,
        maxBotReplies: parseInt(String(currentPlan.maxBotReplies)) || 0,
        aiChatBotEnabled: Boolean(currentPlan.aiChatBotEnabled),
        apiWebhookAccess: Boolean(currentPlan.apiWebhookAccess),
        modulesAccess: currentPlan.modulesAccess || {},
      };

      const res = await fetch(`/api/admin/configurations/plans?slug=${expandedPlan}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json().catch(() => null);
        const affectedOrganizations = Number(result?.affectedOrganizations ?? 0);
        const updatedAt = Date.now().toString();

        localStorage.setItem(PLAN_CONFIG_UPDATED_STORAGE_KEY, updatedAt);
        window.dispatchEvent(new CustomEvent(PLAN_CONFIG_UPDATED_EVENT, {
          detail: { slug: expandedPlan, updatedAt, affectedOrganizations },
        }));

        toast.success(
          affectedOrganizations > 0
            ? `${currentPlan.name} updated and synced to ${affectedOrganizations} account${affectedOrganizations === 1 ? "" : "s"}!`
            : `${currentPlan.name} updated successfully!`,
          { id: toastId }
        );
        setInitialPlans((prev) =>
          prev.map((p) => (p.slug === expandedPlan ? { ...currentPlan } : p))
        );
      } else {
        toast.error("Failed to update plan properties", { id: toastId });
      }
    } catch (error) {
      toast.error("An error occurred while saving", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (currentInitialPlan) {
      setPlans((prev) =>
        prev.map((p) => (p.slug === expandedPlan ? { ...currentInitialPlan } : p))
      );
      toast("Changes discarded");
    }
  };

  const updateField = (field: keyof PlanConfig, value: any) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.slug === expandedPlan) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  if (isLoading || !currentPlan) {
    return <WatiBotLoader fullScreen={false} />;
  }

  const theme = PLAN_THEMES[expandedPlan] || PLAN_THEMES.free;

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-20 plus-jakarta-forced max-w-[1300px]">
      
      {/* Left Sidebar: Plan List */}
      <div className="w-full lg:w-80 shrink-0 space-y-3">
        {plans.map((plan) => {
          const ptTheme = PLAN_THEMES[plan.slug] || PLAN_THEMES.free;
          const isSelected = expandedPlan === plan.slug;
          const isInactive = !plan.isEnabled;

          return (
            <button
              key={plan.slug}
              onClick={() => {
                if (hasChanges && expandedPlan !== plan.slug) {
                  const confirmChange = window.confirm(
                    "You have unsaved changes. Are you sure you want to switch plans?"
                  );
                  if (!confirmChange) return;
                  handleReset();
                }
                setExpandedPlan(plan.slug);
              }}
              className={cn(
                "w-full text-left p-4 rounded-[20px] transition-all duration-200 border flex flex-col gap-4",
                isSelected
                  ? `bg-white dark:bg-slate-900 shadow-md ${ptTheme.borderActive}`
                  : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700",
                isInactive && !isSelected && "opacity-60 grayscale-[0.5]"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isSelected ? ptTheme.iconBgActive : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}
                  >
                    <Zap size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {plan.name}
                    </h3>
                  </div>
                </div>
                <Badge
                  variant={plan.isEnabled ? "success" : "secondary"}
                  className={cn(
                    "text-[9px] px-2 py-0.5 rounded-lg font-bold border-none uppercase tracking-wider",
                    plan.isEnabled
                      ? isSelected
                        ? ptTheme.badgeActive
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  {plan.isEnabled ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Monthly
                  </span>
                  <div className="flex items-end mt-1">
                    <span className="text-base font-black text-slate-900 dark:text-white leading-none">
                      ${plan.monthlyPrice}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Yearly
                  </span>
                  <div className="flex items-end mt-1">
                    <span className="text-base font-black text-slate-900 dark:text-white leading-none">
                      ${plan.yearlyPrice}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between w-full">
                <div className="flex -space-x-1">
                  {[Database, MessageSquare, Users].map((Icon, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500",
                        isSelected && ptTheme.iconBgActive
                      )}
                    >
                      <Icon size={10} />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {plan.maxTeamMembers} Members
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Content: Settings Panel */}
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Top accent bar */}
          <div className={cn("h-1 w-full", theme.accentBar)} />

          {/* Sticky Header */}
          <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between p-5 px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner", theme.iconBgActive)}>
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{currentPlan.name} Settings</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: hasChanges ? "#f59e0b" : "#10b981" }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {hasChanges ? "Unsaved Changes" : "All Changes Saved"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-2" />
                  Discard
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={cn(
                  "rounded-xl h-10 px-6 text-xs font-bold shadow-sm transition-all",
                  hasChanges && !isSaving
                    ? "bg-[#00a884] text-white hover:bg-[#00946f]"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                )}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Plan Changes
              </Button>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Left Column: Identity & Limits */}
              <div className="space-y-10">
                {/* Plan Identity */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-6 rounded-full", theme.accentBar)} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Plan Details
                    </h2>
                  </div>

                  <div className="space-y-5 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                        Plan Name
                      </Label>
                      <input
                        type="text"
                        value={currentPlan.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex flex-col space-y-1">
                        <Label className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                          Active Status
                        </Label>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Allow customers to subscribe to this plan
                        </span>
                      </div>
                      <Switch
                        checked={currentPlan.isEnabled}
                        onCheckedChange={(v) => updateField("isEnabled", v)}
                      />
                    </div>
                  </div>
                </div>

                {/* Usage Limits */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-6 rounded-full", theme.accentBar)} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Usage Limits
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        label: "Max Contacts",
                        subtitle: "Total contacts allowed in the system (-1 for unlimited)",
                        field: "maxContacts" as keyof PlanConfig,
                        icon: Users,
                      },
                      {
                        label: "Max Bot Flows",
                        subtitle: "Number of automation flows allowed (-1 for unlimited)",
                        field: "maxBotFlows" as keyof PlanConfig,
                        icon: Activity,
                      },
                      {
                        label: "Max Campaigns",
                        subtitle: "Number of message campaigns allowed (-1 for unlimited)",
                        field: "maxCampaigns" as keyof PlanConfig,
                        icon: Zap,
                      },
                      {
                        label: "Team Members",
                        subtitle: "Number of staff members who can use the system (-1 for unlimited)",
                        field: "maxTeamMembers" as keyof PlanConfig,
                        icon: Users,
                      },
                      {
                        label: "Max Messages / Broadcasts",
                        subtitle: "Outbound messages and broadcast limit (-1 for unlimited)",
                        field: "maxBotReplies" as keyof PlanConfig,
                        icon: MessageSquare,
                      },
                    ].map((limit) => (
                      <div
                        key={limit.field}
                        className="flex items-center justify-between p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[20px] transition-all hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 shrink-0">
                            <limit.icon size={18} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-sm font-bold text-slate-900 dark:text-white block leading-none">
                              {limit.label}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                              {limit.subtitle}
                            </span>
                          </div>
                        </div>
                        <div className="relative shrink-0 ml-4">
                          <input
                            type="number"
                            value={typeof currentPlan[limit.field] === 'number' ? (currentPlan[limit.field] as number) : 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateField(limit.field, val === "" ? 0 : parseInt(val));
                            }}
                            className="w-24 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Pricing & Features */}
              <div className="space-y-10">
                {/* Pricing */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-6 rounded-full", theme.accentBar)} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Pricing
                    </h2>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 space-y-5">
                    {[
                      { label: "Monthly Price", subtitle: "Amount charged every month", field: "monthlyPrice" as keyof PlanConfig },
                      { label: "Quarterly Price", subtitle: "Amount charged every 3 months", field: "quarterlyPrice" as keyof PlanConfig },
                      { label: "Yearly Price", subtitle: "Amount charged every year", field: "yearlyPrice" as keyof PlanConfig },
                    ].map((price) => (
                      <div key={price.field} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                            {price.label}
                          </Label>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            {price.subtitle}
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 flex items-center text-slate-400 font-bold text-sm pointer-events-none">
                            <DollarSign size={16} />
                          </div>
                          <input
                            type="text"
                            value={String(currentPlan[price.field] ?? "")}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              updateField(price.field, val ? parseInt(val) : 0);
                            }}
                            className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Included Features */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-6 rounded-full", theme.accentBar)} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Included Features
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        label: "AI Automatic Replies",
                        subtitle: "Let the AI talk to customers automatically",
                        field: "aiChatBotEnabled" as keyof PlanConfig,
                      },
                      {
                        label: "API & Webhook Access",
                        subtitle: "Access to developer APIs and Webhooks",
                        field: "apiWebhookAccess" as keyof PlanConfig,
                      },
                    ].map((feat) => (
                      <div
                        key={feat.field}
                        className="flex items-center justify-between p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[20px] transition-all hover:border-slate-300 dark:hover:border-slate-700"
                      >
                        <div className="flex flex-col space-y-1">
                          <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                            {feat.label}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {feat.subtitle}
                          </span>
                        </div>
                        <Switch
                          checked={Boolean(currentPlan[feat.field])}
                          onCheckedChange={(v) => updateField(feat.field, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Module Access Settings */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-6 rounded-full", theme.accentBar)} />
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Module Access Permissions
                    </h2>
                  </div>
                  
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 space-y-4">
                    <p className="text-xs text-slate-500 mb-4 font-medium">Turn off a module to completely hide it from the vendor dashboard.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { key: "dashboard", label: "Dashboard" },
                        { key: "chat", label: "Live Chat & History" },
                        { key: "contacts", label: "Contacts" },
                        { key: "audience", label: "Audience" },
                        { key: "templates", label: "Message Templates" },
                        { key: "quick_replies", label: "Quick Replies" },
                        { key: "quick_message", label: "Quick Messages" },
                        { key: "drip_campaign", label: "Drip Campaigns" },
                        { key: "flow", label: "Automation Flows" },
                        { key: "knowledge_base", label: "Knowledge Base" },
                        { key: "ad_manager", label: "Ads Manager" },
                        { key: "facebook_posts", label: "Facebook Posts" },
                        { key: "instagram_posts", label: "Instagram Posts" },
                        { key: "reports", label: "Reports" },
                        { key: "agents", label: "Agents Management" },
                        { key: "permissions", label: "Permissions Management" },
                        { key: "tags", label: "Tags Management" },
                        { key: "notifications", label: "Notification Preferences" },
                        { key: "settings", label: "Settings" },
                        { key: "integrations", label: "Integrations & Webhooks" },
                        { key: "quota", label: "Quota" },
                        { key: "developer", label: "Developer Menu" },
                        { key: "projects", label: "All Projects" }
                      ].map((mod) => {
                        const isEnabled = currentPlan.modulesAccess ? currentPlan.modulesAccess[mod.key] !== false : true;
                        
                        return (
                          <div key={mod.key} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl transition-all hover:border-slate-300 dark:hover:border-slate-700">
                            <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {mod.label}
                            </span>
                            <div className="shrink-0">
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(v) => {
                                  const newModules = { ...(currentPlan.modulesAccess || {}) };
                                  newModules[mod.key] = v;
                                  updateField("modulesAccess", newModules);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
