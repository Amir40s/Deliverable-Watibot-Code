"use client"

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
    X, Send, Paperclip, Smile, MoreVertical, Phone, Mail,
    Calendar, Tag, Clock, CheckCircle2, AlertCircle, ChevronDown,
    ChevronUp, Search, Forward, CheckSquare, User, MapPin, Plus, UserMinus
} from "lucide-react"
import { Contact } from './contact-table'
import { getTags } from '@/app/actions/tags'
import { getAgents } from '@/app/actions/agents'
import { useSession } from 'next-auth/react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from 'sonner'
import { cn, format12HourTime } from "@/lib/utils"
import { FormattedMessageText } from '@/components/live-chat/InteractiveMessageRenderer'
 
interface ContactChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact | null;
}

type Message = {
    id: string;
    content: string | null;
    direction: 'inbound' | 'outbound';
    type: string;
    createdAt: Date;
    status: string;
}
function AccordionItem({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-100 dark:border-slate-800 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-4 px-6 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                {title}
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {isOpen && <div className="px-6 pb-4">{children}</div>}
        </div>
    );
}

export function ContactChatDrawer({ isOpen, onClose, contact }: ContactChatDrawerProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [dbTags, setDbTags] = useState<any[]>([]);
    const [isUpdatingTags, setIsUpdatingTags] = useState(false);
    const [availableAgents, setAvailableAgents] = useState<any[]>([]);
    const [isTransferring, setIsTransferring] = useState(false);
    const { data: session } = useSession();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isAdminOrOwner = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
    const perms = (session?.user?.permissions as Record<string, boolean>) || {};
    const canReply = isAdminOrOwner || perms.chat_super || perms.chat_reply;
    const canAssign = isAdminOrOwner || perms.chat_super || perms.chat_assign; // Assuming chat_assign exists or should be super

    useEffect(() => {
        if (isOpen) {
            getTags().then(setDbTags).catch(console.error);
            getAgents().then(setAvailableAgents).catch(console.error);
        }
    }, [isOpen]);

    const handleTagToggle = async (tagId: string) => {
        if (!contact) return;
        setIsUpdatingTags(true);
        try {
            const currentTagIds = contact.tags?.map(t => t.id) || [];
            let newTagIds;
            if (currentTagIds.includes(tagId)) {
                newTagIds = currentTagIds.filter(id => id !== tagId);
            } else {
                newTagIds = [...currentTagIds, tagId];
            }
            await updateContact(contact.id, { tagIds: newTagIds });
            toast.success('Tags updated. Please refresh parent if needed.');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update tags');
        } finally {
            setIsUpdatingTags(false);
        }
    };

    // Fetch messages when drawer opens or contact changes
    useEffect(() => {
        if (!isOpen || !contact) return;

        // Initial fetch
        fetchMessages();

        // Set up polling
        const intervalId = setInterval(fetchMessages, 3000);

        return () => clearInterval(intervalId);
    }, [isOpen, contact]);

    const fetchMessages = async () => {
        if (!contact) return;
        setIsLoading(true);
        try {
            const msgs = await getMessages(contact.id);
            setMessages(msgs as Message[]);
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!contact || !newMessage.trim()) return;
        setIsSending(true);
        try {
            const resultMsg = await sendWhatsAppMessage(contact.id, newMessage);
            if (resultMsg.success && resultMsg.data) {
                setMessages(prev => [...prev, resultMsg.data as unknown as Message]);
                setNewMessage("");
            } else if (resultMsg.error) {
                toast.error(resultMsg.error);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    const handleAssign = async (agentId: string) => {
        if (!contact) return;
        setIsTransferring(true);
        try {
            await assignContactAgent(contact.id, agentId, 'assign');
            toast.success('Agent assigned successfully');
        } catch (error) {
            toast.error('Failed to assign agent');
        } finally {
            setIsTransferring(false);
        }
    };

    const handleUnassign = async (agentId: string | null) => {
        if (!contact) return;
        setIsTransferring(true);
        try {
            await assignContactAgent(contact.id, agentId, 'unassign');
            toast.success(agentId ? 'Agent unassigned successfully' : 'All agents unassigned');
        } catch (error) {
            toast.error('Failed to unassign agent');
        } finally {
            setIsTransferring(false);
        }
    };

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    if (!contact) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="fixed right-0 top-0 left-auto h-full w-full max-w-[95vw] md:max-w-[1200px] translate-x-0 translate-y-0 border-l shadow-2xl p-0 gap-0 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:rounded-none bg-[#FDFBF7] dark:bg-slate-950 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row antialiased">

                {/* Close Button styling matching the design (top left over everything? or in header?) 
 The screenshot shows X in the very top left green bar. 
 We'll put it in the main chat header as we'll construct the layout manually.
 */}

                {/* MAIN CHAT AREA */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-slate-800 h-full">
                    {/* Header */}
                    <div className="h-16 bg-[#005C4B] dark:bg-slate-900 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                            <Avatar className="h-10 w-10 border-2 border-white/20">
                                <AvatarImage src={contact.profilePic || undefined} />
                                <AvatarFallback className="bg-emerald-600 text-white font-bold">
                                    {contact.name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-white font-semibold text-sm leading-tight">
                                    {contact.name || contact.waId}
                                </span>
                                <span className="text-white/70 text-xs">
                                    {contact.assignedUsers?.length
                                        ? `Assigned to: ${contact.assignedUsers.map(u => u.name).join(',')}`
                                        : 'Unassigned'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => window.open(`https://wa.me/${contact.waId}`, '_blank')}
                                className="bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 hover:text-white h-8 text-xs font-semibold gap-1.5"
                                title="Call Contact on WhatsApp"
                            >
                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                Call
                            </Button>
                            {isAdminOrOwner && (
                                <>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white h-8 text-xs font-medium" disabled={isTransferring}>
                                                Assign To
                                                <Plus className="w-3 h-3 ml-2" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 border border-emerald-500/20">

                                            {availableAgents
                                                .filter(agent => !contact.assignedUsers?.some(u => u.id === agent.id))
                                                .map(agent => (
                                                    <DropdownMenuItem
                                                        key={agent.id}
                                                        onClick={() => handleAssign(agent.id)}
                                                        className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                                                    >
                                                        <span className="font-bold text-sm">{agent.name}</span>
                                                        <span className="text-[10px] text-slate-500">{agent.department?.name || 'No Dept'}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                            {availableAgents.filter(agent => !contact.assignedUsers?.some(u => u.id === agent.id)).length === 0 && (
                                                <div className="px-2 py-4 text-center text-xs text-slate-400">All available agents assigned</div>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {contact.assignedUsers && contact.assignedUsers.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="bg-transparent border-white/30 text-rose-100 hover:bg-rose-500/10 hover:text-white h-8 text-xs font-medium" disabled={isTransferring}>
                                                    Unassign
                                                    <UserMinus className="w-3 h-3 ml-2" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 border border-rose-500/20">
                                                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Remove Agent</div>
                                                {contact.assignedUsers.map(user => (
                                                    <DropdownMenuItem
                                                        key={user.id}
                                                        onClick={() => handleUnassign(user.id)}
                                                        className="flex items-center justify-between py-2 cursor-pointer text-rose-600"
                                                    >
                                                        <span className="font-bold text-sm">{user.name}</span>
                                                        <X className="w-3 h-3" />
                                                    </DropdownMenuItem>
                                                ))}
                                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                                <DropdownMenuItem
                                                    onClick={() => handleUnassign(null)}
                                                    className="py-2 cursor-pointer text-rose-700 font-bold text-xs uppercase tracking-wider text-center flex justify-center bg-rose-50 dark:bg-rose-950/20"
                                                >
                                                    Unassign All
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </>
                            )}
                            <Button className="bg-white text-[#005C4B] hover:bg-white/90 h-8 text-xs font-bold uppercase tracking-wide">
                                Resolve
                            </Button>
                        </div>
                    </div>

                    {/* Chat Background & Messages */}
                    <div className="flex-1 overflow-hidden relative bg-[#EFEAE2] dark:bg-[#0b141a]">
                        {/* Background Pattern Overlay */}
                        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}>
                        </div>

                        <ScrollArea className="h-full px-4 md:px-12 py-6">
                            <div className="space-y-6">
                                {/* Date Separator Mock */}
                                <div className="flex justify-center">
                                    <span className="bg-white/80 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg shadow-sm backdrop-blur-sm">
                                        Today
                                    </span>
                                </div>

                                {/* Messages */}
                                {messages.map((msg, i) => {
                                    const isOutbound = msg.direction === 'outbound';
                                    return (
                                        <div key={msg.id} className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
                                            <div className={cn(
                                                "max-w-[75%] min-w-0 overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] p-3 text-sm shadow-sm",
                                                isOutbound
                                                    ? "bg-[#D9FDD3] dark:bg-[#005C4B] text-gray-900 dark:text-gray-100 rounded-2xl rounded-tr-none"
                                                    : "bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-none"
                                            )}>
                                                <FormattedMessageText text={msg.content} className="text-sm" />
                                                <div className={cn(
                                                    "text-[10px] mt-1 flex items-center justify-end gap-1 opacity-60",
                                                    isOutbound ? "text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {format12HourTime(msg.createdAt)}
                                                    {isOutbound && <CheckCircle2 className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Input Area */}
                    <div className="bg-[#F0F2F5] dark:bg-slate-900 px-4 py-3 flex items-end gap-2 border-t border-gray-200 dark:border-slate-800">
                        {canReply ? (
                            <>
                                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    <Smile className="w-6 h-6" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    <Paperclip className="w-6 h-6" />
                                </Button>
                                <div className="flex-1 bg-white dark:bg-slate-800 rounded-lg px-4 py-2 border border-transparent focus-within:border-emerald-500/50 transition-colors">
                                    <Textarea
                                        placeholder="Type a message"
                                        className="min-h-[24px] max-h-32 p-0 border-none resize-none bg-transparent focus-visible:ring-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    className="bg-[#005C4B] hover:bg-[#005C4B]/90 text-white rounded-xl h-10 w-10 p-0 shadow-sm"
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim() || isSending}
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </>
                        ) : (
                            <div className="flex-1 py-3 px-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl text-center text-xs text-gray-500 italic border border-dashed border-gray-200 dark:border-slate-700">
                                You don't have permission to reply to this chat.
                            </div>
                        )}
                    </div>
                </div>

                 <div className="w-full md:w-[380px] bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col h-full overflow-y-auto">
                    {/* Sidebar Header */}
                    <div className="h-16 bg-[#005C4B] dark:bg-slate-900 flex items-center px-6 shrink-0 border-l border-[#004b3e] dark:border-slate-800">
                        <span className="text-white font-medium text-lg">Chat Profile</span>
                    </div>

                    {/* Profile Overview */}
                    <div className="p-8 flex flex-col items-center border-b border-gray-100 dark:border-slate-800">
                        <div className="relative mb-4">
                            <Avatar className="h-20 w-20 border-4 border-gray-50 dark:border-slate-800">
                                <AvatarImage src={contact.profilePic || undefined} />
                                <AvatarFallback className="bg-orange-500 text-white text-3xl font-bold">
                                    {contact.name?.substring(0, 1).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{contact.name}</h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">+{contact.waId}</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="bg-emerald-50/50 dark:bg-slate-800/30 p-6 space-y-3 border-b border-gray-100 dark:border-slate-800 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Status</span>
                            <span className="font-medium text-gray-900 dark:text-white">Intervened</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Assigned To</span>
                            <span className="font-medium text-gray-900 dark:text-white text-right">
                                {contact.assignedUsers?.length
                                    ? contact.assignedUsers.map(u => u.name).join(',')
                                    : 'Initial (Admin)'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Last Active</span>
                            <span className="font-medium text-gray-900 dark:text-white">{new Date(contact.lastMessageAt).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Template Messages</span>
                            <span className="font-medium text-gray-900 dark:text-white">0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Source</span>
                            <span className="font-medium text-gray-900 dark:text-white uppercase">{contact.notes?.includes('Source:') ? contact.notes.split('Source:')[1]?.trim() : 'ORGANIC'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">WA Conversation</span>
                            <span className="font-medium text-gray-900 dark:text-white">Inactive</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">Opted In</span>
                            <Switch checked={true} className="scale-75 origin-right" />
                        </div>
                    </div>

                    {/* Accordions */}
                    <AccordionItem title="Payments">
                        <div className="space-y-3">
                            <Button variant="outline" className="w-full justify-center text-emerald-600 border-emerald-600/30 hover:bg-emerald-50">
                                Create Payment
                            </Button>
                            <div className="flex justify-between text-xs font-semibold text-gray-400 px-1">
                                <span>Order Id</span>
                                <span className="mr-8">Amount</span>
                                <span>Status</span>
                            </div>
                            <div className="text-center text-xs text-gray-400 py-4 italic">No payments found</div>
                        </div>
                    </AccordionItem>

                    <AccordionItem title="Drip Campaigns">
                        <div className="text-sm text-gray-500 text-center py-2">No active drip campaigns</div>
                    </AccordionItem>

                    <AccordionItem title="Attributes">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Email</label>
                                    <div className="text-sm text-gray-800 dark:text-gray-200 truncate">{contact.email || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">City</label>
                                    <div className="text-sm text-gray-800 dark:text-gray-200">-</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Age</label>
                                    <div className="text-sm text-gray-800 dark:text-gray-200">{contact.notes?.includes('DOB:') ? '28' : '-'}</div>
                                </div>
                            </div>
                        </div>
                    </AccordionItem>

                    <AccordionItem title="Tags" defaultOpen>
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {dbTags.map(tag => {
                                    const isSelected = contact.tags?.some(t => t.id === tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleTagToggle(tag.id)}
                                            disabled={isUpdatingTags}
                                            type="button"
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isSelected ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700'} ${isUpdatingTags ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {tag.name}
                                        </button>
                                    );
                                })}
                                {dbTags.length === 0 && <span className="text-sm text-gray-400">No tags available.</span>}
                            </div>
                        </div>
                    </AccordionItem>

                    <AccordionItem title="Customer Journey" defaultOpen>
                        <div className="relative pl-2 space-y-6">
                            {/* Timeline Line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-800"></div>

                            <div className="relative pl-8">
                                <div className="absolute left-1.5 top-1.5 w-3 h-3 bg-emerald-600 rounded-full ring-4 ring-white dark:ring-slate-900"></div>
                                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Service Conversation Started</h4>
                                <span className="text-[10px] text-gray-400 font-medium">03:22 PM, 11 Feb 2026</span>
                            </div>

                            <div className="relative pl-8">
                                <div className="absolute left-1.5 top-1.5 w-3 h-3 border-2 border-emerald-600 bg-white dark:bg-slate-900 rounded-full ring-4 ring-white dark:ring-slate-900"></div>
                                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Chat Intervened by haroon</h4>
                                <span className="text-[10px] text-gray-400 font-medium">03:22 PM, 11 Feb 2026</span>
                            </div>

                            <div className="relative pl-8">
                                <div className="absolute left-1.5 top-1.5 w-3 h-3 border-2 border-emerald-600 bg-white dark:bg-slate-900 rounded-full ring-4 ring-white dark:ring-slate-900"></div>
                                <h4 className="text-xs font-bold text-gray-900 dark:text-white">User created</h4>
                                <span className="text-[10px] text-gray-400 font-medium">03:21 PM, 11 Feb 2026</span>
                            </div>
                        </div>
                    </AccordionItem>

                    <div className="p-6 mt-auto">
                        <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 h-11 border border-red-100 dark:border-red-900/30">
                            <AlertCircle className="w-4 h-4" />
                            Block Incoming Messages
                        </Button>
                    </div>

                </div>

            </DialogContent>
        </Dialog>
    )
}
