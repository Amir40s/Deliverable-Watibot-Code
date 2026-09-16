"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
 MessageCircle, 
 ArrowRight, 
 Plus, 
 Minus,
 MessageSquare,
 Smartphone
} from "lucide-react"

// FAQ Item Component
const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
 const [isOpen, setIsOpen] = useState(false)
 return (
 <div className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300">
 <button 
 onClick={() => setIsOpen(!isOpen)}
 className="w-full flex items-center justify-between p-4 text-left bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
 >
 <span className="font-bold text-gray-800 dark:text-white text-sm">{question}</span>
 {isOpen ? <Minus className="w-4 h-4 text-gray-500" /> : <Plus className="w-4 h-4 text-gray-500" />}
 </button>
 <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}>
 <div className="p-4 pt-0 text-sm text-gray-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
 {answer}
 </div>
 </div>
 </div>
 )
}

export default function WhatsAppButtonPage() {
 const [phone, setPhone] = useState("")
 const [message, setMessage] = useState("Hi! I would like to know more about AiSensy.")
 const [buttonText, setButtonText] = useState("Chat with us")
 const [borderRadius, setBorderRadius] = useState(24)
 
 return (
 <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white">
 {/* Minimal Header */}
 <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
 <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center text-white font-bold text-xl">
 <span className="mb-0.5">Ai</span>
 </div>
 <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">AiSensy</span>
 </div>
 <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-gray-600 dark:text-slate-300">
 <a href="#" className="hover:text-[#10B981] transition-colors">Pricing</a>
 <a href="#" className="hover:text-[#10B981] transition-colors">Platform</a>
 <a href="#" className="hover:text-[#10B981] transition-colors">WhatsApp Link</a>
 <a href="#" className="hover:text-[#10B981] transition-colors">Integration</a>
 </nav>
 <div className="flex items-center gap-4">
 <button className="text-sm font-bold text-gray-600 dark:text-slate-300 hover:text-[#10B981] dark:hover:text-[#10B981]">Sign In</button>
 <Button className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full px-6 font-bold text-xs">
 Get Started
 </Button>
 </div>
 </div>
 </header>

 <main className="pt-24 pb-20">
 
 {/* Hero / Generator Section */}
 <section className="max-w-6xl mx-auto px-6 mb-20">
 <div className="bg-[#F8FAFC] dark:bg-slate-900/50 rounded-[32px] p-8 md:p-12 border border-gray-100 dark:border-slate-800 flex flex-col lg:flex-row gap-12">
 {/* Left: Configuration Form */}
 <div className="flex-1 space-y-8">
 <div>
 <h1 className="text-2xl font-bold text-[#10B981] mb-2 tracking-tight">Free WhatsApp Button Generator by AiSensy</h1>
 <p className="text-gray-500 dark:text-slate-400 text-xs font-medium">Create a custom WhatsApp chat button for your website. Convert website visitors into WhatsApp subscribers instantly.</p>
 </div>

 <div className="space-y-6">
 {/* Configuration Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">Button Text</label>
 <Input 
 value={buttonText} 
 onChange={(e) => setButtonText(e.target.value)}
 className="bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700"
 />
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">WhatsApp Number</label>
 <Input 
 placeholder="e.g. 919876543210"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 className="bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700"
 />
 </div>
 <div className="space-y-2 col-span-2">
 <label className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">Pre-filled Message</label>
 <Input 
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 className="bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700"
 />
 </div>
 
 {/* Styling Options */}
 <div className="space-y-3">
 <label className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">Button Size</label>
 <div className="flex gap-2">
 <div className="h-8 px-4 rounded border bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-white dark:hover:bg-slate-700">Small</div>
 <div className="h-8 px-4 rounded border bg-white dark:bg-emerald-500/10 border-[#10B981] text-[#10B981] text-xs font-bold flex items-center justify-center cursor-pointer shadow-sm">Medium</div>
 <div className="h-8 px-4 rounded border bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-white dark:hover:bg-slate-700">Large</div>
 </div>
 </div>

 <div className="space-y-3">
 <label className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">Position</label>
 <div className="flex gap-2">
 <div className="h-8 px-4 rounded border bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-white dark:hover:bg-slate-700">Left</div>
 <div className="h-8 px-4 rounded border bg-white dark:bg-emerald-500/10 border-[#10B981] text-[#10B981] text-xs font-bold flex items-center justify-center cursor-pointer shadow-sm">Right</div>
 </div>
 </div>
 </div>

 <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-700">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700 dark:text-slate-300">Show Brand Name</span>
 <Switch />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700 dark:text-slate-300">Add Profile Image</span>
 <Switch />
 </div>
 </div>

 <Button className="w-full bg-[#10B981] hover:bg-[#059669] text-white h-12 rounded-xl font-bold text-sm shadow-lg shadow-emerald-100">
 Generate Snippet
 </Button>
 </div>
 </div>

 {/* Right: Preview Area */}
 <div className="lg:w-[400px] shrink-0 bg-white dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-[32px] p-6 flex flex-col items-center justify-center relative min-h-[500px]">
 <span className="absolute top-4 left-4 text-xs font-bold text-gray-400 dark:text-slate-600 uppercase tracking-widest">Live Preview</span>
 
 {/* Fake Website Content */}
 <div className="w-full space-y-4 opacity-10 blur-[1px]">
 <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto" />
 <div className="h-32 bg-gray-100 rounded w-full" />
 <div className="space-y-2">
 <div className="h-4 bg-gray-100 rounded w-full" />
 <div className="h-4 bg-gray-100 rounded w-5/6" />
 <div className="h-4 bg-gray-100 rounded w-4/6" />
 </div>
 </div>

 {/* The Button Preview */}
 <div className="absolute bottom-8 right-8 animate-bounce-slow">
 <div className="flex items-center gap-2 bg-[#00B074] text-white px-5 py-3 rounded-full shadow-lg cursor-pointer hover:scale-105 transition-transform">
 <MessageCircle className="w-5 h-5 fill-current" />
 <span className="font-bold text-sm">{buttonText}</span>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Integration Steps */}
 <section className="bg-[#F0FDF4] dark:bg-emerald-950/20 border border-[#DCFCE7] dark:border-emerald-900/50 py-16 mb-20 rounded-3xl mx-6">
 <div className="max-w-4xl mx-auto px-6">
 <h2 className="text-2xl font-bold text-[#10B981] mb-8 text-center">Simple Steps to Add WhatsApp Button</h2>
 <div className="space-y-4">
 {[
 "Enter your WhatsApp Number & details.",
 "Customize the button appearance to match your brand.",
 "Click'Generate Snippet' to get your code.",
 "Copy & Paste the code into your website's HTML before the closing </body> tag."
 ].map((step, i) => (
 <div key={i} className="flex gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-[#DCFCE7] dark:border-slate-800">
 <div className="w-6 h-6 rounded-full bg-[#10B981] text-white font-bold flex items-center justify-center shrink-0 text-xs">
 {i + 1}
 </div>
 <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{step}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* FAQ Section */}
 <section className="max-w-3xl mx-auto px-6 mb-24">
 <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-8 text-center">WhatsApp Button FAQ's</h2>
 <div className="flex flex-col gap-3">
 <FAQItem question="Q. What is a WhatsApp Button?" answer="A widget on your website that lets visitors chat with you on WhatsApp instantly." />
 <FAQItem question="Q. Is it free?" answer="Yes, the button generator is completely free." />
 <FAQItem question="Q. Can I use it on WordPress/Shopify?" answer="Yes! You just need to paste the generated code into your site's footer." />
 </div>
 </section>

 {/* Footer CTA */}
 <section className="bg-white dark:bg-slate-950 py-20 border-t border-gray-100 dark:border-slate-800 text-center">
 <div className="max-w-xl mx-auto px-6">
 <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Get Started with AiSensy Platform</h2>
 <p className="text-gray-500 mb-8">Drive 3x more sales with WhatsApp Marketing.</p>
 <Button className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full px-8 py-6 text-sm font-bold shadow-xl shadow-emerald-200">
 Get Started Free
 </Button>
 </div>
 </section>

 {/* Simple Footer Links */}
 <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 bg-[#10B981] rounded flex items-center justify-center text-white font-bold text-xs">Ai</div>
 <span className="font-bold text-gray-900 dark:text-white text-sm">AiSensy</span>
 </div>
 <div className="text-xs text-gray-400 dark:text-slate-500">© 2026 AiSensy. All rights reserved.</div>
 </footer>
 </main>
 </div>
 )
}
