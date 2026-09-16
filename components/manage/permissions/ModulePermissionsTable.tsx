"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Eye,
  Edit3,
  Ban,
  Lock,
  Unlock,
  CheckCheck,
  LayoutDashboard,
  MessageSquare,
  Users,
  Facebook,
  Instagram,
  Zap,
  FileText,
  FolderOpen,
  Megaphone,
  BarChart3,
  GitBranch,
  MessageSquarePlus,
  Database,
  Tag,
  Bell,
  Puzzle,
  Code2,
  Focus,
  Target,
  Calendar,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AccessLevel = "full" | "view" | "edit" | "delete" | "none" | "custom";

export interface PermissionModule {
  name: string;
  key: string;
  icon: LucideIcon;
  description: string;
  group: "Core" | "CRM" | "Messaging" | "Automation" | "Marketing" | "Administration";
  defaultAccess: Record<string, AccessLevel>;
}

export const MODULE_DEFINITIONS: PermissionModule[] = [
  // 1. CORE
  {
    name: "Dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    description: "Overview of workspace health, messaging velocity, and key operational metrics.",
    group: "Core",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "view", "custom-role": "view" },
  },
  {
    name: "Live Chat",
    key: "chat",
    icon: MessageSquare,
    description: "Real-time customer conversation console, 1-on-1 messaging, and agent responses.",
    group: "Core",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "full", viewer: "view", "custom-role": "view" },
  },
  {
    name: "View All Chats",
    key: "view_all_chats",
    icon: ShieldCheck,
    description: "Access cross-agent and unassigned conversations across the organization.",
    group: "Core",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },

  // 2. CRM
  {
    name: "Contacts",
    key: "contacts",
    icon: Users,
    description: "Directory of customer phone numbers, custom attributes, and profile histories.",
    group: "CRM",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "view", "custom-role": "view" },
  },
  {
    name: "Audience",
    key: "audience",
    icon: Users,
    description: "Segmentation groups, dynamic contact lists, and filtered campaign targets.",
    group: "CRM",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "view", "custom-role": "view" },
  },
  {
    name: "Tags",
    key: "tags",
    icon: Tag,
    description: "Lead categorization tags, lifecycle labels, and automated assignment tags.",
    group: "CRM",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },

  // 3. MESSAGING
  {
    name: "Quick Replies",
    key: "quick_replies",
    icon: Zap,
    description: "Canned response shortcuts and quick snippets for instant live-chat replies.",
    group: "Messaging",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Templates",
    key: "templates",
    icon: FileText,
    description: "WhatsApp official HSM message templates, submission, and approval statuses.",
    group: "Messaging",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Media Library",
    key: "media_library",
    icon: FolderOpen,
    description: "Media repository, document storage, and asset management for campaigns and chats.",
    group: "Messaging",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Quick Message",
    key: "quick_message",
    icon: MessageSquarePlus,
    description: "Direct ad-hoc message broadcasts to single contacts or phone numbers.",
    group: "Messaging",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "none", "custom-role": "none" },
  },

  // 4. AUTOMATION
  {
    name: "Flow Builder",
    key: "flow",
    icon: GitBranch,
    description: "Visual drag-and-drop interactive chatbot workflows and logic nodes.",
    group: "Automation",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Knowledge Base",
    key: "knowledge_base",
    icon: Database,
    description: "AI RAG knowledge embeddings, company documents, and FAQ training sources.",
    group: "Automation",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Message Scheduler",
    key: "scheduler",
    icon: Calendar,
    description: "Scheduled recurring broadcasts, timed reminders, and delayed queues.",
    group: "Automation",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "none", "custom-role": "none" },
  },

  // 5. MARKETING
  {
    name: "Drip Campaign",
    key: "drip_campaign",
    icon: Megaphone,
    description: "Sequential automated nurturing funnels triggered by customer actions.",
    group: "Marketing",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "AD Campaign",
    key: "ad_campaign",
    icon: Megaphone,
    description: "Meta sponsored click-to-WhatsApp promotional advertising campaigns.",
    group: "Marketing",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Ad Manager",
    key: "ad_manager",
    icon: BarChart3,
    description: "Ad spend performance analytics, ROI tracking, and budget management.",
    group: "Marketing",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Facebook Posts",
    key: "facebook_posts",
    icon: Facebook,
    description: "Social media comments ingestion, Facebook page engagement, and routing.",
    group: "Marketing",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "view", "custom-role": "view" },
  },
  {
    name: "Instagram Posts",
    key: "instagram_posts",
    icon: Instagram,
    description: "Instagram Direct message management, story reply automation, and comments.",
    group: "Marketing",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "view", viewer: "view", "custom-role": "view" },
  },
  {
    name: "Leads Report",
    key: "leads_report",
    icon: Target,
    description: "Acquisition analytics, conversion attribution funnels, and customer journeys.",
    group: "Marketing",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "view", "custom-role": "none" },
  },

  // 6. ADMINISTRATION
  {
    name: "Agents",
    key: "agents",
    icon: Users,
    description: "Team member invites, agent seats, availability statuses, and management.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "view", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Permissions",
    key: "permissions",
    icon: ShieldCheck,
    description: "Role-based access matrix, granular privileges, and chat assignment rules.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "none", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Reports",
    key: "reports",
    icon: BarChart3,
    description: "Workspace analytics, agent response times, and message delivery reports.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "none", viewer: "view", "custom-role": "view" },
  },
  {
    name: "Notifications",
    key: "notifications",
    icon: Bell,
    description: "Alert preferences, browser notifications, sound triggers, and webhooks.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "full", agent: "full", viewer: "view", "custom-role": "full" },
  },
  {
    name: "Settings",
    key: "settings",
    icon: Settings,
    description: "Organization settings, WhatsApp Business API credentials, and profiles.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "none", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Integrations",
    key: "integrations",
    icon: Puzzle,
    description: "Shopify, WooCommerce, TikTok, Stripe, and third-party SaaS connectors.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "none", agent: "none", viewer: "none", "custom-role": "none" },
  },
  {
    name: "Quota & Billing",
    key: "quota",
    icon: Database,
    description: "Message credit balance, monthly tier limits, and subscription management.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "view", agent: "none", viewer: "view", "custom-role": "none" },
  },
  {
    name: "Developer API",
    key: "developer",
    icon: Code2,
    description: "REST API keys, inbound webhooks, payload logging, and documentation.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "none", agent: "none", viewer: "none", "custom-role": "custom" },
  },
  {
    name: "All Projects",
    key: "projects",
    icon: Focus,
    description: "Multi-tenant workspace switcher and cross-organization project routing.",
    group: "Administration",
    defaultAccess: { "super-admin": "full", admin: "full", manager: "none", agent: "none", viewer: "none", "custom-role": "none" },
  },
];

