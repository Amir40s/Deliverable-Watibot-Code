"use client"
import { useState, useRef, useEffect } from "react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import FetchedAdsTab from "@/components/dashboard/ads/FetchedAdsTab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { 
 Search, 
 RefreshCw, 
 Download, 
 Settings, 
 Columns, 
 Plus,
 Info,
 Calendar,
 ChevronDown,
 Check
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdsManagerPage() {
 const [activeTab, setActiveTab] = useState<'aisensy' |'fetched'>('aisensy');
 const [isStatusOpen, setIsStatusOpen] = useState(false)
 const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Active'])
 const [statusSearch, setStatusSearch] = useState('')
 const [searchQuery, setSearchQuery] = useState('')
 const statusRef = useRef<HTMLDivElement>(null)

 const statuses = [
 { id:'all', label:'All' },
 { id:'active', label:'Active' },
 { id:'paused', label:'Paused' },
 { id:'draft', label:'Draft' },
 ]

 const mockAds = [
 { id:'1', name:'Summer Campaign 2024', status:'Active', type:'Image', budget:'₹ 500.00', impressions:'12,450', reach:'8,200', clicks:'450', ctr:'3.6', spend:'₹ 1,200', cpc:'₹ 2.6', cpm:'₹ 96.3', startDate:'12 Mar 2026' },
 { id:'2', name:'Product Launch X', status:'Paused', type:'Video', budget:'₹ 1,200.00', impressions:'45,000', reach:'32,000', clicks:'890', ctr:'1.9', spend:'₹ 4,500', cpc:'₹ 5.0', cpm:'₹ 100.0', startDate:'05 Mar 2026' },
 { id:'3', name:'Waitbot Promo', status:'Draft', type:'Carousel', budget:'₹ 200.00', impressions:'0', reach:'0', clicks:'0', ctr:'0.0', spend:'₹ 0', cpc:'₹ 0', cpm:'₹ 0', startDate:'Pending' },
 ]

 const filteredStatuses = statuses.filter(s => 
 s.label.toLowerCase().includes(statusSearch.toLowerCase())
 )

 const filteredAds = mockAds.filter(ad => {
 const matchesSearch = ad.name.toLowerCase().includes(searchQuery.toLowerCase())
 const matchesStatus = selectedStatuses.includes('All') || selectedStatuses.includes(ad.status)
 return matchesSearch && matchesStatus
 })

 useEffect(() => {
 function handleClickOutside(event: MouseEvent) {
 if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
 setIsStatusOpen(false)
 }
 }
 document.addEventListener("mousedown", handleClickOutside)
 return () => document.removeEventListener("mousedown", handleClickOutside)
 }, [])

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

 const kpis = [
 { label: "Number of Leads", value: "0" },
 { label: "Click-Through Rate", value: "0%" },
 { label: "Cost Per Lead", value: "₹ 0" },
 { label: "Total Spend", value: "₹ 0" },
 { label: "Total CAPI Signals", value: "0" },
 ];

 const columns = [
 "Actions",
 "Ad Name",
 "Start Date",
 "Status",
 "Ad Type",
 "Daily Budget",
 "Impressions",
 "Reach",
 "Clicks",
 "CTR (%)",
 "Spend",
 "CPC",
 "CPM"
 ];

 return (
 <DashboardLayoutClient mainClassName="bg-white dark:bg-slate-950 min-h-screen">
 <div className="w-full flex-1 flex flex-col pt-4">
 
 {/* Header */}
 <div className="px-8 pb-4 flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 dark:border-slate-800 gap-4">
 <h1 className="text-xl font-medium text-slate-800 dark:text-white">Ads Manager</h1>
 
 <div className="flex items-center gap-3">
 <Button disabled className="h-9 px-4 text-xs font-semibold bg-gray-100 text-gray-400 cursor-not-allowed rounded-md border-none flex items-center gap-2">
 <Plus className="w-4 h-4" />
 Create Ad
 </Button>
 </div>
 </div>

 {/* Main Content Area */}
 <div className="p-8 pb-20">
 
 {/* Tabs */}
 <div className="flex items-center gap-8 border-b border-gray-200 dark:border-slate-800 mb-6">
 <button 
 onClick={() => setActiveTab('aisensy')}
 className={cn(
 "pb-3 text-[13px] font-semibold transition-colors relative",
 activeTab ==='aisensy' ? "text-[#10b981]" : "text-gray-500 hover:text-gray-700"
 )}
 >
 Watibot Ads Manager
 {activeTab ==='aisensy' && (
 <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#10b981]" />
 )}
 </button>
 <button 
 onClick={() => setActiveTab('fetched')}
 className={cn(
 "pb-3 text-[13px] font-semibold transition-colors relative",
 activeTab ==='fetched' ? "text-[#10b981]" : "text-gray-500 hover:text-gray-700"
 )}
 >
 Fetched Ads
 {activeTab ==='fetched' && (
 <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#10b981]" />
 )}
 </button>
 </div>

 {activeTab ==='aisensy' ? (
 <>
 {/* Toolbar */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
 <div className="relative w-full max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <Input 
 placeholder="Search by Ad name" 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9 h-10 bg-gray-50/50 border-gray-200 text-sm focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-md"
 />
 </div>
 
 <div className="flex items-center gap-2">
 <Button variant="outline" className="h-10 px-5 text-[13px] font-semibold text-slate-700 gap-2 border-gray-200 hover:bg-gray-50 rounded-full shadow-sm">
 <RefreshCw className="w-4 h-4 text-slate-500" />
 Sync
 </Button>
 <Button variant="outline" className="h-10 px-5 text-[13px] font-semibold text-slate-700 gap-2 border-gray-200 hover:bg-gray-50 rounded-full shadow-sm">
 <Download className="w-4 h-4 text-slate-500" />
 Download Report
 </Button>
 </div>
 </div>

 {/* Filters & Customization */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
 <div className="flex items-center gap-3">
 <div className="relative" ref={statusRef}>
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
 <div className="absolute top-12 left-0 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
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
 {filteredStatuses.map((s) => (
 <div 
 key={s.id}
 onClick={() => toggleStatus(s.label)}
 className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer group transition-colors"
 >
 <Checkbox 
 checked={selectedStatuses.includes(s.label)}
 onCheckedChange={() => toggleStatus(s.label)}
 className="border-gray-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
 />
 <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
 {s.label}
 </span>
 </div>
 ))}
 {filteredStatuses.length === 0 && (
 <div className="py-8 text-center text-xs text-slate-400 font-medium">No results found</div>
 )}
 </div>
 </div>
 )}
 </div>
 
 <div className="relative">
 <button className="h-10 px-5 flex items-center gap-2 bg-gray-50/80 hover:bg-gray-100 border border-gray-200 text-slate-700 text-[13px] font-semibold rounded-full transition-colors shadow-sm">
 <Calendar className="w-4 h-4 text-slate-500" />
 Last 30 days: 18 Mar 2026 - 16 Apr 2026
 <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
 </button>
 </div>
 </div>


 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
 {kpis.map((kpi, idx) => (
 <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
 <div className="flex items-center gap-1.5 mb-3 text-gray-500">
 <span className="text-xs font-semibold">{kpi.label}</span>
 <Info className="w-3.5 h-3.5 text-gray-400" />
 </div>
 <div className="text-2xl font-bold text-gray-900">
 {kpi.value}
 </div>
 </div>
 ))}
 </div>

 {/* Data Table */}
 <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col min-h-[400px]">
 <div className="overflow-x-auto border-b border-gray-200 items-start align-top">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="border-b border-gray-100 dark:border-slate-800 text-[12px] font-semibold text-[#185e49] dark:text-emerald-400 bg-[#f9fafb] dark:bg-slate-800/50">
 <th className="py-3 px-4 first:rounded-tl-lg whitespace-nowrap">Actions</th>
 <th className="py-3 px-4 whitespace-nowrap">Ad Name</th>
 <th className="py-3 px-4 whitespace-nowrap">Start Date</th>
 <th className="py-3 px-4 whitespace-nowrap">Status</th>
 <th className="py-3 px-4 whitespace-nowrap">Ad Type</th>
 <th className="py-3 px-4 whitespace-nowrap">Daily Budget</th>
 <th className="py-3 px-4 whitespace-nowrap">Impressions</th>
 <th className="py-3 px-4 whitespace-nowrap">Reach</th>
 <th className="py-3 px-4 whitespace-nowrap">Clicks</th>
 <th className="py-3 px-4 whitespace-nowrap">CTR (%)</th>
 <th className="py-3 px-4 whitespace-nowrap">Spend</th>
 <th className="py-3 px-4 whitespace-nowrap">CPC</th>
 <th className="py-3 px-4 last:rounded-tr-lg whitespace-nowrap">CPM</th>
 </tr>
 </thead>
 <tbody>
 {filteredAds.length > 0 ? (
 filteredAds.map((ad) => (
 <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
 <td className="py-3 px-4">
 <div className="flex items-center gap-2">
 <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-emerald-500">
 <Settings className="h-4 w-4" />
 </Button>
 </div>
 </td>
 <td className="py-3 px-4 text-[13px] font-medium text-gray-900">{ad.name}</td>
 <td className="py-3 px-4 text-[13px] text-gray-500">{ad.startDate}</td>
 <td className="py-3 px-4">
 <span className={cn(
 "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
 ad.status ==='Active' ? "bg-emerald-100 text-emerald-800" : 
 ad.status ==='Paused' ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-600"
 )}>
 {ad.status}
 </span>
 </td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.type}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600 font-medium">{ad.budget}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.impressions}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.reach}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.clicks}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.ctr}%</td>
 <td className="py-3 px-4 text-[13px] text-gray-600 font-medium">{ad.spend}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.cpc}</td>
 <td className="py-3 px-4 text-[13px] text-gray-600">{ad.cpm}</td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan={13} className="py-20 text-center">
 <p className="text-sm font-medium text-gray-400">No data found matching your search</p>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 
 {/* Pagination */}
 <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-end gap-6 bg-white shrink-0">
 <div className="flex items-center gap-2">
 <span className="text-xs text-gray-500 font-medium">Rows per page:</span>
 <div className="relative">
 <select className="h-8 appearance-none bg-transparent text-xs text-gray-700 font-medium pr-6 cursor-pointer focus:outline-none">
 <option>10</option>
 <option>20</option>
 <option>50</option>
 </select>
 <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
 </div>
 </div>
 <span className="text-xs text-gray-500 font-medium tracking-wide">0-0 of 0</span>
 <div className="flex items-center gap-4 text-gray-400">
 <button disabled className="cursor-not-allowed hover:text-gray-600 transition-colors">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
 </button>
 <button disabled className="cursor-not-allowed hover:text-gray-600 transition-colors">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
 </button>
 </div>
 </div>
 </div>
 </>
 ) : (
 <FetchedAdsTab />
 )}
 </div>
 </div>
 
 <style jsx global>{`
 . {
 font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
 }
`}</style>
 </DashboardLayoutClient>
 )
}
