"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { 
  Users, 
  Tag, 
  UserMinus, 
  Layers, 
  Search, 
  Filter, 
  ArrowUpDown, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Phone, 
  Clock,
  MessageCircle,
  Activity,
  LayoutList,
  LayoutGrid
} from 'lucide-react';
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import WatiBotLoader from "@/components/WatiBotLoader";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

interface TagItem {
  id: string;
  name: string;
  color?: string;
  category?: string;
}

interface ContactItem {
  id: string;
  name?: string;
  waId: string;
  avatar?: string;
  lastMessage?: string;
  lastInboundMessageAt?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  isBlocked?: boolean;
  isAiBotEnabled?: boolean;
  tags: TagItem[];
}

interface TagGroup {
  id: string;
  name: string;
  color: string;
  category: string;
  contactCount: number;
  contacts: ContactItem[];
}

interface AudienceApiResponse {
  success: boolean;
  summary: {
    totalContacts: number;
    totalTags: number;
    untaggedContacts: number;
    multipleTagsContacts: number;
  };
  tags: TagGroup[];
  untaggedContacts: ContactItem[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load live chat audience data');
  return data as AudienceApiResponse;
};

export default function AudiencePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recently_active" | "oldest_active" | "name">("recently_active");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Real-time SWR Data Fetching with 5-second polling interval
  const { data, error, isLoading, mutate } = useSWR('/api/audience', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const handleCopyPhone = (waId: string, id: string) => {
    navigator.clipboard.writeText(waId);
    setCopiedPhoneId(id);
    toast.success("Phone number copied to clipboard!");
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const toggleSectionCollapse = (sectionKey: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Helper for formatting relative activity time
  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'No recent activity';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recently';
    }
  };

  // Helper to determine WhatsApp 24-Hour Session Window Status
  const getWindowStatus = (lastInboundStr?: string) => {
    if (!lastInboundStr) return { status: 'Expired Window', is24hOpen: false };
    const lastInbound = new Date(lastInboundStr).getTime();
    const now = Date.now();
    const hours24 = 24 * 60 * 60 * 1000;
    const is24hOpen = (now - lastInbound) < hours24;
    return {
      status: is24hOpen ? 'Active 24h' : 'Expired Window',
      is24hOpen
    };
  };

  // Helper for generating initial avatar background color based on name
  const getAvatarGradient = (nameStr: string) => {
    const gradients = [
      'from-emerald-500 to-teal-700',
      'from-blue-500 to-indigo-700',
      'from-purple-500 to-pink-700',
      'from-amber-500 to-orange-700',
      'from-[#00B074] to-emerald-800'
    ];
    let hash = 0;
    for (let i = 0; i < nameStr.length; i++) {
      hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const getInitials = (nameStr?: string, waIdStr?: string) => {
    if (nameStr && nameStr.trim()) {
      const parts = nameStr.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return nameStr.substring(0, 2).toUpperCase();
    }
    if (waIdStr) return waIdStr.substring(Math.max(0, waIdStr.length - 2));
    return 'WA';
  };

  // Process, search, and sort contacts
  const processContactsList = (contacts: ContactItem[]) => {
    let list = [...contacts];

    // 1. Search Filter (by Name, Phone Number, or Last Message content)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.waId && c.waId.toLowerCase().includes(q)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
    }

    // 2. Sorting
    list.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.name || a.waId).toLowerCase();
        const nameB = (b.name || b.waId).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      const timeA = new Date(a.lastInboundMessageAt || a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.lastInboundMessageAt || b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
      
      if (sortBy === 'oldest_active') {
        return timeA - timeB;
      }
      // Default: Recently Active
      return timeB - timeA;
    });

    return list;
  };

  // Filter visible tag groups
  const filteredTagGroups = useMemo(() => {
    if (!data?.tags) return [];
    if (selectedTagFilter === 'untagged') return [];
    if (selectedTagFilter !== 'all') {
      return data.tags.filter(t => t.id === selectedTagFilter);
    }
    return data.tags;
  }, [data?.tags, selectedTagFilter]);

  const showUntaggedSection = selectedTagFilter === 'all' || selectedTagFilter === 'untagged';

  const summary = data?.summary || {
    totalContacts: 0,
    totalTags: 0,
    untaggedContacts: 0,
    multipleTagsContacts: 0,
  };

  return (
    <DashboardLayoutClient mainClassName="bg-[#fafbfc] dark:bg-slate-950 min-h-screen">
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Live Chat Audience
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Activity className="w-3.5 h-3.5" /> Live Chat Users Grouped by Tags
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              View live chat & inbox conversations organized into sections based on assigned tags.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => mutate()}
              className="p-3 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={cn("w-4.5 h-4.5", isLoading && "animate-spin")} />
            </button>

