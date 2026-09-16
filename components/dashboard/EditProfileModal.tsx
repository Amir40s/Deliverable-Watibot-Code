"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
 X, 
 Plus,
 Loader2,
 Image as ImageIcon
} from "lucide-react"
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import { getOrganizationProfile, updateOrganizationProfile } from "@/app/actions/organization"
import { toast } from "sonner"

interface EditProfileModalProps {
 isOpen: boolean
 onOpenChange: (open: boolean) => void
 onSuccess?: () => void
}

export function EditProfileModal({ isOpen, onOpenChange, onSuccess }: EditProfileModalProps) {
 const [isLoading, setIsLoading] = useState(false)
 const [isSaving, setIsSaving] = useState(false)
 const [isUploading, setIsUploading] = useState(false)
 const fileInputRef = useRef<HTMLInputElement>(null)
 const [formData, setFormData] = useState({
 description: "",
 address: "",
 email: "",
 vertical: "apparel",
 websites: [""],
 logo: ""
 })

 useEffect(() => {
 if (isOpen) {
 const loadData = async () => {
 setIsLoading(true)
 try {
 const data = await getOrganizationProfile()
 setFormData({
 description: data.businessDescription || "",
 address: data.businessAddress || "",
 email: data.businessEmail || "",
 vertical: (data.businessVertical as string)?.toLowerCase() || "apparel",
 websites: Array.isArray(data.businessWebsites) ? data.businessWebsites : [""],
 logo: data.businessLogo || ""
 })
 } catch (error) {
 console.error("Failed to load profile", error)
 toast.error("Failed to load profile data")
 } finally {
 setIsLoading(false)
 }
 }
 loadData()
 }
 }, [isOpen])

 const handleSave = async () => {
 setIsSaving(true)
 try {
 const res = await updateOrganizationProfile({
 businessDescription: formData.description,
 businessAddress: formData.address,
 businessEmail: formData.email,
 businessVertical: formData.vertical,
 businessWebsites: formData.websites.filter(w => w.trim() !== ""),
 businessLogo: formData.logo
 })
 if (res.success) {
 toast.success("Profile updated successfully")
 onSuccess?.()
 onOpenChange(false)
 } else {
 toast.error(res.error || "Failed to update profile")
 }
 } catch (error) {
 console.error("Failed to update profile", error)
 toast.error("An unexpected error occurred")
 } finally {
 setIsSaving(false)
 }
 }

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (!file) return

 if (file.size > 5 * 1024 * 1024) {
 toast.error("File size exceeds 5MB limit")
 return
 }

 setIsUploading(true)
 const uploadData = new FormData()
 uploadData.append("file", file)

 try {
 const response = await fetch("/api/upload", {
 method: "POST",
 body: uploadData,
 })

 const data = await response.json()
 if (data.url) {
 setFormData({ ...formData, logo: data.url })
 toast.success("Logo uploaded successfully")
 } else {
 toast.error(data.error || "Upload failed")
 }
 } catch (error) {
 console.error("Upload error:", error)
 toast.error("Failed to upload image")
 } finally {
 setIsUploading(false)
 if (fileInputRef.current) fileInputRef.current.value = ""
 }
 }

 const addWebsite = () => {
 if (formData.websites.length < 2) {
 setFormData({ ...formData, websites: [...formData.websites, ""] })
 }
 }

 const updateWebsite = (index: number, value: string) => {
 const newWebsites = [...formData.websites]
 newWebsites[index] = value
 setFormData({ ...formData, websites: newWebsites })
 }

 return (
 <Dialog open={isOpen} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-[600px] p-0 overflow-hidden border-none rounded-3xl bg-white dark:bg-slate-900 shadow-2xl max-h-[90vh] flex flex-col">
 <input 
 type="file" 
 ref={fileInputRef} 
 className="hidden" 
 accept="image/*"
 onChange={handleFileUpload}
 />
 <div className="p-8 pb-0 relative shrink-0">
 <DialogHeader>
 <DialogTitle className="text-xl font-bold text-[#1F2937] dark:text-white">Edit Profile</DialogTitle>
 </DialogHeader>
 </div>

 <div className="p-8 space-y-8 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
 {isLoading ? (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="w-8 h-8 animate-spin text-[#123E40]" />
 </div>
 ) : (
 <>
 {/* Profile Picture */}
 <div className="space-y-4">
 <div>
 <h3 className="text-[16px] font-normal text-[#374151] dark:text-gray-200">Profile Picture</h3>
 <p className="text-[13px] text-[#6B7280] dark:text-slate-400">
 Max size of 5MB allowed.<br/>
 Image size of 640x640 is recommended.<br/>
 Images with a height or width of less than 192px may cause issues.
 </p>
 </div>
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden relative">
 {formData.logo ? (
 <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
 ) : (
 <div className="absolute inset-0 flex flex-col items-center justify-center pt-5 pointer-events-none opacity-20">
 <div className="w-6 h-6 bg-[#FFB800] rounded-full mb-0.5 shrink-0" />
 <div className="w-16 h-10 bg-[#FFB800] rounded-t-[50%] translate-y-1.5 scale-x-125 shrink-0" />
 </div>
 )}
 {isUploading && (
 <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
 <Loader2 className="w-6 h-6 animate-spin text-white" />
 </div>
 )}
 </div>
 <div className="flex gap-2">
 <Button 
 className="bg-[#123E40] dark:bg-[#1D635F] hover:bg-[#0D2D2E] text-white font-bold h-9 rounded-lg text-xs px-4"
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploading}
 >
 {isUploading ? "Uploading..." : "Add New"}
 </Button>
 {formData.logo && (
 <Button 
 variant="outline" 
 className="text-[#374151] dark:text-gray-200 border-[#E5E7EB] dark:border-slate-700 font-bold h-9 rounded-lg text-xs px-4 hover:bg-[#F3F4F6] dark:hover:bg-slate-800 dark:bg-transparent"
 onClick={() => setFormData({ ...formData, logo: "" })}
 disabled={isUploading}
 >
 Remove
 </Button>
 )}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-6">
 {/* Description */}
 <div className="space-y-2">
 <div className="space-y-1">
 <Label className="text-[16px] font-normal text-[#374151] dark:text-gray-200">Description</Label>
 <p className="text-[13px] text-[#6B7280] dark:text-slate-400">Description of the business.<br/>Maximum of 256 characters.</p>
 </div>
 <Input 
 placeholder="Enter Description"
 className="h-12 bg-[#F3F4F6] dark:bg-slate-800 border-none rounded-lg text-[14px] placeholder:text-[#9CA3AF] px-4 dark:text-white"
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 maxLength={256}
 />
 </div>

 {/* Address */}
 <div className="space-y-2">
 <div className="space-y-1">
 <Label className="text-[16px] font-normal text-[#374151] dark:text-gray-200">Address</Label>
 <p className="text-[13px] text-[#6B7280] dark:text-slate-400">Address of the business.<br/>Maximum of 256 characters.</p>
 </div>
 <Input 
 placeholder="Enter Address"
 className="h-12 bg-[#F3F4F6] dark:bg-slate-800 border-none rounded-lg text-[14px] placeholder:text-[#9CA3AF] px-4 dark:text-white"
 value={formData.address}
 onChange={(e) => setFormData({ ...formData, address: e.target.value })}
 maxLength={256}
 />
 </div>

 {/* Email */}
 <div className="space-y-2">
 <div className="space-y-1">
 <Label className="text-[16px] font-normal text-[#374151] dark:text-gray-200">Email</Label>
 <p className="text-[13px] text-[#6B7280] dark:text-slate-400">Email address (in valid email format) to contact the business.<br/>Maximum of 128 characters.</p>
 </div>
 <Input 
 placeholder="Enter Email"
 className="h-12 bg-[#F3F4F6] dark:bg-slate-800 border-none rounded-lg text-[14px] placeholder:text-[#9CA3AF] px-4 dark:text-white"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 maxLength={128}
 />
 </div>

 </div>

 {/* Websites */}
 <div className="space-y-2">
 <div className="space-y-1">
 <Label className="text-[16px] font-normal text-[#374151] dark:text-gray-200">Websites</Label>
 <p className="text-[13px] text-[#6B7280] dark:text-slate-400">
 URLs (including http:// or https://) associated with the business (e.g., website, Facebook Page, Instagram).<br/>
 Maximum of 2 websites with a maximum of 256 characters each.
 </p>
 </div>
 <div className="space-y-3 pt-2">
 {formData.websites.map((website, idx) => (
 <div key={idx} className="relative">
 <Input 
 value={website}
 onChange={(e) => updateWebsite(idx, e.target.value)}
 className="h-12 bg-[#F3F4F6] dark:bg-slate-800 border-none rounded-lg text-[14px] placeholder:text-[#9CA3AF] px-4 pr-12 dark:text-white"
 placeholder="https://..."
 />
 {idx === formData.websites.length - 1 && formData.websites.length < 2 && (
 <button 
 onClick={addWebsite}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-[#374151] hover:text-[#123E40] dark:text-gray-400 dark:hover:text-white transition-colors"
 >
 <Plus className="w-5 h-5" />
 </button>
 )}
 </div>
 ))}
 </div>
 </div>
 </>
 )}
 </div>

 {/* Footer Buttons */}
 <div className="px-8 py-6 flex justify-end gap-3 bg-white dark:bg-slate-900 border-t border-transparent dark:border-slate-800 shrink-0">
 <Button 
 variant="outline" 
 onClick={() => onOpenChange(false)}
 className="h-11 px-6 rounded-lg font-normal text-[#374151] hover:bg-[#F3F4F6] border-[#E5E7EB] dark:bg-transparent dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
 disabled={isSaving}
 >
 Cancel
 </Button>
 <Button 
 className="h-11 px-8 rounded-lg font-normal bg-[#123E40] dark:bg-[#1D635F] text-white hover:bg-[#0D2D2E]"
 onClick={handleSave}
 disabled={isSaving || isLoading || isUploading}
 >
 {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
 {isSaving ? "Saving..." : "Save"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 )
}
