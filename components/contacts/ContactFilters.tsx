"use client"
import { useTranslations } from 'next-intl';
import { Search, ChevronDown, Trash2, User, Phone, Tag, Globe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"

export default function ContactFilters() {
  const t = useTranslations('Contacts');

 return (
 <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-[24px] border border-white/50 dark:border-slate-800 p-6 shadow-sm space-y-6">
 <div className="flex items-center gap-2.5 mb-1">
 <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
 <Search className="w-3.5 h-3.5 text-purple-600" />
 </div>
 <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Advanced Filtering</h3>
 </div>

 {/* Filter Inputs Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { placeholder: "Filter by name", icon: User },
 { placeholder: "Filter by phone", icon: Phone },
 { placeholder: "Filter by tags", icon: Tag },
 { placeholder: "Search Country", icon: Globe }
 ].map((input, idx) => (
 <div key={idx} className="relative group">
 <Input 
 type="text" 
 placeholder={input.placeholder} 
 style={{ paddingLeft:'2.75rem' }}
 className="h-10 bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 rounded-xl pr-4 font-bold text-xs focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400" 
 />
 <input.icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-all" />
 </div>
 ))}
 </div>

 {/* Filter Controls Row */}
 <div className="flex flex-wrap items-center gap-4">
 <Select>
 <SelectTrigger className="w-[180px] h-10 bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 rounded-xl font-bold text-xs">
 <SelectValue placeholder="Status: All" />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="inactive">Inactive</SelectItem>
 </SelectContent>
 </Select>

 <Select>
 <SelectTrigger className="w-[180px] h-10 bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 rounded-xl font-bold text-xs">
 <SelectValue placeholder="Meta Filters" />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
 <SelectItem value="none">None</SelectItem>
 <SelectItem value="meta1">Meta 1</SelectItem>
 </SelectContent>
 </Select>

 <div className="flex items-center gap-2.5 px-3.5 h-10 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-white/5">
 <button className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative transition-colors focus:outline-none">
 <span className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform"></span>
 </button>
 <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">All Leads</span>
 </div>

 <div className="flex items-center gap-2.5 px-3.5 h-10 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-white/5">
 <button className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative transition-colors focus:outline-none">
 <span className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform"></span>
 </button>
 <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Opted Out</span>
 </div>
 </div>

 <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/20 dark:border-white/5">
 <Button variant="ghost" className="h-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2 font-bold uppercase text-[9px] tracking-widest px-3 rounded-lg">
 <Trash2 className="w-3.5 h-3.5" />
 Clear Advanced Filters
 </Button>
 
 <Select>
 <SelectTrigger className="w-[160px] h-9 bg-slate-100/50 dark:bg-slate-800/50 border-transparent rounded-lg font-bold text-[9px] uppercase tracking-widest">
 <SelectValue placeholder="Table Columns" />
 </SelectTrigger>
 <SelectContent className="rounded-lg">
 <SelectItem value="default">Default View</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 )
}
