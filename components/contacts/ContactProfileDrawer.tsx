'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Star, MessageSquare, Phone, Mail, MoreHorizontal, ChevronRight, Plus, MapPin, Calendar, Clock, BarChart2, Tag, FileText, Zap, Users, Copy, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Tag { id: string; name: string; color: string | null; }

export interface DrawerContact {
    id: string;
    name?: string | null;
    waId: string;
    email?: string | null;
    profilePic?: string | null;
    isBlocked?: boolean;
    notes?: string | null;
    createdAt?: Date | null;
    lastMessageAt?: Date;
    tags?: Tag[];
    groups?: Array<{ group: { id: string; name: string; color: string | null } }>;
    assignedUsers?: Array<{ id: string; name: string | null; email: string }>;
    platform?: string;
    firstName?: string | null;
    lastName?: string | null;
    customAttributes?: any;
}

interface Props {
    contact: DrawerContact | null;
    onClose: () => void;
}

const TABS = ['Details', 'Activity', 'Notes', 'Tags'];

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-4 py-2.5 border-b border-slate-50 dark:border-slate-800">
            <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium w-36 shrink-0 pt-0.5">{label}</span>
            <span className="text-[13px] text-slate-700 dark:text-slate-200 font-medium flex-1">{value}</span>
        </div>
    );
}

