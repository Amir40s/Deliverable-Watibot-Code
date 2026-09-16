"use client"

import type React from "react"
import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, CheckCircle, Loader2, ShieldCheck, ShieldAlert, MessageSquare, Bot, Users, BarChart3, XCircle } from "lucide-react"

function VerifyEmailContent() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const email = searchParams.get("email")
    const method = searchParams.get("method") || "email"
    const phone = searchParams.get("phone")

    const [code, setCode] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!email) {
            router.replace("/register")
        }
    }, [email, router])

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (params.has("code")) {
            params.delete("code")
            const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
            router.replace(nextUrl)
        }
    }, [pathname, router, searchParams])

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || code.length !== 6) return

        setIsLoading(true)
        setError("")

        try {
            const response = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || "Verification failed")
                return
            }

            setSuccess(true)
            setTimeout(() => {
                router.push("/login?verified=true")
            }, 1400)
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const handleResendCode = async () => {
        if (!email) return

        setIsLoading(true)
        setError("")

        try {
            const response = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, method }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || "Failed to resend code")
                return
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full lg:h-screen lg:overflow-hidden bg-white flex flex-col lg:flex-row antialiased plus-jakarta-forced forced-light">
            <div className="w-full lg:w-[60%] order-2 lg:order-1 flex flex-col justify-between pt-6 px-6 pb-6 lg:pt-5 lg:px-8 lg:pb-8 xl:pt-6 xl:px-12 xl:pb-10 relative overflow-hidden bg-gradient-to-br from-[#f2faf7] via-[#e8f5ee] to-[#f4fbf9] border-t lg:border-t-0 lg:border-r border-slate-100/60 lg:h-screen lg:overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[320px] h-[320px] bg-emerald-200/20 rounded-full blur-[90px] pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] bg-emerald-100/25 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute top-[6%] right-[10%] w-24 h-24 bg-[radial-gradient(#00a884_1.5px,transparent_1.5px)] [background-size:10px_10px] opacity-15 pointer-events-none hidden xl:block" />

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

                <div className="relative z-10 flex items-center justify-center lg:justify-start my-10">
                    <img src="/logo11122.png" alt="WatiBot Logo" className="w-[170px] xl:w-[190px] h-auto object-contain mt-[-15px] lg:mt-[-20px] xl:mt-[-25px]" />
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-0 pb-4 mt-[-10px] xl:mt-[-15px] relative z-10 w-full">
                    <div className="col-span-1 lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5 xl:space-y-6">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00a884] text-[10px] font-bold border border-emerald-100/50 shadow-sm w-fit uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                            Secure verification flow
                        </div>

                        <div className="space-y-2.5 flex flex-col items-center lg:items-start">
                            <h1 className="text-3xl xl:text-[38px] font-black text-slate-900 tracking-tight leading-[1.15]">
                                Confirm your account and keep access on <span className="text-[#00a884]">WhatsApp</span>
                            </h1>
                            <p className="text-slate-500 text-[13px] leading-relaxed max-w-sm">
                                Enter the 6-digit code we sent to your registered email or phone number to finish activation.
                            </p>
                        </div>

                        <div className="space-y-6 pt-8 xl:pt-10 w-full">
                            <div className="flex gap-3.5 items-start text-left">
                                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                                    <ShieldCheck className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-[14px]">Verified access only</h3>
                                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">No shortcut bypasses, no dev codes, just the token from your message.</p>
                                </div>
                            </div>

                            <div className="flex gap-3.5 items-start text-left">
                                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                                    <MessageSquare className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-[14px]">WhatsApp or email delivery</h3>
                                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">Use the method chosen during registration to receive your code quickly.</p>
                                </div>
                            </div>

                            <div className="flex gap-3.5 items-start text-left">
                                <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#e6f4ee] flex items-center justify-center text-[#00a884] shadow-sm">
                                    <BarChart3 className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-[14px]">Same dashboard-ready design</h3>
                                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">This screen now matches the login layout instead of a separate debug view.</p>
                                </div>
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-3.5 px-4 py-2 bg-white border border-slate-100 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] w-fit mt-6 xl:mt-8 animate-fade-in select-none">
                            <div className="flex -space-x-2 items-center">
                                <div className="w-[26px] h-[26px] rounded-full bg-[#00a884] text-white text-[8.5px] font-black flex items-center justify-center border-2 border-white relative z-10 shadow-sm">OTP</div>
                                <div className="w-[26px] h-[26px] rounded-full bg-slate-200 border-2 border-white" />
                                <div className="w-[26px] h-[26px] rounded-full bg-slate-300 border-2 border-white" />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 pr-1.5 ml-2.5">
                                Step 2 of 2: <span className="text-[#00a884] font-extrabold">verify and continue</span>
                            </span>
                        </div>
                    </div>

                    <div className="col-span-1 lg:col-span-5 relative flex items-center justify-center h-full min-h-[390px] xl:min-h-[640px] perspective-1000">
                        <div className="absolute w-[440px] h-[440px] rounded-full bg-[#00a884]/12 blur-[8px] pointer-events-none z-0" style={{ transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) translateZ(-40px) translateX(35px) translateY(-30px)" }} />

                        <div className="relative rounded-3xl border border-slate-200/80 overflow-hidden z-10 flex shadow-2xl bg-[#f8fafc]"
                            style={{ width: "380px", height: "540px", minWidth: "380px", minHeight: "540px", transform: "perspective(1200px) rotateY(-30deg) rotateX(10deg) rotateZ(-8deg) translateX(35px) translateY(-30px)", transformStyle: "preserve-3d" }}>
                            <div className="flex-1 flex overflow-hidden bg-[#f8fafc] rounded-3xl">
                                <div className="w-[45px] bg-[#0c1317] flex flex-col items-center py-5 gap-5 flex-shrink-0 rounded-l-3xl border-r border-slate-800/40">
                                    <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm p-1.5 mb-2">
                                        <svg className="w-full h-full fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </div>
                                    <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 flex items-center justify-center text-[#00a884] shadow-sm">
                                        <ShieldCheck className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
                                        <Users className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
                                        <Bot className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
                                        <BarChart3 className="w-4.5 h-4.5" />
                                    </div>
                                </div>

                                <div className="flex-1 bg-[#f4f7f6] flex flex-col overflow-hidden rounded-r-3xl text-left">
                                    <div className="h-8 bg-white border-b border-slate-100 flex items-center px-4 justify-between flex-shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-[#ff5f56]" />
                                            <span className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
                                            <span className="w-2 h-2 rounded-full bg-[#27c93f]" />
                                        </div>
                                        <div className="flex items-center gap-1 bg-[#f1f5f9] px-3 py-1 rounded-full w-[170px] justify-center">
                                            <span className="text-[7.5px] font-black text-slate-400">watibot.com/verify</span>
                                        </div>
                                        <div className="w-2.5 h-2.5 bg-slate-200 rounded-full" />
                                    </div>

                                    <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden justify-between">
                                        <div className="flex justify-between items-center flex-shrink-0 pl-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11.5px] font-black text-slate-800 tracking-tight">Security Gate</span>
                                                <span className="text-[7px] font-black bg-emerald-50 text-[#00a884] border border-emerald-100/50 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Live</span>
                                            </div>
                                            <span className="text-[8px] font-black text-slate-400">OTP required</span>
                                        </div>

                                        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col gap-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-[#00a884]">
                                                    <ShieldAlert className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-800">Verification in progress</p>
                                                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Use the 6 digit code only once</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3 flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-200" />
                                                <div className="w-5 h-5 rounded-full bg-slate-200" />
                                                <div className="w-5 h-5 rounded-full bg-slate-200" />
                                                <div className="w-5 h-5 rounded-full bg-slate-200" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-auto">
                                                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                    <span className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-wider">Email</span>
                                                    <p className="text-[8.5px] font-black text-slate-800 truncate">{email}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                                    <span className="text-[6.5px] font-extrabold text-slate-400 uppercase tracking-wider">Method</span>
                                                    <p className="text-[8.5px] font-black text-slate-800">{method === "phone" ? "WhatsApp" : "Email"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-[40%] order-1 lg:order-2 bg-[#fafbfc] flex flex-col justify-between items-center lg:items-stretch lg:h-screen lg:overflow-hidden p-4 sm:p-6 lg:p-8 relative">
                <div className="flex justify-end w-full relative z-20">
                    <Link href="/login" className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100/90 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer select-none">
                        Return to Sign In
                    </Link>
                </div>

                <div className="mx-auto my-4 lg:mt-8 lg:mb-10 w-full max-w-[500px] bg-white border border-slate-100/90 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-lg shadow-slate-100/40 flex flex-col relative">
                    <div className="flex flex-col items-center text-center">
                        <img src="/logo11122.png" alt="WatiBot Logo" className="w-[155px] h-auto object-contain mx-auto" />
                        <h2 className="text-[20px] font-black text-slate-800 mt-4 tracking-tight">Security Check</h2>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                            Enter the 6-digit code we sent to {method === "phone" && phone ? phone : email}.
                        </p>
                    </div>

                    {success ? (
                        <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center">
                            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mx-auto border border-emerald-100">
                                <CheckCircle className="w-7 h-7 text-emerald-600" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 mt-4">Email verified</h3>
                            <p className="text-[11px] text-slate-500 mt-1">Redirecting you to sign in...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleVerify} className="space-y-4 mt-5">
                            {error && (
                                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-2.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">
                                    Verification code
                                </label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="000 000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    maxLength={6}
                                    required
                                    className="h-16 bg-white border-slate-200 rounded-2xl text-3xl font-black text-slate-900 text-center tracking-[0.4em] pl-[0.4em] focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884] transition-all outline-none shadow-sm"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={code.length !== 6 || isLoading}
                                className="w-full h-14 bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-[#00a884]/20 flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Verify account
                                        <ArrowRight className="w-4.5 h-4.5 transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </Button>

                            <div className="flex flex-col items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={isLoading}
                                    className="text-[10px] font-bold text-[#00a884] uppercase tracking-widest hover:underline disabled:opacity-50"
                                >
                                    Resend verification code
                                </button>

                                <Link href="/login" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                                    Back to sign in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="w-10 h-10 text-[#00a884] animate-spin" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    )
}
