"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Database, Plus, Trash2, BookOpen, Search, Loader2, Clock,
  CheckCircle2, FileText, HelpCircle, Briefcase, ShoppingBag,
  ShieldAlert, Edit2, Sparkles, Brain, TrendingUp, Activity, RefreshCw, Key, Eye, EyeOff, Upload, FileSpreadsheet, Bot, Settings, Settings2,
  MoreVertical, PlayCircle, Copy, History, Terminal, User, Tag, XCircle, ChevronRight, Paperclip, AlertCircle,
  Mic, Volume2, Play, Square, SlidersHorizontal, MessageSquare, Image as ImageIcon, Video, ArrowRight, Radio,
  Route, GitBranch, Zap, UserCheck, Send, Globe, ExternalLink, CalendarCheck, Calendar, Store,
  MessageCircle, Instagram, Check, ChevronDown, ChevronUp, StopCircle
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  addKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeAction,
  updateKnowledgeEntry,
  addWebsiteKnowledgeEntry,
  syncWebsiteKnowledgeEntry,
  discoverWebsiteRoutesAction,
  importSelectedWebsitePagesAction,
  importSingleWebsitePageAction,
  finalizeWebsiteImportAction,
} from "@/app/actions/knowledge-base";
import { getOrdersList, updateOrderStatus, testPOSWebhookAction } from "@/app/actions/orders";
import { getAppointmentsList } from "@/app/actions/appointments";
import { createAIFunction, createAIMcpServer, deleteAIFunction, deleteAIMcpServer, getAIToolsSetup, testAIMcpServer, updateAIFunction, updateAIMcpServer } from "@/app/actions/ai-tools";
import { getAIAgentExecutions, clearAIAgentExecutions } from "@/app/actions/ai-executions";
import { getOrganizationAiStatus, toggleOrganizationAiStatus, getOrganizationAiConfig, updateOrganizationAiConfig, getOrganizationVoiceStatus, toggleOrganizationVoiceStatus, fetchElevenLabsVoicesAction, AiResponseFormatConfig, updateOrganizationResponseFormatAction, getOrganizationResponseFormatAction } from "@/app/actions/organization";
import { testVoiceGeneration } from "@/app/actions/voice-test";
import {
  getAiRoutingRules,
  getOrgAgents,
  createAiRoutingRule,
  updateAiRoutingRule,
  toggleAiRoutingRule,
  deleteAiRoutingRule,
  testAiRoutingMatch,
} from "@/app/actions/ai-routing";
import { getTagsAndPipelineStagesAction, createTagQuickAction } from "@/app/actions/pipeline";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { cn } from "@/lib/utils";
import { MediaLibraryModal } from "@/components/flows/modals/media-library-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const PROVIDER_MODELS: Record<string, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "gpt-4o-mini (Fast & Recommended)" },
    { id: "gpt-4o", label: "gpt-4o (Flagship Omni)" },
    { id: "o3-mini", label: "o3-mini (Latest Reasoning)" },
    { id: "o1", label: "o1 (Advanced Reasoning)" },
    { id: "o1-mini", label: "o1-mini (Fast Reasoning)" },
    { id: "gpt-4-turbo", label: "gpt-4-turbo" },
  ],
  gemini: [
    { id: "gemini-3.5-flash", label: "gemini-3.5-flash" },
    { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite" },
    { id: "gemini-3.0-flash", label: "gemini-3.0-flash" },
    { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
    { id: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite" },
    { id: "gemini-2.0-flash-thinking-exp", label: "gemini-2.0-flash-thinking (Reasoning)" },
    { id: "gemini-2.0-pro-exp-02-05", label: "gemini-2.0-pro" },
    { id: "gemini-1.5-flash", label: "gemini-1.5-flash" },
    { id: "gemini-1.5-pro", label: "gemini-1.5-pro" },
  ],
  claude: [
    { id: "claude-3-7-sonnet-20250219", label: "claude-3-7-sonnet (Latest Hybrid Reasoning)" },
    { id: "claude-3-5-sonnet-20241022", label: "claude-3-5-sonnet v2" },
    { id: "claude-3-5-haiku-20241022", label: "claude-3-5-haiku" },
    { id: "claude-3-opus-20240229", label: "claude-3-opus" },
  ],
  xai: [
    { id: "grok-2-latest", label: "grok-2-latest (Recommended)" },
    { id: "grok-2-1212", label: "grok-2-1212" },
    { id: "grok-beta", label: "grok-beta" },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "deepseek-chat (DeepSeek-V3)" },
    { id: "deepseek-reasoner", label: "deepseek-reasoner (DeepSeek-R1)" },
  ],
};

const isCustomModel = (modelName: string | null | undefined, provider: string, dynamicModels?: Array<{ id: string }>) => {
  if (!modelName) return false;
  if (modelName === "custom") return true;
  const models = dynamicModels && dynamicModels.length > 0 ? dynamicModels : (PROVIDER_MODELS[provider] || []);
  return !models.some(m => m.id === modelName);
};


import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper for dynamic category detection
const detectCategory = (title: string, content: string) => {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes("faq") || text.includes("q&a") || text.includes("?") || text.includes("question") || text.includes("how to")) {
    return "FAQs";
  }
  if (text.includes("product") || text.includes("price") || text.includes("catalog") || text.includes("service") || text.includes("buy") || text.includes("shop")) {
    return "Products & Services";
  }
  if (text.includes("policy") || text.includes("refund") || text.includes("terms") || text.includes("shipping") || text.includes("delivery")) {
    return "Policy Sheets";
  }
  return "Business Profile";
};
const getCategoryIcon = (category: string) => {
  switch (category) {
    case "FAQs":
      return {
        icon: HelpCircle,
        bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30",
        color: "text-amber-500",
        badge: "bg-amber-100/60 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
      };
    case "Products & Services":
      return {
        icon: ShoppingBag,
        bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30",
        color: "text-blue-500",
        badge: "bg-blue-100/60 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
      };
    case "Policy Sheets":
      return {
        icon: ShieldAlert,
        bg: "bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30",
        color: "text-purple-500",
        badge: "bg-purple-100/60 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400"
      };
    case "Google Sheet":
      return {
        icon: FileSpreadsheet,
        bg: "bg-emerald-55/40 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40",
        color: "text-emerald-600 dark:text-emerald-400",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
      };
    case "Website URL":
      return {
        icon: Globe,
        bg: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30",
        color: "text-indigo-600 dark:text-indigo-400",
        badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
      };
    default:
      return {
        icon: Briefcase,
        bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30",
        color: "text-[#00B074]",
        badge: "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
      };
  }
};

