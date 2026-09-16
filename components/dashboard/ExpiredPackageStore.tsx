"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Check, ShieldAlert, Sparkles, Zap, ArrowRight, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChangePlanModal } from "@/components/dashboard/ChangePlanModal";
import { CheckoutModal } from "@/components/dashboard/CheckoutModal";

interface ExpiredPackageStoreProps {
  onPlanSelected?: (planSlug: string) => void;
}

export function ExpiredPackageStore({ onPlanSelected }: ExpiredPackageStoreProps) {
  const router = useRouter();
  const locale = useLocale();
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDbPlans = async () => {
      try {
        const dbPlans = await getPlans();
        if (isMounted) {
          setPlans(Array.isArray(dbPlans) ? dbPlans : []);
        }
      } catch (err) {
        console.error("Failed to load database plans:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDbPlans();
    return () => { isMounted = false; };
  }, []);

  const handleBuyPackage = (planSlug: string) => {
    setIsChangePlanOpen(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 animate-in fade-in duration-300">
      <ChangePlanModal isOpen={isChangePlanOpen} onOpenChange={setIsChangePlanOpen} />

      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-4 h-4 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">Subscription Required</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Package Expired — Choose a Plan to Unlock
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
          Your WatiBot subscription package has expired. Select a database package below to reactivate your WhatsApp Business API and unlock all sidebar tabs.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl w-fit mx-auto shadow-inner pt-1">
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

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#00a884]" />
          <p className="text-xs font-bold text-slate-400 mt-4">Fetching database package plans...</p>
        </div>
      ) : (
        /* Package Cards Grid (Fetched from DB) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
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

                  {/* Feature List */}
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
                        <span>AI ChatBot Enabled</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => window.open(`/${locale}/dashboard/billing/checkout?plan=${plan.slug}&cycle=${billingCycle}`, '_blank')}
                    className={cn(
                      "w-full py-3 text-xs font-black rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer",
                      isPopular
                        ? "bg-[#00a884] hover:bg-[#008f70] text-white shadow-[#00a884]/20"
                        : "bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900"
                    )}
                  >
                    Buy Package
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
