"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Edit, Key, Trash, Loader2, Phone, Calendar, Hash, Crown, ShieldCheck, X,
  Building2, User, Users, Mail, Globe, Clock, CheckCircle2, XCircle, AlertCircle,
  MessageSquare, Zap, Activity, RefreshCw, LogIn, ChevronRight, LayoutDashboard, Copy,
  CreditCard, Smartphone, Shield, Box, Settings, Bot, BookOpen
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { toast } from "sonner"
import { deleteVendor, changeVendorPassword, updateVendor, getVendorFullDetails, syncVendorWhatsAppStatus } from "@/app/[locale]/admin/vendors/actions"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

interface VendorDetailsSheetProps {
  isOpen: boolean
  onClose: () => void
  vendor: any
  onEditClick?: () => void
  onManagePermissionsClick?: (vendor: any) => void
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
  TRIAL: "bg-amber-50 text-amber-700 border-amber-100",
  PENDING: "bg-rose-50 text-rose-700 border-rose-100",
  INACTIVE: "bg-slate-100 text-slate-600 border-slate-200",
}

function SectionHeading({ title, icon: Icon }: { title: string, icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0">
      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest">{title}</h3>
    </div>
  )
}

function DetailRow({ label, value, valueNode }: { label: string, value?: string | number | null, valueNode?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0 gap-4">
      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap pt-0.5 shrink-0">{label}</span>
      {valueNode ? valueNode : (
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 text-right break-words [overflow-wrap:anywhere] [word-break:break-word] select-all">
          {value || "N/A"}
        </span>
      )}
    </div>
  )
}

