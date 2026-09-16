"use client"

import { useState } from "react"
import { User, Smartphone, AtSign, Key, IdCard, Building2, Loader2 } from "lucide-react"
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from "@/components/ui/dialog"
import { createVendor } from "@/app/[locale]/admin/vendors/actions"
import { toast } from "sonner"

interface AddVendorModalProps {
 isOpen: boolean
 onClose: () => void
}

export default function AddVendorModal({ isOpen, onClose }: AddVendorModalProps) {
 const [isLoading, setIsLoading] = useState(false)
 const [formData, setFormData] = useState({
 title: "",
 username: "",
 firstName: "",
 lastName: "",
 whatsappNumber: "",
 email: "",
 password: "",
 confirmPassword: ""
 })

 const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const { name, value } = e.target
 setFormData(prev => ({ ...prev, [name]: value }))
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 
 if (formData.password !== formData.confirmPassword) {
 toast.error("Passwords do not match")
 return
 }

 setIsLoading(true)
 try {
 const result = await createVendor(formData)
 if (result.error) {
 toast.error(result.error)
 } else {
 toast.success("Vendor created successfully")
 setFormData({
 title: "",
 username: "",
 firstName: "",
 lastName: "",
 whatsappNumber: "",
 email: "",
 password: "",
 confirmPassword: ""
 })
 onClose()
 }
 } catch (error) {
 toast.error("Failed to create vendor")
 } finally {
 setIsLoading(false)
 }
 }

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden sm:rounded-2xl border-slate-200 dark:border-slate-700 shadow-xl [&>button]:text-gray-900 [&>button]:hover:text-gray-800 [&>button]:top-4 [&>button]:right-4">
 {/* Header - same green as Create Vendor button (#5ED96E) */}
 <DialogHeader className="h-16 bg-[#5ED96E] flex flex-row items-center justify-between px-6 shrink-0 rounded-t-2xl">
 <DialogTitle className="text-gray-900 text-lg font-semibold">
 Add New Vendor
 </DialogTitle>
 </DialogHeader>

 {/* Form Content - scrollable */}
 <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
 <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
 {/* Vendor Title */}
 <div className="flex rounded-xl shadow-sm border-2 border-slate-100 dark:border-slate-700 overflow-hidden focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/10 transition-all duration-300 group">
 <div className="bg-slate-50 dark:bg-slate-800 px-4 flex items-center justify-center border-r-2 border-slate-100 dark:border-slate-700 w-12 shrink-0 transition-colors group-focus-within:border-green-500/50">
 <Building2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="text"
 name="title"
 value={formData.title}
 onChange={handleChange}
 placeholder="Vendor Title"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Admin User Divider */}
 <div className="relative py-2">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t border-gray-200 dark:border-slate-700 transition-colors" />
 </div>
 <div className="relative flex justify-center text-xs uppercase">
 <span className="bg-white dark:bg-slate-900 px-2 text-gray-400 dark:text-gray-500 font-medium tracking-wider transition-colors">
 Admin User
 </span>
 </div>
 </div>

 {/* Username */}
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <IdCard className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="text"
 name="username"
 value={formData.username}
 onChange={handleChange}
 placeholder="Username"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* First Name */}
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="text"
 name="firstName"
 value={formData.firstName}
 onChange={handleChange}
 placeholder="First Name"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Last Name */}
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="text"
 name="lastName"
 value={formData.lastName}
 onChange={handleChange}
 placeholder="Last Name"
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Mobile Number */}
 <div className="space-y-1">
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <Smartphone className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="text"
 name="whatsappNumber"
 value={formData.whatsappNumber}
 onChange={handleChange}
 placeholder="Mobile Number"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>
 <p className="text-[10px] text-zinc-500 dark:text-gray-500 px-1 transition-colors">
 Mobile number should be with country code without 0 or +
 </p>
 </div>

 {/* Email */}
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <AtSign className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="email"
 name="email"
 value={formData.email}
 onChange={handleChange}
 placeholder="Email"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Password */}
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <Key className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="password"
 name="password"
 value={formData.password}
 onChange={handleChange}
 placeholder="Password"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>

 {/* Confirm Password */}
 <div className="flex rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden focus-within:ring-1 focus-within:ring-green-500 transition-all">
 <div className="bg-gray-50 dark:bg-slate-800 px-3 flex items-center justify-center border-r border-gray-200 dark:border-slate-700 w-12 shrink-0 transition-colors">
 <Key className="w-5 h-5 text-gray-400 dark:text-gray-500" />
 </div>
 <input
 type="password"
 name="confirmPassword"
 value={formData.confirmPassword}
 onChange={handleChange}
 placeholder="Confirm Password"
 required
 className="flex-1 px-4 py-2.5 text-sm outline-none text-gray-700 dark:text-gray-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
 />
 </div>
 </div>

 {/* Footer Actions */}
 <DialogFooter className="p-6 pt-4 flex justify-end gap-2 shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
 <button
 type="button"
 onClick={onClose}
 disabled={isLoading}
 className="px-5 py-2 rounded-full font-medium text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
 >
 Close
 </button>
 <button
 type="submit"
 disabled={isLoading}
 className="px-5 py-2 bg-[#22C55E] text-white rounded-full font-medium text-sm hover:bg-[#16A34A] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
 >
 {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
 {isLoading ? "Adding..." : "Add"}
 </button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 )
}
