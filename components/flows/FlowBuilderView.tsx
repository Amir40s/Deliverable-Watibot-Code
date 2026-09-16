"use client";

import Link from "next/link";
import { Plus, Search, BookOpen, GitBranch, Facebook, TrendingUp, HelpCircle, FileText, ShoppingBag, Download, Upload, FileJson } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { PillButton } from "@/components/ui/pill-button";
import { Input } from "@/components/ui/input";
import { FlowsTable } from "@/components/flows/flows-table";
import { Flow } from "@/types/flow";
import { Button } from "@/components/ui/button";
import * as XLSX from'xlsx';
import { toast } from'sonner';
import { useState, useEffect, useRef } from 'react';
import { useSession } from "next-auth/react";
import { importFlow } from'@/app/actions/flows';
import { getQuotaStatus } from '@/app/actions/quota';

import { useRouter } from 'next/navigation';

interface FlowBuilderViewProps {
 flows: Flow[];
 isLoading: boolean;
}

export function FlowBuilderView({ flows, isLoading }: FlowBuilderViewProps) {
 const t = useTranslations("Flows");
 const locale = useLocale();
 const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr";
 const { data: session } = useSession();
 const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
 const userPerms = (session?.user?.permissions as any) || {};
 const canCreate = isAdmin || userPerms.flow_create === true || userPerms.flow_super === true || session?.user?.role === "USER";
 const fileInputRef = useRef<HTMLInputElement>(null);
 const router = useRouter();
 const [flowQuota, setFlowQuota] = useState<{ allowed: boolean; limit: number; current: number } | null>(null);

 useEffect(() => {
  getQuotaStatus('maxBotFlows').then(status => {
   setFlowQuota(status);
  }).catch(err => console.error('Failed to fetch flow quota:', err));
 }, []);

 const isFlowLimitReached = flowQuota ? !flowQuota.allowed : false;

 const handleImportClick = () => {
 fileInputRef.current?.click();
 };

 const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 try {
 const text = await file.text();
 const data = JSON.parse(text);

 const importOne = async (flowData: any) => {
 if (!flowData.name || !flowData.nodes || !flowData.edges) {
 throw new Error(flowData.name ?`Invalid design for "${flowData.name}"` :'Invalid flow design');
 }
 const result = await importFlow(flowData);
 if (!result.success) {
 throw new Error(result.error);
 }
 return result;
 };

 const flowsToImport = Array.isArray(data) ? data : [data];
 
 toast.promise(Promise.all(flowsToImport.map(f => importOne(f))), {
 loading: flowsToImport.length > 1 ? t("importingMultiple", { count: flowsToImport.length }) : t("importingOne"),
 success: () => {
 setTimeout(() => window.location.reload(), 1000);
 return flowsToImport.length > 1 ? t("importedMultiple", { count: flowsToImport.length }) : t("importedOne");
 },
 error: (err) => `${t("importFailed")}: ${err.message}`
 });
 } catch (error) {
 console.error('Import failed:', error);
 toast.error(t("parseFailed"));
 } finally {
 if (event.target) event.target.value ='';
 }
 };

 const handleExportAll = () => {
 try {
 if (!flows || flows.length === 0) {
 toast.error(t("noFlowsToExport"));
 return;
 }

 const exportData = flows.map(flow => ({
 name: flow.name,
 description: flow.description,
 trigger: flow.trigger,
 nodes: flow.nodes,
 edges: flow.edges,
 version:'1.0'
 }));

 const blob = new Blob([JSON.stringify(exportData, null, 2)], { type:'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download =`all_flows_export_${new Date().toISOString().split('T')[0]}.json`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 toast.success(t("exportAllJsonSuccess"));
 } catch (error) {
 console.error('Export failed:', error);
 toast.error(t("exportJsonFailed"));
 }
 };

 const handleExport = () => {
 try {
 if (!flows || flows.length === 0) {
 toast.error(t("noFlowsToExport"));
 return;
 }

 const exportData = flows.map(flow => ({
'Name': flow.name,
'Description': flow.description ||'',
'Status': flow.isActive ?'Active' :'Inactive',
'Trigger Type': (flow.trigger as any)?.type ||'-',
'Executions': (flow as any)._count?.executions || 0,
'Created At': new Date(flow.createdAt).toLocaleString(),
'Updated At': new Date(flow.updatedAt).toLocaleString()
 }));

 const ws = XLSX.utils.json_to_sheet(exportData);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, "Flows");

 XLSX.writeFile(wb,`flows_export_${new Date().toISOString().split('T')[0]}.xlsx`);
 toast.success(t("exportExcelSuccess"));
 } catch (error) {
 console.error('Export failed:', error);
 toast.error(t("exportJsonFailed"));
 }
 };

 return (
 <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4 md:px-8 pt-4" dir={dir}>
 {/* Flow Automation Banner */}
 <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm">
 <div className="absolute top-0 right-0 w-64 h-full bg-emerald-500/5 dark:bg-emerald-500/10 -skew-x-12 translate-x-12" />

 <div className={`flex items-start gap-4 relative z-10 ${dir === 'rtl' ? 'flex-row-reverse text-start' : 'text-start'}`}>
 <div className="bg-[#00B074] rounded-xl p-3 shadow-lg shadow-[#00B074]/20 text-white shrink-0">
 <GitBranch className="w-6 h-6" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-1">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {t("bannerTitle")}
 </h3>
 </div>
 <p className="text-sm text-[#00B074]/80 dark:text-emerald-400/70 font-medium">
 {t("bannerDesc")}
 </p>
 </div>
 </div>
 {canCreate && (
  isFlowLimitReached ? (
   <Button disabled className="bg-gray-400 text-white border-none rounded-xl font-bold text-xs uppercase tracking-widest px-6 opacity-50 cursor-not-allowed relative z-10">
    {t("createNewFlow")} {dir === "rtl" ? "←" : "→"}
   </Button>
  ) : (
   <Link href="/dashboard/flows/new">
    <Button className="bg-[#00B074] hover:bg-[#009662] text-white border-none rounded-xl font-bold text-xs uppercase tracking-widest px-6 shadow-lg shadow-[#00B074]/20 relative z-10 ">
     {t("createNewFlow")} {dir === "rtl" ? "←" : "→"}
    </Button>
   </Link>
  )
 )}
 </div>

 {isFlowLimitReached && flowQuota && (
  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full shadow-sm animate-in fade-in slide-in-from-top duration-300">
   <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
     <GitBranch className="w-5 h-5" />
    </div>
    <div>
     <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Flow Limit Reached</h4>
     <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5 font-medium">
      You have used {flowQuota.current}/{flowQuota.limit} flows. Please upgrade your subscription plan to create more flows.
     </p>
    </div>
   </div>
   <Button
    onClick={() => router.push('/dashboard/billing')}
    className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shrink-0 transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
   >
    Upgrade Plan
   </Button>
  </div>
 )}

 {/* Quick Guide */}
 <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800/60 shadow-sm text-start">
 <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t("guideTitle")}</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-2xl font-medium">
 {t("guideDesc")}
 </p>
 <div className={`flex flex-col sm:flex-row gap-6 ${dir === 'rtl' ? 'sm:flex-row-reverse justify-end' : ''}`}>
 <Link href="#" className="flex items-center text-sm font-bold text-[#00B074] dark:text-emerald-400 hover:text-[#009662] hover:underline transition-colors">
 <BookOpen className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
 {t("createFirstFlow")}
 </Link>
 <Link href="#" className="flex items-center text-sm font-bold text-[#00B074] dark:text-emerald-400 hover:text-[#009662] hover:underline transition-colors">
 <Plus className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
 {t("understandingAiNodes")}
 </Link>
 </div>
 </div>

 {/* Total Quota */}

 {/* Search and Create */}
 <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${dir === 'rtl' ? 'md:flex-row-reverse' : ''}`}>
 <div className="relative flex-1 max-w-md w-full">
 <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <Input
 placeholder={t("searchPlaceholder")}
 className="pl-10 rtl:pl-3 rtl:pr-10 h-11 rounded-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
 />
 </div>
 <div className={`flex items-center gap-2 flex-wrap ${dir === 'rtl' ? 'justify-start' : 'justify-start md:justify-end'}`}>
 <input 
 type="file" 
 ref={fileInputRef} 
 onChange={handleFileChange} 
 accept=".json" 
 className="hidden" 
 />
 {canCreate && (
 <Button 
 onClick={handleImportClick}
 variant="outline" 
 className="h-11 px-6 rounded-xl border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-200 font-semibold"
 >
 <Upload className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
 {t("importFlow")}
 </Button>
 )}
 <Button 
 onClick={handleExportAll}
 variant="outline" 
 className="h-11 px-6 rounded-xl border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-200 font-semibold"
 >
 <FileJson className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
 {t("exportAll")}
 </Button>
 <Button 
 onClick={handleExport}
 variant="outline" 
 className="h-11 px-6 rounded-xl border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-200 font-semibold"
 >
 <Download className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
 {t("downloadExcel")}
 </Button>
 {canCreate && (
  isFlowLimitReached ? (
   <Button disabled className="h-11 px-6 rounded-xl bg-gray-400 text-white font-semibold opacity-50 cursor-not-allowed">
    <Plus className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
    {t("createFlow")}
   </Button>
  ) : (
   <Link href="/dashboard/flows/new">
    <Button className="h-11 px-6 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white font-semibold">
     <Plus className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
     {t("createFlow")}
    </Button>
   </Link>
  )
 )}
 </div>
 </div>

 {/* Flows Tabs */}
 <div className="border-b border-gray-200 dark:border-slate-800">
 <div className={`flex items-center gap-8 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
 <button className="pb-4 border-b-2 border-[#00B074] dark:border-emerald-400 text-[#00B074] dark:text-emerald-400 font-semibold text-sm flex items-center gap-2">
 {t("yourFlows")}
 </button>
 </div>
 </div>

 {/* Flows Table */}
 <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden min-h-[300px]">
 {isLoading ? (
 <div className="flex items-center justify-center h-48 text-gray-400">{t("loadingFlows")}</div>
 ) : flows.length > 0 ? (
 <FlowsTable flows={flows} />
 ) : (
 <div className="flex flex-col items-center justify-center h-64 text-gray-400">
 <p>{t("noFlowsFound")}</p>
 </div>
 )}
 </div>

 {/* Pagination Placeholder */}
 <div className="flex items-center justify-end gap-2 text-xs text-gray-500" dir={dir}>
 <span>{t("paginationOf", { range: "1-3", total: flows.length.toString() })}</span>
 <button disabled className="p-1 hover:bg-gray-100 rounded disabled:opacity-50">{dir === "rtl" ? '>' : '<'}</button>
 <button className="p-1 hover:bg-gray-100 rounded">{dir === "rtl" ? '<' : '>'}</button>
 </div>
 </div>
 );
}
