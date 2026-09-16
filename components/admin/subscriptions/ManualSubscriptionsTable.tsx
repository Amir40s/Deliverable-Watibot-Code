"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Pencil, 
  Trash2, 
  Plus, 
  Loader2, 
  ExternalLink, 
  Calendar, 
  CreditCard,
  ArrowUpDown,
  AlertCircle,
  Users,
  Activity,
  Clock,
  TrendingUp,
  DollarSign,
  CheckCircle,
  FileText
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import SubscriptionModal from "./SubscriptionModal"
import WatiBotLoader from "@/components/WatiBotLoader"

interface Subscription {
  id: string
  vendor: string
  isAuto: boolean
  plan: string
  startDate: string
  endDate: string
  amount: string
  currency: string
  frequency: string
  status: string[]
  createdAt: string
  updatedAt: string
}

interface ManualSubscriptionsTableProps {
  triggerAdd?: number
}

// Color badges mappings
const PLAN_BADGES: Record<string, string> = {
  FREE: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  STANDARD: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60",
  PREMIUM: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60",
  ULTIMATE: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/60",
}

const STATUS_BADGES: Record<string, { bg: string, dot: string, text: string }> = {
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-950/30", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  EXPIRED: { bg: "bg-rose-50 dark:bg-rose-950/30", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
  INACTIVE: { bg: "bg-slate-50 dark:bg-slate-900/40", dot: "bg-slate-500", text: "text-slate-650 dark:text-slate-400" },
}

interface StatCardProps {
  label: string
  value: string | number
  subLabel?: string
  colorClass: string
  bgClass: string
  borderClass: string
  icon: any
}

