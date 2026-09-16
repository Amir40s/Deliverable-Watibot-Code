"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  KeyRound,
  Building2,
  Check,
  ChevronDown,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  LayoutDashboard,
  Activity,
  PhoneCall,
  DatabaseBackup,
  CreditCard,
  Settings,
  Sparkles,
  Lock,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ADMIN_MODULES,
  DEFAULT_ADMIN_ROLE_PRESETS,
  type AdminModuleKey,
  type AdminUserPermissions,
  type AdminStaffUser,
} from "@/lib/admin/rbac"
import {
  createAdminStaffUser,
  updateAdminStaffUser,
  deleteAdminStaffUser,
  getAllVendorsForPicker,
} from "@/app/[locale]/admin/staff/actions"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"

interface AdminStaffClientProps {
  initialStaff: AdminStaffUser[]
  availableVendors?: { id: string; name: string; slug: string; whatsappNumber?: string | null; status: string }[]
  hideHeader?: boolean
}

const MODULE_ICONS: Record<AdminModuleKey, any> = {
  dashboard: LayoutDashboard,
  system_status: Activity,
  vendors: Building2,
  booked_calls: PhoneCall,
  backup: DatabaseBackup,
  subscriptions: CreditCard,
  configurations: Settings,
}

export default function AdminStaffClient({ initialStaff, availableVendors = [], hideHeader = false }: AdminStaffClientProps) {
  const [mounted, setMounted] = useState(false)
  const [staffList, setStaffList] = useState<AdminStaffUser[]>(initialStaff)
  const [vendorsList, setVendorsList] = useState(availableVendors)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  useEffect(() => {
    setMounted(true)
  }, [])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<AdminStaffUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminStaffUser | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Form State
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [selectedPresetName, setSelectedPresetName] = useState<string>("Operations Lead")
  const [permissions, setPermissions] = useState<AdminUserPermissions>(() => {
    return (
      DEFAULT_ADMIN_ROLE_PRESETS.find((p) => p.name === "Operations Lead")?.permissions ||
      DEFAULT_ADMIN_ROLE_PRESETS[0].permissions
    )
  })

  // Vendor Picker Search inside Modal
  const [vendorSearch, setVendorSearch] = useState("")

  const { data: session } = useSession()
  const router = useRouter()

  // Refresh vendors if empty
  useEffect(() => {
    if (vendorsList.length === 0) {
      getAllVendorsForPicker().then((res) => {
        if (res.success && res.vendors) {
          setVendorsList(res.vendors)
        }
      })
    }
  }, [vendorsList.length])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingStaff(null)
    setName("")
    setEmail("")
    setPassword("")
    setStatus("ACTIVE")
    setSelectedPresetName("Operations Lead")
    const preset = DEFAULT_ADMIN_ROLE_PRESETS.find((p) => p.name === "Operations Lead")
    setPermissions(
      preset?.permissions || {
        roleName: "Operations Lead",
        modules: {
          dashboard: { read: true, write: true },
          system_status: { read: true, write: true },
          vendors: { read: true, write: true },
          booked_calls: { read: true, write: true },
          backup: { read: true, write: false },
          subscriptions: { read: true, write: true },
          configurations: { read: true, write: false },
        },
        vendorScope: { type: "all", vendorIds: [] },
      }
    )
    setVendorSearch("")
    setShowPassword(false)
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (staff: AdminStaffUser) => {
    setEditingStaff(staff)
    setName(staff.name || "")
    setEmail(staff.email || "")
    setPassword("") // Leave blank to keep existing
    setStatus(staff.status)
    setSelectedPresetName(staff.permissions.roleName || "Custom")
    setPermissions(JSON.parse(JSON.stringify(staff.permissions)))
    setVendorSearch("")
    setShowPassword(false)
    setIsModalOpen(true)
  }

  // Handle Preset Change
  const handleSelectPreset = (presetName: string) => {
    setSelectedPresetName(presetName)
    const preset = DEFAULT_ADMIN_ROLE_PRESETS.find((p) => p.name === presetName)
    if (preset) {
      setPermissions(JSON.parse(JSON.stringify(preset.permissions)))
    } else {
      setPermissions((prev) => ({
        ...prev,
        roleName: "Custom Role",
        isSuperAdmin: false,
      }))
    }
  }

  // Handle Module Permission Toggles
  const handleTogglePermission = (moduleKey: AdminModuleKey, action: "read" | "write") => {
    setSelectedPresetName("Custom")
    setPermissions((prev) => {
      const current = prev.modules[moduleKey] || { read: false, write: false }
      const updated = { ...current }

      if (action === "read") {
        updated.read = !current.read
        // If unchecking read, write must also be false
        if (!updated.read) updated.write = false
      } else {
        updated.write = !current.write
        // If checking write, read must also be true
        if (updated.write) updated.read = true
      }

      return {
        ...prev,
        isSuperAdmin: false,
        modules: {
          ...prev.modules,
          [moduleKey]: updated,
        },
      }
    })
  }

  const handleToggleModuleFull = (moduleKey: AdminModuleKey) => {
    setSelectedPresetName("Custom")
    setPermissions((prev) => {
      const current = prev.modules[moduleKey] || { read: false, write: false }
      const isFull = current.read && current.write
      return {
        ...prev,
        isSuperAdmin: false,
        modules: {
          ...prev.modules,
          [moduleKey]: isFull ? { read: false, write: false } : { read: true, write: true },
        },
      }
    })
  }

  const handleSetAllPermissions = (type: "allRead" | "allWrite" | "clearAll") => {
    setSelectedPresetName("Custom")
    setPermissions((prev) => {
      const nextModules = { ...prev.modules }
      ADMIN_MODULES.forEach((m) => {
        if (type === "allRead") {
          nextModules[m.key] = { read: true, write: nextModules[m.key]?.write || false }
        } else if (type === "allWrite") {
          nextModules[m.key] = { read: true, write: true }
        } else {
          nextModules[m.key] = { read: false, write: false }
        }
      })
      return { ...prev, isSuperAdmin: false, modules: nextModules }
    })
  }

  // Handle Vendor Scope Toggle & Selection
  const handleVendorScopeTypeChange = (type: "all" | "specific") => {
    setPermissions((prev) => ({
      ...prev,
      vendorScope: {
        type,
        vendorIds: type === "all" ? [] : prev.vendorScope.vendorIds,
      },
    }))
  }

  const handleToggleVendorId = (vendorId: string) => {
    setPermissions((prev) => {
      const currentIds = new Set(prev.vendorScope.vendorIds)
      if (currentIds.has(vendorId)) {
        currentIds.delete(vendorId)
      } else {
        currentIds.add(vendorId)
      }
      return {
        ...prev,
        vendorScope: {
          type: "specific",
          vendorIds: Array.from(currentIds),
        },
      }
    })
  }

  const handleSelectAllFilteredVendors = () => {
    const filteredVendorIds = filteredVendorsInPicker.map((v) => v.id)
    setPermissions((prev) => {
      const set = new Set([...prev.vendorScope.vendorIds, ...filteredVendorIds])
      return {
        ...prev,
        vendorScope: {
          type: "specific",
          vendorIds: Array.from(set),
        },
      }
    })
  }

  const handleClearSelectedVendors = () => {
    setPermissions((prev) => ({
      ...prev,
      vendorScope: {
        type: "specific",
        vendorIds: [],
      },
    }))
  }

  // Save Staff (Create or Update)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Please enter a staff name")
      return
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please provide a valid email address")
      return
    }
    if (!editingStaff && (!password || password.length < 6)) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (permissions.vendorScope.type === "specific" && permissions.vendorScope.vendorIds.length === 0) {
      toast.error("Please assign at least one vendor organization or select 'All Organizations'")
      return
    }

    setIsSaving(true)
    const toastId = toast.loading(editingStaff ? "Updating staff account..." : "Creating staff account...")

    try {
      if (editingStaff) {
        const payload: any = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          status,
          permissions: {
            ...permissions,
            roleName: selectedPresetName === "Custom" ? permissions.roleName || "Custom Role" : selectedPresetName,
          },
        }
        if (password && password.trim().length >= 6) {
          payload.password = password.trim()
        }

        const res = await updateAdminStaffUser(editingStaff.id, payload)
        if (!res.success) {
          toast.error(res.error || "Failed to update staff user", { id: toastId })
          setIsSaving(false)
          return
        }

        setStaffList((prev) =>
          prev.map((s) =>
            s.id === editingStaff.id
              ? {
                  ...s,
                  name: payload.name,
                  email: payload.email,
                  status: payload.status,
                  permissions: payload.permissions,
                }
              : s
          )
        )
        toast.success("Staff account updated successfully", { id: toastId })
      } else {
        const payload = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          status,
          permissions: {
            ...permissions,
            roleName: selectedPresetName === "Custom" ? permissions.roleName || "Custom Role" : selectedPresetName,
          },
        }

        const res = await createAdminStaffUser(payload)
        if (!res.success || !res.user) {
          toast.error(res.error || "Failed to create staff user", { id: toastId })
          setIsSaving(false)
          return
        }

        setStaffList((prev) => [res.user!, ...prev])
        toast.success("Staff account created successfully", { id: toastId })
      }

      setIsModalOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error("Save staff error:", err)
      toast.error(err.message || "An unexpected error occurred", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    const toastId = toast.loading(`Deleting staff user ${deleteTarget.name}...`)

    try {
      const res = await deleteAdminStaffUser(deleteTarget.id)
      if (!res.success) {
        toast.error(res.error || "Failed to delete staff account", { id: toastId })
        setIsDeleting(false)
        return
      }

      setStaffList((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      toast.success("Staff account deleted successfully", { id: toastId })
      setDeleteTarget(null)
      router.refresh()
    } catch (err: any) {
      console.error("Delete staff error:", err)
      toast.error(err.message || "Failed to delete staff", { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const q = search.toLowerCase()
      const matchSearch =
        !search ||
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.permissions?.roleName?.toLowerCase().includes(q)

      if (!matchSearch) return false

      if (roleFilter !== "ALL") {
        if (roleFilter === "SUPER_ADMIN" && s.role !== "SUPER_ADMIN") return false
        if (roleFilter !== "SUPER_ADMIN" && s.permissions.roleName !== roleFilter) return false
      }

      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false
      }

      return true
    })
  }, [staffList, search, roleFilter, statusFilter])

  // Filtered vendors inside picker
  const filteredVendorsInPicker = useMemo(() => {
    if (!vendorSearch) return vendorsList
    const q = vendorSearch.toLowerCase()
    return vendorsList.filter(
      (v) => v.name?.toLowerCase().includes(q) || v.slug?.toLowerCase().includes(q) || v.whatsappNumber?.includes(q)
    )
  }, [vendorsList, vendorSearch])

  // Stats calculation
  const stats = useMemo(() => {
    const total = staffList.length
    const active = staffList.filter((s) => s.status === "ACTIVE").length
    const superAdmins = staffList.filter((s) => s.role === "SUPER_ADMIN" || s.permissions.isSuperAdmin).length
    const restricted = staffList.filter((s) => s.permissions.vendorScope.type === "specific").length
    return { total, active, superAdmins, restricted }
  }, [staffList])

  return (
    <div className="flex-1 flex flex-col w-full min-h-full" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      {/* Top Header & CTAs */}
      {!hideHeader && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="px-6 md:px-8 pt-8 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Admin Staff & Roles</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Manage administrative personnel, configure module-wise read/write permissions, and scope vendor access.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-2 bg-gradient-to-br from-[#00a884] to-emerald-600 hover:from-[#009272] hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Admin Staff</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Body Section */}
      <div className={cn("space-y-6 flex-1", hideHeader ? "pt-1 pb-8" : "px-6 md:px-8 py-6 pb-24")}>
        {hideHeader && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Staff Directory</h2>
              <p className="text-xs text-slate-500 font-medium">Manage administrative users, roles, and granular scoping</p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-gradient-to-br from-[#00a884] to-emerald-600 hover:from-[#009272] hover:to-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Admin Staff</span>
            </button>
          </div>
        )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 mb-3 border border-slate-200/50 dark:border-slate-700">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.total}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1.5">
            Total Staff Users
          </p>
        </div>

        <div className="rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-[#00a884] mb-3 border border-emerald-100 dark:border-emerald-900/40">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.active}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1.5">
            Active Accounts
          </p>
        </div>

        <div className="rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 border border-purple-100 dark:border-purple-900/40">
            <Shield className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.superAdmins}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1.5">
            Super Admins
          </p>
        </div>

        <div className="rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 border border-amber-100 dark:border-amber-900/40">
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stats.restricted}</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1.5">
            Scoped Vendors Only
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Role Preset Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            {DEFAULT_ADMIN_ROLE_PRESETS.filter((p) => p.name !== "Super Admin").map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">No staff members found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              No administrative accounts match your filter criteria. Try adjusting your search or add a new team member.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 min-w-[240px]">Staff Member</th>
                  <th className="py-4 px-6 min-w-[160px]">Role / Preset</th>
                  <th className="py-4 px-6 min-w-[120px]">Account Status</th>
                  <th className="py-4 px-6 min-w-[200px]">Vendor Scope</th>
                  <th className="py-4 px-6 min-w-[220px]">Module Permissions</th>
                  <th className="py-4 pr-6 text-right min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStaff.map((staff) => {
                  const isSuper = staff.role === "SUPER_ADMIN" || staff.permissions.isSuperAdmin
                  const isSpecific = staff.permissions.vendorScope.type === "specific"
                  const scopedCount = staff.permissions.vendorScope.vendorIds.length
                  const isSelf = session?.user?.email === staff.email

                  const activeModulesCount = Object.values(staff.permissions.modules).filter(
                    (m) => m.read || m.write
                  ).length

                  return (
                    <tr
                      key={staff.id}
                      className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Member Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884]/15 to-emerald-600/15 text-[#00a884] flex items-center justify-center font-bold text-sm shrink-0 border border-[#00a884]/20">
                            {staff.name?.slice(0, 2).toUpperCase() || "AD"}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              {staff.name || "Unnamed Staff"}
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 truncate">{staff.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Preset */}
                      <td className="py-4 px-6">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border",
                            isSuper
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                              : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          <Shield className="w-3 h-3 text-current" />
                          {staff.permissions.roleName || (isSuper ? "Super Admin" : "Custom")}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold",
                            staff.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              staff.status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            )}
                          />
                          {staff.status}
                        </span>
                      </td>

                      {/* Vendor Scope */}
                      <td className="py-4 px-6">
                        {isSuper || !isSpecific ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <Building2 className="w-3.5 h-3.5" />
                            All Organizations (Global)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 text-xs font-bold">
                            <Lock className="w-3 h-3" />
                            {scopedCount} Assigned Vendor{scopedCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>

                      {/* Permissions matrix summary */}
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap items-center gap-1">
                          {isSuper ? (
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                              Full Access (All 7 Modules)
                            </span>
                          ) : (
                            ADMIN_MODULES.map((m) => {
                              const perm = staff.permissions.modules[m.key]
                              if (!perm?.read && !perm?.write) return null
                              return (
                                <span
                                  key={m.key}
                                  title={`${m.name}: ${perm.write ? "Read & Write" : "Read Only"}`}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                    perm.write
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                                      : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                                  )}
                                >
                                  {m.name.split(" ")[0]} {perm.write ? "(W)" : "(R)"}
                                </span>
                              )
                            })
                          )}
                          {!isSuper && activeModulesCount === 0 && (
                            <span className="text-xs font-medium text-slate-400">No active module permissions</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(staff)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Edit Permissions & Scope"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button (disabled for self or super admin) */}
                          <button
                            onClick={() => setDeleteTarget(staff)}
                            disabled={isSelf || (isSuper && session?.user?.role !== "SUPER_ADMIN")}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title={isSelf ? "You cannot delete yourself" : "Delete Staff Member"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* ─── ADD / EDIT STAFF MODAL ─── */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#00a884]/10 text-[#00a884] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingStaff ? "Edit Admin Staff & Permissions" : "Add New Admin Staff"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assign role templates, granular module controls, and vendor scoping.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveStaff} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Section 1: Basic Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Staff Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah@watibot.io"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {editingStaff ? "New Password (Leave blank to keep current)" : "Password *"}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required={!editingStaff}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingStaff ? "••••••••" : "Minimum 6 characters"}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-slate-600 dark:text-slate-300" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Account Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] cursor-pointer"
                    >
                      <option value="ACTIVE">Active (Can log in)</option>
                      <option value="INACTIVE">Inactive (Access blocked)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Role Presets Quick-Select */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Role Preset Template</h4>
                  <span className="text-[11px] font-semibold text-slate-400">Selecting a role pre-configures permissions</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {DEFAULT_ADMIN_ROLE_PRESETS.map((preset) => {
                    const isSelected = selectedPresetName === preset.name
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleSelectPreset(preset.name)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-[#00a884]/20"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-bold",
                              isSelected ? "text-[#00a884]" : "text-slate-800 dark:text-slate-200"
                            )}
                          >
                            {preset.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#00a884]" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{preset.description}</p>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("Custom")}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      selectedPresetName === "Custom"
                        ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-[#00a884]/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-bold",
                          selectedPresetName === "Custom" ? "text-[#00a884]" : "text-slate-800 dark:text-slate-200"
                        )}
                      >
                        Custom Role
                      </span>
                      {selectedPresetName === "Custom" && <Check className="w-3.5 h-3.5 text-[#00a884]" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Manual matrix customization</p>
                  </button>
                </div>
              </div>

              {/* Section 3: Module Permissions Matrix */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      3. Module Permissions Matrix
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Assign Read (view) and Write (create, edit, delete, actions) permissions per module.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions("allRead")}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-slate-200 transition-colors"
                    >
                      All Read
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions("allWrite")}
                      className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[#00a884] text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                    >
                      All Full Access
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions("clearAll")}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold hover:text-slate-600 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 font-bold">
                        <th className="py-2.5 px-4">Platform Module</th>
                        <th className="py-2.5 px-4 text-center w-24">Read</th>
                        <th className="py-2.5 px-4 text-center w-24">Write</th>
                        <th className="py-2.5 px-4 text-center w-28">Full Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {ADMIN_MODULES.map((mod) => {
                        const Icon = MODULE_ICONS[mod.key]
                        const perm = permissions.modules[mod.key] || { read: false, write: false }
                        const isFull = perm.read && perm.write

                        return (
                          <tr key={mod.key} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 dark:text-slate-200">{mod.name}</p>
                                  <p className="text-[10px] text-slate-400 line-clamp-1">{mod.description}</p>
                                </div>
                              </div>
                            </td>

                            {/* Read Checkbox */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm.read}
                                onChange={() => handleTogglePermission(mod.key, "read")}
                                className="w-4 h-4 rounded border-slate-300 text-[#00a884] focus:ring-[#00a884]/20 cursor-pointer accent-[#00a884]"
                              />
                            </td>

                            {/* Write Checkbox */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={perm.write}
                                onChange={() => handleTogglePermission(mod.key, "write")}
                                className="w-4 h-4 rounded border-slate-300 text-[#00a884] focus:ring-[#00a884]/20 cursor-pointer accent-[#00a884]"
                              />
                            </td>

                            {/* Full Access Toggle */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleModuleFull(mod.key)}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all",
                                  isFull
                                    ? "bg-[#00a884] text-white shadow-sm"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                              >
                                {isFull ? "Full" : "Custom"}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Granular Vendor Scoping Control */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    4. Vendor-Level Scoping Control
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Restrict this admin to manage specific vendor organizations or grant global access to all vendors.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleVendorScopeTypeChange("all")}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all cursor-pointer",
                      permissions.vendorScope.type === "all"
                        ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-[#00a884]/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/10 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#00a884]" />
                        Option A: All Organizations
                      </span>
                      {permissions.vendorScope.type === "all" && <Check className="w-4 h-4 text-[#00a884]" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Full platform access to manage all registered vendor accounts without restrictions.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVendorScopeTypeChange("specific")}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all cursor-pointer",
                      permissions.vendorScope.type === "specific"
                        ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-[#00a884]/20"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/10 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-500" />
                        Option B: Specific Organizations
                      </span>
                      {permissions.vendorScope.type === "specific" && <Check className="w-4 h-4 text-[#00a884]" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Restrict visibility so this staff member can only view and manage explicitly assigned accounts.
                    </p>
                  </button>
                </div>

                {/* Specific Vendors Multi-Select List */}
                {permissions.vendorScope.type === "specific" && (
                  <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-400">
                          Assigned Vendors:
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-black">
                          {permissions.vendorScope.vendorIds.length} of {vendorsList.length} selected
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredVendors}
                          className="text-[11px] font-bold text-[#00a884] hover:underline"
                        >
                          Select Filtered
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={handleClearSelectedVendors}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search vendors by name or slug..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00a884]/20"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredVendorsInPicker.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-400">No matching vendor accounts found</p>
                      ) : (
                        filteredVendorsInPicker.map((vendor) => {
                          const isChecked = permissions.vendorScope.vendorIds.includes(vendor.id)
                          return (
                            <label
                              key={vendor.id}
                              className={cn(
                                "flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors",
                                isChecked && "bg-emerald-50/30 dark:bg-emerald-950/20"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleVendorId(vendor.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-[#00a884] focus:ring-[#00a884]/20 cursor-pointer accent-[#00a884]"
                                />
                                <div className="truncate">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {vendor.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    slug: {vendor.slug} {vendor.whatsappNumber && `• ${vendor.whatsappNumber}`}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0",
                                  vendor.status === "ACTIVE" || vendor.status === "active"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                )}
                              >
                                {vendor.status}
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#009272] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {editingStaff ? "Save Permissions" : "Create Staff Member"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      {mounted && deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Admin Staff</h3>
                <p className="text-xs text-slate-500 font-medium">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 mb-6">
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                Are you sure you want to delete staff account{" "}
                <strong className="font-bold">{deleteTarget.name}</strong> ({deleteTarget.email})? All platform
                administrative access will be immediately revoked.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete Staff
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
