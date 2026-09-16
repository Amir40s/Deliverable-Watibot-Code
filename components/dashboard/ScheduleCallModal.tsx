"use client"

import React, { useState } from "react"
import { X, Calendar, Clock, Phone, Loader2, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { bookCallAction } from "@/app/actions/booked-calls" 
interface ScheduleCallModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}
export function ScheduleCallModal({ isOpen, onOpenChange }: ScheduleCallModalProps) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !time || !phoneNumber) {
      toast.error("Please fill in all fields.")
      return
    }

    setIsLoading(true)
    try {
      const res = await bookCallAction({ date, time, phoneNumber })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Call booked successfully!")
        setIsSuccess(true)
        setTimeout(() => {
          setIsSuccess(false)
          setDate("")
          setTime("")
          setPhoneNumber("")
          onOpenChange(false)
        }, 2000)
      }
    } catch (err) {
      toast.error("Failed to book call. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="plus-jakarta-forced max-w-[480px] p-0 overflow-hidden border-none rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-4 relative shrink-0 border-b border-slate-100">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00a884]" />
              Schedule a Call
            </DialogTitle>
            <p className="text-slate-500 text-xs font-semibold">
              Select your preferred date, time, and phone number to schedule a call with us.
            </p>
          </DialogHeader>
        </div>

        {isSuccess ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 animate-[scale-in_0.3s_ease]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Call Scheduled!</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                We will call you on <span className="text-slate-800 font-bold">{date}</span> at <span className="text-slate-800 font-bold">{time}</span>.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4.5">
            {/* Date Picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">
                Select Date
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="pl-11 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                />
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Time Picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">
                Select Time
              </Label>
              <div className="relative">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="pl-11 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                />
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">
                Phone Number
              </Label>
              <div className="relative">
                <Input
                  type="tel"
                  placeholder="e.g. +1 555-0199"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="pl-11 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                />
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !date || !time || !phoneNumber}
              className="w-full h-11 bg-[#00a884] hover:bg-[#008f70] text-white font-extrabold rounded-xl transition-all duration-200 shadow-md shadow-emerald-100/50 flex items-center justify-center gap-2 active:scale-[0.98] mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                "Book Call"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
