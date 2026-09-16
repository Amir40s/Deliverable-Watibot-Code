"use client"

import React, { useState, useEffect } from "react"
import { 
  X, 
  Check,
  ArrowRight,
  Loader2,
  Zap
} from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { findPlanBySlug, getCanonicalPlanSlug, getPlanFamily } from "@/lib/plan-slugs"

interface ChangePlanModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type BillingCycle = "monthly" | "quarterly" | "yearly"
type PaymentProvider = "stripe" | "payfast"

function submitCheckoutResponse(data: any) {
  if (data?.formAction && data?.formFields) {
    const form = document.createElement("form")
    form.method = data.formMethod || "POST"
    form.action = data.formAction
    Object.entries(data.formFields as Record<string, unknown>).forEach(([key, value]) => {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = key
      input.value = String(value ?? "")
      form.appendChild(input)
    })
    document.body.appendChild(form)
    form.submit()
    return true
  }
  if (data?.url) {
    window.location.href = data.url
    return true
  }
  return false
}

export function ChangePlanModal({ isOpen, onOpenChange }: ChangePlanModalProps) {
  const { data: session, update: updateSession } = useSession()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("stripe")
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return
      setIsLoading(true)
      try {
        const [plansData, statusData] = await Promise.all([getPlans(), getLatestStatus()])
        const finalPlans = plansData || []
        setPlans(finalPlans)
        if (statusData) {
          const planSlug = statusData.plan?.toLowerCase() || 'free'
          const resolvedCurrentPlan = findPlanBySlug(finalPlans, planSlug)?.slug || getCanonicalPlanSlug(planSlug, finalPlans)
          const firstPaidPlan = finalPlans.find((plan) => getPlanFamily(plan.slug, finalPlans) !== 'free')?.slug || finalPlans[0]?.slug || null
          setCurrentPlan(resolvedCurrentPlan)
          setSelectedPlanSlug(getPlanFamily(resolvedCurrentPlan, finalPlans) === 'free' ? firstPaidPlan : resolvedCurrentPlan)
        }
      } catch (error) {
        console.error("Failed to load plans", error)
        toast.error("Failed to load subscription plans")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [isOpen])

  const selectedPlan = selectedPlanSlug ? findPlanBySlug(plans, selectedPlanSlug) : undefined

  const calculatePrice = (plan: any) => {
    if (!plan) return 0
    let price = 0
    if (billingCycle === 'monthly') price = Number(plan.monthlyPrice)
    else if (billingCycle === 'quarterly') price = Number(plan.quarterlyPrice)
    else price = Number(plan.yearlyPrice)
    return isNaN(price) ? 0 : price
  }

  const handlePurchase = async () => {
    if (!selectedPlanSlug || selectedPlanSlug === currentPlan) return
    setIsUpdating(true)
    try {
      const price = calculatePrice(selectedPlan)
      if (price === 0) {
        const result = await updateOrganizationPlan(selectedPlanSlug)
        if (result.success) {
          await updateSession();
          toast.success("Subscription Updated", { description: `Switched to ${selectedPlan?.name}.` })
          onOpenChange(false)
          window.location.reload()
        } else {
          toast.error(result.error || "Failed to update subscription")
        }
        setIsUpdating(false)
        return
      }
      const checkoutEndpoint = paymentProvider === "stripe" ? "/api/stripe/checkout" : "/api/payfast/checkout"
      const response = await fetch(checkoutEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: selectedPlanSlug,
          billingCycle,
          locale: window.location.pathname.split("/").filter(Boolean)[0] || "en"
        })
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || "Failed to initialize checkout.")
        setIsUpdating(false)
        return
      }
      if (!submitCheckoutResponse(data)) {
        toast.error("Invalid response from payment gateway.")
        setIsUpdating(false)
      }
    } catch (error) {
      console.error("Upgrade failed", error)
      toast.error("An unexpected error occurred during upgrade")
      setIsUpdating(false)
    }
  }

  const currencySymbol = (currency: string) =>
    currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="plus-jakarta-forced fixed right-0 top-0 left-auto h-full w-full max-w-[1200px] translate-x-0 translate-y-0 border-l shadow-2xl p-0 gap-0 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right rounded-none bg-white dark:bg-slate-900 dark:border-slate-800 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 lg:p-8 border-b border-slate-200/60 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-[#00a884]/10 dark:bg-[#00a884]/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#00a884]" />
              </div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Upgrade Plan</h2>
            </div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Choose the perfect plan for your business</p>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 mt-4 sm:mt-0">
            {/* Billing Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 h-10 w-[320px]">
              {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={cn(
                    "flex-1 rounded-lg text-[11px] font-black tracking-wider uppercase transition-all flex items-center justify-center",
                    billingCycle === cycle
                      ? "bg-[#00a884] text-white shadow-sm"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  {cycle === 'quarterly' ? 'Qtrly' : cycle}
                  {cycle === 'quarterly' && (
                    <span className={cn("ml-1 text-[9px] font-black", billingCycle === cycle ? "text-green-100" : "text-purple-500")}>
                      -10%
                    </span>
                  )}
                  {cycle === 'yearly' && (
                    <span className={cn("ml-1 text-[9px] font-black", billingCycle === cycle ? "text-green-100" : "text-[#00a884]")}>
                      -20%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Payment Toggle */}
            <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 h-10 w-[180px]">
              {(['stripe', 'payfast'] as PaymentProvider[]).map((provider) => (
                <button
                  key={provider}
                  onClick={() => setPaymentProvider(provider)}
                  className={cn(
                    "flex-1 rounded-lg text-[11px] font-black tracking-wider uppercase transition-all flex items-center justify-center",
                    paymentProvider === provider
                      ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-none bg-[#fafbfc] dark:bg-slate-950 p-6 lg:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-[#00a884]" />
            </div>
          ) : (
            <div className="flex flex-col h-full">

              {/* Plan Cards — Horizontal Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5 flex-1 pb-4">
                {plans.map((plan) => {
                  const isCurrent = getPlanFamily(currentPlan) === getPlanFamily(plan.slug)
                  const isSelected = selectedPlanSlug === plan.slug
                  const price = calculatePrice(plan)
                  const isPopular = ['premium', 'prem'].includes(plan.slug?.toLowerCase())

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanSlug(plan.slug)}
                      className={cn(
                        "relative border-2 rounded-[18px] p-4 cursor-pointer transition-all duration-200 flex flex-col gap-3 h-full",
                        isSelected
                          ? "border-[#00a884] bg-[#00a884]/5 dark:bg-[#00a884]/10"
                          : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50"
                      )}
                    >
                      {isPopular && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#00a884] text-white text-[7px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                          MOST POPULAR
                        </div>
                      )}

                      {/* Plan name + price */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{plan.name}</div>
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-2xl font-extrabold text-[#00a884]">{currencySymbol(plan.currency)}{price}</span>
                            <span className="text-[9px] text-slate-400 font-bold">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'quarterly' ? 'qtr' : 'yr'}</span>
                          </div>
                        </div>
                        {isCurrent ? (
                          <span className="text-[9px] font-black tracking-[0.15em] text-[#00a884] border border-[#00a884]/30 bg-[#00a884]/5 rounded-full px-2 py-0.5 shrink-0">
                            CURRENT
                          </span>
                        ) : (
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5",
                            isSelected ? "border-[#00a884] bg-[#00a884]" : "border-slate-200 dark:border-slate-600"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-100 dark:bg-slate-700" />

                      {/* Features */}
                      <div className="flex flex-col gap-1.5">
                        {[
                          `${plan.maxContacts === -1 ? 'Unlimited' : plan.maxContacts.toLocaleString()} Contacts`,
                          `${plan.maxBotFlows === -1 ? 'Unlimited' : plan.maxBotFlows} Flows`,
                          `${plan.maxCampaigns === -1 ? 'Unlimited' : plan.maxCampaigns} Campaigns`,
                          `${plan.maxTeamMembers === -1 ? 'Unlimited' : plan.maxTeamMembers} Agents`,
                          `${plan.maxBotReplies === -1 ? 'Unlimited' : plan.maxBotReplies.toLocaleString()} Messages`,
                        ].map((feat, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            <div className="w-3 h-3 rounded-full bg-[#00a884]/10 flex items-center justify-center border border-[#00a884]/20 shrink-0">
                              <Check className="w-1.5 h-1.5 text-[#00a884]" />
                            </div>
                            {feat}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {!isLoading && (
          <div className="p-6 lg:px-8 lg:py-5 border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  Switching to <span className="text-[#00a884] font-black">{selectedPlan?.name}</span>
                  {" "}({billingCycle}) via <span className="font-black uppercase">{paymentProvider}</span>
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-slate-800 dark:text-white">
                    {currencySymbol(selectedPlan?.currency || 'USD')}{calculatePrice(selectedPlan)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'quarterly' ? 'qtr' : 'yr'}</span>
                </div>
              </div>
              <Button
                className={cn(
                  "h-11 px-6 rounded-xl text-xs font-black tracking-wider transition-all duration-200",
                  selectedPlanSlug === currentPlan
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-none shadow-none"
                    : "bg-[#00a884] hover:bg-[#008f70] text-white shadow-md hover:scale-[1.02] active:scale-95"
                )}
                onClick={handlePurchase}
                disabled={selectedPlanSlug === currentPlan || isUpdating}
              >
                {isUpdating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>UPGRADING...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{selectedPlanSlug === currentPlan ? 'CURRENT PLAN' : 'UPGRADE NOW'}</span>
                    {selectedPlanSlug !== currentPlan && <ArrowRight className="w-4 h-4" />}
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
