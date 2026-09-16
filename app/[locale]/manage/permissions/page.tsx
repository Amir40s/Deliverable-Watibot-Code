"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ManageLayout from "@/components/layouts/ManageLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import WatiBotLoader from "@/components/WatiBotLoader";
import { useLocale, useTranslations } from "next-intl";
import { getAgents, updateAgent } from "@/app/actions/agents";
import PermissionsHeader from "@/components/manage/permissions/PermissionsHeader";
import UserSelectorCard, { type PermissionUser, type RoleId } from "@/components/manage/permissions/UserSelectorCard";
import PermissionOverviewStats from "@/components/manage/permissions/PermissionOverviewStats";
import ModulePermissionsTable, {
  MODULE_DEFINITIONS,
  type AccessLevel,
} from "@/components/manage/permissions/ModulePermissionsTable";
import AgentChatAssignmentSection from "@/components/manage/permissions/AgentChatAssignmentSection";
import RoundRobinRoutingSection from "@/components/manage/permissions/RoundRobinRoutingSection";
import UnsavedChangesBar from "@/components/manage/permissions/UnsavedChangesBar";

export default function PermissionsPage() {
  const t = useTranslations("PermissionsPage");
  const locale = useLocale();
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr";
  const isRtl = dir === "rtl";

  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  // Local pending permissions per module for unsaved changes & batch saving
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, AccessLevel>>({});
  const [initialPermissions, setInitialPermissions] = useState<Record<string, AccessLevel>>({});

  const formatDate = useCallback(
    (dateInput: string | Date | null | undefined) => {
      if (!dateInput) return "N/A";
      const date = new Date(dateInput);
      if (Number.isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString(locale === "en" ? "en-US" : locale, {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    },
    [locale]
  );

  const normalizePermissions = useCallback(
    (permissions: unknown): Record<string, AccessLevel> => {
      if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return {};

      return Object.entries(permissions as Record<string, unknown>).reduce<Record<string, AccessLevel>>(
        (acc, [key, value]) => {
          if (["full", "view", "edit", "delete", "none", "custom"].includes(String(value))) {
            acc[key] = value as AccessLevel;
          }
          return acc;
        },
        {}
      );
    },
    []
  );

  const getRoleName = useCallback(
    (roleId: RoleId) => {
      try {
        const tr = t(`roles.${roleId}.name`);
        if (tr && !tr.startsWith("PermissionsPage.")) return tr;
      } catch {}
      switch (roleId) {
        case "admin":
          return "Admin";
        case "manager":
          return "Manager";
        case "agent":
          return "Agent";
        case "viewer":
          return "Viewer";
        default:
          return "Custom Role";
      }
    },
    [t]
  );

  // Fetch users on mount
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dbAgents = await getAgents();
      const formattedDb = (dbAgents || []).map(
        (u): PermissionUser => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role === "USER" ? "AGENT" : u.role,
          status: u.status || "ACTIVE",
          permissions: normalizePermissions(u.permissions),
          createdAt: formatDate(u.createdAt),
          updatedAt: formatDate(u.lastLoginAt),
        })
      );

      setUsers(formattedDb);
      if (formattedDb.length > 0) {
        setSelectedUserId((prev) => (prev && formattedDb.some((u) => u.id === prev) ? prev : formattedDb[0].id));
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
      setUsers([]);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [formatDate, normalizePermissions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Active Selected User
  const activeUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || users[0] || null;
  }, [users, selectedUserId]);

  // Active Role ID derived from active user
  const selectedRoleId = useMemo<RoleId>(() => {
    if (!activeUser) return "admin";
    const r = (activeUser.role || "AGENT").toLowerCase();
    if (r === "admin" || r === "super_admin" || r === "super-admin") return "admin";
    if (r === "manager") return "manager";
    if (r === "viewer" || r === "guest") return "viewer";
    if (r === "agent" || r === "user") return "agent";
    return "custom-role";
  }, [activeUser]);

  // Sync initial and pending permissions whenever active user changes
  useEffect(() => {
    if (activeUser) {
      const userPerms = activeUser.permissions || {};
      const fullPerms: Record<string, AccessLevel> = {};
      MODULE_DEFINITIONS.forEach((mod) => {
        fullPerms[mod.key] = (userPerms[mod.key] as AccessLevel) || mod.defaultAccess[selectedRoleId] || "none";
      });
      setInitialPermissions(fullPerms);
      setPendingPermissions(fullPerms);
    }
  }, [activeUser, selectedRoleId]);

  // Calculate Unsaved Changes
  const unsavedCount = useMemo(() => {
    let count = 0;
    Object.keys(pendingPermissions).forEach((key) => {
      if (pendingPermissions[key] !== initialPermissions[key]) {
        count++;
      }
    });
    return count;
  }, [pendingPermissions, initialPermissions]);

  const hasUnsavedChanges = unsavedCount > 0;

  // Local change handler for module permissions
  const handleChangePermission = (moduleKey: string, newAccess: AccessLevel) => {
    setPendingPermissions((prev) => ({
      ...prev,
      [moduleKey]: newAccess,
    }));
  };

  // Batch permission setter
  const handleBatchSetPermissions = (level: AccessLevel) => {
    const updated: Record<string, AccessLevel> = {};
    MODULE_DEFINITIONS.forEach((mod) => {
      updated[mod.key] = level;
    });
    setPendingPermissions(updated);
    toast.info(`Set all modules to ${level === "full" ? "Full Access" : "No Access"}`);
  };

  // Save all pending changes to server
  const handleSave = async () => {
    if (!activeUser) return;
    setIsSaving(true);
    try {
      await updateAgent(activeUser.id, { permissions: pendingPermissions });
      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === activeUser.id ? { ...u, permissions: pendingPermissions } : u))
      );
      setInitialPermissions(pendingPermissions);
      toast.success("Permissions updated successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset/Discard pending changes
  const handleReset = () => {
    setPendingPermissions(initialPermissions);
    toast.info("Unsaved changes discarded");
  };

  // Change Role Handler
  const handleChangeRole = async (newRoleId: RoleId) => {
    if (!activeUser) return;
    let dbRole = "USER";
    if (newRoleId === "admin") dbRole = "ADMIN";
    else if (newRoleId === "manager") dbRole = "MANAGER";
    else if (newRoleId === "viewer") dbRole = "GUEST";
    else dbRole = "USER";

    setIsUpdatingRole(true);
    try {
      await updateAgent(activeUser.id, { role: dbRole });
      toast.success("User role updated successfully");
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update role");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Calculate stats based on pending permissions
  const stats = useMemo(() => {
    let full = 0;
    let edit = 0;
    let view = 0;
    let none = 0;
    MODULE_DEFINITIONS.forEach((mod) => {
      const access = pendingPermissions[mod.key] || mod.defaultAccess[selectedRoleId] || "none";
      if (access === "full") full++;
      else if (access === "edit") edit++;
      else if (access === "view") view++;
      else none++;
    });
    return {
      total: MODULE_DEFINITIONS.length,
      full,
      edit,
      view,
      none,
    };
  }, [pendingPermissions, selectedRoleId]);

  if (isLoading) {
    return <WatiBotLoader fullScreen={true} />;
  }

  return (
    <ManageLayout contentClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen pb-24 plus-jakarta-forced max-w-none">
      <div dir={dir} className="max-w-[1400px] mx-auto space-y-6 pb-20 px-4 sm:px-6 lg:px-8 pt-6">
        {/* 1. PROFESSIONAL PAGE HEADER */}
        <PermissionsHeader
          title="Role & Permissions"
          subtitle="Manage user access, module privileges, and live chat routing assignment rules."
          hasUnsavedChanges={hasUnsavedChanges}
          unsavedCount={unsavedCount}
          isSaving={isSaving}
          onSave={handleSave}
          onReset={handleReset}
          isRtl={isRtl}
        />

        {/* 2. USER SELECTOR & PROFILE SUMMARY PANEL */}
        <UserSelectorCard
          users={users}
          selectedUserId={selectedUserId}
          onSelectUser={(id) => {
            if (hasUnsavedChanges) {
              if (!confirm("You have unsaved changes. Switching users will discard them. Continue?")) {
                return;
              }
            }
            setSelectedUserId(id);
          }}
          activeRole={selectedRoleId}
          onChangeRole={handleChangeRole}
          isUpdatingRole={isUpdatingRole}
          isRtl={isRtl}
          getRoleName={getRoleName}
        />

        {/* 3. PERMISSION OVERVIEW STATS ROW */}
        <PermissionOverviewStats stats={stats} isRtl={isRtl} />

        {/* 4. MODULE PERMISSIONS TABLE / MATRIX */}
        <ModulePermissionsTable
          permissions={pendingPermissions}
          selectedRoleId={selectedRoleId}
          onChangePermission={handleChangePermission}
          onBatchSetPermissions={handleBatchSetPermissions}
          isRtl={isRtl}
        />

        {/* 5. LIVE CHAT ASSIGNMENT SECTION */}
        {activeUser && (
          <AgentChatAssignmentSection
            key={activeUser.id}
            agent={activeUser}
            dir={dir}
          />
        )}

        {/* 6. ROUND-ROBIN & BATCH ROTATION DISTRIBUTION SECTION */}
        <RoundRobinRoutingSection dir={dir} />
      </div>

      {/* 6. FLOATING STICKY ACTION BAR FOR UNSAVED CHANGES */}
      <UnsavedChangesBar
        hasUnsavedChanges={hasUnsavedChanges}
        unsavedCount={unsavedCount}
        isSaving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
        isRtl={isRtl}
      />
    </ManageLayout>
  );
}
