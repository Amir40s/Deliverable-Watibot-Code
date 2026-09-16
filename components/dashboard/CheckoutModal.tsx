"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Check, 
  ArrowRight, 
  Loader2, 
  Zap, 
  ShieldCheck, 
  CreditCard, 
  Lock, 
  Sparkles,
  CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type BillingCycle = "monthly" | "quarterly" | "yearly";
type PaymentProvider = "stripe" | "payfast";

interface CheckoutModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: any;
  initialBillingCycle?: BillingCycle;
}

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

export function CheckoutModal({
  isOpen,
  onOpenChange,
  selectedPlan,
  initialBillingCycle = "monthly"
}: CheckoutModalProps) {
  const { data: session, update: updateSession } = useSession();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("stripe");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialBillingCycle) {
      setBillingCycle(initialBillingCycle);
    }
  }, [initialBillingCycle, isOpen]);

  if (!selectedPlan) return null;

  const calculatePrice = () => {
    if (!selectedPlan) return 0;
    if (billingCycle === "monthly") return Number(selectedPlan.monthlyPrice || 0);
    if (billingCycle === "quarterly") return Number(selectedPlan.quarterlyPrice || Number(selectedPlan.monthlyPrice || 0) * 3);
    return Number(selectedPlan.yearlyPrice || 0);
  };

  const price = calculatePrice();
  const currencySymbol = selectedPlan.currency === "USD" ? "$" : selectedPlan.currency === "INR" ? "₹" : (selectedPlan.currency || "$");

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      if (price === 0) {
        const result = await updateOrganizationPlan(selectedPlan.slug);
        if (result.success) {
          await updateSession();
          toast.success("Subscription Activated", { description: `Switched to ${selectedPlan.name} Plan.` });
          onOpenChange(false);
          window.location.reload();
        } else {
          toast.error(result.error || "Failed to update subscription");
        }
        setIsProcessing(false);
        return;
      }

      const checkoutEndpoint = paymentProvider === "stripe" ? "/api/stripe/checkout" : "/api/payfast/checkout";
      const response = await fetch(checkoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: selectedPlan.slug,
          billingCycle,
          locale: window.location.pathname.split("/").filter(Boolean)[0] || "en"
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
      console.error("Checkout failed:", error);
      toast.error("An unexpected error occurred during checkout initialization.");
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="plus-jakarta-forced max-w-3xl p-0 overflow-hidden border-0 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl">
        
        {/* Modal Top Header */}
        <div className="bg-[#00a884] p-6 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Order Checkout</h2>
              <p className="text-xs text-emerald-100 font-medium">Complete your package selection</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
          
          {/* Left Column: Selected Package Summary */}
          <div className="md:col-span-7 space-y-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00a884]">Selected Package</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                {selectedPlan.name} Package
              </h3>
              <p className="text-xs font-medium text-slate-500">
                {selectedPlan.maxTeamMembers === -1 ? "Unlimited" : selectedPlan.maxTeamMembers} Agent Seat{selectedPlan.maxTeamMembers === 1 ? "" : "s"} included
              </p>
            </div>

            {/* Billing Cycle Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Billing Cycle</label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                {(["monthly", "quarterly", "yearly"] as BillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-extrabold capitalize transition-all",
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

            {/* Features Checklist */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Features Included:</label>
              <ul className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                  <span>WhatsApp Business Cloud API Access</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                  <span>{selectedPlan.maxContacts === -1 ? "Unlimited" : Number(selectedPlan.maxContacts).toLocaleString()} Contacts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                  <span>{selectedPlan.maxBotFlows === -1 ? "Unlimited" : selectedPlan.maxBotFlows} Bot Flow Automations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                  <span>{selectedPlan.maxTeamMembers === -1 ? "Unlimited" : selectedPlan.maxTeamMembers} Agent Seats</span>
                </li>
                {selectedPlan.aiChatBotEnabled && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                    <span>AI ChatBot Integration Included</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Payment Method Provider */}
            {price > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentProvider("stripe")}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all flex items-center justify-between",
                      paymentProvider === "stripe"
                        ? "border-[#00a884] bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-[#00a884]/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white">Stripe</p>
                      <p className="text-[10px] text-slate-400 font-medium">Card / Apple Pay</p>
                    </div>
                    <CreditCard className={cn("w-4 h-4", paymentProvider === "stripe" ? "text-[#00a884]" : "text-slate-400")} />
                  </button>

                  <button
                    onClick={() => setPaymentProvider("payfast")}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all flex items-center justify-between",
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
          </div>

          {/* Right Column: Cost Breakdown & Action */}
          <div className="md:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Payment Summary</h4>
              
              <div className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>{selectedPlan.name} Plan ({billingCycle})</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currencySymbol}{price}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cloud API Setup</span>
                  <span className="font-bold text-[#00a884]">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes & Fees</span>
                  <span className="font-bold text-slate-400">$0.00</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Total Due</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{currencySymbol}{price}</span>
                  <p className="text-[10px] font-bold text-slate-400">Billed {billingCycle}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                disabled={isProcessing}
                onClick={handleCheckout}
                className="w-full py-3.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-xl shadow-lg shadow-[#00a884]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting Gateway...
                  </>
                ) : price === 0 ? (
                  "Activate Free Plan"
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Proceed to Secure Payment
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
               </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
