"use client"

import { useState, useMemo } from "react"
import {
  PhoneCall, Search, Calendar, Clock, Building2,
  CheckCircle2, Clock3, ChevronLeft, ChevronRight, Loader2,
  Phone, ArrowUpDown, Check
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { completeBookedCallAction } from "@/app/actions/booked-calls"

interface BookedCallRow {
  id: string
  organizationId: string
  userId: string
  date: string
  time: string
  phoneNumber: string
  status: string
  createdAt: Date
  user: {
    name: string | null
    email: string | null
  }
  organization: {
    name: string
  }
}

interface BookedCallsPageClientProps {
  initialBookedCalls: BookedCallRow[]
}

const CALL_STATUS_BADGES: Record<string, { bg: string, dot: string, text: string }> = {
  COMPLETED: { bg: "bg-emerald-50 dark:bg-emerald-950/30", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  PENDING: { bg: "bg-amber-50 dark:bg-amber-950/30", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
}

function StatCard({
  label, value, icon: Icon, textColor, subLabel,
}: {
  label: string; value: string | number; icon: any
  textColor: string; subLabel?: string
}) {
  return (
    <div className="relative rounded-3xl p-5 overflow-hidden border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between min-h-[110px]">
      <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3 ring-1 ring-slate-100 dark:ring-slate-700">
        <Icon className={cn("w-5 h-5", textColor)} />
      </div>

      <div>
        <p className="text-4xl font-black text-slate-800 dark:text-white leading-none tracking-tight">{value}</p>
        <p className="mt-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-widest">{label}</p>
        {subLabel && <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{subLabel}</p>}
      </div>
    </div>
  )
}

function BookedCallRowItem({ call, onStatusChange }: { call: BookedCallRow, onStatusChange: (id: string) => void }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleMarkCompleted = async () => {
    setIsUpdating(true)
    try {
      const res = await completeBookedCallAction(call.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Call marked as completed!")
        onStatusChange(call.id)
      }
    } catch (err) {
      toast.error("Failed to update call status. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const initials = (call.user?.name || "U")
    .split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()
  const statusName = (call.status || "PENDING").toUpperCase()
  const statusBadge = CALL_STATUS_BADGES[statusName] || CALL_STATUS_BADGES.PENDING

  return (
    <tr className="group hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-all duration-205">
      {/* User Info */}
      <td className="py-4 px-6 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs bg-gradient-to-br from-[#00a884]/10 to-emerald-600/10 text-[#00a884] dark:from-[#00a884]/20 dark:to-emerald-600/20 ring-1 ring-[#00a884]/15">
            {initials}
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-[#00a884] transition-colors duration-200">
              {call.user?.name || "User"}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {call.user?.email || "—"}
            </span>
          </div>
        </div>
      </td>

      {/* Organization */}
      <td className="py-4 px-6 whitespace-nowrap text-left">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#00a884]/10 flex items-center justify-center">
            <Building2 className="w-3 h-3 text-[#00a884]" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
            {call.organization?.name || "—"}
          </span>
        </div>
      </td>

      {/* Date & Time */}
      <td className="py-4 px-6 whitespace-nowrap text-left">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-750 dark:text-slate-250 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {call.date}
          </span>
          <span className="text-[10px] font-bold text-slate-405 tracking-wider mt-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {call.time}
          </span>
        </div>
      </td>

      {/* Phone Number */}
      <td className="py-4 px-6 whitespace-nowrap text-left">
        <span className="text-xs font-bold text-slate-650 dark:text-slate-300 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          {call.phoneNumber}
        </span>
      </td>

      {/* Status */}
      <td className="py-4 px-6 whitespace-nowrap text-left">
        <div className={cn(
          "inline-flex justify-center items-center gap-1.5 w-[110px] py-1 rounded-full text-[9px] font-black tracking-widest border border-transparent",
          statusBadge.bg,
          statusBadge.text
        )}>
          <span className={cn("w-1.5 h-1.5 rounded-full relative flex shrink-0")}>
            {statusName === "PENDING" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            )}
            <span className={cn("relative inline-flex rounded-full w-1.5 h-1.5", statusBadge.dot)} />
          </span>
          {statusName}
        </div>
      </td>

      {/* Actions */}
      <td className="py-4 px-6 whitespace-nowrap text-right">
        <div className="flex items-center justify-end">
          {statusName === "PENDING" ? (
            <button
              onClick={handleMarkCompleted}
              disabled={isUpdating}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-[#00a884] to-emerald-600 text-white text-[10px] font-black tracking-wider shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Complete Call
            </button>
          ) : (
            <div className="text-[10px] font-black tracking-widest text-[#00a884] flex items-center gap-1.5 select-none pr-3">
              <CheckCircle2 className="w-4 h-4" />
              COMPLETED
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

const PAGE_SIZE_OPTIONS: (number | "ALL")[] = [8, 20, 30, 50, "ALL"]

export default function BookedCallsPageClient({ initialBookedCalls }: BookedCallsPageClientProps) {
  const [calls, setCalls] = useState<BookedCallRow[]>(initialBookedCalls)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "COMPLETED">("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState<number | "ALL">(8)

  // Sorting state
  const [sortField, setSortField] = useState<string>("date")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  const handleStatusChange = (id: string) => {
    setCalls(prev =>
      prev.map(c => (c.id === id ? { ...c, status: "COMPLETED" } : c))
    )
  }

  const counts = useMemo(() => ({
    total: calls.length,
    pending: calls.filter(c => c.status === "PENDING").length,
    completed: calls.filter(c => c.status === "COMPLETED").length,
  }), [calls])

  const filtered = useMemo(() => calls.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      c.user?.name?.toLowerCase().includes(q) ||
      c.user?.email?.toLowerCase().includes(q) ||
      c.phoneNumber.includes(q) ||
      c.organization?.name?.toLowerCase().includes(q)
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter
    return matchSearch && matchStatus
  }), [calls, search, statusFilter])

  // Client-side sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let valA = ""
      let valB = ""

      if (sortField === "user") {
        valA = a.user?.name || ""
        valB = b.user?.name || ""
      } else if (sortField === "organization") {
        valA = a.organization?.name || ""
        valB = b.organization?.name || ""
      } else {
        valA = a[sortField] || ""
        valB = b[sortField] || ""
      }

      if (typeof valA === "string") valA = valA.toLowerCase()
      if (typeof valB === "string") valB = valB.toLowerCase()

      if (valA < valB) return sortDirection === "asc" ? -1 : 1
      if (valA > valB) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [filtered, sortField, sortDirection])

  const effectivePerPage = perPage === "ALL" ? sorted.length : perPage
  const totalPages = perPage === "ALL" ? 1 : Math.ceil(sorted.length / effectivePerPage)
  const paginated = perPage === "ALL" ? sorted : sorted.slice((currentPage - 1) * effectivePerPage, currentPage * effectivePerPage)

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const STATUS_TABS = [
    { label: "All", value: "ALL" as const, count: counts.total },
    { label: "Pending", value: "PENDING" as const, count: counts.pending },
    { label: "Completed", value: "COMPLETED" as const, count: counts.completed },
  ]

  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#F4F6F9] dark:bg-slate-950 min-h-screen plus-jakarta-forced">
      {/* Hero Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="px-8 pt-8 pb-6">
          {/* Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/10 flex items-center justify-center ring-1 ring-[#00a884]/15">
              <PhoneCall className="w-5 h-5 text-[#00a884]" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Booked Calls</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                Manage scheduled support and sales calls with users.
              </p>
            </div>
          </div>

          {/* Premium Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Total Bookings"
              value={counts.total}
              icon={PhoneCall}
              textColor="text-slate-600 dark:text-slate-350"
              subLabel="All calls registered"
            />
            <StatCard
              label="Pending"
              value={counts.pending}
              icon={Clock3}
              textColor="text-amber-500"
              subLabel="Awaiting callback"
            />
            <StatCard
              label="Completed"
              value={counts.completed}
              icon={CheckCircle2}
              textColor="text-[#00a884]"
              subLabel="Completed calls"
            />
          </div>

          {/* Search, Status Tabs & Per-page */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors" />
              <input
                type="text"
                placeholder="Search user, email, phone number…"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/40 transition-all text-left"
              />
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setCurrentPage(1) }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider transition-all flex items-center gap-1.5",
                    statusFilter === tab.value
                      ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {tab.label}
                  <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full",
                    statusFilter === tab.value
                      ? "bg-[#00a884]/10 text-[#00a884]"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  )}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Per-page selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl px-2 py-1 lg:ml-auto">
              <span className="text-[9px] font-black text-slate-400 tracking-widest px-1 whitespace-nowrap">Show</span>
              {PAGE_SIZE_OPTIONS.map(size => (
                <button
                  key={size}
                  onClick={() => { setPerPage(size); setCurrentPage(1) }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all",
                    perPage === size
                      ? "bg-gradient-to-br from-[#00a884] to-emerald-600 text-white shadow-md"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="px-8 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <PhoneCall className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-black text-lg">No booked calls found</p>
              <p className="text-slate-400 text-sm mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                    {/* User Column */}
                    <th className="py-4.5 px-6">
                      <button
                        onClick={() => handleSort("user")}
                        className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        USER
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    {/* Organization Column */}
                    <th className="py-4.5 px-6">
                      <button
                        onClick={() => handleSort("organization")}
                        className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        ORGANIZATION
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    {/* Date/Time Column */}
                    <th className="py-4.5 px-6">
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        DATE & TIME
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>

                    {/* Phone Column */}
                    <th className="py-4.5 px-6">
                      <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">
                        PHONE NUMBER
                      </span>
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
                    <th className="py-4.5 px-6 text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 text-right">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {paginated.map((call) => (
                    <BookedCallRowItem
                      key={call.id}
                      call={call}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-400 tracking-widest">
              Showing {perPage === "ALL" ? 1 : (currentPage - 1) * effectivePerPage + 1}–{Math.min(currentPage * (perPage === "ALL" ? sorted.length : effectivePerPage), filtered.length)} of {filtered.length} bookings
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn("w-9 h-9 rounded-xl text-sm font-black transition-all",
                    currentPage === page
                      ? "bg-gradient-to-br from-[#00a884] to-emerald-600 text-white shadow-lg shadow-[#00a884]/25"
                      : "border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
