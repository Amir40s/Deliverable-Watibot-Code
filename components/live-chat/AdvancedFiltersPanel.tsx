'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Filter, Search, MessageSquare, User, Users, Phone, Tag, Settings, Calendar, ChevronDown, Check, Globe, Mail, Eye, ChevronRight, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateTagModal } from '@/components/dashboard/CreateTagModal';

 export interface LiveChatFilters {
     dateMode: 'All' | 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Custom';
    dateFrom: string;
    dateTo: string;
     readStatus: 'All' | 'Read' | 'Unread';
    platform: 'All' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'MESSENGER' | 'TIKTOK' | 'WEB_CHAT' | 'EMAIL';
     agentIds: string[];
     teamId?: string;
      tagIds: string[];
     keyword: string;
    excludeKeyword?: string;
    
    // Conversation rich fields
    conversationType?: 'All' | 'User' | 'Bot' | 'Team' | 'System';
    conversationStatus?: 'All' | 'Open' | 'Pending' | 'Closed' | 'Snoozed';
    responseStatus?: 'All' | 'Replied' | 'Not Replied';
    priority?: 'All' | 'High' | 'Medium' | 'Low';
    slaStatus?: 'All' | 'Met' | 'Breached' | 'Warning';
    conversationWith?: string;
    lastActivityTime?: string;
    messageType?: string;
    attachmentStatus?: string;
    mediaType?: string;
    messageContains?: string;
}

export const defaultFilters: LiveChatFilters = {
    dateMode: 'All', dateFrom: '', dateTo: '',
    readStatus: 'All',
    platform: 'All',
    agentIds: [],
    teamId: 'All',
    tagIds: [],
    keyword: '',
    excludeKeyword: '',
    conversationType: 'All',
    conversationStatus: 'All',
    responseStatus: 'All',
    priority: 'All',
    slaStatus: 'All',
    conversationWith: 'Any',
    lastActivityTime: 'Any',
    messageType: 'All',
    attachmentStatus: 'Any',
    mediaType: 'All',
    messageContains: '',
};

interface Agent { 
    id: string; 
    name: string | null; 
    email: string; 
    lastLoginAt?: string | Date | null;
    deviceSettings?: Array<{ lastActiveAt: string | Date }> | null;
}
interface TagItem {
    id: string;
    name: string;
    color: string;
    category?: string;
    _count?: { contacts: number };
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    filters: LiveChatFilters;
    onApply: (f: LiveChatFilters) => void;
    agents?: Agent[];
    tags?: TagItem[];
    onRefreshTags?: () => void;
}



