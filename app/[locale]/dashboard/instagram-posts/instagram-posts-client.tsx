"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Instagram,
  Image as ImageIcon,
  AlertCircle,
  ExternalLink,
  Heart,
  MessageCircle,
  Loader2,
  Zap,
  Bot,
  Settings2,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  ThumbsUp,
  Globe,
  Sliders,
  Play,
  Film,
  Calendar,
  MessageSquare,
  Layers,
  Send,
  HelpCircle,
  Sparkle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getConnectedInstagramAccountData,
  getConnectedInstagramPostComments,
  getInstagramPostAutomations,
  saveInstagramPostAutomation,
  deleteInstagramPostAutomation,
  getInstagramStoryAutomations,
  saveInstagramStoryAutomation,
  deleteInstagramStoryAutomation,
  replyToConnectedInstagramComment,
  type InstagramKeywordRule,
  type InstagramPostAutomationRule,
  type InstagramStoryAutomationRule,
} from "@/app/actions/instagram-page";

type InstagramProfilePayload = {
  id: string;
  username: string;
  name: string;
  biography: string;
  profilePictureUrl: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
};

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramStory = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
};

type InstagramComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  replies?: {
    data?: Array<{
      id: string;
      text?: string;
      username?: string;
      timestamp?: string;
    }>;
  };
};

type InitialPayload = {
  profile: InstagramProfilePayload;
  media: InstagramMedia[];
  stories?: InstagramStory[];
} | null;

type AiAgentOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

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

