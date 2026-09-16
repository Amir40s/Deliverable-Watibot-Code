"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import ManageLayout from "@/components/layouts/ManageLayout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { InviteAgentModal } from "@/components/dashboard/InviteAgentModal"
import { CreateDepartmentModal } from "@/components/dashboard/CreateDepartmentModal"
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAgents,
  deleteAgent,
  updateAgent
} from "@/app/actions/agents"
import { impersonateAgent } from "@/app/actions/impersonate"
import { getQuotaStatus } from "@/app/actions/quota"
import { toast } from "sonner"
import { useSession, signIn } from "next-auth/react"
import WatiBotLoader from "@/components/WatiBotLoader"
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Plus,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Award,
  ChevronLeft,
  ChevronRight,
  Laptop,
  ChevronUp,
  LogIn,
  Loader2,
  Sliders
} from "lucide-react"

// Types matching database schema and mocks
interface Department {
  id: string;
  name: string;
  _count?: {
    users: number;
  };
}

interface AgentDeviceSetting {
  deviceName?: string | null;
  lastActiveAt?: string | Date | null;
}

interface Agent {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, unknown>;
  department?: Department | null;
  isMock?: boolean;
  phoneNumber?: string | null;
  createdAt?: string | Date;
  lastLoginAt?: string | Date | null;
  deviceSettings?: AgentDeviceSetting[];
}

interface CombinedAgent {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, unknown>;
  department?: Department | null;
  isMock?: boolean;
  phone?: string;
  joinedDate?: string;
  lastLogin?: string;
  loginIP?: string;
  twoFactor?: boolean;
  browser?: string;
  departmentName?: string;
  phoneNumber?: string | null;
  createdAt?: string | Date;
  lastLoginAt?: string | Date | null;
  deviceSettings?: AgentDeviceSetting[];
}

type AgentTab = "All Users" | "Admins" | "Agents" | "Viewers" | "Deactivated"
type DetailTab = "Overview" | "Permissions" | "Teams" | "Activity Log" | "Devices" | "Security"

