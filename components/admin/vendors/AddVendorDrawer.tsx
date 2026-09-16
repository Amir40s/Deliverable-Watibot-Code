"use client"
import { X, User, CreditCard, Smartphone, AtSign, Key, Building2, IdCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddVendorDrawerProps {
 isOpen: boolean
 onClose: () => void
}

export default function AddVendorDrawer({ isOpen, onClose }: AddVendorDrawerProps) {
 return (
 <>
 {/* Backdrop */}
 <div 
 className={cn(
 "fixed inset-0 bg-black/40 z-60 transition-all duration-300 backdrop-blur-[1px]",
 isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
 )}
 onClick={onClose}
 />

 {/* Drawer Panel */}
 <div 
 className={cn(
 "fixed top-0 right-0 h-full w-[450px] bg-white dark:bg-slate-900 z-70 shadow-2xl transform transition-all duration-300 ease-in-out flex flex-col",
 isOpen ? "translate-x-0" : "translate-x-full"
 )}
 >
 {/* Header */}
 <div className="h-20 bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-between px-6 shrink-0 shadow-lg shadow-green-500/20">
 <h2 className="text-white text-lg font-medium">Add New Vendor</h2>
 <button 
 onClick={onClose}
 className="text-white/80 hover:text-white transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Form Content */}
 <div className="flex-1 overflow-y-auto p-6 space-y-5">
 {/* Vendor Title */}
 <div className="flex rounded-2xl shadow-sm border-2 border-slate-100 dark:border-slate-700 overflow-hidden focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/10 transition-all duration-300 group">
 <div className="bg-slate-50 dark:bg-slate-800 px-4 flex items-center justify-center border-r-2 border-slate-100 dark:border-slate-700 w-12 shrink-0 transition-colors group-focus-within:border-green-500/50">
 <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="text" 
 placeholder="Vendor Title" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Admin User Divider */}
 <div className="relative py-2">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t border-gray-200 dark:border-slate-700 transition-colors" />
 </div>
 <div className="relative flex justify-center text-xs uppercase">
 <span className="bg-white dark:bg-slate-900 px-2 text-gray-400 dark:text-gray-500 font-medium tracking-wider transition-colors">Admin User</span>
 </div>
 </div>

 {/* Username */}
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <IdCard className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="text" 
 placeholder="Username" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* First Name */}
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="text" 
 placeholder="First Name" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Last Name */}
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="text" 
 placeholder="Last Name" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Mobile Number */}
 <div className="space-y-1">
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <Smartphone className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="text" 
 placeholder="Mobile Number" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>
 <p className="text-[10px] text-zinc-500 dark:text-gray-500 px-1 transition-colors">Mobile number should be with country code without 0 or +</p>
 </div>

 {/* Email */}
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <AtSign className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="email" 
 placeholder="Email" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Password */}
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <Key className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="password" 
 placeholder="Password" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Confirm Password */}
 <div className="flex rounded-md shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <Key className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input 
 type="password" 
 placeholder="Confirm Password" 
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>
 </div>

 {/* Footer Actions */}
 <div className="p-6 pt-2 pb-8 flex justify-end gap-3 bg-white dark:bg-slate-900 shrink-0 transition-colors">
 <button className="px-6 py-2 bg-[#22C55E] text-white rounded-full font-medium text-sm hover:bg-[#16A34A] transition-colors shadow-sm shadow-green-200 dark:shadow-none">
 Add
 </button>
 <button 
 onClick={onClose}
 className="px-6 py-2 bg-[#0F2926] dark:bg-slate-800 text-white rounded-full font-medium text-sm hover:bg-[#081A18] dark:hover:bg-slate-700 transition-colors shadow-sm"
 >
 Close
 </button>
 </div>
 </div>
 </>
 )
}
