"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Send,
  Eye,
  AlertCircle,
  Paperclip,
  CheckCheck,
  MousePointerClick,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  Info,
  BarChart3,
  MessageSquare,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import WatiBotLoader from "@/components/WatiBotLoader";
import Link from "next/link";
import CampaignLiveProgress from "@/components/campaign/CampaignLiveProgress";

type AnalyticsTab = "overall" | "delivered" | "read" | "clicked" | "failed";

export default function CampaignStatsPage() {
  const t = useTranslations("CampaignsPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Tabs state
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overall");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await getSingleCampaignStats(id);
      if (res.success && res.campaign) {
        setData(res);
        setError(null);
      } else {
        setError(res.error || "Failed to load campaign analytics.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const res = await pauseScheduledMessage(id);
      if (res.success) {
        toast.success("Campaign paused successfully");
        const updatedStats = await getSingleCampaignStats(id);
        if (updatedStats.success && updatedStats.campaign) {
          setData(updatedStats);
        }
      } else {
        toast.error(res.error || "Failed to pause campaign");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to pause campaign");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const res = await resumeScheduledMessage(id);
      if (res.success) {
        toast.success("Campaign resumed successfully");
        const updatedStats = await getSingleCampaignStats(id);
        if (updatedStats.success && updatedStats.campaign) {
          setData(updatedStats);
        }
      } else {
        toast.error(res.error || "Failed to resume campaign");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to resume campaign");
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchStats();
    }
  }, [id]);

  const campaign = data?.campaign;
  const analytics = data?.analytics;

  // Build recipients list
  const getCampaignRecipients = () => {
    if (!campaign) return [];
    if (campaign.contactId && campaign.contact) {
      return [
        {
          contactId: campaign.contactId,
          name: campaign.contact.name,
          waId: campaign.contact.waId,
        },
      ];
    }

    return (campaign.group?.contacts || [])
      .map((member: any) =>
        member.contactId && member.contact
          ? {
              contactId: member.contactId,
              name: member.contact.name,
              waId: member.contact.waId,
            }
          : null
      )
      .filter((recipient: any): recipient is { contactId: string; name: string | null; waId: string } => !!recipient);
  };

  const getFallbackAnalytics = () => {
    if (!campaign) return null;
    const recipients = getCampaignRecipients();
    const fallbackStatus =
      campaign.status === "SENT"
        ? "sent"
        : campaign.status === "FAILED"
        ? "failed"
        : campaign.status === "PAUSED"
        ? "paused"
        : "not_sent";
    const sentAt =
      campaign.status === "SENT"
        ? new Date(campaign.scheduledAt).toISOString()
        : null;

    return {
      id: campaign.id,
      recipients: recipients.length,
      sent: campaign.status === "SENT" ? recipients.length : 0,
      delivered: 0,
      read: 0,
      failed: campaign.status === "FAILED" ? recipients.length : 0,
      clicked: 0,
      totalClicks: 0,
      deliveryRate: 0,
      readRate: 0,
      clickRate: 0,
      firstSentAt: sentAt,
      lastSentAt: sentAt,
      executionDurationMs: 0,
      formattedDuration: "0s",
      recipientRows: recipients.map((recipient: any) => ({
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

  const activeAnalytics = analytics || getFallbackAnalytics();

  // Selected contact details
  const selectedContactRow = useMemo(() => {
    if (!activeAnalytics || !selectedContactId) return null;
    return activeAnalytics.recipientRows.find((row: any) => row.contactId === selectedContactId) || null;
  }, [activeAnalytics, selectedContactId]);

  // Recipient status tags helper
  const getRecipientStatusLabel = (status: string) => {
    if (status === "read") return t("readSeen") || "Read";
    if (status === "delivered") return t("delivered") || "Delivered";
    if (status === "sent") return t("sent") || "Sent";
    if (status === "failed") return t("failed") || "Failed";
    if (status === "paused") return "Paused";
    return t("notSentYet") || "Pending";
  };

  const getRecipientStatusClass = (status: string) => {
    if (status === "read") return "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40";
    if (status === "delivered") return "bg-emerald-50 text-[#00B074] border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40";
    if (status === "sent") return "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40";
    if (status === "failed") return "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40";
    if (status === "paused") return "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40";
    return "bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:border-slate-700";
  };

  // Filtered recipients rows
  const filteredRecipientRows = useMemo(() => {
    if (!activeAnalytics) return [];
    return activeAnalytics.recipientRows.filter((row: any) => {
      const matchesSearch =
        (row.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.waId.includes(searchQuery);

      const matchesTab =
        analyticsTab === "overall" ||
        (analyticsTab === "delivered" && (row.status === "delivered" || row.status === "read")) ||
        (analyticsTab === "read" && row.status === "read") ||
        (analyticsTab === "clicked" && row.clickCount > 0) ||
        (analyticsTab === "failed" && row.status === "failed");

      return matchesSearch && matchesTab;
    });
  }, [activeAnalytics, searchQuery, analyticsTab]);

  // Chart statistics data
  const chartData = useMemo(() => {
    if (!activeAnalytics) return [];
    return [
      { name: "Sent", count: activeAnalytics.sent, fill: "#6366f1" },
      { name: "Delivered", count: activeAnalytics.delivered, fill: "#10b981" },
      { name: "Read", count: activeAnalytics.read, fill: "#3b82f6" },
      { name: "Clicked", count: activeAnalytics.clicked, fill: "#f59e0b" },
      { name: "Failed", count: activeAnalytics.failed, fill: "#ef4444" },
    ];
  }, [activeAnalytics]);

  const pieChartData = useMemo(() => {
    if (!activeAnalytics) return [];
    const deliveredCount = activeAnalytics.delivered - activeAnalytics.read;
    return [
      { name: "Read", value: activeAnalytics.read, fill: "#3b82f6" },
      { name: "Delivered (Unread)", value: Math.max(0, deliveredCount), fill: "#10b981" },
      { name: "Sent Only", value: Math.max(0, activeAnalytics.sent - activeAnalytics.delivered), fill: "#6366f1" },
      { name: "Failed", value: activeAnalytics.failed, fill: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [activeAnalytics]);

  if (isLoading) {
    return <WatiBotLoader fullScreen={true} />;
  }

  if (error || !campaign) {
    return (
      <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-[#0B0F1A] min-h-screen pt-12 plus-jakarta-forced">
        <div className="max-w-md mx-auto text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Error Loading Stats</h3>
          <p className="text-sm text-slate-500">{error || "Campaign not found"}</p>
          <Button onClick={() => router.push(`/${locale}/campaign`)} className="bg-[#00B074] hover:bg-[#009662] text-white rounded-xl">
            Go Back to Campaigns
          </Button>
        </div>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-[#0B0F1A] min-h-screen relative overflow-x-hidden transition-colors duration-300 pb-20 plus-jakarta-forced">
      {/* Ambient background blur */}
      <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-[1400px] mx-auto space-y-8 px-4 md:px-8 pt-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/${locale}/campaign`)}
              className="h-10 w-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 text-slate-600 dark:text-slate-350 cursor-pointer shadow-sm shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {campaign.templateName || campaign.contact?.name || campaign.group?.name || "Campaign Details"}
                </h2>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none",
                    campaign.status === "PAUSED"
                      ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50"
                      : (campaign.status === "SENT" && activeAnalytics.sent >= activeAnalytics.recipients)
                      ? "bg-emerald-50 text-[#00B074] border-emerald-200"
                      : (campaign.status === "SENT" && activeAnalytics.sent < activeAnalytics.recipients)
                      ? "bg-amber-50 text-amber-600 border-amber-200"
                      : (campaign.status === "PENDING" || campaign.status === "PROCESSING")
                      ? "bg-blue-50 text-blue-600 border-blue-200 animate-pulse"
                      : "bg-rose-50 text-rose-600 border-rose-200"
                  )}
                >
                  {campaign.status === "PAUSED"
                    ? "Paused"
                    : (campaign.status === "SENT" && activeAnalytics.sent >= activeAnalytics.recipients)
                    ? "Completed"
                    : (campaign.status === "SENT" && activeAnalytics.sent < activeAnalytics.recipients)
                    ? `Incomplete (${activeAnalytics.sent}/${activeAnalytics.recipients} Dispatched)`
                    : (campaign.status === "PENDING" || campaign.status === "PROCESSING")
                    ? "Running"
                    : "Failed"}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-[12px] text-slate-400 font-bold">
                <p className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Scheduled for {format(new Date(campaign.scheduledAt), "dd MMM yyyy 'at' hh:mm a")}
                </p>
                {activeAnalytics?.formattedDuration && activeAnalytics.formattedDuration !== 'N/A' && (
                  <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-[11px] font-extrabold">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    Time Consumed: {activeAnalytics.formattedDuration}
                    {activeAnalytics.firstSentAt && activeAnalytics.lastSentAt && (
                      <span className="text-[10px] text-emerald-600/70 font-normal">
                        ({format(new Date(activeAnalytics.firstSentAt), "hh:mm:ss a")} - {format(new Date(activeAnalytics.lastSentAt), "hh:mm:ss a")})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons: Pause / Resume */}
          <div className="flex items-center gap-2">
            {campaign.status === "PAUSED" && (
              <Button
                onClick={handleResume}
                disabled={isActionLoading}
                className="bg-[#00B074] hover:bg-[#009662] text-white rounded-xl font-bold text-xs flex items-center gap-2 h-9 px-4 cursor-pointer shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Resume Campaign
              </Button>
            )}
            {(campaign.status === "PENDING" || campaign.status === "PROCESSING") && (
              <Button
                onClick={handlePause}
                disabled={isActionLoading}
                variant="outline"
                className="border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl font-bold text-xs flex items-center gap-2 h-9 px-4 cursor-pointer shadow-sm"
              >
                <Pause className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                Pause Campaign
              </Button>
            )}
          </div>
        </div>

        {/* Live Campaign Progress Panel */}
        <CampaignLiveProgress campaignId={id} />

        {/* Analytics High-level KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipients</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{activeAnalytics.recipients}</h3>
              <p className="text-[9px] font-bold text-slate-400 mt-1">Total targets</p>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Sent</span>
              <Send className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{activeAnalytics.sent}</h3>
              <p className="text-[9px] font-bold text-indigo-400 mt-1">Dispatched count</p>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#00B074] uppercase tracking-widest">Delivered</span>
              <CheckCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{activeAnalytics.delivered}</h3>
                <span className="text-xs font-bold text-[#00B074]">{activeAnalytics.deliveryRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-[#00B074] h-full" style={{ width: `${activeAnalytics.deliveryRate}%` }} />
              </div>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Read</span>
              <Eye className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{activeAnalytics.read}</h3>
                <span className="text-xs font-bold text-blue-500">{activeAnalytics.readRate}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${activeAnalytics.readRate}%` }} />
              </div>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Clicked</span>
              <MousePointerClick className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{activeAnalytics.clicked}</h3>
                <span className="text-xs font-bold text-amber-500">{activeAnalytics.clickRate}%</span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 mt-1">{activeAnalytics.totalClicks} total clicks</p>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Failed</span>
              <XCircle className="w-4 h-4 text-rose-450" />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-rose-500 leading-none">{activeAnalytics.failed}</h3>
              <p className="text-[9px] font-bold text-rose-400 mt-1">Delivery issues</p>
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Time Consumed</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none">{activeAnalytics.formattedDuration || "0s"}</h3>
              <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">1st to last message</p>
            </div>
          </Card>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Analytics Charts & Message Preview */}
          <div className="lg:col-span-7 space-y-8">
            {/* Proper Analytics Graph Card */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4.5 h-4.5 text-[#00B074]" />
                    Campaign Performance Graph
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">Detailed metric quantities comparison</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Bar Chart Representation */}
                <div className="md:col-span-8 h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut Funnel Representation */}
                <div className="md:col-span-4 flex flex-col items-center justify-center">
                  <div className="relative w-36 h-36">
                    {pieChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={3}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full rounded-full border-4 border-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                        No Send Data
                      </div>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
                        {activeAnalytics.sent}
                      </span>
                      <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mt-1">Dispatched</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center text-[9px] font-bold text-slate-500">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> Read</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Delivered</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-500" /> Sent</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> Failed</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Campaign Details Info & Content */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-indigo-500" />
                Campaign Asset Details
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-bold border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Template</p>
                  <p className="text-slate-800 dark:text-slate-200 mt-1">{campaign.templateName || "Regular (No Template)"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Platform</p>
                  <p className="text-slate-850 dark:text-slate-300 mt-1 uppercase tracking-widest text-[10px]">{campaign.platform}</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Message Content</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm text-slate-750 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto border border-slate-100/80 dark:border-slate-800">
                  {campaign.content}
                </div>
              </div>

              {campaign.mediaUrl && (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 flex items-center justify-center rounded-xl shrink-0">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{campaign.mediaUrl.split("/").pop()}</p>
                    <a
                      href={campaign.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#00B074] hover:underline font-extrabold tracking-wide mt-0.5 block"
                    >
                      Download Attachment
                    </a>
                  </div>
                </div>
              )}
            </Card>
          </div>

           <div className="lg:col-span-5">
            <Card className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm rounded-3xl overflow-hidden p-6 flex flex-col h-[700px]">
              <div className="space-y-4 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Recipient Breakdown</h3>
                  <p className="text-[11px] font-bold text-slate-400">Search and filter campaign targets status</p>
                </div>
                
            
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search name or waId..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 w-full rounded-xl bg-slate-50 dark:bg-slate-900 border-none font-bold text-xs"
                  />
                </div>

                {/* Tab selections */}
                <div className="flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                  {[
                    { key: "overall" as const, label: "All", count: activeAnalytics.recipients },
                    { key: "delivered" as const, label: "Delivered", count: activeAnalytics.delivered },
                    { key: "read" as const, label: "Read", count: activeAnalytics.read },
                    { key: "clicked" as const, label: "Clicked", count: activeAnalytics.clicked },
                    { key: "failed" as const, label: "Failed", count: activeAnalytics.failed },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setAnalyticsTab(tab.key);
                        setSelectedContactId(null);
                      }}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer border",
                        analyticsTab === tab.key
                          ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white"
                          : "bg-white dark:bg-slate-950 border-slate-150 dark:border-slate-850 text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className={cn(
                        "min-w-4 h-4 px-1.5 rounded-full text-[9px] flex items-center justify-center font-bold",
                        analyticsTab === tab.key
                          ? "bg-white text-slate-900 dark:bg-slate-800 dark:text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients list scroll area */}
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecipientRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-xs font-bold text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mb-2" />
                    No contacts found matching the filters.
                  </div>
                ) : (
                  filteredRecipientRows.map((row: any) => (
                    <div
                      key={row.contactId}
                      className={cn(
                        "p-4 flex flex-col gap-2 transition-all border-l-2",
                        selectedContactId === row.contactId
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500"
                          : "border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      )}
                    >
                      <div
                        className="flex items-center justify-between gap-4 cursor-pointer"
                        onClick={() => setSelectedContactId(selectedContactId === row.contactId ? null : row.contactId)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                              {row.name || "Unknown Recipient"}
                            </p>
                            {row.contactId && (
                              <Link
                                href={`/live-chat?contactId=${row.contactId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-[#00B074] transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0"
                                title="Open Chat"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold font-mono">
                            +{row.waId}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider",
                              getRecipientStatusClass(row.status)
                            )}
                          >
                            {getRecipientStatusLabel(row.status)}
                          </span>
                          {row.clickCount > 0 && (
                            <span className="text-[9px] font-extrabold text-amber-500 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              {row.clickCount} Click{row.clickCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visible Failure Reason Badge */}
                      {(row.status === "failed" || row.failureReason) && (
                        <div className="mt-1 flex items-start gap-1.5 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/90 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-[11px] font-bold leading-normal shadow-xs">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-black text-rose-800 dark:text-rose-200">Failure Reason:</span>
                              {row.errorCode && (
                                <span className="font-mono text-[9.5px] bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 px-1.5 py-0.5 rounded font-black">
                                  Meta Error {row.errorCode}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] font-semibold text-rose-700 dark:text-rose-300">
                              {row.failureReason || row.errorMessage || "Delivery failed or rejected by recipient carrier / WhatsApp Cloud API"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Expanded Recipient details */}
                      {selectedContactId === row.contactId && (
                        <div className="mt-2 p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl space-y-2 text-[10px] font-bold text-slate-500 animate-in slide-in-from-top-1 duration-200">
                          {row.sentAt && (
                            <div className="flex justify-between">
                              <span>Sent At</span>
                              <span className="text-slate-700 dark:text-slate-350">{format(new Date(row.sentAt), "dd MMM yyyy, hh:mm a")}</span>
                            </div>
                          )}
                          {row.lastStatusAt && row.status !== "not_sent" && (
                            <div className="flex justify-between">
                              <span>Last Update</span>
                              <span className="text-slate-700 dark:text-slate-350">{format(new Date(row.lastStatusAt), "dd MMM yyyy, hh:mm a")}</span>
                            </div>
                          )}
                          {row.wamid && (
                            <div className="flex justify-between">
                              <span>Meta Message ID</span>
                              <span className="font-mono text-[9.5px] text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{row.wamid}</span>
                            </div>
                          )}
                          {row.failureReason && (
                            <div className="border-t border-rose-100 dark:border-rose-950 pt-2 space-y-1 text-rose-600 dark:text-rose-400">
                              <div className="flex justify-between font-extrabold">
                                <span>Failure Category</span>
                                <span>{row.errorCode ? `Meta Error ${row.errorCode}` : "Meta API Reject"}</span>
                              </div>
                              <p className="text-[10px] font-normal leading-relaxed text-rose-700 dark:text-rose-300">
                                {row.failureReason}
                              </p>
                            </div>
                          )}
                          {row.clickCount > 0 && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1.5">
                              <div className="flex justify-between text-amber-600">
                                <span>First Click Button</span>
                                <span className="font-extrabold">{row.clickText || "Link Click"}</span>
                              </div>
                              {row.lastClickedAt && (
                                <div className="flex justify-between">
                                  <span>Last Clicked</span>
                                  <span className="text-slate-700 dark:text-slate-350">{format(new Date(row.lastClickedAt), "dd MMM yyyy, hh:mm a")}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {row.contactId && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                              <Link
                                href={`/live-chat?contactId=${row.contactId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00B074] hover:bg-[#009b66] text-white rounded-xl text-[11px] font-black transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Open Live Chat
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