export default function InstagramPostsClient({
  initialPayload,
  initialError,
}: {
  initialPayload: InitialPayload;
  initialError: string | null;
}) {
  const t = useTranslations("InstagramPosts");

  const [activeTab, setActiveTab] = useState<"posts" | "stories">("posts");
  const [posts, setPosts] = useState<InstagramMedia[]>(initialPayload?.media || []);
  const [stories, setStories] = useState<InstagramStory[]>(initialPayload?.stories || []);
  const [profile, setProfile] = useState<InstagramProfilePayload | null>(
    initialPayload?.profile || null
  );
  const [isRefreshingPosts, setIsRefreshingPosts] = useState(false);
  const [viewingStory, setViewingStory] = useState<InstagramStory | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "automated" | "no_rules">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 24;

  // Automations & AI State for Posts
  const [postRules, setPostRules] = useState<InstagramPostAutomationRule[]>([]);
  const [globalRule, setGlobalRule] = useState<InstagramPostAutomationRule | null>(null);
  const [aiAgents, setAiAgents] = useState<AiAgentOption[]>([]);
  const [isLoadingAutomations, setIsLoadingAutomations] = useState(false);

  // Automations State for Stories
  const [storyRules, setStoryRules] = useState<InstagramStoryAutomationRule[]>([]);
  const [globalStoryRule, setGlobalStoryRule] = useState<InstagramStoryAutomationRule | null>(null);

  // Active Post for Editing Automation
  const [editingPost, setEditingPost] = useState<InstagramMedia | null>(null);
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
  const [currentRuleDraft, setCurrentRuleDraft] = useState<InstagramPostAutomationRule>({
    postId: "",
    enabled: true,
    keywords: [],
    defaultReply: { enabled: false, publicReplyText: "", autoLike: true },
    aiAgent: { enabled: false, autoLike: true, customPrompt: "" },
  });
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Active Story for Editing Automation
  const [editingStory, setEditingStory] = useState<InstagramStory | null>(null);
  const [isGlobalStoryModalOpen, setIsGlobalStoryModalOpen] = useState(false);
  const [currentStoryRuleDraft, setCurrentStoryRuleDraft] = useState<InstagramStoryAutomationRule>({
    storyId: "",
    enabled: true,
    keywords: [],
    defaultReply: { enabled: false, dmReplyText: "" },
    aiAgent: { enabled: false, customPrompt: "" },
  });
  const [isSavingStoryRule, setIsSavingStoryRule] = useState(false);

  // Active Post for Viewing Comments Drawer
  const [commentsPost, setCommentsPost] = useState<InstagramMedia | null>(null);
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [manualReplyDrafts, setManualReplyDrafts] = useState<Record<string, string>>({});
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);

  // Load Automations
  const loadAutomations = async () => {
    setIsLoadingAutomations(true);
    try {
      const [postRes, storyRes] = await Promise.all([
        getInstagramPostAutomations(),
        getInstagramStoryAutomations().catch(() => ({ storyRules: [], globalStoryRule: null, aiAgents: [] })),
      ]);
      setPostRules(postRes.postRules || []);
      setGlobalRule(postRes.globalRule || null);
      setAiAgents(postRes.aiAgents || []);
      setStoryRules(storyRes.storyRules || []);
      setGlobalStoryRule(storyRes.globalStoryRule || null);
    } catch (err: any) {
      console.warn("Failed to load Instagram automations:", err?.message);
    } finally {
      setIsLoadingAutomations(false);
    }
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  // Refresh posts list
  const handleRefreshPosts = async () => {
    setIsRefreshingPosts(true);
    try {
      const res = await getConnectedInstagramAccountData({ fetchAll: true });
      if (res?.media) {
        setPosts(res.media);
        if (res.profile) setProfile(res.profile);
        if (res.stories) setStories(res.stories);
        toast.success(`Instagram media refreshed successfully! Loaded ${res.media.length} posts.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to refresh Instagram posts.");
    } finally {
      setIsRefreshingPosts(false);
    }
  };

  // Open Automation Modal for Posts
  const handleOpenAutomation = (post: InstagramMedia | null) => {
    if (post) {
      setEditingPost(post);
      const existing = postRules.find((r) => r.postId === post.id);

      if (existing) {
        setCurrentRuleDraft(JSON.parse(JSON.stringify(existing)));
      } else {
        setCurrentRuleDraft({
          postId: post.id,
          enabled: true,
          keywords: [
            {
              id: `kw_${Date.now()}`,
              keyword: "price",
              matchType: "contains",
              publicReplyText: "Hi @{name}! Thanks for asking. We'd love to help you with the pricing and details.",
              autoLike: true,
            },
          ],
          defaultReply: {
            enabled: false,
            publicReplyText: "Hi @{name}! Thanks for your comment. Our team will get back to you shortly.",
            autoLike: true,
          },
          aiAgent: {
            enabled: false,
            agentId: aiAgents[0]?.id || "",
            autoLike: true,
            customPrompt: `Answer questions about this Instagram post: "${post.caption || 'our product'}". Be engaging, friendly, and helpful.`,
          },
        });
      }
    } else {
      // Global Post Rule
      setIsGlobalModalOpen(true);
      if (globalRule) {
        setCurrentRuleDraft(JSON.parse(JSON.stringify(globalRule)));
      } else {
        setCurrentRuleDraft({
          postId: "ALL",
          enabled: true,
          keywords: [
            {
              id: `kw_global_${Date.now()}`,
              keyword: "info",
              matchType: "contains",
              publicReplyText: "Hi @{name}! Thanks for reaching out. Let us know how we can help!",
              autoLike: true,
            },
          ],
          defaultReply: {
            enabled: true,
            publicReplyText: "Hi @{name}! Thank you for your comment. We appreciate your support!",
            autoLike: true,
          },
          aiAgent: {
            enabled: false,
            agentId: aiAgents[0]?.id || "",
            autoLike: true,
            customPrompt: "Act as our Instagram social media assistant. Answer questions concisely and politely.",
          },
        });
      }
    }
  };

  // Save Post Rule Draft
  const handleSaveAutomation = async () => {
    if (!currentRuleDraft.postId) return;
    setIsSavingRule(true);
    try {
      const res = await saveInstagramPostAutomation(currentRuleDraft);
      if (res.isGlobal) {
        setGlobalRule(currentRuleDraft);
        toast.success("Global Instagram automation saved successfully!");
        setIsGlobalModalOpen(false);
      } else {
        setPostRules((prev) => {
          const idx = prev.findIndex((r) => r.postId === currentRuleDraft.postId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = currentRuleDraft;
            return next;
          }
          return [...prev, currentRuleDraft];
        });
        toast.success("Post automation saved successfully!");
        setEditingPost(null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save automation rule.");
    } finally {
      setIsSavingRule(false);
    }
  };

  // Delete Post Rule
  const handleDeleteAutomation = async (postId: string) => {
    try {
      await deleteInstagramPostAutomation(postId);
      if (postId === "ALL") {
        setGlobalRule(null);
        setIsGlobalModalOpen(false);
        toast.success("Global automation rule deleted.");
      } else {
        setPostRules((prev) => prev.filter((r) => r.postId !== postId));
        setEditingPost(null);
        toast.success("Post automation rule deleted.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete rule.");
    }
  };

  // Open Story Automation Modal
  const handleOpenStoryAutomation = (story: InstagramStory | null) => {
    if (story) {
      setEditingStory(story);
      const existing = storyRules.find((r) => r.storyId === story.id);

      if (existing) {
        setCurrentStoryRuleDraft(JSON.parse(JSON.stringify(existing)));
      } else {
        setCurrentStoryRuleDraft({
          storyId: story.id,
          enabled: true,
          keywords: [],
          defaultReply: {
            enabled: true,
            dmReplyText: "Hi @{name}! Thanks for replying to our story! How can we assist you today?",
          },
          aiAgent: {
            enabled: false,
            agentId: aiAgents[0]?.id || "",
            customPrompt: `The customer is replying to our Instagram story: "${story.caption || 'our active story'}". Provide a friendly, concise, and helpful direct message response.`,
          },
        });
      }
    } else {
      // Global Story Rule
      setIsGlobalStoryModalOpen(true);
      if (globalStoryRule) {
        setCurrentStoryRuleDraft(JSON.parse(JSON.stringify(globalStoryRule)));
      } else {
        setCurrentStoryRuleDraft({
          storyId: "ALL_STORIES",
          enabled: true,
          keywords: [],
          defaultReply: {
            enabled: true,
            dmReplyText: "Hi @{name}! Thanks for watching and replying to our story! Let us know how we can help.",
          },
          aiAgent: {
            enabled: false,
            agentId: aiAgents[0]?.id || "",
            customPrompt: "Act as our Instagram story DM assistant. Answer story inquiries politely and helpfully in DM.",
          },
        });
      }
    }
  };

  // Save Story Rule Draft
  const handleSaveStoryAutomation = async () => {
    if (!currentStoryRuleDraft.storyId) return;
    setIsSavingStoryRule(true);
    try {
      const res = await saveInstagramStoryAutomation(currentStoryRuleDraft);
      if (res.isGlobal) {
        setGlobalStoryRule(currentStoryRuleDraft);
        toast.success("Global story automation saved successfully!");
        setIsGlobalStoryModalOpen(false);
      } else {
        setStoryRules((prev) => {
          const idx = prev.findIndex((r) => r.storyId === currentStoryRuleDraft.storyId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = currentStoryRuleDraft;
            return next;
          }
          return [...prev, currentStoryRuleDraft];
        });
        toast.success("Story automation saved successfully!");
        setEditingStory(null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save story automation rule.");
    } finally {
      setIsSavingStoryRule(false);
    }
  };

  // Delete Story Rule
  const handleDeleteStoryAutomation = async (storyId: string) => {
    try {
      await deleteInstagramStoryAutomation(storyId);
      if (storyId === "ALL_STORIES") {
        setGlobalStoryRule(null);
        setIsGlobalStoryModalOpen(false);
        toast.success("Global story automation deleted.");
      } else {
        setStoryRules((prev) => prev.filter((r) => r.storyId !== storyId));
        setEditingStory(null);
        toast.success("Story automation rule deleted.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete story rule.");
    }
  };

  // Open Comments Drawer
  const handleOpenComments = async (post: InstagramMedia) => {
    setCommentsPost(post);
    setIsCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await getConnectedInstagramPostComments(post.id, 50);
      setComments(res.comments || []);
    } catch (err: any) {
      setCommentsError(err?.message || "Failed to fetch Instagram comments.");
    } finally {
      setIsCommentsLoading(false);
    }
  };

  // Send Manual Reply
  const handleSendManualReply = async (commentId: string) => {
    const text = manualReplyDrafts[commentId]?.trim();
    if (!text) {
      toast.error("Please type a reply message first.");
      return;
    }
    setReplyingCommentId(commentId);
    try {
      await replyToConnectedInstagramComment(commentId, text);
      toast.success("Reply published to Instagram!");
      setManualReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
      if (commentsPost) {
        const refreshed = await getConnectedInstagramPostComments(commentsPost.id, 50);
        setComments(refreshed.comments || []);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send Instagram reply.");
    } finally {
      setReplyingCommentId(null);
    }
  };

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.id.includes(searchQuery);

      if (!matchesSearch) return false;

      const rule = postRules.find((r) => r.postId === post.id);
      const isAutomated = !!(rule && rule.enabled);

      if (filterType === "automated") return isAutomated;
      if (filterType === "no_rules") return !isAutomated;
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

  // Metrics
  const automatedCount = useMemo(() => {
    return posts.filter((p) => postRules.some((r) => r.postId === p.id && r.enabled)).length;
  }, [posts, postRules]);

  const aiEnabledCount = useMemo(() => {
    return posts.filter((p) =>
      postRules.some((r) => r.postId === p.id && r.enabled && r.aiAgent?.enabled)
    ).length;
  }, [posts, postRules]);

  const automatedStoriesCount = useMemo(() => {
    return stories.filter((s) => storyRules.some((r) => r.storyId === s.id && r.enabled)).length;
  }, [stories, storyRules]);

  const aiStoriesCount = useMemo(() => {
    return stories.filter((s) =>
      storyRules.some((r) => r.storyId === s.id && r.enabled && r.aiAgent?.enabled)
    ).length;
  }, [stories, storyRules]);

  if (initialError) {
    return (
      <DashboardLayoutClient>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col items-center justify-center">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] flex items-center justify-center mx-auto text-white shadow-lg shadow-pink-500/20">
              <Instagram className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Connect Instagram Account
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {initialError}
            </p>
            <div className="pt-2">
              <Link href="/en/dashboard/settings">
                <Button className="w-full bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white font-bold rounded-xl h-11 shadow-md">
                  Go to Settings & Connect
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          {/* TOP HERO BANNER */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] p-6 sm:p-8 text-white shadow-xl shadow-pink-500/10">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-white">
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram Social Automation Suite</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Instagram Posts & Stories
                  </h1>
                  {profile && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/20 text-xs text-white font-medium">
                      {profile.profilePictureUrl ? (
                        <img
                          src={profile.profilePictureUrl}
                          alt={profile.username}
                          className="w-5 h-5 rounded-full object-cover border border-white/40"
                        />
                      ) : (
                        <Instagram className="w-4 h-4 text-white" />
                      )}
                      <span className="font-bold">@{profile.username}</span>
                      <span className="text-white/60">· {profile.followersCount.toLocaleString()} followers</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-white/80 max-w-2xl">
                  Automate public comment replies on your posts and instant DM responses on your Instagram Stories with keywords, default messages, and 24/7 AI Agents.
                </p>
              </div>

              {/* Top Action Buttons */}
              <div className="flex items-center flex-wrap gap-2.5">
                <Button
                  onClick={() => {
                    if (activeTab === "stories") {
                      handleOpenStoryAutomation(null);
                    } else {
                      handleOpenAutomation(null);
                    }
                  }}
                  variant="outline"
                  className="bg-white/15 hover:bg-white/25 text-white border-white/30 rounded-xl text-xs font-bold gap-2 h-10 shadow-sm backdrop-blur-sm cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-amber-200" />
                  <span>{activeTab === "stories" ? "Global Story Automation" : "Global Post Automation"}</span>
                  {(activeTab === "stories" ? globalStoryRule?.enabled : globalRule?.enabled) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </Button>

                <Button
                  onClick={handleRefreshPosts}
                  disabled={isRefreshingPosts}
                  className="bg-white hover:bg-white/90 text-slate-900 rounded-xl text-xs font-black gap-2 h-10 shadow-md cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingPosts ? "animate-spin text-rose-500" : "text-rose-500"}`} />
                  <span>{isRefreshingPosts ? "Syncing..." : "Sync Posts & Stories"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* MAIN TAB SWITCHER (Posts vs Stories) */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3 p-1.5 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <button
                onClick={() => setActiveTab("posts")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === "posts"
                    ? "bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-md scale-[1.02]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Feed Posts & Reels</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
                  {posts.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("stories")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === "stories"
                    ? "bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white shadow-md shadow-pink-500/20 scale-[1.02]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Active Stories & Automations</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === "stories" ? "bg-white/25 text-white" : "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                }`}>
                  {stories.length}
                </span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Instagram Graph API Connected</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: FEED POSTS & REELS */}
          {/* ========================================================================= */}
          {activeTab === "posts" && (
            <div className="space-y-8">
              {/* METRICS COUNTER BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Synced</span>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{posts.length}</p>
                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                      <Instagram className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Automated Posts</span>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{automatedCount}</p>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI Agent Linked</span>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{aiEnabledCount}</p>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Global Fallback</span>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-purple-600 dark:text-purple-400">
                      {globalRule?.enabled ? "Active" : "Disabled"}
                    </p>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEARCH & FILTERS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search captions or ID..."
                    className="pl-10 h-10 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 self-stretch sm:self-auto">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      filterType === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    All ({posts.length})
                  </button>
                  <button
                    onClick={() => setFilterType("automated")}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      filterType === "automated"
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    ⚡ Automated ({automatedCount})
                  </button>
                  <button
                    onClick={() => setFilterType("no_rules")}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      filterType === "no_rules"
                        ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    No Rule ({posts.length - automatedCount})
                  </button>
                </div>
              </div>

              {/* POSTS GRID */}
              {filteredPosts.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <Instagram className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-black text-slate-700 dark:text-slate-200">No Instagram Posts Found</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {searchQuery
                      ? "No posts match your search query."
                      : "No Instagram posts available. Click 'Sync Posts' above to refresh from Instagram."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedPosts.map((post) => {
                      const rule = postRules.find((r) => r.postId === post.id);
                      const isAutomated = !!(rule && rule.enabled);
                      const isVideo = post.media_type === "VIDEO";
                      const isCarousel = post.media_type === "CAROUSEL_ALBUM";
                      const mediaPreview = post.thumbnail_url || post.media_url;

                      return (
                        <div
                          key={post.id}
                          className={`group flex flex-col rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-xl ${
                            isAutomated
                              ? "border-pink-500/30 dark:border-pink-500/20 hover:border-pink-500"
                              : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          {/* Media Header & Thumbnail */}
                          <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            {mediaPreview ? (
                              <img
                                src={mediaPreview}
                                alt={post.caption || "Instagram Post"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-10 h-10" />
                              </div>
                            )}

                            {/* Media Type Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase">
                              {isVideo ? (
                                <>
                                  <Film className="w-3 h-3 text-pink-400" />
                                  <span>Reel/Video</span>
                                </>
                              ) : isCarousel ? (
                                <>
                                  <Layers className="w-3 h-3 text-amber-400" />
                                  <span>Carousel</span>
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-3 h-3 text-blue-400" />
                                  <span>Photo</span>
                                </>
                              )}
                            </div>

                            {/* Automation Status Badge */}
                            <div className="absolute top-3 right-3">
                              {isAutomated ? (
                                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-md">
                                  <Zap className="w-3 h-3 fill-white" />
                                  <span>Automated</span>
                                </div>
                              ) : (
                                <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/80 text-[10px] font-bold">
                                  No Rules
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(post.timestamp)}
                                </span>
                                <span className="font-mono text-[10px]">ID: {post.id}</span>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-200 font-medium line-clamp-3 leading-relaxed">
                                {post.caption || "No caption provided."}
                              </p>
                            </div>

                            {/* Rule Summary Pill */}
                            {rule && rule.enabled && (
                              <div className="p-3 rounded-2xl bg-pink-50/60 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/40 text-[11px] space-y-1.5">
                                <div className="flex items-center justify-between font-bold text-pink-700 dark:text-pink-300">
                                  <span className="flex items-center gap-1">
                                    <Sliders className="w-3 h-3" />
                                    <span>Active Keywords ({rule.keywords?.length || 0})</span>
                                  </span>
                                  {rule.aiAgent?.enabled && (
                                    <span className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                                      <Bot className="w-3 h-3" />
                                      <span>AI Enabled</span>
                                    </span>
                                  )}
                                </div>
                                {rule.keywords && rule.keywords.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {rule.keywords.slice(0, 3).map((kw) => (
                                      <span
                                        key={kw.id}
                                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-800 text-[10px] font-mono text-pink-600 dark:text-pink-400"
                                      >
                                        "{kw.keyword}"
                                      </span>
                                    ))}
                                    {rule.keywords.length > 3 && (
                                      <span className="text-[10px] text-slate-400 self-center">
                                        +{rule.keywords.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenComments(post)}
                                  className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-pink-500 hover:text-pink-600"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Comments</span>
                                  {typeof post.comments_count === "number" && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ({post.comments_count})
                                    </span>
                                  )}
                                </Button>

                                {post.permalink && (
                                  <a
                                    href={post.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    title="View on Instagram"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>

                              <Button
                                size="sm"
                                onClick={() => handleOpenAutomation(post)}
                                className={`h-9 px-3 rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-sm ${
                                  isAutomated
                                    ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                                    : "bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white"
                                }`}
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                                <span>{isAutomated ? "Edit Rules" : "Set Rules"}</span>
                              </Button>
                            </div>
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
                          <span className="px-2 py-0.5 rounded-lg bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400 font-extrabold">
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ACTIVE STORIES & STORY AUTOMATIONS */}
          {/* ========================================================================= */}
          {activeTab === "stories" && (
            <div className="space-y-8">
              {/* STORIES KPI METRICS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Stories (24h)</span>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stories.length}</p>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Automated Stories</span>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{automatedStoriesCount}</p>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI DM Linked</span>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{aiStoriesCount}</p>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Global Story Rule</span>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-pink-600 dark:text-pink-400">
                      {globalStoryRule?.enabled ? "Active" : "Disabled"}
                    </p>
                    <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* GLOBAL STORY BANNER */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900/90 via-pink-900/90 to-rose-900/90 text-white border border-purple-500/20 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-pink-300" />
                    <h3 className="text-sm font-black text-white">Global Story Reply Automation</h3>
                    {globalStoryRule?.enabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black">
                        Active Fallback
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-[10px] font-bold">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/80 max-w-2xl">
                    When someone replies to ANY of your active Instagram stories, send automated DM responses, discount links, or let your AI Agent answer instantly.
                  </p>
                </div>

                <Button
                  onClick={() => handleOpenStoryAutomation(null)}
                  className="bg-white hover:bg-white/90 text-purple-950 rounded-xl text-xs font-black gap-2 h-10 shadow-md cursor-pointer self-start md:self-auto"
                >
                  <Settings2 className="w-4 h-4 text-pink-600" />
                  <span>Configure Global Story Rule</span>
                </Button>
              </div>

              {/* STORIES GRID (9:16 Vertical Cards) */}
              {stories.length === 0 ? (
                <div className="p-16 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] flex items-center justify-center mx-auto text-white shadow-lg">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-800 dark:text-white">No Active Stories Found</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Instagram Stories expire automatically after 24 hours. When you post new stories to your Instagram account, click "Sync Posts & Stories" above to load and automate them.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {stories.map((story) => {
                    const rule = storyRules.find((r) => r.storyId === story.id);
                    const isAutomated = !!(rule && rule.enabled);
                    const isVideo = story.media_type === "VIDEO";
                    const mediaPreview = story.thumbnail_url || story.media_url;

                    return (
                      <div
                        key={story.id}
                        className={`group relative flex flex-col rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-2xl ${
                          isAutomated
                            ? "border-pink-500/40 dark:border-pink-500/30 hover:border-pink-500 ring-2 ring-pink-500/10"
                            : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        {/* 9:16 Vertical Preview Container */}
                        <div className="relative aspect-[9/14] w-full bg-slate-950 overflow-hidden">
                          {mediaPreview ? (
                            <img
                              src={mediaPreview}
                              alt={story.caption || "Instagram Story"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                              <Sparkles className="w-10 h-10 text-pink-500" />
                              <span className="text-xs font-bold">Story Media</span>
                            </div>
                          )}

                          {/* Gradient Overlays */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />

                          {/* Top Overlay Badges */}
                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase">
                              {isVideo ? (
                                <>
                                  <Film className="w-3 h-3 text-pink-400" />
                                  <span>Video Story</span>
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-3 h-3 text-blue-400" />
                                  <span>Photo Story</span>
                                </>
                              )}
                            </div>

                            {/* Automation Status Badge */}
                            {isAutomated ? (
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-md">
                                <Zap className="w-3 h-3 fill-white" />
                                <span>Automated</span>
                              </div>
                            ) : (
                              <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/80 text-[10px] font-bold">
                                No Rules
                              </div>
                            )}
                          </div>

                          {/* Center Play / Click Icon */}
                          <button
                            onClick={() => setViewingStory(story)}
                            className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer"
                          >
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-lg">
                              {isVideo ? (
                                <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                              ) : (
                                <Sparkles className="w-5 h-5 text-white" />
                              )}
                            </div>
                          </button>

                          {/* Bottom Info Overlay */}
                          <div className="absolute bottom-3 left-3 right-3 z-10 space-y-2">
                            <div className="text-[10px] text-white/70 flex items-center justify-between">
                              <span>{formatDate(story.timestamp)}</span>
                              <span className="font-mono">ID: {story.id.slice(-6)}</span>
                            </div>

                            {story.caption ? (
                              <p className="text-xs text-white font-semibold line-clamp-2 leading-tight">
                                {story.caption}
                              </p>
                            ) : (
                              <p className="text-[11px] text-white/60 italic">Active 24h Story</p>
                            )}

                            {/* Quick Rule Tag */}
                            {rule && rule.enabled && (
                              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-[10px] text-white flex items-center justify-between">
                                <span className="font-bold flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-amber-300" />
                                  {rule.keywords?.length || 0} Keyword Triggers
                                </span>
                                {rule.aiAgent?.enabled && (
                                  <span className="text-blue-300 font-bold flex items-center gap-0.5">
                                    <Bot className="w-3 h-3" />
                                    AI Active
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Story Card Footer Actions */}
                        <div className="p-4 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingStory(story)}
                            className="flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-pink-500"
                          >
                            <Play className="w-3.5 h-3.5 text-pink-500" />
                            <span>Preview</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenStoryAutomation(story)}
                            className={`flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-sm ${
                              isAutomated
                                ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                                : "bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white"
                            }`}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>{isAutomated ? "Edit Auto" : "Automate"}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* POST AUTOMATION CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      <Dialog
        open={!!editingPost || isGlobalModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPost(null);
            setIsGlobalModalOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl">
          <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-1 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white flex items-center justify-center shadow-md">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 dark:text-white">
                  {editingPost ? "Post Comment Automation" : "Global Instagram Post Automation"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {editingPost
                    ? `Configuring rules for post ID: ${editingPost.id}`
                    : "Fallback automation applied to all posts without individual rules."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Rule Enabled Switch */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Enable Automation Rule
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  When active, comment webhooks will trigger public replies and likes.
                </p>
              </div>
              <Switch
                checked={currentRuleDraft.enabled}
                onCheckedChange={(checked) =>
                  setCurrentRuleDraft((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            {/* Automation Modes Tabs */}
            <Tabs defaultValue="keywords" className="w-full">
              <TabsList className="grid grid-cols-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 h-11">
                <TabsTrigger value="keywords" className="rounded-xl text-xs font-bold gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-pink-500" />
                  <span>Keywords ({currentRuleDraft.keywords?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-xl text-xs font-bold gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-500" />
                  <span>AI Agent</span>
                </TabsTrigger>
                <TabsTrigger value="fallback" className="rounded-xl text-xs font-bold gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                  <span>Default Reply</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: KEYWORDS */}
              <TabsContent value="keywords" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    Respond based on specific keywords found in comments
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newKw: InstagramKeywordRule = {
                        id: `kw_${Date.now()}`,
                        keyword: "",
                        matchType: "contains",
                        publicReplyText: "Hi @{name}! Thanks for reaching out.",
                        autoLike: true,
                      };
                      setCurrentRuleDraft((prev) => ({
                        ...prev,
                        keywords: [...(prev.keywords || []), newKw],
                      }));
                    }}
                    className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 cursor-pointer border border-pink-200 dark:border-pink-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Keyword</span>
                  </Button>
                </div>

                {(!currentRuleDraft.keywords || currentRuleDraft.keywords.length === 0) ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <Zap className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No keyword rules yet</p>
                    <p className="text-[11px] text-slate-400">Add keywords like "price", "how to buy", or "info" to trigger automated replies.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentRuleDraft.keywords.map((kw, idx) => (
                      <div
                        key={kw.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={kw.keyword}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCurrentRuleDraft((prev) => {
                                  const kws = [...(prev.keywords || [])];
                                  kws[idx] = { ...kws[idx], keyword: val };
                                  return { ...prev, keywords: kws };
                                });
                              }}
                              placeholder="e.g. price, details, offer"
                              className="h-9 text-xs font-bold bg-white dark:bg-slate-900 rounded-xl"
                            />

                            <Select
                              value={kw.matchType}
                              onValueChange={(val: any) => {
                                setCurrentRuleDraft((prev) => {
                                  const kws = [...(prev.keywords || [])];
                                  kws[idx] = { ...kws[idx], matchType: val };
                                  return { ...prev, keywords: kws };
                                });
                              }}
                            >
                              <SelectTrigger className="w-32 h-9 text-xs font-bold rounded-xl bg-white dark:bg-slate-900">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="exact">Exact Match</SelectItem>
                                <SelectItem value="starts_with">Starts With</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCurrentRuleDraft((prev) => ({
                                ...prev,
                                keywords: (prev.keywords || []).filter((_, i) => i !== idx),
                              }));
                            }}
                            className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Public Reply Field */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Public Comment Reply
                          </label>
                          <Textarea
                            value={kw.publicReplyText || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentRuleDraft((prev) => {
                                const kws = [...(prev.keywords || [])];
                                kws[idx] = { ...kws[idx], publicReplyText: val };
                                return { ...prev, keywords: kws };
                              });
                            }}
                            rows={2}
                            placeholder="Use {name} for commenter name, e.g.: Hi @{name}! We sent you details."
                            className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id={`like_${kw.id}`}
                            checked={!!kw.autoLike}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCurrentRuleDraft((prev) => {
                                const kws = [...(prev.keywords || [])];
                                kws[idx] = { ...kws[idx], autoLike: checked };
                                return { ...prev, keywords: kws };
                              });
                            }}
                            className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                          />
                          <label htmlFor={`like_${kw.id}`} className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5 text-pink-500" />
                            <span>Auto-like the comment</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: AI AGENT */}
              <TabsContent value="ai" className="space-y-4 pt-4">
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-blue-500" />
                        <span>Enable AI Agent Intelligence</span>
                      </span>
                      <p className="text-[11px] text-blue-700 dark:text-blue-400">
                        When no keyword matches, the AI Agent will read the comment and write a personalized reply.
                      </p>
                    </div>
                    <Switch
                      checked={!!currentRuleDraft.aiAgent?.enabled}
                      onCheckedChange={(checked) =>
                        setCurrentRuleDraft((prev) => ({
                          ...prev,
                          aiAgent: {
                            ...(prev.aiAgent || { autoLike: true }),
                            enabled: checked,
                            agentId: prev.aiAgent?.agentId || aiAgents[0]?.id,
                          },
                        }))
                      }
                    />
                  </div>

                  {currentRuleDraft.aiAgent?.enabled && (
                    <div className="space-y-4 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Select AI Agent
                        </label>
                        <Select
                          value={currentRuleDraft.aiAgent.agentId || (aiAgents[0]?.id || "")}
                          onValueChange={(val) =>
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: { ...(prev.aiAgent || { enabled: true }), agentId: val },
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 text-xs font-bold rounded-xl bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Choose an AI Agent" />
                          </SelectTrigger>
                          <SelectContent>
                            {aiAgents.map((ag) => (
                              <SelectItem key={ag.id} value={ag.id}>
                                {ag.name} {ag.isDefault ? "(Default)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Custom Instructions / Post Context (Optional)
                        </label>
                        <Textarea
                          value={currentRuleDraft.aiAgent.customPrompt || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: { ...(prev.aiAgent || { enabled: true }), customPrompt: val },
                            }));
                          }}
                          rows={3}
                          placeholder="e.g. This post promotes our summer shoe sale. Inform users that free shipping applies to all orders above $50."
                          className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 3: DEFAULT FALLBACK */}
              <TabsContent value="fallback" className="space-y-4 pt-4">
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                        <span>Static Default Fallback</span>
                      </span>
                      <p className="text-[11px] text-purple-700 dark:text-purple-400">
                        Always reply with this static message if no keyword matches and AI is disabled.
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
                            publicReplyText: prev.defaultReply?.publicReplyText || "Thanks for your comment, @{name}!",
                          },
                        }))
                      }
                    />
                  </div>

                  {currentRuleDraft.defaultReply?.enabled && (
                    <div className="space-y-3 pt-2 border-t border-purple-200/50 dark:border-purple-800/50">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                          placeholder="Thank you for your comment, @{name}! We appreciate your support."
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
          </div>

          <DialogFooter className="p-6 pt-4 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {editingPost && postRules.some((r) => r.postId === editingPost.id) && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteAutomation(editingPost.id)}
                  className="rounded-xl text-xs font-bold gap-1.5 h-9"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Rule</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingPost(null);
                  setIsGlobalModalOpen(false);
                }}
                className="rounded-xl text-xs font-bold h-9 bg-white dark:bg-slate-900"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSaveAutomation}
                disabled={isSavingRule}
                className="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white rounded-xl text-xs font-black gap-2 h-9 shadow-md cursor-pointer"
              >
                {isSavingRule ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Save Automation</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* STORY AUTOMATION CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      <Dialog
        open={!!editingStory || isGlobalStoryModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingStory(null);
            setIsGlobalStoryModalOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl">
          <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-1 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 dark:text-white">
                  {editingStory ? "Instagram Story DM Automation" : "Global Story Reply Automation"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {editingStory
                    ? `Auto-reply directly to customer DMs when they reply to story ID: ${editingStory.id}`
                    : "Universal fallback DM auto-reply whenever someone replies to ANY active story."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Rule Enabled Switch */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Enable Story Reply Automation
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  When enabled, story replies will automatically send direct messages (DMs) to the user.
                </p>
              </div>
              <Switch
                checked={currentStoryRuleDraft.enabled}
                onCheckedChange={(checked) =>
                  setCurrentStoryRuleDraft((prev) => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            {/* Story Modes Tabs */}
            <Tabs defaultValue="keywords" className="w-full">
              <TabsList className="grid grid-cols-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 h-11">
                <TabsTrigger value="keywords" className="rounded-xl text-xs font-bold gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-pink-500" />
                  <span>Keyword Triggers ({currentStoryRuleDraft.keywords?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="rounded-xl text-xs font-bold gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-500" />
                  <span>AI Agent</span>
                </TabsTrigger>
                <TabsTrigger value="fallback" className="rounded-xl text-xs font-bold gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                  <span>Default DM</span>
                </TabsTrigger>
              </TabsList>

              {/* STORY TAB 1: KEYWORDS */}
              <TabsContent value="keywords" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    Respond with customized DM messages based on user reaction/text
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newKw: InstagramKeywordRule = {
                        id: `kw_story_${Date.now()}`,
                        keyword: "",
                        matchType: "contains",
                        publicReplyText: "Hi @{name}! Here is your link: https://yoursite.com",
                      };
                      setCurrentStoryRuleDraft((prev) => ({
                        ...prev,
                        keywords: [...(prev.keywords || []), newKw],
                      }));
                    }}
                    className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 cursor-pointer border border-pink-200 dark:border-pink-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Story Keyword</span>
                  </Button>
                </div>

                {(!currentStoryRuleDraft.keywords || currentStoryRuleDraft.keywords.length === 0) ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <Zap className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No story keywords configured</p>
                    <p className="text-[11px] text-slate-400">Add triggers like "offer", "discount", "link", or "price" to send instant automated DMs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentStoryRuleDraft.keywords.map((kw, idx) => (
                      <div
                        key={kw.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={kw.keyword}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCurrentStoryRuleDraft((prev) => {
                                  const kws = [...(prev.keywords || [])];
                                  kws[idx] = { ...kws[idx], keyword: val };
                                  return { ...prev, keywords: kws };
                                });
                              }}
                              placeholder="e.g. link, offer, price, yes"
                              className="h-9 text-xs font-bold bg-white dark:bg-slate-900 rounded-xl"
                            />

                            <Select
                              value={kw.matchType}
                              onValueChange={(val: any) => {
                                setCurrentStoryRuleDraft((prev) => {
                                  const kws = [...(prev.keywords || [])];
                                  kws[idx] = { ...kws[idx], matchType: val };
                                  return { ...prev, keywords: kws };
                                });
                              }}
                            >
                              <SelectTrigger className="w-32 h-9 text-xs font-bold rounded-xl bg-white dark:bg-slate-900">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="exact">Exact Match</SelectItem>
                                <SelectItem value="starts_with">Starts With</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCurrentStoryRuleDraft((prev) => ({
                                ...prev,
                                keywords: (prev.keywords || []).filter((_, i) => i !== idx),
                              }));
                            }}
                            className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Direct DM Reply Text */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Direct Message (DM) Reply Text
                          </label>
                          <Textarea
                            value={kw.publicReplyText || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentStoryRuleDraft((prev) => {
                                const kws = [...(prev.keywords || [])];
                                kws[idx] = { ...kws[idx], publicReplyText: val };
                                return { ...prev, keywords: kws };
                              });
                            }}
                            rows={2}
                            placeholder="e.g.: Hey @{name}! Here is your exclusive link for this story: https://yoursite.com"
                            className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* STORY TAB 2: AI AGENT */}
              <TabsContent value="ai" className="space-y-4 pt-4">
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-blue-500" />
                        <span>Enable Story AI Agent</span>
                      </span>
                      <p className="text-[11px] text-blue-700 dark:text-blue-400">
                        When a user replies with any question or reaction, your AI Agent responds in DM naturally.
                      </p>
                    </div>
                    <Switch
                      checked={!!currentStoryRuleDraft.aiAgent?.enabled}
                      onCheckedChange={(checked) =>
                        setCurrentStoryRuleDraft((prev) => ({
                          ...prev,
                          aiAgent: {
                            ...(prev.aiAgent || {}),
                            enabled: checked,
                            agentId: prev.aiAgent?.agentId || aiAgents[0]?.id,
                          },
                        }))
                      }
                    />
                  </div>

                  {currentStoryRuleDraft.aiAgent?.enabled && (
                    <div className="space-y-4 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Select AI Agent
                        </label>
                        <Select
                          value={currentStoryRuleDraft.aiAgent.agentId || (aiAgents[0]?.id || "")}
                          onValueChange={(val) =>
                            setCurrentStoryRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: { ...(prev.aiAgent || { enabled: true }), agentId: val },
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 text-xs font-bold rounded-xl bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Choose an AI Agent" />
                          </SelectTrigger>
                          <SelectContent>
                            {aiAgents.map((ag) => (
                              <SelectItem key={ag.id} value={ag.id}>
                                {ag.name} {ag.isDefault ? "(Default)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Custom Instructions / Story Context (Optional)
                        </label>
                        <Textarea
                          value={currentStoryRuleDraft.aiAgent.customPrompt || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentStoryRuleDraft((prev) => ({
                              ...prev,
                              aiAgent: { ...(prev.aiAgent || { enabled: true }), customPrompt: val },
                            }));
                          }}
                          rows={3}
                          placeholder="e.g. The customer is replying to our flash sale story. Answer pricing questions and send them to https://yoursite.com/flash-sale"
                          className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* STORY TAB 3: DEFAULT DM */}
              <TabsContent value="fallback" className="space-y-4 pt-4">
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                        <span>Default Story DM Response</span>
                      </span>
                      <p className="text-[11px] text-purple-700 dark:text-purple-400">
                        Always send this direct message when a user sends any reaction or message to this story.
                      </p>
                    </div>
                    <Switch
                      checked={!!currentStoryRuleDraft.defaultReply?.enabled}
                      onCheckedChange={(checked) =>
                        setCurrentStoryRuleDraft((prev) => ({
                          ...prev,
                          defaultReply: {
                            ...(prev.defaultReply || {}),
                            enabled: checked,
                            dmReplyText: prev.defaultReply?.dmReplyText || "Hi @{name}! Thanks for checking out our story!",
                          },
                        }))
                      }
                    />
                  </div>

                  {currentStoryRuleDraft.defaultReply?.enabled && (
                    <div className="space-y-3 pt-2 border-t border-purple-200/50 dark:border-purple-800/50">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Direct Message Text
                        </label>
                        <Textarea
                          value={currentStoryRuleDraft.defaultReply?.dmReplyText || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCurrentStoryRuleDraft((prev) => ({
                              ...prev,
                              defaultReply: {
                                ...(prev.defaultReply || { enabled: true }),
                                dmReplyText: val,
                                enabled: true,
                              },
                            }));
                          }}
                          rows={3}
                          placeholder="Hi @{name}! Thanks for replying to our story. Let us know what you need and our team will help right away!"
                          className="text-xs font-medium rounded-xl bg-white dark:bg-slate-900 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="p-6 pt-4 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {editingStory && storyRules.some((r) => r.storyId === editingStory.id) && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteStoryAutomation(editingStory.id)}
                  className="rounded-xl text-xs font-bold gap-1.5 h-9"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Rule</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingStory(null);
                  setIsGlobalStoryModalOpen(false);
                }}
                className="rounded-xl text-xs font-bold h-9 bg-white dark:bg-slate-900"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSaveStoryAutomation}
                disabled={isSavingStoryRule}
                className="bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white rounded-xl text-xs font-black gap-2 h-9 shadow-md cursor-pointer"
              >
                {isSavingStoryRule ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Save Story Automation</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMMENTS DRAWER / SHEET */}
      <Sheet
        open={!!commentsPost}
        onOpenChange={(open) => {
          if (!open) setCommentsPost(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full bg-white dark:bg-slate-900">
          <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <SheetTitle className="text-base font-black text-slate-900 dark:text-white">
                Instagram Comments
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-slate-400">
              Live comment stream for post ID: <code className="text-pink-500 font-mono">{commentsPost?.id}</code>
            </SheetDescription>
          </SheetHeader>

          {/* Comments List Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isCommentsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                <p className="text-xs font-bold text-slate-400">Fetching live comments from Instagram...</p>
              </div>
            ) : commentsError ? (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-xs font-bold space-y-1">
                <p>Failed to load comments:</p>
                <p className="font-normal text-[11px] text-rose-500">{commentsError}</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <MessageCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No comments on this post yet</p>
                <p className="text-[11px] text-slate-400">When users comment on your Instagram post, they will appear here.</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      @{comment.username || "Instagram User"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(comment.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                    {comment.text}
                  </p>

                  {/* Nested Replies */}
                  {comment.replies?.data && comment.replies.data.length > 0 && (
                    <div className="pl-3 border-l-2 border-pink-400/40 space-y-2 pt-1">
                      {comment.replies.data.map((reply) => (
                        <div key={reply.id} className="text-[11px] space-y-0.5">
                          <span className="font-bold text-pink-600 dark:text-pink-400">
                            @{reply.username || "Account"}
                          </span>
                          <p className="text-slate-600 dark:text-slate-300">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual Reply Box */}
                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2">
                    <Input
                      value={manualReplyDrafts[comment.id] || ""}
                      onChange={(e) =>
                        setManualReplyDrafts((prev) => ({
                          ...prev,
                          [comment.id]: e.target.value,
                        }))
                      }
                      placeholder="Write a public reply..."
                      className="h-8 text-xs bg-white dark:bg-slate-900 rounded-xl"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSendManualReply(comment.id)}
                      disabled={replyingCommentId === comment.id}
                      className="h-8 px-3 rounded-xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white text-xs font-bold flex-shrink-0 cursor-pointer"
                    >
                      {replyingCommentId === comment.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* STORY VIEWER DIALOG */}
      <Dialog
        open={!!viewingStory}
        onOpenChange={(open) => {
          if (!open) setViewingStory(null);
        }}
      >
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black text-white border-slate-800 rounded-3xl">
          <div className="relative flex flex-col items-center justify-center min-h-[480px] max-h-[80vh] bg-slate-950">
            {/* Header / Info overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800">
                    {profile?.profilePictureUrl ? (
                      <img
                        src={profile.profilePictureUrl}
                        alt={profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Instagram className="w-5 h-5 text-white m-1.5" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black text-white leading-tight">
                    @{profile?.username || "instagram"}
                  </p>
                  <p className="text-[10px] text-white/70">
                    {viewingStory?.timestamp ? formatDate(viewingStory.timestamp) : "Active Story"}
                  </p>
                </div>
              </div>

              {viewingStory?.permalink && (
                <a
                  href={viewingStory.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <span>Instagram</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Media Content */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              {viewingStory?.media_type === "VIDEO" && viewingStory.media_url ? (
                <video
                  src={viewingStory.media_url}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : viewingStory?.media_url || viewingStory?.thumbnail_url ? (
                <img
                  src={viewingStory.media_url || viewingStory.thumbnail_url}
                  alt="Story content"
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <div className="py-24 text-center text-slate-400 space-y-2">
                  <Sparkles className="w-12 h-12 mx-auto text-pink-500 animate-pulse" />
                  <p className="text-xs font-bold">Story preview unavailable</p>
                </div>
              )}
            </div>

            {/* Caption Overlay */}
            {viewingStory?.caption && (
              <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <p className="text-xs text-white/90 font-medium line-clamp-3">
                  {viewingStory.caption}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayoutClient>
  );
}
