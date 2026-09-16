"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  Facebook,
  Bot,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  MessageSquare,
  Send,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Clock,
  ThumbsUp,
  RefreshCw,
  Sliders,
  Globe,
  Loader2,
  AlertCircle,
  MessageCircle,
  HelpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  User,
  ShieldCheck,
} from "lucide-react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getConnectedFacebookPagePosts,
  getConnectedFacebookPostComments,
  getFacebookPostAutomations,
  saveFacebookPostAutomation,
  deleteFacebookPostAutomation,
  replyToConnectedFacebookComment,
  type FacebookPostAutomationRule,
  type FacebookKeywordRule,
} from "@/app/actions/facebook-page";

export type FacebookPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: {
    data: Array<{
      media?: {
        image?: {
          src: string;
        };
        source?: string;
      };
      target?: {
        id: string;
        url: string;
      };
      type?: string;
      url?: string;
    }>;
  };
};

export type FacebookPostComment = {
  id: string;
  message?: string;
  created_time?: string;
  from?: {
    id?: string;
    name?: string;
  };
  permalink_url?: string;
  mediaUrl?: string;
};

type AIAgentOption = {
  id: string;
  name: string;
  model?: string | null;
  isDefault?: boolean;
};

type InitialPayload = {
  pageId: string;
  pageName: string;
  posts: FacebookPost[];
} | null;

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractLeafId(id: string): string {
  const parts = id.split("_");
  return parts.length > 1 ? parts[parts.length - 1] : id;
}

