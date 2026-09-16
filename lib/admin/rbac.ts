import { Session } from "next-auth"

export type AdminModuleKey =
  | "dashboard"
  | "system_status"
  | "vendors"
  | "booked_calls"
  | "backup"
  | "subscriptions"
  | "configurations"

export interface ModulePermission {
  read: boolean
  write: boolean
}

export interface VendorScope {
  type: "all" | "specific"
  vendorIds: string[]
}

export interface AdminUserPermissions {
  roleName: string
  isSuperAdmin?: boolean
  modules: Record<AdminModuleKey, ModulePermission>
  vendorScope: VendorScope
}

export interface AdminStaffUser {
  id: string
  name: string | null
  email: string
  role: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string | Date
  lastLoginAt?: string | Date | null
  permissions: AdminUserPermissions
}

export interface ModuleMeta {
  key: AdminModuleKey
  name: string
  description: string
  icon: string
  pathPrefix: string
}

export const ADMIN_MODULES: ModuleMeta[] = [
  {
    key: "dashboard",
    name: "Dashboard & Analytics",
    description: "Platform high-level revenue, WABA status metrics, analytics charts",
    icon: "LayoutDashboard",
    pathPrefix: "/admin/dashboard",
  },
  {
    key: "system_status",
    name: "System Status",
    description: "Server health metrics, dual DB synchronization, socket status",
    icon: "Activity",
    pathPrefix: "/admin/system-status",
  },
  {
    key: "vendors",
    name: "Vendors & Accounts",
    description: "Organization directory, account status, subscriptions, WhatsApp sync",
    icon: "Building2",
    pathPrefix: "/admin/vendors",
  },
  {
    key: "booked_calls",
    name: "Booked Calls",
    description: "Demo calls, onboarding requests, and scheduled vendor consultations",
    icon: "PhoneCall",
    pathPrefix: "/admin/booked-calls",
  },
  {
    key: "backup",
    name: "Backup & Restore",
    description: "Database export, dump snapshots, and data restore operations",
    icon: "DatabaseBackup",
    pathPrefix: "/admin/backup",
  },
  {
    key: "subscriptions",
    name: "Subscriptions & Billing",
    description: "Auto/Manual subscription management, transaction history, plans",
    icon: "CreditCard",
    pathPrefix: "/admin/subscriptions",
  },
  {
    key: "configurations",
    name: "Configurations & Staff",
    description: "Global settings, admin staff & roles, plans, gateways, tutorial videos",
    icon: "Settings",
    pathPrefix: "/admin/configurations",
  },
]

export const DEFAULT_ADMIN_ROLE_PRESETS: {
  name: string
  description: string
  badgeColor: string
  permissions: AdminUserPermissions
}[] = [
  {
    name: "Super Admin",
    description: "Unrestricted master access to all platform modules and organizations",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
    permissions: {
      roleName: "Super Admin",
      isSuperAdmin: true,
      modules: {
        dashboard: { read: true, write: true },
        system_status: { read: true, write: true },
        vendors: { read: true, write: true },
        booked_calls: { read: true, write: true },
        backup: { read: true, write: true },
        subscriptions: { read: true, write: true },
        configurations: { read: true, write: true },
      },
      vendorScope: {
        type: "all",
        vendorIds: [],
      },
    },
  },
  {
    name: "Operations Lead",
    description: "Day-to-day platform management without critical DB backup or global config write",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    permissions: {
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
      vendorScope: {
        type: "all",
        vendorIds: [],
      },
    },
  },
  {
    name: "Vendor Account Manager",
    description: "Manages assigned vendor accounts, onboarding, and client communication",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    permissions: {
      roleName: "Vendor Account Manager",
      modules: {
        dashboard: { read: true, write: false },
        system_status: { read: false, write: false },
        vendors: { read: true, write: true },
        booked_calls: { read: true, write: true },
        backup: { read: false, write: false },
        subscriptions: { read: true, write: false },
        configurations: { read: false, write: false },
      },
      vendorScope: {
        type: "specific",
        vendorIds: [],
      },
    },
  },
  {
    name: "Customer Support Agent",
    description: "Read-only access to view vendors and troubleshoot customer issues",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    permissions: {
      roleName: "Customer Support Agent",
      modules: {
        dashboard: { read: true, write: false },
        system_status: { read: true, write: false },
        vendors: { read: true, write: false },
        booked_calls: { read: true, write: false },
        backup: { read: false, write: false },
        subscriptions: { read: false, write: false },
        configurations: { read: false, write: false },
      },
      vendorScope: {
        type: "all",
        vendorIds: [],
      },
    },
  },
  {
    name: "Finance & Billing Admin",
    description: "Manages subscriptions, prepaid plans, and invoices",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
    permissions: {
      roleName: "Finance & Billing Admin",
      modules: {
        dashboard: { read: true, write: false },
        system_status: { read: false, write: false },
        vendors: { read: true, write: false },
        booked_calls: { read: false, write: false },
        backup: { read: false, write: false },
        subscriptions: { read: true, write: true },
        configurations: { read: false, write: false },
      },
      vendorScope: {
        type: "all",
        vendorIds: [],
      },
    },
  },
]

