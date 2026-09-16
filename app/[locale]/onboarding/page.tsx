"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Users, 
  Zap, 
  MessageSquare, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Bot, 
  BarChart3, 
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { countries } from "@/lib/countries";

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    organizationName: "",
    industry: "",
    companySize: "",
    timezone: "(GMT +05:00) Asia/Karachi",
  });
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      window.location.href = "/dashboard";
    }
  }, [status, router]);

  const handleUpdateOnboarding = async (nextStep: number, isCompleted: boolean = false) => {
    if (step === 1 && nextStep === 2) {
      setStep(nextStep);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: nextStep,
          completed: isCompleted,
          data: {
            ...formData,
            acceptedPolicies
          },
        }),
      });

      const resData = await response.json().catch(() => null);
      console.log(`[Completion API Response] status: ${response.status}, ok: ${response.ok}, payload:`, resData);

      if (response.ok) {
        if (isCompleted) {
          try {
            console.log("[Completion API Response] Onboarding completed successfully. Refreshing session and navigating to /dashboard.");
            await update({ onboardingCompleted: true, onboardingStep: 3 });
            await new Promise(resolve => setTimeout(resolve, 500));
            window.location.href = "/dashboard";
          } catch (redirectError) {
            console.error("Error during redirect:", redirectError);
            setIsLoading(false);
          }
        } else {
          setStep(nextStep);
          setIsLoading(false);
        }
      } else {
        alert(resData?.error || "Failed to save progress");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to update onboarding:", error);
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-3 border-[#00a884]/20 border-t-[#00a884] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full lg:h-screen lg:overflow-hidden bg-white flex flex-col lg:flex-row antialiased plus-jakarta-forced forced-light">
      
      {/* LEFT SIDE: BRAND & HERO & STUNNING 3D MOCKUP */}
      <div className="w-full lg:w-[60%] order-2 lg:order-1 flex flex-col justify-between pt-6 px-6 pb-6 lg:pt-5 lg:px-8 lg:pb-8 xl:pt-6 xl:px-12 xl:pb-10 relative overflow-hidden bg-gradient-to-br from-[#f2faf7] via-[#e8f5ee] to-[#f4fbf9] border-t lg:border-t-0 lg:border-r border-slate-100/60 lg:h-screen lg:overflow-hidden">
        
        {/* Soft floating background design blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[320px] h-[320px] bg-emerald-200/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] bg-emerald-100/25 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Dotted grid design pattern */}
        <div className="absolute top-[6%] right-[10%] w-24 h-24 bg-[radial-gradient(#00a884_1.5px,transparent_1.5px)] [background-size:10px_10px] opacity-15 pointer-events-none hidden xl:block" />

        {/* Concentric ripples/waves behind the mockup */}
        <div className="hidden lg:block absolute right-[-70px] top-[4%] w-[680px] h-[680px] pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,168,132,0.18)_0%,transparent_75%)] blur-[4px]" />
          <svg className="w-full h-full text-[#00a884]/20 animate-[spin_120s_linear_infinite]" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.6" />
            <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
            <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="1" strokeDasharray="12 8" opacity="0.75" />
            <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <circle cx="200" cy="200" r="60" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.3" />
            <line x1="200" y1="10" x2="200" y2="390" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.25" />
            <line x1="10" y1="200" x2="390" y2="200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.25" />
          </svg>
        </div>

        {/* Logo and Branding Header */}
        <div className="relative z-10 flex items-center justify-center lg:justify-start my-10">
          <img src="/logo11122.png" alt="WatiBot Logo" className="w-[170px] xl:w-[190px] h-auto object-contain mt-[-15px] lg:mt-[-20px] xl:mt-[-25px]" />
        </div>

        {/* Main Grid Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-0 pb-4 mt-[-10px] xl:mt-[-15px] relative z-10 w-full">
          {/* Column 1: Text & Features List */}
          <div className="col-span-1 lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5 xl:space-y-6">
            
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit  tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
              Advanced WhatsApp CRM Platform
            </div>

            <div className="space-y-2.5 flex flex-col items-center lg:items-start">
              <h1 className="text-3xl xl:text-[38px] font-black text-slate-900 tracking-tight leading-[1.15]">
                Configure Your Workspace for <span className="text-[#00a884]">Peak Performance</span>
              </h1>
              <p className="text-[12px] xl:text-[13px] text-slate-400 font-semibold leading-relaxed max-w-[390px]">
                Complete your onboarding steps in minutes to start automating chats, capture prospects, and scale customer operations.
              </p>
            </div>

            {/* Premium high-fidelity feature bullet rows */}
            <div className="space-y-3.5 w-full pt-1.5 max-w-[360px] lg:max-w-none">
              <div className="flex items-start gap-3.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00a884]/10 flex items-center justify-center text-[#00a884]">✓</span>
                <div className="text-left">
                  <h4 className="text-[11.5px] font-black text-slate-800 tracking-tight">Active Automation Triggers</h4>
                  <p className="text-slate-400 text-[10.5px] font-bold leading-normal">Instantly assign chats to agents and configure automated campaigns.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00a884]/10 flex items-center justify-center text-[#00a884]">✓</span>
                <div className="text-left">
                  <h4 className="text-[11.5px] font-black text-slate-800 tracking-tight">Unified Client Inbox</h4>
                  <p className="text-slate-400 text-[10.5px] font-bold leading-normal">Collaborate with multiple agents across Instagram, Facebook, and WhatsApp.</p>
                </div>
              </div>
            </div>

            {/* Social Proof Badge */}
            <div className="inline-flex items-center gap-3.5 px-4 py-2 bg-white border border-slate-100 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] w-fit mt-6 xl:mt-8 select-none">
              <div className="flex -space-x-2 items-center">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <div className="w-[26px] h-[26px] rounded-full bg-[#00a884] text-white text-[8.5px] font-black flex items-center justify-center border-2 border-white relative z-10 shadow-sm">
                  10K+
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 pr-1.5 ml-2.5">
                Trusted by <span className="text-[#00a884] font-extrabold">10,000+</span> teams worldwide
              </span>
            </div>
          </div>

          {/* Column 2: Redesigned 3D Mockup Container */}
          <div className="col-span-1 lg:col-span-5 relative flex items-center justify-center h-full min-h-[390px] xl:min-h-[640px] perspective-1000">
            {/* Giant soft green background circle */}
            <div className="absolute w-[440px] h-[440px] rounded-full bg-[#00a884]/12 blur-[8px] pointer-events-none z-0" 
              style={{
                transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) translateZ(-40px) translateX(35px) translateY(-30px)",
              }}
            />

            {/* 3D Rotated Mockup Screen Card */}
            <div 
              className="relative rounded-3xl border border-slate-200/80 overflow-hidden z-10 flex shadow-2xl bg-[#f8fafc]"
              style={{
                width: "380px",
                height: "540px",
                minWidth: "380px",
                minHeight: "540px",
                transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) rotateZ(-8deg) translateX(35px) translateY(-30px)",
                transformStyle: "preserve-3d",
              }}
            >
              
              {/* Mockup Screen Content Inner */}
              <div className="flex-1 flex overflow-hidden bg-[#f8fafc] rounded-3xl">
                
                {/* Mockup Sidebar (Sleek dark navigation panel) */}
                <div className="w-[45px] bg-[#0c1317] flex flex-col items-center py-5 gap-5 flex-shrink-0 rounded-l-3xl border-r border-slate-800/40">
                  {/* WhatsApp Brand circle */}
                  <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm p-1.5 mb-2 hover:scale-105 transition-transform cursor-pointer">
                    <svg className="w-full h-full fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 flex items-center justify-center text-[#00a884] shadow-sm cursor-pointer">
                    <MessageSquare className="w-4.5 h-4.5" />
                  </div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                    <BarChart3 className="w-4.5 h-4.5" />
                  </div>
                </div>
                
                {/* Main Browser Window Area */}
                <div className="flex-1 bg-[#f4f7f6] flex flex-col overflow-hidden rounded-r-3xl text-left">
                  {/* Top window bar */}
                  <div className="h-8 bg-white border-b border-slate-100 flex items-center px-4 justify-between flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#ff5f56]" />
                      <span className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
                      <span className="w-2 h-2 rounded-full bg-[#27c93f]" />
                    </div>
                    <div className="flex items-center gap-1 bg-[#f1f5f9] px-3 py-1 rounded-full w-[170px] justify-center">
                      <span className="text-[7.5px] font-black text-slate-400">watibot.com/inbox</span>
                    </div>
                    <div className="w-2.5 h-2.5 bg-slate-200 rounded-full" />
                  </div>
                  
                  {/* Dashboard Mockup Content */}
                  <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden">
                    
                    {/* Header Row: Inbox Label & Active Status */}
                    <div className="flex justify-between items-center flex-shrink-0 pl-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-black text-slate-800 tracking-tight">Active Team Inbox</span>
                        <span className="text-[7px] font-black bg-emerald-50 text-[#00a884] border border-emerald-100/50 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Live</span>
                      </div>
                      <span className="text-[8px] font-black text-slate-400">Total Chats: 24 active</span>
                    </div>

                    {/* Chat Item: Sarah Connor (Highly detailed, colorful, premium) */}
                    <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-sm flex items-center gap-3 flex-shrink-0">
                      <div className="relative">
                        <img 
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80" 
                          className="w-9 h-9 rounded-full object-cover border border-slate-50"
                          alt="Sarah Connor"
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[9.5px] font-black text-slate-800">Sarah Connor</span>
                          <span className="text-[7px] font-bold text-slate-400">1m ago</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[8px] font-semibold text-slate-400 truncate pr-1">"Hey! Do you have this product in stock? 🛍️"</span>
                          <span className="bg-[#e0f7f1] text-[#00a884] text-[6.5px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wide shrink-0">VIP CLIENT</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Item: Tony Stark (Highly detailed, colorful, premium) */}
                    <div className="bg-white/80 rounded-2xl p-2.5 border border-slate-100 shadow-sm flex items-center gap-3 flex-shrink-0 opacity-85">
                      <div className="relative">
                        <img 
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80" 
                          className="w-9 h-9 rounded-full object-cover border border-slate-50"
                          alt="Tony Stark"
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border border-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[9.5px] font-black text-slate-800">Tony Stark</span>
                          <span className="text-[7px] font-bold text-slate-400">10m ago</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[8px] font-bold text-[#00a884] truncate pr-1">"Automated checkout flow successfully built! ⚡"</span>
                          <span className="bg-purple-50 text-purple-500 border border-purple-100/50 text-[6.5px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wide shrink-0">Enterprise</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive chat assistant conversation simulator */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex-1 flex flex-col gap-2 overflow-hidden justify-between">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Automated Reply Dialog</span>
                      
                      <div className="flex flex-col gap-2.5 overflow-hidden">
                        {/* Customer Speech Bubble */}
                        <div className="flex gap-2 max-w-[85%] self-start">
                          <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=32&h=32&q=80" className="w-full h-full object-cover" />
                          </div>
                          <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-2 text-[8px] font-semibold text-slate-600 shadow-sm leading-normal">
                            How do I trigger custom broadcast lists? 📁
                          </div>
                        </div>

                        {/* WatiBot Reply Bubble */}
                        <div className="flex gap-2 max-w-[85%] self-end flex-row-reverse">
                          <div className="w-5 h-5 rounded-full bg-[#00a884] flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm shadow-[#00a884]/30">
                            🤖
                          </div>
                          <div className="bg-[#00a884] text-white rounded-2xl rounded-tr-sm p-2 text-[8px] font-black shadow-md shadow-[#00a884]/10 leading-normal">
                            Simple! Upload your custom .CSV dataset in the Wati Contacts dashboard. 🚀
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bottom grid panel stats */}
                    <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                      <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex flex-col text-left pl-0.5">
                          <span className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-wider">Deliverability</span>
                          <span className="text-[10px] font-black text-slate-800">99.8%</span>
                        </div>
                        <span className="text-[7.5px] font-bold text-[#00a884] bg-emerald-50 px-1 rounded-sm">↑ 0.4%</span>
                      </div>
                      
                      <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex flex-col text-left pl-0.5">
                          <span className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-wider">Avg Response Time</span>
                          <span className="text-[10px] font-black text-slate-800">45 seconds</span>
                        </div>
                        <span className="text-[7.5px] font-bold text-[#00a884] bg-emerald-50 px-1 rounded-sm">Fast</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: ONBOARDING FORMS & MULTI-STEP FLOW */}
      <div className="w-full lg:w-[40%] order-1 lg:order-2 bg-[#fafbfc] flex flex-col justify-between items-center lg:items-stretch lg:h-screen lg:overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
        
        {/* Progress Tracker (Elegant modern UI pills) */}
        <div className="w-full max-w-[500px] mx-auto mt-4 mb-2 flex items-center justify-between px-2 relative z-20">
          {[
            { num: 1, label: "Welcome" },
            { num: 2, label: "Profile" },
            { num: 3, label: "Connect" }
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-2 select-none">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300",
                  step === s.num 
                    ? "bg-[#00a884] text-white shadow-md shadow-[#00a884]/20 scale-110" 
                    : step > s.num 
                      ? "bg-emerald-100 text-[#00a884]" 
                      : "bg-slate-100 text-slate-400"
                )}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <span className={cn(
                  "text-[10.5px] font-bold transition-colors duration-300 hidden sm:inline-block",
                  step === s.num 
                    ? "text-slate-800" 
                    : step > s.num 
                      ? "text-[#00a884]" 
                      : "text-slate-400"
                )}>
                  {s.label}
                </span>
              </div>
              {idx < 2 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2 rounded-full transition-all duration-500",
                  step > s.num ? "bg-[#00a884]" : "bg-slate-100"
                )} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Center: Beautiful Onboarding Card */}
        <div className="mx-auto my-4 lg:my-auto w-full max-w-[500px] bg-white border border-slate-100/90 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-lg shadow-slate-100/40 flex flex-col relative animate-fade-in max-h-[85vh] overflow-y-auto">
          
          {step === 1 && (
            <div className="space-y-5 text-center sm:text-left flex flex-col">
              
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit  tracking-wider mb-2 self-center sm:self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                Step 1 of 3: Welcome
              </div>

              <div className="space-y-1.5">
                <h3 className="text-[20px] font-black text-slate-800 tracking-tight">Prepare for Peak Engagement</h3>
                <p className="text-[11.5px] text-slate-400 font-semibold leading-relaxed">
                  You are minutes away from deploying the most powerful WhatsApp Business growth CRM ever designed. Let's configure your workspace foundations.
                </p>
              </div>

              {/* Checklist items representing step 1 */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-3 items-center bg-slate-50/45 p-3 rounded-2xl border border-slate-50">
                  <span className="w-6 h-6 rounded-xl bg-emerald-50 text-[#00a884] text-xs font-black flex items-center justify-center border border-emerald-100/50 shrink-0">1</span>
                  <div className="text-left">
                    <span className="text-[11.5px] font-black text-slate-800 block leading-tight">Define Corporate Profile</span>
                    <span className="text-[10px] text-slate-400 font-bold">Select industry vertical and company size dashboard view.</span>
                  </div>
                </div>

                <div className="flex gap-3 items-center bg-slate-50/45 p-3 rounded-2xl border border-slate-50">
                  <span className="w-6 h-6 rounded-xl bg-emerald-50 text-[#00a884] text-xs font-black flex items-center justify-center border border-emerald-100/50 shrink-0">2</span>
                  <div className="text-left">
                    <span className="text-[11.5px] font-black text-slate-800 block leading-tight">Verify WhatsApp CRM Channel</span>
                    <span className="text-[10px] text-slate-400 font-bold">Connect your verified WhatsApp Business dialing channel.</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => handleUpdateOnboarding(2)}
                className="h-11 w-full bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4"
              >
                Start Setup Process
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit  tracking-wider mb-2 self-center sm:self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                Step 2 of 3: Organization
              </div>

              <div className="space-y-1.5 text-center sm:text-left">
                <h3 className="text-[20px] font-black text-slate-800 tracking-tight">Business Profile</h3>
                <p className="text-[11.5px] text-slate-400 font-semibold leading-relaxed">
                  Tell us about your organization to optimize workspace layouts.
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                {/* Entity Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest ml-1 ">Company Entity Name</label>
                  <Input
                    name="organizationName"
                    placeholder="Acme Global Industries"
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                    required
                    className="h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* Industry Select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 tracking-widest ml-1 ">Industry Vertical</label>
                    <Select
                      onValueChange={(val) => setFormData({ ...formData, industry: val })}
                      value={formData.industry}
                    >
                      <SelectTrigger className="h-11 border-slate-100 bg-slate-50/20 rounded-xl text-xs font-semibold text-slate-700 focus:ring-[#00a884]/20 focus:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:border-[#00a884] focus-visible:ring-offset-0 focus:outline-none transition-all px-4 justify-between">
                        <SelectValue placeholder="Select Sector" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-100/90 rounded-2xl p-1.5 shadow-2xl z-30">
                        <SelectItem value="ecommerce" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">E-commerce</SelectItem>
                        <SelectItem value="realestate" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">Real Estate</SelectItem>
                        <SelectItem value="healthcare" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">Healthcare</SelectItem>
                        <SelectItem value="education" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">Education</SelectItem>
                        <SelectItem value="tech" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">Technology</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Company Size Select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 tracking-widest ml-1 ">Company Size</label>
                    <Select
                      onValueChange={(val) => setFormData({ ...formData, companySize: val })}
                      value={formData.companySize}
                    >
                      <SelectTrigger className="h-11 border-slate-100 bg-slate-50/20 rounded-xl text-xs font-semibold text-slate-700 focus:ring-[#00a884]/20 focus:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:border-[#00a884] focus-visible:ring-offset-0 focus:outline-none transition-all px-4 justify-between">
                        <SelectValue placeholder="Headcount" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-100/90 rounded-2xl p-1.5 shadow-2xl z-30">
                        <SelectItem value="1-10" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">1-10 Members</SelectItem>
                        <SelectItem value="11-50" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">11-50 Members</SelectItem>
                        <SelectItem value="51-200" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">51-200 Members</SelectItem>
                        <SelectItem value="200+" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">200+ Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Timezone Select */}
                <div className="space-y-1.5 mt-3.5">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest ml-1 ">Time Zone</label>
                  <Select
                    onValueChange={(val) => setFormData({ ...formData, timezone: val })}
                    value={formData.timezone}
                  >
                    <SelectTrigger className="h-11 border-slate-100 bg-slate-55/20 rounded-xl text-xs font-semibold text-slate-700 focus:ring-[#00a884]/20 focus:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:border-[#00a884] focus-visible:ring-offset-0 focus:outline-none transition-all px-4 justify-between">
                      <SelectValue placeholder="Select Time Zone" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-100/90 rounded-2xl p-1.5 shadow-2xl z-30">
                      <SelectItem value="(GMT +05:00) Asia/Karachi" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">(GMT +05:00) Asia/Karachi</SelectItem>
                      <SelectItem value="(GMT +00:00) UTC" className="rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-700">(GMT +00:00) UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                disabled={!formData.organizationName || !formData.industry || !formData.companySize || !formData.timezone || isLoading}
                onClick={() => handleUpdateOnboarding(3)}
                className="h-11 w-full bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4 disabled:opacity-50"
              >
                Proceed to Connectivity
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit  tracking-wider mb-2 self-center sm:self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                Step 3 of 3: Connection
              </div>

              <div className="space-y-1.5 text-center sm:text-left">
                <h3 className="text-[20px] font-black text-slate-800 tracking-tight">Privacy & Policy</h3>
                <p className="text-[11.5px] text-slate-400 font-semibold leading-relaxed">
                  Review the policies that govern your workspace, then accept them to finish setup.
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#e6f4ee] text-[#00a884] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-[12px] font-black text-slate-800 tracking-tight">Privacy and legal terms</h4>
                      <p className="text-[10.5px] font-semibold text-slate-400 leading-relaxed">
                        We use your verified account details to create your workspace, deliver alerts, and keep your account secure.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href="/terms-and-policies/privacy_policy" className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left hover:border-[#00a884]/30 hover:bg-[#f7fffc] transition-colors">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-[#00a884]">Privacy Policy</span>
                      <span className="block text-[10.5px] font-semibold text-slate-500 mt-0.5 leading-relaxed">How we store, use, and protect your information.</span>
                    </Link>
                    <Link href="/terms-and-policies/terms_of_service" className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left hover:border-[#00a884]/30 hover:bg-[#f7fffc] transition-colors">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-[#00a884]">Terms of Service</span>
                      <span className="block text-[10.5px] font-semibold text-slate-500 mt-0.5 leading-relaxed">How the platform and your workspace may be used.</span>
                    </Link>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-[#00a884]" />
                      What you are accepting
                    </div>
                    <ul className="space-y-1 text-[10.5px] font-semibold text-slate-500 leading-relaxed">
                      <li>• We may use your verified details to set up and secure the workspace.</li>
                      <li>• Policy pages define how your data is stored, used, and protected.</li>
                      <li>• You can review the full legal text before completing setup.</li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedPolicies}
                      onChange={(e) => setAcceptedPolicies(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#00a884] focus:ring-[#00a884]"
                      required
                    />
                    <span className="text-[11px] text-slate-600 font-semibold leading-relaxed text-left">
                      I agree to the <Link href="/terms-and-policies/privacy_policy" className="text-[#00a884] font-black hover:underline">Privacy Policy</Link> and <Link href="/terms-and-policies/terms_of_service" className="text-[#00a884] font-black hover:underline">Terms of Service</Link>.
                    </span>
                  </label>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <FileText className="w-3.5 h-3.5 text-[#00a884]" />
                    Policy acceptance required to activate the workspace
                  </div>
                </div>
              </div>

              {/* Navigation CTAs */}
              <div className="space-y-2 pt-2">
                <Button
                  disabled={!acceptedPolicies || isLoading}
                  onClick={() => handleUpdateOnboarding(3, true)}
                  className="h-11 w-full bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircle2 className="ml-1 w-4 h-4" />
                    </>
                  )}
                </Button>

                <button
                  onClick={() => setStep(2)}
                  className="w-full text-[9px] font-black  tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors py-2"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer legalities */}
        <div className="w-full text-center py-4 relative z-20">
          <p className="text-[10px] text-slate-400 font-bold select-none">
            © {new Date().getFullYear()} WatiBot. All rights reserved.
          </p>
        </div>

      </div>

    </div>
  );
}
