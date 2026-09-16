"use client"

import React, { useState, useEffect } from "react"
import { 
  Check,
  ShoppingCart,
  ArrowRight,
  Loader2
} from "lucide-react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"
import { findPlanBySlug, getCanonicalPlanSlug, getPlanFamily } from "@/lib/plan-slugs"

type BillingCycle = "monthly" | "yearly"
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

export default function UpgradePlanPage() {
  const { data: session, update: updateSession } = useSession()
  const locale = useLocale()
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("stripe")
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const [plansData, statusData] = await Promise.all([
          getPlans(),
          getLatestStatus()
        ])
        
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
  }, [])

  const selectedPlan = selectedPlanSlug ? findPlanBySlug(plans, selectedPlanSlug) : undefined

  const calculatePrice = (plan: any) => {
    if (!plan) return 0
    const price = billingCycle === 'monthly' ? Number(plan.monthlyPrice) : Number(plan.yearlyPrice)
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
          router.push(`/${locale}/dashboard/billing`)
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
          billingCycle: billingCycle,
          locale
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

  return (
    <DashboardLayoutClient hideNav={true} mainClassName="p-0 bg-background" mainFullBleed={true}>
      <div className="min-h-screen bg-background flex flex-col justify-between text-foreground">
        
        <div className="px-6 sm:px-12 py-4 border-b border-border/50 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold text-[#00B074]">WatiBot</span>
            <span className="text-[10px] text-muted-foreground font-bold border-l border-border/50 pl-3 uppercase tracking-wider">Upgrade Subscription</span>
          </div>
          <Button 
            variant="outline"
            onClick={() => router.push(`/${locale}/dashboard/billing`)}
            className="px-5 py-1.5 h-8 rounded-xl border border-border text-foreground hover:bg-muted transition-all font-bold text-[10px] tracking-wider"
          >
            BACK TO BILLING
          </Button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center min-h-[300px]">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-start pb-12">
            <div className="max-w-6xl mx-auto w-full px-6 sm:px-12 pt-8 pb-4 text-center space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Upgrade Your Experience</h1>
              <p className="text-muted-foreground text-xs font-medium">Select the perfect plan for your business growth</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-8">
              <div className="bg-muted/50 p-1 rounded-xl flex items-center border border-border/50 shadow-inner">
                <button 
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "px-6 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all",
                    billingCycle === "monthly" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  MONTHLY
                </button>
                <button 
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "px-6 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all",
                    billingCycle === "yearly" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  YEARLY <span className="ml-1 text-[7px] opacity-70">-20%</span>
                </button>
              </div>

              <div className="bg-muted/50 p-1 rounded-xl flex items-center border border-border/50 shadow-inner">
                <button
                  onClick={() => setPaymentProvider("stripe")}
                  className={cn(
                    "px-6 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all",
                    paymentProvider === "stripe"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  STRIPE
                </button>
                <button
                  onClick={() => setPaymentProvider("payfast")}
                  className={cn(
                    "px-6 py-1.5 rounded-lg text-[10px] font-bold tracking-widest transition-all",
                    paymentProvider === "payfast"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  PAYFAST
                </button>
              </div>
            </div>

            <div className="max-w-6xl mx-auto w-full px-6 sm:px-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {plans.map((plan) => {
                  const isCurrent = getPlanFamily(currentPlan) === getPlanFamily(plan.slug)
                  const isSelected = selectedPlanSlug === plan.slug
                  const price = calculatePrice(plan)
                  const isPopular = ['premium', 'prem'].includes(plan.slug?.toLowerCase())
                  
                  return (
                    <div 
                      key={plan.id}
                      className={cn(
                        "group relative bg-card rounded-[24px] p-6 border-2 transition-all duration-300 cursor-pointer flex flex-col h-full",
                        isSelected 
                          ? "border-emerald-500 bg-emerald-50/5 dark:bg-emerald-950/5 shadow-md" 
                          : "border-border/50 hover:border-emerald-500/30 hover:bg-muted/5",
                        isPopular && !isSelected && "border-emerald-500/20"
                      )}
                      onClick={() => setSelectedPlanSlug(plan.slug)}
                    >
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-emerald-400 text-white text-[8px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md whitespace-nowrap">
                          MOST POPULAR
                        </div>
                      )}

                      <div className="flex flex-col items-center text-center mb-6">
                        <h3 className="text-lg font-bold text-foreground mb-1 tracking-tight">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                            {plan.currency === 'USD' ? '$' : (plan.currency === 'INR' ? '₹' : plan.currency)}
                            {price}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 flex-1">
                        {[
                          { label: `${plan.maxContacts === -1 ? 'Unlimited' : plan.maxContacts.toLocaleString()} Contacts`, icon: Check },
                          { label: `${plan.maxBotFlows === -1 ? 'Unlimited' : plan.maxBotFlows} Flows`, icon: Check },
                          { label: `${plan.maxCampaigns === -1 ? 'Unlimited' : plan.maxCampaigns} Campaigns`, icon: Check },
                          { label: `${plan.maxTeamMembers === -1 ? 'Unlimited' : plan.maxTeamMembers} Agents`, icon: Check },
                          { label: 'AI Bot Replies Chat', icon: Check, hidden: !plan.aiChatBotEnabled }
                        ].map((feature, i) => !feature.hidden && (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-600">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-foreground/80 font-semibold">{feature.label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-8">
                        {isCurrent ? (
                          <div className="w-full py-2.5 text-center border border-emerald-500/20 rounded-xl bg-emerald-500/5">
                            <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-bold tracking-widest">CURRENT PLAN</span>
                          </div>
                        ) : (
                          <button className={cn(
                            "w-full py-2.5 rounded-xl text-[9px] font-bold tracking-widest transition-all duration-300 border",
                            isSelected 
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20" 
                              : "bg-muted/50 border-border text-foreground hover:bg-muted"
                          )}>
                            SELECT {plan.name.toUpperCase()}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="w-full px-6 sm:px-12 py-4 bg-card border-t border-border/50 sticky bottom-0 z-20 shadow-[0_-4px_20px_rgb(0,0,0,0.02)]">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground leading-none mb-1">Estimated Total</h4>
                  <p className="text-xs text-muted-foreground font-semibold">
                    Switching to <span className="text-emerald-600 font-bold">{selectedPlan?.name}</span> ({billingCycle}) via{" "}
                    <span className="text-emerald-600 uppercase font-bold">{paymentProvider}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground leading-none">
                      {selectedPlan?.currency === 'USD' ? '$' : (selectedPlan?.currency === 'INR' ? '₹' : selectedPlan?.currency)}
                      {calculatePrice(selectedPlan)}
                    </span>
                    <span className="text-xs text-muted-foreground/60 font-bold uppercase tracking-wider">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </div>

                <Button 
                  className={cn(
                    "h-12 px-8 rounded-xl text-xs font-bold tracking-widest transition-all duration-300 min-w-[180px]",
                    selectedPlanSlug === currentPlan 
                      ? "bg-muted text-muted-foreground border border-border cursor-not-allowed" 
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 hover:scale-[1.01] active:scale-95"
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
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayoutClient>
  )
}
