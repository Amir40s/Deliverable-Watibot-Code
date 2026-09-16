"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Download,
  RefreshCw,
  ShoppingCart,
  Box,
  Users,
  Eye,
  EyeOff,
  TrendingUp,
  Coins,
  Activity,
  Bell,
  MessageSquare,
  MessageSquare as MessageCircle,
  Rewind,
  FileSpreadsheet,
  FileText,
  Clock,
  Check,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  User,
  Tag,
  Receipt,
  Send,
  Sparkles,
  SlidersHorizontal,
  ArrowDown,
  X,
  Package,
  Search,
  Blocks,
  Unlink,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getWooCommerceOrders,
  getWooCommerceProducts,
  getWooCommerceCustomers,
  bulkFulfillWooCommerceOrders,
  fulfillWooCommerceOrder,
  sendWooCommercePendingOrdersWhatsAppBroadcast,
} from "@/app/actions/woocommerce-integration";
import { disconnectIntegration } from "@/app/actions/organization";
import { Switch } from "@/components/ui/switch";
import { WhatsAppTemplatePreview } from "@/components/whatsapp/WhatsAppTemplatePreview";
import { getFlows } from "@/app/actions/flows";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const WOOCOMMERCE_FIELDS = [
  { value: "number", labelKey: "fields.orderNumber" },
  { value: "total", labelKey: "fields.totalPrice" },
  { value: "currency", labelKey: "fields.currency" },
  { value: "billing.first_name", labelKey: "fields.customerFirstName" },
  { value: "billing.last_name", labelKey: "fields.customerLastName" },
  { value: "billing.phone", labelKey: "fields.customerPhone" },
  { value: "billing.email", labelKey: "fields.customerEmail" },
  { value: "shipping.address_1", labelKey: "fields.shippingAddress" },
  { value: "shipping.city", labelKey: "fields.shippingCity" },
  { value: "payment_method_title", labelKey: "fields.paymentMethod" },
  { value: "status", labelKey: "fields.orderStatus" },
  { value: "items_summary", labelKey: "fields.itemsSummary" },
];

const WOOCOMMERCE_VARIABLES = [
  { label: "Customer First Name", value: "customer.first_name" },
  { label: "Customer Last Name", value: "customer.last_name" },
  { label: "Customer Full Name", value: "customer.name" },
  { label: "Customer Phone", value: "customer.phone" },
  { label: "Customer Email", value: "customer.email" },
  { label: "Order Number", value: "order_number" },
  { label: "Total Price", value: "total_price" },
  { label: "Currency", value: "currency" },
  { label: "Payment Method", value: "payment_method" },
  { label: "Items Summary", value: "items_summary" },
  { label: "Shipping Address", value: "shipping_address" },
  { label: "Store URL", value: "shop_url" },
];

const detectPlaceholders = (text: string): number[] => {
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  const numbers = matches
    .map((m) => parseInt(m.replace(/[{}]/g, ""), 10))
    .filter((n) => !isNaN(n));
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
};

const RTL_LOCALES = new Set(["ar", "ur"]);
const LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  ur: "ur-PK",
  hi: "hi-IN",
  bn: "bn-BD",
  en: "en-US",
};

const AUTOMATION_MODULE_KEYS: Record<string, string> = {
  order_confirmation: "orderConfirmation",
  order_fulfillment: "orderShipped",
  abandoned_checkout: "abandonedCheckout",
  order_cancellation: "orderCancelled",
  admin_notification: "adminNotification",
  rewind: "rewind",
};

