import { useState, useEffect } from "react"
import { Search, RefreshCw, Info, Calendar, ChevronDown, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface FetchedAd {
 id: string;
 name: string;
 status: string;
 daily_budget: number;
 spend: number;
 impressions: number;
 reach: number;
 clicks: number;
}

export default function FetchedAdsTab() {
 const [ads, setAds] = useState<FetchedAd[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('')
 const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['All'])
 const [isStatusOpen, setIsStatusOpen] = useState(false)
 const [statusSearch, setStatusSearch] = useState('')

 const statuses = [
 { id:'all', label:'All' },
 { id:'active', label:'ACTIVE' },
 { id:'paused', label:'PAUSED' },
 { id:'archived', label:'ARCHIVED' },
 ]

 const toggleStatus = (label: string) => {
 if (label ==='All') {
 setSelectedStatuses(['All'])
 } else {
 let newSelected = selectedStatuses.includes('All') ? [] : [...selectedStatuses]
 if (newSelected.includes(label)) {
 newSelected = newSelected.filter(s => s !== label)
 } else {
 newSelected.push(label)
 }
 if (newSelected.length === 0) newSelected = ['All']
 setSelectedStatuses(newSelected)
 }
 }

 const filteredAds = ads.filter(ad => {
 const matchesSearch = ad.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
 ad.id.toLowerCase().includes(searchQuery.toLowerCase())
 const matchesStatus = selectedStatuses.includes('All') || selectedStatuses.includes(ad.status)
 return matchesSearch && matchesStatus
 })

 const fetchAds = async () => {
 try {
 setIsLoading(true);
 setError(null);
 const res = await fetch("/api/ads/fetched");
 const json = await res.json();
 
 if (!res.ok) {
 throw new Error(json.error || "Failed to fetch ads from API");
 }

 setAds(json.data || []);
 } catch (err: any) {
 console.error("Fetch Ads Error:", err);
 setError(err.message);
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 fetchAds();
 }, []);

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('en-IN', {
 style:'currency',
 currency:'INR',
 minimumFractionDigits: 2,
 }).format(amount);
 };

 const totalSpend = filteredAds.reduce((sum, ad) => sum + ad.spend, 0);
 const totalImpressions = filteredAds.reduce((sum, ad) => sum + ad.impressions, 0);
 const totalClicks = filteredAds.reduce((sum, ad) => sum + ad.clicks, 0);
 const averageCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0%";

 const filteredStatusOptions = statuses.filter(s => 
 s.label.toLowerCase().includes(statusSearch.toLowerCase())
 )

 return (
 <div className="flex flex-col gap-6 animate-in fade-in duration-500">
 {/* Toolbar */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full">
 <div className="relative w-full max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <Input 
 placeholder="Search Meta ads..." 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9 h-10 bg-gray-50/50 border-gray-200 text-sm focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-md"
 />
 </div>

 {/* Status Filter */}
 <div className="relative">
 <button 
 onClick={() => setIsStatusOpen(!isStatusOpen)}
 className={cn(
 "h-10 px-5 flex items-center justify-between gap-3 bg-white border text-slate-700 text-[13px] font-semibold rounded-full shadow-sm transition-all hover:border-emerald-500",
 isStatusOpen ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-gray-200"
 )}
 style={{ minWidth:'160px' }}
 >
 <span>{selectedStatuses.length > 1 ?`${selectedStatuses.length} Selected` : (selectedStatuses[0] ||'Select Status')}</span>
 <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isStatusOpen && "rotate-180")} />
 </button>

 {isStatusOpen && (
 <div className="absolute top-12 left-0 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
 <div className="relative mb-2">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
 <Input 
 autoFocus
 placeholder="Search by status"
 value={statusSearch}
 onChange={(e) => setStatusSearch(e.target.value)}
 className="h-9 pl-9 text-xs bg-gray-50 border-none rounded-xl focus-visible:ring-0"
 />
 </div>
 <div className="space-y-0.5 max-h-[250px] overflow-y-auto pr-1">
 {filteredStatusOptions.map((s) => (
 <div 
 key={s.id}
 onClick={() => toggleStatus(s.label)}
 className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer group transition-colors"
 >
 <input 
 type="checkbox"
 readOnly
 checked={selectedStatuses.includes(s.label)}
 className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
 />
 <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-900">
 {s.label}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 
 <div className="flex items-center gap-2 shrink-0">
 <Button 
 variant="outline" 
 onClick={fetchAds}
 disabled={isLoading}
 className="h-10 px-5 text-[13px] font-semibold text-slate-700 gap-2 border-gray-200 hover:bg-gray-50 rounded-full shadow-sm"
 >
 <RefreshCw className={cn("w-4 h-4 text-slate-500", isLoading && "animate-spin")} />
 Sync from Meta
 </Button>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
 <div className="flex items-center gap-1.5 mb-3 text-gray-500">
 <span className="text-xs font-semibold">Total Spend</span>
 <Info className="w-3.5 h-3.5 text-gray-400" />
 </div>
 <div className="text-2xl font-bold text-gray-900">
 {formatCurrency(totalSpend)}
 </div>
 </div>
 <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
 <div className="flex items-center gap-1.5 mb-3 text-gray-500">
 <span className="text-xs font-semibold">Total Impressions</span>
 <Info className="w-3.5 h-3.5 text-gray-400" />
 </div>
 <div className="text-2xl font-bold text-gray-900">
 {totalImpressions.toLocaleString()}
 </div>
 </div>
 <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
 <div className="flex items-center gap-1.5 mb-3 text-gray-500">
 <span className="text-xs font-semibold">Average CTR</span>
 <Info className="w-3.5 h-3.5 text-gray-400" />
 </div>
 <div className="text-2xl font-bold text-gray-900">
 {averageCtr}
 </div>
 </div>
 </div>

 {/* Error State */}
 {error && (
 <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-sm font-medium flex items-center gap-2">
 <XCircle className="w-5 h-5" />
 {error}
 </div>
 )}

 {/* Data Table */}
 <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col min-h-[400px]">
 <div className="overflow-x-auto border-b border-gray-200 items-start align-top">
 <table className="w-full text-left border-collapse min-w-[1000px]">
 <thead>
 <tr className="border-b border-gray-100 dark:border-slate-800 text-[12px] font-semibold text-[#185e49] dark:text-emerald-400 bg-[#f9fafb] dark:bg-slate-800/50">
 <th className="py-3 px-4 first:rounded-tl-lg whitespace-nowrap">Ad Name</th>
 <th className="py-3 px-4 whitespace-nowrap">Status</th>
 <th className="py-3 px-4 whitespace-nowrap">Daily Budget</th>
 <th className="py-3 px-4 whitespace-nowrap">Spend</th>
 <th className="py-3 px-4 whitespace-nowrap">Impressions</th>
 <th className="py-3 px-4 whitespace-nowrap">Reach</th>
 <th className="py-3 px-4 whitespace-nowrap">Clicks</th>
 <th className="py-3 px-4 last:rounded-tr-lg whitespace-nowrap">CTR (%)</th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr>
 <td colSpan={8} className="p-8 text-center text-sm text-gray-500">
 <div className="flex items-center justify-center gap-2">
 <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
 Syncing with Meta...
 </div>
 </td>
 </tr>
 ) : ads.length > 0 ? (
 ads.map((ad) => {
 const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";
 const isActive = ad.status ==='ACTIVE';

 return (
 <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
 <td className="py-3 px-4 text-[13px] font-medium text-gray-900">
 {ad.name}
 <div className="text-[11px] text-gray-400 font-normal mt-0.5">ID: {ad.id}</div>
 </td>
 <td className="py-3 px-4">
 <span className={cn(
 "inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold tracking-wide",
 isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
 )}>
 {ad.status}
 </span>
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600 font-medium">
 {ad.daily_budget ? formatCurrency(ad.daily_budget) : "N/A"}
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600">
 {formatCurrency(ad.spend)}
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600">
 {ad.impressions.toLocaleString()}
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600">
 {ad.reach.toLocaleString()}
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600">
 {ad.clicks.toLocaleString()}
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600 font-medium">
 {ctr}%
 </td>
 </tr>
 );
 })
 ) : (
 <tr>
 <td colSpan={8}>
 <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
 <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
 <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
 </svg>
 </div>
 <h3 className="text-sm font-semibold text-gray-900 mb-1">Connect Meta Account</h3>
 <p className="text-sm text-gray-500 max-w-sm mb-6">No active ads fetched from Meta. Please ensure your Ad Account ID and Access Token are configured.</p>
 <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold">
 Configure Integration
 </Button>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 
 {/* Pagination (Mock format for alignment) */}
 <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-end gap-6 bg-white shrink-0 mt-auto">
 <div className="flex items-center gap-2">
 <span className="text-xs text-gray-500 font-medium">Rows per page:</span>
 <div className="relative">
 <select disabled className="h-8 appearance-none bg-transparent text-xs text-gray-700 font-medium pr-6 cursor-not-allowed focus:outline-none">
 <option>100</option>
 </select>
 <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
 </div>
 </div>
 <span className="text-xs text-gray-500 font-medium tracking-wide">0-{ads.length} of {ads.length}</span>
 </div>
 </div>
 </div>
 )
}
