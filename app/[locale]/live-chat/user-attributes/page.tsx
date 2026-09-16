"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UserAttributesHelpPage() {
 return (
 <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 p-4 md:p-8">
 <div className="max-w-3xl mx-auto">
 <div className="mb-6">
 <Link href="/live-chat">
 <Button variant="ghost" className="gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
 <ArrowLeft className="w-4 h-4" />
 Back to Live Chat
 </Button>
 </Link>
 </div>

 <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
 <div className="h-32 bg-[#0f3d3e] dark:bg-[#0a2a2b] flex items-center justify-center p-6">
 <h1 className="text-2xl md:text-3xl font-bold text-white text-center">
 How to Add User Attributes Manually?
 </h1>
 </div>
 
 <div className="p-6 md:p-10 space-y-8">
 <div className="space-y-4">
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">1</div>
 <div className="space-y-2">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Open User Profile</h3>
 <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
 Click on the contact name in the chat header to open the profile sidebar on the right.
 </p>
 </div>
 </div>
 
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">2</div>
 <div className="space-y-2">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Navigate to Attributes</h3>
 <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
 Scroll down to the "Attributes" section in the profile sidebar.
 </p>
 <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-8 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-700">
 <p className="text-gray-500 dark:text-gray-400 italic">Screenshot Placeholder</p>
 </div>
 </div>
 </div>

 <div className="flex items-start gap-4">
 <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg shrink-0">3</div>
 <div className="space-y-2">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Attribute</h3>
 <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
 Click the "Add Attribute" button, enter the name and value, and click Save.
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