export default function FacebookPostsClient({
  initialPayload,
  initialError,
}: {
  initialPayload: InitialPayload;
  initialError: string | null;
}) {
  const t = useTranslations("FacebookPosts");

  const [posts, setPosts] = useState<FacebookPost[]>(initialPayload?.posts || []);
  const [pageName] = useState(initialPayload?.pageName || "Facebook Page");
  const [pageId] = useState(initialPayload?.pageId || "");
  const [isRefreshingPosts, setIsRefreshingPosts] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "automated" | "manual">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 24;

  // Automations state
  const [postRules, setPostRules] = useState<FacebookPostAutomationRule[]>([]);
  const [globalRule, setGlobalRule] = useState<FacebookPostAutomationRule | null>(null);
  const [aiAgents, setAiAgents] = useState<AIAgentOption[]>([]);
  const [isLoadingAutomations, setIsLoadingAutomations] = useState(false);

  // Active Post for Editing Automation
  const [editingPost, setEditingPost] = useState<FacebookPost | null>(null);
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
  const [currentRuleDraft, setCurrentRuleDraft] = useState<FacebookPostAutomationRule>({
    postId: "",
    enabled: true,
    keywords: [],
    defaultReply: { enabled: false, publicReplyText: "", autoLike: true },
    aiAgent: { enabled: false, autoLike: true, customPrompt: "" },
  });
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Active Post for Viewing Comments
  const [commentsPost, setCommentsPost] = useState<FacebookPost | null>(null);
  const [comments, setComments] = useState<FacebookPostComment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [manualReplyDrafts, setManualReplyDrafts] = useState<Record<string, string>>({});
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);

  // Load Automations & AI Agents
  const loadAutomations = async () => {
    setIsLoadingAutomations(true);
    try {
      const res = await getFacebookPostAutomations();
      setPostRules(res.postRules || []);
      setGlobalRule(res.globalRule || null);
      setAiAgents(res.aiAgents || []);
    } catch (err: any) {
      console.warn("Failed to load post automations:", err?.message);
    } finally {
      setIsLoadingAutomations(false);
    }
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  // Refresh posts list from Graph API
  const handleRefreshPosts = async () => {
    setIsRefreshingPosts(true);
    try {
      const res = await getConnectedFacebookPagePosts({ fetchAll: true });
      if (res?.posts) {
        setPosts(res.posts);
        toast.success(`Facebook posts refreshed successfully! Loaded ${res.posts.length} posts.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to refresh posts.");
    } finally {
      setIsRefreshingPosts(false);
    }
  };

  // Open Automation Modal for specific post or global
  const handleOpenAutomation = (post: FacebookPost | null) => {
    if (post) {
      setEditingPost(post);
      const leafId = extractLeafId(post.id);
      const existing = postRules.find(
        (r) => r.postId === post.id || extractLeafId(r.postId) === leafId
      );

      if (existing) {
        setCurrentRuleDraft(JSON.parse(JSON.stringify(existing)));
      } else {
        setCurrentRuleDraft({
          postId: post.id,
          enabled: true,
          keywords: [
            {
              id: "kw_1",
              keyword: "price",
              matchType: "contains",
              publicReplyText: "Hi {name}! Thanks for asking. We'd love to help you with the pricing and details.",
              autoLike: true,
            },
          ],
          defaultReply: {
            enabled: false,
            publicReplyText: "Hi {name}! Thanks for your comment. Our team will get back to you shortly.",
            autoLike: true,
          },
          aiAgent: {
            enabled: false,
            agentId: aiAgents[0]?.id || "",
            autoLike: true,
            customPrompt: `Answer questions about this post: "${post.message || 'our product'}". Be helpful, friendly, and reply under their comment.`,
          },
        });
      }
    } else {
      // Global Rule
      setIsGlobalModalOpen(true);
      if (globalRule) {
        setCurrentRuleDraft(JSON.parse(JSON.stringify(globalRule)));
      } else {
        setCurrentRuleDraft({
          postId: "ALL",
          enabled: true,
          keywords: [
            {
              id: "kw_global_1",
              keyword: "info",
              matchType: "contains",
              publicReplyText: "Hi {name}! Thanks for reaching out. Let us know what details you need.",
              autoLike: true,
            },
          ],
          defaultReply: {
            enabled: true,
            publicReplyText: "Hi {name}! Thank you for your comment. We're glad to have you with us!",
            autoLike: true,
          },
          aiAgent: {
            enabled: false,
            agentId: aiAgents[0]?.id || "",
            autoLike: true,
            customPrompt: "Act as our Facebook social media support assistant. Answer questions kindly and guide users.",
          },
        });
      }
    }
  };

  // Save current rule draft
  const handleSaveAutomation = async () => {
    setIsSavingRule(true);
    try {
      const res = await saveFacebookPostAutomation(currentRuleDraft);
      if (res.success) {
        setPostRules(res.postRules);
        if (res.globalRule) setGlobalRule(res.globalRule);
        toast.success(
          currentRuleDraft.postId === "ALL"
            ? "Global Facebook Post Automation saved!"
            : "Post automation rules updated successfully!"
        );
        setEditingPost(null);
        setIsGlobalModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save automation rule.");
    } finally {
      setIsSavingRule(false);
    }
  };

  // Delete rule for post
  const handleDeleteAutomation = async (postId: string) => {
    try {
      const res = await deleteFacebookPostAutomation(postId);
      if (res.success) {
        setPostRules(res.postRules);
        if (postId === "ALL") setGlobalRule(null);
        toast.info("Automation rule removed.");
        setEditingPost(null);
        setIsGlobalModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove rule.");
    }
  };

  // Open Comments Drawer
  const handleOpenComments = async (post: FacebookPost) => {
    setCommentsPost(post);
    setComments([]);
    setCommentsError(null);
    setIsCommentsLoading(true);

    try {
      const res = await getConnectedFacebookPostComments(post.id, 50);
      setComments(res.comments || []);
    } catch (err: any) {
      setCommentsError(err?.message || "Failed to fetch comments.");
    } finally {
      setIsCommentsLoading(false);
    }
  };

  // Send Manual Reply to a comment
  const handleSendManualReply = async (commentId: string) => {
    const draft = (manualReplyDrafts[commentId] || "").trim();
    if (!draft) {
      toast.error("Reply text cannot be empty.");
      return;
    }

    setReplyingCommentId(commentId);
    try {
      await replyToConnectedFacebookComment(commentId, draft);
      toast.success("Reply published to Facebook comment!");
      setManualReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
      // Reload comments
      if (commentsPost) {
        const refreshed = await getConnectedFacebookPostComments(commentsPost.id, 50);
        setComments(refreshed.comments || []);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reply to comment.");
    } finally {
      setReplyingCommentId(null);
    }
  };

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (p.message || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.includes(searchQuery);

      if (!matchesSearch) return false;

      const leafId = extractLeafId(p.id);
      const isAutomated = postRules.some(
        (r) => r.enabled && (r.postId === p.id || extractLeafId(r.postId) === leafId)
      );

      if (filterType === "automated") return isAutomated;
      if (filterType === "manual") return !isAutomated;
      return true;
    });
  }, [posts, searchQuery, filterType, postRules]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  // Statistics
  const totalPostsCount = posts.length;
  const automatedPostsCount = postRules.filter((r) => r.enabled).length;
  const aiEnabledCount = postRules.filter((r) => r.enabled && r.aiAgent?.enabled).length + (globalRule?.enabled && globalRule.aiAgent?.enabled ? 1 : 0);

  return (
    <DashboardLayoutClient>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        
        {/* TOP HERO HEADER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-900/40 p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
                  <Facebook className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      Facebook Posts & Comment Automations
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Connected
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium">
                    Page: <span className="text-white font-bold">{pageName}</span> (ID: <code className="text-blue-300 font-mono text-xs">{pageId || "N/A"}</code>)
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 max-w-2xl">
                Automatically reply to Facebook comments with keyword triggers, auto-like user comments, and attach AI Agents to answer questions 24/7.
              </p>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center flex-wrap gap-2.5">
              <Button
                onClick={() => handleOpenAutomation(null)}
                variant="outline"
                className="bg-white/10 hover:bg-white/15 text-white border-white/20 rounded-xl text-xs font-bold gap-2 h-10 shadow-sm backdrop-blur-sm cursor-pointer"
              >
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Global Post Automation</span>
                {globalRule?.enabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Button>

              <Button
                onClick={handleRefreshPosts}
                disabled={isRefreshingPosts}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold gap-2 h-10 shadow-md cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingPosts ? "animate-spin" : ""}`} />
                <span>Refresh Posts</span>
              </Button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Posts</span>
              <p className="text-xl font-black text-white mt-0.5">{totalPostsCount}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">Custom Automated</span>
              <p className="text-xl font-black text-blue-400 mt-0.5">{automatedPostsCount}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">AI Agent Linked</span>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{aiEnabledCount}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300">Global Fallback</span>
              <p className="text-xl font-black text-purple-400 mt-0.5">
                {globalRule?.enabled ? "ACTIVE" : "OFF"}
              </p>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search posts by text or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === "all"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({posts.length})
              </button>
              <button
                onClick={() => setFilterType("automated")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === "automated"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                ⚡ Automated ({automatedPostsCount})
              </button>
              <button
                onClick={() => setFilterType("manual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterType === "manual"
                    ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                No Rule ({posts.length - automatedPostsCount})
              </button>
            </div>
          </div>
        </div>

        {/* POSTS GRID */}
        {filteredPosts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Facebook posts found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery
                ? "No posts match your search query. Try clearing the filter."
                : "No posts were retrieved from your connected Facebook Page. Click 'Refresh Posts' above to sync."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedPosts.map((post) => {
                const leafId = extractLeafId(post.id);
                const customRule = postRules.find(
                  (r) => r.enabled && (r.postId === post.id || extractLeafId(r.postId) === leafId)
                );
                const isAiActive = !!customRule?.aiAgent?.enabled || (globalRule?.enabled && !!globalRule.aiAgent?.enabled);
                const keywordCount = customRule?.keywords?.length || 0;

                // Image thumbnail
                const pictureUrl =
                  post.full_picture ||
                  post.attachments?.data?.[0]?.media?.image?.src ||
                  null;

                return (
                  <div
                    key={post.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    {/* Card Header & Media */}
                    <div>
                      {pictureUrl ? (
                        <div className="h-44 w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                          <img
                            src={pictureUrl}
                            alt="Post preview"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            {isAiActive && (
                              <Badge className="bg-emerald-600/90 text-white font-black text-[9px] shadow-sm backdrop-blur-xs gap-1 border-0">
                                <Bot className="w-3 h-3" />
                                AI Agent
                              </Badge>
                            )}
                            {keywordCount > 0 && (
                              <Badge className="bg-blue-600/90 text-white font-black text-[9px] shadow-sm backdrop-blur-xs gap-1 border-0">
                                <Zap className="w-3 h-3" />
                                {keywordCount} Keywords
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/40 dark:to-slate-800/80 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Facebook className="w-5 h-5 text-blue-600" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Text Post</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isAiActive && (
                              <Badge className="bg-emerald-600/90 text-white font-black text-[9px]">
                                AI Agent
                              </Badge>
                            )}
                            {keywordCount > 0 && (
                              <Badge className="bg-blue-600 text-white font-black text-[9px]">
                                {keywordCount} Keywords
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Post Content */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            {formatDate(post.created_time)}
                          </span>
                          {post.permalink_url && (
                            <a
                              href={post.permalink_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-500 hover:text-blue-600 flex items-center gap-0.5 font-bold hover:underline"
                            >
                              <span>Post</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-200 font-medium line-clamp-3 leading-relaxed">
                          {post.message || <span className="italic text-slate-400">No caption for this post</span>}
                        </p>

                        {/* Automation Status Strip */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-500">Automation Mode:</span>
                            {customRule ? (
                              <span className="text-blue-600 dark:text-blue-400 font-extrabold">Custom Rule</span>
                            ) : globalRule?.enabled ? (
                              <span className="text-purple-600 dark:text-purple-400 font-extrabold">Global Default</span>
                            ) : (
                              <span className="text-slate-400">Disabled</span>
                            )}
                          </div>
                          {customRule?.keywords && customRule.keywords.length > 0 && (
                            <div className="text-[10px] text-slate-500 truncate">
                              Keywords: <span className="font-semibold text-slate-700 dark:text-slate-300">{customRule.keywords.map((k) => k.keyword).join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom Actions */}
                    <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleOpenAutomation(post)}
                        variant="outline"
                        className="w-full text-xs font-bold rounded-xl h-9 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 gap-1.5 cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Automation</span>
                      </Button>

                      <Button
                        onClick={() => handleOpenComments(post)}
                        variant="secondary"
                        className="w-full text-xs font-bold rounded-xl h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#00B074]" />
                        <span>Comments</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * POSTS_PER_PAGE + 1}</span> to{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{Math.min(currentPage * POSTS_PER_PAGE, filteredPosts.length)}</span> of{" "}
                  <span className="font-bold text-slate-900 dark:text-white">{filteredPosts.length}</span> posts
                </p>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-9 px-3 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1 px-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>Page</span>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-extrabold">
                      {currentPage}
                    </span>
                    <span>of {totalPages}</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-9 px-3 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1. AUTOMATION CONFIGURATION MODAL (POST / GLOBAL) */}
        <Dialog
          open={!!editingPost || isGlobalModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditingPost(null);
              setIsGlobalModalOpen(false);
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 border-slate-200 dark:border-slate-800">
            <DialogHeader className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800 text-start">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 border border-blue-600/20 flex items-center justify-center font-bold">
                    {isGlobalModalOpen ? <Globe className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-slate-900 dark:text-white">
                      {isGlobalModalOpen ? "Global Facebook Posts Automation" : "Configure Post Automation"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      {isGlobalModalOpen
                        ? "Define default comment triggers and AI intelligence that apply to ALL posts automatically."
                        : `Custom rules for Post ID: ${editingPost?.id}`}
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {currentRuleDraft.enabled ? "Active" : "Disabled"}
                  </span>
                  <Switch
                    checked={currentRuleDraft.enabled}
                    onCheckedChange={(checked) =>
                      setCurrentRuleDraft((prev) => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>
              </div>
            </DialogHeader>

            {/* TABBED CONFIGURATION */}
            <Tabs defaultValue="keywords" className="mt-4 space-y-4">
              <TabsList className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl h-11">
                <TabsTrigger value="keywords" className="rounded-xl text-xs font-extrabold gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  <span>Keyword Triggers</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-xl text-xs font-extrabold gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-500" />
                  <span>AI Agent Auto-Reply</span>
                </TabsTrigger>
                <TabsTrigger value="fallback" className="rounded-xl text-xs font-extrabold gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                  <span>Default Fallback</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: KEYWORD AUTO-REPLIES */}
              <TabsContent value="keywords" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Keyword-Based Rules
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      When a user comments with these keywords, trigger instant public replies and auto-likes.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newKw: FacebookKeywordRule = {
                        id: `kw_${Date.now()}`,
                        keyword: "",
                        matchType: "contains",
                        publicReplyText: "Hi {name}! Thanks for reaching out. We appreciate your interest.",
                        autoLike: true,
                      };
                      setCurrentRuleDraft((prev) => ({
                        ...prev,
                        keywords: [...(prev.keywords || []), newKw],
                      }));
                    }}
                    className="bg-[#00B074] hover:bg-[#009b66] text-white rounded-xl text-xs font-bold gap-1.5 h-8 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Keyword</span>
                  </Button>
                </div>

                {currentRuleDraft.keywords.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                    <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No keyword triggers configured</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click &quot;Add Keyword&quot; above to auto-reply to comments like &quot;price&quot;, &quot;link&quot;, &quot;buy&quot;, etc.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentRuleDraft.keywords.map((kw, index) => (
                      <div
                        key={kw.id || index}
                        className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Keyword
                              </label>
                              <Input
                                value={kw.keyword}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCurrentRuleDraft((prev) => {
                                    const next = [...prev.keywords];
                                    next[index].keyword = val;
                                    return { ...prev, keywords: next };
                                  });
                                }}
                                placeholder="e.g. price, order, link, help"
                                className="h-9 rounded-xl text-xs font-bold bg-white dark:bg-slate-900"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Match Condition
                              </label>
                              <Select
                                value={kw.matchType}
                                onValueChange={(val: any) => {
                                  setCurrentRuleDraft((prev) => {
                                    const next = [...prev.keywords];
                                    next[index].matchType = val;
                                    return { ...prev, keywords: next };
                                  });
                                }}
                              >
                                <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-white dark:bg-slate-900">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="contains" className="text-xs font-bold">
                                    Contains Keyword
                                  </SelectItem>
                                  <SelectItem value="exact" className="text-xs font-bold">
                                    Exact Match Only
                                  </SelectItem>
                                  <SelectItem value="starts_with" className="text-xs font-bold">
                                    Starts With Keyword
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCurrentRuleDraft((prev) => ({
                                ...prev,
                                keywords: prev.keywords.filter((_, i) => i !== index),
                              }));
                            }}
                            className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors self-end mb-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Public Comment Reply */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                              Public Comment Reply
                            </label>
                            <span className="text-[9px] text-slate-400">Use <code>{'{name}'}</code> for commenter name</span>
                          </div>
                          <Textarea
                            value={kw.publicReplyText || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentRuleDraft((prev) => {
                                const next = [...prev.keywords];
                                next[index].publicReplyText = val;
                                return { ...prev, keywords: next };
                              });
                            }}
                            rows={2}
                            placeholder="Public reply shown below the comment..."
                            className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                          />
                        </div>

                        {/* Auto-Like Checkbox */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/40 dark:border-slate-700/60">
                          <input
                            type="checkbox"
                            id={`like_${index}`}
                            checked={!!kw.autoLike}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCurrentRuleDraft((prev) => {
                                const next = [...prev.keywords];
                                next[index].autoLike = checked;
                                return { ...prev, keywords: next };
                              });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor={`like_${index}`} className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5 text-blue-500" />
                            <span>Auto-like the comment from Facebook Page</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: AI AGENT INTELLIGENCE */}
              <TabsContent value="ai" className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">
                          AI Agent Comment Responder
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Automatically answers questions on comments using LLM intelligence & your Knowledge Base.
                        </p>
                      </div>
                    </div>

                    <Switch
                      checked={!!currentRuleDraft.aiAgent?.enabled}
                      onCheckedChange={(checked) =>
                        setCurrentRuleDraft((prev) => ({
                          ...prev,
                          aiAgent: {
                            ...(prev.aiAgent || { replyMode: "public_comment", autoLike: true }),
                            enabled: checked,
                          },
                        }))
                      }
                    />
                  </div>

                  {currentRuleDraft.aiAgent?.enabled && (
                    <div className="space-y-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/40">
                      {/* Select Agent */}
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                          Link AI Agent (Trained Assistant)
                        </label>
                        <Select
                          value={currentRuleDraft.aiAgent?.agentId || "default"}
                          onValueChange={(val) =>
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: {
                                ...(prev.aiAgent || { replyMode: "public_comment", autoLike: true }),
                                agentId: val === "default" ? "" : val,
                                enabled: true,
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                            <SelectValue placeholder="Select an AI Agent..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="default" className="text-xs font-bold">
                              ✨ Smart Default Assistant (Auto)
                            </SelectItem>
                            {aiAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id} className="text-xs font-bold">
                                🤖 {agent.name} {agent.isDefault ? "(Default)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Custom Prompt / Guardrails */}
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                          Custom Instructions / Post Context for AI
                        </label>
                        <Textarea
                          value={currentRuleDraft.aiAgent?.customPrompt || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: {
                                ...(prev.aiAgent || { enabled: true }),
                                customPrompt: val,
                                enabled: true,
                              },
                            }));
                          }}
                          rows={3}
                          placeholder="e.g. Answer questions about this specific offer. Mention we offer 20% discount this week..."
                          className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                        />
                      </div>

                      {/* Auto Like */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="ai_like"
                          checked={!!currentRuleDraft.aiAgent?.autoLike}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: {
                                ...(prev.aiAgent || { enabled: true }),
                                autoLike: checked,
                                enabled: true,
                              },
                            }));
                          }}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor="ai_like" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1">
                          <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Auto-like the comment before AI responds</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 3: DEFAULT FALLBACK */}
              <TabsContent value="fallback" className="space-y-4">
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        Default Fallback Reply
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Executed when no keywords match and AI Agent is disabled.
                      </p>
                    </div>
                    <Switch
                      checked={!!currentRuleDraft.defaultReply?.enabled}
                      onCheckedChange={(checked) =>
                        setCurrentRuleDraft((prev) => ({
                          ...prev,
                          defaultReply: {
                            ...(prev.defaultReply || { autoLike: true }),
                            enabled: checked,
                          },
                        }))
                      }
                    />
                  </div>

                  {currentRuleDraft.defaultReply?.enabled && (
                    <div className="space-y-3 pt-3 border-t border-purple-200/50 dark:border-purple-800/40">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                          Public Fallback Reply
                        </label>
                        <Textarea
                          value={currentRuleDraft.defaultReply?.publicReplyText || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              defaultReply: {
                                ...(prev.defaultReply || { enabled: true, autoLike: true }),
                                publicReplyText: val,
                                enabled: true,
                              },
                            }));
                          }}
                          rows={2}
                          placeholder="Thank you for your comment, {name}! We appreciate your support."
                          className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="default_like"
                          checked={!!currentRuleDraft.defaultReply?.autoLike}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              defaultReply: {
                                ...(prev.defaultReply || { enabled: true }),
                                autoLike: checked,
                                enabled: true,
                              },
                            }));
                          }}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="default_like" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1">
                          <ThumbsUp className="w-3.5 h-3.5 text-purple-500" />
                          <span>Auto-like the comment</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              {editingPost && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDeleteAutomation(editingPost.id)}
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  <span>Remove Custom Rule</span>
                </Button>
              )}
              {isGlobalModalOpen && (
                <div className="text-[11px] text-slate-400">
                  Global rules apply to all posts on your Facebook Page.
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPost(null);
                    setIsGlobalModalOpen(false);
                  }}
                  className="rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveAutomation}
                  disabled={isSavingRule}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold gap-1.5 px-5 cursor-pointer shadow-md"
                >
                  {isSavingRule ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Automation</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 2. LIVE COMMENTS & REPLIES DRAWER */}
        <Sheet
          open={!!commentsPost}
          onOpenChange={(open) => {
            if (!open) setCommentsPost(null);
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            {/* Sheet Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#00B074]/10 text-[#00B074] flex items-center justify-center font-bold">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-black text-slate-900 dark:text-white">
                    Post Comments & Replies
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    Live comments stream with instant manual reply
                  </SheetDescription>
                </div>
              </div>

              {commentsPost?.message && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2">
                  &quot;{commentsPost.message}&quot;
                </div>
              )}
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {isCommentsLoading ? (
                <div className="py-20 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">Fetching live comments from Facebook...</p>
                </div>
              ) : commentsError ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{commentsError}</span>
                </div>
              ) : comments.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No comments found</p>
                  <p className="text-[11px] text-slate-400">When people comment on this post, they will appear here in real time.</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const draft = manualReplyDrafts[comment.id] || "";
                  const isReplying = replyingCommentId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-xs">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {comment.from?.name || "Facebook User"}
                            </span>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {formatDate(comment.created_time)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                        {comment.message || <span className="italic text-slate-400">[Media or Attachment]</span>}
                      </p>

                      {/* Inline Quick Reply Box */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                        <Input
                          value={draft}
                          onChange={(e) =>
                            setManualReplyDrafts((prev) => ({
                              ...prev,
                              [comment.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendManualReply(comment.id);
                            }
                          }}
                          placeholder={`Reply to ${comment.from?.name || "commenter"}...`}
                          className="h-8 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSendManualReply(comment.id)}
                          disabled={isReplying || !draft.trim()}
                          className="h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold gap-1 px-3 cursor-pointer shrink-0"
                        >
                          {isReplying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Reply</span>
                              <Send className="w-3 h-3" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayoutClient>
  );
}