export default function KnowledgeBasePage({
  params,
  initialAgents = [],
}: {
  params: { orgId: string };
  initialAgents?: any[];
}) {
  const t = useTranslations("KnowledgeBase");
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isTogglingVoice, setIsTogglingVoice] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceProviderChoice, setVoiceProviderChoice] = useState<"gemini" | "openai" | "elevenlabs">("gemini");
  const [voiceApiKeyInput, setVoiceApiKeyInput] = useState("");
  const [voiceGeminiModelChoice, setVoiceGeminiModelChoice] = useState("gemini-3.1-flash-lite");
  const [elevenLabsVoiceChoice, setElevenLabsVoiceChoice] = useState<string>("");
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ id: string; name: string; category: string; previewUrl?: string; description?: string }>>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [voiceLoadError, setVoiceLoadError] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [showVoiceKey, setShowVoiceKey] = useState(false);
  const [isSavingVoiceConfig, setIsSavingVoiceConfig] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [voiceTestError, setVoiceTestError] = useState<string | null>(null);
  const [voiceTestSuccess, setVoiceTestSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [aiProvider, setAiProvider] = useState<string>("openai");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [selectedProviderModal, setSelectedProviderModal] = useState<string | null>(null);
  const [modalKeyInput, setModalKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState("All Knowledge");
  const [statusFilter, setStatusFilter] = useState("All");
  const organizationId = params.orgId;
 
  const [agents, setAgents] = useState<any[]>(initialAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    const defaultAgent = initialAgents.find((a: any) => a.isDefault);
    return defaultAgent?.id || (initialAgents.length > 0 ? initialAgents[0].id : "");
  });
  const [isLoadingAgents, setIsLoadingAgents] = useState<boolean>(initialAgents.length === 0);
  const [isAgentsDialogOpen, setIsAgentsDialogOpen] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentProvider, setNewAgentProvider] = useState("openai");
  const [newAgentKey, setNewAgentKey] = useState("");
  const [newAgentInstructions, setNewAgentInstructions] = useState("");
  const [newAgentModel, setNewAgentModel] = useState("gpt-4o-mini");
  const [newAgentCustomModel, setNewAgentCustomModel] = useState("");
  const [fetchedProviderModels, setFetchedProviderModels] = useState<Record<string, Array<{ id: string; label: string }>>>({});
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [newAgentTemperature, setNewAgentTemperature] = useState(0.1);
  const [newAgentMaxTokens, setNewAgentMaxTokens] = useState(2048);
  const [newAgentReasoningEffort, setNewAgentReasoningEffort] = useState("medium");
  const [newAgentSpreadsheetId, setNewAgentSpreadsheetId] = useState("");
  const [newAgentSheetName, setNewAgentSheetName] = useState("Sheet1");
  const [newAgentPlatforms, setNewAgentPlatforms] = useState<string[]>(["ALL"]);
  const [newAgentType, setNewAgentType] = useState<"lead_collector" | "ordering_collector" | "appointment_collector">("lead_collector");
  const [newAgentCustomVariables, setNewAgentCustomVariables] = useState<Array<{ id: string; name: string; label?: string; type?: string; required?: boolean }>>([
    { id: "var_1", name: "name", label: "Customer Name", type: "text", required: true },
    { id: "var_2", name: "email", label: "Email Address", type: "email", required: false },
    { id: "var_3", name: "phone", label: "Phone Number", type: "phone", required: true },
  ]);
  const [newAgentDestinations, setNewAgentDestinations] = useState<string[]>([]);
  const [newAgentDelaySeconds, setNewAgentDelaySeconds] = useState<number>(0);
  const [newAgentKeywordResponses, setNewAgentKeywordResponses] = useState<Array<{ id: string; keyword: string; responseType: string; mediaUrl: string; fileName?: string; caption?: string }>>([]);

  // POS System Webhook states
  const [newAgentPosWebhookEnabled, setNewAgentPosWebhookEnabled] = useState(false);
  const [newAgentPosWebhookUrl, setNewAgentPosWebhookUrl] = useState("");
  const [newAgentPosWebhookSecret, setNewAgentPosWebhookSecret] = useState("");
  const [isTestingPosWebhook, setIsTestingPosWebhook] = useState(false);
  const [posWebhookTestStatus, setPosWebhookTestStatus] = useState<string | null>(null);

  // Pipeline & Customer Tagging Sync states
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color?: string | null; category?: string | null }>>([]);
  const [pipelineStages, setPipelineStages] = useState<Array<{ id: string; name: string; color?: string | null; tagId?: string | null; order: number }>>([]);
  const [newAgentDefaultTagId, setNewAgentDefaultTagId] = useState("");
  const [newAgentQualifiedTagId, setNewAgentQualifiedTagId] = useState("");

  // Quick Tag Creation Modal states
  const [isQuickTagModalOpen, setIsQuickTagModalOpen] = useState(false);
  const [quickTagName, setQuickTagName] = useState("");
  const [quickTagColor, setQuickTagColor] = useState("#10B981");
  const [quickTagStageId, setQuickTagStageId] = useState("");
  const [isCreatingQuickTag, setIsCreatingQuickTag] = useState(false);
  const [quickTagTargetField, setQuickTagTargetField] = useState<"default" | "qualified">("default");

  // Temporary inputs for Custom Variables builder
  const [tempVarName, setTempVarName] = useState("");
  const [tempVarType, setTempVarType] = useState("text");

  // Temporary inputs for Keyword Responses builder
  const [tempKeyword, setTempKeyword] = useState("");
  const [tempKeywordType, setTempKeywordType] = useState("document");
  const [tempKeywordUrl, setTempKeywordUrl] = useState("");
  const [tempKeywordFileName, setTempKeywordFileName] = useState("");
  const [isUploadingKeywordMedia, setIsUploadingKeywordMedia] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

  // Website Route Scanner & Selective Importer states
  const [websiteScanUrl, setWebsiteScanUrl] = useState("");
  const [isScanningWebsite, setIsScanningWebsite] = useState(false);
  const [discoveredWebsiteRoutes, setDiscoveredWebsiteRoutes] = useState<Array<{ url: string; path: string; title: string; isRoot?: boolean }>>([]);
  const [selectedWebsiteRoutes, setSelectedWebsiteRoutes] = useState<string[]>([]);
  const [isImportingWebsite, setIsImportingWebsite] = useState(false);

  const [agentFileIds, setAgentFileIds] = useState<string[]>([]);
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [testAgent, setTestAgent] = useState<any | null>(null);
  const [testPrompt, setTestPrompt] = useState("Hi, how can you help me?");
  const [testReply, setTestReply] = useState("");
  const [testMedia, setTestMedia] = useState<any[]>([]);
  const [isTestingAgent, setIsTestingAgent] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"agents" | "routing" | "files" | "orders" | "appointments" | "functions" | "executions" | "mcp" | "response_format">("agents");

  // Orders & Appointments State
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [ordersStats, setOrdersStats] = useState<any>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [appointmentsStats, setAppointmentsStats] = useState<any>(null);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  const reloadOrdersAndAppointments = async () => {
    try {
      setIsLoadingOrders(true);
      setIsLoadingAppointments(true);
      const [oRes, aRes] = await Promise.allSettled([
        getOrdersList({ limit: 10 }),
        getAppointmentsList({ limit: 10 }),
      ]);
      if (oRes.status === "fulfilled" && oRes.value.success) {
        setOrdersList(oRes.value.orders || []);
        setOrdersStats(oRes.value.stats || null);
      }
      if (aRes.status === "fulfilled" && aRes.value.success) {
        setAppointmentsList(aRes.value.appointments || []);
        setAppointmentsStats(aRes.value.stats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingOrders(false);
      setIsLoadingAppointments(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await updateOrderStatus(orderId, newStatus);
      if (res.success) {
        toast.success(`Order marked as ${newStatus}`);
        setOrdersList(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        reloadOrdersAndAppointments();
      } else {
        toast.error(res.error || "Failed to update order status");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    }
  };

  const [responseFormat, setResponseFormat] = useState<AiResponseFormatConfig>({
    text: "text",
    voice: "voice",
    media: "text",
  });
  const [isSavingResponseFormat, setIsSavingResponseFormat] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<any | null>(null);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [executionSearch, setExecutionSearch] = useState("");
  const [executionStatusFilter, setExecutionStatusFilter] = useState("all");
  const [isAutoRefreshExecutions, setIsAutoRefreshExecutions] = useState(true);
  const [aiFunctions, setAiFunctions] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [flowOptions, setFlowOptions] = useState<any[]>([]);
  const [isSavingFunction, setIsSavingFunction] = useState(false);
  const [functionForm, setFunctionForm] = useState({
    id: "",
    name: "",
    description: "",
    googleSpreadsheetId: "",
    googleSheetName: "Sheet1",
    finalMessage: "Thanks. I have collected your details and our team will continue from here.",
    aiAgentId: "global",
    isActive: true,
  });
  const [functionFields, setFunctionFields] = useState([
    { name: "email", label: "Email", type: "email", required: true, description: "Customer email address" },
    { name: "phone", label: "Phone Number", type: "phone", required: true, description: "Customer phone or WhatsApp number" },
  ]);
  const [isSavingMcp, setIsSavingMcp] = useState(false);
  const [isTestingMcp, setIsTestingMcp] = useState<string | null>(null);
  const [mcpForm, setMcpForm] = useState({
    id: "",
    name: "",
    description: "",
    url: "",
    authType: "none",
    accessToken: "",
    apiKey: "",
    aiAgentId: "global",
    isActive: true,
  });
  const [mcpCustomHeaders, setMcpCustomHeaders] = useState("");
  const [agentModalTab, setAgentModalTab] = useState<"editor" | "agents">("editor");
  const [agentAttachedFiles, setAgentAttachedFiles] = useState<
    Array<{ id?: string; name: string; size?: string; content: string; sourceUrl?: string; isWeb?: boolean }>
  >([]);
  const [isAttachedFilesCollapsed, setIsAttachedFilesCollapsed] = useState(false);
  const [isUploadingAgentFile, setIsUploadingAgentFile] = useState(false);
  const [agentSearchFilter, setAgentSearchFilter] = useState("");

  // Live Scraper Progress state
  const [importProgress, setImportProgress] = useState<{
    isOpen: boolean;
    total: number;
    current: number;
    currentUrl: string;
    currentTitle: string;
    percent: number;
    completed: number;
    failed: number;
    status: "idle" | "running" | "completed" | "aborted" | "error";
    startTime: number;
    estimatedSecondsRemaining: number | null;
  }>({
    isOpen: false,
    total: 0,
    current: 0,
    currentUrl: "",
    currentTitle: "",
    percent: 0,
    completed: 0,
    failed: 0,
    status: "idle",
    startTime: 0,
    estimatedSecondsRemaining: null,
  });
  const abortImportRef = useRef(false);

  // AI Routing state
  const [routingRules, setRoutingRules] = useState<any[]>([]);
  const [isLoadingRoutingRules, setIsLoadingRoutingRules] = useState(false);
  const [orgAgentsList, setOrgAgentsList] = useState<any[]>([]);
  const [isRoutingDialogOpen, setIsRoutingDialogOpen] = useState(false);
  const [editingRoutingRule, setEditingRoutingRule] = useState<any | null>(null);
  const [isSavingRoutingRule, setIsSavingRoutingRule] = useState(false);
  
  // Routing Form state
  const [routingName, setRoutingName] = useState("");
  const [routingTopic, setRoutingTopic] = useState("");
  const [routingKeywords, setRoutingKeywords] = useState("");
  const [routingAgentId, setRoutingAgentId] = useState("");
  const [routingTransferMsg, setRoutingTransferMsg] = useState("We will connect you to our agent.");
  const [routingIsActive, setRoutingIsActive] = useState(true);

  // Test Simulator state
  const [testSimulatorQuery, setTestSimulatorQuery] = useState("");
  const [isTestingRouting, setIsTestingRouting] = useState(false);
  const [testSimulatorResult, setTestSimulatorResult] = useState<any | null>(null);
  const [routingSearchFilter, setRoutingSearchFilter] = useState("");

  const reloadRoutingRules = async () => {
    setIsLoadingRoutingRules(true);
    try {
      const [rules, agentsList] = await Promise.all([
        getAiRoutingRules(),
        getOrgAgents(),
      ]);
      setRoutingRules(rules || []);
      setOrgAgentsList(agentsList || []);
      if (!routingAgentId && agentsList && agentsList.length > 0) {
        setRoutingAgentId(agentsList[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load AI Routing Rules:", err);
    } finally {
      setIsLoadingRoutingRules(false);
    }
  };

  const openCreateRoutingDialog = () => {
    setEditingRoutingRule(null);
    setRoutingName("");
    setRoutingTopic("");
    setRoutingKeywords("");
    setRoutingAgentId(orgAgentsList[0]?.id || "");
    setRoutingTransferMsg("We will connect you to our agent.");
    setRoutingIsActive(true);
    setIsRoutingDialogOpen(true);
  };

  const openEditRoutingDialog = (rule: any) => {
    setEditingRoutingRule(rule);
    setRoutingName(rule.name || "");
    setRoutingTopic(rule.topic || "");
    setRoutingKeywords(Array.isArray(rule.keywords) ? rule.keywords.join(", ") : "");
    setRoutingAgentId(rule.agentId || "");
    setRoutingTransferMsg(rule.transferMessage || "We will connect you to our agent.");
    setRoutingIsActive(rule.isActive !== false);
    setIsRoutingDialogOpen(true);
  };

  const handleSaveRoutingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routingName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }
    if (!routingTopic.trim()) {
      toast.error("Please enter a topic or intent description");
      return;
    }
    if (!routingAgentId) {
      toast.error("Please select an assigned agent");
      return;
    }

    setIsSavingRoutingRule(true);
    try {
      const keywords = routingKeywords
        .split(/[,;\n]/)
        .map(k => k.trim())
        .filter(Boolean);

      if (editingRoutingRule) {
        const res = await updateAiRoutingRule(editingRoutingRule.id, {
          name: routingName,
          topic: routingTopic,
          keywords,
          agentId: routingAgentId,
          transferMessage: routingTransferMsg,
          isActive: routingIsActive,
        });
        if (res.success) {
          toast.success(`Routing rule "${routingName}" updated successfully!`);
          setIsRoutingDialogOpen(false);
          await reloadRoutingRules();
        }
      } else {
        const res = await createAiRoutingRule({
          name: routingName,
          topic: routingTopic,
          keywords,
          agentId: routingAgentId,
          transferMessage: routingTransferMsg,
          isActive: routingIsActive,
        });
        if (res.success) {
          toast.success(`Routing rule "${routingName}" created successfully!`);
          setIsRoutingDialogOpen(false);
          await reloadRoutingRules();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save routing rule");
    } finally {
      setIsSavingRoutingRule(false);
    }
  };

  const handleToggleRoutingRule = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setRoutingRules(prev => prev.map(r => r.id === id ? { ...r, isActive: nextStatus } : r));
    try {
      await toggleAiRoutingRule(id, nextStatus);
      toast.success(nextStatus ? "Routing rule enabled" : "Routing rule disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle rule");
      await reloadRoutingRules();
    }
  };

  const handleDeleteRoutingRule = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the routing rule "${name}"?`)) return;
    try {
      await deleteAiRoutingRule(id);
      toast.success(`Routing rule "${name}" deleted`);
      await reloadRoutingRules();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete routing rule");
    }
  };

  const handleRunSimulatorTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testSimulatorQuery.trim()) {
      toast.error("Please enter a customer message to test");
      return;
    }
    setIsTestingRouting(true);
    setTestSimulatorResult(null);
    try {
      const result = await testAiRoutingMatch(testSimulatorQuery.trim());
      setTestSimulatorResult(result);
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setIsTestingRouting(false);
    }
  };

  const handleAgentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAgentFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", organizationId);
      if (editingAgent?.id) {
        formData.append("aiAgentId", editingAgent.id);
      }
      const res = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Failed to upload file");
        return;
      }
      
      setAgentAttachedFiles(prev => [
        ...prev,
        {
          id: data.id,
          name: data.fileName || file.name,
          size: `${Math.round(file.size / 1024)} KB`,
          content: data.content || ""
        }
      ]);
      if (data.id) {
        setAgentFileIds(prev => Array.from(new Set([...prev, data.id])));
      }
      toast.success(`File "${file.name}" attached successfully!`);
      await reloadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setIsUploadingAgentFile(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachedFile = (index: number) => {
    const fileToRemove = agentAttachedFiles[index];
    setAgentAttachedFiles(prev => prev.filter((_, i) => i !== index));
    if (fileToRemove?.id) {
      setAgentFileIds(prev => prev.filter(id => id !== fileToRemove.id));
    }
  };

  const buildFullInstructions = (basePrompt: string) => {
    const fileBlocks = agentAttachedFiles
      .filter(f => f.content)
      .map(f => `### KNOWLEDGE FILE: ${f.name}\n${f.content}`);
    
    if (fileBlocks.length === 0) return basePrompt.trim();
    return [basePrompt.trim(), ...fileBlocks].filter(Boolean).join("\n\n");
  };

  const reloadAgents = async (showLoading = true) => {
    if (showLoading) setIsLoadingAgents(true);
    try {
      const data = await getAIAgents(organizationId);
      const safeData = data || [];
      setAgents(safeData);
      const defaultAgentId = safeData.find((agent: any) => agent.isDefault)?.id;
      if (defaultAgentId && !selectedAgentId) {
        setSelectedAgentId(defaultAgentId);
      } else if (!selectedAgentId && safeData.length > 0) {
        setSelectedAgentId(safeData[0].id);
      }
    } catch (err) {
      console.error("Failed to reload agents:", err);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const reloadAITools = async () => {
    try {
      const data = await getAIToolsSetup(organizationId);
      setAiFunctions(data.functions || []);
      setMcpServers(data.mcpServers || []);
      setFlowOptions(data.flows || []);
    } catch (err) {
      console.error("Failed to reload AI tools:", err);
    }
  };

  const reloadTagsAndStages = async () => {
    try {
      const res = await getTagsAndPipelineStagesAction();
      if (res) {
        setAvailableTags(res.tags || []);
        setPipelineStages(res.stages || []);
      }
    } catch (err) {
      console.error("Failed to load tags & pipeline stages:", err);
    }
  };

  const handleCreateQuickTag = async () => {
    if (!quickTagName.trim()) return;
    setIsCreatingQuickTag(true);
    try {
      const res = await createTagQuickAction({
        name: quickTagName.trim(),
        color: quickTagColor,
        linkStageId: quickTagStageId || undefined,
      });

      if (res.success && res.tag) {
        toast.success(`Tag "${res.tag.name}" created successfully!`);
        await reloadTagsAndStages();

        if (editingAgent) {
          setEditingAgent({
            ...editingAgent,
            [quickTagTargetField === "default" ? "defaultTagId" : "qualifiedTagId"]: res.tag.id,
          });
        } else {
          if (quickTagTargetField === "default") {
            setNewAgentDefaultTagId(res.tag.id);
          } else {
            setNewAgentQualifiedTagId(res.tag.id);
          }
        }
        setIsQuickTagModalOpen(false);
        setQuickTagName("");
      } else {
        toast.error(res.error || "Failed to create tag");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create tag");
    } finally {
      setIsCreatingQuickTag(false);
    }
  };

  // Derived: the first linked Google Sheet entry (if any)
  const linkedGoogleSheet = entries.find((e: any) => 
    e.sourceUrl?.startsWith("googlesheets://") && 
    (selectedAgentId === "global" 
      ? (!e.agentFiles || e.agentFiles.length === 0)
      : e.agentFiles?.some((af: any) => af.aiAgent?.id === selectedAgentId))
  ) ?? null;

  const reloadEntries = async () => {
    try {
      const [res] = await Promise.all([
        fetch(`/api/knowledge-base?orgId=${organizationId}`).then((r) => r.json()),
        reloadAgents(false),
        reloadAITools(),
      ]);
      setEntries(res || []);
    } catch (err) {
      console.error(err);
    }
  };
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadAgentId, setUploadAgentId] = useState<string>("global");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");

  // Website Scraping State
  const [isWebDialogOpen, setIsWebDialogOpen] = useState(false);
  const [webAgentId, setWebAgentId] = useState<string>("global");
  const [isScrapingWeb, setIsScrapingWeb] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [webTitle, setWebTitle] = useState("");
  const [webCrawlMode, setWebCrawlMode] = useState<"single" | "deep">("single");
  const [webMaxPages, setWebMaxPages] = useState<number>(5);
  const [syncingWebsiteId, setSyncingWebsiteId] = useState<string | null>(null);
  const [viewingFileContent, setViewingFileContent] = useState<{ name: string; content: string } | null>(null);

  const handleScrapeWebsite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!webUrl.trim()) {
      toast.error("Please enter a website URL");
      return;
    }
    setIsScrapingWeb(true);
    try {
      const res = await addWebsiteKnowledgeEntry({
        url: webUrl.trim(),
        customTitle: webTitle.trim() || undefined,
        organizationId,
        crawlMode: webCrawlMode,
        maxPages: webMaxPages,
        aiAgentId: webAgentId === "global" ? null : webAgentId,
      });
      toast.success(`Successfully imported ${res.count} website page(s) into Knowledge Base!`);
      setWebUrl("");
      setWebTitle("");
      setIsWebDialogOpen(false);
      await reloadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to scrape website.");
    } finally {
      setIsScrapingWeb(false);
    }
  };

  const handleSyncWebsite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSyncingWebsiteId(id);
      await syncWebsiteKnowledgeEntry(id);
      toast.success("Website data refreshed successfully!");
      await reloadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to refresh website content.");
    } finally {
      setSyncingWebsiteId(null);
    }
  };



  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("orgId", organizationId);
    if (uploadTitle) {
      formData.append("title", uploadTitle);
    }
    if (uploadAgentId !== "global") {
      formData.append("aiAgentId", uploadAgentId);
    }
    setIsUploading(true);
    try {
      const res = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (res.ok && result.success) {
        toast.success("Document uploaded and synchronized successfully!");
        setSelectedFile(null);
        setUploadTitle("");
        setIsUploadDialogOpen(false);
        await reloadEntries();
      } else {
        toast.error(result.error || "Failed to parse and upload document.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetch(`/api/knowledge-base?orgId=${organizationId}`)
      .then(res => res.json())
      .then(data => {
        setEntries(data);
        setIsLoading(false);
      });

    getOrganizationAiStatus()
      .then(setIsAiEnabled)
      .catch(console.error);

    getOrganizationVoiceStatus()
      .then(setIsVoiceEnabled)
      .catch(console.error);

    getOrganizationAiConfig()
      .then(config => {
        setApiKeys(config.apiKeys || {});
        setAiProvider(config.provider);
        if (config.responseFormat) {
          setResponseFormat(config.responseFormat);
        }
        if (config.apiKeys?.elevenlabsVoiceId) {
          setElevenLabsVoiceChoice(config.apiKeys.elevenlabsVoiceId);
        }
        if (config.apiKeys?.elevenlabs) {
          fetchElevenLabsVoicesAction(config.apiKeys.elevenlabs)
            .then(res => {
              if (res.success && res.voices) {
                setElevenLabsVoices(res.voices);
              }
            })
            .catch(() => {});
        }
      })
      .catch(err => console.error("Failed to fetch AI Config:", err));

    getOrganizationResponseFormatAction()
      .then(format => {
        if (format) setResponseFormat(format);
      })
      .catch(() => {});

    getOrganizationVoiceStatus()
      .then(status => setIsVoiceEnabled(status))
      .catch(err => console.error("Failed to fetch Voice Status:", err));



    reloadAgents(initialAgents.length === 0);
    reloadAITools();
    reloadExecutions();
    reloadRoutingRules();
    reloadOrdersAndAppointments();
    reloadTagsAndStages();
  }, [organizationId]);

  useEffect(() => {
    if (workspaceTab === "orders" || workspaceTab === "appointments") {
      reloadOrdersAndAppointments();
    }
  }, [workspaceTab]);

  const reloadExecutions = async () => {
    setIsLoadingExecutions(true);
    try {
      const data = await getAIAgentExecutions(organizationId, {
        search: executionSearch,
        status: executionStatusFilter,
        limit: 50,
      });
      setExecutions(data || []);
      if (data && data.length > 0) {
        if (!selectedExecution) {
          setSelectedExecution(data[0]);
        } else {
          const fresh = data.find((d) => d.id === selectedExecution.id);
          if (fresh) {
            setSelectedExecution(fresh);
          } else {
            setSelectedExecution(data[0]);
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load AI Executions:", err);
    } finally {
      setIsLoadingExecutions(false);
    }
  };

  useEffect(() => {
    if (workspaceTab === "executions") {
      reloadExecutions();
    }
  }, [workspaceTab, executionSearch, executionStatusFilter]);

  useEffect(() => {
    if (workspaceTab === "routing") {
      reloadRoutingRules();
    }
  }, [workspaceTab]);

  useEffect(() => {
    if (workspaceTab !== "executions" || !isAutoRefreshExecutions) return;
    const interval = setInterval(() => {
      reloadExecutions();
    }, 5000);
    return () => clearInterval(interval);
  }, [workspaceTab, isAutoRefreshExecutions, executionSearch, executionStatusFilter]);

  const handleToggleAi = async () => {
    setIsToggling(true);
    const targetStatus = !isAiEnabled;
    try {
      const res = await toggleOrganizationAiStatus(targetStatus);
      if (res.success) {
        setIsAiEnabled(targetStatus);
        toast.success(targetStatus ? t("toastEnabled") : t("toastDisabled"));
      } else {
        toast.error(res.error || t("toastToggleFailed"));
      }
    } catch (err: any) {
      toast.error(err.message || t("toastError"));
    } finally {
      setIsToggling(false);
    }
  };

  const fetchVoices = async (keyToUse?: string) => {
    const key = (keyToUse !== undefined ? keyToUse : voiceApiKeyInput).trim();
    if (!key) {
      toast.error("Please enter your ElevenLabs API key first.");
      return;
    }
    setIsLoadingVoices(true);
    setVoiceLoadError(null);
    try {
      const res = await fetchElevenLabsVoicesAction(key);
      if (res.success && res.voices) {
        setElevenLabsVoices(res.voices);
        if (res.voices.length > 0) {
          const current = elevenLabsVoiceChoice || apiKeys['elevenlabsVoiceId'];
          const matched = res.voices.find((v: any) => v.id === current);
          if (matched) {
            setElevenLabsVoiceChoice(matched.id);
          } else {
            setElevenLabsVoiceChoice(res.voices[0].id);
          }
        }
        toast.success(`Found ${res.voices.length} voices in your ElevenLabs account!`);
      } else {
        setVoiceLoadError(res.error || "Failed to fetch voices");
        toast.error(res.error || "Failed to fetch voices from ElevenLabs");
      }
    } catch (err: any) {
      setVoiceLoadError(err.message || "Network error fetching voices");
      toast.error(err.message || "Network error fetching voices");
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const handlePlayPreview = (voice: { id: string; previewUrl?: string | null }) => {
    if (!voice.previewUrl) {
      toast.info("No audio preview available for this voice.");
      return;
    }
    if (audioPlayer) {
      audioPlayer.pause();
      if (playingVoiceId === voice.id) {
        setPlayingVoiceId(null);
        return;
      }
    }
    const audio = new Audio(voice.previewUrl);
    setAudioPlayer(audio);
    setPlayingVoiceId(voice.id);
    audio.play().catch(() => {
      setPlayingVoiceId(null);
    });
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
  };

  const handleOpenVoiceModal = (preferredProvider?: "gemini" | "openai" | "elevenlabs") => {
    const choice = preferredProvider || 
      ((aiProvider === 'gemini' || aiProvider === 'openai' || aiProvider === 'elevenlabs') 
        ? (aiProvider as "gemini" | "openai" | "elevenlabs") 
        : (apiKeys['gemini'] ? 'gemini' : (apiKeys['openai'] ? 'openai' : (apiKeys['elevenlabs'] ? 'elevenlabs' : 'gemini'))));
    setVoiceProviderChoice(choice);
    const key = apiKeys[choice] || "";
    setVoiceApiKeyInput(key);
    setShowVoiceKey(false);
    setVoiceTestError(null);
    setVoiceTestSuccess(false);
    setIsVoiceModalOpen(true);
    if (choice === 'elevenlabs') {
      const savedVoice = apiKeys['elevenlabsVoiceId'] || "";
      if (savedVoice) setElevenLabsVoiceChoice(savedVoice);
      if (key && elevenLabsVoices.length === 0) {
        fetchVoices(key);
      }
    }
  };

  const handleSelectVoiceProvider = (provider: "gemini" | "openai" | "elevenlabs") => {
    setVoiceProviderChoice(provider);
    const key = apiKeys[provider] || "";
    setVoiceApiKeyInput(key);
    setVoiceTestError(null);
    setVoiceTestSuccess(false);
    if (provider === 'elevenlabs') {
      const savedVoice = apiKeys['elevenlabsVoiceId'] || "";
      if (savedVoice) setElevenLabsVoiceChoice(savedVoice);
      if (key && elevenLabsVoices.length === 0) {
        fetchVoices(key);
      }
    }
  };

  const handleTestVoiceGeneration = async () => {
    const key = voiceApiKeyInput.trim();
    if (!key) {
      toast.error("Please enter your API key first.");
      return;
    }
    if (voiceProviderChoice === 'elevenlabs' && !elevenLabsVoiceChoice) {
      toast.error("Please select an ElevenLabs voice to test.");
      return;
    }
    setIsTestingVoice(true);
    setVoiceTestError(null);
    setVoiceTestSuccess(false);

    try {
      const res = await testVoiceGeneration("Hello! This is a test of your voice generation engine.", {
        provider: voiceProviderChoice,
        apiKey: key,
        voice: voiceProviderChoice === 'elevenlabs' ? elevenLabsVoiceChoice : undefined,
        model: voiceProviderChoice === 'gemini' ? voiceGeminiModelChoice : undefined,
      });

      if (res.success && res.audioUrl) {
        setVoiceTestSuccess(true);
        toast.success("Voice generated and played successfully!");
        if (audioPlayer) {
          audioPlayer.pause();
        }
        const audio = new Audio(res.audioUrl);
        setAudioPlayer(audio);
        audio.play().catch(() => {});
      } else {
        const errorMsg = res.error || "Failed to generate speech with ElevenLabs";
        setVoiceTestError(errorMsg);
        toast.error(errorMsg, { duration: 10000 });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Failed to generate voice";
      setVoiceTestError(errorMsg);
      toast.error(errorMsg, { duration: 10000 });
    } finally {
      setIsTestingVoice(false);
    }
  };

  const fetchModelsForProvider = async (provider: string, apiKeyInput?: string) => {
    setIsLoadingModels(true);
    try {
      const res = await fetchProviderModelsAction(provider, apiKeyInput);
      if (res.success && res.models && res.models.length > 0) {
        setFetchedProviderModels(prev => ({ ...prev, [provider]: res.models }));
        toast.success(`Loaded ${res.models.length} available ${provider.toUpperCase()} models!`);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err: any) {
      console.warn("Failed to fetch models:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSetActiveVoiceProvider = async (provider: "gemini" | "openai" | "elevenlabs") => {
    const key = apiKeys[provider];
    if (!key) {
      handleSelectVoiceProvider(provider);
      return;
    }
    setIsSavingVoiceConfig(true);
    try {
      const extra = provider === 'elevenlabs' 
        ? { voiceId: elevenLabsVoiceChoice || apiKeys['elevenlabsVoiceId'] } 
        : undefined;
      const configRes = await updateOrganizationAiConfig(provider, key, extra);
      if (!configRes.success) {
        toast.error(configRes.error || "Failed to switch voice engine");
        return;
      }
      setAiProvider(provider);
      setVoiceProviderChoice(provider);
      const toggleRes = await toggleOrganizationVoiceStatus(true);
      if (toggleRes.success) {
        setIsVoiceEnabled(true);
        const name = provider === 'gemini' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'ElevenLabs';
        toast.success(`Active voice source switched to ${name}!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to switch voice engine");
    } finally {
      setIsSavingVoiceConfig(false);
    }
  };

  const handleToggleVoice = async (checked: boolean) => {
    if (checked && !apiKeys['gemini'] && !apiKeys['openai'] && !apiKeys['elevenlabs']) {
      handleOpenVoiceModal(
        (aiProvider === 'gemini' || aiProvider === 'openai' || aiProvider === 'elevenlabs') 
          ? (aiProvider as any) 
          : 'gemini'
      );
      return;
    }

    setIsTogglingVoice(true);
    try {
      const res = await toggleOrganizationVoiceStatus(checked);
      if (res.success) {
        setIsVoiceEnabled(checked);
        const activeName = aiProvider === 'gemini' 
          ? 'Google Gemini' 
          : aiProvider === 'openai' 
          ? 'OpenAI' 
          : aiProvider === 'elevenlabs' 
          ? 'ElevenLabs' 
          : (apiKeys['gemini'] ? 'Google Gemini' : (apiKeys['openai'] ? 'OpenAI' : (apiKeys['elevenlabs'] ? 'ElevenLabs' : 'AI')));
        toast.success(`AI Voice Responses & Transcription ${checked ? 'enabled' : 'disabled'} (${activeName})`);
      } else {
        if ((res as any).needsKey) {
          handleOpenVoiceModal('gemini');
        } else {
          toast.error(res.error || "Failed to update voice status");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update voice status");
    } finally {
      setIsTogglingVoice(false);
    }
  };

  const handleUpdateResponseFormat = async (type: "text" | "voice" | "media", value: "text" | "voice") => {
    const previous = { ...responseFormat };
    const updated = { ...responseFormat, [type]: value };
    setResponseFormat(updated);
    setIsSavingResponseFormat(true);

    const hasAnyVoice = updated.text === 'voice' || updated.voice === 'voice' || updated.media === 'voice';
    if (value === 'voice' && !apiKeys['gemini'] && !apiKeys['openai'] && !apiKeys['elevenlabs']) {
      handleOpenVoiceModal(
        (aiProvider === 'gemini' || aiProvider === 'openai' || aiProvider === 'elevenlabs') 
          ? (aiProvider as any) 
          : 'gemini'
      );
    }

    try {
      const res = await updateOrganizationResponseFormatAction(updated);
      if (res.success && res.formats) {
        setResponseFormat(res.formats);
        if (hasAnyVoice) {
          setIsVoiceEnabled(true);
        } else {
          setIsVoiceEnabled(false);
        }
        const label = type === 'text' ? 'Incoming text messages' : type === 'voice' ? 'Incoming voice notes' : 'Incoming media messages';
        toast.success(`${label} will now receive ${value.toUpperCase()} replies!`);
      } else {
        setResponseFormat(previous);
        toast.error(res.error || "Failed to update response format");
      }
    } catch (err: any) {
      setResponseFormat(previous);
      toast.error(err.message || "Failed to update response format");
    } finally {
      setIsSavingResponseFormat(false);
    }
  };

  const handleSaveVoiceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const providerLabel = voiceProviderChoice === 'gemini' ? 'Google Gemini' : (voiceProviderChoice === 'openai' ? 'OpenAI' : 'ElevenLabs');
    if (!voiceApiKeyInput.trim()) {
      toast.error(`Please enter your ${providerLabel} API key.`);
      return;
    }

    if (voiceProviderChoice === 'elevenlabs' && !elevenLabsVoiceChoice) {
      toast.error("Please select an ElevenLabs voice for speech generation.");
      return;
    }

    setIsSavingVoiceConfig(true);
    try {
      const extra = voiceProviderChoice === 'elevenlabs' 
        ? { voiceId: elevenLabsVoiceChoice } 
        : undefined;

      const configRes = await updateOrganizationAiConfig(voiceProviderChoice, voiceApiKeyInput.trim(), extra);
      if (!configRes.success) {
        toast.error(configRes.error || "Failed to save API key");
        return;
      }

      setApiKeys(prev => ({ 
        ...prev, 
        [voiceProviderChoice]: voiceApiKeyInput.trim(),
        ...(voiceProviderChoice === 'elevenlabs' && elevenLabsVoiceChoice ? { elevenlabsVoiceId: elevenLabsVoiceChoice } : {})
      }));
      setAiProvider(voiceProviderChoice);

      const toggleRes = await toggleOrganizationVoiceStatus(true);
      if (toggleRes.success) {
        setIsVoiceEnabled(true);
        setIsVoiceModalOpen(false);
        const selectedVoiceObj = elevenLabsVoices.find(v => v.id === elevenLabsVoiceChoice);
        const voiceLabel = selectedVoiceObj ? ` (${selectedVoiceObj.name})` : '';
        toast.success(
          `Voice responses enabled with ${voiceProviderChoice === 'gemini' ? 'Google Gemini (' + voiceGeminiModelChoice + ')' : (voiceProviderChoice === 'openai' ? 'OpenAI Whisper & TTS' : 'ElevenLabs Studio TTS' + voiceLabel)} as active source!`
        );
      } else {
        toast.error(toggleRes.error || "Failed to enable voice status");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save voice configuration");
    } finally {
      setIsSavingVoiceConfig(false);
    }
  };

  const handleOpenProviderModal = (providerId: string) => {
    setSelectedProviderModal(providerId);
    setModalKeyInput(apiKeys[providerId] || "");
    setShowKey(false);
  };
  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderModal) return;
    setIsSavingKey(true);
    try {
      const res = await updateOrganizationAiConfig(selectedProviderModal, modalKeyInput);
      if (res.success) {
        setApiKeys(prev => ({ ...prev, [selectedProviderModal]: modalKeyInput }));
        setAiProvider(selectedProviderModal);
        setSelectedProviderModal(null);
        toast.success(`${selectedProviderModal} Configuration saved and set as active!`);
      } else {
        toast.error(res.error || "Failed to update API Key");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update API Key");
    } finally {
      setIsSavingKey(false);
    }
  };
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName) return;
    setIsCreatingAgent(true);
    try {
      const fullInstructions = buildFullInstructions(newAgentInstructions);
      const isCustom = isCustomModel(newAgentModel, newAgentProvider, fetchedProviderModels[newAgentProvider]);
      const resolvedModel = isCustom ? (newAgentCustomModel.trim() || newAgentModel) : newAgentModel;

      let finalCustomVars = [...newAgentCustomVariables];
      if (newAgentDefaultTagId || newAgentQualifiedTagId) {
        finalCustomVars = finalCustomVars.filter(v => v.id !== "_tag_config" && v.type !== "system_tag_config");
        finalCustomVars.push({
          id: "_tag_config",
          name: "_tag_config",
          type: "system_tag_config",
          defaultTagId: newAgentDefaultTagId || undefined,
          qualifiedTagId: newAgentQualifiedTagId || undefined,
        } as any);
      }
      const finalDestinations = Array.isArray(newAgentDestinations) ? newAgentDestinations : [];

      const res = await createAIAgent(organizationId, {
        name: newAgentName,
        aiProvider: newAgentProvider,
        aiProviderApiKey: newAgentKey,
        instructions: fullInstructions,
        isDefault: false,
        model: resolvedModel === "custom" ? "gpt-4o-mini" : resolvedModel,
        temperature: newAgentTemperature,
        maxTokens: newAgentMaxTokens,
        reasoningEffort: newAgentReasoningEffort,
        googleSpreadsheetId: newAgentSpreadsheetId,
        googleSheetName: newAgentSheetName,
        platforms: newAgentPlatforms,
        agentType: newAgentType,
        customVariables: finalCustomVars,
        destinations: finalDestinations,
        keywordResponses: newAgentKeywordResponses,
        delaySeconds: newAgentDelaySeconds,
        posWebhookEnabled: newAgentPosWebhookEnabled,
        posWebhookUrl: newAgentPosWebhookUrl || null,
        posWebhookSecret: newAgentPosWebhookSecret || null,
        fileIds: agentFileIds,
      });
      if (res.success) {
        toast.success("AI Agent created successfully!");
        setNewAgentName("");
        setNewAgentKey("");
        setNewAgentInstructions("");
        setNewAgentModel("gpt-4o-mini");
        setNewAgentCustomModel("");
        setNewAgentTemperature(0.1);
        setNewAgentMaxTokens(2048);
        setNewAgentReasoningEffort("medium");
        setNewAgentSpreadsheetId("");
        setNewAgentSheetName("Sheet1");
        setNewAgentPlatforms(["ALL"]);
        setNewAgentType("lead_collector");
        setNewAgentCustomVariables([
          { id: "var_1", name: "name", label: "Customer Name", type: "text", required: true },
          { id: "var_2", name: "email", label: "Email Address", type: "email", required: false },
          { id: "var_3", name: "phone", label: "Phone Number", type: "phone", required: true },
        ]);
        setNewAgentDestinations([]);
        setNewAgentDelaySeconds(0);
        setNewAgentPosWebhookEnabled(false);
        setNewAgentPosWebhookUrl("");
        setNewAgentPosWebhookSecret("");
        setPosWebhookTestStatus(null);
        setNewAgentKeywordResponses([]);
        setWebsiteScanUrl("");
        setDiscoveredWebsiteRoutes([]);
        setSelectedWebsiteRoutes([]);
        setAgentFileIds([]);
        setAgentAttachedFiles([]);
        await reloadAgents();
        setIsAgentsDialogOpen(false);
      } else {
        toast.error("Failed to create AI Agent");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent || !editingAgent.name) return;
    try {
      const fullInstructions = buildFullInstructions(editingAgent.instructions || "");
      const prov = editingAgent.aiProvider || "openai";
      const isCustom = isCustomModel(editingAgent.model, prov, fetchedProviderModels[prov]);
      const resolvedModel = isCustom ? (editingAgent.customModelName?.trim() || editingAgent.model) : editingAgent.model;

      let finalCustomVars = Array.isArray(editingAgent.customVariables)
        ? [...editingAgent.customVariables]
        : [];
      if (editingAgent.defaultTagId || editingAgent.qualifiedTagId) {
        finalCustomVars = finalCustomVars.filter(v => v.id !== "_tag_config" && v.type !== "system_tag_config");
        finalCustomVars.push({
          id: "_tag_config",
          name: "_tag_config",
          type: "system_tag_config",
          defaultTagId: editingAgent.defaultTagId || undefined,
          qualifiedTagId: editingAgent.qualifiedTagId || undefined,
        } as any);
      } else {
        finalCustomVars = finalCustomVars.filter(v => v.id !== "_tag_config" && v.type !== "system_tag_config");
      }
      const finalDestinations = Array.isArray(editingAgent.destinations) ? editingAgent.destinations : [];

      const res = await updateAIAgent(editingAgent.id, {
        name: editingAgent.name,
        aiProvider: editingAgent.aiProvider,
        aiProviderApiKey: editingAgent.aiProviderApiKey,
        instructions: fullInstructions,
        isDefault: editingAgent.isDefault,
        model: resolvedModel === "custom" ? "gpt-4o-mini" : resolvedModel,
        temperature: editingAgent.temperature,
        maxTokens: editingAgent.maxTokens,
        reasoningEffort: editingAgent.reasoningEffort,
        googleSpreadsheetId: editingAgent.googleSpreadsheetId,
        googleSheetName: editingAgent.googleSheetName,
        platforms: editingAgent.platforms,
        agentType: editingAgent.agentType || "lead_collector",
        customVariables: finalCustomVars,
        destinations: finalDestinations,
        keywordResponses: editingAgent.keywordResponses || [],
        delaySeconds: typeof editingAgent.delaySeconds === "number" ? editingAgent.delaySeconds : 0,
        posWebhookEnabled: !!editingAgent.posWebhookEnabled,
        posWebhookUrl: editingAgent.posWebhookUrl || null,
        posWebhookSecret: editingAgent.posWebhookSecret || null,
        fileIds: agentFileIds,
      });
      if (res.success) {
        toast.success("AI Agent updated successfully!");
        setEditingAgent(null);
        setAgentFileIds([]);
        setAgentAttachedFiles([]);
        setWebsiteScanUrl("");
        setDiscoveredWebsiteRoutes([]);
        setSelectedWebsiteRoutes([]);
        await reloadAgents();
        setIsAgentsDialogOpen(false);
      } else {
        toast.error("Failed to update AI Agent");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update agent");
    }
  };

  const handleTestPosWebhook = async () => {
    const url = (editingAgent ? editingAgent.posWebhookUrl : newAgentPosWebhookUrl)?.trim();
    const secret = (editingAgent ? editingAgent.posWebhookSecret : newAgentPosWebhookSecret)?.trim();
    if (!url) {
      toast.error("Please enter a POS Webhook URL first.");
      return;
    }
    setIsTestingPosWebhook(true);
    setPosWebhookTestStatus("testing");
    try {
      const res = await testPOSWebhookAction(url, secret);
      if (res.success) {
        toast.success(`POS Webhook test succeeded! Endpoint responded with HTTP ${res.status || 200}`);
        setPosWebhookTestStatus(`✅ HTTP ${res.status || 200}: Success! POS captured test order.`);
      } else {
        toast.error(`POS Webhook test failed: ${res.error}`);
        setPosWebhookTestStatus(`❌ Failed: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to test webhook");
      setPosWebhookTestStatus(`❌ ${err.message}`);
    } finally {
      setIsTestingPosWebhook(false);
    }
  };

  const openCreateAgentDialog = () => {
    setEditingAgent(null);
    setNewAgentInstructions("");
    setNewAgentCustomModel("");
    setNewAgentPlatforms(["ALL"]);
    setNewAgentType("lead_collector");
    setNewAgentCustomVariables([
      { id: "var_1", name: "name", label: "Customer Name", type: "text", required: true },
      { id: "var_2", name: "email", label: "Email Address", type: "email", required: false },
      { id: "var_3", name: "phone", label: "Phone Number", type: "phone", required: true },
    ]);
    setNewAgentDestinations([]);
    setNewAgentDelaySeconds(0);
    setNewAgentPosWebhookEnabled(false);
    setNewAgentPosWebhookUrl("");
    setNewAgentPosWebhookSecret("");
    setPosWebhookTestStatus(null);
    setNewAgentDefaultTagId("");
    setNewAgentQualifiedTagId("");
    reloadTagsAndStages();
    setNewAgentKeywordResponses([]);
    setWebsiteScanUrl("");
    setDiscoveredWebsiteRoutes([]);
    setSelectedWebsiteRoutes([]);
    setAgentFileIds([]);
    setAgentAttachedFiles([]);
    setAgentModalTab("editor");
    setIsAgentsDialogOpen(true);
    const prov = newAgentProvider || "openai";
    const key = newAgentKey || apiKeys[prov];
    if (key && !fetchedProviderModels[prov]) {
      fetchModelsForProvider(prov, key);
    }
  };

  const openEditAgentDialog = (agent: (typeof agents)[number]) => {
    const existingFiles = agent.agentFiles?.map((af: any) => {
      const kb = af.knowledgeBase;
      const isWeb = !!(kb?.sourceUrl || (kb?.title && kb.title.startsWith("[Web]")));
      let displayName = kb?.title || kb?.fileName || "Attached Document";
      displayName = displayName.replace(/^\[Web\]\s*/i, "").trim();

      let badge = isWeb ? "Web" : "File";
      if (!isWeb && kb?.fileName && kb.fileName.includes(".")) {
        badge = kb.fileName.split(".").pop()?.toUpperCase() || "File";
      }

      return {
        id: kb?.id || af.knowledgeBaseId,
        name: displayName,
        size: badge,
        content: kb?.content || "",
        sourceUrl: kb?.sourceUrl || undefined,
        isWeb,
      };
    }) || [];
    
    let cleanInstructions = agent.instructions || "";
    if (cleanInstructions.includes("### KNOWLEDGE FILE:")) {
      cleanInstructions = cleanInstructions.split("### KNOWLEDGE FILE:")[0].trim();
    } else if (cleanInstructions.includes("### KNOWLEDGE DATA:")) {
      cleanInstructions = cleanInstructions.split("### KNOWLEDGE DATA:")[0].trim();
    }
    
    const prov = agent.aiProvider || "openai";
    const isCustom = isCustomModel(agent.model, prov);

    const tagConfig = Array.isArray(agent.customVariables)
      ? (agent.customVariables as any[]).find(
          (c: any) => c && typeof c === "object" && (c.type === "system_tag_config" || c.id === "_tag_config")
        )
      : null;

    setEditingAgent({
      ...agent,
      instructions: cleanInstructions,
      customModelName: isCustom ? agent.model : "",
      platforms: agent.platforms && agent.platforms.length > 0 ? agent.platforms : ["ALL"],
      agentType: agent.agentType || "lead_collector",
      defaultTagId: tagConfig?.defaultTagId || "",
      qualifiedTagId: tagConfig?.qualifiedTagId || "",
      customVariables: Array.isArray(agent.customVariables) && agent.customVariables.length > 0
        ? agent.customVariables.filter((c: any) => c && typeof c === "object" && c.type !== "system_tag_config" && c.id !== "_tag_config")
        : [
            { id: "var_1", name: "name", label: "Customer Name", type: "text", required: true },
            { id: "var_2", name: "email", label: "Email Address", type: "email", required: false },
            { id: "var_3", name: "phone", label: "Phone Number", type: "phone", required: true },
          ],
      destinations: Array.isArray(agent.destinations)
        ? agent.destinations
        : [],
      keywordResponses: Array.isArray(agent.keywordResponses)
        ? agent.keywordResponses
        : [],
      delaySeconds: typeof agent.delaySeconds === "number" ? agent.delaySeconds : 0,
      posWebhookEnabled: !!(agent as any).posWebhookEnabled,
      posWebhookUrl: (agent as any).posWebhookUrl || "",
      posWebhookSecret: (agent as any).posWebhookSecret || "",
    });
    reloadTagsAndStages();
    setAgentFileIds(agent.agentFiles?.map((f: any) => f.knowledgeBaseId) || []);
    setAgentAttachedFiles(existingFiles);
    setIsAttachedFilesCollapsed(false);
    setWebsiteScanUrl("");
    setDiscoveredWebsiteRoutes([]);
    setSelectedWebsiteRoutes([]);
    setImportProgress({
      isOpen: false,
      total: 0,
      current: 0,
      currentUrl: "",
      currentTitle: "",
      percent: 0,
      completed: 0,
      failed: 0,
      status: "idle",
      startTime: 0,
      estimatedSecondsRemaining: null,
    });
    setAgentModalTab("editor");
    setIsAgentsDialogOpen(true);
    const key = agent.aiProviderApiKey || apiKeys[prov];
    if (key && !fetchedProviderModels[prov]) {
      fetchModelsForProvider(prov, key);
    }
  };

  const handleScanWebsite = async (urlOverride?: any) => {
    const raw = (typeof urlOverride === "string" ? urlOverride : websiteScanUrl).trim();
    if (!raw) {
      toast.error("Please enter a website URL to scan (e.g. https://example.com)");
      return;
    }
    setIsScanningWebsite(true);
    try {
      const res = await discoverWebsiteRoutesAction(raw);
      if (res.success && res.routes) {
        setDiscoveredWebsiteRoutes(res.routes);
        // Preselect all non-root routes by default
        setSelectedWebsiteRoutes(res.routes.map((r: any) => r.url));
        toast.success(`Discovered ${res.routes.length} route(s) on ${raw}!`);
      } else {
        toast.error("Could not discover any routes on this website.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scan website routes");
    } finally {
      setIsScanningWebsite(false);
    }
  };

  const handleAbortImport = () => {
    abortImportRef.current = true;
    toast.info("Stopping import after current page completes...");
  };

  const handleCloseImportProgress = () => {
    setImportProgress((prev) => ({ ...prev, isOpen: false }));
    setDiscoveredWebsiteRoutes([]);
    setSelectedWebsiteRoutes([]);
    setWebsiteScanUrl("");
  };

  const handleImportSelectedWebsitePages = async () => {
    if (selectedWebsiteRoutes.length === 0) {
      toast.error("Please select at least one page to import.");
      return;
    }

    const pagesToImport = discoveredWebsiteRoutes
      .filter((r) => selectedWebsiteRoutes.includes(r.url))
      .map((r) => ({ url: r.url, title: r.title }));

    const total = pagesToImport.length;
    abortImportRef.current = false;
    setIsImportingWebsite(true);

    const startTime = Date.now();
    setImportProgress({
      isOpen: true,
      total,
      current: 1,
      currentUrl: pagesToImport[0].url,
      currentTitle: pagesToImport[0].title || pagesToImport[0].url,
      percent: 0,
      completed: 0,
      failed: 0,
      status: "running",
      startTime,
      estimatedSecondsRemaining: Math.max(10, total * 3),
    });

    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < total; i++) {
      if (abortImportRef.current) {
        setImportProgress((prev) => ({
          ...prev,
          status: "aborted",
          estimatedSecondsRemaining: 0,
        }));
        toast.info(`Import stopped. ${completedCount} page(s) successfully added.`);
        break;
      }

      const p = pagesToImport[i];
      const pageNum = i + 1;
      const elapsedMs = Date.now() - startTime;
      const avgMsPerPage = i > 0 ? elapsedMs / i : 3000;
      const remainingPages = total - i;
      const estSecs = Math.max(1, Math.round((avgMsPerPage * remainingPages) / 1000));

      setImportProgress((prev) => ({
        ...prev,
        current: pageNum,
        currentUrl: p.url,
        currentTitle: p.title || p.url,
        percent: Math.round((i / total) * 100),
        estimatedSecondsRemaining: estSecs,
      }));

      try {
        const res = await importSingleWebsitePageAction({
          organizationId,
          aiAgentId: editingAgent?.id,
          page: p,
        });

        if (res.success && res.entry) {
          completedCount++;
          const cleanName = (res.entry.title || "Web Page").replace(/^\[Web\]\s*/i, "").trim();

          setAgentAttachedFiles((prev) => {
            if (prev.some((f) => f.id === res.entry!.id)) return prev;
            return [
              ...prev,
              {
                id: res.entry!.id,
                name: cleanName,
                size: "Web",
                content: res.entry!.content || "",
                sourceUrl: res.entry!.url,
                isWeb: true,
              },
            ];
          });

          setAgentFileIds((prev) => Array.from(new Set([...prev, res.entry!.id])));

          setImportProgress((prev) => ({
            ...prev,
            completed: completedCount,
            percent: Math.round(((i + 1) / total) * 100),
          }));
        } else {
          failedCount++;
          setImportProgress((prev) => ({
            ...prev,
            failed: failedCount,
          }));
        }
      } catch (pageErr) {
        console.warn(`Failed to import page ${p.url}:`, pageErr);
        failedCount++;
        setImportProgress((prev) => ({
          ...prev,
          failed: failedCount,
        }));
      }
    }

    if (completedCount > 0) {
      await finalizeWebsiteImportAction({
        organizationId,
        aiAgentId: editingAgent?.id,
        count: completedCount,
        sampleUrl: pagesToImport[0]?.url,
      }).catch(() => {});
      await reloadEntries();
      toast.success(`Successfully imported ${completedCount} page(s) into Knowledge Base!`);
    }

    setImportProgress((prev) => ({
      ...prev,
      percent: 100,
      current: total,
      status: prev.status === "aborted" ? "aborted" : "completed",
      estimatedSecondsRemaining: 0,
    }));

    setIsImportingWebsite(false);
  };

  const handleUploadKeywordMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingKeywordMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success || !data.url) {
        toast.error(data.error || "Failed to upload media file");
        return;
      }
      setTempKeywordUrl(data.url);
      setTempKeywordFileName(data.originalName || file.name);

      // Auto-detect response type from file mime
      const mime = file.type.toLowerCase();
      if (mime.includes("pdf") || mime.includes("doc") || mime.includes("text") || mime.includes("sheet")) {
        setTempKeywordType("document");
      } else if (mime.includes("image")) {
        setTempKeywordType("image");
      } else if (mime.includes("video")) {
        setTempKeywordType("video");
      } else if (mime.includes("audio")) {
        setTempKeywordType("audio");
      } else {
        setTempKeywordType("file");
      }

      toast.success(`Attached "${file.name}" for keyword response!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload media file");
    } finally {
      setIsUploadingKeywordMedia(false);
      e.target.value = "";
    }
  };

  const handleAddKeywordRule = () => {
    const kw = tempKeyword.trim().toLowerCase();
    if (!kw) {
      toast.error("Please enter a trigger keyword (e.g. menu, price, location)");
      return;
    }
    if (!tempKeywordUrl.trim()) {
      toast.error("Please choose a file from the Media Library");
      return;
    }

    const newRule = {
      id: `rule_${Date.now()}`,
      keyword: kw,
      responseType: tempKeywordType,
      mediaUrl: tempKeywordUrl.trim(),
      fileName: tempKeywordFileName.trim() || kw,
    };

    if (editingAgent) {
      setEditingAgent({
        ...editingAgent,
        keywordResponses: [...(editingAgent.keywordResponses || []), newRule],
      });
    } else {
      setNewAgentKeywordResponses((prev) => [...prev, newRule]);
    }

    setTempKeyword("");
    setTempKeywordUrl("");
    setTempKeywordFileName("");
    toast.success(`Keyword rule for "${kw}" added!`);
  };

  const handleRemoveKeywordRule = (index: number) => {
    if (editingAgent) {
      setEditingAgent({
        ...editingAgent,
        keywordResponses: (editingAgent.keywordResponses || []).filter((_: any, i: number) => i !== index),
      });
    } else {
      setNewAgentKeywordResponses((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddCustomVariable = (nameVal?: string, typeVal?: string) => {
    const rawName = (nameVal || tempVarName).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!rawName) {
      toast.error("Please enter a variable name (e.g. name, email, address, product)");
      return;
    }

    const currentVars = editingAgent ? (editingAgent.customVariables || []) : newAgentCustomVariables;
    if (currentVars.some((v: any) => v.name.toLowerCase() === rawName.toLowerCase())) {
      toast.error(`Variable "${rawName}" is already added.`);
      return;
    }

    const newVar = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      type: typeVal || tempVarType || "text",
      required: false,
    };

    if (editingAgent) {
      setEditingAgent({
        ...editingAgent,
        customVariables: [...currentVars, newVar],
      });
    } else {
      setNewAgentCustomVariables((prev) => [...prev, newVar]);
    }

    setTempVarName("");
    setTempVarType("text");
  };

  const handleRemoveCustomVariable = (index: number) => {
    if (editingAgent) {
      setEditingAgent({
        ...editingAgent,
        customVariables: (editingAgent.customVariables || []).filter((_: any, i: number) => i !== index),
      });
    } else {
      setNewAgentCustomVariables((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleApplyAgentTypePresets = (type: "lead_collector" | "ordering_collector" | "appointment_collector") => {
    let vars: Array<{ id: string; name: string; label: string; type: string; required?: boolean }> = [];
    let dests: string[] = ["spreadsheet"];

    if (type === "lead_collector") {
      vars = [
        { id: `var_1_${Date.now()}`, name: "name", label: "Customer Name", type: "text", required: true },
        { id: `var_2_${Date.now()}`, name: "email", label: "Email Address", type: "email", required: false },
        { id: `var_3_${Date.now()}`, name: "phone", label: "Phone Number", type: "phone", required: true },
      ];
      dests = ["spreadsheet"];
    } else if (type === "ordering_collector") {
      vars = [
        { id: `var_1_${Date.now()}`, name: "name", label: "Customer Name", type: "text", required: true },
        { id: `var_2_${Date.now()}`, name: "phone", label: "Phone Number", type: "phone", required: true },
        { id: `var_3_${Date.now()}`, name: "product", label: "Product / Item", type: "text", required: true },
        { id: `var_4_${Date.now()}`, name: "quantity", label: "Quantity", type: "number", required: true },
        { id: `var_5_${Date.now()}`, name: "address", label: "Delivery Address", type: "text", required: true },
      ];
      dests = ["spreadsheet", "ordering_system"];
    } else if (type === "appointment_collector") {
      vars = [
        { id: `var_1_${Date.now()}`, name: "name", label: "Customer Name", type: "text", required: true },
        { id: `var_2_${Date.now()}`, name: "phone", label: "Phone Number", type: "phone", required: true },
        { id: `var_3_${Date.now()}`, name: "appointment_date", label: "Appointment Date (YYYY-MM-DD)", type: "date", required: true },
        { id: `var_4_${Date.now()}`, name: "appointment_time", label: "Appointment Time (HH:MM)", type: "time", required: true },
      ];
      dests = ["spreadsheet", "appointment_system"];
    }

    if (editingAgent) {
      setEditingAgent({
        ...editingAgent,
        agentType: type,
        customVariables: vars,
        destinations: dests,
      });
    } else {
      setNewAgentType(type);
      setNewAgentCustomVariables(vars);
      setNewAgentDestinations(dests);
    }
  };

  const handleAgentsDialogOpenChange = (open: boolean) => {
    setIsAgentsDialogOpen(open);
    if (!open) {
      setEditingAgent(null);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this AI Agent? This will also delete all associated knowledge base entries and sheets.")) return;
    try {
      const res = await deleteAIAgent(id);
      if (res.success) {
        toast.success("AI Agent deleted successfully!");
        if (selectedAgentId === id) {
          setSelectedAgentId("");
        }
        await reloadEntries();
      } else {
        toast.error("Failed to delete AI Agent");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete agent");
    }
  };

  const handleSetActiveAgent = async (agentId: string | null, label: string) => {
    try {
      const res = await setDefaultAIAgent(organizationId, agentId === "global" ? null : agentId);
      if (res.success) {
        const nextId = agentId === "global" ? null : agentId;
        setSelectedAgentId(nextId || "");
        setAgents((prev) => prev.map((item) => ({ ...item, isDefault: !!nextId && item.id === nextId })));
        setEditingAgent((current: any | null) => current ? { ...current, isDefault: !!nextId && current.id === nextId } : current);
        const movedContacts = typeof res.clearedContactCount === "number" && res.clearedContactCount > 0
          ? ` ${res.clearedContactCount} chat${res.clearedContactCount === 1 ? "" : "s"} moved to the new default.`
          : "";
        if (nextId) {
          toast.success(`${label} is active now.${movedContacts}`);
        } else {
          toast.success(`Active AI Agent deactivated.${movedContacts}`);
        }
        await reloadAgents();
      } else {
        toast.error("Failed to update active agent");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update active agent");
    }
  };

  const handleDuplicateAgent = async (agent: any) => {
    try {
      const res = await duplicateAIAgent(agent.id);
      if (res.success) {
        toast.success(`${agent.name} duplicated`);
        await reloadEntries();
      } else {
        toast.error("Failed to duplicate agent");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate agent");
    }
  };

  const openTestAgent = (agent: any) => {
    setTestAgent(agent);
    setTestPrompt("Hi, how can you help me?");
    setTestReply("");
  };

  const handleRunAgentTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!testAgent || !testPrompt.trim()) {
      toast.error("Enter a message to test");
      return;
    }

    setIsTestingAgent(true);
    setTestReply("");
    setTestMedia([]);
    try {
      const res = await testAIAgent(testAgent.id, testPrompt);
      if (res.success) {
        setTestReply(res.reply || "No response returned.");
        setTestMedia(res.media || []);
      } else {
        toast.error("Agent test failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Agent test failed");
      setTestReply(err.message || "Agent test failed");
      setTestMedia([]);
    } finally {
      setIsTestingAgent(false);
    }
  };

  const syncKnowledgeForScope = (aiAgentId?: string | null) => {
    if (isSyncing) return;

    setIsSyncing(true);
    const syncPromise = syncKnowledgeAction(organizationId, aiAgentId || null).then((res) => {
      if (!res.success) {
        throw new Error(res.error || "System error");
      }
      return res;
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Sync request timed out. Refresh the page after compiling finishes, then try again."));
      }, 45000);
    });

    const guardedPromise = Promise.race([syncPromise, timeoutPromise]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      setIsSyncing(false);
    });

    toast.promise(guardedPromise, {
      loading: "Synchronizing knowledge model vectors with WatiBot engine...",
      success: () => "AI knowledge vectors updated.",
      error: (err) => `Failed to sync AI: ${err.message || "System error"}`
    });
  };

  const renderAgentActionsMenu = (agent: any, buttonClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={buttonClassName}
          aria-label={`Open ${agent.name} actions`}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="z-[20000] w-44 rounded-xl">
        {selectedAgentId === agent.id ? (
          <>
            <DropdownMenuItem
              onClick={() => handleSetActiveAgent(null, agent.name)}
              className="cursor-pointer rounded-lg text-[12px] font-bold text-amber-600 focus:text-amber-600"
            >
              <CheckCircle2 className="w-3.5 h-3.5 opacity-50" />
              Deactivate Agent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => handleSetActiveAgent(agent.id, agent.name)}
              className="cursor-pointer rounded-lg text-[12px] font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Set Active
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => openTestAgent(agent)}
          className="cursor-pointer rounded-lg text-[12px] font-bold"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Test Now
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDuplicateAgent(agent)}
          className="cursor-pointer rounded-lg text-[12px] font-bold"
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => syncKnowledgeForScope(agent.id)}
          disabled={isSyncing}
          className="cursor-pointer rounded-lg text-[12px] font-bold"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
          Sync Knowledge
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleDeleteAgent(agent.id)}
          className="cursor-pointer rounded-lg text-[12px] font-bold text-red-600 focus:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const resetFunctionForm = () => {
    setFunctionForm({
      id: "",
      name: "",
      description: "",
      googleSpreadsheetId: "",
      googleSheetName: "Sheet1",
      finalMessage: "Thanks. I have collected your details and our team will continue from here.",
      aiAgentId: "global",
      isActive: true,
    });
    setFunctionFields([
      { name: "email", label: "Email", type: "email", required: true, description: "Customer email address" },
      { name: "phone", label: "Phone Number", type: "phone", required: true, description: "Customer phone or WhatsApp number" },
    ]);
  };

  const handleFunctionFieldChange = (index: number, key: string, value: string | boolean) => {
    setFunctionFields((prev) => prev.map((field, fieldIndex) => (
      fieldIndex === index ? { ...field, [key]: value } : field
    )));
  };

  const handleEditFunction = (aiFunction: any) => {
    const fields = Array.isArray(aiFunction.fields) && aiFunction.fields.length > 0
      ? aiFunction.fields
      : [{ name: "email", label: "Email", type: "email", required: true, description: "Customer email address" }];
    setFunctionForm({
      id: aiFunction.id,
      name: aiFunction.name || "",
      description: aiFunction.description || "",
      googleSpreadsheetId: aiFunction.googleSpreadsheetId || "",
      googleSheetName: aiFunction.googleSheetName || "Sheet1",
      finalMessage: aiFunction.finalMessage || "Thanks. I have collected your details and our team will continue from here.",
      aiAgentId: aiFunction.aiAgentId || "global",
      isActive: aiFunction.isActive !== false,
    });
    setFunctionFields(fields);
    setWorkspaceTab("functions");
  };

  const handleSaveFunction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!functionForm.name.trim()) {
      toast.error("Function name is required");
      return;
    }
    if (functionFields.length === 0) {
      toast.error("Add at least one data field");
      return;
    }

    setIsSavingFunction(true);
    try {
      const payload = {
        name: functionForm.name,
        description: functionForm.description,
        fields: functionFields,
        googleSpreadsheetId: functionForm.googleSpreadsheetId || null,
        googleSheetName: functionForm.googleSheetName || null,
        finalMessage: functionForm.finalMessage,
        aiAgentId: functionForm.aiAgentId === "global" ? null : functionForm.aiAgentId,
        isActive: functionForm.isActive,
      };
      const res = functionForm.id
        ? await updateAIFunction(functionForm.id, payload)
        : await createAIFunction(organizationId, payload);

      if (res.success) {
        toast.success(functionForm.id ? "AI Function updated" : "AI Function created");
        resetFunctionForm();
        await reloadAITools();
      } else {
        toast.error("Failed to save AI Function");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save AI Function");
    } finally {
      setIsSavingFunction(false);
    }
  };

  const handleDeleteFunction = async (id: string) => {
    if (!confirm("Delete this AI Function?")) return;
    try {
      const res = await deleteAIFunction(id);
      if (res.success) {
        toast.success("AI Function deleted");
        await reloadAITools();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete AI Function");
    }
  };

  const resetMcpForm = () => {
    setMcpForm({
      id: "",
      name: "",
      description: "",
      url: "",
      authType: "none",
      accessToken: "",
      apiKey: "",
      aiAgentId: "global",
      isActive: true,
    });
    setMcpCustomHeaders("");
  };

  const handleEditMcpServer = (server: any) => {
    setMcpForm({
      id: server.id,
      name: server.name || "",
      description: server.description || "",
      url: server.url || "",
      authType: server.authType || "none",
      accessToken: "",
      apiKey: "",
      aiAgentId: server.aiAgentId || "global",
      isActive: server.isActive !== false,
    });
    setMcpCustomHeaders(server.customHeaders ? JSON.stringify(server.customHeaders, null, 2) : "");
    setWorkspaceTab("mcp");
  };

  const handleSaveMcpServer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mcpForm.name.trim() || !mcpForm.url.trim()) {
      toast.error("Name and URL are required");
      return;
    }

    let parsedHeaders: Record<string, string> | null = null;
    if (mcpCustomHeaders.trim()) {
      try {
        parsedHeaders = JSON.parse(mcpCustomHeaders);
      } catch {
        toast.error("Custom headers must be valid JSON");
        return;
      }
    }

    setIsSavingMcp(true);
    try {
      const payload: any = {
        name: mcpForm.name,
        description: mcpForm.description,
        url: mcpForm.url,
        authType: mcpForm.authType,
        customHeaders: parsedHeaders,
        aiAgentId: mcpForm.aiAgentId === "global" ? null : mcpForm.aiAgentId,
        isActive: mcpForm.isActive,
      };

      if (!mcpForm.id || mcpForm.accessToken.trim()) {
        payload.accessToken = mcpForm.accessToken;
      }
      if (!mcpForm.id || mcpForm.apiKey.trim()) {
        payload.apiKey = mcpForm.apiKey;
      }

      const res = mcpForm.id
        ? await updateAIMcpServer(mcpForm.id, payload)
        : await createAIMcpServer(organizationId, payload);

      if (res.success) {
        toast.success(mcpForm.id ? "MCP Server updated" : "MCP Server added");
        resetMcpForm();
        await reloadAITools();
      } else {
        toast.error("Failed to save MCP Server");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save MCP Server");
    } finally {
      setIsSavingMcp(false);
    }
  };

  const handleDeleteMcpServer = async (id: string) => {
    if (!confirm("Delete this MCP Server?")) return;
    try {
      const res = await deleteAIMcpServer(id);
      if (res.success) {
        toast.success("MCP Server deleted");
        await reloadAITools();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete MCP Server");
    }
  };

  const handleTestMcpServer = async (id: string) => {
    setIsTestingMcp(id);
    try {
      const res = await testAIMcpServer(id);
      if (res.success) {
        toast.success(`Connected: ${res.status}`);
      } else {
        toast.error(res.message || "Connection failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    } finally {
      setIsTestingMcp(null);
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const agentIdFromForm = formData.get("aiAgentId");
    if (agentIdFromForm === "global") {
      formData.delete("aiAgentId");
    } else if (!agentIdFromForm && selectedAgentId !== "global") {
      formData.append("aiAgentId", selectedAgentId);
    }
    try {
      setIsAdding(true);
      await addKnowledgeEntry(formData, organizationId);
      toast.success(t("toastAdded"));
      form.reset();
      setIsDialogOpen(false);
      await reloadEntries();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editEntry) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;

    try {
      setIsEditing(true);
      await updateKnowledgeEntry(editEntry.id, title, content);
      toast.success(t("toastUpdated"));
      setEditEntry(null);
      await reloadEntries();
    } catch (err: any) {
      toast.error(err.message || t("toastUpdateFailed"));
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteKnowledgeEntry(id);
      setEntries(entries.filter(e => e.id !== id));
      toast.success(t("toastDeleted"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSyncNow = async () => {
    syncKnowledgeForScope(selectedAgentId === "global" ? null : selectedAgentId);
  };
  const faqCount = entries.filter(e => detectCategory(e.title, e.content) === "FAQs").length;
  const profileCount = entries.filter(e => detectCategory(e.title, e.content) === "Business Profile").length;
  const productCount = entries.filter(e => detectCategory(e.title, e.content) === "Products & Services").length;
  const policyCount = entries.filter(e => detectCategory(e.title, e.content) === "Policy Sheets").length;
  const totalCount = entries.length;
  const agentDisplayCount = agents.length;

  const faqPercent = totalCount > 0 ? Math.round((faqCount / totalCount) * 100) : 0;
  const profilePercent = totalCount > 0 ? Math.round((profileCount / totalCount) * 100) : 0;
  const productPercent = totalCount > 0 ? Math.round((productCount / totalCount) * 100) : 0;
  const policyPercent = totalCount > 0 ? Math.round((policyCount / totalCount) * 100) : 0;

  const faqOffset = profilePercent;
  const productOffset = faqOffset + faqPercent;
  const policyOffset = productOffset + productPercent;

  const filteredEntries = entries.filter(entry => {
    // Agent filter
    const isAgentMatch = selectedAgentId === "global"
      ? (!entry.agentFiles || entry.agentFiles.length === 0)
      : entry.agentFiles?.some((af: any) => af.aiAgent?.id === selectedAgentId);

    if (!isAgentMatch) return false;

    // Exclude Google Sheet entries — they are shown in the header pill, not as cards
    if (entry.sourceUrl?.startsWith("googlesheets://")) return false;

    // Search filter
    const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());

    // Tab Filter (Category mapping)
    const category = detectCategory(entry.title, entry.content);
    const matchesTab = activeTab === "All Knowledge" || category === activeTab;

    // Status filter
    const matchesStatus = statusFilter === "All" || entry.status === statusFilter.toLowerCase();

    return matchesSearch && matchesTab && matchesStatus;
  });

  const headerActionButtonClass =
    "inline-flex h-11 w-full sm:w-auto sm:min-w-[154px] items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold leading-none whitespace-nowrap transition-all active:scale-95 cursor-pointer plus-jakarta-forced";

  return (
    <DashboardLayoutClient mainClassName="p-0 bg-slate-50/50 dark:bg-slate-950/20 antialiased h-[calc(100vh-64px)] overflow-hidden transition-colors duration-300 plus-jakarta-forced">
      <div className="h-full overflow-y-auto p-6 md:p-8">
        <div className="max-w-[1600px] mx-auto space-y-6">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <Database className="w-6 h-6 text-[#00B074]" />
                {t("title")}
              </h2>
              <p className="text-slate-450 dark:text-slate-400 text-[13px] font-semibold">
                {t("subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-start md:justify-end gap-3">
              {/* Upload Document Dialog */}
              <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
                if (open) setUploadAgentId(selectedAgentId);
                setIsUploadDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <button className={cn(headerActionButtonClass, "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm")}>
                    <Upload className="w-4 h-4 text-[#00B074] shrink-0" /> Upload Document
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-xl rounded-[24px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced">
                  <div className="p-7">
                    <DialogHeader className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <DialogTitle className="text-[18px] font-black flex items-center gap-2 text-slate-800 dark:text-white plus-jakarta-forced">
                        <Upload className="w-5 h-5 text-[#00B074]" />
                        Upload Document
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-3 mb-4 flex items-start gap-3">
                      <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                          Uploading knowledge for: 
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                            {uploadAgentId === "global" ? "Global Knowledge" : (agents.find(a => a.id === uploadAgentId)?.name || "Unknown Agent")}
                          </span>
                        </p>
                        <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 leading-snug">
                          This file will only be accessible to the selected AI Agent during responses.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleUpload} className="space-y-5 plus-jakarta-forced">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">Title (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Refund Policy (Defaults to file name)"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all plus-jakarta-forced"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">Assign to AI Agent</label>
                        <select
                          value={uploadAgentId}
                          onChange={(e) => setUploadAgentId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all plus-jakarta-forced"
                        >
                          <option value="global">Global Knowledge (Accessible to agents without specific files)</option>
                          {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">Select Document</label>
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#00B074] rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-900/50 relative group">
                          <input
                            type="file"
                            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            required
                          />
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-8 h-8 text-slate-400 group-hover:text-[#00B074] transition-colors" />
                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 plus-jakarta-forced">
                              {selectedFile ? selectedFile.name : "Click to select or drag document or menu image here"}
                            </span>
                            <span className="text-[10.5px] font-bold text-slate-450 dark:text-slate-400 plus-jakarta-forced">
                              Supports PDF, Word, Excel, Text, or Menu Images (PNG, JPG, WebP)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setUploadTitle("");
                            setIsUploadDialogOpen(false);
                          }}
                          className="px-4 py-2 text-[12px] font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 transition-all plus-jakarta-forced cursor-pointer active:scale-95"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="px-5 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-[12px] flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 plus-jakarta-forced"
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          Upload & Parse
                        </button>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Import from Website Dialog */}
              <Dialog open={isWebDialogOpen} onOpenChange={(open) => {
                if (open) setWebAgentId(selectedAgentId);
                setIsWebDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <button className={cn(headerActionButtonClass, "border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 shadow-sm")}>
                    <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" /> Import from Website
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-xl rounded-[24px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced">
                  <div className="p-7">
                    <DialogHeader className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <DialogTitle className="text-[18px] font-black flex items-center gap-2 text-slate-800 dark:text-white plus-jakarta-forced">
                        <Globe className="w-5 h-5 text-indigo-600" />
                        Import from Website / URL
                      </DialogTitle>
                    </DialogHeader>

                    <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3.5 mb-4 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                          Automated AI Web Crawling
                        </p>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5 leading-relaxed">
                          Enter your website link. WatiBot will automatically scrape clean text, FAQs, products, and headings so your WhatsApp AI Agent can answer customer inquiries accurately.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleScrapeWebsite} className="space-y-4 plus-jakarta-forced">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Website URL <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="url"
                            value={webUrl}
                            onChange={(e) => setWebUrl(e.target.value)}
                            placeholder="https://example.com/about or https://mybrand.com/faq"
                            required
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Custom Title (Optional)
                        </label>
                        <input
                          type="text"
                          value={webTitle}
                          onChange={(e) => setWebTitle(e.target.value)}
                          placeholder="e.g., Official Pricing & Services"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                            Crawl Mode
                          </label>
                          <select
                            value={webCrawlMode}
                            onChange={(e) => setWebCrawlMode(e.target.value as any)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12px] font-bold outline-none focus:border-indigo-500 transition-all"
                          >
                            <option value="single">Single Page (Fast)</option>
                            <option value="deep">Smart Crawl (Multi-Page)</option>
                          </select>
                        </div>

                        {webCrawlMode === "deep" ? (
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                              Max Subpages
                            </label>
                            <select
                              value={webMaxPages}
                              onChange={(e) => setWebMaxPages(Number(e.target.value))}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12px] font-bold outline-none focus:border-indigo-500 transition-all"
                            >
                              <option value="3">Top 3 Pages</option>
                              <option value="5">Top 5 Pages (Recommended)</option>
                              <option value="8">Top 8 Pages</option>
                              <option value="10">Top 10 Pages</option>
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                              Target Page
                            </label>
                            <div className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 text-slate-500 text-[12px] font-bold truncate">
                              Exact URL Only
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Assign to AI Agent
                        </label>
                        <select
                          value={webAgentId}
                          onChange={(e) => setWebAgentId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="global">Global Knowledge (Accessible to all AI Agents)</option>
                          {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </div>

                      {isScrapingWeb && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-2 text-xs">
                          <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              {webCrawlMode === "deep" ? `Crawling website & extracting up to ${webMaxPages} subpages...` : "Scraping website page content..."}
                            </span>
                          </div>
                          <div className="w-full bg-indigo-100 dark:bg-indigo-900/60 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full w-full animate-pulse" />
                          </div>
                          <p className="text-[10.5px] text-indigo-600 dark:text-indigo-400">
                            Please keep this window open while pages are being extracted and synchronized.
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                        <button
                          type="button"
                          onClick={() => {
                            setWebUrl("");
                            setWebTitle("");
                            setIsWebDialogOpen(false);
                          }}
                          className="px-4 py-2 text-[12px] font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer active:scale-95"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isScrapingWeb}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-[12px] flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
                        >
                          {isScrapingWeb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                          <span>{isScrapingWeb ? (webCrawlMode === "deep" ? "Crawling Pages..." : "Scraping...") : "Scrape & Save Website"}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>



              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className={cn(headerActionButtonClass, "bg-[#00B074] hover:bg-[#009c66] text-white shadow-md shadow-emerald-500/20")}>
                    <Plus className="w-4 h-4 shrink-0" /> {t("addNewEntry")}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-xl rounded-[24px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced">
                  <div className="p-7">
                    <DialogHeader className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <DialogTitle className="text-[18px] font-black flex items-center gap-2 text-slate-800 dark:text-white">
                        <BookOpen className="w-5 h-5 text-[#00B074]" />
                        {t("newEntryTitle")}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="space-y-5 plus-jakarta-forced">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">{t("fieldTitle")}</label>
                        <input
                          name="title"
                          type="text"
                          placeholder={t("titlePlaceholder")}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all plus-jakarta-forced"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">{t("fieldContent")}</label>
                        <textarea
                          name="content"
                          rows={6}
                          placeholder={t("contentPlaceholder")}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] resize-none min-h-[120px] transition-all plus-jakarta-forced"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">Assign to AI Agent</label>
                        <select
                          name="aiAgentId"
                          defaultValue={selectedAgentId}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all plus-jakarta-forced"
                        >
                          <option value="global">Global Knowledge (Accessible to agents without specific files)</option>
                          {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                        <button
                          type="button"
                          onClick={() => setIsDialogOpen(false)}
                          className="px-4 py-2 text-[12px] font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 transition-all plus-jakarta-forced cursor-pointer active:scale-95"
                        >
                          {t("cancel")}
                        </button>
                        <button
                          disabled={isAdding}
                          className="px-5 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-[12px] flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 plus-jakarta-forced"
                        >
                          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          {t("addEntryBtn")}
                        </button>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* AI Workspace Tabs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-2.5 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 custom-scrollbar">
              {[
                { id: "agents", label: "AI Agents", icon: Bot, count: isLoadingAgents ? "..." : agentDisplayCount },
                { id: "routing", label: "AI Routing", icon: Route, count: routingRules.filter(r => r.isActive).length },
                { id: "files", label: "Files & Web", icon: FileText, count: totalCount },
                { id: "orders", label: "AI Orders", icon: ShoppingBag, count: ordersStats?.totalOrders ?? 0 },
                { id: "appointments", label: "Appointments", icon: CalendarCheck, count: appointmentsStats?.totalAppointments ?? 0 },
                 { id: "executions", label: "Executions", icon: History, count: executions.length },
                { id: "mcp", label: "MCP Servers", icon: Activity, count: mcpServers.length },
                { 
                  id: "response_format", 
                  label: "Response Format", 
                  icon: SlidersHorizontal, 
                  count: (responseFormat.text === 'voice' || responseFormat.voice === 'voice' || responseFormat.media === 'voice') ? 'Voice' : 'Text' 
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = workspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWorkspaceTab(tab.id as any)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] font-black whitespace-nowrap transition-all active:scale-[0.98] cursor-pointer shrink-0 border",
                      isActive
                        ? "bg-[#00B074] border-[#00B074] text-white shadow-md shadow-emerald-500/20"
                        : "bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-[#00B074]")} />
                    <span>{tab.label}</span>
                    <span className={cn(
                      "text-[10.5px] font-black rounded-full px-2 py-0.5 leading-none transition-colors",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {workspaceTab === "agents" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#00B074]" />
                    AI Agents
                  </h3>
                  <p className="text-[12px] font-semibold text-slate-450 dark:text-slate-400 mt-1">
                    Create specialist agents. The AI will automatically route messages to the best agent.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={openCreateAgentDialog}
                    className="px-4 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-[12px] font-extrabold flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Agent
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {isLoadingAgents ? (
                  <>
                    <div className="col-span-full py-1 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00B074]" />
                        <span>Loading AI Agents...</span>
                      </div>
                    </div>
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 rounded-2xl p-4.5 shadow-2xs space-y-3.5 animate-pulse"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="h-4.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
                              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                            </div>
                            <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="flex gap-1.5 pt-1">
                              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1.5">
                          <div className="h-3 w-full bg-slate-150 dark:bg-slate-800/80 rounded" />
                          <div className="h-3 w-4/5 bg-slate-150 dark:bg-slate-800/80 rounded" />
                        </div>

                        <div className="flex items-center gap-4 pt-1">
                          <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : agents.length === 0 ? (
                  <div className="col-span-full py-12 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] flex items-center justify-center mb-3">
                      <Bot className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">No AI Agents Created</h4>
                    <p className="text-xs text-slate-400 font-semibold max-w-sm mt-1 mb-4">
                      Create specialized AI agents to handle customer inquiries, route topics, or manage custom knowledge sets.
                    </p>
                    <button
                      type="button"
                      onClick={openCreateAgentDialog}
                      className="px-4 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create First Agent
                    </button>
                  </div>
                ) : null}

                {!isLoadingAgents && agents.map((agent) => {
                  const isSelectedAgent = selectedAgentId === agent.id;
                  return (
                    <div
                      key={agent.id}
                      className={cn(
                        "border rounded-2xl p-4 transition-all",
                        isSelectedAgent
                          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-sm shadow-emerald-500/10"
                          : "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{agent.name}</h4>
                            {isSelectedAgent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                Active Now
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                            {agent.aiProvider || "openai"} • {agent.model || "default"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {(!agent.platforms || agent.platforms.includes("ALL")) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[10px] font-extrabold border border-indigo-200/50 dark:border-indigo-800/50">
                                <Globe className="w-2.5 h-2.5" /> All Channels
                              </span>
                            ) : (
                              agent.platforms.map((p: string) => {
                                if (p === "WHATSAPP") return (
                                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-200/50 dark:border-emerald-800/50">
                                    <MessageSquare className="w-2.5 h-2.5" /> WhatsApp
                                  </span>
                                );
                                if (p === "FACEBOOK") return (
                                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold border border-blue-200/50 dark:border-blue-800/50">
                                    <MessageCircle className="w-2.5 h-2.5" /> Facebook
                                  </span>
                                );
                                if (p === "INSTAGRAM") return (
                                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400 text-[10px] font-extrabold border border-pink-200/50 dark:border-pink-800/50">
                                    <Instagram className="w-2.5 h-2.5" /> Instagram
                                  </span>
                                );
                                return null;
                              })
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditAgentDialog(agent)}
                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {renderAgentActionsMenu(
                            agent,
                            "w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          )}
                        </div>
                      </div>
                      <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-3 mt-3 min-h-[40px]">
                        {agent.instructions || "Uses the organization prompt and connected knowledge base."}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-3 mb-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          <Database className="w-3.5 h-3.5 text-emerald-500" />
                          {agent.agentFiles?.length || 0} Files Linked
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          <Bot className="w-3.5 h-3.5 text-blue-500" />
                          {agent.temperature} Temp
                        </div>
                        {agent.googleSpreadsheetId && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400" title={`Spreadsheet: ${agent.googleSpreadsheetId}`}>
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                            Sheet Linked
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200/70 dark:border-slate-800">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          AI Agent
                        </span>
                        {isSelectedAgent ? (
                          <span className="text-[10px] font-bold text-slate-400">
                            Updated {agent.updatedAt ? new Date(agent.updatedAt).toLocaleDateString() : ""}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleSetActiveAgent(agent.id, agent.name)}
                            className="rounded-lg bg-[#00B074] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-[#009c66] active:scale-95"
                          >
                            Set Active
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/50">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500">
                          {agent.agentFiles?.length || 0} files attached
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {workspaceTab === "routing" && (
            <div className="space-y-6">
              {/* Header & Stats */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] border border-emerald-100 dark:border-emerald-900/40">
                        <Route className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                          AI Intent & Keyword Routing
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {routingRules.filter(r => r.isActive).length} Active Rules
                          </span>
                        </h3>
                        <p className="text-[12.5px] font-semibold text-slate-450 dark:text-slate-400 mt-0.5">
                          Automatically route customer conversations to dedicated agents based on topic intent or keywords. If no rule matches, conversation stays with the AI Bot.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={reloadRoutingRules}
                      disabled={isLoadingRoutingRules}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isLoadingRoutingRules && "animate-spin")} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={openCreateRoutingDialog}
                      className="px-4 py-2.5 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Create Routing Rule
                    </button>
                  </div>
                </div>

                {/* Quick Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Total Rules</span>
                    <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{routingRules.length}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Routing</span>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {routingRules.filter(r => r.isActive).length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Assigned Agents</span>
                    <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                      {new Set(routingRules.map(r => r.agentId)).size}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">AI Fallback</span>
                    <p className="text-xs font-extrabold text-blue-700 dark:text-blue-300 mt-1">
                      Always Active (Retains with AI)
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Test Message Simulator */}
              <div className="bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-slate-900 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Live Intent Routing Simulator
                    </h4>
                    <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Test any sample customer query to see which agent and rule will be triggered, or if it will stay with the AI bot.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Real-time AI Tester
                  </span>
                </div>

                {/* Example query chips */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[11px] font-bold text-slate-450 dark:text-slate-400 mr-1">Try example:</span>
                  {[
                    "I want to know the pricing packages",
                    "Can I buy 10 licenses for my team?",
                    "I have a technical error in my account",
                    "What are your business opening hours?",
                    "Hello, how can you help me today?",
                  ].map((exampleText) => (
                    <button
                      key={exampleText}
                      type="button"
                      onClick={() => setTestSimulatorQuery(exampleText)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer"
                    >
                      {exampleText}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleRunSimulatorTest} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={testSimulatorQuery}
                      onChange={(e) => setTestSimulatorQuery(e.target.value)}
                      placeholder='Enter sample customer message (e.g. "I want to ask about your pricing and sales plans")'
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none focus:border-[#00B074] shadow-sm transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTestingRouting || !testSimulatorQuery.trim()}
                    className="px-5 py-3 rounded-xl bg-[#00B074] hover:bg-[#009c66] text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    {isTestingRouting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Evaluating Intent...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Test Route
                      </>
                    )}
                  </button>
                </form>

                {/* Simulation Result Preview */}
                {testSimulatorResult && (
                  <div className={cn(
                    "mt-4 rounded-xl border p-4 transition-all animate-in fade-in slide-in-from-top-2 duration-300",
                    testSimulatorResult.matched
                      ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                      : "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {testSimulatorResult.matched ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            MATCHED & ROUTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white">
                            <Bot className="w-3.5 h-3.5" />
                            REMAIN WITH AI BOT
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                          {testSimulatorResult.matched
                            ? `Rule: "${testSimulatorResult.rule?.name}"`
                            : "No routing rule triggered"}
                        </span>
                      </div>
                      {testSimulatorResult.matchType && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                          Match Type: {testSimulatorResult.matchType === "keyword" ? "Keyword Trigger" : "AI Semantic Intent"}
                        </span>
                      )}
                    </div>

                    {testSimulatorResult.matched ? (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Assigned Agent Card */}
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-400 block mb-1">
                              Assigned Agent
                            </span>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center">
                                {(testSimulatorResult.assignedAgent?.name || testSimulatorResult.assignedAgent?.email || "A").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                                  {testSimulatorResult.assignedAgent?.name || "Agent"}
                                </p>
                                <p className="text-[11px] font-semibold text-slate-400 truncate">
                                  {testSimulatorResult.assignedAgent?.email}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Trigger Topic */}
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-400 block mb-1">
                              Matched Intent / Topic
                            </span>
                            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 line-clamp-2">
                              {testSimulatorResult.rule?.topic}
                            </p>
                          </div>
                        </div>

                        {/* Automated Transfer Message */}
                        <div className="p-3 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-0.5">
                            Automated Customer Transfer Message:
                          </span>
                          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100 italic">
                            "{testSimulatorResult.rule?.transferMessage || 'We will connect you to our agent.'}"
                          </p>
                        </div>

                        {/* AI Explanation / Reasoning */}
                        {testSimulatorResult.reasoning && (
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <strong className="font-black text-slate-700 dark:text-slate-300">Explanation: </strong>
                            {testSimulatorResult.reasoning}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {testSimulatorResult.reasoning || "The customer's question does not match any routing rules. The conversation remains with the AI Bot to answer based on your knowledge base."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rules Management Section */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#00B074]" />
                      Configured Routing Rules ({routingRules.length})
                    </h3>
                    <p className="text-[11.5px] font-semibold text-slate-450 dark:text-slate-400 mt-0.5">
                      Rules are evaluated in priority order. If intent matches, the chat is assigned and notification message is sent.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={routingSearchFilter}
                      onChange={(e) => setRoutingSearchFilter(e.target.value)}
                      placeholder="Filter rules or keywords..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none focus:border-[#00B074]"
                    />
                  </div>
                </div>

                {/* Rules List */}
                {routingRules.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                    <Route className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No AI Routing Rules created yet.</p>
                    <p className="text-xs font-semibold text-slate-400 mt-1 max-w-md mx-auto">
                      Create rules to automatically assign sales questions to your sales agent, pricing questions to billing, or technical queries to support.
                    </p>
                    <button
                      type="button"
                      onClick={openCreateRoutingDialog}
                      className="mt-4 px-4 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Rule
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {routingRules
                      .filter(r => {
                        if (!routingSearchFilter.trim()) return true;
                        const q = routingSearchFilter.toLowerCase();
                        return (
                          r.name.toLowerCase().includes(q) ||
                          r.topic.toLowerCase().includes(q) ||
                          r.keywords?.some((k: string) => k.toLowerCase().includes(q)) ||
                          r.agent?.name?.toLowerCase().includes(q) ||
                          r.agent?.email?.toLowerCase().includes(q)
                        );
                      })
                      .map((rule) => {
                        return (
                          <div
                            key={rule.id}
                            className={cn(
                              "border rounded-2xl p-4 transition-all flex flex-col justify-between",
                              rule.isActive
                                ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm"
                                : "border-slate-100 dark:border-slate-850 bg-slate-50/60 dark:bg-slate-950/30 opacity-75"
                            )}
                          >
                            <div>
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">
                                      {rule.name}
                                    </h4>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Switch
                                    checked={rule.isActive}
                                    onCheckedChange={() => handleToggleRoutingRule(rule.id, rule.isActive)}
                                    className="data-[state=checked]:bg-[#00B074] scale-90"
                                  />
                                </div>
                              </div>

                              {/* Topic / Intent Description */}
                              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80">
                                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                  Topic / Intent
                                </span>
                                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 line-clamp-2">
                                  {rule.topic}
                                </p>
                              </div>

                              {/* Keywords chips */}
                              {rule.keywords && rule.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {rule.keywords.map((kw: string, i: number) => (
                                    <span
                                      key={i}
                                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                    >
                                      #{kw}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Assigned Agent */}
                              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Assigned Agent
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-black flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                                    {(rule.agent?.name || rule.agent?.email || "A").charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                                    {rule.agent?.name || rule.agent?.email || "Agent"}
                                  </span>
                                </div>
                              </div>

                              {/* Transfer Message preview */}
                              <div className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 italic line-clamp-2">
                                "{rule.transferMessage || 'We will connect you to our agent.'}"
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-between gap-2 pt-3 mt-4 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => {
                                  setTestSimulatorQuery(rule.keywords?.[0] || rule.topic.split(",")[0] || rule.name);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="text-[11px] font-black text-[#00B074] hover:text-[#009c66] flex items-center gap-1 cursor-pointer"
                              >
                                <Zap className="w-3 h-3" />
                                Test this rule
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditRoutingDialog(rule)}
                                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
                                  title="Edit Rule"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoutingRule(rule.id, rule.name)}
                                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                                  title="Delete Rule"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Create / Edit AI Routing Rule Dialog */}
              <Dialog open={isRoutingDialogOpen} onOpenChange={setIsRoutingDialogOpen}>
                <DialogContent className="max-w-xl rounded-[24px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced">
                  <div className="p-7">
                    <DialogHeader className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <DialogTitle className="text-[18px] font-black flex items-center gap-2 text-slate-800 dark:text-white plus-jakarta-forced">
                        <Route className="w-5 h-5 text-[#00B074]" />
                        {editingRoutingRule ? "Edit AI Routing Rule" : "Create AI Routing Rule"}
                      </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSaveRoutingRule} className="space-y-4 plus-jakarta-forced">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Rule Name *
                        </label>
                        <input
                          type="text"
                          value={routingName}
                          onChange={(e) => setRoutingName(e.target.value)}
                          placeholder="e.g. Sales & Pricing Inquiries"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none focus:border-[#00B074]"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Topic / Intent Description (for AI) *
                        </label>
                        <textarea
                          value={routingTopic}
                          onChange={(e) => setRoutingTopic(e.target.value)}
                          placeholder="Describe the topics and intents for the AI to match (e.g. Sales inquiries, pricing questions, purchasing licenses, requesting bulk quotes, discounts)"
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none focus:border-[#00B074] resize-none"
                          required
                        />
                        <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-400">
                          The AI understands the meaning of customer messages, even when they do not use exact keywords.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Keywords / Triggers (Optional)
                        </label>
                        <input
                          type="text"
                          value={routingKeywords}
                          onChange={(e) => setRoutingKeywords(e.target.value)}
                          placeholder="e.g. sales, price, pricing, cost, buy, purchase, quote (comma separated)"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none focus:border-[#00B074]"
                        />
                        <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-400">
                          Optional comma-separated keywords for immediate direct matching.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Assign To Agent *
                        </label>
                        <select
                          value={routingAgentId}
                          onChange={(e) => setRoutingAgentId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none focus:border-[#00B074]"
                          required
                        >
                          <option value="">Select an Agent...</option>
                          {orgAgentsList.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name || agent.email} ({agent.role}) {agent.department?.name ? `- ${agent.department.name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          Automated Customer Transfer Message
                        </label>
                        <textarea
                          value={routingTransferMsg}
                          onChange={(e) => setRoutingTransferMsg(e.target.value)}
                          placeholder='e.g. "We will connect you to our sales agent."'
                          rows={2}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold outline-none focus:border-[#00B074] resize-none"
                        />
                        <p className="text-[10px] font-semibold text-slate-450 dark:text-slate-400">
                          Sent automatically to the customer once this rule triggers.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <Switch
                            checked={routingIsActive}
                            onCheckedChange={setRoutingIsActive}
                            className="data-[state=checked]:bg-[#00B074]"
                          />
                          Rule Active
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsRoutingDialogOpen(false)}
                            className="px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingRoutingRule}
                            className="px-5 py-2.5 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isSavingRoutingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {editingRoutingRule ? "Update Rule" : "Create Rule"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* AI ORDERS TAB */}
          {workspaceTab === "orders" && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-emerald-500" />
                      WhatsApp AI Custom Orders & Commerce
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Orders captured live from WhatsApp customer conversations by the AI using your Knowledge Base & website data.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("files")}
                      className="px-3 py-2 text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-500" /> Knowledge Base Sources
                    </button>
                    <Link
                      href="/dashboard/orders"
                      className="px-3.5 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      Full Orders CRM <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Orders</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white mt-1">{ordersStats?.totalOrders || 0}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Revenue</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">PKR {Number(ordersStats?.totalRevenue || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Orders</p>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{ordersStats?.pendingCount || 0}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Confirmed / Delivered</p>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">{(ordersStats?.confirmedCount || 0) + (ordersStats?.deliveredCount || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Recent WhatsApp Orders ({ordersList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={reloadOrdersAndAppointments}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoadingOrders && "animate-spin")} /> Refresh
                  </button>
                </div>

                {isLoadingOrders ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    <p className="text-xs font-bold text-slate-400">Loading AI orders...</p>
                  </div>
                ) : ordersList.length === 0 ? (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                    <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">No Orders Captured Yet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      When customers request items in WhatsApp chat, your AI Agent automatically reads your Knowledge Base and website crawler data, collects customer details, and creates confirmed orders here!
                    </p>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("files")}
                      className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" /> Manage Knowledge Base & Website Data
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <th className="pb-3">Order ID</th>
                          <th className="pb-3">Customer</th>
                          <th className="pb-3">Items</th>
                          <th className="pb-3">Total Amount</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-200">
                        {ordersList.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {order.orderNumber}
                            </td>
                            <td className="py-3">
                              <p className="font-bold text-slate-800 dark:text-white">{order.customerName}</p>
                              <p className="text-[10px] text-slate-400">{order.customerPhone}</p>
                            </td>
                            <td className="py-3 max-w-[220px]">
                              {Array.isArray(order.items) && order.items.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {order.items.map((it: any, idx: number) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                      {it.quantity}x {it.productName || it.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">Custom Order</span>
                              )}
                            </td>
                            <td className="py-3 font-bold text-slate-900 dark:text-white">
                              {order.currency || "PKR"} {Number(order.totalAmount || 0).toLocaleString()}
                            </td>
                            <td className="py-3">
                              <select
                                value={order.status || "PENDING"}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                className={cn(
                                  "text-[10px] font-black px-2 py-1 rounded-lg border outline-none cursor-pointer transition-all appearance-none text-center",
                                  order.status === "DELIVERED" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" :
                                  order.status === "CONFIRMED" ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800" :
                                  order.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800" :
                                  order.status === "PROCESSING" ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800" :
                                  "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                )}
                                title="Click to change order status"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="CONFIRMED">CONFIRMED</option>
                                <option value="PROCESSING">PROCESSING</option>
                                <option value="DELIVERED">DELIVERED</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            </td>
                            <td className="py-3 text-[10px] text-slate-400">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI APPOINTMENTS TAB */}
          {workspaceTab === "appointments" && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-blue-500" />
                      WhatsApp AI Appointment Bookings
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Appointments booked live through WhatsApp chat by the AI using your Knowledge Base services & slot availability.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("files")}
                      className="px-3 py-2 text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" /> Knowledge Base & Services
                    </button>
                    <Link
                      href="/dashboard/appointments"
                      className="px-3.5 py-2 text-xs font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
                    >
                      Full Appointments CRM <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Appointments</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white mt-1">{appointmentsStats?.totalAppointments || 0}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Today's Bookings</p>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">{appointmentsStats?.todayCount || 0}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Confirmed</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{appointmentsStats?.confirmedCount || 0}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending</p>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{appointmentsStats?.pendingCount || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Booked Appointments ({appointmentsList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={reloadOrdersAndAppointments}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoadingAppointments && "animate-spin")} /> Refresh
                  </button>
                </div>

                {isLoadingAppointments ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-xs font-bold text-slate-400">Loading appointments...</p>
                  </div>
                ) : appointmentsList.length === 0 ? (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                    <CalendarCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">No Appointments Booked Yet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      When customers ask to book a call, consultation, or service in WhatsApp chat, the AI reads your Knowledge Base, checks open slots, and books them automatically!
                    </p>
                    <button
                      type="button"
                      onClick={() => setWorkspaceTab("files")}
                      className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> Manage Knowledge Base & Services
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <th className="pb-3">Appointment #</th>
                          <th className="pb-3">Customer</th>
                          <th className="pb-3">Service</th>
                          <th className="pb-3">Date & Time</th>
                          <th className="pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-200">
                        {appointmentsList.map((apt) => (
                          <tr key={apt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {apt.appointmentNumber}
                            </td>
                            <td className="py-3">
                              <p className="font-bold text-slate-800 dark:text-white">{apt.customerName}</p>
                              <p className="text-[10px] text-slate-400">{apt.customerPhone}</p>
                            </td>
                            <td className="py-3 font-bold text-slate-800 dark:text-slate-200">
                              {apt.serviceName || "General Appointment"}
                            </td>
                            <td className="py-3 font-mono text-slate-700 dark:text-slate-300">
                              {apt.date} at {apt.time}
                            </td>
                            <td className="py-3">
                              <Badge className={cn("text-[9px] font-black px-2 py-0.5 rounded-md border-0",
                                apt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400" :
                                apt.status === "CONFIRMED" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400" :
                                apt.status === "CANCELLED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400" :
                                "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                              )}>
                                {apt.status || "PENDING"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {workspaceTab === "functions" && (
            <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-[#00B074]" />
                      {functionForm.id ? "Edit AI Function" : "Create AI Function"}
                    </h3>
                    <p className="text-[11.5px] font-semibold text-slate-450 dark:text-slate-400 mt-1">
                      Collect fields, trigger a flow, then show a final message.
                    </p>
                  </div>
                  {functionForm.id && (
                    <button type="button" onClick={resetFunctionForm} className="text-[11px] font-black text-slate-400 hover:text-slate-700">
                      Clear
                    </button>
                  )}
                </div>
                <form onSubmit={handleSaveFunction} className="space-y-4">
                  <input
                    value={functionForm.name}
                    onChange={(e) => setFunctionForm({ ...functionForm, name: e.target.value })}
                    placeholder="e.g. Lead Capture"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074]"
                    required
                  />
                  <textarea
                    value={functionForm.description}
                    onChange={(e) => setFunctionForm({ ...functionForm, description: e.target.value })}
                    placeholder="When should AI use this function?"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074] resize-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={functionForm.aiAgentId}
                      onChange={(e) => setFunctionForm({ ...functionForm, aiAgentId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[12px] font-bold outline-none"
                    >
                      <option value="global">All Agents</option>
                      {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                    </select>
                    <input
                      value={functionForm.googleSpreadsheetId}
                      onChange={(e) => setFunctionForm({ ...functionForm, googleSpreadsheetId: e.target.value })}
                      placeholder="Google Spreadsheet ID"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074]"
                    />
                  </div>
                  <div className="mt-2">
                    <input
                      value={functionForm.googleSheetName}
                      onChange={(e) => setFunctionForm({ ...functionForm, googleSheetName: e.target.value })}
                      placeholder="Sheet Name (e.g. Sheet1)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074]"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">
                    Note: Ensure your sheet sharing settings are set to "Anyone with the link" and Role is "Editor".
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Data Fields</label>
                      <button
                        type="button"
                        onClick={() => setFunctionFields([...functionFields, { name: "", label: "", type: "text", required: true, description: "" }])}
                        className="text-[11px] font-black text-[#00B074]"
                      >
                        Add Field
                      </button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {functionFields.map((field, index) => (
                        <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-2">
                          <div className="grid grid-cols-[1fr_120px_32px] gap-2">
                            <input
                              value={field.label}
                              onChange={(e) => handleFunctionFieldChange(index, "label", e.target.value)}
                              placeholder="Label"
                              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[12px] font-bold outline-none"
                              required
                            />
                            <select
                              value={field.type}
                              onChange={(e) => handleFunctionFieldChange(index, "type", e.target.value)}
                              className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[12px] font-bold outline-none"
                            >
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setFunctionFields(functionFields.filter((_, fieldIndex) => fieldIndex !== index))}
                              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-red-500 flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            value={field.name}
                            onChange={(e) => handleFunctionFieldChange(index, "name", e.target.value)}
                            placeholder="field_name"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[12px] font-mono outline-none"
                          />
                          <input
                            value={field.description}
                            onChange={(e) => handleFunctionFieldChange(index, "description", e.target.value)}
                            placeholder="Short description for AI"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[12px] font-bold outline-none"
                          />
                          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => handleFunctionFieldChange(index, "required", e.target.checked)}
                              className="rounded border-slate-300 text-[#00B074]"
                            />
                            Required
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={functionForm.finalMessage}
                    onChange={(e) => setFunctionForm({ ...functionForm, finalMessage: e.target.value })}
                    placeholder="Final message after all data is collected"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074] resize-none"
                  />
                  <label className="flex items-center gap-2 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={functionForm.isActive}
                      onChange={(e) => setFunctionForm({ ...functionForm, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-[#00B074]"
                    />
                    Active
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingFunction}
                    className="w-full px-5 py-2.5 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-[12px] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSavingFunction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {functionForm.id ? "Save Function" : "Create Function"}
                  </button>
                </form>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4">Configured Functions ({aiFunctions.length})</h3>
                {aiFunctions.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                    <Settings2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No AI Functions yet.</p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Create one to collect email, phone, address, or custom lead data.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {aiFunctions.map((aiFunction) => (
                      <div key={aiFunction.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{aiFunction.name}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                              {aiFunction.aiAgent?.name || "All Agents"} {aiFunction.flow?.name ? `- ${aiFunction.flow.name}` : "- No Flow"}
                            </p>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", aiFunction.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>
                            {aiFunction.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 mt-3 min-h-[40px]">
                          {aiFunction.description || "AI can trigger this function when the customer intent matches."}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {(Array.isArray(aiFunction.fields) ? aiFunction.fields : []).map((field: any) => (
                            <span key={field.name} className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500">
                              {field.label || field.name}
                            </span>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                          <button type="button" onClick={() => handleEditFunction(aiFunction)} className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-700">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteFunction(aiFunction.id)} className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {workspaceTab === "executions" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm p-4 overflow-hidden">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-[#00B074]" />
                    AI Agent Executions Log
                  </h3>
                  <p className="text-[12px] font-semibold text-slate-450 dark:text-slate-400 mt-0.5">
                    Real-time execution history showing prompt resolution, RAG retrieval, LLM output, lead evaluation, and spreadsheet export steps.
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300">Auto Refresh</span>
                    <Switch
                      checked={isAutoRefreshExecutions}
                      onCheckedChange={setIsAutoRefreshExecutions}
                      className="data-[state=checked]:bg-[#00B074] scale-90"
                    />
                  </div>

                  <button
                    onClick={reloadExecutions}
                    disabled={isLoadingExecutions}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoadingExecutions && "animate-spin")} />
                    Refresh
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm("Are you sure you want to clear all execution logs?")) {
                        await clearAIAgentExecutions(organizationId);
                        setExecutions([]);
                        setSelectedExecution(null);
                        toast.success("Execution logs cleared!");
                      }
                    }}
                    className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Logs
                  </button>
                </div>
              </div>

              {/* Two Column n8n Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[600px]">
                {/* Left Column: Executions Feed List (4 cols) */}
                <div className="lg:col-span-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 p-3 space-y-3 flex flex-col h-[650px]">
                  {/* Search & Filter */}
                  <div className="space-y-2">
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search contact, message, agent..."
                        value={executionSearch}
                        onChange={(e) => setExecutionSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none focus:border-[#00B074]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {["all", "success", "failed"].map((st) => (
                        <button
                          key={st}
                          onClick={() => setExecutionStatusFilter(st)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                            executionStatusFilter === st
                              ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"
                          )}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Executions List Scroll Container */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {isLoadingExecutions && executions.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        <p className="text-xs font-semibold">Loading executions...</p>
                      </div>
                    ) : executions.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4">
                        <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Executions Found</p>
                        <p className="text-[10.5px] text-slate-400 mt-1">Executions will appear here as customers chat with your AI Agent.</p>
                      </div>
                    ) : (
                      executions.map((exec) => {
                        const isSelected = selectedExecution?.id === exec.id;
                        const isSuccess = exec.status === "success";
                        const formattedTime = new Date(exec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const formattedDate = new Date(exec.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

                        return (
                          <div
                            key={exec.id}
                            onClick={() => setSelectedExecution(exec)}
                            className={cn(
                              "p-3 rounded-xl border transition-all cursor-pointer space-y-2 relative",
                              isSelected
                                ? "bg-white dark:bg-slate-900 border-[#00B074] shadow-md shadow-emerald-500/10 ring-1 ring-[#00B074]"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {isSuccess ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                                    <CheckCircle2 className="w-3 h-3" /> Succeeded
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-black">
                                    <XCircle className="w-3 h-3" /> Failed
                                  </span>
                                )}
                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                  {(exec.durationMs / 1000).toFixed(2)}s
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">
                                {formattedDate}, {formattedTime}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-[12px] font-black text-slate-800 dark:text-white truncate">
                                  {exec.contactName || exec.contactPhone || "Customer Chat"}
                                </p>
                                <span className="text-[9.5px] font-mono uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-slate-500 shrink-0">
                                  {exec.provider || "openai"}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                                <span className="text-slate-400 font-bold mr-1">In:</span>"{exec.userPrompt}"
                              </p>
                              {exec.parsedMessage && (
                                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 line-clamp-1">
                                  <span className="text-emerald-500/70 font-bold mr-1">Out:</span>"{exec.parsedMessage}"
                                </p>
                              )}
                              {!isSuccess && exec.error && (
                                <p className="text-[10px] font-semibold text-rose-500 line-clamp-1">
                                  ⚠️ {exec.error}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400">
                              <span className="truncate max-w-[140px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Bot className="w-3 h-3 shrink-0" />
                                {exec.aiAgentName || "AI Agent"}
                              </span>
                              {exec.sheetSaved && (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
                                  <FileSpreadsheet className="w-3 h-3" /> Sheet Saved
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Detailed n8n Step Inspector (8 cols) */}
                <div className="lg:col-span-8 border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 p-5 h-[650px] overflow-y-auto custom-scrollbar">
                  {!selectedExecution ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                      <Terminal className="w-12 h-12 text-slate-300 dark:text-slate-800 mb-3" />
                      <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">No Execution Selected</h4>
                      <p className="text-xs font-semibold text-slate-400 mt-1 max-w-sm">
                        Select an execution run from the left list to view step-by-step RAG retrieval, prompt inputs, LLM JSON outputs, and Google Sheet exports.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Selected Execution Header */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white">
                              Execution ID: #{selectedExecution.id.substring(0, 12)}
                            </h4>
                            <Badge className={selectedExecution.status === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>
                              {selectedExecution.status === "success" ? "Succeeded" : "Failed"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>🕒 {new Date(selectedExecution.createdAt).toLocaleString()}</span>
                            <span>⚡ Duration: {(selectedExecution.durationMs / 1000).toFixed(3)}s</span>
                            <span>🤖 Agent: {selectedExecution.aiAgentName || "AI Agent"}</span>
                            <span>🧠 Model: {selectedExecution.provider || "openai"} / {selectedExecution.model || "gpt-4o-mini"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Error Banner if Failed */}
                      {selectedExecution.status === "failed" && selectedExecution.error && (
                        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-400">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-sm">Execution Error</p>
                            <p className="font-mono text-[11px]">{selectedExecution.error}</p>
                          </div>
                        </div>
                      )}

                      {/* n8n Step Timeline */}
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">

                        {/* Step 1: Inbound Trigger & User Input */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                            1
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <User className="w-4 h-4 text-emerald-500" />
                                📥 Step 1: Customer Input Message
                              </h5>
                              <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold">
                                Contact: {selectedExecution.contactName ? `${selectedExecution.contactName} (${selectedExecution.contactPhone || "No Phone"})` : selectedExecution.contactPhone || "Unknown"}
                              </span>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                              "{selectedExecution.userPrompt}"
                            </div>
                          </div>
                        </div>

                        {/* Step 2: Vector Search / RAG Retrieval */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-950 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                            2
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Database className="w-4 h-4 text-blue-500" />
                                🔍 Step 2: RAG Vector Knowledge Base Retrieval
                              </h5>
                              <span className="text-[10px] font-mono bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded font-bold">
                                {Array.isArray(selectedExecution.retrievedChunks) ? selectedExecution.retrievedChunks.length : 0} Chunks Retrieved
                              </span>
                            </div>
                            {Array.isArray(selectedExecution.retrievedChunks) && selectedExecution.retrievedChunks.length > 0 ? (
                              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {selectedExecution.retrievedChunks.map((chunk: string, idx: number) => (
                                  <div key={idx} className="p-2.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                                    <span className="text-blue-500 font-bold mr-1">Chunk #{idx + 1}:</span>
                                    {chunk}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-slate-400 italic">No specific vector chunks retrieved; used agent primary system prompt instructions.</p>
                            )}

                            {selectedExecution.systemPromptUsed && (
                              <details className="mt-2 text-[11px] border-t border-slate-200 dark:border-slate-800 pt-2">
                                <summary className="cursor-pointer font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                  View System Prompt & Instructions
                                </summary>
                                <div className="mt-2 p-2.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                                  {selectedExecution.systemPromptUsed}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>

                        {/* Step 3: LLM Call & Raw Output */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-purple-500 border-2 border-white dark:border-slate-950 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                            3
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Bot className="w-4 h-4 text-purple-500" />
                                🧠 Step 3: LLM Output & JSON Response ({selectedExecution.provider} / {selectedExecution.model})
                              </h5>
                            </div>
                            <div className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap custom-scrollbar border border-slate-800">
                              {selectedExecution.rawAiOutput || "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* Step 4: Clean WhatsApp Output */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                            4
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                            <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                              💬 Step 4: Clean Reply Sent on WhatsApp
                            </h5>
                            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                              {selectedExecution.parsedMessage || selectedExecution.rawAiOutput || "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* Step 5: Extracted Lead Data & Tags */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-950 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                            5
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                            <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                              🏷️ Step 5: Extracted Lead Attributes & CRM Sync
                            </h5>
                            {selectedExecution.extractedLeadData && typeof selectedExecution.extractedLeadData === "object" ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(selectedExecution.extractedLeadData).map(([k, v]) => {
                                  if (["message", "response", "reply", "text"].includes(k.toLowerCase())) return null;
                                  return (
                                    <div key={k} className="p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col">
                                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{k.replace(/_/g, " ")}</span>
                                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{String(v)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-slate-400 italic">No dynamic lead attributes extracted in this step.</p>
                            )}
                          </div>
                        </div>

                        {/* Step 6: Google Sheet Export */}
                        <div className="relative">
                          <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-600 border-2 border-white dark:border-slate-950 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                            6
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                📊 Step 6: Google Sheet Export Status
                              </h5>
                              <Badge className={selectedExecution.sheetSaved ? "bg-emerald-500 text-white" : "bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}>
                                {selectedExecution.sheetSaved ? "Row Appended to Sheet" : "Not Saved to Sheet"}
                              </Badge>
                            </div>
                            {selectedExecution.sheetSaved && selectedExecution.sheetRowData ? (
                              <div className="space-y-2 pt-1">
                                <div className="text-[11px] font-bold text-slate-500">
                                  Sheet ID: <span className="font-mono text-emerald-600">{selectedExecution.spreadsheetId}</span> ({selectedExecution.sheetName || "Sheet1"})
                                </div>
                                <div className="p-2.5 bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/40 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-200 overflow-x-auto">
                                  {JSON.stringify(selectedExecution.sheetRowData, null, 2)}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-slate-400 italic">No spreadsheet row appended (or spreadsheet not attached to this agent).</p>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {workspaceTab === "mcp" && (
            <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#00B074]" />
                      {mcpForm.id ? "Edit MCP Server" : "Add MCP Server"}
                    </h3>
                    <p className="text-[11.5px] font-semibold text-slate-450 dark:text-slate-400 mt-1">
                      Connect AI to external systems with URL and auth details.
                    </p>
                  </div>
                  {mcpForm.id && (
                    <button type="button" onClick={resetMcpForm} className="text-[11px] font-black text-slate-400 hover:text-slate-700">
                      Clear
                    </button>
                  )}
                </div>
                <form onSubmit={handleSaveMcpServer} className="space-y-4">
                  <input
                    value={mcpForm.name}
                    onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                    placeholder="e.g. CRM Lookup"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074]"
                    required
                  />
                  <input
                    value={mcpForm.url}
                    onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })}
                    placeholder="https://example.com/mcp"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-mono outline-none focus:border-[#00B074]"
                    required
                  />
                  <textarea
                    value={mcpForm.description}
                    onChange={(e) => setMcpForm({ ...mcpForm, description: e.target.value })}
                    placeholder="What data can AI fetch from this server?"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-bold outline-none focus:border-[#00B074] resize-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={mcpForm.aiAgentId}
                      onChange={(e) => setMcpForm({ ...mcpForm, aiAgentId: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[12px] font-bold outline-none"
                    >
                      <option value="global">All Agents</option>
                      {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                    </select>
                    <select
                      value={mcpForm.authType}
                      onChange={(e) => setMcpForm({ ...mcpForm, authType: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[12px] font-bold outline-none"
                    >
                      <option value="none">No Auth</option>
                      <option value="bearer">Access Token</option>
                      <option value="api_key">API Key</option>
                      <option value="custom_headers">Custom Headers</option>
                    </select>
                  </div>
                  {mcpForm.authType === "bearer" && (
                    <input
                      type="password"
                      value={mcpForm.accessToken}
                      onChange={(e) => setMcpForm({ ...mcpForm, accessToken: e.target.value })}
                      placeholder={mcpForm.id ? "Leave blank to keep saved access token" : "Access token"}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-mono outline-none"
                    />
                  )}
                  {mcpForm.authType === "api_key" && (
                    <input
                      type="password"
                      value={mcpForm.apiKey}
                      onChange={(e) => setMcpForm({ ...mcpForm, apiKey: e.target.value })}
                      placeholder={mcpForm.id ? "Leave blank to keep saved API key" : "API key"}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[13px] font-mono outline-none"
                    />
                  )}
                  {mcpForm.authType === "custom_headers" && (
                    <textarea
                      value={mcpCustomHeaders}
                      onChange={(e) => setMcpCustomHeaders(e.target.value)}
                      placeholder={'{"Authorization":"Bearer token","X-Client":"watibot"}'}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[12px] font-mono outline-none resize-none"
                    />
                  )}
                  <label className="flex items-center gap-2 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={mcpForm.isActive}
                      onChange={(e) => setMcpForm({ ...mcpForm, isActive: e.target.checked })}
                      className="rounded border-slate-300 text-[#00B074]"
                    />
                    Active
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingMcp}
                    className="w-full px-5 py-2.5 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-[12px] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSavingMcp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {mcpForm.id ? "Save Server" : "Add Server"}
                  </button>
                </form>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4">Connected Servers ({mcpServers.length})</h3>
                {mcpServers.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                    <Activity className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No MCP Servers connected.</p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Add an endpoint so AI can fetch live client data from external systems.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {mcpServers.map((server) => (
                      <div key={server.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{server.name}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                              {server.aiAgent?.name || "All Agents"} - {server.authType || "none"}
                            </p>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", server.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>
                            {server.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="text-[12px] font-mono text-slate-500 dark:text-slate-400 truncate mt-3">{server.url}</p>
                        <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 min-h-[40px]">
                          {server.description || "AI can call this endpoint when live external data is needed."}
                        </p>
                        <div className="flex justify-between gap-2 mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleTestMcpServer(server.id)}
                            disabled={isTestingMcp === server.id}
                            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-[#00B074] flex items-center gap-1.5"
                          >
                            {isTestingMcp === server.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Test
                          </button>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleEditMcpServer(server)} className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDeleteMcpServer(server.id)} className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {workspaceTab === "files" && (
            <>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Stat 1 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-slate-455 tracking-wider">{t("totalRecords")}</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{totalCount}</h3>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">{t("aiVectorBase")}</span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl flex items-center justify-center">
                <Database className="w-6 h-6 text-emerald-500" />
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-slate-455 tracking-wider">{t("fullyTrained")}</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{totalCount}</h3>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">{t("synced")}</span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#00B074]" />
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase text-slate-455 tracking-wider">{t("aiRepliesSwitch")}</p>
                <h3 className={cn("text-[16px] font-black mt-1", isAiEnabled ? "text-emerald-500" : "text-rose-500")}>
                  {isAiEnabled ? t("activeResponding") : t("paused")}
                </h3>
                <button
                  onClick={handleToggleAi}
                  disabled={isToggling}
                  className="text-[11px] font-bold text-slate-455 hover:underline flex items-center gap-1 transition-all"
                >
                  {t("toggleState")} {isToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                </button>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={isAiEnabled}
                  onCheckedChange={handleToggleAi}
                  disabled={isToggling}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>

            {/* Stat 4 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-black uppercase text-slate-455 tracking-wider">AI Voice Responses</p>
                  {isVoiceEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-[#818CF8] border border-indigo-100 dark:border-indigo-900/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {aiProvider === 'gemini' ? 'Gemini' : (aiProvider === 'openai' ? 'OpenAI' : (aiProvider === 'elevenlabs' ? 'ElevenLabs' : (apiKeys['gemini'] ? 'Gemini' : (apiKeys['openai'] ? 'OpenAI' : (apiKeys['elevenlabs'] ? 'ElevenLabs' : 'Active')))))}
                    </span>
                  )}
                </div>
                <h3 className={cn("text-[16px] font-black mt-1", isVoiceEnabled ? "text-emerald-500" : "text-rose-500")}>
                  {isVoiceEnabled 
                    ? `Voice Active (${aiProvider === 'gemini' ? 'Google Gemini' : (aiProvider === 'openai' ? 'OpenAI' : (aiProvider === 'elevenlabs' ? 'ElevenLabs' : 'Auto'))})` 
                    : "Text Responses Only"}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                  Format: Text➔<span className={responseFormat.text === 'voice' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-700 dark:text-slate-200'}>{responseFormat.text}</span> • 
                  Voice➔<span className={responseFormat.voice === 'voice' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-700 dark:text-slate-200'}>{responseFormat.voice}</span> • 
                  Media➔<span className={responseFormat.media === 'voice' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-700 dark:text-slate-200'}>{responseFormat.media}</span>
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => handleToggleVoice(!isVoiceEnabled)}
                    disabled={isTogglingVoice}
                    className="text-[11px] font-bold text-slate-455 hover:underline flex items-center gap-1 transition-all cursor-pointer"
                  >
                    Toggle Voice {isTogglingVoice && <Loader2 className="w-3 h-3 animate-spin" />}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    onClick={() => handleOpenVoiceModal()}
                    className="text-[11px] font-bold text-indigo-500 hover:underline flex items-center gap-1 transition-all cursor-pointer"
                  >
                    Configure Keys
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    onClick={() => setWorkspaceTab("response_format")}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 transition-all cursor-pointer"
                  >
                    Reply Format
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <Switch
                  checked={isVoiceEnabled}
                  onCheckedChange={handleToggleVoice}
                  disabled={isTogglingVoice}
                  className="data-[state=checked]:bg-[#4F46E5] dark:data-[state=checked]:bg-[#6366F1]"
                />
              </div>
            </div>
          </div>

          {/* Core Panel Content */}
          <div className="space-y-6">

            {/* Search Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[13px] font-medium border border-transparent focus:border-slate-200 dark:focus:border-slate-700 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Entries Grid */}
            <div className="min-h-[300px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  <p className="text-slate-400 text-sm font-semibold">{t("retrieving")}</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  <Database className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-3" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">{t("noItemsFound")}</h3>
                  <p className="text-slate-500 text-[12.5px] mt-1 max-w-xs font-semibold">
                    {t("noItemsDesc")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredEntries.map((entry) => {
                    const isGoogleSheet = entry.sourceUrl?.startsWith("googlesheets://");
                    const isWebsite = entry.sourceUrl?.startsWith("http://") || entry.sourceUrl?.startsWith("https://");
                    const category = isGoogleSheet ? "Google Sheet" : isWebsite ? "Website URL" : detectCategory(entry.title, entry.content);
                    const visual = getCategoryIcon(category);
                    const Icon = visual.icon;

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-[220px] group relative cursor-pointer",
                          isGoogleSheet
                            ? "border-emerald-300 dark:border-emerald-800/40 hover:border-emerald-500 dark:hover:border-emerald-600/80"
                            : isWebsite
                            ? "border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-500 dark:hover:border-indigo-600/80"
                            : "border-slate-100 dark:border-slate-800/80 hover:border-emerald-250 dark:hover:border-emerald-900/50"
                        )}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm", visual.bg)}>
                                <Icon className={cn("w-5 h-5", visual.color)} />
                              </div>
                              <div className="space-y-0.5">
                                <h3 className="text-[14.5px] font-black text-slate-800 dark:text-white group-hover:text-[#00B074] transition-colors line-clamp-1">
                                  {entry.title}
                                </h3>
                                {entry.agentFiles && entry.agentFiles.length > 0 && (
                                  <div className="flex flex-col gap-1 mt-1 border-t border-slate-100 dark:border-slate-800/50 pt-1.5">
                                    <div 
                                      className="flex items-center gap-1 text-[10px] font-extrabold text-[#4f46e5] dark:text-[#818cf8] uppercase tracking-wider cursor-pointer hover:underline w-fit"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setWorkspaceTab("agents");
                                      }}
                                    >
                                      <Bot className="w-3 h-3 shrink-0" />
                                      Used by {entry.agentFiles.length} AI Agent{entry.agentFiles.length > 1 ? 's' : ''}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {entry.agentFiles.map((af: any) => (
                                        <span key={af.aiAgent?.id} className="text-[9px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[120px]" title={af.aiAgent?.name}>
                                          {af.aiAgent?.name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Badge className={cn("border-0 text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md self-start", visual.badge)}>
                              {isGoogleSheet ? "Google Sheet" : isWebsite ? "Website URL" : t(`categories.${category === "FAQs" ? "faqs" : category === "Products & Services" ? "products" : category === "Policy Sheets" ? "policies" : "profile"}`)}
                            </Badge>
                          </div>

                          {/* Card Body */}
                          {isWebsite ? (
                            <div className="mt-2 p-2.5 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 rounded-xl flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <Globe className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <a
                                    href={entry.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[11.5px] font-extrabold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 truncate"
                                  >
                                    <span className="truncate">{entry.fileName || entry.sourceUrl}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                                  </a>
                                  <p className="text-[10px] font-bold text-slate-400 truncate">
                                    {entry.sourceUrl}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : entry.sourceUrl?.startsWith("googlesheets://") ? (
                            <div className="mt-2 p-3 bg-emerald-50/10 dark:bg-emerald-950/5 border border-emerald-100/30 dark:border-emerald-900/20 rounded-xl flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 truncate">
                                  {entry.sourceUrl.replace("googlesheets://", "").split("/")[1] || "Sheet1"}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 truncate">
                                  ID: {entry.fileName || "Google Sheet"}
                                </p>
                              </div>
                            </div>
                          ) : entry.fileName ? (
                            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 rounded-xl flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-emerald-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 truncate">
                                  {entry.fileName}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400">
                                  Uploaded Document File
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[12.5px] font-semibold text-slate-450 dark:text-slate-400 line-clamp-3 leading-relaxed">
                              {entry.content}
                            </p>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/40">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(entry.updatedAt).toLocaleDateString()}
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            {/* Re-scrape Button for Website entries */}
                            {isWebsite && (
                              <button
                                type="button"
                                disabled={syncingWebsiteId === entry.id}
                                onClick={(e) => handleSyncWebsite(entry.id, e)}
                                title="Re-scrape and refresh website data"
                                className="h-8 px-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold transition-all active:scale-90"
                              >
                                <RefreshCw className={cn("w-3 h-3", syncingWebsiteId === entry.id && "animate-spin text-indigo-500")} />
                                <span>{syncingWebsiteId === entry.id ? "Syncing" : "Re-scrape"}</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditEntry(entry);
                              }}
                              className="w-8 h-8 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all active:scale-90"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(entry.id);
                              }}
                              className="w-8 h-8 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center bg-slate-50 hover:bg-red-50 dark:bg-slate-900 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-90"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
            </>
          )}

          {/* Response Format Workspace Tab Content */}
          {workspaceTab === "response_format" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-200">
              {/* Header Section */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100 dark:border-slate-800/80 pb-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center justify-center text-[#00B074] shrink-0 shadow-sm">
                    <SlidersHorizontal className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-xl font-black text-slate-800 dark:text-white">
                        AI Response Format Configuration
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Active Routing
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure whether the AI replies with a written text message or spoken voice note based on the incoming message type.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenVoiceModal()}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Mic className="w-4 h-4 text-indigo-500" />
                    Voice Engine Settings ({aiProvider === 'gemini' ? 'Google Gemini' : aiProvider === 'openai' ? 'OpenAI' : aiProvider === 'elevenlabs' ? 'ElevenLabs' : 'Auto'})
                  </button>
                </div>
              </div>

              {/* Status Overview Ribbon */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/20 to-emerald-50/30 dark:from-slate-850 dark:via-indigo-950/10 dark:to-emerald-950/20 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Current Reply Rule Summary
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                        Text ➔ <strong className={responseFormat.text === 'voice' ? 'text-indigo-600 dark:text-indigo-400 uppercase font-black' : 'text-slate-900 dark:text-white uppercase font-black'}>{responseFormat.text}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <Mic className="w-3.5 h-3.5 text-indigo-500" />
                        Voice ➔ <strong className={responseFormat.voice === 'voice' ? 'text-indigo-600 dark:text-indigo-400 uppercase font-black' : 'text-slate-900 dark:text-white uppercase font-black'}>{responseFormat.voice}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                        Media ➔ <strong className={responseFormat.media === 'voice' ? 'text-indigo-600 dark:text-indigo-400 uppercase font-black' : 'text-slate-900 dark:text-white uppercase font-black'}>{responseFormat.media}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {isSavingResponseFormat && (
                  <div className="flex items-center gap-2 text-xs font-bold text-[#00B074] shrink-0 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving routing changes...</span>
                  </div>
                )}
              </div>

              {/* The 3 Message Type Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Incoming Text Messages Card */}
                <div className={cn(
                  "rounded-2xl border p-6 flex flex-col justify-between transition-all relative",
                  responseFormat.text === 'voice'
                    ? "border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/15 ring-1 ring-indigo-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                )}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-[#00B074]">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
                        responseFormat.text === 'voice'
                          ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      )}>
                        Replies: {responseFormat.text.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-800 dark:text-white">
                        Incoming Text Messages
                      </h4>
                      <p className="text-xs font-semibold text-slate-450 dark:text-slate-400 mt-1">
                        When a customer types and sends a standard written text message.
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-slate-500 bg-slate-100/70 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-200/50 dark:border-slate-700/50">
                        💬 &quot;Hello, do you deliver to my area?&quot;
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      AI Reply Format
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => handleUpdateResponseFormat('text', 'text')}
                        disabled={isSavingResponseFormat}
                        className={cn(
                          "py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          responseFormat.text === 'text'
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                        Text Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateResponseFormat('text', 'voice')}
                        disabled={isSavingResponseFormat}
                        className={cn(
                          "py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          responseFormat.text === 'voice'
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <Mic className="w-3.5 h-3.5 text-indigo-300" />
                        Voice Reply
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 leading-tight">
                      {responseFormat.text === 'text'
                        ? "AI replies back with a clean, formatted text message."
                        : "AI converts the answer into speech and sends a voice message."}
                    </p>
                  </div>
                </div>

                {/* 2. Incoming Voice Messages Card */}
                <div className={cn(
                  "rounded-2xl border p-6 flex flex-col justify-between transition-all relative",
                  responseFormat.voice === 'voice'
                    ? "border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/15 ring-1 ring-indigo-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                )}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/40 flex items-center justify-center text-[#4F46E5] dark:text-[#818CF8]">
                        <Mic className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
                        responseFormat.voice === 'voice'
                          ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      )}>
                        Replies: {responseFormat.voice.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                        Incoming Voice Notes
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold uppercase">Popular</span>
                      </h4>
                      <p className="text-xs font-semibold text-slate-450 dark:text-slate-400 mt-1">
                        When a customer records and sends a WhatsApp voice message / audio note.
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-slate-500 bg-slate-100/70 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-200/50 dark:border-slate-700/50">
                        🎙️ WhatsApp Voice Note (.ogg audio)
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      AI Reply Format
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => handleUpdateResponseFormat('voice', 'text')}
                        disabled={isSavingResponseFormat}
                        className={cn(
                          "py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          responseFormat.voice === 'text'
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                        Text Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateResponseFormat('voice', 'voice')}
                        disabled={isSavingResponseFormat}
                        className={cn(
                          "py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          responseFormat.voice === 'voice'
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <Mic className="w-3.5 h-3.5 text-indigo-300" />
                        Voice Reply
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 leading-tight">
                      {responseFormat.voice === 'voice'
                        ? "Transcribes customer audio and responds back with a natural spoken voice message."
                        : "Transcribes customer audio and replies in written text."}
                    </p>
                  </div>
                </div>

                {/* 3. Incoming Media Messages Card */}
                <div className={cn(
                  "rounded-2xl border p-6 flex flex-col justify-between transition-all relative",
                  responseFormat.media === 'voice'
                    ? "border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/15 ring-1 ring-indigo-500/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                )}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
                        responseFormat.media === 'voice'
                          ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      )}>
                        Replies: {responseFormat.media.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-800 dark:text-white">
                        Incoming Media Messages
                      </h4>
                      <p className="text-xs font-semibold text-slate-450 dark:text-slate-400 mt-1">
                        When a customer uploads an image, photo, video, PDF or document file.
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-slate-500 bg-slate-100/70 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-200/50 dark:border-slate-700/50">
                        📁 Image, Video, Document, or Sticker
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                    <label className="block text-[11px] font-black uppercase text-slate-400 tracking-wider">
                      AI Reply Format
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => handleUpdateResponseFormat('media', 'text')}
                        disabled={isSavingResponseFormat}
                        className={cn(
                          "py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          responseFormat.media === 'text'
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                        Text Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateResponseFormat('media', 'voice')}
                        disabled={isSavingResponseFormat}
                        className={cn(
                          "py-2.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                          responseFormat.media === 'voice'
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                      >
                        <Mic className="w-3.5 h-3.5 text-indigo-300" />
                        Voice Reply
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 leading-tight">
                      {responseFormat.media === 'text'
                        ? "Analyzes the media attachment and sends back a text response."
                        : "Analyzes the media attachment and sends back a voice audio note."}
                    </p>
                  </div>
                </div>

              </div>

              {/* Behavior Simulation & Fallback Banner */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                {/* Live Matrix Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#00B074]" />
                    Live Interaction Simulation
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                        Customer sends Text
                      </div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        {responseFormat.text === 'voice' ? '🎙️ Spoken Voice Note' : '💬 Formatted Text Message'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                        <Mic className="w-4 h-4 text-indigo-500" />
                        Customer sends Voice Note
                      </div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        {responseFormat.voice === 'voice' ? '🎙️ Spoken Voice Note' : '💬 Formatted Text Message'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                        <ImageIcon className="w-4 h-4 text-amber-500" />
                        Customer sends Photo / File
                      </div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        {responseFormat.media === 'voice' ? '🎙️ Spoken Voice Note' : '💬 Formatted Text Message'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Graceful Fallback Notice Card */}
                <div className="p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Automatic Graceful Text Fallback
                    </h4>
                    <p className="text-xs font-semibold text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                      Whenever voice reply is configured, WatiBot synthesizes speech via your active TTS engine (Google Gemini, OpenAI, or ElevenLabs).
                    </p>
                    <p className="text-xs font-semibold text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                      If voice generation ever encounters an issue (such as character quota exhaustion, invalid API key, or third-party outage), WatiBot <strong>automatically falls back to sending the normal written text reply</strong>, ensuring no customer message is ever dropped.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Fail-safe delivery protection active on all channels
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Provider Config Modal */}
          {selectedProviderModal && (
            <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Configure {selectedProviderModal.toUpperCase()}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Enter your API key below. Saving this will also set it as the active provider.
                </p>
                <form onSubmit={handleSaveApiKey} className="space-y-4">
                  <div className="relative w-full">
                    <input
                      type={showKey ? "text" : "password"}
                      placeholder={`Enter ${selectedProviderModal} API Key`}
                      value={modalKeyInput}
                      onChange={(e) => setModalKeyInput(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[13px] font-mono border border-slate-200 dark:border-slate-700 focus:border-[#00B074] outline-none text-slate-800 dark:text-slate-100 transition-all"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProviderModal(null)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingKey}
                      className="flex items-center gap-2 px-4 py-2 bg-[#00B074] hover:bg-[#009c66] rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                    >
                      {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Set Active"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* AI Voice & Transcription Setup Modal */}
          {isVoiceModalOpen && (
            <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 w-full max-w-xl sm:max-w-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-[#4F46E5] dark:text-[#818CF8]">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        AI Voice & Transcription Setup
                      </h3>
                      <p className="text-xs font-semibold text-slate-500">
                        Transcribe WhatsApp voice notes & enable AI voice responses
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Active Voice Source Status Banner */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-800/80 dark:to-indigo-950/20 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full shrink-0 shadow-sm",
                      isVoiceEnabled ? "bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" : "bg-slate-400"
                    )} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Active Voice Source:
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          {aiProvider === "gemini" ? "Google Gemini" : aiProvider === "openai" ? "OpenAI" : aiProvider === "elevenlabs" ? "ElevenLabs" : (apiKeys["gemini"] ? "Google Gemini" : apiKeys["openai"] ? "OpenAI" : apiKeys["elevenlabs"] ? "ElevenLabs" : "None Selected")}
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase bg-indigo-100/80 dark:bg-indigo-900/50 text-[#4F46E5] dark:text-[#818CF8] font-bold">
                            {aiProvider || "gemini"}
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                        {isVoiceEnabled 
                          ? "Voice messages are transcribed & spoken audio replies generated with this source." 
                          : "Voice responses are currently disabled. Select an engine and enable below."}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "self-start sm:self-center shrink-0 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border",
                    isVoiceEnabled 
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                  )}>
                    {isVoiceEnabled ? "● Voice Active" : "Voice Paused"}
                  </span>
                </div>

                {/* Provider Selector Tabs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase text-slate-455 tracking-wider">
                      Select AI Voice / Audio Engine
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Click a provider to configure or switch
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Gemini Option */}
                    <button
                      type="button"
                      onClick={() => handleSelectVoiceProvider("gemini")}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer min-h-[108px]",
                        voiceProviderChoice === "gemini"
                          ? "border-[#4F46E5] bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        aiProvider === "gemini" && isVoiceEnabled && "border-emerald-500/70 ring-1 ring-emerald-500/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-4 h-4 text-[#4F46E5] shrink-0" />
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            Google Gemini
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {aiProvider === "gemini" && isVoiceEnabled ? (
                            <span className="inline-flex items-center gap-1 text-[8px] sm:text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm whitespace-nowrap">
                              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              Fast
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">
                        Fast transcription & native voice replies
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                        {apiKeys["gemini"] ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Key Saved
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">Key not set</span>
                        )}
                        {aiProvider === "gemini" && isVoiceEnabled ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase">Current Source</span>
                        ) : null}
                      </div>
                    </button>

                    {/* OpenAI Option */}
                    <button
                      type="button"
                      onClick={() => handleSelectVoiceProvider("openai")}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer min-h-[108px]",
                        voiceProviderChoice === "openai"
                          ? "border-[#4F46E5] bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        aiProvider === "openai" && isVoiceEnabled && "border-emerald-500/70 ring-1 ring-emerald-500/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Bot className="w-4 h-4 text-[#00B074] shrink-0" />
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            OpenAI
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {aiProvider === "openai" && isVoiceEnabled ? (
                            <span className="inline-flex items-center gap-1 text-[8px] sm:text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm whitespace-nowrap">
                              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 whitespace-nowrap">
                              TTS-1
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">
                        Whisper transcription & OpenAI TTS speech
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                        {apiKeys["openai"] ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Key Saved
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">Key not set</span>
                        )}
                        {aiProvider === "openai" && isVoiceEnabled ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase">Current Source</span>
                        ) : null}
                      </div>
                    </button>

                    {/* ElevenLabs Option */}
                    <button
                      type="button"
                      onClick={() => handleSelectVoiceProvider("elevenlabs")}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-2 cursor-pointer min-h-[108px]",
                        voiceProviderChoice === "elevenlabs"
                          ? "border-[#4F46E5] bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        aiProvider === "elevenlabs" && isVoiceEnabled && "border-emerald-500/70 ring-1 ring-emerald-500/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            ElevenLabs
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {aiProvider === "elevenlabs" && isVoiceEnabled ? (
                            <span className="inline-flex items-center gap-1 text-[8px] sm:text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm whitespace-nowrap">
                              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 whitespace-nowrap">
                              Studio
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">
                        Ultra-realistic multilingual voice synthesis
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                        {apiKeys["elevenlabs"] ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Key Saved
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">Key not set</span>
                        )}
                        {aiProvider === "elevenlabs" && isVoiceEnabled ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase">Current Source</span>
                        ) : null}
                      </div>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveVoiceConfig} className="space-y-4">
                  {/* Model Selector (for Gemini) */}
                  {voiceProviderChoice === "gemini" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-455 tracking-wider">
                        Gemini Model
                      </label>
                      <select
                        value={voiceGeminiModelChoice}
                        onChange={(e) => setVoiceGeminiModelChoice(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[13px] font-semibold border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fastest & High Quality)</option>
                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      </select>
                    </div>
                  )}

                  {/* API Key Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-slate-455 tracking-wider">
                        {voiceProviderChoice === "gemini"
                          ? "Google Gemini API Key"
                          : voiceProviderChoice === "openai"
                          ? "OpenAI API Key"
                          : "ElevenLabs API Key"}
                      </label>
                      <a
                        href={
                          voiceProviderChoice === "gemini"
                            ? "https://aistudio.google.com/app/apikey"
                            : voiceProviderChoice === "openai"
                            ? "https://platform.openai.com/api-keys"
                            : "https://elevenlabs.io/app/settings/api-keys"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-[#4F46E5] hover:underline"
                      >
                        Get API Key &rarr;
                      </a>
                    </div>
                    <div className="relative w-full">
                      <input
                        type={showVoiceKey ? "text" : "password"}
                        placeholder={
                          voiceProviderChoice === "gemini"
                            ? "Enter Gemini API Key (e.g. AIzaSy...)"
                            : voiceProviderChoice === "openai"
                            ? "Enter OpenAI API Key (e.g. sk-...)"
                            : "Enter ElevenLabs API Key (e.g. xi-api-key...)"
                        }
                        value={voiceApiKeyInput}
                        onChange={(e) => setVoiceApiKeyInput(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[13px] font-mono border border-slate-200 dark:border-slate-700 focus:border-[#4F46E5] outline-none text-slate-800 dark:text-slate-100 transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowVoiceKey(!showVoiceKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
                      >
                        {showVoiceKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                      {apiKeys[voiceProviderChoice] ? (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Existing {voiceProviderChoice === "gemini" ? "Gemini" : voiceProviderChoice === "openai" ? "OpenAI" : "ElevenLabs"} API Key saved in settings.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-medium">
                          Enter your API key and save to enable this engine.
                        </p>
                      )}
                      {aiProvider === voiceProviderChoice && isVoiceEnabled ? (
                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          ● Currently Active Engine
                        </span>
                      ) : apiKeys[voiceProviderChoice] ? (
                        <button
                          type="button"
                          onClick={() => handleSetActiveVoiceProvider(voiceProviderChoice)}
                          disabled={isSavingVoiceConfig}
                          className="text-[11px] font-bold text-[#4F46E5] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          Switch to {voiceProviderChoice === 'gemini' ? 'Gemini' : voiceProviderChoice === 'openai' ? 'OpenAI' : 'ElevenLabs'} as Active Source &rarr;
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* ElevenLabs Dynamic Voice Selector */}
                  {voiceProviderChoice === "elevenlabs" && (
                    <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <label className="text-[11px] font-black uppercase text-purple-950 dark:text-purple-200 tracking-wider">
                            Select Voice Model
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchVoices()}
                          disabled={isLoadingVoices || !voiceApiKeyInput.trim()}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4F46E5] hover:text-[#4338CA] dark:text-[#818CF8] cursor-pointer disabled:opacity-40 transition-all"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", isLoadingVoices && "animate-spin")} />
                          <span>{isLoadingVoices ? "Fetching Voices..." : "Fetch Available Voices"}</span>
                        </button>
                      </div>

                      {elevenLabsVoices.length > 0 ? (
                        <div className="space-y-2.5">
                          <select
                            value={elevenLabsVoiceChoice}
                            onChange={(e) => setElevenLabsVoiceChoice(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 rounded-xl text-[13px] font-semibold border border-purple-200 dark:border-purple-800/60 outline-none text-slate-800 dark:text-slate-100 cursor-pointer focus:ring-2 focus:ring-purple-500/20"
                          >
                            {elevenLabsVoices.map((voice) => (
                              <option key={voice.id} value={voice.id}>
                                {voice.name} ({voice.category}){voice.description ? ` • ${voice.description}` : ''}
                              </option>
                            ))}
                          </select>

                          {/* Selected Voice Card + Audio Preview */}
                          {(() => {
                            const currentVoice = elevenLabsVoices.find(v => v.id === elevenLabsVoiceChoice);
                            if (!currentVoice) return null;
                            return (
                              <div className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-purple-100 dark:border-purple-900/40 flex items-center justify-between gap-3 shadow-xs">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                      {currentVoice.name}
                                    </span>
                                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shrink-0">
                                      {currentVoice.category}
                                    </span>
                                  </div>
                                  <p className="text-[10.5px] font-mono text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                    ID: {currentVoice.id}
                                  </p>
                                </div>
                                {currentVoice.previewUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handlePlayPreview(currentVoice)}
                                    className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                                  >
                                    {playingVoiceId === currentVoice.id ? (
                                      <>
                                        <Square className="w-3 h-3 fill-current" />
                                        <span>Stop</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>Sample</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* Test Voice Generation Button */}
                          <div className="pt-2 border-t border-purple-200/70 dark:border-purple-800/50 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-500">
                              Generate live audio sample with your API key:
                            </span>
                            <button
                              type="button"
                              onClick={handleTestVoiceGeneration}
                              disabled={isTestingVoice || !voiceApiKeyInput.trim() || !elevenLabsVoiceChoice}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40"
                            >
                              {isTestingVoice ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Testing Generation...</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>Test Voice Generation</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-dashed border-purple-200 dark:border-purple-900/60 bg-white/60 dark:bg-slate-900/40 text-center space-y-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {voiceApiKeyInput.trim()
                              ? "Click 'Fetch Available Voices' to load all voices linked to this API Key."
                              : "Enter your ElevenLabs API Key above to load and select voices from your account."}
                          </p>
                          {voiceApiKeyInput.trim() && (
                            <button
                              type="button"
                              onClick={() => fetchVoices()}
                              disabled={isLoadingVoices}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                            >
                              <RefreshCw className={cn("w-3 h-3", isLoadingVoices && "animate-spin")} />
                              <span>{isLoadingVoices ? "Fetching Voices..." : "Load Voices from ElevenLabs"}</span>
                            </button>
                          )}
                          {voiceLoadError && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-left">
                              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{voiceLoadError}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prominent Voice Test Error Display */}
                      {voiceTestError && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-500/50 text-rose-800 dark:text-rose-200 space-y-2 shadow-sm animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-rose-900 dark:text-rose-100">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>ElevenLabs Voice Generation Error</span>
                          </div>
                          <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap pl-6 text-rose-700 dark:text-rose-300">
                            {voiceTestError}
                          </p>
                          <div className="pl-6 pt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                            💡 ElevenLabs free accounts cannot use certain library voices via the API. Please select a pre-made voice from your account or upgrade your ElevenLabs subscription.
                          </div>
                        </div>
                      )}

                      {/* Prominent Voice Test Success Display */}
                      {voiceTestSuccess && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-xs font-bold shadow-sm animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Speech generated and played successfully! Your ElevenLabs API key and voice are working properly.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Response Format Configuration Section inside Voice Modal */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
                          Response Format by Message Type
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        Configured per incoming message
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Text Message Setting */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> Text Msg
                          </span>
                          <span className="text-[9.5px] font-black uppercase text-slate-400">
                            {responseFormat.text}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseFormat('text', 'text')}
                            disabled={isSavingResponseFormat}
                            className={cn(
                              "py-1 rounded-md text-center transition-all cursor-pointer",
                              responseFormat.text === 'text' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Text
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseFormat('text', 'voice')}
                            disabled={isSavingResponseFormat}
                            className={cn(
                              "py-1 rounded-md text-center transition-all cursor-pointer",
                              responseFormat.text === 'voice' ? "bg-indigo-600 text-white shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Voice
                          </button>
                        </div>
                      </div>

                      {/* Voice Note Setting */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-indigo-500" /> Voice Note
                          </span>
                          <span className="text-[9.5px] font-black uppercase text-slate-400">
                            {responseFormat.voice}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseFormat('voice', 'text')}
                            disabled={isSavingResponseFormat}
                            className={cn(
                              "py-1 rounded-md text-center transition-all cursor-pointer",
                              responseFormat.voice === 'text' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Text
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseFormat('voice', 'voice')}
                            disabled={isSavingResponseFormat}
                            className={cn(
                              "py-1 rounded-md text-center transition-all cursor-pointer",
                              responseFormat.voice === 'voice' ? "bg-indigo-600 text-white shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Voice
                          </button>
                        </div>
                      </div>

                      {/* Media Setting */}
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-amber-500" /> Media / File
                          </span>
                          <span className="text-[9.5px] font-black uppercase text-slate-400">
                            {responseFormat.media}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseFormat('media', 'text')}
                            disabled={isSavingResponseFormat}
                            className={cn(
                              "py-1 rounded-md text-center transition-all cursor-pointer",
                              responseFormat.media === 'text' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Text
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseFormat('media', 'voice')}
                            disabled={isSavingResponseFormat}
                            className={cn(
                              "py-1 rounded-md text-center transition-all cursor-pointer",
                              responseFormat.media === 'voice' ? "bg-indigo-600 text-white shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Voice
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                    <div>
                      {apiKeys[voiceProviderChoice] && aiProvider !== voiceProviderChoice && (
                        <button
                          type="button"
                          onClick={() => handleSetActiveVoiceProvider(voiceProviderChoice)}
                          disabled={isSavingVoiceConfig}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Set {voiceProviderChoice === 'gemini' ? 'Gemini' : voiceProviderChoice === 'openai' ? 'OpenAI' : 'ElevenLabs'} as Active Source
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setIsVoiceModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingVoiceConfig || !voiceApiKeyInput.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
                      >
                        {isSavingVoiceConfig ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving & Enabling...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" />
                            <span>Save & Set as Active Voice Engine</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MANAGE AI AGENTS DIALOG */}
          <Dialog open={isAgentsDialogOpen} onOpenChange={handleAgentsDialogOpenChange}>
            <DialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] rounded-[28px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced flex flex-col gap-0">
              {/* Modal Header */}
              <div className="px-7 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-[#00B074] shadow-sm">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-[17px] font-black flex items-center gap-2 text-slate-800 dark:text-white">
                        {editingAgent ? `Edit AI Agent: ${editingAgent.name}` : "Create AI Agent & Architecture Studio"}
                      </DialogTitle>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Configure agent purpose, channels, AI model, data collection variables, destinations & keyword triggers.
                      </p>
                    </div>
                  </div>

                  {/* Sub-Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAgentModalTab("editor")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                        agentModalTab === "editor"
                          ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#00B074]" />
                      {editingAgent ? "Agent Editor" : "New Agent"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentModalTab("agents")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                        agentModalTab === "agents"
                          ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      All Agents ({agentDisplayCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-7 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                {/* Real-time Import Progress Sticky Banner */}
                {importProgress.isOpen && importProgress.status === "running" && (
                  <div className="mb-5 p-3 px-4 bg-gradient-to-r from-emerald-600 to-[#00B074] text-white rounded-2xl flex items-center justify-between text-xs font-bold shadow-md shadow-emerald-500/20 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                      <div className="min-w-0">
                        <span className="truncate block">
                          Extracting & Adding: Page {importProgress.current} of {importProgress.total} ({importProgress.percent}%) — {importProgress.currentTitle || importProgress.currentUrl}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {importProgress.estimatedSecondsRemaining !== null && (
                        <span className="text-[11px] font-mono bg-black/20 px-2 py-0.5 rounded-lg text-emerald-100">
                          ⏱️ ~{importProgress.estimatedSecondsRemaining}s left
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleAbortImport}
                        className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-extrabold transition-colors cursor-pointer"
                      >
                        Stop Import
                      </button>
                    </div>
                  </div>
                )}

                {agentModalTab === "editor" ? (
                  <form onSubmit={editingAgent ? handleUpdateAgent : handleCreateAgent} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                      {/* ============================================================ */}
                      {/* LEFT COLUMN: Agent Identity, Type, Channels, Model & Excel (5 cols) */}
                      {/* ============================================================ */}
                      <div className="lg:col-span-5 space-y-4 pr-0 lg:pr-6 lg:border-r border-slate-100 dark:border-slate-800">
                        {/* 1. Agent Name */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                            1. Agent Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sales & Ordering Assistant"
                            value={editingAgent ? editingAgent.name : newAgentName}
                            onChange={(e) => editingAgent 
                              ? setEditingAgent({ ...editingAgent, name: e.target.value })
                              : setNewAgentName(e.target.value)
                            }
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all"
                          />
                        </div>

                        {/* 2. Agent Type */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                              2. Agent Type <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              Determines Primary Role
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              {
                                id: "lead_collector" as const,
                                title: "Lead Collector Agent",
                                desc: "Capture customer contact details, questions & qualified leads",
                                icon: UserCheck,
                                color: "text-emerald-600 dark:text-emerald-400",
                                bg: "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25",
                              },
                              {
                                id: "ordering_collector" as const,
                                title: "Ordering Collector Agent",
                                desc: "Take customer product orders, quantities & delivery info",
                                icon: ShoppingBag,
                                color: "text-amber-600 dark:text-amber-400",
                                bg: "border-amber-500 bg-amber-50/50 dark:bg-amber-950/25",
                              },
                              {
                                id: "appointment_collector" as const,
                                title: "Appointment Collector Agent",
                                desc: "Schedule appointments, dates, time slots & consultations",
                                icon: Calendar,
                                color: "text-blue-600 dark:text-blue-400",
                                bg: "border-blue-500 bg-blue-50/50 dark:bg-blue-950/25",
                              },
                            ].map((typeOption) => {
                              const currentType = editingAgent ? (editingAgent.agentType || "lead_collector") : newAgentType;
                              const isSelected = currentType === typeOption.id;
                              return (
                                <div
                                  key={typeOption.id}
                                  onClick={() => {
                                    if (editingAgent) {
                                      setEditingAgent({ ...editingAgent, agentType: typeOption.id });
                                    } else {
                                      setNewAgentType(typeOption.id);
                                    }
                                  }}
                                  className={cn(
                                    "p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3",
                                    isSelected
                                      ? cn("shadow-sm font-bold", typeOption.bg)
                                      : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                                  )}
                                >
                                  <div className={cn("p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs mt-0.5", typeOption.color)}>
                                    <typeOption.icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className={cn("text-xs font-black", isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                                        {typeOption.title}
                                      </span>
                                      {isSelected && (
                                        <span className="w-4 h-4 rounded-full bg-[#00B074] text-white flex items-center justify-center shrink-0">
                                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10.5px] text-slate-400 font-medium leading-tight mt-0.5">
                                      {typeOption.desc}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Quick Preset Button */}
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const currentType = editingAgent ? (editingAgent.agentType || "lead_collector") : newAgentType;
                                handleApplyAgentTypePresets(currentType);
                                toast.success(`Applied recommended variables & destinations for ${currentType.replace("_", " ")}!`);
                              }}
                              className="text-[10.5px] font-bold text-[#00B074] hover:underline flex items-center gap-1 cursor-pointer"
                              title="Automatically populate recommended Custom Variables & Destinations for the selected type"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Apply recommended variables & destination preset</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. Channels / Target Platforms */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                              3. Channels <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {((editingAgent ? editingAgent.platforms : newAgentPlatforms) || []).includes("ALL")
                                ? "All Channels Active"
                                : `${((editingAgent ? editingAgent.platforms : newAgentPlatforms) || []).length} Channel(s) Selected`}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "ALL", label: "All Channels", icon: Globe, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700" },
                              { id: "WHATSAPP", label: "WhatsApp", icon: MessageSquare, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700" },
                              { id: "FACEBOOK", label: "Facebook", icon: MessageCircle, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:blue-950/40 border-blue-300 dark:border-blue-700" },
                              { id: "INSTAGRAM", label: "Instagram", icon: Instagram, color: "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 border-pink-300 dark:border-pink-700" },
                            ].map((p) => {
                              const currentPlatforms = (editingAgent ? editingAgent.platforms : newAgentPlatforms) || ["ALL"];
                              const isStrictSelected = currentPlatforms.includes(p.id);

                              const handleToggle = () => {
                                let updated: string[];
                                if (p.id === "ALL") {
                                  updated = ["ALL"];
                                } else {
                                  if (currentPlatforms.includes("ALL")) {
                                    updated = [p.id];
                                  } else if (currentPlatforms.includes(p.id)) {
                                    updated = currentPlatforms.filter((item: string) => item !== p.id);
                                    if (updated.length === 0) updated = ["ALL"];
                                  } else {
                                    updated = [...currentPlatforms.filter((item: string) => item !== "ALL"), p.id];
                                    if (["WHATSAPP", "FACEBOOK", "INSTAGRAM"].every(ch => updated.includes(ch))) {
                                      updated = ["ALL"];
                                    }
                                  }
                                }
                                if (editingAgent) {
                                  setEditingAgent({ ...editingAgent, platforms: updated });
                                } else {
                                  setNewAgentPlatforms(updated);
                                }
                              };

                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={handleToggle}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer",
                                    isStrictSelected || (p.id === "ALL" && currentPlatforms.includes("ALL"))
                                      ? cn("shadow-sm font-black", p.color)
                                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                  )}
                                >
                                  <p.icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{p.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Agent will only operate on incoming messages from the selected channels.
                          </p>
                        </div>

                        {/* 4. AI Provider & Model */}
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                            4. AI Configuration
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400">Provider</label>
                              <select
                                value={editingAgent ? (editingAgent.aiProvider || "openai") : newAgentProvider}
                                onChange={(e) => {
                                  const newProv = e.target.value;
                                  if (editingAgent) {
                                    setEditingAgent({ ...editingAgent, aiProvider: newProv });
                                  } else {
                                    setNewAgentProvider(newProv);
                                  }
                                  const currentKey = editingAgent ? (editingAgent.aiProviderApiKey || apiKeys[newProv]) : (newAgentKey || apiKeys[newProv]);
                                  if (currentKey) {
                                    fetchModelsForProvider(newProv, currentKey);
                                  }
                                }}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12.5px] font-bold outline-none focus:border-[#00B074] transition-all"
                              >
                                <option value="openai">OpenAI</option>
                                <option value="gemini">Gemini</option>
                                <option value="claude">Claude</option>
                                <option value="xai">X AI</option>
                                <option value="deepseek">DeepSeek</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400">Model</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const prov = editingAgent ? (editingAgent.aiProvider || "openai") : newAgentProvider;
                                    const key = editingAgent ? (editingAgent.aiProviderApiKey || apiKeys[prov]) : (newAgentKey || apiKeys[prov]);
                                    fetchModelsForProvider(prov, key);
                                  }}
                                  disabled={isLoadingModels}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00B074] hover:underline cursor-pointer disabled:opacity-50"
                                  title="Fetch available models from provider API"
                                >
                                  <RefreshCw className={cn("w-2.5 h-2.5", isLoadingModels && "animate-spin")} />
                                  <span>{isLoadingModels ? "Loading..." : "Fetch"}</span>
                                </button>
                              </div>
                              <select
                                value={editingAgent 
                                  ? (isCustomModel(editingAgent.model, editingAgent.aiProvider || "openai", fetchedProviderModels[editingAgent.aiProvider || "openai"]) ? "custom" : (editingAgent.model || "gpt-4o-mini")) 
                                  : (isCustomModel(newAgentModel, newAgentProvider, fetchedProviderModels[newAgentProvider]) ? "custom" : newAgentModel)
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (editingAgent) {
                                    setEditingAgent({ 
                                      ...editingAgent, 
                                      model: val === "custom" ? (editingAgent.customModelName || "custom") : val,
                                      isCustom: val === "custom"
                                    });
                                  } else {
                                    if (val === "custom") {
                                      setNewAgentModel(newAgentCustomModel || "custom");
                                    } else {
                                      setNewAgentModel(val);
                                    }
                                  }
                                }}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12.5px] font-bold outline-none focus:border-[#00B074] transition-all"
                              >
                                {(
                                  fetchedProviderModels[editingAgent ? (editingAgent.aiProvider || "openai") : newAgentProvider]?.length
                                    ? fetchedProviderModels[editingAgent ? (editingAgent.aiProvider || "openai") : newAgentProvider]
                                    : (PROVIDER_MODELS[editingAgent ? (editingAgent.aiProvider || "openai") : newAgentProvider] || PROVIDER_MODELS.openai)
                                ).map((m) => (
                                  <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                                <option value="custom">Custom Model...</option>
                              </select>
                            </div>
                          </div>

                          {/* Custom Model Input when 'custom' is active */}
                          {(
                            (editingAgent
                              ? isCustomModel(editingAgent.model, editingAgent.aiProvider || "openai", fetchedProviderModels[editingAgent.aiProvider || "openai"])
                              : isCustomModel(newAgentModel, newAgentProvider, fetchedProviderModels[newAgentProvider])
                            ) || (editingAgent?.model === "custom" || newAgentModel === "custom")
                          ) && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                              <label className="block text-[10.5px] font-black text-[#00B074] uppercase tracking-wider">
                                Custom Model Identifier
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. gemini-2.5-flash-thinking or gpt-4.5-preview"
                                value={editingAgent ? (editingAgent.customModelName ?? (editingAgent.model === "custom" ? "" : editingAgent.model)) : newAgentCustomModel}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (editingAgent) {
                                    setEditingAgent({
                                      ...editingAgent,
                                      customModelName: val,
                                      model: val || "custom",
                                    });
                                  } else {
                                    setNewAgentCustomModel(val);
                                    setNewAgentModel(val || "custom");
                                  }
                                }}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-[#00B074]/50 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-200 text-[12.5px] font-bold outline-none focus:border-[#00B074] focus:ring-1 focus:ring-[#00B074]/30 transition-all"
                              />
                            </div>
                          )}

                          {/* Provider API Key */}
                          <div className="space-y-1.5">
                            <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                              Provider API Key
                            </label>
                            <input
                              type="password"
                              placeholder="Leave blank to use Organization key"
                              value={editingAgent ? (editingAgent.aiProviderApiKey || "") : newAgentKey}
                              onChange={(e) => editingAgent
                                ? setEditingAgent({ ...editingAgent, aiProviderApiKey: e.target.value })
                                : setNewAgentKey(e.target.value)
                              }
                              onBlur={(e) => {
                                const typedKey = e.target.value.trim();
                                const currentProv = editingAgent ? (editingAgent.aiProvider || "openai") : newAgentProvider;
                                if (typedKey) {
                                  fetchModelsForProvider(currentProv, typedKey);
                                }
                              }}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all"
                            />
                          </div>

                          {/* Temperature & Token Limit */}
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-3.5">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider">
                                  Creativity / Temperature
                                </label>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-black">
                                  {editingAgent ? (editingAgent.temperature !== undefined ? editingAgent.temperature : 0.1) : newAgentTemperature}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={editingAgent ? (editingAgent.temperature !== undefined ? editingAgent.temperature : 0.1) : newAgentTemperature}
                                onChange={(e) => editingAgent
                                  ? setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })
                                  : setNewAgentTemperature(parseFloat(e.target.value))
                                }
                                className="w-full h-2 accent-[#00B074] bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                              />
                            </div>

                            <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10.5px] font-black text-slate-500 uppercase tracking-wider">
                                  Token Limit (Max Output)
                                </label>
                                <span className="text-[10px] font-bold text-slate-400">
                                  Default: 2048
                                </span>
                              </div>
                              <input
                                type="number"
                                min="100"
                                max="32000"
                                step="256"
                                placeholder="2048"
                                value={editingAgent ? (editingAgent.maxTokens !== undefined ? editingAgent.maxTokens : 2048) : newAgentMaxTokens}
                                onChange={(e) => editingAgent
                                  ? setEditingAgent({ ...editingAgent, maxTokens: parseInt(e.target.value) || 2048 })
                                  : setNewAgentMaxTokens(parseInt(e.target.value) || 2048)
                                }
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12.5px] font-bold outline-none focus:border-[#00B074] transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 5. Excel / Google Spreadsheet Configuration */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-bold text-[#00B074] uppercase tracking-widest flex items-center gap-1.5">
                              <FileSpreadsheet className="w-3.5 h-3.5" /> 5. Spreadsheet / Excel Destination
                            </h4>
                            <span className="text-[9.5px] text-slate-400 font-semibold">
                              All Agent Types Supported
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1">Spreadsheet ID</label>
                              <input
                                type="text"
                                placeholder="e.g. 1ABC123xyz_YOUR_SPREADSHEET_ID"
                                value={editingAgent ? (editingAgent.googleSpreadsheetId || "") : newAgentSpreadsheetId}
                                onChange={(e) => editingAgent
                                  ? setEditingAgent({ ...editingAgent, googleSpreadsheetId: e.target.value })
                                  : setNewAgentSpreadsheetId(e.target.value)
                                }
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12px] font-bold outline-none focus:border-[#00B074] transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1">Sheet Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Leads or Sheet1"
                                value={editingAgent ? (editingAgent.googleSheetName || "Sheet1") : newAgentSheetName}
                                onChange={(e) => editingAgent
                                  ? setEditingAgent({ ...editingAgent, googleSheetName: e.target.value })
                                  : setNewAgentSheetName(e.target.value)
                                }
                                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[12px] font-bold outline-none focus:border-[#00B074] transition-all"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Lead, Ordering and Appointment agents will export their collected variables to this sheet when Spreadsheet destination is active.
                          </p>
                        </div>
                      </div>

                      {/* ============================================================ */}
                      {/* RIGHT COLUMN: Prompt, Custom Variables, Destinations, Web Import & Keyword Media (7 cols) */}
                      {/* ============================================================ */}
                      <div className="lg:col-span-7 space-y-6 flex flex-col">
                        <div className="space-y-6">

                          {/* 6. PROMPT (PERSONA & CONVERSATION BEHAVIOR ONLY) */}
                          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    6. AI Personality & Conversation Instructions
                                  </label>
                                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[9.5px] font-extrabold">
                                    Behavior Only
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                                  Describe tone, language, and guidelines. <strong className="text-slate-600 dark:text-slate-300 font-bold">Do NOT</strong> specify fields or storage here — configure Custom Variables below.
                                </p>
                              </div>

                              {/* Attach Knowledge File Button */}
                              <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#00B074] text-slate-700 dark:text-slate-200 hover:text-[#00B074] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0">
                                {isUploadingAgentFile ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00B074]" /> : <Paperclip className="w-3.5 h-3.5 text-[#00B074]" />}
                                <span>{isUploadingAgentFile ? "Attaching..." : "Add File"}</span>
                                <input
                                  type="file"
                                  accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                                  onChange={handleAgentFileUpload}
                                  disabled={isUploadingAgentFile}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            {/* Attached Files List Container */}
                            {agentAttachedFiles.length > 0 && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                      Attached Knowledge ({agentAttachedFiles.length})
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00B074] text-[10px] font-bold">
                                      Active in Agent
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {agentAttachedFiles.length > 4 && (
                                      <button
                                        type="button"
                                        onClick={() => setIsAttachedFilesCollapsed(!isAttachedFilesCollapsed)}
                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                      >
                                        {isAttachedFilesCollapsed ? `Show All (${agentAttachedFiles.length})` : "Collapse"}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm("Remove all attached files from this agent?")) {
                                          setAgentAttachedFiles([]);
                                          setAgentFileIds([]);
                                        }
                                      }}
                                      className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                                    >
                                      Clear All
                                    </button>
                                  </div>
                                </div>

                                {!isAttachedFilesCollapsed ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                                    {agentAttachedFiles.map((file, idx) => (
                                      <div
                                        key={file.id || idx}
                                        onClick={() => setViewingFileContent({ name: file.name, content: file.content || "" })}
                                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition-all group"
                                        title={`${file.name} - Click to preview content`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                          {file.isWeb || file.sourceUrl ? (
                                            <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                          ) : (
                                            <FileText className="w-3.5 h-3.5 text-[#00B074] shrink-0" />
                                          )}
                                          <span className="truncate text-slate-700 dark:text-slate-200 text-[11.5px] font-bold">
                                            {file.name}
                                          </span>
                                          <span
                                            className={cn(
                                              "px-1.5 py-0.5 rounded text-[9px] uppercase font-black shrink-0",
                                              file.isWeb || file.sourceUrl
                                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                            )}
                                          >
                                            {file.size || (file.isWeb ? "WEB" : "DOC")}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-500 transition-colors" />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveAttachedFile(idx);
                                            }}
                                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-500 rounded-md transition-colors cursor-pointer"
                                            title="Remove File"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => setIsAttachedFilesCollapsed(false)}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <span>
                                      <strong className="text-slate-700 dark:text-slate-200 font-bold">{agentAttachedFiles.length}</strong> knowledge files attached (click to expand)
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Prompt Textarea */}
                            <textarea
                              rows={8}
                              placeholder="e.g. Help customers book an appointment and politely answer their questions with a welcoming tone..."
                              value={editingAgent ? (editingAgent.instructions || "") : newAgentInstructions}
                              onChange={(e) => editingAgent
                                ? setEditingAgent({ ...editingAgent, instructions: e.target.value })
                                : setNewAgentInstructions(e.target.value)
                              }
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono text-[12.5px] leading-relaxed outline-none focus:border-[#00B074] resize-y min-h-[140px] max-h-[260px] custom-scrollbar transition-all"
                            />
                          </div>

                          {/* 7. CUSTOM VARIABLES (THE SOLE SOURCE OF TRUTH FOR DATA COLLECTION) */}
                          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                  7. Custom Variables
                                </label>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00B074] border border-emerald-500/30 text-[9.5px] font-black uppercase tracking-wider">
                                  Source of Truth
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {((editingAgent ? editingAgent.customVariables : newAgentCustomVariables) || []).length} Variable(s) Configured
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                              The agent will <strong className="text-[#00B074] font-black">ONLY</strong> collect and extract the variables configured here. Even if the prompt mentions 50 extra fields, the agent will never collect unconfigured fields.
                            </p>

                            {/* Quick Add Preset Chips */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                Quick Add Presets:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { name: "name", label: "Customer Name", type: "text" },
                                  { name: "phone", label: "Phone Number", type: "phone" },
                                  { name: "email", label: "Email Address", type: "email" },
                                  { name: "name", type: "text" },
                                  { name: "phone", type: "phone" },
                                  { name: "email", type: "email" },
                                  { name: "address", type: "text" },
                                  { name: "product", type: "text" },
                                  { name: "quantity", type: "number" },
                                  { name: "appointment_date", type: "date" },
                                  { name: "appointment_time", type: "time" },
                                  { name: "company", type: "text" },
                                  { name: "notes", type: "text" },
                                ].map((preset) => (
                                  <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handleAddCustomVariable(preset.name, preset.type)}
                                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#00B074] hover:text-[#00B074] text-slate-600 dark:text-slate-300 text-[10.5px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>{preset.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Add Variable Inline Inputs */}
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                <div className="sm:col-span-7">
                                  <input
                                    type="text"
                                    placeholder="Variable Name (e.g. product, email, budget)"
                                    value={tempVarName}
                                    onChange={(e) => setTempVarName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddCustomVariable();
                                      }
                                    }}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <select
                                    value={tempVarType}
                                    onChange={(e) => setTempVarType(e.target.value)}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                                  >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="email">Email</option>
                                    <option value="phone">Phone</option>
                                    <option value="date">Date</option>
                                    <option value="time">Time</option>
                                  </select>
                                </div>
                                <div className="sm:col-span-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddCustomVariable()}
                                    className="w-full py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Configured Custom Variables Pill List */}
                            <div className="space-y-1.5">
                              {((editingAgent ? editingAgent.customVariables : newAgentCustomVariables) || []).length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                  No variables configured yet. Click a preset chip above or add a variable.
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
                                  {((editingAgent ? editingAgent.customVariables : newAgentCustomVariables) || []).map((v: any, idx: number) => (
                                    <div
                                      key={v.id || idx}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs group"
                                    >
                                      <span className="font-mono text-[#00B074]">{v.name}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[9.5px] uppercase font-black">
                                        {v.type || "text"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCustomVariable(idx)}
                                        className="text-slate-300 hover:text-red-500 ml-1 p-0.5 rounded transition-colors cursor-pointer"
                                        title="Remove variable"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 8. DATA DESTINATIONS */}
                          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                8. Data Destinations
                              </label>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                Optional • Multi-Select Supported
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Choose where extracted custom variables should be dispatched and saved:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                              {[
                                {
                                  id: "spreadsheet",
                                  title: "Spreadsheet / Excel",
                                  desc: "Appends row of custom variables to Google Sheets",
                                  icon: FileSpreadsheet,
                                  color: "text-emerald-600 dark:text-emerald-400",
                                  border: "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/25",
                                },
                                {
                                  id: "pipeline",
                                  title: "CRM Pipeline Sync",
                                  desc: "Syncs customer journey directly to Pipeline stages",
                                  icon: Route,
                                  color: "text-purple-600 dark:text-purple-400",
                                  border: "border-purple-500 bg-purple-50/40 dark:bg-purple-950/25",
                                },
                                {
                                  id: "ordering_system",
                                  title: "Ordering System",
                                  desc: "Creates & registers order in CRM Order Manager",
                                  icon: ShoppingBag,
                                  color: "text-amber-600 dark:text-amber-400",
                                  border: "border-amber-500 bg-amber-50/40 dark:bg-amber-950/25",
                                },
                                {
                                  id: "appointment_system",
                                  title: "Appointment System",
                                  desc: "Schedules booking in CRM Appointment Calendar",
                                  icon: Calendar,
                                  color: "text-blue-600 dark:text-blue-400",
                                  border: "border-blue-500 bg-blue-50/40 dark:bg-blue-950/25",
                                },
                              ].map((dest) => {
                                const currentDestinations = (editingAgent ? editingAgent.destinations : newAgentDestinations) || [];
                                const isChecked = currentDestinations.includes(dest.id);

                                const toggleDest = () => {
                                  let updated: string[];
                                  if (isChecked) {
                                    updated = currentDestinations.filter((d: string) => d !== dest.id);
                                  } else {
                                    updated = [...currentDestinations, dest.id];
                                  }
                                  if (editingAgent) {
                                    setEditingAgent({ ...editingAgent, destinations: updated });
                                  } else {
                                    setNewAgentDestinations(updated);
                                  }
                                };

                                return (
                                  <div
                                    key={dest.id}
                                    onClick={toggleDest}
                                    className={cn(
                                      "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between",
                                      isChecked
                                        ? cn("shadow-xs font-bold", dest.border)
                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                                    )}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <div className={cn("p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800", dest.color)}>
                                          <dest.icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className={cn(
                                          "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                          isChecked ? "bg-[#00B074] border-[#00B074] text-white" : "border-slate-300 dark:border-slate-600"
                                        )}>
                                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                      </div>
                                      <span className="text-xs font-black block text-slate-800 dark:text-slate-100">
                                        {dest.title}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium leading-tight mt-1.5">
                                      {dest.desc}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>

                            {/* POS SYSTEM WEBHOOK INTEGRATION */}
                            {(((editingAgent ? editingAgent.destinations : newAgentDestinations) || []).includes("ordering_system") || (editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled)) && (
                              <div className="mt-3.5 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/25 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                      <Store className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                        External POS System Webhook Dispatcher
                                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                                          Automated Push
                                        </span>
                                      </h5>
                                      <p className="text-[10px] text-slate-400 font-medium">
                                        Instantly send confirmed orders to your external POS system for kitchen receipt printing & inventory sync.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 select-none">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                      {(editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled) ? "Active" : "Disabled"}
                                    </span>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={!!(editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled)}
                                      onClick={() => {
                                        const nextVal = !(editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled);
                                        if (editingAgent) {
                                          setEditingAgent({ ...editingAgent, posWebhookEnabled: nextVal });
                                        } else {
                                          setNewAgentPosWebhookEnabled(nextVal);
                                        }
                                      }}
                                      className={cn(
                                        "w-9 h-5 rounded-full transition-colors relative cursor-pointer focus:outline-none shrink-0",
                                        (editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled)
                                          ? "bg-amber-500"
                                          : "bg-slate-200 dark:bg-slate-700"
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform shadow-xs",
                                          (editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled) && "translate-x-4"
                                        )}
                                      />
                                    </button>
                                  </div>
                                </div>

                                {(editingAgent ? editingAgent.posWebhookEnabled : newAgentPosWebhookEnabled) && (
                                  <div className="space-y-3 pt-2 border-t border-amber-500/20">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                                          POS Webhook URL <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="url"
                                          placeholder="https://pos.yourrestaurant.com/api/v1/orders"
                                          value={(editingAgent ? editingAgent.posWebhookUrl : newAgentPosWebhookUrl) || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (editingAgent) {
                                              setEditingAgent({ ...editingAgent, posWebhookUrl: val });
                                            } else {
                                              setNewAgentPosWebhookUrl(val);
                                            }
                                          }}
                                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                                        />
                                      </div>

                                      <div>
                                        <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                                          Secret Key / Bearer Token <span className="text-slate-400 font-normal">(Optional)</span>
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="e.g. pos_sec_991823... or Bearer Token"
                                          value={(editingAgent ? editingAgent.posWebhookSecret : newAgentPosWebhookSecret) || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (editingAgent) {
                                              setEditingAgent({ ...editingAgent, posWebhookSecret: val });
                                            } else {
                                              setNewAgentPosWebhookSecret(val);
                                            }
                                          }}
                                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                                      <div className="text-[10px] text-slate-400">
                                        {posWebhookTestStatus && (
                                          <span className={cn("font-bold", posWebhookTestStatus.includes("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                            {posWebhookTestStatus}
                                          </span>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isTestingPosWebhook || !(editingAgent ? editingAgent.posWebhookUrl : newAgentPosWebhookUrl)?.trim()}
                                        onClick={handleTestPosWebhook}
                                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                                      >
                                        {isTestingPosWebhook ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Testing POS...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Send className="w-3 h-3" />
                                            <span>Send Test Order to POS</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 9. CUSTOMER TAGGING & PIPELINE STAGE SYNC */}
                          <div className="p-4.5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                                  <Tag className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <label className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider block">
                                    9. Auto Customer Tagging & Pipeline Stage Sync
                                  </label>
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    Assign tags to customers automatically & move them across Pipeline stages in real-time
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setQuickTagName("");
                                  setQuickTagColor("#10B981");
                                  setQuickTagStageId("");
                                  setQuickTagTargetField("default");
                                  setIsQuickTagModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                              >
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Create New Tag</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              {/* Initial Inquiry Tag */}
                              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                                    Initial Chat / Inquiry Tag
                                  </label>
                                  <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold">
                                    On Engagement
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-slate-400">
                                  Assigned when customer first interacts with this agent.
                                </p>
                                <select
                                  value={editingAgent ? (editingAgent.defaultTagId || "") : newAgentDefaultTagId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (editingAgent) {
                                      setEditingAgent({ ...editingAgent, defaultTagId: val });
                                    } else {
                                      setNewAgentDefaultTagId(val);
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                                >
                                  <option value="">None (Do not tag automatically)</option>
                                  {availableTags.map((t) => {
                                    const matchedStage = pipelineStages.find((s) => s.tagId === t.id);
                                    return (
                                      <option key={t.id} value={t.id}>
                                        🏷️ {t.name} {matchedStage ? `➜ [Stage: ${matchedStage.name}]` : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                                {(() => {
                                  const currentTagId = editingAgent ? editingAgent.defaultTagId : newAgentDefaultTagId;
                                  const matchedStage = pipelineStages.find(s => s.tagId === currentTagId);
                                  if (!currentTagId) return null;
                                  return (
                                    <div className="text-[10px] flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                                      <Route className="w-3 h-3" />
                                      <span>
                                        {matchedStage ? `Moves customer to Pipeline: "${matchedStage.name}"` : "General Tag (not tied to any pipeline stage)"}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Lead Captured / Qualified Tag */}
                              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                                    Qualified / Converted Tag
                                  </label>
                                  <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-bold">
                                    On Data Captured
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-slate-400">
                                  Assigned when customer provides required lead details or makes booking.
                                </p>
                                <select
                                  value={editingAgent ? (editingAgent.qualifiedTagId || "") : newAgentQualifiedTagId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (editingAgent) {
                                      setEditingAgent({ ...editingAgent, qualifiedTagId: val });
                                    } else {
                                      setNewAgentQualifiedTagId(val);
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                                >
                                  <option value="">None (Do not tag on completion)</option>
                                  {availableTags.map((t) => {
                                    const matchedStage = pipelineStages.find((s) => s.tagId === t.id);
                                    return (
                                      <option key={t.id} value={t.id}>
                                        🏷️ {t.name} {matchedStage ? `➜ [Stage: ${matchedStage.name}]` : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                                {(() => {
                                  const currentTagId = editingAgent ? editingAgent.qualifiedTagId : newAgentQualifiedTagId;
                                  const matchedStage = pipelineStages.find(s => s.tagId === currentTagId);
                                  if (!currentTagId) return null;
                                  return (
                                    <div className="text-[10px] flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400">
                                      <Route className="w-3 h-3" />
                                      <span>
                                        {matchedStage ? `Moves customer to Pipeline: "${matchedStage.name}"` : "General Tag (not tied to any pipeline stage)"}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* 10. RESPONSE DELAY & TYPING TIME */}
                          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                                  10. Response Delay & Typing Simulation
                                </label>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9.5px] font-black uppercase tracking-wider">
                                  Human Pace
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                {((editingAgent ? editingAgent.delaySeconds : newAgentDelaySeconds) || 0) === 0
                                  ? "Instant Reply (0s delay)"
                                  : `${((editingAgent ? editingAgent.delaySeconds : newAgentDelaySeconds) || 0)}s delay before reply`}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Configure how many seconds the agent should wait before sending its message to simulate human typing and thought time:
                            </p>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {[
                                { label: "⚡ Instant (0s)", value: 0 },
                                { label: "⏱️ 2s", value: 2 },
                                { label: "⏱️ 5s", value: 5 },
                                { label: "⏱️ 10s", value: 10 },
                                { label: "⏱️ 15s", value: 15 },
                                { label: "⏱️ 30s", value: 30 },
                              ].map((preset) => {
                                const currentDelay = (editingAgent ? editingAgent.delaySeconds : newAgentDelaySeconds) ?? 0;
                                const isSelected = currentDelay === preset.value;
                                return (
                                  <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => {
                                      if (editingAgent) {
                                        setEditingAgent({ ...editingAgent, delaySeconds: preset.value });
                                      } else {
                                        setNewAgentDelaySeconds(preset.value);
                                      }
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                                      isSelected
                                        ? "bg-amber-500 text-white border-amber-500 shadow-xs scale-102"
                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400"
                                    )}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}

                              <div className="flex items-center gap-2 ml-auto">
                                <span className="text-[11px] font-bold text-slate-500">Custom Delay:</span>
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="120"
                                    value={(editingAgent ? editingAgent.delaySeconds : newAgentDelaySeconds) ?? 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, Math.min(120, parseInt(e.target.value) || 0));
                                      if (editingAgent) {
                                        setEditingAgent({ ...editingAgent, delaySeconds: val });
                                      } else {
                                        setNewAgentDelaySeconds(val);
                                      }
                                    }}
                                    className="w-20 px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-right pr-6"
                                  />
                                  <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                    s
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 11. IMPORT FROM WEBSITE */}
                          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                  11. Import from Website
                                </label>
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[9.5px] font-black uppercase tracking-wider">
                                  Selective Crawl
                                </span>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Crawl a website, review discovered routes, and selectively import chosen pages into the agent's knowledge base.
                            </p>

                            {/* URL input and Scan button */}
                            <div className="flex gap-2">
                              <input
                                type="url"
                                placeholder="https://example.com"
                                value={websiteScanUrl}
                                onChange={(e) => setWebsiteScanUrl(e.target.value)}
                                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                              />
                              <button
                                type="button"
                                onClick={handleScanWebsite}
                                disabled={isScanningWebsite}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50 shrink-0"
                              >
                                {isScanningWebsite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                <span>{isScanningWebsite ? "Scanning..." : "Fetch Routes"}</span>
                              </button>
                            </div>

                            {/* Discovered Routes Checklist */}
                            {discoveredWebsiteRoutes.length > 0 && (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                    Discovered Pages ({selectedWebsiteRoutes.length} of {discoveredWebsiteRoutes.length} selected)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedWebsiteRoutes.length === discoveredWebsiteRoutes.length) {
                                        setSelectedWebsiteRoutes([]);
                                      } else {
                                        setSelectedWebsiteRoutes(discoveredWebsiteRoutes.map(r => r.url));
                                      }
                                    }}
                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                  >
                                    {selectedWebsiteRoutes.length === discoveredWebsiteRoutes.length ? "Deselect All" : "Select All"}
                                  </button>
                                </div>

                                <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                  {discoveredWebsiteRoutes.map((route) => {
                                    const isRouteChecked = selectedWebsiteRoutes.includes(route.url);
                                    return (
                                      <label
                                        key={route.url}
                                        className={cn(
                                          "flex items-start gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all",
                                          isRouteChecked
                                            ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 text-slate-900 dark:text-white"
                                            : "border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isRouteChecked}
                                          onChange={() => {
                                            if (isRouteChecked) {
                                              setSelectedWebsiteRoutes(selectedWebsiteRoutes.filter(u => u !== route.url));
                                            } else {
                                              setSelectedWebsiteRoutes([...selectedWebsiteRoutes, route.url]);
                                            }
                                          }}
                                          className="mt-0.5 accent-[#00B074]"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="font-bold truncate">{route.title || route.path}</div>
                                          <div className="text-[10px] text-slate-400 truncate">{route.url}</div>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>

                                {/* Real-time Live Scraping Progress Component */}
                                {importProgress.isOpen && (
                                  <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-emerald-50/50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-2xl border border-emerald-500/40 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-[#00B074]">
                                          {importProgress.status === "running" ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : importProgress.status === "completed" ? (
                                            <CheckCircle2 className="w-4 h-4 text-[#00B074]" />
                                          ) : (
                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                          )}
                                        </div>
                                        <div>
                                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                                            {importProgress.status === "running"
                                              ? `Importing Page ${importProgress.current} of ${importProgress.total}...`
                                              : importProgress.status === "completed"
                                              ? `Import Complete (${importProgress.completed} Pages Added)`
                                              : `Import Stopped (${importProgress.completed} Added)`}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            {importProgress.status === "running"
                                              ? "Extracting clean text & adding to agent knowledge base live"
                                              : "Imported pages have been synchronized and added to agent"}
                                          </span>
                                        </div>
                                      </div>

                                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {importProgress.percent}%
                                      </span>
                                    </div>

                                    {/* Progress Bar with glow */}
                                    <div className="w-full bg-slate-200/70 dark:bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all duration-300",
                                          importProgress.status === "aborted"
                                            ? "bg-amber-500"
                                            : "bg-gradient-to-r from-emerald-500 via-[#00B074] to-teal-400 shadow-sm"
                                        )}
                                        style={{ width: `${Math.max(importProgress.percent, 4)}%` }}
                                      />
                                    </div>

                                    {/* Real-time Status Details */}
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium flex-wrap gap-2">
                                      <div className="truncate max-w-[280px]">
                                        {importProgress.status === "running" ? (
                                          <span>
                                            Current: <strong className="text-slate-700 dark:text-slate-200 font-bold">{importProgress.currentTitle || importProgress.currentUrl}</strong>
                                          </span>
                                        ) : (
                                          <span className="text-emerald-600 font-bold">
                                            ✓ {importProgress.completed} page(s) ready in agent context
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        {importProgress.status === "running" && importProgress.estimatedSecondsRemaining !== null && (
                                          <span className="flex items-center gap-1 font-mono text-[10.5px] text-slate-500 bg-white/70 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700">
                                            <Clock className="w-3 h-3 text-[#00B074]" />
                                            ~{importProgress.estimatedSecondsRemaining}s left
                                          </span>
                                        )}
                                        <span className="text-[10px] font-bold text-slate-400">
                                          {importProgress.completed} done {importProgress.failed > 0 && `· ${importProgress.failed} skipped`}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end pt-1 gap-2">
                                      {importProgress.status === "running" ? (
                                        <button
                                          type="button"
                                          onClick={handleAbortImport}
                                          className="px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                          <StopCircle className="w-3.5 h-3.5" />
                                          <span>Stop Import</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={handleCloseImportProgress}
                                          className="px-4 py-1.5 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Done ({importProgress.completed} Added)</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {!importProgress.isOpen && (
                                  <div className="flex justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={handleImportSelectedWebsitePages}
                                      disabled={isImportingWebsite || selectedWebsiteRoutes.length === 0}
                                      className="px-4 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                                    >
                                      {isImportingWebsite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                      <span>Import Selected Pages ({selectedWebsiteRoutes.length})</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 10. KEYWORD-BASED MEDIA / FILE RESPONSES */}
                          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                  12. Keyword / Media Responses
                                </label>
                                <span className="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30 text-[9.5px] font-black uppercase tracking-wider">
                                  Direct Trigger
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {((editingAgent ? editingAgent.keywordResponses : newAgentKeywordResponses) || []).length} Rule(s) Configured
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 font-medium">
                              Automatically dispatch files or media when user messages match keywords (e.g. "menu" → menu.pdf, "price" → price-list.pdf) — independently from the AI prompt.
                            </p>

                            {/* Rule Creator */}
                            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                                <div className="sm:col-span-4 space-y-1">
                                  <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-wider">
                                    Trigger Keyword
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. menu, price, catalog"
                                    value={tempKeyword}
                                    onChange={(e) => setTempKeyword(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074] transition-all"
                                  />
                                </div>

                                <div className="sm:col-span-3 space-y-1">
                                  <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-wider">
                                    Response Type
                                  </label>
                                  <select
                                    value={tempKeywordType}
                                    onChange={(e) => setTempKeywordType(e.target.value)}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074] transition-all"
                                  >
                                    <option value="document">Document (PDF/Doc)</option>
                                    <option value="image">Image (JPG/PNG)</option>
                                    <option value="video">Video (MP4)</option>
                                    <option value="audio">Audio (MP3/OGG)</option>
                                    <option value="file">File (Other)</option>
                                  </select>
                                </div>

                                <div className="sm:col-span-5 space-y-1">
                                  <label className="block text-[10.5px] font-black text-slate-400 uppercase tracking-wider">
                                    Media File
                                  </label>
                                  {tempKeywordFileName && tempKeywordUrl ? (
                                    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-3.5 h-3.5 text-[#00B074] shrink-0" />
                                        <span className="truncate max-w-[150px]" title={tempKeywordFileName}>{tempKeywordFileName}</span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setIsMediaLibraryOpen(true)}
                                          className="text-[10.5px] font-bold text-[#00B074] hover:underline px-1.5 py-0.5 rounded cursor-pointer"
                                        >
                                          Change
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTempKeywordUrl("");
                                            setTempKeywordFileName("");
                                          }}
                                          className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                                          title="Remove selection"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setIsMediaLibraryOpen(true)}
                                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/60 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-[#00B074] font-bold text-xs transition-all cursor-pointer shadow-2xs"
                                    >
                                      <ImageIcon className="w-4 h-4 text-[#00B074]" />
                                      <span>Choose from Media Library</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={handleAddKeywordRule}
                                  className="px-5 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Keyword Rule</span>
                                </button>
                              </div>
                            </div>

                            {/* Active Rules List */}
                            <div className="space-y-1.5">
                              {((editingAgent ? editingAgent.keywordResponses : newAgentKeywordResponses) || []).length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                  No keyword rules configured yet. Add rules above (e.g. "menu" → menu.pdf).
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                  {((editingAgent ? editingAgent.keywordResponses : newAgentKeywordResponses) || []).map((rule: any, idx: number) => (
                                    <div
                                      key={rule.id || idx}
                                      className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs shadow-2xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-mono font-black">
                                          "{rule.keyword}"
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] uppercase font-black">
                                          {rule.responseType}
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[200px]" title={rule.mediaUrl}>
                                          {rule.fileName || rule.mediaUrl}
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleRemoveKeywordRule(idx)}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0"
                                        title="Delete rule"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Modal Submit Actions Footer */}
                        <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-6">
                          <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold flex-wrap">
                            <span>{agentAttachedFiles.length} file(s) attached</span>
                            <span>•</span>
                            <span>{((editingAgent ? editingAgent.customVariables : newAgentCustomVariables) || []).length} custom variable(s)</span>
                            <span>•</span>
                            <span>{((editingAgent ? editingAgent.destinations : newAgentDestinations) || []).length} destination(s)</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                              <Clock className="w-3 h-3" />
                              {((editingAgent ? editingAgent.delaySeconds : newAgentDelaySeconds) || 0) > 0
                                ? `${((editingAgent ? editingAgent.delaySeconds : newAgentDelaySeconds) || 0)}s delay`
                                : "Instant reply"}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            {editingAgent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAgent(null);
                                  setAgentModalTab("agents");
                                }}
                                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                              >
                                Cancel Edit
                              </button>
                            )}
                            <button
                              type="submit"
                              disabled={isCreatingAgent}
                              className="px-6 py-2.5 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
                            >
                              {isCreatingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              {editingAgent ? "Save Changes" : "Create AI Agent"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* ============================================================ */
                  /* ALL AGENTS LIST VIEW WITH STRUCTURED BADGES */
                  /* ============================================================ */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search AI agents..."
                          value={agentSearchFilter}
                          onChange={(e) => setAgentSearchFilter(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 outline-none focus:border-[#00B074]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAgent(null);
                          setAgentModalTab("editor");
                        }}
                        className="px-4 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Agent
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                      {isLoadingAgents ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-semibold">
                          <Loader2 className="w-5 h-5 animate-spin text-[#00B074]" />
                          <span>Loading AI Agents...</span>
                        </div>
                      ) : agents.filter(a => !agentSearchFilter || a.name.toLowerCase().includes(agentSearchFilter.toLowerCase())).length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400 text-xs font-semibold">
                          No AI agents found.
                        </div>
                      ) : null}

                      {/* Filtered Agent Cards */}
                      {!isLoadingAgents && agents
                        .filter(a => !agentSearchFilter || a.name.toLowerCase().includes(agentSearchFilter.toLowerCase()))
                        .map((agent) => {
                          const isSelectedAgent = selectedAgentId === agent.id;
                          const agentType = agent.agentType || "lead_collector";
                          const customVars = Array.isArray(agent.customVariables) ? agent.customVariables : [];
                          const destinations = Array.isArray(agent.destinations) ? agent.destinations : [];
                          const keywordRules = Array.isArray(agent.keywordResponses) ? agent.keywordResponses : [];

                          return (
                            <div
                              key={agent.id}
                              className={cn(
                                "p-4.5 border rounded-2xl transition-all bg-white dark:bg-slate-900 flex flex-col justify-between min-h-[190px] shadow-2xs",
                                isSelectedAgent
                                  ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20"
                                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                              )}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[220px]">
                                      {agent.name}
                                    </h4>
                                    {/* Agent Type Badge */}
                                    {agentType === "ordering_collector" ? (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase flex items-center gap-1">
                                        <ShoppingBag className="w-2.5 h-2.5" /> Order Agent
                                      </span>
                                    ) : agentType === "appointment_collector" ? (
                                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[10px] font-black uppercase flex items-center gap-1">
                                        <Calendar className="w-2.5 h-2.5" /> Booking Agent
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1">
                                        <UserCheck className="w-2.5 h-2.5" /> Lead Agent
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase">
                                      {agent.aiProvider || "openai"}
                                    </span>
                                    {isSelectedAgent && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#00B074] text-white text-[9.5px] font-black uppercase">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Tags & Metadata Row */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {/* Platforms */}
                                  {(!agent.platforms || agent.platforms.includes("ALL")) ? (
                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-[9.5px] font-black uppercase flex items-center gap-0.5">
                                      <Globe className="w-2.5 h-2.5" /> All Channels
                                    </span>
                                  ) : (
                                    agent.platforms.map((p: string) => {
                                      if (p === "WHATSAPP") return (
                                        <span key={p} className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-black uppercase flex items-center gap-0.5" title="WhatsApp">
                                          <MessageSquare className="w-2.5 h-2.5" /> WA
                                        </span>
                                      );
                                      if (p === "FACEBOOK") return (
                                        <span key={p} className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 text-[9.5px] font-black uppercase flex items-center gap-0.5" title="Facebook">
                                          <MessageCircle className="w-2.5 h-2.5" /> FB
                                        </span>
                                      );
                                      if (p === "INSTAGRAM") return (
                                        <span key={p} className="px-1.5 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-400 text-[9.5px] font-black uppercase flex items-center gap-0.5" title="Instagram">
                                          <Instagram className="w-2.5 h-2.5" /> IG
                                        </span>
                                      );
                                      return null;
                                    })
                                  )}

                                  {/* Active Destinations */}
                                  {destinations.map((d: string) => (
                                    <span key={d} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9.5px] font-bold">
                                      {d === "spreadsheet" ? "📊 Sheets" : d === "ordering_system" ? "🛒 Orders" : d === "pipeline" ? "🔄 Pipeline" : "🗓️ Booking"}
                                    </span>
                                  ))}

                                  {/* Custom Variables count */}
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-bold">
                                    {customVars.length} Variables
                                  </span>

                                  {/* Keyword responses count */}
                                  {keywordRules.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400 text-[9.5px] font-bold">
                                      {keywordRules.length} Triggers
                                    </span>
                                  )}

                                  {/* Response Delay */}
                                  {typeof (agent as any).delaySeconds === "number" && (agent as any).delaySeconds > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[9.5px] font-bold flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" /> {(agent as any).delaySeconds}s delay
                                    </span>
                                  )}

                                  {/* POS Webhook Active */}
                                  {!!(agent as any).posWebhookEnabled && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-bold flex items-center gap-0.5" title="POS Webhook Active">
                                      <Store className="w-2.5 h-2.5" /> POS Active
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-400 font-medium line-clamp-2 pt-1">
                                  {agent.instructions || "No custom instructions provided."}
                                </p>
                              </div>

                              {/* Card Action Buttons */}
                              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openEditAgentDialog(agent);
                                      setAgentModalTab("editor");
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
                                    title="Edit Agent"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openTestAgent(agent)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-[#00B074] transition-all cursor-pointer"
                                    title="Test Agent"
                                  >
                                    <PlayCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateAgent(agent)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
                                    title="Duplicate Agent"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAgent(agent.id)}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition-all cursor-pointer"
                                    title="Delete Agent"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {!isSelectedAgent && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSetActiveAgent(agent.id, agent.name)}
                                    className="px-3 py-1 bg-[#00B074] hover:bg-[#009c66] text-white rounded-lg text-xs font-bold active:scale-95 transition-all cursor-pointer"
                                  >
                                    Set Active
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* QUICK CREATE TAG & LINK PIPELINE STAGE MODAL */}
          <Dialog open={isQuickTagModalOpen} onOpenChange={setIsQuickTagModalOpen}>
            <DialogContent className="max-w-md rounded-2xl p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 plus-jakarta-forced">
              <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                  <Tag className="w-4 h-4 text-[#00B074]" />
                  <span>Create Tag & Link to Pipeline</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Interested, Follow-up, Qualified"
                    value={quickTagName}
                    onChange={(e) => setQuickTagName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tag Color
                  </label>
                  <div className="flex items-center gap-2">
                    {["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#EF4444"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setQuickTagColor(c)}
                        style={{ backgroundColor: c }}
                        className={cn(
                          "w-7 h-7 rounded-full transition-transform cursor-pointer",
                          quickTagColor === c ? "scale-110 ring-2 ring-offset-2 ring-emerald-500" : "opacity-80 hover:opacity-100"
                        )}
                      />
                    ))}
                    <input
                      type="color"
                      value={quickTagColor}
                      onChange={(e) => setQuickTagColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 ml-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Link directly to Pipeline Stage (Optional)
                  </label>
                  <select
                    value={quickTagStageId}
                    onChange={(e) => setQuickTagStageId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-[#00B074]"
                  >
                    <option value="">Do not link to any stage (General Tag)</option>
                    {pipelineStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        Pipeline Stage: {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Customers assigned this tag will automatically move to this column on the Pipeline Board.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsQuickTagModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingQuickTag || !quickTagName.trim()}
                    onClick={handleCreateQuickTag}
                    className="px-4 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
                  >
                    {isCreatingQuickTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Create & Link Tag</span>
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>


          {/* MEDIA LIBRARY SELECTOR MODAL FOR KEYWORD RESPONSES */}
          <MediaLibraryModal
            isOpen={isMediaLibraryOpen}
            onClose={() => setIsMediaLibraryOpen(false)}
            contentType={
              tempKeywordType === "image" ? "image" :
              tempKeywordType === "video" ? "video" :
              tempKeywordType === "audio" ? "audio" :
              tempKeywordType === "document" ? "document" : "all"
            }
            onSelect={(url, name, type) => {
              setTempKeywordUrl(url);
              if (name) setTempKeywordFileName(name);
              if (type) {
                if (type === "image") setTempKeywordType("image");
                else if (type === "video") setTempKeywordType("video");
                else if (type === "audio") setTempKeywordType("audio");
                else if (type === "document") setTempKeywordType("document");
                else setTempKeywordType("file");
              }
              setIsMediaLibraryOpen(false);
              toast.success(`Selected "${name || 'file'}" from Media Library!`);
            }}
          />

          {/* TEST AI AGENT MODAL */}
          <Dialog
            open={!!testAgent}
            onOpenChange={(open) => {
              if (!open) {
                setTestAgent(null);
                setTestReply("");
                setTestMedia([]);
                setIsTestingAgent(false);
              }
            }}
          >
            <DialogContent className="max-w-xl rounded-[24px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced">
              {testAgent && (
                <div className="p-7">
                  <DialogHeader className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <DialogTitle className="text-[18px] font-black flex items-center gap-2 text-slate-800 dark:text-white">
                      <PlayCircle className="w-5 h-5 text-[#00B074]" />
                      Test {testAgent.name}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRunAgentTest} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        Message
                      </label>
                      <textarea
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        rows={4}
                        placeholder="Ask this agent a question..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] resize-none transition-all"
                        required
                      />
                    </div>

                    {testReply && (
                      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="w-4 h-4 text-[#00B074]" />
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Agent Reply
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
                          {testReply}
                        </p>

                        {testMedia && testMedia.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/50 space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                              Attached Media ({testMedia.length})
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                              {testMedia.map((m: any, idx: number) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 flex items-center gap-3">
                                  {m.type === "video" ? (
                                    <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0 text-indigo-500">
                                      <Video className="w-5 h-5" />
                                    </div>
                                  ) : (
                                    <img src={m.url} alt={m.caption || "Preview"} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                        {m.type}
                                      </span>
                                      {m.caption && <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{m.caption}</span>}
                                    </div>
                                    <a href={m.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5">
                                      {m.url}
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                      <button
                        type="button"
                        onClick={() => {
                          setTestAgent(null);
                          setTestReply("");
                        }}
                        className="px-4 py-2 text-[12px] font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isTestingAgent}
                        className="px-5 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-[12px] flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95"
                      >
                        {isTestingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                        Test Now
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* EDIT KNOWLEDGE ENTRY MODAL */}
          <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
            <DialogContent className="max-w-xl rounded-[24px] p-0 overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 plus-jakarta-forced">
              {editEntry && (
                <div className="p-7">
                  <DialogHeader className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <DialogTitle className="text-[18px] font-black flex items-center gap-2 text-slate-800 dark:text-white plus-jakarta-forced">
                      <Edit2 className="w-5 h-5 text-[#00B074]" />
                      {t("editEntryTitle")}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleEdit} className="space-y-5 plus-jakarta-forced">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">{t("fieldTitle")}</label>
                      <input
                        name="title"
                        type="text"
                        defaultValue={editEntry.title}
                        placeholder={t("titlePlaceholder")}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[13px] font-bold outline-none focus:border-[#00B074] transition-all plus-jakarta-forced"
                        required
                      />
                    </div>
                    {editEntry.fileName && (
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">
                          {editEntry.sourceUrl?.startsWith("http") ? "Scraped Website" : "Attached Document"}
                        </label>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                              {editEntry.sourceUrl?.startsWith("http") ? <Globe className="w-4 h-4 text-indigo-600" /> : <FileText className="w-4 h-4 text-emerald-500" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 truncate">
                                {editEntry.fileName}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 truncate">
                                {editEntry.sourceUrl || "Uploaded Document File"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(editEntry.content || "");
                              toast.success("Content copied to clipboard!");
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold flex items-center gap-1 shrink-0 bg-white dark:bg-slate-800"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider plus-jakarta-forced">
                          {editEntry.fileName ? "Parsed & Scraped Content" : t("fieldContent")}
                        </label>
                        <span className="text-[10px] font-bold text-slate-400">
                          {editEntry.content?.length || 0} characters
                        </span>
                      </div>
                      <textarea
                        name="content"
                        rows={8}
                        defaultValue={editEntry.content}
                        placeholder={t("contentPlaceholder")}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-[12px] leading-relaxed outline-none focus:border-[#00B074] resize-y min-h-[140px] max-h-[360px] custom-scrollbar transition-all plus-jakarta-forced"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                      <button
                        type="button"
                        onClick={() => setEditEntry(null)}
                        className="px-4 py-2 text-[12px] font-extrabold text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 transition-all plus-jakarta-forced cursor-pointer active:scale-95"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        disabled={isEditing}
                        className="px-5 py-2 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-extrabold text-[12px] flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 plus-jakarta-forced"
                      >
                        {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
                        {t("saveChanges")}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* QUICK FILE CONTENT PREVIEW MODAL */}
          {viewingFileContent && (
            <Dialog open={!!viewingFileContent} onOpenChange={() => setViewingFileContent(null)}>
              <DialogContent className="max-w-2xl rounded-[24px] p-6 border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
                <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                  <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-800 dark:text-white">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    {viewingFileContent.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">
                      Content Preview ({viewingFileContent.content.length} characters)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingFileContent.content);
                        toast.success("Content copied to clipboard!");
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 text-slate-600 dark:text-slate-300"
                    >
                      <Copy className="w-3 h-3" /> Copy Content
                    </button>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 max-h-[420px] overflow-y-auto whitespace-pre-wrap">
                    {viewingFileContent.content || "No text content found for this file."}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
