import { useState } from'react';
import { createPortal } from'react-dom';
import { X, Plus, Trash2 } from'lucide-react';
import { Input } from'@/components/ui/input';
import { Button } from'@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from'@/components/ui/select';
import { Textarea } from'@/components/ui/textarea';
import { cn } from'@/lib/utils';

interface ApiRequestModalProps {
 isOpen: boolean;
 onClose: () => void;
}

type Tab ='params' |'headers' |'body';

interface ParamRow {
 id: string;
 key: string;
 value: string;
}

interface ResponseRow {
 id: string;
 key: string;
 value: string;
}

function AttributeSelect({ placeholder = "Select attribute or type value" }: { placeholder?: string }) {
 return (
 <Select>
 <SelectTrigger className="w-full bg-slate-100 dark:bg-slate-800 border-none h-11 rounded-xl text-slate-400 font-normal truncate">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent className="bg-white dark:bg-slate-900 border-slate-200">
 <SelectGroup>
 <SelectLabel className="text-slate-500 font-semibold text-xs uppercase tracking-wider px-3 py-1">Attributes</SelectLabel>
 <SelectItem value="name">Name</SelectItem>
 <SelectItem value="firstname">FirstName</SelectItem>
 <SelectItem value="lastname">LastName</SelectItem>
 <SelectItem value="mobilenumber">MobileNumber</SelectItem>
 </SelectGroup>
 </SelectContent>
 </Select>
 );
}

