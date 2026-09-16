"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR, { mutate } from "swr";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { Calendar, Clock, Plus, Search, Filter, Trash2, User, Users, MoreVertical, RefreshCw, Paperclip, Eye, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScheduleMessageModal } from "@/components/scheduler/ScheduleMessageModal";
import { ImportScheduledMessagesModal } from "@/components/scheduler/ImportScheduledMessagesModal";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
 DropdownMenuRadioGroup,
 DropdownMenuRadioItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as XLSX from'xlsx';
import { Download, Upload as UploadIcon, X, Play } from "lucide-react";

export default function MessageSchedulerPage() {
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [isImportModalOpen, setIsImportModalOpen] = useState(false);
 const [selectedMessage, setSelectedMessage] = useState<ScheduledMessageWithRelations | null>(null);
 const [messages, setMessages] = useState<ScheduledMessageWithRelations[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("ALL");
 const [typeFilter, setTypeFilter] = useState("ALL");
 const [recipientFilter, setRecipientFilter] = useState("ALL");
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [viewMessage, setViewMessage] = useState<ScheduledMessageWithRelations | null>(null);
 const [currentPage, setCurrentPage] = useState(1);
 const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
 const pageSize = 10;

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
  const userPerms = (session?.user?.permissions as any) || {};
  const schedulerAccess = userPerms.scheduler || (isAdmin ? "full" : "none");
  const canCreate =
    isAdmin ||
    schedulerAccess === "full" ||
    schedulerAccess === "edit" ||
    userPerms.sch_create === true ||
    userPerms.sch_super === true;
  const canEdit =
    isAdmin ||
    schedulerAccess === "full" ||
    schedulerAccess === "edit" ||
    userPerms.sch_edit === true ||
    userPerms.sch_super === true;
  const canDelete =
    isAdmin ||
    schedulerAccess === "full" ||
    schedulerAccess === "delete" ||
    userPerms.sch_delete === true ||
    userPerms.sch_super === true;
  const canProcess =
    isAdmin ||
    schedulerAccess === "full" ||
    userPerms.sch_super === true;

 // Standard fetcher for SWR
 const fetcher = (url: string) => fetch(url).then(r => r.json());

 // Use SWR for Scheduler Polling
 const { data: swrMessages, isLoading: isSWRisLoading } = useSWR(
'/api/chat/poll?type=scheduler',
 fetcher,
 {
 refreshInterval: 5000,
 revalidateOnFocus: true,
 }
 );

 // Sync SWR contacts with local state preserving local loading transitions map
 useEffect(() => {
 if (swrMessages) {
 setMessages(swrMessages as ScheduledMessageWithRelations[]);
 setIsLoading(false);
 }
 }, [swrMessages]);

 // Reset to page 1 when filters change
 useEffect(() => {
 setCurrentPage(1);
 }, [search, statusFilter, typeFilter, recipientFilter]);

 const loadMessages = async () => {
 setIsLoading(true);
 mutate('/api/chat/poll?type=scheduler');
 };

 const handleDelete = async (id: string) => {
 if (!confirm("Are you sure you want to delete this scheduled message?")) return;
 
 try {
 const res = await deleteScheduledMessage(id);
 if (res.success) {
 toast.success("Message deleted successfully");
 loadMessages();
 } else {
 toast.error(res.error || "Failed to delete message");
 }
 } catch (error) {
 console.error(error);
 toast.error("Failed to delete message");
 }
 };

 const handleProcessMessages = async () => {
 setIsRefreshing(true);
 toast.message("Processing pending messages...");
 try {
 const res = await processScheduledMessages();
 if (res.success) {
 toast.success(`Successfully processed ${res.processed} messages`);
 loadMessages();
 } else {
 toast.error(res.error || "Failed to process messages");
 }
 } catch (error) {
 console.error(error);
 toast.error("An unexpected error occurred during processing");
 } finally {
 setIsRefreshing(false);
 }
 };

 const handleEdit = (message: ScheduledMessageWithRelations) => {
 setSelectedMessage(message);
 setIsModalOpen(true);
 };

 const handleModalClose = () => {
 setIsModalOpen(false);
 setSelectedMessage(null);
 };

 const handleExport = async () => {
 try {
 toast.message("Exporting records...");
 const res = await getAllScheduledMessages();
 if (res.success && res.data) {
 const exportData = res.data.map(m => ({
'Recipient': m.contact?.name || m.group?.name ||'Unknown',
'Mobile': m.contact ?`+${m.contact.waId}` :'Groups',
'Message': m.content,
'Scheduled At': format(new Date(m.scheduledAt),'yyyy-MM-dd HH:mm'),
'Status': m.status
 }));

 const ws = XLSX.utils.json_to_sheet(exportData);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, "Scheduled Messages");
 XLSX.writeFile(wb,`scheduled_messages_${format(new Date(),'yyyy-MM-dd')}.xlsx`);
 toast.success("Records exported successfully");
 } else {
 toast.error(res.error || "Failed to export records");
 }
 } catch (error) {
 console.error(error);
 toast.error("Export failed");
 }
 };

 const filteredMessages = messages.filter(m => {
 const matchesSearch = 
 m.content.toLowerCase().includes(search.toLowerCase()) ||
 m.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
 m.group?.name?.toLowerCase().includes(search.toLowerCase());
 
 const matchesStatus = statusFilter === "ALL" || 
 (statusFilter === "PENDING" && (m.status === "PENDING" || m.status === "PROCESSING")) ||
 m.status === statusFilter;
 
 const matchesType = typeFilter === "ALL" || 
 (typeFilter === "TEMPLATE" && (m as any).templateName) || 
 (typeFilter === "REGULAR" && !(m as any).templateName);

 const matchesRecipient = recipientFilter === "ALL" ||
 (recipientFilter === "CONTACT" && m.contactId && !m.groupId) ||
 (recipientFilter === "GROUP" && m.groupId);
 
 return matchesSearch && matchesStatus && matchesType && matchesRecipient;
 });

 const activeFiltersCount = (statusFilter !== "ALL" ? 1 : 0) + (typeFilter !== "ALL" ? 1 : 0) + (recipientFilter !== "ALL" ? 1 : 0);

 const stats = {
 pending: messages.filter(m => m.status ==='PENDING').length,
 processing: messages.filter(m => m.status ==='PROCESSING').length,
 scheduled: messages.length,
 completed: messages.filter(m => m.status ==='SENT').length,
 failed: messages.filter(m => m.status ==='FAILED').length
 };

 const totalPages = Math.ceil(filteredMessages.length / pageSize);
 const paginatedMessages = filteredMessages.slice(
 (currentPage - 1) * pageSize,
 currentPage * pageSize
 );

 return (
 <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)] transition-colors duration-300">
 <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4 md:px-8 pt-4">
 {/* Header Section */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="space-y-1">
 <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
 Message Scheduler
 </h2>
 <p className="text-slate-500 dark:text-slate-400 font-medium">
 Schedule your WhatsApp messages for the perfect time
 </p>
 </div>
 <div className="flex items-center gap-3 shrink-0">
 {canProcess && (
 <Button 
 variant="outline"
 onClick={handleProcessMessages}
 disabled={isRefreshing}
 className="border-gray-200 dark:border-slate-800 text-[#00B074] dark:text-emerald-400 font-bold h-11 px-5 rounded-xl text-xs tracking-widest transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/10 flex items-center gap-2"
 >
 <Play className={cn("w-4 h-4", isRefreshing && "animate-pulse")} />
 Process Now
 </Button>
 )}
 <Button 
 variant="outline"
 onClick={handleExport}
 className="border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold h-11 px-5 rounded-xl text-xs tracking-widest transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
 >
 <Download className="w-4 h-4" />
 Export
 </Button>
 {canCreate && (
 <Button 
 variant="outline"
 onClick={() => setIsImportModalOpen(true)}
 className="border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold h-11 px-5 rounded-xl text-xs tracking-widest transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
 >
 <UploadIcon className="w-4 h-4" />
 Import
 </Button>
 )}
 {canCreate && (
 <Button 
 onClick={() => setIsModalOpen(true)}
 className="bg-[#00B074] hover:bg-[#009662] text-white font-bold h-11 px-6 rounded-xl text-xs tracking-widest transition-all shadow-lg shadow-[#00B074]/20 flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Schedule Message
 </Button>
 )}
 </div>
 </div>

 {/* Stats Section */}
	<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		{/* Pending Card */}
		<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
			<div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#FFF9EC] dark:bg-amber-500/10 flex items-center justify-center text-[#F59E0B] shrink-0">
				<Clock className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
			</div>
			<div className="min-w-0 flex-1">
				<span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Pending</span>
				<span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
					{stats.pending + stats.processing}
				</span>
			</div>
		</div>

		{/* Total Scheduled Card */}
		<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
			<div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#EEF2FF] dark:bg-blue-500/10 flex items-center justify-center text-[#2F63FF] shrink-0">
				<Calendar className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
			</div>
			<div className="min-w-0 flex-1">
				<span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Total Scheduled</span>
				<span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
					{stats.scheduled}
				</span>
			</div>
		</div>

		{/* Completed Card */}
		<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
			<div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#E8F8F2] dark:bg-emerald-500/10 flex items-center justify-center text-[#00B074] shrink-0">
				<Plus className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
			</div>
			<div className="min-w-0 flex-1">
				<span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Completed</span>
				<span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
					{stats.completed}
				</span>
			</div>
		</div>

		{/* Failed Card */}
		<div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
			<div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 shrink-0">
				<Trash2 className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
			</div>
			<div className="min-w-0 flex-1">
				<span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Failed</span>
				<span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
					{stats.failed}
				</span>
			</div>
		</div>
	</div>

	{/* Filters & Search */}
 <div className="flex items-center justify-between gap-4">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <Input 
 placeholder="Search messages or recipients..." 
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-10 h-11 rounded-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 focus:ring-emerald-500/20 transition-all font-medium"
 />
 </div>
 <div className="flex items-center gap-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" className={cn(
 "h-11 px-6 rounded-xl border-gray-200 dark:border-slate-800 font-bold text-xs tracking-widest transition-all",
 activeFiltersCount > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
 )}>
 <Filter className="w-4 h-4 mr-2" />
 Filters
 {activeFiltersCount > 0 && (
 <span className="ml-2 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
 {activeFiltersCount}
 </span>
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
 <DropdownMenuLabel className="text-[10px] tracking-widest text-slate-400 font-bold mb-1">Status</DropdownMenuLabel>
 <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
 <DropdownMenuRadioItem value="ALL" className="text-xs font-medium cursor-pointer">All Statuses</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="PENDING" className="text-xs font-medium cursor-pointer">Pending</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="SENT" className="text-xs font-medium cursor-pointer">Sent</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="FAILED" className="text-xs font-medium cursor-pointer">Failed</DropdownMenuRadioItem>
 </DropdownMenuRadioGroup>
 <DropdownMenuSeparator className="my-2" />
 <DropdownMenuLabel className="text-[10px] tracking-widest text-slate-400 font-bold mb-1">Message Type</DropdownMenuLabel>
 <DropdownMenuRadioGroup value={typeFilter} onValueChange={setTypeFilter}>
 <DropdownMenuRadioItem value="ALL" className="text-xs font-medium cursor-pointer">All Types</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="TEMPLATE" className="text-xs font-medium cursor-pointer">Template Messages</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="REGULAR" className="text-xs font-medium cursor-pointer">Regular Messages</DropdownMenuRadioItem>
 </DropdownMenuRadioGroup>
 <DropdownMenuSeparator className="my-2" />
 <DropdownMenuLabel className="text-[10px] tracking-widest text-slate-400 font-bold mb-1">Recipient</DropdownMenuLabel>
 <DropdownMenuRadioGroup value={recipientFilter} onValueChange={setRecipientFilter}>
 <DropdownMenuRadioItem value="ALL" className="text-xs font-medium cursor-pointer">All Recipients</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="CONTACT" className="text-xs font-medium cursor-pointer">Single Contact</DropdownMenuRadioItem>
 <DropdownMenuRadioItem value="GROUP" className="text-xs font-medium cursor-pointer">Group</DropdownMenuRadioItem>
 </DropdownMenuRadioGroup>
 {activeFiltersCount > 0 && (
 <>
 <DropdownMenuSeparator className="my-2" />
 <DropdownMenuItem 
 onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); setRecipientFilter("ALL"); }}
 className="text-xs font-bold text-rose-600 focus:text-rose-600 cursor-pointer justify-center py-2"
 >
 Clear All Filters
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>

 {activeFiltersCount > 0 && (
 <Button 
 variant="ghost" 
 size="icon"
 onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); setRecipientFilter("ALL"); }}
 className="h-11 w-11 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50"
 >
 <X className="w-5 h-5" />
 </Button>
 )}
 </div>
 </div>

 {/* Table / List Section */}
 <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden min-h-[400px]">
 {isLoading ? (
 <div className="flex items-center justify-center h-[400px]">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
 </div>
 ) : filteredMessages.length === 0 ? (
 <div className="flex flex-col items-center justify-center p-12 text-center h-[400px]">
 <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
 <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600" />
 </div>
 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
 {search ? "No matches found" : "No Scheduled Messages"}
 </h3>
 <p className="text-slate-500 dark:text-slate-400 max-w-sm font-medium mb-8">
 {search ? "Try a different search term" : "You haven't scheduled any messages yet. Start by clicking the \"Schedule Message\" button above."}
 </p>
 {!search && (
 <Button 
 onClick={() => setIsModalOpen(true)}
 className="bg-[#00B074] hover:bg-[#009662] text-white font-bold h-11 px-10 rounded-xl text-xs tracking-widest transition-all shadow-lg shadow-[#00B074]/20"
 >
 Get Started
 </Button>
 )}
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
 <th className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest">Recipient</th>
 <th className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest">Platform</th>
 <th className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest">Message</th>
 <th className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest">Scheduled For</th>
 <th className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest">Status</th>
 <th className="px-6 py-4 text-xs font-bold text-slate-400 tracking-widest text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
 {paginatedMessages.map((m) => (
 <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
 {m.contact ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
 </div>
 <div>
 <p className="text-sm font-bold text-slate-900 dark:text-white">
 {m.contact?.name || m.group?.name || "Unknown"}
 </p>
 <p className="text-xs text-slate-500 font-medium">
 {m.contact ?`+${m.contact.waId}` : "Group Message"}
 </p>
 </div>
 </div>
 </td>
 <td className="px-6 py-4">
 {m.platform === "INSTAGRAM" ? (
 <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400 border border-pink-200/50 dark:border-pink-800/20 rounded-lg px-2.5 py-1 font-bold text-[10px] tracking-wide uppercase">
 Instagram
 </Badge>
 ) : m.platform === "FACEBOOK" ? (
 <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/20 rounded-lg px-2.5 py-1 font-bold text-[10px] tracking-wide uppercase">
 Facebook
 </Badge>
 ) : m.platform === "TIKTOK" ? (
 <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/30 rounded-lg px-2.5 py-1 font-bold text-[10px] tracking-wide uppercase">
 TikTok
 </Badge>
 ) : (
 <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/20 rounded-lg px-2.5 py-1 font-bold text-[10px] tracking-wide uppercase">
 WhatsApp
 </Badge>
 )}
 </td>
 <td className="px-6 py-4">
 {m.templateName && (
 <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold tracking-wider mb-2">
 <Calendar className="w-3 h-3" />
 Template: {m.templateName}
 </span>
 )}
 <p className="text-sm text-slate-600 dark:text-slate-400 font-medium line-clamp-2 max-w-xs block">
 {m.content}
 </p>
 {m.mediaUrl && (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setPreviewImageUrl(m.mediaUrl);
 }}
 className="flex items-center gap-1 mt-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:underline cursor-pointer transition-colors"
 >
 <Paperclip className="w-3.5 h-3.5" />
 <span className="tracking-widest text-[10px]">Attachment included</span>
 </button>
 )}
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <p className="text-sm font-bold text-slate-900 dark:text-white">
 {format(new Date(m.scheduledAt),'MMM d, yyyy')}
 </p>
 <p className="text-xs text-slate-500 font-medium">
 {format(new Date(m.scheduledAt),'hh:mm a')}
 </p>
 </div>
 </td>
 <td className="px-6 py-4">
 <Badge className={cn(
 "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider",
 m.status === 'PROCESSING' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/20" :
 m.status === 'PENDING' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20" : 
 m.status === 'SENT' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20" :
 "bg-rose-100 text-rose-600 dark:bg-rose-900/20"
 )}>
 {m.status === 'PROCESSING' ? 'PROCESSING' : m.status}
 </Badge>
 </td>
 <td className="px-6 py-4 text-right">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
 <MoreVertical className="w-4 h-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-40">
 <DropdownMenuItem 
 className="text-slate-600 font-medium cursor-pointer"
 onClick={() => setViewMessage(m)}
 >
 <Eye className="w-4 h-4 mr-2" />
 View Details
 </DropdownMenuItem>
 {canEdit && (
 <DropdownMenuItem 
 className="text-amber-600 font-medium cursor-pointer"
 onClick={() => handleEdit(m)}
 >
 <Clock className="w-4 h-4 mr-2" />
 Reschedule
 </DropdownMenuItem>
 )}
 {canDelete && (
 <DropdownMenuItem 
 className="text-rose-600 font-medium cursor-pointer"
 onClick={() => handleDelete(m.id)}
 >
 <Trash2 className="w-4 h-4 mr-2" />
 Delete
 </DropdownMenuItem>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 <Pagination 
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 totalRecords={filteredMessages.length}
 pageSize={pageSize}
 />
 </div>
 )}
 </div>
 </div>

 <ScheduleMessageModal 
 isOpen={isModalOpen}
 onClose={handleModalClose}
 onSuccess={() => {
 loadMessages();
 }}
 initialData={selectedMessage ? {
 id: selectedMessage.id,
 content: selectedMessage.content,
 scheduledAt: selectedMessage.scheduledAt,
 contactId: selectedMessage.contactId,
 groupId: selectedMessage.groupId,
 mediaUrl: selectedMessage.mediaUrl,
 templateName: selectedMessage.templateName,
 templateLanguage: selectedMessage.templateLanguage,
 templateParams: selectedMessage.templateParams,
 buttons: selectedMessage.buttons
 } : undefined}
 />

 <ImportScheduledMessagesModal 
 isOpen={isImportModalOpen}
 onClose={() => setIsImportModalOpen(false)}
 onSuccess={loadMessages}
 />

 {/* View Details Dialog */}
 <Dialog open={!!viewMessage} onOpenChange={() => setViewMessage(null)}>
 <DialogContent className="max-w-md p-0 gap-0 bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl overflow-hidden [&>button:first-of-type]:hidden">
 {viewMessage && (
 <>
 {/* Header */}
 <div className={cn(
 "px-6 py-5 flex items-center gap-4",
 viewMessage.status ==='SENT' ? "bg-emerald-500" :
 viewMessage.status ==='FAILED' ? "bg-rose-500" :
 "bg-amber-500"
 )}>
 <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
 {viewMessage.contact ? <User className="w-6 h-6 text-white" /> : <Users className="w-6 h-6 text-white" />}
 </div>
 <div className="min-w-0">
 <DialogTitle className="text-lg font-bold text-white truncate">
 {viewMessage.contact?.name || viewMessage.group?.name || "Unknown Recipient"}
 </DialogTitle>
 <p className="text-white/80 text-xs font-medium mt-0.5">
 {viewMessage.contact ?`+${viewMessage.contact.waId}` : "Group Message"}
 </p>
 </div>
 <div className="ml-auto shrink-0">
 {viewMessage.status ==='SENT' && <CheckCircle2 className="w-8 h-8 text-white/90" />}
 {viewMessage.status ==='FAILED' && <XCircle className="w-8 h-8 text-white/90" />}
 {viewMessage.status ==='PENDING' && <AlertCircle className="w-8 h-8 text-white/90" />}
 </div>
 </div>

 {/* Body */}
 <div className="p-6 space-y-4">
 {/* Status */}
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-400 tracking-widest">Status</span>
 <span className={cn(
 "px-3 py-1 rounded-full text-xs font-bold tracking-wider",
 viewMessage.status ==='PENDING' ? "bg-amber-100 text-amber-600" :
 viewMessage.status ==='SENT' ? "bg-emerald-100 text-emerald-600" :
 "bg-rose-100 text-rose-600"
 )}>
 {viewMessage.status}
 </span>
 </div>

 {/* Template */}
 {viewMessage.templateName && (
 <div className="flex items-start justify-between gap-4">
 <span className="text-xs font-bold text-slate-400 tracking-widest shrink-0">Template</span>
 <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-right">{viewMessage.templateName}</span>
 </div>
 )}

 {/* Message Content */}
 <div className="space-y-1.5">
 <span className="text-xs font-bold text-slate-400 tracking-widest">Message</span>
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
 {viewMessage.content}
 </div>
 </div>

 {/* Attachment */}
 {viewMessage.mediaUrl && (
 <div className="flex items-center justify-between gap-4">
 <span className="text-xs font-bold text-slate-400 tracking-widest shrink-0">Attachment</span>
 {viewMessage.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
 <button
 type="button"
 onClick={() => setPreviewImageUrl(viewMessage.mediaUrl)}
 className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold hover:underline truncate max-w-[200px]"
 >
 <Paperclip className="w-3.5 h-3.5 shrink-0" />
 {viewMessage.mediaUrl.split('/').pop()?.split('?')[0] ||'View File'}
 </button>
 ) : (
 <a
 href={viewMessage.mediaUrl}
 target="_blank"
 rel="noreferrer"
 className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold hover:underline truncate max-w-[200px]"
 >
 <Paperclip className="w-3.5 h-3.5 shrink-0" />
 {viewMessage.mediaUrl.split('/').pop()?.split('?')[0] ||'View File'}
 </a>
 )}
 </div>
 )}

 {/* Divider */}
 <div className="border-t border-slate-100 dark:border-slate-800" />

 {/* Scheduled At */}
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-400 tracking-widest">Scheduled For</span>
 <div className="text-right">
 <p className="text-sm font-bold text-slate-900 dark:text-white">{format(new Date(viewMessage.scheduledAt),'MMM d, yyyy')}</p>
 <p className="text-xs text-slate-500">{format(new Date(viewMessage.scheduledAt),'hh:mm a')}</p>
 </div>
 </div>

 {/* Created At */}
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-400 tracking-widest">Created</span>
 <div className="text-right">
 <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{format(new Date((viewMessage as any).createdAt || viewMessage.scheduledAt),'MMM d, yyyy')}</p>
 <p className="text-xs text-slate-500">{format(new Date((viewMessage as any).createdAt || viewMessage.scheduledAt),'hh:mm a')}</p>
 </div>
 </div>

 {/* ID */}
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-slate-400 tracking-widest">Record ID</span>
 <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">{viewMessage.id}</span>
 </div>
 </div>

 {/* Footer */}
 <div className="px-6 pb-5 flex gap-3">
 {viewMessage.status ==='PENDING' && canEdit && (
 <Button
 variant="outline"
 size="sm"
 className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50"
 onClick={() => { setViewMessage(null); handleEdit(viewMessage); }}
 >
 <Clock className="w-3.5 h-3.5 mr-1.5" />
 Reschedule
 </Button>
 )}
 {canDelete && (
 <Button
 variant="outline"
 size="sm"
 className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50"
 onClick={() => { setViewMessage(null); handleDelete(viewMessage.id); }}
 >
 <Trash2 className="w-3.5 h-3.5 mr-1.5" />
 Delete
 </Button>
 )}
 <Button
 size="sm"
 className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700"
 onClick={() => setViewMessage(null)}
 >
 Close
 </Button>
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>

 {previewImageUrl && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative max-w-3xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-col items-center justify-center overflow-hidden">
        <button
          type="button"
          onClick={() => setPreviewImageUrl(null)}
          className="absolute right-4 top-4 z-50 p-2 rounded-full bg-white text-black hover:bg-slate-100 transition-all shadow-md hover:scale-105"
        >
          <X className="w-5 h-5 text-black" />
        </button>
        <div className="p-2 flex items-center justify-center w-full h-full">
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg border border-white/5"
          />
        </div>
      </div>
    </div>
  )}
  </DashboardLayoutClient>
  );
}