const GROUP_ORDER: Array<"Core" | "CRM" | "Messaging" | "Automation" | "Marketing" | "Administration"> = [
  "Core",
  "CRM",
  "Messaging",
  "Automation",
  "Marketing",
  "Administration",
];

const ACCESS_CONFIG: Record<
  AccessLevel,
  { label: string; shortLabel: string; dotColor: string; badgeClass: string; icon: typeof ShieldCheck }
> = {
  full: {
    label: "Full Access (View, Edit, Delete)",
    shortLabel: "Full Access",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    icon: ShieldCheck,
  },
  edit: {
    label: "Edit Access (View, Edit)",
    shortLabel: "Edit Access",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    icon: Edit3,
  },
  view: {
    label: "View Only (Read Only)",
    shortLabel: "View Only",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    icon: Eye,
  },
  none: {
    label: "No Access (Hidden)",
    shortLabel: "No Access",
    dotColor: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    icon: Ban,
  },
  delete: {
    label: "Delete Access",
    shortLabel: "Delete Access",
    dotColor: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    icon: Ban,
  },
  custom: {
    label: "Custom Access",
    shortLabel: "Custom",
    dotColor: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
    icon: ShieldCheck,
  },
};

interface ModulePermissionsTableProps {
  permissions: Record<string, AccessLevel>;
  selectedRoleId: string;
  onChangePermission: (moduleKey: string, newAccess: AccessLevel) => void;
  onBatchSetPermissions?: (level: AccessLevel) => void;
  isRtl?: boolean;
}

