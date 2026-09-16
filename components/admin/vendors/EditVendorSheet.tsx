"use client"

import { useState, useEffect } from "react"
import { 
    Building2, User, Mail, Smartphone, MessageSquare, Globe, Clock, AtSign, 
    Shield, Activity, CheckCircle2, Lock, Key, CreditCard, Calendar, RefreshCw, 
    Settings, Bot, Zap, Database, MessageCircle, FileText, X, Edit, Loader2, Save,
    Check
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { updateVendor, getVendorFullDetails, getPlans } from "@/app/[locale]/admin/vendors/actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { findPlanBySlug, getCanonicalPlanSlug, getPlanStorageLimit } from "@/lib/plan-slugs"
import { useRouter } from "next/navigation"

interface EditVendorSheetProps {
    isOpen: boolean
    onClose: () => void
    vendor: any
}

function SectionHeading({ title, icon: Icon, description }: { title: string, icon: any, description?: string }) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
            </div>
            {description && <p className="text-xs text-slate-500 ml-8">{description}</p>}
        </div>
    )
}

function InputField({ label, icon: Icon, type = "text", name, value, onChange, placeholder, disabled = false }: any) {
    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">{label}</label>
            <div className="relative flex items-center group">
                {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none" />}
                <input
                    type={type}
                    name={name}
                    value={value || ""}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl py-2.5 pr-4 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/40 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm",
                        Icon ? "pl-10" : "pl-4",
                        disabled && "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
                    )}
                />
            </div>
        </div>
    )
}

