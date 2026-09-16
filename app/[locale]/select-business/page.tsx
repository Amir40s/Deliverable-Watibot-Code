"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, ArrowUpDown, Grip, List, Plus, Star, ExternalLink } from "lucide-react";
import Link from "next/link";

import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";

export default function SelectBusinessPage() {
 const [isCollapsed, setIsCollapsed] = useState(false);
 const toggleSidebar = () => setIsCollapsed((prev) => !prev);

 return (
 <div className="min-h-screen bg-[#F7F8FA]">
 <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
 <Header />
 <main className="main-content-transition p-4 sm:p-8">
 <div className="max-w-7xl mx-auto">
 
 {/* Page Header */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
 <h1 className="text-2xl font-bold text-gray-900">Select your business</h1>
 <Link href="/onboarding">
 <Button className="bg-[#22C55E] hover:bg-green-600 text-white font-semibold">
 <Plus className="w-4 h-4 mr-2" />
 Create new business
 </Button>
 </Link>
 </div>

 {/* Search & Filtering Bar */}
 <div className="flex flex-col md:flex-row gap-4 mb-4">
 <div className="relative flex-1 group">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
 <Input 
 placeholder="Search by name or phone number" 
 style={{ paddingLeft:'2.5rem' }}
 className="bg-white border-gray-200"
 />
 </div>
 <div className="flex gap-2 bg-white rounded-lg p-1 border border-transparent">
 <Button variant="outline" className="bg-white border-gray-200 text-gray-700 font-medium">
 <Filter className="w-4 h-4 mr-2" />
 All businesses
 </Button>
 <Button variant="outline" className="bg-white border-gray-200 text-gray-700 font-medium">
 <ArrowUpDown className="w-4 h-4 mr-2" />
 Sort
 </Button>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="ghost" size="icon" className="bg-white border border-gray-200 text-gray-700 h-10 w-10">
 <Grip className="w-4 h-4" />
 </Button>
 <Button variant="ghost" size="icon" className="text-gray-400 h-10 w-10">
 <List className="w-4 h-4" />
 </Button>
 </div>
 </div>
 
 <p className="text-sm text-gray-500 mb-8">Showing 1 of 1 businesses</p>

 {/* Business Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 
 {/* Business Card */}
 <Card className="border border-gray-200 shadow-sm rounded-xl overflow-hidden bg-white hover:border-gray-300 transition-colors cursor-pointer group">
 <CardContent className="p-6 relative">
 <div className="flex justify-between items-start mb-6">
 <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-600 transition-colors">ht</h3>
 <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
 </div>
 
 <div className="flex justify-between items-end">
 <div className="bg-gray-100 rounded-md px-3 py-1.5 flex items-center gap-2">
 <div className="flex flex-col">
 <span className="text-[10px] text-gray-500 font-medium leading-tight">Not</span>
 <span className="text-[10px] text-gray-500 font-medium leading-tight">Connected</span>
 </div>
 <ExternalLink className="w-3 h-3 text-gray-400" />
 </div>
 <span className="text-[10px] text-gray-400 font-medium">Created 15 Jan 2026</span>
 </div>
 </CardContent>
 </Card>

 </div>

 </div>

 </main>
 </div>
 );
}
