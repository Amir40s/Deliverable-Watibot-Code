"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import { Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function AffiliatePage() {
 const [showPassword, setShowPassword] = useState(false)
 const [showConfirmPassword, setShowConfirmPassword] = useState(false)

 return (
 <div className="min-h-screen bg-white flex ">
 {/* Left Column - Teal/Greenish Background */}
 <div className="hidden lg:flex w-1/2 bg-[#D1EDE8] flex-col justify-between p-16 relative overflow-hidden">
 <div className="space-y-12 z-10">
 {/* Logo Area */}
 <div className="flex items-center gap-2">
 <div className="flex items-center">
 <div className="mr-2">
 {/* "AiSensy" Logo - Reused from Training Page */}
 <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
 <path d="M24 0C10.745 0 0 10.745 0 24s10.745 24 24 24 24-10.745 24-24S37.255 0 24 0zm-2 35l-5-5 1.41-1.41L22 32.17l10.59-10.59L34 23l-12 12z" fill="#22C55E"/>
 <path d="M10 16h16v4H10z" fill="#374151"/>
 <path d="M10 24h10v4H10z" fill="#374151"/>
 <path d="M10 32h6v4H10z" fill="#374151"/>
 </svg>
 </div>
 <span className="text-4xl font-bold text-[#374151]">AiSensy</span>
 </div>
 </div>

 <div className="space-y-4">
 <h1 className="text-[40px] font-bold text-[#374151] leading-tight">AiSensy Affiliate Dashboard</h1>
 <p className="text-[#374151] text-lg font-medium">Start with 20% commission and Grow More !!!</p>
 </div>
 </div>

 {/* Illustration Area */}
 <div className="relative flex-1 flex items-center justify-center z-10">
 {/* Using the found image or a fallback if not perfect, but'affiliate_magnet' sounds appropriate */}
 <img 
 src="/images/dashboard/affiliate_magnet.png" 
 alt="Affiliate Partnership" 
 className="max-w-[80%] max-h-[400px] object-contain"
 />
 </div>

 {/* Footer Text */}
 <div className="text-center z-10 pt-8">
 <p className="text-[#374151] font-bold text-lg">Trusted by 50000 + Brands</p>
 </div>
 </div>

 {/* Right Column - Form */}
 <div className="w-full lg:w-1/2 bg-white p-8 md:p-16 flex flex-col justify-center relative">
 <div className="absolute top-8 right-8 text-sm">
 Already a member ? <Link href="#" className="text-[#10B981] font-bold hover:underline">Log in</Link>
 </div>

 <div className="max-w-md mx-auto w-full space-y-8">
 <div className="text-center space-y-2">
 <h2 className="text-[32px] font-medium text-[#374151]">Create Your AiSensy Affiliate Account</h2>
 <p className="text-[#6B7280]">Fill in the details below to complete your signup.</p>
 </div>

 <div className="space-y-5">
 <Input 
 placeholder="Name" 
 className="h-12 border-[#9CA3AF] rounded-md text-[15px] placeholder:text-[#9CA3AF]"
 />

 <Input 
 placeholder="Company Name" 
 className="h-12 border-[#9CA3AF] rounded-md text-[15px] placeholder:text-[#9CA3AF]"
 />

 <div className="flex gap-2">
 <Select defaultValue="+91">
 <SelectTrigger className="w-[100px] h-12 border-[#9CA3AF] rounded-md text-[#374151]">
 <div className="flex items-center gap-2">
 {/* Simple Flag Placeholder */}
 <span className="text-lg">🇮🇳</span>
 <SelectValue placeholder="+91" />
 </div>
 </SelectTrigger>
 <SelectContent className="bg-white">
 <SelectItem value="+91">🇮🇳 +91</SelectItem>
 <SelectItem value="+1">🇺🇸 +1</SelectItem>
 </SelectContent>
 </Select>
 <Input 
 placeholder="Mobile Number" 
 className="h-12 border-[#9CA3AF] rounded-md text-[15px] placeholder:text-[#9CA3AF] flex-1"
 />
 </div>

 <Input 
 placeholder="Email" 
 type="email"
 className="h-12 border-[#9CA3AF] rounded-md text-[15px] placeholder:text-[#9CA3AF]"
 />

 <div className="relative">
 <Input 
 placeholder="Login Password" 
 type={showPassword ? "text" : "password"}
 className="h-12 border-[#9CA3AF] rounded-md text-[15px] placeholder:text-[#9CA3AF] pr-10"
 />
 <button 
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
 >
 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>

 <div className="relative">
 <Input 
 placeholder="Confirm Password" 
 type={showConfirmPassword ? "text" : "password"}
 className="h-12 border-[#9CA3AF] rounded-md text-[15px] placeholder:text-[#9CA3AF] pr-10"
 />
 <button 
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
 >
 {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 </div>

 <Button className="w-full h-12 bg-[#D1D5DB] hover:bg-[#9CA3AF] text-[#374151] font-medium text-lg rounded-md mt-4 shadow-none">
 Next
 </Button>
 </div>
 </div>
 </div>
 )
}
