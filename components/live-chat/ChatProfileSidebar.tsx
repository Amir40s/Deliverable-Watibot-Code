import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, ChevronDown, ChevronUp, User, Clock, MessageSquare,
    Zap, Tag, ShoppingBag, BarChart3, Database, History,
    Instagram, Facebook, Mail, Phone, Info, CheckCircle2, AlertCircle, ShieldAlert, Loader2, UserPlus,
    MapPin, Link as LinkIcon, Video, MoreHorizontal, ChevronsLeft, ChevronsRight, Plus, Calendar, Edit2,
    FileText, Activity, Ban, Webhook, ExternalLink
} from 'lucide-react';
import { cn, format12HourTime } from "@/lib/utils";
import { ChatAvatar } from "./ChatAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getContactProfileData } from "@/app/actions/contact-profile";
import { useSession } from "next-auth/react";


interface ChatProfileSidebarProps {
    contact: any;
    messages: any[];
    canSendRegular: boolean;
    onClose: () => void;
}
import { useTranslations } from 'next-intl';
import { isInternalCustomAttribute } from "@/lib/contacts/attributes";

export function ChatProfileSidebar({
    contact: initialContact, messages, canSendRegular, onClose }: ChatProfileSidebarProps) {
    const t = useTranslations('ProfileSidebar');
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';

    const [contact, setContact] = useState(initialContact);



    const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'activity' | 'campaigns' | 'tags'>('info');
    const [profileData, setProfileData] = useState<{ campaigns: any[], tags: any[], journey: any[] } | null>(null);
    const [windowData, setWindowData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [expandedSessionIdx, setExpandedSessionIdx] = useState<number | null>(null);
    const [customAttrs, setCustomAttrs] = useState<Array<{ name: string; value: string }>>([]);
    const [isAddingAttr, setIsAddingAttr] = useState(false);
    const [newAttrName, setNewAttrName] = useState('');
    const [newAttrValue, setNewAttrValue] = useState('');

    const [notes, setNotes] = useState<Array<{ id: string, text: string, date: string }>>([]);
    const [allTags, setAllTags] = useState<any[]>([]);
    const [isSelectingTag, setIsSelectingTag] = useState(false);
    const [isSavingCrm, setIsSavingCrm] = useState(false);

    useEffect(() => {
        if (contact?.id) {
            import('@/app/actions/window-reminders').then(({ getContactWindowDetails }) => {
                getContactWindowDetails(contact.id).then((res) => {
                    if (res.success) setWindowData(res.data);
                }).catch(console.error);
            });
        }
    }, [contact?.id, contact?.lastInboundMessageAt, contact?.windowExpiresAt]);

    const handleSaveToCrm = async () => {
        if (!contact?.id || isSavingCrm) return;
        setIsSavingCrm(true);
        try {
                        const res = await promoteToContact(contact.id);
            if (res.success) {
                setContact((prev: any) => prev ? { ...prev, isAutoCreated: false } : null);
            }
        } catch (err) {
            console.error("Failed to save contact to CRM:", err);
        } finally {
            setIsSavingCrm(false);
        }
    };

    useEffect(() => {
        if (contact && contact.notes) {
            try {
                const parsed = JSON.parse(contact.notes);
                if (Array.isArray(parsed)) {
                    setNotes(parsed);
                } else {
                    setNotes([{ id: '1', text: contact.notes, date: 'Initial Note' }]);
                }
            } catch (e) {
                setNotes([{ id: '1', text: contact.notes, date: 'Initial Note' }]);
            }
        } else {
            setNotes([]);
        }
    }, [contact?.notes]);

    useEffect(() => {
        setContact(initialContact);
    }, [initialContact]);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const { getTags } = await import('@/app/actions/tags');
                const tags = await getTags();
                setAllTags(tags);
            } catch (err) {
                console.error("Failed to load workspace tags:", err);
            }
        };
        fetchTags();
    }, []);

    useEffect(() => {
        if (contact && contact.customAttributes) {
            try {
                let parsed = contact.customAttributes;
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    const mapped: Array<{ name: string; value: string }> = [];
                    for (const [name, value] of Object.entries(parsed)) {
                        if (isInternalCustomAttribute(name)) continue;
                        if (value !== null && typeof value === 'object') continue;
                        mapped.push({
                            name,
                            value: String(value ?? '')
                        });
                    }
                    setCustomAttrs(mapped);
                } else if (Array.isArray(parsed)) {
                    setCustomAttrs(
                        parsed.filter((item: any) => item && item.name && !isInternalCustomAttribute(item.name))
                    );
                } else {
                    setCustomAttrs([]);
                }
            } catch (e) {
                console.error("Failed to parse customAttributes:", e);
                setCustomAttrs([]);
            }
        } else {
            setCustomAttrs([]);
        }
    }, [contact?.customAttributes]);

    const handleSaveAttribute = async (updatedAttrs: Array<{ name: string; value: string }>) => {
        try {
            
            // Preserve internal system attributes from existing contact.customAttributes
            let existingParsed: Record<string, any> = {};
            try {
                if (contact?.customAttributes) {
                    existingParsed = typeof contact.customAttributes === 'string'
                        ? JSON.parse(contact.customAttributes)
                        : (contact.customAttributes || {});
                }
            } catch (e) {
                // ignore
            }

            const attributesObj: Record<string, any> = {};
            // Retain internal/system attributes (e.g. whatsappJid, whatsappLid, leadData, etc.)
            if (existingParsed && typeof existingParsed === 'object' && !Array.isArray(existingParsed)) {
                for (const [k, v] of Object.entries(existingParsed)) {
                    if (isInternalCustomAttribute(k) || (v !== null && typeof v === 'object')) {
                        attributesObj[k] = v;
                    }
                }
            }

            // Apply visible user-defined attributes
            updatedAttrs.forEach(attr => {
                if (attr.name && attr.name.trim() && !isInternalCustomAttribute(attr.name)) {
                    attributesObj[attr.name.trim()] = attr.value;
                }
            });

            await updateContact(contact.id, { customAttributes: attributesObj });
            setContact((prev: any) => ({ ...prev, customAttributes: attributesObj }));
            setCustomAttrs(updatedAttrs.filter(a => !isInternalCustomAttribute(a.name)));
        } catch (err) {
            console.error("Failed to save custom attributes:", err);
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        try {
                        const remainingTags = (contact.tags || []).filter((t: any) => t.id !== tagId);
            const remainingTagIds = remainingTags.map((t: any) => t.id);
            await updateContact(contact.id, { tagIds: remainingTagIds });
            setContact({ ...contact, tags: remainingTags });
        } catch (err) {
            console.error("Failed to remove tag:", err);
        }
    };

    const handleAddTag = async (tagId: string) => {
        try {
            const tag = allTags.find(t => t.id === tagId);
            if (!tag) return;
            const currentTags = contact.tags || [];
            if (currentTags.some((t: any) => t.id === tagId)) return;

                        const newTags = [...currentTags, tag];
            await updateContact(contact.id, { tagIds: newTags.map((t: any) => t.id) });
            setContact({ ...contact, tags: newTags });
            setIsSelectingTag(false);
        } catch (err) {
            console.error("Failed to add tag:", err);
        }
    };

    useEffect(() => {
        if (!contact?.id) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const data = await getContactProfileData(contact.id);
                setProfileData(data);
            } catch (err) {
                console.error("Failed to fetch profile data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [contact?.id]);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        const newNoteObj = {
            id: Date.now().toString(),
            text: newNote.trim(),
            date: new Date().toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
        const updatedNotes = [newNoteObj, ...notes];
        setNotes(updatedNotes);
        setNewNote('');

        try {
                        await updateContact(contact.id, { notes: JSON.stringify(updatedNotes) });
            setContact({ ...contact, notes: JSON.stringify(updatedNotes) });
        } catch (err) {
            console.error("Failed to save note:", err);
        }
    };

    const handleRemoveNote = async (noteId: string) => {
        const updatedNotes = notes.filter(n => n.id !== noteId);
        setNotes(updatedNotes);

        try {
                        await updateContact(contact.id, { notes: JSON.stringify(updatedNotes) });
            setContact({ ...contact, notes: JSON.stringify(updatedNotes) });
        } catch (err) {
            console.error("Failed to delete note:", err);
        }
    };

    const handleToggleBlock = async () => {
        setIsBlocking(true);
        try {
                        const newBlockStatus = !contact.isBlocked;
            await updateContact(contact.id, { isBlocked: newBlockStatus });
            setContact({ ...contact, isBlocked: newBlockStatus });
            alert(`Contact has been ${newBlockStatus ? 'blocked' : 'unblocked'} successfully.`);
        } catch (err) {
            console.error("Failed to toggle block status:", err);
            alert("Failed to update block status. Please try again.");
        } finally {
            setIsBlocking(false);
        }
    };

    const [isTogglingWebhook, setIsTogglingWebhook] = useState(false);
    const [availableWebhooks, setAvailableWebhooks] = useState<Array<{ id: string; name: string; targetUrl?: string; isSystem?: boolean; isActive?: boolean }>>([]);

    useEffect(() => {
        const fetchWebhooks = async () => {
            if (!contact?.id) return;
            try {
                                const res = await getOrganizationWebhooks(contact.id);
                if (res.success && res.webhooks) {
                    setAvailableWebhooks(res.webhooks);
                }
            } catch (err) {
                console.error("Failed to load webhooks for sidebar:", err);
            }
        };
        fetchWebhooks();
    }, [contact?.id]);

    const handleToggleSpecificWebhook = async (webhookId: string) => {
        setIsTogglingWebhook(true);
        try {
                        if (webhookId === 'all') {
                const nextStatus = !(contact.isWebhookEnabled ?? true);
                const res = await toggleSpecificWebhookAutomation(contact.id, 'all', nextStatus);
                if (res.success && res.contact) {
                    setContact({ ...contact, ...res.contact });
                }
            } else {
                const disabledList = contact.disabledWebhookIds || [];
                const isCurrentlyDisabled = disabledList.includes(webhookId);
                const enableIt = isCurrentlyDisabled;
                const res = await toggleSpecificWebhookAutomation(contact.id, webhookId, enableIt);
                if (res.success && res.contact) {
                    setContact({ ...contact, ...res.contact });
                }
            }
        } catch (err) {
            console.error("Failed to toggle webhook status:", err);
        } finally {
            setIsTogglingWebhook(false);
        }
    };

    const firstMessage = messages.length > 0 ? messages[0] : null;
    const contactCustomAttrs = (contact?.customAttributes as Record<string, any>) || {};
    const storedSource = contactCustomAttrs.source || contactCustomAttrs.contactSource;
    const adSource = contactCustomAttrs.adSource;
    const campaignName = contactCustomAttrs.campaignName || contactCustomAttrs.adTitle || contactCustomAttrs.referral?.headline;
    const referral = firstMessage?.rawBody?.referral || contactCustomAttrs.referral;
    const adSourceId = contactCustomAttrs.ad_source_id || contactCustomAttrs.adId || referral?.source_id || referral?.ad_id;
    const adSourceType = (contactCustomAttrs.ad_source_type || referral?.source_type || (adSourceId ? 'ad' : '')).toLowerCase();
    const ctwaClickId = contactCustomAttrs.ctwa_click_id || referral?.ctwa_clid;
    const adsManagerUrl = adSourceId ? `https://adsmanager.facebook.com/adsmanager/manage/ads?selected_ad_ids=${adSourceId}` : (contactCustomAttrs.ad_source_url || referral?.source_url);

    let sourceValue = 'General';
    if (adSource && campaignName) {
        sourceValue = `${adSource}: "${campaignName}"`;
    } else if (adSource) {
        sourceValue = adSource;
    } else if (storedSource && storedSource !== 'General' && storedSource !== 'Organic') {
        sourceValue = campaignName ? `${storedSource}: "${campaignName}"` : storedSource;
    } else if (referral) {
        const platform = referral.source_url?.includes('instagram.com') ? 'Instagram' : 'Facebook';
        const isAd = referral.source_type === 'ad' || referral.ad_id || referral.source_id;
        const headline = referral.headline ? `: "${referral.headline}"` : '';
        sourceValue = `${platform} ${isAd ? 'Ad' : 'Campaign'}${headline}`;
    } else {
        sourceValue = storedSource || 'General';
    }
    const firstSeenValue = contact.createdAt
        ? new Date(contact.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '12 May 2024, 10:20 AM';
    const lastSeenValue = contact.lastInboundMessageAt
        ? new Date(contact.lastInboundMessageAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Today, 10:30 AM';

    const infoItems = [
        { label: 'Source', value: sourceValue, icon: <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" /> },
        ...(adSourceId ? [{
            label: adSourceType === 'post' ? 'Post ID' : 'Ad ID',
            value: (
                <div className="flex items-center justify-end gap-1">
                    {adsManagerUrl ? (
                        <a 
                            href={adsManagerUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            title="Open in Meta Ads Manager"
                        >
                            <span>{adSourceId}</span>
                            <ExternalLink className="w-3 h-3 text-emerald-500 shrink-0" />
                        </a>
                    ) : (
                        <span className="text-xs font-mono font-bold">{adSourceId}</span>
                    )}
                </div>
            ),
            icon: <Tag className="w-4 h-4 text-slate-400 shrink-0" />
        }] : []),
        ...(ctwaClickId ? [{
            label: 'Click ID',
            value: <span className="text-[11px] font-mono truncate max-w-[130px] block" title={ctwaClickId}>{ctwaClickId}</span>,
            icon: <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
        }] : []),
        { label: 'First Seen', value: firstSeenValue, icon: <Clock className="w-4 h-4 text-slate-400 shrink-0" /> },
        { label: 'Last Seen', value: lastSeenValue, icon: <Clock className="w-4 h-4 text-slate-400 shrink-0" /> },
    ];

    // Group messages into distinct 24h conversation blocks dynamically
    const dynamicConversations = (() => {
        if (!messages || messages.length === 0) return [];

        // Sort chronologically
        const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const sessions: Array<{ title: string; desc: string; date: string; status: 'Open' | 'Closed'; messages: any[] }> = [];
        let currentSession: { startTime: number; lastTime: number; firstMessageText: string; count: number; messages: any[] } | null = null;

        for (const msg of sorted) {
            const msgTime = new Date(msg.createdAt).getTime();
            // Get clean text snippet of message
            let msgText = msg.content || '';
            if (!msgText && msg.type === 'template') {
                msgText = `Template Message`;
            } else if (!msgText) {
                msgText = `Media Message (${msg.type || 'WhatsApp'})`;
            }

            if (!currentSession || (msgTime - currentSession.lastTime > 24 * 60 * 60 * 1000)) {
                if (currentSession) {
                    const isSessionClosed = (Date.now() - currentSession.lastTime > 24 * 60 * 60 * 1000);
                    const formattedDate = new Date(currentSession.startTime).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });
                    sessions.push({
                        title: currentSession.firstMessageText.length > 25
                            ? currentSession.firstMessageText.slice(0, 25) + '...'
                            : currentSession.firstMessageText,
                        desc: t('messagesCount', { count: currentSession.count }),
                        date: formattedDate,
                        status: isSessionClosed ? 'Closed' : 'Open',
                        messages: currentSession.messages
                    });
                }
                currentSession = {
                    startTime: msgTime,
                    lastTime: msgTime,
                    firstMessageText: msgText || 'Inquiry Started',
                    count: 1,
                    messages: [msg]
                };
            } else {
                currentSession.lastTime = msgTime;
                currentSession.count += 1;
                currentSession.messages.push(msg);
            }
        }

        if (currentSession) {
            const isSessionClosed = (Date.now() - currentSession.lastTime > 24 * 60 * 60 * 1000);
            const formattedDate = new Date(currentSession.startTime).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            sessions.push({
                title: currentSession.firstMessageText.length > 25
                    ? currentSession.firstMessageText.slice(0, 25) + '...'
                    : currentSession.firstMessageText,
                desc: t('messagesCount', { count: currentSession.count }),
                date: formattedDate,
                status: isSessionClosed ? 'Closed' : 'Open',
                messages: currentSession.messages
            });
        }

        return sessions.reverse();
    })();

    const displayConversations = dynamicConversations;

    const displayCampaigns = profileData?.campaigns ? profileData.campaigns : [];

    return (
        <div
            className="relative overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-100 dark:border-slate-800 h-full flex flex-col shrink-0 animate-in slide-in-from-right duration-350 shadow-xl z-50 md:relative absolute right-0 top-0 bottom-0 w-[330px]"
        >
            {/* Header - EXACTLY LIKE MOCKUP */}
            <div className="h-16 flex items-center justify-between px-4.5 border-b border-slate-100 dark:border-slate-900 shrink-0 bg-white dark:bg-slate-950">
                <h3 className="font-bold text-slate-850 dark:text-slate-100 text-[14.5px] tracking-tight">{t("contactDetails")}</h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500 text-slate-450 dark:text-slate-500 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 w-full max-w-full overflow-x-hidden">
                <div className="p-4.5 space-y-5">
                    {/* Contact Hero Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            {/* Avatar with Status indicator */}
                            <div className="relative">
                                <ChatAvatar contact={contact} className="w-12 h-12 border border-slate-100 dark:border-slate-800" />
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center shadow-sm">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#25D366]" />
                                </div>
                            </div>

                            {/* Name & Platform Number */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="text-[14.5px] font-bold text-slate-800 dark:text-white truncate tracking-tight">
                                        {contact.name || contact.whatsappName || `+${contact.waId}`}
                                    </h2>
                                </div>
                                {contact.whatsappName && contact.name && contact.whatsappName !== contact.name && (
                                    <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-semibold block truncate">
                                        WhatsApp Name: {contact.whatsappName}
                                    </span>
                                )}
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="w-3.5 h-3.5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                                        <svg className="w-2.5 h-2.5 text-white fill-white" viewBox="0 0 24 24">
                                            <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.04 15.04 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .25-1.02A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold truncate">+{contact.waId}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {contact?.isAutoCreated && (
                        <Button
                            onClick={handleSaveToCrm}
                            disabled={isSavingCrm}
                            size="sm"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm gap-1.5 transition-all py-2 cursor-pointer"
                        >
                            {isSavingCrm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                            Save to Contact List
                        </Button>
                    )}

                    {/* WhatsApp 24-Hour Customer Service Window Card */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                24-Hour Window
                            </div>
                            {windowData?.windowStatus === 'ACTIVE' ? (
                                <Badge className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0">
                                    ACTIVE
                                </Badge>
                            ) : windowData?.windowStatus === 'EXPIRING_SOON' ? (
                                <Badge className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0">
                                    EXPIRING SOON
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="text-[9px] font-bold px-1.5 py-0">
                                    EXPIRED
                                </Badge>
                            )}
                        </div>

                        <div className="text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Started:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {windowData?.lastInboundMessageAt
                                        ? new Date(windowData.lastInboundMessageAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : 'No inbound message'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Expires:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {windowData?.windowExpiresAt
                                        ? new Date(windowData.windowExpiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : 'Expired'}
                                </span>
                            </div>
                        </div>

                        {windowData?.rules && windowData.rules.length > 0 && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                    Expiry Reminders:
                                </span>
                                {windowData.rules.map((r: any) => (
                                    <div key={r.ruleId} className="flex items-center justify-between text-[11px]">
                                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 truncate">
                                            {r.isSent ? (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            ) : (
                                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                            )}
                                            {r.ruleName} ({r.minutesBeforeExpiry}m)
                                        </span>
                                        <span className={`text-[10px] font-bold shrink-0 ${r.isSent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                            {r.isSent ? (r.sentAt ? new Date(r.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sent') : 'Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation Tabs - Info, Notes, Activity, Campaigns */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-0.5 rounded-xl flex items-center gap-0.5 border border-slate-100 dark:border-slate-850/50">
                        {([
                            { id: 'info', label: t("infoTab"), icon: <User className="w-3 h-3" /> },
                            { id: 'notes', label: t("notesTab"), icon: <FileText className="w-3 h-3" /> },
                            { id: 'activity', label: t("activityTab"), icon: <Activity className="w-3 h-3" /> },
                            { id: 'campaigns', label: t("campaignsTab"), icon: <Zap className="w-3 h-3" /> }
                        ] as const).map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${isActive
                                            ? 'bg-white dark:bg-slate-950 text-slate-800 dark:text-white shadow-sm border border-slate-100/50 dark:border-slate-800/60 scale-[1.01]'
                                            : 'text-slate-455 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'
                                        }`}
                                >
                                    {tab.icon}
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Contents */}
                    <div className="min-h-[140px] animate-in fade-in duration-300">
                        {activeTab === 'info' && (
                            <div className="space-y-3.5">
                                {infoItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[12.5px] border-b border-slate-50/50 dark:border-slate-900/40 pb-2">
                                        <span className="text-slate-500 dark:text-slate-450 font-semibold flex items-center gap-2">
                                            {item.icon} {item.label}
                                        </span>
                                        <span className="text-slate-750 dark:text-slate-200 font-bold max-w-[180px] truncate text-right">
                                            {item.value}
                                        </span>
                                    </div>
                                ))}

                                {/* Assigned Tags Section inside Info Tab */}
                                <div className="pt-1.5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest">
                                        <Tag className="w-3 h-3 text-[#25D366]" /> {t('assignedTags')}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact.tags && contact.tags.length > 0 ? (
                                            contact.tags.map((tag: any) => (
                                                <Badge
                                                    key={tag.id}
                                                    style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '30' }}
                                                    className="text-[10px] font-black px-2 py-0.5 border rounded-xl flex items-center gap-1 shadow-sm select-none"
                                                >
                                                    {tag.name}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-[11px] italic text-slate-400">No tags assigned.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Webhook Automation Section */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Webhook className="w-4 h-4 text-emerald-500 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Webhook Automation</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {(contact.isWebhookEnabled ?? true) ? 'Active' : 'All Disabled'}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isTogglingWebhook}
                                            onClick={() => handleToggleSpecificWebhook('all')}
                                            className={cn(
                                                "h-7 px-2 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer",
                                                (contact.isWebhookEnabled ?? true)
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                                            )}
                                        >
                                            {(contact.isWebhookEnabled ?? true) ? 'MASTER ON' : 'MASTER OFF'}
                                        </Button>
                                    </div>

                                    {(contact.isWebhookEnabled ?? true) && availableWebhooks.length > 0 && (
                                        <div className="pl-6 space-y-1.5 pt-1">
                                            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Configured Webhooks</span>
                                            {availableWebhooks.map((wh) => {
                                                const isThisDisabled = contact.disabledWebhookIds?.includes(wh.id);
                                                const isTargetOn = !isThisDisabled;
                                                return (
                                                    <div key={wh.id} className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                                                        <div className="flex flex-col min-w-0 pr-2">
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{wh.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={isTogglingWebhook}
                                                            onClick={() => handleToggleSpecificWebhook(wh.id)}
                                                            className={cn(
                                                                "px-1.5 py-0.5 text-[8.5px] font-black rounded-md uppercase cursor-pointer transition-colors",
                                                                isTargetOn
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200"
                                                                    : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-200"
                                                            )}
                                                        >
                                                            {isTargetOn ? "ON" : "OFF"}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={t("addNote")}
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        className="h-10 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold focus-visible:ring-emerald-500"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                                    />
                                    <Button onClick={handleAddNote} className="bg-primary hover:bg-primary/95 text-white h-10 px-4 rounded-xl font-bold uppercase tracking-wider text-[10px]">
                                        Add
                                    </Button>
                                </div>
                                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                                    {notes.map((note) => (
                                        <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850/60 rounded-2xl relative group">
                                            <p className="text-xs text-slate-700 dark:text-slate-250 leading-relaxed font-semibold italic">"{note.text}"</p>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold block mt-1.5 uppercase tracking-wider">{note.date}</span>
                                            <button
                                                onClick={() => handleRemoveNote(note.id)}
                                                className="absolute top-2 right-2 text-slate-350 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {notes.length === 0 && (
                                        <span className="text-xs italic text-slate-400 block text-center py-6">{t("noNotes")}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="space-y-3.5">
                                {(profileData?.journey && profileData.journey.length > 0) ? (
                                    <div className="relative border-l-2 border-slate-100 dark:border-slate-800 pl-4 ml-2 space-y-4 max-h-[250px] overflow-y-auto">
                                        {profileData.journey.slice(0, 10).map((step: any, idx: number) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-550 border-2 border-white dark:border-slate-950 shadow-sm" />
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">{step.title}</p>
                                                {step.content && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 leading-snug">{step.content}</p>}
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5 uppercase tracking-wider font-semibold">
                                                    {new Date(step.timestamp).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-xs">
                                        <Activity className="w-8 h-8 opacity-30 mb-2" />
                                        <span>No activity timeline recorded.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'campaigns' && (
                            <div className="space-y-3.5">
                                {/* {t('campaignsSummary')} Card */}
                                <div className="p-3 bg-gradient-to-br from-[#00a884]/5 via-white to-slate-50/50 dark:from-emerald-950/5 dark:to-slate-900/20 border border-[#00a884]/10 dark:border-emerald-500/10 rounded-3xl relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
                                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-2.5">
                                        <Zap className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                                        {t('campaignsSummary')}
                                    </div>
                                    <div className="flex justify-between items-center bg-white/40 dark:bg-slate-900/30 p-2.5 rounded-2xl border border-slate-100/50 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[20px] font-black text-slate-800 dark:text-white leading-none">
                                                {displayCampaigns.length}
                                            </span>
                                            <span className="text-[9px] text-slate-450 dark:text-slate-555 font-bold uppercase mt-0.5">{t('campaignsInteracted')}</span>
                                        </div>
                                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                                        <div className="flex flex-col items-end">
                                            <span className="text-[20px] font-black text-emerald-600 dark:text-emerald-450">{t("active")}</span>
                                            <span className="text-[9px] text-slate-450 dark:text-slate-555 font-bold uppercase mt-0.5">{t('currentStatus')}</span>
                                        </div>
                                    </div>
                                </div>

                                 {/* Campaigns List */}
                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                    {displayCampaigns.length > 0 ? (
                                        displayCampaigns.map((camp: any) => {
                                            const dateStr = camp.lastExecutedAt
                                                ? new Date(camp.lastExecutedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : 'Recent';
                                            return (
                                                <div key={camp.id} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100/50 dark:border-slate-850/40 text-[12px] shadow-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/20">
                                                            <Zap className="w-3.5 h-3.5 text-[#25D366]" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-slate-700 dark:text-slate-200 truncate leading-snug">{camp.name}</p>
                                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">{t("lastExecution")}: {dateStr}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <span className="text-xs italic text-slate-400 block text-center py-3">No campaigns interacted</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'tags' && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-1.5">
                                    {contact.tags && contact.tags.length > 0 ? (
                                        contact.tags.map((tag: any) => (
                                            <Badge
                                                key={tag.id}
                                                style={{ backgroundColor: tag.color + '15', color: tag.color, borderColor: tag.color + '30' }}
                                                className="text-[11px] font-bold px-2.5 py-1 border rounded-xl flex items-center gap-1.5 shadow-sm"
                                            >
                                                {tag.name}
                                                <button
                                                    onClick={() => handleRemoveTag(tag.id)}
                                                    className="hover:text-rose-500 transition-colors ml-0.5 shrink-0"
                                                >
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-xs italic text-slate-400">No tags assigned to this contact.</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Previous Conversations - DYNAMIC COLLAPSIBLE TRANSCRIPTS */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-900/60">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{t("previousConversations")}</h4>
                            <span className="text-[11px] font-bold text-[#25D366] cursor-pointer hover:underline">{t("viewAll")}</span>
                        </div>
                        <div className="space-y-2.5">
                            {displayConversations.map((item, idx) => (
                                <div key={idx} className="border-b border-slate-50/50 dark:border-slate-900/40 pb-2">
                                    <div
                                        onClick={() => setExpandedSessionIdx(expandedSessionIdx === idx ? null : idx)}
                                        className="flex justify-between items-center text-[12.5px] py-2 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/20 px-1 rounded-xl transition-all select-none"
                                    >
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800 flex items-center justify-center shrink-0">
                                                <MessageSquare className="w-3.5 h-3.5 text-slate-450" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-700 dark:text-slate-200 truncate leading-snug">{item.title}</p>
                                                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-semibold">{item.desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0 gap-1 ml-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-semibold leading-none">{item.date}</span>
                                                {expandedSessionIdx === idx ? (
                                                    <ChevronUp className="w-3 h-3 text-slate-400" />
                                                ) : (
                                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                                )}
                                            </div>
                                            <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border", item.status === 'Open' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-[#25D366] border-emerald-100/10' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent')}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Collapsible Chat Messages */}
                                    {expandedSessionIdx === idx && (
                                        <div className="mt-2.5 ml-2 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850/60 rounded-2xl space-y-2.5 animate-in slide-in-from-top duration-200">
                                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center gap-1">
                                                <History className="w-3 h-3 text-[#25D366]" /> Chat Transcript Log
                                            </p>
                                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                                {item.messages && item.messages.map((msg: any, mIdx: number) => {
                                                    const isUser = msg.sender === 'user' || msg.direction === 'inbound';
                                                    const msgText = msg.content || msg.body || 'Media Message';
                                                    const msgTime = format12HourTime(msg.createdAt);
                                                    return (
                                                        <div
                                                            key={mIdx}
                                                            className={cn(
                                                                "flex flex-col max-w-[85%] rounded-2xl p-2 text-xs",
                                                                isUser
                                                                    ? "bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 mr-auto"
                                                                    : "bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/10 text-slate-850 dark:text-slate-100 ml-auto"
                                                            )}
                                                        >
                                                            {msgText?.trim().toLowerCase() === '[revoke]' || msgText?.trim().toLowerCase() === '[protocol]' ? (
                                                                <p className="font-semibold leading-relaxed break-words text-rose-500 italic flex items-center gap-1">
                                                                    <Ban className="w-3 h-3 text-rose-500 shrink-0" />
                                                                    This message was deleted
                                                                </p>
                                                            ) : (
                                                                <p className="font-semibold leading-relaxed break-words">{msgText}</p>
                                                            )}
                                                            <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold text-right block mt-1 uppercase">{msgTime}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Custom Attributes - DYNAMIC COMPACT MANAGER */}
                    <div className="pt-2 pb-8 border-t border-slate-100 dark:border-slate-900/60">
                        <div className="flex justify-between items-center mb-3.5">
                            <h4 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{t("customAttributes")}</h4>
                            <span
                                onClick={() => setIsAddingAttr(!isAddingAttr)}
                                className="text-[11px] font-bold text-[#25D366] cursor-pointer hover:underline flex items-center gap-1 select-none"
                            >
                                <Plus className="w-3.5 h-3.5" /> {t('addAttribute')}
                            </span>
                        </div>

                        {/* Inline Custom Attribute Form */}
                        {isAddingAttr && (
                            <div className="p-3 mb-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850/60 rounded-2xl space-y-2.5 animate-in slide-in-from-top duration-200">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        placeholder="Attribute Name"
                                        value={newAttrName}
                                        onChange={(e) => setNewAttrName(e.target.value)}
                                        className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                                    />
                                    <Input
                                        placeholder="Value"
                                        value={newAttrValue}
                                        onChange={(e) => setNewAttrValue(e.target.value)}
                                        className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setIsAddingAttr(false);
                                            setNewAttrName('');
                                            setNewAttrValue('');
                                        }}
                                        className="h-7 text-[10px] font-bold px-2 rounded-lg cursor-pointer"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        disabled={!newAttrName || !newAttrValue}
                                        onClick={() => {
                                            const updated = [...customAttrs, { name: newAttrName.trim(), value: newAttrValue.trim() }];
                                            handleSaveAttribute(updated);
                                            setIsAddingAttr(false);
                                            setNewAttrName('');
                                            setNewAttrValue('');
                                        }}
                                        className="h-7 text-[10px] font-bold px-2.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg cursor-pointer"
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2.5">
                            {customAttrs.map((attr, idx) => (
                                <div 
                                    key={idx} 
                                    className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 transition-all flex flex-col gap-1.5 group relative"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                                            {attr.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = customAttrs.filter((_, i) => i !== idx);
                                                handleSaveAttribute(updated);
                                            }}
                                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 rounded-lg transition-all cursor-pointer shrink-0"
                                            title="Delete attribute"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 break-all leading-relaxed whitespace-pre-wrap select-text">
                                        {attr.value ? attr.value : (
                                            <span className="text-xs font-normal italic text-slate-400 dark:text-slate-500">No value set</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {customAttrs.length === 0 && !isAddingAttr && (
                                <span className="text-xs italic text-slate-400 block text-center py-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800">
                                    {t("noCustomAttributes")}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Block/Unblock Button - Restricted to Admin/Super Admin only */}
                    {isAdmin && (
                        <div className="pt-4 pb-8 border-t border-slate-100 dark:border-slate-900/60">
                            <Button
                                className={cn(
                                    "w-full rounded-2xl h-12 font-bold text-xs uppercase tracking-widest transition-all text-white shadow-md cursor-pointer",
                                    contact.isBlocked
                                        ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                        : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                                )}
                                onClick={handleToggleBlock}
                                disabled={isBlocking}
                            >
                                {isBlocking ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : contact.isBlocked ? (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                ) : (
                                    <ShieldAlert className="w-4 h-4 mr-2" />
                                )}
                                {contact.isBlocked ? t('unblockIncomingMessages') : t('blockIncomingMessages')}
                            </Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
