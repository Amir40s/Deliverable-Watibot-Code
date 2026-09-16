import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CreditCard, Building2, Layers, DollarSign, Calendar, Activity, Shield } from "lucide-react"
import { getVendors, getPlans } from "@/app/[locale]/admin/vendors/actions"

interface SubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: any) => Promise<void>
    initialData?: any
    isLoading?: boolean
}

export default function SubscriptionModal({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    isLoading
}: SubscriptionModalProps) {
    const [formData, setFormData] = useState({
        vendor: "",
        isAuto: false,
        plan: "",
        startDate: "",
        endDate: "",
        amount: "",
        currency: "USD",
        frequency: "monthly",
        status: "ACTIVE"
    })

    const [vendorsList, setVendorsList] = useState<any[]>([])
    const [loadingVendors, setLoadingVendors] = useState(false)
    const [plansList, setPlansList] = useState<any[]>([])
    const [loadingPlans, setLoadingPlans] = useState(false)

    useEffect(() => {
        if (isOpen) {
            const fetchVendorsList = async () => {
                setLoadingVendors(true)
                try {
                    const data = await getVendors()
                    setVendorsList(data || [])
                } catch (err) {
                    console.error("Failed to fetch vendors:", err)
                } finally {
                    setLoadingVendors(false)
                }
            }
            fetchVendorsList()

            const fetchPlansList = async () => {
                setLoadingPlans(true)
                try {
                    const res = await getPlans()
                    if (res?.success && res.data) {
                        const formattedPlans = res.data.map((p: any) => ({
                            name: p.name,
                            slug: p.slug.toUpperCase()
                        }))
                        setPlansList(formattedPlans)
                    }
                } catch (err) {
                    console.error("Failed to fetch plans:", err)
                    setPlansList([])
                } finally {
                    setLoadingPlans(false)
                }
            }
            fetchPlansList()
        }
    }, [isOpen])

    useEffect(() => {
        if (initialData) {
            setFormData({
                vendor: initialData.vendor,
                isAuto: initialData.isAuto,
                plan: initialData.plan,
                startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : "",
                endDate: initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : "",
                amount: initialData.amount,
                currency: initialData.currency || "USD",
                frequency: initialData.frequency,
                status: initialData.status[0] || "ACTIVE"
            })
        } else {
            setFormData({
                vendor: "",
                isAuto: false,
                plan: "",
                startDate: "",
                endDate: "",
                amount: "",
                currency: "USD",
                frequency: "monthly",
                status: "ACTIVE"
            })
        }
    }, [initialData, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await onSubmit({
            ...formData,
            status: [formData.status]
        })
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0 flex flex-col border-l border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 plus-jakarta-forced">
                
                {/* Header Redesigned to be Premium & Clean */}
                <SheetHeader className="h-20 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between px-6 shrink-0 space-y-0 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="bg-[#e6f4ee] dark:bg-[#00a884]/15 p-2 rounded-xl text-[#00a884]">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <SheetTitle className="text-slate-800 dark:text-white text-lg font-black tracking-tight">
                            {initialData ? "Update Subscription" : "Add Subscription"}
                        </SheetTitle>
                    </div>
                </SheetHeader>

                <form id="subscription-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Vendor Name Dropdown */}
                        <div className="space-y-2">
                            <Label htmlFor="vendor" className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider block px-1">
                                Vendor Name
                            </Label>
                            <div className="relative flex items-center group">
                                <Building2 className="absolute left-4 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none z-10" />
                                <Select
                                    value={formData.vendor}
                                    onValueChange={(value) => setFormData({ ...formData, vendor: value })}
                                >
                                    <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 h-auto text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-700 outline-none flex items-center justify-between">
                                        <SelectValue placeholder={loadingVendors ? "Loading vendors..." : "Select Vendor"} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 plus-jakarta-forced shadow-lg max-h-[250px] overflow-y-auto">
                                        {vendorsList.map((vendor) => (
                                            <SelectItem key={vendor.id} value={vendor.title} className="font-bold text-slate-700 dark:text-slate-250 cursor-pointer">
                                                {vendor.title}
                                            </SelectItem>
                                        ))}
                                        {vendorsList.length === 0 && !loadingVendors && (
                                            <div className="p-3 text-xs text-slate-400 font-bold text-center">No vendors found</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Auto Recurring Toggle Card */}
                        

                        {/* Plan & Amount Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plan" className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider block px-1">
                                    Plan Type
                                </Label>
                                <div className="relative flex items-center group">
                                    <Layers className="absolute left-4 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none z-10" />
                                    <Select
                                        value={formData.plan ? formData.plan.toUpperCase() : ""}
                                        onValueChange={(value) => setFormData({ ...formData, plan: value })}
                                    >
                                        <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 h-auto text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-700 outline-none flex items-center justify-between">
                                            <SelectValue placeholder={loadingPlans ? "Loading plans..." : "Select Plan"} />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 plus-jakarta-forced shadow-lg">
                                            {plansList.map((plan) => (
                                                <SelectItem key={plan.slug} value={plan.slug} className="font-bold text-slate-700 dark:text-slate-250 cursor-pointer">
                                                    {plan.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider block px-1">
                                    Amount (USD)
                                </Label>
                                <div className="relative flex items-center group">
                                    <DollarSign className="absolute left-4 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none" />
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        required
                                        className="w-full bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Start & End Dates Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate" className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider block px-1">
                                    Start Date
                                </Label>
                                <div className="relative flex items-center group">
                                    <Calendar className="absolute left-4 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none" />
                                    <input
                                        id="startDate"
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                        className="w-full bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate" className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider block px-1">
                                    End Date
                                </Label>
                                <div className="relative flex items-center group">
                                    <Calendar className="absolute left-4 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none" />
                                    <input
                                        id="endDate"
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        required
                                        className="w-full bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status (Full width) */}
                        <div className="space-y-2">
                            <Label htmlFor="status" className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-wider block px-1">
                                Status
                            </Label>
                            <div className="relative flex items-center group">
                                <Shield className="absolute left-4 w-4.5 h-4.5 text-slate-400 group-focus-within:text-[#00a884] transition-colors pointer-events-none z-10" />
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 h-auto text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-700 outline-none flex items-center justify-between">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 plus-jakarta-forced shadow-lg">
                                        <SelectItem value="ACTIVE" className="font-bold text-slate-700 dark:text-slate-250 cursor-pointer">Active</SelectItem>
                                        <SelectItem value="EXPIRED" className="font-bold text-slate-700 dark:text-slate-250 cursor-pointer">Expired</SelectItem>
                                        <SelectItem value="CANCELLED" className="font-bold text-slate-700 dark:text-slate-250 cursor-pointer">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                    </div>

                    {/* Footer Redesigned to be Premium, Spacious & Tactile */}
                    <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-4 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 h-12 rounded-2xl font-black text-xs tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] border border-slate-100 dark:border-slate-800"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="flex-[1.4] h-12 bg-[#00a884] hover:bg-[#008f70] text-white rounded-2xl font-black text-xs tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                    <span>Saving</span>
                                </>
                            ) : (
                                <span>{initialData ? "Update Record" : "Create Subscription"}</span>
                            )}
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    )
}
