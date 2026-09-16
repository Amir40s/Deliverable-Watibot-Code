"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import WatiBotLoader from "@/components/WatiBotLoader"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isPlatformAdminUser, getDefaultAdminRoute } from "@/lib/admin/rbac"
import { 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Users, 
  Bot, 
  TrendingUp, 
  ChevronDown,
  MessageSquare,
  BarChart3
} from "lucide-react"

function LoginContent() {
  const t = useTranslations('Login')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [rememberMe, setRememberMe] = useState(false)



  useEffect(() => {
    fetch("/api/admin/configurations/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRegistrationEnabled(Boolean(data.enableVendorRegistration ?? true))
      })
      .catch(() => setRegistrationEnabled(true))
  }, [])

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "OAuthCallback") {
      setError(t('errors.oauth_canceled'))
    } else if (errorParam === "OAuthAccountNotLinked") {
      setError(t('errors.oauth_not_linked'))
    } else if (errorParam) {
      setError(errorParam.length > 50 ? t('errors.auth_error') : errorParam)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        const response = await fetch("/api/auth/session")
        const session = await response.json()
        console.log(`[Route Guard Login] session user: ${session?.user?.id}, onboardingCompleted: ${session?.user?.onboardingCompleted}, status: ${session?.user?.status}`);

        const isImpersonating = !!(session?.user?.originalAdminId && session.user.originalAdminId !== session.user.id);
        const isPlatformAdmin = isPlatformAdminUser(session?.user) && !isImpersonating;

        let destination = "/dashboard";
        if (isPlatformAdmin) {
          destination = getDefaultAdminRoute(session?.user);
        } else if (isImpersonating) {
          destination = "/dashboard";
        } else if (session?.user?.status === "PENDING") {
          destination = "/account-under-review";
        } else if (session?.user?.status === "SUSPENDED") {
          destination = "/account-suspended";
        }

        console.log(`[Route Guard Login Decision] Destination: ${destination}`);
        window.location.href = destination;
      }
    } catch {
      setError(t('errors.unexpected'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch {
      setError(t('errors.google_failed'))
      setIsLoading(false)
    }
  }
  return (
    <div className="w-full lg:h-screen lg:overflow-hidden bg-white flex flex-col lg:flex-row antialiased plus-jakarta-forced forced-light">
      {/* LEFT SIDE: BRAND & HERO & SOCIAL PROOF */}
      <div className="w-full lg:w-[60%] order-2 lg:order-1 flex flex-col justify-between pt-6 px-6 pb-6 lg:pt-5 lg:px-8 lg:pb-8 xl:pt-6 xl:px-12 xl:pb-10 relative overflow-hidden bg-gradient-to-br from-[#f2faf7] via-[#e8f5ee] to-[#f4fbf9] border-t lg:border-t-0 lg:border-r border-slate-100/60 lg:h-screen lg:overflow-hidden">
        {/* Soft floating background design blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[320px] h-[320px] bg-emerald-200/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] bg-emerald-100/25 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Dotted grid design pattern exactly like mockup */}
        <div className="absolute top-[6%] right-[10%] w-24 h-24 bg-[radial-gradient(#00a884_1.5px,transparent_1.5px)] [background-size:10px_10px] opacity-15 pointer-events-none hidden xl:block" />

        {/* Concentric ripples/waves behind the mockup exactly like the target */}
        <div className="hidden lg:block absolute right-[-140px] xl:right-[-70px] top-[4%] w-[680px] h-[680px] pointer-events-none z-0">
          {/* Outer glowing green background sphere */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,168,132,0.18)_0%,transparent_75%)] blur-[4px]" />
          
          {/* High-fidelity Concentric Wireframe Circle SVG */}
          <svg className="w-full h-full text-[#00a884]/20 animate-[spin_120s_linear_infinite]" viewBox="0 0 400 400" fill="none">
            {/* Outermost dotted circle */}
            <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.6" />
            
            {/* Solid fine circle */}
            <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
            
            {/* Dashed circle */}
            <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="1" strokeDasharray="12 8" opacity="0.75" />
            
            {/* Solid accent circle */}
            <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            
            {/* Innermost dashed circle */}
            <circle cx="200" cy="200" r="60" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.3" />
            
            {/* Tech grid crosshairs or radiating line vectors for premium design */}
            <line x1="200" y1="10" x2="200" y2="390" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.25" />
            <line x1="10" y1="200" x2="390" y2="200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.25" />
          </svg>
        </div>

        {/* Logo and Branding Header */}
        <div className="relative z-10 flex items-center justify-center lg:justify-start my-10">
          <img src="/logo11122.png" alt="WatiBot Logo" className="w-[170px] xl:w-[190px] h-auto object-contain mt-[-15px] lg:mt-[-20px] xl:mt-[-25px]" />
        </div>

        {/* Main Side-by-Side Content Grid: Text/Features on Left, 3D Mockup on Right */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-0 pb-4 mt-[-10px] xl:mt-[-15px] relative z-10 w-full">
          {/* Column 1: Text & Features List (Occupies 7/12 width) */}
          <div className="col-span-1 lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5 xl:space-y-6">
            
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
              {t('advanced_crm_badge')}
            </div>

            {/* Titles (Matches mockup branding: Only 'Businesses' in Green) */}
            <div className="space-y-2.5 flex flex-col items-center lg:items-start">
              <h1 className="text-3xl xl:text-[38px] font-black text-slate-900 tracking-tight leading-[1.15]">
                {t('title_start')} <span className="text-[#00a884]">{t('title_highlight')}</span>
              </h1>
              <p className="text-slate-500 text-[13px] leading-relaxed max-w-sm">
                {t('subtitle')}
              </p>
            </div>

            {/* List of Features Stacked Vertically in 1 Column to match mockup */}
            <div className="space-y-6 pt-8 xl:pt-10 w-full">
              {/* Feature 1 */}
              <div className="flex gap-3.5 items-start text-left">
                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[14px]">{t('feature1_title')}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{t('feature1_desc')}</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-3.5 items-start text-left">
                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                  <Bot className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[14px]">{t('feature2_title')}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{t('feature2_desc')}</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-3.5 items-start text-left">
                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                  <BarChart3 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[14px]">{t('feature3_title')}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{t('feature3_desc')}</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-3.5 items-start text-left">
                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[14px]">{t('feature4_title')}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{t('feature4_desc')}</p>
                </div>
              </div>
            </div>

            {/* Trusted by 10,000+ businesses badge at the bottom (Pill capsule styled) */}
            <div className="inline-flex items-center gap-3.5 px-4 py-2 bg-white border border-slate-100 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] w-fit mt-6 xl:mt-8 animate-fade-in select-none">
              <div className="flex -space-x-2 items-center">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=64&h=64&q=80" className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                <div className="w-[26px] h-[26px] rounded-full bg-[#00a884] text-white text-[8.5px] font-black flex items-center justify-center border-2 border-white relative z-10 shadow-sm">
                  10K+
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 pr-1.5 ml-2.5">
                {t('trusted_by')} <span className="text-[#00a884] font-extrabold">10,000+</span> {t('businesses_worldwide')}
              </span>
            </div>
          </div>

          {/* Column 2: Premium 3D Perspective Laptop Mockup */}
          <div className="col-span-1 lg:col-span-5 relative flex items-center justify-center h-full min-h-[390px] xl:min-h-[640px] perspective-1000">
            {/* Giant soft green circle background exactly like mockup */}
            <div className="absolute w-[440px] h-[440px] rounded-full bg-[#00a884]/12 blur-[8px] pointer-events-none z-0" 
              style={{
                transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) translateZ(-40px) translateX(35px) translateY(-30px)",
              }}
            />

            {/* 3D Rotated Laptop Screen */}
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

      {/* RIGHT SIDE: LOGIN FORM & CARD */}
      <div className="w-full lg:w-[40%] order-1 lg:order-2 bg-[#fafbfc] flex flex-col justify-between items-center lg:items-stretch lg:h-screen lg:overflow-y-auto p-4 sm:p-6 lg:p-8 relative custom-scrollbar">


        {/* Center: Beautiful Login Card (Sized beautifully to stay under 100vh) */}
        <div className="mx-auto my-4 lg:mt-8 lg:mb-10 w-full max-w-[500px] bg-white border border-slate-100/90 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-lg shadow-slate-100/40 flex flex-col relative">
          
          {/* Card Header (Logo and Titles) */}
          <div className="flex flex-col items-center text-center">
            <img src="/logo11122.png" alt="WatiBot Logo" className="w-[155px] h-auto object-contain mx-auto" />
            <h2 className="text-[20px] font-black text-slate-800 mt-4 tracking-tight">{t('welcome_back')}</h2>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
              {t('login_prompt')}
            </p>
          </div>

          {/* Form and Fields */}
          <form onSubmit={handleLogin} className="space-y-4 mt-5">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

             <div className="space-y-1">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input
                  type="email"
                  placeholder={t('email_placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-11 pr-6 border-slate-200/80 rounded-xl focus-visible:ring-[#00a884] focus-visible:border-[#00a884] text-[12.5px] font-bold text-slate-800 placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t('password_placeholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-11 pr-11 border-slate-200/80 rounded-xl focus-visible:ring-[#00a884] focus-visible:border-[#00a884] text-[12.5px] font-bold text-slate-800 placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#00a884] focus:ring-[#00a884] accent-[#00a884] cursor-pointer"
                />
                <span className="text-[11.5px] font-bold text-slate-500">{t('remember_me')}</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-[11.5px] font-bold text-[#00a884] hover:text-emerald-700 hover:underline transition-colors"
              >
                {t('forgot_password')}
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#00a884] hover:bg-[#009675] disabled:opacity-85 text-white font-extrabold rounded-xl transition-all duration-200 shadow-md shadow-emerald-100/50 flex items-center justify-center gap-2 active:scale-[0.98] mt-4"
            >
              {isLoading ? (
                <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t('login_button')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* OR Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <span className="relative px-3 bg-white text-[9px] text-slate-400 font-extrabold uppercase tracking-widest">
              {t('or')}
            </span>
          </div>

           <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-11 bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-[11.5px] rounded-xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t('login_google')}
          </Button>

          {/* Secure lock message */}
          <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold text-slate-400 mt-4 pt-3 border-t border-slate-100">
            <Lock className="w-3 h-3 text-slate-300" />
            <span>{t('secure_data')}</span>
          </div>

          {/* Optional Vendor Registration */}
          {registrationEnabled && (
            <p className="text-[11px] font-bold text-slate-500 text-center mt-4">
              {t('new_to_watibot')}{" "}
              <Link href="/register" className="text-[#00a884] hover:text-[#009675] hover:underline transition-colors">
                {t('create_account')}
              </Link>
            </p>
          )}
        </div>

        {/* Bottom Footer Info (Properly positioned at the bottom of 100vh) */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center text-[11px] font-bold text-slate-400 mt-auto pt-4 border-t border-slate-100/60 w-full relative z-10">
          <div className="flex gap-4">
            <Link href="/terms-and-policies" className="hover:text-slate-600 transition-colors">{t('privacy_policy')}</Link>
            <span>|</span>
            <Link href="/terms-and-policies" className="hover:text-slate-600 transition-colors">{t('terms_of_service')}</Link>
          </div>
          <div>
            <span>{t('copyright')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<WatiBotLoader />}>
      <LoginContent />
    </Suspense>
  )
}
