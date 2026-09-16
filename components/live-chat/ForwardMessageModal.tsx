"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Search, 
  Send, 
  Check, 
  Loader2, 
  CornerUpRight,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  User
} from "lucide-react";
import { cn, downloadMedia } from "@/lib/utils";
import { toast } from "sonner";

interface Contact {
  id: string;
  waId: string;
  name: string | null;
  phoneNumber?: string;
  profilePic?: string | null;
}

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageToForward: any;
  contacts: Contact[];
}

export function ForwardMessageModal({ isOpen, onClose, messageToForward, contacts }: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [sentContactIds, setSentContactIds] = useState<Set<string>>(new Set());
  const [fetchedContacts, setFetchedContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (contacts && contacts.length > 0) {
      setFetchedContacts(contacts);
    }
    setIsLoadingContacts(true);
    fetch(`/api/chat/poll?type=contacts&limit=5000`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.contacts)) {
          setFetchedContacts(data.contacts);
        }
      })
      .catch((err) => {
        console.error("Failed to load contacts for forward modal:", err);
      })
      .finally(() => {
        setIsLoadingContacts(false);
      });
  }, [isOpen]);

  if (!isOpen || !messageToForward) return null;

  const allContactsList = fetchedContacts.length > 0 ? fetchedContacts : contacts;

  const filteredContacts = allContactsList.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nameMatch = c.name?.toLowerCase().includes(query);
    const phoneMatch = c.waId?.includes(query);
    return nameMatch || phoneMatch;
  });

  const getMediaPreview = () => {
    if (messageToForward.type === 'image' || messageToForward.type === 'sticker') {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="truncate">{messageToForward.content || "Photo"}</span>
        </div>
      );
    }
    if (messageToForward.type === 'video') {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <VideoIcon className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="truncate">{messageToForward.content || "Video"}</span>
        </div>
      );
    }
    if (messageToForward.type === 'document') {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="truncate">{messageToForward.content || "Document"}</span>
        </div>
      );
    }
    return (
      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
        {messageToForward.content || "Message"}
      </p>
    );
  };

  const handleForwardToContact = async (targetContact: Contact) => {
    if (sendingToId) return;
    setSendingToId(targetContact.id);
    try {
      const mediaUrl = messageToForward.mediaUrl || undefined;
      const content = messageToForward.content || "";
      const textToSend = mediaUrl 
        ? (content && !content.startsWith('[') ? content : "") 
        : `${content}`;

      const res = await sendWhatsAppMessage(targetContact.id, textToSend, false, mediaUrl);
      if (!res.success) throw new Error(res.error || "Failed to forward message");

      setSentContactIds(prev => new Set(prev).add(targetContact.id));
      toast.success(`Forwarded to ${targetContact.name || targetContact.waId}`);
    } catch (err: any) {
      console.error("Forwarding error:", err);
      toast.error(err.message || "Failed to forward message");
    } finally {
      setSendingToId(null);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 top-0 left-0 w-screen h-screen z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-200 font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', var(--font-plus-jakarta), var(--dashboard-font), sans-serif" }}
      onClick={onClose}
    >
      <style>{`
        .forward-modal-font, .forward-modal-font * {
          font-family: 'Plus Jakarta Sans', var(--font-plus-jakarta), var(--dashboard-font), sans-serif !important;
        }
      `}</style>
      <div 
        className="forward-modal-font bg-white dark:bg-[#111b21] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans"
        style={{ fontFamily: "'Plus Jakarta Sans', var(--font-plus-jakarta), var(--dashboard-font), sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#1f2c34]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CornerUpRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Forward Message</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select contact to send to {allContactsList.length > 0 ? `(${allContactsList.length} contacts)` : ""}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Preview Box */}
        <div className="p-3 bg-slate-100 dark:bg-[#0b141a] border-b border-slate-200 dark:border-white/5">
          <div className="p-2.5 bg-white dark:bg-[#202c33] border-l-4 border-emerald-500 rounded-r-xl shadow-sm">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Forwarding Preview</span>
            {getMediaPreview()}
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-100 dark:border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search contact name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#202c33] border-none rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 p-2">
          {isLoadingContacts && allContactsList.length === 0 ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <span>Loading contacts...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSending = sendingToId === contact.id;
              const isSent = sentContactIds.has(contact.id);

              return (
                <div 
                  key={contact.id}
                  className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-600/10 text-emerald-600 font-bold flex items-center justify-center shrink-0">
                      {contact.name ? contact.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {contact.name || contact.waId}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">
                        {contact.waId}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleForwardToContact(contact)}
                    disabled={isSending || isSent}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0",
                      isSent
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                    )}
                  >
                    {isSending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Sent</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null;
}
