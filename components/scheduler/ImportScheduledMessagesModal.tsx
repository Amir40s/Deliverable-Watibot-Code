"use client";

import React, { useState, useRef } from'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle
} from'@/components/ui/dialog';
import { Button } from'@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle } from'lucide-react';
import { toast } from'sonner';
import * as XLSX from'xlsx';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from'@/components/ui/table';
import { format, parse } from'date-fns';

interface ImportScheduledMessagesModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSuccess: () => void;
}

interface ParsedMessage {
 waId: string;
 content: string;
 scheduledAt: Date;
 displayDate: string;
 displayTime: string;
 mediaUrl?: string;
}

export function ImportScheduledMessagesModal({ isOpen, onClose, onSuccess }: ImportScheduledMessagesModalProps) {
 const [isLoading, setIsLoading] = useState(false);
 const [parsedData, setParsedData] = useState<ParsedMessage[]>([]);
 const [fileName, setFileName] = useState('');
 const fileInputRef = useRef<HTMLInputElement>(null);

 const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setFileName(file.name);
 const reader = new FileReader();
 
 reader.onload = (event) => {
 try {
 const bstr = event.target?.result;
 const wb = XLSX.read(bstr, { type:'binary' });
 const wsname = wb.SheetNames[0];
 const ws = wb.Sheets[wsname];
 const data = XLSX.utils.sheet_to_json(ws);

 // Map data to expected format
 const messages: ParsedMessage[] = data.map((row: any) => {
 const waId = String(row['Contact Mobile'] || row['phone'] || row['Mobile'] || row['Recipient'] ||'');
 const content = row['Message'] || row['content'] ||'';
 const dateStr = row['Date'] || row['date'] ||'';
 const timeStr = row['Time'] || row['time'] ||'';
 const mediaUrl = row['Media URL'] || row['mediaUrl'] || row['media'] || '';
 
 let scheduledAt: Date | null = null;
 try {
 // Attempt to parse Date and Time
 // Format expected: YYYY-MM-DD and HH:mm
 if (dateStr && timeStr) {
 scheduledAt = parse(`${dateStr} ${timeStr}`,'yyyy-MM-dd HH:mm', new Date());
 } else if (dateStr) {
 // If only date, assume today's current time + offset or just parse
 scheduledAt = new Date(dateStr);
 }
 } catch (e) {
 console.error('Date parsing failed for row:', row);
 }

 return {
 waId,
 content,
 scheduledAt: scheduledAt || new Date(Date.now() + 3600000), // Default 1hr ahead if fail
 displayDate: dateStr,
 displayTime: timeStr,
 mediaUrl: mediaUrl || undefined
 };
 }).filter(m => m.waId && m.content);

 if (messages.length === 0) {
 toast.error('No valid messages found. Please check column names.');
 return;
 }

 setParsedData(messages);
 } catch (error) {
 console.error('Error parsing file:', error);
 toast.error('Failed to parse file');
 }
 };
 
 reader.readAsBinaryString(file);
 };

 const handleImport = async () => {
 if (parsedData.length === 0) return;

 setIsLoading(true);
 try {
 const result = await bulkCreateScheduledMessages(parsedData,'SCHEDULED');

 if (result.success) {
 toast.success(`Successfully imported ${result.createdCount} messages`);
 if (result.errors && result.errors.length > 0) {
 toast.warning(`${result.errors.length} records failed to import`);
 console.warn('Import errors:', result.errors);
 }
 onSuccess();
 handleClose();
 } else {
 toast.error(result.error ||'Failed to import messages');
 }
 } catch (error) {
 console.error('Import failed:', error);
 toast.error('Failed to import records');
 } finally {
 setIsLoading(false);
 }
 };

 const handleClose = () => {
 setParsedData([]);
 setFileName('');
 if (fileInputRef.current) fileInputRef.current.value ='';
 onClose();
 };

 return (
 <Dialog open={isOpen} onOpenChange={handleClose}>
 <DialogContent className="max-w-4xl bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
 <DialogHeader className="p-6 border-b border-gray-100 dark:border-slate-800">
 <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
 Import Scheduled Messages
 </DialogTitle>
 </DialogHeader>

 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 {!parsedData.length ? (
 <div 
 className="border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
 onClick={() => fileInputRef.current?.click()}
 >
 <input 
 type="file" 
 ref={fileInputRef} 
 onChange={handleFileUpload} 
 accept=".xlsx, .xls, .csv" 
 className="hidden" 
 />
 <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
 <Upload className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
 </div>
 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
 Click to upload or drag and drop
 </h3>
 <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm font-medium">
 Supported formats: .xlsx, .xls, .csv
 </p>
 <div className="mt-8 text-left max-w-md w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Expected Columns:</p>
 <div className="grid grid-cols-2 gap-3">
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Contact Mobile</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Message</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Date (YYYY-MM-DD)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Time (HH:mm)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
 <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Media URL (Optional)</span>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
 <div className="flex items-center gap-3 ">
 <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
 <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
 </div>
 <div>
 <p className="text-sm font-bold text-slate-900 dark:text-white">{fileName}</p>
 <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
 {parsedData.length} Records Detected
 </p>
 </div>
 </div>
 <Button 
 variant="ghost" 
 size="sm" 
 onClick={() => {
 setParsedData([]);
 setFileName('');
 if (fileInputRef.current) fileInputRef.current.value ='';
 }}
 className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold text-xs uppercase tracking-widest"
 >
 Clear
 </Button>
 </div>

 <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
 <div className="max-h-[400px] overflow-y-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
 <TableHead className="text-[10px] font-bold uppercase tracking-widest">Contact</TableHead>
 <TableHead className="text-[10px] font-bold uppercase tracking-widest">Message</TableHead>
 <TableHead className="text-[10px] font-bold uppercase tracking-widest">Date</TableHead>
 <TableHead className="text-[10px] font-bold uppercase tracking-widest">Time</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {parsedData.slice(0, 50).map((row, i) => (
 <TableRow key={i}>
 <TableCell className="text-sm font-bold">+{row.waId}</TableCell>
 <TableCell className="text-sm text-slate-500 max-w-xs truncate">{row.content}</TableCell>
 <TableCell className="text-sm">{row.displayDate ||'-'}</TableCell>
 <TableCell className="text-sm">{row.displayTime ||'-'}</TableCell>
 </TableRow>
 ))}
 {parsedData.length > 50 && (
 <TableRow>
 <TableCell colSpan={4} className="text-center text-slate-400 py-6 text-xs font-bold uppercase tracking-widest italic">
 ...and {parsedData.length - 50} more records
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 )}
 </div>

 <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-4 bg-white dark:bg-slate-900">
 <Button variant="outline" onClick={handleClose} disabled={isLoading} className="rounded-xl h-11 px-6 font-bold text-xs uppercase tracking-widest border-slate-200">
 Cancel
 </Button>
 <Button 
 onClick={handleImport} 
 disabled={isLoading || parsedData.length === 0}
 className="bg-[#00B074] hover:bg-[#009662] text-white rounded-xl h-11 px-8 font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#00B074]/20"
 >
 {isLoading ?'Processing...' :'Schedule Records'}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );
}
