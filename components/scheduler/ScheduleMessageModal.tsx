"use client";

import React, { useState, useEffect } from'react';
import {
 Dialog,
 DialogContent,
 DialogTitle,
} from'@/components/ui/dialog';
import { Button } from'@/components/ui/button';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Calendar as CalendarIcon, Clock, User, Users, Paperclip, X, FileIcon, ImageIcon, Loader2, Link2, AlertCircle } from'lucide-react';
import { toast } from'sonner';
import { Textarea } from'@/components/ui/textarea';

import { WhatsAppTemplatePreview, type MessageTemplate, type TemplateComponent } from'@/components/whatsapp/WhatsAppTemplatePreview';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getGroups } from'@/app/actions/groups';
import { getTags } from'@/app/actions/tags';
import { getAgents } from'@/app/actions/agents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMMON_CONTACT_VARIABLES,
  insertVariableAtCursor,
} from "@/lib/messaging/contactVariables";

interface ScheduleMessageModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSuccess: () => void;
 initialData?: {
 id: string;
 content: string;
 scheduledAt: Date;
 mediaUrl?: string | null;
 contactId?: string | null;
 groupId?: string | null;
 templateName?: string | null;
 templateLanguage?: string | null;
 templateParams?: any;
 buttons?: { id: string, text: string, url?: string }[] | null;
 } | null;
}

interface SelectionContact {
 id: string;
 waId: string;
 name: string | null;
 lastMessageAt: Date | string | null;
 groups: { groupId: string }[];
 tags: { id: string }[];
 assignedUsers: { id: string }[];
}