/**
 * Normalizes raw JSON stored in user.permissions into a typed AdminUserPermissions object.
 */
export function normalizeAdminPermissions(raw: any, userRole?: string): AdminUserPermissions {
  if (userRole === "SUPER_ADMIN" || raw?.isSuperAdmin) {
    return {
      roleName: raw?.roleName || "Super Admin",
      isSuperAdmin: true,
      modules: {
        dashboard: { read: true, write: true },
        system_status: { read: true, write: true },
        vendors: { read: true, write: true },
        booked_calls: { read: true, write: true },
        backup: { read: true, write: true },
        subscriptions: { read: true, write: true },
        configurations: { read: true, write: true },
      },
      vendorScope: {
        type: "all",
        vendorIds: [],
      },
    }
  }

  const roleName = typeof raw?.roleName === "string" ? raw.roleName : "Custom Staff"
  const rawModules = raw?.modules || {}
  const rawScope = raw?.vendorScope || {}

  const defaultFalse: ModulePermission = { read: false, write: false }

  const modules: Record<AdminModuleKey, ModulePermission> = {
    dashboard: {
      read: Boolean(rawModules.dashboard?.read),
      write: Boolean(rawModules.dashboard?.write),
    },
    system_status: {
      read: Boolean(rawModules.system_status?.read),
      write: Boolean(rawModules.system_status?.write),
    },
    vendors: {
      read: Boolean(rawModules.vendors?.read),
      write: Boolean(rawModules.vendors?.write),
    },
    booked_calls: {
      read: Boolean(rawModules.booked_calls?.read),
      write: Boolean(rawModules.booked_calls?.write),
    },
    backup: {
      read: Boolean(rawModules.backup?.read),
      write: Boolean(rawModules.backup?.write),
    },
    subscriptions: {
      read: Boolean(rawModules.subscriptions?.read),
      write: Boolean(rawModules.subscriptions?.write),
    },
    configurations: {
      read: Boolean(rawModules.configurations?.read),
      write: Boolean(rawModules.configurations?.write),
    },
  }

  const vendorScope: VendorScope = {
    type: rawScope.type === "specific" ? "specific" : "all",
    vendorIds: Array.isArray(rawScope.vendorIds) ? rawScope.vendorIds : [],
  }

  return {
    roleName,
    isSuperAdmin: false,
    modules,
    vendorScope,
  }
}

/**
 * Checks whether a given admin user session possesses read or write permission for a module.
 */
export function verifyAdminPermission(
  user: any,
  module: AdminModuleKey,
  action: "read" | "write" = "read"
): { allowed: boolean; isSuperAdmin: boolean; isAllVendors: boolean; vendorIds: string[]; error?: string } {
  if (!user) {
    return { allowed: false, isSuperAdmin: false, isAllVendors: false, vendorIds: [], error: "Unauthorized" }
  }

  const role = String(user.role || "").toUpperCase()
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return { allowed: false, isSuperAdmin: false, isAllVendors: false, vendorIds: [], error: "Forbidden: Admin privileges required" }
  }

  if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
    return { allowed: false, isSuperAdmin: false, isAllVendors: false, vendorIds: [], error: "Account is inactive or suspended" }
  }

  // Super Admin bypasses all checks
  if (role === "SUPER_ADMIN") {
    return { allowed: true, isSuperAdmin: true, isAllVendors: true, vendorIds: [] }
  }

  const permissions = normalizeAdminPermissions(user.permissions, role)
  if (permissions.isSuperAdmin) {
    return { allowed: true, isSuperAdmin: true, isAllVendors: true, vendorIds: [] }
  }

  const mod = permissions.modules[module]
  if (!mod) {
    return { allowed: false, isSuperAdmin: false, isAllVendors: false, vendorIds: [], error: `No permission rule for module ${module}` }
  }

  const allowed = action === "write" ? Boolean(mod.write) : Boolean(mod.read || mod.write)

  if (!allowed) {
    return {
      allowed: false,
      isSuperAdmin: false,
      isAllVendors: false,
      vendorIds: [],
      error: `Forbidden: Missing ${action.toUpperCase()} permission on ${module}`,
    }
  }

  return {
    allowed: true,
    isSuperAdmin: false,
    isAllVendors: permissions.vendorScope.type === "all",
    vendorIds: permissions.vendorScope.vendorIds,
  }
}

