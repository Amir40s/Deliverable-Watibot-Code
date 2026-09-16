"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Users,
  Bot,
  BarChart3,
  MessageSquare,
  ChevronDown,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [resetCode, setResetCode] = useState<string | null>(null)



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")
    setResetCode(null)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        if (data.resetCode) {
          setResetCode(data.resetCode)
        }
        setTimeout(() => {
          router.push(`/reset-password?identifier=${encodeURIComponent(identifier)}`)
        }, 8000)
      } else {
        setError(data.error || "Something went wrong. Please try again.")
      }
    } catch {
      setError("Failed to connect to the server.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full lg:h-screen lg:overflow-hidden bg-white flex flex-col lg:flex-row antialiased plus-jakarta-forced forced-light">

      {/* Development Reset Code Popup */}
      {resetCode && (
        <div className="fixed inset-0 bg-[#00B074]/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 max-w-sm w-full mx-4 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border border-white/20 ring-1 ring-[#00B074]/10">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-[#00B074]/10 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-[#00B074]/20">
                <ShieldCheck className="w-8 h-8 text-[#00B074]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Reset</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Developer Capture Active</p>
              </div>
              <div className="bg-[#00B074]/5 rounded-2xl p-6 border-2 border-dashed border-[#00B074]/30">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Recovery Code</p>
                <h1 className="text-4xl font-bold text-[#00B074] tracking-[0.4em] ml-[0.4em]">{resetCode}</h1>
              </div>
              <Button
                onClick={() => router.push(`/reset-password?identifier=${encodeURIComponent(identifier)}`)}
                className="w-full h-14 bg-[#00B074] hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all"
              >
                Continue Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDE: BRAND & HERO */}
      <div className="w-full lg:w-[60%] order-2 lg:order-1 flex flex-col justify-between pt-6 px-6 pb-6 lg:pt-5 lg:px-8 lg:pb-8 xl:pt-6 xl:px-12 xl:pb-10 relative overflow-hidden bg-gradient-to-br from-[#f2faf7] via-[#e8f5ee] to-[#f4fbf9] border-t lg:border-t-0 lg:border-r border-slate-100/60 lg:h-screen lg:overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[320px] h-[320px] bg-emerald-200/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] bg-emerald-100/25 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[6%] right-[10%] w-24 h-24 bg-[radial-gradient(#00a884_1.5px,transparent_1.5px)] [background-size:10px_10px] opacity-15 pointer-events-none hidden xl:block" />

        {/* Concentric rings */}
        <div className="hidden lg:block absolute right-[-140px] xl:right-[-70px] top-[4%] w-[680px] h-[680px] pointer-events-none z-0">
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

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center lg:justify-start my-10">
          <img src="/logo11122.png" alt="WatiBot Logo" className="w-[170px] xl:w-[190px] h-auto object-contain mt-[-15px] lg:mt-[-20px] xl:mt-[-25px]" />
        </div>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-0 pb-4 mt-[-10px] xl:mt-[-15px] relative z-10 w-full">
          {/* Left Column: Text & Features */}
          <div className="col-span-1 lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5 xl:space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
              Advanced WhatsApp CRM Platform
            </div>

            <div className="space-y-2.5 flex flex-col items-center lg:items-start">
              <h1 className="text-3xl xl:text-[38px] font-black text-slate-900 tracking-tight leading-[1.15]">
                Powerful WhatsApp CRM for Modern <span className="text-[#00a884]">Businesses</span>
              </h1>
              <p className="text-slate-500 text-[13px] leading-relaxed max-w-sm">
                Manage conversations, automate workflows, and grow your business with the most advanced WhatsApp CRM platform.
              </p>
            </div>

            <div className="space-y-6 pt-8 xl:pt-10 w-full">
              {[
                { icon: <MessageSquare className="w-4 h-4" />, title: "Multi-Agent Inbox", desc: "Collaborate with your team and manage all conversations in one place." },
                { icon: <Bot className="w-4 h-4" />, title: "Smart Automation", desc: "Create smart automations and chatbots to engage your customers 24/7." },
                { icon: <BarChart3 className="w-4 h-4" />, title: "Advanced Analytics", desc: "Track performance, analyze data, and make smarter business decisions." },
                { icon: <ShieldCheck className="w-4 h-4" />, title: "Enterprise Security", desc: "Your data is protected with enterprise-grade security and privacy." },
              ].map((f) => (
                <div key={f.title} className="flex gap-3.5 items-start text-left">
                  <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-[14px]">{f.title}</h3>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trusted badge */}
            <div className="inline-flex items-center gap-3.5 px-4 py-2 bg-white border border-slate-100 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] w-fit mt-6 xl:mt-8 select-none">
              <div className="flex -space-x-2 items-center">
                {[
                  "photo-1534528741775-53994a69daeb",
                  "photo-1507003211169-0a1dd7228f2d",
                  "photo-1494790108377-be9c29b29330",
                  "photo-1500648767791-00dcc994a43e",
                  "photo-1517841905240-472988babdf9",
                ].map((id) => (
                  <img key={id} src={`https://images.unsplash.com/${id}?auto=format&fit=crop&w=64&h=64&q=80`} className="w-[26px] h-[26px] rounded-full border-2 border-white object-cover" />
                ))}
                <div className="w-[26px] h-[26px] rounded-full bg-[#00a884] text-white text-[8.5px] font-black flex items-center justify-center border-2 border-white relative z-10 shadow-sm">10K+</div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 pr-1.5 ml-2.5">
                Trusted by <span className="text-[#00a884] font-extrabold">10,000+</span> businesses worldwide
              </span>
            </div>
          </div>

          {/* Right Column: 3D Mockup */}
          <div className="col-span-1 lg:col-span-5 relative flex items-center justify-center h-full min-h-[390px] xl:min-h-[640px]">
            <div className="absolute w-[440px] h-[440px] rounded-full bg-[#00a884]/12 blur-[8px] pointer-events-none z-0"
              style={{ transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) translateZ(-40px) translateX(35px) translateY(-30px)" }}
            />
            <div
              className="relative rounded-3xl border border-slate-200/80 overflow-hidden z-10 flex shadow-2xl bg-[#f8fafc]"
              style={{
                width: "380px", height: "540px", minWidth: "380px", minHeight: "540px",
                transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) rotateZ(-8deg) translateX(35px) translateY(-30px)",
                transformStyle: "preserve-3d",
              }}
            >
              <div className="flex-1 flex overflow-hidden bg-[#f8fafc] rounded-3xl">
                {/* Sidebar */}
                <div className="w-[45px] bg-[#0c1317] flex flex-col items-center py-5 gap-5 flex-shrink-0 rounded-l-3xl border-r border-slate-800/40">
                  <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm p-1.5 mb-2">
                    <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 flex items-center justify-center text-[#00a884]"><MessageSquare className="w-4 h-4" /></div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500"><Users className="w-4 h-4" /></div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500"><Bot className="w-4 h-4" /></div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500"><BarChart3 className="w-4 h-4" /></div>
                </div>

                {/* Main Area */}
                <div className="flex-1 bg-[#f4f7f6] flex flex-col overflow-hidden rounded-r-3xl text-left">
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

                  <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden">
                    <div className="flex justify-between items-center flex-shrink-0 pl-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-black text-slate-800 tracking-tight">Active Team Inbox</span>
                        <span className="text-[7px] font-black bg-emerald-50 text-[#00a884] border border-emerald-100/50 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Live</span>
                      </div>
                      <span className="text-[8px] font-black text-slate-400">Total Chats: 24 active</span>
                    </div>

                    <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-sm flex items-center gap-3 flex-shrink-0">
                      <div className="relative">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&h=64&q=80" className="w-9 h-9 rounded-full object-cover" alt="Sarah Connor" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[9.5px] font-black text-slate-800">Sarah Connor</span>
                          <span className="text-[7px] font-bold text-slate-400">1m ago</span>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[8px] font-semibold text-slate-400 truncate">"Hey! Do you have this product in stock? 🛍️"</span>
                          <span className="bg-[#e0f7f1] text-[#00a884] text-[6.5px] font-black px-1.5 rounded-full uppercase shrink-0">VIP</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex-1 flex flex-col gap-2 overflow-hidden justify-between">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Automated Reply Dialog</span>
                      <div className="flex flex-col gap-2.5">
                        <div className="flex gap-2 max-w-[85%] self-start">
                          <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=32&h=32&q=80" className="w-full h-full object-cover" />
                          </div>
                          <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-2 text-[8px] font-semibold text-slate-600 shadow-sm">
                            How do I trigger custom broadcast lists? 📁
                          </div>
                        </div>
                        <div className="flex gap-2 max-w-[85%] self-end flex-row-reverse">
                          <div className="w-5 h-5 rounded-full bg-[#00a884] flex items-center justify-center text-white text-[9px] font-black shrink-0">🤖</div>
                          <div className="bg-[#00a884] text-white rounded-2xl rounded-tr-sm p-2 text-[8px] font-black">
                            Simple! Upload your custom .CSV dataset in the Wati Contacts dashboard. 🚀
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                      <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex flex-col text-left">
                          <span className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-wider">Deliverability</span>
                          <span className="text-[10px] font-black text-slate-800">99.8%</span>
                        </div>
                        <span className="text-[7.5px] font-bold text-[#00a884] bg-emerald-50 px-1 rounded-sm">↑ 0.4%</span>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex flex-col text-left">
                          <span className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-wider">Avg Response</span>
                          <span className="text-[10px] font-black text-slate-800">45 sec</span>
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

      {/* RIGHT SIDE: FORM */}
      <div className="w-full lg:w-[40%] order-1 lg:order-2 bg-[#fafbfc] flex flex-col justify-between items-center lg:items-stretch lg:h-screen lg:overflow-hidden p-4 sm:p-6 lg:p-8 relative">


        {/* Form Card */}
        <div className="mx-auto my-4 lg:mt-8 lg:mb-10 w-full max-w-[500px] bg-white border border-slate-100/90 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-lg shadow-slate-100/40 flex flex-col relative">
          
          {/* Card Header (Logo and Titles) */}
          <div className="flex flex-col items-center text-center">
            <img src="/logo11122.png" alt="WatiBot Logo" className="w-[155px] h-auto object-contain mx-auto" />
            <h2 className="text-[20px] font-black text-slate-800 mt-4 tracking-tight">Forgot Password?</h2>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
              Enter your email address or phone number to receive a recovery code
            </p>
          </div>

          <div className="mt-5 flex flex-col">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold mb-4">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[11px] font-bold mb-4">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Email Address or Phone Number"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-11 pl-11 pr-6 border-slate-200/80 rounded-xl focus-visible:ring-[#00a884] focus-visible:border-[#00a884] text-[12.5px] font-bold text-slate-800 placeholder:text-slate-400"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !identifier.trim()}
                className="w-full h-11 bg-[#00a884] hover:bg-[#009675] text-white font-extrabold rounded-xl transition-all duration-200 shadow-md shadow-emerald-100/50 flex items-center justify-center gap-2 active:scale-[0.98] mt-4"
              >
                {isLoading ? (
                  <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Send Recovery Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-center justify-center mt-6 pt-4 border-t border-slate-100">
              <Link href="/login" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#00a884] transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 mt-8 pt-4 border-t border-slate-100/60 w-full">
          <div className="flex gap-4">
            <Link href="/terms-and-policies/privacy_policy" className="hover:text-slate-600">Privacy Policy</Link>
            <span>|</span>
            <Link href="/terms-and-policies/terms_of_service" className="hover:text-slate-600">Terms of Service</Link>
          </div>
          <div>© 2026 WatiBot. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
