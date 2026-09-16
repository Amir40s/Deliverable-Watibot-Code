"use client";

import { useState } from'react';
import { 
 Dialog, 
 DialogContent, 
 DialogHeader, 
 DialogTitle 
} from'@/components/ui/dialog';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { 
 Search, 
 ShoppingBag, 
 Trash2, 
 X, 
 Package,
 Tag,
 Layers,
 Boxes
} from'lucide-react';
import { cn } from'@/lib/utils';
import Image from'next/image';

interface ProductSelectionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelect?: (product: any) => void;
}

export function ProductSelectionModal({ isOpen, onClose, onSelect }: ProductSelectionModalProps) {
 const [activeTab, setActiveTab] = useState<'all' |'electronics' |'fashion' |'home'>('all');

 const tabs = [
 { id:'all', label:'All Products', icon: Boxes, count: 0 },
 { id:'electronics', label:'Electronics', icon: Package, count: 0 },
 { id:'fashion', label:'Fashion', icon: Tag, count: 0 },
 { id:'home', label:'Home & Garden', icon: Layers, count: 0 },
 ];

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-slate-950 border-none rounded-[32px] shadow-2xl">
 {/* Header Section */}
 <div className="p-8 pb-4">
 <div className="flex items-center justify-between mb-6">
 <DialogTitle className="text-2xl font-bold text-[#00B074] dark:text-emerald-400">Catalogue / Products</DialogTitle>
 </div>

 <div className="flex items-center gap-4 mb-6">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
 <Input 
 placeholder="Search products in catalogue" 
 className="pl-12 h-12 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl text-[15px] focus-visible:ring-1 focus-visible:ring-[#00B074]/20"
 />
 </div>
 </div>

 {/* Tabs Navigation */}
 <div className="flex items-center border-b border-slate-100 dark:border-slate-800">
 {tabs.map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 "px-10 py-4 text-[15px] font-bold transition-all relative",
 activeTab === tab.id 
 ? "text-[#00B074] dark:text-emerald-400" 
 : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
 )}
 >
 {tab.label} ({tab.count})
 {activeTab === tab.id && (
 <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#00B074] dark:bg-emerald-400 rounded-t-full" />
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Content Area */}
 <div className="h-[450px] overflow-y-auto flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-950">
 <div className="relative w-72 h-72 mb-8 opacity-90 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-full">
 <ShoppingBag className="w-24 h-24 text-slate-200 dark:text-slate-800" />
 </div>
 <div className="text-center">
 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No products found</h3>
 <p className="text-[17px] text-slate-400 italic font-medium">Your catalogue is feeling a bit lonely...</p>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
