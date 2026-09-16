"use client"

import React from "react"
import { useRouter } from "next/navigation"

export function WhatsAppWidgetBuilder({ defaultPhone = "", businessName = "" }: {
  defaultPhone?: string
  businessName?: string
}) {
  const router = useRouter()

  return (
    <div
      onClick={() => router.push('/dashboard/whatsapp-widget')}
      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all duration-300 group flex flex-row items-center p-3 gap-5"
    >
      <div className="w-24 h-24 shrink-0 bg-[#fafafa] dark:bg-slate-800/30 rounded-[18px] flex items-center justify-center overflow-hidden border border-slate-50 dark:border-slate-700/50">
        <img 
          src="/whatsappWebsiteWidget.png" 
          alt="WhatsApp Website Button" 
          className="w-20 h-20 object-contain group-hover:scale-105 transition-transform duration-500" 
        />
      </div>
      <div className="flex flex-col text-start py-2 pr-4 min-w-0">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">WhatsApp Website Button</h3>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">Drive WhatsApp sales with personalised CTAs</p>
      </div>
    </div>
  )
}
