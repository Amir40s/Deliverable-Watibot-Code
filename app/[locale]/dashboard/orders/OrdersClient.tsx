"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Eye,
  Trash2,
  MessageSquare,
  Plus,
  ArrowUpDown,
  ExternalLink,
  DollarSign,
  Package,
  Calendar,
  User,
  Phone,
  MapPin,
  Bot,
  Users,
  CheckSquare,
  Square,
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
  getOrdersList,
  getOrderDetails,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  deleteOrder,
  bulkDeleteOrders,
  createManualOrder,
} from "@/app/actions/orders";
import { exportOrdersToExcel, exportOrdersToPDF } from "@/lib/orders/order-export";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300",
  PROCESSING: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300",
  SHIPPED: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300",
};

export interface DetectedVariable {
  id: string;
  type: "body" | "header_text" | "header_media" | "button_url" | "button_code";
  placeholder: string;
  label: string;
  example?: string;
  defaultValue: string;
  mediaFormat?: string;
}

function guessDefaultValue(name: string, index: number, order: any, newStatus: string): string {
  if (!order) return "";
  const lower = name.toLowerCase();

  if (lower.includes("name") || lower.includes("cust") || lower.includes("user") || lower.includes("client")) {
    return order.customerName || "Customer";
  }
  if (lower.includes("order") || lower.includes("id") || lower.includes("num") || lower.includes("ref") || lower.includes("tracking")) {
    return order.orderNumber || "";
  }
  if (lower.includes("status") || lower.includes("state")) {
    return newStatus || order.status || "CONFIRMED";
  }
  if (lower.includes("total") || lower.includes("amount") || lower.includes("price") || lower.includes("cost") || lower.includes("pay")) {
    return `${order.currency || "PKR"} ${order.totalAmount || 0}`;
  }
  if (lower.includes("address") || lower.includes("loc") || lower.includes("dest") || lower.includes("city") || lower.includes("street")) {
    return order.deliveryAddress || "";
  }
  if (lower.includes("item") || lower.includes("product")) {
    return Array.isArray(order.items) && order.items.length > 0
      ? order.items.map((i: any) => `${i.quantity}× ${i.productName || i.name}`).join(", ")
      : "";
  }
  if (lower.includes("store") || lower.includes("company") || lower.includes("business") || lower.includes("brand") || lower.includes("org")) {
    return order.organization?.name || "Our Store";
  }
  if (lower.includes("date") || lower.includes("time")) {
    return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  // Fallback by index position
  switch (index) {
    case 0:
      return order.customerName || "Customer";
    case 1:
      return order.orderNumber || "";
    case 2:
      return newStatus || order.status || "CONFIRMED";
    case 3:
      return `${order.currency || "PKR"} ${order.totalAmount || 0}`;
    case 4:
      return order.deliveryAddress || "";
    case 5:
      return Array.isArray(order.items) && order.items.length > 0
        ? order.items.map((i: any) => `${i.quantity}× ${i.productName || i.name}`).join(", ")
        : "";
    default:
      return "";
  }
}

function getDescriptiveLabel(name: string, index: number): string {
  const lower = name.toLowerCase();
  if (lower.includes("name") || lower.includes("cust")) return `Customer Name ({{${name}}})`;
  if (lower.includes("order") || lower.includes("id") || lower.includes("num")) return `Order Number ({{${name}}})`;
  if (lower.includes("status")) return `Order Status ({{${name}}})`;
  if (lower.includes("total") || lower.includes("amount") || lower.includes("price")) return `Total Amount ({{${name}}})`;
  if (lower.includes("address")) return `Delivery Address ({{${name}}})`;
  if (lower.includes("item") || lower.includes("product")) return `Items ({{${name}}})`;

  switch (index) {
    case 0:
      return `Customer Name ({{${name}}})`;
    case 1:
      return `Order Number ({{${name}}})`;
    case 2:
      return `New Status ({{${name}}})`;
    case 3:
      return `Total Amount ({{${name}}})`;
    case 4:
      return `Delivery Address ({{${name}}})`;
    default:
      return `Variable {{${name}}}`;
  }
}

function extractTemplateVariables(template: any, order: any, newStatus: string): DetectedVariable[] {
  if (!template) return [];
  if (!Array.isArray(template.components)) {
    // If it's a common preset template without components array:
    return [
      { id: "body_0", type: "body", placeholder: "{{1}}", label: "Customer Name ({{1}})", defaultValue: order?.customerName || "Customer" },
      { id: "body_1", type: "body", placeholder: "{{2}}", label: "Order Number ({{2}})", defaultValue: order?.orderNumber || "" },
      { id: "body_2", type: "body", placeholder: "{{3}}", label: "Order Status ({{3}})", defaultValue: newStatus || order?.status || "CONFIRMED" },
      { id: "body_3", type: "body", placeholder: "{{4}}", label: "Total Amount ({{4}})", defaultValue: `${order?.currency || "PKR"} ${order?.totalAmount || 0}` },
      ...(order?.deliveryAddress ? [{ id: "body_4", type: "body" as const, placeholder: "{{5}}", label: "Delivery Address ({{5}})", defaultValue: order.deliveryAddress }] : [])
    ];
  }

  const variables: DetectedVariable[] = [];
  const headerComp = template.components.find((c: any) => c.type?.toUpperCase() === "HEADER");
  const bodyComp = template.components.find((c: any) => c.type?.toUpperCase() === "BODY");
  const buttonsComp = template.components.find((c: any) => c.type?.toUpperCase() === "BUTTONS");

  // 1. Header Media
  if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format?.toUpperCase())) {
    const fmt = headerComp.format.toUpperCase();
    const exampleUrl = headerComp.example?.header_handle?.[0] || "";
    variables.push({
      id: "header_media",
      type: "header_media",
      placeholder: `Header ${fmt}`,
      label: `Header ${fmt} URL`,
      example: exampleUrl,
      defaultValue: exampleUrl || "",
      mediaFormat: fmt,
    });
  }

  // 2. Header Text Variables
  if (headerComp && headerComp.format?.toUpperCase() === "TEXT" && headerComp.text) {
    const matches = Array.from(headerComp.text.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g));
    const examples = headerComp.example?.header_text || [];
    matches.forEach((m: any, idx: number) => {
      const ph = m[0];
      const name = m[1];
      const example = examples[idx] || "";
      const defaultValue = guessDefaultValue(name, idx, order, newStatus);
      variables.push({
        id: `header_${idx}`,
        type: "header_text",
        placeholder: ph,
        label: `Header: ${ph}`,
        example,
        defaultValue,
      });
    });
  }

  // 3. Body Variables
  if (bodyComp && bodyComp.text) {
    const matches = Array.from(bodyComp.text.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g));
    const examples = bodyComp.example?.body_text?.[0] || [];

    if (matches.length > 0) {
      matches.forEach((m: any, idx: number) => {
        const ph = m[0];
        const name = m[1];
        const example = examples[idx] || "";
        const defaultValue = guessDefaultValue(name, idx, order, newStatus);
        variables.push({
          id: `body_${idx}`,
          type: "body",
          placeholder: ph,
          label: getDescriptiveLabel(name, idx),
          example,
          defaultValue,
        });
      });
    } else if (examples.length > 0) {
      examples.forEach((ex: string, idx: number) => {
        const ph = `{{${idx + 1}}}`;
        const defaultValue = guessDefaultValue(String(idx + 1), idx, order, newStatus);
        variables.push({
          id: `body_${idx}`,
          type: "body",
          placeholder: ph,
          label: getDescriptiveLabel(String(idx + 1), idx),
          example: ex,
          defaultValue,
        });
      });
    }
  }

  // 4. Button Variables
  if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
    buttonsComp.buttons.forEach((btn: any, idx: number) => {
      if (btn.type === "URL" && (btn.url?.includes("{{1}}") || btn.example)) {
        variables.push({
          id: `button_${idx}`,
          type: "button_url",
          placeholder: `URL Variable`,
          label: `Button "${btn.text || "Link"}" URL suffix`,
          example: btn.example?.[0] || "track",
          defaultValue: order?.orderNumber || "1",
        });
      } else if (btn.type === "COPY_CODE") {
        variables.push({
          id: `button_${idx}`,
          type: "button_code",
          placeholder: `Coupon Code`,
          label: `Button "${btn.text || "Copy Code"}" Coupon Code`,
          example: btn.example?.[0] || "DISCOUNT10",
          defaultValue: "ORDER" + (order?.orderNumber?.replace(/\D/g, "") || ""),
        });
      }
    });
  }

  return variables;
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; type: "AI" | "USER" }[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingCount: 0,
    confirmedCount: 0,
    deliveredCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState("ALL");
  const [customDate, setCustomDate] = useState("");
  const [agentFilter, setAgentFilter] = useState("ALL");

  // Selection & Bulk actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("CONFIRMED");
  const [bulkTemplate, setBulkTemplate] = useState<string>("order_update");
  const [bulkCustomTemplateName, setBulkCustomTemplateName] = useState<string>("");
  const [bulkCustomTemplateLang, setBulkCustomTemplateLang] = useState<string>("en");

  // Status Change Dialog (with Template inspection & variable editing)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalOrder, setStatusModalOrder] = useState<any>(null);
  const [statusModalNewStatus, setStatusModalNewStatus] = useState<string>("CONFIRMED");
  const [statusModalTemplate, setStatusModalTemplate] = useState<string>("order_update");
  const [statusModalCustomTemplateName, setStatusModalCustomTemplateName] = useState<string>("");
  const [statusModalCustomTemplateLang, setStatusModalCustomTemplateLang] = useState<string>("en");
  const [detectedVariables, setDetectedVariables] = useState<DetectedVariable[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Single order details & manual creation
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    productName: "",
    variant: "",
    quantity: 1,
    unitPrice: 0,
    deliveryFee: 0,
    paymentMethod: "Cash on Delivery",
    notes: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchOrders(debouncedSearch);
  }, [statusFilter, dateRangeFilter, customDate, agentFilter, debouncedSearch]);

  useEffect(() => {
    // Load available WhatsApp Templates for notification options
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

  const fetchOrders = async (querySearch?: string) => {
    setLoading(true);
    try {
      const activeSearch = querySearch !== undefined ? querySearch : debouncedSearch;
      const res = await getOrdersList({
        status: statusFilter,
        search: activeSearch,
        dateRange: dateRangeFilter,
        customDate: dateRangeFilter === "CUSTOM" ? customDate : undefined,
        agentId: agentFilter,
      });
      if (res.success) {
        setOrders(res.orders || []);
        if (res.stats) setStats(res.stats);
        if (res.agents) setAgents(res.agents);
        setSelectedOrderIds((prev) =>
          prev.filter((id) => (res.orders || []).some((o: any) => o.id === id))
        );
      } else {
        toast.error(res.error || "Failed to load orders");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchTerm);
    fetchOrders(searchTerm);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
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
      setSelectedOrderIds(orders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Open status modal for single order
  const handleOpenStatusModal = (order: any, targetStatus?: string) => {
    const statusToUse = targetStatus || order.status || "CONFIRMED";
    setStatusModalOrder(order);
    setStatusModalNewStatus(statusToUse);
    const defaultTpl = templates.length > 0 ? templates[0].name : "order_update";
    setStatusModalTemplate(defaultTpl);
    setStatusModalCustomTemplateName("");
    setStatusModalCustomTemplateLang("en");

    const chosenTpl = templates.find((t) => t.name === defaultTpl);
    const vars = extractTemplateVariables(chosenTpl || { name: defaultTpl }, order, statusToUse);
    setDetectedVariables(vars);
    const initialVals: Record<string, string> = {};
    vars.forEach((v) => {
      initialVals[v.id] = v.defaultValue;
    });
    setVariableValues(initialVals);
    setStatusModalOpen(true);
  };

  const handleTemplateChangeInModal = (tplName: string) => {
    setStatusModalTemplate(tplName);
    if (tplName === "none" || tplName === "default") {
      setDetectedVariables([]);
      setVariableValues({});
      return;
    }
    const chosenTpl = templates.find((t) => t.name === tplName);
    const vars = extractTemplateVariables(chosenTpl || { name: tplName }, statusModalOrder, statusModalNewStatus);
    setDetectedVariables(vars);
    const newVals: Record<string, string> = {};
    vars.forEach((v) => {
      newVals[v.id] = v.defaultValue;
    });
    setVariableValues(newVals);
  };

  const handleStatusChangeInModal = (newStatus: string) => {
    setStatusModalNewStatus(newStatus);
    // Automatically update status variable if present in values
    setVariableValues((prev) => {
      const updated = { ...prev };
      detectedVariables.forEach((v) => {
        if (v.label.toLowerCase().includes("status") || v.placeholder === "{{3}}") {
          updated[v.id] = newStatus;
        }
      });
      return updated;
    });
  };

  // Submit single status update with chosen template
  const handleConfirmSingleStatusUpdate = async () => {
    if (!statusModalOrder) return;
    setStatusUpdating(true);
    try {
      let finalTemplateName = statusModalTemplate;
      let finalLanguage = "en";
      let finalComponents: any[] | undefined = undefined;

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

        const headerMedia = detectedVariables.find((v) => v.type === "header_media");
        const headerTextVars = detectedVariables.filter((v) => v.type === "header_text");
        const bodyVars = detectedVariables.filter((v) => v.type === "body");
        const buttonVars = detectedVariables.filter((v) => v.type === "button_url" || v.type === "button_code");

        const comps: any[] = [];

        // Header Media / Text
        if (headerMedia) {
          const mediaUrl = variableValues[headerMedia.id] || headerMedia.defaultValue;
          if (mediaUrl) {
            const fmt = (headerMedia.mediaFormat || "image").toLowerCase();
            comps.push({
              type: "header",
              parameters: [
                {
                  type: fmt,
                  [fmt]: { link: mediaUrl },
                },
              ],
            });
          }
        } else if (headerTextVars.length > 0) {
          comps.push({
            type: "header",
            parameters: headerTextVars.map((v) => ({
              type: "text",
              text: variableValues[v.id] ?? v.defaultValue ?? "",
            })),
          });
        }

        // Body
        if (bodyVars.length > 0) {
          comps.push({
            type: "body",
            parameters: bodyVars.map((v) => ({
              type: "text",
              text: variableValues[v.id] ?? v.defaultValue ?? "",
            })),
          });
        }

        // Buttons
        if (buttonVars.length > 0 && chosen?.components) {
          const buttonsComp = chosen.components.find((c: any) => c.type?.toUpperCase() === "BUTTONS");
          if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
            buttonsComp.buttons.forEach((btn: any, idx: number) => {
              const btnVar = buttonVars.find((v) => v.id === `button_${idx}`);
              if (btnVar) {
                const val = variableValues[btnVar.id] ?? btnVar.defaultValue ?? "";
                if (btnVar.type === "button_url") {
                  comps.push({
                    type: "button",
                    sub_type: "url",
                    index: String(idx),
                    parameters: [{ type: "text", text: val }],
                  });
                } else if (btnVar.type === "button_code") {
                  comps.push({
                    type: "button",
                    sub_type: "copy_code",
                    index: String(idx),
                    parameters: [{ type: "coupon_code", coupon_code: val }],
                  });
                }
              }
            });
          }
        }

        finalComponents = comps.length > 0 ? comps : undefined;
      }

      const res = await updateOrderStatus(
        statusModalOrder.id,
        statusModalNewStatus,
        undefined,
        {
          templateName: finalTemplateName,
          languageCode: finalLanguage,
          templateComponents: finalComponents,
        }
      );

      if (res.success) {
        toast.success(
          `Order #${statusModalOrder.orderNumber} status changed to ${statusModalNewStatus}${
            finalTemplateName !== "none"
              ? ` & WhatsApp template "${finalTemplateName}" sent to ${statusModalOrder.customerPhone || "customer"}`
              : ""
          }!`
        );
        if (selectedOrder && selectedOrder.id === statusModalOrder.id) {
          setSelectedOrder({ ...selectedOrder, status: statusModalNewStatus });
        }
        setStatusModalOpen(false);
        fetchOrders();
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
    if (selectedOrderIds.length === 0) return;
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

      const res = await bulkUpdateOrderStatus(selectedOrderIds, bulkStatus, {
        templateName: finalTemplateName,
        languageCode: finalLanguage,
      });

      if (res.success) {
        toast.success(
          `Updated ${res.count || selectedOrderIds.length} orders to ${bulkStatus}${
            finalTemplateName !== "none" ? ` and sent WhatsApp template "${finalTemplateName}"` : ""
          }!`
        );
        setSelectedOrderIds([]);
        fetchOrders();
      } else {
        toast.error(res.error || "Failed to update selected orders");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await bulkDeleteOrders(selectedOrderIds);
      if (res.success) {
        toast.success(`Deleted ${res.count || selectedOrderIds.length} orders.`);
        setSelectedOrderIds([]);
        setBulkDeleteDialogOpen(false);
        fetchOrders();
      } else {
        toast.error(res.error || "Failed to delete selected orders");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      const res = await deleteOrder(orderId);
      if (res.success) {
        toast.success("Order deleted.");
        setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
        setDetailsModalOpen(false);
        fetchOrders();
      } else {
        toast.error(res.error || "Failed to delete order");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenDetails = (order: any) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  const handleCreateManualOrder = async () => {
    if (!newOrderForm.customerName.trim() || !newOrderForm.customerPhone.trim() || !newOrderForm.deliveryAddress.trim()) {
      toast.error("Please fill in customer name, phone, and address.");
      return;
    }
    if (!newOrderForm.productName.trim() || !newOrderForm.unitPrice) {
      toast.error("Please provide product name and unit price.");
      return;
    }

    try {
      const res = await createManualOrder({
        customerName: newOrderForm.customerName,
        customerPhone: newOrderForm.customerPhone,
        customerEmail: newOrderForm.customerEmail || undefined,
        deliveryAddress: newOrderForm.deliveryAddress,
        items: [
          {
            productName: newOrderForm.productName,
            variant: newOrderForm.variant || undefined,
            quantity: Number(newOrderForm.quantity) || 1,
            unitPrice: Number(newOrderForm.unitPrice) || 0,
          },
        ],
        deliveryFee: Number(newOrderForm.deliveryFee) || 0,
        paymentMethod: newOrderForm.paymentMethod,
        notes: newOrderForm.notes,
      });

      if (res.success) {
        toast.success("Order created and confirmation sent to customer!");
        setCreateModalOpen(false);
        fetchOrders();
      } else {
        toast.error(res.error || "Failed to create order");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExportExcel = () => {
    try {
      const ordersToExport =
        selectedOrderIds.length > 0
          ? orders.filter((o) => selectedOrderIds.includes(o.id))
          : orders;

      if (!ordersToExport || ordersToExport.length === 0) {
        toast.error("No orders to export");
        return;
      }

      exportOrdersToExcel(ordersToExport, {
        filterName: statusFilter !== "ALL" ? statusFilter : undefined,
      });

      toast.success(
        `Successfully exported ${ordersToExport.length} order${ordersToExport.length > 1 ? "s" : ""} to Excel`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel");
    }
  };

  const handleExportPDF = () => {
    try {
      const ordersToExport =
        selectedOrderIds.length > 0
          ? orders.filter((o) => selectedOrderIds.includes(o.id))
          : orders;

      if (!ordersToExport || ordersToExport.length === 0) {
        toast.error("No orders to export");
        return;
      }

      exportOrdersToPDF(ordersToExport, {
        filterName: statusFilter !== "ALL" ? statusFilter : undefined,
      });

      toast.success(
        `Successfully exported ${ordersToExport.length} order${ordersToExport.length > 1 ? "s" : ""} to PDF`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export PDF");
    }
  };

  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;
  const isPartiallySelected = selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length;

  return (
    <DashboardLayoutClient mainClassName="pb-16 antialiased">
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and process orders captured by the AI agent and manual entries.
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
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm text-xs font-semibold px-3.5"
            >
              <Plus className="h-4 w-4" /> Create Manual Order
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                PKR {(stats.totalRevenue || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.pendingCount ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.deliveredCount ?? 0}
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
                  placeholder="Search by Order ID, Name, Phone..."
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
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="SHIPPED">Shipped</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div>
                <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2 truncate">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
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
        {selectedOrderIds.length > 0 && (
          <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-950 text-white rounded-xl shadow-xl border border-emerald-800 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 font-bold px-2.5 py-0.5 text-xs">
                {selectedOrderIds.length} Selected
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
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="PROCESSING">Processing</SelectItem>
                    <SelectItem value="SHIPPED">Shipped</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
                    <SelectItem value="order_update">📦 order_update (Status Notification)</SelectItem>
                    <SelectItem value="order_confirmation">✅ order_confirmation</SelectItem>
                    <SelectItem value="order_status">📋 order_status</SelectItem>
                    <SelectItem value="order_shipped">🚚 order_shipped</SelectItem>

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
                <Send className="h-3.5 w-3.5" /> Apply to {selectedOrderIds.length} Orders
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
                onClick={() => setSelectedOrderIds([])}
                className="h-8 text-emerald-200 hover:text-white hover:bg-emerald-900/50 text-xs gap-1"
              >
                <X className="h-3.5 w-3.5" /> Deselect
              </Button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <span className="text-xs text-muted-foreground">Loading orders...</span>
                </div>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold text-base">No orders found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  {hasActiveFilters
                    ? "Try adjusting your filters or search terms."
                    : "When customers chat with your AI agent to place orders, they will appear here automatically."}
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
                          aria-label="Select all orders"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Order #</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Items</th>
                      <th className="px-4 py-3 text-left">Total</th>
                      <th className="px-4 py-3 text-left">Agent / Source</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => {
                      const isSelected = selectedOrderIds.includes(order.id);
                      const aiAgentName = order.contact?.aiAgent?.name;
                      const assignedAgentName = order.contact?.assignedAgent?.name;

                      return (
                        <tr
                          key={order.id}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectOrder(order.id)}
                              aria-label={`Select order ${order.orderNumber}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <button
                              onClick={() => handleOpenDetails(order)}
                              className="hover:underline text-emerald-600 dark:text-emerald-400"
                            >
                              {order.orderNumber}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{order.customerName}</div>
                            <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {Array.isArray(order.items) && order.items.length > 0
                                ? order.items
                                    .map((i: any) => `${i.quantity}× ${i.productName}${i.variant ? ` (${i.variant})` : ""}`)
                                    .join(", ")
                                : "No items"}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {order.currency} {order.totalAmount}
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
                                {order.source === "AI_CHAT" ? "🤖 AI Chat" : "Manual"}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/* Clicking status badge opens the Status & Template selector dialog */}
                            <button
                              onClick={() => handleOpenStatusModal(order)}
                              className={`h-7 text-xs border rounded-full px-2.5 font-medium transition-all hover:ring-2 hover:ring-offset-1 hover:ring-emerald-500 flex items-center gap-1 ${
                                STATUS_COLORS[order.status] || ""
                              }`}
                              title="Click to update status and choose WhatsApp Template"
                            >
                              <span>{order.status}</span>
                              <span className="text-[10px] opacity-60">▼</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {order.contactId && (
                                <Link href={`/live-chat?contactId=${order.contactId}`}>
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
                                onClick={() => handleOpenStatusModal(order)}
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                                title="Change Status & Send Template"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDetails(order)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(order.id)}
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                                title="Delete Order"
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

        {/* STATUS & WHATSAPP TEMPLATE SELECTION DIALOG (For Single Order) */}
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-emerald-600" />
                Change Order Status & Send Notification
              </DialogTitle>
              <DialogDescription>
                Update order #{statusModalOrder?.orderNumber} and select which WhatsApp message or template to send to the customer.
              </DialogDescription>
            </DialogHeader>

            {statusModalOrder && (
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
                      {statusModalOrder.customerPhone || "⚠️ No phone number provided"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({statusModalOrder.customerName})
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 pt-0.5 border-t border-emerald-200/50 dark:border-emerald-900/50 flex justify-between">
                    <span>Order: <strong>#{statusModalOrder.orderNumber}</strong></span>
                    <span>Total: <strong>{statusModalOrder.currency} {statusModalOrder.totalAmount}</strong></span>
                    <span>Current: <Badge className={`text-[10px] py-0 ${STATUS_COLORS[statusModalOrder.status] || ""}`}>{statusModalOrder.status}</Badge></span>
                  </div>
                </div>

                {/* New Status Select */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Select New Status *
                  </label>
                  <Select
                    value={statusModalNewStatus}
                    onValueChange={handleStatusChangeInModal}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="PROCESSING">Processing</SelectItem>
                      <SelectItem value="SHIPPED">Shipped</SelectItem>
                      <SelectItem value="DELIVERED">Delivered</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
                    onValueChange={handleTemplateChangeInModal}
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
                        Common Order Templates
                      </div>
                      <SelectItem value="order_update">
                        📦 order_update (Order Status Notification)
                      </SelectItem>
                      <SelectItem value="order_confirmation">
                        ✅ order_confirmation (Order Confirmation)
                      </SelectItem>
                      <SelectItem value="order_status">
                        📋 order_status (General Status Update)
                      </SelectItem>
                      <SelectItem value="order_shipped">
                        🚚 order_shipped (Shipping / Out for Delivery)
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
                        placeholder="e.g. kfc_order_confirmed"
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

                {/* Dynamic Variables and Live Preview */}
                {statusModalTemplate === "none" ? (
                  <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-xs">
                    <p className="text-amber-800 dark:text-amber-300 font-medium">
                      ⚠️ No WhatsApp message will be sent. Order status will be updated silently.
                    </p>
                  </div>
                ) : statusModalTemplate === "default" ? (
                  <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        💬 Standard WhatsApp Message Preview:
                      </span>
                      <Badge variant="outline" className="text-[10px]">24hr Window Only</Badge>
                    </div>
                    <div className="font-mono text-[11px] bg-background p-2.5 rounded border border-border whitespace-pre-wrap leading-relaxed">
                      {`📦 Order Status Update: ${statusModalNewStatus}

Hello ${statusModalOrder.customerName || "Customer"},
Your order #${statusModalOrder.orderNumber} is now ${statusModalNewStatus}.
Total: ${statusModalOrder.currency} ${statusModalOrder.totalAmount}
${statusModalOrder.deliveryAddress ? `Address: ${statusModalOrder.deliveryAddress}\n` : ""}
— Our Store`}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Detected Template Variables List with Inputs */}
                    {detectedVariables.length > 0 ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Template Variables ({detectedVariables.length} detected)
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            Values to inject:
                          </span>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {detectedVariables.map((v) => (
                            <div
                              key={v.id}
                              className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-1.5 transition-colors focus-within:border-emerald-500 focus-within:bg-emerald-50/20 dark:focus-within:bg-emerald-950/20"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-[10px] px-1.5 py-0 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 font-bold"
                                  >
                                    {v.placeholder}
                                  </Badge>
                                  <span className="truncate">{v.label}</span>
                                </span>
                                {v.example && (
                                  <span className="text-[10px] text-muted-foreground italic truncate max-w-[130px]">
                                    example: {v.example}
                                  </span>
                                )}
                              </div>
                              <Input
                                value={variableValues[v.id] ?? ""}
                                onChange={(e) =>
                                  setVariableValues((prev) => ({
                                    ...prev,
                                    [v.id]: e.target.value,
                                  }))
                                }
                                placeholder={v.example || `Value for ${v.placeholder}`}
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>This template has no dynamic placeholders (static template).</span>
                      </div>
                    )}

                    {/* Live WhatsApp Message Preview */}
                    {(() => {
                      const chosenTpl = templates.find((t) => t.name === statusModalTemplate);
                      const headerComp = chosenTpl?.components?.find((c: any) => c.type?.toUpperCase() === "HEADER");
                      const bodyComp = chosenTpl?.components?.find((c: any) => c.type?.toUpperCase() === "BODY");
                      const footerComp = chosenTpl?.components?.find((c: any) => c.type?.toUpperCase() === "FOOTER");
                      const buttonsComp = chosenTpl?.components?.find((c: any) => c.type?.toUpperCase() === "BUTTONS");

                      let headerText = headerComp?.text || "";
                      if (headerText) {
                        detectedVariables
                          .filter((v) => v.type === "header_text")
                          .forEach((v) => {
                            headerText = headerText.replaceAll(
                              v.placeholder,
                              variableValues[v.id] ?? v.defaultValue ?? `[${v.placeholder}]`
                            );
                          });
                      }

                      let bodyText = bodyComp?.text || "";
                      if (bodyText) {
                        detectedVariables
                          .filter((v) => v.type === "body")
                          .forEach((v) => {
                            bodyText = bodyText.replaceAll(
                              v.placeholder,
                              variableValues[v.id] ?? v.defaultValue ?? `[${v.placeholder}]`
                            );
                          });
                      } else if (!chosenTpl) {
                        bodyText = `Order update: ${statusModalOrder.customerName}, your order #${statusModalOrder.orderNumber} is now ${statusModalNewStatus}. Total: ${statusModalOrder.currency} ${statusModalOrder.totalAmount}`;
                      }

                      const footerText = footerComp?.text || "";

                      return (
                        <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                              Live WhatsApp Notification Preview
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {chosenTpl?.name || statusModalTemplate} ({chosenTpl?.language || "en"})
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-background border border-border shadow-xs text-xs space-y-2">
                            {headerText && (
                              <div className="font-bold text-foreground text-xs pb-1 border-b border-border/50">
                                {headerText}
                              </div>
                            )}
                            <div className="text-foreground whitespace-pre-wrap leading-relaxed text-xs">
                              {bodyText}
                            </div>
                            {footerText && (
                              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                                {footerText}
                              </div>
                            )}
                            {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
                              <div className="pt-2 border-t border-border flex flex-col gap-1">
                                {buttonsComp.buttons.map((btn: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="text-center py-1 px-2 rounded bg-muted text-emerald-700 dark:text-emerald-300 font-medium text-[11px]"
                                  >
                                    🔗 {btn.text || "Action Button"}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between">
                            <span>To WhatsApp: <strong>{statusModalOrder.customerPhone}</strong></span>
                            <Badge className="bg-emerald-600 text-white text-[9px] py-0">Order Notification</Badge>
                          </div>
                        </div>
                      );
                    })()}
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
                <Trash2 className="h-5 w-5" /> Delete Selected Orders
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedOrderIds.length} selected orders?
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
                {bulkActionLoading ? "Deleting..." : `Yes, Delete ${selectedOrderIds.length} Orders`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ORDER DETAILS MODAL */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            {selectedOrder && (
              <>
                <DialogHeader>
                  <div className="flex justify-between items-start pr-4">
                    <div>
                      <DialogTitle className="text-xl">Order #{selectedOrder.orderNumber}</DialogTitle>
                      <DialogDescription>
                        Placed on {new Date(selectedOrder.createdAt).toLocaleString()} via {selectedOrder.source}
                      </DialogDescription>
                    </div>
                    <Badge className={`text-xs ${STATUS_COLORS[selectedOrder.status] || ""}`}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-6 py-2">
                  {/* Customer Info */}
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Customer Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Name:</span>
                        <p className="font-medium">{selectedOrder.customerName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Phone:</span>
                        <p className="font-medium flex items-center gap-1">
                          {selectedOrder.customerPhone}
                          <a
                            href={`https://wa.me/${selectedOrder.customerPhone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline inline-flex items-center text-xs"
                          >
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </p>
                      </div>
                    </div>
                    <div className="pt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Delivery Address:
                      </span>
                      <p className="text-sm font-medium mt-0.5">{selectedOrder.deliveryAddress}</p>
                    </div>
                  </div>

                  {/* Items Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" /> Ordered Products
                    </h4>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {Array.isArray(selectedOrder.items) &&
                        selectedOrder.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 text-sm">
                            <div>
                              <p className="font-medium">{item.productName}</p>
                              {item.variant && (
                                <p className="text-xs text-muted-foreground">Variant: {item.variant}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Qty: {item.quantity} × {selectedOrder.currency} {item.unitPrice}
                              </p>
                            </div>
                            <span className="font-semibold">
                              {selectedOrder.currency} {item.subtotal || item.quantity * item.unitPrice}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm bg-muted/30">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{selectedOrder.currency} {selectedOrder.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Delivery Charges</span>
                      <span>{selectedOrder.currency} {selectedOrder.deliveryFee}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border">
                      <span>Total Amount</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {selectedOrder.currency} {selectedOrder.totalAmount}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 flex justify-between">
                      <span>Payment Method: {selectedOrder.paymentMethod}</span>
                      <span>Payment: {selectedOrder.paymentStatus}</span>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="rounded-lg border border-border p-3 bg-muted/10 text-xs">
                      <span className="font-semibold text-muted-foreground">Notes:</span>
                      <p className="mt-1 whitespace-pre-wrap">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex justify-between items-center sm:justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleOpenStatusModal(selectedOrder)}
                      className="gap-1.5 text-emerald-600"
                    >
                      <Send className="h-4 w-4" /> Change Status & Send Template
                    </Button>
                    {selectedOrder.contactId && (
                      <Link href={`/live-chat?contactId=${selectedOrder.contactId}`}>
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

        {/* CREATE MANUAL ORDER MODAL */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Manual Order</DialogTitle>
              <DialogDescription>
                Record an order received via call, counter, or external channels.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div>
                <label className="text-xs font-medium">Customer Name *</label>
                <Input
                  placeholder="Full Name"
                  value={newOrderForm.customerName}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Customer Phone *</label>
                <Input
                  placeholder="Phone/WhatsApp Number"
                  value={newOrderForm.customerPhone}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, customerPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Delivery Address *</label>
                <Input
                  placeholder="Full street address, city"
                  value={newOrderForm.deliveryAddress}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, deliveryAddress: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Product Name *</label>
                  <Input
                    placeholder="e.g. Cotton Shirt"
                    value={newOrderForm.productName}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, productName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Variant / Size</label>
                  <Input
                    placeholder="e.g. Medium, Black"
                    value={newOrderForm.variant}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, variant: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium">Quantity</label>
                  <Input
                    type="number"
                    value={newOrderForm.quantity}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Unit Price</label>
                  <Input
                    type="number"
                    value={newOrderForm.unitPrice}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, unitPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Delivery Fee</label>
                  <Input
                    type="number"
                    value={newOrderForm.deliveryFee}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, deliveryFee: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Notes</label>
                <Input
                  placeholder="Special delivery notes..."
                  value={newOrderForm.notes}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateManualOrder} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Create Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayoutClient>
  );
}