            <Link
              href="/manage/tags"
              className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Manage Tags
            </Link>

            <Link
              href="/live-chat"
              className="px-5 py-2.5 bg-[#00B074] hover:bg-[#009864] text-white rounded-2xl font-semibold text-xs flex items-center gap-2 shadow-lg shadow-[#00B074]/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Open Live Inbox
            </Link>
          </div>
        </div>

        {/* Tag Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Inbox Users</span>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isLoading ? '...' : summary.totalContacts}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Active live chat conversations</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Tags</span>
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isLoading ? '...' : summary.totalTags}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Active tags created</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Untagged Users</span>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UserMinus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isLoading ? '...' : summary.untaggedContacts}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Users without assigned tags</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Multiple Tags</span>
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {isLoading ? '...' : summary.multipleTagsContacts}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Assigned to 2+ tags</p>
          </div>
        </div>

        {/* Toolbar: Search, Tag Filter, Sorting, View Mode Toggle */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 shadow-sm">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search live chat users by name, phone, or last message..."
              className="w-full h-11 pl-11 pr-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#00B074] transition-all"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tag Filter Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Tag Filter:</span>
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">All Tags & Untagged</option>
                <option value="untagged">Untagged Only ({summary.untaggedContacts})</option>
                {data?.tags?.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.contactCount})</option>
                ))}
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="recently_active">Recently Active</option>
                <option value="oldest_active">Oldest Activity</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {/* View Mode Switcher (List vs Grid) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  viewMode === "list" 
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  viewMode === "grid" 
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex justify-center items-center">
            <WatiBotLoader fullScreen={false} />
          </div>
        )}

        {/* Content Section: Tag Groups */}
        {!isLoading && (
          <div className="space-y-6">
            
            {/* Render Tag Groups */}
            {filteredTagGroups.map((tagGroup) => {
              const processedContacts = processContactsList(tagGroup.contacts);
              const isCollapsed = !!collapsedSections[tagGroup.id];

              if (searchQuery.trim() && processedContacts.length === 0) {
                return null; // Skip empty groups during active search
              }

              return (
                <div 
                  key={tagGroup.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4 transition-all"
                >
                  {/* Tag Group Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm shrink-0" 
                        style={{ backgroundColor: tagGroup.color || '#10B981' }} 
                      />
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        {tagGroup.name}
                        {tagGroup.category && tagGroup.category !== 'General' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-white/10 text-slate-500 uppercase tracking-wider">
                            {tagGroup.category}
                          </span>
                        )}
                      </h2>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {processedContacts.length} {processedContacts.length === 1 ? 'Live Chat User' : 'Live Chat Users'}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleSectionCollapse(tagGroup.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Chat Users List View */}
                  {!isCollapsed && (
                    <>
                      {processedContacts.length > 0 ? (
                        viewMode === "list" ? (
                          /* High-Density Clean Table / List Layout */
                          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-950/40">
                            {processedContacts.map((contact) => {
                              const win = getWindowStatus(contact.lastInboundMessageAt);

                              return (
                                <div
                                  key={`${tagGroup.id}-${contact.id}`}
                                  className="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 hover:bg-slate-100/60 dark:hover:bg-white/5 transition-all"
                                >
                                  {/* Left: Avatar + Name + Phone */}
                                  <div className="flex items-center gap-3 min-w-[220px] max-w-[280px]">
                                    <div className={cn(
                                      "w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm bg-gradient-to-br",
                                      getAvatarGradient(contact.name || contact.waId)
                                    )}>
                                      {contact.avatar ? (
                                        <img 
                                          src={contact.avatar} 
                                          alt={contact.name || contact.waId} 
                                          className="w-full h-full object-cover rounded-2xl" 
                                        />
                                      ) : (
                                        getInitials(contact.name, contact.waId)
                                      )}
                                    </div>

                                    <div className="space-y-0.5 min-w-0 flex-1">
                                      <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-[#00B074] transition-colors">
                                        {contact.name || contact.waId}
                                      </h3>
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">{contact.waId}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyPhone(contact.waId, `${tagGroup.id}-${contact.id}`)}
                                          className="p-0.5 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                                          title="Copy Phone"
                                        >
                                          {copiedPhoneId === `${tagGroup.id}-${contact.id}` ? (
                                            <Check className="w-3 h-3 text-emerald-500" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Middle 1: Last Message Preview */}
                                  <div className="flex-1 min-w-0 max-w-md hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                    {contact.lastMessage ? (
                                      <>
                                        <MessageCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate italic">"{contact.lastMessage}"</span>
                                      </>
                                    ) : (
                                      <span className="text-slate-400 text-[11px] font-normal">No message preview</span>
                                    )}
                                  </div>

                                  {/* Middle 2: Tag Chips */}
                                  <div className="flex flex-wrap items-center gap-1 min-w-[150px]">
                                    {contact.tags?.map((t) => (
                                      <span
                                        key={t.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                        style={{
                                          backgroundColor: `${t.color || '#10B981'}15`,
                                          borderColor: `${t.color || '#10B981'}30`,
                                          color: t.color || '#10B981'
                                        }}
                                      >
                                        <span 
                                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                                          style={{ backgroundColor: t.color || '#10B981' }} 
                                        />
                                        {t.name}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Right: Window Badge + Activity + Open Chat */}
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className={cn(
                                      "text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                                      win.is24hOpen 
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300/40"
                                    )}>
                                      {win.status}
                                    </span>

                                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 min-w-[70px]">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {formatTimeAgo(contact.lastInboundMessageAt || contact.lastMessageAt || contact.updatedAt)}
                                    </span>

                                    <Link
                                      href={`/live-chat?contactId=${contact.id}`}
                                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-[#00B074] text-[#00B074] hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                      Open Chat <ExternalLink className="w-3 h-3" />
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Grid Layout Fallback */
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                            {processedContacts.map((contact) => {
                              const win = getWindowStatus(contact.lastInboundMessageAt);

                              return (
                                <div
                                  key={`${tagGroup.id}-${contact.id}`}
                                  className="group relative bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 hover:border-[#00B074]/40 rounded-2xl p-4 transition-all hover:shadow-md flex flex-col justify-between gap-3"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={cn(
                                      "w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm bg-gradient-to-br",
                                      getAvatarGradient(contact.name || contact.waId)
                                    )}>
                                      {contact.avatar ? (
                                        <img 
                                          src={contact.avatar} 
                                          alt={contact.name || contact.waId} 
                                          className="w-full h-full object-cover rounded-2xl" 
                                        />
                                      ) : (
                                        getInitials(contact.name, contact.waId)
                                      )}
                                    </div>

                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-[#00B074] transition-colors">
                                          {contact.name || contact.waId}
                                        </h3>

                                        <span className={cn(
                                          "text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                                          win.is24hOpen 
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                            : "bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300/40"
                                        )}>
                                          {win.status}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span className="truncate">{contact.waId}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyPhone(contact.waId, `${tagGroup.id}-${contact.id}`)}
                                          className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                                          title="Copy Phone Number"
                                        >
                                          {copiedPhoneId === `${tagGroup.id}-${contact.id}` ? (
                                            <Check className="w-3 h-3 text-emerald-500" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {contact.lastMessage && (
                                    <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                                      <MessageCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      <p className="truncate font-medium italic">"{contact.lastMessage}"</p>
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    {contact.tags?.map((t) => (
                                      <span
                                        key={t.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                                        style={{
                                          backgroundColor: `${t.color || '#10B981'}15`,
                                          borderColor: `${t.color || '#10B981'}30`,
                                          color: t.color || '#10B981'
                                        }}
                                      >
                                        <span 
                                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                                          style={{ backgroundColor: t.color || '#10B981' }} 
                                        />
                                        {t.name}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-400 font-medium">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatTimeAgo(contact.lastInboundMessageAt || contact.lastMessageAt || contact.updatedAt)}
                                    </span>

                                    <Link
                                      href={`/live-chat?contactId=${contact.id}`}
                                      className="inline-flex items-center gap-1 font-bold text-[#00B074] hover:text-[#009864] transition-colors"
                                    >
                                      Open Chat <ExternalLink className="w-3 h-3" />
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400 font-medium">
                          No live chat users found under this tag for current search query.
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Untagged Users Section */}
            {showUntaggedSection && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-400 dark:bg-slate-600 shadow-sm shrink-0" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      Untagged Live Chat Users
                    </h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {processContactsList(data?.untaggedContacts || []).length} Users
                    </span>
                  </div>

                  <button
                    onClick={() => toggleSectionCollapse('untagged-section')}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                  >
                    {collapsedSections['untagged-section'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>

                {/* Untagged Live Chat Users List View */}
                {!collapsedSections['untagged-section'] && (
                  <>
                    {processContactsList(data?.untaggedContacts || []).length > 0 ? (
                      viewMode === "list" ? (
                        <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-950/40">
                          {processContactsList(data?.untaggedContacts || []).map((contact) => {
                            const win = getWindowStatus(contact.lastInboundMessageAt);

                            return (
                              <div
                                key={`untagged-${contact.id}`}
                                className="group flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 hover:bg-slate-100/60 dark:hover:bg-white/5 transition-all"
                              >
                                <div className="flex items-center gap-3 min-w-[220px] max-w-[280px]">
                                  <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm bg-gradient-to-br",
                                    getAvatarGradient(contact.name || contact.waId)
                                  )}>
                                    {contact.avatar ? (
                                      <img 
                                        src={contact.avatar} 
                                        alt={contact.name || contact.waId} 
                                        className="w-full h-full object-cover rounded-2xl" 
                                      />
                                    ) : (
                                      getInitials(contact.name, contact.waId)
                                    )}
                                  </div>

                                  <div className="space-y-0.5 min-w-0 flex-1">
                                    <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-[#00B074] transition-colors">
                                      {contact.name || contact.waId}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{contact.waId}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyPhone(contact.waId, `untagged-${contact.id}`)}
                                        className="p-0.5 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                                        title="Copy Phone"
                                      >
                                        {copiedPhoneId === `untagged-${contact.id}` ? (
                                          <Check className="w-3 h-3 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 max-w-md hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                  {contact.lastMessage ? (
                                    <>
                                      <MessageCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate italic">"{contact.lastMessage}"</span>
                                    </>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] font-normal">No message preview</span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1 min-w-[150px]">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-500 border border-slate-300/40">
                                    No Tags Assigned
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className={cn(
                                    "text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                                    win.is24hOpen 
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300/40"
                                  )}>
                                    {win.status}
                                  </span>

                                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 min-w-[70px]">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {formatTimeAgo(contact.lastInboundMessageAt || contact.lastMessageAt || contact.updatedAt)}
                                  </span>

                                  <Link
                                    href={`/live-chat?contactId=${contact.id}`}
                                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-[#00B074] text-[#00B074] hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    Open Chat <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                          {processContactsList(data?.untaggedContacts || []).map((contact) => {
                            const win = getWindowStatus(contact.lastInboundMessageAt);

                            return (
                              <div
                                key={`untagged-${contact.id}`}
                                className="group relative bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 hover:border-[#00B074]/40 rounded-2xl p-4 transition-all hover:shadow-md flex flex-col justify-between gap-3"
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "w-11 h-11 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm bg-gradient-to-br",
                                    getAvatarGradient(contact.name || contact.waId)
                                  )}>
                                    {contact.avatar ? (
                                      <img 
                                        src={contact.avatar} 
                                        alt={contact.name || contact.waId} 
                                        className="w-full h-full object-cover rounded-2xl" 
                                      />
                                    ) : (
                                      getInitials(contact.name, contact.waId)
                                    )}
                                  </div>

                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-[#00B074] transition-colors">
                                        {contact.name || contact.waId}
                                      </h3>

                                      <span className={cn(
                                        "text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                                        win.is24hOpen 
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                          : "bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300/40"
                                      )}>
                                        {win.status}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{contact.waId}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyPhone(contact.waId, `untagged-${contact.id}`)}
                                        className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                                        title="Copy Phone Number"
                                      >
                                        {copiedPhoneId === `untagged-${contact.id}` ? (
                                          <Check className="w-3 h-3 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {contact.lastMessage && (
                                  <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                                    <MessageCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="truncate font-medium italic">"{contact.lastMessage}"</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 pt-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-500 border border-slate-300/40">
                                    No Tags Assigned
                                  </span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeAgo(contact.lastInboundMessageAt || contact.lastMessageAt || contact.updatedAt)}
                                  </span>

                                  <Link
                                    href={`/live-chat?contactId=${contact.id}`}
                                    className="inline-flex items-center gap-1 font-bold text-[#00B074] hover:text-[#009864] transition-colors"
                                  >
                                    Open Chat <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400 font-medium">
                        All live chat users in your workspace have assigned tags!
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Global Empty Search State */}
            {searchQuery.trim() && filteredTagGroups.every(g => processContactsList(g.contacts).length === 0) && processContactsList(data?.untaggedContacts || []).length === 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-3xl p-12 text-center space-y-3">
                <Search className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No live chat users found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
                  No live chat users matched your search query "{searchQuery}". Try searching with a different name, phone number, or message keyword.
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs transition-all"
                >
                  Clear Search
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </DashboardLayoutClient>
  );
}
