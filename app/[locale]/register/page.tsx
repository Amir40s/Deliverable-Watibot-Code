"use client"

import type React from "react"
import { useState } from "react"
import { countries } from "@/lib/countries"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  User,
  Building2,
  Zap,
  Play,
  MessageSquare,
  BarChart3
} from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    phoneNumber: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone'>('email')
  const [step, setStep] = useState<1 | 2>(1)



  const [selectedCountry, setSelectedCountry] = useState({
    code: "+1",
    flag: "https://flagcdn.com/w40/us.png",
    name: "US"
  })
  const [isCountryOpen, setIsCountryOpen] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    if (e.target.name === "phoneNumber") {
      const trimmed = value.trim();
      
      // Sort countries by code length descending to match longer prefixes first (e.g. +1684 before +1)
      const sortedCountries = [...countries].sort((a, b) => b.code.length - a.code.length);
      
      // Match ONLY when the user explicitly types an international prefix indicator ("+" or "00")
      // to avoid conflict with standard local phone numbers (like Pakistan's 300, India's 98, etc.)
      if (trimmed.startsWith("+")) {
        const matched = sortedCountries.find(c => trimmed.startsWith(c.code));
        if (matched) {
          setSelectedCountry(matched);
          // Strip the country code and any leading spaces from input value
          value = trimmed.substring(matched.code.length).trim();
        }
      } else if (trimmed.startsWith("00")) {
        const matched = sortedCountries.find(c => {
          const codeWithoutPlus = c.code.replace("+", "");
          return trimmed.startsWith(`00${codeWithoutPlus}`);
        });
        if (matched) {
          const codeWithoutPlus = matched.code.replace("+", "");
          setSelectedCountry(matched);
          // Strip the "00" and the country code from input value
          value = trimmed.substring(2 + codeWithoutPlus.length).trim();
        }
      }
    }

    setFormData({ ...formData, [e.target.name]: value })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (step === 1) {
      if (!agreeTerms) {
        setError("You must agree to the Terms of Service and Privacy Policy")
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      setStep(2)
      return
    }

    setIsLoading(true)

    if (verificationMethod === 'phone' && !formData.phoneNumber.trim()) {
      setError("Phone number is required for WhatsApp OTP verification")
      setIsLoading(false)
      return
    }

    try {
      let cleanPhone = formData.phoneNumber.trim();
      if (cleanPhone) {
        const prefixWithoutPlus = selectedCountry.code.replace("+", "");
        if (cleanPhone.startsWith("+")) {
          cleanPhone = cleanPhone.substring(1);
        }
        if (cleanPhone.startsWith(prefixWithoutPlus)) {
          cleanPhone = cleanPhone.substring(prefixWithoutPlus.length);
        }
        if (cleanPhone.startsWith("0")) {
          cleanPhone = cleanPhone.substring(1);
        }
        cleanPhone = `${selectedCountry.code}${cleanPhone}`;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          organizationName: formData.organizationName || undefined,
          phoneNumber: cleanPhone || undefined,
          verificationMethod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed")
        setIsLoading(false)
        return
      }

      if (data.verification?.required === false) {
        router.push("/login?registered=true")
        return
      }

      const verificationUrl = `/verify-email?email=${encodeURIComponent(formData.email)}&method=${verificationMethod}${cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : ''}`
      router.push(verificationUrl)
    } catch (error) {
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsLoading(true)
    try {
      await signIn("google", { callbackUrl: "/account-under-review" })
    } catch (error) {
      setError("Failed to sign up with Google")
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen bg-white flex flex-col lg:flex-row antialiased plus-jakarta-forced forced-light">
      {/* LEFT SIDE: BRAND & HERO & SOCIAL PROOF */}
      <div className="w-full lg:w-[60%] order-2 lg:order-1 flex flex-col justify-between pt-8 px-6 pb-8 lg:pt-3 lg:px-12 lg:pb-8 xl:pt-4 xl:px-16 xl:pb-10 relative overflow-hidden bg-gradient-to-br from-[#f2faf7] via-[#e8f5ee] to-[#f4fbf9] border-t lg:border-t-0 lg:border-r border-slate-100/60 lg:min-h-screen">
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

        {/* Vertical Stack Layout representing the target mockup exactly */}
        <div className="flex flex-col gap-4 max-w-[620px] mx-auto w-full relative z-10 pt-1 pb-6">
          
          {/* Logo and Branding Header */}
          <div className="flex items-center justify-center lg:justify-start my-10">
            <img 
              src="/logo11122.png" 
              alt="WatiBot Logo" 
              className="w-[170px] xl:w-[190px] h-auto object-contain mt-[-15px] lg:mt-[-20px] xl:mt-[-25px] mb-[-15px] lg:mb-[-20px] xl:mb-[-25px]" 
            />
          </div>

          {/* Grouped Badge, Title, and Paragraph with Tight Vertical Spacing */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-3">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit  tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
              Advanced WhatsApp CRM Platform
            </div>

            {/* Hero Titles & Description */}
            <div className="space-y-2.5">
              <h1 className="text-[34px] xl:text-[40px] font-black text-slate-900 tracking-tight leading-[1.12]">
                Grow Faster with Smart <span className="text-[#00a884]">WhatsApp</span> Automation
              </h1>
              <p className="text-slate-500 text-[13px] leading-relaxed max-w-xl">
                Automate chats, capture leads, and scale conversations with an all-in-one WhatsApp CRM.
              </p>
            </div>
          </div>

          {/* Landscape Browser Mockup (Wide screen, elegant, flat, drop shadow) */}
          <div className="w-full aspect-[1.62] border border-slate-200/80 rounded-3xl overflow-hidden shadow-2xl flex relative bg-[#f8fafc] mt-1">
            <div className="flex-1 flex bg-[#f8fafc] overflow-hidden">
              
              {/* Sidebar */}
              <div className="w-[125px] bg-[#0b141a] flex flex-col py-4 gap-1.5 flex-shrink-0">
                {/* Sidebar Header with WhatsApp icon */}
                <div className="px-3 pb-3 border-b border-slate-800/40 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm p-0.5 flex-shrink-0">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black text-white  tracking-wider">WatiBot</span>
                </div>

                {/* Sidebar Menu Items */}
                <div className="flex flex-col gap-1 px-2 pt-2 flex-1">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#00a884] rounded-lg text-white text-[9px] font-bold shadow-sm">
                    <Bot className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Dashboard</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-slate-400 hover:text-white text-[9px] font-bold rounded-lg cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Inbox</span>
                    </div>
                    <span className="bg-[#00a884] text-white text-[8px] px-1.5 py-0.5 rounded-full">12</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-slate-400 hover:text-white text-[9px] font-bold rounded-lg cursor-pointer">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Contacts</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-slate-400 hover:text-white text-[9px] font-bold rounded-lg cursor-pointer">
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Broadcast</span>
                  </div>
                </div>
              </div>

              {/* Right Main Page */}
              <div className="flex-1 bg-[#f8fafc] flex flex-col overflow-hidden">
                {/* Top window bar */}
                <div className="h-7 bg-white border-b border-slate-100 flex items-center px-4 justify-between flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    <span className="w-2 h-2 rounded-full bg-[#eab308]" />
                    <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  </div>
               
                  <div className="w-3 h-3 bg-slate-100 rounded-full" />
                </div>

                {/* Dashboard inner content */}
                <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden relative">
                  
                  {/* Dashboard Header */}
                  <div className="flex justify-between items-center flex-shrink-0">
                    <span className="text-[11px] font-black text-slate-800  tracking-tight">Dashboard</span>
                    <div className="w-3.5 h-3.5 flex items-center justify-center text-slate-400 font-bold select-none cursor-pointer">⋮</div>
                  </div>

                  {/* Grid row of 4 statistics cards (2x2 on mobile) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[7px] text-slate-400 font-bold  tracking-tight">Total Contacts</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-[12px] font-black text-slate-800">25,680</span>
                        <span className="text-[7px] text-[#00a884] font-bold">↑ 12.5%</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[7px] text-slate-400 font-bold  tracking-tight">Messages Sent</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-[12px] font-black text-slate-800">98,765</span>
                        <span className="text-[7px] text-[#00a884] font-bold">↑ 18.2%</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[7px] text-slate-400 font-bold  tracking-tight">Active Chats</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-[12px] font-black text-slate-800">8,432</span>
                        <span className="text-[7px] text-[#00a884] font-bold">↑ 8.7%</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-[7px] text-slate-400 font-bold  tracking-tight">Open Rate</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-[12px] font-black text-slate-800">72.5%</span>
                        <span className="text-[7px] text-[#00a884] font-bold">↑ 6.1%</span>
                      </div>
                    </div>
                  </div>

                  {/* Split details layout */}
                  <div className="grid grid-cols-12 gap-3 h-[50%] flex-shrink-0">
                    {/* Left: Live conversations */}
                    <div className="col-span-5 bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between gap-1.5 relative overflow-hidden">
                      <div className="w-full flex justify-between items-center border-b border-slate-50 pb-1 flex-shrink-0">
                        <span className="text-[8px] text-slate-700 font-extrabold ">Live Conversations</span>
                        <span className="w-2 h-2 rounded-full bg-[#00a884]" />
                      </div>
                      <div className="flex flex-col gap-2 pt-1 flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=32&h=32&q=80" className="w-5 h-5 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[7px] font-bold text-slate-800">Sarah Johnson</div>
                            <div className="text-[6px] text-slate-400 truncate">Hi, I want to know more about...</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=32&h=32&q=80" className="w-5 h-5 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[7px] font-bold text-slate-800">David Smith</div>
                            <div className="text-[6px] text-[#00a884] font-bold truncate">Can you share the pricing?</div>
                          </div>
                          <span className="bg-[#00a884] text-white text-[6px] w-3 h-3 flex items-center justify-center rounded-full font-bold flex-shrink-0">1</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=32&h=32&q=80" className="w-5 h-5 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[7px] font-bold text-slate-800">Michael Brown</div>
                            <div className="text-[6px] text-slate-400 truncate">Thank you! 👍</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Curve Line Graph */}
                    <div className="col-span-7 bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <div className="w-full flex justify-between items-center flex-shrink-0">
                        <span className="text-[8px] text-slate-700 font-extrabold ">Messages Sent</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full" />
                          <span className="text-[6px] text-slate-400 font-bold">9,765</span>
                          <span className="text-[5px] text-[#00a884] font-bold">↑ 18.2%</span>
                        </div>
                      </div>

                      {/* Curved Line Path */}
                      <div className="relative w-full h-[65px] mt-2 flex-1">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
                          <line x1="0" y1="12" x2="100" y2="12" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2" />
                          <line x1="0" y1="28" x2="100" y2="28" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2" />
                          <line x1="0" y1="44" x2="100" y2="44" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="2" />
                          <defs>
                            <linearGradient id="chart-grad-reg-v2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00a884" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#00a884" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d="M 0 45 Q 25 35 45 28 T 85 14 T 100 5 L 100 50 L 0 50 Z" fill="url(#chart-grad-reg-v2)" />
                          <path d="M 0 45 Q 25 35 45 28 T 85 14 T 100 5" fill="none" stroke="#00a884" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="100" cy="5" r="2.2" fill="#ffffff" stroke="#00a884" strokeWidth="1.2" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Stacked active agent avatars row and details - ALIGNED TO THE FAR RIGHT */}
                  <div className="flex items-center justify-end pl-2.5 pr-0 -mr-1 flex-shrink-0 pt-0.5 mt-0.5">
                    <div className="flex gap-2 items-center">
                      <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=32&h=32&q=80" className="w-5.5 h-5.5 rounded-full border border-white object-cover" />
                      <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=32&h=32&q=80" className="w-5.5 h-5.5 rounded-full border border-white object-cover" />
                      <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=32&h=32&q=80" className="w-5.5 h-5.5 rounded-full border border-white object-cover" />
                      <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=32&h=32&q=80" className="w-5.5 h-5.5 rounded-full border border-white object-cover" />
                      <div className="w-5.5 h-5.5 rounded-full bg-[#00a884] text-white text-[8px] font-black flex items-center justify-center border border-white">
                        10K+
                      </div>
                    </div>
                  </div>

                  {/* Large Overlapping Green Play button in the middle */}
                  <div className="absolute top-[52%] left-[42%] transform -translate-x-1/2 -translate-y-1/2 z-30 select-none">
                    <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-lg shadow-[#00a884]/30 cursor-pointer hover:scale-110 active:scale-95 transition-all">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* 3-Column horizontal row of features below browser mockup (Vertical on mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 xl:pt-12 w-full">
            {/* Feature 1 */}
            <div className="flex gap-2.5 items-start">
              <div className="flex-shrink-0 w-[32px] h-[32px] rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-[12.5px] tracking-tight">Instant Automation</h3>
                <p className="text-slate-400 text-[9.5px] mt-0.5 leading-relaxed">Automate replies, follow-ups and workflows in seconds.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-2.5 items-start">
              <div className="flex-shrink-0 w-[32px] h-[32px] rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-[12.5px] tracking-tight">Multi-Agent Inbox</h3>
                <p className="text-slate-400 text-[9.5px] mt-0.5 leading-relaxed">Collaborate with your team in one shared inbox.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-2.5 items-start">
              <div className="flex-shrink-0 w-[32px] h-[32px] rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-[12.5px] tracking-tight">Smart Analytics</h3>
                <p className="text-slate-400 text-[9.5px] mt-0.5 leading-relaxed">Track performance and make data-driven decisions.</p>
              </div>
            </div>
          </div>

          {/* Trusted by 10,000+ businesses badge at the bottom (Pill capsule styled) */}
          <div className="inline-flex items-center gap-3.5 px-4 py-2 bg-white border border-slate-100 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] w-fit mt-4 animate-fade-in select-none">
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
              Trusted by <span className="text-[#00a884] font-extrabold">10,000+</span> businesses worldwide
            </span>
          </div>

        </div>

      </div>

      {/* RIGHT SIDE: REGISTER FORM & CARD */}
      <div className="w-full lg:w-[40%] order-1 lg:order-2 bg-[#fafbfc] flex flex-col justify-center items-center lg:justify-start lg:items-stretch lg:h-screen lg:overflow-y-auto p-3 sm:p-6 lg:p-8 relative custom-scrollbar">


        {/* Center: Beautiful Register Card */}
        <div className="mx-auto my-4 lg:mt-8 lg:mb-10 w-full max-w-[500px] bg-white border border-slate-100/90 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-lg shadow-slate-100/40 flex flex-col relative">
          
          {/* Card Header (Logo and Titles) */}
          <div className="flex flex-col items-center text-center">
            <img src="/logo11122.png" alt="WatiBot Logo" className="w-[155px] h-auto object-contain mx-auto" />
            <h2 className="text-[20px] font-black text-slate-800 mt-4 tracking-tight">Create Your Account</h2>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[280px] leading-relaxed">
              Sign up to get started and manage your WhatsApp .
            </p>
          </div>

          {/* Form and Fields */}
          <form onSubmit={handleRegister} className="space-y-3.5 mt-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-500 text-[11px] font-bold leading-relaxed animate-shake">
                {error}
              </div>
            )}

            {step === 1 && (
              <>
                {/* Row 1: Full Name and Company Name Side-by-Side */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400  tracking-widest ml-1">
                      Full Name
                    </Label>
                    <div className="relative">
                      <Input
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="pl-12 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                      />
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400  tracking-widest ml-1">
                      Company Name
                    </Label>
                    <div className="relative">
                      <Input
                        name="organizationName"
                        placeholder="Company Name"
                        value={formData.organizationName}
                        onChange={handleChange}
                        required
                        className="pl-12 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                      />
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Row 2: Email Address */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400  tracking-widest ml-1">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Input
                      type="email"
                      name="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="pl-12 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* Row 3: Phone Number with US Flag dropdown inside */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400  tracking-widest ml-1">
                    Phone Number
                  </Label>
                  <div className="relative flex items-center">
                    <div 
                      onClick={() => setIsCountryOpen(!isCountryOpen)}
                      className={`absolute left-2.5 flex items-center gap-1.5 bg-slate-50/80 border rounded-lg px-2 py-1.5 select-none cursor-pointer z-10 transition-all duration-200 ${
                        isCountryOpen 
                          ? 'border-[#00a884] bg-white ring-1 ring-[#00a884]/20 shadow-sm' 
                          : 'border-slate-100 hover:border-[#00a884]/40 hover:bg-slate-100/90'
                      }`}
                    >
                      <img src={selectedCountry.flag} alt={selectedCountry.name} className="w-4 h-2.5 object-cover rounded-sm flex-shrink-0" />
                      <span className="text-[10px] font-bold text-slate-700">{selectedCountry.code}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <Input
                      type="tel"
                      name="phoneNumber"
                      placeholder="Phone Number"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      required
                      style={{ paddingLeft: selectedCountry.code.length <= 3 ? "100px" : selectedCountry.code.length === 4 ? "110px" : "120px" }}
                      className="h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                    />

                    {isCountryOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setIsCountryOpen(false)} />
                        <div className="absolute left-2.5 top-[44px] w-[180px] bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xl shadow-slate-100/60 z-30 animate-fade-in max-h-[220px] overflow-y-auto">
                          {countries.map((c) => (
                            <div
                              key={c.code}
                              onClick={() => {
                                setSelectedCountry(c)
                                setIsCountryOpen(false)
                              }}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-xs font-bold select-none text-slate-700 hover:text-slate-900 justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <img src={c.flag} alt={c.name} className="w-4.5 h-2.5 object-cover rounded-sm flex-shrink-0" />
                                <span className="text-slate-500 font-semibold">{c.name}</span>
                              </div>
                              <span className="text-slate-400 font-black text-[10px]">{c.code}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 4 & 5: Password & Confirm Password */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400  tracking-widest ml-1">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      className="pl-12 pr-10 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400  tracking-widest ml-1">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      minLength={8}
                      className="pl-12 pr-10 h-11 text-xs font-semibold text-slate-800 border-slate-100 rounded-xl focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884]/30 focus-visible:ring-offset-0 focus:outline-none transition-all bg-slate-50/20"
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Checkbox agreement */}
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    id="agree-checkbox"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 cursor-pointer appearance-auto accent-[#00a884] bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#00a884]"
                  />
                  <label htmlFor="agree-checkbox" className="text-[10px] xl:text-[11px] font-semibold text-slate-500 select-none cursor-pointer">
                    I agree to the{" "}
                    <Link href="/terms-and-policies/terms_of_service" className="text-[#00a884] hover:underline font-bold">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/terms-and-policies/privacy_policy" className="text-[#00a884] hover:underline font-bold">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-4 py-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 tracking-widest ml-1">
                    Receive Verification Code Via
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVerificationMethod('email')}
                      className={`flex items-center justify-center gap-2 h-11 border text-xs font-bold rounded-xl transition-all ${
                        verificationMethod === 'email'
                          ? 'border-[#00a884] bg-[#00a884]/5 text-[#00a884] ring-1 ring-[#00a884]/20'
                          : 'border-slate-100 bg-slate-50/10 hover:border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      <span>Email Address</span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex items-center justify-center gap-2 h-11 border border-slate-100 bg-slate-50/40 text-slate-300 rounded-xl cursor-not-allowed opacity-60 text-xs font-bold transition-all select-none"
                      title="WhatsApp verification is currently disabled"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span>WhatsApp (Phone)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons Container */}
            <div className="flex gap-3 mt-4">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                  className="w-[110px] h-11 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                >
                  Back
                </button>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-11 bg-[#00a884] hover:bg-[#008f70] text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#00a884]/10 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{step === 1 ? "Continue" : "Send Verification Code"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {step === 1 && (
            <>
              {/* OR divider */}
              <div className="relative flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[9px] font-black text-slate-300  tracking-widest">OR</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Google SSO Button */}
              <Button
                onClick={handleGoogleSignup}
                type="button"
                variant="outline"
                className="w-full h-11 bg-white border border-slate-100 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 active:scale-[0.99]"
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
                <span>Sign up with Google</span>
              </Button>
            </>
          )}

          {/* Secure disclaimer */}
         <div className="w-full max-w-[420px] mx-auto flex flex-row items-center justify-between gap-3 text-[11px] font-bold text-slate-400 mt-auto pt-6">
  <p>
    Already have an account?{" "}
    <Link href="/login" className="text-[#00a884] hover:underline px-0.5">
      Login
    </Link>
  </p>

  <p>© 2026 WatiBot. All rights reserved.</p>
</div>

        </div>

 
      

      </div>

    </div>
  )
}