/**
 * Resolves the vendor scope query filter for the authenticated admin user.
 */
export function getAdminVendorScope(user: any): { isAllVendors: boolean; allowedVendorIds: string[] } {
  if (!user) return { isAllVendors: false, allowedVendorIds: [] }
  const role = String(user.role || "").toUpperCase()
  if (role === "SUPER_ADMIN") {
    return { isAllVendors: true, allowedVendorIds: [] }
  }

  const permissions = normalizeAdminPermissions(user.permissions, role)
  if (permissions.isSuperAdmin || permissions.vendorScope.type === "all") {
    return { isAllVendors: true, allowedVendorIds: [] }
  }

  return {
    isAllVendors: false,
    allowedVendorIds: permissions.vendorScope.vendorIds || [],
  }
}

/**
 * Maps a pathname like /admin/vendors or /api/admin/vendors to its corresponding AdminModuleKey.
 */
export function mapPathToModule(pathname: string): AdminModuleKey | null {
  const clean = pathname.replace(/^\/(en|ur|hi|ar|bn)/, "")

  if (clean.startsWith("/admin/dashboard") || clean.startsWith("/api/admin/dashboard")) return "dashboard"
  if (clean.startsWith("/admin/system-status") || clean.startsWith("/api/admin/system-status") || clean.startsWith("/admin/dual-db-sync")) return "system_status"
  if (clean.startsWith("/admin/vendors") || clean.startsWith("/api/admin/vendors")) return "vendors"
  if (clean.startsWith("/admin/booked-calls") || clean.startsWith("/api/admin/booked-calls")) return "booked_calls"
  if (clean.startsWith("/admin/backup") || clean.startsWith("/api/admin/backup")) return "backup"
  if (clean.startsWith("/admin/subscriptions") || clean.startsWith("/api/admin/subscriptions")) return "subscriptions"
  if (clean.startsWith("/admin/configurations") || clean.startsWith("/api/admin/configurations") || clean.startsWith("/admin/staff") || clean.startsWith("/api/admin/staff")) return "configurations"

  return null
}

/**
 * Determines whether a user or JWT token represents a platform administration staff member
 * (either a full Super Admin, or an Admin staff member not tied to an individual vendor org).
 */
export function isPlatformAdminUser(user: any): boolean {
  if (!user) return false
  const role = String(user.role || "").toUpperCase()
  if (role === "SUPER_ADMIN") return true
  if (role === "ADMIN" && (!user.organizationId || !!(user.permissions as any)?.modules)) return true
  return false
}

/**
 * Resolves the primary landing admin route for an admin staff user based on their granted module permissions.
 */
export function getDefaultAdminRoute(user: any): string {
  if (!user) return "/admin/dashboard"
  const role = String(user.role || "").toUpperCase()
  if (role === "SUPER_ADMIN") return "/admin/dashboard"

  const candidateModules: { key: AdminModuleKey; route: string }[] = [
    { key: "dashboard", route: "/admin/dashboard" },
    { key: "vendors", route: "/admin/vendors" },
    { key: "booked_calls", route: "/admin/booked-calls" },
    { key: "subscriptions", route: "/admin/subscriptions" },
    { key: "system_status", route: "/admin/system-status" },
    { key: "backup", route: "/admin/backup" },
    { key: "configurations", route: "/admin/staff" },
  ]

  for (const candidate of candidateModules) {
    if (verifyAdminPermission(user, candidate.key, "read").allowed) {
      return candidate.route
    }
  }

  return "/admin/dashboard"
}
