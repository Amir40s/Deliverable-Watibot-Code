"use client"
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl';

import useSWR, { mutate } from 'swr'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { getQuickReplies } from '@/app/actions/quick-replies'
import { resolveContactVariables } from '@/lib/messaging/contactVariables'
import { getAgents } from '@/app/actions/agents'
import { getTags } from '@/app/actions/tags'
import { getOrganizationAiStatus, toggleOrganizationAiStatus } from '@/app/actions/organization'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, Send, Paperclip, Loader2, User, Plus, ArrowLeft, FileText, AlertCircle, Smile, MessageSquare, MoreVertical, Filter, Tag, FilePlus, Link as LinkIcon, Video, Bold, Italic, Strikethrough, Image as ImageIcon, BookTemplate, Zap, Mic, Square, UserMinus, X, Tags, Download, Instagram, Music2, ListFilter, Calendar, Facebook, UserCheck, AlertTriangle, RefreshCw, Star, Bot, Ban, Trash2, ZoomIn, Play, CornerUpLeft, CornerUpRight, Edit2, Pencil, Webhook, Info, CheckCheck, Globe, Layers, QrCode, ShieldCheck, Check, ChevronDown, ChevronRight } from "lucide-react"
import WhatsAppMediaSpecsModal from "@/components/media/WhatsAppMediaSpecsModal"
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NotificationPopupToggle } from "@/components/dashboard/NotificationPopupToggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, downloadMedia, format12HourTime } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { countries } from "@/lib/countries"
import { ModalButton } from "@/components/ui/modal-button"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { LiveChatHeader } from "@/components/live-chat/LiveChatHeader"
import { useSession } from "next-auth/react"
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay"
import { usePusher } from "@/components/providers/PusherProvider"
import { getDeviceId, registerDevice } from "@/lib/device"
import { Smartphone, Clock, ShieldAlert, UserPlus, ClipboardList, Undo, Headset, Sparkles, Lock } from "lucide-react"
import { canEdit, canFull, canView } from '@/lib/permissionLevels'
import { toast } from 'sonner'
import FacebookEmbeddedSignup from "@/components/FacebookEmbeddedSignup"
import { ChatAvatar } from "@/components/live-chat/ChatAvatar"
import { InteractiveMessageRenderer, FormattedMessageText } from "@/components/live-chat/InteractiveMessageRenderer"
import { ChatProfileSidebar } from "@/components/live-chat/ChatProfileSidebar"
import { AdvancedFiltersPanel, type LiveChatFilters, defaultFilters } from '@/components/live-chat/AdvancedFiltersPanel'
import WatiBotLoader from "@/components/WatiBotLoader"
import { MediaLibraryModal } from "@/components/flows/modals/media-library-modal"
import { MediaLightboxModal, type MediaLightboxData } from "@/components/live-chat/MediaLightboxModal"
import { ForwardMessageModal } from "@/components/live-chat/ForwardMessageModal"
import { WhatsAppVoicePlayer } from "@/components/live-chat/WhatsAppVoicePlayer"
import { NormalAudioPlayer } from "@/components/live-chat/NormalAudioPlayer"
import { ChatImageBubble, ChatVideoBubble, ChatDocumentBubble, UnsupportedMessageBubble } from "@/components/live-chat/ChatMediaBubble"
import { WindowStatusBanner } from "@/components/live-chat/WindowStatusBanner"
import { useUserStatus } from "@/hooks/useUserStatus"
import { isVoiceMessage, getAudioMediaUrl, getAudioFilename } from "@/lib/chat/audio-helpers"

type Contact = {
    id: string;
    waId: string;
    name: string | null;
    whatsappName?: string | null;
    lastMessage: string | null;
    lastMessageAt: Date;
    lastInboundMessageAt?: Date | string | null;
    unreadCount: number;
    profilePic?: string | null;
    assignedUsers?: Array<{
        id: string;
        name: string | null;
        email: string;
    }>;
    tags?: Array<{
        id: string;
        name: string;
        color: string;
    }>;
    platform?: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK';
    isBlocked?: boolean;
    isAiBotEnabled?: boolean;
    isWebhookEnabled?: boolean;
    disabledWebhookIds?: string[];
    isAutoCreated?: boolean;
    createdAt?: Date | string;
    customAttributes?: any;
    aiAgentId?: string | null;
    aiAgent?: {
        id: string;
        name: string;
        aiProvider: string;
        isDefault?: boolean;
    } | null;
    defaultAiAgent?: {
        id: string;
        name: string;
        aiProvider: string;
        isDefault?: boolean;
    } | null;
    effectiveAiAgent?: {
        id: string;
        name: string;
        aiProvider: string;
        isDefault?: boolean;
    } | null;
    aiAgentSource?: 'assigned' | 'default' | 'none';
    organization?: {
        isAiBotEnabled?: boolean;
    } | null;
}

type Message = {
    id: string;
    wamid?: string | null;
    content: string | null;
    direction: 'inbound' | 'outbound';
    type: string;
    createdAt: Date;
    status: string;
    mediaUrl?: string | null;
    rawBody?: any;
    senderId?: string | null;
    sender?: {
        id: string;
        name: string | null;
        email?: string | null;
    } | null;
    replyToId?: string | null;
    replyToWaId?: string | null;
    replyPreview?: string | null;
    replySenderName?: string | null;
    replyMessageType?: string | null;
}

type TemplateComponent = {
    type: string;
    format?: string;
    text?: string;
    example?: {
        body_text?: string[][];
        header_text?: string[];
        header_handle?: string[];
    };
    buttons?: any[]
}
type MessageTemplate = { name: string; language: string; status: string; components?: TemplateComponent[] }

/** Common emojis for the picker modal */
const EMOJI_GRID = [
    "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
    "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔",
    "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉",
    "👆", "👇", "☝️", "👍", "🙌", "👏", "🙏", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞",
    "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈",
    "🔥", "⭐", "🌟", "✨", "💫", "✅", "❌", "❗", "❓", "‼️", "💯", "🔔", "📢", "💬", "💭", "🗯️", "♻️", "🌍", "📅", "⏰",
];