export function ApiRequestModal({ isOpen, onClose }: ApiRequestModalProps) {
 const [activeTab, setActiveTab] = useState<Tab>('params');
 const [method, setMethod] = useState('GET');
 const [url, setUrl] = useState('');
 const [params, setParams] = useState<ParamRow[]>([
 { id: crypto.randomUUID(), key:'', value:'' },
 { id: crypto.randomUUID(), key:'', value:'' },
 ]);
 const [headers, setHeaders] = useState<ParamRow[]>([
 { id: crypto.randomUUID(), key:'', value:'' },
 { id: crypto.randomUUID(), key:'', value:'' },
 ]);
 const [body, setBody] = useState('{\n \n}');
 const [responseRows, setResponseRows] = useState<ResponseRow[]>([
 { id: crypto.randomUUID(), key:'', value:'' },
 { id: crypto.randomUUID(), key:'', value:'' },
 ]);

 if (!isOpen) return null;

 const addRow = (type:'params' |'headers') => {
 const newRow: ParamRow = { id: crypto.randomUUID(), key:'', value:'' };
 if (type ==='params') setParams(prev => [...prev, newRow]);
 else setHeaders(prev => [...prev, newRow]);
 };

 const removeRow = (type:'params' |'headers', id: string) => {
 if (type ==='params') setParams(prev => prev.filter(r => r.id !== id));
 else setHeaders(prev => prev.filter(r => r.id !== id));
 };

 const addResponseRow = () => {
 setResponseRows(prev => [...prev, { id: crypto.randomUUID(), key:'', value:'' }]);
 };

 const removeResponseRow = (id: string) => {
 setResponseRows(prev => prev.filter(r => r.id !== id));
 };

 const tabs: { key: Tab; label: string }[] = [
 { key:'params', label:'Params' },
 { key:'headers', label:'Headers' },
 { key:'body', label:'Body' },
 ];

 const renderRows = (rows: ParamRow[], type:'params' |'headers') => (
 <div className="space-y-2">
 {rows.map((row, index) => {
 const isLast = index === rows.length - 1;
 return (
 <div key={row.id} className="flex gap-2 items-center">
 <Input
 placeholder="Key"
 defaultValue={row.key}
 className="w-1/3 bg-slate-100 dark:bg-slate-800 border-none h-11 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus-visible:ring-[#00B074]/30"
 />
 <div className="flex-1">
 <AttributeSelect />
 </div>
 {isLast ? (
 <button
 onClick={() => addRow(type)}
 className="w-11 h-11 border border-[#00B074] rounded-xl flex items-center justify-center text-[#00B074] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shrink-0"
 >
 <Plus className="w-4 h-4" />
 </button>
 ) : (
 <button
 onClick={() => removeRow(type, row.id)}
 className="w-11 h-11 border border-red-400 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 );
 })}
 </div>
 );

 return createPortal(
 <div
 className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
 onClick={onClose}
 >
 <div
 className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[95vw] mx-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="p-8 overflow-y-auto max-h-[95vh] space-y-6">

 {/* Close */}
 <div className="flex justify-end">
 <button
 onClick={onClose}
 className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* ── REQUEST SECTION ── */}
 <div className="space-y-4">
 <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Request</h3>

 {/* Method + URL row */}
 <div className="flex gap-3">
 <Select value={method} onValueChange={setMethod}>
 <SelectTrigger className="w-28 bg-slate-100 dark:bg-slate-800 border-none rounded-xl h-11 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
 <SelectItem value="GET">GET</SelectItem>
 <SelectItem value="POST">POST</SelectItem>
 <SelectItem value="PUT">PUT</SelectItem>
 <SelectItem value="PATCH">PATCH</SelectItem>
 <SelectItem value="DELETE">DELETE</SelectItem>
 </SelectContent>
 </Select>
 <Input
 placeholder="Enter URL or paste"
 value={url}
 onChange={(e) => setUrl(e.target.value)}
 className="flex-1 bg-slate-100 dark:bg-slate-800 border-none h-11 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus-visible:ring-[#00B074]/30"
 />
 </div>

 {/* Tabs */}
 <div className="border-b border-slate-200 dark:border-slate-700">
 <div className="flex gap-6">
 {tabs.map(tab => (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key)}
 className={cn(
 "pb-2 text-sm font-medium border-b-2 transition-colors -mb-px",
 activeTab === tab.key
 ? "border-[#00B074] text-[#00B074] dark:text-emerald-400"
 : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
 )}
 >
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* Tab Content */}
 <div className="min-h-[200px]">
 {activeTab ==='params' && renderRows(params,'params')}
 {activeTab ==='headers' && renderRows(headers,'headers')}

 {activeTab ==='body' && (
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
 <div className="flex">
 <div className="px-3 py-3 select-none text-slate-400 dark:text-slate-500 font-mono text-sm leading-6 border-r border-slate-200 dark:border-slate-700 min-w-[40px] text-right bg-slate-100/60 dark:bg-slate-800/60">
 {body.split('\n').map((_, i) => (
 <div key={i}>{i + 1}</div>
 ))}
 </div>
 <Textarea
 value={body}
 onChange={(e) => setBody(e.target.value)}
 className="flex-1 border-none shadow-none focus-visible:ring-0 resize-none bg-transparent font-mono text-sm text-slate-700 dark:text-slate-200 min-h-[160px] py-3 leading-6"
 spellCheck={false}
 />
 </div>
 </div>
 )}
 </div>

 {/* Test / Save buttons */}
 <div className="flex justify-end gap-3 pt-1">
 <Button className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-6 h-11 rounded-xl font-semibold">
 Test
 </Button>
 <Button onClick={onClose} className="bg-[#00B074] hover:bg-[#009662] text-white px-6 h-11 rounded-xl font-semibold">
 Save
 </Button>
 </div>
 </div>

 {/* Divider */}
 <div className="border-t border-slate-200 dark:border-slate-700" />

 {/* ── RESPONSE SECTION ── */}
 <div className="space-y-4">
 <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Response</h3>
 <h4 className="text-sm text-slate-600 dark:text-slate-300">Capture response in Attribute</h4>

 <div className="space-y-2">
 {responseRows.map((row, index) => {
 const isLast = index === responseRows.length - 1;
 return (
 <div key={row.id} className="flex gap-2 items-center">
 <div className="flex-1">
 <AttributeSelect />
 </div>
 <div className="flex-1">
 <AttributeSelect />
 </div>
 {isLast ? (
 <button
 onClick={addResponseRow}
 className="w-11 h-11 border border-[#00B074] rounded-xl flex items-center justify-center text-[#00B074] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shrink-0"
 >
 <Plus className="w-4 h-4" />
 </button>
 ) : (
 <button
 onClick={() => removeResponseRow(row.id)}
 className="w-11 h-11 border border-red-400 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 );
 })}
 </div>

 {/* JSON icon */}
 <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 pt-1">
 <span className="font-mono text-base font-bold">{'{}'}</span>
 </div>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
}
