"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
 MessageSquare, 
 ArrowRight, 
 CheckCircle2, 
 Smartphone, 
 Share2, 
 MessageCircle, 
 Plus, 
 Minus 
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

export default function WhatsAppLinkPage() {
 const [phone, setPhone] = useState("")
 const [message, setMessage] = useState("Hello! I want to know more about AiSensy.")
 
 return (
 <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white">
 {/* Minimal Header for Tool Page */}
 <header className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 z-50">
 <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
 <div className="flex items-center gap-2">
 {/* Using text logo for simplicity or reuse existing if available */}
 <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center text-white font-bold text-xl">
 <span className="mb-0.5">Ai</span>
 </div>
 <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">AiSensy</span>
 </div>
 <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-gray-600 dark:text-slate-300">
 <a href="#" className="hover:text-[#10B981] transition-colors">Pricing</a>
 <a href="#" className="hover:text-[#10B981] transition-colors">Platform</a>
 <a href="#" className="hover:text-[#10B981] transition-colors">WhatsApp Button</a>
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
 
 {/* Hero Section / Generator Tool */}
 <section className="max-w-6xl mx-auto px-6 mb-20">
 <div className="bg-[#F8FAFC] dark:bg-slate-900/50 rounded-[32px] p-8 md:p-12 border border-gray-100 dark:border-slate-800 flex flex-col lg:flex-row gap-12">
 {/* Left: Input Form */}
 <div className="flex-1 space-y-8">
 <div>
 <h1 className="text-3xl font-bold text-[#10B981] mb-2 tracking-tight">Free WhatsApp link generator by AiSensy</h1>
 <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Create quick & simple WhatsApp links to allow customers to start a WhatsApp chat with just one click! Start converting more traffic.</p>
 </div>

 <div className="space-y-6">
 <div className="space-y-2">
 <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">WhatsApp Phone Number</label>
 <p className="text-xs text-gray-400 dark:text-slate-500">Enter your number with country code (without + icon)</p>
 <div className="flex gap-4">
 <select className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 dark:text-white w-24">
 <option>India</option>
 {/* Add more if needed */}
 </select>
 <Input 
 placeholder="+91 1234567890" 
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 h-12 rounded-xl text-base text-gray-900 dark:text-white"
 />
 </div>
 </div>

 <div className="space-y-2">
 <div className="flex items-center gap-2">
 <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">Custom Message</label>
 <span className="text-lg">😉</span>
 </div>
 <p className="text-xs text-gray-400 dark:text-slate-500">This text will be shown when user clicks on your link & opens WhatsApp</p>
 <Textarea 
 placeholder="Hello! I want to know more about your services." 
 value={message}
 onChange={(e) => setMessage(e.target.value)}
 className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 min-h-[120px] rounded-xl text-sm resize-none p-4 text-gray-900 dark:text-white"
 />
 </div>

 <Button className="w-full md:w-auto bg-[#10B981] hover:bg-[#059669] text-white h-12 px-8 rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 transition-all hover:scale-105">
 Generate WhatsApp Link
 </Button>
 </div>
 </div>

 {/* Right: Phone Preview */}
 <div className="lg:w-[320px] shrink-0 flex justify-center lg:justify-end">
 <div className="relative w-[280px] h-[580px] bg-white border-[8px] border-gray-100 rounded-[40px] shadow-2xl overflow-hidden">
 {/* Notch */}
 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-100 rounded-b-xl z-20"></div>
 
 {/* Screen Content */}
 <div className="w-full h-full bg-[#E5DDD5] flex flex-col">
 {/* WA Header */}
 <div className="h-16 bg-[#00B074] flex items-center px-4 pt-4 gap-3">
 <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden">
 <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-bold">404</div>
 </div>
 <div className="text-white text-sm font-bold">AiSensy</div>
 </div>
 
 {/* Chat Body */}
 <div className="flex-1 p-4 flex flex-col justify-end pb-20">
 <div className="bg-[#DCF8C6] p-3 rounded-lg rounded-tr-none shadow-sm self-end max-w-[85%]">
 <p className="text-sm text-gray-800 leading-relaxed">{message || "Your message preview..."}</p>
 <div className="text-[10px] text-gray-500 text-right mt-1">12:30 PM</div>
 </div>
 </div>

 {/* WA Footer */}
 <div className="absolute bottom-4 left-2 right-2 h-10 bg-white rounded-full flex items-center px-4 justify-between shadow-sm">
 <span className="text-gray-400 text-xs">Type a message</span>
 <ArrowRight className="w-4 h-4 text-gray-400" />
 </div>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Steps Section */}
 <section className="bg-[#F0FDF4] dark:bg-emerald-950/20 py-16 mb-20 rounded-3xl mx-6 border border-[#DCFCE7] dark:border-emerald-900/50">
 <div className="max-w-4xl mx-auto px-6">
 <h2 className="text-2xl font-bold text-[#10B981] mb-8 text-center">3 Steps to Create WhatsApp Link for your Business</h2>
 <div className="space-y-6">
 {[
 { title: "1. Enter your WhatsApp Number", desc: "Select your country code from the list and fill in your WhatsApp number where you wish to receive messages." },
 { title: "2. Add a Custom Message", desc: "Write a predefined hello message for users that shows up when a WhatsApp user clicks on your link. For example,'Hey, I had a query!'" },
 { title: "3. Generate your WhatsApp Link", desc: "Finally, hit the'Generate Link' button. Voila! A shareable link generated which you can copy and share on various platforms like Instagram, Facebook, Emails etc." }
 ].map((step, i) => (
 <div key={i} className="flex gap-4">
 <div className="w-8 h-8 rounded-full bg-white border-2 border-[#10B981] text-[#10B981] font-bold flex items-center justify-center shrink-0 shadow-sm">
 {i + 1}
 </div>
 <div>
 <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{step.title}</h3>
 <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Benefits Section */}
 <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm py-12 mb-20 rounded-3xl mx-6">
 <div className="max-w-4xl mx-auto px-6">
 <h2 className="text-2xl font-bold text-[#10B981] mb-8">Benefits of sharing WhatsApp Link</h2>
 <ul className="space-y-3">
 {[
 "Connect with users directly on WhatsApp with ease.",
 "Users won't have to save your contact info on their phone to start a conversation.",
 "Get people engaged in real-time communication, and provide customer support on WhatsApp.",
 "Encourage users to save your contact, allowing for better re-marketing opportunities."
 ].map((item, i) => (
 <li key={i} className="flex items-start gap-3">
 <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
 <span className="text-sm text-gray-600 dark:text-slate-400 font-medium leading-relaxed">{item}</span>
 </li>
 ))}
 </ul>
 </div>
 </section>

 {/* How to Use / FAQ Grid */}
 <section className="max-w-6xl mx-auto px-6 mb-20 grid md:grid-cols-2 gap-12">
 {/* How to Use Section */}
 <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-8 rounded-[32px]">
 <h2 className="text-xl font-bold text-[#10B981] mb-6">How to Use WhatsApp Link?</h2>
 <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 font-medium">There are multiple use cases of a WhatsApp Link. Here are a few creative ways you can use your WhatsApp Link to drive leads to WhatsApp.</p>
 <ul className="space-y-4">
 {[
 { title: "Add WhatsApp Link to your Social Media Bio", desc: "Adding your link to bio helps connect with potential leads directly." },
 { title: "Add WhatsApp Link to your Instagram Story", desc: "Use the link sticker feature to add your WhatsApp link." },
 { title: "Share WhatsApp Link on Facebook", desc: "Add button to posts or page so users can easily click to chat." },
 { title: "Share WhatsApp Link on Twitter", desc: "Insert your link in tweets to reach users interested in your niche." },
 { title: "Add the Link to YouTube Video Descriptions", desc: "Add link in description for easy contact while watching videos." }
 ].map((item, i) => (
 <li key={i} className="text-sm">
 <span className="font-bold text-gray-800 dark:text-slate-200 block mb-1">• {item.title}</span>
 <span className="text-gray-500 dark:text-slate-500 block pl-3 text-xs leading-relaxed">{item.desc}</span>
 </li>
 ))}
 </ul>
 </div>

 {/* FAQ Section */}
 <div>
 <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">WhatsApp Link FAQ's</h2>
 <div className="flex flex-col gap-3">
 <FAQItem question="Q. What is a WhatsApp Link?" answer="A WhatsApp link (wa.me link) allows users to start a chat with you without saving your phone number." />
 <FAQItem question="Q. How to create WhatsApp Link on Instagram?" answer="Generate your link here, copy it, and paste it into your Instagram profile bio or stories." />
 <FAQItem question="Q. How to create WhatsApp Link on iPhone?" answer="The process is the same! Just use this generator on your iPhone browser." />
 <FAQItem question="Q. What do you need to pay to create a WhatsApp Link?" answer="Nothing! This tool is 100% free to use." />
 <FAQItem question="Q. Where can I use the WhatsApp Link?" answer="Anywhere! Instagram, Facebook, Twitter, Email signatures, YouTube descriptions, and more." />
 </div>
 </div>
 </section>

 {/* Related Resources */}
 <section className="max-w-6xl mx-auto px-6 mb-24">
 <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Related Resources</h2>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {[
 { title: "How to create FREE WhatsApp QR Code for your Business", img: "/images/dashboard/refer_money_bag.png" }, // Reusing existing assets as placeholders
 { title: "3 FREE Strategies to add WhatsApp to your Website", img: "/images/dashboard/wa_widget.png" },
 { title: "Top 12 FREE WhatsApp Marketing Tools", img: "/images/dashboard/affiliate_magnet.png" }
 ].map((card, i) => (
 <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer">
 <div className="h-40 bg-[#F0FDF4] dark:bg-emerald-950/20 flex items-center justify-center p-6 relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/10 to-transparent" />
 <img src={card.img} className="h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" alt="Resource" />
 </div>
 <div className="p-6">
 <h3 className="font-bold text-gray-800 dark:text-white text-sm group-hover:text-[#10B981] transition-colors line-clamp-2">{card.title}</h3>
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* Footer CTA */}
 <section className="bg-white dark:bg-slate-950 py-20 border-t border-gray-100 dark:border-slate-800 text-center relative overflow-hidden">
 <div className="max-w-xl mx-auto px-6 relative z-10">
 <h2 className="text-3xl font-bold text-gray-900 mb-4">Get Started with AiSensy Platform</h2>
 <p className="text-gray-500 mb-8 max-w-md mx-auto">World's Smartest WhatsApp Engagement Platform. Install & Grow with 2x Rate.</p>
 <Button className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full px-8 py-6 text-sm font-bold shadow-xl shadow-emerald-200">
 Get Started Free
 </Button>
 </div>
 {/* Decorative Elements */}
 <div className="absolute top-1/2 -translate-y-1/2 left-20 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-50" />
 <div className="absolute top-1/2 -translate-y-1/2 right-20 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50" />
 </section>
 
 {/* Simple Footer Links */}
 <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-8">
 <div>
 <div className="flex items-center gap-2 mb-6">
 <div className="w-6 h-6 bg-[#10B981] rounded flex items-center justify-center text-white font-bold text-xs">Ai</div>
 <span className="font-bold text-gray-900 dark:text-white">AiSensy</span>
 </div>
 <p className="text-xs text-gray-500 dark:text-slate-500">Best WhatsApp Engagement Platform</p>
 </div>
 {[
 { header: "Platform", links: ["Features", "Use Cases", "Pricing", "FAQs"] },
 { header: "Resources", links: ["Learning Hub", "WhatsApp Business API", "Case Studies", "Developers"] },
 { header: "Connect", links: ["Contact Us", "Partner Program", "Careers", "Social Media"] }
 ].map((col, i) => (
 <div key={i}>
 <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm">{col.header}</h4>
 <ul className="space-y-2">
 {col.links.map((link, j) => (
 <li key={j} className="text-xs text-gray-500 dark:text-slate-500 hover:text-[#10B981] dark:hover:text-[#10B981] cursor-pointer">{link}</li>
 ))}
 </ul>
 </div>
 ))}
 </footer>

 </main>
 </div>
 )
}