// ── Pill button ───────────────────────────────────────────────────────────────
function Pill({ active, onClick, children, color }: {
    active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all',
                active
                    ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
        >
            {color && <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />}
            {children}
        </button>
    );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="p-2 bg-[#00B074]/10 rounded-xl mt-0.5">
                <Icon className="w-4 h-4 text-[#00B074]" />
            </div>
            <div>
                <h3 className="font-bold text-slate-800 text-[15px]">{title}</h3>
                <p className="text-[12px] text-slate-400 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AdvancedFiltersPanel({ isOpen, onClose, filters, onApply, agents = [], tags = [], onRefreshTags }: Props) {
    const t = useTranslations('Filters');
    
    // ── Nav sections ──────────────────────────────────────────────────────────────
    const NAV = [
        { id: 'general',      label: t('generalTab'),      icon: Settings },
        { id: 'conversation', label: t('conversationTab'),  icon: MessageSquare },
        { id: 'user',         label: t('userTab'),          icon: User },
        { id: 'agent',        label: t('agentTab'),         icon: Users },
        { id: 'channel',      label: t('channelTab'),       icon: Phone },
        { id: 'tags',         label: t('tagsAndLabelsTab'), icon: Tag },
    ];
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const [section, setSection] = useState('general');
    const [draft, setDraft] = useState<LiveChatFilters>(filters);
    const [agentSearch, setAgentSearch] = useState('');
    const [tagSearch, setTagSearch] = useState('');
    const [activeUserTab, setActiveUserTab] = useState<'all' | 'agents' | 'admins' | 'online' | 'offline'>('all');
    
    // Channels filter state hooks
    const [channelSearchQuery, setChannelSearchQuery] = useState('');
    const [activeChannelTab, setActiveChannelTab] = useState<'All' | 'Messaging' | 'Social Media' | 'Email' | 'Web'>('All');
    const [selectedChannels, setSelectedChannels] = useState<string[]>(['WHATSAPP', 'FACEBOOK', 'INSTAGRAM']);

    // Tags & Labels filter state hooks
    const [activeTagTab, setActiveTagTab] = useState<'All' | 'Tags' | 'Labels'>('All');
    const [tagMatchLogic, setTagMatchLogic] = useState<'OR' | 'AND'>('OR');
    const [labelMatchLogic, setLabelMatchLogic] = useState<'OR' | 'AND'>('OR');
    const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false);
    const [createTagModalEditData, setCreateTagModalEditData] = useState<any>(null);

    const [integrationStatus, setIntegrationStatus] = useState<{
        isConnected: boolean;
        isInstagramConnected: boolean;
        isFacebookConnected: boolean;
    }>({
        isConnected: false,
        isInstagramConnected: false,
        isFacebookConnected: false,
    });

    useEffect(() => {
        if (!isOpen) return;
        getWhatsappStatus()
            .then(res => {
                if (res) {
                    setIntegrationStatus({
                        isConnected: !!res.isConnected,
                        isInstagramConnected: !!res.isInstagramConnected,
                        isFacebookConnected: !!res.isFacebookConnected,
                    });
                }
            })
            .catch(err => console.error("Failed to fetch WhatsApp/Meta integrations status:", err));
    }, [isOpen]);

    const augmentedUsers = useMemo(() => {
        // Map real agents from the database into the structured list format
        return agents.map((a, idx) => {
            // Check if the user was active recently (last 5 minutes)
            const deviceSettings = a.deviceSettings || [];
            const lastActive = deviceSettings[0]?.lastActiveAt || a.lastLoginAt;
            const isLiveOnline = lastActive 
                ? (Date.now() - new Date(lastActive).getTime()) < 5 * 60 * 1000 
                : false;

            // Map DB roles (ADMIN / SUPER_ADMIN) to 'Admin', all others to 'Agent'
            const dbRole = (a as any).role || '';
            const computedRole = (dbRole === 'ADMIN' || dbRole === 'SUPER_ADMIN') ? 'Admin' : 'Agent';

            return {
                id: a.id,
                name: a.name || a.email.split('@')[0],
                email: a.email,
                role: computedRole,
                status: isLiveOnline ? 'Online' : 'Offline',
            };
        });
    }, [agents]);

    if (!isOpen) return null;

    const set = <K extends keyof LiveChatFilters>(k: K, v: LiveChatFilters[K]) =>
        setDraft(prev => ({ ...prev, [k]: v }));

    const toggleId = (key: 'agentIds' | 'tagIds', id: string) =>
        setDraft(prev => ({
            ...prev,
            [key]: prev[key].includes(id) ? prev[key].filter(x => x !== id) : [...prev[key], id],
        }));

    const resetAll = () => setDraft(defaultFilters);

    const today = () => {
        const d = new Date().toISOString().split('T')[0];
        setDraft(p => ({ ...p, dateMode: 'Today', dateFrom: d, dateTo: d }));
    };
    const yesterday = () => {
        const d = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        setDraft(p => ({ ...p, dateMode: 'Yesterday', dateFrom: d, dateTo: d }));
    };
    const thisWeek = () => {
        const now = new Date();
        const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        setDraft(p => ({ ...p, dateMode: 'This Week', dateFrom: mon.toISOString().split('T')[0], dateTo: sun.toISOString().split('T')[0] }));
    };
    const thisMonth = () => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setDraft(p => ({ ...p, dateMode: 'This Month', dateFrom: first.toISOString().split('T')[0], dateTo: last.toISOString().split('T')[0] }));
    };

    const filteredAgents = agents.filter(a =>
        `${a.name} ${a.email}`.toLowerCase().includes(agentSearch.toLowerCase())
    );
    const filteredTags = tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()));

    // ── Render section content ─────────────────────────────────────────────────
    const renderContent = () => {
        switch (section) {

            // ── GENERAL ─────────────────────────────────────────────────────
            case 'general':
                return (
                    <div className="space-y-6">
                        <SectionHeader icon={Settings} title={t("general")} subtitle={t("refineConversations")} />

                        {/* Date Range */}
                        <div>
                            <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-3">{t("dateRange")}</p>
                            <div className="flex flex-wrap gap-2">
                                {([t('today'), t('yesterday'), t('thisWeek'), t('thisMonth')] as const).map(m => (
                                    <Pill key={m} active={draft.dateMode === m} onClick={() => {
                                        if (m === 'Today') today();
                                        else if (m === 'Yesterday') yesterday();
                                        else if (m === 'This Week') thisWeek();
                                        else thisMonth();
                                    }}>{m}</Pill>
                                ))}
                                <Pill active={draft.dateMode === 'Custom'} onClick={() => set('dateMode', 'Custom')}>
                                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{t("customRange")}</span>
                                </Pill>
                            </div>
                            {draft.dateMode === 'Custom' && (
                                <div className="flex items-center gap-3 mt-3">
                                    <input type="date" value={draft.dateFrom}
                                        onChange={e => set('dateFrom', e.target.value)}
                                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#00B074]" />
                                    <span className="text-slate-400 text-sm">to</span>
                                    <input type="date" value={draft.dateTo}
                                        onChange={e => set('dateTo', e.target.value)}
                                        className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#00B074]" />
                                </div>
                            )}
                        </div>

                        {/* Read Status */}
                        <div>
                            <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-3">{t("readStatus")}</p>
                            <div className="flex gap-2">
                                {(['All', 'Read', 'Unread'] as const).map(s => (
                                    <Pill key={s} active={draft.readStatus === s} onClick={() => set('readStatus', s)}>{t(s.toLowerCase() as any)}</Pill>
                                ))}
                            </div>
                        </div>

                        {/* Channel Selection */}
                        <div>
                            <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-3">{t("channelTab")}</p>
                            <div className="grid grid-cols-7 gap-3">
                                {[
                                    { id: 'WHATSAPP', label: t('whatsapp'), icon: <img src="/whatsapp-logo.png" alt="WhatsApp" className="w-5 h-5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />, fallbackIcon: <Phone className="w-5 h-5 text-emerald-500" /> },
                                    { id: 'INSTAGRAM', label: t('instagram'), icon: <img src="/instagram-logo.png" alt="Instagram" className="w-5 h-5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />, fallbackIcon: <Globe className="w-5 h-5 text-rose-500" /> },
                                    { id: 'FACEBOOK', label: t('facebook'), icon: <img src="/facebook-logo.png" alt="Facebook" className="w-5 h-5 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />, fallbackIcon: <Globe className="w-5 h-5 text-blue-600" /> },

                                ].map(ch => {
                                    const active = draft.platform === ch.id;
                                    return (
                                        <button
                                            key={ch.id}
                                            type="button"
                                            onClick={() => set('platform', ch.id as any)}
                                            className={cn(
                                                'relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all text-center h-20',
                                                active 
                                                    ? 'border-[#00B074] bg-[#00B074]/5' 
                                                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
                                            )}
                                        >
                                            {/* Checkbox badge in top-right */}
                                            <div className={cn(
                                                'absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded flex items-center justify-center border transition-all',
                                                active ? 'bg-[#00B074] border-[#00B074]' : 'border-slate-200 bg-white'
                                            )}>
                                                {active && <Check className="w-2.5 h-2.5 text-white" />}
                                            </div>
                                            <span className="w-7 h-7 flex items-center justify-center">
                                                {ch.icon || ch.fallbackIcon}
                                            </span>
                                            <span className="text-[11px] font-semibold text-slate-700">{ch.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Assigned Agent & Team */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("assignedAgent")}</p>
                                <div className="relative">
                                    <select
                                        value={draft.agentIds[0] || 'All'}
                                        onChange={e => {
                                            const val = e.target.value;
                                            set('agentIds', val === 'All' ? [] : [val]);
                                        }}
                                        className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#00B074] bg-white appearance-none cursor-pointer"
                                    >
                                        <option value="All">{t("allAgents")}</option>
                                        {agents.map(a => (
                                            <option key={a.id} value={a.id}>{a.name || a.email}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("team")}</p>
                                <div className="relative">
                                    <select
                                        value={draft.teamId || 'All'}
                                        onChange={e => set('teamId', e.target.value)}
                                        className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#00B074] bg-white appearance-none cursor-pointer"
                                    >
                                        <option value="All">{t("allTeams")}</option>
                                        <option value="Support">{t('supportTeam')}</option>
                                        <option value="Sales">{t('salesTeam')}</option>
                                        <option value="Marketing">{t('marketingTeam')}</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Keyword Search & Exclude Keywords */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("keywordSearch")}</p>
                                <div className="relative">
                                    <input
                                        value={draft.keyword}
                                        onChange={e => set('keyword', e.target.value)}
                                        placeholder={t("searchMessageContent")}
                                        className="w-full pl-4 pr-9 h-10 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#00B074] bg-slate-50/50"
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("excludeKeywords")}</p>
                                <div className="relative">
                                    <input
                                        value={draft.excludeKeyword || ''}
                                        onChange={e => set('excludeKeyword', e.target.value)}
                                        placeholder={t("excludeMessages")}
                                        className="w-full pl-4 pr-9 h-10 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-[#00B074] bg-slate-50/50"
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'conversation':
                return (
                    <div className="space-y-6">
                        <SectionHeader icon={MessageSquare} title={t("conversation")} subtitle={t("refineConversations")} />

                        {/* Row 1: Conversation Type & Status */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2.5">{t("conversationType")}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['All', 'User', 'Bot', 'Team', 'System'] as const).map(type => {
                                        const active = (draft.conversationType || 'All') === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => set('conversationType', type)}
                                                className={cn(
                                                    'px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all',
                                                    active
                                                        ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                )}
                                            >
                                                {t(type.toLowerCase() as any)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2.5">{t("status")}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['All', 'Open', 'Pending', 'Closed', 'Snoozed'] as const).map(status => {
                                        const active = (draft.conversationStatus || 'All') === status;
                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => set('conversationStatus', status)}
                                                className={cn(
                                                    'px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all',
                                                    active
                                                        ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-355 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                )}
                                            >
                                                {t(status.toLowerCase() as any)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Read Status & Response Status */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2.5">{t("readStatus")}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['All', 'Read', 'Unread'] as const).map(rs => {
                                        const active = draft.readStatus === rs;
                                        return (
                                            <button
                                                key={rs}
                                                type="button"
                                                onClick={() => set('readStatus', rs)}
                                                className={cn(
                                                    'px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all',
                                                    active
                                                        ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-355 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                )}
                                            >
                                                {t(rs.toLowerCase() as any)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2.5">{t("responseStatus")}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(['All', 'Replied', 'Not Replied'] as const).map(rp => {
                                        const active = (draft.responseStatus || 'All') === rp;
                                        return (
                                            <button
                                                key={rp}
                                                type="button"
                                                onClick={() => set('responseStatus', rp)}
                                                className={cn(
                                                    'px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all',
                                                    active
                                                        ? 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-355 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                )}
                                            >
                                                {rp === 'Not Replied' ? t('notReplied') : t(rp.toLowerCase() as any)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                     

                        {/* Row 4: Conversation with & Last Activity */}
                        <div className="grid grid-cols-2 gap-6">
                           
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("lastActivity")}</p>
                                <div className="relative">
                                    <select
                                        value={draft.lastActivityTime || 'Any'}
                                        onChange={e => set('lastActivityTime', e.target.value)}
                                        className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00B074] bg-white dark:bg-slate-800 appearance-none cursor-pointer"
                                    >
                                        <option value="Any">{t("anyTime")}</option>
                                        <option value="Today">{t('today')}</option>
                                        <option value="Yesterday">{t('yesterday')}</option>
                                        <option value="This Week">{t('thisWeek')}</option>
                                        <option value="This Month">{t('thisMonth')}</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Section Divider: Message Filters */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="font-bold text-[#00B074] text-[14px]">{t("messageFilters")}</h4>
                        </div>

                        {/* Row 5: Message Type & Attachment */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("messageType")}</p>
                                <div className="relative">
                                    <select
                                        value={draft.messageType || 'All'}
                                        onChange={e => set('messageType', e.target.value)}
                                        className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00B074] bg-white dark:bg-slate-800 appearance-none cursor-pointer"
                                    >
                                        <option value="All">{t("allTypes")}</option>
                                        <option value="Text">{t('textType')}</option>
                                        <option value="Image">{t('imageType')}</option>
                                        <option value="Audio">{t('audioType')}</option>
                                        <option value="Video">{t('videoType')}</option>
                                        <option value="Document">{t('documentType')}</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("attachment")}</p>
                                <div className="relative">
                                    <select
                                        value={draft.attachmentStatus || 'Any'}
                                        onChange={e => set('attachmentStatus', e.target.value)}
                                        className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00B074] bg-white dark:bg-slate-800 appearance-none cursor-pointer"
                                    >
                                        <option value="Any">{t("any")}</option>
                                        <option value="HasAttachment">{t("hasAttachment")}</option>
                                        <option value="NoAttachment">{t("noAttachment")}</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Row 6: Media Type & Message Contains */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("mediaType")}</p>
                                <div className="relative">
                                    <select
                                        value={draft.mediaType || 'All'}
                                        onChange={e => set('mediaType', e.target.value)}
                                        className="w-full h-10 px-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00B074] bg-white dark:bg-slate-800 appearance-none cursor-pointer"
                                    >
                                        <option value="All">{t("allMedia")}</option>
                                        <option value="Image">{t('imageType')}</option>
                                        <option value="Video">{t('videoType')}</option>
                                        <option value="Audio">{t('audioType')}</option>
                                        <option value="Document">{t('documentType')}</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-slate-500 tracking-wider mb-2">{t("messageContains")}</p>
                                <div className="relative">
                                    <input
                                        value={draft.messageContains || ''}
                                        onChange={e => set('messageContains', e.target.value)}
                                        placeholder={t("searchKeywords")}
                                        className="w-full pl-4 pr-9 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#00B074] bg-slate-50/50 dark:bg-slate-800/50"
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            // ── USER / AGENT ────────────────────────────────────────────────
            case 'user':
            case 'agent':
                const isAgent = section === 'agent';
                const allCount = augmentedUsers.length;
                const agentsCount = augmentedUsers.filter(u => u.role === 'Agent').length;
                const adminsCount = augmentedUsers.filter(u => u.role === 'Admin').length;
                const onlineCount = augmentedUsers.filter(u => u.status === 'Online').length;
                const offlineCount = augmentedUsers.filter(u => u.status === 'Offline').length;

                const filteredByTabAndSearch = augmentedUsers.filter(u => {
                    const matchesSearch = `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(agentSearch.toLowerCase());
                    if (!matchesSearch) return false;
                    
                    if (activeUserTab === 'agents') return u.role === 'Agent';
                    if (activeUserTab === 'admins') return u.role === 'Admin';
                    if (activeUserTab === 'online') return u.status === 'Online';
                    if (activeUserTab === 'offline') return u.status === 'Offline';
                    return true;
                });

                const clearAllSelectedUsers = () => {
                    set('agentIds', []);
                };

                return (
                    <div className="space-y-5">
                        {/* Header with Clear All */}
                        <div className="flex items-center justify-between">
                            <SectionHeader
                                icon={isAgent ? Users : User}
                                title={isAgent ? t('agentTab') : t('userTab')}
                                subtitle={t('refineConversations')}
                            />
                            <button
                                type="button"
                                onClick={clearAllSelectedUsers}
                                className="flex items-center gap-1 text-[13px] font-bold text-[#00B074] hover:opacity-80 transition-opacity"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Clear All
                            </button>
                        </div>

                        {/* Search input with magnifier icon on left */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                value={agentSearch}
                                onChange={e => setAgentSearch(e.target.value)}
                                placeholder={t("searchUsers")}
                                className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-355 focus:outline-none focus:border-[#00B074] bg-slate-50/50 dark:bg-slate-800/50"
                            />
                        </div>

                        {/* Filter Tabs / Pills */}
                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setActiveUserTab('all')}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[12px] font-bold border transition-all',
                                    activeUserTab === 'all'
                                        ? 'bg-[#00B074]/5 border-[#00B074] text-[#00B074]'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-200'
                                )}
                            >{t("allUsers")} ({allCount})</button>
                            <button
                                type="button"
                                onClick={() => setActiveUserTab('agents')}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[12px] font-bold border transition-all',
                                    activeUserTab === 'agents'
                                        ? 'bg-[#00B074]/5 border-[#00B074] text-[#00B074]'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-200'
                                )}
                            >{t("agents")} ({agentsCount})</button>
                            <button
                                type="button"
                                onClick={() => setActiveUserTab('admins')}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[12px] font-bold border transition-all',
                                    activeUserTab === 'admins'
                                        ? 'bg-[#00B074]/5 border-[#00B074] text-[#00B074]'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-200'
                                )}
                            >{t("admins")} ({adminsCount})</button>
                            <button
                                type="button"
                                onClick={() => setActiveUserTab('online')}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[12px] font-bold border transition-all',
                                    activeUserTab === 'online'
                                        ? 'bg-[#00B074]/5 border-[#00B074] text-[#00B074]'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-200'
                                )}
                            >{t("online")} ({onlineCount})</button>
                            <button
                                type="button"
                                onClick={() => setActiveUserTab('offline')}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[12px] font-bold border transition-all',
                                    activeUserTab === 'offline'
                                        ? 'bg-[#00B074]/5 border-[#00B074] text-[#00B074]'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-200'
                                )}
                            >{t("offline")} ({offlineCount})</button>
                        </div>

                        {/* Users List Container */}
                        <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[320px] overflow-y-auto pr-1 bg-white dark:bg-slate-900 shadow-sm">
                            {filteredByTabAndSearch.length === 0 ? (
                                <div className="text-center text-slate-400 text-sm py-12">
                                    {t("searchUsers")}
                                </div>
                            ) : filteredByTabAndSearch.map(u => {
                                const selected = draft.agentIds.includes(u.id);
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => toggleId('agentIds', u.id)}
                                        className={cn(
                                            'w-full flex items-center gap-4 px-4 py-3.5 transition-all text-left bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 focus:outline-none focus:ring-0 focus-visible:outline-none',
                                            selected ? 'bg-[#00B074]/5 dark:bg-[#00B074]/5' : ''
                                        )}
                                    >
                                        {/* Custom checkbox */}
                                        <div className={cn(
                                            'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                                            selected ? 'bg-[#00B074] border-[#00B074]' : 'border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-800'
                                        )}>
                                            {selected && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
                                        </div>

                                        {/* Profile Avatar */}
                                        <Avatar className="h-10 w-10 rounded-full shrink-0 border border-slate-100 dark:border-slate-800">
                                            <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff&size=80`} />
                                            <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700 font-bold">
                                                {u.name.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{u.name}</p>
                                            <p className="text-[12px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{u.email}</p>
                                        </div>

                                        {/* Role Badge */}
                                        <div className="w-32 flex justify-center shrink-0">
                                            <span className={cn(
                                                'px-3 py-1 rounded-full text-[11px] font-black tracking-wide',
                                                u.role === 'Admin' && 'bg-emerald-50 text-[#00B074] dark:bg-emerald-950/20',
                                                u.role === 'Agent' && 'bg-blue-50 text-blue-500 dark:bg-blue-950/20',
                                                u.role === 'Viewer' && 'bg-purple-50 text-purple-500 dark:bg-purple-950/20'
                                            )}>
                                                {u.role}
                                            </span>
                                        </div>

                                        {/* Status Bullet */}
                                        <div className="w-24 flex items-center gap-1.5 shrink-0 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                                            <span className={cn(
                                                'w-2 h-2 rounded-full',
                                                u.status === 'Online' ? 'bg-[#00B074]' : 'bg-slate-400'
                                            )} />
                                            {u.status}
                                        </div>

                                        {/* Arrow right */}
                                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected Users Tray */}
                        {draft.agentIds.length > 0 && (
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-xl">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-[12px] text-slate-500 font-semibold mr-1">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        <span>{draft.agentIds.length} users selected</span>
                                    </div>
                                    {draft.agentIds.map(id => {
                                        const u = augmentedUsers.find(x => x.id === id);
                                        return u ? (
                                            <span
                                                key={id}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#00B074] text-[#00B074] rounded-lg text-[12px] font-bold"
                                            >
                                                {u.name}
                                                <button
                                                    onClick={() => toggleId('agentIds', id)}
                                                    className="hover:opacity-75 transition-opacity"
                                                >
                                                    <X className="w-3 h-3 text-[#00B074]" />
                                                </button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                                <button className="flex items-center gap-1 text-[12px] font-bold text-[#00B074] hover:opacity-80 transition-opacity shrink-0">
                                    <Eye className="w-4 h-4" /> View Selected
                                </button>
                            </div>
                        )}
                    </div>
                );

            // ── CHANNEL ─────────────────────────────────────────────────────
            case 'channel':
                interface ChannelItem {
                    id: string;
                    name: string;
                    desc: string;
                    type: string;
                    status: string;
                    logo?: string;
                    icon?: React.ReactNode;
                    color?: string;
                }

                const allChannelsData: ChannelItem[] = [
                    { id: 'WHATSAPP', name: 'WhatsApp', desc: 'Connect with customers on WhatsApp', type: 'Messaging', status: integrationStatus.isConnected ? 'Connected' : 'Disconnected', logo: '/whatsapp-logo.png' },
                    { id: 'FACEBOOK', name: 'Facebook Messenger', desc: 'Respond to messages on Messenger', type: 'Messaging', status: integrationStatus.isFacebookConnected ? 'Connected' : 'Disconnected', logo: '/facebook-logo.png' },
                    { id: 'INSTAGRAM', name: 'Instagram Direct', desc: 'Engage with users on Instagram', type: 'Social Media', status: integrationStatus.isInstagramConnected ? 'Connected' : 'Disconnected', logo: '/instagram-logo.png' },
                ];

                // Filtering by tab
                const filteredByTab = allChannelsData.filter(ch => {
                    if (activeChannelTab === 'All') return true;
                    return ch.type === activeChannelTab;
                });

                // Filtering by search query
                const filteredChannels = filteredByTab.filter(ch => 
                    ch.name.toLowerCase().includes(channelSearchQuery.toLowerCase()) ||
                    ch.desc.toLowerCase().includes(channelSearchQuery.toLowerCase())
                );

                // Tab counts
                const getTabCount = (tab: 'All' | 'Messaging' | 'Social Media' | 'Email' | 'Web') => {
                    if (tab === 'All') return allChannelsData.length;
                    return allChannelsData.filter(c => c.type === tab).length;
                };

                const toggleChannelSelection = (channelId: string) => {
                    let next: string[];
                    if (selectedChannels.includes(channelId)) {
                        next = selectedChannels.filter(id => id !== channelId);
                    } else {
                        next = [...selectedChannels, channelId];
                    }
                    setSelectedChannels(next);
                    
                    // Keep parent platform in sync: set to first valid selected DB platform or 'All'
                    const validDBPlatforms = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'WEB_CHAT'];
                    const activeDBPlatform = next.find(id => validDBPlatforms.includes(id));
                    set('platform', (activeDBPlatform || 'All') as any);
                };

                const toggleAllChannelsOnPage = () => {
                    const currentPageIds = filteredChannels.map(c => c.id);
                    const allSelected = currentPageIds.every(id => selectedChannels.includes(id));
                    
                    let next: string[];
                    if (allSelected) {
                        next = selectedChannels.filter(id => !currentPageIds.includes(id));
                    } else {
                        next = Array.from(new Set([...selectedChannels, ...currentPageIds]));
                    }
                    setSelectedChannels(next);
                    
                    const validDBPlatforms = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'WEB_CHAT'];
                    const activeDBPlatform = next.find(id => validDBPlatforms.includes(id));
                    set('platform', (activeDBPlatform || 'All') as any);
                };

                const clearChannelSelection = () => {
                    setSelectedChannels([]);
                    set('platform', 'All');
                };

                return (
                    <div className="space-y-4">
                        <SectionHeader 
                            icon={Phone} 
                            title="Channel" 
                            subtitle="Filter conversations by communication channels." 
                        />

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                            <input
                                type="text"
                                value={channelSearchQuery}
                                onChange={(e) => setChannelSearchQuery(e.target.value)}
                                placeholder="Search channels by name..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#00B074]/30 placeholder:text-slate-400 text-slate-700 dark:text-slate-200"
                            />
                        </div>

                        {/* Category Pills/Tabs */}
                        <div className="flex flex-wrap gap-2.5 pt-1">
                            {(['All', 'Messaging', 'Social Media'] as const).map(tab => {
                                const active = activeChannelTab === tab;
                                const count = getTabCount(tab);
                                return (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveChannelTab(tab)}
                                        className={cn(
                                            'px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all duration-200 select-none border',
                                            active
                                                ? 'bg-[#00B074]/10 border-[#00B074] text-[#00B074]'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:border-slate-200 dark:hover:border-slate-700'
                                        )}
                                    >
                                        {tab === 'All' ? 'All Channels' : tab} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Channels List Table */}
                        <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                            <div className="max-h-[340px] overflow-y-auto min-w-[650px] scrollbar-thin">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400 tracking-wider">
                                            <th className="py-3 px-4 w-12">
                                                <button
                                                    type="button"
                                                    onClick={toggleAllChannelsOnPage}
                                                    className="w-4 h-4 rounded border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer focus:outline-none"
                                                >
                                                    {filteredChannels.every(c => selectedChannels.includes(c.id)) && (
                                                        <div className="w-2.5 h-2.5 bg-[#00B074] rounded-sm" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="py-3 px-4">{t("channelTab")}</th>
                                            <th className="py-3 px-4 w-32">Type</th>
                                            <th className="py-3 px-4 w-36">{t("status")}</th>
                                            <th className="py-3 px-4 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {filteredChannels.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400">
                                                    No channels found matching filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredChannels.map(ch => {
                                                const checked = selectedChannels.includes(ch.id);
                                                return (
                                                    <tr 
                                                        key={ch.id} 
                                                        onClick={() => toggleChannelSelection(ch.id)}
                                                        className={cn(
                                                            "hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors duration-150 group",
                                                            checked && "bg-[#00B074]/[0.01]"
                                                        )}
                                                    >
                                                        {/* Checkbox column */}
                                                        <td className="py-3.5 px-4 w-12" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleChannelSelection(ch.id)}
                                                                className={cn(
                                                                    "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                                                                    checked 
                                                                        ? "border-[#00B074] bg-[#00B074] text-white" 
                                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 group-hover:border-slate-300"
                                                                )}
                                                            >
                                                                {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                            </button>
                                                        </td>

                                                        {/* Channel details (Logo, Title, Desc) */}
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-3">
                                                                {ch.logo ? (
                                                                    <div className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100/50 dark:border-slate-800">
                                                                        <img src={ch.logo} alt={ch.name} className="w-5 h-5 object-contain" />
                                                                    </div>
                                                                ) : (
                                                                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", ch.color)}>
                                                                        {ch.icon}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-extrabold text-[13.5px] text-slate-800 dark:text-slate-100 tracking-wide">{ch.name}</p>
                                                                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{ch.desc}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Type Badge column */}
                                                        <td className="py-3.5 px-4">
                                                            <span className={cn(
                                                                "px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide leading-none",
                                                                ch.type === 'Messaging' && "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400",
                                                                ch.type === 'Social Media' && "bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400",
                                                                ch.type === 'Email' && "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400",
                                                                ch.type === 'Web' && "bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400"
                                                            )}>
                                                                {ch.type}
                                                            </span>
                                                        </td>

                                                        {/* Status Column */}
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                                    ch.status === 'Connected' ? "bg-emerald-500" : "bg-slate-400"
                                                                )} />
                                                                <span className={cn(
                                                                    "text-xs font-bold",
                                                                    ch.status === 'Connected' ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                                                                )}>{ch.status}</span>
                                                            </div>
                                                        </td>

                                                        {/* Actions / Connect Button */}
                                                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-2">
                                                                
                                                                
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Selected Channels bottom tray tray */}
                        {selectedChannels.length > 0 && (
                            <div className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-[12px] text-slate-500 font-extrabold mr-1 shrink-0">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        <span>{selectedChannels.length} {t('channelsSelected')}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedChannels.map(id => {
                                            const ch = allChannelsData.find(x => x.id === id);
                                            return ch ? (
                                                <span
                                                    key={id}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-[#00B074]/30 text-[#00B074] dark:text-[#00B074] rounded-xl text-[11px] font-extrabold"
                                                >
                                                    {ch.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleChannelSelection(id)}
                                                        className="hover:opacity-75 transition-opacity cursor-pointer text-[#00B074] leading-none"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={clearChannelSelection}
                                    className="flex items-center gap-1.5 text-[11.5px] font-black text-rose-500 hover:text-rose-600 transition-colors shrink-0 cursor-pointer active:scale-95"
                                >
                                    <Trash2 className="w-4 h-4" />{t("clearSelection")}</button>
                            </div>
                        )}
                    </div>
                );

            // ── TAGS ────────────────────────────────────────────────────────
            case 'tags': {
                const presetTags = [
                    { id: 'tag_order_related', name: 'Order Related', color: '#00B074' },
                    { id: 'tag_payment_issue', name: 'Payment Issue', color: '#4b6b1d' },
                    { id: 'tag_product_inquiry', name: 'Product Inquiry', color: '#a855f7' },
                    { id: 'tag_shipping', name: 'Shipping', color: '#f97316' },
                    { id: 'tag_refund_request', name: 'Refund Request', color: '#ef4444' },
                    { id: 'tag_technical_support', name: 'Technical Support', color: '#3b82f6' },
                    { id: 'tag_general_question', name: 'General Question', color: '#06b6d4' },
                    { id: 'tag_bulk_order', name: 'Bulk Order', color: '#eab308' },
                    { id: 'tag_complaint', name: 'Complaint', color: '#ec4899' },
                ].map(preset => {
                    const dbMatch = tags.find(t => t.name.toLowerCase() === preset.name.toLowerCase());
                    return dbMatch ? {
                        ...preset,
                        id: dbMatch.id,
                        conversations: dbMatch._count?.contacts ?? 0
                    } : null;
                }).filter(Boolean) as any[];

                // Also append any extra custom database tags that don't match the presets
                const dbTagsOnly = tags.filter(t => 
                    t.category !== 'Label' && 
                    !presetTags.some(p => p.name.toLowerCase() === t.name.toLowerCase())
                ).map(t => ({
                    id: t.id,
                    name: t.name,
                    conversations: t._count?.contacts ?? 0,
                    color: t.color || '#64748b'
                }));

                const allTags = [...presetTags, ...dbTagsOnly];

                const presetLabels = [
                    { id: 'label_high_priority', name: 'High Priority', color: '#ef4444' },
                    { id: 'label_vip_customer', name: 'VIP Customer', color: '#8b5cf6' },
                    { id: 'label_returning_customer', name: 'Returning Customer', color: '#3b82f6' },
                    { id: 'label_new_customer', name: 'New Customer', color: '#10b981' },
                    { id: 'label_lead', name: 'Lead', color: '#f59e0b' },
                    { id: 'label_closed', name: 'Closed', color: '#6b7280' },
                ].map(preset => {
                    const dbMatch = tags.find(t => t.name.toLowerCase() === preset.name.toLowerCase());
                    return dbMatch ? {
                        ...preset,
                        id: dbMatch.id,
                        conversations: dbMatch._count?.contacts ?? 0
                    } : null;
                }).filter(Boolean) as any[];

                // Also append any extra custom database labels that don't match the presets
                const dbLabelsOnly = tags.filter(t => 
                    t.category === 'Label' && 
                    !presetLabels.some(p => p.name.toLowerCase() === t.name.toLowerCase())
                ).map(t => ({
                    id: t.id,
                    name: t.name,
                    conversations: t._count?.contacts ?? 0,
                    color: t.color || '#64748b'
                }));

                const allLabels = [...presetLabels, ...dbLabelsOnly];

                const filteredTags = allTags.filter(t =>
                    t.name.toLowerCase().includes(tagSearch.toLowerCase())
                );

                const filteredLabels = allLabels.filter(l =>
                    l.name.toLowerCase().includes(tagSearch.toLowerCase())
                );

                const tagsCount = filteredTags.length;
                const labelsCount = filteredLabels.length;
                const totalCount = tagsCount + labelsCount;

                const selectedTags = allTags.filter(t => draft.tagIds.includes(t.id));
                const selectedLabels = allLabels.filter(l => draft.tagIds.includes(l.id));
                const totalSelectedCount = selectedTags.length + selectedLabels.length;

                return (
                    <div className="space-y-5">
                        {/* Section Header */}
                        <SectionHeader icon={Tag} title={t('tagsAndLabels')} subtitle={t('filterByTagsAndLabels')} />

                        {/* Search & Actions Bar */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={tagSearch}
                                    onChange={e => setTagSearch(e.target.value)}
                                    placeholder="Search tags or labels..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#00B074]/30 placeholder:text-slate-400 text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setCreateTagModalEditData({ category: 'Tag' });
                                        setIsCreateTagModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 border border-[#00B074] hover:bg-[#00B074]/5 focus:outline-none focus:ring-0 text-xs font-black text-[#00B074] rounded-xl transition-all active:scale-95 cursor-pointer select-none"
                                >
                                    {t('createTag')}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setCreateTagModalEditData({ category: 'Label' });
                                        setIsCreateTagModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 border border-[#00B074] hover:bg-[#00B074]/5 focus:outline-none focus:ring-0 text-xs font-black text-[#00B074] rounded-xl transition-all active:scale-95 cursor-pointer select-none"
                                >
                                    {t('createLabel')}
                                </button>
                            </div>
                        </div>

                        {/* Tabs Pill Bar */}
                        <div className="flex gap-2 pt-1">
                            {(['All', 'Tags', 'Labels'] as const).map(tab => {
                                const active = activeTagTab === tab;
                                const countValue = tab === 'All' ? totalCount : tab === 'Tags' ? tagsCount : labelsCount;
                                return (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTagTab(tab)}
                                        className={cn(
                                            'px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all duration-200 select-none border',
                                            active
                                                ? 'bg-[#00B074]/10 border-[#00B074] text-[#00B074]'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:text-slate-700 hover:border-slate-200 dark:hover:border-slate-700'
                                        )}
                                    >
                                        {tab === 'All' ? t('allTab') : tab === 'Tags' ? t('tagsTab') : t('labelsTab')} ({countValue})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Main Grid Splits */}
                        <div className="grid grid-cols-12 gap-5">
                            {/* Left Side tags grids */}
                            <div className="col-span-8 space-y-6">
                                {/* TAGS GRID SECTION */}
                                {(activeTagTab === 'All' || activeTagTab === 'Tags') && (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-[#00B074]/10 rounded-lg text-[#00B074] shrink-0 mt-0.5">
                                                <Tag className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-[13.5px] text-slate-800 dark:text-slate-100">{t("tags")}</h4>
                                                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{t('filterByTags')}</p>
                                            </div>
                                        </div>

                                        {/* Tags Cards Grid */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {filteredTags.map(tag => {
                                                const selected = draft.tagIds.includes(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() => toggleId('tagIds', tag.id)}
                                                        className={cn(
                                                            'flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer active:scale-[0.98]',
                                                            selected 
                                                                ? 'border-[#00B074] bg-[#00B074]/5 dark:bg-[#00B074]/5' 
                                                                : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={cn(
                                                                'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                                                                selected ? 'bg-[#00B074] border-[#00B074]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                                            )}>
                                                                {selected && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-extrabold text-[12.5px] text-slate-800 dark:text-slate-100 truncate">{tag.name}</p>
                                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{tag.conversations}  {t('conversationsCount')}</p>
                                                            </div>
                                                        </div>
                                                        <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-1.5" style={{ background: tag.color }} />
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Match Type for Tags */}
                                        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/50">
                                            <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-widest mb-2.5">{t('matchType')}</p>
                                            <div className="flex flex-col sm:flex-row gap-5">
                                                <button
                                                    type="button"
                                                    onClick={() => setTagMatchLogic('OR')}
                                                    className="flex items-start gap-2.5 text-left cursor-pointer focus:outline-none"
                                                >
                                                    <div className={cn(
                                                        'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                                                        tagMatchLogic === 'OR' ? 'border-[#00B074]' : 'border-slate-300 dark:border-slate-700'
                                                    )}>
                                                        {tagMatchLogic === 'OR' && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[12px] font-bold text-slate-750 dark:text-slate-200">{t('matchAnySelectedTag')}</p>
                                                        <p className="text-[10px] text-slate-405 dark:text-slate-500 mt-0.5">{t('showConversationsWithAnyTag')}</p>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTagMatchLogic('AND')}
                                                    className="flex items-start gap-2.5 text-left cursor-pointer focus:outline-none"
                                                >
                                                    <div className={cn(
                                                        'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                                                        tagMatchLogic === 'AND' ? 'border-[#00B074]' : 'border-slate-300 dark:border-slate-700'
                                                    )}>
                                                        {tagMatchLogic === 'AND' && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[12px] font-bold text-slate-750 dark:text-slate-200">{t('matchAllSelectedTags')}</p>
                                                        <p className="text-[10px] text-slate-405 dark:text-slate-500 mt-0.5">{t('showConversationsWithAllTags')}</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* LABELS GRID SECTION */}
                                {(activeTagTab === 'All' || activeTagTab === 'Labels') && (
                                    <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-[#00B074]/10 rounded-lg text-[#00B074] shrink-0 mt-0.5">
                                                <Tag className="w-4 h-4 rotate-90" />
                                            </div>
                                            <div>
                                                <h4 className="font-extrabold text-[13.5px] text-slate-800 dark:text-slate-100">{t("labels")}</h4>
                                                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{t('filterByLabels')}</p>
                                            </div>
                                        </div>

                                        {/* Labels Cards Grid */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {filteredLabels.map(lbl => {
                                                const selected = draft.tagIds.includes(lbl.id);
                                                return (
                                                    <button
                                                        key={lbl.id}
                                                        type="button"
                                                        onClick={() => toggleId('tagIds', lbl.id)}
                                                        className={cn(
                                                            'flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer active:scale-[0.98]',
                                                            selected 
                                                                ? 'border-[#00B074] bg-[#00B074]/5 dark:bg-[#00B074]/5' 
                                                                : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={cn(
                                                                'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                                                                selected ? 'bg-[#00B074] border-[#00B074]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                                            )}>
                                                                {selected && <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-extrabold text-[12.5px] text-slate-800 dark:text-slate-100 truncate">{lbl.name}</p>
                                                                <p className="text-[10px] text-slate-404 dark:text-slate-500 font-semibold mt-0.5">{lbl.conversations}  {t('conversationsCount')}</p>
                                                            </div>
                                                        </div>
                                                        <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-1.5" style={{ background: lbl.color }} />
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Match Type for Labels */}
                                        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/50">
                                            <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-widest mb-2.5">{t('matchType')}</p>
                                            <div className="flex flex-col sm:flex-row gap-5">
                                                <button
                                                    type="button"
                                                    onClick={() => setLabelMatchLogic('OR')}
                                                    className="flex items-start gap-2.5 text-left cursor-pointer focus:outline-none"
                                                >
                                                    <div className={cn(
                                                        'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                                                        labelMatchLogic === 'OR' ? 'border-[#00B074]' : 'border-slate-300 dark:border-slate-700'
                                                    )}>
                                                        {labelMatchLogic === 'OR' && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[12px] font-bold text-slate-750 dark:text-slate-200">{t('matchAnySelectedLabel')}</p>
                                                        <p className="text-[10px] text-slate-405 dark:text-slate-500 mt-0.5">{t('showConversationsWithAnyLabel')}</p>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLabelMatchLogic('AND')}
                                                    className="flex items-start gap-2.5 text-left cursor-pointer focus:outline-none"
                                                >
                                                    <div className={cn(
                                                        'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                                                        labelMatchLogic === 'AND' ? 'border-[#00B074]' : 'border-slate-300 dark:border-slate-700'
                                                    )}>
                                                        {labelMatchLogic === 'AND' && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[12px] font-bold text-slate-750 dark:text-slate-200">{t('matchAllSelectedLabels')}</p>
                                                        <p className="text-[10px] text-slate-405 dark:text-slate-500 mt-0.5">{t('showConversationsWithAllLabels')}</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Side Summary panel */}
                            <div className="col-span-4 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 rounded-3xl p-4 flex flex-col justify-between shadow-sm min-h-[440px] divide-y divide-slate-100 dark:divide-slate-800/80">
                                <div className="space-y-4 pb-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between pb-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-200">{t("selectedFilters")}</span>
                                            <span className="w-5 h-5 bg-[#00B074]/10 text-[#00B074] rounded-full text-[10px] flex items-center justify-center font-black">{totalSelectedCount}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setDraft(prev => ({ ...prev, tagIds: [] }))}
                                            className="text-[11px] font-black text-[#00B074] hover:text-[#009662] transition-colors cursor-pointer select-none"
                                        >
                                            Clear All
                                        </button>
                                    </div>

                                    {/* Tags Badges */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            <span>{t('tags')} ({selectedTags.length})</span>
                                            <span className="text-[10px] cursor-help text-slate-405">ⓘ</span>
                                        </div>
                                        {selectedTags.length === 0 ? (
                                            <p className="text-[11px] font-semibold text-slate-400 italic">{t("noTagsSelected")}</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedTags.map(t => (
                                                    <span 
                                                        key={t.id} 
                                                        className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#00B074]/30 text-[#00B074] rounded-xl text-[11px] font-extrabold"
                                                    >
                                                        {t.name}
                                                        <button 
                                                            type="button"
                                                            onClick={() => toggleId('tagIds', t.id)}
                                                            className="hover:opacity-75 transition-opacity cursor-pointer font-black text-[#00B074]"
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Labels Badges */}
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            <span>{t('labels')} ({selectedLabels.length})</span>
                                            <span className="text-[10px] cursor-help text-slate-405">ⓘ</span>
                                        </div>
                                        {selectedLabels.length === 0 ? (
                                            <p className="text-[11px] font-semibold text-slate-400 italic">{t("noLabelsSelected")}</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedLabels.map(l => (
                                                    <span 
                                                        key={l.id} 
                                                        className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#00B074]/30 text-[#00B074] rounded-xl text-[11px] font-extrabold"
                                                    >
                                                        {l.name}
                                                        <button 
                                                            type="button"
                                                            onClick={() => toggleId('tagIds', l.id)}
                                                            className="hover:opacity-75 transition-opacity cursor-pointer font-black text-[#00B074]"
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Match logic & reminder */}
                                <div className="space-y-4 pt-4">
                                    {/* Match Logic Badge Display */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t('matchLogic')}</p>
                                        <div className="flex gap-2">
                                            <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#00B074]/30 text-[#00B074] rounded-xl text-[10px] font-extrabold tracking-wide select-none">
                                                {t('tagsColon')} {tagMatchLogic}
                                            </span>
                                            <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-[#00B074]/30 text-[#00B074] rounded-xl text-[10px] font-extrabold tracking-wide select-none">
                                                {t('labelsColon')} {labelMatchLogic}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Notification banner */}
                                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl flex items-center justify-between gap-3 select-none">
                                        <div className="min-w-0">
                                            <p className="text-[11.5px] font-extrabold text-[#00B074] truncate">Filters are ready to apply</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{t('conversationsFilteredByTags')}</p>
                                        </div>
                                        <div className="w-7 h-7 rounded-full bg-[#00B074]/15 flex items-center justify-center shrink-0 text-[#00B074]">
                                            <Filter className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            default: return null;
        }
    };

    const activeCount = [
        draft.dateMode !== 'All',
        draft.readStatus !== 'All',
        draft.platform !== 'All',
        draft.agentIds.length > 0,
        draft.tagIds.length > 0,
        !!draft.keyword,
    ].filter(Boolean).length;

    if (!isOpen || !mounted) return null;

    return createPortal(
        <>
            <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 plus-jakarta-forced" 
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose();
                    }
                }}
            >
                {/* Panel */}
                <div 
                    className="relative w-full max-w-4xl h-[85vh] max-h-[750px] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-fade-in"
                    onClick={e => e.stopPropagation()}
                >
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("advancedFiltersTitle")}</h2>
                        <p className="text-[12px] text-slate-400 mt-0.5">{t('refineConversations')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> {t('resetAll')}
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left nav */}
                    <div className="w-48 shrink-0 border-r border-slate-100 dark:border-slate-800 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
                        {NAV.map(n => {
                            const Icon = n.icon;
                            const active = section === n.id;
                            return (
                                <button
                                    key={n.id}
                                    onClick={() => setSection(n.id)}
                                    className={cn(
                                        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left',
                                        active ? 'bg-[#00B074]/10 text-[#00B074]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    {n.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-900/50">
                        {renderContent()}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80">
                    <button className="flex items-center gap-1.5 text-[13px] text-slate-500 font-semibold hover:text-[#00B074] transition-colors">
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                            {t('cancel')}
                        </button>
                        <button
                            onClick={() => { onApply(draft); onClose(); }}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-[13px] font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            {t("applyFilters")}
                            {activeCount > 0 && (
                                <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] flex items-center justify-center font-black">{activeCount}</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            </div>
            <CreateTagModal
                isOpen={isCreateTagModalOpen}
                onOpenChange={setIsCreateTagModalOpen}
                editData={createTagModalEditData}
                onSuccess={() => {
                    console.log("Tag/Label successfully created!");
                    onRefreshTags?.();
                }}
            />
        </>,
        document.body
    );
}
