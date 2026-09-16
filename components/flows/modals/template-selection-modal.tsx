'use client';

import { useState, useEffect } from'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from'@/components/ui/dialog';
import { Input } from'@/components/ui/input';
import { Search, Loader2, X, FileText } from'lucide-react';
import { cn } from'@/lib/utils';
import { Button } from'@/components/ui/button';

export interface TemplateSelectionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelect: (template: any) => void;
}

export function TemplateSelectionModal({ isOpen, onClose, onSelect }: TemplateSelectionModalProps) {
 const [templates, setTemplates] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');

 useEffect(() => {
 if (isOpen) {
 loadTemplates();
 }
 }, [isOpen]);

 const loadTemplates = async () => {
 setLoading(true);
 try {
 const res = await getMessageTemplates();
 if (res.success && res.data) {
 setTemplates(res.data);
 }
 } catch (error) {
 console.error('Failed to load templates', error);
 } finally {
 setLoading(false);
 }
 };

 const filteredTemplates = templates.filter(t => 
 t.name?.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-5xl bg-white dark:bg-slate-950 border-none shadow-2xl p-0 overflow-hidden rounded-[32px]">
 <div className="p-8">
 <DialogHeader className="p-0 mb-2 relative">
 <DialogTitle className="text-2xl font-bold text-[#00B074] dark:text-emerald-400">
 Template Messages
 </DialogTitle>
 <button 
 onClick={onClose}
 className="absolute -top-1 -right-1 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
 >
 <X className="w-6 h-6 text-slate-400" />
 </button>
 </DialogHeader>

 <p className="text-[15px] text-[#00B074] dark:text-emerald-500 font-medium mb-6">
 Click-tracking-enabled templates will not be shown in this list
 </p>

 <div className="mb-8">
 <div className="relative w-80">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
 <Input 
 placeholder="Search templates" 
 className="bg-[#F0F2F2] dark:bg-slate-900/50 border-none h-12 rounded-xl pl-12 text-[15px] focus-visible:ring-0"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm whitespace-nowrap">
 <thead className="text-[15px] text-[#00B074] dark:text-emerald-400 font-bold border-b-0">
 <tr>
 <th className="px-4 py-4 first:pl-0">Name</th>
 <th className="px-4 py-4">Status</th>
 <th className="px-4 py-4">Type</th>
 <th className="px-4 py-4">Created At</th>
 <th className="px-4 py-4 text-right last:pr-0">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
 {loading ? (
 <tr>
 <td colSpan={5} className="py-20 text-center">
 <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#00B074] mb-3" />
 <p className="text-slate-500 font-medium">Loading templates...</p>
 </td>
 </tr>
 ) : filteredTemplates.length === 0 ? (
 <tr>
 <td colSpan={5} className="py-20 text-center">
 <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
 <FileText className="w-8 h-8 text-slate-200 dark:text-slate-700" />
 </div>
 <p className="text-slate-500 font-medium italic">No templates found.</p>
 </td>
 </tr>
 ) : (
 filteredTemplates.map((template) => (
 <tr key={template.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
 <td className="px-4 py-5 first:pl-0 text-slate-700 dark:text-slate-300 font-semibold">{template.name}</td>
 <td className="px-4 py-5 font-medium">
 <span className={cn(
 "px-3 py-1 rounded-full text-[12px] font-bold",
 template.status ==='APPROVED' ?'bg-emerald-50 text-emerald-600' :
 template.status ==='REJECTED' ?'bg-red-50 text-red-600' :
'bg-amber-50 text-amber-600'
 )}>
 {template.status}
 </span>
 </td>
 <td className="px-4 py-5 text-slate-500 font-medium capitalize">{template.category?.toLowerCase() ||'Marketing'}</td>
 <td className="px-4 py-5 text-slate-500 font-medium">
 {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
 </td>
 <td className="px-4 py-5 text-right last:pr-0">
 <Button 
 variant="ghost" 
 className="text-[#00B074] hover:text-[#00B074] hover:bg-[#00B074]/5 font-bold px-6"
 onClick={() => {
 onSelect(template);
 onClose();
 }}
 >
 Select
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