function StatCard({ label, value, subLabel, colorClass, bgClass, borderClass, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[28px] p-6 shadow-sm flex flex-col justify-between h-[135px] relative overflow-hidden group hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", bgClass, colorClass)}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 z-10 relative">
        <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tight tabular-nums">
          {value}
        </span>
        {subLabel && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">{subLabel}</span>}
      </div>
    </div>
  )
}

export default function ManualSubscriptionsTable({ triggerAdd }: ManualSubscriptionsTableProps) {
  const [data, setData] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Search, pagination and sorting state
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState<number | "ALL">(10)
  const [sortField, setSortField] = useState<keyof Subscription>("vendor")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions', { cache: "no-store" })
      if (!response.ok) throw new Error('Failed to fetch subscriptions')
      const result = await response.json()
      // Filter out auto-recurring items so only manual items are shown here
      const manualOnly = result.filter((s: any) => !s.isAuto)
      setData(manualOnly)
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      toast.error("Failed to load subscriptions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  // Trigger modal when user clicks New Subscription
  useEffect(() => {
    if (triggerAdd && triggerAdd > 0) {
      openAddModal()
    }
  }, [triggerAdd])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return

    try {
      const response = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete')
      
      toast.success("Subscription deleted successfully")
      await fetchSubscriptions()
    } catch (error) {
      console.error('Error deleting subscription:', error)
      toast.error("Failed to delete subscription")
    }
  }

  const handleSave = async (formData: any) => {
    setIsSubmitting(true)
    try {
      const url = editingSubscription 
        ? `/api/admin/subscriptions/${editingSubscription.id}`
        : '/api/admin/subscriptions'
      
      const method = editingSubscription ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      toast.success(editingSubscription ? "Subscription updated" : "Subscription created")
      setIsModalOpen(false)
      await new Promise(resolve => setTimeout(resolve, 300))
      await fetchSubscriptions()
    } catch (error) {
      console.error('Error saving subscription:', error)
      toast.error("Failed to save subscription")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAddModal = () => {
    setEditingSubscription(undefined)
    setIsModalOpen(true)
  }

  const openEditModal = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setIsModalOpen(true)
  }

  // Calculate statistics
  const stats = useMemo(() => {
    const total = data.length
    const active = data.filter(s => (s.status?.[0] || "").toUpperCase() === "ACTIVE").length
    const expired = data.filter(s => {
      const sName = (s.status?.[0] || "").toUpperCase()
      return sName === "EXPIRED" || sName === "INACTIVE"
    }).length
    
    // Sum charges of ACTIVE prepaid subscriptions
    const totalVolume = data.reduce((acc, curr) => {
      const sName = (curr.status?.[0] || "").toUpperCase()
      if (sName !== "ACTIVE") return acc
      return acc + (parseFloat(curr.amount) || 0)
    }, 0)

    return { total, active, expired, totalVolume }
  }, [data])

  // Sorting helper
  const handleSort = (field: keyof Subscription) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Client-side filtering
  const filtered = useMemo(() => {
    return data.filter(item => {
      const q = search.toLowerCase()
      return (
        item.vendor.toLowerCase().includes(q) ||
        item.plan.toLowerCase().includes(q) ||
        (item.frequency || "").toLowerCase().includes(q) ||
        (item.status?.[0] || "").toLowerCase().includes(q)
      )
    })
  }, [data, search])

  // Client-side sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortField === "createdAt" || sortField === "endDate" || sortField === "startDate") {
        const timeA = new Date(a[sortField] as string).getTime() || 0
        const timeB = new Date(b[sortField] as string).getTime() || 0
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA
      }
      
      if (sortField === "amount") {
        const amtA = parseFloat(a[sortField] as string) || 0
        const amtB = parseFloat(b[sortField] as string) || 0
        return sortDirection === "asc" ? amtA - amtB : amtB - amtA
      }

      if (sortField === "isAuto") {
        const autoA = a.isAuto ? 1 : 0
        const autoB = b.isAuto ? 1 : 0
        return sortDirection === "asc" ? autoA - autoB : autoB - autoA
      }

      if (sortField === "status") {
        const statusA = a.status?.[0] || ""
        const statusB = b.status?.[0] || ""
        return sortDirection === "asc" 
          ? statusA.localeCompare(statusB) 
          : statusB.localeCompare(statusA)
      }

      const strA = String(a[sortField] || "")
      const strB = String(b[sortField] || "")
      return sortDirection === "asc" 
        ? strA.localeCompare(strB) 
        : strB.localeCompare(strA)
    })
  }, [filtered, sortField, sortDirection])

  // Paginated list
  const effectivePerPage = perPage === "ALL" ? sorted.length : perPage
  const totalPages = perPage === "ALL" ? 1 : Math.ceil(sorted.length / effectivePerPage)
  const paginated = perPage === "ALL" ? sorted : sorted.slice((currentPage - 1) * effectivePerPage, currentPage * effectivePerPage)

  return (
    <div className="space-y-6">
      
      {/* ── Premium Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Manual"
          value={stats.total}
          icon={Users}
          colorClass="text-[#00a884]"
          bgClass="bg-[#e6f4ee] dark:bg-[#00a884]/15"
          borderClass="border-[#00a884]/10 dark:border-[#00a884]/20"
          subLabel="All prepaid entries"
        />
        <StatCard
          label="Active Accounts"
          value={stats.active}
          icon={Activity}
          colorClass="text-[#a855f7]"
          bgClass="bg-[#f3e8ff] dark:bg-[#a855f7]/15"
          borderClass="border-[#a855f7]/10 dark:border-[#a855f7]/20"
          subLabel="Currently authorized"
        />
        <StatCard
          label="Expired/Inactive"
          value={stats.expired}
          icon={Clock}
          colorClass="text-[#ec4899]"
          bgClass="bg-[#fce7f3] dark:bg-[#ec4899]/15"
          borderClass="border-[#ec4899]/10 dark:border-[#ec4899]/20"
          subLabel="Requiring renewal"
        />
        <StatCard
          label="Estimated Revenue"
          value={`$${stats.totalVolume.toFixed(2)}`}
          icon={DollarSign}
          colorClass="text-[#f97316]"
          bgClass="bg-[#ffedd5] dark:bg-[#f97316]/15"
          borderClass="border-[#f97316]/10 dark:border-[#f97316]/20"
          subLabel="Active manual charges"
        />
      </div>

      {/* ── Filter Strip ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors" />
          <input
            type="text"
            placeholder="Search manual subscriptions, vendors, plans…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/40 transition-all"
          />
        </div>

        {/* Action + Page Size Selector */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-1">
            <span className="text-[9px] font-black text-slate-400 tracking-widest px-2.5 whitespace-nowrap">Show</span>
            {([10, 25, 50, "ALL"] as const).map(size => (
              <button
                key={size}
                onClick={() => { setPerPage(size); setCurrentPage(1) }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all tracking-wider",
                  perPage === size
                    ? "bg-gradient-to-br from-[#00a884] to-emerald-600 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700/50"
                )}
              >
                {size}
              </button>
            ))}
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-gradient-to-br from-[#00a884] to-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-[#00a884]/25 hover:shadow-xl hover:shadow-[#00a884]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>

      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
                {loading ? (
            <WatiBotLoader fullScreen={true} />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                  
                  {/* Vendor Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("vendor")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      VENDOR
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Is Auto Recurring Column */}
                  <th className="py-4.5 px-6 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">
                    AUTO RECURRING
                  </th>

                  {/* Plan Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("plan")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      PLAN
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Created At Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("createdAt")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      CREATED AT
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Expiry At Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("endDate")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      EXPIRY AT
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Plan Charges Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("amount")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      PLAN CHARGES
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Frequency Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("frequency")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      FREQUENCY
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Status Column */}
                  <th className="py-4.5 px-6">
                    <button 
                      onClick={() => handleSort("status")} 
                      className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      STATUS
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>

                  {/* Action Column */}
                  <th className="py-4.5 px-6 text-right text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {paginated.length > 0 ? (
                  paginated.map(item => {
                    const initials = item.vendor.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
                    const statusName = (item.status?.[0] || "ACTIVE").toUpperCase()
                    const statusBadge = STATUS_BADGES[statusName] || STATUS_BADGES.ACTIVE

                    return (
                      <tr 
                        key={item.id}
                        className="group hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-all duration-200"
                      >
                        {/* Vendor Name Avatar */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs bg-gradient-to-br from-[#00a884]/10 to-emerald-600/10 text-[#00a884] dark:from-[#00a884]/20 dark:to-emerald-600/20 ring-1 ring-[#00a884]/15">
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-[#00a884] transition-colors duration-200">
                                {item.vendor}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">
                                Manual/Prepaid
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Is Auto Recurring */}
                        <td className="py-4 px-6 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-black">
                            NO
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex justify-center items-center px-3 py-1 rounded-lg border text-[10px] font-black tracking-wider min-w-[85px]",
                            PLAN_BADGES[item.plan.toUpperCase()] || PLAN_BADGES.FREE
                          )}>
                            {(item as any).planName || item.plan}
                          </span>
                        </td>

                        {/* Created At */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {format(new Date(item.createdAt), "dd MMM yyyy")}
                          </span>
                        </td>

                        {/* Expiry At */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {format(new Date(item.endDate), "dd MMM yyyy")}
                          </span>
                        </td>

                        {/* Plan Charges */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-[#00a884]/10 flex items-center justify-center">
                              <CreditCard className="w-3 h-3 text-[#00a884]" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency || 'USD' }).format(parseFloat(item.amount) || 0)}
                            </span>
                          </div>
                        </td>

                        {/* Frequency */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide">
                            {item.frequency || "monthly"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className={cn(
                            "inline-flex justify-center items-center gap-1.5 w-[95px] py-1 rounded-full text-[9px] font-black tracking-widest border border-transparent",
                            statusBadge.bg,
                            statusBadge.text
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full relative flex shrink-0")}>
                              {statusName === "ACTIVE" && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              )}
                              <span className={cn("relative inline-flex rounded-full w-1.5 h-1.5", statusBadge.dot)} />
                            </span>
                            {statusName}
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-[#00a884]/10 hover:text-[#00a884] dark:hover:bg-[#00a884]/20 text-slate-400 transition-colors"
                              title="Update Entry"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 dark:hover:bg-rose-500/20 text-slate-400 transition-colors"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-bold tracking-widest">No matching subscriptions found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer / Pagination ── */}
        {totalPages > 1 && (
          <div className="bg-slate-50/40 dark:bg-slate-800/10 px-6 py-4.5 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Range info */}
            <span className="text-[11px] font-bold text-slate-400 tracking-widest">
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * effectivePerPage + 1} to{" "}
              {Math.min(currentPage * effectivePerPage, filtered.length)} of {filtered.length} entries
            </span>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800 hover:bg-[#00a884]/10 hover:text-[#00a884] dark:hover:bg-[#00a884]/20 text-slate-500 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "w-8 h-8 rounded-xl text-xs font-bold transition-all",
                    currentPage === i + 1
                      ? "bg-[#00a884] text-white shadow-md shadow-[#00a884]/20"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800 hover:bg-[#00a884]/10 hover:text-[#00a884] dark:hover:bg-[#00a884]/20 text-slate-500 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

      </div>

      <SubscriptionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSave}
        initialData={editingSubscription}
        isLoading={isSubmitting}
      />
    </div>
  )
}
