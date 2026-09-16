"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  Calendar as CalendarIcon,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Trash2,
  MessageSquare,
  Plus,
  ExternalLink,
  User,
  Phone,
  Scissors,
  CalendarCheck,
  RotateCw,
  Bot,
  Users,
  X,
  RotateCcw,
  Send,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAppointmentsList,
  getAppointmentDetails,
  updateAppointmentStatus,
  bulkUpdateAppointmentStatus,
  rescheduleAppointmentAction,
  deleteAppointment,
  bulkDeleteAppointments,
  createManualAppointment,
} from "@/app/actions/appointments";
import { exportAppointmentsToExcel, exportAppointmentsToPDF } from "@/lib/appointments/appointment-export";

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  PENDING: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  COMPLETED: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300",
  RESCHEDULED: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
};

export default function AppointmentsClient() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; type: "AI" | "USER" }[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalAppointments: 0,
    confirmedCount: 0,
    pendingCount: 0,
    completedCount: 0,
    todayCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState("ALL");
  const [customDate, setCustomDate] = useState("");
  const [agentFilter, setAgentFilter] = useState("ALL");

  // Selection & Bulk actions
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("CONFIRMED");
  const [bulkTemplate, setBulkTemplate] = useState<string>("appointment_update");
  const [bulkCustomTemplateName, setBulkCustomTemplateName] = useState<string>("");
  const [bulkCustomTemplateLang, setBulkCustomTemplateLang] = useState<string>("en");

  // Status Change Dialog (with Template selection option)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalApt, setStatusModalApt] = useState<any>(null);
  const [statusModalNewStatus, setStatusModalNewStatus] = useState<string>("CONFIRMED");
  const [statusModalTemplate, setStatusModalTemplate] = useState<string>("appointment_update");
  const [statusModalCustomTemplateName, setStatusModalCustomTemplateName] = useState<string>("");
  const [statusModalCustomTemplateLang, setStatusModalCustomTemplateLang] = useState<string>("en");
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Single appointment details & modals
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Reschedule modal
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({ id: "", date: "", time: "", template: "default" });

  // Create manual modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceName: "",
    staffName: "",
    date: new Date().toISOString().slice(0, 10),
    time: "14:00",
    durationMinutes: 30,
    price: 0,
    notes: "",
  });

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, dateRangeFilter, customDate, agentFilter]);

  useEffect(() => {
    getMessageTemplates()
      .then((res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          setTemplates(res.data.filter((t: any) => !t.status || t.status.toUpperCase() === "APPROVED"));
        }
      })
      .catch((err) => {
        console.warn("Could not load templates:", err.message);
      });
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await getAppointmentsList({
        status: statusFilter,
        dateRange: dateRangeFilter,
        customDate: dateRangeFilter === "CUSTOM" ? customDate : undefined,
        agentId: agentFilter,
        search: searchTerm,
      });
      if (res.success) {
        setAppointments(res.appointments || []);
        if (res.stats) setStats(res.stats);
        if (res.agents) setAgents(res.agents);
        setSelectedAppointmentIds((prev) =>
          prev.filter((id) => (res.appointments || []).some((a: any) => a.id === id))
        );
      } else {
        toast.error(res.error || "Failed to load appointments");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAppointments();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setDateRangeFilter("ALL");
    setCustomDate("");
    setAgentFilter("ALL");
  };

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    statusFilter !== "ALL" ||
    dateRangeFilter !== "ALL" ||
    agentFilter !== "ALL";

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAppointmentIds(appointments.map((a) => a.id));
    } else {
      setSelectedAppointmentIds([]);
    }
  };

  const handleToggleSelect = (aptId: string) => {
    setSelectedAppointmentIds((prev) =>
      prev.includes(aptId) ? prev.filter((id) => id !== aptId) : [...prev, aptId]
    );
  };

  // Open status modal for single appointment
  const handleOpenStatusModal = (apt: any, targetStatus?: string) => {
    setStatusModalApt(apt);
    setStatusModalNewStatus(targetStatus || apt.status || "CONFIRMED");
    const defaultTpl = templates.length > 0 ? templates[0].name : "appointment_update";
    setStatusModalTemplate(defaultTpl);
    setStatusModalCustomTemplateName("");
    setStatusModalCustomTemplateLang("en");
    setStatusModalOpen(true);
  };

  // Confirm single status update with chosen template
  const handleConfirmSingleStatusUpdate = async () => {
    if (!statusModalApt) return;
    setStatusUpdating(true);
    try {
      let finalTemplateName = statusModalTemplate;
      let finalLanguage = "en";

      if (statusModalTemplate === "custom") {
        finalTemplateName = statusModalCustomTemplateName.trim();
        finalLanguage = statusModalCustomTemplateLang.trim() || "en";
        if (!finalTemplateName) {
          toast.error("Please enter a WhatsApp template name");
          setStatusUpdating(false);
          return;
        }
      } else if (statusModalTemplate !== "none" && statusModalTemplate !== "default") {
        const chosen = templates.find((t) => t.name === statusModalTemplate);
        if (chosen?.language) finalLanguage = chosen.language;
      }

      const res = await updateAppointmentStatus(
        statusModalApt.id,
        statusModalNewStatus,
        undefined,
        {
          templateName: finalTemplateName,
          languageCode: finalLanguage,
        }
      );

      if (res.success) {
        toast.success(
          `Appointment #${statusModalApt.appointmentNumber} status changed to ${statusModalNewStatus}${
            finalTemplateName !== "none" ? ` & WhatsApp template "${finalTemplateName}" sent to ${statusModalApt.customerPhone || "customer"}` : ""
          }!`
        );
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === statusModalApt.id ? { ...a, status: statusModalNewStatus } : a
          )
        );
        if (selectedAppointment && selectedAppointment.id === statusModalApt.id) {
          setSelectedAppointment({ ...selectedAppointment, status: statusModalNewStatus });
        }
        setStatusModalOpen(false);
      } else {
        toast.error(res.error || "Failed to update status");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Bulk status update with chosen template
  const handleBulkStatusSubmit = async () => {
    if (selectedAppointmentIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      let finalTemplateName = bulkTemplate;
      let finalLanguage = "en";

      if (bulkTemplate === "custom") {
        finalTemplateName = bulkCustomTemplateName.trim();
        finalLanguage = bulkCustomTemplateLang.trim() || "en";
        if (!finalTemplateName) {
          toast.error("Please enter a WhatsApp template name");
          setBulkActionLoading(false);
          return;
        }
      } else if (bulkTemplate !== "none" && bulkTemplate !== "default") {
        const chosen = templates.find((t) => t.name === bulkTemplate);
        if (chosen?.language) finalLanguage = chosen.language;
      }

      const res = await bulkUpdateAppointmentStatus(selectedAppointmentIds, bulkStatus, {
        templateName: finalTemplateName,
        languageCode: finalLanguage,
      });

      if (res.success) {
        toast.success(
          `Updated status of ${res.count || selectedAppointmentIds.length} appointments to ${bulkStatus}${
            finalTemplateName !== "none" ? ` and sent WhatsApp template "${finalTemplateName}"` : ""
          }!`
        );
        setAppointments((prev) =>
          prev.map((a) =>
            selectedAppointmentIds.includes(a.id) ? { ...a, status: bulkStatus } : a
          )
        );
        setSelectedAppointmentIds([]);
      } else {
        toast.error(res.error || "Failed to update appointments");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedAppointmentIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await bulkDeleteAppointments(selectedAppointmentIds);
      if (res.success) {
        toast.success(`Deleted ${res.count || selectedAppointmentIds.length} appointments.`);
        setAppointments((prev) => prev.filter((a) => !selectedAppointmentIds.includes(a.id)));
        setSelectedAppointmentIds([]);
        setBulkDeleteDialogOpen(false);
      } else {
        toast.error(res.error || "Failed to delete appointments");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDelete = async (aptId: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      const res = await deleteAppointment(aptId);
      if (res.success) {
        toast.success("Appointment deleted.");
        setAppointments(appointments.filter((a) => a.id !== aptId));
        setSelectedAppointmentIds((prev) => prev.filter((id) => id !== aptId));
        setDetailsModalOpen(false);
      } else {
        toast.error(res.error || "Failed to delete appointment");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openRescheduleModal = (apt: any) => {
    setRescheduleData({
      id: apt.id,
      date: apt.date,
      time: apt.time,
      template: "default",
    });
    setRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleData.date || !rescheduleData.time) {
      toast.error("Please provide both date and time.");
      return;
    }

    try {
      const chosenTemplate = templates.find((t) => t.name === rescheduleData.template);
      const res = await rescheduleAppointmentAction(
        rescheduleData.id,
        rescheduleData.date,
        rescheduleData.time,
        {
          templateName: rescheduleData.template,
          languageCode: chosenTemplate?.language || "en",
        }
      );

      if (res.success) {
        toast.success("Appointment rescheduled and notification sent to customer!");
        setRescheduleModalOpen(false);
        fetchAppointments();
      } else {
        toast.error(res.error || "Failed to reschedule.");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateManualSubmit = async () => {
    if (!manualForm.customerName.trim() || !manualForm.customerPhone.trim() || !manualForm.serviceName.trim()) {
      toast.error("Please fill in customer name, phone, and service.");
      return;
    }

    try {
      const res = await createManualAppointment(manualForm);
      if (res.success) {
        toast.success("Appointment created and confirmation sent to customer!");
        setCreateModalOpen(false);
        fetchAppointments();
      } else {
        toast.error(res.error || "Failed to create appointment");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExportExcel = () => {
    try {
      const appointmentsToExport =
        selectedAppointmentIds.length > 0
          ? appointments.filter((a) => selectedAppointmentIds.includes(a.id))
          : appointments;

      if (!appointmentsToExport || appointmentsToExport.length === 0) {
        toast.error("No appointments to export");
        return;
      }

      exportAppointmentsToExcel(appointmentsToExport, {
        filterName: statusFilter !== "ALL" ? statusFilter : undefined,
      });

      toast.success(
        `Successfully exported ${appointmentsToExport.length} appointment${appointmentsToExport.length > 1 ? "s" : ""} to Excel`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel");
    }
  };

  const handleExportPDF = () => {
    try {
      const appointmentsToExport =
        selectedAppointmentIds.length > 0
          ? appointments.filter((a) => selectedAppointmentIds.includes(a.id))
          : appointments;

      if (!appointmentsToExport || appointmentsToExport.length === 0) {
        toast.error("No appointments to export");
        return;
      }

      exportAppointmentsToPDF(appointmentsToExport, {
        filterName: statusFilter !== "ALL" ? statusFilter : undefined,
      });

      toast.success(
        `Successfully exported ${appointmentsToExport.length} appointment${appointmentsToExport.length > 1 ? "s" : ""} to PDF`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export PDF");
    }
  };

  const isAllSelected = appointments.length > 0 && selectedAppointmentIds.length === appointments.length;
  const isPartiallySelected = selectedAppointmentIds.length > 0 && selectedAppointmentIds.length < appointments.length;

  return (
    <DashboardLayoutClient mainClassName="pb-16 antialiased">
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Appointments & Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage client appointments captured automatically via AI agent or manual entries.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="h-9 px-3 gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="h-9 px-3 gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 shadow-xs"
            >
              <FileText className="h-4 w-4 text-rose-600" /> Export PDF
            </Button>

            <Button
              onClick={() => setCreateModalOpen(true)}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm text-xs font-semibold"
            >
              <Plus className="h-4 w-4" /> Book Appointment
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Today&apos;s Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.todayCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Confirmed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.confirmedCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.pendingCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, Customer, Phone, Service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              {/* Status Filter */}
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div>
                <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2 truncate">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Date Range" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Time</SelectItem>
                    <SelectItem value="TODAY">Today</SelectItem>
                    <SelectItem value="YESTERDAY">Yesterday</SelectItem>
                    <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                    <SelectItem value="THIS_MONTH">This Month</SelectItem>
                    <SelectItem value="CUSTOM">Custom Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Agent Filter */}
              <div>
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2 truncate">
                      <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="All Agents" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Agents</SelectItem>
                    {agents.filter((a) => a.type === "AI").length > 0 && (
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                        🤖 AI Agents
                      </div>
                    )}
                    {agents
                      .filter((a) => a.type === "AI")
                      .map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          🤖 {agent.name}
                        </SelectItem>
                      ))}

                    {agents.filter((a) => a.type === "USER").length > 0 && (
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                        👤 Team Members
                      </div>
                    )}
                    {agents
                      .filter((a) => a.type === "USER")
                      .map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          👤 {agent.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </form>

            {/* Custom Date Input */}
            {dateRangeFilter === "CUSTOM" && (
              <div className="flex items-center gap-3 pt-1 border-t border-border">
                <span className="text-xs text-muted-foreground font-medium">Select Date:</span>
                <Input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-48 h-9 text-xs"
                />
              </div>
            )}

            {/* Active filters */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">Active Filters:</span>
                  {statusFilter !== "ALL" && (
                    <Badge variant="secondary" className="text-xs">
                      Status: {statusFilter}
                    </Badge>
                  )}
                  {dateRangeFilter !== "ALL" && (
                    <Badge variant="secondary" className="text-xs">
                      Date: {dateRangeFilter === "CUSTOM" ? customDate || "Custom" : dateRangeFilter}
                    </Badge>
                  )}
                  {agentFilter !== "ALL" && (
                    <Badge variant="secondary" className="text-xs">
                      Agent: {agents.find((a) => a.id === agentFilter)?.name || agentFilter}
                    </Badge>
                  )}
                  {searchTerm.trim() !== "" && (
                    <Badge variant="secondary" className="text-xs">
                      Search: &quot;{searchTerm}&quot;
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 text-xs text-rose-500 hover:text-rose-600 gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* BULK ACTIONS FLOATING BAR (With WhatsApp Template Selector!) */}
        {selectedAppointmentIds.length > 0 && (
          <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-950 text-white rounded-xl shadow-xl border border-emerald-800 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 font-bold px-2.5 py-0.5 text-xs">
                {selectedAppointmentIds.length} Selected
              </Badge>
              <span className="text-xs font-medium text-emerald-100 hidden md:inline">
                Bulk Update & WhatsApp Notification:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Select */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-emerald-200">Status:</span>
                <Select
                  value={bulkStatus}
                  onValueChange={setBulkStatus}
                  disabled={bulkActionLoading}
                >
                  <SelectTrigger className="h-8 w-32 bg-emerald-900/80 border-emerald-700 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* WhatsApp Template Select */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-emerald-200">Template:</span>
                <Select
                  value={bulkTemplate}
                  onValueChange={setBulkTemplate}
                  disabled={bulkActionLoading}
                >
                  <SelectTrigger className="h-8 w-44 bg-emerald-900/80 border-emerald-700 text-white text-xs truncate">
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length > 0 && (
                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/60 uppercase">
                        Approved Meta Templates
                      </div>
                    )}
                    {templates.map((tmpl) => (
                      <SelectItem key={tmpl.id || tmpl.name} value={tmpl.name}>
                        📄 {tmpl.name} ({tmpl.language || "en"})
                      </SelectItem>
                    ))}

                    <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/60 uppercase">
                      Common Presets
                    </div>
                    <SelectItem value="appointment_update">🗓️ appointment_update (Status Notification)</SelectItem>
                    <SelectItem value="appointment_confirmation">✅ appointment_confirmation</SelectItem>
                    <SelectItem value="appointment_reminder">⏰ appointment_reminder</SelectItem>

                    <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/60 uppercase">
                      Options
                    </div>
                    <SelectItem value="custom">✍️ Custom Template Name...</SelectItem>
                    <SelectItem value="default">💬 Freeform Text (24h Window Only)</SelectItem>
                    <SelectItem value="none">🚫 Do Not Send WhatsApp</SelectItem>
                  </SelectContent>
                </Select>

                {bulkTemplate === "custom" && (
                  <Input
                    placeholder="template_name"
                    value={bulkCustomTemplateName}
                    onChange={(e) => setBulkCustomTemplateName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                    className="h-8 w-36 bg-emerald-900/80 border-emerald-700 text-white text-xs placeholder:text-emerald-400 font-mono"
                  />
                )}
              </div>

              {/* Apply Button */}
              <Button
                size="sm"
                disabled={bulkActionLoading}
                onClick={handleBulkStatusSubmit}
                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1 shadow-sm"
              >
                <Send className="h-3.5 w-3.5" /> Apply to {selectedAppointmentIds.length} Bookings
              </Button>

              {/* Bulk Export Buttons */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-8 bg-emerald-900/80 border-emerald-700 text-white hover:bg-emerald-800 text-xs gap-1 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" /> Excel
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-8 bg-emerald-900/80 border-emerald-700 text-white hover:bg-emerald-800 text-xs gap-1 shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 text-rose-300" /> PDF
              </Button>

              {/* Bulk Delete Button */}
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkActionLoading}
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="h-8 gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>

              {/* Deselect All */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAppointmentIds([])}
                className="h-8 text-emerald-200 hover:text-white hover:bg-emerald-900/50 text-xs gap-1"
              >
                <X className="h-3.5 w-3.5" /> Deselect
              </Button>
            </div>
          </div>
        )}

        {/* Appointments Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <span className="text-xs text-muted-foreground">Loading appointments...</span>
                </div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <CalendarCheck className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold text-base">No appointments found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  {hasActiveFilters
                    ? "Try adjusting your filters or search terms."
                    : "Appointments booked via AI chat or created manually will appear here."}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="mt-4 text-xs gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-medium">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <Checkbox
                          checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                          aria-label="Select all appointments"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Booking #</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Service</th>
                      <th className="px-4 py-3 text-left">Date & Time</th>
                      <th className="px-4 py-3 text-left">Agent / Source</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appointments.map((apt) => {
                      const isSelected = selectedAppointmentIds.includes(apt.id);
                      const aiAgentName = apt.contact?.aiAgent?.name;
                      const assignedAgentName = apt.contact?.assignedAgent?.name;

                      return (
                        <tr
                          key={apt.id}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(apt.id)}
                              aria-label={`Select appointment ${apt.appointmentNumber}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            <button
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setDetailsModalOpen(true);
                              }}
                              className="hover:underline text-emerald-600 dark:text-emerald-400"
                            >
                              {apt.appointmentNumber}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{apt.customerName}</div>
                            <div className="text-xs text-muted-foreground">{apt.customerPhone}</div>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <div>{apt.serviceName}</div>
                            <div className="text-xs text-muted-foreground">{apt.durationMinutes} mins</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{apt.date}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {apt.time}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {aiAgentName ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 gap-1 font-medium"
                              >
                                🤖 {aiAgentName}
                              </Badge>
                            ) : assignedAgentName ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 gap-1 font-medium"
                              >
                                👤 {assignedAgentName}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0">
                                {apt.source === "AI_CHAT" ? "🤖 AI Chat" : "Manual"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/* Clicking status badge opens the Status & Template selector dialog */}
                            <button
                              onClick={() => handleOpenStatusModal(apt)}
                              className={`h-7 text-xs border rounded-full px-2.5 font-medium transition-all hover:ring-2 hover:ring-offset-1 hover:ring-emerald-500 flex items-center gap-1 ${
                                STATUS_COLORS[apt.status] || ""
                              }`}
                              title="Click to update status and choose WhatsApp Template"
                            >
                              <span>{apt.status}</span>
                              <span className="text-[10px] opacity-60">▼</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {apt.contactId && (
                                <Link href={`/live-chat?contactId=${apt.contactId}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                                    title="Open Live Chat"
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenStatusModal(apt)}
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                                title="Change Status & Send Template"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRescheduleModal(apt)}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                title="Reschedule Slot"
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setDetailsModalOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(apt.id)}
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                                title="Delete Appointment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STATUS & WHATSAPP TEMPLATE SELECTION DIALOG (For Single Appointment) */}
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-emerald-600" />
                Change Booking Status & Send Notification
              </DialogTitle>
              <DialogDescription>
                Update appointment #{statusModalApt?.appointmentNumber} and choose which WhatsApp template to send.
              </DialogDescription>
            </DialogHeader>

            {statusModalApt && (
              <div className="space-y-4 py-2 text-sm">
                {/* Target Customer WhatsApp Phone Banner */}
                <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      Recipient WhatsApp Phone:
                    </span>
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                      Direct WhatsApp Delivery
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-foreground tracking-wide font-mono">
                      {statusModalApt.customerPhone || "⚠️ No phone number provided"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({statusModalApt.customerName})
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 pt-0.5 border-t border-emerald-200/50 dark:border-emerald-900/50 flex justify-between">
                    <span>Booking: <strong>#{statusModalApt.appointmentNumber}</strong></span>
                    <span>Service: <strong>{statusModalApt.serviceName}</strong></span>
                    <span>Current: <Badge className={`text-[10px] py-0 ${STATUS_COLORS[statusModalApt.status] || ""}`}>{statusModalApt.status}</Badge></span>
                  </div>
                </div>

                {/* New Status Select */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Select New Status *
                  </label>
                  <Select
                    value={statusModalNewStatus}
                    onValueChange={setStatusModalNewStatus}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* WhatsApp Template Select Option */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                    <span>WhatsApp Template to Send *</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Meta 24-hr Compliant
                    </span>
                  </label>
                  <Select
                    value={statusModalTemplate}
                    onValueChange={setStatusModalTemplate}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose WhatsApp template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length > 0 && (
                        <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/60 uppercase tracking-wider">
                          Approved Meta Templates
                        </div>
                      )}
                      {templates.map((tmpl) => (
                        <SelectItem key={tmpl.id || tmpl.name} value={tmpl.name}>
                          📄 {tmpl.name} ({tmpl.language || "en"})
                        </SelectItem>
                      ))}

                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/60 uppercase tracking-wider">
                        Common Booking Templates
                      </div>
                      <SelectItem value="appointment_update">
                        🗓️ appointment_update (Status Notification)
                      </SelectItem>
                      <SelectItem value="appointment_confirmation">
                        ✅ appointment_confirmation (Booking Confirmed)
                      </SelectItem>
                      <SelectItem value="appointment_reminder">
                        ⏰ appointment_reminder (Time & Date Reminder)
                      </SelectItem>

                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground bg-muted/60 uppercase tracking-wider">
                        Other Options
                      </div>
                      <SelectItem value="custom">
                        ✍️ Enter Custom Template Name...
                      </SelectItem>
                      <SelectItem value="default">
                        💬 Standard Text Message (Active 24h Window Only)
                      </SelectItem>
                      <SelectItem value="none">
                        🚫 Do Not Send WhatsApp Message
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Template Input Fields */}
                {statusModalTemplate === "custom" && (
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Meta Template Name *
                      </label>
                      <Input
                        placeholder="e.g. clinic_booking_confirmed"
                        value={statusModalCustomTemplateName}
                        onChange={(e) => setStatusModalCustomTemplateName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                        className="h-9 font-mono text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        Must match an approved template name in your Meta WhatsApp Manager.
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Language Code
                      </label>
                      <Input
                        placeholder="en"
                        value={statusModalCustomTemplateLang}
                        onChange={(e) => setStatusModalCustomTemplateLang(e.target.value)}
                        className="h-9 font-mono text-xs w-28"
                      />
                    </div>
                  </div>
                )}

                {/* Template Variables Live Preview */}
                {statusModalTemplate !== "none" ? (
                  <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Parameters injected into WhatsApp:
                      </span>
                      <span className="font-mono text-[10px]">
                        Template: {statusModalTemplate === "custom" ? (statusModalCustomTemplateName || "[Enter name]") : statusModalTemplate}
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] bg-background/80 p-2.5 rounded border border-border">
                      <p><span className="text-emerald-600 font-bold">&#123;&#123;1&#125;&#125;</span> Customer: <strong>{statusModalApt.customerName || "Customer"}</strong></p>
                      <p><span className="text-emerald-600 font-bold">&#123;&#123;2&#125;&#125;</span> Booking ID: <strong>{statusModalApt.appointmentNumber}</strong></p>
                      <p><span className="text-emerald-600 font-bold">&#123;&#123;3&#125;&#125;</span> Service: <strong>{statusModalApt.serviceName}</strong></p>
                      <p><span className="text-emerald-600 font-bold">&#123;&#123;4&#125;&#125;</span> Date: <strong>{statusModalApt.date}</strong></p>
                      <p><span className="text-emerald-600 font-bold">&#123;&#123;5&#125;&#125;</span> Time: <strong>{statusModalApt.time}</strong></p>
                      <p><span className="text-emerald-600 font-bold">&#123;&#123;6&#125;&#125;</span> New Status: <strong className="text-emerald-600">{statusModalNewStatus}</strong></p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Dispatched to customer&apos;s WhatsApp: <strong>{statusModalApt.customerPhone}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-xs">
                    <p className="text-amber-800 dark:text-amber-300 font-medium">
                      ⚠️ No WhatsApp message will be sent. Status will be updated silently.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-3">
              <Button
                variant="outline"
                disabled={statusUpdating}
                onClick={() => setStatusModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSingleStatusUpdate}
                disabled={statusUpdating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {statusUpdating ? "Updating & Sending..." : "Update Status & Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* BULK DELETE CONFIRMATION MODAL */}
        <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Delete Selected Appointments
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedAppointmentIds.length} selected appointments?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                disabled={bulkActionLoading}
                onClick={() => setBulkDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={bulkActionLoading}
                onClick={handleBulkDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {bulkActionLoading ? "Deleting..." : `Yes, Delete ${selectedAppointmentIds.length} Appointments`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DETAILS MODAL */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-md">
            {selectedAppointment && (
              <>
                <DialogHeader>
                  <div className="flex justify-between items-start pr-4">
                    <div>
                      <DialogTitle className="text-xl">Appointment #{selectedAppointment.appointmentNumber}</DialogTitle>
                      <DialogDescription>
                        Created via {selectedAppointment.source}
                      </DialogDescription>
                    </div>
                    <Badge className={`text-xs ${STATUS_COLORS[selectedAppointment.status] || ""}`}>
                      {selectedAppointment.status}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm">
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> Customer Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground">Name:</span>
                        <p className="font-medium">{selectedAppointment.customerName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Phone:</span>
                        <p className="font-medium flex items-center gap-1">
                          {selectedAppointment.customerPhone}
                          <a
                            href={`https://wa.me/${selectedAppointment.customerPhone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline inline-flex items-center text-xs"
                          >
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                      <Scissors className="h-3.5 w-3.5" /> Service & Slot
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground">Service:</span>
                        <p className="font-medium">{selectedAppointment.serviceName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Fee:</span>
                        <p className="font-medium">{selectedAppointment.currency} {selectedAppointment.price}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Date:</span>
                        <p className="font-medium">{selectedAppointment.date}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Time:</span>
                        <p className="font-medium">{selectedAppointment.time}</p>
                      </div>
                    </div>
                  </div>

                  {selectedAppointment.notes && (
                    <div className="rounded-lg border border-border p-3 bg-muted/10 text-xs">
                      <span className="font-semibold text-muted-foreground">Notes:</span>
                      <p className="mt-1 whitespace-pre-wrap">{selectedAppointment.notes}</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex justify-between items-center sm:justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleOpenStatusModal(selectedAppointment)}
                      className="gap-1.5 text-emerald-600"
                    >
                      <Send className="h-4 w-4" /> Change Status & Send Template
                    </Button>
                    {selectedAppointment.contactId && (
                      <Link href={`/live-chat?contactId=${selectedAppointment.contactId}`}>
                        <Button variant="outline" className="gap-2 text-emerald-600">
                          <MessageSquare className="h-4 w-4" /> Open Conversation
                        </Button>
                      </Link>
                    )}
                  </div>

                  <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* RESCHEDULE MODAL */}
        <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Reschedule Appointment</DialogTitle>
              <DialogDescription>Select a new date, time, and WhatsApp notification template.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium">New Date</label>
                <Input
                  type="date"
                  value={rescheduleData.date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium">New Time</label>
                <Input
                  type="time"
                  value={rescheduleData.time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium">WhatsApp Notification Template</label>
                <Select
                  value={rescheduleData.template}
                  onValueChange={(val) => setRescheduleData({ ...rescheduleData, template: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">💬 Standard Reschedule Notification</SelectItem>
                    <SelectItem value="none">🚫 Do Not Send WhatsApp Message</SelectItem>
                    {templates.map((tmpl) => (
                      <SelectItem key={tmpl.id || tmpl.name} value={tmpl.name}>
                        📄 {tmpl.name} ({tmpl.language || "en"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRescheduleSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirm Reschedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE MANUAL APPOINTMENT MODAL */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book Manual Appointment</DialogTitle>
              <DialogDescription>
                Record an appointment taken via phone, walk-in, or external channels.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div>
                <label className="text-xs font-medium">Customer Name *</label>
                <Input
                  placeholder="Full Name"
                  value={manualForm.customerName}
                  onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Customer Phone *</label>
                <Input
                  placeholder="Phone/WhatsApp Number"
                  value={manualForm.customerPhone}
                  onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Service Name *</label>
                <Input
                  placeholder="e.g. Haircut, Consultation"
                  value={manualForm.serviceName}
                  onChange={(e) => setManualForm({ ...manualForm, serviceName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Date *</label>
                  <Input
                    type="date"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Time *</label>
                  <Input
                    type="time"
                    value={manualForm.time}
                    onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Staff Member</label>
                  <Input
                    placeholder="Staff name"
                    value={manualForm.staffName}
                    onChange={(e) => setManualForm({ ...manualForm, staffName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Fee (PKR)</label>
                  <Input
                    type="number"
                    value={manualForm.price}
                    onChange={(e) => setManualForm({ ...manualForm, price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Notes</label>
                <Input
                  placeholder="Special instructions..."
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateManualSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Book Appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayoutClient>
  );
}