function SelectField({ label, icon: Icon, name, value, onChange, options, placeholder }: any) {
    const safeOptions = Array.isArray(options) ? options : [];
    
    // Find matching option (exact or case-insensitive)
    let selectedOpt = safeOptions.find((opt: any) => opt.value === value);
    if (!selectedOpt && value) {
        selectedOpt = safeOptions.find((opt: any) => String(opt.value).toLowerCase() === String(value).toLowerCase());
    }
    
    const selectedValue = selectedOpt ? selectedOpt.value : (value || "");

    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">{label}</label>
            <div className="relative flex items-center group">
                {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none z-10" />}
                <Select value={selectedValue} onValueChange={(val) => onChange({ target: { name, value: val } } as any)}>
                    <SelectTrigger className={cn(
                        "w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl py-2.5 pr-4 h-auto text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/40 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm outline-none flex items-center justify-between",
                        Icon ? "pl-10" : "pl-4"
                    )}>
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 plus-jakarta-forced shadow-lg z-[20000]">
                        {safeOptions.map((opt: any, idx: number) => (
                            <SelectItem key={opt.value + "_" + idx} value={opt.value} className="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer py-2">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}

function ToggleField({ label, description, name, checked, onChange }: any) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-800/20 shadow-sm">
            <div className="space-y-0.5 pr-4">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</p>
                {description && <p className="text-xs text-slate-500 leading-snug">{description}</p>}
            </div>
            <Switch checked={checked} onCheckedChange={(val) => onChange({ target: { name, value: val } } as any)} className="data-[state=checked]:bg-[#00a884]" />
        </div>
    )
}

export default function EditVendorSheet({ isOpen, onClose, vendor }: EditVendorSheetProps) {
    const router = useRouter()
    const t = useTranslations("Vendors")
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    
    const [formData, setFormData] = useState<any>({})
    const [originalData, setOriginalData] = useState<any>({})
    const [plans, setPlans] = useState<any[]>([])

    useEffect(() => {
        if (isOpen) {
            getPlans().then(res => {
                if (res?.success && res.data) {
                    setPlans(res.data)
                }
            })
        }
    }, [isOpen])

    useEffect(() => {
        if (isOpen && vendor?.id) {
            setIsFetching(true)
            getVendorFullDetails(vendor.id).then(res => {
                if (res.success && res.data) {
                    const org = res.data.organization
                    const sub = res.data.subscription as any
                    const user = org?.users?.[0]
                    const config = (org?.vendorConfig as any) || {}
                    const rawPlanSlug = sub?.plan || org?.plan || "free"
                    const resolvedPlanSlug = findPlanBySlug(plans, rawPlanSlug)?.slug || getCanonicalPlanSlug(rawPlanSlug, plans)
                    
                    const initialData = {
                        id: vendor.id,
                        title: org?.name || "",
                        contactPerson: user?.name || "",
                        email: user?.email || "",
                        mobileNumber: user?.phoneNumber || "",
                        whatsappNumber: org?.whatsappNumber || "",
                        country: config.country || "",
                        timezone: org?.timezone || "UTC",
                        username: org?.slug || "",

                        role: user?.role || "ADMIN",
                        status: user?.status || "ACTIVE",
                        emailVerified: !!user?.emailVerified,
                        phoneVerified: config.phoneVerified || false,
                        twoFactorAuth: config.twoFactorAuth || false,
                        allowLogin: config.allowLogin !== false,
                        loginAsVendor: config.loginAsVendor !== false,

                        plan: resolvedPlanSlug,
                        billingCycle: sub?.frequency || "monthly",
                        subscriptionStatus: sub?.status?.[0] || org?.status || "active",
                        trialStartDate: user?.trialStartDate ? new Date(user.trialStartDate).toISOString().split('T')[0] : "",
                        trialEndDate: (user?.trialStartDate && user?.trialLimitDays)
                          ? new Date(new Date(user.trialStartDate).getTime() + user.trialLimitDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                          : "",
                        expiryDate: sub?.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : "",
                        nextBillingDate: sub?.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : "",
                        autoRenew: config.autoRenew !== false,

                        contactsLimit: config.contactsLimit || 1000,
                        broadcastLimit: config.broadcastLimit || 1000,
                        campaignLimit: config.campaignLimit || 5,
                        maxBotFlows: config.maxBotFlows || 2,
                        maxTeamMembers: config.maxTeamMembers || config.maxMembers || 1,
                        storageLimit: config.storageLimit || 5,
                        aiCredits: config.aiCredits || 100,
                        isAiBotEnabled: org?.isAiBotEnabled || false,
                        enableCampaigns: config.enableCampaigns !== false,
                        enableApiAccess: config.enableApiAccess !== false,
                        enableLiveChat: config.enableLiveChat !== false,
                        enableAutomation: config.enableAutomation !== false,

                        knowledgeBaseManagement: config.knowledgeBaseManagement || "user",
                        aiMessageLimit: typeof config.aiMessageLimit === "number" ? config.aiMessageLimit : 5000,
                        isAiLimitUnlimited: !!config.isAiLimitUnlimited,
                        aiUsage: org?.aiUsageInfo?.usage || 0,

                        adminNotes: org?.adminNotes || "",
                        metaVerificationStatus: org?.whatsapp_token_info_data ? "Verified" : "Unverified"
                    }
                    
                    setFormData(initialData)
                    setOriginalData(initialData)
                    setHasChanges(false)
                }
                setIsFetching(false)
            })
        }
    }, [isOpen, vendor?.id, plans])

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target
        // Convert input type numbers
        const val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
        
        setFormData((prev: any) => {
            let newData = { ...prev, [name]: val }
            
            // If plan changes, automatically populate the plan limits as default values
            if (name === "plan") {
                const selectedPlan = findPlanBySlug(plans, val);
                if (selectedPlan) {
                    newData = {
                        ...newData,
                        plan: selectedPlan.slug,
                        contactsLimit: selectedPlan.maxContacts ?? 100,
                        broadcastLimit: selectedPlan.maxBotReplies ?? 100,
                        campaignLimit: selectedPlan.maxCampaigns ?? 10,
                        maxBotFlows: selectedPlan.maxBotFlows ?? 2,
                        maxTeamMembers: selectedPlan.maxTeamMembers ?? 1,
                        storageLimit: getPlanStorageLimit(selectedPlan.slug, plans),
                        aiCredits: selectedPlan.aiChatBotEnabled ? 500 : 0,
                        enableCampaigns: selectedPlan.maxCampaigns !== 0,
                        enableApiAccess: selectedPlan.apiWebhookAccess,
                        enableAutomation: selectedPlan.maxBotFlows !== 0,
                    };
                }
            }
            
            setHasChanges(JSON.stringify(newData) !== JSON.stringify(originalData))
            return newData
        })
    }

    const handleReset = () => {
        setFormData(originalData)
        setHasChanges(false)
        toast.info("Changes reset to original values")
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        setIsLoading(true)
        try {
            const result = await updateVendor(formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success(t("updatedSuccess"))
                router.refresh()
                onClose()
            }
        } catch (error) {
            toast.error(t("failedUpdate"))
        } finally {
            setIsLoading(false)
        }
    }

    if (!vendor && !isOpen) return null

    const initials = formData.title ? formData.title.substring(0, 2).toUpperCase() : "V"
    const planOptions = plans.map((plan) => ({
        value: plan.slug,
        label: plan.name || plan.slug
    }))

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-0 flex flex-col border-0 shadow-2xl bg-[#F7F8FA] dark:bg-slate-950 plus-jakarta-forced">
                <SheetHeader className="h-auto py-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col px-6 sm:px-8 shrink-0 bg-white dark:bg-slate-900 z-10 shadow-sm relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-4 mt-2">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl bg-gradient-to-br from-[#00a884]/10 to-emerald-600/10 text-[#00a884] ring-1 ring-[#00a884]/20 shadow-sm shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1">
                            <SheetTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                                {formData.title || t("editVendorDetails")}
                                {formData.status === "ACTIVE" ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">Active</span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">{formData.status}</span>
                                )}
                            </SheetTitle>
                            <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
                                <AtSign className="w-3.5 h-3.5" /> {formData.username || vendor?.username || "—"}
                                <span className="mx-2 text-slate-300">•</span>
                                <span className="font-mono">{formData.id}</span>
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                 <form id="edit-vendor-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                        {isFetching ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-4">
                                <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
                                <p className="text-sm font-bold text-slate-500">Loading vendor details...</p>
                            </div>
                        ) : (
                            <>
                                {/* SECTION 1: Organization Details */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                                    <SectionHeading title="Organization Details" icon={Building2} description="Basic information about the vendor's organization and primary contact." />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                                        <InputField label="Organization Name" name="title" icon={Building2} value={formData.title} onChange={handleChange} required />
                                        <InputField label="Username (Slug)" name="username" icon={AtSign} value={formData.username} onChange={handleChange} />
                                        <InputField label="Contact Person" name="contactPerson" icon={User} value={formData.contactPerson} onChange={handleChange} />
                                        <InputField label="Email Address" name="email" type="email" icon={Mail} value={formData.email} onChange={handleChange} />
                                        <InputField label="Mobile Number" name="mobileNumber" icon={Smartphone} value={formData.mobileNumber} onChange={handleChange} />
                                        <InputField label="WhatsApp Number" name="whatsappNumber" icon={MessageSquare} value={formData.whatsappNumber} onChange={handleChange} />
                                        <InputField label="Country" name="country" icon={Globe} value={formData.country} onChange={handleChange} />
                                        <InputField label="Timezone" name="timezone" icon={Clock} value={formData.timezone} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* SECTION 2: Account Settings */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                                    <SectionHeading title="Account Settings" icon={Shield} description="Manage roles, access status, and security verification." />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 mb-6">
                                        <SelectField label="Account Status" name="status" icon={Activity} value={formData.status} onChange={handleChange} options={[
                                            { value: "ACTIVE", label: "Active" },
                                            { value: "INACTIVE", label: "Inactive" },
                                            { value: "PENDING", label: "Pending" },
                                            { value: "SUSPENDED", label: "Suspended" },
                                            { value: "TRIAL", label: "Trial" }
                                        ]} />
                                        <SelectField label="Role" name="role" icon={Shield} value={formData.role} onChange={handleChange} options={[
                                            { value: "SUPER_ADMIN", label: "Super Admin" },
                                            { value: "ADMIN", label: "Admin" },
                                            { value: "USER", label: "User" }
                                        ]} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ToggleField label="Email Verified" description="User has verified their email address" name="emailVerified" checked={formData.emailVerified} onChange={handleChange} />
                                        <ToggleField label="Phone Verified" description="User has verified their phone number" name="phoneVerified" checked={formData.phoneVerified} onChange={handleChange} />
                                        <ToggleField label="Two-Factor Auth" description="Require 2FA for this account" name="twoFactorAuth" checked={formData.twoFactorAuth} onChange={handleChange} />
                                        <ToggleField label="Allow Login" description="User can log into the dashboard" name="allowLogin" checked={formData.allowLogin} onChange={handleChange} />
                                    </div>
                                </div>

                                {/* SECTION 3: Subscription */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm relative z-20">
                                    <SectionHeading title="Subscription & Billing" icon={CreditCard} description="Manage the vendor's active plan and billing cycle." />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 mb-6 relative z-30">
                                        <SelectField label="Current Plan" name="plan" icon={CreditCard} value={formData.plan} onChange={handleChange} options={planOptions} />
                                        <SelectField label="Billing Cycle" name="billingCycle" icon={RefreshCw} value={formData.billingCycle} onChange={handleChange} options={[
                                            { value: "monthly", label: "Monthly" },
                                            { value: "yearly", label: "Yearly" }
                                        ]} />
                                        <SelectField label="Subscription Status" name="subscriptionStatus" icon={Activity} value={formData.subscriptionStatus} onChange={handleChange} options={[
                                            { value: "active", label: "Active" },
                                            { value: "past_due", label: "Past Due" },
                                            { value: "canceled", label: "Canceled" }
                                        ]} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6 relative z-10">
                                        <InputField type="date" label="Next Billing Date" name="nextBillingDate" icon={Calendar} value={formData.nextBillingDate} onChange={handleChange} />
                                        <InputField type="date" label="Expiry Date" name="expiryDate" icon={Calendar} value={formData.expiryDate} onChange={handleChange} />
                                    </div>
                                    <ToggleField label="Auto Renew" description="Automatically renew subscription at end of cycle" name="autoRenew" checked={formData.autoRenew} onChange={handleChange} />
                                </div>

                                {/* SECTION 4: WhatsApp Integration */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 border-dashed">
                                    <div className="flex items-center justify-between mb-4">
                                        <SectionHeading title="WhatsApp Integration" icon={MessageCircle} description="Current WhatsApp connection status (Read-only view)" />
                                        {formData.metaVerificationStatus === "Verified" ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500 text-xs font-bold border border-slate-300 dark:border-slate-700">
                                                Disconnected
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <InputField label="Meta Verification Status" value={formData.metaVerificationStatus} disabled icon={Shield} />
                                        <InputField label="Connected Number" value={formData.whatsappNumber} disabled icon={Smartphone} />
                                    </div>
                                </div>

                                {/* SECTION 5: Knowledge Base & AI Message Limit */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-6">
                                    <SectionHeading 
                                        title="Knowledge Base & AI Controls" 
                                        icon={Database} 
                                        description="Configure whether the user manages their Knowledge Base and set AI message usage quotas." 
                                    />

                                    {/* 1. Knowledge Base Management */}
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                                            Knowledge Base Management
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className={cn(
                                                "flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all",
                                                formData.knowledgeBaseManagement === "user" || !formData.knowledgeBaseManagement
                                                    ? "border-[#00a884] bg-emerald-50/20 dark:bg-emerald-950/10 ring-1 ring-[#00a884]"
                                                    : "border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                                            )}>
                                                <input
                                                    type="radio"
                                                    name="knowledgeBaseManagement"
                                                    value="user"
                                                    checked={formData.knowledgeBaseManagement === "user" || !formData.knowledgeBaseManagement}
                                                    onChange={() => handleChange({ target: { name: "knowledgeBaseManagement", value: "user" } })}
                                                    className="mt-1 text-[#00a884] focus:ring-[#00a884] h-4 w-4"
                                                />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">User</p>
                                                    <p className="text-xs text-slate-500 leading-snug">
                                                        User manages their Knowledge Base directly. The Knowledge Base menu item and page remain visible.
                                                    </p>
                                                </div>
                                            </label>

                                            <label className={cn(
                                                "flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all",
                                                formData.knowledgeBaseManagement === "admin"
                                                    ? "border-[#00a884] bg-emerald-50/20 dark:bg-emerald-950/10 ring-1 ring-[#00a884]"
                                                    : "border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                                            )}>
                                                <input
                                                    type="radio"
                                                    name="knowledgeBaseManagement"
                                                    value="admin"
                                                    checked={formData.knowledgeBaseManagement === "admin"}
                                                    onChange={() => handleChange({ target: { name: "knowledgeBaseManagement", value: "admin" } })}
                                                    className="mt-1 text-[#00a884] focus:ring-[#00a884] h-4 w-4"
                                                />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Admin</p>
                                                    <p className="text-xs text-slate-500 leading-snug">
                                                        Hidden from user. Admin manages it by using &quot;Sign In As User&quot;.
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* 2. AI Message Limit & Usage Display */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                                                    AI Message Limit
                                                </label>
                                                <p className="text-xs text-slate-500">Maximum automated AI messages allowed for this user.</p>
                                            </div>
                                            
                                            {/* Live Usage Stat Badge */}
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">AI Usage</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
                                                    {(formData.aiUsage ?? 0).toLocaleString()} / {formData.isAiLimitUnlimited ? "Unlimited" : (formData.aiMessageLimit ?? 5000).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                                            <div className="space-y-1.5">
                                                <div className="relative flex items-center group">
                                                    <Bot className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none" />
                                                    <input
                                                        type="number"
                                                        name="aiMessageLimit"
                                                        min={0}
                                                        value={formData.isAiLimitUnlimited ? "" : (formData.aiMessageLimit ?? 5000)}
                                                        onChange={handleChange}
                                                        disabled={formData.isAiLimitUnlimited}
                                                        placeholder={formData.isAiLimitUnlimited ? "Unlimited" : "5000"}
                                                        className={cn(
                                                            "w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/40 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm",
                                                            formData.isAiLimitUnlimited && "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    name="isAiLimitUnlimited"
                                                    checked={!!formData.isAiLimitUnlimited}
                                                    onChange={(e) => handleChange({ target: { name: "isAiLimitUnlimited", value: e.target.checked, type: "checkbox", checked: e.target.checked } })}
                                                    className="w-4 h-4 text-[#00a884] rounded border-slate-300 focus:ring-[#00a884]"
                                                />
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Unlimited</p>
                                                    <p className="text-[10px] text-slate-500">Allow unlimited AI messages without restriction</p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 6: Notes */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                                    <SectionHeading title="Internal Admin Notes" icon={FileText} description="Notes about this vendor. Only visible to Super Admins." />
                                    <div className="mt-4">
                                        <textarea
                                            name="adminNotes"
                                            value={formData.adminNotes}
                                            onChange={handleChange}
                                            placeholder="Write internal notes here..."
                                            rows={5}
                                            className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl p-4 text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/40 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm resize-none"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* FOOTER - Sticky */}
                    <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleReset}
                            disabled={isLoading || isFetching || !hasChanges}
                            className="h-11 px-5 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Reset
                        </Button>
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={isLoading}
                                className="h-11 px-5 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="edit-vendor-form"
                                disabled={isLoading || isFetching || !hasChanges}
                                className={cn(
                                    "h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm",
                                    hasChanges 
                                        ? "bg-[#00a884] hover:bg-[#009474] text-white" 
                                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                                )}
                            >
                                {isLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Save Changes</>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    )
}
