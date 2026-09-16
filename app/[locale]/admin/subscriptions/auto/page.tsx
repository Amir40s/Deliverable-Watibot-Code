"use client"
import AutoSubscriptionsTable from "@/components/admin/subscriptions/AutoSubscriptionsTable"

export default function AutoSubscriptionsPage() {
  return (
    <div className="bg-[#fafbfc] dark:bg-slate-950 min-h-screen plus-jakarta-forced animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="mb-8">
        <span className="text-[#00a884] font-black uppercase tracking-widest text-[10px]">Management</span>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mt-1">
          Auto Subscriptions
        </h1>
        <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">
          Monitor and track platform-wide automated Stripe recurring billing status.
        </p>
      </div>

      {/* Content Section */}
      <div className="w-full">
        <AutoSubscriptionsTable />
      </div>
    </div>
  )
}