export default function LiveChatPage() {
    const t = useTranslations('LiveChat');
    const { data: session } = useSession();
    const locale = useLocale();
    const { pusher } = usePusher();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [tabCounts, setTabCounts] = useState({ all: 0, unread: 0, assigned: 0, ai: 0, intervented: 0, expired: 0, urgent: 0, visitors: 0 });
    const [isOrganizationAiEnabled, setIsOrganizationAiEnabled] = useState(true);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const selectedContactIdRef = useRef<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // New Contact State
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newContactName, setNewContactName] = useState("");
    const [newContactPhone, setNewContactPhone] = useState("");
    const [selectedCountry, setSelectedCountry] = useState(countries.find(c => c.code === '+91') || countries[0]);
    const [isCreatingContact, setIsCreatingContact] = useState(false);

    // Permissions
    const perms = (session?.user?.permissions as Record<string, any>) || {};
    const userRole = (session?.user?.role || '').toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
    const canViewAllChats = isAdmin || perms.chat_super === true || perms.view_all_chats === 'full' || perms.view_all_chats === 'view';


    const optimisticContactTagsRef = useRef<Record<string, { tags: any[]; timestamp: number }>>({});
    const isGuestRole = session?.user?.role === 'GUEST';
    const canCreateContact = isGuestRole ? canEdit(session, 'contacts') : true;
    const canExportContacts = isGuestRole ? canFull(session, 'contacts') : true;
    const canReplyChat = isGuestRole ? canEdit(session, 'chat') : true;
    const canResolveChat = isGuestRole ? canEdit(session, 'chat') : true;
    const canAssignAgent = isGuestRole ? canEdit(session, 'chat') : true;
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const { whatsappConnectionMethod } = useUserStatus();
    const isQr = whatsappConnectionMethod === 'qr' || (session?.user as any)?.whatsappConnectionMethod === 'qr' || (selectedContact as any)?.organization?.whatsappConnectionMethod === 'qr';
    const [canSendRegular, setCanSendRegular] = useState(true);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [isSendingTemplate, setIsSendingTemplate] = useState(false);
    const [templateParams, setTemplateParams] = useState<string[]>([]);
    const [templateHeaderMediaUrl, setTemplateHeaderMediaUrl] = useState<string>('');
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'assigned' | 'ai' | 'intervented' | 'history' | 'visitors'>(() => {
        const tabParam = (searchParams?.get('tab') as any);
        return tabParam === 'history' ? 'history' : (tabParam === 'visitors' ? 'visitors' : 'all');
    });

    // Cache refs for 0ms tab switching and conversation switching
    const tabContactsCacheRef = useRef<Record<string, { contacts: Contact[]; tabCounts: any; timestamp: number }>>({});
    const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
    const messagesContactIdRef = useRef<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [visibleContactsCount, setVisibleContactsCount] = useState(10);
    const [liveFilters, setLiveFilters] = useState<LiveChatFilters>(defaultFilters);
    const [messageQuota, setMessageQuota] = useState<{ allowed: boolean; limit: number; current: number; message?: string } | null>(null);
    const [channels, setChannels] = useState<WhatsAppChannelDTO[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [selectedFilterChannelId, setSelectedFilterChannelId] = useState<string>('all');
    const [actionMenuView, setActionMenuView] = useState<'main' | 'assign' | 'ai-agent' | 'labels' | 'webhooks'>('main');

    useEffect(() => {
        getWhatsAppChannels().then(res => {
            const list = res.channels || [];
            if (res.success && list.length > 0) {
                setChannels(list);
                const defaultChan = list.find((c: WhatsAppChannelDTO) => c.isDefault) || list[0];
                if (defaultChan) setSelectedChannelId(defaultChan.id);
            }
        }).catch(err => console.error('[LiveChat] Failed to fetch WhatsApp channels:', err));
    }, []);

    // Standard fetcher for SWR
    const fetcher = async (url: string) => {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.error || data?.message || 'Request failed');
        }
        return data;
    };

    // Use SWR for Contacts with server-side pagination, searching and filtering parameters
    const swrKey = `/api/chat/poll?type=contacts&tab=${activeTab}&limit=${visibleContactsCount}&search=${encodeURIComponent(searchQuery)}&platform=${liveFilters.platform || 'all'}&channelId=${selectedFilterChannelId}&filters=${encodeURIComponent(JSON.stringify(liveFilters))}`;

    const { data: swrContacts, isLoading: isLoadingContactsSWR, mutate: mutateContacts } = useSWR(
        swrKey,
        fetcher,
        {
            refreshInterval: 15000,
            dedupingInterval: 5000,
            revalidateOnFocus: false,
        }
    );

    const handleTabChange = useCallback((newTab: 'all' | 'unread' | 'assigned' | 'ai' | 'intervented' | 'history' | 'visitors') => {
        setActiveTab(newTab);
        const cached = tabContactsCacheRef.current[newTab];
        if (cached && cached.contacts) {
            setContacts(cached.contacts);
            if (cached.tabCounts) setTabCounts(cached.tabCounts);
        }
    }, []);



    const handleBackToLiveChat = () => {
        handleTabChange('all');
        if (searchParams?.get('tab') === 'history') {
            router.push(pathname);
        }
    };
    const [interventedFilter, setInterventedFilter] = useState<string>('all');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [availableAgents, setAvailableAgents] = useState<any[]>([]);
    const [aiAgents, setAiAgents] = useState<any[]>([]);
    const [isAssigningAiAgent, setIsAssigningAiAgent] = useState(false);
    const [availableTags, setAvailableTags] = useState<any[]>([]);
    const [quickReplies, setQuickReplies] = useState<any[]>([]);
    const [isTransferring, setIsTransferring] = useState(false);
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [isTogglingAiBot, setIsTogglingAiBot] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isQuickReplyDialogOpen, setIsQuickReplyDialogOpen] = useState(false);
    const [quickReplySearchQuery, setQuickReplySearchQuery] = useState("");

    const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

    const handleMarkAllAsRead = async () => {
        if (isMarkingAllRead) return;
        setIsMarkingAllRead(true);
        try {
                        const res = await markAllContactsAsRead();
            if (!res.success) throw new Error(res.error || 'Failed to mark all as read');

            setContacts(prev => prev.map(c => ({ ...c, unreadCount: 0 })));
            if (selectedContact) {
                setSelectedContact(prev => prev ? { ...prev, unreadCount: 0 } : null);
            }
            setTabCounts(prev => ({ ...prev, unread: 0 }));

            toast.success('All messages marked as read');
            mutate(url => typeof url === 'string' && (url.includes('/api/chat/poll') || url.includes('/api/sidebar/counts')), undefined, { revalidate: true });
        } catch (err: any) {
            toast.error(err?.message || 'Failed to mark all as read');
        } finally {
            setIsMarkingAllRead(false);
        }
    };

    const filteredQuickReplies = useMemo(() => {
        if (!quickReplySearchQuery.trim()) return quickReplies;
        const q = quickReplySearchQuery.toLowerCase().trim();
        return quickReplies.filter((reply) => {
            const nameMatch = reply.name?.toLowerCase().includes(q);
            const contentMatch = reply.content?.toLowerCase().includes(q);
            const shortcutMatch = reply.shortcut?.toLowerCase().includes(q) || reply.keyword?.toLowerCase().includes(q);
            const fileNameMatch = reply.fileName?.toLowerCase().includes(q);
            const typeMatch = reply.type?.toLowerCase().includes(q);
            return nameMatch || contentMatch || shortcutMatch || fileNameMatch || typeMatch;
        });
    }, [quickReplies, quickReplySearchQuery]);

    // Edit Contact Name State & Handlers
    const [isEditNameOpen, setIsEditNameOpen] = useState(false);
    const [editNameInput, setEditNameInput] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    const handleOpenEditName = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!selectedContact) return;
        setEditNameInput(selectedContact.name || selectedContact.whatsappName || '');
        setIsEditNameOpen(true);
    }, [selectedContact]);

    const handleSaveContactName = async () => {
        if (!selectedContact || !editNameInput.trim()) return;
        setIsSavingName(true);
        try {
                        const res = await updateContactName(selectedContact.id, editNameInput.trim());
            if (res.success && res.contact) {
                const updatedName = res.contact.name;
                setSelectedContact(prev => prev ? { ...prev, name: updatedName } : null);
                setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, name: updatedName } : c));
                mutateContacts();
                toast.success("Contact name updated successfully");
                setIsEditNameOpen(false);
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to update contact name");
        } finally {
            setIsSavingName(false);
        }
    };

    const handleResetContactName = async () => {
        if (!selectedContact) return;
        setIsSavingName(true);
        try {
                        const res = await resetContactName(selectedContact.id);
            if (res.success && res.contact) {
                const resetName = res.contact.name;
                setSelectedContact(prev => prev ? { ...prev, name: resetName } : null);
                setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, name: resetName } : c));
                mutateContacts();
                toast.success("Reset to WhatsApp profile name");
                setIsEditNameOpen(false);
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to reset contact name");
        } finally {
            setIsSavingName(false);
        }
    };

    // Helper to ensure internal media URLs have the orgId and avoid host/port mismatch
    const getProxiedUrl = useCallback((url: string | null) => {
        if (!url) return '';
        let normalized = url;
        if (normalized.includes('/api/media/')) {
            normalized = normalized.substring(normalized.indexOf('/api/media/'));
        }

        if (normalized.startsWith('/api/media/') && !normalized.includes('orgId=')) {
            if (!session?.user?.organizationId) {
                return normalized;
            }
            const connector = normalized.includes('?') ? '&' : '?';
            return `${normalized}${connector}orgId=${session?.user?.organizationId}`;
        }

        // Force download for Cloudinary PDFs to avoid browser viewer errors
        if (normalized.includes('res.cloudinary.com') && normalized.toLowerCase().endsWith('.pdf')) {
            if (normalized.includes('/upload/') && !normalized.includes('/fl_attachment/')) {
                return normalized.replace('/upload/', '/upload/fl_attachment/');
            }
        }

        return normalized;
    }, [session?.user?.organizationId]);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportSearchQuery, setExportSearchQuery] = useState("");
    const [selectedExportTags, setSelectedExportTags] = useState<string[]>([]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [lightboxData, setLightboxData] = useState<MediaLightboxData | null>(null);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

    const handleOpenLightbox = useCallback((url: string, type?: string, caption?: string | null, senderName?: string, timestamp?: string) => {
        if (!url) return;
        setLightboxData({
            url,
            type,
            caption,
            senderName,
            timestamp
        });
        setIsLightboxOpen(true);
    }, []);

    // Reset pagination when tab, search, or platform filter transitions
    useEffect(() => {
        setVisibleContactsCount(10);
    }, [activeTab, searchQuery, liveFilters.platform]);

    // Reset intervened filter when active tab transitions
    useEffect(() => {
        if (activeTab !== 'intervented') {
            setInterventedFilter('all');
        }
    }, [activeTab]);

    const [availableWebhooks, setAvailableWebhooks] = useState<Array<{ id: string; name: string; targetUrl?: string; isSystem?: boolean; isActive?: boolean; isAiAgent?: boolean }>>([]);

    const isContactHandledByAi = useCallback((contact?: Contact | null) => {
        if (!contact) return false;
        const organizationAiEnabled = contact.organization?.isAiBotEnabled ?? isOrganizationAiEnabled;
        const isContactAiEnabled = contact.isAiBotEnabled ?? true;
        const isContactWebhookEnabled = contact.isWebhookEnabled ?? true;

        if (!organizationAiEnabled || !isContactAiEnabled || !isContactWebhookEnabled) {
            return false;
        }

        if (contact.disabledWebhookIds && contact.disabledWebhookIds.length > 0) {
            const disabledSet = new Set(contact.disabledWebhookIds);
            const hasDisabledAiWebhook = availableWebhooks.some(wh => wh.isAiAgent && disabledSet.has(wh.id));
            if (hasDisabledAiWebhook) {
                return false;
            }
            if (availableWebhooks.length > 0) {
                const aiWebhooks = availableWebhooks.filter(wh => wh.isAiAgent);
                if (aiWebhooks.length > 0 && aiWebhooks.every(wh => disabledSet.has(wh.id))) {
                    return false;
                }
            }
        }

        return true;
    }, [isOrganizationAiEnabled, availableWebhooks]);

    const handleSelectContact = useCallback((contact: Contact) => {
        const isNewContact = selectedContactIdRef.current !== contact.id;
        setSelectedContact(contact);
        selectedContactIdRef.current = contact.id;
        setIsProfileOpen(false);

        if (isNewContact) {
            const cachedMsgs = messagesCacheRef.current.get(contact.id);
            if (cachedMsgs && cachedMsgs.length > 0) {
                setMessages(cachedMsgs);
                messagesContactIdRef.current = contact.id;
                setIsLoadingMessages(false);
            } else {
                setMessages([]);
                messagesContactIdRef.current = null;
                setIsLoadingMessages(true);
            }
        }

        if (contact.unreadCount > 0) {
            setContacts(prev => prev.map((c) =>
                c.id === contact.id ? { ...c, unreadCount: 0 } : c
            ));
            setTabCounts(prev => ({
                ...prev,
                unread: Math.max(0, prev.unread - 1)
            }));

            mutateContacts((currentData: any) => {
                if (!currentData || !Array.isArray(currentData.contacts)) return currentData;
                return {
                    ...currentData,
                    contacts: currentData.contacts.map((c: any) =>
                        c.id === contact.id ? { ...c, unreadCount: 0 } : c
                    )
                };
            }, { revalidate: false });

            markMessagesAsRead(contact.id).catch(err => {
                console.error("Failed to mark messages as read:", err);
            });
        }
    }, [mutateContacts]);

    // Sync SWR contacts with local state, preserving optimistic tag updates & populating tab cache
    useEffect(() => {
        if (swrContacts && typeof swrContacts === 'object') {
            if (typeof swrContacts.organizationAiEnabled === 'boolean') {
                setIsOrganizationAiEnabled(swrContacts.organizationAiEnabled);
            }
            const rawContacts = (swrContacts.contacts || []) as Contact[];
            const now = Date.now();
            const newContacts = rawContacts.map(c => {
                const opt = optimisticContactTagsRef.current[c.id];
                if (opt && (now - opt.timestamp) < 15000) {
                    return { ...c, tags: opt.tags };
                }
                return c;
            });

            setContacts(newContacts);
            setIsLoadingContacts(false);

            const updatedTabCounts = swrContacts.tabCounts ? {
                all: swrContacts.tabCounts.all || 0,
                unread: swrContacts.tabCounts.unread || 0,
                assigned: swrContacts.tabCounts.assigned || 0,
                ai: swrContacts.tabCounts.ai || 0,
                intervented: swrContacts.tabCounts.intervented || 0,
                expired: swrContacts.tabCounts.expired || 0,
                urgent: swrContacts.tabCounts.urgent || 0,
                visitors: swrContacts.tabCounts.visitors || 0
            } : tabCounts;

            if (swrContacts.tabCounts) {
                setTabCounts(updatedTabCounts);
            }

            // Cache current tab data for zero-latency tab switching
            tabContactsCacheRef.current[activeTab] = {
                contacts: newContacts,
                tabCounts: updatedTabCounts,
                timestamp: now,
            };

            if (selectedContact) {
                const refreshed = newContacts.find(c => c.id === selectedContact.id);
                if (refreshed) {
                    const opt = optimisticContactTagsRef.current[selectedContact.id];
                    if (opt && (now - opt.timestamp) < 15000) {
                        setSelectedContact(prev => prev ? { ...refreshed, tags: opt.tags } : null);
                    } else {
                        setSelectedContact(refreshed);
                    }
                } else if (newContacts.length > 0) {
                    // Contact may have been merged or deleted; seamlessly select the matching active contact
                    const matchingContact = newContacts.find(c =>
                        (selectedContact.waId && c.waId === selectedContact.waId) ||
                        (selectedContact.name && c.name && c.name.toLowerCase() === selectedContact.name.toLowerCase())
                    );
                    if (matchingContact) {
                        handleSelectContact(matchingContact);
                    }
                }
            }

            if (swrContacts.messageQuota) {
                setMessageQuota(swrContacts.messageQuota);
            }
        }
    }, [swrContacts, selectedContact?.id, activeTab]);

    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            if (activeTab === 'unread') {
                if (!contact.unreadCount || contact.unreadCount <= 0) return false;
            } else if (activeTab === 'assigned') {
                const myId = session?.user?.id;
                const myEmail = session?.user?.email;
                const isAssigned = contact.assignedUsers?.some(user => user.id === myId || (myEmail && user.email === myEmail));
                if (!isAssigned) return false;
            } else if (activeTab === 'ai') {
                const isAi = isContactHandledByAi(contact);
                const isWithin24h = contact.lastInboundMessageAt && (Date.now() - new Date(contact.lastInboundMessageAt).getTime()) < 24 * 60 * 60 * 1000;
                if (!isAi || !isWithin24h) return false;
            } else if (activeTab === 'intervented') {
                if (isContactHandledByAi(contact)) return false;
                if (interventedFilter === 'me') {
                    const myId = session?.user?.id;
                    const myEmail = session?.user?.email;
                    const isAssigned = contact.assignedUsers?.some(user => user.id === myId || (myEmail && user.email === myEmail));
                    if (!isAssigned) return false;
                } else if (interventedFilter !== 'all') {
                    const isAssignedToFilter = contact.assignedUsers?.some(user => user.id === interventedFilter);
                    if (!isAssignedToFilter) return false;
                }
            } else if (activeTab === 'history') {
                const isExpired = !contact.lastInboundMessageAt || (Date.now() - new Date(contact.lastInboundMessageAt).getTime()) >= 24 * 60 * 60 * 1000;
                if (!isExpired) return false;
            } else if (activeTab === 'visitors') {
                const isVisitor = contact.waId?.startsWith('web_') ||
                    (contact.customAttributes as any)?.channel === 'website_widget' ||
                    contact.tags?.some((t: any) => t.name?.toLowerCase() === 'website');
                if (!isVisitor) return false;
            }
            return true;
        });
    }, [contacts, activeTab, interventedFilter, session?.user?.id, session?.user?.email, isContactHandledByAi]);

    const derivedTabCounts = useMemo(() => {
        let unreadLocal = 0;
        let assignedLocal = 0;
        let aiLocal = 0;
        let interventedLocal = 0;
        let expiredLocal = 0;
        let visitorsLocal = 0;

        const myId = session?.user?.id;
        const myEmail = session?.user?.email;

        contacts.forEach(c => {
            if (c.unreadCount > 0) unreadLocal++;
            if (c.assignedUsers?.some(u => u.id === myId || (myEmail && u.email === myEmail))) assignedLocal++;
            if (isContactHandledByAi(c) && (isQr || (c.lastInboundMessageAt && (Date.now() - new Date(c.lastInboundMessageAt).getTime()) < 24 * 60 * 60 * 1000))) aiLocal++;
            if (c.isAiBotEnabled === false) interventedLocal++;
            if (!isQr && (!c.lastInboundMessageAt || (Date.now() - new Date(c.lastInboundMessageAt).getTime()) >= 24 * 60 * 60 * 1000)) expiredLocal++;
            if (c.waId?.startsWith('web_') || (c.customAttributes as any)?.channel === 'website_widget' || c.tags?.some((t: any) => t.name?.toLowerCase() === 'website')) visitorsLocal++;
        });

        return {
            all: tabCounts.all !== undefined && tabCounts.all > 0 ? tabCounts.all : contacts.length,
            unread: tabCounts.unread !== undefined ? tabCounts.unread : unreadLocal,
            assigned: tabCounts.assigned !== undefined ? tabCounts.assigned : assignedLocal,
            ai: tabCounts.ai !== undefined ? tabCounts.ai : aiLocal,
            intervented: tabCounts.intervented !== undefined ? tabCounts.intervented : interventedLocal,
            expired: isQr ? 0 : (tabCounts.expired !== undefined ? tabCounts.expired : expiredLocal),
            urgent: tabCounts.urgent || 0,
            visitors: tabCounts.visitors !== undefined && tabCounts.visitors > 0 ? tabCounts.visitors : visitorsLocal
        };
    }, [contacts, tabCounts, session?.user?.id, session?.user?.email, isContactHandledByAi, isQr]);

    useEffect(() => {
        const tabParam = searchParams?.get('tab');
        if (tabParam === 'history') {
            setActiveTab('history');
        }
    }, [searchParams]);

    useEffect(() => {
        selectedContactIdRef.current = selectedContact?.id ?? null;
    }, [selectedContact?.id]);

    useEffect(() => {
        const handleInboundWindow = (e: Event) => {
            const customEvent = e as CustomEvent;
            const payload = customEvent.detail;
            if (!payload) return;

            // Security Isolation: Non-admin agents must only receive messages for contacts assigned to them
            const currentUserId = session?.user?.id;
            const assignedAgentId = payload.assignedAgentId || payload.assigned_agent_id || payload.contact?.assignedAgentId || payload.contact?.assigned_agent_id;
            const rawAssignedUserIds = payload.assignedUserIds || payload.assigned_user_ids || payload.contact?.assignedUserIds || payload.contact?.assigned_user_ids || payload.contact?.assignedUsers || [];
            const assignedUserIds = Array.isArray(rawAssignedUserIds)
                ? rawAssignedUserIds.map((u: any) => (typeof u === 'string' ? u : u?.id)).filter(Boolean)
                : [];
            const isAssignedToMe = Boolean(currentUserId && (
                assignedAgentId === currentUserId ||
                assignedUserIds.includes(currentUserId)
            ));

            if (!canViewAllChats && !isAssignedToMe) {
                // Ignore message if not assigned to this agent and agent cannot view all chats
                return;
            }

            const inboundContactId = payload.contactId;
            const inboundContent = payload.content || '[Message]';
            const nowIso = new Date().toISOString();
            const isCurrentlySelected = inboundContactId && inboundContactId === selectedContactIdRef.current;

            // Instantly update contacts list in state & prepend new/updated unread contacts
            setContacts(prev => {
                const existingIdx = prev.findIndex(c => c.id === inboundContactId);
                if (existingIdx !== -1) {
                    const existing = prev[existingIdx];
                    const updated: Contact = {
                        ...existing,
                        lastMessage: inboundContent,
                        lastMessageAt: new Date(nowIso),
                        lastInboundMessageAt: new Date(nowIso),
                        unreadCount: isCurrentlySelected ? 0 : (existing.unreadCount || 0) + 1,
                    };
                    const rest = [...prev];
                    rest.splice(existingIdx, 1);
                    return [updated, ...rest];
                } else if (inboundContactId) {
                    const newContact: Contact = {
                        id: inboundContactId,
                        name: payload.contactName || payload.contactNumber || 'New Contact',
                        waId: payload.contactNumber || inboundContactId,
                        unreadCount: isCurrentlySelected ? 0 : 1,
                        lastMessage: inboundContent,
                        lastMessageAt: new Date(nowIso),
                        lastInboundMessageAt: new Date(nowIso),
                        platform: payload.platform || 'WHATSAPP',
                        tags: [],
                        assignedUsers: [],
                        isAiBotEnabled: true,
                        createdAt: new Date(nowIso),
                        updatedAt: new Date(nowIso),
                    } as any;
                    return [newContact, ...prev];
                }
                return prev;
            });

            // Update real-time unread tab counts badge
            if (!isCurrentlySelected) {
                setTabCounts(prev => ({
                    ...prev,
                    unread: (prev.unread || 0) + 1,
                    all: (prev.all || 0) + 1,
                }));
            }

            // Append message if current active conversation
            if (isCurrentlySelected && inboundContactId) {
                setMessages(prev => {
                    if (payload.messageId && prev.some(m => m.id === payload.messageId)) return prev;
                    const inboundMsg: Message = {
                        id: payload.messageId || `inbound-${Date.now()}`,
                        contactId: inboundContactId,
                        direction: 'inbound',
                        type: 'text',
                        content: inboundContent,
                        status: 'delivered',
                        createdAt: new Date(),
                        sender: null,
                        senderId: null,
                    } as any;
                    const updated = [...prev, inboundMsg];
                    messagesCacheRef.current.set(inboundContactId, updated);
                    return updated;
                });
            }

            mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
            if (payload?.contactId && isCurrentlySelected) {
                mutate(url => typeof url === 'string' && url.includes(`/api/chat/poll?type=messages&contactId=${payload.contactId}`), undefined, { revalidate: true });
            }
        };

        const handleContactRead = (e: Event) => {
            const customEvent = e as CustomEvent;
            const payload = customEvent.detail;

            if (payload?.contactId) {
                const newCount = typeof payload.unreadCount === 'number' ? payload.unreadCount : 0;
                setContacts(prev => prev.map(c => c.id === payload.contactId ? { ...c, unreadCount: newCount } : c));
                if (selectedContactIdRef.current === payload.contactId) {
                    setSelectedContact(prev => prev ? { ...prev, unreadCount: newCount } : null);
                }
            }

            mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
            if (payload?.contactId && payload.contactId === selectedContactIdRef.current) {
                mutate(url => typeof url === 'string' && url.includes(`/api/chat/poll?type=messages&contactId=${payload.contactId}`), undefined, { revalidate: true });
            }
        };

        const handleMessageDelete = (e: Event) => {
            const customEvent = e as CustomEvent;
            const payload = customEvent.detail;

            if (payload?.contactId) {
                const newLastMessageText = payload.lastMessage !== undefined
                    ? payload.lastMessage
                    : (payload.newLatestMessage ? (payload.newLatestMessage.content || `[${payload.newLatestMessage.type}]`) : null);
                const newLastMessageAt = payload.lastMessageAt
                    ? new Date(payload.lastMessageAt)
                    : (payload.newLatestMessage?.created_at_iso ? new Date(payload.newLatestMessage.created_at_iso) : new Date());

                setContacts(prev => prev.map(c => c.id === payload.contactId ? { ...c, lastMessage: newLastMessageText, lastMessageAt: newLastMessageAt } : c));

                if (selectedContactIdRef.current === payload.contactId) {
                    if (payload.messageId) {
                        setMessages(prev => prev.filter(m => m.id !== payload.messageId));
                    }
                    setSelectedContact(prev => prev ? { ...prev, lastMessage: newLastMessageText, lastMessageAt: newLastMessageAt } : null);
                    mutate(url => typeof url === 'string' && url.includes(`/api/chat/poll?type=messages&contactId=${payload.contactId}`), undefined, { revalidate: true });
                }
            }
            mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
        };

        const handleAssignmentChange = () => {
            mutateContacts();
        };

        window.addEventListener('message:inbound', handleInboundWindow);
        window.addEventListener('contact:read', handleContactRead);
        window.addEventListener('message:delete', handleMessageDelete);
        window.addEventListener('chat-assigned', handleAssignmentChange);
        window.addEventListener('chat-unassigned', handleAssignmentChange);
        window.addEventListener('chat-assignment-updated', handleAssignmentChange);
        return () => {
            window.removeEventListener('message:inbound', handleInboundWindow);
            window.removeEventListener('contact:read', handleContactRead);
            window.removeEventListener('message:delete', handleMessageDelete);
            window.removeEventListener('chat-assigned', handleAssignmentChange);
            window.removeEventListener('chat-unassigned', handleAssignmentChange);
            window.removeEventListener('chat-assignment-updated', handleAssignmentChange);
        };
    }, [mutateContacts, session?.user?.id, canViewAllChats]);

    const handleDeleteMessage = async (messageId: string) => {
        if (!window.confirm('Are you sure you want to delete this message from the CRM database?')) {
            return;
        }

        // Calculate remaining messages to find immediate optimistic preview
        const remaining = messages.filter(m => m.id !== messageId && m.type !== 'internal_log' && m.type !== 'comment');
        const newLatest = remaining.length > 0 ? remaining[remaining.length - 1] : null;

        const formatPreview = (m: Message | null) => {
            if (!m) return null;
            if (m.content && m.content.trim()) return m.content.trim();
            const type = (m.type || 'text').toLowerCase();
            switch (type) {
                case 'image': return '[Image]';
                case 'video': return '[Video]';
                case 'audio': return '[Audio]';
                case 'voice':
                case 'ptt': return '[Voice Message]';
                case 'document': return '[Document]';
                case 'sticker': return '[Sticker]';
                case 'location': return '[Location]';
                case 'contact': return '[Contact]';
                default: return `[${type}]`;
            }
        };

        const optLastMessageText = formatPreview(newLatest);
        const optLastMessageAt = newLatest ? newLatest.createdAt : (selectedContact?.createdAt ? new Date(selectedContact.createdAt) : new Date());

        // Optimistic UI update for both messages and contact lastMessage preview
        setMessages(prev => prev.filter(m => m.id !== messageId));
        if (selectedContact) {
            const targetContactId = selectedContact.id;
            setContacts(prev => prev.map(c => c.id === targetContactId ? { ...c, lastMessage: optLastMessageText, lastMessageAt: optLastMessageAt } : c));
            setSelectedContact(prev => prev ? { ...prev, lastMessage: optLastMessageText, lastMessageAt: optLastMessageAt } : null);
        }

        try {
            const res = await fetch(`/api/v1/live-chat/messages/${messageId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || data.message || 'Failed to delete message');
            }

            const { toast } = await import('sonner');
            toast.success('Message deleted from CRM');
            mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
            if (selectedContact?.id) {
                mutate(url => typeof url === 'string' && url.includes(`/api/chat/poll?type=messages&contactId=${selectedContact.id}`), undefined, { revalidate: true });
            }
        } catch (err: any) {
            const { toast } = await import('sonner');
            toast.error(err.message || 'Failed to delete message');
            if (selectedContact?.id) {
                mutate(url => typeof url === 'string' && url.includes(`/api/chat/poll?type=messages&contactId=${selectedContact.id}`), undefined, { revalidate: true });
            }
        }
    };

    // Handle Export to Excel
    const handleExport = async () => {
        let contactsToExport = contacts;

        // Apply Tag Filter
        if (selectedExportTags.length > 0) {
            contactsToExport = contacts.filter(c =>
                c.tags?.some(tag => selectedExportTags.includes(tag.id))
            );
        }

        if (contactsToExport.length === 0) {
            toast.error("No contacts to export for selected filters");
            return;
        }

        const dataToExport = contactsToExport.map(c => ({
            'Name': c.name || 'N/A',
            'WhatsApp ID': c.waId,
            'Tags': c.tags?.map(t => t.name).join(', ') || '',
            'Last Message': c.lastMessage || '',
            'Unread Count': c.unreadCount,
            'Last Message At': new Date(c.lastMessageAt).toLocaleString(),
            'Last Inbound At': c.lastInboundMessageAt ? new Date(c.lastInboundMessageAt).toLocaleString() : 'Never',
            'Status': (!c.lastInboundMessageAt || (Date.now() - new Date(c.lastInboundMessageAt).getTime()) / (1000 * 60 * 60) >= 24) ? 'Expired' : 'Active'
        }));

        try {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
            XLSX.writeFile(workbook, `contacts_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success(`Exported ${contactsToExport.length} contacts successfully`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export contacts');
        }
    };

    const handleExportSingleChat = async (contactId: string, contactName: string) => {
        try {
            toast.info(`Fetching chat history for ${contactName}...`);
            const msgs = await getMessages(contactId);
            if (!msgs || msgs.length === 0) {
                toast.error("No messages found for this contact");
                return;
            }

            const dataToExport = msgs.map((m: any) => ({
                'Date': new Date(m.createdAt).toLocaleDateString(),
                'Time': format12HourTime(m.createdAt),
                'Direction': m.direction === 'inbound' ? 'Customer' : 'Me',
                'Type': m.type,
                'Message': m.content || (m.mediaUrl ? '[Media]' : ''),
                'Status': m.status
            }));

            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Chat History");
            XLSX.writeFile(workbook, `Chat_History_${contactName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success("Chat history exported successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export chat history");
        }
    };

    const activeTabCount = useMemo(() => {
        if (activeTab === 'unread') return tabCounts.unread;
        if (activeTab === 'assigned') return tabCounts.assigned;
        if (activeTab === 'ai') return tabCounts.ai;
        if (activeTab === 'intervented') return tabCounts.intervented;
        if (activeTab === 'history') return tabCounts.expired;
        if (activeTab === 'visitors') return tabCounts.visitors;
        return tabCounts.all;
    }, [activeTab, tabCounts]);

    // Polling interval ref
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isMediaSpecsModalOpen, setIsMediaSpecsModalOpen] = useState(false);

    // Audio recording state (Native MediaRecorder with Opus codec)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioStreamRef = useRef<MediaStream | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
        if (selectedFiles.length === 0 || !selectedContact) return;

        if (fileInputRef.current) fileInputRef.current.value = '';

        const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16 MB
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
        const MAX_AUDIO_SIZE = 16 * 1024 * 1024;  // 16 MB
        const MAX_DOC_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

        const validFiles: File[] = [];
        const rejectedErrors: string[] = [];

        for (const file of selectedFiles) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
                rejectedErrors.push(`Unable to send video "${file.name}" (${sizeMB} MB). WhatsApp video limit is 16 MB.`);
            } else if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
                rejectedErrors.push(`Unable to send photo "${file.name}" (${sizeMB} MB). WhatsApp image limit is 5 MB.`);
            } else if (file.type.startsWith('audio/') && file.size > MAX_AUDIO_SIZE) {
                rejectedErrors.push(`Unable to send audio "${file.name}" (${sizeMB} MB). WhatsApp audio limit is 16 MB.`);
            } else if (file.size > MAX_DOC_SIZE) {
                rejectedErrors.push(`Unable to send "${file.name}" (${sizeMB} MB). Maximum file limit is 2 GB.`);
            } else {
                validFiles.push(file);
            }
        }

        if (rejectedErrors.length > 0) {
            rejectedErrors.forEach(msg => {
                toast.error("File Size Limit Exceeded", {
                    description: msg,
                    duration: 6000
                });
            });
        }

        if (validFiles.length === 0) return;

        setIsSending(true);
        const toastId = toast.loading(`Sending ${validFiles.length} file${validFiles.length > 1 ? 's' : ''}...`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const optimisticId = `optimistic-${Date.now()}-${i}`;
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');

            let messageType: 'image' | 'video' | 'audio' | 'document' = 'document';
            if (isImage) messageType = 'image';
            else if (isVideo) messageType = 'video';
            else if (isAudio) messageType = 'audio';

            const optimisticMsg: Message = {
                id: optimisticId,
                content: isImage ? `Sending photo ${i + 1} of ${validFiles.length}...` : `Sending file: ${file.name}...`,
                direction: 'outbound',
                type: messageType,
                createdAt: new Date(),
                status: 'sending'
            };

            setMessages(prev => [...prev, optimisticMsg]);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('contactId', selectedContact.id);

            try {
                const res = await sendWhatsAppMedia(formData);
                if (res.success && res.data) {
                    successCount++;
                    setMessages(prev => prev.map(m => m.id === optimisticId ? (res.data as Message) : m));
                } else {
                    failCount++;
                    setMessages(prev => prev.filter(m => m.id !== optimisticId));
                    toast.error(`Failed to send ${file.name}: ${res.error}`);
                }
            } catch (err: any) {
                failCount++;
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                toast.error(`Failed to send ${file.name}`);
            }
        }

        setIsSending(false);
        if (successCount > 0) {
            toast.success(`Successfully sent ${successCount} file${successCount > 1 ? 's' : ''}`, { id: toastId });
        } else {
            toast.dismiss(toastId);
        }
    };

    const opusRecorderRef = useRef<any>(null);

    const startRecording = async () => {
        if (!selectedContact?.id) {
            toast.error("Please select a contact before recording.");
            return;
        }

        try {
            // Check if opus-recorder is available
            const RecorderModule = (await import('opus-recorder')).default;
            const recorder = new RecorderModule({
                encoderPath: '/opus-recorder/encoderWorker.min.js',
                encoderSampleRate: 48000,
                numberOfChannels: 1,
                encoderApplication: 2048, // VoIP / Voice
                maxFramesPerPage: 40,
                encoderFrameSize: 20,
                streamPages: false
            });

            opusRecorderRef.current = recorder;

            recorder.ondataavailable = async (typedArray: Uint8Array) => {
                try {
                    recorder.close?.();
                } catch (e) { }

                if (!selectedContact?.id || !typedArray || typedArray.length < 200) {
                    console.warn("[VoiceRecord] Discarding empty or too short recording:", typedArray?.length);
                    return;
                }

                const oggBlob = new Blob([new Uint8Array(typedArray)], { type: 'audio/ogg' });
                const oggFile = new File([oggBlob], `voice-message-${Date.now()}.ogg`, { type: 'audio/ogg' });
                const blobPreviewUrl = URL.createObjectURL(oggBlob);

                const formData = new FormData();
                formData.append('file', oggFile);
                formData.append('contactId', selectedContact.id);
                formData.append('type', 'voice');
                formData.append('isVoice', 'true');

                const optimisticId = `optimistic-${Date.now()}`;
                const optimisticMsg: Message = {
                    id: optimisticId,
                    content: '[Voice Message]',
                    direction: 'outbound',
                    type: 'voice',
                    mediaUrl: blobPreviewUrl,
                    rawBody: { voice: true, isVoice: true, audio: { voice: true } },
                    createdAt: new Date(),
                    status: 'sending'
                };

                setMessages(prev => [...prev, optimisticMsg]);

                try {
                    setIsSending(true);
                    const res = await sendWhatsAppMedia(formData);
                    if (!res.success) throw new Error(res.error || "Failed to send voice message");

                    // Replace optimistic with real data
                    setMessages(prev => prev.map(m => m.id === optimisticId ? (res.data as Message) : m));
                } catch (error: any) {
                    console.error("Voice send error:", error);
                    // Rollback optimistic message
                    setMessages(prev => prev.filter(m => m.id !== optimisticId));
                    toast.error(error?.message || "Failed to send voice message");
                } finally {
                    setIsSending(false);
                }
            };

            await recorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Opus recorder error, fallback to standard media recorder:", error);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStreamRef.current = stream;

                const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg; codecs=opus'))
                    ? 'audio/ogg; codecs=opus'
                    : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm; codecs=opus'))
                        ? 'audio/webm; codecs=opus'
                        : 'audio/webm';

                const recorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRef.current = recorder;
                audioChunksRef.current = [];

                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                recorder.start(100);
                setIsRecording(true);
                setRecordingDuration(0);
                timerRef.current = setInterval(() => {
                    setRecordingDuration(prev => prev + 1);
                }, 1000);
            } catch (fallbackErr) {
                console.error("Microphone recording error:", fallbackErr);
                toast.error("Microphone access denied or error starting recording");
            }
        }
    };

    const stopRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);

            if (opusRecorderRef.current) {
                try {
                    const rec = opusRecorderRef.current;
                    opusRecorderRef.current = null;
                    // Trigger asynchronous flush and stop. Do NOT call rec.close() here as it
                    // prematurely kills the worker before encoded data can be delivered to ondataavailable.
                    rec.stop();
                    return;
                } catch (err) {
                    console.error("Error stopping opusRecorder:", err);
                    opusRecorderRef.current = null;
                }
            }

            if (mediaRecorderRef.current) {
                const recorder = mediaRecorderRef.current;
                recorder.onstop = async () => {
                    if (audioStreamRef.current) {
                        audioStreamRef.current.getTracks().forEach(track => track.stop());
                        audioStreamRef.current = null;
                    }

                    if (!selectedContact?.id || audioChunksRef.current.length === 0) return;

                    const mimeType = recorder.mimeType || 'audio/webm; codecs=opus';
                    const blob = new Blob(audioChunksRef.current, { type: mimeType });
                    // Backend convertWebMToOggOpus automatically ensures pure Ogg Opus
                    const file = new File([blob], `voice-message-${Date.now()}.ogg`, { type: mimeType });
                    const blobPreviewUrl = URL.createObjectURL(blob);

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('contactId', selectedContact.id);
                    formData.append('type', 'voice');
                    formData.append('isVoice', 'true');

                    const optimisticId = `optimistic-${Date.now()}`;
                    const optimisticMsg: Message = {
                        id: optimisticId,
                        content: '[Voice Message]',
                        direction: 'outbound',
                        type: 'voice',
                        mediaUrl: blobPreviewUrl,
                        rawBody: { voice: true, isVoice: true, audio: { voice: true } },
                        createdAt: new Date(),
                        status: 'sending'
                    };

                    setMessages(prev => [...prev, optimisticMsg]);

                    try {
                        setIsSending(true);
                        const res = await sendWhatsAppMedia(formData);
                        if (!res.success) throw new Error(res.error || "Failed to send voice message");

                        setMessages(prev => prev.map(m => m.id === optimisticId ? (res.data as Message) : m));
                    } catch (error: any) {
                        console.error("Voice send error:", error);
                        setMessages(prev => prev.filter(m => m.id !== optimisticId));
                        toast.error(error?.message || "Failed to send voice message");
                    } finally {
                        setIsSending(false);
                    }
                };

                recorder.stop();
            }
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleFormat = (formatter: string) => {
        if (!textareaRef.current || !canSendRegular) return;
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = newMessage.substring(start, end);
        const beforeText = newMessage.substring(0, start);
        const afterText = newMessage.substring(end);

        let newMsg = '';
        if (selectedText) {
            newMsg = `${beforeText}${formatter}${selectedText}${formatter}${afterText}`;
        } else {
            newMsg = `${beforeText}${formatter}${formatter}${afterText}`;
        }

        setNewMessage(newMsg);

        // Restore focus and cursor position after state update
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = selectedText ? start + formatter.length + selectedText.length + formatter.length : start + formatter.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };


    // Auto-select contact based on URL query parameter
    useEffect(() => {
        if (typeof window !== 'undefined' && contacts.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get('contactId') || params.get('id');
            if (queryId) {
                const matched = contacts.find(c => c.id === queryId);
                if (matched && (!selectedContact || selectedContact.id !== queryId)) {
                    setSelectedContact(matched);
                }
            }
        }
    }, [contacts]);

    // Use SWR for Messages
    const { data: swrMessages, mutate: mutateMessages } = useSWR(
        selectedContact ? `/api/chat/poll?type=messages&contactId=${selectedContact.id}` : null,
        fetcher,
        {
            refreshInterval: 3000,
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    // Sync SWR messages with local state and handle window logic, preserving pending optimistic messages and preventing race conditions
    useEffect(() => {
        if (swrMessages && selectedContact) {
            const currentActiveId = selectedContactIdRef.current;
            // Prevent race condition: ignore responses if selected contact has changed
            if (!currentActiveId || currentActiveId !== selectedContact.id) {
                return;
            }

            const serverMsgs = swrMessages as Message[];
            let finalMsgs = serverMsgs;

            setMessages(prev => {
                const pendingOptimistic = prev.filter(p => {
                    const isPending = p.id.startsWith('optimistic-') || p.status === 'sending';
                    if (!isPending) return false;
                    const alreadyInServer = serverMsgs.some(sm =>
                        sm.id === p.id ||
                        (p.wamid && sm.wamid === p.wamid) ||
                        (sm.content === p.content && sm.direction === p.direction && Math.abs(new Date(sm.createdAt).getTime() - new Date(p.createdAt).getTime()) < 15000)
                    );
                    return !alreadyInServer;
                });

                if (pendingOptimistic.length === 0) {
                    finalMsgs = serverMsgs;
                } else {
                    finalMsgs = [...serverMsgs, ...pendingOptimistic];
                }
                return finalMsgs;
            });

            messagesCacheRef.current.set(selectedContact.id, finalMsgs);
            messagesContactIdRef.current = selectedContact.id;
            setIsLoadingMessages(false);

            // Update 24-hour window status
            if (isQr) {
                setCanSendRegular(true);
            } else {
                const lastInbound = [...serverMsgs].filter(m => m.direction === 'inbound').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                if (lastInbound) {
                    const lastInboundDate = new Date(lastInbound.createdAt);
                    const diffMs = Date.now() - lastInboundDate.getTime();
                    const hoursSince = diffMs / (1000 * 60 * 60);

                    // Allow a small buffer for safety (23.9 hours instead of 24)
                    setCanSendRegular(hoursSince < 23.95);
                } else {
                    setCanSendRegular(false);
                }
            }
        }
    }, [swrMessages, selectedContact?.id, isQr]);

    // Check window status when contact transitions
    useEffect(() => {
        if (!selectedContact) return;

        if (isQr) {
            setCanSendRegular(true);
            return;
        }

        const contactId = selectedContact.id;

        // Optimistic check: if we already have messages for this contact, check them first
        if (messages.length > 0) {
            const lastInbound = [...messages].filter(m => m.direction === 'inbound').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            if (lastInbound) {
                const hoursSince = (Date.now() - new Date(lastInbound.createdAt).getTime()) / (1000 * 60 * 60);
                if (hoursSince < 23.9) {
                    setCanSendRegular(true);
                    return;
                }
            }
        }

        // Server check as secondary source of truth
        canSendRegularMessage(contactId).then((result) => {
            if (selectedContactIdRef.current === contactId) {
                setCanSendRegular(result);
            }
        }).catch(() => {
            if (selectedContactIdRef.current === contactId) {
                setCanSendRegular(false);
            }
        });
    }, [selectedContact?.id, messages.length, isQr]); // Added messages.length dependency

    const refreshTags = useCallback(async () => {
        try {
            const tagsRes = await getTags();
            setAvailableTags(tagsRes);
        } catch (e) {
            console.error('Failed to refresh tags:', e);
        }
    }, []);

    // Fetch Templates, Agents, Tags & Quick Replies on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [templateRes, agentRes, tagsRes, quickRepliesRes] = await Promise.allSettled([
                    !isQr ? getMessageTemplates() : Promise.resolve({ success: false, data: [] as any[] }),
                    getAgents(),
                    getTags(),
                    getQuickReplies()
                ]);

                // Message Templates (only for Meta Cloud API accounts)
                if (templateRes.status === 'fulfilled') {
                    const tmplVal = templateRes.value as any;
                    if (tmplVal?.success && Array.isArray(tmplVal?.data)) {
                        setTemplates(tmplVal.data);
                    } else if (Array.isArray(tmplVal)) {
                        setTemplates(tmplVal);
                    } else {
                        setTemplates([]);
                    }
                } else {
                    console.error('Failed to fetch message templates:', templateRes.reason);
                    setTemplates([]);
                }

                // Agents
                if (agentRes.status === 'fulfilled') {
                    const agentData: any = agentRes.value;
                    setAvailableAgents(Array.isArray(agentData) ? agentData : (Array.isArray(agentData?.data) ? agentData.data : []));
                } else {
                    console.error('Failed to fetch agents:', agentRes.reason);
                }

                // Tags
                if (tagsRes.status === 'fulfilled') {
                    const tagsData: any = tagsRes.value;
                    setAvailableTags(Array.isArray(tagsData) ? tagsData : (Array.isArray(tagsData?.data) ? tagsData.data : []));
                } else {
                    console.error('Failed to fetch tags:', tagsRes.reason);
                }

                // Quick Replies (independent execution)
                if (quickRepliesRes.status === 'fulfilled') {
                    const qrData: any = quickRepliesRes.value;
                    setQuickReplies(Array.isArray(qrData) ? qrData : (Array.isArray(qrData?.data) ? qrData.data : []));
                } else {
                    console.error('Failed to fetch quick replies:', quickRepliesRes.reason);
                }
            } catch (e) {
                console.error('Failed to fetch initial data:', e);
            }
        };
        fetchData();
    }, [isQr]);

    useEffect(() => {
        if (session?.user?.organizationId) {
            getAIAgents(session.user.organizationId)
                .then(data => setAiAgents(data))
                .catch(err => console.error("Failed to load AI Agents in live-chat:", err));
            getOrganizationAiStatus()
                .then(setIsOrganizationAiEnabled)
                .catch(err => console.error("Failed to load organization AI status:", err));
        }
    }, [session?.user?.organizationId]);

    // Scroll to bottom
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    };

    useEffect(() => {
        if (messages.length > 0) {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            } else {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
            }
        }
    }, [messages.length, selectedContact?.id]); // Scroll when messages change or contact changes


    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;

        // Check if template is required
        if (!isQr && !canSendRegular) {
            toast.error('The 24-hour messaging window has closed for this contact. Please use a template message to resume the conversation.', {
                duration: 5000,
                action: {
                    label: 'Use Template',
                    onClick: () => setIsTemplateDialogOpen(true)
                }
            });
            setIsTemplateDialogOpen(true);
            return;
        }

        let messageContent = newMessage.trim();
        const replyTarget = replyingToMessage;
        const replyToMessageId = replyTarget ? replyTarget.id : undefined;

        const optimisticId = `optimistic-${Date.now()}`;
        const now = new Date();

        // Optimistic message update
        const optimisticMsg: Message = {
            id: optimisticId,
            content: messageContent,
            direction: 'outbound',
            type: 'text',
            createdAt: now,
            status: 'sending',
            ...(replyTarget ? {
                replyToId: replyTarget.id,
                replyToWaId: replyTarget.wamid,
                replyPreview: replyTarget.content || (replyTarget.type ? `[${replyTarget.type.charAt(0).toUpperCase() + replyTarget.type.slice(1)}]` : 'Message'),
                replySenderName: replyTarget.direction === 'outbound' ? 'You' : (selectedContact.name || selectedContact.waId || 'Contact'),
                replyMessageType: replyTarget.type || 'text'
            } : {})
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage(""); // Clear input immediately
        setReplyingToMessage(null); // Clear reply state
        setIsSending(true);

        // Optimistically update left sidebar contact preview immediately
        const targetContactId = selectedContact.id;
        setContacts(prev => prev.map(c => c.id === targetContactId ? { ...c, lastMessage: messageContent, lastMessageAt: now } : c));
        setSelectedContact(prev => prev ? { ...prev, lastMessage: messageContent, lastMessageAt: now } : null);

        try {
            const res = await sendWhatsAppMessage(selectedContact.id, messageContent, false, undefined, undefined, replyToMessageId, selectedChannelId || undefined);
            if (!res.success) throw new Error(res.error || "Failed to send message");

            // Replace optimistic with real server response
            setMessages(prev => prev.map(m => m.id === optimisticId ? { ...(res.data as Message), status: (res.data as Message).status || 'sent' } : m));
            mutateMessages(); // Trigger SWR revalidation
            mutate('/api/chat/poll?type=contacts');

        } catch (error) {
            console.error("Message send error:", error);
            // Update optimistic message to failed status so it remains visible for retry
            setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: 'failed' } : m));
            toast.error("Failed to send message", {
                description: (error as Error).message
            });
            mutateContacts();
        } finally {
            setIsSending(false);
        }
    };

    const handleSendTemplate = async () => {
        if (!selectedContact || !selectedTemplate) return;

        // Build components array if template has parameters or media headers
        const finalComponents: any[] = [];
        const bodyComponent = selectedTemplate.components?.find((c: TemplateComponent) => c.type === 'BODY');
        const headerComponent = selectedTemplate.components?.find((c: TemplateComponent) => c.type === 'HEADER');

        // Check for header media parameter
        if (headerComponent && headerComponent.format) {
            const format = headerComponent.format.toLowerCase();
            if (['image', 'video', 'document'].includes(format)) {
                const mediaUrl = templateHeaderMediaUrl || headerComponent.example?.header_handle?.[0];
                if (mediaUrl) {
                    finalComponents.push({
                        type: 'header',
                        parameters: [{
                            type: format,
                            [format]: { link: mediaUrl }
                        }]
                    });
                }
            }
        }

        const matchCount = bodyComponent?.text?.match(/{{\d+}}/g)?.length || 0;
        const paramCount = Math.max(matchCount, bodyComponent?.example?.body_text?.[0]?.length || 0);

        if (paramCount > 0) {

            // Validate all parameters are filled
            if (templateParams.length !== paramCount || templateParams.some(p => !p.trim())) {
                alert(`Please fill in all ${paramCount} parameter(s) for this template.`);
                return;
            }

            finalComponents.push({
                type: 'body',
                parameters: templateParams.map(value => ({
                    type: 'text',
                    text: value
                }))
            });
        }

        // Automatically inject button parameters for dynamic URL or COPY_CODE buttons
        const buttonsComponent = selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS');
        if (buttonsComponent && Array.isArray(buttonsComponent.buttons)) {
            buttonsComponent.buttons.forEach((btn: any, idx: number) => {
                const isDynamicUrl = btn.type === 'URL' && (btn.url?.includes('{{1}}') || btn.example || btn.text?.toLowerCase().includes('copy'));
                if (isDynamicUrl) {
                    finalComponents.push({
                        type: 'button',
                        sub_type: 'url',
                        index: String(idx),
                        parameters: [{
                            type: 'text',
                            text: templateParams[0] || '1'
                        }]
                    });
                } else if (btn.type === 'COPY_CODE') {
                    finalComponents.push({
                        type: 'button',
                        sub_type: 'copy_code',
                        index: String(idx),
                        parameters: [{
                            type: 'coupon_code',
                            coupon_code: templateParams[0] || '1'
                        }]
                    });
                }
            });
        }

        const components = finalComponents.length > 0 ? finalComponents : undefined;

        // Resolve complete template text (Header + Body + Footer) for DB storage
        let resolvedText = `Template: ${selectedTemplate.name}`;
        const componentsText: string[] = [];

        // 1. Header Text
        if (headerComponent?.text) {
            componentsText.push(headerComponent.text);
        }

        // 2. Body Text (with parameters replaced)
        if (bodyComponent && bodyComponent.text) {
            let bodyText = bodyComponent.text;
            templateParams.forEach((param, idx) => {
                bodyText = bodyText.replaceAll(`{{${idx + 1}}}`, param);
            });
            componentsText.push(bodyText);
        }

        // 3. Footer Text
        const footerComponent = selectedTemplate.components?.find((c: TemplateComponent) => c.type === 'FOOTER');
        if (footerComponent?.text) {
            componentsText.push(footerComponent.text);
        }

        if (componentsText.length > 0) {
            resolvedText = componentsText.join('\n\n');
        }

        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMsg: Message = {
            id: optimisticId,
            content: resolvedText,
            direction: 'outbound',
            type: 'template',
            mediaUrl: templateHeaderMediaUrl || undefined,
            rawBody: {
                type: 'template',
                media_url: templateHeaderMediaUrl || undefined,
                template: {
                    name: selectedTemplate.name,
                    components: finalComponents
                }
            },
            createdAt: new Date(),
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setIsTemplateDialogOpen(false);
        setIsSendingTemplate(true);

        try {
            const res = await sendTemplateMessage(
                selectedContact.id,
                selectedTemplate.name,
                selectedTemplate.language,
                components,
                resolvedText
            );
            if (!res.success) throw new Error(res.error || "Failed to send template");

            // Replace optimistic with real data
            setMessages(prev => prev.map(m => m.id === optimisticId ? (res.data as Message) : m));
            setSelectedTemplate(null);
            setTemplateParams([]);
            mutate('/api/chat/poll?type=contacts');
        } catch (error) {
            console.error(error);
            // Rollback optimistic message
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            toast.error("Failed to send template", {
                description: (error as Error).message
            });
        } finally {
            setIsSendingTemplate(false);
        }
    };

    const handleSendQuickReply = async (replyId: string) => {
        if (!selectedContact) return;

        const optimisticId = `optimistic-${Date.now()}`;
        const reply = quickReplies.find(r => r.id === replyId);
        if (!reply) return;

        // Optimistic update
        let replyUrls: string[] = [];
        const rawFileUrl = (reply.fileUrl || '').trim();
        if (rawFileUrl.startsWith('[') && rawFileUrl.endsWith(']')) {
            try {
                const parsed = JSON.parse(rawFileUrl);
                if (Array.isArray(parsed)) replyUrls = parsed.map(String).filter(Boolean);
            } catch { }
        }
        if (replyUrls.length === 0 && rawFileUrl) replyUrls = [rawFileUrl];
        const resolvedContent = resolveContactVariables(reply.content, selectedContact);

        const optimisticMsg: Message = {
            id: optimisticId,
            content: reply.type === 'text'
                ? resolvedContent
                : (replyUrls.length > 1 ? `Sending ${replyUrls.length} images: ${reply.name}...` : `Sending ${reply.type}: ${reply.name}...`),
            direction: 'outbound',
            type: reply.type === 'text' ? 'text' : reply.type,
            createdAt: new Date(),
            status: 'sending',
            mediaUrl: replyUrls[0] || reply.fileUrl
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setIsSending(true);

        try {
            const res = await sendQuickReply(selectedContact.id, replyId);
            if (!res.success) throw new Error(res.error || "Failed to send quick reply");

            // Replace optimistic with real data
            setMessages(prev => prev.map(m => m.id === optimisticId ? (res.data as Message) : m));
            mutateMessages();
        } catch (error) {
            console.error(error);
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            toast.error("Failed to send quick reply");
        } finally {
            setIsSending(false);
        }
    };

    const handleAssign = async (agentId: string) => {
        if (!selectedContact) return;
        setIsTransferring(true);
        try {
            const res = await assignContactAgent(selectedContact.id, agentId, 'assign');
            if (!res.success) throw new Error(res.error || 'Failed to assign agent');
            toast.success('Agent assigned successfully');
            setSelectedContact(res.data as Contact);
            mutate('/api/chat/poll?type=contacts');
        } catch (error) {
            toast.error((error as Error).message || 'Failed to assign agent');
        } finally {
            setIsTransferring(false);
        }
    };

    const handleAssignAiAgent = async (agentId: string | null) => {
        if (!selectedContact) return;
        setIsAssigningAiAgent(true);
        try {
            const res = await assignAIAgentToContact(selectedContact.id, agentId);
            if (res.success) {
                const matchedAgent = aiAgents.find(a => a.id === agentId);
                const fallbackDefaultAgent = selectedContact.defaultAiAgent || aiAgents.find((agent: any) => agent.isDefault) || null;
                const nextEffectiveAgent = matchedAgent || fallbackDefaultAgent || null;
                const nextAgentSource: Contact['aiAgentSource'] = agentId ? 'assigned' : fallbackDefaultAgent ? 'default' : 'none';
                setSelectedContact(prev => prev ? {
                    ...prev,
                    aiAgentId: agentId,
                    aiAgent: matchedAgent || null,
                    effectiveAiAgent: nextEffectiveAgent,
                    aiAgentSource: nextAgentSource,
                } : null);
                setContacts(prev => prev.map(c => c.id === selectedContact.id ? {
                    ...c,
                    aiAgentId: agentId,
                    aiAgent: matchedAgent || null,
                    effectiveAiAgent: nextEffectiveAgent,
                    aiAgentSource: nextAgentSource,
                } : c));
                toast.success(agentId ? 'AI Agent assigned successfully' : 'AI Agent unassigned');
                mutate('/api/chat/poll?type=contacts');
            } else {
                toast.error('Failed to assign AI Agent');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to assign AI Agent');
        } finally {
            setIsAssigningAiAgent(false);
        }
    };

    const handleUnassign = async (agentId: string | null) => {
        if (!selectedContact) return;
        setIsTransferring(true);
        try {
            const res = await assignContactAgent(selectedContact.id, agentId, 'unassign');
            if (!res.success) throw new Error(res.error || 'Failed to unassign agent');
            toast.success(agentId ? 'Agent unassigned successfully' : 'All agents unassigned');
            setSelectedContact(res.data as Contact);
            mutate('/api/chat/poll?type=contacts');
        } catch (error) {
            toast.error((error as Error).message || 'Failed to unassign agent');
        } finally {
            setIsTransferring(false);
        }
    };

    const handleToggleAiBot = async () => {
        if (!selectedContact || isTogglingAiBot) return;
        setIsTogglingAiBot(true);
        const isCurrentlyHandledByAi = isContactHandledByAi(selectedContact);
        const selectedOrganizationAiEnabled = selectedContact.organization?.isAiBotEnabled ?? isOrganizationAiEnabled;
        const nextContactStatus = !isCurrentlyHandledByAi;
        const nextOrganizationStatus = isCurrentlyHandledByAi
            ? selectedOrganizationAiEnabled
            : true;
        try {
            if (!isCurrentlyHandledByAi && !selectedOrganizationAiEnabled) {
                const orgRes = await toggleOrganizationAiStatus(true);
                if (!orgRes.success) throw new Error(orgRes.error || 'Failed to enable organization AI bot');
                setIsOrganizationAiEnabled(true);
            }

            const res = await toggleAiBot(selectedContact.id, nextContactStatus);
            if (!res.success) throw new Error(res.error || 'Failed to toggle AI bot status');

            toast.success(nextContactStatus ? 'AI Bot resumed for this chat' : 'Chat marked as Intervened');

            const updatedContact = res.contact ? {
                ...selectedContact,
                ...res.contact,
                organization: {
                    ...(selectedContact.organization || {}),
                    isAiBotEnabled: nextOrganizationStatus
                }
            } : null;

            if (updatedContact) {
                setSelectedContact(updatedContact as Contact);
                setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...updatedContact } as Contact : c));
            }

            mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
        } catch (error) {
            toast.error((error as Error).message || 'Failed to toggle AI Bot status');
        } finally {
            setIsTogglingAiBot(false);
        }
    };

    const [isTogglingWebhook, setIsTogglingWebhook] = useState(false);

    useEffect(() => {
        const fetchWebhooks = async () => {
            try {
                const res = await getOrganizationWebhooks(selectedContact?.id);
                if (res.success && res.webhooks) {
                    setAvailableWebhooks(res.webhooks);
                }
            } catch (err) {
                console.error("Failed to load organization webhooks:", err);
            }
        };
        fetchWebhooks();
    }, [selectedContact?.id]);

    const handleToggleSpecificWebhook = async (webhookId: string) => {
        if (!selectedContact || isTogglingWebhook) return;
        setIsTogglingWebhook(true);

        try {
            if (webhookId === 'all') {
                const nextStatus = !(selectedContact.isWebhookEnabled ?? true);
                const res = await toggleSpecificWebhookAutomation(selectedContact.id, 'all', nextStatus);
                if (!res.success) throw new Error(res.error || 'Failed to update webhook setting');
                toast.success(nextStatus ? 'All Webhooks Enabled' : 'All Webhooks Disabled');
                if (res.contact) {
                    setSelectedContact(prev => prev ? { ...prev, ...res.contact } as Contact : null);
                    setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...res.contact } as Contact : c));
                }
            } else {
                const disabledList = selectedContact.disabledWebhookIds || [];
                const isCurrentlyDisabled = disabledList.includes(webhookId);
                const enableIt = isCurrentlyDisabled;
                const res = await toggleSpecificWebhookAutomation(selectedContact.id, webhookId, enableIt);
                if (!res.success) throw new Error(res.error || 'Failed to update webhook setting');

                toast.success(enableIt ? 'Webhook Enabled' : 'Webhook Disabled');
                if (res.contact) {
                    setSelectedContact(prev => prev ? { ...prev, ...res.contact } as Contact : null);
                    setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, ...res.contact } as Contact : c));
                }
            }
            mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
        } catch (error) {
            toast.error((error as Error).message || 'Failed to update webhook automation setting');
        } finally {
            setIsTogglingWebhook(false);
        }
    };

    const handleToggleTag = async (tagId: string) => {
        if (!selectedContact) return;
        const targetContactId = selectedContact.id;
        const now = Date.now();

        // Retrieve latest tags from optimistic ref if valid, or selectedContact.tags
        const opt = optimisticContactTagsRef.current[targetContactId];
        const baseTags = (opt && (now - opt.timestamp) < 15000)
            ? opt.tags
            : (selectedContact.tags || []);

        const currentTagIds = baseTags.map(t => t.id);
        let newTagIds: string[];
        if (currentTagIds.includes(tagId)) {
            newTagIds = currentTagIds.filter(id => id !== tagId);
        } else {
            newTagIds = [...currentTagIds, tagId];
        }

        const updatedTags = availableTags.filter(t => newTagIds.includes(t.id));

        // 1. Lock in optimistic ref immediately (prevents SWR polling overwrite)
        optimisticContactTagsRef.current[targetContactId] = {
            tags: updatedTags,
            timestamp: now
        };

        // 2. Instantly update React state in < 1ms
        setSelectedContact(prev => (prev && prev.id === targetContactId) ? { ...prev, tags: updatedTags } : prev);
        setContacts(prev => prev.map(c => c.id === targetContactId ? { ...c, tags: updatedTags } : c));

        // 3. Mutate SWR local cache without triggering network revalidation
        if (typeof mutateContacts === 'function') {
            mutateContacts((currentData: any) => {
                if (!currentData || !Array.isArray(currentData.contacts)) return currentData;
                return {
                    ...currentData,
                    contacts: currentData.contacts.map((c: any) =>
                        c.id === targetContactId ? { ...c, tags: updatedTags } : c
                    )
                };
            }, { revalidate: false });
        }

        // 4. Send background PUT request to save in DB
        try {
            const res = await fetch('/api/contacts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: targetContactId, tagIds: newTagIds })
            });

            if (!res.ok) throw new Error('Failed to update tags');

            // Extend lock timestamp on success
            optimisticContactTagsRef.current[targetContactId] = {
                tags: updatedTags,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('[Tags] Toggle error:', error);
            delete optimisticContactTagsRef.current[targetContactId];
            toast.error('Failed to update labels');
            if (typeof mutateContacts === 'function') {
                mutateContacts();
            }
        }
    };

    const handleCreateContact = async () => {
        if (!newContactPhone) return;
        setIsCreatingContact(true);
        try {
            const fullPhone = `${selectedCountry.code.replace('-', '')}${newContactPhone}`;
            const nameToUse = newContactName || fullPhone;
            const res = await createContact(nameToUse, fullPhone);
            if (!res.success) throw new Error(res.error || "Failed to create contact");

            mutate('/api/chat/poll?type=contacts');
            setSelectedContact(res.data as Contact);
            setIsNewChatOpen(false);
            setNewContactName("");
            setNewContactPhone("");
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setIsCreatingContact(false);
        }
    }

    const activeCount = useMemo(() => isQr ? (derivedTabCounts.all || 0) : (derivedTabCounts.all - derivedTabCounts.expired), [isQr, derivedTabCounts.all, derivedTabCounts.expired]);
    const expiredCount = useMemo(() => isQr ? 0 : derivedTabCounts.expired, [isQr, derivedTabCounts.expired]);
    const assignedCount = useMemo(() => derivedTabCounts.assigned, [derivedTabCounts.assigned]);
    const aiChatsCount = useMemo(() => derivedTabCounts.ai || 0, [derivedTabCounts.ai]);
    const starredCount = useMemo(() => derivedTabCounts.intervented || 0, [derivedTabCounts.intervented]);
    const visitorsCount = useMemo(() => derivedTabCounts.visitors || 0, [derivedTabCounts.visitors]);
    const selectedContactHandledByAi = isContactHandledByAi(selectedContact);
    const selectedContactOrgAiDisabled = !!selectedContact && !(selectedContact.organization?.isAiBotEnabled ?? isOrganizationAiEnabled);
    const defaultAiAgent = useMemo(
        () => selectedContact?.defaultAiAgent || aiAgents.find((agent: any) => agent.isDefault) || null,
        [aiAgents, selectedContact?.defaultAiAgent]
    );
    const explicitlyAssignedAiAgent = useMemo(() => {
        if (!selectedContact?.aiAgentId) return null;
        return selectedContact.aiAgent || aiAgents.find((agent: any) => agent.id === selectedContact.aiAgentId) || null;
    }, [aiAgents, selectedContact?.aiAgent, selectedContact?.aiAgentId]);
    const effectiveAiAgent = selectedContact?.effectiveAiAgent || explicitlyAssignedAiAgent || defaultAiAgent || null;
    const isUsingDefaultAiAgent = !!selectedContact && (
        selectedContact.aiAgentSource === 'default' ||
        (!selectedContact.aiAgentId && !!effectiveAiAgent)
    );

    if (isLoadingContacts && contacts.length === 0) {
        return <WatiBotLoader />;
    }

    return (
        <DashboardLayoutClient
            mainFullBleed={true}
            mainClassName="flex flex-col h-[calc(100dvh-48px)] overflow-hidden antialiased bg-white dark:bg-slate-900"
        >
            {session?.user && !session.user.whatsappConnected && !session.user.facebookConnected && !session.user.instagramConnected && (
                <LockedPageOverlay
                    title="Live Chat Restricted"
                    description="Your Live Chat workspace is currently locked. To start chatting with customers, you must first connect your WhatsApp Business Account, Facebook Page, or Instagram account."
                    icon={<Smartphone className="w-10 h-10" />}
                    ctaText="Connect a Platform"
                    ctaLink={`/${locale}/dashboard/settings`}
                />
            )}
            {session?.user && (
                session.user.status === 'SUSPENDED' ||
                session.user.status === 'INACTIVE' ||
                session.user.status === 'EXPIRED' ||
                (session.user.status === 'TRIAL' && (session.user.trialDaysRemaining ?? 0) <= 0)
            ) && (
                    <LockedPageOverlay
                        title="Plan Expired"
                        description="Your active plan has expired. To continue viewing and replying to your messages, please upgrade or renew your subscription."
                        ctaText="Upgrade Plan"
                        ctaLink={`/${locale}/dashboard/billing`}
                        icon={<Lock className="w-10 h-10" />}
                    />
                )}
            <div className="flex flex-col h-full w-full flex-1 overflow-hidden">
                {/* Top premium design metrics status bar */}
                <div className="hidden md:flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3.5 flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0 shadow-sm">
                    {activeTab === 'history' ? (
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleBackToLiveChat}
                                variant="outline"
                                size="icon"
                                className="bg-white border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 w-9 h-9 shadow-sm cursor-pointer mr-1 active:scale-95 transition-all"
                                title="Back to Live Chat"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[16px] font-black text-slate-800 dark:text-slate-200 leading-none">Chat History</span>
                                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1">Viewing expired & closed conversations</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-5 md:gap-7.5">
                            {/* Card 1: Active */}
                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
                                onClick={() => handleTabChange('all')}
                            >
                                <div className="w-9 h-9 rounded-full bg-[#e6f7f0] text-[#00a884] flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 leading-none">{activeCount}</span>
                                    <span className="text-[10.5px] font-bold text-[#00a884] dark:text-slate-500 mt-1">{t('active')}</span>
                                </div>
                            </div>


                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
                                onClick={() => handleTabChange('history')}
                            >
                                <div className="w-9 h-9 rounded-full bg-[#fff6e6] text-[#ff9800] flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 leading-none">{expiredCount}</span>
                                    <span className="text-[10.5px] font-bold text-[#ff9800] dark:text-slate-500 mt-1">{t('expired')}</span>
                                </div>
                            </div>

                            {/* Card 3: Assigned to me */}
                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
                                onClick={() => handleTabChange('assigned')}
                            >
                                <div className="w-9 h-9 rounded-full bg-[#e8effd] text-[#3b82f6] flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 leading-none">{assignedCount}</span>
                                    <span className="text-[10.5px] font-bold text-[#3b82f6] dark:text-slate-500 mt-1">{t('assignedToMe')}</span>
                                </div>
                            </div>

                            {/* Card 4: AI Chats */}
                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
                                onClick={() => handleTabChange('ai')}
                            >
                                <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 leading-none">{aiChatsCount}</span>
                                    <span className="text-[10.5px] font-bold text-purple-600 dark:text-slate-500 mt-1">AI Chats</span>
                                </div>
                            </div>

                            {/* Card 5: Intervented */}
                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
                                onClick={() => handleTabChange('intervented')}
                            >
                                <div className="w-9 h-9 rounded-full bg-[#fffbeb] text-[#d97706] flex items-center justify-center shrink-0">
                                    <Star className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 leading-none">{starredCount}</span>
                                    <span className="text-[10.5px] font-bold text-[#d97706] dark:text-slate-500 mt-1">Intervented</span>
                                </div>
                            </div>

                            {/* Card 6: Website Visitors */}
                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
                                onClick={() => handleTabChange('visitors')}
                            >
                                <div className="w-9 h-9 rounded-full bg-[#e0f2fe] text-[#0284c7] dark:bg-sky-950/30 dark:text-sky-400 flex items-center justify-center shrink-0">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[15px] font-black text-slate-800 dark:text-slate-200 leading-none">{visitorsCount}</span>
                                    <span className="text-[10.5px] font-bold text-[#0284c7] dark:text-sky-400 mt-1">Visitors</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions — full width row on mobile, compact on desktop */}
                    <div className="flex items-center gap-2">
                        {/* Filters Button */}
                        <Button
                            onClick={() => setIsFilterModalOpen(true)}
                            variant="outline"
                            className="bg-white border border-slate-200/80 text-slate-750 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 h-9 shadow-sm"
                        >
                            <Filter className="w-3.5 h-3.5 text-slate-500" />
                            <span>{t("filters")}</span>
                        </Button>

                        {/* Refresh Button */}
                        <Button
                            onClick={() => mutate('/api/chat/poll?type=contacts')}
                            variant="outline"
                            size="icon"
                            className="bg-white border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 text-[#00a884] rounded-xl hover:bg-[#e6f4ee]/50 flex items-center justify-center shrink-0 w-9 h-9 shadow-sm"
                            title="Refresh List"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </Button>

                        {/* New Conversation Button with Chevron Dropdown design */}
                        <Button
                            onClick={() => setIsNewChatOpen(true)}
                            className="bg-[#00a884] hover:bg-[#008f70] text-white rounded-xl text-[11px] font-bold pl-4 pr-3.5 py-2 shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center gap-2 h-9"
                        >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>{t("newConversation")}</span>
                            <div className="w-[1px] h-3.5 bg-white/25 mx-0.5" />
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    {/* Contacts Sidebar - Left Column */}
                    <div
                        className={cn(
                            "relative h-full bg-white dark:bg-slate-950 border-r border-[#E0E0E0] dark:border-[#2a3942] flex flex-col shrink-0 w-full md:w-[400px] xl:w-[450px]",
                            selectedContact ? 'hidden md:flex' : 'flex'
                        )}
                    >

                        {/* Header with Tabs - Styled premium white/dark bg */}
                        <div className="h-24 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col shrink-0">
                            {/* Search and Action Row */}
                            <div className="flex items-center justify-between px-4 py-2.5 flex-1">
                                {isSearchActive ? (
                                    <div className="flex items-center gap-2 w-full animate-in fade-in duration-200">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                            <Input
                                                placeholder="Search conversations..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-8 h-8 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#00a884]/20 rounded-xl text-xs outline-none shadow-none transition-all"
                                                autoFocus
                                            />
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-slate-400 hover:text-slate-750 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setIsSearchActive(false);
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Left Side: Platform Dropdown (All, WhatsApp, Instagram, Facebook) */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="bg-slate-50 border border-slate-200/60 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold px-3 py-1.5 flex items-center gap-1.5 h-8 select-none shadow-none cursor-pointer max-w-[180px]"
                                                >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        {liveFilters.platform === 'WHATSAPP' ? (
                                                            <>
                                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                <span className="truncate">WhatsApp</span>
                                                            </>
                                                        ) : liveFilters.platform === 'INSTAGRAM' ? (
                                                            <>
                                                                <Instagram className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                                                                <span className="truncate">Instagram</span>
                                                            </>
                                                        ) : liveFilters.platform === 'FACEBOOK' ? (
                                                            <>
                                                                <Facebook className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                                <span className="truncate">Facebook</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                <span className="truncate">{t('allChannels')}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl min-w-[180px] p-1.5 space-y-0.5 z-50">
                                                {/* All Channels Option */}
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedFilterChannelId('all');
                                                        setLiveFilters(prev => ({ ...prev, platform: 'All' }));
                                                    }}
                                                    className={cn(
                                                        "text-xs font-semibold rounded-xl cursor-pointer flex items-center justify-between px-2.5 py-1.5",
                                                        liveFilters.platform === 'All'
                                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-emerald-600" />
                                                        <span>All Channels</span>
                                                    </div>
                                                    {liveFilters.platform === 'All' && (
                                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                    )}
                                                </DropdownMenuItem>

                                                {/* WhatsApp Option */}
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedFilterChannelId('all');
                                                        setLiveFilters(prev => ({ ...prev, platform: 'WHATSAPP' }));
                                                    }}
                                                    className={cn(
                                                        "text-xs font-semibold rounded-xl cursor-pointer flex items-center justify-between px-2.5 py-1.5",
                                                        liveFilters.platform === 'WHATSAPP'
                                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                                        <span>WhatsApp</span>
                                                    </div>
                                                    {liveFilters.platform === 'WHATSAPP' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                                </DropdownMenuItem>

                                                {/* Instagram Option */}
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedFilterChannelId('all');
                                                        setLiveFilters(prev => ({ ...prev, platform: 'INSTAGRAM' }));
                                                    }}
                                                    className={cn(
                                                        "text-xs font-semibold rounded-xl cursor-pointer flex items-center justify-between px-2.5 py-1.5",
                                                        liveFilters.platform === 'INSTAGRAM'
                                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Instagram className="w-4 h-4 text-pink-500" />
                                                        <span>Instagram</span>
                                                    </div>
                                                    {liveFilters.platform === 'INSTAGRAM' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                                </DropdownMenuItem>

                                                {/* Facebook Option */}
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedFilterChannelId('all');
                                                        setLiveFilters(prev => ({ ...prev, platform: 'FACEBOOK' }));
                                                    }}
                                                    className={cn(
                                                        "text-xs font-semibold rounded-xl cursor-pointer flex items-center justify-between px-2.5 py-1.5",
                                                        liveFilters.platform === 'FACEBOOK'
                                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Facebook className="w-4 h-4 text-blue-600" />
                                                        <span>Facebook</span>
                                                    </div>
                                                    {liveFilters.platform === 'FACEBOOK' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Right Side: Action Icons */}
                                        <div className="flex items-center gap-0.5">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                                                onClick={() => setIsSearchActive(true)}
                                            >
                                                <Search className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                                                onClick={() => setIsFilterModalOpen(true)}
                                            >
                                                <ListFilter className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl cursor-pointer"
                                                onClick={handleMarkAllAsRead}
                                                disabled={isMarkingAllRead}
                                                title="Mark all as read"
                                            >
                                                {isMarkingAllRead ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <CheckCheck className="w-4 h-4" />}
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl min-w-[150px]">
                                                    <DropdownMenuItem
                                                        onClick={handleMarkAllAsRead}
                                                        disabled={isMarkingAllRead}
                                                        className="text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
                                                    >
                                                        <CheckCheck className="w-3.5 h-3.5" />
                                                        Mark all as read
                                                    </DropdownMenuItem>
                                                    {canExportContacts && (
                                                        <DropdownMenuItem
                                                            onClick={() => setIsExportModalOpen(true)}
                                                            className="text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            {t('exportHistory')}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        onClick={() => mutate('/api/chat/poll?type=contacts')}
                                                        className="text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        {t('syncContacts')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Tabs Row */}
                            {activeTab === 'history' ? (
                                <div className="flex items-center px-4 pb-2.5 pt-1.5 border-t border-slate-50 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex-1 min-h-0">
                                    <button
                                        onClick={handleBackToLiveChat}
                                        className="flex items-center gap-1.5 text-xs font-bold text-[#00a884] dark:text-[#00c99e] hover:opacity-85 transition-all cursor-pointer"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        <span>Back to Live Chat</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-end px-3 border-t border-slate-50 dark:border-slate-800/60 bg-white dark:bg-slate-900 flex-1 min-h-0">
                                    <div className="flex w-full items-center gap-3.5 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap scroll-smooth pb-0.5">
                                        {/* All Tab */}
                                        <button
                                            onClick={() => handleTabChange('all')}
                                            className={cn(
                                                "pb-2.5 pt-2 px-1 text-center transition-all relative text-xs font-bold cursor-pointer select-none flex items-center gap-1 shrink-0",
                                                activeTab === 'all'
                                                    ? "text-[#00a884] dark:text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                            )}
                                        >
                                            <span>{t('all')}</span>
                                            {derivedTabCounts.all > 0 && (
                                                <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[9px] font-bold shrink-0">
                                                    {derivedTabCounts.all}
                                                </span>
                                            )}
                                            {activeTab === 'all' && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00a884] rounded-full animate-in slide-in-from-left duration-200" />
                                            )}
                                        </button>

                                        {/* Unread Tab */}
                                        <button
                                            onClick={() => handleTabChange('unread')}
                                            className={cn(
                                                "pb-2.5 pt-2 px-1 text-center transition-all relative text-xs font-bold cursor-pointer select-none flex items-center gap-1 shrink-0",
                                                activeTab === 'unread'
                                                    ? "text-[#00a884] dark:text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                            )}
                                        >
                                            <span>{t('unread')}</span>
                                            {derivedTabCounts.unread > 0 && (
                                                <span className="min-w-[18px] h-4 px-1.5 flex items-center justify-center bg-[#00a884] text-white rounded-full text-[10px] font-black leading-none shrink-0">
                                                    {derivedTabCounts.unread}
                                                </span>
                                            )}
                                            {activeTab === 'unread' && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00a884] rounded-full animate-in slide-in-from-left duration-200" />
                                            )}
                                        </button>

                                        {/* Assigned Chat Tab */}
                                        <button
                                            onClick={() => handleTabChange('assigned')}
                                            className={cn(
                                                "pb-2.5 pt-2 px-1 text-center transition-all relative text-xs font-bold cursor-pointer select-none flex items-center gap-1 shrink-0",
                                                activeTab === 'assigned'
                                                    ? "text-[#00a884] dark:text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                            )}
                                        >
                                            <span>Assigned Chat</span>
                                            {derivedTabCounts.assigned > 0 && (
                                                <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[9px] font-bold shrink-0">
                                                    {derivedTabCounts.assigned}
                                                </span>
                                            )}
                                            {activeTab === 'assigned' && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00a884] rounded-full animate-in slide-in-from-left duration-200" />
                                            )}
                                        </button>

                                        {/* AI Chat Tab */}
                                        <button
                                            onClick={() => handleTabChange('ai')}
                                            className={cn(
                                                "pb-2.5 pt-2 px-1 text-center transition-all relative text-xs font-bold cursor-pointer select-none flex items-center gap-1 shrink-0",
                                                activeTab === 'ai'
                                                    ? "text-[#00a884] dark:text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                            )}
                                        >
                                            <span>AI Chat</span>
                                            {derivedTabCounts.ai > 0 && (
                                                <span className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[9px] font-bold shrink-0">
                                                    {derivedTabCounts.ai}
                                                </span>
                                            )}
                                            {activeTab === 'ai' && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00a884] rounded-full animate-in slide-in-from-left duration-200" />
                                            )}
                                        </button>

                                        {/* Intervented Chat Tab */}
                                        <button
                                            onClick={() => handleTabChange('intervented')}
                                            className={cn(
                                                "pb-2.5 pt-2 px-1 text-center transition-all relative text-xs font-bold cursor-pointer select-none shrink-0 flex items-center gap-1",
                                                activeTab === 'intervented'
                                                    ? "text-[#00a884] dark:text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                            )}
                                        >
                                            <span>Intervented Chat</span>
                                            {derivedTabCounts.intervented > 0 && (
                                                <span className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full text-[9px] font-bold shrink-0">
                                                    {derivedTabCounts.intervented}
                                                </span>
                                            )}
                                            {activeTab === 'intervented' && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00a884] rounded-full animate-in slide-in-from-left duration-200" />
                                            )}
                                        </button>

                                        {/* Website Visitors Tab */}
                                        <button
                                            onClick={() => handleTabChange('visitors')}
                                            className={cn(
                                                "pb-2.5 pt-2 px-1 text-center transition-all relative text-xs font-bold cursor-pointer select-none shrink-0 flex items-center gap-1.5",
                                                activeTab === 'visitors'
                                                    ? "text-[#0284c7] dark:text-sky-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                            )}
                                        >
                                            <Globe className="w-3.5 h-3.5" />
                                            <span>Website Visitors</span>
                                            {derivedTabCounts.visitors > 0 && (
                                                <span className="px-1.5 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-full text-[9px] font-bold shrink-0">
                                                    {derivedTabCounts.visitors}
                                                </span>
                                            )}
                                            {activeTab === 'visitors' && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0284c7] rounded-full animate-in slide-in-from-left duration-200" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Filter Modal */}
                        <AdvancedFiltersPanel
                            isOpen={isFilterModalOpen}
                            onClose={() => setIsFilterModalOpen(false)}
                            filters={liveFilters}
                            onApply={(newFilters) => setLiveFilters(newFilters)}
                            agents={availableAgents}
                            tags={availableTags}
                            onRefreshTags={refreshTags}
                        />

                        {/* Export Modal */}
                        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                            <DialogContent className="border border-primary/10 max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Export Chat History</DialogTitle>
                                    <DialogDescription>
                                        Select a contact to export their full message history to Excel.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search contact..."
                                                value={exportSearchQuery}
                                                onChange={(e) => setExportSearchQuery(e.target.value)}
                                                className="pl-10 h-11 rounded-2xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-primary/20 outline-none shadow-none text-xs font-bold"
                                            />
                                        </div>

                                        {/* Tag Filter Section */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filter by Tags</span>
                                                {selectedExportTags.length > 0 && (
                                                    <button
                                                        onClick={() => setSelectedExportTags([])}
                                                        className="text-[10px] font-bold text-primary hover:underline"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                                                {availableTags.map(tag => {
                                                    const isSelected = selectedExportTags.includes(tag.id);
                                                    return (
                                                        <button
                                                            key={tag.id}
                                                            onClick={() => {
                                                                setSelectedExportTags(prev =>
                                                                    isSelected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                                                                );
                                                            }}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                                                                isSelected
                                                                    ? "bg-primary/10 border-primary text-primary shadow-sm"
                                                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                                                {tag.name}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                                {availableTags.length === 0 && (
                                                    <span className="text-[10px] text-slate-400 italic px-1">No tags available</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <ScrollArea className="h-[260px] pr-4">
                                        <div className="space-y-2">
                                            {contacts
                                                .filter(c => {
                                                    // Search match
                                                    const matchesSearch = !exportSearchQuery.trim() ||
                                                        c.name?.toLowerCase().includes(exportSearchQuery.toLowerCase()) ||
                                                        c.waId.includes(exportSearchQuery);

                                                    // Tag match
                                                    const matchesTags = selectedExportTags.length === 0 ||
                                                        c.tags?.some(t => selectedExportTags.includes(t.id));

                                                    return matchesSearch && matchesTags;
                                                })
                                                .map(contact => (
                                                    <div
                                                        key={contact.id}
                                                        onClick={() => {
                                                            handleExportSingleChat(contact.id, contact.name || contact.waId);
                                                            setIsExportModalOpen(false);
                                                            setExportSearchQuery("");
                                                        }}
                                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 dark:hover:bg-primary/5 cursor-pointer transition-colors border border-transparent hover:border-primary/20"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <ChatAvatar contact={contact} className="h-8 w-8" />
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{contact.name || contact.waId}</span>
                                                                <span className="text-[10px] text-muted-foreground tracking-wider">{contact.waId}</span>
                                                            </div>
                                                        </div>
                                                        <Download className="w-4 h-4 text-primary" />
                                                    </div>
                                                ))}
                                            {contacts.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground text-sm">No contacts found</div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                                <DialogFooter>
                                    <ModalButton variant="outline" onClick={() => setIsExportModalOpen(false)}>Close</ModalButton>
                                    <ModalButton onClick={handleExport}>Export All Contacts</ModalButton>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <div className="flex-1 relative flex flex-col min-h-0 bg-white dark:bg-slate-950">
                            {canCreateContact && (
                                <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                                    <DialogContent className="max-w-md w-full rounded-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl [&>button]:hidden font-sans">
                                        <div className="px-7 pt-7 pb-8 space-y-7">
                                            <div className="flex items-start justify-between gap-4">
                                                <DialogHeader className="text-left space-y-1">
                                                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("newConversation")}</DialogTitle>
                                                    <DialogDescription className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">
                                                        {t('enterPhoneToStart')}
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <button
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                                                    onClick={() => setIsNewChatOpen(false)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="space-y-5">
                                                <div className="space-y-2.5">
                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1 block">
                                                        {t('mobileNumberTitle')}
                                                    </label>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-[120px] shrink-0">
                                                            <Select value={selectedCountry.code} onValueChange={(val) => {
                                                                const c = countries.find(x => x.code === val);
                                                                if (c) setSelectedCountry(c);
                                                            }}>
                                                                <SelectTrigger className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 shadow-sm text-[13px] font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 shadow-xl font-sans">
                                                                    {countries.map((c) => (
                                                                        <SelectItem key={c.code} value={c.code} className="text-[13px] font-medium rounded-lg cursor-pointer">
                                                                            {c.name} ({c.code})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="relative flex-1">
                                                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-2.5 h-5">
                                                                <span>{selectedCountry.code}</span>
                                                            </div>
                                                            <Input
                                                                placeholder={t('whatsappNumber')}
                                                                value={newContactPhone}
                                                                onChange={(e) => setNewContactPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                                                className="h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-[74px] focus-visible:ring-2 focus-visible:ring-primary/20 text-[13px] font-semibold shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors placeholder:text-slate-400 placeholder:font-medium"
                                                                style={{ paddingLeft: `${50 + (selectedCountry.code.length * 8)}px` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 ml-1">
                                                        {t('enterMobileWithoutCountryCode')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pt-2">
                                                <ModalButton variant="outline" onClick={() => setIsNewChatOpen(false)} className="flex-1 h-11 rounded-xl text-xs font-semibold shadow-sm">
                                                    {t('cancelUpper')}
                                                </ModalButton>
                                                <ModalButton
                                                    onClick={handleCreateContact}
                                                    disabled={!newContactPhone}
                                                    loading={isCreatingContact}
                                                    className="flex-1 h-11 rounded-xl text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                                                >
                                                    {t('startChat')}
                                                </ModalButton>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {activeTab === 'intervented' && (
                                <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Intervented By</span>
                                    <div className="w-48">
                                        <Select value={interventedFilter} onValueChange={setInterventedFilter}>
                                            <SelectTrigger className="h-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-primary/20 shadow-none text-xs font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
                                                <SelectItem value="all" className="text-xs font-medium rounded-lg">
                                                    All Agents
                                                </SelectItem>
                                                <SelectItem value="me" className="text-xs font-medium rounded-lg">
                                                    Me
                                                </SelectItem>
                                                {availableAgents.map((agent) => {
                                                    const isMe = agent.id === session?.user?.id || agent.email === session?.user?.email;
                                                    if (isMe) return null;
                                                    return (
                                                        <SelectItem key={agent.id} value={agent.id} className="text-xs font-medium rounded-lg">
                                                            {agent.name || agent.email}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {(isLoadingContactsSWR || isLoadingContacts) && filteredContacts.length === 0 ? (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/40 animate-pulse p-1">
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className="py-3.5 px-3.5 flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                                                <div className="flex-1 min-w-0 space-y-2 py-0.5">
                                                    <div className="flex justify-between items-center">
                                                        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-28" />
                                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-md w-10" />
                                                    </div>
                                                    <div className="h-3 bg-slate-100 dark:bg-slate-800/80 rounded-md w-3/4" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredContacts.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        <p className="font-medium">
                                            {activeTab === 'visitors' ? 'No website visitors yet.' : 'No conversations yet.'}
                                        </p>
                                        <p className="text-xs opacity-60 mt-1">
                                            {activeTab === 'visitors' ? 'Visitors messaging through the website widget will show here.' : 'Direct messages will appear here.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredContacts.slice(0, visibleContactsCount).map(contact => (
                                            <div
                                                key={contact.id}
                                                onClick={() => handleSelectContact(contact)}
                                                className={cn(
                                                    "py-3.5 flex items-start gap-3 transition-all cursor-pointer border-b border-slate-100/50 dark:border-slate-800/30",
                                                    selectedContact?.id === contact.id
                                                        ? "bg-emerald-50/30 dark:bg-[#00B074]/5 border-l-4 border-[#00B074] pl-2.5 pr-3.5"
                                                        : "hover:bg-slate-50/60 dark:hover:bg-slate-900/60 border-l-4 border-transparent px-3.5"
                                                )}
                                            >
                                                {/* Avatar Container with Platform Overlay Badge */}
                                                <div className="shrink-0 relative">
                                                    <ChatAvatar contact={contact} className="h-10 w-10 border border-slate-100 dark:border-slate-800" />

                                                    {/* Platform Overlay Badge */}
                                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-950 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center z-10">
                                                        {(contact.customAttributes as any)?.channel === 'website_widget' || contact.waId?.startsWith('web_') ? (
                                                            <Globe className="h-3.5 w-3.5 text-blue-500" />
                                                        ) : contact.platform?.toUpperCase() === 'INSTAGRAM' ? (
                                                            <Instagram className="h-3.5 w-3.5 text-[#E1306C]" />
                                                        ) : contact.platform?.toUpperCase() === 'FACEBOOK' ? (
                                                            <Facebook className="h-3.5 w-3.5 text-[#1877F2] fill-[#1877F2]" />
                                                        ) : contact.platform?.toUpperCase() === 'TIKTOK' ? (
                                                            <Music2 className="h-3.5 w-3.5 text-slate-800 dark:text-gray-450" />
                                                        ) : (
                                                            <div className="h-3.5 w-3.5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                                                                <svg className="h-2 w-2 text-white fill-white" viewBox="0 0 24 24">
                                                                    <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.04 15.04 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .25-1.02A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Name, Message and Unread Details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5 gap-1.5">
                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <h3 className="font-bold truncate text-[13.5px] text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
                                                                    {contact.name || contact.whatsappName || contact.waId}
                                                                </h3>
                                                                {isContactHandledByAi(contact) && (
                                                                    <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[8px] font-black rounded-full flex items-center gap-0.5 shrink-0">
                                                                        <Sparkles className="w-2.5 h-2.5" /> AI
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {contact.name && (
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-medium truncate mt-0.5">
                                                                    {contact.platform?.toUpperCase() === 'INSTAGRAM'
                                                                        ? ((contact.customAttributes as any)?.username ? `@${(contact.customAttributes as any).username}` : `IG: ${contact.waId}`)
                                                                        : contact.platform?.toUpperCase() === 'FACEBOOK'
                                                                            ? `FB: ${contact.waId}`
                                                                            : contact.waId?.startsWith('web_')
                                                                                ? 'Web Visitor'
                                                                                : `+${contact.waId}`}
                                                                </span>
                                                            )}
                                                            {/* Contact Assigned Label Badges */}
                                                            {contact.tags && contact.tags.length > 0 && (
                                                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                                    {contact.tags.slice(0, 3).map((tag) => (
                                                                        <span
                                                                            key={tag.id}
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-extrabold text-white shadow-xs max-w-[95px] truncate"
                                                                            style={{ backgroundColor: tag.color || '#10b981' }}
                                                                            title={tag.name}
                                                                        >
                                                                            <Tag className="w-2.5 h-2.5 shrink-0 opacity-90" />
                                                                            <span className="truncate">{tag.name}</span>
                                                                        </span>
                                                                    ))}
                                                                    {contact.tags.length > 3 && (
                                                                        <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                                            +{contact.tags.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                                                            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-550 leading-none">
                                                                {format12HourTime(contact.lastMessageAt)}
                                                            </span>
                                                            {contact.unreadCount > 0 && (
                                                                <span className="min-w-4.5 h-4.5 px-1 bg-[#00B074] text-white text-[9px] font-black flex items-center justify-center rounded-full animate-in zoom-in shadow-sm shadow-emerald-500/20">
                                                                    {contact.unreadCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 truncate pr-2 font-medium">
                                                        {contact.lastMessage?.trim().toLowerCase() === '[revoke]' || contact.lastMessage?.trim().toLowerCase() === '[protocol]' ? (
                                                            <span className="text-rose-500 dark:text-rose-400 font-semibold italic inline-flex items-center gap-1">
                                                                <Ban className="w-3 h-3 text-rose-500 shrink-0" />
                                                                This message was deleted
                                                            </span>
                                                        ) : (
                                                            contact.lastMessage || "Start a conversation"
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Load More Conversations Button - Styled exactly like mockup image */}
                                        {activeTabCount > contacts.length && filteredContacts.length > 0 && (
                                            <div className="p-4 flex items-center justify-center bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800/40">
                                                <button
                                                    onClick={() => setVisibleContactsCount(prev => prev + 10)}
                                                    className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-slate-100 dark:border-slate-800 cursor-pointer shadow-sm active:scale-[0.98] select-none"
                                                >
                                                    <span>{t('loadMoreConversations')}</span>
                                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 animate-bounce" style={{ animationDuration: '1.8s' }} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Middle and Right Column - Chat Area & Profile */}
                    <div className={cn(
                        "flex flex-1 min-w-0 h-full relative",
                        !selectedContact ? 'hidden md:flex' : 'flex'
                    )}>
                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0c1317] relative">
                            {/* Background Pattern */}
                            <div
                                className="absolute inset-0 z-0 opacity-[0.35] dark:opacity-[0.1] pointer-events-none"
                                style={{
                                    backgroundImage: 'url("/watsapp%20background.jpg")',
                                    backgroundSize: '380px',
                                    backgroundRepeat: 'repeat'
                                }}
                            ></div>

                            {selectedContact ? (
                                <>
                                    {/* Chat Header - Styled exactly like mockup image */}
                                    <div className="shrink-0 h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20 shadow-sm relative">
                                        <div className="flex items-center gap-2.5 sm:gap-4">
                                            <Button variant="ghost" size="icon" className="md:hidden -ml-2 h-9 w-9 rounded-full text-slate-500 dark:text-slate-400" onClick={(e) => { e.stopPropagation(); setSelectedContact(null); }}>
                                                <ArrowLeft className="w-5 h-5" />
                                            </Button>

                                            <div
                                                className="flex items-center gap-2 sm:gap-3.5 min-w-0 cursor-pointer group/header"
                                                onClick={() => setIsProfileOpen(true)}
                                            >
                                                <div className="relative">
                                                    <ChatAvatar contact={selectedContact} className="h-11 w-11 sm:h-12 sm:w-12 border border-slate-100 dark:border-slate-800 group-hover/header:scale-105 transition-transform" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h3 title={selectedContact?.name || selectedContact?.whatsappName || selectedContact?.waId || ''} className="font-bold text-[15px] sm:text-[16px] text-slate-800 dark:text-slate-100 truncate group-hover/header:underline decoration-slate-400 underline-offset-2 max-w-[220px] sm:max-w-[340px]">
                                                            {(() => {
                                                                const rawName = selectedContact?.name || selectedContact?.whatsappName || selectedContact?.waId || '';
                                                                return rawName.length > 5 ? `${rawName.substring(0, 5)}...` : rawName;
                                                            })()}
                                                        </h3>
                                                        <button
                                                            onClick={handleOpenEditName}
                                                            title="Edit contact name"
                                                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <div className="flex items-center gap-1">
                                                            {(selectedContact.customAttributes as any)?.channel === 'website_widget' || selectedContact.waId?.startsWith('web_') ? (
                                                                <>
                                                                    <Globe className="w-4 h-4 text-blue-500" />
                                                                    <span className="text-xs text-blue-600 font-semibold dark:text-blue-400">Website Widget</span>
                                                                </>
                                                            ) : selectedContact.platform?.toUpperCase() === 'INSTAGRAM' ? (
                                                                <>
                                                                    <Instagram className="w-4 h-4 text-[#E1306C]" />
                                                                    <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">{t('instagram')}</span>
                                                                </>
                                                            ) : selectedContact.platform?.toUpperCase() === 'FACEBOOK' ? (
                                                                <>
                                                                    <Facebook className="w-4 h-4 text-[#1877F2] fill-[#1877F2]" />
                                                                    <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">{t('facebook')}</span>
                                                                </>
                                                            ) : selectedContact.platform?.toUpperCase() === 'TIKTOK' ? (
                                                                <>
                                                                    <Music2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                                                                    <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">{t('tiktok')}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-4 h-4 text-emerald-500 fill-current" viewBox="0 0 24 24">
                                                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.528 2.016 14.053 1.01 11.99 1.01c-5.438 0-9.863 4.37-9.868 9.8-.001 1.77.463 3.5 1.34 5.023l-.963 3.515 3.61-.934zm9.324-5.69c-.26-.13-1.536-.759-1.773-.846-.237-.087-.41-.13-.58.13-.172.26-.666.846-.818 1.02-.152.173-.304.195-.563.065-.26-.13-1.097-.404-2.09-1.29-.773-.69-1.294-1.542-1.446-1.802-.152-.26-.016-.4.113-.53.117-.118.26-.304.39-.456.13-.152.173-.26.26-.433.087-.173.044-.325-.022-.456-.065-.13-.58-1.397-.795-1.916-.21-.504-.44-.434-.6-.443-.153-.008-.328-.01-.503-.01-.174 0-.457.065-.695.325-.24.26-.913.892-.913 2.174 0 1.282.933 2.518 1.063 2.69.13.173 1.837 2.805 4.45 3.934.62.268 1.105.429 1.482.548.624.199 1.192.171 1.64.103.5-.076 1.537-.628 1.753-1.235.217-.607.217-1.127.152-1.235-.065-.108-.238-.172-.497-.303z" />
                                                                    </svg>
                                                                    <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">{t('whatsapp')}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 sm:gap-3" onClick={(e) => e.stopPropagation()}>
                                            {selectedContact && (
                                                <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                                                    {selectedContactHandledByAi ? (
                                                        <>
                                                            <span className="px-2 py-1 sm:px-2.5 bg-violet-50 dark:bg-violet-900/25 text-violet-600 dark:text-violet-400 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                                <Sparkles className="w-3.5 h-3.5 animate-pulse text-violet-500" />
                                                                <span className="hidden lg:inline">Handled by AI</span>
                                                            </span>
                                                            {effectiveAiAgent && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button
                                                                            title={`${effectiveAiAgent.name} (${isUsingDefaultAiAgent ? 'default selected' : 'assigned'})`}
                                                                            disabled={isAssigningAiAgent}
                                                                            className="max-w-[100px] sm:max-w-[130px] px-2 py-1 bg-emerald-50 dark:bg-emerald-950/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full flex items-center gap-1 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                                                                        >
                                                                            <Bot className="w-3.5 h-3.5 shrink-0" />
                                                                            <span className="truncate">
                                                                                {effectiveAiAgent.name
                                                                                    ? effectiveAiAgent.name.length > 5
                                                                                        ? `${effectiveAiAgent.name.slice(0, 5)}...`
                                                                                        : effectiveAiAgent.name
                                                                                    : 'Agent'}
                                                                            </span>
                                                                            <span className="shrink-0 text-[8px] uppercase tracking-wide text-emerald-500 dark:text-emerald-400 hidden xl:inline">
                                                                                {isUsingDefaultAiAgent ? 'Default' : 'Assigned'}
                                                                            </span>
                                                                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-emerald-500/70" />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-64 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 bg-white dark:bg-slate-900 z-50 plus-jakarta-forced">
                                                                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">AI Agents</div>
                                                                        <DropdownMenuItem
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleAssignAiAgent(null);
                                                                            }}
                                                                            className={cn(
                                                                                "flex flex-col items-start gap-0.5 py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all",
                                                                                !selectedContact.aiAgentId ? "bg-violet-50 dark:bg-violet-950/20" : ""
                                                                            )}
                                                                        >
                                                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                                                {defaultAiAgent ? "Use Default Agent" : "Use Global Knowledge"}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400">
                                                                                {defaultAiAgent ? defaultAiAgent.name : "Organization default bot"}
                                                                            </span>
                                                                        </DropdownMenuItem>
                                                                        {aiAgents.map((agent: any) => (
                                                                            <DropdownMenuItem
                                                                                key={agent.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleAssignAiAgent(agent.id);
                                                                                }}
                                                                                className={cn(
                                                                                    "flex flex-col items-start gap-0.5 py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all",
                                                                                    selectedContact.aiAgentId === agent.id ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                                                                                )}
                                                                            >
                                                                                <span className="flex w-full items-center justify-between gap-2">
                                                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{agent.name}</span>
                                                                                    {selectedContact.aiAgentId === agent.id ? (
                                                                                        <span className="shrink-0 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-300">Selected</span>
                                                                                    ) : agent.isDefault ? (
                                                                                        <span className="shrink-0 text-[9px] font-black uppercase text-violet-500 dark:text-violet-300">Default</span>
                                                                                    ) : null}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{agent.aiProvider || "openai"}</span>
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={handleToggleAiBot}
                                                                disabled={isTogglingAiBot}
                                                                className="text-[10px] h-10 px-3 rounded-xl border-violet-200 dark:border-violet-800/80 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 cursor-pointer shadow-sm active:scale-[0.98] hidden sm:flex items-center gap-1"
                                                            >
                                                                <Headset className="w-3.5 h-3.5" />
                                                                <span className="hidden lg:inline">Intervene</span>
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="px-2 py-1 sm:px-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                                <Headset className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                                {selectedContactOrgAiDisabled ? (
                                                                    <span className="hidden lg:inline">AI paused globally</span>
                                                                ) : selectedContact.assignedUsers && selectedContact.assignedUsers.length > 0 ? (
                                                                    <span className="hidden lg:inline">
                                                                        {`Intervened by ${selectedContact.assignedUsers[selectedContact.assignedUsers.length - 1].name?.split(' ')[0] || selectedContact.assignedUsers[selectedContact.assignedUsers.length - 1].email?.split('@')[0] || 'Agent'}`}
                                                                    </span>
                                                                ) : (
                                                                    <span className="hidden lg:inline">Intervened</span>
                                                                )}
                                                            </span>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={handleToggleAiBot}
                                                                disabled={isTogglingAiBot}
                                                                className="text-[10px] h-10 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm active:scale-[0.98] hidden sm:flex items-center gap-1"
                                                            >
                                                                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                                                <span className="hidden lg:inline">Resume AI</span>
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {canAssignAgent && (
                                                <>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-10 text-xs font-semibold rounded-xl px-3 hidden sm:flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]" disabled={isTransferring}>
                                                                <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
                                                                <span className="hidden lg:inline">{t('assignTo')}</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 bg-white dark:bg-slate-900 z-50 plus-jakarta-forced">
                                                            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('addAgent')}</div>
                                                            {availableAgents.length > 0 ? availableAgents.map((agent: any) => {
                                                                const isAssigned = selectedContact.assignedUsers?.some(u => u.id === agent.id);
                                                                return (
                                                                    <DropdownMenuItem
                                                                        key={agent.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isAssigned) {
                                                                                handleUnassign(agent.id);
                                                                            } else {
                                                                                handleAssign(agent.id);
                                                                            }
                                                                        }}
                                                                        className={cn("flex items-center justify-between py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all", isAssigned ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "")}
                                                                    >
                                                                        <div className="flex flex-col items-start gap-0.5">
                                                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{agent.name}</span>
                                                                            <span className="text-[10px] text-slate-400">{agent.department?.name || 'No Dept'}</span>
                                                                        </div>
                                                                        {isAssigned && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                                                    </DropdownMenuItem>
                                                                );
                                                            }) : (
                                                                <div className="px-2 py-4 text-center text-xs text-slate-400">No agents available</div>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    {!selectedContactHandledByAi && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-10 text-xs font-semibold rounded-xl px-2 sm:px-3 hidden sm:flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] max-w-[120px] md:max-w-[140px]" disabled={isAssigningAiAgent}>
                                                                    <Bot className="w-4 h-4 text-slate-400 shrink-0" />
                                                                    <span className="truncate hidden lg:inline">
                                                                        {effectiveAiAgent
                                                                            ? effectiveAiAgent.name.length > 5
                                                                                ? `${effectiveAiAgent.name.slice(0, 5)}...`
                                                                                : effectiveAiAgent.name
                                                                            : "Assign AI"}
                                                                    </span>
                                                                    {isUsingDefaultAiAgent && (
                                                                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-[8px] font-black uppercase text-violet-600 dark:text-violet-300 hidden md:inline">
                                                                            Default
                                                                        </span>
                                                                    )}
                                                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-64 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 bg-white dark:bg-slate-900 z-50 plus-jakarta-forced">
                                                                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">AI Agents</div>

                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAssignAiAgent(null);
                                                                    }}
                                                                    className={cn(
                                                                        "flex flex-col items-start gap-0.5 py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all",
                                                                        !selectedContact.aiAgentId ? "bg-violet-50 dark:bg-violet-950/20" : ""
                                                                    )}
                                                                >
                                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                                        {defaultAiAgent ? "Use Default Agent" : "Use Global Knowledge"}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {defaultAiAgent ? defaultAiAgent.name : "Organization default bot"}
                                                                    </span>
                                                                </DropdownMenuItem>
                                                                {aiAgents.map((agent: any) => (
                                                                    <DropdownMenuItem
                                                                        key={agent.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleAssignAiAgent(agent.id);
                                                                        }}
                                                                        className={cn(
                                                                            "flex flex-col items-start gap-0.5 py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all",
                                                                            selectedContact.aiAgentId === agent.id ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                                                                        )}
                                                                    >
                                                                        <span className="flex w-full items-center justify-between gap-2">
                                                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{agent.name}</span>
                                                                            {selectedContact.aiAgentId === agent.id ? (
                                                                                <span className="shrink-0 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-300">Selected</span>
                                                                            ) : agent.isDefault ? (
                                                                                <span className="shrink-0 text-[9px] font-black uppercase text-violet-500 dark:text-violet-300">Default</span>
                                                                            ) : null}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{agent.aiProvider || "openai"}</span>
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}

                                                    {/* Labels Tag Button */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-10 w-10 rounded-xl p-0 flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98] hidden lg:flex">
                                                                <Tags className="w-4.5 h-4.5 text-slate-400" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 bg-white dark:bg-slate-900 max-h-[300px] overflow-y-auto z-50">
                                                            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('manageLabels')}</div>
                                                            {availableTags.map((tag: any) => {
                                                                const isSelected = selectedContact.tags?.some((t) => t.id === tag.id);
                                                                return (
                                                                    <DropdownMenuItem
                                                                        key={tag.id}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            handleToggleTag(tag.id);
                                                                        }}
                                                                        className="flex items-center justify-between py-2.5 px-3 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all gap-2"
                                                                    >
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                                                            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">{tag.name}</span>
                                                                        </div>
                                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                                                                    </DropdownMenuItem>
                                                                );
                                                            })}
                                                            {availableTags.length === 0 && (
                                                                <div className="px-2 py-4 text-center text-xs text-slate-400">No labels found</div>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>

                                                    <DropdownMenu onOpenChange={(open) => { if (!open) setActionMenuView('main'); }}>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-10 w-10 rounded-xl p-0 flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98]">
                                                                <MoreVertical className="w-4.5 h-4.5 text-slate-400" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-32px)] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 bg-white dark:bg-slate-900 z-50 overflow-hidden">
                                                            {actionMenuView === 'main' && (
                                                                <div className="space-y-0.5 animate-in fade-in-50 duration-150">
                                                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('actionsMenu')}</div>

                                                                    {/* Mobile-only action items */}
                                                                    <div className="sm:hidden space-y-0.5">
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                handleToggleAiBot();
                                                                            }}
                                                                            className={cn(
                                                                                "py-2.5 px-3 cursor-pointer rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 select-none text-slate-700 dark:text-slate-200",
                                                                                isTogglingAiBot ? "opacity-50 pointer-events-none" : ""
                                                                            )}
                                                                        >
                                                                            {selectedContactOrgAiDisabled ? (
                                                                                <>
                                                                                    <Sparkles className="w-4 h-4 text-violet-500" />
                                                                                    <span>Resume AI</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Headset className="w-4 h-4 text-slate-500" />
                                                                                    <span>Pause AI / Intervene</span>
                                                                                </>
                                                                            )}
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('assign');
                                                                            }}
                                                                            className="py-2.5 px-3 cursor-pointer rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 select-none text-slate-700 dark:text-slate-200"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <UserPlus className="w-4 h-4 text-slate-400" />
                                                                                <span>Assign To</span>
                                                                            </div>
                                                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                        </DropdownMenuItem>

                                                                        {!selectedContactHandledByAi && (
                                                                            <DropdownMenuItem
                                                                                onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('ai-agent');
                                                                            }}
                                                                            className="py-2.5 px-3 cursor-pointer rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 select-none text-slate-700 dark:text-slate-200"
                                                                        >
                                                                                <div className="flex items-center gap-2">
                                                                                    <Bot className="w-4 h-4 text-slate-400" />
                                                                                    <span>Assign AI Agent</span>
                                                                                </div>
                                                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </div>

                                                                    <div className="lg:hidden">
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('labels');
                                                                            }}
                                                                            className="py-2.5 px-3 cursor-pointer rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 select-none text-slate-700 dark:text-slate-200"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <Tags className="w-4 h-4 text-slate-400" />
                                                                                <span>Labels</span>
                                                                            </div>
                                                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                        </DropdownMenuItem>
                                                                    </div>

                                                                    <DropdownMenuItem
                                                                        onSelect={(e) => {
                                                                            e.preventDefault();
                                                                            setActionMenuView('webhooks');
                                                                        }}
                                                                        className="py-2.5 px-3 cursor-pointer rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 select-none text-slate-700 dark:text-slate-200"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <Webhook className="w-4 h-4 text-emerald-500" />
                                                                            <span>Webhook Automation</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={cn(
                                                                                "px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider",
                                                                                !(selectedContact.isWebhookEnabled ?? true)
                                                                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                                                                    : (selectedContact.disabledWebhookIds && selectedContact.disabledWebhookIds.length > 0)
                                                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                                                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                                                            )}>
                                                                                {!(selectedContact.isWebhookEnabled ?? true)
                                                                                    ? "Disabled"
                                                                                    : (selectedContact.disabledWebhookIds && selectedContact.disabledWebhookIds.length > 0)
                                                                                        ? "Partial"
                                                                                        : "Enabled"}
                                                                            </span>
                                                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                        </div>
                                                                    </DropdownMenuItem>

                                                                    {selectedContact.assignedUsers && selectedContact.assignedUsers.length > 0 && (
                                                                        <DropdownMenuItem
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleUnassign(null);
                                                                            }}
                                                                            className="py-2.5 px-3 cursor-pointer rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-medium text-sm transition-all"
                                                                        >
                                                                            Unassign Agents
                                                                        </DropdownMenuItem>
                                                                    )}

                                                                    {selectedContact.unreadCount === 0 && (
                                                                        <DropdownMenuItem
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const updatedContacts = contacts.map(c =>
                                                                                    c.id === selectedContact.id ? { ...c, unreadCount: 1 } : c
                                                                                );
                                                                                const updatedTabCounts = {
                                                                                    ...tabCounts,
                                                                                    unread: tabCounts.unread + 1
                                                                                };

                                                                                setContacts(updatedContacts);
                                                                                setTabCounts(updatedTabCounts);
                                                                                setSelectedContact(prev => prev ? { ...prev, unreadCount: 1 } : null);

                                                                                mutateContacts({
                                                                                    contacts: updatedContacts,
                                                                                    tabCounts: updatedTabCounts
                                                                                }, { revalidate: false });

                                                                                // Call server action to persist in DB
                                                                                markMessagesAsUnread(selectedContact.id)
                                                                                    .then(() => mutateContacts())
                                                                                    .catch((err) => {
                                                                                        console.error('Failed to mark as unread:', err);
                                                                                        mutateContacts();
                                                                                    });
                                                                            }}
                                                                            className="py-2.5 px-3 cursor-pointer rounded-xl text-slate-700 dark:text-slate-200 font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                        >
                                                                            Mark as Unread
                                                                        </DropdownMenuItem>
                                                                    )}

                                                                    {selectedContact.isAutoCreated && (
                                                                        <DropdownMenuItem
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                try {
                                                                                                                                                                        const res = await promoteToContact(selectedContact.id);
                                                                                    if (res.success) {
                                                                                        toast.success('Contact saved to CRM');
                                                                                        setSelectedContact(prev => prev ? { ...prev, isAutoCreated: false } : null);
                                                                                    }
                                                                                } catch (err) {
                                                                                    toast.error('Failed to save contact');
                                                                                }
                                                                            }}
                                                                            className="py-2.5 px-3 cursor-pointer rounded-xl text-slate-700 dark:text-slate-200 font-medium text-sm transition-all"
                                                                        >
                                                                            Save to CRM
                                                                        </DropdownMenuItem>
                                                                    )}

                                                                    <DropdownMenuItem
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
                                                                                try {
                                                                                                                                                                        const res = await deleteChat(selectedContact.id);
                                                                                    if (res.success) {
                                                                                        toast.success('Chat deleted successfully');
                                                                                        setContacts(prev => prev.filter(c => c.id !== selectedContact.id));
                                                                                        setSelectedContact(null);
                                                                                        mutate(url => typeof url === 'string' && url.includes('/api/chat/poll?type=contacts'), undefined, { revalidate: true });
                                                                                    }
                                                                                } catch (err: any) {
                                                                                    toast.error(err.message || 'Failed to delete chat');
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="py-2.5 px-3 cursor-pointer rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-medium text-sm transition-all"
                                                                    >
                                                                        Delete Chat
                                                                    </DropdownMenuItem>
                                                                </div>
                                                            )}

                                                            {actionMenuView === 'assign' && (
                                                                <div className="space-y-1 animate-in fade-in-50 duration-150">
                                                                    <div className="flex items-center gap-1.5 px-1 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('main');
                                                                            }}
                                                                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <ArrowLeft className="w-4 h-4" />
                                                                        </DropdownMenuItem>
                                                                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200">{t('addAgent')}</span>
                                                                    </div>
                                                                    <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                                                                        {availableAgents
                                                                            .filter(agent => !selectedContact.assignedUsers?.some(u => u.id === agent.id))
                                                                            .map((agent: any) => (
                                                                                <DropdownMenuItem
                                                                                    key={agent.id}
                                                                                    onSelect={() => {
                                                                                        handleAssign(agent.id);
                                                                                        setActionMenuView('main');
                                                                                    }}
                                                                                    className="flex flex-col items-start gap-0.5 py-2 px-2.5 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none"
                                                                                >
                                                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{agent.name}</span>
                                                                                    <span className="text-[10px] text-slate-400">{agent.department?.name || 'No Dept'}</span>
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                        {availableAgents.filter(agent => !selectedContact.assignedUsers?.some(u => u.id === agent.id)).length === 0 && (
                                                                            <div className="px-2 py-4 text-center text-xs text-slate-400">All available agents assigned</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {actionMenuView === 'ai-agent' && (
                                                                <div className="space-y-1 animate-in fade-in-50 duration-150">
                                                                    <div className="flex items-center gap-1.5 px-1 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('main');
                                                                            }}
                                                                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <ArrowLeft className="w-4 h-4" />
                                                                        </DropdownMenuItem>
                                                                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200">Assign AI Agent</span>
                                                                    </div>
                                                                    <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                                                                        <DropdownMenuItem
                                                                            onSelect={() => {
                                                                                handleAssignAiAgent(null);
                                                                                setActionMenuView('main');
                                                                            }}
                                                                            className={cn(
                                                                                "flex flex-col items-start gap-0.5 py-2 px-2.5 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none",
                                                                                !selectedContact.aiAgentId ? "bg-violet-50 dark:bg-violet-950/20" : ""
                                                                            )}
                                                                        >
                                                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                                                {defaultAiAgent ? "Use Default Agent" : "Use Global Knowledge"}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400">
                                                                                {defaultAiAgent ? defaultAiAgent.name : "Organization default bot"}
                                                                            </span>
                                                                        </DropdownMenuItem>
                                                                        {aiAgents.map((agent: any) => (
                                                                            <DropdownMenuItem
                                                                                key={agent.id}
                                                                                onSelect={() => {
                                                                                    handleAssignAiAgent(agent.id);
                                                                                    setActionMenuView('main');
                                                                                }}
                                                                                className={cn(
                                                                                    "flex flex-col items-start gap-0.5 py-2 px-2.5 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all select-none",
                                                                                    selectedContact.aiAgentId === agent.id ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                                                                                )}
                                                                            >
                                                                                <span className="flex w-full items-center justify-between gap-2">
                                                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{agent.name}</span>
                                                                                    {selectedContact.aiAgentId === agent.id ? (
                                                                                        <span className="shrink-0 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-300">Selected</span>
                                                                                    ) : agent.isDefault ? (
                                                                                        <span className="shrink-0 text-[9px] font-black uppercase text-violet-500 dark:text-violet-300">Default</span>
                                                                                    ) : null}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{agent.aiProvider || "openai"}</span>
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {actionMenuView === 'labels' && (
                                                                <div className="space-y-1 animate-in fade-in-50 duration-150">
                                                                    <div className="flex items-center gap-1.5 px-1 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('main');
                                                                            }}
                                                                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <ArrowLeft className="w-4 h-4" />
                                                                        </DropdownMenuItem>
                                                                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200">{t('manageLabels')}</span>
                                                                    </div>
                                                                    <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                                                                        {availableTags.map((tag: any) => {
                                                                            const isSelected = selectedContact.tags?.some((t) => t.id === tag.id);
                                                                            return (
                                                                                <DropdownMenuItem
                                                                                    key={tag.id}
                                                                                    onSelect={(e) => {
                                                                                        e.preventDefault();
                                                                                        handleToggleTag(tag.id);
                                                                                    }}
                                                                                    className="flex items-center justify-between py-2 px-2.5 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all gap-2 select-none"
                                                                                >
                                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                                                                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">{tag.name}</span>
                                                                                    </div>
                                                                                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                                                                </DropdownMenuItem>
                                                                            );
                                                                        })}
                                                                        {availableTags.length === 0 && (
                                                                            <div className="px-2 py-4 text-center text-xs text-slate-400">No labels found</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {actionMenuView === 'webhooks' && (
                                                                <div className="space-y-1 animate-in fade-in-50 duration-150">
                                                                    <div className="flex items-center gap-1.5 px-1 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                setActionMenuView('main');
                                                                            }}
                                                                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <ArrowLeft className="w-4 h-4" />
                                                                        </DropdownMenuItem>
                                                                        <span className="font-bold text-xs text-slate-700 dark:text-slate-200">Webhook Automation</span>
                                                                    </div>
                                                                    <div className="max-h-[280px] overflow-y-auto space-y-0.5">
                                                                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Master Switch</div>
                                                                        <DropdownMenuItem
                                                                            onSelect={(e) => {
                                                                                e.preventDefault();
                                                                                handleToggleSpecificWebhook('all');
                                                                            }}
                                                                            className={cn(
                                                                                "flex items-center justify-between py-2 px-2.5 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs select-none",
                                                                                isTogglingWebhook ? "opacity-50 pointer-events-none" : ""
                                                                            )}
                                                                        >
                                                                            <span>All Webhooks</span>
                                                                            <span className={cn(
                                                                                "px-2 py-0.5 text-[9px] font-black rounded-full uppercase",
                                                                                (selectedContact.isWebhookEnabled ?? true) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                                                            )}>
                                                                                {(selectedContact.isWebhookEnabled ?? true) ? "ENABLED" : "DISABLED"}
                                                                            </span>
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuSeparator className="my-1" />

                                                                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Webhooks List</div>
                                                                        {availableWebhooks.length === 0 ? (
                                                                            <div className="px-3 py-2 text-xs italic text-slate-400">No configured webhooks</div>
                                                                        ) : (
                                                                            availableWebhooks.map((wh) => {
                                                                                const isMasterOn = selectedContact.isWebhookEnabled ?? true;
                                                                                const isThisDisabled = selectedContact.disabledWebhookIds?.includes(wh.id);
                                                                                const isTargetOn = isMasterOn && !isThisDisabled;

                                                                                return (
                                                                                    <DropdownMenuItem
                                                                                        key={wh.id}
                                                                                        onSelect={(e) => {
                                                                                            e.preventDefault();
                                                                                            handleToggleSpecificWebhook(wh.id);
                                                                                        }}
                                                                                        className={cn(
                                                                                            "flex items-center justify-between py-2 px-2.5 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all gap-2 select-none",
                                                                                            (!isMasterOn || isTogglingWebhook) ? "opacity-50 pointer-events-none" : ""
                                                                                        )}
                                                                                    >
                                                                                        <div className="flex flex-col min-w-0 pr-2">
                                                                                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">{wh.name}</span>
                                                                                            {wh.targetUrl && (
                                                                                                <span className="text-[9px] text-slate-400 truncate max-w-[130px]">{wh.targetUrl}</span>
                                                                                            )}
                                                                                        </div>
                                                                                        <span className={cn(
                                                                                            "px-1.5 py-0.5 text-[8.5px] font-black rounded-md uppercase shrink-0",
                                                                                            isTargetOn
                                                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                                                                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                                                                        )}>
                                                                                            {isTargetOn ? "ON" : "OFF"}
                                                                                        </span>
                                                                                    </DropdownMenuItem>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </>
                                            )}

                                            <Button
                                                variant="outline"
                                                className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 h-10 w-10 rounded-xl p-0 hidden md:flex items-center justify-center cursor-pointer shadow-sm active:scale-[0.98] hover:text-rose-500 hover:border-rose-200 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); setSelectedContact(null); }}
                                                title="Close Chat"
                                            >
                                                <X className="w-4.5 h-4.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {selectedContact && (
                                        <WindowStatusBanner
                                            contact={selectedContact}
                                            onOpenTemplateModal={() => setIsTemplateDialogOpen(true)}
                                            canReplyChat={canReplyChat}
                                        />
                                    )}


                                    {/* Messages Area - WhatsApp-style background + pattern */}
                                    <div className="flex-1 min-h-0 overflow-hidden relative z-10">
                                        {/* Chat Background Pattern */}
                                        <div
                                            className="absolute inset-0 z-0 opacity-[0.45] dark:opacity-[0.08] pointer-events-none"
                                            style={{
                                                backgroundImage: 'url(/whatsapp-chat-bg.png)',
                                                backgroundSize: '360px',
                                                backgroundRepeat: 'repeat'
                                            }}
                                        />

                                        {messageQuota && !messageQuota.allowed && (
                                            <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/15 backdrop-blur-[6px] z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 pointer-events-auto select-none">
                                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                                                    <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 shadow-md">
                                                        <Lock className="w-8 h-8" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Chat Locked</h3>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                                            You have used {messageQuota.current}/{messageQuota.limit} messages. Upgrade your subscription plan to unlock and view your chat messages.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div
                                            ref={scrollContainerRef}
                                            className="h-full overflow-y-auto relative z-10 custom-scrollbar"
                                        >
                                            <div className="p-4 md:p-10 lg:p-12 space-y-6 relative z-10 w-full max-w-screen-2xl mx-auto">
                                                {isLoadingMessages || (selectedContact && messagesContactIdRef.current !== selectedContact.id) ? (
                                                    <div className="flex flex-col items-center justify-center p-12 space-y-3 my-auto h-full text-center">
                                                        <Loader2 className="w-7 h-7 animate-spin text-[#00a884]" />
                                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Loading conversation...</p>
                                                    </div>
                                                ) : (() => {
                                                    // Map any standalone reaction messages (from DB or poll) to their target wamid
                                                    const reactionMap = new Map<string, Array<{ emoji: string; fromMe?: boolean; sender?: string }>>();
                                                    messages.forEach(m => {
                                                        const raw = m.rawBody || {};
                                                        const reactionObj = raw.message?.reactionMessage || raw.reaction;
                                                        const isReaction = m.type === 'reaction' || Boolean(reactionObj) || (m.content === '[Message]' && Boolean(raw.message?.reactionMessage));

                                                        if (isReaction && reactionObj) {
                                                            const targetWamid = reactionObj.key?.id || reactionObj.message_id;
                                                            const emoji = reactionObj.text || reactionObj.emoji;
                                                            if (targetWamid && emoji) {
                                                                const list = reactionMap.get(targetWamid) || [];
                                                                list.push({ emoji, fromMe: m.direction === 'outbound' });
                                                                reactionMap.set(targetWamid, list);
                                                            }
                                                        }
                                                    });

                                                    const visibleMessages = messages.filter(m => {
                                                        if (m.type === 'internal_log') return false;
                                                        const raw = m.rawBody || {};
                                                        if (m.type === 'reaction') return false;
                                                        if (m.content === '[Message]' && Boolean(raw.message?.reactionMessage)) return false;
                                                        if (m.content?.startsWith('[Reaction:') && !m.mediaUrl) return false;
                                                        return true;
                                                    });
                                                    const getMessageDateString = (dateInput: Date | string) => {
                                                        const d = new Date(dateInput);
                                                        const today = new Date();
                                                        const yesterday = new Date();
                                                        yesterday.setDate(today.getDate() - 1);

                                                        if (d.toDateString() === today.toDateString()) {
                                                            return "Today";
                                                        } else if (d.toDateString() === yesterday.toDateString()) {
                                                            return "Yesterday";
                                                        } else {
                                                            return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
                                                        }
                                                    };

                                                    const getInterventionTimeString = (dateInput: Date | string) => {
                                                        const d = new Date(dateInput);
                                                        const today = new Date();
                                                        const yesterday = new Date();
                                                        yesterday.setDate(today.getDate() - 1);
                                                        const msgTime = format12HourTime(d);

                                                        if (d.toDateString() === today.toDateString()) {
                                                            return `Today at ${msgTime}`;
                                                        } else if (d.toDateString() === yesterday.toDateString()) {
                                                            return `Yesterday at ${msgTime}`;
                                                        } else {
                                                            const diffTime = today.getTime() - d.getTime();
                                                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                                            if (diffDays > 0 && diffDays < 7) {
                                                                const weekday = d.toLocaleDateString([], { weekday: 'long' });
                                                                return `${weekday} at ${msgTime}`;
                                                            }
                                                            const formattedDate = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                                                            return `on ${formattedDate} at ${msgTime}`;
                                                        }
                                                    };

                                                    const interventionAgentName = selectedContact ? (
                                                        selectedContact.assignedUsers?.map(u => u.name || u.email).filter(Boolean).join(', ') ||
                                                        messages.find(m => m.direction === 'outbound' && m.sender?.name)?.sender?.name ||
                                                        messages.find(m => m.direction === 'outbound' && m.sender?.email)?.sender?.email ||
                                                        'Agent'
                                                    ) : 'Agent';

                                                    return visibleMessages.map((msg, idx) => {
                                                        const isOutbound = msg.direction === 'outbound';
                                                        const showAvatar = !isOutbound && (idx === 0 || visibleMessages[idx - 1].direction === 'outbound');

                                                        const isAgentMessage = isOutbound && (msg.senderId || msg.sender);
                                                        let showInterventionLabel = false;
                                                        let msgInterventionLabelText = '';

                                                        if (isAgentMessage) {
                                                            let isFirstOfBlock = true;
                                                            for (let i = idx - 1; i >= 0; i--) {
                                                                if (visibleMessages[i].direction === 'outbound') {
                                                                    if (visibleMessages[i].senderId || visibleMessages[i].sender) {
                                                                        isFirstOfBlock = false;
                                                                    }
                                                                    break;
                                                                }
                                                            }
                                                            if (isFirstOfBlock) {
                                                                showInterventionLabel = true;
                                                                const senderName = msg.sender?.name || msg.sender?.email || interventionAgentName;
                                                                msgInterventionLabelText = `Intervened by ${senderName} ${getInterventionTimeString(msg.createdAt)}`;
                                                            }
                                                        }

                                                        const msgDate = new Date(msg.createdAt).toDateString();
                                                        const prevMsgDate = idx > 0 ? new Date(visibleMessages[idx - 1].createdAt).toDateString() : null;
                                                        const showDateSeparator = msgDate !== prevMsgDate;

                                                        return (
                                                            <div key={msg.id} className="w-full flex flex-col gap-4">
                                                                {showDateSeparator && (
                                                                    <div className="flex justify-center my-4 w-full animate-in fade-in slide-in-from-top-1 duration-300">
                                                                        <div className="bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[10.5px] font-bold px-3 py-1.5 rounded-xl shadow-sm border border-slate-100/50 dark:border-slate-800/80 uppercase tracking-wider select-none">
                                                                            {getMessageDateString(msg.createdAt)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {showInterventionLabel && (
                                                                    <div className="flex justify-center w-full">
                                                                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-[85%] text-center shadow-sm">
                                                                            {msgInterventionLabelText}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div
                                                                    id={`msg-${msg.id}`}
                                                                    className={cn(
                                                                        "flex group animate-in fade-in slide-in-from-bottom-2 duration-300 items-center gap-1.5 transition-all duration-300 rounded-2xl",
                                                                        isOutbound ? 'justify-end' : 'justify-start items-end gap-2'
                                                                    )}
                                                                >
                                                                    {!isOutbound && (
                                                                        <div className="w-8 h-8 shrink-0">
                                                                            {showAvatar ? (
                                                                                <ChatAvatar contact={selectedContact} className="h-8 w-8 text-[10px] border border-gray-200 dark:border-slate-700" />
                                                                            ) : <div className="w-8" />}
                                                                        </div>
                                                                    )}
                                                                    {/* Message Hover Action Bar (Reply, Forward, Delete) */}
                                                                    <div className={cn(
                                                                        "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 self-center bg-white/90 dark:bg-[#111b21]/90 backdrop-blur-sm p-0.5 rounded-lg border border-black/5 dark:border-white/10 shadow-sm z-10",
                                                                        isOutbound ? "order-first mr-1" : "order-last ml-1"
                                                                    )}>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setReplyingToMessage(msg);
                                                                            }}
                                                                            title="Reply to message"
                                                                            className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                                                        >
                                                                            <CornerUpLeft className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setForwardingMessage(msg);
                                                                                setIsForwardModalOpen(true);
                                                                            }}
                                                                            title="Forward message"
                                                                            className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                                                        >
                                                                            <CornerUpRight className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        {isOutbound && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteMessage(msg.id);
                                                                                }}
                                                                                title="Delete message from CRM"
                                                                                className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        className={cn(
                                                                            "max-w-[75%] min-w-0 overflow-visible break-words [overflow-wrap:anywhere] [word-break:break-word] shadow-sm relative border",
                                                                            ((msg.rawBody?.interactive || msg.rawBody?.template || msg.type === 'template' || msg.type === 'interactive') && !(['image', 'video', 'audio', 'voice', 'document', 'sticker'].includes(msg.type || '')))
                                                                                ? "bg-transparent border-none shadow-none px-0 py-0"
                                                                                : cn(
                                                                                    isOutbound
                                                                                        ? 'bg-chat-bubble-outgoing text-slate-900 dark:text-slate-100 rounded-2xl rounded-tr-none border-black/5 dark:border-none'
                                                                                        : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-none border-black/5 dark:border-white/5',
                                                                                    ['image', 'video', 'sticker', 'audio', 'voice'].includes(msg.type || '') ? 'p-1.5' : 'px-4 py-2.5'
                                                                                )
                                                                        )}
                                                                    >
                                                                        {/* Native Quoted Reply Block */}
                                                                        {(msg.replyToId || msg.replyToWaId || msg.replyPreview) && (
                                                                            <div
                                                                                onClick={() => {
                                                                                    const targetId = msg.replyToId;
                                                                                    if (targetId) {
                                                                                        const el = document.getElementById(`msg-${targetId}`);
                                                                                        if (el) {
                                                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                            el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-4');
                                                                                            setTimeout(() => {
                                                                                                el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-4');
                                                                                            }, 2000);
                                                                                            return;
                                                                                        }
                                                                                    }
                                                                                    toast.info("Original message unavailable.");
                                                                                }}
                                                                                className={cn(
                                                                                    "mb-2 p-2 rounded-xl cursor-pointer transition-all border-l-4 select-none",
                                                                                    isOutbound
                                                                                        ? "bg-black/20 dark:bg-black/35 border-emerald-300 dark:border-emerald-400 hover:bg-black/30"
                                                                                        : "bg-slate-100 dark:bg-slate-800/90 border-emerald-500 dark:border-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                                                                                )}
                                                                            >
                                                                                <div className={cn(
                                                                                    "flex items-center gap-1 text-[11.5px] font-extrabold tracking-wide",
                                                                                    isOutbound ? "text-emerald-200 dark:text-emerald-300" : "text-emerald-600 dark:text-emerald-400"
                                                                                )}>
                                                                                    <span>{msg.replySenderName || (msg.direction === 'outbound' ? 'You' : (selectedContact?.name || selectedContact?.waId || 'Contact'))}</span>
                                                                                </div>
                                                                                <div className={cn(
                                                                                    "flex items-center gap-1.5 text-xs mt-0.5 font-medium truncate",
                                                                                    isOutbound ? "text-white/90 dark:text-slate-100" : "text-slate-700 dark:text-slate-200"
                                                                                )}>
                                                                                    {msg.replyMessageType === 'image' || msg.replyMessageType === 'sticker' ? (
                                                                                        <ImageIcon className={cn("w-3.5 h-3.5 shrink-0", isOutbound ? "text-emerald-200" : "text-emerald-500")} />
                                                                                    ) : msg.replyMessageType === 'video' ? (
                                                                                        <Video className={cn("w-3.5 h-3.5 shrink-0", isOutbound ? "text-emerald-200" : "text-emerald-500")} />
                                                                                    ) : msg.replyMessageType === 'audio' || msg.replyMessageType === 'voice' ? (
                                                                                        <Mic className={cn("w-3.5 h-3.5 shrink-0", isOutbound ? "text-emerald-200" : "text-emerald-500")} />
                                                                                    ) : msg.replyMessageType === 'document' ? (
                                                                                        <FileText className={cn("w-3.5 h-3.5 shrink-0", isOutbound ? "text-emerald-200" : "text-emerald-500")} />
                                                                                    ) : msg.replyMessageType === 'contact' ? (
                                                                                        <User className={cn("w-3.5 h-3.5 shrink-0", isOutbound ? "text-emerald-200" : "text-emerald-500")} />
                                                                                    ) : (
                                                                                        <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", isOutbound ? "text-emerald-200" : "text-emerald-500")} />
                                                                                    )}
                                                                                    <span className="truncate">{msg.replyPreview || "Original message unavailable"}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {(msg.status === 'revoked' || msg.rawBody?.isRevoked) && (
                                                                            <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-bold italic text-[11px] px-1 pt-1 pb-1.5 border-b border-rose-200/40 dark:border-rose-900/40 mb-1 select-none">
                                                                                <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                                                                <span>This message was deleted by sender</span>
                                                                            </div>
                                                                        )}
                                                                        {(msg.type === 'audio' || msg.type === 'voice' || isVoiceMessage(msg)) ? (() => {
                                                                            const audioUrl = getAudioMediaUrl(msg);
                                                                            const isVoice = isVoiceMessage(msg);
                                                                            const hasTranscription = msg.content &&
                                                                                msg.content.toLowerCase() !== '[audio]' &&
                                                                                msg.content.toLowerCase() !== '[voice message]' &&
                                                                                msg.content.toLowerCase() !== '[voice]' &&
                                                                                msg.content.toLowerCase() !== 'voice message' &&
                                                                                !msg.content.startsWith('http://') &&
                                                                                !msg.content.startsWith('https://') &&
                                                                                !msg.content.startsWith('/api/media/');

                                                                            if (isVoice) {
                                                                                return (
                                                                                    <div className="flex flex-col">
                                                                                        <WhatsAppVoicePlayer
                                                                                            messageId={msg.id}
                                                                                            mediaUrl={getProxiedUrl(audioUrl)}
                                                                                            isOutbound={isOutbound}
                                                                                        />
                                                                                        {hasTranscription && (
                                                                                            <p className={cn(
                                                                                                "text-[13.5px] px-3 py-1.5 whitespace-pre-wrap break-words border-t border-black/5 dark:border-white/5 mt-0.5",
                                                                                                isOutbound ? "text-slate-800 dark:text-slate-100 font-medium" : "text-gray-800 dark:text-gray-200 font-medium"
                                                                                            )}>
                                                                                                {msg.content}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            } else {
                                                                                const audioName = getAudioFilename(msg, msg.content || 'Audio Attachment');
                                                                                return (
                                                                                    <NormalAudioPlayer
                                                                                        messageId={msg.id}
                                                                                        mediaUrl={getProxiedUrl(audioUrl)}
                                                                                        filename={audioName}
                                                                                        isOutbound={isOutbound}
                                                                                    />
                                                                                );
                                                                            }
                                                                        })() : (msg.type === 'image' || msg.type === 'sticker') ? (
                                                                            <ChatImageBubble
                                                                                msg={msg}
                                                                                isOutbound={isOutbound}
                                                                                selectedContact={selectedContact}
                                                                                onOpenLightbox={(url, type, caption, senderName, timestamp) => {
                                                                                    handleOpenLightbox(url, type, caption, senderName, timestamp);
                                                                                }}
                                                                                onDownload={downloadMedia}
                                                                                formatTime={format12HourTime}
                                                                                getProxiedUrl={getProxiedUrl}
                                                                            />
                                                                        ) : msg.type === 'video' ? (
                                                                            <ChatVideoBubble
                                                                                msg={msg}
                                                                                isOutbound={isOutbound}
                                                                                selectedContact={selectedContact}
                                                                                onOpenLightbox={(url, type, caption, senderName, timestamp) => {
                                                                                    handleOpenLightbox(url, type, caption, senderName, timestamp);
                                                                                }}
                                                                                onDownload={downloadMedia}
                                                                                formatTime={format12HourTime}
                                                                                getProxiedUrl={getProxiedUrl}
                                                                            />
                                                                        ) : msg.type === 'document' ? (
                                                                            <ChatDocumentBubble
                                                                                msg={msg}
                                                                                isOutbound={isOutbound}
                                                                                getProxiedUrl={getProxiedUrl}
                                                                            />
                                                                        ) : (msg.type === 'unsupported' || msg.content?.startsWith('[Unsupported:')) ? (
                                                                            <UnsupportedMessageBubble msg={msg} />
                                                                        ) : (msg.rawBody?.interactive || msg.rawBody?.reaction || msg.rawBody?.template || msg.type === 'template' || msg.type === 'interactive' || msg.type === 'reaction' || msg.type === 'text') ? (
                                                                            <InteractiveMessageRenderer
                                                                                msg={msg}
                                                                                isOutbound={isOutbound}
                                                                                templates={templates}
                                                                                onOpenMedia={(media) => {
                                                                                    setLightboxData(media);
                                                                                    setIsLightboxOpen(true);
                                                                                }}
                                                                            />
                                                                        ) : (
                                                                            <div className="px-3 py-1.5 w-full overflow-hidden">
                                                                                {msg.content?.trim().toLowerCase() === '[revoke]' || msg.content?.trim().toLowerCase() === '[protocol]' || msg.type === 'revoke' || msg.type === 'protocol' ? (
                                                                                    <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 font-semibold italic text-[13.5px] select-none py-0.5">
                                                                                        <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                                                                                        <span>This message was deleted</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex flex-col">
                                                                                        {(() => {
                                                                                            if (msg.content?.startsWith('📜 [Replying to ')) {
                                                                                                const match = msg.content.match(/^📜\s*\[Replying to ([^\]]+)\]:\s*"([^"]+)"\n\n([\s\S]*)$/);
                                                                                                if (match) {
                                                                                                    return (
                                                                                                        <div className="mb-1.5 p-2 bg-black/5 dark:bg-white/10 border-l-4 border-emerald-500 rounded-r-lg text-xs select-none">
                                                                                                            <div className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                                                                                                                {match[1]}
                                                                                                            </div>
                                                                                                            <div className="text-slate-600 dark:text-slate-300 truncate text-[12px] mt-0.5 font-medium">
                                                                                                                {match[2]}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    );
                                                                                                }
                                                                                            }
                                                                                            return null;
                                                                                        })()}
                                                                                        <FormattedMessageText
                                                                                            text={msg.content?.replace(/^📜\s*\[Replying to [^\]]+\]:\s*"[^"]+"\n\n/, '')}
                                                                                            className="text-[14.2px] leading-snug"
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {msg.status === 'failed' && (() => {
                                                                            const err = msg.rawBody?.errors?.[0] || msg.rawBody?.statusUpdate?.errors?.[0];
                                                                            return (
                                                                                <div className="mx-2 mt-2 p-2 bg-red-600/10 border border-red-600/20 rounded-lg flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
                                                                                    <div className="flex items-center gap-1.5 text-red-600 font-bold text-[10px] uppercase tracking-widest">
                                                                                        <ShieldAlert className="w-3.5 h-3.5" />
                                                                                        {err?.title || 'Delivery Error'}
                                                                                    </div>
                                                                                    <p className="text-[11px] text-red-500 font-bold leading-snug">
                                                                                        {err?.message || 'Message failed to send.'}
                                                                                    </p>
                                                                                    {err?.error_data?.details && (
                                                                                        <p className="text-[10px] text-red-500/80 italic font-medium border-t border-red-600/10 pt-1 mt-0.5">
                                                                                            {err.error_data.details}
                                                                                        </p>
                                                                                    )}
                                                                                    <p className="text-[9px] text-red-400 font-mono opacity-70">
                                                                                        Code: {err?.code || 'Unknown'}
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        <div className={cn(
                                                                            "text-[10px] mt-1.5 font-medium flex items-center gap-1.5 opacity-70",
                                                                            isOutbound ? 'justify-end text-slate-500 dark:text-slate-400' : 'justify-start text-slate-400'
                                                                        )}>
                                                                            {msg.rawBody?.isEdited && (
                                                                                <span className="text-[9.5px] italic font-medium text-slate-400 dark:text-slate-500 mr-1 select-none">(edited)</span>
                                                                            )}
                                                                            <span>{format12HourTime(msg.createdAt)}</span>
                                                                            {isOutbound && (
                                                                                <span className={cn(
                                                                                    "flex font-semibold text-xs leading-none",
                                                                                    msg.status === 'read' ? 'text-[#34b7f1]' :
                                                                                        msg.status === 'failed' ? 'text-rose-500' : 'text-slate-400'
                                                                                )}>
                                                                                    {msg.status === 'sending' ? <Clock className="w-3 h-3 animate-pulse" /> :
                                                                                        msg.status === 'read' ? '✓✓' :
                                                                                            msg.status === 'delivered' ? '✓✓' :
                                                                                                msg.status === 'failed' ? 'FAILED' : '✓'}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Floating WhatsApp Reaction Badge */}
                                                                        {(() => {
                                                                            const raw = msg.rawBody || {};
                                                                            const mapped = msg.wamid ? (reactionMap.get(msg.wamid) || []) : [];
                                                                            const rawList: Array<{ emoji: string; fromMe?: boolean; sender?: string }> = Array.isArray(raw.reactions)
                                                                                ? raw.reactions
                                                                                : (raw.reaction?.emoji ? [{ emoji: raw.reaction.emoji, fromMe: raw.reaction.fromMe }] : []);
                                                                            const allReactions = [...rawList, ...mapped];
                                                                            if (allReactions.length === 0) return null;

                                                                            const emojiCounts: Record<string, number> = {};
                                                                            allReactions.forEach((r) => {
                                                                                if (r?.emoji) emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
                                                                            });
                                                                            const entries = Object.entries(emojiCounts);
                                                                            if (entries.length === 0) return null;

                                                                            return (
                                                                                <div
                                                                                    className={cn(
                                                                                        "absolute -bottom-2.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white dark:bg-[#1f2c34] border border-black/10 dark:border-white/10 shadow-sm text-[12px] z-20 select-none transition-transform hover:scale-110 cursor-default",
                                                                                        isOutbound ? "right-2" : "left-2"
                                                                                    )}
                                                                                    title={allReactions.map((r) => r.emoji).join(' ')}
                                                                                >
                                                                                    <div className="flex items-center -space-x-1">
                                                                                        {entries.slice(0, 3).map(([emoji]) => (
                                                                                            <span key={emoji} className="leading-none">{emoji}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                    {allReactions.length > 1 && (
                                                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold pl-0.5">
                                                                                            {allReactions.length}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    {!isOutbound && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteMessage(msg.id);
                                                                            }}
                                                                            title="Delete message from CRM"
                                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 self-center"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                                <div ref={messagesEndRef} />
                                            </div>
                                        </div>

                                        {/* Floating Scroll Button */}
                                        <div className="absolute bottom-4 right-6 z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            className="h-10 w-10 rounded-full shadow-lg bg-white dark:bg-[#202c33] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a3942] border border-gray-200 dark:border-white/5 transition-all active:scale-95"
                                                            onClick={scrollToBottom}
                                                        >
                                                            <ChevronDown className="h-5 w-5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-xs">Scroll to bottom</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>

                                    {/* Input Area - Styled exactly like mockup image */}
                                    <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 px-4 py-1.5 z-20">
                                        {activeTab === 'history' ? (
                                            <div className="flex flex-col items-center justify-center text-center py-4 px-2">
                                                <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                                                <h3 className="text-[13px] font-bold text-slate-700 dark:text-slate-300">History Mode</h3>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm">
                                                    {isQr
                                                        ? "This conversation is in history mode. You can view past messages or reply directly."
                                                        : "This conversation has expired. You can view the chat history, but must send a template to reconnect."}
                                                </p>
                                                {!isQr && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setIsTemplateDialogOpen(true)}
                                                        className="mt-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-bold h-8 px-4 rounded-xl shadow-sm transition-all"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                                                        Send Template
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <>

                                                {messageQuota && !messageQuota.allowed && (
                                                    <div className="flex items-center justify-between bg-red-50/80 dark:bg-red-950/20 rounded-xl p-3 mb-3 border border-red-200/50 dark:border-red-900/30 animate-in slide-in-from-bottom-4 duration-500">
                                                        <div className="flex items-center gap-3">
                                                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-red-900 dark:text-red-200">Message Limit Reached</p>
                                                                <p className="text-[10px] text-red-700 dark:text-red-400 font-medium">You have used {messageQuota.current}/{messageQuota.limit} messages. Upgrade your plan to continue sending.</p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => window.location.href = '/dashboard/billing'}
                                                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold uppercase tracking-wider h-8 px-3 rounded-lg shrink-0"
                                                        >
                                                            Upgrade Plan
                                                        </Button>
                                                    </div>
                                                )}

                                                <div className={`flex flex-col gap-1 w-full max-w-screen-2xl mx-auto bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl px-3.5 pt-2 pb-1.5 ${messageQuota && !messageQuota.allowed ? 'opacity-40 pointer-events-none' : ''}`}>
                                                    {/* Quoted Reply Banner */}
                                                    {replyingToMessage && (
                                                        <div className="mb-1.5 p-2 bg-[#d9fdd3]/70 dark:bg-[#005c4b]/30 border-l-4 border-emerald-500 rounded-r-xl flex items-center justify-between shadow-xs animate-in slide-in-from-bottom-1 duration-150">
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                    <CornerUpLeft className="w-3.5 h-3.5" />
                                                                    <span>Replying to {replyingToMessage.direction === 'outbound' ? 'You' : (selectedContact?.name || selectedContact?.waId || 'Contact')}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-700 dark:text-slate-200 truncate mt-0.5 font-medium">
                                                                    {replyingToMessage.type === 'image' ? '📷 Photo' : replyingToMessage.type === 'video' ? '📹 Video' : replyingToMessage.type === 'sticker' ? '🎨 Sticker' : replyingToMessage.type === 'document' ? '📄 Document' : (replyingToMessage.content || 'Media message')}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => setReplyingToMessage(null)}
                                                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
                                                                title="Cancel reply"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        multiple
                                                        onChange={handleFileUpload}
                                                    />

                                                    <div className="w-full">
                                                        {!canReplyChat ? (
                                                            <div className="h-10 flex items-center justify-center text-xs text-slate-400 font-medium italic">
                                                                Permission denied to reply
                                                            </div>
                                                        ) : isRecording ? (
                                                            <div className="flex items-center gap-3 px-2 py-3 bg-red-50 dark:bg-red-900/10 rounded-lg w-full">
                                                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                                                <span className="text-base font-medium text-red-600 dark:text-red-400">Recording: {formatDuration(recordingDuration)}</span>
                                                            </div>
                                                        ) : (
                                                            <Textarea
                                                                ref={textareaRef}
                                                                onFocus={() => setIsInputFocused(true)}
                                                                onBlur={() => setIsInputFocused(false)}
                                                                value={newMessage}
                                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                                                                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                                        e.preventDefault();
                                                                        handleSendMessage();
                                                                    }
                                                                }}
                                                                placeholder={isQr || canSendRegular ? t('typeMessage') : t('windowClosedTemplate')}
                                                                disabled={(!isQr && !canSendRegular) || !canReplyChat || (messageQuota ? !messageQuota.allowed : false)}
                                                                className="min-h-[26px] max-h-48 !border-0 bg-transparent p-0 text-[15px] placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-100 resize-none font-normal leading-relaxed w-full !shadow-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none"
                                                                rows={1}
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Bottom Toolbar & Send Split Button Row */}
                                                    <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/80 pt-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <TooltipProvider delayDuration={300}>
                                                                {/* Emoji Button */}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                                                            onClick={() => setIsEmojiPickerOpen(true)}
                                                                        >
                                                                            <Smile className="w-5 h-5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">Emoji</TooltipContent>
                                                                </Tooltip>

                                                                {/* Attach File Button */}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                                                            onClick={() => fileInputRef.current?.click()}
                                                                            disabled={(!isQr && !canSendRegular) || isSending}
                                                                        >
                                                                            <Paperclip className="w-5 h-5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">Attach file</TooltipContent>
                                                                </Tooltip>

                                                                {/* Media Specs & Limits Info Button */}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                                                            onClick={() => setIsMediaSpecsModalOpen(true)}
                                                                        >
                                                                            <Info className="w-5 h-5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">WhatsApp API Media Limits</TooltipContent>
                                                                </Tooltip>

                                                                {/* Templates Button (Cloud API only) */}
                                                                {!isQr && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                                                                onClick={() => setIsTemplateDialogOpen(true)}
                                                                            >
                                                                                <BookTemplate className="w-5 h-5" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="top" className="text-xs">Templates</TooltipContent>
                                                                    </Tooltip>
                                                                )}

                                                                {/* Quick Replies Button */}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                                                            onClick={() => setIsQuickReplyDialogOpen(true)}
                                                                        >
                                                                            <Zap className="w-5 h-5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">Quick Replies</TooltipContent>
                                                                </Tooltip>

                                                                {/* Automation / Sparkles Button */}
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                                                            onClick={() => setIsQuickReplyDialogOpen(true)}
                                                                        >
                                                                            <Sparkles className="w-5 h-5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="top" className="text-xs">Automation</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {channels.length > 1 && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-xl text-xs font-semibold border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                                            <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                                            <span className="truncate max-w-[110px]">
                                                                                {channels.find(c => c.id === selectedChannelId)?.name || 'Select Number'}
                                                                            </span>
                                                                            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-64 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 z-[60]">
                                                                        <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Send From Channel</div>
                                                                        {channels.map(chan => (
                                                                            <DropdownMenuItem
                                                                                key={chan.id}
                                                                                onClick={() => setSelectedChannelId(chan.id)}
                                                                                className={cn(
                                                                                    "flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer text-xs font-medium transition-colors",
                                                                                    selectedChannelId === chan.id ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                                )}
                                                                            >
                                                                                <div className="flex flex-col min-w-0 pr-2">
                                                                                    <span className="font-bold truncate">{chan.name}</span>
                                                                                    <span className="text-[10px] text-slate-400 truncate">{chan.phoneNumber}</span>
                                                                                </div>
                                                                                {selectedChannelId === chan.id && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                            {!isQr && canSendRegular && (() => {
                                                                const lastInbound = [...messages].filter(m => m.direction === 'inbound').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                                                if (lastInbound) {
                                                                    const diffMs = (new Date(lastInbound.createdAt).getTime() + 24 * 60 * 60 * 1000) - Date.now();
                                                                    if (diffMs > 0) {
                                                                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                                                                        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                                                        return <span className="text-[10px] text-slate-400 font-medium mr-2 hidden sm:inline-block">Expires in {hours}h {mins}m</span>;
                                                                    }
                                                                }
                                                                return null;
                                                            })()}
                                                            {!newMessage.trim() && !isRecording && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={startRecording}
                                                                    disabled={(!isQr && !canSendRegular) || !canReplyChat || isSending || (messageQuota ? !messageQuota.allowed : false)}
                                                                    className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
                                                                >
                                                                    <Mic className="w-5 h-5" />
                                                                </Button>
                                                            )}

                                                            {isRecording && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={stopRecording}
                                                                    className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-955/10 cursor-pointer"
                                                                >
                                                                    <Square className="w-4 h-4 fill-current" />
                                                                </Button>
                                                            )}

                                                            {/* Split Green Send Button */}
                                                            {newMessage.trim() && (
                                                                <div className="flex items-center bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl shadow-sm transition-all overflow-hidden h-10 select-none">
                                                                    <button
                                                                        onClick={handleSendMessage}
                                                                        disabled={isSending || (!isQr && !canSendRegular) || !canReplyChat || (messageQuota ? !messageQuota.allowed : false)}
                                                                        className="flex items-center justify-center gap-1.5 px-4 h-full text-xs font-bold transition-all disabled:opacity-60 cursor-pointer active:scale-95"
                                                                    >
                                                                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                                    </button>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <button className="flex items-center justify-center w-7 h-full border-l border-white/20 hover:bg-white/10 transition-all cursor-pointer">
                                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-48 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2 bg-white dark:bg-slate-900 z-[60]">
                                                                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Send Options</div>
                                                                            <DropdownMenuItem onClick={handleSendMessage} className="py-2.5 px-3 cursor-pointer rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200">
                                                                                Send Message
                                                                            </DropdownMenuItem>
                                                                            {!isQr && (
                                                                                <DropdownMenuItem onClick={() => setIsTemplateDialogOpen(true)} className="py-2.5 px-3 cursor-pointer rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200">
                                                                                    Send as Template
                                                                                </DropdownMenuItem>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Template Dialogs & Emoji Pickers (Same as before) */}
                                    <Dialog open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                                        <DialogContent className="max-w-sm p-0 rounded-2xl border border-primary/10 shadow-xl overflow-hidden ">
                                            <DialogHeader className="px-4 pt-4 pb-2">
                                                <DialogTitle className="text-base font-semibold">Pick an emoji</DialogTitle>
                                                <DialogDescription className="text-xs text-muted-foreground">
                                                    Click an emoji to add it to your message
                                                </DialogDescription>
                                            </DialogHeader>
                                            <ScrollArea className="h-[280px] px-4 pb-4">
                                                <div className="grid grid-cols-10 gap-1">
                                                    {EMOJI_GRID.map((emoji, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            className="h-9 w-9 flex items-center justify-center rounded-lg text-xl hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1"
                                                            onClick={() => {
                                                                setNewMessage((prev) => prev + emoji);
                                                            }}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </DialogContent>
                                    </Dialog>

                                    <Dialog open={isTemplateDialogOpen && !isQr} onOpenChange={(open) => { if (!isQr) setIsTemplateDialogOpen(open); else setIsTemplateDialogOpen(false); }}>
                                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl font-sans">
                                            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 items-start border-b border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-[#00a884]/10 flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-[#00a884]" />
                                                    </div>
                                                    <div>
                                                        <DialogTitle className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Message Templates</DialogTitle>
                                                        <DialogDescription className="text-sm text-slate-500 font-medium">
                                                            Select a pre-approved Meta template to initiate a conversation.
                                                        </DialogDescription>
                                                    </div>
                                                </div>
                                            </DialogHeader>
                                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/30">
                                                {templates.filter((t: any) => t.status === 'APPROVED').length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in-95 duration-700">
                                                        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 rotate-3">
                                                            <FileText className="w-10 h-10 text-primary/40" />
                                                        </div>
                                                        <p className="text-slate-700 dark:text-slate-300 font-bold text-xl tracking-tight">No templates found</p>
                                                        <p className="text-sm text-slate-500/70 mt-2 font-medium">Manage templates in your Meta dashboard</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6 mt-2">
                                                        {templates.filter((t: any) => t.status === 'APPROVED').map((template) => {
                                                            const bodyComponent = template.components?.find((c: TemplateComponent) => c.type === 'BODY');
                                                            const matchCount = bodyComponent?.text?.match(/{{\d+}}/g)?.length || 0;
                                                            const paramCount = Math.max(matchCount, bodyComponent?.example?.body_text?.[0]?.length || 0);
                                                            const isSelected = selectedTemplate?.name === template.name;
                                                            return (
                                                                <div
                                                                    key={template.name}
                                                                    onClick={() => {
                                                                        if (selectedTemplate?.name !== template.name) {
                                                                            setSelectedTemplate(template);
                                                                            setTemplateParams(new Array(paramCount).fill(''));
                                                                            setTemplateHeaderMediaUrl('');
                                                                        }
                                                                    }}
                                                                    className={cn(
                                                                        "p-5 rounded-[20px] cursor-pointer transition-all duration-300 relative group border-2",
                                                                        isSelected
                                                                            ? 'border-[#00a884] bg-white dark:bg-slate-950 shadow-lg shadow-[#00a884]/10 scale-[1.01] z-10'
                                                                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-[#00a884]/30 hover:shadow-md'
                                                                    )}
                                                                >
                                                                    <div className="flex items-center justify-between mb-3 ">
                                                                        <div className="flex items-center gap-3">
                                                                            <h4 className="font-bold text-[14px] tracking-tight text-slate-800 dark:text-slate-100">{template.name}</h4>
                                                                            <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-widest h-5 border-[#00a884]/20 text-[#00a884] bg-[#00a884]/5">
                                                                                {template.language}
                                                                            </Badge>
                                                                        </div>
                                                                        {paramCount > 0 && (
                                                                            <Badge className="bg-blue-500/10 text-blue-600 text-[9px] font-semibold uppercase tracking-widest border-none h-5">
                                                                                {paramCount} Parameters
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {bodyComponent && (
                                                                        <div className="relative overflow-hidden rounded-2xl bg-[#efeae2] dark:bg-[#0c1317] p-4 border border-primary/5">
                                                                            {/* WhatsApp background for the card */}
                                                                            <div
                                                                                className="absolute inset-0 z-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none grayscale"
                                                                                style={{
                                                                                    backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/638/wallpaper-whatsapp-background.jpg")',
                                                                                    backgroundSize: '200px',
                                                                                    backgroundRepeat: 'repeat'
                                                                                }}
                                                                            />
                                                                            <div className="relative z-10 flex justify-start">
                                                                                <div className="bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 dark:border-white/5 relative max-w-[90%] overflow-hidden">
                                                                                    {/* Image Header */}
                                                                                    {(() => {
                                                                                        const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
                                                                                        if (headerComp?.format === 'IMAGE') {
                                                                                            const imageUrl = headerComp.example?.header_handle?.[0];
                                                                                            return (
                                                                                                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                                                                    {imageUrl ? (
                                                                                                        <img
                                                                                                            src={imageUrl}
                                                                                                            alt="Template Header"
                                                                                                            className="object-cover w-full h-full"
                                                                                                        />
                                                                                                    ) : (
                                                                                                        <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs">
                                                                                                            Image Header
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        } else if (headerComp?.format === 'VIDEO') {
                                                                                            return (
                                                                                                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                                                                                                    📹 Video Header
                                                                                                </div>
                                                                                            );
                                                                                        } else if (headerComp?.format === 'DOCUMENT') {
                                                                                            return (
                                                                                                <div className="relative h-14 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs border-b border-gray-100 dark:border-slate-700/50">
                                                                                                    📄 Document Header
                                                                                                </div>
                                                                                            );
                                                                                        }
                                                                                        return null;
                                                                                    })()}

                                                                                    <div className="p-3 pb-2">
                                                                                        {(() => {
                                                                                            const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
                                                                                            if (headerComp && headerComp.format !== 'IMAGE' && headerComp.format !== 'VIDEO' && headerComp.format !== 'DOCUMENT') {
                                                                                                return (
                                                                                                    <div className="font-bold text-[12.5px] text-[#111b21] dark:text-gray-100 mb-1">
                                                                                                        {headerComp.text}
                                                                                                    </div>
                                                                                                );
                                                                                            }
                                                                                            return null;
                                                                                        })()}

                                                                                        <p className="text-[13px] leading-snug whitespace-pre-wrap">
                                                                                            {bodyComponent.text}
                                                                                        </p>
                                                                                        <div className="text-[8px] mt-1 font-medium flex items-center justify-start gap-1 opacity-60 text-gray-500 dark:text-gray-400">
                                                                                            {format12HourTime(new Date())}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Check for buttons and render them */}
                                                                                    {(template.components?.find((c: any) => c.type === 'BUTTONS')?.buttons?.length || 0) > 0 && (
                                                                                        <div className="mt-2 space-y-1 border-t border-gray-100 dark:border-slate-700/50 pt-1 w-full min-w-[180px]">
                                                                                            {template.components?.find((c: any) => c.type === 'BUTTONS')?.buttons?.map((button: any, i: number) => (
                                                                                                <div key={i} className="text-[13px] text-[#00a884] dark:text-emerald-400 font-bold text-center py-1.5 border-b border-gray-100 dark:border-slate-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                                                                    {button.text}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {isSelected && (paramCount > 0 || ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.components?.find((c: any) => c.type === 'HEADER')?.format || '')) && (
                                                                        <div
                                                                            className="mt-6 space-y-4 animate-in fade-in duration-500"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4" />

                                                                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.components?.find((c: any) => c.type === 'HEADER')?.format || '') && (
                                                                                <div className="space-y-1.5">
                                                                                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center justify-between">
                                                                                        <span>{template.components?.find((c: any) => c.type === 'HEADER')?.format} URL (Optional)</span>
                                                                                        <span className="text-[9px] lowercase opacity-60 font-normal normal-case">Leave empty to use default</span>
                                                                                    </label>
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="outline"
                                                                                        className="w-full h-10 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-start gap-2 px-3 overflow-hidden"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setIsMediaLibraryOpen(true);
                                                                                        }}
                                                                                    >
                                                                                        <ImageIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                                                                        <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
                                                                                            {templateHeaderMediaUrl ? templateHeaderMediaUrl.split('/').pop() || templateHeaderMediaUrl : "Choose from Media Library"}
                                                                                        </span>
                                                                                        {templateHeaderMediaUrl && (
                                                                                            <span
                                                                                                className="ml-auto text-xs text-red-500 hover:text-red-700 z-10"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setTemplateHeaderMediaUrl('');
                                                                                                }}
                                                                                            >
                                                                                                Clear
                                                                                            </span>
                                                                                        )}
                                                                                    </Button>
                                                                                </div>
                                                                            )}

                                                                            {Array.from({ length: paramCount }).map((_, index) => (
                                                                                <div key={index} className="space-y-1.5">
                                                                                    <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                                                                        Parameter {index + 1}
                                                                                        {bodyComponent?.example?.body_text?.[0]?.[index] && (
                                                                                            <span className="text-slate-400 ml-2 opacity-70">
                                                                                                (e.g., {bodyComponent.example.body_text[0][index]})
                                                                                            </span>
                                                                                        )}
                                                                                    </label>
                                                                                    <Input
                                                                                        placeholder={`Value for {{${index + 1}}}`}
                                                                                        value={templateParams[index] || ''}
                                                                                        onChange={(e) => {
                                                                                            const newParams = [...templateParams];
                                                                                            newParams[index] = e.target.value;
                                                                                            setTemplateParams(newParams);
                                                                                        }}
                                                                                        className="h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#00a884] focus:ring-[#00a884]/20 transition-all text-sm"
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                                                <Button variant="ghost" onClick={() => setIsTemplateDialogOpen(false)} className="rounded-xl font-bold uppercase tracking-wider text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</Button>
                                                <Button
                                                    onClick={handleSendTemplate}
                                                    disabled={isSendingTemplate || !selectedTemplate}
                                                    className="bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl shadow-md font-bold uppercase tracking-wider text-[11px] h-10 px-6 transition-all"
                                                >
                                                    {isSendingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                                                    Send Message
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    {/* Quick Reply Dialog */}
                                    <Dialog open={isQuickReplyDialogOpen} onOpenChange={(open) => {
                                        setIsQuickReplyDialogOpen(open);
                                        if (!open) setQuickReplySearchQuery("");
                                    }}>
                                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl font-sans">
                                            <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-900/50 items-start border-b border-slate-100 dark:border-slate-800 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center">
                                                        <Zap className="w-5 h-5 text-[#3b82f6]" />
                                                    </div>
                                                    <div>
                                                        <DialogTitle className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Quick Replies</DialogTitle>
                                                        <DialogDescription className="text-sm text-slate-500 font-medium">
                                                            Choose a saved response to send instantly.
                                                        </DialogDescription>
                                                    </div>
                                                </div>

                                                {/* Search Bar */}
                                                <div className="relative w-full">
                                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input
                                                        type="text"
                                                        placeholder="Search quick replies by name, content, shortcut or type..."
                                                        value={quickReplySearchQuery}
                                                        onChange={(e) => setQuickReplySearchQuery(e.target.value)}
                                                        className="pl-10 pr-10 py-2 h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-[#3b82f6]/30 shadow-sm"
                                                    />
                                                    {quickReplySearchQuery && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setQuickReplySearchQuery("")}
                                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </DialogHeader>

                                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/30">
                                                {quickReplies.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-20">
                                                        <Zap className="w-12 h-12 text-slate-300 mb-4" />
                                                        <p className="text-lg font-bold text-slate-600">No quick replies found</p>
                                                        <p className="text-sm text-slate-400">Add them in the Quick Replies module</p>
                                                    </div>
                                                ) : filteredQuickReplies.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                        <Zap className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                                                        <p className="text-base font-bold text-slate-600 dark:text-slate-300">No matching quick replies</p>
                                                        <p className="text-xs text-slate-400 mt-1">No results for &quot;{quickReplySearchQuery}&quot;</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {filteredQuickReplies.map((reply) => (
                                                            <div
                                                                key={reply.id}
                                                                onClick={() => {
                                                                    handleSendQuickReply(reply.id);
                                                                    setIsQuickReplyDialogOpen(false);
                                                                    setQuickReplySearchQuery("");
                                                                }}
                                                                className="p-4 rounded-[20px] bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-[#3b82f6]/50 hover:shadow-md transition-all cursor-pointer group"
                                                            >
                                                                {(() => {
                                                                    let urls: string[] = [];
                                                                    const rUrl = (reply.fileUrl || '').trim();
                                                                    if (rUrl.startsWith('[') && rUrl.endsWith(']')) {
                                                                        try {
                                                                            const p = JSON.parse(rUrl);
                                                                            if (Array.isArray(p)) urls = p.map(String).filter(Boolean);
                                                                        } catch { }
                                                                    }
                                                                    if (urls.length === 0 && rUrl) urls = [rUrl];
                                                                    const isMulti = urls.length > 1;

                                                                    return (
                                                                        <>
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <h4 className="font-bold text-sm truncate pr-2 text-slate-800 dark:text-slate-100">{reply.name}</h4>
                                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                                    {isMulti && (
                                                                                        <Badge variant="outline" className="text-[9px] font-bold h-5 px-1.5 border-emerald-500/20 text-[#00B074] bg-[#00B074]/5">
                                                                                            {urls.length} images
                                                                                        </Badge>
                                                                                    )}
                                                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-5 px-1.5 border-[#3b82f6]/20 text-[#3b82f6] shrink-0 bg-[#3b82f6]/5">
                                                                                        {reply.type}
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>
                                                                            {isMulti && (
                                                                                <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
                                                                                    {urls.slice(0, 4).map((u, i) => (
                                                                                        <img key={i} src={u} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-800" />
                                                                                    ))}
                                                                                    {urls.length > 4 && (
                                                                                        <span className="text-[10px] font-bold text-slate-400">+{urls.length - 4}</span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                                                                                {(reply.content ? resolveContactVariables(reply.content, selectedContact) : "") || (isMulti ? `${urls.length} images` : (reply.fileName ? `File: ${reply.fileName}` : 'Media content'))}
                                                                            </p>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                                                <Button variant="ghost" onClick={() => {
                                                    setIsQuickReplyDialogOpen(false);
                                                    setQuickReplySearchQuery("");
                                                }} className="rounded-xl font-bold uppercase tracking-wider text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center w-full h-full relative z-10 bg-white dark:bg-[#111B21] transition-colors duration-200 select-none animate-in fade-in duration-500">
                                    <div className="max-w-md w-full text-center px-6 py-8 flex flex-col items-center justify-center">
                                        {/* WhatsApp Web Minimalist Vector Illustration */}
                                        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center pointer-events-none mb-2">
                                            <svg
                                                viewBox="0 0 360 360"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-full h-full drop-shadow-sm opacity-95 dark:opacity-90 transition-all duration-300"
                                            >
                                                {/* Soft Outer Halo Background */}
                                                <circle cx="180" cy="180" r="140" className="fill-slate-100 dark:fill-slate-800/40" />

                                                {/* Desktop Computer Monitor Base & Frame */}
                                                <rect x="75" y="65" width="210" height="142" rx="14" className="fill-slate-700 dark:fill-slate-600" />
                                                <rect x="81" y="71" width="198" height="130" rx="9" className="fill-white dark:fill-[#1f2c34]" />

                                                {/* Stand & Base */}
                                                <path d="M150 207H210V222C210 223.105 209.105 224 208 224H152C150.895 224 150 223.105 150 222V207Z" className="fill-slate-400 dark:fill-slate-500" />
                                                <path d="M130 224H230C233.314 224 236 226.686 236 230V232H124V230C124 226.686 126.686 224 130 224Z" className="fill-slate-300 dark:fill-slate-600" />

                                                {/* Web Application UI inside screen */}
                                                {/* Left Sidebar strip */}
                                                <rect x="81" y="71" width="60" height="130" className="fill-slate-100 dark:fill-slate-800/90" />
                                                <circle cx="98" cy="87" r="6" className="fill-slate-300 dark:fill-slate-600" />
                                                <rect x="110" y="85" width="22" height="4" rx="2" className="fill-slate-300 dark:fill-slate-600" />
                                                <rect x="89" y="102" width="44" height="4" rx="2" className="fill-slate-200 dark:fill-slate-700" />
                                                <rect x="89" y="113" width="36" height="4" rx="2" className="fill-slate-200 dark:fill-slate-700" />
                                                <rect x="89" y="124" width="40" height="4" rx="2" className="fill-slate-200 dark:fill-slate-700" />
                                                <rect x="89" y="135" width="32" height="4" rx="2" className="fill-slate-200 dark:fill-slate-700" />
                                                <rect x="89" y="146" width="38" height="4" rx="2" className="fill-slate-200 dark:fill-slate-700" />

                                                {/* Main Chat Conversation Bubbles inside Screen */}
                                                <rect x="151" y="92" width="75" height="20" rx="7" className="fill-slate-200 dark:fill-slate-700" />
                                                <rect x="157" y="100" width="50" height="4" rx="2" className="fill-slate-400 dark:fill-slate-500" />

                                                <rect x="188" y="120" width="85" height="24" rx="7" fill="#00B074" opacity="0.9" />
                                                <rect x="196" y="130" width="55" height="4" rx="2" fill="white" opacity="0.95" />

                                                <rect x="151" y="152" width="68" height="20" rx="7" className="fill-slate-200 dark:fill-slate-700" />
                                                <rect x="157" y="160" width="42" height="4" rx="2" className="fill-slate-400 dark:fill-slate-500" />

                                                {/* Connected Mobile Smartphone Graphic Overlay */}
                                                <rect x="238" y="125" width="62" height="110" rx="12" className="fill-slate-800 dark:fill-slate-700" />
                                                <rect x="243" y="131" width="52" height="98" rx="8" className="fill-white dark:fill-[#111b21]" />
                                                <circle cx="269" cy="136" r="2.5" className="fill-slate-400 dark:fill-slate-600" />

                                                {/* Mobile Chat Bubbles */}
                                                <rect x="247" y="146" width="32" height="12" rx="4" className="fill-slate-200 dark:fill-slate-800" />
                                                <rect x="257" y="164" width="34" height="14" rx="4" fill="#00B074" opacity="0.85" />
                                                <rect x="247" y="184" width="28" height="12" rx="4" className="fill-slate-200 dark:fill-slate-800" />

                                                {/* Brand Green Security Badge */}
                                                <circle cx="269" cy="246" r="18" fill="#00B074" className="shadow-md" />
                                                <path d="M263 246V243.5C263 240.186 265.686 237.5 269 237.5C272.314 237.5 275 240.186 275 243.5V246M261 246H277C278.105 246 279 246.895 279 248V253C279 254.105 278.105 255 277 255H261C259.895 255 259 254.105 259 253V248C259 246.895 259.895 246 261 246Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>

                                        {/* Title & Subtitle */}
                                        <div className="space-y-2 mt-2">
                                            <h2 className="text-2xl font-normal tracking-tight text-slate-800 dark:text-slate-100">
                                                Select a conversation
                                            </h2>
                                            <p className="text-sm font-normal text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                                Select a conversation from the left sidebar to start messaging, view previous chats, and manage customer interactions.
                                            </p>
                                        </div>

                                        {/* Optional Security Lock Note */}
                                        <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                                            <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                            <span>Your conversations are securely managed.</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {isProfileOpen && selectedContact && (
                            <ChatProfileSidebar
                                contact={selectedContact}
                                messages={messages}
                                canSendRegular={canSendRegular}
                                onClose={() => setIsProfileOpen(false)}
                            />
                        )}
                    </div>
                </div>
            </div>
            <MediaLibraryModal
                isOpen={isMediaLibraryOpen}
                onClose={() => setIsMediaLibraryOpen(false)}
                onSelect={(url) => {
                    setTemplateHeaderMediaUrl(url);
                    setIsMediaLibraryOpen(false);
                }}
                contentType={(selectedTemplate?.components?.find((c: any) => c.type === 'HEADER')?.format?.toLowerCase() as any) || 'image'}
            />
            <MediaLightboxModal
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                data={lightboxData}
            />
            <ForwardMessageModal
                isOpen={isForwardModalOpen}
                onClose={() => setIsForwardModalOpen(false)}
                messageToForward={forwardingMessage}
                contacts={contacts}
            />

            {/* Edit Contact Name Dialog */}
            <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
                <DialogContent className="max-w-md w-full rounded-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl font-sans [&>button]:hidden">
                    <div className="p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <DialogHeader className="text-left space-y-1">
                                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Edit Contact Name</DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                                    Set a custom CRM display name. This custom name will be displayed across the application and will not be overwritten by WhatsApp profile updates.
                                </DialogDescription>
                            </DialogHeader>
                            <button
                                onClick={() => setIsEditNameOpen(false)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {selectedContact?.whatsappName && (
                            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">WhatsApp Profile Name:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedContact.whatsappName}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-0.5">
                                CRM Contact Name
                            </label>
                            <Input
                                value={editNameInput}
                                onChange={(e) => setEditNameInput(e.target.value)}
                                placeholder="Enter custom contact name..."
                                className="h-11 rounded-xl border-slate-200 dark:border-slate-700 font-semibold text-sm focus:ring-2 focus:ring-emerald-500/20"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveContactName();
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2 gap-2">
                            {selectedContact?.whatsappName ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleResetContactName}
                                    disabled={isSavingName}
                                    className="text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 h-9 px-3 rounded-xl font-bold"
                                >
                                    Reset to WhatsApp Name
                                </Button>
                            ) : (
                                <div />
                            )}
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsEditNameOpen(false)}
                                    disabled={isSavingName}
                                    className="h-9 px-4 rounded-xl text-xs font-semibold"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveContactName}
                                    disabled={isSavingName || !editNameInput.trim()}
                                    className="h-9 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                >
                                    {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Name"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <WhatsAppMediaSpecsModal
                isOpen={isMediaSpecsModalOpen}
                onClose={() => setIsMediaSpecsModalOpen(false)}
            />
        </DashboardLayoutClient>
    );
}
