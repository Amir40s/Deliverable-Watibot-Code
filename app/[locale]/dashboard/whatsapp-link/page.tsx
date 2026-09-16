"use client"
import React, { useState, useEffect } from "react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { WhatsAppLinkGenerator } from "@/components/dashboard/WhatsAppLinkGenerator"
export default function WhatsAppLinkPage() {
  const [defaultPhone, setDefaultPhone] = useState("")
  useEffect(() => {
    async function load() {
      try {
        const stats = await getDashboardStats()
        if (stats?.whatsappNumber) {
          setDefaultPhone(stats.whatsappNumber)
        }
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])
  return (
    <DashboardLayoutClient mainClassName="bg-white dark:bg-slate-900 min-h-screen">
      <div className="p-6 md:p-8">
        <WhatsAppLinkGenerator defaultPhone={defaultPhone} isPage={true} />
      </div>
    </DashboardLayoutClient>
  )
}
