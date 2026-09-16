'use client';
import { useTranslations } from 'next-intl';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Search, Mail, Phone, User, Users, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ListFilter, Edit2, Trash2, Upload, Download, Instagram, Music2, MessageCircle, X, SlidersHorizontal, Facebook, MessageSquare, Calendar, RotateCcw, Tag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CreateContactModal } from './CreateContactModal';
import { ContactChatDrawer } from './ContactChatDrawer';
import { ContactProfileDrawer, type DrawerContact } from './ContactProfileDrawer';
import { getGroups } from '@/app/actions/groups';
import { getTags } from '@/app/actions/tags';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { AddToGroupModal } from './AddToGroupModal';
import { CreateGroupModal } from './create-group-modal';
import { ManageGroupsButton } from './manage-groups-button';
import { Check } from 'lucide-react';
import { ModalButton } from '@/components/ui/modal-button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { isInternalCustomAttribute } from '@/lib/contacts/attributes';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface Contact {
    id: string;
    waId: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    profilePic?: string | null;
    isBlocked?: boolean;
    isAiBotEnabled?: boolean;
    lastMessageAt: Date;
    createdAt?: Date | null;
    notes?: string | null;
    groups?: Array<{
        group: {
            id: string;
            name: string;
            color: string | null;
        };
    }>;
    tags?: Array<{
        id: string;
        name: string;
        color: string | null;
    }>;
    assignedUserId?: string | null;
    assignedUsers?: Array<{
        id: string;
        name: string | null;
        email: string;
    }>;
    platform?: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
}

interface ContactTableProps {
    initialContacts: Contact[];
    total: number;
    totalPages: number;
    currentPage: number;
    limit: number;
}


function getRelativeTime(date: Date | string | null | undefined) {
    if (!date) return '—';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return diffHours + 'h ago';
    const diffDays = Math.floor(diffHours / 24);
    return diffDays + 'd ago';
}

