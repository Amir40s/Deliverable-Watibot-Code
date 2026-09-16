"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import AddVendorSheet from "@/components/admin/vendors/AddVendorSheet"
import VendorDetailsSheet from "@/components/admin/vendors/VendorDetailsSheet"
import EditVendorSheet from "@/components/admin/vendors/EditVendorSheet"
import ManageVendorPermissionsModal from "@/components/admin/vendors/ManageVendorPermissionsModal"
import {
  updateUserAccountStatus,
  syncVendorWhatsAppStatus,
  syncAllVendorsWhatsAppStatus,
  disconnectVendorWhatsApp,
  deleteVendor,
  deleteVendorsBulk,
  type VendorRow,
} from "./actions"
import { exportVendorsToExcel, exportVendorsToPDF } from "@/lib/admin/vendor-export"
import {
  Plus, Search, Users, ShieldCheck, Activity,
  ChevronLeft, ChevronRight, Eye, LogIn, Mail,
  Loader2, Building2, Crown, TrendingUp, ArrowUpDown,
  AlertCircle, Phone, MessageSquare, Calendar, Clock, CreditCard,
  CheckCircle2, XCircle, MoreVertical, Bot, Ban, RefreshCw, Unlink,
  Download, FileSpreadsheet, FileText, Trash2, ChevronDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { impersonateUser } from "@/app/actions/impersonate"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface VendorsPageClientProps {
  initialVendors: VendorRow[]
  initialFilter?: string
  canWrite?: boolean
}

export type VendorStatusFilter = 
  | "ALL"
  | "ACTIVE"
  | "EXPIRED"
  | "EXPIRE_SOON"
  | "PENDING_PLAN"
  | "WABA_ACTIVE"
  | "BANNED"
  | "DISCONNECTED"
  | "SUSPENDED"
  | "TRIAL"

function normalizeFilterValue(val?: string): VendorStatusFilter {
  if (!val) return "ALL"
  const clean = val.toUpperCase().replace(/[_-]/g, "")
  if (clean === "ACTIVE") return "ACTIVE"
  if (clean === "EXPIRED") return "EXPIRED"
  if (clean === "EXPIRESOON") return "EXPIRE_SOON"
  if (clean === "PENDINGPLAN" || clean === "PENDING") return "PENDING_PLAN"
  if (clean === "WABAACTIVE") return "WABA_ACTIVE"
  if (clean === "BANNED") return "BANNED"
  if (clean === "DISCONNECTED") return "DISCONNECTED"
  if (clean === "SUSPENDED") return "SUSPENDED"
  if (clean === "TRIAL") return "TRIAL"
  return "ALL"
}

const USER_STATUS_BADGES: Record<string, { bg: string, dot: string, text: string }> = {
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-950/30", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  TRIAL: { bg: "bg-amber-50 dark:bg-amber-950/30", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  PENDING: { bg: "bg-amber-50 dark:bg-amber-950/30", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  SUSPENDED: { bg: "bg-rose-50 dark:bg-rose-950/30", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
}

const SUBSCRIPTION_STATUS_BADGES: Record<string, { bg: string, text: string, border: string }> = {
  active: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-500/20" },
  trial: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  expired: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
  pending: { bg: "bg-slate-50 dark:bg-slate-500/10", text: "text-slate-700 dark:text-slate-400", border: "border-slate-200 dark:border-slate-500/20" },
}

const WHATSAPP_STATUS_BADGES: Record<string, { bg: string, text: string, border: string }> = {
  LIVE: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20" },
  APPROVED: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20" },
  CONNECTED: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20" },
  BANNED: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20 animate-pulse" },
  BLOCKED: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
  DISABLED: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
  SUSPENDED: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
  TOKEN_EXPIRED: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
  RESTRICTED: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  FLAGGED: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  RATE_LIMITED: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  PENDING: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  UNVERIFIED: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  DISCONNECTED: { bg: "bg-slate-50 dark:bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-500/20" },
}

function formatDate(dateString: any) {
  if (!dateString) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString))
  } catch {
    return "—"
  }
}