export default function ModulePermissionsTable({
  permissions,
  selectedRoleId,
  onChangePermission,
  onBatchSetPermissions,
  isRtl = false,
}: ModulePermissionsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccess, setFilterAccess] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const filteredModules = useMemo(() => {
    return MODULE_DEFINITIONS.filter((mod) => {
      const defaultAccess = mod.defaultAccess[selectedRoleId] || "none";
      const currentAccess = permissions[mod.key] || defaultAccess;

      // Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = mod.name.toLowerCase().includes(q);
        const matchesDesc = mod.description.toLowerCase().includes(q);
        const matchesGroup = mod.group.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesGroup) return false;
      }

      // Filter by Access Level Pill
      if (filterAccess !== "all") {
        if (filterAccess === "full" && currentAccess !== "full") return false;
        if (filterAccess === "edit" && currentAccess !== "edit") return false;
        if (filterAccess === "view" && currentAccess !== "view") return false;
        if (filterAccess === "none" && currentAccess !== "none") return false;
      }

      return true;
    });
  }, [searchQuery, filterAccess, permissions, selectedRoleId]);

  const groupedModules = useMemo(() => {
    const map = new Map<string, PermissionModule[]>();
    GROUP_ORDER.forEach((g) => map.set(g, []));

    filteredModules.forEach((mod) => {
      const list = map.get(mod.group) || [];
      list.push(mod);
      map.set(mod.group, list);
    });

    return GROUP_ORDER.map((g) => ({
      groupName: g,
      modules: map.get(g) || [],
    })).filter((group) => group.modules.length > 0);
  }, [filteredModules]);

  return (
    <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden text-start space-y-0">
      {/* SECTION HEADER WITH SEARCH & FILTERS */}
      <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Module Permissions Matrix
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {filteredModules.length} Modules
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Control exactly what this user is authorized to view, create, edit, or delete within each module.
            </p>
          </div>

          {/* Batch Quick Action Shortcuts */}
          {onBatchSetPermissions && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onBatchSetPermissions("full")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100/60 transition-colors cursor-pointer"
                title="Grant full access to all modules"
              >
                <Unlock className="w-3 h-3 text-[#00B074]" />
                Grant All Full
              </button>
              <button
                type="button"
                onClick={() => onBatchSetPermissions("none")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Revoke access to all modules"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                Revoke All
              </button>
            </div>
          )}
        </div>

        {/* SEARCH BAR & ACCESS FILTER PILLS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search modules or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: "all", label: "All" },
              { key: "full", label: "Full Access", dot: "bg-emerald-500" },
              { key: "edit", label: "Edit Access", dot: "bg-amber-500" },
              { key: "view", label: "View Only", dot: "bg-blue-500" },
              { key: "none", label: "No Access", dot: "bg-rose-500" },
            ].map((pill) => {
              const isActive = filterAccess === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilterAccess(pill.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer",
                    isActive
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {pill.dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pill.dot)} />}
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODULE GROUPS & PERMISSION ROWS */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {groupedModules.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Filter className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-bold">No modules match your search or filter</p>
          </div>
        ) : (
          groupedModules.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.groupName]);

            return (
              <div key={group.groupName} className="space-y-0">
                {/* Group Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.groupName)}
                  className="w-full px-6 py-3 bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-900 flex items-center justify-between transition-colors text-start cursor-pointer border-b border-slate-100 dark:border-slate-800/60"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {group.groupName}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.2 rounded-full border border-slate-200 dark:border-slate-700">
                      {group.modules.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {isCollapsed ? "Click to expand" : "Click to collapse"}
                  </span>
                </button>

                {/* Group Module Rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {group.modules.map((module) => {
                      const ModIcon = module.icon;
                      const defaultAccess = module.defaultAccess[selectedRoleId] || "none";
                      const currentAccess = (permissions[module.key] as AccessLevel) || defaultAccess;
                      const cfg = ACCESS_CONFIG[currentAccess] || ACCESS_CONFIG.none;

                      return (
                        <div
                          key={module.key}
                          className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors"
                        >
                          {/* Module Name & Description */}
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60 mt-0.5">
                              <ModIcon className="w-4.5 h-4.5" />
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                  {module.name}
                                </h4>
                                <span className={cn("hidden md:inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[9px] font-extrabold uppercase border", cfg.badgeClass)}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dotColor)} />
                                  {cfg.shortLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-tight">
                                {module.description}
                              </p>
                            </div>
                          </div>

                          {/* Permission Dropdown Selector */}
                          <div className="shrink-0 self-end sm:self-center w-full sm:w-auto">
                            <Select
                              value={currentAccess}
                              onValueChange={(val) => onChangePermission(module.key, val as AccessLevel)}
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-8 sm:w-44 border rounded-lg text-xs font-bold shadow-xs px-2.5 transition-all",
                                  cfg.badgeClass
                                )}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dotColor)} />
                                  <span className="truncate">{cfg.shortLabel}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 rounded-xl shadow-xl">
                                <SelectItem value="full" className="text-xs font-bold py-2 text-emerald-700 dark:text-emerald-400">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>Full Access (View, Edit, Delete)</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="edit" className="text-xs font-bold py-2 text-amber-700 dark:text-amber-400">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span>Edit Access (View, Edit)</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="view" className="text-xs font-bold py-2 text-blue-700 dark:text-blue-400">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>View Only (Read Only)</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="none" className="text-xs font-bold py-2 text-rose-700 dark:text-rose-400">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                    <span>No Access (Hidden)</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