export function ContactProfileDrawer({ contact, onClose }: Props) {
    const router = useRouter();
    const [tab, setTab] = useState('Details');
    const [starred, setStarred] = useState(false);

    // Notes tab state
    const [notes, setNotes] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (contact) {
            setNotes(contact.notes || '');
            setIsEditing(false);
            
            // Check if starred in customAttributes
            const attrs = (contact.customAttributes as Record<string, any>) || {};
            setStarred(!!attrs.starred || !!attrs.isStarred);
        }
    }, [contact]);

    const handleToggleStar = async () => {
        if (!contact) return;
        const newStarred = !starred;
        setStarred(newStarred); // Optimistic UI update
        
        try {
            const currentAttrs = (contact.customAttributes as Record<string, any>) || {};
            const updatedAttrs = {
                ...currentAttrs,
                starred: newStarred,
                isStarred: newStarred // Set both keys for compatibility with chat poll router
            };
            
            // Update local memory contact state
            contact.customAttributes = updatedAttrs;
            
            const res = await updateContact(contact.id, {
                customAttributes: updatedAttrs
            });
            
            if (res.success) {
                toast.success(newStarred ? 'Contact added to favorites' : 'Contact removed from favorites');
                router.refresh();
            } else {
                setStarred(!newStarred); // Revert on failure
                toast.error('Failed to update favorite status');
            }
        } catch (error: any) {
            setStarred(!newStarred); // Revert on error
            toast.error(error.message || 'An error occurred while updating star status');
        }
    };

    const handleSaveNote = async () => {
        if (!contact) return;
        setIsSaving(true);
        try {
            const res = await updateContact(contact.id, { notes: notes });
            if (res.success) {
                toast.success('Note updated successfully!');
                setIsEditing(false);
                router.refresh();
            } else {
                toast.error('Failed to save note');
            }
        } catch (e: any) {
            toast.error(e.message || 'An error occurred while saving the note');
        } finally {
            setIsSaving(false);
        }
    };

    if (!contact) return null;
    if (typeof window === 'undefined') return null;

    const initials = (contact.name || contact.waId)
        .replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase() || '??';

    const formatDate = (d?: Date | null) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const tagStyle = (color: string | null, name: string) => {
        if (color) return { bg: `${color}18`, text: color, border: `${color}40` };
        const map: Record<string, { bg: string; text: string; border: string }> = {
            vip: { bg: '#8b5cf618', text: '#7c3aed', border: '#8b5cf640' },
            high: { bg: '#f43f5e18', text: '#e11d48', border: '#f43f5e40' },
            new: { bg: '#3b82f618', text: '#2563eb', border: '#3b82f640' },
            regular: { bg: '#10b98118', text: '#059669', border: '#10b98140' },
        };
        const key = Object.keys(map).find(k => name.toLowerCase().includes(k)) || '';
        return map[key] || { bg: '#64748b18', text: '#475569', border: '#64748b40' };
    };

    const getRelativeTime = (date: Date | string | null | undefined) => {
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
    };

    const getJourneyTimeline = () => {
        const items: Array<{
            id: string;
            title: string;
            description: string;
            date: Date | string | null | undefined;
            type: 'create' | 'message' | 'group' | 'tag';
        }> = [];

        // 1. Enrollment (Created)
        if (contact.createdAt) {
            items.push({
                id: 'create',
                title: 'Contact Enrolled',
                description: 'Contact enrolled inside CRM directory.',
                date: contact.createdAt,
                type: 'create'
            });
        }

        // 2. Groups
        if (contact.groups && contact.groups.length > 0) {
            contact.groups.forEach((g, idx) => {
                items.push({
                    id: `group-${g.group.id}-${idx}`,
                    title: `Added to Segment: ${g.group.name}`,
                    description: `Contact added to segment group for campaigns.`,
                    date: contact.createdAt || contact.lastMessageAt,
                    type: 'group'
                });
            });
        }

        // 3. Tags
        if (contact.tags && contact.tags.length > 0) {
            contact.tags.forEach((t, idx) => {
                items.push({
                    id: `tag-${t.id}-${idx}`,
                    title: `Tagged with: ${t.name}`,
                    description: `CRM label tag was applied to contact.`,
                    date: contact.createdAt,
                    type: 'tag'
                });
            });
        }

        // 4. Last Message
        if (contact.lastMessageAt) {
            items.push({
                id: 'message',
                title: 'Chat Activity',
                description: 'Last inbound or outbound chat interaction recorded.',
                date: contact.lastMessageAt,
                type: 'message'
            });
        }

        // Sort items by date (descending, latest first)
        return items.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
    };

    const customAttrs = (contact.customAttributes as Record<string, any>) || {};
    const referral = customAttrs.referral || {};
    const source = customAttrs.adSource || customAttrs.source || customAttrs.contactSource || (referral?.source_type ? (referral.source_type === 'ad' ? 'Meta Ad' : 'Meta Post') : 'Organic / Direct');
    const adSourceId = customAttrs.ad_source_id || customAttrs.adId || referral?.source_id || referral?.ad_id;
    const adSourceType = (customAttrs.ad_source_type || referral?.source_type || (adSourceId ? 'ad' : '')).toLowerCase();
    const ctwaClickId = customAttrs.ctwa_click_id || referral?.ctwa_clid;
    const adHeadline = customAttrs.ad_headline || customAttrs.adTitle || customAttrs.campaignName || referral?.headline;
    const adSourceUrl = customAttrs.ad_source_url || referral?.source_url;
    const adAttributedAt = customAttrs.ad_attributed_at;
    const adsManagerUrl = adSourceId ? `https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${adSourceId}` : adSourceUrl;

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-[2px]"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 bottom-0 z-[99999] w-[360px] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 plus-jakarta-forced">

                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-14 w-14 rounded-full shadow-md">
                                <AvatarImage src={contact.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name || contact.waId)}&background=random&color=fff&bold=true&size=128`} />
                                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-bold text-lg rounded-full">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-[15px]">{contact.name || 'Anonymous'}</h3>
                                    <span className={cn(
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                        contact.isBlocked
                                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    )}>
                                        {contact.isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                    <button onClick={handleToggleStar} className="hover:scale-110 active:scale-95 transition-all cursor-pointer">
                                        <Star className={cn('w-4 h-4 transition-all', starred ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-400')} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">
                                        {contact.firstName || 'Customer'}
                                    </span>
                                    {contact.tags && contact.tags.slice(0, 1).map(t => {
                                        const s = tagStyle(t.color, t.name);
                                        return (
                                            <span key={t.id} style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                                                className="text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                {t.name}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0">
                            <X className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        </button>
                    </div>

                </div>

                {/* Tabs */}
                <div className="flex w-full border-b border-slate-100 dark:border-slate-800 px-4 shrink-0 font-sans bg-white dark:bg-slate-950">
                    {TABS.map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                'flex-1 py-3 text-[12.5px] font-extrabold border-b-2 text-center transition-all cursor-pointer font-sans',
                                tab === t
                                    ? 'border-[#00B074] text-[#00B074]'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 bg-white dark:bg-slate-950">

                    {tab === 'Details' && (
                        <div className="space-y-0">
                            <DetailRow label="Phone" value={<span className="text-emerald-600">+{contact.waId}</span>} />
                            <DetailRow label="Email" value={contact.email || <span className="text-slate-300 dark:text-slate-600 italic text-xs">Not set</span>} />
                            <DetailRow label="Platform" value={
                                <span className="capitalize text-[12px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold border border-emerald-100 dark:border-emerald-800/50">
                                    {contact.platform || 'WhatsApp'}
                                </span>
                            } />
                            <DetailRow label="Source" value={
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn(
                                        "text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
                                        adSourceId || (source && source.toLowerCase().includes('ad'))
                                            ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/50"
                                            : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                                    )}>
                                        {source}
                                    </span>
                                    {adHeadline && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400 italic truncate max-w-[170px]" title={adHeadline}>
                                            &quot;{adHeadline}&quot;
                                        </span>
                                    )}
                                </div>
                            } />

                            {adSourceId && (
                                <DetailRow 
                                    label={adSourceType === 'post' ? 'Post ID' : 'Ad ID'} 
                                    value={
                                        <div className="flex items-center gap-2">
                                            {adsManagerUrl ? (
                                                <a 
                                                    href={adsManagerUrl} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                                    title="Open in Meta Ads Manager"
                                                >
                                                    <span>{adSourceId}</span>
                                                    <ExternalLink className="w-3 h-3 text-emerald-500" />
                                                </a>
                                            ) : (
                                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">{adSourceId}</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(adSourceId);
                                                    toast.success(`${adSourceType === 'post' ? 'Post ID' : 'Ad ID'} copied to clipboard`);
                                                }}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600"
                                                title="Copy ID"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    } 
                                />
                            )}

                            {ctwaClickId && (
                                <DetailRow 
                                    label="Click ID (CTWA)" 
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate max-w-[140px]" title={ctwaClickId}>
                                                {ctwaClickId}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(ctwaClickId);
                                                    toast.success('Click ID copied to clipboard');
                                                }}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600"
                                                title="Copy Click ID"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    } 
                                />
                            )}

                            {adAttributedAt && (
                                <DetailRow label="Attributed At" value={formatDate(new Date(adAttributedAt))} />
                            )}

                            <DetailRow label="Added On" value={formatDate(contact.createdAt)} />
                            <DetailRow label="Last Seen" value={formatDate(contact.lastMessageAt)} />
                            <DetailRow label="Status" value={
                                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', contact.isBlocked ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50')}>
                                    {contact.isBlocked ? 'Blocked' : 'Active'}
                                </span>
                            } />
                            {contact.assignedUsers && contact.assignedUsers.length > 0 && (
                                <DetailRow label="Assigned To" value={contact.assignedUsers.map(u => u.name || u.email).join(', ')} />
                            )}

                            {/* Tags */}
                            <div className="pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-800 dark:text-slate-100 text-[13px]">Tags</span>
                                    <button className="text-[11px] font-bold text-emerald-600 hover:underline">Manage</button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {contact.tags && contact.tags.length > 0 ? contact.tags.map(t => {
                                        const s = tagStyle(t.color, t.name);
                                        return (
                                            <span key={t.id} style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-full">
                                                {t.name}
                                            </span>
                                        );
                                    }) : <span className="text-slate-300 dark:text-slate-600 italic text-xs">No tags</span>}
                                    <button className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all flex items-center gap-1">
                                        <Plus className="w-2.5 h-2.5" /> Add Tag
                                    </button>
                                </div>
                            </div>

                            {/* Notes */}
                            {notes && (
                                <div className="pt-4 border-t border-slate-50 dark:border-slate-800 mt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-slate-800 dark:text-slate-100 text-[13px]">Notes</span>
                                        <button 
                                            onClick={() => {
                                                setTab('Notes');
                                                setIsEditing(true);
                                            }}
                                            className="text-[11px] font-bold text-emerald-600 hover:underline"
                                        >
                                            Edit Note
                                        </button>
                                    </div>
                                    <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">{notes}</p>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="pt-4 border-t border-slate-50 dark:border-slate-800 mt-2">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-[13px] block mb-3">Quick Actions</span>
                                {[
                                    { icon: MessageSquare, label: 'Start Conversation', sub: 'Send message on WhatsApp', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
                                    { icon: Zap, label: 'Add to Campaign', sub: 'Add to broadcast campaign', color: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300' },
                                ].map(({ icon: Icon, label, sub, color }) => (
                                    <button key={label} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 mb-2">
                                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{label}</p>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'Notes' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-[14px]">Notes</span>
                                {!isEditing && (
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="text-[12px] font-extrabold text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer"
                                    >
                                        {notes ? 'Edit Note' : '+ Add Note'}
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Type your notes here..."
                                        rows={6}
                                        className="w-full text-[13px] text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium resize-none placeholder-slate-400 dark:placeholder-slate-600"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            disabled={isSaving}
                                            onClick={() => {
                                                setNotes(contact.notes || '');
                                                setIsEditing(false);
                                            }}
                                            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent disabled:opacity-50 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={isSaving}
                                            onClick={handleSaveNote}
                                            className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#00B074] hover:bg-[#009662] text-white transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Note'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {notes ? (
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                            <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">{notes}</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                                            <FileText className="w-9 h-9 mb-2 opacity-30" />
                                            <p className="text-sm font-bold">No notes yet</p>
                                            <button 
                                                onClick={() => setIsEditing(true)}
                                                className="text-xs font-bold text-emerald-600 hover:underline mt-2 cursor-pointer"
                                            >
                                                Click to add a note
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {tab === 'Tags' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-bold text-slate-800 dark:text-slate-100">Tags</span>
                                <button className="text-[12px] font-bold text-emerald-600 hover:underline">Manage</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {contact.tags && contact.tags.length > 0 ? contact.tags.map(t => {
                                    const s = tagStyle(t.color, t.name);
                                    return (
                                        <span key={t.id} style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-full">
                                            {t.name}
                                        </span>
                                    );
                                }) : <p className="text-slate-400 dark:text-slate-500 text-sm">No tags assigned</p>}
                            </div>
                        </div>
                    )}

                    {tab === 'Activity' && (() => {
                        const timeline = getJourneyTimeline();
                        if (timeline.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-300 dark:text-slate-600">
                                    <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
                                    <p className="text-sm font-bold">No journey activity yet</p>
                                </div>
                            );
                        }

                        return (
                            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 dark:before:bg-slate-800/80 before:border-dashed before:border-l">
                                {timeline.map((item) => {
                                    return (
                                        <div key={item.id} className="relative flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            {/* Icon Indicator */}
                                            <div className={cn(
                                                "absolute -left-[30px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm",
                                                item.type === 'create' && 'bg-emerald-50 dark:bg-emerald-950/20',
                                                item.type === 'message' && 'bg-blue-50 dark:bg-blue-950/20',
                                                item.type === 'group' && 'bg-indigo-50 dark:bg-indigo-950/20',
                                                item.type === 'tag' && 'bg-amber-50 dark:bg-amber-950/20'
                                            )}>
                                                {item.type === 'create' && <Zap className="w-2.5 h-2.5 text-[#00B074]" />}
                                                {item.type === 'message' && <MessageSquare className="w-2.5 h-2.5 text-blue-500" />}
                                                {item.type === 'group' && <Users className="w-2.5 h-2.5 text-indigo-500" />}
                                                {item.type === 'tag' && <Tag className="w-2.5 h-2.5 text-amber-500" />}
                                            </div>

                                            {/* Text details */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200">
                                                    {item.title}
                                                </span>
                                                <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                                    {getRelativeTime(item.date)}
                                                </span>
                                            </div>
                                            <p className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 leading-normal">
                                                {item.description}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {tab === 'More' && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-300 dark:text-slate-600">
                            <BarChart2 className="w-10 h-10 mb-2" />
                            <p className="text-sm font-medium">No details yet</p>
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
