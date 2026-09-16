"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
  X,
  RotateCcw,
  Search,
  Lock,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Zap,
  MessageSquarePlus,
  Megaphone,
  GitBranch,
  Database,
  ShoppingBag,
  BarChart3,
  Facebook,
  Instagram,
  LayoutGrid,
  Headphones,
  Tag,
  Bell,
  Settings,
  Puzzle,
  Code2,
  Focus,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getVendorPermissions, updateVendorPermissions } from "@/app/[locale]/admin/vendors/actions";

export interface SidebarModuleDefinition {
  key: string;
  label: string;
  category: "Overview" | "Conversations" | "CRM" | "Messaging" | "Automation" | "Commerce" | "Social Media" | "Management" | "Settings";
  icon: any;
  description: string;
}

export const SIDEBAR_MODULES_LIST: SidebarModuleDefinition[] = [
  { key: "dashboard", label: "Dashboard Overview", category: "Overview", icon: LayoutDashboard, description: "Main platform stats and welcome dashboard" },
  { key: "chat", label: "Live Chat & Inbox", category: "Conversations", icon: MessageSquare, description: "Real-time chat inbox and history" },
  { key: "contacts", label: "Contacts & Pipeline", category: "CRM", icon: Users, description: "Customer contact list and CRM pipeline" },
  { key: "audience", label: "Audience Segments", category: "CRM", icon: Users, description: "Customer segments and audience groups" },
  { key: "templates", label: "Message Templates", category: "Messaging", icon: FileText, description: "WhatsApp HSM message templates" },
  { key: "quick_replies", label: "Quick Replies", category: "Messaging", icon: Zap, description: "Canned response shortcuts for live chat" },
  { key: "quick_message", label: "Quick / Welcome Messages", category: "Messaging", icon: MessageSquarePlus, description: "Automated welcome and instant messages" },
  { key: "drip_campaign", label: "Bulk Broadcasting", category: "Messaging", icon: Megaphone, description: "Mass marketing campaigns and broadcasts" },
  { key: "flow", label: "Automation Flows", category: "Automation", icon: GitBranch, description: "Visual drag-and-drop chatbot builder" },
  { key: "knowledge_base", label: "Knowledge Base AI", category: "Automation", icon: Database, description: "AI chatbot training data & documentation" },
  { key: "ad_manager", label: "Ad Manager", category: "Commerce", icon: BarChart3, description: "Click-to-WhatsApp ad creation & management" },
  { key: "facebook_posts", label: "Facebook Posts", category: "Social Media", icon: Facebook, description: "Facebook page posts and auto-comment replies" },
  { key: "instagram_posts", label: "Instagram Posts", category: "Social Media", icon: Instagram, description: "Instagram post management and auto-replies" },
  { key: "reports", label: "Reports & Analytics", category: "Management", icon: LayoutGrid, description: "System reports and performance analytics" },
  { key: "agents", label: "Agents Management", category: "Management", icon: Headphones, description: "Team members and support agent access" },
  { key: "permissions", label: "Role Permissions", category: "Management", icon: ShieldCheck, description: "Role-based access control rules" },
  { key: "tags", label: "Tags Management", category: "Management", icon: Tag, description: "Contact tagging and labels" },
  { key: "notifications", label: "Notification Preferences", category: "Management", icon: Bell, description: "System notification & alert preferences" },
  { key: "settings", label: "Account Settings", category: "Settings", icon: Settings, description: "Organization settings and business profile" },
  { key: "integrations", label: "Integrations & Webhooks", category: "Settings", icon: Puzzle, description: "Shopify, CRM, and custom Webhooks" },
  { key: "developer", label: "Developer API Keys", category: "Settings", icon: Code2, description: "API keys and developer documentation" },
  { key: "projects", label: "All Projects", category: "Settings", icon: Focus, description: "Project workspace switcher" },
];

interface ManageVendorPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: {
    id: string;
    title: string;
    vendorConfig?: any;
  } | null;
  onSuccess?: () => void;
}

