
import React from'react';
import { Sparkles } from'lucide-react';
import { Button } from'@/components/ui/button';

export function AiBanner() {
 return (
 <div className="relative overflow-hidden bg-gradient-to-r from-[#DCFCE7] to-[#F0FDF4] dark:from-[#064E3B] dark:to-[#065F46] rounded-xl p-4 md:px-6 md:py-5 border border-[#86EFAC]/50 dark:border-[#10B981]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
 <div className="flex items-start gap-4">
 <div className="bg-white/50 dark:bg-white/10 p-2 rounded-lg backdrop-blur-sm shrink-0">
 <Sparkles className="w-5 h-5 text-[#15803D] dark:text-[#34D399]" />
 </div>
 <div className="space-y-1">
 <h3 className="font-bold text-[#14532D] dark:text-[#D1FAE5] text-sm md:text-base">
 Introducing AI-powered Magic: Generate Powerful WhatsApp Templates in seconds!
 </h3>
 <p className="text-[#166534] dark:text-[#A7F3D0] text-xs font-medium">
 Smarter. Faster. Zero guesswork.
 </p>
 </div>
 </div>
 <Button size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white border-none shadow-lg shadow-emerald-500/20 font-bold text-xs px-4 h-9 shrink-0">
 <Sparkles className="w-3.5 h-3.5 mr-2" />
 Generate Now
 </Button>
 </div>
 );
}
