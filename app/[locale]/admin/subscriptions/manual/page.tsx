"use client"

import { useState } from "react"
import ManualSubscriptionsTable from "@/components/admin/subscriptions/ManualSubscriptionsTable"

export default function ManualSubscriptionsPage() {
  const [triggerAdd, setTriggerAdd] = useState(0)

  return (
    <div className="bg-[#fafbfc] dark:bg-slate-950 min-h-screen plus-jakarta-forced animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="mb-8">
        <span className="text-[#00a884] font-black uppercase tracking-widest text-[10px]">Management</span>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mt-1">
          Manual & Prepaid Subscriptions
        </h1>
        <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">
          Manually create, renew, or suspend prepaid and custom client accounts.
        </p>
      </div>

      {/* Content Section */}
      <div className="w-full">
        <ManualSubscriptionsTable triggerAdd={triggerAdd} />
      </div>
    </div>
  )
}
