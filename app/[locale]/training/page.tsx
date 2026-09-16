"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import Link from "next/link"

export default function TrainingPage() {
 return (
 <div className="min-h-screen bg-white flex items-center justify-center p-8 ">
 <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
 {/* Left Column */}
 <div className="space-y-12">
 {/* Logo Area */}
 <div className="flex items-center gap-2">
 <div className="flex items-center">
 <div className="mr-2">
 {/* Approximate "AiSensy" Logo */}
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
 
 <div className="space-y-6">
 <h2 className="text-[28px] font-bold text-[#1E293B] leading-tight">AiSensy Platform Training Call</h2>
 <div className="space-y-4">
 <p className="text-[#475569] text-lg font-medium">Schedule your Platform Training Call with our team</p>
 <ul className="space-y-3">
 <li className="flex items-center gap-3 text-[#475569] font-medium">
 <span className="w-1.5 h-1.5 rounded-full bg-[#1E293B]" />
 Understand How to Use the Platform
 </li>
 <li className="flex items-center gap-3 text-[#475569] font-medium">
 <span className="w-1.5 h-1.5 rounded-full bg-[#1E293B]" />
 Apply for WhatsApp Business API
 </li>
 </ul>
 </div>
 </div>
 </div>

 {/* Right Column */}
 <div className="bg-white">
 <div className="max-w-md ml-auto mr-auto md:mr-0 space-y-8">
 <p className="text-[#334155] font-semibold leading-relaxed">
 AiSensy offers dashboard onboarding in Hindi & english for your ease.
 Please choose the preferred language from the dropdown
 </p>

 <div className="space-y-8">
 <Select defaultValue="hindi">
 <SelectTrigger className="w-full h-12 border rounded-md border-gray-300 text-gray-700">
 <SelectValue placeholder="Select Language" />
 </SelectTrigger>
 <SelectContent className="bg-white">
 <SelectItem value="hindi">Hindi</SelectItem>
 <SelectItem value="english">English</SelectItem>
 </SelectContent>
 </Select>

 <Button className="w-fit px-12 h-11 bg-[#0061FF] hover:bg-[#0051D4] text-white font-bold rounded-full text-base transition-all shadow-md hover:shadow-lg">
 Submit
 </Button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}