function WooCommerceOrderDetailsDialog({
  order,
  isOpen,
  onClose,
  storeUrl,
  products = [],
  onFulfill,
  isFulfilling = false,
}: {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  storeUrl: string | null;
  products?: any[];
  onFulfill?: (orderId: string) => Promise<void>;
  isFulfilling?: boolean;
}) {
  if (!order) return null;

  const rawStatus = String(order.status || "").toLowerCase();
  const isCancelled = ["cancelled", "canceled", "refunded", "failed"].includes(rawStatus);
  const isConfirmed = !isCancelled && ["completed", "processing"].includes(rawStatus);
  const isCompleted = rawStatus === "completed";

  const shipping = order.shippingAddress;
  const billing = order.billingAddress;
  const waPhone = String(order.customerPhone || "").replace(/[^0-9]/g, "");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose={true} className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 font-black text-sm">
              #{order.orderNumber}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Order #{order.orderNumber}
                </h2>
                {isCancelled ? (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 text-[11px] font-bold">
                    Cancelled
                  </Badge>
                ) : isCompleted ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 text-[11px] font-bold">
                    Completed
                  </Badge>
                ) : isConfirmed ? (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 text-[11px] font-bold">
                    Processing
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 text-[11px] font-bold">
                    Pending
                  </Badge>
                )}
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px]">
                  {order.channel || "WooCommerce"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {storeUrl && (
              <a
                href={`${storeUrl.replace(/\/$/, '')}/wp-admin/post.php?post=${order.id}&action=edit`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span>Woo Admin</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            )}
            {waPhone && (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition-all shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 cols): Line Items & Payment Breakdown */}
            <div className="lg:col-span-8 space-y-5">
              {/* Line Items Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Line Items ({order.lineItems?.length || 0})
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {order.status}
                  </Badge>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {order.lineItems && order.lineItems.length > 0 ? (
                    order.lineItems.map((item: any, idx: number) => {
                      const matchedProduct = products.find((p) => p.id === item.productId || p.sku === item.sku);
                      const imgSrc = item.imageUrl || matchedProduct?.imageUrl;

                      return (
                        <div key={idx} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-lg border border-slate-200/80 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                              {imgSrc ? (
                                <img src={imgSrc} alt={item.title || item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Box className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {item.title || item.name || "Product"}
                              </p>
                              {item.sku && (
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  SKU: {item.sku}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500">
                                {order.currency || "$"}{item.price} × {item.quantity}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {order.currency || "$"}{item.total || (Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No line items recorded.
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Breakdown Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Payment Breakdown</span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[11px] font-bold",
                    isConfirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    isCancelled ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {isConfirmed ? "Paid" : isCancelled ? "Refunded" : "Pending"}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {order.currency || "$"}{order.subtotalPrice || order.totalPrice}
                    </span>
                  </div>

                  {Number(order.totalDiscounts) > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discounts</span>
                      <span>-{order.currency || "$"}{order.totalDiscounts}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Shipping ({order.deliveryMethod || "Standard"})</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {order.currency || "$"}{order.totalShipping || "0.00"}
                    </span>
                  </div>

                  {Number(order.totalTax) > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Tax</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {order.currency || "$"}{order.totalTax}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
                    <span>Total Amount</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-base">
                      {order.currency || "$"}{order.totalPrice}
                    </span>
                  </div>
                </div>

                {order.paymentMethod && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Payment Method: <strong className="text-slate-700 dark:text-slate-300">{order.paymentMethod}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (4 cols): Customer Profile, Shipping, Billing, Tags */}
            <div className="lg:col-span-4 space-y-5">
              {/* Customer Details */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer Details</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-sm font-bold text-purple-700 dark:text-purple-300 shrink-0">
                    {(order.customerName || "C").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {order.customerName || "Customer"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Order total: {order.currency || "$"}{order.totalPrice}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {order.customerEmail ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a href={`mailto:${order.customerEmail}`} className="text-blue-600 hover:underline truncate">
                          {order.customerEmail}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(order.customerEmail);
                          toast.success("Email copied");
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copy email"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <Mail className="w-3.5 h-3.5" />
                      <span>No email provided</span>
                    </div>
                  )}

                  {order.customerPhone ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-800 dark:text-slate-200 truncate">{order.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {waPhone && (
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-emerald-600 hover:text-emerald-700"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(order.customerPhone);
                            toast.success("Phone copied");
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Copy phone"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <Phone className="w-3.5 h-3.5" />
                      <span>No phone provided</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Shipping Address</span>
                </div>
                {shipping ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {[shipping.first_name, shipping.last_name].filter(Boolean).join(" ") || order.customerName}
                    </p>
                    {shipping.address_1 && <p>{shipping.address_1}</p>}
                    {shipping.address_2 && <p>{shipping.address_2}</p>}
                    <p>
                      {[shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(", ")}
                    </p>
                    {shipping.country && <p>{shipping.country}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No shipping address provided.</p>
                )}
              </div>

              {/* Order Notes & Tags */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Tag className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Tags & Notes</span>
                </div>

                {order.tags ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {order.tags.split(",").map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-semibold">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No tags assigned.</p>
                )}

                {order.note && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Customer Note</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 italic bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                      "{order.note}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 font-mono">
            WooCommerce ID: {order.id}
          </span>
          <div className="flex items-center gap-2">
            {!isCompleted && !isCancelled && onFulfill && (
              <Button
                type="button"
                size="sm"
                onClick={() => onFulfill(order.id)}
                disabled={isFulfilling}
                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm gap-1.5"
              >
                {isFulfilling ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Mark as Completed in WooCommerce</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 px-4 rounded-lg text-xs font-bold"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type WooCommerceTab =
  | "dashboard"
  | "setup"
  | "automation"
  | "orders"
  | "pending_reminders"
  | "products"
  | "customers";
type ExportableWooCommerceTab = Extract<WooCommerceTab, "orders" | "products" | "customers">;
type OrderDayFilter = "all" | "today" | "yesterday" | "last-7-days" | "last-30-days";
type ExportRow = Record<string, string | number>;
type ExportColumn = {
  key: string;
  header: string;
  width: string;
};
type ExportConfig = {
  title: string;
  sheetName: string;
  fileName: string;
  columns: ExportColumn[];
  rows: ExportRow[];
};

const isExportableTab = (tab: WooCommerceTab): tab is ExportableWooCommerceTab =>
  ["orders", "products", "customers"].includes(tab);

const exportPdfStyles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#10b981",
    marginBottom: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    fontSize: 18,
    fontWeight: "bold",
  },
  title: {
    marginTop: 4,
    fontSize: 10,
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  meta: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "right",
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    minHeight: 28,
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1.5,
    borderBottomColor: "#10b981",
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: "center",
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#475569",
    textTransform: "uppercase",
  },
  tableCellText: {
    fontSize: 8,
    color: "#0f172a",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

function WooCommerceExportPDF({
  title,
  columns,
  rows,
  generatedAt,
}: {
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={exportPdfStyles.page}>
        <View style={exportPdfStyles.header}>
          <View>
            <Text style={exportPdfStyles.brand}>WatiBot</Text>
            <Text style={exportPdfStyles.title}>{title}</Text>
          </View>
          <Text style={exportPdfStyles.meta}>Generated on{"\n"}{generatedAt}</Text>
        </View>

        <View style={exportPdfStyles.table}>
          <View style={[exportPdfStyles.tableRow, exportPdfStyles.tableHeader]} fixed>
            {columns.map((column) => (
              <View key={column.key} style={[exportPdfStyles.tableCell, { width: column.width }]}>
                <Text style={exportPdfStyles.tableHeaderText}>{column.header}</Text>
              </View>
            ))}
          </View>
          {rows.map((row, index) => (
            <View key={index} style={exportPdfStyles.tableRow} wrap={false}>
              {columns.map((column) => (
                <View key={column.key} style={[exportPdfStyles.tableCell, { width: column.width }]}>
                  <Text style={exportPdfStyles.tableCellText}>{String(row[column.key] ?? "")}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text style={exportPdfStyles.footer} fixed>
          WooCommerce integration export - {rows.length} records
        </Text>
      </Page>
    </Document>
  );
}

function toExportValue(value: unknown, fallback: string | number = "") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  return String(value);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const WooCommerceIcon = ({
  className = "w-12 h-12",
}: {
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="none"
  >
    <path
      d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z"
      fill="#96588A"
    />
    <path
      d="M17.3 8.3c-.2-.1-.4-.2-.7-.2-.2 0-.4 0-.5.1l-4.5 9-1.9-4.7L8 15.6l-2-5.4c-.1-.4.1-.8.5-.9.4-.1.8.1.9.5l1.1 3 1.1-2.4c.1-.2.3-.3.5-.3h.1c.2 0 .4.2.5.4l2 5.23.4-7.4c.1-.4.4-.6.8-.5.4.1.6.5.5.8L13 18l4.8-9.1c.2-.3.6-.4.9-.2.3.2.4.6.2.9L14.7 18h-.1l4.9-9.1c.2-.3.1-.7-.2-.8z"
      fill="#FFFFFF"
    />
  </svg>
);

export default function WooCommerceIntegrationPage() {
  const t = useTranslations("WooCommerceIntegrationPage");
  const locale = useLocale();
  const isRtl = RTL_LOCALES.has(locale);
  const intlLocale = LOCALE_MAP[locale] ?? locale;
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [shopName, setShopName] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [activeTab, setActiveTab] = useState<WooCommerceTab>("setup");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderTagFilter, setOrderTagFilter] = useState("all");
  const [orderFromDate, setOrderFromDate] = useState("");
  const [orderToDate, setOrderToDate] = useState("");
  const [orderFromTime, setOrderFromTime] = useState("");
  const [orderToTime, setOrderToTime] = useState("");

  // Orders & Advanced Filter States
  const [orderDateRange, setOrderDateRange] = useState<"all" | "today" | "yesterday" | "last-7-days" | "last-30-days" | "custom">("all");
  const [orderConfirmationFilter, setOrderConfirmationFilter] = useState<"all" | "confirmed" | "pending" | "cancelled">("all");
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState("all");
  const [orderFulfillmentStatusFilter, setOrderFulfillmentStatusFilter] = useState("all");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderQuickTab, setOrderQuickTab] = useState<"all" | "unfulfilled" | "unpaid" | "open" | "archived">("all");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any | null>(null);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);

  // Bulk Fulfillment State
  const [isBulkFulfilling, setIsBulkFulfilling] = useState(false);
  const [isFulfillDialogOpen, setIsFulfillDialogOpen] = useState(false);
  const [isFulfillingSingleId, setIsFulfillingSingleId] = useState<string | null>(null);

  // Pending Orders Broadcast State
  const [pendingFilterDateRange, setPendingFilterDateRange] = useState<"all" | "today" | "yesterday" | "this-week" | "last-7-days" | "last-30-days" | "custom">("all");
  const [pendingFromDate, setPendingFromDate] = useState("");
  const [pendingToDate, setPendingToDate] = useState("");
  const [pendingSelectedTemplate, setPendingSelectedTemplate] = useState<string>("");
  const [pendingVariableMappings, setPendingVariableMappings] = useState<Record<string, string>>({
    "1": "customer.first_name",
    "2": "order_number",
    "3": "total_price",
  });
  const [selectedPendingOrderIds, setSelectedPendingOrderIds] = useState<string[]>([]);
  const [isSendingPendingBroadcast, setIsSendingPendingBroadcast] = useState(false);
  const [pendingBroadcastResult, setPendingBroadcastResult] = useState<any | null>(null);
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");

  // Automation States
  const [automationSettings, setAutomationSettings] = useState<any>({
    order_confirmation: {
      active: false,
      template: "",
      mappings: { "1": "number", "2": "total" },
      delay: 0,
    },
    order_fulfillment: {
      active: false,
      template: "",
      mappings: { "1": "number" },
      delay: 0,
    },
    order_cancellation: {
      active: false,
      template: "",
      mappings: { "1": "number" },
      delay: 0,
    },
    abandoned_checkout: {
      active: false,
      template: "",
      mappings: { "1": "billing.first_name" },
      delay: 0,
    },
    admin_notification: {
      active: false,
      template: "",
      mappings: { "1": "number" },
      adminPhone: "",
      delay: 0,
    },
    rewind: {
      active: false,
      template: "",
      mappings: {},
      buttonActions: {},
      delay: 0,
    },
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [dbFlows, setDbFlows] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Settings Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<string | null>(null);

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return t("fallback.notAvailable");
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return t("fallback.notAvailable");
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed);
  };

  const formatTime = (date: string | Date | null | undefined) => {
    if (!date) return "";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat(intlLocale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  };

  const formatDateTime = (date: string | Date | null | undefined) => {
    const dateText = formatDate(date);
    const timeText = formatTime(date);
    return timeText ? `${dateText} ${timeText}` : dateText;
  };

  const getModuleTitle = (key: string) => {
    const moduleKey = AUTOMATION_MODULE_KEYS[key];
    return moduleKey ? t(`automation.modules.${moduleKey}.title`) : key;
  };

  const getModuleDescription = (key: string) => {
    const moduleKey = AUTOMATION_MODULE_KEYS[key];
    return moduleKey ? t(`automation.modules.${moduleKey}.description`) : "";
  };

  const formatOrderCount = (count: number) =>
    `${count} ${count === 1 ? t("counts.order") : t("counts.orders")}`;

  const formatStatus = (status: string) => {
    const normalized = status?.toLowerCase() || "unknown";
    const statusMap: Record<string, string> = {
      completed: t("orderStatuses.completed"),
      processing: t("orderStatuses.processing"),
      pending: t("orderStatuses.pending"),
      cancelled: t("orderStatuses.cancelled"),
      canceled: t("orderStatuses.cancelled"),
      unknown: t("orderStatuses.unknown"),
    };
    return statusMap[normalized] ?? status;
  };

  const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getStartOfLocalDay = (date = new Date()) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const getRowDate = (value: string | Date | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const normalizeFilterValue = (value: unknown) =>
    String(value ?? "").trim().toLowerCase();

  const getOrderTags = (tags: unknown) => {
    if (Array.isArray(tags)) {
      return tags.map((tag) => String(tag).trim()).filter(Boolean);
    }

    return String(tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const isCancelledOrder = (order: any) => {
    const status = String(order.status || "").toLowerCase();
    if (["cancelled", "canceled", "refunded", "failed"].includes(status)) return true;
    const tags = String(order.tags || "").toLowerCase();
    if (tags.includes("cancel") || tags.includes("cancelled") || tags.includes("canceled")) return true;
    return false;
  };

  const isConfirmedOrder = (order: any) => {
    if (isCancelledOrder(order)) return false;
    const status = String(order.status || "").toLowerCase();
    return ["completed", "processing"].includes(status);
  };

  const isPendingOrder = (order: any) => {
    if (isCancelledOrder(order)) return false;
    const status = String(order.status || "").toLowerCase();
    return ["pending", "on-hold", "on_hold"].includes(status) || status !== "completed";
  };

  const orderMatchesDateRange = (createdAt: Date | null) => {
    if (orderDateRange === "all") return true;
    if (!createdAt) return false;

    const now = new Date();
    const todayStart = getStartOfLocalDay(now);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    if (orderDateRange === "today") {
      return createdAt >= todayStart && createdAt <= todayEnd;
    }

    if (orderDateRange === "yesterday") {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      return createdAt >= yesterdayStart && createdAt <= yesterdayEnd;
    }

    if (orderDateRange === "last-7-days") {
      const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      return createdAt >= sevenDaysAgo && createdAt <= todayEnd;
    }

    if (orderDateRange === "last-30-days") {
      const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      return createdAt >= thirtyDaysAgo && createdAt <= todayEnd;
    }

    if (orderDateRange === "custom") {
      if (orderFromDate) {
        const fromDateStart = new Date(orderFromDate + "T00:00:00");
        if (createdAt < fromDateStart) return false;
      }
      if (orderToDate) {
        const toDateEnd = new Date(orderToDate + "T23:59:59.999");
        if (createdAt > toDateEnd) return false;
      }
      if (orderFromTime) {
        const [fromHour, fromMin] = orderFromTime.split(":").map(Number);
        const orderMinutes = createdAt.getHours() * 60 + createdAt.getMinutes();
        const fromMinutes = fromHour * 60 + fromMin;
        if (orderMinutes < fromMinutes) return false;
      }
      if (orderToTime) {
        const [toHour, toMin] = orderToTime.split(":").map(Number);
        const orderMinutes = createdAt.getHours() * 60 + createdAt.getMinutes();
        const toMinutes = toHour * 60 + toMin;
        if (orderMinutes > toMinutes) return false;
      }
    }

    return true;
  };

  const orderMatchesFilters = (order: any) => {
    // Quick Tab filter (All, Unfulfilled, Unpaid, Open, Archived)
    const rawStatus = String(order.status || "").toLowerCase();
    if (orderQuickTab === "unfulfilled") {
      if (rawStatus === "completed" || isCancelledOrder(order)) return false;
    } else if (orderQuickTab === "unpaid") {
      if (rawStatus === "completed" || rawStatus === "processing" || isCancelledOrder(order)) return false;
    } else if (orderQuickTab === "open") {
      if (isCancelledOrder(order)) return false;
    } else if (orderQuickTab === "archived") {
      if (!isCancelledOrder(order)) return false;
    }

    // Confirmation Status filter (Confirmed vs Pending vs Cancelled)
    if (orderConfirmationFilter === "confirmed") {
      if (isCancelledOrder(order) || !isConfirmedOrder(order)) return false;
    } else if (orderConfirmationFilter === "pending") {
      if (isCancelledOrder(order) || !isPendingOrder(order)) return false;
    } else if (orderConfirmationFilter === "cancelled") {
      if (!isCancelledOrder(order)) return false;
    }

    // Status filter
    if (orderStatusFilter !== "all" && normalizeFilterValue(order.status || "unknown") !== orderStatusFilter) {
      return false;
    }

    // Tag filter
    if (
      orderTagFilter !== "all" &&
      !getOrderTags(order.tags).some((tag) => normalizeFilterValue(tag) === orderTagFilter)
    ) {
      return false;
    }

    // Date Range
    const createdAt = getRowDate(order.createdAt);
    if (!orderMatchesDateRange(createdAt)) return false;

    // Search query filter
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      const orderNum = String(order.orderNumber || "").toLowerCase();
      const customer = String(order.customerName || "").toLowerCase();
      const email = String(order.customerEmail || "").toLowerCase();
      const phone = String(order.customerPhone || "").toLowerCase();
      const tags = String(order.tags || "").toLowerCase();
      const total = String(order.totalPrice || "").toLowerCase();
      if (
        !orderNum.includes(q) &&
        !customer.includes(q) &&
        !email.includes(q) &&
        !phone.includes(q) &&
        !tags.includes(q) &&
        !total.includes(q)
      ) {
        return false;
      }
    }

    return true;
  };

  const clearOrderFilters = () => {
    setOrderStatusFilter("all");
    setOrderTagFilter("all");
    setOrderDateRange("all");
    setOrderConfirmationFilter("all");
    setOrderPaymentStatusFilter("all");
    setOrderFulfillmentStatusFilter("all");
    setOrderFromDate("");
    setOrderToDate("");
    setOrderFromTime("");
    setOrderToTime("");
    setOrderSearchQuery("");
    setOrderQuickTab("all");
  };

  // Pending Orders Broadcast Filtering Logic
  const allPendingOrders = orders.filter((o) => isPendingOrder(o));

  const filteredPendingOrders = allPendingOrders.filter((order) => {
    const createdAt = getRowDate(order.createdAt);
    if (!createdAt) return true;

    const now = new Date();
    const todayStart = getStartOfLocalDay(now);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    if (pendingFilterDateRange === "today") {
      if (createdAt < todayStart || createdAt > todayEnd) return false;
    } else if (pendingFilterDateRange === "yesterday") {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(todayStart.getTime() - 1);
      if (createdAt < yesterdayStart || createdAt > yesterdayEnd) return false;
    } else if (pendingFilterDateRange === "this-week") {
      const dayOfWeek = now.getDay();
      const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      if (createdAt < firstDayOfWeek) return false;
    } else if (pendingFilterDateRange === "last-7-days") {
      const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (createdAt < sevenDaysAgo || createdAt > todayEnd) return false;
    } else if (pendingFilterDateRange === "last-30-days") {
      const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (createdAt < thirtyDaysAgo || createdAt > todayEnd) return false;
    } else if (pendingFilterDateRange === "custom") {
      if (pendingFromDate) {
        const fromDateStart = new Date(pendingFromDate + "T00:00:00");
        if (createdAt < fromDateStart) return false;
      }
      if (pendingToDate) {
        const toDateEnd = new Date(pendingToDate + "T23:59:59.999");
        if (createdAt > toDateEnd) return false;
      }
    }

    if (pendingSearchQuery.trim()) {
      const q = pendingSearchQuery.toLowerCase().trim();
      const orderNum = String(order.orderNumber || "").toLowerCase();
      const customer = String(order.customerName || "").toLowerCase();
      const phone = String(order.customerPhone || "").toLowerCase();
      if (!orderNum.includes(q) && !customer.includes(q) && !phone.includes(q)) return false;
    }

    return true;
  });

  const handlePendingTemplateChange = (templateName: string) => {
    setPendingSelectedTemplate(templateName);
    const tpl = templates.find((t) => t.name === templateName);
    const bodyComp = tpl?.components?.find((c: any) => c.type === "BODY");
    const placeholders = bodyComp?.text ? detectPlaceholders(bodyComp.text) : [];
    const initialMappings: Record<string, string> = { ...pendingVariableMappings };
    placeholders.forEach((num, idx) => {
      if (!initialMappings[num.toString()]) {
        if (idx === 0) initialMappings[num.toString()] = "customer.first_name";
        else if (idx === 1) initialMappings[num.toString()] = "order_number";
        else if (idx === 2) initialMappings[num.toString()] = "total_price";
        else initialMappings[num.toString()] = "shop_url";
      }
    });
    setPendingVariableMappings(initialMappings);
  };

  const handleSendPendingBroadcast = async () => {
    if (!pendingSelectedTemplate) {
      toast.error("Please select a WhatsApp template");
      return;
    }

    const targetOrders = filteredPendingOrders.filter((o) => selectedPendingOrderIds.includes(o.id));
    if (targetOrders.length === 0) {
      toast.error("Please select at least 1 pending order to send reminders");
      return;
    }

    const tpl = templates.find((t) => t.name === pendingSelectedTemplate);
    setIsSendingPendingBroadcast(true);
    const toastId = toast.loading(`Sending WhatsApp reminder to ${targetOrders.length} pending orders...`);

    try {
      const res = await sendWooCommercePendingOrdersWhatsAppBroadcast({
        orders: targetOrders,
        templateName: pendingSelectedTemplate,
        templateLanguage: tpl?.language || "en",
        variableMappings: pendingVariableMappings,
      });

      if (res.success) {
        toast.success(`Successfully sent ${res.sentCount} reminders! (${res.failedCount} failed)`, { id: toastId });
        setPendingBroadcastResult(res);
      } else {
        toast.error("Failed to send WhatsApp broadcast", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send broadcast", { id: toastId });
    } finally {
      setIsSendingPendingBroadcast(false);
    }
  };

  const handleBulkFulfill = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkFulfilling(true);
    try {
      const res = await bulkFulfillWooCommerceOrders(selectedOrderIds);
      if (res.success) {
        if (res.failedCount === 0) {
          toast.success(`Successfully completed all ${res.fulfilledCount} orders in WooCommerce!`);
        } else {
          toast.warning(`Completed ${res.fulfilledCount} orders (${res.failedCount} failed).`);
        }
        setIsFulfillDialogOpen(false);
        setSelectedOrderIds([]);
        await loadStoreData();
      } else {
        toast.error("Failed to complete orders in WooCommerce.");
      }
    } catch (err: any) {
      console.error("Bulk fulfill error:", err);
      toast.error(err.message || "Failed to complete orders in WooCommerce.");
    } finally {
      setIsBulkFulfilling(false);
    }
  };

  const handleSingleFulfill = async (orderId: string) => {
    setIsFulfillingSingleId(orderId);
    try {
      const res = await fulfillWooCommerceOrder(orderId);
      if (res.success) {
        toast.success(res.message || `Order #${orderId} marked as completed in WooCommerce!`);
        await loadStoreData();
        if (selectedOrderForDetails && String(selectedOrderForDetails.id) === String(orderId)) {
          setSelectedOrderForDetails((prev: any) =>
            prev ? { ...prev, status: "completed" } : null
          );
        }
      } else {
        toast.error("Failed to complete order in WooCommerce.");
      }
    } catch (err: any) {
      console.error("Single fulfill error:", err);
      toast.error(err.message || "Failed to complete order in WooCommerce.");
    } finally {
      setIsFulfillingSingleId(null);
    }
  };

  const isConnected = !!orgData?.woocommerceWebhookSecret;
  const tSafe = (key: string, fallback: string) => {
    try {
      const value = t(key);
      return value === key || value === `WooCommerceIntegrationPage.${key}`
        ? fallback
        : value;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    fetchOrgDetails();
    fetchTemplates();
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      const res = await getFlows();
      if (res.flows) setDbFlows(res.flows);
    } catch (error) {
      console.error("Failed to fetch flows:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
            const res = await getMessageTemplates();
      if (res.success) setTemplates(res.data);
    } catch (error) {
      console.error("Failed to fetch templates");
    }
  };

  const fetchOrgDetails = async () => {
    try {
      const res = await fetch("/api/organization/details");
      const data = await res.json();
      setOrgData(data);
      if (data.woocommerceStoreUrl) {
        setShopUrl(data.woocommerceStoreUrl);
        if (data.woocommerceConsumerKey)
          setConsumerKey(data.woocommerceConsumerKey);
        if (data.woocommerceConsumerSecret)
          setConsumerSecret(data.woocommerceConsumerSecret);

        // Load automation settings if they exist
        if (data.woocommerceAutomation) {
          setAutomationSettings((prev: any) => {
            const merged = { ...prev, ...data.woocommerceAutomation };
            merged.admin_notification = {
              ...prev.admin_notification,
              ...(data.woocommerceAutomation.admin_notification || {})
            };
            merged.rewind = {
              ...prev.rewind,
              ...(data.woocommerceAutomation.rewind || {})
            };
            return merged;
          });
        }

        loadStoreData();

        // Switch to dashboard tab if WooCommerce is connected
        if (data.woocommerceWebhookSecret) {
          setActiveTab("dashboard");
        }
      }
    } catch (error) {
      console.error("Failed to fetch organization details");
    }
  };

  const handleSaveAutomation = async (key: string, updates: any) => {
    // If template is being updated, also save its structure and clean mappings
    if (updates.template) {
      const template = templates.find(t => t.name === updates.template);
      if (template) {
        const headerText = template.components?.find((c: any) => c.type === "HEADER")?.text || "";
        const bodyText = template.components?.find((c: any) => c.type === "BODY")?.text || "";
        
        const headerVars = Array.from(headerText.matchAll(/\{\{(\d+)\}\}/g)).length;
        const bodyVars = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g)).length;
        
        updates.structure = {
          header: headerVars,
          body: bodyVars
        };

        // CLEAN MAPPINGS: Only keep variables that actually exist in the new template
        const totalVars = headerVars + bodyVars;
        const currentMappings = updates.mappings || automationSettings[key].mappings || {};
        const cleanedMappings: any = {};
        
        for (let i = 1; i <= totalVars; i++) {
          if (currentMappings[i.toString()]) {
            cleanedMappings[i.toString()] = currentMappings[i.toString()];
          }
        }
        updates.mappings = cleanedMappings;
      }
    }

    const newSettings = {
      ...automationSettings,
      [key]: { ...automationSettings[key], ...updates },
    };
    setAutomationSettings(newSettings);

    // Save to DB
    setIsSaving(true);
    try {
      const res = await fetch("/api/woocommerce/save-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation: newSettings }),
      });
      if (res.ok) {
        toast.success(t("toasts.automationUpdated"));
      } else {
        toast.error(t("toasts.automationSaveError"));
      }
    } catch (error) {
      toast.error(t("toasts.settingsError"));
    } finally {
      setIsSaving(false);
    }
  };

  const loadStoreData = async () => {
    setIsFetchingData(true);
    try {
      const [ordersData, productsData, customersData] = await Promise.all([
        getWooCommerceOrders(),
        getWooCommerceProducts(),
        getWooCommerceCustomers(),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Failed to load store data", error);
    } finally {
      setIsFetchingData(false);
    }
  };

  const getTemplateVariables = (templateName: string) => {
    const template = templates.find((t) => t.name === templateName);
    if (!template) return [];
    
    let allText = "";
    template.components?.forEach((c: any) => {
      if (c.text) allText += " " + c.text;
      if (c.format === "TEXT" && c.text) allText += " " + c.text;
    });

    const matches = Array.from(allText.matchAll(/\{\{(\d+)\}\}/g));
    const indices = Array.from(new Set(matches.map((m: any) => m[1]))).sort((a, b) => parseInt(a) - parseInt(b));
    return indices;
  };

  const getMappedValues = (mappings: any) => {
    const values: Record<string, string> = {};
    Object.entries(mappings || {}).forEach(([key, val]: [string, any]) => {
      const field = WOOCOMMERCE_FIELDS.find(f => f.value === val);
      values[key] = field ? `[${t(field.labelKey)}]` : String(val);
    });
    return values;
  };

  const handleConnect = async () => {
    if (!shopUrl || !consumerKey || !consumerSecret) {
      toast.error(t("toasts.fillFields"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/woocommerce/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName,
          shopUrl,
          consumerKey,
          consumerSecret,
        }),
      });   
      const data = await res.json();
      if (data.success) {
        toast.success(t("toasts.connected"));
        fetchOrgDetails();
      } else {
        toast.error(data.error || t("toasts.connectError"));
      }
    } catch (error) {
      toast.error(t("toasts.unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isConnected) return;

    setDisconnecting(true);
    try {
      const result = await disconnectIntegration("woocommerce");

      if (!result.success) {
        toast.error(result.error || tSafe("toasts.disconnectError", "Failed to disconnect WooCommerce"));
        return;
      }

      setOrgData((prev: any) => ({
        ...(prev || {}),
        woocommerceStoreUrl: null,
        woocommerceConsumerKey: null,
        woocommerceConsumerSecret: null,
        woocommerceWebhookSecret: null,
        woocommerceAutomation: null,
      }));
      setShopName("");
      setShopUrl("");
      setConsumerKey("");
      setConsumerSecret("");
      setOrders([]);
      setProducts([]);
      setCustomers([]);
      setActiveTab("setup");
      toast.success(tSafe("toasts.disconnected", "WooCommerce disconnected successfully."));
    } catch (error) {
      console.error("Failed to disconnect WooCommerce:", error);
      toast.error(tSafe("toasts.disconnectError", "Failed to disconnect WooCommerce"));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncAll = async () => {
    setLoading(true);
    try {
    const productRes = await fetch("/api/woocommerce/sync-products", {
        method: "POST",
      });
      const productData = await productRes.json();
      const orderRes = await fetch("/api/woocommerce/sync-orders", {
        method: "POST",
      });
      const orderData = await orderRes.json();

      if (productData.success || orderData.success) {
        toast.success(
          t("toasts.synced", {
            products: productData.count || 0,
            orders: orderData.count || 0,
          }),
        );
        loadStoreData();
      } else {
        toast.error(t("toasts.syncError"));
      }
    } catch (error) {
      toast.error(t("toasts.syncUnexpectedError"));
    } finally {
      setLoading(false);
    }
  };
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("toasts.copied", { label }));
  };

  const buildExportConfig = (tab: WooCommerceTab = activeTab): ExportConfig | null => {
    const dateStamp = new Date().toISOString().slice(0, 10);

    if (tab === "orders") {
      const columns: ExportColumn[] = [
        { key: "orderNumber", header: t("table.orderNumber"), width: "10%" },
        { key: "customerPhone", header: t("table.phone"), width: "13%" },
        { key: "customerEmail", header: t("table.email"), width: "16%" },
        { key: "products", header: "Ordered Products", width: "22%" },
        { key: "total", header: t("table.total"), width: "11%" },
        { key: "status", header: t("table.status"), width: "10%" },
        { key: "tags", header: t("table.tags"), width: "8%" },
        { key: "date", header: t("table.date"), width: "10%" },
      ];

      return {
        title: "WooCommerce Orders & Tags",
        sheetName: "Orders",
        fileName: `woocommerce-orders-${dateStamp}`,
        columns,
        rows: filteredOrders.map((order) => {
          const productsDisplay = (Array.isArray(order.lineItems) && order.lineItems.length > 0)
            ? order.lineItems.map((li: any) => `${li.title || li.name || 'Product'} x${li.quantity || 1}`).join(', ')
            : (order.productsSummary || "—");

          return {
            orderNumber: `#${toExportValue(order.orderNumber)}`,
            customerPhone: toExportValue(order.customerPhone, t("fallback.noPhone")),
            customerEmail: toExportValue(order.customerEmail, t("fallback.noEmail")),
            products: productsDisplay,
            total: `${toExportValue(order.currency)} ${toExportValue(order.totalPrice)}`.trim(),
            status: formatStatus(toExportValue(order.status, "unknown").toString()),
            tags: toExportValue(order.tags, t("fallback.notAvailable")),
            date: formatDateTime(order.createdAt),
          };
        }),
      };
    }

    if (tab === "products") {
      const columns: ExportColumn[] = [
        { key: "product", header: t("table.product"), width: "42%" },
        { key: "price", header: t("table.price"), width: "14%" },
        { key: "sku", header: t("table.sku"), width: "20%" },
        { key: "status", header: t("table.status"), width: "12%" },
        { key: "lastSynced", header: t("table.lastSynced"), width: "12%" },
      ];

      return {
        title: "WooCommerce Products",
        sheetName: "Products",
        fileName: `woocommerce-products-${dateStamp}`,
        columns,
        rows: products.map((product) => ({
          product: toExportValue(product.name, t("fallback.notAvailable")),
          price: `${toExportValue(product.currency)} ${toExportValue(product.price)}`.trim(),
          sku: toExportValue(product.sku, t("fallback.notAvailable")),
          status: formatStatus(toExportValue(product.status, "unknown").toString()),
          lastSynced: formatDate(product.updatedAt),
        })),
      };
    }

    if (tab === "customers") {
      const columns: ExportColumn[] = [
        { key: "customer", header: t("table.customer"), width: "42%" },
        { key: "phone", header: t("table.phone"), width: "24%" },
        { key: "orders", header: t("table.orders"), width: "14%" },
        { key: "lastOrder", header: t("table.lastOrder"), width: "20%" },
      ];

      return {
        title: "WooCommerce Customers",
        sheetName: "Customers",
        fileName: `woocommerce-customers-${dateStamp}`,
        columns,
        rows: customers.map((customer) => ({
          customer: toExportValue(customer.email, t("fallback.noEmail")),
          phone: toExportValue(customer.phone, t("fallback.noPhone")),
          orders: toExportValue(customer.orderCount, 0),
          lastOrder: formatDate(customer.lastOrderAt),
        })),
      };
    }

    return null;
  };

  const handleDownloadPdf = async () => {
    const exportConfig = buildExportConfig();

    if (!exportConfig || exportConfig.rows.length === 0) {
      toast.error(t("toasts.noRecordsToExport"));
      return;
    }

    setIsExportingPdf(true);
    const toastId = toast.loading(t("toasts.generatingPdf"));
    try {
      const generatedAt = new Intl.DateTimeFormat(intlLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());
      const blob = await pdf(
        <WooCommerceExportPDF
          title={exportConfig.title}
          columns={exportConfig.columns}
          rows={exportConfig.rows}
          generatedAt={generatedAt}
        />
      ).toBlob();

      downloadBlob(blob, `${exportConfig.fileName}.pdf`);
      toast.success(t("toasts.pdfDownloaded"), { id: toastId });
    } catch (error) {
      console.error("WooCommerce PDF export failed:", error);
      toast.error(t("toasts.exportFailed"), { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadExcel = () => {
    const exportConfig = buildExportConfig();

    if (!exportConfig || exportConfig.rows.length === 0) {
      toast.error(t("toasts.noRecordsToExport"));
      return;
    }

    setIsExportingExcel(true);
    const toastId = toast.loading(t("toasts.generatingExcel"));
    try {
      const worksheetRows = exportConfig.rows.map((row) =>
        Object.fromEntries(exportConfig.columns.map((column) => [column.header, row[column.key] ?? ""]))
      );
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
        header: exportConfig.columns.map((column) => column.header),
      });
      worksheet["!cols"] = exportConfig.columns.map((column) => ({
        wch: Math.max(12, column.header.length + 4),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, exportConfig.sheetName.slice(0, 31));
      XLSX.writeFile(workbook, `${exportConfig.fileName}.xlsx`);
      toast.success(t("toasts.excelDownloaded"), { id: toastId });
    } catch (error) {
      console.error("WooCommerce Excel export failed:", error);
      toast.error(t("toasts.exportFailed"), { id: toastId });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const currentModuleSettings = editingModule ? automationSettings[editingModule] : null;
  const hasOrderFilters = Boolean(
    orderStatusFilter !== "all" ||
    orderTagFilter !== "all" ||
    orderConfirmationFilter !== "all" ||
    orderPaymentStatusFilter !== "all" ||
    orderFulfillmentStatusFilter !== "all" ||
    orderDateRange !== "all" ||
    orderSearchQuery.trim() ||
    orderQuickTab !== "all" ||
    orderFromDate ||
    orderToDate ||
    orderFromTime ||
    orderToTime
  );
  const filteredOrders = orders.filter(orderMatchesFilters);
  const orderStatusOptions = Array.from(
    orders.reduce((map: Map<string, string>, order) => {
      const status = String(order.status || "unknown").trim() || "unknown";
      map.set(normalizeFilterValue(status), status);
      return map;
    }, new Map<string, string>())
  ).sort(([, firstStatus], [, secondStatus]) =>
    formatStatus(firstStatus).localeCompare(formatStatus(secondStatus))
  );
  const orderTagOptions = Array.from(
    orders.reduce((map: Map<string, string>, order) => {
      getOrderTags(order.tags).forEach((tag) => {
        map.set(normalizeFilterValue(tag), tag);
      });
      return map;
    }, new Map<string, string>())
  ).sort(([, firstTag], [, secondTag]) => firstTag.localeCompare(secondTag));

  // Dynamic dashboard calculations
  const confirmedOrders = orders.filter(
    (o) => o.status === "completed" || o.status === "processing"
  );
  const confirmedCount = confirmedOrders.length;
  
  const pendingOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "on-hold" || o.status === "on_hold"
  );
  const pendingCount = pendingOrders.length;

  const cancelledOrders = orders.filter(
    (o) => o.status === "cancelled" || o.status === "canceled"
  );
  const cancelledCount = cancelledOrders.length;

  const revenueByCurrency = confirmedOrders.reduce((acc: Record<string, number>, order) => {
    const amount = parseFloat(order.totalPrice) || 0;
    const currency = order.currency || "";
    acc[currency] = (acc[currency] || 0) + amount;
    return acc;
  }, {});

  const statusCounts = orders.reduce((acc: Record<string, number>, order) => {
    const status = order.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const totalOrdersCount = orders.length;

  const topProducts = [...products]
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    .slice(0, 5);

  const recentOrders = orders.slice(0, 5);
  const activeExportConfig = buildExportConfig();
  const canExportActiveTable = Boolean(activeExportConfig?.rows.length);

  return (
    <DashboardLayoutClient mainClassName="p-0 bg-white dark:bg-slate-950 antialiased h-[calc(100vh-64px)] overflow-hidden transition-colors duration-300">
      <div dir={isRtl ? "rtl" : "ltr"} className="h-full overflow-y-auto p-8 text-start">
        <div className="max-w-[1200px] mx-auto space-y-8 ">
           <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-2xl max-h-[90vh] overflow-y-auto text-start">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  {editingModule ? t("modal.moduleSettings", { module: getModuleTitle(editingModule) }) : t("modal.settings")}
                </DialogTitle>
              </DialogHeader>
               {editingModule && currentModuleSettings && (
                <div className="space-y-6 py-4">
                  {/* Template Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400  tracking-widest">
                      {t("modal.selectTemplate")}
                    </label>
                    <select
                      className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                      value={currentModuleSettings.template}
                      onChange={(e) =>
                        handleSaveAutomation(editingModule, {
                          template: e.target.value,
                        })
                      }
                    >
                      <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Admin Phone Number (Only for Admin Notification) */}
                  {editingModule === "admin_notification" && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 tracking-widest block">
                        {t("modal.adminWhatsAppNumber")}
                      </label>
                      <Input
                        placeholder={t("modal.adminPhonePlaceholder")}
                        value={currentModuleSettings.adminPhone || ""}
                        onChange={(e) =>
                          handleSaveAutomation(editingModule, {
                            adminPhone: e.target.value,
                          })
                        }
                        className="h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm"
                      />
                      <p className="text-[11px] text-slate-500 font-medium">
                        {t("modal.adminPhoneHelp")}
                      </p>
                    </div>
                  )}

                  {/* Send Delay in Hours */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 tracking-widest block">
                      {t("modal.sendDelayHours")}
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="0"
                        placeholder={t("modal.instantPlaceholder")}
                        value={currentModuleSettings.delay ?? 0}
                        onChange={(e) =>
                          handleSaveAutomation(editingModule, {
                            delay: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-32 h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm"
                      />
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t("modal.hours")}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t("modal.delayHelp")}
                    </p>
                  </div>

                  {currentModuleSettings.template && (
                    <>
                      {/* Variable Mapping */}
                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-bold text-slate-400  tracking-widest block">
                          {t("modal.variableMapping")}
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                          {getTemplateVariables(currentModuleSettings.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="w-8 h-8 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-md font-mono text-xs font-bold shrink-0">
                                {num}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={currentModuleSettings.mappings?.[num] || ""}
                                onChange={(e) => {
                                  const newMappings = {
                                    ...currentModuleSettings.mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation(editingModule, {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Button Actions */}
                      {templates.find(t => t.name === currentModuleSettings.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <label className="text-[10px] font-bold text-slate-400  tracking-widest block">
                            {t("modal.buttonActions")}
                          </label>
                          <div className="space-y-3">
                            {templates.find(t => t.name === currentModuleSettings.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                              const mapping = currentModuleSettings.buttonActions?.[btn.text] || { action: "none", value: "" };
                              return (
                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                  <div className="space-y-3">
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(currentModuleSettings.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation(editingModule, { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                        <option value="remove_tag">{t("modal.removeTagFromOrder")}</option>
                                        <option value="cancel_order">{t("modal.cancelOrder")}</option>
                                        <option value="start_flow">{t("modal.triggerFlow")}</option>
                                      </select>
                                      {["add_tag", "remove_tag"].includes(mapping.action) && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(currentModuleSettings.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation(editingModule, { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs"
                                        />
                                      )}
                                    </div>
                                    {mapping.action === "start_flow" && (
                                      <div className="w-full">
                                        <select
                                          value={mapping.flowId || ""}
                                          onChange={(e) => {
                                            const selectedFlow = dbFlows.find(f => f.id === e.target.value);
                                            const newActions = {
                                              ...(currentModuleSettings.buttonActions || {}),
                                              [btn.text]: { 
                                                ...mapping, 
                                                flowId: e.target.value,
                                                value: selectedFlow?.name || ""
                                              }
                                            };
                                            handleSaveAutomation(editingModule, { buttonActions: newActions });
                                          }}
                                          className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                        >
                                          <option value="">{t("modal.selectFlow")}</option>
                                          {dbFlows.map((f: any) => (
                                            <option key={f.id} value={f.id}>
                                              {f.name} {f.isActive ? t("modal.activeIndicator") : t("modal.inactiveIndicator")}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Preview */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-3">
                          {t("modal.preview")}
                        </label>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 flex justify-center">
                          <div className="scale-90 origin-center">
                            <WhatsAppTemplatePreview 
                              template={templates.find(t => t.name === currentModuleSettings.template)}
                              getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                              testValues={getMappedValues(currentModuleSettings.mappings)}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                  {t("buttons.close")}
                </Button>
                <Button 
                  className="bg-primary hover:opacity-90 text-primary-foreground font-bold"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  {t("buttons.saveChanges")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <WooCommerceIcon className="w-8 h-8" />
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {t("title")}
                </h2>
                <Badge
                  className={`${isConnected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500"} border-0 tracking-widest text-[10px] px-2 py-0.5 ms-2 rounded-md font-bold `}
                >
                  {isConnected ? t("status.connected") : t("status.notConnected")}
                </Badge>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {t("subtitle")}
              </p>
            </div>

            {isConnected && (
              <Button
                onClick={handleSyncAll}
                disabled={loading}
                variant="outline"
                className="h-11 rounded-xl font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400"
              >
                <RefreshCw
                  className={`w-4 h-4 me-2 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? t("buttons.syncing") : t("buttons.syncCatalog")}
              </Button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WooCommerceTab)} className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 gap-1 flex-wrap h-auto">
                {isConnected && (
                  <TabsTrigger
                    value="dashboard"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
                  >
                    <Activity className="w-4 h-4 me-2 text-primary" />
                    {t("tabs.dashboard")}
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="setup"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
                >
                  {isConnected ? t("tabs.connectionStatus") || "Connection Status" : t("tabs.connectionSetup")}
                </TabsTrigger>
                <TabsTrigger
                  value="automation"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
                >
                  {t("tabs.automations")}
                </TabsTrigger>
                <TabsTrigger
                  value="orders"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
                >
                  <ShoppingCart className="w-4 h-4 mr-2 text-primary" />
                  Orders & Tags
                  {orders.length > 0 && (
                    <Badge className="ms-2 h-4 px-1">
                      {hasOrderFilters ? `${filteredOrders.length}/${orders.length}` : orders.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="pending_reminders"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400"
                >
                  <Clock className="w-3.5 h-3.5 me-1.5 text-amber-500" />
                  Pending Reminders
                  {allPendingOrders.length > 0 && (
                    <Badge className="ms-2 h-4 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-0">
                      {allPendingOrders.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="products"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
                >
                  <Box className="w-4 h-4 mr-2 text-primary" />
                  Products
                  {products.length > 0 && (
                    <Badge className="ms-2 h-4 px-1">{products.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="customers"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
                >
                  <Users className="w-4 h-4 mr-2 text-primary" />
                  Customers
                  {customers.length > 0 && (
                    <Badge className="ms-2 h-4 px-1">{customers.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {isExportableTab(activeTab) && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={!canExportActiveTable || isExportingPdf || isExportingExcel || isFetchingData}
                    className="h-10 rounded-xl border-slate-200 px-4 text-xs font-bold tracking-wide text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isExportingPdf ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <FileText className="me-2 h-4 w-4" />}
                    {t("buttons.downloadPdf")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadExcel}
                    disabled={!canExportActiveTable || isExportingPdf || isExportingExcel || isFetchingData}
                    className="h-10 rounded-xl border-slate-200 px-4 text-xs font-bold tracking-wide text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isExportingExcel ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="me-2 h-4 w-4" />}
                    {t("buttons.downloadExcel")}
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="dashboard" className="space-y-8 outline-none">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                 <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-950/10 dark:to-transparent border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-300">
                    <Coins className="w-24 h-24 text-emerald-600" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400  tracking-wider">
                      {t("stats.totalSales")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {Object.keys(revenueByCurrency).length > 0 ? (
                      Object.entries(revenueByCurrency).map(([currency, total]) => (
                        <h3 key={currency} className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {currency ? `${currency} ` : ""}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                      ))
                    ) : (
                      <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        0.00
                      </h3>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{t("stats.activeSales")}</span>
                    </div>
                  </div>
                </div>
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-950/10 dark:to-transparent border border-blue-100 dark:border-blue-900/50 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-300">
                    <ShoppingCart className="w-24 h-24 text-blue-600" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400  tracking-wider">
                      {t("stats.totalOrders")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {totalOrdersCount}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t("stats.ordersSynced")}
                    </p>
                  </div>
                </div>

                {/* Confirmed Orders Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-500/20 dark:via-indigo-950/10 dark:to-transparent border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle2 className="w-24 h-24 text-indigo-600" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400  tracking-wider">
                      {t("stats.confirmedOrders")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {confirmedCount}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <span>{t("stats.completedProcessing")}</span>
                    </div>
                  </div>
                </div>

                 <div className="relative overflow-hidden bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent dark:from-rose-500/20 dark:via-rose-950/10 dark:to-transparent border border-rose-100 dark:border-rose-900/50 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="w-24 h-24 text-rose-600" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400  tracking-wider">
                      {t("stats.pendingOrders")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {pendingCount}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t("stats.pendingConfirmation")}
                    </p>
                  </div>
                </div>

                 <div className="relative overflow-hidden bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent dark:from-red-500/20 dark:via-red-950/10 dark:to-transparent border border-red-100 dark:border-red-900/50 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-300">
                    <AlertCircle className="w-24 h-24 text-red-600" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-red-700 dark:text-red-400  tracking-wider">
                      {t("stats.cancelledOrders")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {cancelledCount}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t("stats.cancelledByCustomer")}
                    </p>
                  </div>
                </div>

                {/* Catalog Card */}
               
              </div>

              {/* Four Column Details Panel */}
              {/* Order Status Distribution Full Width with Visual Charts */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {t("dashboard.orderStatusDistribution")}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] tracking-wider font-bold ">
                    {t("dashboard.currentSynced")}
                  </Badge>
                </div>

                {Object.keys(statusCounts).length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-12">{t("empty.noOrdersSynced")}</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    {/* Left Column: Progress Bars */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">Details</h4>
                      {Object.entries(statusCounts).map(([status, count]) => {
                        const pct = totalOrdersCount > 0 ? (count / totalOrdersCount) * 100 : 0;
                        let barColor = "bg-slate-400";
                        let textColor = "text-slate-600 dark:text-slate-300";
                        let badgeStyle = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                        if (status === "completed") {
                          barColor = "bg-emerald-500";
                          textColor = "text-emerald-700 dark:text-emerald-400";
                          badgeStyle = "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
                        } else if (status === "processing") {
                          barColor = "bg-blue-500";
                          textColor = "text-blue-700 dark:text-blue-400";
                          badgeStyle = "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400";
                        } else if (status === "pending") {
                          barColor = "bg-amber-500";
                          textColor = "text-amber-700 dark:text-amber-400";
                          badgeStyle = "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
                        } else if (status === "cancelled") {
                          barColor = "bg-red-500";
                          textColor = "text-red-700 dark:text-red-400";
                          badgeStyle = "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400";
                        }

                        return (
                          <div key={status} className="space-y-2 text-left">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className={`capitalize ${textColor}`}>{formatStatus(status)}</span>
                              <div className="flex items-center gap-2">
                                <Badge className={`border-0 text-[10px] px-1.5 py-0 ${badgeStyle}`}>
                                  {formatOrderCount(Number(count))}
                                </Badge>
                                <span className="text-slate-400 font-normal">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Middle Column: Pie Chart representation */}
                    <div className="flex flex-col items-center justify-center h-[260px] relative">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start lg:self-center">Distribution Share</h4>
                      <div className="h-[220px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(statusCounts).map(([status, count]) => {
                                let color = '#9ca3af';
                                if (status === 'completed') color = '#10b981';
                                if (status === 'processing') color = '#3b82f6';
                                if (status === 'pending') color = '#f59e0b';
                                if (status === 'cancelled') color = '#ef4444';
                                return { name: formatStatus(status), value: Number(count), color };
                              })}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {Object.entries(statusCounts).map(([status, count], index) => {
                                let color = '#9ca3af';
                                if (status === 'completed') color = '#10b981';
                                if (status === 'processing') color = '#3b82f6';
                                if (status === 'pending') color = '#f59e0b';
                                if (status === 'cancelled') color = '#ef4444';
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} orders`, 'Volume']} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                          <span className="text-2xl font-black text-slate-800 dark:text-white">{totalOrdersCount}</span>
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider">Total Synced</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Bar Chart representation */}
                    <div className="flex flex-col items-center justify-center h-[260px]">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start lg:self-center">Order Volume Bar Graph</h4>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.entries(statusCounts).map(([status, count]) => {
                              let color = '#9ca3af';
                              if (status === 'completed') color = '#10b981';
                              if (status === 'processing') color = '#3b82f6';
                              if (status === 'pending') color = '#f59e0b';
                              if (status === 'cancelled') color = '#ef4444';
                              return { name: formatStatus(status), count: Number(count), fill: color };
                            })}
                            margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }}
                              allowDecimals={false}
                            />
                            <Tooltip formatter={(value) => [`${value} orders`, 'Count']} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                              {Object.entries(statusCounts).map(([status, count], index) => {
                                let color = '#9ca3af';
                                if (status === 'completed') color = '#10b981';
                                if (status === 'processing') color = '#3b82f6';
                                if (status === 'pending') color = '#f59e0b';
                                if (status === 'cancelled') color = '#ef4444';
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="automation" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Confirmation Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {getModuleTitle("order_confirmation")}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {getModuleDescription("order_confirmation")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold  tracking-widest text-slate-400 hover:text-blue-600"
                        onClick={() => {
                          setEditingModule("order_confirmation");
                          setIsSettingsOpen(true);
                        }}
                      >
                        {t("buttons.settings")}
                      </Button>
                      <Switch
                        checked={automationSettings.order_confirmation.active}
                        onCheckedChange={(checked: boolean) =>
                          handleSaveAutomation("order_confirmation", {
                            active: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400  tracking-widest">
                        {t("modal.selectTemplate")}
                      </label>
                      <select
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                        value={automationSettings.order_confirmation.template}
                        onChange={(e) =>
                          handleSaveAutomation("order_confirmation", {
                            template: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {automationSettings.order_confirmation.template && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-2">
                            {t("modal.variableMapping")}
                          </label>
                          {getTemplateVariables(automationSettings.order_confirmation.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">
                                {"{{"}
                                {num}
                                {"}}"}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={
                                  automationSettings.order_confirmation
                                    .mappings?.[num] || ""
                                }
                                onChange={(e) => {
                                  const newMappings = {
                                    ...automationSettings.order_confirmation
                                      .mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation("order_confirmation", {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {getTemplateVariables(automationSettings.order_confirmation.template).length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">{t("modal.noVariables")}</p>
                          )}
                        </div>

                        {/* Button Actions Section */}
                        {templates.find(t => t.name === automationSettings.order_confirmation.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400  tracking-widest block">
                              {t("modal.buttonActions")}
                            </label>
                            <div className="space-y-3">
                              {templates.find(t => t.name === automationSettings.order_confirmation.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                                const mapping = automationSettings.order_confirmation.buttonActions?.[btn.text] || { action: "none", value: "" };
                                return (
                                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-500 ">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(automationSettings.order_confirmation.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation("order_confirmation", { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                        <option value="cancel_order">{t("modal.cancelOrder")}</option>
                                      </select>
                                      {["add_tag", "remove_tag"].includes(mapping.action) && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(automationSettings.order_confirmation.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation("order_confirmation", { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px]"
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-3">
                            {t("modal.preview")}
                          </label>
                          <div className="scale-90 origin-top -mt-2">
                            <WhatsAppTemplatePreview 
                              template={templates.find(t => t.name === automationSettings.order_confirmation.template)}
                              getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                              testValues={getMappedValues(automationSettings.order_confirmation.mappings)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fulfillment Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                        <Box className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {getModuleTitle("order_fulfillment")}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {getModuleDescription("order_fulfillment")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold  tracking-widest text-slate-400 hover:text-blue-600"
                        onClick={() => {
                          setEditingModule("order_fulfillment");
                          setIsSettingsOpen(true);
                        }}
                      >
                        {t("buttons.settings")}
                      </Button>
                      <Switch
                        checked={automationSettings.order_fulfillment.active}
                        onCheckedChange={(checked: boolean) =>
                          handleSaveAutomation("order_fulfillment", {
                            active: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400  tracking-widest">
                        {t("modal.selectTemplate")}
                      </label>
                      <select
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                        value={automationSettings.order_fulfillment.template}
                        onChange={(e) =>
                          handleSaveAutomation("order_fulfillment", {
                            template: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {automationSettings.order_fulfillment.template && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-2">
                            {t("modal.variableMapping")}
                          </label>
                          {getTemplateVariables(automationSettings.order_fulfillment.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">
                                {"{{"}
                                {num}
                                {"}}"}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={
                                  automationSettings.order_fulfillment.mappings?.[
                                    num
                                  ] || ""
                                }
                                onChange={(e) => {
                                  const newMappings = {
                                    ...automationSettings.order_fulfillment
                                      .mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation("order_fulfillment", {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {getTemplateVariables(automationSettings.order_fulfillment.template).length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">{t("modal.noVariables")}</p>
                          )}
                        </div>

                        {/* Button Actions Section */}
                        {templates.find(t => t.name === automationSettings.order_fulfillment.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400  tracking-widest block">
                              {t("modal.buttonActions")}
                            </label>
                            <div className="space-y-3">
                              {templates.find(t => t.name === automationSettings.order_fulfillment.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                                const mapping = automationSettings.order_fulfillment.buttonActions?.[btn.text] || { action: "none", value: "" };
                                return (
                                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-500 ">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(automationSettings.order_fulfillment.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation("order_fulfillment", { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                      </select>
                                      {mapping.action !== "none" && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(automationSettings.order_fulfillment.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation("order_fulfillment", { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px]"
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-3">
                            {t("modal.preview")}
                          </label>
                          <div className="scale-90 origin-top -mt-2">
                            <WhatsAppTemplatePreview 
                              template={templates.find(t => t.name === automationSettings.order_fulfillment.template)}
                              getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                              testValues={getMappedValues(automationSettings.order_fulfillment.mappings)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Abandoned Checkout Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {getModuleTitle("abandoned_checkout")}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {getModuleDescription("abandoned_checkout")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold  tracking-widest text-slate-400 hover:text-blue-600"
                        onClick={() => {
                          setEditingModule("abandoned_checkout");
                          setIsSettingsOpen(true);
                        }}
                      >
                        {t("buttons.settings")}
                      </Button>
                      <Switch
                        checked={automationSettings.abandoned_checkout.active}
                        onCheckedChange={(checked: boolean) =>
                          handleSaveAutomation("abandoned_checkout", {
                            active: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400  tracking-widest">
                        {t("modal.selectTemplate")}
                      </label>
                      <select
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                        value={automationSettings.abandoned_checkout.template}
                        onChange={(e) =>
                          handleSaveAutomation("abandoned_checkout", {
                            template: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {automationSettings.abandoned_checkout.template && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-2">
                            {t("modal.variableMapping")}
                          </label>
                          {getTemplateVariables(automationSettings.abandoned_checkout.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">
                                {"{{"}
                                {num}
                                {"}}"}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={
                                  automationSettings.abandoned_checkout
                                    .mappings?.[num] || ""
                                }
                                onChange={(e) => {
                                  const newMappings = {
                                    ...automationSettings.abandoned_checkout
                                      .mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation("abandoned_checkout", {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {getTemplateVariables(automationSettings.abandoned_checkout.template).length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">{t("modal.noVariables")}</p>
                          )}
                        </div>

                        {/* Button Actions Section */}
                        {templates.find(t => t.name === automationSettings.abandoned_checkout.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400  tracking-widest block">
                              {t("modal.buttonActions")}
                            </label>
                            <div className="space-y-3">
                              {templates.find(t => t.name === automationSettings.abandoned_checkout.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                                const mapping = automationSettings.abandoned_checkout.buttonActions?.[btn.text] || { action: "none", value: "" };
                                return (
                                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-500 ">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(automationSettings.abandoned_checkout.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation("abandoned_checkout", { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                      </select>
                                      {mapping.action !== "none" && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(automationSettings.abandoned_checkout.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation("abandoned_checkout", { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px]"
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-3">
                            {t("modal.preview")}
                          </label>
                          <div className="scale-90 origin-top -mt-2">
                            <WhatsAppTemplatePreview 
                              template={templates.find(t => t.name === automationSettings.abandoned_checkout.template)}
                              getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                              testValues={getMappedValues(automationSettings.abandoned_checkout.mappings)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancellation Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {getModuleTitle("order_cancellation")}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {getModuleDescription("order_cancellation")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold  tracking-widest text-slate-400 hover:text-blue-600"
                        onClick={() => {
                          setEditingModule("order_cancellation");
                          setIsSettingsOpen(true);
                        }}
                      >
                        {t("buttons.settings")}
                      </Button>
                      <Switch
                        checked={automationSettings.order_cancellation.active}
                        onCheckedChange={(checked: boolean) =>
                          handleSaveAutomation("order_cancellation", {
                            active: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400  tracking-widest">
                        {t("modal.selectTemplate")}
                      </label>
                      <select
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                        value={automationSettings.order_cancellation.template}
                        onChange={(e) =>
                          handleSaveAutomation("order_cancellation", {
                            template: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {automationSettings.order_cancellation.template && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-2">
                            {t("modal.variableMapping")}
                          </label>
                          {getTemplateVariables(automationSettings.order_cancellation.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">
                                {"{{"}
                                {num}
                                {"}}"}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={
                                  automationSettings.order_cancellation
                                    .mappings?.[num] || ""
                                }
                                onChange={(e) => {
                                  const newMappings = {
                                    ...automationSettings.order_cancellation
                                      .mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation("order_cancellation", {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {getTemplateVariables(automationSettings.order_cancellation.template).length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">{t("modal.noVariables")}</p>
                          )}
                        </div>

                        {/* Button Actions Section */}
                        {templates.find(t => t.name === automationSettings.order_cancellation.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400  tracking-widest block">
                              {t("modal.buttonActions")}
                            </label>
                            <div className="space-y-3">
                              {templates.find(t => t.name === automationSettings.order_cancellation.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                                const mapping = automationSettings.order_cancellation.buttonActions?.[btn.text] || { action: "none", value: "" };
                                return (
                                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-500 ">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(automationSettings.order_cancellation.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation("order_cancellation", { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                      </select>
                                      {mapping.action !== "none" && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(automationSettings.order_cancellation.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation("order_cancellation", { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px]"
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-3">
                            {t("modal.preview")}
                           </label>
                           <div className="scale-90 origin-top -mt-2">
                             <WhatsAppTemplatePreview 
                               template={templates.find(t => t.name === automationSettings.order_cancellation.template)}
                               getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                               testValues={getMappedValues(automationSettings.order_cancellation.mappings)}
                             />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Notification Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {getModuleTitle("admin_notification")}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {getModuleDescription("admin_notification")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold tracking-widest text-slate-400 hover:text-blue-600"
                        onClick={() => {
                          setEditingModule("admin_notification");
                          setIsSettingsOpen(true);
                        }}
                      >
                        {t("buttons.settings")}
                      </Button>
                      <Switch
                        checked={automationSettings.admin_notification.active}
                        onCheckedChange={(checked: boolean) =>
                          handleSaveAutomation("admin_notification", {
                            active: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 tracking-widest block">
                        Admin WhatsApp Number
                      </label>
                      <Input
                        placeholder="e.g. +923001234567"
                        value={automationSettings.admin_notification.adminPhone || ""}
                        onChange={(e) =>
                          handleSaveAutomation("admin_notification", {
                            adminPhone: e.target.value,
                          })
                        }
                        className="h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                      />
                      <p className="text-[10px] text-slate-500 font-medium">
                        Enter the phone number (with country code) to receive notifications.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 tracking-widest">
                        {t("modal.selectTemplate")}
                      </label>
                      <select
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                        value={automationSettings.admin_notification.template}
                        onChange={(e) =>
                          handleSaveAutomation("admin_notification", {
                            template: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {automationSettings.admin_notification.template && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 tracking-widest block mb-2">
                            {t("modal.variableMapping")}
                          </label>
                          {getTemplateVariables(automationSettings.admin_notification.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">
                                {"{{"}
                                {num}
                                {"}}"}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={
                                  automationSettings.admin_notification
                                    .mappings?.[num] || ""
                                }
                                onChange={(e) => {
                                  const newMappings = {
                                    ...automationSettings.admin_notification
                                      .mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation("admin_notification", {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {getTemplateVariables(automationSettings.admin_notification.template).length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">{t("modal.noVariables")}</p>
                          )}
                        </div>

                        {/* Button Actions Section */}
                        {templates.find(t => t.name === automationSettings.admin_notification.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400 tracking-widest block">
                              {t("modal.buttonActions")}
                            </label>
                            <div className="space-y-3">
                              {templates.find(t => t.name === automationSettings.admin_notification.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                                const mapping = automationSettings.admin_notification.buttonActions?.[btn.text] || { action: "none", value: "" };
                                return (
                                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-500 ">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(automationSettings.admin_notification.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation("admin_notification", { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                      </select>
                                      {mapping.action !== "none" && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(automationSettings.admin_notification.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation("admin_notification", { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px]"
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-bold text-slate-400 tracking-widest block mb-3">
                            {t("modal.preview")}
                           </label>
                           <div className="scale-90 origin-top -mt-2">
                             <WhatsAppTemplatePreview 
                               template={templates.find(t => t.name === automationSettings.admin_notification.template)}
                               getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                               testValues={getMappedValues(automationSettings.admin_notification.mappings)}
                             />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rewind Settings Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                        <Rewind className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {getModuleTitle("rewind")}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {getModuleDescription("rewind")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold tracking-widest text-slate-400 hover:text-blue-600"
                        onClick={() => {
                          setEditingModule("rewind");
                          setIsSettingsOpen(true);
                        }}
                      >
                        {t("buttons.settings")}
                      </Button>
                      <Switch
                        checked={automationSettings.rewind.active}
                        onCheckedChange={(checked: boolean) =>
                          handleSaveAutomation("rewind", {
                            active: checked,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 tracking-widest">
                        {t("modal.selectTemplate")}
                      </label>
                      <select
                        className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm outline-none"
                        value={automationSettings.rewind.template}
                        onChange={(e) =>
                          handleSaveAutomation("rewind", {
                            template: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("modal.selectTemplatePlaceholder")}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {automationSettings.rewind.template && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 tracking-widest block mb-2">
                            {t("modal.variableMapping")}
                          </label>
                          {getTemplateVariables(automationSettings.rewind.template).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">
                                {"{{"}
                                {num}
                                {"}}"}
                              </span>
                              <select
                                className="flex-1 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-xs outline-none"
                                value={
                                  automationSettings.rewind
                                    .mappings?.[num] || ""
                                }
                                onChange={(e) => {
                                  const newMappings = {
                                    ...automationSettings.rewind
                                      .mappings,
                                    [num]: e.target.value,
                                  };
                                  handleSaveAutomation("rewind", {
                                    mappings: newMappings,
                                  });
                                }}
                              >
                                <option value="">{t("modal.selectField")}</option>
                                {WOOCOMMERCE_FIELDS.map((f) => (
                                  <option key={f.value} value={f.value}>{t(f.labelKey)}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {getTemplateVariables(automationSettings.rewind.template).length === 0 && (
                            <p className="text-[10px] text-slate-400 italic">{t("modal.noVariables")}</p>
                          )}
                        </div>

                        {/* Button Actions Section */}
                        {templates.find(t => t.name === automationSettings.rewind.template)?.components?.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-bold text-slate-400 tracking-widest block">
                              {t("modal.buttonActions")}
                            </label>
                            <div className="space-y-3">
                              {templates.find(t => t.name === automationSettings.rewind.template)?.components?.find((c: any) => c.type === "BUTTONS")?.buttons.map((btn: any, idx: number) => {
                                const mapping = automationSettings.rewind.buttonActions?.[btn.text] || { action: "none", value: "" };
                                return (
                                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                                    <p className="text-[10px] font-bold text-slate-500 ">{t("modal.ifUserClicks", { text: btn.text })}</p>
                                    <div className="flex gap-2">
                                      <select
                                        value={mapping.action}
                                        onChange={(e) => {
                                          const newActions = {
                                            ...(automationSettings.rewind.buttonActions || {}),
                                            [btn.text]: { ...mapping, action: e.target.value }
                                          };
                                          handleSaveAutomation("rewind", { buttonActions: newActions });
                                        }}
                                        className="flex-1 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                      >
                                        <option value="none">{t("modal.doNothing")}</option>
                                        <option value="add_tag">{t("modal.addTagToOrder")}</option>
                                        <option value="remove_tag">{t("modal.removeTagFromOrder")}</option>
                                        <option value="start_flow">{t("modal.triggerFlow")}</option>
                                      </select>
                                      {["add_tag", "remove_tag"].includes(mapping.action) && (
                                        <Input
                                          placeholder={t("modal.tagNamePlaceholder")}
                                          value={mapping.value}
                                          onChange={(e) => {
                                            const newActions = {
                                              ...(automationSettings.rewind.buttonActions || {}),
                                              [btn.text]: { ...mapping, value: e.target.value }
                                            };
                                            handleSaveAutomation("rewind", { buttonActions: newActions });
                                          }}
                                          className="flex-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px]"
                                        />
                                      )}
                                      {mapping.action === "start_flow" && (
                                        <div className="w-full">
                                          <select
                                            value={mapping.flowId || ""}
                                            onChange={(e) => {
                                              const selectedFlow = dbFlows.find(f => f.id === e.target.value);
                                              const newActions = {
                                                ...(automationSettings.rewind.buttonActions || {}),
                                                [btn.text]: { 
                                                  ...mapping, 
                                                  flowId: e.target.value,
                                                  value: selectedFlow?.name || ""
                                                }
                                              };
                                              handleSaveAutomation("rewind", { buttonActions: newActions });
                                            }}
                                            className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 text-[10px] outline-none"
                                          >
                                            <option value="">{t("modal.selectFlow")}</option>
                                            {dbFlows.map((f: any) => (
                                              <option key={f.id} value={f.id}>
                                                {f.name} {f.isActive ? "🟢" : "⚪"}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-bold text-slate-400 tracking-widest block mb-3">
                            {t("modal.preview")}
                           </label>
                           <div className="scale-90 origin-top -mt-2">
                             <WhatsAppTemplatePreview 
                               template={templates.find(t => t.name === automationSettings.rewind.template)}
                               getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                               testValues={getMappedValues(automationSettings.rewind.mappings)}
                             />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="setup" className="space-y-8 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Forms */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Connect via App Card */}
                  <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 rounded-xl bg-[#96588A]/10 dark:bg-[#96588A]/20 flex items-center justify-center shrink-0">
                        <WooCommerceIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                          {t("setup.connectTitle")}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {t("setup.connectDescription")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-900 dark:text-slate-300">
                            {t("setup.shopName")}
                          </label>
                          <Input
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder={t("setup.shopNamePlaceholder")}
                            className="h-12 bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-900 dark:text-slate-300">
                            {t("setup.shopUrl")}
                          </label>
                          <Input
                            value={shopUrl}
                            onChange={(e) => setShopUrl(e.target.value)}
                            placeholder="https://yourstore.com"
                            className="h-12 bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-900 dark:text-slate-300">
                            {t("setup.consumerKey")}
                          </label>
                          <div className="relative">
                            <Input
                              type={showKeys ? "text" : "password"}
                              value={consumerKey}
                              onChange={(e) => setConsumerKey(e.target.value)}
                              placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className={isRtl ? "h-12 bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 rounded-xl pl-10" : "h-12 bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 rounded-xl pr-10"}
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys(!showKeys)}
                              className={isRtl ? "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" : "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"}
                            >
                              {showKeys ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-900 dark:text-slate-300">
                            {t("setup.consumerSecret")}
                          </label>
                          <div className="relative">
                            <Input
                              type={showKeys ? "text" : "password"}
                              value={consumerSecret}
                              onChange={(e) =>
                                setConsumerSecret(e.target.value)
                              }
                              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className={isRtl ? "h-12 bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 rounded-xl pl-10" : "h-12 bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 rounded-xl pr-10"}
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys(!showKeys)}
                              className={isRtl ? "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" : "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"}
                            >
                              {showKeys ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button
                          onClick={handleConnect}
                          disabled={loading || disconnecting}
                          className="w-full sm:w-auto bg-[#00B074] hover:bg-[#009662] text-white font-bold h-12 px-10 rounded-xl text-xs tracking-widest shadow-lg shadow-[#00B074]/20 transition-all"
                        >
	                          {loading
	                            ? t("buttons.connecting")
	                            : t("buttons.connectStore")}
                        </Button>

                        {isConnected && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDisconnect}
                            disabled={loading || disconnecting}
                            className="w-full sm:w-auto h-12 rounded-xl border-red-200 px-8 text-xs font-black tracking-widest text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/20"
                          >
                            {disconnecting ? (
                              <RefreshCw className="me-2 h-4 w-4 animate-spin" />
                            ) : (
                              <AlertCircle className="me-2 h-4 w-4" />
                            )}
                            {disconnecting
                              ? tSafe("buttons.disconnecting", "Disconnecting...")
                              : tSafe("buttons.disconnectStore", "Disconnect Store")}
                          </Button>
                        )}

                        {isConnected && (
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5" />
                            {t("status.connected")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Establish Manual Connection Accordion */}
                  <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
                    <button
                      onClick={() => setIsManualOpen(!isManualOpen)}
                      type="button"
	                      className="flex w-full items-center justify-between p-6 text-start group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                          <LinkIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {t("manual.title")}
                          </span>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">
                            {t("manual.description")}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-slate-400 transition-transform ${isManualOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isManualOpen && (
                      <div className="px-6 pb-8 border-t border-gray-50 dark:border-slate-800 pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2  tracking-widest">
                              <Download className="w-4 h-4" />
                              {t("manual.stepOneTitle")}
                            </h4>
                            <p className="text-sm text-slate-500 leading-relaxed">
                              {t("manual.stepOneDescription")}
                            </p>
                            <Button
                              variant="outline"
                              className="h-11 rounded-xl font-bold border-slate-200 dark:border-slate-700 w-full md:w-auto"
                            >
                              <Download className="w-4 h-4 me-2" />
                              {t("buttons.downloadPlugin")}
                            </Button>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2  tracking-widest">
                              <CheckCircle2 className="w-4 h-4" />
                              {t("manual.stepTwoTitle")}
                            </h4>
                            <p className="text-sm text-slate-500 leading-relaxed">
                              {t("manual.stepTwoBefore")}{" "}
                              <strong>
                                WooCommerce {">"} Watibot Settings
                              </strong>{" "}
                              {t("manual.stepTwoAfter")}
                            </p>

                            <div className="space-y-3">
                              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-gray-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-1">
                                  {t("manual.baseApiUrl")}
                                </label>
                                <div className="flex items-center justify-between">
                                  <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                    https://watibot.pro
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        "https://watibot.pro",
	                                        t("manual.apiUrlLabel"),
                                      )
                                    }
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-gray-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-1">
                                  {t("manual.organizationId")}
                                </label>
                                <div className="flex items-center justify-between">
                                  <code className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate mr-2">
	                                    {orgData?.id || t("fallback.loading")}
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        orgData?.id,
	                                        t("manual.organizationId"),
                                      )
                                    }
                                    className="text-slate-400 hover:text-slate-600 shrink-0"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-gray-100 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-400  tracking-widest block mb-1">
                                  {t("manual.webhookSecret")}
                                </label>
                                <div className="flex items-center justify-between">
                                  <code className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate mr-2">
                                    {orgData?.woocommerceWebhookSecret ||
	                                      t("fallback.generateByConnectingFirst")}
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        orgData?.woocommerceWebhookSecret,
	                                        t("manual.webhookSecret"),
                                      )
                                    }
                                    className="text-slate-400 hover:text-slate-600 shrink-0"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Info */}
                <div className="space-y-6">
                  {/* Quick Guide */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-400 mb-3">
                      {t("guide.title")}
                    </h3>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-500/80 mb-6 leading-relaxed">
                      {t("guide.description")}
                    </p>
                    <div className="space-y-3 text-xs font-bold tracking-widest">
                      <a
                        href="https://woocommerce.com/document/woocommerce-rest-api/"
                        target="_blank"
                        className="flex items-center gap-3 text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        {t("guide.restApiGuide")}
                      </a>
                      <Link
                        href="/dashboard/flows"
                        className="flex items-center gap-3 text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30"
                      >
                        <LinkIcon className="h-4 w-4 shrink-0" />
                        {t("guide.setupAutomation")}
                      </Link>
                    </div>
                  </div>

                  {/* Informational Content */}
                  <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm tracking-widest ">
                        {t("guide.aboutTitle")}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t("guide.aboutDescription")}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm tracking-widest ">
                        {t("guide.watibotTitle")}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 leading-relaxed font-medium">
                        {t("guide.watibotDescription")}
                      </p>
                      <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                        <li className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2"></div>
                          {t("guide.bullets.abandonedCart")}
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2"></div>
                          {t("guide.bullets.paymentStatus")}
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2"></div>
                          {t("guide.bullets.orderConfirmations")}
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2"></div>
                          {t("guide.bullets.deliveryUpdates")}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="outline-none space-y-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Unified WooCommerce Toolbar: View Switcher + Search + Filter Selects + Custom Pickers + Exports */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    {/* View Switcher: All ⬍ */}
                    <div className="shrink-0">
                      <Select value={orderQuickTab} onValueChange={(val: any) => setOrderQuickTab(val)}>
                        <SelectTrigger className="h-8 px-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-none gap-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ({orders.length})</SelectItem>
                          <SelectItem value="unfulfilled">Unfulfilled ({orders.filter((o) => !isCancelledOrder(o) && String(o.status || "").toLowerCase() !== "completed").length})</SelectItem>
                          <SelectItem value="unpaid">Unpaid ({orders.filter((o) => !isCancelledOrder(o) && !["completed", "processing"].includes(String(o.status || "").toLowerCase())).length})</SelectItem>
                          <SelectItem value="open">Open ({orders.filter((o) => !isCancelledOrder(o)).length})</SelectItem>
                          <SelectItem value="archived">Archived ({orders.filter(isCancelledOrder).length})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[140px] max-w-[220px] shrink-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        placeholder="Search and filter"
                        className="h-8 pl-8 pr-7 rounded-lg border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-normal placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                      {orderSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setOrderSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Status Filter (Confirmed vs Pending vs Cancelled) */}
                    <div className="w-[120px] shrink-0">
                      <Select value={orderConfirmationFilter} onValueChange={(v: any) => setOrderConfirmationFilter(v)}>
                        <SelectTrigger className="h-8 px-2 rounded-lg border-slate-200/90 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <SelectValue placeholder="Status: All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Status: All</SelectItem>
                          <SelectItem value="confirmed">🟢 Confirmed</SelectItem>
                          <SelectItem value="pending">🟡 Pending</SelectItem>
                          <SelectItem value="cancelled">🔴 Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range Filter */}
                    <div className="w-[115px] shrink-0">
                      <Select value={orderDateRange} onValueChange={(val: any) => {
                        setOrderDateRange(val);
                        if (val === "custom") setShowAdvancedFilters(true);
                      }}>
                        <SelectTrigger className="h-8 px-2 rounded-lg border-slate-200/90 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <SelectValue placeholder="Date: All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Date: All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                          <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                          <SelectItem value="custom">Custom Range...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Date/Time Pickers Trigger */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-xs font-semibold border-slate-200/90 dark:border-slate-700 shadow-none flex items-center gap-1.5 shrink-0",
                        showAdvancedFilters || Boolean(orderFromDate || orderToDate || orderFromTime || orderToTime)
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Custom Pickers</span>
                      {Boolean(orderFromDate || orderToDate || orderFromTime || orderToTime) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      )}
                    </Button>
                  </div>

                  {/* Actions & Export Buttons */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {hasOrderFilters && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearOrderFilters}
                        className="h-8 px-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadPdf}
                      disabled={filteredOrders.length === 0 || isExportingPdf || isFetchingData}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700 shadow-none hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {isExportingPdf ? <RefreshCw className="w-3.5 h-3.5 me-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 me-1 text-red-500" />}
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadExcel}
                      disabled={filteredOrders.length === 0 || isExportingExcel || isFetchingData}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700 shadow-none hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {isExportingExcel ? <RefreshCw className="w-3.5 h-3.5 me-1 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 me-1 text-emerald-600" />}
                      Excel
                    </Button>
                  </div>
                </div>

                {/* Collapsible Advanced Custom Date / Time Drawer */}
                {showAdvancedFilters && (
                  <div className="p-4 bg-slate-50/90 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">From Date</label>
                      <Input
                        type="date"
                        value={orderFromDate}
                        onChange={(e) => {
                          setOrderFromDate(e.target.value);
                          setOrderDateRange("custom");
                        }}
                        className="h-8 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To Date</label>
                      <Input
                        type="date"
                        value={orderToDate}
                        onChange={(e) => {
                          setOrderToDate(e.target.value);
                          setOrderDateRange("custom");
                        }}
                        className="h-8 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">From Time</label>
                      <Input
                        type="time"
                        value={orderFromTime}
                        onChange={(e) => {
                          setOrderFromTime(e.target.value);
                          setOrderDateRange("custom");
                        }}
                        className="h-8 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">To Time</label>
                      <Input
                        type="time"
                        value={orderToTime}
                        onChange={(e) => {
                          setOrderToTime(e.target.value);
                          setOrderDateRange("custom");
                        }}
                        className="h-8 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {/* Bulk Action Header when items are selected */}
                {selectedOrderIds.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-xl mx-3 my-2.5 text-xs shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold">{selectedOrderIds.length} orders selected</span>
                      </div>
                      <span className="text-slate-500">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderIds(filteredOrders.map((o) => o.id))}
                        className="text-slate-300 hover:text-white underline font-medium"
                      >
                        Select all {filteredOrders.length}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsFulfillDialogOpen(true)}
                        disabled={isBulkFulfilling}
                        className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm gap-1.5"
                      >
                        {isBulkFulfilling ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Mark as Completed in WooCommerce</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => setSelectedOrderIds([])}
                        className="h-7 px-2.5 text-slate-300 hover:text-white text-xs font-medium rounded hover:bg-slate-800 transition-colors"
                      >
                        Deselect
                      </button>
                    </div>
                  </div>
                )}

                {/* Main WooCommerce Orders Table */}
                <div className="overflow-x-auto">
                  <Table className="w-full text-xs">
                    <TableHeader>
                      <TableRow className="bg-[#fbfbfb] dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 hover:bg-[#fbfbfb]">
                        <TableHead className="w-10 px-3.5 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(filteredOrders.map((o) => o.id));
                              } else {
                                setSelectedOrderIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded-[4px] border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                          />
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[90px]">{t("table.orderNumber")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[140px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {t("table.date")} <ArrowDown className="w-3 h-3 inline-block" />
                          </span>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[170px]">{t("table.customer")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[100px]">{t("table.total")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[120px] whitespace-nowrap">{t("table.status")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[110px]">{t("table.tags")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-48 text-center text-slate-500">
                            {orders.length === 0 ? t("empty.orders") : "No orders match the selected filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order) => {
                          const isSelected = selectedOrderIds.includes(order.id);
                          const isCancelled = isCancelledOrder(order);
                          const isCompleted = String(order.status || "").toLowerCase() === "completed";
                          const isProcessing = String(order.status || "").toLowerCase() === "processing";
                          const waPhone = String(order.customerPhone || "").replace(/[^0-9]/g, "");

                          return (
                            <TableRow
                              key={order.id}
                              className={cn(
                                "border-b border-slate-100 dark:border-slate-800/70 transition-colors text-[13px]",
                                isSelected ? "bg-purple-50/40 dark:bg-purple-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                              )}
                            >
                              {/* Checkbox */}
                              <TableCell className="w-10 px-3.5 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds((prev) => [...prev, order.id]);
                                    } else {
                                      setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded-[4px] border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                                />
                              </TableCell>

                              {/* Order Number (Clickable to view details) */}
                              <TableCell className="px-3.5 py-3 font-semibold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderForDetails(order);
                                    setIsOrderDetailsOpen(true);
                                  }}
                                  className="font-bold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
                                  title="Click to view complete order details"
                                >
                                  <span>#{order.orderNumber}</span>
                                </button>
                              </TableCell>

                              {/* Date */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                                <div>
                                  <span>{formatDate(order.createdAt)}</span>
                                  {formatTime(order.createdAt) && (
                                    <span className="text-[11px] font-medium text-slate-400 block">
                                      {formatTime(order.createdAt)}
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Customer Details */}
                              <TableCell className="px-3.5 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {order.customerName || "Customer"}
                                  </span>
                                  {order.customerEmail && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                      {order.customerEmail}
                                    </span>
                                  )}
                                  {order.customerPhone && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                                        {order.customerPhone}
                                      </span>
                                      {waPhone && (
                                        <a
                                          href={`https://wa.me/${waPhone}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-emerald-600 hover:text-emerald-700 p-0.5"
                                          title="Chat on WhatsApp"
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              {/* Total */}
                              <TableCell className="px-3.5 py-3 font-bold whitespace-nowrap text-slate-900 dark:text-white">
                                {order.currency || "$"}{order.totalPrice}
                              </TableCell>

                              {/* Status */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap">
                                {isCancelled ? (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 text-[11px] font-bold">
                                    Cancelled
                                  </Badge>
                                ) : isCompleted ? (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 text-[11px] font-bold">
                                    Completed
                                  </Badge>
                                ) : isProcessing ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 text-[11px] font-bold">
                                    Processing
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 text-[11px] font-bold">
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>

                              {/* Tags */}
                              <TableCell className="px-3.5 py-3">
                                {order.tags ? (
                                  <div className="flex flex-wrap gap-1">
                                    {order.tags.split(',').map((tag: string) => (
                                      <Badge key={tag} className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-1.5 py-0.5">
                                        {tag.trim()}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Pending Reminders Tab */}
            <TabsContent value="pending_reminders" className="outline-none space-y-4">
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Pending Orders Automated WhatsApp Reminders</span>
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" />
                        {allPendingOrders.length} Pending Total
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Select a date, day, or week range, choose an approved WhatsApp template, and send instant broadcast reminders to customers with pending orders.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedPendingOrderIds.length === filteredPendingOrders.length) {
                        setSelectedPendingOrderIds([]);
                      } else {
                        setSelectedPendingOrderIds(filteredPendingOrders.map((o) => o.id));
                      }
                    }}
                    className="h-8 text-xs font-bold rounded-lg border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50"
                  >
                    {selectedPendingOrderIds.length === filteredPendingOrders.length && filteredPendingOrders.length > 0
                      ? "Deselect All"
                      : `Select All (${filteredPendingOrders.length})`}
                  </Button>
                </div>
              </div>

              {/* 2-Column Main Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column: Template Selection, Date Filter & Broadcast Setup */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Step 1: Filter Date Range */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black">
                          1
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Filter Pending Orders by Range
                        </h4>
                      </div>
                      <Badge variant="outline" className="text-[11px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                        {filteredPendingOrders.length} Matched
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Select Target Period
                      </label>
                      <Select value={pendingFilterDateRange} onValueChange={(val: any) => setPendingFilterDateRange(val)}>
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200">
                          <SelectValue placeholder="Select date range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time (All Pending Orders)</SelectItem>
                          <SelectItem value="today">Today's Orders</SelectItem>
                          <SelectItem value="yesterday">Yesterday's Orders</SelectItem>
                          <SelectItem value="this-week">This Current Week</SelectItem>
                          <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                          <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                          <SelectItem value="custom">Custom Date Range...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {pendingFilterDateRange === "custom" && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">From Date</label>
                          <Input
                            type="date"
                            value={pendingFromDate}
                            onChange={(e) => setPendingFromDate(e.target.value)}
                            className="h-8 text-xs bg-slate-50 dark:bg-slate-950 rounded-lg border-slate-200 dark:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">To Date</label>
                          <Input
                            type="date"
                            value={pendingToDate}
                            onChange={(e) => setPendingToDate(e.target.value)}
                            className="h-8 text-xs bg-slate-50 dark:bg-slate-950 rounded-lg border-slate-200 dark:border-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Template Selection & Live Preview */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black">
                        2
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Select WhatsApp Template
                      </h4>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Predefined WhatsApp Template
                      </label>
                      <Select value={pendingSelectedTemplate} onValueChange={handlePendingTemplateChange}>
                        <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200">
                          <SelectValue placeholder="Choose an approved template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.length === 0 ? (
                            <SelectItem value="none" disabled>No templates available</SelectItem>
                          ) : (
                            templates.map((tpl) => (
                              <SelectItem key={tpl.id || tpl.name} value={tpl.name}>
                                {tpl.name} ({tpl.language})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dynamic Variable Mappings */}
                    {pendingSelectedTemplate && (() => {
                      const tplData = templates.find((t) => t.name === pendingSelectedTemplate);
                      const bodyComp = tplData?.components?.find((c: any) => c.type === "BODY");
                      const placeholders = bodyComp?.text ? detectPlaceholders(bodyComp.text) : [];

                      if (placeholders.length === 0) return null;

                      return (
                        <div className="space-y-3 p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
                          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Blocks className="w-3.5 h-3.5" /> Map Variables ({placeholders.length})
                          </p>
                          <div className="space-y-2">
                            {placeholders.map((num) => (
                              <div key={num} className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-center text-xs font-bold shrink-0">
                                  {num}
                                </div>
                                <select
                                  value={pendingVariableMappings[num.toString()] || ""}
                                  onChange={(e) =>
                                    setPendingVariableMappings({
                                      ...pendingVariableMappings,
                                      [num.toString()]: e.target.value,
                                    })
                                  }
                                  className="h-8 px-2 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none"
                                >
                                  {WOOCOMMERCE_VARIABLES.map((v) => (
                                    <option key={v.value} value={v.value}>
                                      {v.label} ({v.value})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Live WhatsApp Bubble Preview */}
                    {pendingSelectedTemplate && (() => {
                      const tplData = templates.find((t) => t.name === pendingSelectedTemplate);
                      const bodyComp = tplData?.components?.find((c: any) => c.type === "BODY");
                      if (!bodyComp?.text) return null;

                      const sampleOrder = filteredPendingOrders[0] || orders[0];
                      let previewText = bodyComp.text;

                      Object.entries(pendingVariableMappings).forEach(([num, varPath]) => {
                        let sampleVal = `[${varPath}]`;
                        if (sampleOrder) {
                          if (varPath === "customer.first_name") sampleVal = sampleOrder.customerName?.split(" ")[0] || "Customer";
                          else if (varPath === "customer.last_name") sampleVal = sampleOrder.customerName?.split(" ")[1] || "";
                          else if (varPath === "customer.name") sampleVal = sampleOrder.customerName || "Customer";
                          else if (varPath === "order_number") sampleVal = `#${sampleOrder.orderNumber}`;
                          else if (varPath === "total_price") sampleVal = `${sampleOrder.currency || "$"}${sampleOrder.totalPrice}`;
                          else if (varPath === "shop_url") sampleVal = shopUrl || "your-woocommerce-store.com";
                        }
                        previewText = previewText.replace(new RegExp(`\\{\\{${num}\\}\\}`, "g"), sampleVal);
                      });

                      return (
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Live Message Preview
                          </label>
                          <div className="p-3 bg-[#e5ddd5] dark:bg-slate-800/80 rounded-xl relative">
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg rounded-tl-none shadow-xs text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-w-sm">
                              {previewText}
                              <div className="text-[9px] text-slate-400 text-right mt-1">12:45 PM</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Step 3: Broadcast Send CTA */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-3">
                    <Button
                      type="button"
                      onClick={handleSendPendingBroadcast}
                      disabled={isSendingPendingBroadcast || selectedPendingOrderIds.length === 0 || !pendingSelectedTemplate || isFetchingData}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      {isSendingPendingBroadcast ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Sending Reminders...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send WhatsApp to {selectedPendingOrderIds.length} Pending Orders</span>
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-center text-slate-400">
                      Messages will be sent directly to each customer's WhatsApp number.
                    </p>
                  </div>
                </div>

                {/* Right Column: Pending Orders Target List Table */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Table Header Controls */}
                    <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <Input
                          value={pendingSearchQuery}
                          onChange={(e) => setPendingSearchQuery(e.target.value)}
                          placeholder="Search pending orders..."
                          className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg border-slate-200 dark:border-slate-700"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (selectedPendingOrderIds.length === filteredPendingOrders.length) {
                              setSelectedPendingOrderIds([]);
                            } else {
                              setSelectedPendingOrderIds(filteredPendingOrders.map((o) => o.id));
                            }
                          }}
                          className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          {selectedPendingOrderIds.length === filteredPendingOrders.length && filteredPendingOrders.length > 0
                            ? "Deselect All"
                            : `Select All (${filteredPendingOrders.length})`}
                        </Button>
                      </div>
                    </div>

                    {/* Table Content */}
                    <div className="overflow-x-auto">
                      <Table className="w-full text-xs">
                        <TableHeader>
                          <TableRow className="bg-[#fbfbfb] dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                            <TableHead className="w-10 px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={filteredPendingOrders.length > 0 && selectedPendingOrderIds.length === filteredPendingOrders.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPendingOrderIds(filteredPendingOrders.map((o) => o.id));
                                  } else {
                                    setSelectedPendingOrderIds([]);
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                              />
                            </TableHead>
                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3 py-3">Order</TableHead>
                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3 py-3">Date</TableHead>
                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3 py-3 min-w-[150px]">Customer</TableHead>
                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3 py-3">Total</TableHead>
                            <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3 py-3">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPendingOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="h-48 text-center text-slate-500">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                  <p className="font-medium text-xs">No pending orders match the selected date filter.</p>
                                  <span className="text-[11px] text-slate-400">Try selecting "All Time" or adjusting the date range.</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredPendingOrders.map((order) => {
                              const isSelected = selectedPendingOrderIds.includes(order.id);
                              const hasPhone = Boolean(order.customerPhone && order.customerPhone.replace(/[^0-9]/g, "").length >= 7);

                              return (
                                <TableRow
                                  key={order.id}
                                  className={cn(
                                    "border-b border-slate-100 dark:border-slate-800/70 transition-colors text-[13px]",
                                    isSelected ? "bg-amber-50/40 dark:bg-amber-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                  )}
                                >
                                  {/* Checkbox */}
                                  <TableCell className="w-10 px-3 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedPendingOrderIds((prev) => [...prev, order.id]);
                                        } else {
                                          setSelectedPendingOrderIds((prev) => prev.filter((id) => id !== order.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                                    />
                                  </TableCell>

                                  {/* Order Number */}
                                  <TableCell className="px-3 py-3 font-semibold">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedOrderForDetails(order);
                                        setIsOrderDetailsOpen(true);
                                      }}
                                      className="font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline cursor-pointer"
                                      title="Click to view complete order details"
                                    >
                                      #{order.orderNumber}
                                    </button>
                                  </TableCell>

                                  {/* Date */}
                                  <TableCell className="px-3 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                                    {formatDate(order.createdAt)}
                                  </TableCell>

                                  {/* Customer */}
                                  <TableCell className="px-3 py-3 min-w-[150px]">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-slate-900 dark:text-slate-100">
                                        {order.customerName || "Customer"}
                                      </span>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {hasPhone ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                            <MessageCircle className="w-3 h-3" />
                                            {order.customerPhone}
                                          </span>
                                        ) : (
                                          <span className="text-[11px] text-red-400 italic">No WhatsApp phone</span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Total */}
                                  <TableCell className="px-3 py-3 font-bold whitespace-nowrap text-slate-800 dark:text-slate-200">
                                    {order.currency ? `${order.currency} ` : "$"}{order.totalPrice}
                                  </TableCell>

                                  {/* Status */}
                                  <TableCell className="px-3 py-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff3c4] text-[#744210] dark:bg-amber-950/40 dark:text-amber-300">
                                      <Clock className="w-3 h-3 text-[#744210] dark:text-amber-300" /> Pending
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products" className="outline-none">
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
	                      <TableHead>{t("table.product")}</TableHead>
	                      <TableHead>{t("table.price")}</TableHead>
	                      <TableHead>{t("table.sku")}</TableHead>
	                      <TableHead>{t("table.status")}</TableHead>
	                      <TableHead>{t("table.lastSynced")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-48 text-center text-slate-500"
                        >
	                          {t("empty.products")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {product.imageUrl && !imageErrors[product.id] ? (
                                <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50">
                                  <img
                                    src={product.imageUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={() => setImageErrors((prev) => ({ ...prev, [product.id]: true }))}
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                                  <Box className="w-6 h-6" />
                                </div>
                              )}
                              <span className="font-bold">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">
                            {product.currency} {product.price.toString()}
                          </TableCell>
                          <TableCell className="text-slate-500">
	                            {product.sku || t("fallback.notAvailable")}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
	                              {formatStatus(product.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
	                            {formatDate(product.updatedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="customers" className="outline-none">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <Table className="w-full text-xs">
                    <TableHeader>
                      <TableRow className="bg-[#fbfbfb] dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 hover:bg-[#fbfbfb]">
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[200px]">{t("table.customer")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[130px]">{t("table.phone")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[110px]">{t("table.orders")}</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[200px]">{t("table.lastOrder")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-48 text-center text-slate-500">
                            {t("empty.customers")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer) => {
                          const waPhone = String(customer.phone || "").replace(/[^0-9]/g, "");

                          return (
                            <TableRow key={customer.id} className="border-b border-slate-100 dark:border-slate-800/70 hover:bg-[#f8f9fa] dark:hover:bg-slate-800/30 text-[13px] transition-colors">
                              {/* Customer Name & Email */}
                              <TableCell className="px-4 py-3.5">
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{customer.name || customer.email?.split("@")[0] || "Customer"}</span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                    {customer.email || t("fallback.noEmail")}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Phone */}
                              <TableCell className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {customer.phone ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      {customer.phone}
                                    </span>
                                    {waPhone && (
                                      <a
                                        href={`https://wa.me/${waPhone}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-emerald-600 hover:text-emerald-700 p-1"
                                        title="Chat on WhatsApp"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">No Phone</span>
                                )}
                              </TableCell>

                              {/* Orders */}
                              <TableCell className="px-4 py-3.5 whitespace-nowrap">
                                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-0 font-bold text-xs px-2 py-0.5">
                                  {customer.orderCount} {customer.orderCount === 1 ? "order" : "orders"}
                                </Badge>
                              </TableCell>

                              {/* Last Order Detail */}
                              <TableCell className="px-4 py-3.5">
                                {customer.lastOrderAt ? (
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {formatDate(customer.lastOrderAt)}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">No orders yet</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Simple Bulk Fulfill Confirmation Dialog */}
      <Dialog open={isFulfillDialogOpen} onOpenChange={(open) => !isBulkFulfilling && setIsFulfillDialogOpen(open)}>
        <DialogContent className="max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6">
          <DialogHeader className="space-y-2 text-start">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-1">
              <Package className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Fulfill {selectedOrderIds.length} {selectedOrderIds.length === 1 ? "Order" : "Orders"}?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to mark {selectedOrderIds.length} selected {selectedOrderIds.length === 1 ? "order" : "orders"} as completed in WooCommerce?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBulkFulfilling}
              onClick={() => setIsFulfillDialogOpen(false)}
              className="h-9 px-4 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isBulkFulfilling || selectedOrderIds.length === 0}
              onClick={handleBulkFulfill}
              className="h-9 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md gap-2"
            >
              {isBulkFulfilling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm ({selectedOrderIds.length})</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WooCommerce Order Complete Details Modal */}
      <WooCommerceOrderDetailsDialog
        order={selectedOrderForDetails}
        isOpen={isOrderDetailsOpen}
        onClose={() => {
          setIsOrderDetailsOpen(false);
          setSelectedOrderForDetails(null);
        }}
        storeUrl={shopUrl}
        products={products}
        onFulfill={handleSingleFulfill}
        isFulfilling={isFulfillingSingleId === selectedOrderForDetails?.id}
      />
    </DashboardLayoutClient>
  );
}
