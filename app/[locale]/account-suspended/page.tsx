"use client"

import React, { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { ShieldAlert, LogOut, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AccountSuspendedPage() {
    const [phone, setPhone] = useState("+92 329 1486545")

    useEffect(() => {
        fetch("/api/admin/configurations/general")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const num = data?.supportPhone || data?.whatsappNumber
                if (num && typeof num === 'string' && num.trim().length > 0) {
                    setPhone(num.trim())
                }
            })
            .catch(() => null)
    }, [])

    const cleanDigits = phone.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/${cleanDigits || "923291486545"}?text=Hello%20WatiBot%20Support%2C%20my%20account%20is%20suspended`

    return (
        <div className="min-h-screen w-full bg-[#fafbfc] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 antialiased plus-jakarta-forced">
            {/* Header */}
            <header className="w-full max-w-5xl flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                    <img src="/logo11122.png" alt="WatiBot Logo" className="w-[155px] h-auto object-contain" />
                </div>

                <Button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    variant="outline"
                    className="bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    <span>Sign Out</span>
                </Button>
            </header>

            {/* Main Content Card */}
            <main className="w-full max-w-[480px] my-auto py-6">
                <div className="bg-white border border-slate-100/90 rounded-3xl p-6 sm:p-8 md:p-10 shadow-lg shadow-slate-100/50 text-center space-y-6">
                    
                    {/* Illustration / Icon Badge */}
                    <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-sm mx-auto">
                        <ShieldAlert className="w-8 h-8" />
                    </div>

                    {/* Titles */}
                    <div className="space-y-2">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                            Account Suspended
                        </h1>
                        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
                            Your account access has been restricted. If you believe this is an error or require assistance, please contact our support team on WhatsApp.
                        </p>
                    </div>

                    {/* WhatsApp Support Info Badge */}
                    <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5 flex items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0 font-bold">
                                <MessageSquare className="w-4.5 h-4.5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Support</span>
                                <span className="text-xs font-extrabold text-slate-700">{phone}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-5 py-3 rounded-xl text-xs transition-all shadow-md shadow-rose-100/50 active:scale-[0.98]"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span>Contact on WhatsApp</span>
                        </a>

                        <Button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            variant="outline"
                            className="w-full sm:w-auto bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl px-5 py-3 h-auto active:scale-[0.98] shadow-sm"
                        >
                            <LogOut className="w-4 h-4 text-slate-400" />
                            <span>Sign Out</span>
                        </Button>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full max-w-5xl text-center text-xs font-bold text-slate-400 py-4">
                <p>&copy; {new Date().getFullYear()} WatiBot. All rights reserved. Secure Cloud Authentication.</p>
            </footer>
        </div>
    )
}
