
import React from'react';
import { BookOpen, PlayCircle } from'lucide-react';

export function QuickGuide() {
 return (
 <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
 <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-2">Quick Guide</h3>
 <p className="text-gray-500 dark:text-gray-400 text-xs mb-6">
 Import contact, create audience & launch campaign, all from one place.
 </p>
 
 <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
 <button className="flex items-center gap-2 text-xs font-bold text-[#0E7490] dark:text-[#22D3EE] hover:underline hover:text-[#0891B2] transition duration-200">
 <BookOpen className="w-4 h-4" />
 Import upto 2 lakh contacts in one go
 </button>
 
 <button className="flex items-center gap-2 text-xs font-bold text-[#0E7490] dark:text-[#22D3EE] hover:underline hover:text-[#0891B2] transition duration-200">
 <PlayCircle className="w-4 h-4" />
 Watch Tutorial
 </button>
 </div>
 </div>
 );
}
