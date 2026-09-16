import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export function MobileAppCard() {
 return (
 <div className="aesthetic-glass rounded-[2.5rem] p-8 h-full flex flex-col items-center">
 <h3 className="text-2xl font-bold text-white mb-8 text-center leading-tight tracking-tight">
 Get the<br />Mobile Suite
 </h3>

 <div className="flex flex-col items-center justify-center gap-6 mb-10 w-full">
 {/* QR Code */}
 <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm shrink-0">
 <Image
 src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Example"
 alt="QR Code"
 width={120}
 height={120}
 className="w-28 h-28"
 />
 </div>

 {/* Store Buttons */}
 <div className="flex flex-col gap-3">
 <button className="bg-black text-white rounded-xl px-4 py-2 flex items-center gap-3 hover:opacity-90 transition-opacity w-[160px]">
 <div className="shrink-0">
 <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
 <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.45-1.02 3.93-.72 1.35.26 2.5.86 2.95 2.08-2.6 1.34-2.17 6.13.43 7.31-.5 1.48-1.27 2.65-2.39 3.56zm-1.73-14.5c.61-.75.98-1.81.98-2.88 0-.15 0-.3-.02-.45-1 .04-2.19.67-2.9 1.5-.56.64-.99 1.68-.99 2.72 0 .14.02.29.04.43.99.07 2.27-.58 2.89-1.32z"/>
 </svg>
 </div>
 <div className="flex flex-col items-start leading-none gap-0.5">
 <span className="text-[9px] font-medium text-white/80">Download on the</span>
 <span className="text-sm font-bold">App Store</span>
 </div>
 </button>
 <button className="bg-black text-white rounded-xl px-4 py-2 flex items-center gap-3 hover:opacity-90 transition-opacity w-[160px]">
 <div className="shrink-0">
 <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
 <path d="M4.53 1.93L19.58 11.23C20.18 11.61 20.18 12.39 19.58 12.77L4.53 22.07C3.92 22.45 3.08 21.98 3.08 21.2V2.8C3.08 2.02 3.92 1.55 4.53 1.93ZM5.58 4.2V19.8L17.78 12L5.58 4.2Z"/>
 </svg>
 </div>
 <div className="flex flex-col items-start leading-none gap-0.5">
 <span className="text-[9px] font-medium text-white/80">Get it on</span>
 <span className="text-sm font-bold">Google Play</span>
 </div>
 </button>
 </div>
 </div>

 <div className="relative mb-8 w-full">
 <div className="absolute inset-0 flex items-center" aria-hidden="true">
 <div className="w-full border-t border-gray-200 dark:border-gray-700" />
 </div>
 <div className="relative flex justify-center">
 <span className="bg-white dark:bg-slate-800 px-4 text-lg text-slate-500 font-serif italic">
 Key Features
 </span>
 </div>
 </div>

 <div className="flex flex-col gap-3 w-full px-6">
 {[
 "Real-time notifications",
 "Live Chat",
 "Ads Management",
 "Analytics Dashboard"
 ].map((feature) => (
 <div key={feature} className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
 <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{feature}</span>
 </div>
 ))}
 </div>
 </div>
 )
}

