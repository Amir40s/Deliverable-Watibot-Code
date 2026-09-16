"use client"

import { useState } from "react"
import { User, Smartphone, AtSign, Key, IdCard, Building2, Loader2, Plus } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { createVendor } from "@/app/[locale]/admin/vendors/actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface AddVendorSheetProps {
    isOpen: boolean
    onClose: () => void
}

export default function AddVendorSheet({ isOpen, onClose }: AddVendorSheetProps) {
    const t = useTranslations("Vendors")
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
            toast.error(t("passwordsNotMatch"))
            return
        }

        setIsLoading(true)
        try {
            const result = await createVendor(formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t("createdSuccess"))
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
            toast.error(t("failedCreate"))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 flex flex-col border-0 shadow-2xl bg-white dark:bg-slate-900 border-l dark:border-slate-800">
                <SheetHeader className="h-20 bg-emerald-600 flex flex-row items-center px-6 shrink-0 space-y-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <SheetTitle className="text-white text-xl font-bold tracking-tight">
                            {t("newVendor")}
                        </SheetTitle>
                    </div>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-950">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest px-1">{t("orgDetails")}</label>
                            <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-12 shrink-0">
                                    <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder={t("vendorTitle")}
                                    required
                                    className="flex-1 px-4 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest px-1">{t("adminUserAccount")}</label>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                    <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-12 shrink-0">
                                        <IdCard className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        placeholder={t("username")}
                                        required
                                        className="flex-1 px-4 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-10 shrink-0">
                                            <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            placeholder={t("firstName")}
                                            required
                                            className="flex-1 px-3 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        />
                                    </div>
                                    <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-10 shrink-0">
                                            <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            placeholder={t("lastName")}
                                            className="flex-1 px-3 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-12 shrink-0">
                                            <Smartphone className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            name="whatsappNumber"
                                            value={formData.whatsappNumber}
                                            onChange={handleChange}
                                            placeholder={t("mobileNumber")}
                                            required
                                            className="flex-1 px-4 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium px-1">
                                        {t("countryCodeNote")}
                                    </p>
                                </div>

                                <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                    <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-12 shrink-0">
                                        <AtSign className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder={t("emailAddress")}
                                        required
                                        className="flex-1 px-4 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-12 shrink-0">
                                            <Key className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder={t("password")}
                                            required
                                            className="flex-1 px-4 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        />
                                    </div>
                                    <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all group">
                                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 w-12 shrink-0">
                                            <Key className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            placeholder={t("confirmPassword")}
                                            required
                                            className="flex-1 px-4 py-3.5 text-sm outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <SheetFooter className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 h-12 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                        >
                            {t("cancelProject")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="flex-[1.5] h-12 bg-[#00B074] text-white rounded-xl font-bold hover:bg-[#054C44] transition-all shadow-lg shadow-[#00B074]/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>{t("provisioning")}</span>
                                </>
                            ) : (
                                <span>{t("provisionVendor")}</span>
                            )}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    )
}