export default function ManageVendorPermissionsModal({
  isOpen,
  onClose,
  vendor,
  onSuccess,
}: ManageVendorPermissionsModalProps) {
  const [modulesAccess, setModulesAccess] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    if (!isOpen || !vendor?.id) return;

    let isMounted = true;
    setIsLoading(true);

    const loadPermissions = async () => {
      try {
        const res = await getVendorPermissions(vendor.id);
        if (res.success && res.modulesAccess) {
          const initialAccess: Record<string, boolean> = {};
          SIDEBAR_MODULES_LIST.forEach((mod) => {
            initialAccess[mod.key] = res.modulesAccess[mod.key] !== false;
          });
          if (isMounted) setModulesAccess(initialAccess);
        } else {
          // Default all to true if missing
          const defaultAccess: Record<string, boolean> = {};
          const existing = vendor.vendorConfig?.modulesAccess || {};
          SIDEBAR_MODULES_LIST.forEach((mod) => {
            defaultAccess[mod.key] = existing[mod.key] !== false;
          });
          if (isMounted) setModulesAccess(defaultAccess);
        }
      } catch (err) {
        toast.error("Failed to fetch vendor permissions");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, vendor]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add("All");
    SIDEBAR_MODULES_LIST.forEach((mod) => set.add(mod.category));
    return Array.from(set);
  }, []);

  const filteredModules = useMemo(() => {
    return SIDEBAR_MODULES_LIST.filter((mod) => {
      const matchesSearch =
        mod.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.key.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || mod.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const allowedCount = useMemo(() => {
    return Object.values(modulesAccess).filter((v) => v !== false).length;
  }, [modulesAccess]);

  const restrictedCount = useMemo(() => {
    return SIDEBAR_MODULES_LIST.length - allowedCount;
  }, [allowedCount]);

  const handleToggle = (key: string, enabled: boolean) => {
    setModulesAccess((prev) => ({
      ...prev,
      [key]: enabled,
    }));
  };

  const handleSelectAll = () => {
    const updated: Record<string, boolean> = { ...modulesAccess };
    SIDEBAR_MODULES_LIST.forEach((mod) => {
      updated[mod.key] = true;
    });
    setModulesAccess(updated);
    toast.info("All sidebar pages enabled");
  };

  const handleClearAll = () => {
    const updated: Record<string, boolean> = { ...modulesAccess };
    SIDEBAR_MODULES_LIST.forEach((mod) => {
      // Keep dashboard enabled as sensible fallback
      updated[mod.key] = mod.key === "dashboard";
    });
    setModulesAccess(updated);
    toast.warning("All sidebar pages disabled (Dashboard remains enabled)");
  };

  const handleSave = async () => {
    if (!vendor?.id) return;
    setIsSaving(true);

    try {
      const res = await updateVendorPermissions(vendor.id, modulesAccess);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Page permissions saved for ${vendor.title}`);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch {
      toast.error("Failed to save vendor permissions");
    } finally {
      setIsSaving(false);
    }
  };

  if (!vendor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[780px] p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#00a884]/10 dark:bg-[#00a884]/20 border border-[#00a884]/20 flex items-center justify-center text-[#00a884]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                  Manage Sidebar Permissions
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Vendor: <span className="text-slate-800 dark:text-slate-200 font-extrabold">{vendor.title}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider border-none px-2.5 py-1">
                {allowedCount} Allowed
              </Badge>
              {restrictedCount > 0 && (
                <Badge className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-[10px] uppercase tracking-wider border-none px-2.5 py-1">
                  {restrictedCount} Restricted
                </Badge>
              )}
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search sidebar pages (e.g. Campaigns, Live Chat)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-10 text-[11px] font-extrabold rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Select All
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-10 text-[11px] font-extrabold rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear All
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all whitespace-nowrap",
                  selectedCategory === cat
                    ? "bg-[#00a884] text-white shadow-xs"
                    : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Modules List Container */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[320px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[280px] gap-3">
              <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading vendor page permissions...</p>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[260px] text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching sidebar pages found.</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing your search query or switching categories.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredModules.map((mod) => {
                const Icon = mod.icon;
                const isEnabled = modulesAccess[mod.key] !== false;

                return (
                  <div
                    key={mod.key}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 group",
                      isEnabled
                        ? "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                        : "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/60 dark:border-rose-900/30"
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          isEnabled
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:bg-[#00a884]/10 group-hover:text-[#00a884]"
                            : "bg-rose-100 dark:bg-rose-950/40 text-rose-500"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">
                            {mod.label}
                          </h4>
                          <span
                            className={cn(
                              "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0",
                              isEnabled
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                            )}
                          >
                            {isEnabled ? "Visible" : "Restricted"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggle(mod.key, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-4 shrink-0">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
            Restricted pages will be hidden from the sidebar and blocked on direct URL access.
          </p>

          <div className="flex items-center gap-3 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 px-5 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="h-11 px-6 rounded-xl font-bold text-xs bg-[#00a884] hover:bg-[#00946f] text-white shadow-md flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {isSaving ? "Saving Permissions..." : "Save Permissions"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