function formatAddedOn(date: Date | string | null | undefined) {
    if (!date) return { dateStr: '—', timeStr: '' };
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const timeStr = hours + ':' + minutes + ' ' + ampm;
    return { dateStr, timeStr };
}
function extractDob(notes: string | null | undefined): string {
    if (!notes) return '—';
    const dobMatch = notes.match(/DOB:\s*([^,]+)/);
    const val = dobMatch ? dobMatch[1].trim() : '';
    return val === 'undefined' || val === 'null' ? '—' : (val || '—');
}
function extractSource(notes: string | null | undefined): string {
    if (!notes) return '—';
    const sourceMatch = notes.match(/Source:\s*(.+)$/);
    const val = sourceMatch ? sourceMatch[1].trim() : '';
    return val === 'undefined' || val === 'null' ? '—' : (val || '—');
}
import { ImportContactsModal } from './ImportContactsModal';
export function ContactTable({ initialContacts, total, totalPages, currentPage, limit }: ContactTableProps) {
    const t = useTranslations('Contacts');
    const router = useRouter();
    const canManageGroups = true;
    const [search, setSearch] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [groups, setGroups] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedChatContact, setSelectedChatContact] = useState<Contact | null>(null);
    const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isAddToGroupOpen, setIsAddToGroupOpen] = useState(false);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [drawerContact, setDrawerContact] = useState<DrawerContact | null>(null);
    const [availableTags, setAvailableTags] = useState<any[]>([]);
    const [activeFilterTab, setActiveFilterTab] = useState<'general' | 'status' | 'tags'>('general');
    const [tagSearch, setTagSearch] = useState('');
    const [isSelectingAll, setIsSelectingAll] = useState(false);
    const [filters, setFilters] = useState<{
        createdAtMode: string;
        dateFrom: string;
        dateTo: string;
        tagIds: string[];
        platform: string;
        isBlocked: string; 
    }>({
        createdAtMode: 'All',
        dateFrom: '',
        dateTo: '',
        tagIds: [],
        platform: 'ALL',
        isBlocked: 'All',
    });

    const hasActiveFilters = 
        filters.createdAtMode !== 'All' || 
        filters.tagIds.length > 0 || 
        filters.platform !== 'ALL' || 
        filters.isBlocked !== 'All' ||
        selectedGroupId !== '';

    useEffect(() => {
        loadGroups();
        loadTags();
         const sp = new URLSearchParams(window.location.search);

        const urlSearch = sp.get('search') || '';
        if (urlSearch) setSearch(urlSearch);

        const urlGroupId = sp.get('groupId') || '';
        if (urlGroupId) setSelectedGroupId(urlGroupId);

        let mode = 'All';
        const dFrom = sp.get('dateFrom') || '';
        const dTo = sp.get('dateTo') || '';
        if (dFrom || dTo) {
            mode = 'Custom';
        }

        setFilters(prev => ({
            ...prev,
            createdAtMode: mode,
            dateFrom: dFrom,
            dateTo: dTo,
            tagIds: sp.get('tagIds')?.split(',').filter(Boolean) || [],
            platform: sp.get('platform') || 'ALL',
            isBlocked: sp.get('isBlocked') || 'All',
        }));
    }, []);

    const loadTags = async () => {
        try {
            const tags = await getTags();
            if (Array.isArray(tags)) {
                setAvailableTags(tags);
            }
        } catch (e) {
            console.error('Failed to load tags:', e);
        }
    }

    const toggleSelectAll = async () => {
        if (selectedIds.length >= initialContacts.length && initialContacts.length > 0) {
            setSelectedIds([]);
        } else {
            setIsSelectingAll(true);
            try {
                toast.loading('Selecting all contacts...', { id: 'selectAll' });
                const allContacts = await getAllContacts(
                    filters.dateFrom, 
                    filters.dateTo, 
                    search, 
                    selectedGroupId, 
                    filters.tagIds,
                    filters.platform === 'ALL' ? undefined : filters.platform
                );
                if (allContacts && Array.isArray(allContacts)) {
                    setSelectedIds(allContacts.map((c: any) => c.id));
                    toast.success(`Selected ${allContacts.length} contacts`, { id: 'selectAll' });
                }
            } catch (error) {
                console.error('Failed to select all:', error);
                toast.error('Failed to select all contacts', { id: 'selectAll' });
            } finally {
                setIsSelectingAll(false);
            }
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const loadGroups = async () => {
        try {
            const { groups: fetchedGroups } = await getGroups();
            setGroups(fetchedGroups as any);
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    };

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(window.location.search);
        params.set('page', newPage.toString());
        router.push(`/dashboard/contacts?${params.toString()}`);
    };

    const handleLimitChange = (newLimit: string) => {
        const params = new URLSearchParams(window.location.search);
        params.set('limit', newLimit);
        params.set('page', '1');
        router.push(`/dashboard/contacts?${params.toString()}`);
    };

    const handleApplyFilters = () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (selectedGroupId) params.set('groupId', selectedGroupId);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        if (filters.tagIds.length > 0) params.set('tagIds', filters.tagIds.join(','));
        if (filters.platform !== 'ALL') params.set('platform', filters.platform);
        if (filters.isBlocked !== 'All') params.set('isBlocked', filters.isBlocked);
        if (limit && limit !== 20) params.set('limit', limit.toString());

        params.set('page', '1');
        router.push(`/dashboard/contacts?${params.toString()}`);
        setIsFilterModalOpen(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        handleApplyFilters();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure from deleting this contact?')) return;
        try {
            await deleteContact(id);
            toast.success('Contact deleted');
            refreshData();
        } catch (_err: unknown) {
            const msg = (_err as Error)?.message || 'Unknown error';
            toast.error(`Failed to delete contact: ${msg}`);
            console.error(_err);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected contacts?`)) return;
        try {
            toast.loading(`Deleting ${selectedIds.length} contacts...`, { id: 'bulkDelete' });
            const result = await bulkDeleteContacts(selectedIds);
            if (result.success) {
                toast.success('Selected contacts deleted successfully', { id: 'bulkDelete' });
                setSelectedIds([]);
                refreshData();
            } else {
                toast.error('Failed to delete contacts', { id: 'bulkDelete' });
            }
        } catch (_err: unknown) {
            const msg = (_err as Error)?.message || 'Unknown error';
            toast.error(`Failed to delete contacts: ${msg}`, { id: 'bulkDelete' });
            console.error(_err);
        }
    };

    const handleToggleBlock = async (contact: Contact) => {
        try {
            await updateContact(contact.id, { isBlocked: !contact.isBlocked });
            toast.success(contact.isBlocked ? t('contactUnblocked') : t('contactBlocked'));
            refreshData();
        } catch (_err: unknown) {
            const msg = (_err as Error)?.message || 'Unknown error';
            toast.error(`Failed to update status: ${msg}`);
        }
    };

    const handleExport = async () => {
        try {
            toast.message('Exporting contacts...');
            
             const allContacts = await getAllContacts(
                filters.dateFrom, 
                filters.dateTo, 
                search, 
                selectedGroupId, 
                filters.tagIds
            );

            if (!allContacts || allContacts.length === 0) {
                toast.error('No contacts found for the selected criteria');
                return;
            }

            const exportData = allContacts.map((contact: any) => ({
                'Name': contact.name || '',
                'Mobile Number': contact.waId,
                'Email': contact.email || '',
                'Date Of Birth': extractDob(contact.notes),
                'Tags': contact.tags?.map((t: any) => t.name).join(',') || '',
                'Source': extractSource(contact.notes) || 'ORGANIC',
                'Status': contact.isBlocked ? 'Blocked' : 'Active'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Contacts");

            XLSX.writeFile(wb, `contacts_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Contacts exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export contacts');
        }
    };

    const refreshData = () => {
        router.refresh();
    };

    return (
        <div className="space-y-4 ">
            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4   p-2 rounded-xl">
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <form onSubmit={handleSearch} className="relative flex-1 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder={t('searchPlaceholder', { defaultValue: '...Search by name, number or email' })}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 rounded-lg bg-[#F3F4F6] dark:bg-slate-800 border-none text-sm"
                        />
                    </form>
                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={cn(
                            "h-10 px-4 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all border",
                            hasActiveFilters
                                ? "bg-[#0f3d3e] text-white border-[#0f3d3e]"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70"
                        )}
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        {t('filter')}
                        {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-white/70 ml-0.5" />}
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end mt-3 lg:mt-0">
                    <ManageGroupsButton />
                    <ModalButton
                        variant="outline"
                        onClick={handleExport}
                        className="h-10 px-4 w-full sm:w-auto flex items-center justify-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('export')}
                    </ModalButton>
                </div>
            </div>

          
            <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
                <DialogContent className="max-w-2xl w-full rounded-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl h-[600px] plus-jakarta-forced outline-none focus:outline-none">
                    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#00B074]/10 rounded-2xl">
                                    <SlidersHorizontal className="w-5 h-5 text-[#00B074]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-[18px] tracking-wide">{t('filterContacts')}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">{t('advancedFilters')}</p>
                                </div>
                            </div>
                        </div>
                         <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar max-h-[440px]">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-[#00B074]/10 rounded-xl mt-0.5">
                                        <Calendar className="w-4 h-4 text-[#00B074]" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[15px] text-slate-800 dark:text-slate-100">{t('createdAtRange')}</h4>
                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{t('filterByCreationDate')}</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pl-9">
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'Today', label: t('today'), onClick: () => { const t = new Date().toISOString().split('T')[0]; setFilters(prev => ({ ...prev, createdAtMode: 'Today', dateFrom: t, dateTo: t })); } },
                                            { id: 'This Week', label: t('thisWeek'), onClick: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); setFilters(prev => ({ ...prev, createdAtMode: 'This Week', dateFrom: mon.toISOString().split('T')[0], dateTo: sun.toISOString().split('T')[0] })); } },
                                            { id: 'This Month', label: t('thisMonth'), onClick: () => { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); const last = new Date(now.getFullYear(), now.getMonth() + 1, 0); setFilters(prev => ({ ...prev, createdAtMode: 'This Month', dateFrom: first.toISOString().split('T')[0], dateTo: last.toISOString().split('T')[0] })); } },
                                            { id: 'Custom', label: t('customRange'), onClick: () => setFilters(prev => ({ ...prev, createdAtMode: 'Custom' })) }
                                        ].map(m => {
                                            const active = filters.createdAtMode === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={m.onClick}
                                                    className={cn(
                                                        'px-4 py-2 rounded-xl text-[12px] font-extrabold border transition-all active:scale-95 shadow-sm cursor-pointer',
                                                        active
                                                            ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                    )}
                                                >
                                                    {m.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {filters.createdAtMode === 'Custom' && (
                                        <div className="flex items-center gap-3 animate-in slide-in-from-top-2 duration-150 max-w-md">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">📅</span>
                                                <Input 
                                                    type="date" 
                                                    value={filters.dateFrom} 
                                                    onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} 
                                                    className="h-10 pl-9 rounded-xl text-xs border-slate-200 dark:border-slate-700 bg-transparent font-bold shadow-sm text-slate-700 dark:text-slate-200 focus:ring-[#00B074]/20"
                                                />
                                            </div>
                                            <span className="text-slate-400 text-xs font-extrabold shrink-0 uppercase tracking-wider">to</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">📅</span>
                                                <Input 
                                                    type="date" 
                                                    value={filters.dateTo} 
                                                    onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} 
                                                    className="h-10 pl-9 rounded-xl text-xs border-slate-200 dark:border-slate-700 bg-transparent font-bold shadow-sm text-slate-700 dark:text-slate-200 focus:ring-[#00B074]/20"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 2: Active Status */}
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-[#00B074]/10 rounded-xl mt-0.5">
                                        <SlidersHorizontal className="w-4 h-4 text-[#00B074]" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[15px] text-slate-800 dark:text-slate-100">{t('activeStatusTitle')}</h4>
                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{t('filterByActiveStatus')}</p>
                                    </div>
                                </div>

                                <div className="pl-9">
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'All', label: t('allStatuses') },
                                            { id: 'false', label: t('activeOnly') },
                                            { id: 'true', label: t('blockedOnly') }
                                        ].map(s => {
                                            const active = filters.isBlocked === s.id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setFilters(prev => ({ ...prev, isBlocked: s.id }))}
                                                    className={cn(
                                                        'px-4 py-2 rounded-xl text-[12px] font-extrabold border transition-all active:scale-95 shadow-sm cursor-pointer',
                                                        active
                                                            ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                                                    )}
                                                >
                                                    {s.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Tags & Labels */}
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-[#00B074]/10 rounded-xl mt-0.5">
                                        <Tag className="w-4 h-4 text-[#00B074]" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[15px] text-slate-800 dark:text-slate-100">{t('tagsAndLabels')}</h4>
                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{t('filterByAssignedTags')}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 pl-9">
                                    {/* Search Filter for Tags */}
                                    <div className="relative max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <Input
                                            value={tagSearch}
                                            onChange={e => setTagSearch(e.target.value)}
                                            placeholder={t('searchTags', { defaultValue: '...Search tags by name' })}
                                            className="w-full pl-9 pr-4 h-10 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none focus:border-[#00B074] bg-slate-50/50 dark:bg-slate-900/50"
                                        />
                                    </div>

                                    {/* Tags Grid */}
                                    <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                                        {availableTags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 ? (
                                            <div className="col-span-2 text-center text-slate-400 text-xs py-4">
                                                {t('noMatchingTags', { defaultValue: 'No matching tags available' })}
                                            </div>
                                        ) : availableTags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase())).map(tag => {
                                            const selected = filters.tagIds.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFilters(prev => ({
                                                            ...prev,
                                                            tagIds: prev.tagIds.includes(tag.id)
                                                                ? prev.tagIds.filter(x => x !== tag.id)
                                                                : [...prev.tagIds, tag.id]
                                                        }));
                                                    }}
                                                    className={cn(
                                                        'flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer active:scale-[0.98]',
                                                        selected 
                                                            ? 'border-[#00B074] bg-[#00B074]/5 dark:bg-[#00B074]/5' 
                                                            : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={cn(
                                                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                                                            selected ? 'bg-[#00B074] border-[#00B074]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                                        )}>
                                                            {selected && <Check className="w-3 h-3 text-white stroke-[3.5]" />}
                                                        </div>
                                                        <p className="font-black text-[12px] text-slate-800 dark:text-slate-200 truncate">{tag.name}</p>
                                                    </div>
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-1.5" style={{ background: tag.color || '#00B074' }} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                             <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-[#00B074]/10 rounded-xl mt-0.5">
                                        <Users className="w-4 h-4 text-[#00B074]" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[15px] text-slate-800 dark:text-slate-100">{t('segmentsAndGroups', { defaultValue: 'Segments & Groups' })}</h4>
                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{t('filterByGroup', { defaultValue: 'Filter contacts by assigned group / segment' })}</p>
                                    </div>
                                </div>

                                <div className="pl-9">
                                    <select 
                                        value={selectedGroupId || "ALL"} 
                                        onChange={(e) => setSelectedGroupId(e.target.value === "ALL" ? "" : e.target.value)}
                                        className="w-full max-w-md h-11 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold text-slate-750 dark:text-slate-200 outline-none cursor-pointer appearance-none transition-all focus:ring-2 focus:ring-[#00B074]/20"
                                        style={{
                                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e")`,
                                            backgroundRepeat: "no-repeat",
                                            backgroundPosition: "right 16px center",
                                            backgroundSize: "14px",
                                            paddingRight: "40px"
                                        }}
                                    >
                                        <option value="ALL" className="text-xs font-bold text-slate-600 dark:text-slate-350 dark:bg-slate-900">
                                            {t('allGroups', { defaultValue: 'All Groups' })}
                                        </option>
                                        {groups.map(group => (
                                            <option key={group.id} value={group.id} className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:bg-slate-900">
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                         <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between shrink-0">
                             <button
                                type="button"
                                onClick={() => {
                                    setFilters({
                                        createdAtMode: 'All',
                                        dateFrom: '',
                                        dateTo: '',
                                        tagIds: [],
                                        platform: 'ALL',
                                        isBlocked: 'All'
                                    });
                                    setSelectedGroupId('');
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-[#00B074]/30 dark:border-slate-800 hover:bg-[#00B074]/5 text-slate-500 hover:text-[#00B074] dark:hover:text-emerald-400 text-xs font-extrabold transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> {t('clearAll')}
                            </button>

                            <div className="flex items-center gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsFilterModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-none bg-transparent"
                                >
                                    {t('cancel')}
                                </button>
                                <Button 
                                    className="bg-[#00B074] hover:bg-[#009b66] text-white px-7 rounded-xl font-bold h-10 shadow-lg border-none" 
                                    onClick={handleApplyFilters}
                                >
                                    {t('applyFilters')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

           
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#00B074] text-white px-6 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2 border-r border-[#ffffff20] pr-4">
                        <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                            {selectedIds.length}
                        </div>
                        <span className="text-sm font-medium">Selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManageGroups && (
                            <>
                                <ModalButton
                                    variant="primary"
                                    onClick={() => setIsAddToGroupOpen(true)}
                                    className="bg-white/10 hover:bg-white/20 text-white h-9 px-4 rounded-xl text-[10px]"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                                    Add to Group
                                </ModalButton>
                                <ModalButton
                                    variant="primary"
                                    onClick={() => setIsCreateGroupModalOpen(true)}
                                    className="bg-white/10 hover:bg-white/20 text-white h-9 px-4 rounded-xl text-[10px]"
                                >
                                    <Users className="w-3.5 h-3.5 mr-1.5" />
                                    Create New Group
                                </ModalButton>
                            </>
                        )}
                        <ModalButton
                            variant="ghost"
                            onClick={handleBulkDelete}
                            className="bg-red-500/80 hover:bg-red-600 text-white h-9 px-4 rounded-xl text-[10px] font-bold border-none flex items-center"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete Contacts
                        </ModalButton>
                        <ModalButton
                            variant="ghost"
                            onClick={() => setSelectedIds([])}
                            className="text-white/70 hover:text-white h-9 px-2 text-[10px] bg-transparent"
                        >
                            Deselect All
                        </ModalButton>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm overflow-x-auto font-[family-name:var(--dashboard-font)] no-scrollbar">
                <Table className="w-full min-w-[1000px]">
                    <TableHeader>
                        <TableRow className="bg-slate-50/20 dark:bg-slate-800/20 hover:bg-slate-50/20 dark:hover:bg-slate-800/20 border-gray-100 dark:border-slate-800 h-14 whitespace-nowrap">
                            <TableHead className="w-[40px] px-4 text-center">
                                {isSelectingAll ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#00B074] border-t-transparent mx-auto" />
                                ) : (
                                    <Checkbox
                                        checked={selectedIds.length > 0 && selectedIds.length >= initialContacts.length}
                                        onCheckedChange={toggleSelectAll}
                                        className="border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 data-[state=checked]:border-[#00B074] data-[state=checked]:bg-[#00B074]"
                                    />
                                )}
                            </TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">{t('contact')}</TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">{t('phoneEmail')}</TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">Source</TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">{t('tags')}</TableHead>
                            {Array.from(new Set(initialContacts.flatMap(c => (c as any).customAttributes && typeof (c as any).customAttributes === 'object' ? Object.keys((c as any).customAttributes).filter(k => !isInternalCustomAttribute(k)) : []))).map(key => (
                                <TableHead key={`head-${key}`} className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">
                                    {key}
                                </TableHead>
                            ))}
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">{t('lastSeen')}</TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">{t('addedOn')}</TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-start">{t('status')}</TableHead>
                            <TableHead className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider text-end pe-8">{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialContacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9 + Array.from(new Set(initialContacts.flatMap(c => (c as any).customAttributes && typeof (c as any).customAttributes === 'object' ? Object.keys((c as any).customAttributes).filter(k => !isInternalCustomAttribute(k)) : []))).length} className="h-72 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                                            <User className="h-8 w-8 opacity-20" />
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-widest opacity-40">No contacts found</p>
                                        <p className="text-xs mt-1 opacity-40">Try adjusting your filters or search query</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialContacts.map((contact) => {
                                const groupName = contact.groups?.[0]?.group.name || 'Customer';
                                const isVIP = groupName.toLowerCase() === 'vip' || contact.tags?.some(t => t.name.toLowerCase() === 'vip');

                                return (
                                    <TableRow
                                        key={contact.id}
                                        onClick={() => setDrawerContact(contact)}
                                        className={cn(
                                            "group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-slate-100 dark:border-slate-800/80 transition-all h-[76px] whitespace-nowrap cursor-pointer",
                                            selectedIds.includes(contact.id) ? "bg-emerald-500/5 dark:bg-emerald-500/10" : ""
                                        )}
                                    >
                                        <TableCell className="w-[40px] px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.includes(contact.id)}
                                                onCheckedChange={() => toggleSelect(contact.id)}
                                                className="border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 data-[state=checked]:border-[#00B074] data-[state=checked]:bg-[#00B074]"
                                            />
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                                                    <AvatarImage src={contact.profilePic || undefined} />
                                                    <AvatarFallback className="bg-[#00B074]/10 text-[#00B074] font-bold text-sm">
                                                        {(contact.name || contact.waId).substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                                                            {contact.name || '-'}
                                                        </span>
                                                        {isVIP && (
                                                            <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded leading-none select-none uppercase tracking-wide">
                                                                VIP
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 capitalize">
                                                        {groupName}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200" dir="ltr">
                                                    {contact.waId ? (contact.waId.startsWith('+') ? contact.waId : '+' + contact.waId) : '-'}
                                                </span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                                    {contact.email || '-'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-start">
                                            {(() => {
                                                const customAttrs = (contact as any).customAttributes as Record<string, any> || {};
                                                const referral = customAttrs.referral || {};
                                                const source = customAttrs.adSource || customAttrs.source || customAttrs.contactSource || (referral?.source_type ? (referral.source_type === 'ad' ? 'Meta Ad' : 'Meta Post') : null);
                                                const headline = customAttrs.ad_headline || customAttrs.adTitle || customAttrs.campaignName || referral?.headline;
                                                const adId = customAttrs.ad_source_id || customAttrs.adId || referral?.source_id || referral?.ad_id;
                                                const isAd = source && (adId || source.toLowerCase().includes('ad') || source.toLowerCase().includes('post') || source.toLowerCase().includes('campaign'));

                                                if (isAd) {
                                                    return (
                                                        <div className="flex flex-col gap-0.5 max-w-[210px]">
                                                            <span 
                                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50 w-max truncate shadow-xs"
                                                                title={adId ? `Ad/Post ID: ${adId}` : undefined}
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                                                <span className="truncate">{source}</span>
                                                            </span>
                                                            {headline && (
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate" title={headline}>
                                                                    &quot;{headline}&quot;
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 w-max">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                                        {source || 'Organic'}
                                                    </span>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <div className="flex flex-wrap items-center gap-1.5 max-w-[280px]">
                                                {contact.tags && contact.tags.length > 0 ? (
                                                    <>
                                                        {contact.tags.slice(0, 2).map((tag) => (
                                                            <span 
                                                                key={tag.id} 
                                                                className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight"
                                                                style={{
                                                                    backgroundColor: (tag.color || '#6366F1') + '15',
                                                                    color: tag.color || '#6366F1'
                                                                }}
                                                            >
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                        {contact.tags.length > 2 && (
                                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 tracking-tight">
                                                                +{contact.tags.length - 2}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#00B074] uppercase tracking-tight">
                                                        Regular
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        {Array.from(new Set(initialContacts.flatMap(c => (c as any).customAttributes && typeof (c as any).customAttributes === 'object' ? Object.keys((c as any).customAttributes).filter(k => !isInternalCustomAttribute(k)) : []))).map(key => {
                                            const val = (contact as any).customAttributes && typeof (contact as any).customAttributes === 'object' ? ((contact as any).customAttributes as Record<string,any>)[key] : null;
                                            return (
                                                <TableCell key={`cell-${contact.id}-${key}`} className="text-start">
                                                    {val ? (
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {String(val)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm font-medium text-slate-400">-</span>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell className="text-start">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {getRelativeTime(contact.lastMessageAt || contact.createdAt)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-start">
                                            {(() => {
                                                const { dateStr, timeStr } = formatAddedOn(contact.createdAt);
                                                return (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{dateStr}</span>
                                                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{timeStr}</span>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <span className={cn(
                                                "inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold leading-none select-none tracking-wide",
                                                contact.isBlocked 
                                                    ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" 
                                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                            )}>
                                                {contact.isBlocked ? t('inactiveStatus') : t('active')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-end pe-6" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2.5">
                                               

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-all border border-slate-200/60 dark:border-slate-700 shadow-sm dark:shadow-none shrink-0"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-xl plus-jakarta-forced">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setContactToEdit(contact);
                                                                setIsAddModalOpen(true);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                                            {t('editInfo', { defaultValue: 'Edit Info' })}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleToggleBlock(contact)}
                                                            className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                                        >
                                                            <X className="w-3.5 h-3.5 text-slate-500" />
                                                            {contact.isBlocked ? t('unblockContact') : t('blockContact')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(contact.id)}
                                                            className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                                            {t('deleteContact', { defaultValue: 'Delete Contact' })}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center py-4 bg-white dark:bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                    >
                        <ChevronLeft className="h-4 w-4 text-gray-400 rtl:rotate-180" />
                    </Button>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        <bdi>{total === 0 ? 0 : (currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, total)}</bdi> {t('of', { defaultValue: 'of' })} <bdi>{total}</bdi>
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight className="h-4 w-4 text-gray-400 rtl:rotate-180" />
                    </Button>

                    <div className="ml-4 flex items-center gap-2">
                        <select 
                            value={limit}
                            onChange={(e) => handleLimitChange(e.target.value)}
                            className="h-8 text-xs bg-transparent border-none text-gray-600 dark:text-gray-400 font-medium focus:ring-0 cursor-pointer"
                        >
                            <option value="20">20 {t('perPage', { defaultValue: 'per page' })}</option>
                            <option value="50">50 {t('perPage', { defaultValue: 'per page' })}</option>
                            <option value="100">100 {t('perPage', { defaultValue: 'per page' })}</option>
                        </select>
                    </div>
                </div>
            </div>

            <CreateContactModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setContactToEdit(null);
                }}
                onSuccess={() => {
                    refreshData();
                    setSelectedIds([]);
                }}
                editData={contactToEdit}
                contactIds={selectedIds}
            />

            <ImportContactsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={refreshData}
            />

            <ContactChatDrawer
                isOpen={!!selectedChatContact}
                onClose={() => setSelectedChatContact(null)}
                contact={selectedChatContact}
            />

            <AddToGroupModal
                isOpen={isAddToGroupOpen}
                onClose={() => setIsAddToGroupOpen(false)}
                onSuccess={() => {
                    refreshData();
                    setSelectedIds([]);
                }}
                contactIds={selectedIds}
            />

            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={() => setIsCreateGroupModalOpen(false)}
                onSuccess={() => {
                    refreshData();
                    setSelectedIds([]);
                }}
                contactIds={selectedIds}
            />

            <ContactProfileDrawer
                contact={drawerContact}
                onClose={() => setDrawerContact(null)}
            />
        </div>
    );
}