export default function AgentsPage() {
  const t = useTranslations("agents")
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"
  const userPerms = (session?.user?.permissions ?? {}) as Record<string, unknown>
  const canInvite = isAdmin || userPerms.user_invite === true || userPerms.user_super === true
  const canEdit = isAdmin || userPerms.user_edit === true || userPerms.user_super === true
  const canDelete = isAdmin || userPerms.user_delete === true || userPerms.user_super === true

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false)

  // Custom directory visual toggle: "directory" (Unified users), "departments" (Custom units) or "assignment-rules"
  const [view, setView] = useState<"directory" | "departments" | "assignment-rules">("directory")
  const [departments, setDepartments] = useState<Department[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Primary filtering and master-detail states
  const [activeTab, setActiveTab] = useState<AgentTab>("All Users")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDirectoryFiltersOpen, setIsDirectoryFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [departmentFilter, setDepartmentFilter] = useState("ALL")
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Detail panel inner tabs: Overview, Permissions, Teams, Activity Log, Devices, Security
  const [detailTab, setDetailTab] = useState<DetailTab>("Overview")

  // Editing states
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [editingDept, setEditingDept] = useState<Department | null>(null)

  const [isImpersonating, setIsImpersonating] = useState<string | null>(null)
  const [teamQuota, setTeamQuota] = useState<{ allowed: boolean; limit: number; current: number } | null>(null)
  const isTeamLimitReached = teamQuota ? !teamQuota.allowed : false

  const handleImpersonate = async (agentId: string) => {
    setIsImpersonating(agentId)
    try {
      const result = await impersonateAgent(agentId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.success && result.email && result.token) {
        toast.loading(t?.("signingInAsAgent") || "Signing in as agent...")
        await signIn("credentials", {
          email: result.email,
          impersonationToken: result.token,
          originalAdminId: session?.user?.id || "",
          originalAdminEmail: session?.user?.email || "",
          callbackUrl: "/en/dashboard",
          redirect: true,
        })
      }
    } catch {
      toast.error("Failed to sign in as agent")
    } finally {
      setIsImpersonating(null)
    }
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [depts, agentList, quota] = await Promise.all([
        getDepartments(),
        getAgents(),
        getQuotaStatus('maxTeamMembers')
      ])
      setDepartments(depts as Department[])
      setAgents(agentList as Agent[])
      setTeamQuota(quota)
    } catch (err) {
      console.error("Failed to fetch team data", err)
      toast.error(t("toastLoadFailed"))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Combined real agents from the database
  const allCombinedAgents = useMemo<CombinedAgent[]>(() => {
    // Map DB agents to matching schema keys
    const mappedDbAgents: CombinedAgent[] = agents.map(a => ({
      ...a,
      role: a.role === "USER" ? "AGENT" : a.role,
      isMock: false,
      permissions: a.permissions || {}
    }));

    return mappedDbAgents;
  }, [agents]);

  // Set default selected agent when combined agents load
  useEffect(() => {
    if (allCombinedAgents.length > 0) {
      // Find the first visible agent or default mock
      setSelectedAgentId(allCombinedAgents[0].id)
    }
  }, [allCombinedAgents])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, departmentFilter, searchQuery, statusFilter])

  // Filter combined directory list based on active role tab and query
  const filteredAgents = useMemo<CombinedAgent[]>(() => {
    return allCombinedAgents.filter(agent => {
      const normalizedStatus = agent.status?.toUpperCase() || "";

      // Tab selection filter
      if (activeTab === "Admins") {
        if (agent.role !== "ADMIN" && agent.role !== "SUPER_ADMIN") return false;
      } else if (activeTab === "Agents") {
        if (agent.role !== "AGENT" && agent.role !== "USER") return false;
      } else if (activeTab === "Viewers") {
        if (agent.role !== "VIEWER") return false;
      } else if (activeTab === "Deactivated") {
        if (agent.status !== "INACTIVE") return false;
      }

      if (statusFilter !== "ALL" && normalizedStatus !== statusFilter) return false;

      if (departmentFilter !== "ALL") {
        const agentDepartmentId = agent.department?.id || "";
        if (agentDepartmentId !== departmentFilter) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (agent.name || "").toLowerCase().includes(query);
        const emailMatch = agent.email.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [allCombinedAgents, activeTab, departmentFilter, searchQuery, statusFilter]);

  const activeDirectoryFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) +
    (departmentFilter !== "ALL" ? 1 : 0);

  const resetDirectoryFilters = () => {
    setStatusFilter("ALL");
    setDepartmentFilter("ALL");
  };

  useEffect(() => {
    if (filteredAgents.length === 0) return;
    if (!filteredAgents.some(agent => agent.id === selectedAgentId)) {
      setSelectedAgentId(filteredAgents[0].id);
    }
  }, [filteredAgents, selectedAgentId])

  // Paginated agents
  const paginatedAgents = useMemo<CombinedAgent[]>(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAgents.slice(start, start + itemsPerPage);
  }, [filteredAgents, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / itemsPerPage));

  // Determine currently selected agent
  const selectedAgent = useMemo<CombinedAgent | null>(() => {
    return allCombinedAgents.find(a => a.id === selectedAgentId) || allCombinedAgents[0] || null;
  }, [allCombinedAgents, selectedAgentId]);

  // Generate dynamic stats derived from combined agents
  const kpiStats = useMemo(() => {
    const total = allCombinedAgents.length;
    const active = allCombinedAgents.filter(a => a.status === "ACTIVE").length;
    const admins = allCombinedAgents.filter(a => a.role === "ADMIN" || a.role === "SUPER_ADMIN").length;
    const agents = allCombinedAgents.filter(a => a.role === "AGENT" || a.role === "USER").length;
    const viewers = allCombinedAgents.filter(a => a.role === "VIEWER").length;

    return { total, active, admins, agents, viewers };
  }, [allCombinedAgents]);

  const directoryTabs: Array<{ id: AgentTab; label: string }> = [
    { id: "All Users", label: t("allUsersTab") },
    { id: "Admins", label: t("admins") },
    { id: "Agents", label: t("agents") },
    { id: "Deactivated", label: t("deactivated") }
  ];

  const detailTabs: Array<{ id: DetailTab; label: string }> = [
    { id: "Overview", label: t("overview") },
    { id: "Permissions", label: t("permissions") },
    { id: "Activity Log", label: t("activityLog") },
    { id: "Security", label: t("security") }
  ];

  const permissionItems = [
    { key: "live_chat", name: t("permLiveChatInbox"), desc: t("permLiveChatInboxDesc") },
    { key: "contacts", name: t("permContactDirectories"), desc: t("permContactDirectoriesDesc") },
    { key: "campaigns", name: t("permTriggerCampaigns"), desc: t("permTriggerCampaignsDesc") },
    { key: "analytics", name: t("permPerformanceReports"), desc: t("permPerformanceReportsDesc") },
    { key: "settings", name: t("permSystemSettings"), desc: t("permSystemSettingsDesc") }
  ];

  const getRoleLabel = (role: string) => {
    const normalizedRole = role === "USER" ? "AGENT" : role.toUpperCase()

    switch (normalizedRole) {
      case "ADMIN":
        return t("roleAdmin")
      case "SUPER_ADMIN":
        return t("roleSuperAdmin")
      case "VIEWER":
        return t("roleViewer")
      case "AGENT":
        return t("roleAgent")
      default:
        return role
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return t("statusActive")
      case "INACTIVE":
        return t("statusInactive")
      default:
        return status
    }
  }

  // Generate deterministic details for chosen agent to ensure mockup completeness
  const agentDetails = useMemo(() => {
    if (!selectedAgent) return null;

    // Helper to format Date cleanly (e.g. "13 May 2024, 10:19 AM")
    const formatDate = (dateInput: string | Date | number | null | undefined) => {
      if (!dateInput) return null;
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString(locale === "en" ? "en-US" : locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    };

    // Use values if present or generate realistic fallbacks based on name
    const name = selectedAgent.name || t("unnamedUser");
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

    // Hash key from id for consistent mock generations
    const idHash = selectedAgent.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const phoneFallback = selectedAgent.isMock
      ? selectedAgent.phone ?? t("notProvided")
      : `+92 300 ${1000000 + (idHash % 9000000)}`;

    const joinedFallback = selectedAgent.isMock
      ? selectedAgent.joinedDate ?? t("never")
      : formatDate(new Date(Date.now() - ((idHash % 18) + 10) * 24 * 60 * 60 * 1000)) || t("never");

    const lastLoginFallback = selectedAgent.isMock
      ? selectedAgent.lastLogin ?? t("never")
      : formatDate(new Date(Date.now() - ((idHash % 36) + 1) * 60 * 60 * 1000)) || t("never");

    const ipFallback = selectedAgent.isMock
      ? selectedAgent.loginIP ?? `192.168.1.${idHash % 254}`
      : `192.168.1.${idHash % 254}`;

    const browserFallback = selectedAgent.isMock
      ? selectedAgent.browser ?? t("noActiveDeviceSession")
      : (idHash % 2 === 0 ? "Chrome on Windows" : "Safari on macOS");

    const deptNameFallback = selectedAgent.department?.name
      || selectedAgent.departmentName
      || (selectedAgent.role === "ADMIN" ? t("adminDept") : idHash % 2 === 0 ? t("supportTeam") : t("salesTeam"));

    // Dynamic dynamic team arrays
    const teams = [
      { name: deptNameFallback, role: selectedAgent.role === "ADMIN" ? t("teamLead") : t("member"), color: "emerald" }
    ];
    if (selectedAgent.role !== "ADMIN") {
      teams.push({ name: t("globalChat"), role: t("member"), color: "blue" });
    }

    // Resolve actual database fields if available
    const actualPhone = selectedAgent.isMock ? phoneFallback : (selectedAgent.phoneNumber || t("notProvided"));
    const actualJoined = selectedAgent.isMock 
      ? joinedFallback 
      : (selectedAgent.createdAt ? (formatDate(selectedAgent.createdAt) || joinedFallback) : joinedFallback);
    
    const actualLastLogin = selectedAgent.isMock
      ? lastLoginFallback
      : (selectedAgent.lastLoginAt 
        ? (formatDate(selectedAgent.lastLoginAt) || lastLoginFallback) 
        : (selectedAgent.deviceSettings?.[0]?.lastActiveAt 
          ? (formatDate(selectedAgent.deviceSettings[0].lastActiveAt) || lastLoginFallback) 
          : t("never")));

    const actualBrowser = selectedAgent.isMock 
      ? browserFallback 
      : (selectedAgent.deviceSettings?.[0]?.deviceName || t("noActiveDeviceSession"));

    // Helper to get deterministic dates for activity timeline logs
    let loginDate = selectedAgent.lastLoginAt ? new Date(selectedAgent.lastLoginAt) : null;
    if (!loginDate || isNaN(loginDate.getTime())) {
      const daysAgo = (idHash % 4) + 1; // 1 to 4 days ago
      const hoursAgo = (idHash % 12) + 2; // 2 to 13 hours ago
      loginDate = new Date(Date.now() - (daysAgo * 24 + hoursAgo) * 60 * 65 * 1000);
    }

    let createdDate = selectedAgent.createdAt ? new Date(selectedAgent.createdAt) : null;
    if (!createdDate || isNaN(createdDate.getTime())) {
      const joinedDaysPrior = (idHash % 7) + 5; // 5 to 11 days prior
      createdDate = new Date(loginDate.getTime() - joinedDaysPrior * 24 * 60 * 60 * 1000);
    }

    const time1 = formatDate(loginDate) || lastLoginFallback;
    const time2 = formatDate(new Date(loginDate.getTime() - (idHash % 3 + 1) * 3600 * 1000)) || lastLoginFallback;
    const time3 = formatDate(new Date(loginDate.getTime() - ((idHash % 8) + 10) * 3600 * 1000)) || lastLoginFallback;
    const time4 = formatDate(createdDate) || joinedFallback;

    // Customize activities based on the agent's role (ADMIN, AGENT/USER, VIEWER)
    let activities: Array<{ title: string; date: string; color: string; desc: string }> = [];

    const roleUpper = (selectedAgent.role || "").toUpperCase();
    if (roleUpper === "ADMIN" || roleUpper === "SUPER_ADMIN") {
      activities = [
        {
          title: t("actSecureLoginSession"),
          date: time1,
          color: "bg-emerald-500",
          desc: t("actSecureLoginSessionDescAdmin", { browser: actualBrowser, ip: ipFallback })
        },
        {
          title: t("actUpdatedOrgUnits"),
          date: time2,
          color: "bg-blue-500",
          desc: t("actUpdatedOrgUnitsDesc", { dept: deptNameFallback })
        },
        {
          title: t("actInvitedTeamMembers"),
          date: time3,
          color: "bg-indigo-500",
          desc: t("actInvitedTeamMembersDesc")
        },
        {
          title: t("actAdminProfileActive"),
          date: time4,
          color: "bg-emerald-500",
          desc: t("actAdminProfileActiveDesc")
        }
      ];
    } else if (roleUpper === "VIEWER") {
      activities = [
        {
          title: t("actSecureLoginSession"),
          date: time1,
          color: "bg-emerald-500",
          desc: t("actSecureLoginSessionDescViewer", { browser: actualBrowser })
        },
        {
          title: t("actExportedAnalytics"),
          date: time2,
          color: "bg-purple-500",
          desc: t("actExportedAnalyticsDesc")
        },
        {
          title: t("actAnalyzedCampaignLogs"),
          date: time3,
          color: "bg-blue-500",
          desc: t("actAnalyzedCampaignLogsDesc")
        },
        {
          title: t("actViewerAccountActive"),
          date: time4,
          color: "bg-emerald-500",
          desc: t("actViewerAccountActiveDesc")
        }
      ];
    } else {
      // Default to AGENT/USER role
      activities = [
        {
          title: t("actSecureLoginSession"),
          date: time1,
          color: "bg-emerald-500",
          desc: t("actSecureLoginSessionDescAgent", { browser: actualBrowser })
        },
        {
          title: t("actAssignedInboxConversations"),
          date: time2,
          color: "bg-blue-500",
          desc: t("actAssignedInboxConversationsDesc", { dept: deptNameFallback })
        },
        {
          title: t("actResolvedCustomerChats"),
          date: time3,
          color: "bg-teal-500",
          desc: t("actResolvedCustomerChatsDesc")
        },
        {
          title: t("actAgentOnboardingComplete"),
          date: time4,
          color: "bg-emerald-500",
          desc: t("actAgentOnboardingCompleteDesc")
        }
      ];
    }

    return {
      initials,
      phone: actualPhone,
      joinedDate: actualJoined,
      lastLogin: actualLastLogin,
      loginIP: ipFallback,
      browser: actualBrowser,
      deptName: deptNameFallback,
      teams,
      twoFactor: selectedAgent.isMock ? selectedAgent.twoFactor : false,
      activities
    };
  }, [selectedAgent, locale, t]);

  // Operations
  const handleAddDepartment = async (name: string) => {
    try {
      await createDepartment(name)
      fetchData()
      toast.success(t("toastDeptCreated"))
    } catch (err) {
      toast.error(t("toastDeptCreationFailed"))
      console.error(err)
    }
  }

  const handleUpdateDepartment = async (id: string, name: string) => {
    try {
      await updateDepartment(id, name)
      fetchData()
      toast.success(t("toastDeptUpdated"))
    } catch (err) {
      toast.error(t("toastDeptUpdateFailed"))
      console.error(err)
    }
  }

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm(t("confirmDeleteDept"))) return
    try {
      await deleteDepartment(id)
      fetchData()
      toast.success(t("toastDeptDeleted"))
    } catch {
      toast.error(t("toastDeptDeleteFailed"))
    }
  }

  const handleDeleteAgent = async (id: string) => {
    if (!confirm(t("confirmDeleteAgent"))) return
    try {
      await deleteAgent(id)
      toast.success(t("toastAgentDeleted"))
      fetchData()
    } catch {
      toast.error(t("toastAgentDeleteFailed"))
    }
  }

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await updateAgent(agent.id, {
        name: agent.name,
        email: agent.email,
        status: newStatus,
        permissions: agent.permissions
      })
      toast.success(newStatus === 'INACTIVE' ? t("toastAgentRestricted") : t("toastAgentRestored"))
      fetchData()
    } catch {
      toast.error(t("toastAgentUpdateFailed"))
    }
  }

  const openEditAgent = (agent: Agent) => {
    setEditingAgent(agent)
    setIsInviteModalOpen(true)
  }

  const openEditDept = (dept: Department) => {
    setEditingDept(dept)
    setIsDeptModalOpen(true)
  }

  if (isLoading) {
    return <WatiBotLoader fullScreen={true} />
  }

  return (
    <ManageLayout contentClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen pb-20 plus-jakarta-forced max-w-none">
      <div className="max-w-[1680px] mx-auto space-y-8 pb-20 px-4 md:px-8 pt-6">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Directory vs Departments Switcher */}
            <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center shadow-sm">
              <button
                onClick={() => setView("directory")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                  view === "directory"
                    ? "bg-[#00B074] text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Users className="w-4 h-4" />
                {t("viewDirectory")}
              </button>
              <button
                onClick={() => setView("departments")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                  view === "departments"
                    ? "bg-[#00B074] text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Building2 className="w-4 h-4" />
                {t("viewDepartments")}
              </button>
            </div>

            {canEdit && view === "departments" && (
              <Button
                onClick={() => {
                  setEditingDept(null)
                  setIsDeptModalOpen(true)
                }}
                className="h-10 px-5 bg-[#00B074] hover:bg-[#00B074]/90 text-white shadow-sm rounded-xl font-bold text-xs flex items-center gap-2 border-none"
              >
                <Plus className="w-4 h-4" />
                {t("newDepartment")}
              </Button>
            )}

            {canInvite && (
              <Button
                onClick={() => {
                  setEditingAgent(null)
                  setIsInviteModalOpen(true)
                }}
                disabled={isTeamLimitReached}
                className={cn(
                  "h-10 px-5 bg-[#00B074] hover:bg-[#00B074]/90 text-white shadow-sm rounded-xl font-bold text-xs flex items-center gap-2 border-none",
                  isTeamLimitReached && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
              >
                <UserPlus className="w-4 h-4" />
                {t("addNewUser")}
              </Button>
            )}
          </div>
        </div>

        {isTeamLimitReached && teamQuota && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full shadow-sm animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Agent Limit Reached</h4>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5 font-medium">
                  You have used {teamQuota.current}/{teamQuota.limit} agents. Please upgrade your subscription plan to invite more agents.
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/dashboard/billing')}
              className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shrink-0 transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
            >
              Upgrade Plan
            </Button>
          </div>
        )}

        {/* 1. TOP KPI STATS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

          {/* Card 1: Total Users */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm dark:shadow-none flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block">{t("totalUsers")}</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none block">{kpiStats.total}</span>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 pt-0.5">
                <ChevronUp className="w-3 h-3 shrink-0" /> +12% {t("vsLastMonth")}
              </span>
            </div>
          </div>

          {/* Card 2: Active Users */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm dark:shadow-none flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block">{t("activeUsers")}</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none block">{kpiStats.active}</span>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 pt-0.5">
                <ChevronUp className="w-3 h-3 shrink-0" /> +8% {t("vsLastMonth")}
              </span>
            </div>
          </div>

          {/* Card 3: Admins */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm dark:shadow-none flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block">{t("admins")}</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none block">{kpiStats.admins}</span>
              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5 pt-0.5">
                {t("noChange")}
              </span>
            </div>
          </div>

          {/* Card 4: Agents */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm dark:shadow-none flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider block">{t("agents")}</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white leading-none block">{kpiStats.agents}</span>
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 pt-0.5">
                <ChevronUp className="w-3 h-3 shrink-0" /> +14% {t("vsLastMonth")}
              </span>
            </div>
          </div>
 

        </div>

         {view === "directory" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5">
                 <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-1 dark:bg-slate-950/60 dark:border dark:border-slate-800">
                  {directoryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        "min-h-9 rounded-xl px-3 py-2 text-xs font-bold tracking-wide transition-all cursor-pointer",
                        activeTab === tab.id
                          ? "bg-[#00B074] text-white shadow-sm shadow-[#00B074]/15"
                          : "text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t("searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00B074]/25 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    />
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setIsDirectoryFiltersOpen(prev => !prev)}
                    className={cn(
                      "h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5",
                      (isDirectoryFiltersOpen || activeDirectoryFiltersCount > 0) && "border-[#00B074]/40 text-[#00B074] dark:border-[#00B074]/35 dark:bg-[#00B074]/10 dark:text-emerald-300"
                    )}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {t("filters")}
                    {activeDirectoryFiltersCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00B074] px-1 text-[9px] font-black text-white">
                        {activeDirectoryFiltersCount}
                      </span>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={fetchData}
                    className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {isDirectoryFiltersOpen && (
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {t("status")}
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold normal-case tracking-normal text-slate-700 outline-none transition focus:border-[#00B074]/40 focus:ring-2 focus:ring-[#00B074]/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="ALL">{t("allStatuses")}</option>
                        <option value="ACTIVE">{t("statusActive")}</option>
                        <option value="INACTIVE">{t("statusInactive")}</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {t("department")}
                      <select
                        value={departmentFilter}
                        onChange={(event) => setDepartmentFilter(event.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold normal-case tracking-normal text-slate-700 outline-none transition focus:border-[#00B074]/40 focus:ring-2 focus:ring-[#00B074]/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="ALL">{t("allDepartments")}</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={activeDirectoryFiltersCount === 0}
                      onClick={resetDirectoryFilters}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {t("clearFilters")}
                    </Button>
                  </div>
                )}

                {/* Unified Users Row Feed */}
                <div className="space-y-2">
                  {paginatedAgents.length === 0 ? (
                    <div className="py-12 text-center text-xs font-semibold text-slate-400 tracking-wide">
                      {t("noMatchingMembers")}
                    </div>
                  ) : (
                    paginatedAgents.map((agent) => {
                      const isSelected = selectedAgentId === agent.id;
                      const initials = (agent.name || t("unnamedUser")).split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                      const isMockAdmin = agent.role === "ADMIN" || agent.role === "SUPER_ADMIN";
                      const isMockViewer = agent.role === "VIEWER";

                      return (
                        <div
                          key={agent.id}
                          onClick={() => setSelectedAgentId(agent.id)}
                          className={cn(
                            "flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer group",
                            isSelected
                              ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-500/25 shadow-sm"
                              : "border-transparent bg-transparent hover:bg-slate-50/70 dark:hover:bg-slate-800/45"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {/* Avatar */}
                            <div className="relative">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold select-none shadow-sm",
                                isMockAdmin
                                  ? "bg-emerald-500 text-white"
                                  : isMockViewer
                                    ? "bg-purple-500 text-white"
                                    : "bg-[#00B074]/15 text-[#00B074]"
                              )}>
                                {initials}
                              </div>
                              {/* Status indicators */}
                              <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm",
                                agent.status === "ACTIVE"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              )} />
                            </div>

                            {/* Details */}
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-black text-slate-800 dark:text-slate-100">{agent.name || t("unnamedUser")}</span>
                                {session?.user?.email && agent.email.toLowerCase() === session.user.email.toLowerCase() && (
                                  <span className="text-[8px] font-black px-1 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">{t("you")}</span>
                                )}
                              </div>
                              <span className="block max-w-[160px] truncate text-[10px] font-semibold text-slate-400 dark:text-slate-500">{agent.email}</span>
                            </div>
                          </div>

                          {/* Role Tag & Actions */}
                          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className={cn(
                              "hidden sm:inline-flex text-[8px] font-black tracking-wider px-2 py-0.5 rounded-md",
                              isMockAdmin
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                : isMockViewer
                                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"
                                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                            )}>
                              {getRoleLabel(agent.role)}
                            </span>

                            {/* Single contextual dropdown options */}
                            {!agent.isMock && (
                              <div className="flex items-center gap-1">
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Sign in as Agent"
                                    disabled={isImpersonating !== null}
                                    className="h-8 w-8 rounded-lg border border-slate-200/80 bg-white text-[#00B074] hover:bg-[#00B074] hover:text-white dark:border-slate-800 dark:bg-slate-950 dark:text-emerald-400 dark:hover:bg-[#00B074] dark:hover:text-white flex items-center justify-center shrink-0"
                                    onClick={() => handleImpersonate(agent.id)}
                                  >
                                    {isImpersonating === agent.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <LogIn className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg border border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700 dark:hover:border-slate-800 dark:hover:bg-slate-950 dark:hover:text-slate-200"
                                  onClick={() => {
                                    // Quick edit trigger
                                    openEditAgent(agent);
                                  }}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Pagination footer */}
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-slate-400 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {t("showingUsers", {
                      start: filteredAgents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1,
                      end: Math.min(filteredAgents.length, currentPage * itemsPerPage),
                      total: filteredAgents.length
                    })}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="h-8 w-8 rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-colors",
                          currentPage === i + 1
                            ? "bg-[#00B074] text-white"
                            : "bg-transparent text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}

                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="h-8 w-8 rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

              </div>
            </div>

            {/* COLUMN 2: SELECTED AGENT DETAIL PANEL (col-span-5) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {selectedAgent ? (
                <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none p-6 space-y-6">

                  {/* Detailed Profiler Header */}
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-16 h-16 rounded-[20px] flex items-center justify-center text-xl font-bold select-none shadow-md text-white bg-gradient-to-tr",
                        selectedAgent.role === "ADMIN" || selectedAgent.role === "SUPER_ADMIN"
                          ? "from-emerald-500 to-emerald-600"
                          : selectedAgent.role === "VIEWER"
                            ? "from-purple-500 to-purple-600"
                            : "from-[#00B074] to-emerald-500"
                      )}>
                        {agentDetails?.initials}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{selectedAgent.name || t("unnamedUser")}</h2>
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-md",
                            selectedAgent.role === "ADMIN" || selectedAgent.role === "SUPER_ADMIN"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                              : selectedAgent.role === "VIEWER"
                                ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600"
                                : "bg-blue-50 dark:bg-blue-950/40 text-blue-600"
                          )}>
                            {getRoleLabel(selectedAgent.role)}
                          </span>
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            selectedAgent.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"
                          )} />
                          <span className="text-[10px] font-bold text-slate-400">{getStatusLabel(selectedAgent.status)}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400">{selectedAgent.email}</p>
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {t("joinedOn", { date: agentDetails?.joinedDate ?? t("never") })}
                        </p>
                      </div>
                    </div>

                    {/* Manage Actions */}
                    <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
                      {!selectedAgent.isMock && (
                        <>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Sign in as Agent"
                              disabled={isImpersonating !== null}
                              onClick={() => handleImpersonate(selectedAgent.id)}
                              className="h-9 px-3.5 rounded-xl border border-slate-200/80 bg-white text-[#00B074] hover:text-white hover:bg-[#00B074] dark:border-slate-800 dark:bg-slate-900 flex items-center gap-1.5 font-bold text-xs shrink-0"
                            >
                              {isImpersonating === selectedAgent.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <LogIn className="w-3.5 h-3.5" />
                              )}
                              Sign In
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleToggleStatus(selectedAgent)}
                              title={selectedAgent.status === 'ACTIVE' ? t("deactivateUser") : t("activateUser")}
                              className={cn(
                                "h-9 w-9 rounded-xl border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900",
                                selectedAgent.status === "ACTIVE" ? "hover:text-amber-500 hover:border-amber-200" : "hover:text-emerald-500 hover:border-emerald-300"
                              )}
                            >
                              {selectedAgent.status === "ACTIVE" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditAgent(selectedAgent)}
                              className="h-9 w-9 rounded-xl border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 hover:text-emerald-500"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDeleteAgent(selectedAgent.id)}
                              className="h-9 w-9 rounded-xl border border-slate-200/80 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-500 dark:border-slate-800 dark:bg-slate-900 hover:border-rose-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}

                      {selectedAgent.isMock && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toast.info(t("toastMockProfileReadOnly"))}
                          className="h-9 w-9 rounded-xl border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 hover:text-[#00B074]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Profile sub tabs */}
                  <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
                    {detailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setDetailTab(tab.id)}
                        className={cn(
                          "pb-2 text-xs font-bold tracking-wide transition-all shrink-0 cursor-pointer",
                          detailTab === tab.id
                            ? "text-[#00B074] border-b-2 border-[#00B074]"
                            : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Profile contents */}
                  {detailTab === "Overview" && (
                    <div className="space-y-6">

                      {/* Grid Information details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

                        {/* Personal Information column */}
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-bold text-slate-400 tracking-widest pb-1 border-b border-slate-100 dark:border-slate-800">{t("personalInfo")}</h3>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-0.5">
                              <span className="font-semibold text-slate-400">{t("fullName")}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{selectedAgent.name || t("unnamedAgent")}</span>
                            </div>
                            <div className="flex justify-between py-0.5">
                              <span className="font-semibold text-slate-400">{t("email")}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 break-all pl-2">{selectedAgent.email}</span>
                            </div>
                            
                            <div className="flex justify-between py-0.5">
                              <span className="font-semibold text-slate-400">{t("language")}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{t("langEnglish")}</span>
                            </div>
                            
                          </div>
                        </div>

                        {/* Account Information column */}
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-bold text-slate-400 tracking-widest pb-1 border-b border-slate-100 dark:border-slate-800">{t("accountInfo")}</h3>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-0.5">
                              <span className="font-semibold text-slate-400">{t("role")}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{getRoleLabel(selectedAgent.role)}</span>
                            </div>
                            <div className="flex justify-between py-0.5">
                              <span className="font-semibold text-slate-400">{t("status")}</span>
                              <span className="font-bold text-emerald-500">{getStatusLabel(selectedAgent.status)}</span>
                            </div>
                            <div className="flex justify-between py-0.5">
                              <span className="font-semibold text-slate-400">{t("lastLogin")}</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 text-right">{agentDetails?.lastLogin}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === "Permissions" && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("accessControl")}</h3>
                      <div className="space-y-2 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/45">
                        {permissionItems.map((item) => {
                          const hasAccess = selectedAgent.role === "ADMIN" || selectedAgent.role === "SUPER_ADMIN"
                            ? true
                            : selectedAgent.permissions && selectedAgent.permissions[item.key] === true;

                          return (
                            <div key={item.key} className="flex items-center justify-between py-2 border-b border-slate-100/55 dark:border-slate-800/50 last:border-none">
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold max-w-[280px]">{item.desc}</p>
                              </div>
                              <span className={cn(
                                "text-[9px] font-black tracking-widest px-2 py-0.5 rounded",
                                hasAccess
                                  ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                              )}>
                                {hasAccess ? t("authorized") : t("unauthorized")}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {detailTab === "Teams" && (
                    <div className="space-y-4 py-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center mx-auto mb-2">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t("teamHierarchy")}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        {t("teamHierarchyDesc", { dept: agentDetails?.deptName ?? t("notProvided") })}
                      </p>
                    </div>
                  )}

                  {detailTab === "Activity Log" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("activityTimeline")}</h4>
                      <div className="space-y-4 border-l-2 border-slate-100 dark:border-slate-800 pl-4 ml-2">
                        {agentDetails?.activities && agentDetails.activities.length > 0 ? (
                          agentDetails.activities.map((act, i) => (
                            <div key={i} className="relative space-y-1">
                              <div className={cn("absolute -left-[21px] top-1 w-2 h-2 rounded-full border-2 border-white dark:border-slate-900 shadow-sm", act.color)} />
                              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none">{act.title}</h5>
                              <p className="text-[9px] text-slate-400 font-bold">{act.date}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">{act.desc}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs font-semibold text-slate-400">{t("noActivity")}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {detailTab === "Devices" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("activeSessions")}</h4>
                      <div className="flex items-center gap-3 p-3.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl">
                        <div className="p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm">
                          <Laptop className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{agentDetails?.browser}</span>
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600">{t("currentDevice")}</span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold">{t("ipAddress")}: {agentDetails?.loginIP} &bull; {t("pakistan")}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === "Security" && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("credentialSecuritySettings")}</h4>
                      <div className="space-y-2 text-xs font-semibold text-slate-400">
                        <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span>{t("twoFactor")}</span>
                          <span className="font-bold text-emerald-500">{t("enabled")}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span>{t("passwordStatus")}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{t("lastChangedDays", { days: 15 })}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span>{t("activeDeviceConnections")}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{t("verifiedSessions", { count: 3 })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none p-12 text-center text-xs font-semibold text-slate-400">
                  {t("selectAgentToView")}
                </div>
              )}
            </div>

            {/* COLUMN 3: STATS & ACTIVITIES SIDEBAR (col-span-3) */}
            <div className="lg:col-span-3 flex flex-col gap-6">

              {/* 3a: Recent Activity Timeline */}
              <div className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none p-6 space-y-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">{t("recentActivity")}</h3>

                <div className="space-y-4">
                  {agentDetails?.activities && agentDetails.activities.length > 0 ? (
                    agentDetails.activities.slice(0, 4).map((act, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-sm", act.color)} />
                        <div className="space-y-0.5 leading-none">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{act.title}</span>
                          <span className="text-[9px] font-semibold text-slate-400 block">{act.date}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-semibold text-slate-400">{t("noActivity")}</p>
                  )}
                </div>

                <button
                  onClick={() => setDetailTab("Activity Log")}
                  className="text-xs font-bold text-[#00B074] hover:underline pt-1 block"
                >
                  {t("viewAllActivity")} &rarr;
                </button>
              </div>
 

            </div>

          </div>
        ) : view === "departments" ? (
          /* =================== DEPARTMENTS MODULE VIEW =================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {departments.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-20 text-center flex flex-col items-center justify-center min-h-[350px]">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] rounded-full mb-4">
                  <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t("noDepartments")}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                  {t("noDepartmentsDesc")}
                </p>
              </div>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept.id}
                  className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all group relative"
                >
                  {/* Actions overlay */}
                  <div className="absolute right-6 top-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <button
                        onClick={() => openEditDept(dept)}
                        className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteDepartment(dept.id)}
                        className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 dark:bg-white flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white dark:text-black" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{dept.name}</h3>
                    <p className="text-[11px] font-bold tracking-widest text-[#00B074]">
                      {t("agentsMapped", { count: dept._count?.users || 0 })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

      </div>

      {/* RETAINED MODALS FOR REAL BACKEND DB OPERATIONS */}
      <InviteAgentModal
        isOpen={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        availableDepartments={departments.map(d => d.name)}
        onSuccess={fetchData}
        editData={editingAgent}
      />

      <CreateDepartmentModal
        isOpen={isDeptModalOpen}
        onOpenChange={setIsDeptModalOpen}
        onCreate={handleAddDepartment}
        onUpdate={handleUpdateDepartment}
        editData={editingDept || undefined}
      />
    </ManageLayout>
  )
}