function formatTimeAgo(dateString: any) {
  if (!dateString) return "Never"
  try {
    const d = new Date(dateString)
    const diff = (new Date().getTime() - d.getTime()) / 1000
    if (diff < 60) return "Just now"
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    if (diff < 2592000) return `${Math.floor(diff/86400)}d ago`
    return formatDate(dateString)
  } catch {
    return "Never"
  }
}

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, gradient, textColor, subLabel,
}: {
  label: string; value: string | number; icon: any
  gradient: string; textColor: string; subLabel?: string
}) {
  return (
    <div className="relative rounded-3xl p-5 overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm flex flex-col justify-between min-h-[110px] hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center mb-3 shadow-sm border border-slate-100 dark:border-slate-700">
        <Icon className={cn("w-5 h-5", textColor)} />
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-800 dark:text-white leading-none tracking-tight">{value}</p>
        <p className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
        {subLabel && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">{subLabel}</p>}
      </div>
    </div>
  )
}

// ─── Vendor Row Component ─────────────────────────────────────────────────────
function VendorRow({
  vendor,
  isSelected,
  onToggleSelect,
  onView,
  onManagePermissions,
  onSyncWhatsAppStatus,
  isSyncing,
  onDisconnectWhatsApp,
  onDelete,
  canWrite = true,
}: {
  vendor: any
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onView: (v: any) => void
  onManagePermissions: (v: any) => void
  onSyncWhatsAppStatus?: (id: string) => void
  isSyncing?: boolean
  onDisconnectWhatsApp?: (id: string) => void
  onDelete: (vendor: any) => void
  canWrite?: boolean
}) {
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const { data: session } = useSession()

  const handleStatusChange = async (newStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED') => {
    if (!vendor.userId) {
      toast.error("User ID not found for this vendor")
      return
    }
    setIsUpdatingStatus(true)
    try {
      const res = await updateUserAccountStatus(vendor.userId, newStatus)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`User status updated to ${newStatus}`)
      }
    } catch {
      toast.error("Failed to update user status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleImpersonate = async () => {
    if (!vendor.userId) { toast.error("User ID not found for this vendor"); return }
    setIsImpersonating(true)
    try {
      const result = await impersonateUser(vendor.userId)
      if (result.error) { toast.error(result.error); return }
      if (result.success && result.email && result.token) {
        await signIn("credentials", {
          email: result.email,
          impersonationToken: result.token,
          originalAdminId: session?.user?.id || "",
          originalAdminEmail: session?.user?.email || "",
          callbackUrl: "/dashboard",
          redirect: true,
        })
      }
    } catch {
      toast.error("Failed to sign in as user")
    } finally {
      setIsImpersonating(false)
    }
  }

  const initials = (vendor.adminName || vendor.title || "V")
    .split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()
  
  const userStatusName = (vendor.status || "ACTIVE").toUpperCase()
  const userStatusBadge = USER_STATUS_BADGES[userStatusName] || USER_STATUS_BADGES.ACTIVE
  
  const subStatusName = (vendor.subscriptionStatus || "active").toLowerCase()
  const subStatusBadge = SUBSCRIPTION_STATUS_BADGES[subStatusName] || SUBSCRIPTION_STATUS_BADGES.active

  return (
    <tr className={cn(
      "group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors duration-200 border-b border-slate-100 dark:border-slate-800/60 last:border-0",
      isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
    )}>
      {/* Checkbox */}
      <td className="py-4 pl-6 pr-2 align-top w-12">
        <div className="flex items-center justify-center pt-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(vendor.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#00a884] focus:ring-[#00a884]/20 cursor-pointer accent-[#00a884]"
            title="Select vendor"
          />
        </div>
      </td>

      {/* Vendor Info */}
      <td className="py-4 px-6 align-top min-w-[240px]">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center font-bold text-sm bg-gradient-to-br from-[#00a884]/10 to-emerald-600/10 text-[#00a884] dark:from-[#00a884]/20 dark:to-emerald-600/20 ring-1 ring-[#00a884]/20 shadow-sm mt-0.5">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-[#00a884] transition-colors">
              {vendor.title}
            </span>
            <span className="text-[10px] font-medium text-slate-500 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
              <span>ID: {vendor.id?.substring(0, 8)}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              <span>Joined {formatDate(vendor.createdAt)}</span>
            </span>
            <div className="flex flex-col gap-1.5 mt-2.5">
              {vendor.whatsappNumber ? (
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-800 whitespace-nowrap shrink-0">
                    <Phone className="w-2.5 h-2.5" />
                    {vendor.whatsappNumber}
                  </span>
                  {vendor.whatsappStatus && (
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold uppercase tracking-wide border leading-none whitespace-nowrap shrink-0",
                        (WHATSAPP_STATUS_BADGES[vendor.whatsappStatus.toUpperCase()] || WHATSAPP_STATUS_BADGES.PENDING).bg,
                        (WHATSAPP_STATUS_BADGES[vendor.whatsappStatus.toUpperCase()] || WHATSAPP_STATUS_BADGES.PENDING).text,
                        (WHATSAPP_STATUS_BADGES[vendor.whatsappStatus.toUpperCase()] || WHATSAPP_STATUS_BADGES.PENDING).border
                      )}>
                        {vendor.whatsappStatus}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSyncWhatsAppStatus?.(vendor.id) }}
                        disabled={isSyncing}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-[#00a884] transition-colors"
                        title="Refresh WhatsApp Status from Meta"
                      >
                        <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin text-[#00a884]")} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
                    <XCircle className="w-3 h-3" />
                    Not Connected
                  </span>
                  {vendor.whatsappStatus && vendor.whatsappStatus !== 'DISCONNECTED' && (
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold uppercase tracking-wide border leading-none whitespace-nowrap shrink-0",
                        (WHATSAPP_STATUS_BADGES[vendor.whatsappStatus.toUpperCase()] || WHATSAPP_STATUS_BADGES.DISCONNECTED).bg,
                        (WHATSAPP_STATUS_BADGES[vendor.whatsappStatus.toUpperCase()] || WHATSAPP_STATUS_BADGES.DISCONNECTED).text,
                        (WHATSAPP_STATUS_BADGES[vendor.whatsappStatus.toUpperCase()] || WHATSAPP_STATUS_BADGES.DISCONNECTED).border
                      )}>
                        {vendor.whatsappStatus}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSyncWhatsAppStatus?.(vendor.id) }}
                        disabled={isSyncing}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-[#00a884] transition-colors"
                        title="Refresh WhatsApp Status from Meta"
                      >
                        <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin text-[#00a884]")} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDisconnectWhatsApp?.(vendor.id) }}
                        className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                        title="Disconnect WhatsApp Connection"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Contact Person */}
      <td className="py-4 px-6 align-top">
        <div className="flex flex-col gap-2 min-w-[180px]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3 text-slate-500" />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
              {vendor.adminName || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Mail className="w-3 h-3 text-slate-500" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {vendor.email || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Phone className="w-3 h-3 text-slate-500" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {vendor.phoneNumber || "—"}
            </span>
          </div>
        </div>
      </td>

      {/* Plan & Activity */}
      <td className="py-4 px-6 align-top">
        <div className="flex flex-col gap-2.5">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-black tracking-widest border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
              <Crown className="w-3 h-3" />
              {(vendor.plan || "Free").toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-0.5">
            <div className="flex items-center gap-2" title="Total Contacts">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {vendor.contactsCount?.toLocaleString() || 0} <span className="text-[10px] font-medium text-slate-400 ml-0.5">contacts</span>
              </span>
            </div>
            <div className="flex items-center gap-2" title="Last Login">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {formatTimeAgo(vendor.lastLoginAt)} <span className="text-[10px] font-medium text-slate-400 ml-0.5">login</span>
              </span>
            </div>
            <div className="flex items-center gap-2" title="AI Replies Status">
              <Bot className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                AI Replies: <span className={cn(
                  "font-bold text-[10px] uppercase px-1.5 py-0.5 rounded-md",
                  vendor.isAiBotEnabled 
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                )}>{vendor.isAiBotEnabled ? "ON" : "OFF"}</span>
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 px-6 align-top">
        <div className="flex flex-col gap-1 whitespace-nowrap">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {formatDate(vendor.planStartDate)}
          </span>
          <span className="text-[10px] font-medium text-slate-400">Start Date</span>
        </div>
      </td>
      <td className="py-4 px-6 align-top">
        <div className="flex flex-col gap-1 whitespace-nowrap">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {formatDate(vendor.planEndDate)}
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            {vendor.planEndDate && new Date(vendor.planEndDate) < new Date() ? (
              <span className="text-rose-500 font-bold">Expired</span>
            ) : (
              "Expiry Date"
            )}
          </span>
        </div>
      </td>

      {/* Statuses (Subscription & User) */}
      <td className="py-4 px-6 min-w-[140px] align-top">
        <div className="flex flex-col gap-2.5 items-start">
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
            subStatusBadge.bg, subStatusBadge.text, subStatusBadge.border
          )} title="Subscription Status">
            {subStatusName}
          </div>
          
          <div className={cn(
            "inline-flex justify-center items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-transparent",
            userStatusBadge.bg, userStatusBadge.text
          )} title="User Status">
            <span className={cn("w-1.5 h-1.5 rounded-full relative flex shrink-0")}>
              {userStatusName === "ACTIVE" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={cn("relative inline-flex rounded-full w-1.5 h-1.5", userStatusBadge.dot)} />
            </span>
            {userStatusName}
          </div>
        </div>
      </td>

      {/* Actions */}
      <td className="py-4 pl-8 pr-6 align-top text-right min-w-[270px] whitespace-nowrap">
        <div className="flex items-center justify-end gap-2 flex-nowrap">
          {/* Sign In */}
          <button
            onClick={handleImpersonate}
            disabled={isImpersonating}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#00a884] to-emerald-600 hover:from-[#009272] hover:to-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 shrink-0 cursor-pointer"
            title="Sign in as vendor"
          >
            {isImpersonating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            Sign In
          </button>
          
          {/* View Details */}
          <button
            onClick={() => onView(vendor)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors shrink-0 cursor-pointer"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>

          {/* Manage Sidebar Permissions */}
          {canWrite && (
            <button
              onClick={() => onManagePermissions(vendor)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all active:scale-[0.98] shrink-0 cursor-pointer"
              title="Manage Sidebar Permissions"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Permissions
            </button>
          )}

          {/* Account Status Actions */}
          {canWrite && (userStatusName === "PENDING" || userStatusName === "SUSPENDED") && (
            <button
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={isUpdatingStatus}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer shrink-0"
              title="Click to Approve Account Access"
            >
              {isUpdatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve Account
            </button>
          )}

          {canWrite && userStatusName === "ACTIVE" && (
            <button
              onClick={() => handleStatusChange("SUSPENDED")}
              disabled={isUpdatingStatus}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer shrink-0"
              title="Click to Suspend Account Access"
            >
              {isUpdatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
              Suspend Account
            </button>
          )}

          {/* Delete Vendor Action */}
          {canWrite && (
            <button
              onClick={() => onDelete(vendor)}
              className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-900/60 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition-all active:scale-[0.98] shrink-0 cursor-pointer"
              title="Delete Vendor"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
const PAGE_SIZE_OPTIONS: (number | "ALL")[] = [10, 25, 50, "ALL"]
export default function VendorsPageClient({ initialVendors, initialFilter, canWrite = true }: VendorsPageClientProps) {
  const [vendors, setVendors] = useState<VendorRow[]>(initialVendors)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isExportOpen, setIsExportOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Deletion modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    type: "single" | "bulk"
    vendor?: any
    ids: string[]
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [permissionsVendor, setPermissionsVendor] = useState<any>(null)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<VendorStatusFilter>(() => normalizeFilterValue(initialFilter))
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState<number | "ALL">(10)

  // Sorting state
  const [sortField, setSortField] = useState<string>("createdAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncingVendorId, setSyncingVendorId] = useState<string | null>(null)
  const router = useRouter()

  // Synchronize when initialVendors changes
  useEffect(() => {
    setVendors(initialVendors)
  }, [initialVendors])

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSyncAllStatus = async () => {
    setIsSyncingAll(true)
    const toastId = toast.loading("Syncing WhatsApp phone statuses with Meta...")
    const res = await syncAllVendorsWhatsAppStatus()
    setIsSyncingAll(false)
    if (res.error) {
      toast.error(res.error, { id: toastId })
    } else {
      toast.success(`Synced status for ${res.count} vendors from Meta`, { id: toastId })
      router.refresh()
    }
  }

  const handleSyncSingleVendor = async (vendorId: string) => {
    setSyncingVendorId(vendorId)
    const toastId = toast.loading("Syncing status with Meta...")
    const res = await syncVendorWhatsAppStatus(vendorId)
    setSyncingVendorId(null)
    if (res.error) {
      toast.error(res.error, { id: toastId })
    } else {
      toast.success(`WhatsApp status updated to ${res.status}`, { id: toastId })
      router.refresh()
    }
  }

  const handleDisconnectSingleVendor = async (vendorId: string) => {
    if (!confirm("Are you sure you want to disconnect WhatsApp connection for this vendor?")) return;
    const toastId = toast.loading("Disconnecting WhatsApp...")
    const res = await disconnectVendorWhatsApp(vendorId)
    if (res.error) {
      toast.error(res.error, { id: toastId })
    } else {
      toast.success("WhatsApp disconnected successfully", { id: toastId })
      router.refresh()
    }
  }

  const handleViewVendor = (vendor: any) => { setSelectedVendor(vendor); setIsDetailsSheetOpen(true) }
  const handleEditClick  = () => { setIsDetailsSheetOpen(false); setIsEditSheetOpen(true) }

  // Checkbox selection handlers
  const handleToggleSelectAll = () => {
    const currentPageIds = paginated.map(v => v.id)
    const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id))

    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allCurrentPageSelected) {
        currentPageIds.forEach(id => next.delete(id))
      } else {
        currentPageIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Export handler (Excel / PDF)
  const handleExport = (format: "excel" | "pdf", onlySelected = false) => {
    setIsExportOpen(false)
    const targetVendors = onlySelected
      ? vendors.filter(v => selectedIds.has(v.id))
      : filtered

    if (targetVendors.length === 0) {
      toast.error("No vendors to export")
      return
    }

    const toastId = toast.loading(`Preparing ${format === "excel" ? "Excel (.xlsx)" : "PDF (.pdf)"} report...`)
    try {
      if (format === "excel") {
        exportVendorsToExcel(targetVendors, {
          filterName: statusFilter,
          searchQuery: search,
          totalCount: targetVendors.length,
        })
      } else {
        exportVendorsToPDF(targetVendors, {
          filterName: statusFilter,
          searchQuery: search,
          totalCount: targetVendors.length,
        })
      }
      toast.success(`${format.toUpperCase()} export downloaded successfully (${targetVendors.length} records)`, { id: toastId })
    } catch (err: any) {
      console.error("Export error:", err)
      toast.error(err.message || "Failed to generate export file", { id: toastId })
    }
  }

  // Deletion modal triggers
  const handleOpenSingleDelete = (vendor: any) => {
    setDeleteModalState({
      type: "single",
      vendor,
      ids: [vendor.id],
    })
  }

  const handleOpenBulkDelete = () => {
    if (selectedIds.size === 0) return
    setDeleteModalState({
      type: "bulk",
      ids: Array.from(selectedIds),
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteModalState) return
    setIsDeleting(true)
    const count = deleteModalState.ids.length
    const toastId = toast.loading(
      deleteModalState.type === "single"
        ? "Deleting vendor and associated data..."
        : `Deleting ${count} selected vendor(s)...`
    )

    try {
      if (deleteModalState.type === "single") {
        const res = await deleteVendor(deleteModalState.ids[0])
        if (res.error) {
          toast.error(res.error, { id: toastId })
          setIsDeleting(false)
          return
        }
      } else {
        const res = await deleteVendorsBulk(deleteModalState.ids)
        if (res.error) {
          toast.error(res.error, { id: toastId })
          setIsDeleting(false)
          return
        }
      }

      // Optimistic update
      const deletedSet = new Set(deleteModalState.ids)
      setVendors(prev => prev.filter(v => !deletedSet.has(v.id)))
      setSelectedIds(prev => {
        const next = new Set(prev)
        deleteModalState.ids.forEach(id => next.delete(id))
        return next
      })

      toast.success(
        deleteModalState.type === "single"
          ? "Vendor deleted successfully"
          : `Successfully deleted ${count} vendor(s)`,
        { id: toastId }
      )

      setDeleteModalState(null)
      router.refresh()
    } catch (err: any) {
      console.error("Delete error:", err)
      toast.error(err.message || "Failed to delete vendor(s)", { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  const counts = useMemo(() => {
    const now = Date.now()
    const in5Days = now + 5 * 24 * 60 * 60 * 1000

    return {
      all: vendors.length,
      active: vendors.filter(v => 
        (v.status === "ACTIVE" || v.subscriptionStatus === "active") && 
        (v.whatsappStatus === "LIVE" || v.whatsappStatus === "CONNECTED" || v.whatsappStatus === "APPROVED")
      ).length,
      expired: vendors.filter(v => 
        v.status === "EXPIRED" || 
        v.subscriptionStatus === "expired" || 
        (!!v.planEndDate && new Date(v.planEndDate).getTime() < now)
      ).length,
      expireSoon: vendors.filter(v => 
        !!v.planEndDate && 
        new Date(v.planEndDate).getTime() >= now && 
        new Date(v.planEndDate).getTime() <= in5Days
      ).length,
      pendingPlan: vendors.filter(v => 
        v.status === "PENDING" || 
        v.subscriptionStatus === "pending" || 
        !v.plan || 
        v.plan.toLowerCase() === "free" || 
        v.plan.toLowerCase() === "pending"
      ).length,
      wabaActive: vendors.filter(v => 
        v.whatsappStatus === "LIVE" || 
        v.whatsappStatus === "CONNECTED" || 
        v.whatsappStatus === "APPROVED"
      ).length,
      banned: vendors.filter(v => 
        ["BANNED", "DISABLED", "BLOCKED", "RESTRICTED"].includes(v.whatsappStatus || "")
      ).length,
      disconnected: vendors.filter(v => 
        !v.whatsappStatus || v.whatsappStatus === "DISCONNECTED"
      ).length,
      suspended: vendors.filter(v => 
        v.status === "SUSPENDED" || v.subscriptionStatus === "suspended"
      ).length,
      trial: vendors.filter(v => 
        v.status === "TRIAL" || v.subscriptionStatus === "trial" || v.plan?.toLowerCase() === "trial"
      ).length,
    }
  }, [vendors])

  const filtered = useMemo(() => {
    const now = Date.now()
    const in5Days = now + 5 * 24 * 60 * 60 * 1000

    return vendors.filter(v => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        v.title?.toLowerCase().includes(q) ||
        v.adminName?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.whatsappNumber?.toLowerCase().includes(q) ||
        v.phoneNumber?.toLowerCase().includes(q)

      if (!matchSearch) return false

      const isVendorActive = v.status === "ACTIVE" || v.subscriptionStatus === "active"
      const isWaLive = v.whatsappStatus === "LIVE" || v.whatsappStatus === "CONNECTED" || v.whatsappStatus === "APPROVED"

      switch (statusFilter) {
        case "ALL":
          return true
        case "ACTIVE":
          return isVendorActive && isWaLive
        case "EXPIRED":
          return v.status === "EXPIRED" || v.subscriptionStatus === "expired" || (!!v.planEndDate && new Date(v.planEndDate).getTime() < now)
        case "EXPIRE_SOON":
          return !!v.planEndDate && new Date(v.planEndDate).getTime() >= now && new Date(v.planEndDate).getTime() <= in5Days
        case "PENDING_PLAN":
          return v.status === "PENDING" || v.subscriptionStatus === "pending" || !v.plan || v.plan.toLowerCase() === "free" || v.plan.toLowerCase() === "pending"
        case "WABA_ACTIVE":
          return isWaLive
        case "BANNED":
          return ["BANNED", "DISABLED", "BLOCKED", "RESTRICTED"].includes(v.whatsappStatus || "")
        case "DISCONNECTED":
          return !v.whatsappStatus || v.whatsappStatus === "DISCONNECTED"
        case "SUSPENDED":
          return v.status === "SUSPENDED" || v.subscriptionStatus === "suspended"
        case "TRIAL":
          return v.status === "TRIAL" || v.subscriptionStatus === "trial" || v.plan?.toLowerCase() === "trial"
        default:
          return true
      }
    })
  }, [vendors, search, statusFilter])

  // Client-side sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let valA = a[sortField] || ""
      let valB = b[sortField] || ""

      if (sortField === 'contactsCount') {
        valA = Number(valA)
        valB = Number(valB)
      } else {
        if (typeof valA === "string") valA = valA.toLowerCase()
        if (typeof valB === "string") valB = valB.toLowerCase()
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1
      if (valA > valB) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [filtered, sortField, sortDirection])

  const effectivePerPage = perPage === "ALL" ? sorted.length : perPage
  const totalPages = perPage === "ALL" ? 1 : Math.ceil(sorted.length / effectivePerPage)
  const paginated  = perPage === "ALL" ? sorted : sorted.slice((currentPage - 1) * effectivePerPage, currentPage * effectivePerPage)

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const STATUS_TABS: { label: string; value: VendorStatusFilter; count: number }[] = [
    { label: "All",          value: "ALL",          count: counts.all },
    { label: "Active",       value: "ACTIVE",       count: counts.active },
    { label: "Expired",      value: "EXPIRED",      count: counts.expired },
    { label: "Expire Soon",  value: "EXPIRE_SOON",  count: counts.expireSoon },
    { label: "Pending Plan", value: "PENDING_PLAN", count: counts.pendingPlan },
    { label: "WABA Active",  value: "WABA_ACTIVE",  count: counts.wabaActive },
    { label: "Banned",       value: "BANNED",       count: counts.banned },
    { label: "Disconnected", value: "DISCONNECTED", count: counts.disconnected },
    { label: "Suspended",    value: "SUSPENDED",    count: counts.suspended },
    { label: "Trial",        value: "TRIAL",        count: counts.trial },
  ]

  return (
    <div 
      className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#F4F6F9] dark:bg-slate-950 min-h-screen flex flex-col"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >

      {/* ── Hero Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
        <div className="px-8 pt-8 pb-6">

          {/* Title + CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Vendors & Accounts</h1>
              <p className="text-sm text-slate-500 font-medium">Manage all organizations, their subscriptions and activities.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl text-sm font-bold shadow-sm hover:shadow transition-all cursor-pointer"
                  title="Export Vendors Data"
                >
                  <Download className="w-4 h-4 text-[#00a884]" />
                  <span>Export</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", isExportOpen && "rotate-180")} />
                </button>

                {isExportOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Export Options</p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {selectedIds.size > 0 ? `${selectedIds.size} vendor(s) selected` : `${filtered.length} vendor(s) matching filter`}
                      </p>
                    </div>
                    <div className="mt-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => handleExport("excel", selectedIds.size > 0)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-bold transition-colors cursor-pointer text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 text-[#00a884]">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                          <div>Export to Excel (.xlsx)</div>
                          <div className="text-[10px] font-medium text-slate-400">Complete spreadsheet data</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport("pdf", selectedIds.size > 0)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center shrink-0 text-rose-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div>Export to PDF (.pdf)</div>
                          <div className="text-[10px] font-medium text-slate-400">Executive tabular report</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {canWrite ? (
                <button
                  onClick={() => setIsAddSheetOpen(true)}
                  className="flex items-center gap-2 bg-gradient-to-br from-[#00a884] to-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  New Vendor
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800">
                  <ShieldCheck className="w-4 h-4" />
                  Read-Only Mode
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Vendors" value={counts.all}
              icon={Building2}
              gradient=""
              textColor="text-slate-600 dark:text-slate-400"
              subLabel="All registered organizations"
            />
            <StatCard
              label="Active Accounts" value={counts.active}
              icon={Activity}
              gradient=""
              textColor="text-[#00a884]"
              subLabel="Live subscriptions"
            />
            <StatCard
              label="In Trial" value={counts.trial}
              icon={TrendingUp}
              gradient=""
              textColor="text-amber-500"
              subLabel="Evaluation period"
            />
            <StatCard
              label="Pending" value={counts.pendingPlan}
              icon={Users}
              gradient=""
              textColor="text-rose-500"
              subLabel="Awaiting activation"
            />
          </div>

          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
            <div className="relative w-full xl:max-w-[280px] group shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors" />
              <input
                type="text"
                placeholder="Search by name, email, phone…"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-all"
              />
            </div>

            {/* Status tabs */}
            <div className="flex items-center min-w-0 flex-1 overflow-x-auto bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/50 dark:border-slate-700/50 shadow-inner scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 gap-0.5">
              {STATUS_TABS.map(tab => {
                const isSelected = statusFilter === tab.value
                return (
                  <button
                    key={tab.value}
                    onClick={() => { 
                      setStatusFilter(tab.value)
                      setCurrentPage(1)
                      if (typeof window !== "undefined") {
                        const url = new URL(window.location.href)
                        if (tab.value === "ALL") {
                          url.searchParams.delete("filter")
                          url.searchParams.delete("status")
                        } else {
                          url.searchParams.set("filter", tab.value.toLowerCase().replace(/_/g, "-"))
                        }
                        window.history.pushState(null, '', url.toString())
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0",
                      isSelected
                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50"
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      "text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums",
                      isSelected
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        : "bg-slate-200/80 dark:bg-slate-700 text-slate-500"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Per-page selector */}
            <div className="flex items-center gap-1.5 xl:ml-auto shrink-0 self-end xl:self-center">
              <span className="text-xs font-semibold text-slate-500">Show</span>
              <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
                {PAGE_SIZE_OPTIONS.map(size => (
                  <button
                    key={size}
                    onClick={() => { setPerPage(size); setCurrentPage(1) }}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                      perPage === size
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table / Grid View ── */}
      <div className="px-8 py-8 flex-1">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-4">
              <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6 shadow-inner">
                <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No vendors found</h3>
              <p className="text-slate-500 text-sm max-w-sm">We couldn't find any vendors matching your current search criteria or filters. Try adjusting them.</p>
              {(search || statusFilter !== "ALL") && (
                <button
                  onClick={() => { 
                    setSearch("")
                    setStatusFilter("ALL")
                    setCurrentPage(1)
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href)
                      url.searchParams.delete("filter")
                      url.searchParams.delete("status")
                      window.history.pushState(null, '', url.toString())
                    }
                  }}
                  className="mt-6 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="py-4 pl-6 pr-2 w-12 text-center">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={paginated.length > 0 && paginated.every(v => selectedIds.has(v.id))}
                          ref={input => {
                            if (input) {
                              const hasSome = paginated.some(v => selectedIds.has(v.id))
                              const hasAll = paginated.length > 0 && paginated.every(v => selectedIds.has(v.id))
                              input.indeterminate = hasSome && !hasAll
                            }
                          }}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#00a884] focus:ring-[#00a884]/20 cursor-pointer accent-[#00a884]"
                          title="Select all on this page"
                        />
                      </div>
                    </th>

                    <th className="py-4 px-6 min-w-[240px]">
                      <button 
                        onClick={() => handleSort("title")} 
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        Vendor Info
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    <th className="py-4 px-6 min-w-[200px]">
                      <button 
                        onClick={() => handleSort("adminName")} 
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        Contact Person
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    <th className="py-4 px-6 min-w-[160px]">
                      <button 
                        onClick={() => handleSort("contactsCount")} 
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        Plan & Activity
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    <th className="py-4 px-6 min-w-[130px]">
                      <button 
                        onClick={() => handleSort("planStartDate")} 
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        Plan Start
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    <th className="py-4 px-6 min-w-[130px]">
                      <button 
                        onClick={() => handleSort("planEndDate")} 
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        Plan End
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    <th className="py-4 px-6 min-w-[140px]">
                      <button 
                        onClick={() => handleSort("status")} 
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider"
                      >
                        Status
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    <th className="py-4 pl-8 pr-6 text-right text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[270px]">
                      Actions
                    </th>

                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
                  {paginated.map((vendor: any) => (
                    <VendorRow
                      key={vendor.id}
                      vendor={vendor}
                      isSelected={selectedIds.has(vendor.id)}
                      onToggleSelect={handleToggleSelectOne}
                      onView={handleViewVendor}
                      onManagePermissions={(v) => {
                        setPermissionsVendor(v)
                        setIsPermissionsModalOpen(true)
                      }}
                      onSyncWhatsAppStatus={handleSyncSingleVendor}
                      onDisconnectWhatsApp={handleDisconnectSingleVendor}
                      onDelete={handleOpenSingleDelete}
                      canWrite={canWrite}
                      isSyncing={syncingVendorId === vendor.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-slate-500">
              Page {currentPage} of {totalPages} ({filtered.length} total vendors)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (totalPages > 7 && Math.abs(currentPage - page) > 2 && page !== 1 && page !== totalPages) {
                  if (Math.abs(currentPage - page) === 3) {
                    return <span key={page} className="px-1 text-slate-400 font-bold text-xs">...</span>
                  }
                  return null
                }

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn("w-9 h-9 rounded-lg text-sm font-bold transition-all",
                      currentPage === page
                        ? "bg-gradient-to-br from-[#00a884] to-emerald-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    {page}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-xl px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center gap-4 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00a884] animate-pulse" />
              <span className="text-white font-bold">{selectedIds.size}</span>
              <span className="text-slate-300 text-xs">vendor{selectedIds.size > 1 ? "s" : ""} selected</span>
            </div>

            <div className="h-4 w-px bg-slate-700" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("excel", true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                title="Export selected vendors to Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Excel
              </button>

              <button
                type="button"
                onClick={() => handleExport("pdf", true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                title="Export selected vendors to PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                PDF
              </button>

              {canWrite && (
                <button
                  type="button"
                  onClick={handleOpenBulkDelete}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all hover:shadow-md cursor-pointer ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.size})
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 text-xs font-medium cursor-pointer"
                title="Clear Selection"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Safety Modal */}
      {deleteModalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {deleteModalState.type === "single"
                    ? "Delete Vendor"
                    : `Delete ${deleteModalState.ids.length} Vendors`}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 mb-6">
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                {deleteModalState.type === "single" ? (
                  <>
                    Are you sure you want to permanently delete{" "}
                    <strong className="font-bold">{deleteModalState.vendor?.title || "this vendor"}</strong>?
                    All associated users, contacts, messages, subscriptions, and configurations will be permanently removed.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete{" "}
                    <strong className="font-bold">{deleteModalState.ids.length} selected vendor(s)</strong>?
                    All associated users, contacts, messages, subscriptions, and configurations will be permanently removed.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalState(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
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
                    Yes, Delete {deleteModalState.type === "single" ? "Vendor" : `${deleteModalState.ids.length} Vendors`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddVendorSheet isOpen={isAddSheetOpen} onClose={() => setIsAddSheetOpen(false)} />
      <VendorDetailsSheet
        isOpen={isDetailsSheetOpen}
        onClose={() => setIsDetailsSheetOpen(false)}
        vendor={selectedVendor}
        onEditClick={handleEditClick}
        onManagePermissionsClick={(v) => {
          setIsDetailsSheetOpen(false)
          setPermissionsVendor(v)
          setIsPermissionsModalOpen(true)
        }}
      />
      <EditVendorSheet isOpen={isEditSheetOpen} onClose={() => setIsEditSheetOpen(false)} vendor={selectedVendor} />
      <ManageVendorPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        vendor={permissionsVendor}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
