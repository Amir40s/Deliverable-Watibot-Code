'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from'@/components/ui/dialog';

export interface QRCampaignSelectionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelect: (campaign: any) => void;
}

export function QRCampaignSelectionModal({ isOpen, onClose, onSelect }: QRCampaignSelectionModalProps) {
 // Mocking QR Campaigns since no API exists yet
 const campaigns = [
 { id:'1', name:'Spring Sale 2024', status:'live', createdAt:'2024-03-01' },
 { id:'2', name:'Welcome Offer', status:'live', createdAt:'2024-02-15' },
 ];

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-4xl bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-[20px]">
 <DialogHeader className="p-6 pb-2 border-b-transparent">
 <DialogTitle className="text-xl font-medium text-[#00B074] flex flex-col items-start gap-1">
 QR Drip Campaigns
 <span className="text-xs text-[#00B074] font-normal opacity-80">Only drip campaigns with a status of "live" will be displayed.</span>
 </DialogTitle>
 </DialogHeader>

 <div className="px-6 py-4">
 {/* The screenshot does not show a visible search bar for QR Campaigns, just the table headers directly */}
 <table className="w-full text-left text-sm whitespace-nowrap mb-8 mt-2">
 <thead className="text-[13px] text-[#00B074] font-medium bg-white dark:bg-slate-900">
 <tr>
 <th className="px-2 py-4 font-medium">Name</th>
 <th className="px-2 py-4 text-center font-medium">Created At</th>
 <th className="px-2 py-4 text-right font-medium">Preview</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
 {campaigns.length === 0 ? (
 <tr>
 <td colSpan={3} className="py-12 text-center">
 <p className="text-slate-500 text-sm">No live drip campaigns found.</p>
 </td>
 </tr>
 ) : (
 campaigns.map((campaign) => (
 <tr 
 key={campaign.id} 
 className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
 onClick={() => {
 onSelect(campaign);
 onClose();
 }}
 >
 <td className="px-2 py-4 text-slate-700 dark:text-slate-300 font-medium">{campaign.name}</td>
 <td className="px-2 py-4 text-slate-500 dark:text-slate-400 text-center">
 {campaign.createdAt}
 </td>
 <td className="px-2 py-4 text-[#00B074] text-right font-medium">
 View Preview
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