export function ScheduleMessageModal({ isOpen, onClose, onSuccess, initialData }: ScheduleMessageModalProps) {
 const [isLoading, setIsLoading] = useState(false);
 const [content, setContent] = useState('');
 const contentRef = React.useRef<HTMLTextAreaElement>(null);
 const [scheduledDate, setScheduledDate] = useState('');
 const [scheduledTime, setScheduledTime] = useState('');
 const [targetType, setTargetType] = useState<'contact' |'multi'>('contact');
 const [selectedId, setSelectedId] = useState('');
 const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
 const [contactSearch, setContactSearch] = useState('');
 const [mediaUrl, setMediaUrl] = useState<string | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
 
 // Multi-selection modes
 const [multiSelectionMode, setMultiSelectionMode] = useState<'individual' |'group' |'tag' |'agent' |'open24'>('individual');
 const [selectedOpen24Ids, setSelectedOpen24Ids] = useState<string[]>([]);
 const [groups, setGroups] = useState<any[]>([]);
 const [tags, setTags] = useState<any[]>([]);
 const [agents, setAgents] = useState<any[]>([]);
 const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
 const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
 const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
 
 // Buttons
 const [buttons, setButtons] = useState<{ id: string, text: string, url?: string }[]>([]);
 const [newButtonText, setNewButtonText] = useState('');
 const [newButtonUrl, setNewButtonUrl] = useState('');
 
 // Templates
 const [templates, setTemplates] = useState<MessageTemplate[]>([]);
 const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
 const [templateParams, setTemplateParams] = useState<string[]>([]);
 const [isTemplateMode, setIsTemplateMode] = useState(false);

 const [contacts, setContacts] = useState<SelectionContact[]>([]);
 const [isDataLoading, setIsDataLoading] = useState(true);

 const filteredContacts = contacts.filter(c => {
 const q = contactSearch.toLowerCase();
 return (
 (c.name ||'').toLowerCase().includes(q) ||
 c.waId.includes(q)
 );
 });

 useEffect(() => {
 if (isOpen) {
 loadData();
 
 if (initialData) {
 setContent(initialData.content);
 setScheduledDate(format(new Date(initialData.scheduledAt),'yyyy-MM-dd'));
 setScheduledTime(format(new Date(initialData.scheduledAt),'HH:mm'));
 setTargetType(initialData.contactId ?'contact' :'multi');
 setSelectedId(initialData.contactId ||'');
 setSelectedContactIds([]);
 setSelectedGroupIds([]);
 setSelectedTagIds([]);
 setSelectedAgentIds([]);
 setSelectedOpen24Ids([]);
 setMultiSelectionMode('individual');
 setContactSearch('');
 setMediaUrl(initialData.mediaUrl || null);
 if (initialData.templateName) {
 setIsTemplateMode(true);
 setTemplateParams(initialData.templateParams || []);
 } else {
 setIsTemplateMode(false);
 }
 if (initialData.buttons) {
 setButtons(initialData.buttons as any);
 } else {
 setButtons([]);
 }
 } else {
 // Default to today and current time + 15 mins
 const now = new Date();
 setScheduledDate(format(now,'yyyy-MM-dd'));
 const future = new Date(now.getTime() + 15 * 60000);
 setScheduledTime(format(future,'HH:mm'));
 // Reset other fields for'New' mode
 setContent('');
 setSelectedId('');
 setSelectedContactIds([]);
 setSelectedGroupIds([]);
 setSelectedTagIds([]);
 setSelectedAgentIds([]);
 setSelectedOpen24Ids([]);
 setMultiSelectionMode('individual');
 setContactSearch('');
 setTargetType('contact');
 setMediaUrl(null);
 setIsTemplateMode(false);
 setSelectedTemplate(null);
 setTemplateParams([]);
 setButtons([]);
 setNewButtonText('');
 setNewButtonUrl('');
 }
 }
 }, [isOpen, initialData]);

 const loadData = async () => {
 setIsDataLoading(true);
 try {
 const [contactsData, templateRes, groupsData, tagsData, agentsData] = await Promise.all([
 getAllContacts(),
 getMessageTemplates(),
 getGroups(),
 getTags(),
 getAgents()
 ]);
 setContacts(contactsData);
 setTemplates(templateRes.success ? templateRes.data.filter((t: any) => t.status ==='APPROVED') : []);
 setGroups(groupsData?.groups || []);
 setTags(tagsData || []);
 setAgents(agentsData || []);
 } catch (error) {
 console.error('Failed to load selection data:', error);
 toast.error('Failed to load contacts and groups');
 } finally {
 setIsDataLoading(false);
 }
 };

 const fileInputRef = React.useRef<HTMLInputElement>(null);

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 // Size limit (Meta allows up to 100MB for docs usually, but we should be reasonable)
 if (file.size > 10 * 1024 * 1024) { // 10MB limit for now
 toast.error('File too large. Maximum size is 10MB.');
 return;
 }

 setIsUploading(true);
 const formData = new FormData();
 formData.append('file', file);

 try {
 const response = await fetch('/api/upload', {
 method:'POST',
 body: formData,
 });

 if (!response.ok) throw new Error('Upload failed');

 const data = await response.json();
 setMediaUrl(data.url);
 toast.success('File uploaded successfully');
 } catch (error) {
 console.error('Upload Error:', error);
 toast.error('Failed to upload file');
 } finally {
 setIsUploading(false);
 }
 };

 const removeAttachment = () => {
 setMediaUrl(null);
 if (fileInputRef.current) fileInputRef.current.value ='';
 };

 const handleSubmit = async () => {
 const isMultiMode = targetType ==='multi';
 const hasSelection = isMultiMode 
 ? (selectedContactIds.length > 0 || selectedGroupIds.length > 0 || selectedTagIds.length > 0 || selectedAgentIds.length > 0 || selectedOpen24Ids.length > 0)
 : !!selectedId;

 if (!scheduledDate || !scheduledTime || !hasSelection) {
 toast.error('Please fill in all required fields');
 return;
 }

 let resolvedContent = content;

 if (isTemplateMode) {
 if (!selectedTemplate) {
 toast.error('Please select a template');
 return;
 }
 
 const bodyComponent = selectedTemplate.components?.find(c => c.type ==='BODY');
 if (bodyComponent?.example?.body_text?.[0]) {
 const paramCount = bodyComponent.example.body_text[0].length;
 if (templateParams.length !== paramCount || templateParams.some(p => !p.trim())) {
 toast.error(`Please fill in all ${paramCount} parameter(s) for this template.`);
 return;
 }
 }

 // Resolve complete template text (Header + Body + Footer) for DB storage preview
 let parts = [];
 const header = selectedTemplate.components?.find(c => c.type ==='HEADER')?.text;
 if (header) parts.push(header);
 
 let body = bodyComponent?.text ||'';
 templateParams.forEach((param, idx) => {
 body = body.replaceAll(`{{${idx + 1}}}`, param);
 });
 if (body) parts.push(body);
 
 const footer = selectedTemplate.components?.find(c => c.type ==='FOOTER')?.text;
 if (footer) parts.push(footer);
 
 resolvedContent = parts.join('\n\n') ||`Template: ${selectedTemplate.name}`;
 } else if (!content) {
 toast.error('Please type a message');
 return;
 }

 const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
 
 // Use a 2-minute buffer and clear seconds/milliseconds for a fair comparison
 const nowWithBuffer = new Date();
 nowWithBuffer.setMinutes(nowWithBuffer.getMinutes() - 2); 
 nowWithBuffer.setSeconds(0, 0);
 
 const compareDate = new Date(scheduledAt);
 compareDate.setSeconds(0, 0);

 if (compareDate < nowWithBuffer) {
 toast.error('Scheduled time must be in the future');
 return;
 }

 setIsLoading(true);
 try {
 const basePayload = {
 content: resolvedContent,
 scheduledAt,
 mediaUrl: isTemplateMode ? undefined : mediaUrl || undefined,
 templateName: isTemplateMode ? selectedTemplate?.name : undefined,
 templateLanguage: isTemplateMode ? selectedTemplate?.language : undefined,
 templateParams: isTemplateMode && templateParams.length > 0 ? templateParams : undefined,
 buttons: !isTemplateMode && buttons.length > 0 ? buttons : undefined,
 };

 let finalContactIds: string[] = [];

 if (targetType ==='multi') {
 const targeted = new Set<string>();
 
 // From individual selection
 selectedContactIds.forEach(id => targeted.add(id));
 
 // From groups
 if (selectedGroupIds.length > 0) {
 contacts.forEach((c: any) => {
 if (c.groups?.some((g: any) => selectedGroupIds.includes(g.groupId))) {
 targeted.add(c.id);
 }
 });
 }
 
 // From tags
 if (selectedTagIds.length > 0) {
 contacts.forEach((c: any) => {
 if (c.tags?.some((t: any) => selectedTagIds.includes(t.id))) {
 targeted.add(c.id);
 }
 });
 }
 
 // From agents
 if (selectedAgentIds.length > 0) {
 contacts.forEach((c: any) => {
 if (c.assignedUsers?.some((u: any) => selectedAgentIds.includes(u.id))) {
 targeted.add(c.id);
 }
 });
 }

 // From 24h open
 if (selectedOpen24Ids.length > 0) {
 selectedOpen24Ids.forEach(id => targeted.add(id));
 }
 
 finalContactIds = Array.from(targeted);
 
 if (finalContactIds.length === 0) {
 toast.error('No contacts selected');
 return;
 }

 // Create one scheduled message per selected contact
 const results = await Promise.all(
 finalContactIds.map(cid =>
 createScheduledMessage({ ...basePayload, contactId: cid })
 )
 );
 const failed = results.filter(r => !r.success);
 if (failed.length > 0) {
 toast.error(`${failed.length} message(s) failed to schedule`);
 } else {
 toast.success(`${finalContactIds.length} message(s) scheduled successfully`);
 onSuccess();
 onClose();
 }
 } else {
 const payload = {
 ...basePayload,
 contactId: targetType ==='contact' ? selectedId : undefined,
 };
 const res = initialData 
 ? await updateScheduledMessage(initialData.id, payload)
 : await createScheduledMessage(payload);

 if (res.success) {
 toast.success(initialData ?'Message rescheduled successfully' :'Message scheduled successfully');
 onSuccess();
 onClose();
 } else {
 toast.error(res.error ||'Failed to save message');
 }
 }
 } catch (error) {
 console.error(error);
 toast.error('An unexpected error occurred');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="max-w-xl p-0 gap-0 bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
 <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
 <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <CalendarIcon className="w-5 h-5 text-emerald-600" />
 {initialData ?'Reschedule Message' :'Schedule New Message'}
 </DialogTitle>
 </div>

 <div className="p-8 space-y-6 overflow-y-auto flex-1">
 {/* Target Selection */}
 <div className="space-y-4">
 <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
 <button 
 onClick={() => { 
 setTargetType('contact'); 
 setSelectedId(''); 
 setSelectedContactIds([]);
 setSelectedGroupIds([]);
 setSelectedTagIds([]);
 setSelectedAgentIds([]);
 }}
 className={cn(
 "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
 targetType ==='contact' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
 )}
 >
 <User className="w-3.5 h-3.5" />
 Single Contact
 </button>
 <button 
 onClick={() => { setTargetType('multi'); setSelectedId(''); }}
 className={cn(
 "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
 targetType ==='multi' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
 )}
 >
 <Users className="w-3.5 h-3.5" />
 Multiple Contacts
 </button>
 </div>

 {targetType ==='contact' ? (
 <div className="space-y-2">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">SELECT CONTACT</Label>
 <Select value={selectedId} onValueChange={setSelectedId} disabled={isDataLoading}>
 <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-emerald-500/20">
 <SelectValue placeholder="Select a contact..." />
 </SelectTrigger>
 <SelectContent className="max-h-[300px]">
 {contacts.map(c => (
 <SelectItem key={c.id} value={c.id}>
 {c.name ||'Unnamed'} (+{c.waId})
 </SelectItem>
 ))}
 {contacts.length === 0 && !isDataLoading && (
 <div className="py-2 px-4 text-xs text-slate-400">No contacts found</div>
 )}
 </SelectContent>
 </Select>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1">
 {(['individual','group','tag','agent','open24'] as const).map((mode) => (
 <button
 key={mode}
 onClick={() => setMultiSelectionMode(mode)}
 className={cn(
 "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
 multiSelectionMode === mode 
 ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
 : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600"
 )}
 >
 {mode ==='individual' ?'Contacts' : mode ==='tag' ?'Labels' : mode ==='open24' ?'24h Open' :`${mode}s`}
 </button>
 ))}
 </div>
 {(() => {
 const targeted = new Set<string>();
 selectedContactIds.forEach(id => targeted.add(id));
 if (selectedGroupIds.length > 0) contacts.forEach((c: any) => { if (c.groups?.some((g: any) => selectedGroupIds.includes(g.groupId))) targeted.add(c.id); });
 if (selectedTagIds.length > 0) contacts.forEach((c: any) => { if (c.tags?.some((t: any) => selectedTagIds.includes(t.id))) targeted.add(c.id); });
 if (selectedAgentIds.length > 0) contacts.forEach((c: any) => { if (c.assignedUsers?.some((u: any) => selectedAgentIds.includes(u.id))) targeted.add(c.id); });
 if (selectedOpen24Ids.length > 0) selectedOpen24Ids.forEach(id => targeted.add(id));
 
 return targeted.size > 0 && (
 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
 {targeted.size} TARGETED
 </span>
 );
 })()}
 </div>

 {multiSelectionMode ==='individual' && (
 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
 {/* Search */}
 <div className="relative">
 <Input
 placeholder="Search contacts..."
 value={contactSearch}
 onChange={e => setContactSearch(e.target.value)}
 className="h-10 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 pr-10 focus:ring-emerald-500/20"
 />
 </div>

 {/* Select All / Clear */}
 <div className="flex items-center justify-between px-1">
 <button
 type="button"
 onClick={() => {
 const allIds = filteredContacts.map(c => c.id);
 const allSelected = allIds.every(id => selectedContactIds.includes(id));
 if (allSelected) {
 setSelectedContactIds(prev => prev.filter(id => !allIds.includes(id)));
 } else {
 setSelectedContactIds(prev => [...new Set([...prev, ...allIds])]);
 }
 }}
 className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wide"
 >
 {filteredContacts.every(c => selectedContactIds.includes(c.id)) ?'Deselect All' :'Select All'}
 </button>
 {selectedContactIds.length > 0 && (
 <button
 type="button"
 onClick={() => setSelectedContactIds([])}
 className="text-[11px] font-bold text-red-400 hover:text-red-500 uppercase tracking-wide"
 >
 Clear
 </button>
 )}
 </div>

 {/* Contact Checklist */}
 <div className="max-h-[200px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 divide-y divide-slate-100 dark:divide-slate-800">
 {filteredContacts.length === 0 && (
 <div className="py-4 text-center text-xs text-slate-400">No contacts found</div>
 )}
 {filteredContacts.map(c => {
 const isChecked = selectedContactIds.includes(c.id);
 return (
 <label
 key={c.id}
 className={cn(
 "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors",
 isChecked && "bg-emerald-50/50 dark:bg-emerald-900/10"
 )}
 >
 <input
 type="checkbox"
 checked={isChecked}
 onChange={() => {
 setSelectedContactIds(prev =>
 isChecked
 ? prev.filter(id => id !== c.id)
 : [...prev, c.id]
 );
 }}
 className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
 />
 <div className="min-w-0">
 <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.name ||'Unnamed'}</p>
 <p className="text-xs text-slate-400">+{c.waId}</p>
 </div>
 {isChecked && (
 <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
 )}
 </label>
 );
 })}
 </div>
 </div>
 )}

 {multiSelectionMode ==='group' && (
 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
 <div className="max-h-[250px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 divide-y divide-slate-100 dark:divide-slate-800">
 {groups.length === 0 && (
 <div className="py-8 text-center text-xs text-slate-400">No groups found</div>
 )}
 {groups.map(g => {
 const isChecked = selectedGroupIds.includes(g.id);
 const contactCount = contacts.filter((c: any) => c.groups?.some((cg: any) => cg.groupId === g.id)).length;
 return (
 <label
 key={g.id}
 className={cn(
 "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors",
 isChecked && "bg-emerald-50/50 dark:bg-emerald-900/10"
 )}
 >
 <div className="flex items-center gap-3 min-w-0">
 <input
 type="checkbox"
 checked={isChecked}
 onChange={() => {
 setSelectedGroupIds(prev =>
 isChecked
 ? prev.filter(id => id !== g.id)
 : [...prev, g.id]
 );
 }}
 className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
 />
 <div className="min-w-0">
 <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{g.name}</p>
 {g.description && <p className="text-[10px] text-slate-400 truncate">{g.description}</p>}
 </div>
 </div>
 <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
 {contactCount} Contacts
 </span>
 </label>
 );
 })}
 </div>
 </div>
 )}

 {multiSelectionMode ==='tag' && (
 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
 <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto p-1">
 {tags.length === 0 && (
 <div className="col-span-2 py-8 text-center text-xs text-slate-400">No labels found</div>
 )}
 {tags.map(t => {
 const isChecked = selectedTagIds.includes(t.id);
 const contactCount = contacts.filter((c: any) => c.tags?.some((ct: any) => ct.id === t.id)).length;
 return (
 <label
 key={t.id}
 className={cn(
 "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all border",
 isChecked 
 ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500/20" 
 : "bg-slate-50/50 dark:bg-slate-800/30 border-transparent"
 )}
 >
 <div className="flex items-center gap-2 min-w-0">
 <input
 type="checkbox"
 checked={isChecked}
 onChange={() => {
 setSelectedTagIds(prev =>
 isChecked
 ? prev.filter(id => id !== t.id)
 : [...prev, t.id]
 );
 }}
 className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer shrink-0"
 />
 <div className="flex items-center gap-1.5 min-w-0">
 <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
 <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{t.name}</p>
 </div>
 </div>
 <span className="text-[9px] font-bold text-slate-400">
 ({contactCount})
 </span>
 </label>
 );
 })}
 </div>
 </div>
 )}

 {multiSelectionMode ==='agent' && (
 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
 <div className="max-h-[250px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 divide-y divide-slate-100 dark:divide-slate-800">
 {agents.length === 0 && (
 <div className="py-8 text-center text-xs text-slate-400">No agents found</div>
 )}
 {agents.map(a => {
 const isChecked = selectedAgentIds.includes(a.id);
 const contactCount = contacts.filter((c: any) => c.assignedUsers?.some((u: any) => u.id === a.id)).length;
 return (
 <label
 key={a.id}
 className={cn(
 "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors",
 isChecked && "bg-emerald-50/50 dark:bg-emerald-900/10"
 )}
 >
 <div className="flex items-center gap-3 min-w-0">
 <input
 type="checkbox"
 checked={isChecked}
 onChange={() => {
 setSelectedAgentIds(prev =>
 isChecked
 ? prev.filter(id => id !== a.id)
 : [...prev, a.id]
 );
 }}
 className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
 />
 <div className="min-w-0">
 <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{a.name || a.email}</p>
 <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest">{a.role}</p>
 </div>
 </div>
 <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
 {contactCount} Contacts
 </span>
 </label>
 );
 })}
 </div>
 </div>
 )}

 {multiSelectionMode ==='open24' && (
 <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
 {(() => {
 const open24Contacts = contacts.filter(c => {
 if (!c.lastMessageAt) return false;
 const lastMsg = new Date(c.lastMessageAt).getTime();
 return Date.now() - lastMsg < 24 * 60 * 60 * 1000;
 });

 return (
 <>
 <div className="flex items-center justify-between px-1">
 <button
 type="button"
 onClick={() => {
 const allIds = open24Contacts.map(c => c.id);
 const allSelected = allIds.every(id => selectedOpen24Ids.includes(id));
 if (allSelected) {
 setSelectedOpen24Ids(prev => prev.filter(id => !allIds.includes(id)));
 } else {
 setSelectedOpen24Ids(prev => [...new Set([...prev, ...allIds])]);
 }
 }}
 className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wide"
 >
 {open24Contacts.length > 0 && open24Contacts.every(c => selectedOpen24Ids.includes(c.id)) ?'Deselect All' :'Select All'}
 </button>
 <span className="text-[10px] text-slate-400 font-medium">
 Active in last 24 hours
 </span>
 </div>

 <div className="max-h-[250px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 divide-y divide-slate-100 dark:divide-slate-800">
 {open24Contacts.length === 0 && (
 <div className="py-8 text-center text-xs text-slate-400">No active contacts in last 24h</div>
 )}
 {open24Contacts.map(c => {
 const isChecked = selectedOpen24Ids.includes(c.id);
 return (
 <label
 key={c.id}
 className={cn(
 "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors",
 isChecked && "bg-emerald-50/50 dark:bg-emerald-900/10"
 )}
 >
 <input
 type="checkbox"
 checked={isChecked}
 onChange={() => {
 setSelectedOpen24Ids(prev =>
 isChecked
 ? prev.filter(id => id !== c.id)
 : [...prev, c.id]
 );
 }}
 className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
 />
 <div className="min-w-0">
 <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.name ||'Unnamed'}</p>
 <p className="text-xs text-slate-400">+{c.waId}</p>
 </div>
 <span className="ml-auto text-[10px] text-emerald-600 font-medium whitespace-nowrap">
 {(() => {
 const diff = Date.now() - new Date(c.lastMessageAt!).getTime();
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 return hours > 0 ?`${hours}h ago` :`${mins}m ago`;
 })()}
 </span>
 </label>
 );
 })}
 </div>
 </>
 );
 })()}
 </div>
 )}
 </div>
 )}
 </div>

 {/* Message Type Selection */}
 <div className="flex items-center gap-4">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">MESSAGE TYPE</Label>
 <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
 <button 
 onClick={() => { setIsTemplateMode(false); setSelectedTemplate(null); setTemplateParams([]); }}
 className={cn(
 "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
 !isTemplateMode ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
 )}
 >
 Regular
 </button>
 <button 
 onClick={() => setIsTemplateMode(true)}
 className={cn(
 "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
 isTemplateMode ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
 )}
 >
 Template
 </button>
 </div>
 </div>

 {isTemplateMode ? (
 <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl">
 <div className="space-y-2">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">SELECT TEMPLATE</Label>
 <Select 
 value={selectedTemplate?.name ||''} 
 onValueChange={(val) => {
 const template = templates.find(t => t.name === val);
 setSelectedTemplate(template || null);
 setTemplateParams([]);
 }}
 >
 <SelectTrigger className="h-12 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-emerald-500/20 font-medium">
 <SelectValue placeholder="Select a pre-approved template..." />
 </SelectTrigger>
 <SelectContent className="max-h-[300px]">
 {templates.map(t => (
 <SelectItem key={t.name} value={t.name}>
 {t.name} ({t.language})
 </SelectItem>
 ))}
 {templates.length === 0 && (
 <div className="py-2 px-4 text-xs text-slate-400">No templates found</div>
 )}
 </SelectContent>
 </Select>
 </div>

 {selectedTemplate && selectedTemplate.components?.find(c => c.type ==='BODY')?.example?.body_text?.[0] && (
 <div className="space-y-3 pt-2">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">TEMPLATE PARAMETERS</Label>
 {selectedTemplate.components.find(c => c.type ==='BODY')?.example?.body_text?.[0].map((exampleText: string, index: number) => (
 <div key={index} className="space-y-1">
 <Label className="text-xs font-medium text-slate-500 ml-1">Variable {'{{'}{index + 1}{'}}'} (e.g. {exampleText})</Label>
 <Input
 placeholder={`Enter value for {{${index + 1}}}`}
 value={templateParams[index] ||''}
 onChange={(e) => {
 const newParams = [...templateParams];
 newParams[index] = e.target.value;
 setTemplateParams(newParams);
 }}
 className="bg-white dark:bg-slate-800/50 h-11 border-slate-200 dark:border-slate-800 rounded-lg text-sm px-4 focus:ring-emerald-500/20 font-medium w-full"
 />
 </div>
 ))}
 </div>
 )}

 {selectedTemplate && (
 <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
 <div className="flex items-center justify-between mb-4">
 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Messaging Preview</span>
 <div className="flex items-center gap-1.5">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
 <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight">Active Rendering</span>
 </div>
 </div>
 
 {/* The preview needs extra height. Usually it is self-containing and scale-able */}
 <div className="relative overflow-hidden pt-4 pb-6 px-4 bg-white/50 dark:bg-[#111b21]/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
 <div className="scale-[0.9] origin-top max-w-sm mx-auto">
 <WhatsAppTemplatePreview
 template={selectedTemplate as any}
 getStatusColor={() => "bg-[#00B074]/10 text-[#00B074] border-[#00B074]/20"}
 testValues={templateParams.reduce((acc, val, idx) => {
 if (val) acc[(idx + 1).toString()] = val;
 return acc;
 }, {} as Record<string, string>)}
 />
 </div>
 </div>
 </div>
 )}

 <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
 <div className="flex items-center justify-between px-1">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">INTERACTIVE BUTTONS (MAX 3)</Label>
 {buttons.length === 1 && buttons[0].url && (
 <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md animate-pulse">
 <Link2 className="w-3 h-3" />
 DIRECT REDIRECT ACTIVE
 </div>
 )}
 </div>
 
 {buttons.some(b => b.url) && buttons.length > 1 && (
 <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg">
 <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
 <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-normal">
 Note: Since you have multiple buttons, direct URL redirection is not possible. The system will send the link once the user clicks the button. Use a single button for direct redirect.
 </p>
 </div>
 )}
 <div className="space-y-3">
 {buttons.map((btn, index) => (
 <div key={index} className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
 <div className="flex items-center gap-2 mb-2">
 <Input 
 value={btn.text} 
 readOnly 
 className="h-9 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-lg text-sm px-3 focus:ring-emerald-500/20 font-semibold w-full"
 />
 <Button 
 variant="ghost" 
 size="icon"
 onClick={() => setButtons(prev => prev.filter((_, i) => i !== index))}
 className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 h-9 w-9"
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 <div className="flex items-center gap-2">
 <Link2 className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
 <Input 
 value={btn.url ||''} 
 onChange={(e) => {
 setButtons(prev => prev.map((b, i) => i === index ? { ...b, url: e.target.value } : b));
 }}
 placeholder="https://example.com (optional)"
 className="h-8 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 focus:ring-emerald-500/20 font-medium w-full text-blue-600 placeholder:text-slate-300"
 />
 </div>
 </div>
 ))}
 
 {buttons.length < 3 && (
 <div className="space-y-2 bg-white dark:bg-slate-800/20 rounded-xl p-3 border border-dashed border-slate-300 dark:border-slate-700">
 <div className="flex items-center gap-2">
 <Input 
 placeholder="Button text..."
 value={newButtonText}
 onChange={(e) => setNewButtonText(e.target.value)}
 onKeyDown={(e) => {
 if (e.key ==='Enter' && newButtonText.trim()) {
 e.preventDefault();
 setButtons(prev => [...prev, { id:`btn_${Date.now()}`, text: newButtonText.trim(), url: newButtonUrl.trim() || undefined }]);
 setNewButtonText('');
 setNewButtonUrl('');
 }
 }}
 className="h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 focus:ring-emerald-500/20 font-medium w-full"
 />
 <Button 
 onClick={() => {
 if (newButtonText.trim()) {
 setButtons(prev => [...prev, { id:`btn_${Date.now()}`, text: newButtonText.trim(), url: newButtonUrl.trim() || undefined }]);
 setNewButtonText('');
 setNewButtonUrl('');
 }
 }}
 disabled={!newButtonText.trim()}
 className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shrink-0 h-9 px-4 rounded-lg font-bold text-xs uppercase tracking-widest"
 >
 Add
 </Button>
 </div>
 <div className="flex items-center gap-2">
 <Link2 className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
 <Input 
 placeholder="https://example.com (optional URL)"
 value={newButtonUrl}
 onChange={(e) => setNewButtonUrl(e.target.value)}
 className="h-8 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-xs px-3 focus:ring-emerald-500/20 font-medium w-full text-blue-600 placeholder:text-slate-300"
 />
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-6">
  {/* Message Content */}
  <div className="space-y-2 relative">
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">MESSAGE CONTENT</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-slate-400">Insert:</span>
        {COMMON_CONTACT_VARIABLES.slice(0, 3).map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => insertVariableAtCursor(contentRef.current, content, v.value, setContent)}
            className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] hover:bg-emerald-100 border border-emerald-200/50 dark:border-emerald-800 transition-colors cursor-pointer"
            title={v.description}
          >
            + {v.label}
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              More...
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 shadow-xl rounded-xl p-1 z-50">
            {COMMON_CONTACT_VARIABLES.map((v) => (
              <DropdownMenuItem
                key={v.value}
                onClick={() => insertVariableAtCursor(contentRef.current, content, v.value, setContent)}
                className="text-xs py-2 px-3 rounded-lg cursor-pointer flex flex-col items-start hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200">{v.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">{v.value}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <Textarea 
      ref={contentRef}
      placeholder="Type the message you want to schedule..."
      value={content}
      onChange={(e) => setContent(e.target.value)}
      className="min-h-[120px] bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-sm p-4 focus:ring-emerald-500/20 resize-none font-medium"
    />
 {content.match(/(https?:\/\/[^\s]+)/g) && buttons.length < 3 && (
 <div className="absolute bottom-3 right-3">
 <Button
 size="sm"
 variant="outline"
 onClick={() => {
 const urlRegex = /(https?:\/\/[^\s]+)/g;
 const matches = content.match(urlRegex);
 if (matches) {
 let newContent = content;
 const newButtons = [...buttons];
 matches.forEach(url => {
 if (newButtons.length < 3) {
 const alreadyExists = newButtons.some(b => b.url === url);
 if (!alreadyExists) {
 newButtons.push({ id:`btn_${Date.now()}_${Math.random()}`, text:'Visit Link', url });
 newContent = newContent.replace(url,'').trim();
 }
 }
 });
 setContent(newContent);
 setButtons(newButtons);
 toast.success('Links moved to buttons');
 }
 }}
 className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider h-7 rounded-lg"
 >
 <Link2 className="w-3 h-3 mr-1" />
 Move links to buttons
 </Button>
 </div>
 )}
 </div>

 {/* Attachment Section */}
 <div className="space-y-2">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ATTACHMENT (IMAGE OR DOCUMENT)</Label>
 
 {!mediaUrl ? (
 <div 
 onClick={() => fileInputRef.current?.click()}
 className={cn(
 "h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
 isUploading ? "opacity-50 pointer-events-none" : "hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:border-emerald-500/50"
 )}
 >
 <input 
 type="file" 
 ref={fileInputRef} 
 className="hidden" 
 onChange={handleFileChange}
 accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
 />
 {isUploading ? (
 <>
 <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Uploading...</p>
 </>
 ) : (
 <>
 <Paperclip className="w-5 h-5 text-slate-400" />
 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Add Attachment</p>
 </>
 )}
 </div>
 ) : (
 <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 relative group">
 <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
 {mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
 <ImageIcon className="w-6 h-6" />
 ) : (
 <FileIcon className="w-6 h-6" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-slate-900 dark:text-white truncate uppercase tracking-tight">
 {mediaUrl.split('/').pop()}
 </p>
 {mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
 <button 
 type="button"
 onClick={() => setIsImagePreviewOpen(true)}
 className="text-[10px] text-emerald-600 font-medium hover:underline block text-left"
 >
 View Attachment
 </button>
 ) : (
 <a 
 href={mediaUrl} 
 target="_blank" 
 rel="noopener noreferrer"
 className="text-[10px] text-emerald-600 font-medium hover:underline block text-left"
 >
 View Attachment
 </a>
 )}
 </div>
 <button 
 onClick={removeAttachment}
 className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 
 {isImagePreviewOpen && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
 <div className="relative max-w-3xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-col items-center justify-center overflow-hidden">
 <button
 type="button"
 onClick={() => setIsImagePreviewOpen(false)}
 className="absolute right-4 top-4 z-50 p-2 rounded-full bg-white text-black hover:bg-slate-100 transition-all shadow-md hover:scale-105"
 >
 <X className="w-5 h-5 text-black" />
 </button>
 <div className="p-2 flex items-center justify-center w-full h-full">
 <img
 src={mediaUrl}
 alt="Preview"
 className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg border border-white/5"
 />
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )}

 {/* Schedule Time */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">DATE</Label>
 <Input 
 type="date"
 value={scheduledDate}
 onChange={(e) => setScheduledDate(e.target.value)}
 className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-emerald-500/20 font-medium w-full"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">TIME</Label>
 <Input 
 type="time"
 value={scheduledTime}
 onChange={(e) => setScheduledTime(e.target.value)}
 className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-emerald-500/20 font-medium w-full"
 />
 </div>
 </div>

 {/* Schedule Summary */}
 {scheduledDate && scheduledTime && (
 <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-4">
 <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
 <Clock className="w-5 h-5" />
 </div>
 <div>
 <p className="text-[10px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest">Selected Slot</p>
 <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 italic">
 {format(new Date(`${scheduledDate}T${scheduledTime}`),'eeee, MMM do')} at {format(new Date(`${scheduledDate}T${scheduledTime}`),'hh:mm a')}
 </p>
 </div>
 </div>
 )}
 </div>

 <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
 <Button
 variant="ghost"
 onClick={onClose}
 className="font-bold text-xs uppercase tracking-widest text-slate-500 hover:text-slate-700"
 >
 Cancel
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={isLoading || isDataLoading}
 className="bg-[#10B981] hover:bg-[#059669] text-white font-bold px-8 h-11 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
 >
 {isLoading ? (initialData ?'Updating...' :'Scheduling...') : (initialData ?'Update Schedule' :'Schedule Message')}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );
}
