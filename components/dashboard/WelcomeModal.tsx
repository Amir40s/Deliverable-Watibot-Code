"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X, PhoneCall, ExternalLink, PartyPopper } from "lucide-react"
import { useSession } from "next-auth/react"

interface WelcomeModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onScheduleCall: () => void
}

const steps = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#00a884]" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    label: "Apply for WhatsApp Business API",
    step: "Step 1",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#00a884" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
    label: "Complete your KYC",
    step: "Step 2",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#00a884" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        <line x1="17" y1="11" x2="23" y2="11"/>
      </svg>
    ),
    label: "Setup your Profile",
    step: "Step 3",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#00a884" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    label: "Apply for Green Tick",
    step: "Step 4",
  },
]

export function WelcomeModal({ isOpen, onOpenChange, onScheduleCall }: WelcomeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="plus-jakarta-forced max-w-[580px] p-0 overflow-hidden border-none rounded-3xl bg-white shadow-2xl">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        <div className="flex flex-col items-center px-8 pt-10 pb-0">
          {/* Party icon */}
          <div className="w-20 h-20 rounded-full bg-[#e6f4ee] flex items-center justify-center mb-5 shadow-sm text-[#00a884]">
            <PartyPopper className="w-10 h-10" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-black text-slate-800 tracking-tight text-center">
            Welcome to WatiBot!
          </h2>
          <p className="text-slate-500 text-sm font-medium text-center mt-2 max-w-[400px] leading-relaxed">
            You are one step closer to transforming your business with WhatsApp Business API
          </p>

          {/* Need highlight */}
          <p className="mt-4 text-sm text-center">
            <span className="text-[#00a884] font-bold">Here's what you'll need:</span>
            <span className="text-slate-500 font-medium"> A phone number not yet registered on WhatsApp</span>
          </p>

          {/* Steps row */}
          <div className="flex items-start justify-center gap-0 mt-8 w-full">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center text-center w-[110px]">
                  <div className="w-12 h-12 rounded-full bg-[#e6f4ee] flex items-center justify-center mb-2">
                    {s.icon}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.step}</span>
                  <span className="text-[12px] font-bold text-slate-700 mt-0.5 leading-tight">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <svg className="w-5 h-5 text-[#00a884] mb-6 mx-1 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-0 mt-6 border-t border-slate-100">
          <button
            onClick={() => onScheduleCall()}
            className="flex-1 py-4 text-sm font-bold text-[#00a884] border-r border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4" />
            Need help? Schedule a Call
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 py-4 text-sm font-bold text-white bg-[#00a884] hover:bg-[#008f70] transition-colors flex items-center justify-center gap-2"
          >
            Apply for WhatsApp API
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
