"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Users,
  Search,
  Check,
  ChevronDown,
  ShieldCheck,
  Calendar,
  Clock,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AccessLevel } from "./ModulePermissionsTable";

export type RoleId = "admin" | "manager" | "agent" | "viewer" | "custom-role";

export interface PermissionUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, AccessLevel>;
  createdAt: string;
  updatedAt: string;
}

interface UserSelectorCardProps {
  users: PermissionUser[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  activeRole: RoleId;
  onChangeRole: (newRoleId: RoleId) => Promise<void>;
  isUpdatingRole?: boolean;
  isRtl?: boolean;
  getRoleName: (roleId: RoleId) => string;
}

const ROLE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  ADMIN: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
  MANAGER: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  AGENT: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-[#00B074]", border: "border-emerald-200 dark:border-emerald-800" },
  VIEWER: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
};

export default function UserSelectorCard({
  users,
  selectedUserId,
  onSelectUser,
  activeRole,
  onChangeRole,
  isUpdatingRole = false,
  isRtl = false,
  getRoleName,
}: UserSelectorCardProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || users[0] || null;
  }, [users, selectedUserId]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const getInitials = (name?: string | null, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return "US";
  };

  const getNormalizedRoleKey = (role: string): string => {
    const r = role.toUpperCase();
    if (r === "SUPER_ADMIN") return "SUPER_ADMIN";
    if (r === "ADMIN") return "ADMIN";
    if (r === "MANAGER") return "MANAGER";
    if (r === "VIEWER" || r === "GUEST") return "VIEWER";
    return "AGENT";
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* 1. USER SELECTOR PANEL (col-span-8) */}
      <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4 text-start">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Target User & Role Matrix
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Select an active team member to inspect and modify their workspace permissions and chat routing rules.
          </p>
        </div>

        {/* User Search & Dropdown Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className={cn(
              "w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:bg-slate-100/70 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3 text-start cursor-pointer shadow-xs",
              isRtl ? "flex-row-reverse" : ""
            )}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-[#00B074]/10 text-[#00B074] dark:bg-[#00B074]/20 border border-[#00B074]/20 flex items-center justify-center font-extrabold text-sm shrink-0">
                {getInitials(activeUser?.name, activeUser?.email)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {activeUser?.name || "No name provided"}
                  </span>
                  {activeUser?.status === "ACTIVE" ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074] border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00B074] animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  <span className="truncate">{activeUser?.email}</span>
                  <span>•</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {activeUser?.role || "AGENT"}
                  </span>
                </div>
              </div>
            </div>

            <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform", isSearchOpen ? "rotate-180" : "")} />
          </button>

          {isSearchOpen && (
            <div className="absolute left-0 top-full mt-2 w-full sm:w-[460px] p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="space-y-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search user by name, email, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-[#00B074]"
                    autoFocus
                  />
                </div>

                {/* Users List */}
                <div className="max-h-64 overflow-y-auto space-y-1 p-0.5">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400 font-semibold">
                      No matching users found
                    </p>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = user.id === selectedUserId;
                      const roleKey = getNormalizedRoleKey(user.role);
                      const colorStyle = ROLE_COLOR_MAP[roleKey] || ROLE_COLOR_MAP.AGENT;

                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            onSelectUser(user.id);
                            setIsSearchOpen(false);
                          }}
                          className={cn(
                            "w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-start transition-all cursor-pointer",
                            isSelected
                              ? "bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                              : "hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs shrink-0">
                              {getInitials(user.name, user.email)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {user.name || "No name"}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase border",
                                    colorStyle.bg,
                                    colorStyle.text,
                                    colorStyle.border
                                  )}
                                >
                                  {user.role || "AGENT"}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-slate-400 font-medium truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          {isSelected && <Check className="w-4 h-4 text-[#00B074] shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. USER OVERVIEW COMPACT SIDE PANEL (col-span-4) */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3 text-start">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#00B074]" />
            User Overview
          </span>
          {activeUser?.status === "ACTIVE" ? (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074]">
              Active User
            </span>
          ) : (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-500">
              Inactive
            </span>
          )}
        </div>

        {/* Assigned Role Selector */}
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
            Assigned Role
          </label>
          <Select
            value={activeRole}
            onValueChange={(val) => onChangeRole(val as RoleId)}
            disabled={isUpdatingRole || !activeUser}
          >
            <SelectTrigger className="h-8 w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 px-2.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00B074]" />
                <SelectValue placeholder="Select role..." />
              </div>
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 rounded-xl">
              <SelectItem value="admin" className="text-xs font-bold">
                {getRoleName("admin")}
              </SelectItem>
              <SelectItem value="manager" className="text-xs font-bold">
                {getRoleName("manager")}
              </SelectItem>
              <SelectItem value="agent" className="text-xs font-bold">
                {getRoleName("agent")}
              </SelectItem>
              <SelectItem value="viewer" className="text-xs font-bold">
                {getRoleName("viewer")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Compact Metadata Rows */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Created
            </span>
            <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
              {activeUser?.createdAt || "N/A"}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Last Active
            </span>
            <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
              {activeUser?.updatedAt || "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
