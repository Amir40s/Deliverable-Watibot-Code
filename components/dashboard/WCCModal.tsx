"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { X, MessageSquare, Info } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface WCCModalProps {
 isOpen: boolean
 onOpenChange: (open: boolean) => void
}

export function WCCModal({ isOpen, onOpenChange }: WCCModalProps) {
 const [amount, setAmount] = useState(1500)
 const [autoRecharge, setAutoRecharge] = useState(false)
 const [minAmount, setMinAmount] = useState(500)
 const [rechargeAmount, setRechargeAmount] = useState(5000)

 const quickAmounts = [2500, 5000, 10000, 50000]

 return (
 <Dialog open={isOpen} onOpenChange={onOpenChange}>
 {/* Custom overlay/content for right-side slider effect */}
 <DialogContent className="fixed right-0 top-0 left-auto h-full w-full max-w-md translate-x-0 translate-y-0 border-l shadow-2xl p-0 gap-0 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md rounded-none bg-white dark:bg-slate-950 dark:border-slate-800">
 
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">
 <h2 className="text-lg font-semibold text-[#111827] dark:text-white">Purchase WhatsApp Conversation Credits (WCC)</h2>
 {/* Close button handled by DialogPrimitive, but we can add explicit one if resizing */}
 </div>

 <div className="p-6 overflow-y-auto h-[calc(100vh-80px)] bg-gray-50/50 dark:bg-slate-900/50 space-y-6">
 
 {/* Purchase Section */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
 <div className="space-y-2">
 <Label className="text-base font-medium text-[#111827] dark:text-white">Enter WCC Amount</Label>
 <p className="text-xs text-gray-500">Minimum purchase of ₹1500 credits is allowed</p>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
 <Input 
 type="number" 
 value={amount}
 onChange={(e) => setAmount(Number(e.target.value))}
 className="pl-8 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 h-11 text-base text-[#111827] dark:text-white"
 />
 </div>
 </div>

 {/* Quick Add Buttons */}
 <div className="grid grid-cols-4 gap-2">
 {quickAmounts.map((amt) => (
 <button
 key={amt}
 onClick={() => setAmount(prev => prev + amt)}
 className="border border-gray-200 dark:border-slate-700 rounded-lg py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
 >
 +{amt}
 </button>
 ))}
 </div>

 <Button className="w-full h-11 bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-800 cursor-not-allowed font-medium text-base" disabled>
 Purchase Now
 </Button>

 <div className="flex justify-center">
 <a href="#" className="text-xs font-semibold text-[#0E7490] dark:text-cyan-400 hover:underline flex items-center gap-1">
 Add billing address first →
 </a>
 </div>
 </div>

 {/* Auto-Recharge Section */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
 <div className="flex items-center justify-between">
 <Label className="text-base font-medium text-[#111827] dark:text-white">Enable WCC auto-recharge</Label>
 <Switch checked={autoRecharge} onCheckedChange={setAutoRecharge} />
 </div>

 <div className={cn("space-y-6 transition-all duration-300", autoRecharge ? "opacity-100" : "opacity-50 pointer-events-none")}>
 <div className="space-y-2">
 <div className="flex items-center gap-1.5">
 <Label className="text-sm font-medium text-gray-600 dark:text-slate-400">Enter minimum WCC amount</Label>
 <Info className="w-3.5 h-3.5 text-gray-400" />
 </div>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
 <Input 
 type="number" 
 value={minAmount}
 onChange={(e) => setMinAmount(Number(e.target.value))}
 className="pl-8 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 h-10 text-[#111827] dark:text-white"
 />
 </div>
 </div>

 <div className="space-y-2">
 <div className="flex items-center gap-1.5">
 <Label className="text-sm font-medium text-gray-600 dark:text-slate-400">Enter auto-recharge amount</Label>
 <Info className="w-3.5 h-3.5 text-gray-400" />
 </div>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
 <Input 
 type="number" 
 value={rechargeAmount}
 onChange={(e) => setRechargeAmount(Number(e.target.value))}
 className="pl-8 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 h-10 text-[#111827] dark:text-white"
 />
 </div>
 </div>

 <p className="text-xs text-gray-500 leading-relaxed">
 WCC auto-recharge of ₹{rechargeAmount} will be initiated when WhatsApp Conversation Credit (WCC) goes below ₹{minAmount}
 </p>

 <Button className="w-fit px-6 bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-800 font-medium" disabled={!autoRecharge}>
 Save
 </Button>
 </div>
 </div>
 </div>

 {/* Floating Feedback Button (as seen in screenshot side tab, just for visual parity) */}
 <div className="absolute right-full top-1/2 -translate-y-1/2 bg-[#22C55E] text-white p-2 rounded-l-md writing-vertical-rl flex items-center justify-center cursor-pointer shadow-lg hover:bg-[#16A34A] transition-colors w-8 h-32 hidden">
 {/* Hidden for now unless requested, as it might be outside the modal scope */}
 </div>
 </DialogContent>
 </Dialog>
 )
}