export default function VendorDetailsSheet({ isOpen, onClose, vendor, onEditClick, onManagePermissionsClick }: VendorDetailsSheetProps) {
  const t = useTranslations("Vendors")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")

  const [details, setDetails] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncingWhatsApp, setIsSyncingWhatsApp] = useState(false)

  const handleSyncWhatsApp = async () => {
    if (!vendor?.id) return
    setIsSyncingWhatsApp(true)
    const toastId = toast.loading("Querying Meta Cloud API for live phone status...")
    const res = await syncVendorWhatsAppStatus(vendor.id)
    setIsSyncingWhatsApp(false)
    if (res.error) {
      toast.error(res.error, { id: toastId })
    } else {
      toast.success(`Live status from Meta: ${res.status}`, { id: toastId })
      getVendorFullDetails(vendor.id).then(r => { if (r.success && r.data) setDetails(r.data) })
    }
  }

  useEffect(() => {
    if (isOpen && vendor?.id) {
      setIsLoading(true)
      getVendorFullDetails(vendor.id).then(res => {
        if (res.success && res.data) {
          setDetails(res.data)
        }
        setIsLoading(false)
      })
    } else {
      setDetails(null)
    }
  }, [isOpen, vendor?.id])

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await deleteVendor(vendor.id)
    setIsDeleting(false)
    if (res.error) { toast.error(res.error) }
    else { toast.success(t("deletedSuccess")); setIsDeleteDialogOpen(false); onClose() }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) { toast.error(t("passwordMinLength")); return }
    setIsChangingPassword(true)
    const res = await changeVendorPassword(vendor.id, newPassword)
    setIsChangingPassword(false)
    if (res.error) { toast.error(res.error) }
    else { toast.success(t("passwordChanged")); setIsPasswordDialogOpen(false); setNewPassword("") }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const handleImpersonate = async () => {
    if (!user?.id && !vendor?.userId) { toast.error("User ID not found for this vendor"); return }
    const targetUserId = user?.id || vendor?.userId
    const toastId = toast.loading("Signing in...")
    try {
      const { impersonateUser } = await import("@/app/actions/impersonate")
      const result = await impersonateUser(targetUserId)
      if (result.error) { toast.error(result.error, { id: toastId }); return }
      if (result.success && result.email && result.token) {
        const { signIn, getSession } = await import("next-auth/react")
        const currentSession = await getSession()
        await signIn("credentials", {
          email: result.email,
          impersonationToken: result.token,
          originalAdminId: currentSession?.user?.id || "",
          originalAdminEmail: currentSession?.user?.email || "",
          callbackUrl: "/dashboard",
          redirect: true,
        })
      }
    } catch {
      toast.error("Failed to sign in as user", { id: toastId })
    }
  }

  if (!vendor && !isOpen) return null

  const org = details?.organization
  const sub = details?.subscription
  const recentActivity = details?.recentActivity || []
  const user = org?.users?.[0]

  const initials = (org?.name || vendor?.title || "V").substring(0, 2).toUpperCase()
  const currentStatus = (org?.status || vendor?.status || "ACTIVE").toUpperCase()
  const bannerColor = STATUS_COLORS[currentStatus] || "bg-slate-100 text-slate-700 border-slate-200"
  const isSuperAdmin = user?.role === "SUPER_ADMIN"

  const onboardingData = org?.whatsapp_onboarding_raw_data as any
  const statusFromOnboarding = onboardingData?.phone_info?.status

  let whatsappStatus = "DISCONNECTED"
  let whatsappStatusColor = "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"

  if (org?.whatsappPhoneNumberId) {
    if (statusFromOnboarding) {
      const s = statusFromOnboarding.toUpperCase()
      if (['APPROVED', 'CONNECTED', 'LIVE'].includes(s)) {
        whatsappStatus = "LIVE"
        whatsappStatusColor = "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
      } else if (['BANNED', 'DISABLED', 'BLOCKED'].includes(s)) {
        whatsappStatus = "BANNED"
        whatsappStatusColor = "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800 animate-pulse"
      } else {
        whatsappStatus = s
        whatsappStatusColor = "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
      }
    } else {
      whatsappStatus = "LIVE"
      whatsappStatusColor = "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
    }
  } else if (org?.whatsappNumber) {
    whatsappStatus = "PENDING"
    whatsappStatusColor = "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
  }

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-0 flex flex-col border-0 shadow-2xl bg-[#F7F8FA] dark:bg-slate-950"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        {/* HEADER SECTION */}
        <div className="relative shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shadow-sm">
          <div className="px-6 py-6 flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl bg-gradient-to-br from-[#00a884]/10 to-emerald-600/10 text-[#00a884] dark:from-[#00a884]/20 dark:to-emerald-600/20 ring-1 ring-[#00a884]/20 shadow-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate pr-4">
                  {org?.name || vendor?.title}
                </h2>
                <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest border shrink-0", bannerColor)}>
                  {currentStatus}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-slate-500 font-mono truncate">
                  {vendor?.id}
                </p>
                <button onClick={() => copyToClipboard(vendor?.id)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-400">
                Joined {vendor?.createdAt ? format(new Date(vendor?.createdAt), "dd MMM yyyy") : "N/A"}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY SECTION */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 animate-pulse">
                  <div className="w-32 h-5 bg-slate-100 dark:bg-slate-800 rounded-md mb-4" />
                  <div className="space-y-3">
                    <div className="h-4 bg-slate-50 dark:bg-slate-800 rounded w-full" />
                    <div className="h-4 bg-slate-50 dark:bg-slate-800 rounded w-5/6" />
                    <div className="h-4 bg-slate-50 dark:bg-slate-800 rounded w-4/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">

              {/* SECTION 1: Basic Information */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <SectionHeading title="Basic Information" icon={Building2} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
                  <DetailRow label="Company Name" value={org?.name} />
                  <DetailRow label="Contact Person" value={user?.name || vendor?.adminName} />
                  <DetailRow label="Email Address" value={user?.email || vendor?.email} />
                  <DetailRow label="Signup Phone" value={user?.phoneNumber} />
                  <DetailRow label="Username" value={org?.slug || vendor?.username} />
                  <DetailRow label="Role" value={isSuperAdmin ? "Super Admin" : (user?.role || "Admin")} />
                  <DetailRow label="Timezone" value={org?.timezone} />
                  <DetailRow label="Country" value={(org?.vendorConfig as any)?.country || org?.country || "N/A"} />
                </div>
              </div>

              {/* SECTION 2: WhatsApp Connection */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeading title="WhatsApp Connection" icon={MessageSquare} />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncWhatsApp}
                      disabled={isSyncingWhatsApp}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-60"
                      title="Fetch live phone status from Meta API"
                    >
                      <RefreshCw className={cn("w-3 h-3 text-[#00a884]", isSyncingWhatsApp && "animate-spin")} />
                      Sync Status
                    </button>
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-sm", whatsappStatusColor)}>
                      {whatsappStatus === "LIVE" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : whatsappStatus === "DISCONNECTED" ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      {whatsappStatus}
                    </span>
                  </div>
                </div>

                {org?.whatsappNumber ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <DetailRow label="Connected Number" value={org.whatsappNumber} />
                    <DetailRow label="WABA ID" value={org.whatsappBusinessId} />
                    <DetailRow label="Phone Number ID" value={org.whatsappPhoneNumberId} />
                    <DetailRow label="Meta Business ID" value={org.metaBusinessId} />
                    <DetailRow label="Display Name" value={org.whatsappBusinessName || "N/A"} />
                    <DetailRow label="Verification Status" valueNode={
                      org.whatsapp_token_info_data ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verified</span>
                      ) : (
                        <span className="text-amber-500 font-bold text-xs">Unverified</span>
                      )
                    } />
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-sm font-semibold text-slate-500 mb-3">This account is not connected to WhatsApp yet.</p>

                  </div>
                )}
              </div>

              {/* SECTION 3: Subscription */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeading title="Subscription" icon={CreditCard} />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-black tracking-widest border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                    <Crown className="w-3.5 h-3.5" /> {(org?.plan || "Free").toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <DetailRow label="Plan Price" value={sub?.amount ? `${sub.amount} ${sub.currency}` : "Free"} />
                  <DetailRow label="Billing Cycle" value={sub?.frequency || "Monthly"} />
                  <DetailRow label="Subscription Status" value={sub?.status?.[0] || org?.status || "Active"} />
                  <DetailRow label="Auto Renew" valueNode={
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{sub?.isAuto ? "Yes" : "No"}</span>
                  } />
                  <DetailRow label="Start Date" value={sub?.startDate ? format(new Date(sub.startDate), "dd MMM yyyy") : "N/A"} />
                  <DetailRow label="Expiry Date" value={sub?.endDate ? format(new Date(sub.endDate), "dd MMM yyyy") : "N/A"} />
                </div>

                {sub?.endDate && differenceInDays(new Date(sub.endDate), new Date()) > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500">Time Remaining</span>
                      <span className="text-indigo-600">{differenceInDays(new Date(sub.endDate), new Date())} Days</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: Usage Statistics */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <SectionHeading title="Usage Statistics" icon={Activity} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: "Contacts", value: org?._count?.contacts || 0, icon: Users },
                    { label: "Flows", value: org?._count?.flows || 0, icon: Zap },
                    { label: "Campaigns", value: org?._count?.scheduledMessages || 0, icon: Calendar },
                    { label: "Quick Replies", value: org?._count?.quickReplies || 0, icon: MessageSquare },
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 flex flex-col items-center text-center">
                      <stat.icon className="w-5 h-5 text-slate-400 mb-2" />
                      <span className="text-xl font-black text-slate-800 dark:text-slate-100">{stat.value.toLocaleString()}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* AI Usage Stat */}
                <div className="mt-3 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">AI Messages Usage</p>
                      <p className="text-[11px] text-slate-500">
                        {org?.aiUsageInfo?.isUnlimited ? "Unlimited Plan" : `${((org?.aiUsageInfo?.usage || 0) / Math.max(1, org?.aiUsageInfo?.limit || 5000) * 100).toFixed(1)}% of quota used`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {(org?.aiUsageInfo?.usage || 0).toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {" / "}{org?.aiUsageInfo?.isUnlimited ? "Unlimited" : (org?.aiUsageInfo?.limit || 5000).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Recent Activity */}
              {recentActivity.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                  <SectionHeading title="Recent Activity" icon={Clock} />
                  <div className="space-y-4 mt-4">
                    {recentActivity.map((act: any, i: number) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{act.action}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{act.details || act.module}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">{format(new Date(act.createdAt), "dd MMM yyyy, HH:mm")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 6: Account Settings */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <SectionHeading title="Account Settings & Features" icon={Settings} />
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> Email Verified</span>
                    {user?.emailVerified ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-slate-400" /> AI Bot Enabled</span>
                    {org?.isAiBotEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Box className="w-3.5 h-3.5 text-slate-400" /> Shopify Enabled</span>
                    {org?.shopifyOrderAutomationEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-slate-400" /> Onboarding Done</span>
                    {user?.onboardingCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-slate-400" /> Knowledge Base</span>
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded-md border",
                      (org?.vendorConfig as any)?.knowledgeBaseManagement === "admin"
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                    )}>
                      {(org?.vendorConfig as any)?.knowledgeBaseManagement === "admin" ? "Admin Managed" : "User Managed"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Bot className="w-3.5 h-3.5 text-slate-400" /> AI Message Limit</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {org?.aiUsageInfo?.isUnlimited ? "Unlimited" : (org?.aiUsageInfo?.limit || 5000).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* STICKY FOOTER */}
        <div className="shrink-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="p-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Delete Vendor"
            >
              <Trash className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPasswordDialogOpen(true)}
              className="p-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Change Password"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onManagePermissionsClick?.(vendor)}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all active:scale-95 flex items-center gap-1.5"
              title="Manage Sidebar Page Permissions"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Permissions
            </button>
            <button
              onClick={() => onEditClick?.()}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={handleImpersonate}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#00a884] to-emerald-600 hover:from-[#009272] hover:to-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign in as Vendor
            </button>
          </div>
        </div>

        {/* DIALOGS */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="rounded-3xl" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            <DialogHeader>
              <DialogTitle className="font-bold text-xl">{t("deleteVendorConfirm")}</DialogTitle>
              <DialogDescription className="text-slate-500">{t("deleteVendorWarning", { title: org?.name || vendor?.title })}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} className="rounded-xl font-bold">{t("cancel")}</Button>
              <Button onClick={handleDelete} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-sm">
                {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("deleting")}</> : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="rounded-3xl" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            <form onSubmit={handleChangePassword}>
              <DialogHeader>
                <DialogTitle className="font-bold text-xl">{t("changePassword")}</DialogTitle>
                <DialogDescription className="text-slate-500">{t("enterNewPassword", { title: user?.name || org?.name || vendor?.title })}</DialogDescription>
              </DialogHeader>
              <div className="py-6">
                <Input
                  type="password"
                  placeholder={t("newPasswordPlaceholder")}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-[#00a884]"
                  autoComplete="new-password"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsPasswordDialogOpen(false)} disabled={isChangingPassword} className="rounded-xl font-bold">{t("cancel")}</Button>
                <Button type="submit" disabled={isChangingPassword} className="bg-gradient-to-br from-[#00a884] to-emerald-600 hover:from-[#009272] hover:to-emerald-700 text-white rounded-xl font-bold shadow-sm">
                  {isChangingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("saving")}</> : t("changePassword")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}
