'use client';

import { useState, useEffect } from'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Input } from'@/components/ui/input';
import { getAdAccounts, getCampaigns } from'@/app/actions/campaigns';
import { Loader2 } from'lucide-react';
import { toast } from'sonner';

export interface FacebookAdSelectionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelect: (ad: any) => void;
}

export function FacebookAdSelectionModal({ isOpen, onClose, onSelect }: FacebookAdSelectionModalProps) {
 const [activeTab, setActiveTab] = useState<'aisensy' |'facebook'>('aisensy');
 const [searchQuery, setSearchQuery] = useState('');
 const [ads, setAds] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 if (isOpen) {
 loadFacebookAds();
 }
 }, [isOpen]);

 const loadFacebookAds = async () => {
 setLoading(true);
 try {
 const accountsRes = await getAdAccounts();
 if (accountsRes.success && accountsRes.data?.[0]) {
 const campaignsRes = await getCampaigns(accountsRes.data[0].id);
 if (campaignsRes.success && campaignsRes.data) {
 setAds(campaignsRes.data);
 } else {
 toast.error(campaignsRes.message ||'Failed to fetch campaigns');
 }
 }
 } catch (error) {
 console.error('Error loading ads:', error);
 toast.error('An error occurred while fetching ads.');
 } finally {
 setLoading(false);
 }
 };

 const displayAds =
 activeTab ==='facebook'
 ? ads.filter((ad) => ad.name?.toLowerCase().includes(searchQuery.toLowerCase()))
 : []; // Aisensy Ads typically mock/filter for platform-specific ones, leaving empty or matching FB ads for now

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-4xl bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-[20px] min-h-[500px] flex flex-col">
 <DialogHeader className="p-6 pb-2 border-b-transparent shrink-0">
 <DialogTitle className="text-xl font-medium text-[#00B074]">Facebook Ads</DialogTitle>
 </DialogHeader>

 <div className="px-6 py-2 shrink-0">
 <div className="relative max-w-sm mb-4">
 <Input
 placeholder="Search ads"
 className="bg-slate-100/50 dark:bg-slate-800/50 border-none h-11 rounded-lg pl-4 text-sm focus-visible:ring-1 focus-visible:ring-slate-200"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">0 of 20 selected.</p>

 {/* Tabs */}
 <div className="flex border-b border-slate-200 dark:border-slate-800">
 <button
 className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
 activeTab ==='aisensy'
 ?'border-[#00B074] text-[#00B074]'
 :'border-transparent text-slate-500 hover:text-slate-700'
 }`}
 onClick={() => setActiveTab('aisensy')}
 >
 AISENSY ADS
 </button>
 <button
 className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
 activeTab ==='facebook'
 ?'border-[#00B074] text-[#00B074]'
 :'border-transparent text-slate-500 hover:text-slate-700'
 }`}
 onClick={() => setActiveTab('facebook')}
 >
 FACEBOOK ADS
 </button>
 </div>
 </div>

 {/* Table Content */}
 <div className="px-6 py-4 flex-1 overflow-auto">
 <table className="w-full text-left text-sm whitespace-nowrap">
 <thead className="text-[13px] text-[#00B074] font-medium bg-white dark:bg-slate-900 sticky top-0 z-10">
 <tr>
 <th className="py-2 font-medium w-24">Select</th>
 <th className="py-2 font-medium">Advertisement</th>
 <th className="py-2 font-medium">Created At</th>
 <th className="py-2 font-medium">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
 {loading ? (
 <tr>
 <td colSpan={4} className="py-20 text-center">
 <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
 <p className="text-slate-500 text-sm">Loading ads...</p>
 </td>
 </tr>
 ) : displayAds.length === 0 ? (
 <tr>
 <td colSpan={4} className="py-20 text-center">
 <p className="text-slate-500 text-sm">No Advertisement yet !</p>
 </td>
 </tr>
 ) : (
 displayAds.map((ad) => (
 <tr
 key={ad.id}
 className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
 onClick={() => {
 onSelect(ad);
 onClose();
 }}
 >
 <td className="py-3">
 <div className="w-4 h-4 rounded border border-slate-300"></div>
 </td>
 <td className="py-3 text-slate-700 dark:text-slate-300 font-medium">{ad.name}</td>
 <td className="py-3 text-slate-500 dark:text-slate-400">
 {ad.start_time ? new Date(ad.start_time).toLocaleDateString() :'N/A'}
 </td>
 <td className="py-3">
 <span
 className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md ${
 ad.status ==='ACTIVE'
 ?'bg-emerald-100 text-emerald-700'
 :'bg-slate-100 text-slate-700'
 }`}
 >
 {ad.status}
 </span>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </DialogContent>
 </Dialog>
 );
}
