"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useSession } from "next-auth/react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  Trash2,
  User,
  Users,
  MoreVertical,
  Paperclip,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  Download,
  Upload as UploadIcon,
  X,
  ChevronDown,
  Megaphone,
  QrCode,
  Send,
  Sparkles,
  TrendingUp,
  CheckCheck,
  MousePointerClick,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportDripCampaignsModal } from "@/components/campaign/ImportDripCampaignsModal";
import { Pagination } from "@/components/ui/Pagination";
import { useUserStatus } from "@/hooks/useUserStatus";
import { getGroups } from "@/app/actions/groups";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { getQuotaStatus } from '@/app/actions/quota';
import CampaignLiveProgress from "@/components/campaign/CampaignLiveProgress";

type AnalyticsTab = "overall" | "delivered" | "read" | "clicked";
type RecipientAnalyticsRow = DripCampaignAnalyticsSummary["recipientRows"][number];

export default function DripCampaignPage() {
  const t = useTranslations("CampaignsPage");
  const locale = useLocale();
  const router = useRouter();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { whatsappConnected, whatsappConnectionMethod, whatsappNumber } = useUserStatus();
  const isQrConnected = whatsappConnected && whatsappConnectionMethod === "qr";
  const isApiConnected = whatsappConnected && (whatsappConnectionMethod === "embedded_signup" || whatsappConnectionMethod === "manual" || !whatsappConnectionMethod);

  const [messages, setMessages] = useState<ScheduledMessageWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [recipientFilter, setRecipientFilter] = useState("ALL");
  const [groups, setGroups] = useState<any[]>([]);
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMessage, setViewMessage] =
    useState<ScheduledMessageWithRelations | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overall");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const pageSize = 10;

  const { data: session } = useSession();
  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
  const userPerms = (session?.user?.permissions as Record<string, unknown>) || {};
  const dripCampaignAccess =
    typeof userPerms.drip_campaign === "string"
      ? userPerms.drip_campaign
      : isAdmin
        ? "full"
        : "none";
  const canCreate =
    isAdmin ||
    dripCampaignAccess === "full" ||
    dripCampaignAccess === "edit" ||
    userPerms.camp_create === true ||
    userPerms.camp_super === true;

  const [campaignQuota, setCampaignQuota] = useState<{ allowed: boolean; limit: number; current: number } | null>(null);

  useEffect(() => {
    getQuotaStatus('maxCampaigns').then(status => {
      setCampaignQuota(status);
    }).catch(err => console.error('Failed to fetch campaign quota:', err));
  }, []);

  const isCampaignLimitReached = campaignQuota ? !campaignQuota.allowed : false;
  const canEdit =
    isAdmin ||
    dripCampaignAccess === "full" ||
    dripCampaignAccess === "edit" ||
    userPerms.camp_edit === true ||
    userPerms.camp_super === true;
  const canDelete =
    isAdmin ||
    dripCampaignAccess === "full" ||
    dripCampaignAccess === "delete" ||
    userPerms.camp_delete === true ||
    userPerms.camp_super === true;
  const canProcess =
    isAdmin ||
    dripCampaignAccess === "full" ||
    userPerms.camp_super === true;

  const fetcher = (url: string) => fetch(url).then((r) => r.json());

  const { data: swrMessages, isLoading: isSWRisLoading } = useSWR(
    "/api/chat/poll?type=drip-scheduler",
    fetcher,
    {
      refreshInterval: 25000,
      dedupingInterval: 10000,
      revalidateOnFocus: false,
    },
  );
  const campaignAnalyticsKey =
    messages.length > 0
      ? ["drip-campaign-analytics", messages.map((m) => m.id).join(",")]
      : null;
  const { data: campaignAnalyticsResult } = useSWR(
    campaignAnalyticsKey,
    () => getDripCampaignAnalytics(messages.map((m) => m.id)),
    {
      refreshInterval: 30000,
      dedupingInterval: 15000,
      revalidateOnFocus: false,
    },
  );
  const campaignAnalytics: DripCampaignAnalyticsMap =
    campaignAnalyticsResult?.success && campaignAnalyticsResult.data
      ? campaignAnalyticsResult.data
      : {};

  // Sync SWR payload with local state (same flow as scheduler page)
  useEffect(() => {
    if (swrMessages) {
      setMessages(swrMessages as ScheduledMessageWithRelations[]);
      setIsLoading(false);
    }
  }, [swrMessages]);

  useEffect(() => {
    if (!isSWRisLoading && !swrMessages) {
      setIsLoading(false);
    }
  }, [isSWRisLoading, swrMessages]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, recipientFilter, groupFilter]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await getGroups();
        if (res.groups) {
          setGroups(res.groups);
        }
      } catch (err) {
        console.error("Failed to load groups:", err);
      }
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    setAnalyticsTab("overall");
    setSelectedContactId(null);
  }, [viewMessage?.id]);

  const loadMessages = async () => {
    setIsLoading(true);
    mutate("/api/chat/poll?type=drip-scheduler");
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm")))
      return;

    try {
      const res = await deleteScheduledMessage(id);
      if (res.success) {
        toast.success(t("deleteSuccess"));
        loadMessages();
      } else {
        toast.error(res.error || t("deleteFailed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("deleteFailed"));
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      const res = await pauseScheduledMessage(id);
      if (res.success) {
        toast.success("Campaign paused successfully");
        loadMessages();
      } else {
        toast.error(res.error || "Failed to pause campaign");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to pause campaign");
    }
  };

  const handleResumeCampaign = async (id: string) => {
    try {
      const res = await resumeScheduledMessage(id);
      if (res.success) {
        toast.success("Campaign resumed successfully");
        loadMessages();
      } else {
        toast.error(res.error || "Failed to resume campaign");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to resume campaign");
    }
  };

  const handleProcessMessages = async () => {
    setIsRefreshing(true);
    toast.message(t("processingCampaigns"));
    try {
      const res = await processScheduledMessages("DRIP");
      if (res.success) {
        toast.success(t("processSuccess", { count: res.processed }));
        loadMessages();
      } else {
        toast.error(res.error || t("processFailed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("processError"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEdit = (message: ScheduledMessageWithRelations) => {
    router.push(`/${locale}/campaign/edit/${message.id}`);
  };

  const handleExport = async () => {
    try {
      toast.message(t("exportingRecords"));
      const res = await getAllScheduledMessages("DRIP");
      if (res.success && res.data) {
        const exportData = res.data.map((m) => ({
          Recipient: m.contact?.name || m.group?.name || "Unknown",
          Mobile: m.contact ? `+${m.contact.waId}` : "Groups",
          Message: m.content,
          "Scheduled At": format(new Date(m.scheduledAt), "yyyy-MM-dd HH:mm"),
          Status: m.status,
        }));

        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Drip Campaigns");
        XLSX.writeFile(
          wb,
          `drip_campaigns_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
        );
        toast.success(t("exportSuccess"));
      } else {
        toast.error(res.error || t("exportFailed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("exportFailed"));
    }
  };

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.group?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PENDING" && (m.status === "PENDING" || m.status === "PROCESSING")) ||
      (statusFilter === "SENT" && m.status === "SENT") ||
      (statusFilter === "FAILED" && m.status === "FAILED") ||
      (statusFilter === "PAUSED" && m.status === "PAUSED");

    const matchesType =
      typeFilter === "ALL" ||
      (typeFilter === "TEMPLATE" && m.templateName) ||
      (typeFilter === "REGULAR" && !m.templateName);

    const matchesRecipient =
      recipientFilter === "ALL" ||
      (recipientFilter === "CONTACT" && m.contactId && !m.groupId) ||
      (recipientFilter === "GROUP" && m.groupId);

    const matchesGroup =
      groupFilter === "ALL" || m.groupId === groupFilter;

    return matchesSearch && matchesStatus && matchesType && matchesRecipient && matchesGroup;
  });

  const getCampaignRecipients = (message: ScheduledMessageWithRelations) => {
    if (message.contactId && message.contact) {
      return [
        {
          contactId: message.contactId,
          name: message.contact.name,
          waId: message.contact.waId,
        },
      ];
    }

    return (message.group?.contacts || [])
      .map((member) =>
        member.contactId && member.contact
          ? {
            contactId: member.contactId,
            name: member.contact.name,
            waId: member.contact.waId,
          }
          : null,
      )
      .filter(
        (recipient): recipient is { contactId: string; name: string | null; waId: string } =>
          !!recipient,
      );
  };

  const getFallbackAnalytics = (
    message: ScheduledMessageWithRelations,
  ): DripCampaignAnalyticsSummary => {
    const recipients = getCampaignRecipients(message);
    const fallbackStatus =
      message.status === "SENT"
        ? "sent"
        : message.status === "FAILED"
          ? "failed"
          : message.status === "PAUSED"
            ? "paused"
            : "not_sent";
    const sentAt =
      message.status === "SENT"
        ? new Date(message.scheduledAt).toISOString()
        : null;

    return {
      id: message.id,
      recipients: recipients.length,
      sent: message.status === "SENT" ? recipients.length : 0,
      delivered: 0,
      read: 0,
      failed: message.status === "FAILED" ? recipients.length : 0,
      clicked: 0,
      totalClicks: 0,
      deliveryRate: 0,
      readRate: 0,
      clickRate: 0,
      recipientRows: recipients.map((recipient) => ({
        ...recipient,
        messageId: null,
        wamid: null,
        status: fallbackStatus,
        sentAt,
        lastStatusAt: sentAt,
        clickCount: 0,
        clickText: null,
        lastClickedAt: null,
      })),
    };
  };

  const getCampaignMetrics = (message: ScheduledMessageWithRelations) =>
    campaignAnalytics[message.id] || getFallbackAnalytics(message);

  const allCampaignMetrics = messages.map(getCampaignMetrics);
  const performanceStats = {
    recipients: allCampaignMetrics.reduce((sum, metric) => sum + metric.recipients, 0),
    delivered: allCampaignMetrics.reduce((sum, metric) => sum + metric.delivered, 0),
    read: allCampaignMetrics.reduce((sum, metric) => sum + metric.read, 0),
    clicked: allCampaignMetrics.reduce((sum, metric) => sum + metric.clicked, 0),
    deliveryRate: allCampaignMetrics.length
      ? Math.round(
        allCampaignMetrics.reduce((sum, metric) => sum + metric.deliveryRate, 0) /
        allCampaignMetrics.length,
      )
      : 0,
  };

  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) +
    (typeFilter !== "ALL" ? 1 : 0) +
    (recipientFilter !== "ALL" ? 1 : 0) +
    (groupFilter !== "ALL" ? 1 : 0);

  const stats = {
    pending: messages.filter((m) => m.status === "PENDING").length,
    processing: messages.filter((m) => m.status === "PROCESSING").length,
    scheduled: messages.length,
    completed: messages.filter((m) => m.status === "SENT").length,
    failed: messages.filter((m) => m.status === "FAILED").length,
  };

  const selectedAnalytics = viewMessage ? getCampaignMetrics(viewMessage) : null;
  const selectedContactRow =
    selectedAnalytics?.recipientRows.find((row) => row.contactId === selectedContactId) || null;
  const getSingleContactAnalytics = (
    analytics: DripCampaignAnalyticsSummary,
    row: RecipientAnalyticsRow,
  ): DripCampaignAnalyticsSummary => {
    const sent = row.status !== "not_sent" ? 1 : 0;
    const delivered = row.status === "delivered" || row.status === "read" ? 1 : 0;
    const read = row.status === "read" ? 1 : 0;
    const failed = row.status === "failed" ? 1 : 0;
    const clicked = row.clickCount > 0 ? 1 : 0;

    return {
      ...analytics,
      recipients: 1,
      sent,
      delivered,
      read,
      failed,
      clicked,
      totalClicks: row.clickCount,
      deliveryRate: delivered ? 100 : 0,
      readRate: read ? 100 : 0,
      clickRate: clicked ? 100 : 0,
      recipientRows: [row],
    };
  };
  const displayedAnalytics =
    selectedAnalytics && selectedContactRow
      ? getSingleContactAnalytics(selectedAnalytics, selectedContactRow)
      : selectedAnalytics;
  const recipientRowsSource = selectedContactRow
    ? [selectedContactRow]
    : selectedAnalytics?.recipientRows || [];
  const selectedRecipientRows = recipientRowsSource.filter((row) => {
    if (analyticsTab === "delivered") return row.status === "delivered" || row.status === "read";
    if (analyticsTab === "read") return row.status === "read";
    if (analyticsTab === "clicked") return row.clickCount > 0;
    return true;
  });

  const getRecipientStatusLabel = (status: string) => {
    if (status === "read") return t("readSeen");
    if (status === "delivered") return t("delivered");
    if (status === "sent") return t("sent");
    if (status === "failed") return t("failed");
    if (status === "paused") return "Paused";
    return t("notSentYet");
  };

  const getRecipientStatusClass = (status: string) => {
    if (status === "read") return "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40";
    if (status === "delivered") return "bg-emerald-50 text-[#00B074] border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40";
    if (status === "sent") return "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40";
    if (status === "failed") return "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40";
    if (status === "paused") return "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40";
    return "bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:border-slate-700";
  };

  const getCampaignRowAssets = (index: number) => {
    const assets = [
      {
        bg: "bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074]",
        icon: <Send className="w-4 h-4" />,
      },
      {
        bg: "bg-purple-50 dark:bg-purple-950/20 text-purple-500",
        icon: <Megaphone className="w-4 h-4" />,
      },
      {
        bg: "bg-amber-50 dark:bg-amber-950/20 text-amber-500",
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        bg: "bg-rose-50 dark:bg-rose-950/20 text-rose-500",
        icon: <Play className="w-4 h-4" />,
      },
      {
        bg: "bg-blue-50 dark:bg-blue-950/20 text-blue-500",
        icon: <Clock className="w-4 h-4" />,
      },
      {
        bg: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500",
        icon: <Users className="w-4 h-4" />,
      },
      {
        bg: "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-450",
        icon: <Sparkles className="w-4 h-4" />,
      },
      {
        bg: "bg-violet-50 dark:bg-violet-950/20 text-violet-500",
        icon: <AlertCircle className="w-4 h-4" />,
      },
      {
        bg: "bg-orange-50 dark:bg-orange-950/20 text-orange-500",
        icon: <Clock className="w-4 h-4" />,
      },
      {
        bg: "bg-teal-50 dark:bg-teal-950/20 text-teal-500",
        icon: <User className="w-4 h-4" />,
      },
    ];
    return assets[index % assets.length];
  };

  const totalPages = Math.ceil(filteredMessages.length / pageSize);
  const paginatedMessages = filteredMessages.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-[#0B0F1A] min-h-screen relative overflow-x-hidden transition-colors duration-300 pb-20 plus-jakarta-forced">
      {/* ambient background blobs */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-emerald-500/5 rounded-full blur-[130px] pointer-events-none -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-0 left-0 w-[650px] h-[650px] bg-blue-500/5 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse duration-[10000ms]" />

      <div className="max-w-[1400px] mx-auto space-y-8 px-4 md:px-8 pt-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
              {t("title")}
            </h2>
            <p className="text-slate-505 dark:text-slate-400 font-bold text-sm">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {canCreate && (
              <div className={`inline-flex items-center rounded-xl bg-[#00B074] shadow-[0_8px_20px_-4px_rgba(0,176,116,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all ${isCampaignLimitReached ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                <Button
                  onClick={() => !isCampaignLimitReached && router.push(`/${locale}/campaign/create`)}
                  disabled={isCampaignLimitReached}
                  className="bg-transparent hover:bg-transparent text-white font-extrabold h-11 pl-5 pr-3 rounded-l-xl text-xs cursor-pointer flex items-center gap-2   "
                >
                  <Plus className="w-4.5 h-4.5" />
                  {t("newCampaign")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {isCampaignLimitReached && campaignQuota && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full shadow-sm animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Campaign Limit Reached</h4>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5 font-medium">
                  You have used {campaignQuota.current}/{campaignQuota.limit} campaigns. Please upgrade your subscription plan to create more campaigns.
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/dashboard/billing')}
              className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shrink-0 transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
            >
              Upgrade Plan
            </Button>
          </div>
        )}

        {/* WhatsApp Channel Broadcast Mode Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center font-black shrink-0 shadow-sm",
              isQrConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : isApiConnected
                  ? "bg-[#00B074]/10 text-[#00B074] border border-[#00B074]/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
            )}>
              {isQrConnected ? <QrCode className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {isQrConnected
                    ? "WhatsApp QR Connection Active"
                    : isApiConnected
                      ? "WhatsApp Cloud API Connection Active"
                      : "WhatsApp Channel Not Connected"}
                </h4>
                <span className={cn(
                  "text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider",
                  whatsappConnected
                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                )}>
                  {whatsappConnected ? (isQrConnected ? "● QR Broadcast Active" : "● Template Broadcast Active") : "● Disconnected"}
                </span>
                {whatsappNumber && (
                  <span className="text-[10.5px] font-bold text-slate-400 font-mono">
                    +{whatsappNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-relaxed">
                {isQrConnected
                  ? "Your number is paired via QR Code. Direct QR Broadcasts (custom text, media & buttons) are enabled without Meta template approval restrictions."
                  : isApiConnected
                    ? "Your number is connected via Official Meta Cloud API. Template Broadcasts with approved Meta templates are active."
                    : "Connect your WhatsApp number in Settings (via QR Code or Official Cloud API) to start broadcasting."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => router.push(`/${locale}/campaign/create`)}
              className="h-10 px-4.5 rounded-xl text-xs font-extrabold bg-[#00B074] hover:bg-[#009B66] text-white shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isQrConnected ? "New QR Broadcast" : "New Campaign"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {/* Total Campaigns */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                {t("totalCampaigns")}
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-[#00B074] shrink-0">
                <Users className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="flex items-end gap-3 mt-4">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">
                {stats.scheduled}
              </span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] text-[9.5px] font-black leading-none">

              </div>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 block">
              {t("vsLast30Days")}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                {t("completed")}
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-500 shrink-0">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="flex items-end gap-3 mt-4">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">
                {stats.completed}
              </span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] text-[9.5px] font-black leading-none">

              </div>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 block">
              {t("vsLast30Days")}
            </span>
          </div>

          {/* In Progress */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                {t("inProgress")}
              </span>
              <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-500 shrink-0 animate-pulse">
                <Clock className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="flex items-end gap-3 mt-4">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">
                {stats.processing}
              </span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 text-[9.5px] font-black leading-none">


              </div>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 block">
              {t("vsLast30Days")}
            </span>
          </div>

          {/* Scheduled */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">
                {t("scheduled")}
              </span>
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-505 shrink-0">
                <Calendar className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="flex items-end gap-3 mt-4">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white leading-none">
                {stats.pending}
              </span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] text-[9.5px] font-black leading-none">

              </div>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 block">
              {t("vsLast30Days")}
            </span>
          </div>

          {/* Avg. Delivery Rate */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col hover:scale-[1.02] transition-all duration-300 min-h-[150px]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block leading-snug max-w-[8.5rem]">
                {t("avgDeliveryRate")}
              </span>
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-[#00B074] shrink-0">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white leading-none">
                {performanceStats.deliveryRate}%
              </span>
              <span className="text-[10px] font-black text-[#00B074] bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-full whitespace-nowrap">
                {performanceStats.delivered}/{performanceStats.recipients || 0}
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00B074]"
                style={{ width: `${performanceStats.deliveryRate}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">
                  {performanceStats.delivered}
                </p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">
                  {t("delivered")}
                </p>
              </div>
              <div className="min-w-0 px-2 border-l border-slate-100 dark:border-slate-800">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">
                  {performanceStats.read}
                </p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">
                  {t("readSeen")}
                </p>
              </div>
              <div className="min-w-0 pl-2 border-l border-slate-100 dark:border-slate-800">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">
                  {performanceStats.clicked}
                </p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">
                  {t("clicked")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t("searchCampaigns")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 h-11 w-full rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 focus:ring-emerald-500/20 transition-all font-bold text-sm text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 px-4.5 rounded-xl border-slate-200 bg-white font-bold text-xs text-slate-700 hover:bg-slate-50 data-[state=open]:bg-slate-50 dark:!border-slate-800/80 dark:!bg-slate-900 dark:!text-slate-300 dark:hover:!bg-slate-800 dark:data-[state=open]:!bg-slate-900 flex items-center gap-2 cursor-pointer"
                >
                  <span>
                    {recipientFilter === "ALL"
                      ? t("allCampaigns")
                      : recipientFilter === "CONTACT"
                        ? t("singleContact")
                        : t("groupCampaign")}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl plus-jakarta-forced">
                <DropdownMenuRadioGroup
                  value={recipientFilter}
                  onValueChange={setRecipientFilter}
                >
                  <DropdownMenuRadioItem
                    value="ALL"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("allCampaigns")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="CONTACT"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("singleContact")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="GROUP"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("groupCampaign")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 px-4.5 rounded-xl border-slate-200 bg-white font-bold text-xs text-slate-700 hover:bg-slate-50 data-[state=open]:bg-slate-50 dark:!border-slate-800/80 dark:!bg-slate-900 dark:!text-slate-300 dark:hover:!bg-slate-800 dark:data-[state=open]:!bg-slate-900 flex items-center gap-2 cursor-pointer"
                >
                  <span>
                    {statusFilter === "ALL"
                      ? t("allStatus")
                      : statusFilter === "SENT"
                        ? t("completed")
                        : statusFilter === "PENDING"
                          ? t("inProgress")
                          : statusFilter === "PAUSED"
                            ? "Paused"
                            : t("failed")}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl plus-jakarta-forced">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <DropdownMenuRadioItem
                    value="ALL"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("allStatus")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="SENT"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("completed")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="PENDING"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("inProgress")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="PAUSED"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    Paused
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="FAILED"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("failed")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 px-4.5 rounded-xl border-slate-200 bg-white font-bold text-xs text-slate-700 hover:bg-slate-50 data-[state=open]:bg-slate-50 dark:!border-slate-800/80 dark:!bg-slate-900 dark:!text-slate-300 dark:hover:!bg-slate-800 dark:data-[state=open]:!bg-slate-900 flex items-center gap-2 cursor-pointer"
                >
                  <span>
                    {groupFilter === "ALL"
                      ? "All Groups"
                      : groups.find((g) => g.id === groupFilter)?.name || "Selected Group"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl plus-jakarta-forced">
                <DropdownMenuRadioGroup
                  value={groupFilter}
                  onValueChange={setGroupFilter}
                >
                  <DropdownMenuRadioItem
                    value="ALL"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    All Groups
                  </DropdownMenuRadioItem>
                  {groups.map((group) => (
                    <DropdownMenuRadioItem
                      key={group.id}
                      value={group.id}
                      className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                    >
                      {group.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-11 px-4.5 rounded-xl border-slate-200 bg-white font-bold text-xs dark:!border-slate-800/80 dark:!bg-slate-900 flex items-center gap-2 cursor-pointer",
                    activeFiltersCount > 0
                      ? "!bg-emerald-50 text-emerald-700 border-[#00B074]/30 hover:!bg-emerald-100 dark:!bg-emerald-950/30 dark:!text-emerald-300 dark:hover:!bg-emerald-950/40"
                      : "text-slate-700 hover:bg-slate-50 data-[state=open]:bg-slate-50 dark:!text-slate-300 dark:hover:!bg-slate-800 dark:data-[state=open]:!bg-slate-900",
                  )}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{t("filters")}</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4.5 h-4.5 rounded-full bg-[#00B074] text-white flex items-center justify-center text-[9px] font-black">
                      {activeFiltersCount}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl plus-jakarta-forced">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1 px-3 py-1.5">
                  {t("messageType")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                >
                  <DropdownMenuRadioItem
                    value="ALL"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("allTypes")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="TEMPLATE"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("templates")}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="REGULAR"
                    className="text-xs font-bold cursor-pointer rounded-lg py-2 text-slate-700 dark:text-slate-300 dark:focus:text-slate-100"
                  >
                    {t("regular")}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {activeFiltersCount > 0 && (
                  <>
                    <DropdownMenuSeparator className="my-1.5 opacity-50" />
                    <DropdownMenuItem
                      onClick={() => {
                        setStatusFilter("ALL");
                        setTypeFilter("ALL");
                        setRecipientFilter("ALL");
                        setGroupFilter("ALL");
                      }}
                      className="text-xs font-black text-rose-600 focus:text-rose-600 cursor-pointer justify-center rounded-lg py-2"
                    >
                      {t("clearFilters")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[400px]">
              <div className="w-20 h-20 rounded-[24px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
                <Calendar className="w-9 h-9 text-slate-305 dark:text-slate-650" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">
                {search ? t("noMatchesFound") : t("noCampaigns")}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm font-bold text-sm mb-8">
                {search
                  ? t("tryDifferentSearch")
                  : t("noCampaignsDesc")}
              </p>
              {!search && (
                <Button
                  onClick={() => !isCampaignLimitReached && router.push(`/${locale}/campaign/create`)}
                  disabled={isCampaignLimitReached}
                  className={`bg-[#00B074] hover:bg-[#009662] text-white font-black h-11 px-10 rounded-xl text-xs transition-all shadow-lg shadow-[#00B074]/20 border-b-2 border-[#009662] ${isCampaignLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t("createFirstCampaign")}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap align-middle">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 font-sans">
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {t("tableCampaign")}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {t("tableType")}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {t("tableStatus")}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {t("tableRecipients")}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {t("tableDeliveryRate")}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {t("tableCreatedOn")}
                    </th>
                    <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right pr-8 font-sans">
                      {t("tableActions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedMessages.map((m, idx) => {
                    const rowAssets = getCampaignRowAssets(idx);
                    const isBroadcast = m.templateName ? true : false;
                    const isAutomation = m.groupId ? true : false;
                    const campaignMetrics = getCampaignMetrics(m);
                    const recCount = campaignMetrics.recipients || m.group?.contacts?.length || 1;
                    const deliveryVal = `${campaignMetrics.deliveryRate}%`;
                    const deliveryWidth = `${campaignMetrics.deliveryRate}%`;

                    return (
                      <tr
                        key={m.id}
                        onClick={() => router.push(`/${locale}/campaign/stats/${m.id}`)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group h-20 cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                rowAssets.bg,
                              )}
                            >
                              {rowAssets.icon}
                            </div>
                            <div className="min-w-0 max-w-[200px]">
                              <p className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight truncate">
                                {m.templateName ||
                                  m.contact?.name ||
                                  m.group?.name ||
                                  `Campaign #${m.id.substring(0, 5)}`}
                              </p>
                              {m.groupId && m.group?.name && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-500 font-extrabold mt-0.5 flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 shrink-0" />
                                  <span>{m.group.name}</span>
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 dark:text-slate-505 font-bold mt-0.5 truncate max-w-[190px]">
                                {m.content}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* TYPE */}
                        <td className="px-6 py-4">
                          {isAutomation ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 text-[10px] font-black tracking-wide">
                              {t("typeAutomation")}
                            </span>
                          ) : isBroadcast ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] text-[10px] font-black tracking-wide">
                              {t("typeBroadcast")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-600 text-[10px] font-black tracking-wide">
                              {t("typeScheduled")}
                            </span>
                          )}
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 w-fit">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                m.status === "SENT"
                                  ? "bg-[#00B074]"
                                  : m.status === "PAUSED"
                                    ? "bg-amber-500"
                                    : (m.status === "PENDING" || m.status === "PROCESSING")
                                      ? "bg-blue-500 animate-pulse"
                                      : "bg-rose-550",
                              )}
                            />
                            <span
                              className={cn(
                                "text-[11px] font-extrabold capitalize leading-none",
                                m.status === "SENT"
                                  ? "text-[#00B074]"
                                  : m.status === "PAUSED"
                                    ? "text-amber-600 dark:text-amber-500"
                                    : (m.status === "PENDING" || m.status === "PROCESSING")
                                      ? "text-blue-600 dark:text-blue-450"
                                      : "text-rose-650",
                              )}
                            >
                              {m.status === "SENT"
                                ? t("completed")
                                : m.status === "PAUSED"
                                  ? "Paused"
                                  : (m.status === "PENDING" || m.status === "PROCESSING")
                                    ? t("inProgress")
                                    : t("failed")}
                            </span>
                          </div>
                        </td>

                        {/* RECIPIENTS */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">
                              {recCount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {t("sentCount", { count: campaignMetrics.sent })}
                            </span>
                          </div>
                        </td>

                        {/* DELIVERY RATE */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col w-28">
                            <span className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">
                              {deliveryVal}
                            </span>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  campaignMetrics.deliveryRate > 0
                                    ? "bg-[#00B074]"
                                    : m.status === "PENDING"
                                      ? "bg-blue-500"
                                      : "bg-slate-350"
                                )}
                                style={{ width: deliveryWidth }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* CREATED ON */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-855 dark:text-slate-205 leading-tight">
                              {format(new Date(m.scheduledAt), "dd MMM yyyy")}
                            </span>
                            <span className="text-[10.5px] text-slate-400 font-bold mt-0.5">
                              {format(new Date(m.scheduledAt), "hh:mm a")}
                            </span>
                          </div>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-6 py-4 text-right pr-8" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/${locale}/campaign/stats/${m.id}`)}
                              className="h-9 w-9 rounded-full text-slate-400 hover:text-slate-655 dark:hover:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                              title={t("viewDetails")}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-full text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                                >
                                  <MoreVertical className="w-4.5 h-4.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1 shadow-xl plus-jakarta-forced"
                              >
                                <DropdownMenuItem
                                  className="text-slate-700 dark:text-slate-205 font-bold text-xs cursor-pointer rounded-xl px-3 py-2 flex items-center gap-2"
                                  onClick={() => router.push(`/${locale}/campaign/stats/${m.id}`)}
                                >
                                  <Eye className="w-4 h-4 text-slate-400" />
                                  {t("viewDetails")}
                                </DropdownMenuItem>
                                {canEdit && (
                                  <DropdownMenuItem
                                    className="text-amber-600 font-bold text-xs cursor-pointer rounded-xl px-3 py-2 flex items-center gap-2"
                                    onClick={() => handleEdit(m)}
                                  >
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    {t("editCampaign")}
                                  </DropdownMenuItem>
                                )}
                                {(m.status === "PENDING" || m.status === "PROCESSING" || m.status === "FAILED") && canEdit && (
                                  <DropdownMenuItem
                                    className="text-amber-600 font-bold text-xs cursor-pointer rounded-xl px-3 py-2 flex items-center gap-2"
                                    onClick={() => handlePauseCampaign(m.id)}
                                  >
                                    <Pause className="w-4 h-4 text-amber-500" />
                                    Pause Campaign
                                  </DropdownMenuItem>
                                )}
                                {m.status === "PAUSED" && canEdit && (
                                  <DropdownMenuItem
                                    className="text-emerald-600 font-bold text-xs cursor-pointer rounded-xl px-3 py-2 flex items-center gap-2"
                                    onClick={() => handleResumeCampaign(m.id)}
                                  >
                                    <Play className="w-4 h-4 text-emerald-550" />
                                    Resume Campaign
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <DropdownMenuItem
                                    className="text-rose-600 font-bold text-xs cursor-pointer rounded-xl px-3 py-2 flex items-center gap-2"
                                    onClick={() => handleDelete(m.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-500" />
                                    {t("remove")}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination footer precisely matching mock */}
              <div className="flex items-center justify-between px-6 py-4.5 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-400 font-bold">
                  {t("showingCampaigns", {
                    start: (currentPage - 1) * pageSize + 1,
                    end: Math.min(currentPage * pageSize, filteredMessages.length),
                    total: filteredMessages.length,
                  })}
                </span>
                <div className="flex items-center gap-3">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalRecords={filteredMessages.length}
                    pageSize={pageSize}
                  />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-500">
                    <span>{t("perPage", { count: pageSize })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportDripCampaignsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadMessages}
      />

      {/* View Details Dialog */}
      <Dialog
        open={!!viewMessage}
        onOpenChange={(open) => {
          if (!open) {
            setViewMessage(null);
            setSelectedContactId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0 gap-0 bg-white dark:bg-slate-900 border-none rounded-[2rem] shadow-2xl overflow-hidden [&>button:first-of-type]:hidden plus-jakarta-forced">
          {viewMessage && (
            <>
              <div
                className={cn(
                  "px-6 py-6 flex items-center gap-4 text-white border-b-2",
                  viewMessage.status === "SENT"
                    ? "bg-[#00B074] border-emerald-600"
                    : viewMessage.status === "FAILED"
                      ? "bg-rose-500 border-rose-600"
                      : "bg-amber-500 border-amber-600",
                )}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  {viewMessage.contact ? (
                    <User className="w-6 h-6 text-white" />
                  ) : (
                    <Users className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-extrabold text-white truncate">
                    {viewMessage.contact?.name ||
                      viewMessage.group?.name ||
                      t("noMatchesFound")}
                  </DialogTitle>
                  <p className="text-white/80 text-xs font-bold mt-0.5">
                    {viewMessage.contact
                      ? `+${viewMessage.contact.waId}`
                      : t("groupCampaign")}
                  </p>
                </div>
                <div className="ml-auto shrink-0">
                  {viewMessage.status === "SENT" && (
                    <CheckCircle2 className="w-8 h-8 text-white/90" />
                  )}
                  {viewMessage.status === "FAILED" && (
                    <XCircle className="w-8 h-8 text-white/90" />
                  )}
                  {(viewMessage.status === "PENDING" || viewMessage.status === "PROCESSING") && (
                    <AlertCircle className="w-8 h-8 text-white/90" />
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {t("campaignStatus")}
                  </span>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border leading-none",
                      (viewMessage.status === "PENDING" || viewMessage.status === "PROCESSING")
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : viewMessage.status === "SENT"
                          ? "bg-emerald-500/10 text-emerald-655 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 border-rose-500/20",
                    )}
                  >
                    {viewMessage.status === "SENT"
                      ? t("completed")
                      : (viewMessage.status === "PENDING" || viewMessage.status === "PROCESSING")
                        ? t("inProgress")
                        : t("failed")}
                  </span>
                </div>

                <CampaignLiveProgress campaignId={viewMessage.id} />

                {displayedAnalytics && selectedAnalytics && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                            {selectedContactRow ? t("contactAnalysis") : t("campaignPerformance")}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {selectedContactRow
                              ? `${selectedContactRow.name || t("noMatchesFound")} - +${selectedContactRow.waId}`
                              : t("trackedAfterRun")}
                          </p>
                        </div>
                      </div>
                      {selectedContactRow && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContactId(null);
                            setAnalyticsTab("overall");
                          }}
                          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
                        >
                          {t("overall")}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3">
                        <Users className="w-4 h-4 text-slate-400 mb-2" />
                        <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                          {displayedAnalytics.recipients}
                        </p>
                        <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          {t("recipients")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/60 dark:bg-indigo-950/20 p-3">
                        <Send className="w-4 h-4 text-indigo-500 mb-2" />
                        <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                          {displayedAnalytics.sent}
                        </p>
                        <p className="text-[9.5px] font-black text-indigo-500 uppercase tracking-widest mt-1">
                          {t("sent")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
                        <CheckCheck className="w-4 h-4 text-[#00B074] mb-2" />
                        <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                          {displayedAnalytics.delivered}
                        </p>
                        <p className="text-[9.5px] font-black text-[#00B074] uppercase tracking-widest mt-1">
                          {t("delivered")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-950/20 p-3">
                        <Eye className="w-4 h-4 text-blue-500 mb-2" />
                        <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                          {displayedAnalytics.read}
                        </p>
                        <p className="text-[9.5px] font-black text-blue-500 uppercase tracking-widest mt-1">
                          {t("readSeen")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                        <MousePointerClick className="w-4 h-4 text-amber-500 mb-2" />
                        <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-none">
                          {displayedAnalytics.clicked}
                        </p>
                        <p className="text-[9.5px] font-black text-amber-500 uppercase tracking-widest mt-1">
                          {t("clicked")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "overall" as const, label: t("overall"), count: displayedAnalytics.recipients },
                        { key: "delivered" as const, label: t("delivered"), count: displayedAnalytics.delivered },
                        { key: "read" as const, label: t("readSeen"), count: displayedAnalytics.read },
                        { key: "clicked" as const, label: t("clicked"), count: displayedAnalytics.clicked },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setAnalyticsTab(item.key)}
                          className={cn(
                            "h-9 px-3 rounded-xl border text-[11px] font-black flex items-center gap-2 transition-all",
                            analyticsTab === item.key
                              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white",
                          )}
                        >
                          <span>{item.label}</span>
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 flex items-center justify-center">
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      {selectedRecipientRows.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                          {t("noRecipientsForStatus")}
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedRecipientRows.map((row) => (
                            <button
                              key={row.contactId}
                              type="button"
                              onClick={() => {
                                setSelectedContactId(row.contactId);
                                setAnalyticsTab("overall");
                              }}
                              className={cn(
                                "w-full px-4 py-3 flex items-center justify-between gap-4 text-left transition-colors",
                                selectedContactId === row.contactId
                                  ? "bg-indigo-50/80 dark:bg-indigo-950/30"
                                  : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60",
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                  {row.name || t("noMatchesFound")}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold font-mono truncate">
                                  +{row.waId}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider",
                                    getRecipientStatusClass(row.status),
                                  )}
                                >
                                  {getRecipientStatusLabel(row.status)}
                                </span>
                                {row.clickCount > 0 && (
                                  <span className="text-[10px] font-bold text-amber-500">
                                    {t("clicksCount", { count: row.clickCount })}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMessage.templateName && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                      {t("template")}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-350 text-right">
                      {viewMessage.templateName}
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                    {t("platform")}
                  </span>
                  <span className="text-sm font-bold text-slate-750 dark:text-slate-300 text-right uppercase tracking-widest text-[11px]">
                    {viewMessage.platform}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {t("messageContent")}
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-medium border border-slate-100 dark:border-slate-800">
                    {viewMessage.content}
                  </div>
                </div>

                {viewMessage.mediaUrl && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                      {t("media")}
                    </span>
                    {viewMessage.mediaUrl.match(
                      /\.(jpg|jpeg|png|gif|webp)$/i,
                    ) ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(viewMessage.mediaUrl)}
                        className="flex items-center gap-1.5 text-emerald-650 text-xs font-bold hover:underline truncate max-w-[200px]"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        {viewMessage.mediaUrl.split("/").pop()?.split("?")[0] ||
                          t("viewDetails")}
                      </button>
                    ) : (
                      <a
                        href={viewMessage.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-emerald-655 text-xs font-bold hover:underline truncate max-w-[200px]"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        {viewMessage.mediaUrl.split("/").pop()?.split("?")[0] ||
                          t("viewDetails")}
                      </a>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {t("launchTime")}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                      {format(new Date(viewMessage.scheduledAt), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      {format(new Date(viewMessage.scheduledAt), "hh:mm a")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3 flex-wrap">
                {viewMessage.status === "PENDING" && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-amber-605 border-amber-200 hover:bg-amber-50 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest transition-all"
                    onClick={() => {
                      setViewMessage(null);
                      handleEdit(viewMessage);
                    }}
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    {t("edit")}
                  </Button>
                )}
                {(viewMessage.status === "PENDING" || viewMessage.status === "PROCESSING" || viewMessage.status === "FAILED") && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest transition-all"
                    onClick={() => {
                      setViewMessage(null);
                      handlePauseCampaign(viewMessage.id);
                    }}
                  >
                    <Pause className="w-3.5 h-3.5 mr-1.5" />
                    Pause
                  </Button>
                )}
                {viewMessage.status === "PAUSED" && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest transition-all"
                    onClick={() => {
                      setViewMessage(null);
                      handleResumeCampaign(viewMessage.id);
                    }}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    Resume
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest transition-all"
                    onClick={() => {
                      setViewMessage(null);
                      handleDelete(viewMessage.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {t("delete")}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest transition-all"
                  onClick={() => setViewMessage(null)}
                >
                  {t("close")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {previewImageUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative max-w-3xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-2 flex flex-col items-center justify-center overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute right-4 top-4 z-50 p-2 rounded-full bg-white text-black hover:bg-slate-100 transition-all shadow-md hover:scale-105 active:scale-[0.95] cursor-pointer"
            >
              <X className="w-5 h-5 text-black" />
            </button>
            <div className="p-2 flex items-center justify-center w-full h-full">
              <img
                src={previewImageUrl}
                alt="Preview"
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-lg border border-white/5"
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayoutClient>
  );
}
