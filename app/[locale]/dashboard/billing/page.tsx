"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { Check, ShieldAlert, Sparkles, Zap, ArrowRight, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChangePlanModal } from "@/components/dashboard/ChangePlanModal";
import { CheckoutModal } from "@/components/dashboard/CheckoutModal";

export default function BillingPage() {
  const router = useRouter();
  const locale = useLocale();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [plans, setPlans] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansData, statusData] = await Promise.all([
          getPlans(),
          getLatestStatus()
        ]);
        setPlans(plansData || []);
        setStatus(statusData);
      } catch (error) {
        console.error("Failed to fetch billing data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const currentPlanSlug = status?.plan?.toLowerCase() || 'free';
  const isExpired = !!status?.planExpiry?.isExpired;
  const daysRemaining = status?.planExpiry?.daysRemaining ?? 0;

  if (isLoading) {
    return (
      <DashboardLayoutClient mainClassName="pb-24">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-[#00a884]" />
          <p className="text-xs font-bold text-slate-400 mt-4">Loading billing details & packages...</p>
        </div>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient mainClassName="pb-24">
      <ChangePlanModal isOpen={isChangePlanOpen} onOpenChange={setIsChangePlanOpen} />
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        selectedPlan={selectedCheckoutPlan}
        initialBillingCycle={billingCycle}
      />

      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Top Plan & Expiry Summary Banner */}
        <div className={cn(
          "p-6 sm:p-8 rounded-3xl border transition-all relative overflow-hidden shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6",
          isExpired 
            ? "bg-rose-500/10 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" 
            : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
              isExpired ? "bg-rose-500/20 text-rose-600 dark:text-rose-400" : "bg-[#00a884]/15 text-[#00a884]"
            )}>
              {isExpired ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <Crown className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Subscription</span>
                {isExpired ? (
                  <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-full">
                    Expired
                  </span>
                ) : daysRemaining <= 7 ? (
                  <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                    {daysRemaining} Days Left
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase text-[#00a884] bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                    Active ({daysRemaining} Days Left)
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {status?.plan || "Basic"} Plan
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isExpired 
                  ? "Your subscription plan has expired. Please choose a package below to reactivate API messaging." 
                  : status?.planExpiry?.endDate 
                    ? `Next renewal date: ${new Date(status.planExpiry.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` 
                    : "Active monthly subscription"
                }
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsChangePlanOpen(true)}
            className="w-full md:w-auto px-8 py-3.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 shrink-0"
          >
            <Zap className="w-4 h-4 fill-white" />
            {isExpired ? "Buy Package Now" : "Change / Upgrade Plan"}
          </button>
        </div>

        {/* Database Packages Section */}
        <div className="space-y-8">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Database Subscription Packages
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              Select the package that fits your business scale. No hidden fees, instant activation.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl w-fit mx-auto shadow-inner">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-extrabold transition-all",
                  billingCycle === "monthly" ? "bg-[#00a884] text-white shadow-md" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("quarterly")}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-extrabold transition-all",
                  billingCycle === "quarterly" ? "bg-[#00a884] text-white shadow-md" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                Quarterly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-extrabold transition-all",
                  billingCycle === "yearly" ? "bg-[#00a884] text-white shadow-md" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                Yearly
              </button>
            </div>
          </div>

          {/* Database Packages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const isCurrent = currentPlanSlug === plan.slug?.toLowerCase();
              const isPopular = ['premium', 'prem'].includes(plan.slug?.toLowerCase());
              const price = billingCycle === 'monthly' ? Number(plan.monthlyPrice) : billingCycle === 'quarterly' ? Number(plan.quarterlyPrice || Number(plan.monthlyPrice) * 3) : Number(plan.yearlyPrice);
              const period = billingCycle === 'monthly' ? 'mo' : billingCycle === 'quarterly' ? 'qtr' : 'yr';

              return (
                <div
                  key={plan.id || plan.slug}
                  className={cn(
                    "bg-white dark:bg-slate-900 border rounded-3xl p-6 flex flex-col justify-between relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                    isPopular 
                      ? "border-[#00a884] dark:border-[#00a884] shadow-lg shadow-[#00a884]/10 ring-2 ring-[#00a884]/20" 
                      : "border-slate-100 dark:border-slate-800 shadow-sm"
                  )}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-[#00a884] text-white text-[9px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Most Popular
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        {plan.name}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {plan.maxTeamMembers === -1 ? 'Unlimited' : plan.maxTeamMembers} Agent Seat{plan.maxTeamMembers === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                          {plan.currency || '$'}{Number(price).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-400">/{period}</span>
                      </div>
                    </div>

                    {/* Features checklist */}
                    <ul className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#00a884] shrink-0" />
                        <span>WhatsApp Business Cloud API</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#00a884] shrink-0" />
                        <span>{plan.maxContacts === -1 ? 'Unlimited' : plan.maxContacts.toLocaleString()} Contacts</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#00a884] shrink-0" />
                        <span>{plan.maxBotFlows === -1 ? 'Unlimited' : plan.maxBotFlows} Flow Automations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#00a884] shrink-0" />
                        <span>{plan.maxTeamMembers === -1 ? 'Unlimited' : plan.maxTeamMembers} Agent Seats</span>
                      </li>
                      {plan.aiChatBotEnabled && (
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#00a884] shrink-0" />
                          <span>AI ChatBot Integration</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                    <button
                      disabled={isCurrent && !isExpired}
                      onClick={() => {
                        window.open(`/${locale}/dashboard/billing/checkout?plan=${plan.slug}&cycle=${billingCycle}`, '_blank');
                      }}
                      className={cn(
                        "w-full py-3 text-xs font-black rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer",
                        isCurrent && !isExpired
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                          : isPopular
                          ? "bg-[#00a884] hover:bg-[#008f70] text-white shadow-[#00a884]/20"
                          : "bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900"
                      )}
                    >
                      {isCurrent && !isExpired ? "Current Package" : "Select Package"}
                      {!isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
