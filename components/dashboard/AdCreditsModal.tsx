"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, MessageSquare } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface AdCreditsModalProps {
 isOpen: boolean
 onOpenChange: (open: boolean) => void
}

export function AdCreditsModal({ isOpen, onOpenChange }: AdCreditsModalProps) {
 const [amount, setAmount] = useState(1500)
 const quickAmounts = [2500, 5000, 10000, 50000]

 return (
 <Dialog open={isOpen} onOpenChange={onOpenChange}>
 {/* Custom overlay/content for right-side slider effect */}
 <DialogContent className="fixed right-0 top-0 left-auto h-full w-full max-w-md translate-x-0 translate-y-0 border-l shadow-2xl p-0 gap-0 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md rounded-none bg-white dark:bg-slate-950 dark:border-slate-800">
 
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">
 <h2 className="text-lg font-semibold text-[#111827] dark:text-white">Purchase AiSensy Ads Credits</h2>
 {/* Close button handled by DialogPrimitive */}
 </div>

 <div className="p-6 overflow-y-auto h-[calc(100vh-80px)] bg-gray-50/50 dark:bg-slate-900/50 space-y-6">
 
 {/* Info Text */}
 <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-100 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
 These Ad credits can be utilized to create and run ads only from AiSensy's Ads Manager. 
 These Ads are run on facebook & instagram and land on whatsapp.
 </div>

 {/* Purchase Section */}
 <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
 <div className="space-y-2">
 <Label className="text-base font-medium text-[#111827] dark:text-white">Enter Amount</Label>
 <p className="text-xs text-gray-500 dark:text-slate-500">Minimum purchase of ₹1500 credits is allowed</p>
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
 </div>
 </div>

 {/* Floating Feedback Button (Hidden for now to match strict design unless requested) */}
 </DialogContent>
 </Dialog>
 )
}
