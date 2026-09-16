"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { 
  ArrowLeft, 
  CheckCircle2, 
  CreditCard, 
  ShieldCheck, 
  Lock, 
  Loader2, 
  Users, 
  Activity, 
  Zap, 
  UserPlus, 
  MessageSquare,
  Crown,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type BillingCycle = "monthly" | "quarterly" | "yearly";
type PaymentProvider = "stripe" | "payfast";

function submitCheckoutResponse(data: any) {
  if (data?.formAction && data?.formFields) {
    const form = document.createElement("form");
    form.method = data.formMethod || "POST";
    form.action = data.formAction;
    Object.entries(data.formFields as Record<string, unknown>).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value ?? "");
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    return true;
  }
  if (data?.url) {
    window.location.href = data.url;
    return true;
  }
  return false;
}

function CheckoutContent() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();

  const planSlugParam = searchParams.get("plan") || "standard";
  const cycleParam = (searchParams.get("cycle") as BillingCycle) || "monthly";

  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(cycleParam);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("stripe");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const fetchedPlans = await getPlans();
        setPlans(fetchedPlans || []);
        const target = fetchedPlans?.find(
          (p: any) => p.slug?.toLowerCase() === planSlugParam.toLowerCase()
        ) || fetchedPlans?.[0] || null;
        setSelectedPlan(target);
      } catch (err) {
        console.error("Failed to load plans for checkout:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPlans();
  }, [planSlugParam]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#00a884]" />
        <p className="text-xs font-bold text-slate-400 mt-4">Loading checkout details...</p>
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Plan Not Found</h2>
        <p className="text-xs text-slate-500">The package you selected could not be found.</p>
        <button
          onClick={() => router.push(`/${locale}/dashboard/billing`)}
          className="px-6 py-2.5 bg-[#00a884] text-white text-xs font-bold rounded-xl"
        >
          Back to Billing
        </button>
      </div>
    );
  }

  const isPopular = ["premium", "prem"].includes(selectedPlan.slug?.toLowerCase());

  const calculatePrice = () => {
    if (billingCycle === "monthly") return Number(selectedPlan.monthlyPrice || 0);
    if (billingCycle === "quarterly")
      return Number(selectedPlan.quarterlyPrice || Number(selectedPlan.monthlyPrice || 0) * 3);
    return Number(selectedPlan.yearlyPrice || 0);
  };

  const price = calculatePrice();
  const currencySymbol =
    selectedPlan.currency === "USD" ? "$" : selectedPlan.currency === "INR" ? "₹" : selectedPlan.currency || "$";

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      if (price === 0) {
        const result = await updateOrganizationPlan(selectedPlan.slug);
        if (result.success) {
          await updateSession();
          toast.success("Subscription Activated", { description: `Switched to ${selectedPlan.name} Plan.` });
          router.push(`/${locale}/dashboard/billing`);
        } else {
          toast.error(result.error || "Failed to update subscription");
        }
        setIsProcessing(false);
        return;
      }

      const checkoutEndpoint =
        paymentProvider === "stripe" ? "/api/stripe/checkout" : "/api/payfast/checkout";
      const response = await fetch(checkoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: selectedPlan.slug,
          billingCycle,
          locale
        })
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to initialize checkout gateway.");
        setIsProcessing(false);
        return;
      }

      if (!submitCheckoutResponse(data)) {
        toast.error("Invalid response from payment gateway.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("An error occurred during checkout processing.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-[#0B0F1A] pb-16">
      
      {/* Standalone Checkout Top Header (No Dashboard Sidebar / Header) */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 sm:px-10 py-4 flex items-center justify-between shadow-xs mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-md shadow-[#00a884]/20 font-black text-sm">
            W
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              WatiBot Checkout
              
            </h1>
          </div>
        </div>

        <button
          onClick={() => router.push(`/${locale}/dashboard/billing`)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-extrabold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit Checkout
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Package Details & Admin Usage Limits */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Selected Plan Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
            {isPopular && (
              <div className="absolute top-6 right-6">
                <span className="bg-[#00a884] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Popular Choice
                </span>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Subscription Package</span>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {selectedPlan.name} Plan
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                WhatsApp Business Cloud API Automation Solution
              </p>
            </div>

            {/* Cycle Selector Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Choose Billing Cycle</label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
                {(["monthly", "quarterly", "yearly"] as BillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-extrabold capitalize transition-all cursor-pointer",
                      billingCycle === cycle
                        ? "bg-[#00a884] text-white shadow-md"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    )}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Preview */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {currencySymbol}{Number(price).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">/{billingCycle === "monthly" ? "mo" : billingCycle === "quarterly" ? "qtr" : "yr"}</span>
            </div>
          </div>

          {/* Usage Limits Section (Matching Admin Panel Style) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-amber-500" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Usage Limits
              </h2>
            </div>

            <div className="space-y-3">
              
              {/* Max Contacts */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:border-slate-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Max Contacts</h3>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Total contacts allowed in the system (-1 for unlimited)
                    </p>
                  </div>
                </div>
                <div className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm font-black text-slate-900 dark:text-white shrink-0 min-w-[75px] text-center">
                  {selectedPlan.maxContacts === -1 ? "-1" : Number(selectedPlan.maxContacts).toLocaleString()}
                </div>
              </div>

              {/* Max Bot Flows */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:border-slate-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Max Bot Flows</h3>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Number of automation flows allowed (-1 for unlimited)
                    </p>
                  </div>
                </div>
                <div className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm font-black text-slate-900 dark:text-white shrink-0 min-w-[75px] text-center">
                  {selectedPlan.maxBotFlows === -1 ? "-1" : selectedPlan.maxBotFlows}
                </div>
              </div>

              {/* Max Campaigns */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:border-slate-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Max Campaigns</h3>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Number of message campaigns allowed (-1 for unlimited)
                    </p>
                  </div>
                </div>
                <div className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm font-black text-slate-900 dark:text-white shrink-0 min-w-[75px] text-center">
                  {selectedPlan.maxCampaigns === -1 || !selectedPlan.maxCampaigns ? "-1" : selectedPlan.maxCampaigns}
                </div>
              </div>

              {/* Team Members */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:border-slate-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Team Members</h3>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Number of staff members who can use the system (-1 for unlimited)
                    </p>
                  </div>
                </div>
                <div className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm font-black text-slate-900 dark:text-white shrink-0 min-w-[75px] text-center">
                  {selectedPlan.maxTeamMembers === -1 ? "-1" : selectedPlan.maxTeamMembers}
                </div>
              </div>

              {/* Max Messages / Broadcasts */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:border-slate-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Max Messages / Broadcasts</h3>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Outbound messages and broadcast limit (-1 for unlimited)
                    </p>
                  </div>
                </div>
                <div className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm font-black text-slate-900 dark:text-white shrink-0 min-w-[75px] text-center">
                  {selectedPlan.maxBotReplies === -1 || !selectedPlan.maxBotReplies ? "-1" : selectedPlan.maxBotReplies}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Order Summary & Gateway Action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl sticky top-6">
            
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Order Summary</h3>
              <p className="text-xs font-medium text-slate-400">Review your subscription invoice</p>
            </div>

            {/* Price breakdown */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>{selectedPlan.name} Plan ({billingCycle})</span>
                <span className="font-black text-slate-900 dark:text-white">{currencySymbol}{price}</span>
              </div>
              <div className="flex justify-between">
                <span>WhatsApp Cloud API Connection</span>
                <span className="font-black text-[#00a884]">Included</span>
              </div>
              <div className="flex justify-between">
                <span>Setup & Activation Fee</span>
                <span className="font-black text-[#00a884]">$0.00</span>
              </div>
            </div>

            {/* Total Display */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Amount Due</span>
              <div className="text-right">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{currencySymbol}{price}</span>
                <p className="text-[10px] font-bold text-slate-400">Billed {billingCycle}</p>
              </div>
            </div>

            {/* Payment Method Provider */}
            {price > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Payment Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentProvider("stripe")}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                      paymentProvider === "stripe"
                        ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-[#00a884]/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Stripe</p>
                      <p className="text-[10px] text-slate-400 font-medium">Credit / Debit Card</p>
                    </div>
                    <CreditCard className={cn("w-4 h-4", paymentProvider === "stripe" ? "text-[#00a884]" : "text-slate-400")} />
                  </button>

                  <button
                    onClick={() => setPaymentProvider("payfast")}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                      paymentProvider === "payfast"
                        ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-[#00a884]/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">PayFast</p>
                      <p className="text-[10px] text-slate-400 font-medium">Local Gateway</p>
                    </div>
                    <ShieldCheck className={cn("w-4 h-4", paymentProvider === "payfast" ? "text-[#00a884]" : "text-slate-400")} />
                  </button>
                </div>
              </div>
            )}

            {/* Action CTA Button */}
            <button
              disabled={isProcessing}
              onClick={handleCheckout}
              className="w-full py-4 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-2xl shadow-xl shadow-[#00a884]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting Payment Gateway...
                </>
              ) : price === 0 ? (
                "Activate Free Package"
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Proceed to Secure Payment
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#00a884]" />
              <span>256-Bit Encrypted & Instant API Activation</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
  );
}

export default function CheckoutPage() {
  return (
    <DashboardLayoutClient hideNav={true} hideChatbot={true} mainClassName="p-0 bg-slate-50/60 dark:bg-[#0B0F1A]">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-10 h-10 animate-spin text-[#00a884]" />
        </div>
      }>
        <CheckoutContent />
      </Suspense>
    </DashboardLayoutClient>
  );
}
