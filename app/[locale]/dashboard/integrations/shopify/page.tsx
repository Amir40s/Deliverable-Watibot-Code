"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from "react"
import * as XLSX from "xlsx"
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ChevronDown, Link as LinkIcon, Copy, Info, CheckCircle2, RefreshCw, FileSpreadsheet, FileText, ShoppingCart, Box, Users, TrendingUp, Coins, Clock, Bell, Package, XCircle, UserCheck, Zap, RotateCcw, Settings, ToggleLeft, ToggleRight, X, Blocks, Unlink, Search, SlidersHorizontal, ArrowDown, Layers, AlertTriangle, Check, Calendar, CalendarDays, ExternalLink, Mail, Phone, MapPin, CreditCard, Truck, User, Tag, Receipt, MessageCircle, Send, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { getShopifyIntegrationKey, generateShopifyIntegrationKey, getShopifyOrders, getShopifyProducts, syncShopifyProducts, getShopifyAutomationSettings, updateShopifyAutomationSettings, getShopifyCustomers, manualRefreshShopifyToken, getShopifyFullAutomation, updateShopifyFullAutomation, getShopifyFlows, sendPendingOrdersWhatsAppBroadcast, bulkFulfillShopifyOrders, fulfillShopifyOrder } from "@/app/actions/shopify-integration"
import { disconnectIntegration } from "@/app/actions/organization"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { WhatsAppTemplatePreview } from "@/components/whatsapp/WhatsAppTemplatePreview"
import { useLocale, useTranslations } from "next-intl"
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
} from "recharts"

const RTL_LOCALES = new Set(["ar", "ur"])
const LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  ur: "ur-PK",
  hi: "hi-IN",
  bn: "bn-BD",
  en: "en-US",
}

type ShopifyTab = "dashboard" | "setup" | "orders" | "pending_reminders" | "products" | "customers" | "automation"

 const SHOPIFY_VARIABLES = [
  { label: "Customer First Name", value: "customer.first_name" },
  { label: "Customer Last Name", value: "customer.last_name" },
  { label: "Order Number", value: "order_number" },
  { label: "Total Price", value: "total_price" },
  { label: "Currency", value: "currency" },
  { label: "Shop URL", value: "shop_url" },
  { label: "Customer Phone", value: "customer.phone" },
  { label: "Shipping City", value: "shipping_address.city" },
  { label: "Shipping Country", value: "shipping_address.country" },
  { label: "Payment Status", value: "financial_status" },
  { label: "Payment Method", value: "payment_method" },
  { label: "Fulfillment Status", value: "fulfillment_status" }, 
  { label: "Invoice URL (Draft Orders)", value: "invoice_url" },
  { label: "Checkout URL (Abandoned)", value: "abandoned_checkout_url" },
  { label: "Product Name", value: "product_name" },
  { label: "Product URL", value: "product_url" },
]

const AUTOMATION_MODULES = [
  { id: "order_confirmation", title: "Order Confirmation", description: "Send WhatsApp message when a new order is placed.", color: "emerald" },
  { id: "order_fulfillment", title: "Order Fulfillment", description: "Notify customer when order is shipped or fulfilled.", color: "blue" },
  { id: "order_cancellation", title: "Order Cancellation", description: "Alert customer when order is cancelled or refunded.", color: "red" },
  { id: "order_notification", title: "Order Notification", description: "General order status updates to customer.", color: "amber" },
  { id: "admin_notification", title: "Admin Notification", description: "Notify admin/store owner on new orders.", color: "purple" },
  { id: "abandoned_checkout", title: "Abandoned Checkout", description: "Recover abandoned carts via WhatsApp.", color: "pink" },
  { id: "draft_order_recovery", title: "Draft Order Recovery", description: "Follow up on draft orders with payment link.", color: "indigo" },
  { id: "rewind", title: "Rewind", description: "Schedule or delay messages to be sent to users at a specified time.", color: "teal" },
]

const MODULE_COLORS: Record<string, string> = {
  emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  blue: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  red: "text-red-600 bg-red-50 dark:bg-red-950/30",
  amber: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  purple: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
  pink: "text-pink-600 bg-pink-50 dark:bg-pink-950/30",
  indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
  teal: "text-teal-600 bg-teal-50 dark:bg-teal-950/30",
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  order_confirmation: <CheckCircle2 className="w-5 h-5" />,
  order_fulfillment: <Package className="w-5 h-5" />,
  order_cancellation: <XCircle className="w-5 h-5" />,
  order_notification: <Bell className="w-5 h-5" />,
  admin_notification: <UserCheck className="w-5 h-5" />,
  abandoned_checkout: <ShoppingCart className="w-5 h-5" />,
  draft_order_recovery: <FileText className="w-5 h-5" />,
  rewind: <RotateCcw className="w-5 h-5" />,
}

import React from "react"

function detectPlaceholders(text: string): number[] {
  if (!text) return []
  const matches = text.match(/{\{(\d+)}}/g)
  if (!matches) return []
  return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ""))))].sort((a, b) => a - b)
}

// ─── Automation Settings Modal ────────────────────────────────────────────────
function AutomationSettingsModal({
  isOpen, onClose, module, automation, templates, onSave, isSaving, dbFlows
}: {
  isOpen: boolean
  onClose: () => void
  module: typeof AUTOMATION_MODULES[0] | null
  automation: Record<string, any>
  templates: any[]
  onSave: (moduleId: string, data: Record<string, any>) => void
  isSaving: boolean
  dbFlows: { id: string; name: string; isActive: boolean }[]
}) {
  const config = module ? (automation[module.id] ?? {}) : {}
  const hasGranularFields = config.delayDays !== undefined || config.delayHours !== undefined || config.delayMinutes !== undefined || config.delaySeconds !== undefined
  const initDays = hasGranularFields ? (config.delayDays ?? 0) : Math.floor((config.delay || 0) / 24)
  const initHours = hasGranularFields ? (config.delayHours ?? 0) : Math.floor((config.delay || 0) % 24)
  const initMins = hasGranularFields ? (config.delayMinutes ?? 0) : Math.round(((config.delay || 0) % 1) * 60)
  const initSecs = hasGranularFields ? (config.delaySeconds ?? 0) : 0

  const [selectedTemplate, setSelectedTemplate] = useState<string>(config.template ?? "")
  const [adminPhone, setAdminPhone] = useState<string>(config.adminPhone ?? "")
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>(config.variableMappings ?? {})
  const [buttonMappings, setButtonMappings] = useState<any[]>(config.buttonMappings ?? [])
  const [delay, setDelay] = useState<number>(config.delay ?? 0)
  const [delayDays, setDelayDays] = useState<number>(initDays)
  const [delayHours, setDelayHours] = useState<number>(initHours)
  const [delayMinutes, setDelayMinutes] = useState<number>(initMins)
  const [delaySeconds, setDelaySeconds] = useState<number>(initSecs)
  const [conditionStatus, setConditionStatus] = useState<string>(config.conditionStatus ?? "")

  useEffect(() => {
    if (!module) return
    const c = automation[module.id] ?? {}
    setSelectedTemplate(c.template ?? "")
    setAdminPhone(c.adminPhone ?? "")
    setVariableMappings(c.variableMappings ?? {})
    setButtonMappings(c.buttonMappings ?? [])
    setDelay(c.delay ?? 0)
    
    const hasFields = c.delayDays !== undefined || c.delayHours !== undefined || c.delayMinutes !== undefined || c.delaySeconds !== undefined
    if (hasFields) {
      setDelayDays(c.delayDays ?? 0)
      setDelayHours(c.delayHours ?? 0)
      setDelayMinutes(c.delayMinutes ?? 0)
      setDelaySeconds(c.delaySeconds ?? 0)
    } else {
      const d = c.delay ?? 0
      setDelayDays(Math.floor(d / 24))
      setDelayHours(Math.floor(d % 24))
      setDelayMinutes(Math.round((d % 1) * 60))
      setDelaySeconds(0)
    }
    
    setConditionStatus(c.conditionStatus ?? "")
  }, [module, isOpen, automation])

  if (!isOpen || !module) return null

  const templateData = templates.find(t => t.name === selectedTemplate)
  const bodyComponent = templateData?.components?.find((c: any) => c.type === "BODY")
  const buttonsComponent = templateData?.components?.find((c: any) => c.type === "BUTTONS")
  const placeholders = bodyComponent?.text ? detectPlaceholders(bodyComponent.text) : []

  const updateButtonMapping = (buttonText: string, action: string, value: string, flowId?: string, statusValue?: string) => {
    const newMappings = [...buttonMappings]
    const index = newMappings.findIndex(m => m.buttonText === buttonText)
    const item: any = { buttonText, action, value }
    if (action === "start_flow") item.flowId = flowId ?? (index >= 0 ? newMappings[index].flowId : "")
    if (action === "add_tag_and_change_status") item.statusValue = statusValue ?? (index >= 0 ? newMappings[index].statusValue : "cancelled")
    if (index >= 0) newMappings[index] = item
    else newMappings.push(item)
    setButtonMappings(newMappings)
  }

  const handleSave = () => {
    const allPlaceholders = placeholders
    const completeMappings: Record<string, string> = {}
    allPlaceholders.forEach(num => { completeMappings[num] = variableMappings[num] ?? "" })
    
    // Save legacy delay as computed hours for full backward compatibility
    const computedDelay = Number(delayDays) * 24 + Number(delayHours) + (Number(delayMinutes) / 60) + (Number(delaySeconds) / 3600)
    
    onSave(module.id, {
      template: selectedTemplate,
      language: templateData?.language ?? "en",
      buttonMappings,
      variableMappings: completeMappings,
      delay: computedDelay || 0,
      delayDays: Number(delayDays) || 0,
      delayHours: Number(delayHours) || 0,
      delayMinutes: Number(delayMinutes) || 0,
      delaySeconds: Number(delaySeconds) || 0,
      conditionStatus,
      adminPhone: module.id === "admin_notification" ? adminPhone : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", MODULE_COLORS[module.color])}>
              {MODULE_ICONS[module.id]}
            </div>
            <h2 className="text-base font-black text-slate-800 dark:text-white">{module.title} Settings</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Admin Phone (only for admin_notification) */}
          {module.id === "admin_notification" && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Admin WhatsApp Number</label>
              <Input
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="e.g. +923001234567"
                className="h-10 rounded-xl text-sm"
              />
              <p className="text-[11px] text-slate-400">Enter number with country code that receives admin notifications.</p>
            </div>
          )}

          {/* Template Picker */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">WhatsApp Template</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="-- Select Template --" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 && <SelectItem value="__none__" disabled>No templates available</SelectItem>}
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.name}>{t.name} ({t.language})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Automation Delay Settings */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <p className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              {module.id === "rewind" ? "Trigger Workflow — Delay" : "Send Delay"}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[{label:"Days",val:delayDays,set:setDelayDays,max:365},{label:"Hours",val:delayHours,set:setDelayHours,max:23},{label:"Minutes",val:delayMinutes,set:setDelayMinutes,max:59},{label:"Seconds",val:delaySeconds,set:setDelaySeconds,max:59}].map(({label,val,set,max}) => (
                <div key={label} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                  <Input type="number" min={0} max={max} value={val} onChange={e => set(Number(e.target.value))} className="h-9 text-center text-sm rounded-lg" />
                </div>
              ))}
            </div>
            
            {module.id === "rewind" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Trigger On Status</label>
                <select
                  value={conditionStatus}
                  onChange={e => setConditionStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="">-- Select Status --</option>
                  <optgroup label="Order Status"><option value="open">Open</option><option value="archived">Archived</option><option value="cancelled">Cancelled</option></optgroup>
                  <optgroup label="Payment Status"><option value="pending">Pending</option><option value="authorized">Authorized</option><option value="paid">Paid</option><option value="partially_paid">Partially Paid</option><option value="refunded">Refunded</option><option value="voided">Voided</option></optgroup>
                  <optgroup label="Fulfillment Status"><option value="unfulfilled">Unfulfilled</option><option value="fulfilled">Fulfilled</option><option value="partially_fulfilled">Partially Fulfilled</option><option value="on_hold">On Hold</option></optgroup>
                </select>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">All 0s = Send immediately. Wait the specified duration before sending the message.</p>
            )}
          </div>

          {/* Variable Mappings */}
          {placeholders.length > 0 && (
            <div className="space-y-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Blocks className="w-3.5 h-3.5" /> Map Template Variables
              </p>
              <p className="text-[11px] text-slate-500">Select which Shopify data fills each placeholder (e.g. {"{{1}}"},  {"{{2}}"})</p>
              <div className="space-y-2.5">
                {placeholders.map(num => (
                  <div key={num} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-400 shrink-0">{num}</div>
                    <select
                      value={variableMappings[num]?.startsWith("custom:") ? "__custom__" : (variableMappings[num] ?? "")}
                      onChange={e => {
                        if (e.target.value === "__custom__") setVariableMappings({ ...variableMappings, [num]: "custom:" })
                        else setVariableMappings({ ...variableMappings, [num]: e.target.value })
                      }}
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                    >
                      <option value="">-- Choose Data Field --</option>
                      {SHOPIFY_VARIABLES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                      <option value="__custom__">-- Write Custom Value --</option>
                    </select>
                    {variableMappings[num]?.startsWith("custom:") && (
                      <Input
                        placeholder="Custom value..."
                        value={variableMappings[num].substring(7)}
                        onChange={e => setVariableMappings({ ...variableMappings, [num]: "custom:" + e.target.value })}
                        className="flex-1 h-9 rounded-lg text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Preview */}
          {selectedTemplate && bodyComponent?.text && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Preview</label>
              <div className="rounded-xl bg-[#e5ddd5] dark:bg-slate-800 p-4">
                <div className="bg-white dark:bg-slate-700 rounded-xl p-3 max-w-[85%] shadow-sm">
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{bodyComponent.text}</p>
                  <span className="text-[10px] text-slate-400 float-right mt-1">12:00 PM</span>
                  <div className="clear-both" />
                </div>
                {buttonsComponent?.buttons?.map((btn: any, i: number) => (
                  <div key={i} className="mt-2 bg-white dark:bg-slate-700 rounded-xl p-2 text-center text-[#00a884] text-sm font-bold max-w-[85%] shadow-sm">{btn.text}</div>
                ))}
              </div>
            </div>
          )}

          {/* Button Actions */}
          {buttonsComponent?.buttons?.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Button Actions</label>
              {buttonsComponent.buttons.map((btn: any, idx: number) => {
                const mapping = buttonMappings.find(m => m.buttonText === btn.text) ?? { action: "none", value: "" }
                return (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">If user clicks &ldquo;{btn.text}&rdquo;:</p>
                    <div className="flex gap-2">
                      <select
                        value={mapping.action}
                        onChange={e => {
                          if (e.target.value === "start_flow") { const f = dbFlows[0]; updateButtonMapping(btn.text, "start_flow", f?.name ?? "", f?.id ?? "") }
                          else updateButtonMapping(btn.text, e.target.value, "")
                        }}
                        className="flex-1 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="none">Do nothing</option>
                        <option value="add_tag">Add Tag to Order</option>
                        <option value="remove_tag">Remove Tag from Order</option>
                        <option value="add_tag_and_change_status">Add Tag and Change Order Status</option>
                        <option value="cancel_order">Cancel Order</option>
                       </select>
                      {["add_tag","remove_tag","add_tag_and_change_status"].includes(mapping.action) && (
                        <Input placeholder="Tag name" value={mapping.value} onChange={e => updateButtonMapping(btn.text, mapping.action, e.target.value)} className="flex-1 h-9 rounded-lg text-sm" />
                      )}
                    </div>
                    {mapping.action === "add_tag_and_change_status" && (
                      <select value={mapping.statusValue ?? "cancelled"} onChange={e => updateButtonMapping(btn.text, mapping.action, mapping.value, undefined, e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none">
                        <option value="cancelled">Change to Cancelled</option>
                        <option value="archived">Change to Archived</option>
                        <option value="open">Change to Open (Reopen)</option>
                      </select>
                    )}
                    {mapping.action === "start_flow" && (
                      <select value={mapping.flowId ?? ""} onChange={e => { const f = dbFlows.find(f => f.id === e.target.value); updateButtonMapping(btn.text, "start_flow", f?.name ?? "", f?.id ?? "") }} className="w-full h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none">
                        <option value="">-- Select WhatsApp Flow --</option>
                        {dbFlows.map(f => <option key={f.id} value={f.id}>{f.name} {f.isActive ? "🟢" : "⚪"}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-bold">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !selectedTemplate}
            className="flex-1 h-10 rounded-xl text-sm font-bold bg-[#00B074] hover:bg-[#009662] text-white"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin me-2" /> : null}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Automation Card ──────────────────────────────────────────────────────────
function AutomationModuleCard({
  module, config, onToggle, onSettings, isTogglingId
}: {
  module: typeof AUTOMATION_MODULES[0]
  config: any
  onToggle: (id: string, active: boolean) => void
  onSettings: (id: string) => void
  isTogglingId: string | null
}) {
  const active = config?.active ?? false
  const template = config?.template ?? module.id
  const isMissingAdminPhone = module.id === "admin_notification" && active && !config?.adminPhone
  const isToggling = isTogglingId === module.id

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm flex flex-col gap-4 relative transition-all hover:shadow-md",
      isMissingAdminPhone ? "border-red-300 dark:border-red-800" : "border-slate-100 dark:border-slate-800"
    )}>
      {isMissingAdminPhone && (
        <span className="absolute -top-2.5 right-4 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Action Required</span>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", MODULE_COLORS[module.color])}>
            {MODULE_ICONS[module.id]}
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              {module.title}
              <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest", active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>
                {active ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={active ? "destructive" : "default"}
          onClick={() => onToggle(module.id, !active)}
          disabled={isToggling}
          className={cn("h-7 px-3 text-[11px] font-bold rounded-lg shadow-none", !active && "bg-[#00B074] hover:bg-[#009662] text-white")}
        >
          {isToggling ? <RefreshCw className="w-3 h-3 animate-spin" /> : (active ? "Disable" : "Enable")}
        </Button>
      </div>
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{module.description}</p>
      {isMissingAdminPhone && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/40 text-xs font-semibold text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Please set the Admin WhatsApp number in Settings.
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-800/60">
        <span className="text-[11px] text-slate-400 font-medium">
          Template: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono text-[10px]">{template}</code>
        </span>
        <Button variant="outline" size="sm" onClick={() => onSettings(module.id)} className="h-7 px-3 text-[11px] font-bold rounded-lg border-slate-200 dark:border-slate-700 shadow-none">
          <Settings className="w-3 h-3 me-1.5" /> Settings
        </Button>
      </div>
    </div>
  )
}
function ShopifyOrderDetailsDialog({
  order,
  isOpen,
  onClose,
  storeUrl,
  products = [],
  onFulfill,
  isFulfilling = false,
}: {
  order: any | null
  isOpen: boolean
  onClose: () => void
  storeUrl: string | null
  products?: any[]
  onFulfill?: (orderId: string) => Promise<void>
  isFulfilling?: boolean
}) {
  if (!order) return null

  const isCancelled = ["cancelled", "canceled", "voided", "refunded", "failed"].includes(
    String(order.paymentStatus || order.financialStatus || "").toLowerCase()
  ) || Boolean(order.cancelledAt) || String(order.tags || "").toLowerCase().includes("cancel")

  const isConfirmed = !isCancelled && String(order.tags || "").trim().length > 0
  const pStatus = String(order.paymentStatus || order.financialStatus || "pending").toLowerCase()
  const fStatus = String(order.fulfillmentStatus || "unfulfilled").toLowerCase()

  const shipping = order.shippingAddress
  const billing = order.billingAddress
  const cleanPhone = String(order.customerPhone || "").replace(/[^0-9+]/g, "")
  const waPhone = String(order.customerPhone || "").replace(/[^0-9]/g, "")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose={true} className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-sm">
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
                ) : isConfirmed ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 text-[11px] font-bold">
                    Confirmed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 text-[11px] font-bold">
                    Pending
                  </Badge>
                )}
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px]">
                  {order.channel || "Online Store"}
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
                href={`https://${storeUrl}/admin/orders/${order.id}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span>Shopify Admin</span>
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

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (8 cols): Line Items & Payment Summary */}
            <div className="lg:col-span-8 space-y-5">
              {/* Items Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Line Items ({order.lineItems?.length || order.itemsCount || 1})
                    </span>
                  </div>
                  {/* Fulfillment Status Pill */}
                  {fStatus === "fulfilled" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e3e3e3] dark:bg-slate-700 text-[#303030] dark:text-slate-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#303030] dark:bg-slate-100 shrink-0"></span> Fulfilled
                    </span>
                  ) : fStatus === "not_required" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f1f1f1] text-[#616161]">
                      Not Required
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fff8db] border border-[#f5c342] text-[#6d4c00]">
                      <span className="w-1.5 h-1.5 rounded-full border border-[#6d4c00] bg-transparent shrink-0"></span> Unfulfilled
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {order.lineItems && order.lineItems.length > 0 ? (
                    order.lineItems.map((item: any, idx: number) => {
                      const matchedProduct = products.find(
                        (p) =>
                          (item.productId && String(p.id) === String(item.productId)) ||
                          (item.title && p.name && p.name.trim().toLowerCase() === item.title.trim().toLowerCase())
                      )
                      const itemImageUrl = item.imageUrl || matchedProduct?.imageUrl || null

                      return (
                        <div key={item.id || idx} className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden relative">
                              {itemImageUrl ? (
                                <img
                                  src={itemImageUrl}
                                  alt={item.title}
                                  className="w-full h-full object-cover object-center"
                                />
                              ) : (
                                <Box className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {item.title}
                              </p>
                              {item.variantTitle && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Variant: {item.variantTitle}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.sku && <span>•</span>}
                                <span>Qty: {item.quantity} × {order.currency || "$"}{item.price}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {order.currency || "$"}{item.total || (Number(item.price || 0) * (Number(item.quantity) || 1)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No line items recorded.
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Payment Breakdown</span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[11px] font-bold",
                    pStatus === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    ["refunded", "voided", "cancelled"].includes(pStatus) ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {pStatus === "paid" ? "Paid" : pStatus === "refunded" ? "Refunded" : "Pending"}
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
                      <span>Estimated Tax</span>
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

                {order.paymentGateways && order.paymentGateways.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Payment Method: <strong className="text-slate-700 dark:text-slate-300">{order.paymentGateways.join(", ")}</strong></span>
                  </div>
                )}
              </div>

              {/* Fulfillments / Tracking Card */}
              {order.fulfillments && order.fulfillments.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Shipping & Tracking</span>
                  </div>
                  {order.fulfillments.map((f: any, idx: number) => (
                    <div key={idx} className="text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Carrier:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{f.tracking_company || "Standard Carrier"}</span>
                      </div>
                      {f.tracking_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Tracking #:</span>
                          {f.tracking_url ? (
                            <a href={f.tracking_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-mono">
                              {f.tracking_number} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="font-mono text-slate-800 dark:text-slate-200">{f.tracking_number}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column (4 cols): Customer Profile, Shipping, Billing, Tags */}
            <div className="lg:col-span-4 space-y-5">
              {/* Customer Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer Details</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {order.customerOrdersCount || 1} {order.customerOrdersCount === 1 ? "order" : "orders"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    {(order.customerName || "C").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {order.customerName || "Customer"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Total spent: {order.currency || "$"}{order.customerTotalSpent || order.totalPrice}
                    </p>
                  </div>
                </div>

                {/* Contact items */}
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
                          navigator.clipboard.writeText(order.customerEmail)
                          toast.success("Email copied")
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
                            navigator.clipboard.writeText(order.customerPhone)
                            toast.success("Phone copied")
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

              {/* Shipping Address Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Shipping Address</span>
                </div>
                {shipping ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {[shipping.first_name, shipping.last_name].filter(Boolean).join(" ") || shipping.name || order.customerName}
                    </p>
                    {shipping.company && <p>{shipping.company}</p>}
                    {shipping.address1 && <p>{shipping.address1}</p>}
                    {shipping.address2 && <p>{shipping.address2}</p>}
                    <p>
                      {[shipping.city, shipping.province || shipping.province_code, shipping.zip].filter(Boolean).join(", ")}
                    </p>
                    {shipping.country && <p>{shipping.country}</p>}
                    {shipping.phone && <p className="font-mono pt-1 text-[11px]">{shipping.phone}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No shipping address provided.</p>
                )}
              </div>

              {/* Billing Address Card */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Billing Address</span>
                </div>
                {billing ? (
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {[billing.first_name, billing.last_name].filter(Boolean).join(" ") || billing.name || order.customerName}
                    </p>
                    {billing.address1 && <p>{billing.address1}</p>}
                    {billing.address2 && <p>{billing.address2}</p>}
                    <p>
                      {[billing.city, billing.province, billing.zip].filter(Boolean).join(", ")}
                    </p>
                    {billing.country && <p>{billing.country}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Same as shipping address.</p>
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
            Shopify ID: {order.id}
          </span>
          <div className="flex items-center gap-2">
            {fStatus !== "fulfilled" && !isCancelled && onFulfill && (
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
                  <Package className="w-3.5 h-3.5" />
                )}
                <span>Mark as Fulfilled in Shopify</span>
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
  )
}

type ExportableShopifyTab = "products" | "customers"
type OrderDayFilter = "all" | "today" | "yesterday" | "last-7-days" | "last-30-days"
type ExportRow = Record<string, string | number>
type ExportColumn = {
  key: string
  header: string
  width: string
}
type ExportConfig = {
  title: string
  sheetName: string
  fileName: string
  columns: ExportColumn[]
  rows: ExportRow[]
}

const isExportableTab = (tab: ShopifyTab): tab is ExportableShopifyTab => tab === "products" || tab === "customers"

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
    lineHeight: 1.25,
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
})

function ShopifyExportPDF({
  title,
  columns,
  rows,
  generatedAt,
}: {
  title: string
  columns: ExportColumn[]
  rows: ExportRow[]
  generatedAt: string
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
          Shopify integration export - {rows.length} records
        </Text>
      </Page>
    </Document>
  )
}

const dashboardPdfStyles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#10b981",
    marginBottom: 20,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  reportBadge: {
    marginTop: 4,
    fontSize: 10,
    color: "#059669",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  storeMeta: {
    marginTop: 3,
    fontSize: 9,
    color: "#64748b",
  },
  rightMeta: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "right",
    lineHeight: 1.4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e293b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  card: {
    width: "31%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  cardLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 3,
  },
  cardCaption: {
    fontSize: 7.5,
    color: "#94a3b8",
  },
  distContainer: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    marginBottom: 16,
  },
  distRow: {
    marginBottom: 10,
  },
  distHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  distLabel: {
    fontSize: 9,
    fontWeight: "bold",
  },
  distValues: {
    fontSize: 9,
    color: "#64748b",
  },
  barTrack: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    minHeight: 24,
    alignItems: "center",
  },
  tableHeader: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1.5,
    borderBottomColor: "#10b981",
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    bottom: 20,
    left: 32,
    right: 32,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
})

function ShopifyDashboardReportPDF({
  storeUrl,
  filterLabel,
  generatedAt,
  cards,
  statusCounts,
  totalOrdersCount,
}: {
  storeUrl: string
  filterLabel: string
  generatedAt: string
  cards: { label: string; value: string; caption: string }[]
  statusCounts: Record<string, number>
  totalOrdersCount: number
}) {
  const confirmedCount = statusCounts.confirmed || 0
  const pendingCount = statusCounts.pending || 0
  const cancelledCount = statusCounts.cancelled || 0

  const confirmedPct = totalOrdersCount > 0 ? (confirmedCount / totalOrdersCount) * 100 : 0
  const pendingPct = totalOrdersCount > 0 ? (pendingCount / totalOrdersCount) * 100 : 0
  const cancelledPct = totalOrdersCount > 0 ? (cancelledCount / totalOrdersCount) * 100 : 0

  return (
    <Document>
      <Page size="A4" style={dashboardPdfStyles.page}>
        {/* Header */}
        <View style={dashboardPdfStyles.header}>
          <View>
            <Text style={dashboardPdfStyles.brand}>WatiBot</Text>
            <Text style={dashboardPdfStyles.reportBadge}>Shopify Integration • Dashboard Report</Text>
            <Text style={dashboardPdfStyles.storeMeta}>Store: {storeUrl || "Shopify Store"}</Text>
          </View>
          <View style={dashboardPdfStyles.rightMeta}>
            <Text style={{ fontWeight: "bold", color: "#059669" }}>Filter: {filterLabel}</Text>
            <Text>Generated: {generatedAt}</Text>
            <Text>Total Orders: {totalOrdersCount}</Text>
          </View>
        </View>

        {/* Section 1: Key Performance Indicator Cards */}
        <Text style={dashboardPdfStyles.sectionTitle}>Key Performance Indicators</Text>
        <View style={dashboardPdfStyles.cardsGrid}>
          {cards.map((c, i) => (
            <View key={i} style={dashboardPdfStyles.card}>
              <Text style={dashboardPdfStyles.cardLabel}>{c.label}</Text>
              <Text style={dashboardPdfStyles.cardValue}>{c.value}</Text>
              <Text style={dashboardPdfStyles.cardCaption}>{c.caption}</Text>
            </View>
          ))}
        </View>

        {/* Section 2: Order Payment & Status Distribution */}
        <Text style={dashboardPdfStyles.sectionTitle}>Order Payment & Status Distribution</Text>
        <View style={dashboardPdfStyles.distContainer}>
          {/* Confirmed Bar */}
          <View style={dashboardPdfStyles.distRow}>
            <View style={dashboardPdfStyles.distHeader}>
              <Text style={[dashboardPdfStyles.distLabel, { color: "#059669" }]}>Confirmed Orders</Text>
              <Text style={dashboardPdfStyles.distValues}>
                {confirmedCount} {confirmedCount === 1 ? "order" : "orders"} ({confirmedPct.toFixed(0)}%)
              </Text>
            </View>
            <View style={dashboardPdfStyles.barTrack}>
              <View
                style={[
                  dashboardPdfStyles.barFill,
                  { width: `${Math.max(confirmedPct, totalOrdersCount > 0 ? 1 : 0)}%`, backgroundColor: "#10b981" },
                ]}
              />
            </View>
          </View>

          {/* Pending Bar */}
          <View style={dashboardPdfStyles.distRow}>
            <View style={dashboardPdfStyles.distHeader}>
              <Text style={[dashboardPdfStyles.distLabel, { color: "#d97706" }]}>Pending Orders</Text>
              <Text style={dashboardPdfStyles.distValues}>
                {pendingCount} {pendingCount === 1 ? "order" : "orders"} ({pendingPct.toFixed(0)}%)
              </Text>
            </View>
            <View style={dashboardPdfStyles.barTrack}>
              <View
                style={[
                  dashboardPdfStyles.barFill,
                  { width: `${Math.max(pendingPct, totalOrdersCount > 0 ? 1 : 0)}%`, backgroundColor: "#f59e0b" },
                ]}
              />
            </View>
          </View>

          {/* Cancelled Bar */}
          <View style={dashboardPdfStyles.distRow}>
            <View style={dashboardPdfStyles.distHeader}>
              <Text style={[dashboardPdfStyles.distLabel, { color: "#dc2626" }]}>Cancelled / Refunded</Text>
              <Text style={dashboardPdfStyles.distValues}>
                {cancelledCount} {cancelledCount === 1 ? "order" : "orders"} ({cancelledPct.toFixed(0)}%)
              </Text>
            </View>
            <View style={dashboardPdfStyles.barTrack}>
              <View
                style={[
                  dashboardPdfStyles.barFill,
                  { width: `${Math.max(cancelledPct, totalOrdersCount > 0 ? 1 : 0)}%`, backgroundColor: "#ef4444" },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Section 3: Summary Breakdown Table */}
        <Text style={dashboardPdfStyles.sectionTitle}>Distribution Summary Table</Text>
        <View style={dashboardPdfStyles.table}>
          <View style={[dashboardPdfStyles.tableRow, dashboardPdfStyles.tableHeader]}>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={dashboardPdfStyles.tableHeaderText}>Status Category</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableHeaderText}>Order Volume</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableHeaderText}>Share (%)</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={dashboardPdfStyles.tableHeaderText}>Description</Text>
            </View>
          </View>

          <View style={dashboardPdfStyles.tableRow}>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={[dashboardPdfStyles.tableCellText, { fontWeight: "bold", color: "#059669" }]}>Confirmed</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>{confirmedCount} {confirmedCount === 1 ? "order" : "orders"}</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>{confirmedPct.toFixed(1)}%</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>Tagged & confirmed orders</Text>
            </View>
          </View>

          <View style={dashboardPdfStyles.tableRow}>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={[dashboardPdfStyles.tableCellText, { fontWeight: "bold", color: "#d97706" }]}>Pending</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>{pendingCount} {pendingCount === 1 ? "order" : "orders"}</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>{pendingPct.toFixed(1)}%</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>Untagged / awaiting confirmation</Text>
            </View>
          </View>

          <View style={dashboardPdfStyles.tableRow}>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={[dashboardPdfStyles.tableCellText, { fontWeight: "bold", color: "#dc2626" }]}>Cancelled</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>{cancelledCount} {cancelledCount === 1 ? "order" : "orders"}</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "20%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>{cancelledPct.toFixed(1)}%</Text>
            </View>
            <View style={[dashboardPdfStyles.tableCell, { width: "30%" }]}>
              <Text style={dashboardPdfStyles.tableCellText}>Cancelled or refunded orders</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={dashboardPdfStyles.footer}>
          WatiBot Shopify Analytics Report • Store: {storeUrl || "N/A"} • Period: {filterLabel} • Page 1 of 1
        </Text>
      </Page>
    </Document>
  )
}

function toExportValue(value: unknown, fallback: string | number = "") {
  if (value === null || value === undefined || value === "") return fallback
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback
  return String(value)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const ShopifyIcon = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="none">
    <path d="M18.8 8.1l-1.9-4.8c-.2-.5-.8-.7-1.3-.5l-3.3 1.2-3.3-1.2c-.5-.2-1.1 0-1.3.5l-1.9 4.8c-.8.3-1.5 1-1.6 1.9L2.8 19c-.2 1.3.7 2.4 2 2.4h14.4c1.3 0 2.2-1.1 2-2.4l-1.4-9c-.1-.9-.8-1.6-1.6-1.9z" fill="#95BF47"/>
    <path d="M12 6.5v8" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 10.5h6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 10.5v-2c0-1.4 1.1-2.5 2.5-2.5h0" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export default function ShopifyIntegrationPage() {
  const t = useTranslations("ShopifyIntegrationPage")
  const locale = useLocale()
  const isRtl = RTL_LOCALES.has(locale)
  const intlLocale = LOCALE_MAP[locale] ?? locale
  const [token, setToken] = useState<string | null>(null)
  const [storeUrl, setStoreUrl] = useState<string | null>(null)
  const [shopifyAccessToken, setShopifyAccessToken] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<ShopifyTab>("setup")
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([])
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [dashboardDateRange, setDashboardDateRange] = useState<"all" | "today" | "yesterday" | "last-7-days" | "last-30-days" | "custom">("all")
  const [dashboardFromDate, setDashboardFromDate] = useState("")
  const [dashboardToDate, setDashboardToDate] = useState("")
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<"all" | "confirmed" | "pending" | "cancelled">("all")
  const [orderDateRange, setOrderDateRange] = useState<"all" | "today" | "yesterday" | "last-7-days" | "last-30-days" | "custom">("all")
  const [orderConfirmationFilter, setOrderConfirmationFilter] = useState<"all" | "confirmed" | "pending" | "cancelled">("all")
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState("all")
  const [orderFulfillmentStatusFilter, setOrderFulfillmentStatusFilter] = useState("all")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [orderFromDate, setOrderFromDate] = useState("")
  const [orderToDate, setOrderToDate] = useState("")
  const [orderFromTime, setOrderFromTime] = useState("")
  const [orderToTime, setOrderToTime] = useState("")
  const [orderSearchQuery, setOrderSearchQuery] = useState("")
  const [orderQuickTab, setOrderQuickTab] = useState<"all" | "unfulfilled" | "unpaid" | "open" | "archived">("all")
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any | null>(null)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  // Bulk Fulfillment State
  const [isBulkFulfilling, setIsBulkFulfilling] = useState(false)
  const [isFulfillDialogOpen, setIsFulfillDialogOpen] = useState(false)
  const [fulfillNotifyCustomer, setFulfillNotifyCustomer] = useState(false)
  const [isFulfillingSingleId, setIsFulfillingSingleId] = useState<string | null>(null)
  // Pending Orders Broadcast State
  const [pendingFilterDateRange, setPendingFilterDateRange] = useState<"all" | "today" | "yesterday" | "this-week" | "last-7-days" | "last-30-days" | "custom">("all")
  const [pendingFromDate, setPendingFromDate] = useState("")
  const [pendingToDate, setPendingToDate] = useState("")
  const [pendingSelectedTemplate, setPendingSelectedTemplate] = useState<string>("")
  const [pendingVariableMappings, setPendingVariableMappings] = useState<Record<string, string>>({
    "1": "customer.first_name",
    "2": "order_number",
    "3": "total_price",
  })
  const [selectedPendingOrderIds, setSelectedPendingOrderIds] = useState<string[]>([])
  const [isSendingPendingBroadcast, setIsSendingPendingBroadcast] = useState(false)
  const [pendingBroadcastResult, setPendingBroadcastResult] = useState<any | null>(null)
  const [pendingSearchQuery, setPendingSearchQuery] = useState("")
  // Full automation state
  const [fullAutomation, setFullAutomation] = useState<Record<string, any>>({})
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [isTogglingModuleId, setIsTogglingModuleId] = useState<string | null>(null)
  const [isSavingModule, setIsSavingModule] = useState(false)
  const [dbFlows, setDbFlows] = useState<{ id: string; name: string; isActive: boolean }[]>([])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "PENDING":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "REJECTED":
        return "bg-red-50 text-red-600 border-red-100";
      default:
        return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false)
  const tSafe = (key: string, fallback: string) => {
    try {
      const value = t(key)
      return value === key || value === `ShopifyIntegrationPage.${key}` ? fallback : value
    } catch {
      return fallback
    }
  }

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "—"
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return "—"
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed)
  }

  const formatShopifyDate = (date: string | Date | null | undefined) => {
    if (!date) return "—"
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return "—"
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const month = months[parsed.getMonth()]
    const day = parsed.getDate()
    let hours = parsed.getHours()
    const minutes = parsed.getMinutes().toString().padStart(2, "0")
    const ampm = hours >= 12 ? "pm" : "am"
    hours = hours % 12
    hours = hours ? hours : 12
    return `${month} ${day} at ${hours}:${minutes} ${ampm}`
  }

  const getFulfillByText = (date: string | Date | null | undefined, isUnfulfilled: boolean) => {
    if (!date || !isUnfulfilled) return null
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return null
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return "Today"
    return `${diffDays} days ago`
  }

  const formatTime = (date: string | Date | null | undefined) => {
    if (!date) return ""
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return ""
    return new Intl.DateTimeFormat(intlLocale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed)
  }

  const formatDateTime = (date: string | Date | null | undefined) => {
    const dateText = formatDate(date)
    const timeText = formatTime(date)
    return timeText ? `${dateText} ${timeText}` : dateText
  }

  const toLocalDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const getStartOfLocalDay = (date = new Date()) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const getRowDate = (value: string | Date | null | undefined) => {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const normalizeStatus = (status: unknown) =>
    String(status || "unknown").toLowerCase().replace(/[\s-]+/g, "_")

  const getOrderStatus = (order: any) =>
    normalizeStatus(order.paymentStatus || order.financialStatus || order.fulfillmentStatus || order.status)

  const isCancelledOrder = (order: any) => {
    const status = getOrderStatus(order)
    if (["cancelled", "canceled", "voided", "refunded", "failed"].includes(status)) return true
    if (order.cancelledAt) return true
    const tags = String(order.tags || "").toLowerCase()
    if (tags.includes("cancel") || tags.includes("cancelled") || tags.includes("canceled")) return true
    return false
  }

  const isConfirmedOrder = (order: any) => {
    if (isCancelledOrder(order)) return false
    const tags = (order.tags || "").trim()
    return tags.length > 0
  }

  const isPendingOrder = (order: any) => {
    if (isCancelledOrder(order)) return false
    const tags = (order.tags || "").trim()
    return tags.length === 0
  }

  const orderMatchesDateRange = (createdAt: Date | null) => {
    if (orderDateRange === "all") return true
    if (!createdAt) return false

    const now = new Date()
    const todayStart = getStartOfLocalDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    if (orderDateRange === "today") {
      return createdAt >= todayStart && createdAt <= todayEnd
    }

    if (orderDateRange === "yesterday") {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayEnd = new Date(todayStart.getTime() - 1)
      return createdAt >= yesterdayStart && createdAt <= yesterdayEnd
    }

    if (orderDateRange === "last-7-days") {
      const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
      return createdAt >= sevenDaysAgo && createdAt <= todayEnd
    }

    if (orderDateRange === "last-30-days") {
      const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)
      return createdAt >= thirtyDaysAgo && createdAt <= todayEnd
    }

    if (orderDateRange === "custom") {
      if (orderFromDate) {
        const fromDateStart = new Date(orderFromDate + "T00:00:00")
        if (createdAt < fromDateStart) return false
      }
      if (orderToDate) {
        const toDateEnd = new Date(orderToDate + "T23:59:59.999")
        if (createdAt > toDateEnd) return false
      }
      if (orderFromTime) {
        const [fromHour, fromMin] = orderFromTime.split(":").map(Number)
        const orderMinutes = createdAt.getHours() * 60 + createdAt.getMinutes()
        const fromMinutes = fromHour * 60 + fromMin
        if (orderMinutes < fromMinutes) return false
      }
      if (orderToTime) {
        const [toHour, toMin] = orderToTime.split(":").map(Number)
        const orderMinutes = createdAt.getHours() * 60 + createdAt.getMinutes()
        const toMinutes = toHour * 60 + toMin
        if (orderMinutes > toMinutes) return false
      }
    }

    return true
  }

  const orderMatchesTimeFilters = (order: any) => {
    const hasTimeFilters = Boolean(orderFromDate || orderToDate || orderFromTime || orderToTime)
    const createdAt = getRowDate(order.createdAt)

    if (hasTimeFilters) {
      if (!createdAt) return false

      // From Date filter
      if (orderFromDate) {
        const fromDateStart = new Date(orderFromDate + "T00:00:00")
        if (createdAt < fromDateStart) return false
      }

      // To Date filter
      if (orderToDate) {
        const toDateEnd = new Date(orderToDate + "T23:59:59.999")
        if (createdAt > toDateEnd) return false
      }

      // From Time filter
      if (orderFromTime) {
        const [fromHour, fromMin] = orderFromTime.split(":").map(Number)
        const orderMinutes = createdAt.getHours() * 60 + createdAt.getMinutes()
        const fromMinutes = fromHour * 60 + fromMin
        if (orderMinutes < fromMinutes) return false
      }

      // To Time filter
      if (orderToTime) {
        const [toHour, toMin] = orderToTime.split(":").map(Number)
        const orderMinutes = createdAt.getHours() * 60 + createdAt.getMinutes()
        const toMinutes = toHour * 60 + toMin
        if (orderMinutes > toMinutes) return false
      }
    }

    if (orderStatusFilter !== "all" && getOrderStatus(order) !== orderStatusFilter) {
      return false
    }

    return true
  }

  const orderMatchesFilters = (order: any) => {
    // Quick Tab filter (All, Unfulfilled, Unpaid, Open, Archived)
    if (orderQuickTab === "unfulfilled") {
      const fStatus = normalizeStatus(order.fulfillmentStatus || "")
      if (fStatus === "fulfilled" || isCancelledOrder(order)) return false
    } else if (orderQuickTab === "unpaid") {
      const pStatus = normalizeStatus(order.paymentStatus || order.financialStatus || "")
      if (pStatus === "paid" || isCancelledOrder(order)) return false
    } else if (orderQuickTab === "open") {
      if (isCancelledOrder(order)) return false
    } else if (orderQuickTab === "archived") {
      if (!isCancelledOrder(order)) return false
    }

    // Confirmation Status filter (Confirmed vs Pending vs Cancelled)
    if (orderConfirmationFilter === "confirmed") {
      if (isCancelledOrder(order) || !isConfirmedOrder(order)) return false
    } else if (orderConfirmationFilter === "pending") {
      if (isCancelledOrder(order) || !isPendingOrder(order)) return false
    } else if (orderConfirmationFilter === "cancelled") {
      if (!isCancelledOrder(order)) return false
    }

    // Payment Status filter
    if (orderPaymentStatusFilter !== "all") {
      const pStatus = normalizeStatus(order.paymentStatus || order.financialStatus || "")
      if (pStatus !== orderPaymentStatusFilter) return false
    }

    // Fulfillment Status filter
    if (orderFulfillmentStatusFilter !== "all") {
      const fStatus = normalizeStatus(order.fulfillmentStatus || "")
      if (fStatus !== orderFulfillmentStatusFilter) return false
    }

    // Date Range (Today, Yesterday, Last 7 days, Last 30 days, Custom)
    const createdAt = getRowDate(order.createdAt)
    if (!orderMatchesDateRange(createdAt)) return false

    // Search query filter
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim()
      const orderNum = String(order.orderNumber || "").toLowerCase()
      const customer = String(order.customerName || "").toLowerCase()
      const email = String(order.customerEmail || "").toLowerCase()
      const phone = String(order.customerPhone || "").toLowerCase()
      const tags = String(order.tags || "").toLowerCase()
      const channel = String(order.channel || "").toLowerCase()
      const total = String(order.totalPrice || "").toLowerCase()
      if (
        !orderNum.includes(q) &&
        !customer.includes(q) &&
        !email.includes(q) &&
        !phone.includes(q) &&
        !tags.includes(q) &&
        !channel.includes(q) &&
        !total.includes(q)
      ) {
        return false
      }
    }

    return true
  }

  const clearOrderFilters = () => {
    setOrderDateRange("all")
    setOrderConfirmationFilter("all")
    setOrderPaymentStatusFilter("all")
    setOrderFulfillmentStatusFilter("all")
    setOrderStatusFilter("all")
    setOrderFromDate("")
    setOrderToDate("")
    setOrderFromTime("")
    setOrderToTime("")
    setOrderSearchQuery("")
    setOrderQuickTab("all")
  }

  // Pending Orders Broadcast Filtering Logic
  const allPendingOrders = orders.filter((o) => isPendingOrder(o))

  const filteredPendingOrders = allPendingOrders.filter((order) => {
    const createdAt = getRowDate(order.createdAt)
    if (!createdAt) return true

    const now = new Date()
    const todayStart = getStartOfLocalDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    if (pendingFilterDateRange === "today") {
      if (createdAt < todayStart || createdAt > todayEnd) return false
    } else if (pendingFilterDateRange === "yesterday") {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayEnd = new Date(todayStart.getTime() - 1)
      if (createdAt < yesterdayStart || createdAt > yesterdayEnd) return false
    } else if (pendingFilterDateRange === "this-week") {
      const dayOfWeek = now.getDay()
      const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
      if (createdAt < firstDayOfWeek) return false
    } else if (pendingFilterDateRange === "last-7-days") {
      const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (createdAt < sevenDaysAgo || createdAt > todayEnd) return false
    } else if (pendingFilterDateRange === "last-30-days") {
      const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000)
      if (createdAt < thirtyDaysAgo || createdAt > todayEnd) return false
    } else if (pendingFilterDateRange === "custom") {
      if (pendingFromDate) {
        const fromDateStart = new Date(pendingFromDate + "T00:00:00")
        if (createdAt < fromDateStart) return false
      }
      if (pendingToDate) {
        const toDateEnd = new Date(pendingToDate + "T23:59:59.999")
        if (createdAt > toDateEnd) return false
      }
    }

    if (pendingSearchQuery.trim()) {
      const q = pendingSearchQuery.toLowerCase().trim()
      const orderNum = String(order.orderNumber || "").toLowerCase()
      const customer = String(order.customerName || "").toLowerCase()
      const phone = String(order.customerPhone || "").toLowerCase()
      if (!orderNum.includes(q) && !customer.includes(q) && !phone.includes(q)) return false
    }

    return true
  })

  // Template select handler
  const handlePendingTemplateChange = (templateName: string) => {
    setPendingSelectedTemplate(templateName)
    const tpl = availableTemplates.find((t) => t.name === templateName)
    const bodyComp = tpl?.components?.find((c: any) => c.type === "BODY")
    const placeholders = bodyComp?.text ? detectPlaceholders(bodyComp.text) : []
    const initialMappings: Record<string, string> = { ...pendingVariableMappings }
    placeholders.forEach((num, idx) => {
      if (!initialMappings[num.toString()]) {
        if (idx === 0) initialMappings[num.toString()] = "customer.first_name"
        else if (idx === 1) initialMappings[num.toString()] = "order_number"
        else if (idx === 2) initialMappings[num.toString()] = "total_price"
        else initialMappings[num.toString()] = "shop_url"
      }
    })
    setPendingVariableMappings(initialMappings)
  }

  const handleSendPendingBroadcast = async () => {
    if (!pendingSelectedTemplate) {
      toast.error("Please select a WhatsApp template")
      return
    }

    const targetOrders = filteredPendingOrders.filter((o) => selectedPendingOrderIds.includes(o.id))
    if (targetOrders.length === 0) {
      toast.error("Please select at least 1 pending order to send reminders")
      return
    }

    const tpl = availableTemplates.find((t) => t.name === pendingSelectedTemplate)
    setIsSendingPendingBroadcast(true)
    const toastId = toast.loading(`Sending WhatsApp reminder to ${targetOrders.length} pending orders...`)

    try {
      const res = await sendPendingOrdersWhatsAppBroadcast({
        orders: targetOrders,
        templateName: pendingSelectedTemplate,
        templateLanguage: tpl?.language || "en",
        variableMappings: pendingVariableMappings,
      })

      if (res.success) {
        toast.success(`Successfully sent ${res.sentCount} reminders! (${res.failedCount} failed)`, { id: toastId })
        setPendingBroadcastResult(res)
      } else {
        toast.error("Failed to send WhatsApp broadcast", { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send broadcast", { id: toastId })
    } finally {
      setIsSendingPendingBroadcast(false)
    }
  }

  const toNumber = (value: unknown) => {
    const parsed = Number.parseFloat(String(value ?? "0"))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const formatCurrency = (amount: number, currency = orders[0]?.currency || "") => {
    try {
      if (!currency) return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency,
        currencyDisplay: "code",
      }).format(amount)
    } catch {
      return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
    }
  }

  const formatOrderCount = (count: number) => `${count} ${count === 1 ? "order" : "orders"}`

  const formatStatus = (status: unknown) => {
    const normalized = normalizeStatus(status)
    const statusMap: Record<string, string> = {
      confirmed: "Confirmed",
      paid: "Paid",
      pending: "Pending",
      authorized: "Authorized",
      partially_paid: "Partially Paid",
      refunded: "Refunded",
      voided: "Voided",
      cancelled: "Cancelled",
      canceled: "Cancelled",
      fulfilled: "Fulfilled",
      unfulfilled: "Unfulfilled",
      open: "Open",
      unknown: "Unknown",
    }
    return statusMap[normalized] || normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  const getCustomerDetails = (customer: any) => {
    const customerOrders = orders.filter((o) => {
      const cEmail = (customer.email || "").toLowerCase().trim()
      const oEmail = (o.customerEmail || "").toLowerCase().trim()
      if (cEmail && oEmail && cEmail === oEmail) return true
      const cPhone = (customer.phone || "").replace(/\D/g, "")
      const oPhone = (o.customerPhone || "").replace(/\D/g, "")
      if (cPhone && oPhone && cPhone.length >= 6 && (cPhone.includes(oPhone) || oPhone.includes(cPhone))) return true
      const cName = (customer.name || "").toLowerCase().trim()
      const oName = (o.customerName || "").toLowerCase().trim()
      if (cName && oName && cName === oName && cName !== "customer") return true
      return false
    })

    const lastOrder = customerOrders[0] || null
    const orderCount = Math.max(Number(customer.orderCount) || 0, customerOrders.length)
    const allProducts = customerOrders.flatMap((o) => o.lineItems || [])
    
    // Group unique products across orders
    const productMap = new Map<string, { title: string; quantity: number }>()
    allProducts.forEach((item: any) => {
      const title = item.title || item.name || "Product"
      const existing = productMap.get(title)
      if (existing) {
        existing.quantity += Number(item.quantity) || 1
      } else {
        productMap.set(title, { title, quantity: Number(item.quantity) || 1 })
      }
    })
    const uniqueProducts = Array.from(productMap.values())
    const productsSummary = uniqueProducts.map((p) => `${p.title} x${p.quantity || 1}`).join(", ")

    return {
      customerOrders,
      lastOrder,
      orderCount,
      uniqueProducts,
      productsSummary,
    }
  }

  const getStatusTheme = (status: unknown) => {
    const normalized = normalizeStatus(status)
    if (["confirmed", "paid", "fulfilled", "completed"].includes(normalized)) {
      return {
        bar: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
        badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      }
    }
    if (["pending", "authorized", "partially_paid", "open", "unfulfilled"].includes(normalized)) {
      return {
        bar: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
        badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      }
    }
    if (["cancelled", "canceled", "voided", "refunded", "failed"].includes(normalized)) {
      return {
        bar: "bg-red-500",
        text: "text-red-700 dark:text-red-400",
        badge: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
      }
    }
    return {
      bar: "bg-slate-400",
      text: "text-slate-600 dark:text-slate-300",
      badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    }
  }

  const getOrderStatusColor = (status: unknown) => {
    const normalized = normalizeStatus(status)
    if (["confirmed", "paid", "fulfilled", "completed"].includes(normalized)) {
      return "#10b981"
    }
    if (["pending", "authorized", "partially_paid", "open", "unfulfilled"].includes(normalized)) {
      return "#f59e0b"
    }
    if (["cancelled", "canceled", "voided", "refunded", "failed"].includes(normalized)) {
      return "#ef4444"
    }
    return "#9ca3af"
  }

  useEffect(() => {
    loadIntegrationData()
  }, [])

  async function loadIntegrationData() {
    setIsLoading(true)
    try {
      const data = await getShopifyIntegrationKey()
      setToken(data?.shopifyIntegrationToken || null)
      setStoreUrl(data?.shopifyStoreUrl || null)
      setShopifyAccessToken(data?.shopifyAccessToken || null)
      setActiveTab((currentTab) => {
        if (!data?.shopifyStoreUrl) return "setup"
        return currentTab === "setup" ? "dashboard" : currentTab
      })
      
      const [ordersData, productsData, automationData, templatesData, customersData, fullAutomationData, flowsData] = await Promise.all([
        getShopifyOrders(),
        getShopifyProducts(),
        getShopifyAutomationSettings(),
        getMessageTemplates(),
        getShopifyCustomers(),
        getShopifyFullAutomation(),
        getShopifyFlows(),
      ])
      setOrders(ordersData)
      setProducts(productsData)
      setCustomers(customersData)
      setIsAutomationEnabled(automationData?.shopifyOrderAutomationEnabled || false)
      setSelectedTemplate(automationData?.shopifyOrderTemplate || "")
      setFullAutomation(fullAutomationData || {})
      setDbFlows(flowsData || [])
      
      if (templatesData.success) {
        setAvailableTemplates(templatesData.data)
      }
    } catch (error: any) {
      console.error("Failed to load shopify data:", error)
      toast.error(t("toasts.loadError"))
    } finally {
      setIsLoading(false)
    }
  }


  async function handleReloadTemplates() {
    try {
      const templatesData = await getMessageTemplates()
      if (templatesData.success) {
        setAvailableTemplates(templatesData.data)
        toast.success(t("toasts.templatesRefreshed"))
      } else {
        toast.error(templatesData.error || t("toasts.templatesRefreshError"))
      }
    } catch (error) {
      toast.error(t("toasts.templatesRefreshUnexpected"))
    }
  }

  async function handleSaveSettings() {
    setIsSavingSettings(true)
    try {
      const templateObj = availableTemplates.find(t => t.name === selectedTemplate);
      const language = templateObj?.language || "en_US";
      
      await updateShopifyAutomationSettings(isAutomationEnabled, selectedTemplate, language)
      toast.success(t("toasts.automationSaved"))
    } catch (error: any) {
      toast.error(error.message || t("toasts.saveSettingsError"))
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function handleSync() {
    setIsSyncing(true)
    try {
      const res = await syncShopifyProducts()
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error.message || t("toasts.syncProductsError"))
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleRefreshConnection() {
    setIsRefreshing(true)
    try {
      const res = await manualRefreshShopifyToken()
      toast.success(res.message)
      // Reload data to show updated token
      await loadIntegrationData()
    } catch (error: any) {
      toast.error(error.message || t("toasts.refreshConnectionError"))
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleDisconnectStore() {
    if (!storeUrl) return

    setIsDisconnecting(true)
    try {
      const result = await disconnectIntegration("shopify")

      if (!result.success) {
        toast.error(result.error || tSafe("toasts.disconnectError", "Failed to disconnect Shopify"))
        return
      }

      setToken(null)
      setStoreUrl(null)
      setShopifyAccessToken(null)
      setOrders([])
      setProducts([])
      setCustomers([])
      setIsAutomationEnabled(false)
      setSelectedTemplate("")
      setActiveTab("setup")
      toast.success(tSafe("toasts.disconnected", "Shopify disconnected successfully."))
    } catch (error) {
      console.error("Failed to disconnect Shopify:", error)
      toast.error(tSafe("toasts.disconnectError", "Failed to disconnect Shopify"))
    } finally {
      setIsDisconnecting(false)
    }
  }

  async function handleGenerateKey() {
    setIsGenerating(true)
    try {
      const newToken = await generateShopifyIntegrationKey()
      setToken(newToken)
      toast.success(t("toasts.keyGenerated"))
    } catch (error) {
      toast.error(t("toasts.keyGenerateError"))
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Full Automation Handlers ────────────────────────────────────────────────
  async function handleToggleModule(moduleId: string, active: boolean) {
    setIsTogglingModuleId(moduleId)
    try {
      await updateShopifyFullAutomation(moduleId, { active })
      setFullAutomation(prev => ({ ...prev, [moduleId]: { ...(prev[moduleId] ?? {}), active } }))
      toast.success(`${active ? "Enabled" : "Disabled"} ${AUTOMATION_MODULES.find(m => m.id === moduleId)?.title ?? moduleId}`)
    } catch (e: any) {
      toast.error(e.message || "Failed to update automation")
    } finally {
      setIsTogglingModuleId(null)
    }
  }

  async function handleSaveModule(moduleId: string, data: Record<string, any>) {
    setIsSavingModule(true)
    try {
      await updateShopifyFullAutomation(moduleId, data)
      setFullAutomation(prev => ({ ...prev, [moduleId]: { ...(prev[moduleId] ?? {}), ...data } }))
      setEditingModuleId(null)
      toast.success("Automation settings saved")
    } catch (e: any) {
      toast.error(e.message || "Failed to save automation")
    } finally {
      setIsSavingModule(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success(t("toasts.copied"))
  }

  // ─── Fulfillment Handlers ────────────────────────────────────────────────
  async function handleBulkFulfill() {
    if (selectedOrderIds.length === 0) return
    setIsBulkFulfilling(true)
    try {
      const res = await bulkFulfillShopifyOrders(selectedOrderIds, {
        notifyCustomer: fulfillNotifyCustomer,
      })
      if (res.success) {
        if (res.failedCount === 0) {
          toast.success(`Successfully fulfilled all ${res.fulfilledCount} orders on Shopify!`)
        } else {
          toast.warning(`Fulfilled ${res.fulfilledCount} orders (${res.failedCount} failed).`)
        }
        setIsFulfillDialogOpen(false)
        setSelectedOrderIds([])
        // Refresh orders from Shopify
        await loadIntegrationData()
      } else {
        toast.error("Failed to fulfill orders on Shopify.")
      }
    } catch (err: any) {
      console.error("Bulk fulfill error:", err)
      toast.error(err.message || "Failed to bulk fulfill orders on Shopify.")
    } finally {
      setIsBulkFulfilling(false)
    }
  }

  async function handleSingleFulfill(orderId: string) {
    setIsFulfillingSingleId(orderId)
    try {
      const res = await fulfillShopifyOrder(orderId, {
        notifyCustomer: fulfillNotifyCustomer,
      })
      if (res.success) {
        toast.success(res.message || `Order #${orderId} fulfilled successfully on Shopify!`)
        await loadIntegrationData()
        if (selectedOrderForDetails && selectedOrderForDetails.id === orderId) {
          setSelectedOrderForDetails((prev: any) =>
            prev ? { ...prev, fulfillmentStatus: "fulfilled" } : null
          )
        }
      } else {
        toast.error("Failed to fulfill order on Shopify.")
      }
    } catch (err: any) {
      console.error("Single fulfill error:", err)
      toast.error(err.message || "Failed to fulfill order on Shopify.")
    } finally {
      setIsFulfillingSingleId(null)
    }
  }

  function buildExportConfig(tab: ShopifyTab = activeTab): ExportConfig | null {
    const dateStamp = new Date().toISOString().slice(0, 10)

    if (tab === "orders" || tab === "dashboard") {
      const isDashboard = tab === "dashboard"
      const targetOrders = isDashboard ? dashboardOrders : filteredOrders
      const statusSuffix = isDashboard && dashboardStatusFilter !== "all" ? ` (${dashboardStatusFilter.toUpperCase()})` : ""
      const dateSuffix = isDashboard ? ` - ${getDashboardFilterLabel()}` : ""

      const columns: ExportColumn[] = [
        { key: "orderNumber", header: "Order", width: "7%" },
        { key: "date", header: "Date", width: "11%" },
        { key: "customer", header: "Customer", width: "16%" },
        { key: "items", header: "Ordered Products", width: "18%" },
        { key: "channel", header: "Channel", width: "8%" },
        { key: "total", header: "Total", width: "8%" },
        { key: "paymentStatus", header: "Payment Status", width: "8%" },
        { key: "fulfillmentStatus", header: "Fulfillment Status", width: "8%" },
        { key: "deliveryMethod", header: "Delivery Method", width: "8%" },
        { key: "tags", header: "Tags / Status", width: "8%" },
      ]
      return {
        title: `Shopify ${t("tabs.orders")}${statusSuffix}${dateSuffix}`,
        sheetName: t("tabs.orders"),
        fileName: `shopify-orders-${isDashboard && dashboardStatusFilter !== "all" ? `${dashboardStatusFilter}-` : ""}${dateStamp}`,
        columns,
        rows: targetOrders.map((order) => {
          const customerLines = [
            order.customerName || "Customer",
            order.customerEmail || "",
            order.customerPhone || "",
          ].filter(Boolean).join("\n")

          const productsDisplay = (Array.isArray(order.lineItems) && order.lineItems.length > 0)
            ? order.lineItems.map((li: any) => `${li.title || li.name || 'Product'} x${li.quantity || 1}`).join(', ')
            : (order.productsSummary || `${order.itemsCount || 1} ${order.itemsCount === 1 ? "item" : "items"}`)

          return {
            orderNumber: `#${toExportValue(order.orderNumber)}`,
            date: formatShopifyDate(order.createdAt),
            customer: customerLines || t("fallback.noEmail"),
            items: productsDisplay,
            channel: toExportValue(order.channel, "Online Store"),
            total: `${toExportValue(order.currency ? order.currency : "$")} ${toExportValue(order.totalPrice)}`.trim(),
            paymentStatus: formatStatus(order.paymentStatus || order.financialStatus),
            fulfillmentStatus: formatStatus(order.fulfillmentStatus || "unfulfilled"),
            deliveryMethod: toExportValue(order.deliveryMethod, "Standard"),
            tags: isCancelledOrder(order) ? "Cancelled" : (isConfirmedOrder(order) ? `Confirmed (${order.tags || 'Tagged'})` : "Pending (No Tag)"),
          }
        }),
      }
    }

    if (tab === "products") {
      const columns: ExportColumn[] = [
        { key: "product", header: t("table.product"), width: "42%" },
        { key: "price", header: t("table.price"), width: "14%" },
        { key: "sku", header: t("table.sku"), width: "24%" },
        { key: "status", header: t("table.status"), width: "10%" },
        { key: "lastSynced", header: t("table.lastSynced"), width: "10%" },
      ]

      return {
        title: `Shopify ${t("tabs.products")}`,
        sheetName: t("tabs.products"),
        fileName: `shopify-products-${dateStamp}`,
        columns,
        rows: products.map((product) => ({
          product: toExportValue(product.name, t("fallback.notAvailable")),
          price: `${toExportValue(product.currency)} ${toExportValue(product.price)}`.trim(),
          sku: toExportValue(product.sku, t("fallback.notAvailable")),
          status: toExportValue(product.status, t("fallback.notAvailable")),
          lastSynced: formatDate(product.updatedAt),
        })),
      }
    }

    if (tab === "customers") {
      const columns: ExportColumn[] = [
        { key: "customer", header: t("table.customer"), width: "22%" },
        { key: "phone", header: t("table.phone"), width: "16%" },
        { key: "orders", header: t("table.orders"), width: "10%" },
        { key: "totalSpent", header: "Total Spent", width: "12%" },
        { key: "lastOrder", header: t("table.lastOrder"), width: "18%" },
        { key: "products", header: "Ordered Products", width: "22%" },
      ]

      return {
        title: `Shopify ${t("tabs.customers")}`,
        sheetName: t("tabs.customers"),
        fileName: `shopify-customers-${dateStamp}`,
        columns,
        rows: customers.map((customer) => {
          const details = getCustomerDetails(customer)
          const lastOrderDisplay = details.lastOrder 
            ? `#${details.lastOrder.orderNumber} (${formatShopifyDate(details.lastOrder.createdAt)})`
            : (customer.lastOrderName || t("fallback.notAvailable"))
          
          return {
            customer: toExportValue(customer.name ? `${customer.name} (${customer.email || 'No email'})` : customer.email, t("fallback.noEmail")),
            phone: toExportValue(customer.phone, t("fallback.noPhone")),
            orders: details.orderCount,
            totalSpent: Number(customer.totalSpent) > 0 ? `${customer.currency || '$'} ${customer.totalSpent}`.trim() : "$0.00",
            lastOrder: lastOrderDisplay,
            products: details.productsSummary || t("fallback.notAvailable"),
          }
        }),
      }
    }

    return null
  }

  async function handleDownloadPdf() {
    if (activeTab === "dashboard") {
      setIsExportingPdf(true)
      const toastId = toast.loading(t("toasts.generatingPdf"))
      try {
        const generatedAt = new Intl.DateTimeFormat(intlLocale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date())

        const blob = await pdf(
          <ShopifyDashboardReportPDF
            storeUrl={storeUrl || "Shopify Store"}
            filterLabel={filterLabel}
            generatedAt={generatedAt}
            cards={dashboardCards.map(c => ({
              label: c.label,
              value: c.value,
              caption: c.caption,
            }))}
            statusCounts={statusCounts}
            totalOrdersCount={totalOrdersCount}
          />
        ).toBlob()

        downloadBlob(blob, `shopify-dashboard-report-${dashboardDateRange}-${new Date().toISOString().slice(0, 10)}.pdf`)
        toast.success(t("toasts.pdfDownloaded"), { id: toastId })
      } catch (error) {
        console.error("Shopify Dashboard PDF export failed:", error)
        toast.error(t("toasts.exportFailed"), { id: toastId })
      } finally {
        setIsExportingPdf(false)
      }
      return
    }

    const exportConfig = buildExportConfig()

    if (!exportConfig || exportConfig.rows.length === 0) {
      toast.error(t("toasts.noRecordsToExport"))
      return
    }

    setIsExportingPdf(true)
    const toastId = toast.loading(t("toasts.generatingPdf"))
    try {
      const generatedAt = new Intl.DateTimeFormat(intlLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date())
      const blob = await pdf(
        <ShopifyExportPDF
          title={exportConfig.title}
          columns={exportConfig.columns}
          rows={exportConfig.rows}
          generatedAt={generatedAt}
        />
      ).toBlob()

      downloadBlob(blob, `${exportConfig.fileName}.pdf`)
      toast.success(t("toasts.pdfDownloaded"), { id: toastId })
    } catch (error) {
      console.error("Shopify PDF export failed:", error)
      toast.error(t("toasts.exportFailed"), { id: toastId })
    } finally {
      setIsExportingPdf(false)
    }
  }

  function handleDownloadExcel() {
    if (activeTab === "dashboard") {
      setIsExportingExcel(true)
      const toastId = toast.loading(t("toasts.generatingExcel"))
      try {
        const dateStamp = new Date().toISOString().slice(0, 10)
        const workbook = XLSX.utils.book_new()

        const summaryRows = [
          { Metric: "Store URL", Value: storeUrl || "N/A" },
          { Metric: "Date Period", Value: filterLabel },
          { Metric: "Report Generated", Value: new Date().toLocaleString() },
          { Metric: "", Value: "" },
          { Metric: "--- KEY PERFORMANCE INDICATORS ---", Value: "" },
          ...dashboardCards.map((c) => ({
            Metric: c.label,
            Value: c.value,
          })),
          { Metric: "", Value: "" },
          { Metric: "--- STATUS DISTRIBUTION ---", Value: "" },
          { Metric: "Confirmed Orders", Value: `${statusCounts.confirmed || 0} (${totalOrdersCount > 0 ? ((statusCounts.confirmed / totalOrdersCount) * 100).toFixed(1) : 0}%)` },
          { Metric: "Pending Orders", Value: `${statusCounts.pending || 0} (${totalOrdersCount > 0 ? ((statusCounts.pending / totalOrdersCount) * 100).toFixed(1) : 0}%)` },
          { Metric: "Cancelled Orders", Value: `${statusCounts.cancelled || 0} (${totalOrdersCount > 0 ? ((statusCounts.cancelled / totalOrdersCount) * 100).toFixed(1) : 0}%)` },
          { Metric: "Total Orders in Period", Value: String(totalOrdersCount) },
        ]

        const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
        summarySheet["!cols"] = [{ wch: 35 }, { wch: 30 }]
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Dashboard Summary")

        XLSX.writeFile(workbook, `shopify-dashboard-summary-${dashboardDateRange}-${dateStamp}.xlsx`)
        toast.success(t("toasts.excelDownloaded"), { id: toastId })
      } catch (error) {
        console.error("Shopify Excel export failed:", error)
        toast.error(t("toasts.exportFailed"), { id: toastId })
      } finally {
        setIsExportingExcel(false)
      }
      return
    }

    const exportConfig = buildExportConfig()

    if (!exportConfig || exportConfig.rows.length === 0) {
      toast.error(t("toasts.noRecordsToExport"))
      return
    }

    setIsExportingExcel(true)
    const toastId = toast.loading(t("toasts.generatingExcel"))
    try {
      const worksheetRows = exportConfig.rows.map((row) =>
        Object.fromEntries(exportConfig.columns.map((column) => [column.header, row[column.key] ?? ""]))
      )
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows, {
        header: exportConfig.columns.map((column) => column.header),
      })
      worksheet["!cols"] = exportConfig.columns.map((column) => ({ wch: Math.max(12, column.header.length + 4) }))

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, exportConfig.sheetName.slice(0, 31))
      XLSX.writeFile(workbook, `${exportConfig.fileName}.xlsx`)
      toast.success(t("toasts.excelDownloaded"), { id: toastId })
    } catch (error) {
      console.error("Shopify Excel export failed:", error)
      toast.error(t("toasts.exportFailed"), { id: toastId })
    } finally {
      setIsExportingExcel(false)
    }
  }

  const hasOrderFilters = Boolean(
    orderQuickTab !== "all" ||
    orderSearchQuery.trim() !== "" ||
    orderDateRange !== "all" ||
    orderPaymentStatusFilter !== "all" ||
    orderFulfillmentStatusFilter !== "all" ||
    orderStatusFilter !== "all" ||
    orderFromDate || orderToDate || orderFromTime || orderToTime
  )
  const filteredOrders = orders.filter(orderMatchesFilters)
  const orderStatusOptions = Array.from(new Set(orders.map(getOrderStatus))).sort((firstStatus, secondStatus) =>
    formatStatus(firstStatus).localeCompare(formatStatus(secondStatus))
  )

  const dashboardMatchesDateRange = (createdAt: Date | null) => {
    if (dashboardDateRange === "all") return true
    if (!createdAt) return false

    const now = new Date()
    const todayStart = getStartOfLocalDay(now)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    if (dashboardDateRange === "today") {
      return createdAt >= todayStart && createdAt <= todayEnd
    }

    if (dashboardDateRange === "yesterday") {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
      const yesterdayEnd = new Date(todayStart.getTime() - 1)
      return createdAt >= yesterdayStart && createdAt <= yesterdayEnd
    }

    if (dashboardDateRange === "last-7-days") {
      const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
      return createdAt >= sevenDaysAgo && createdAt <= todayEnd
    }

    if (dashboardDateRange === "last-30-days") {
      const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000)
      return createdAt >= thirtyDaysAgo && createdAt <= todayEnd
    }

    if (dashboardDateRange === "custom") {
      if (dashboardFromDate) {
        const fromDateStart = new Date(dashboardFromDate + "T00:00:00")
        if (createdAt < fromDateStart) return false
      }
      if (dashboardToDate) {
        const toDateEnd = new Date(dashboardToDate + "T23:59:59.999")
        if (createdAt > toDateEnd) return false
      }
    }

    return true
  }

  // Orders matching date filter
  const dashboardDateOrders = orders.filter((order) => {
    const createdAt = getRowDate(order.createdAt)
    return dashboardMatchesDateRange(createdAt)
  })

  // Orders matching both date filter and status filter (used for downloads and filtered views)
  const dashboardOrders = dashboardDateOrders.filter((order) => {
    if (dashboardStatusFilter === "confirmed") {
      return isConfirmedOrder(order) && !isCancelledOrder(order)
    }
    if (dashboardStatusFilter === "pending") {
      return isPendingOrder(order) && !isCancelledOrder(order)
    }
    if (dashboardStatusFilter === "cancelled") {
      return isCancelledOrder(order)
    }
    return true
  })

  const cancelledOrders = dashboardDateOrders.filter(isCancelledOrder)
  const confirmedOrders = dashboardDateOrders.filter(isConfirmedOrder)
  const pendingOrders = dashboardDateOrders.filter(isPendingOrder)

  const totalSales = dashboardDateOrders
    .filter((order) => !isCancelledOrder(order))
    .reduce((sum, order) => sum + toNumber(order.totalPrice), 0)

  const confirmedOrderValue = confirmedOrders.reduce(
    (sum, order) => sum + toNumber(order.totalPrice),
    0
  )

  const totalOrdersCount = dashboardDateOrders.length
  const currencyCode = dashboardDateOrders[0]?.currency || orders[0]?.currency || ""

  const statusCounts: Record<string, number> = {
    confirmed: confirmedOrders.length,
    pending: pendingOrders.length,
    cancelled: cancelledOrders.length,
  }

  const getDashboardFilterLabel = () => {
    if (dashboardDateRange === "today") return "Today"
    if (dashboardDateRange === "yesterday") return "Yesterday"
    if (dashboardDateRange === "last-7-days") return "Last 7 Days"
    if (dashboardDateRange === "last-30-days") return "Last 30 Days"
    if (dashboardDateRange === "custom") {
      if (dashboardFromDate && dashboardToDate) return `${dashboardFromDate} to ${dashboardToDate}`
      if (dashboardFromDate) return `From ${dashboardFromDate}`
      if (dashboardToDate) return `Until ${dashboardToDate}`
      return "Custom Date"
    }
    return "All Time"
  }

  const filterLabel = getDashboardFilterLabel()

  const topProducts = [...products].sort((a, b) => toNumber(b.price) - toNumber(a.price)).slice(0, 5)
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5)

  const dashboardCards = [
    {
      label: "Total Sales",
      value: formatCurrency(totalSales, currencyCode),
      caption: dashboardDateRange === "all" ? "Gross valid sales" : `Valid sales (${filterLabel})`,
      Icon: Coins,
      statusKey: null,
      accent: "emerald",
      className: "from-emerald-500/10 via-emerald-500/5 border-emerald-100 text-emerald-700 dark:from-emerald-500/20 dark:via-emerald-950/10 dark:border-emerald-900/50 dark:text-emerald-400",
    },
    {
      label: "Total Orders",
      value: String(totalOrdersCount),
      caption: dashboardDateRange === "all" ? "All synced orders" : `Orders (${filterLabel})`,
      Icon: ShoppingCart,
      statusKey: "all",
      accent: "blue",
      className: "from-blue-500/10 via-blue-500/5 border-blue-100 text-blue-700 dark:from-blue-500/20 dark:via-blue-950/10 dark:border-blue-900/50 dark:text-blue-400",
    },
    {
      label: "Pending Orders",
      value: String(pendingOrders.length),
      caption: "Untagged / awaiting conf...",
      Icon: Clock,
      statusKey: "pending",
      accent: "amber",
      className: "from-amber-500/10 via-amber-500/5 border-amber-100 text-amber-700 dark:from-amber-500/20 dark:via-amber-950/10 dark:border-amber-900/50 dark:text-amber-400",
    },
    {
      label: "Confirmed Orders",
      value: String(confirmedOrders.length),
      caption: "Tagged & confirmed orders",
      Icon: CheckCircle2,
      statusKey: "confirmed",
      accent: "teal",
      className: "from-teal-500/10 via-teal-500/5 border-teal-100 text-teal-700 dark:from-teal-500/20 dark:via-teal-950/10 dark:border-teal-900/50 dark:text-teal-400",
    },
    {
      label: "Confirmed Order Value",
      value: formatCurrency(confirmedOrderValue, currencyCode),
      caption: "Total value of confirmed o...",
      Icon: TrendingUp,
      statusKey: "confirmed",
      accent: "indigo",
      className: "from-indigo-500/10 via-indigo-500/5 border-indigo-100 text-indigo-700 dark:from-indigo-500/20 dark:via-indigo-950/10 dark:border-indigo-900/50 dark:text-indigo-400",
    },
    {
      label: "Cancelled",
      value: String(cancelledOrders.length),
      caption: "Cancelled / refunded ord...",
      Icon: XCircle,
      statusKey: "cancelled",
      accent: "red",
      className: "from-red-500/10 via-red-500/5 border-red-100 text-red-700 dark:from-red-500/20 dark:via-red-950/10 dark:border-red-900/50 dark:text-red-400",
    },
  ]

  const activeExportConfig = buildExportConfig()
  const canExportActiveTable = activeTab === "dashboard" ? orders.length > 0 : Boolean(activeExportConfig?.rows.length)

  return (
    <DashboardLayoutClient mainClassName="p-0 bg-white dark:bg-slate-950 antialiased h-[calc(100vh-64px)] overflow-hidden transition-colors duration-300">
      <div dir={isRtl ? "rtl" : "ltr"} className="h-full overflow-y-auto p-8 text-start">
        <div className="max-w-[1200px] mx-auto space-y-8 ">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <ShopifyIcon className="w-8 h-8" />
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {t("title")}
                </h2>
                {storeUrl ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 tracking-widest text-[10px] px-2 py-0.5 ms-2 rounded-md">
                    {t("status.connected")}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-0 tracking-widest text-[10px] px-2 py-0.5 ms-2 rounded-md">
                    {t("status.pendingLink")}
                  </Badge>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {storeUrl ? t("subtitleConnected", { store: storeUrl }) : t("subtitle")}
              </p>
            </div>

            {storeUrl && (
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing || isLoading || isDisconnecting}
                  className="h-9 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 me-1.5", isSyncing && "animate-spin")} />
                  {isSyncing ? "Syncing..." : "Sync Products"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectDialogOpen(true)}
                  disabled={isDisconnecting || isLoading}
                  className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 text-xs font-bold transition-colors shadow-none"
                >
                  {isDisconnecting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5 me-1.5" />
                  )}
                  {isDisconnecting ? tSafe("buttons.disconnecting", "Disconnecting...") : tSafe("buttons.disconnectStore", "Disconnect Store")}
                </Button>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center gap-3.5 p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  Generating Token & Syncing Store Data...
                </p>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Connecting to Shopify, retrieving orders, products, and automations. Please wait a moment.
                </p>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ShopifyTab)} className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 gap-1 flex-wrap h-auto">
                {storeUrl && (
                  <TabsTrigger value="dashboard" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                    Dashboard
                  </TabsTrigger>
                )}
                <TabsTrigger value="setup" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">{storeUrl ? t("tabs.connectionStatus") : t("tabs.connectionSetup")}</TabsTrigger>

                <TabsTrigger value="orders" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                  {t("tabs.orders")}{" "}
                  {isLoading ? (
                    <RefreshCw className="ms-2 h-3 w-3 animate-spin inline-block text-emerald-500" />
                  ) : orders.length > 0 ? (
                    <Badge className="ms-2 h-4 px-1">
                      {hasOrderFilters ? `${filteredOrders.length}/${orders.length}` : orders.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="pending_reminders" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400">
                  <Clock className="w-3.5 h-3.5 me-1.5 text-amber-500" />
                  Pending Reminders
                  {allPendingOrders.length > 0 && (
                    <Badge className="ms-2 h-4 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-0">
                      {allPendingOrders.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="products" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                  {t("tabs.products")}{" "}
                  {isLoading ? (
                    <RefreshCw className="ms-2 h-3 w-3 animate-spin inline-block text-emerald-500" />
                  ) : products.length > 0 ? (
                    <Badge className="ms-2 h-4 px-1">{products.length}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="customers" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                  {t("tabs.customers")}{" "}
                  {isLoading ? (
                    <RefreshCw className="ms-2 h-3 w-3 animate-spin inline-block text-emerald-500" />
                  ) : customers.length > 0 ? (
                    <Badge className="ms-2 h-4 px-1">{customers.length}</Badge>
                  ) : null}
                </TabsTrigger>
                {/* <TabsTrigger value="automation" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-[#00B074]">
                  <Zap className="w-3.5 h-3.5 me-1.5" /> Automation
                  <Badge className="ms-2 h-4 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-0">
                    {Object.values(fullAutomation).filter((m: any) => m?.active).length}
                  </Badge>
                </TabsTrigger> */}
              </TabsList>

              {isExportableTab(activeTab) && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={!canExportActiveTable || isExportingPdf || isExportingExcel || isLoading}
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
                    disabled={!canExportActiveTable || isExportingPdf || isExportingExcel || isLoading}
                    className="h-10 rounded-xl border-slate-200 px-4 text-xs font-bold tracking-wide text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isExportingExcel ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="me-2 h-4 w-4" />}
                    {t("buttons.downloadExcel")}
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="dashboard" className="space-y-6 outline-none">
              {/* Dashboard Date & Status Filter Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 p-4 bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 me-1 shrink-0">
                    <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Filter:</span>
                  </div>

                  {/* Date Range Pills */}
                  <div className="inline-flex items-center p-1 bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800 rounded-xl gap-1 shadow-xs flex-wrap">
                    {[
                      { id: "all", label: "All Time" },
                      { id: "today", label: "Today" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "last-7-days", label: "Last 7 Days" },
                      { id: "last-30-days", label: "Last 30 Days" },
                      { id: "custom", label: "Custom Date" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setDashboardDateRange(item.id as any)
                          if (item.id !== "custom") {
                            setDashboardFromDate("")
                            setDashboardToDate("")
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          dashboardDateRange === item.id
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter Select */}
                  <div className="w-[145px] shrink-0">
                    <Select value={dashboardStatusFilter} onValueChange={(v: any) => setDashboardStatusFilter(v)}>
                      <SelectTrigger className="h-8 px-2.5 rounded-xl border-slate-200/90 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200 shadow-xs">
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

                  {/* Custom Date Picker Inputs */}
                  {dashboardDateRange === "custom" && (
                    <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                        <span className="text-[11px] font-semibold text-slate-500">From:</span>
                        <input
                          type="date"
                          value={dashboardFromDate}
                          onChange={(e) => setDashboardFromDate(e.target.value)}
                          className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                        <span className="text-[11px] font-semibold text-slate-500">To:</span>
                        <input
                          type="date"
                          value={dashboardToDate}
                          onChange={(e) => setDashboardToDate(e.target.value)}
                          className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                        />
                      </div>
                      {(dashboardFromDate || dashboardToDate) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDashboardFromDate("")
                            setDashboardToDate("")
                          }}
                          className="h-8 px-2 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5 me-1" /> Clear
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Counter & Direct PDF / Excel Download Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Badge
                    variant="outline"
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 mx-1">{dashboardOrders.length}</span> {dashboardOrders.length === 1 ? "order" : "orders"}
                  </Badge>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={dashboardOrders.length === 0 || isExportingPdf || isLoading}
                    className="h-8 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isExportingPdf ? <RefreshCw className="w-3.5 h-3.5 me-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 me-1 text-red-500" />}
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadExcel}
                    disabled={dashboardOrders.length === 0 || isExportingExcel || isLoading}
                    className="h-8 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isExportingExcel ? <RefreshCw className="w-3.5 h-3.5 me-1 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 me-1 text-emerald-600" />}
                    Excel
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {dashboardCards.map((card) => {
                  const Icon = card.Icon
                  const isCardActive = Boolean(card.statusKey && dashboardStatusFilter === card.statusKey)

                  return (
                    <div
                      key={card.label}
                      onClick={() => {
                        if (card.statusKey) {
                          if (card.statusKey === "all") {
                            setDashboardStatusFilter("all")
                          } else {
                            setDashboardStatusFilter(dashboardStatusFilter === card.statusKey ? "all" : (card.statusKey as any))
                          }
                        }
                      }}
                      className={cn(
                        "relative overflow-hidden bg-gradient-to-br to-transparent rounded-2xl border p-5 shadow-sm transition-all duration-300",
                        card.statusKey ? "cursor-pointer hover:shadow-md hover:scale-[1.01]" : "",
                        isCardActive ? "ring-2 ring-emerald-500 border-emerald-500/80 shadow-md" : "",
                        card.className
                      )}
                    >
                      <Icon className="absolute -right-2 -top-2 h-20 w-20 opacity-10 pointer-events-none" />
                      <div className="relative space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{card.label}</span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 dark:bg-slate-950/40 shrink-0">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="break-words text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            {isLoading ? (
                              <span className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                                <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                                <span>...</span>
                              </span>
                            ) : (
                              card.value
                            )}
                          </h3>
                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {card.label === "Total Sales" && <TrendingUp className="h-3 w-3 text-emerald-600 shrink-0" />}
                            <span className="truncate">{card.caption}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Order Payment Distribution
                  </h3>
                  <Badge variant="secondary" className="text-[10px] tracking-wider font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                    {filterLabel} ({totalOrdersCount} {totalOrdersCount === 1 ? 'order' : 'orders'})
                  </Badge>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-sm font-semibold">Syncing store data & loading payment distribution...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-12">No orders synced yet.</p>
                ) : totalOrdersCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 text-center">
                    <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No orders found for {filterLabel}.</p>
                    <p className="text-xs text-slate-400">Try selecting a different date range or "All Time".</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDashboardDateRange("all")
                        setDashboardFromDate("")
                        setDashboardToDate("")
                      }}
                      className="mt-2 text-xs font-bold"
                    >
                      Reset to All Time
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    {/* Left Column: Progress Bars */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">Details</h4>
                      {Object.entries(statusCounts).map(([status, count]) => {
                        const pct = totalOrdersCount > 0 ? (count / totalOrdersCount) * 100 : 0
                        const theme = getStatusTheme(status)

                        return (
                          <div key={status} className="space-y-2 text-left">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className={cn("capitalize", theme.text)}>{formatStatus(status)}</span>
                              <div className="flex items-center gap-2">
                                <Badge className={cn("border-0 text-[10px] px-1.5 py-0", theme.badge)}>
                                  {formatOrderCount(Number(count))}
                                </Badge>
                                <span className="text-slate-400 font-normal">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className={cn("h-full transition-all duration-500", theme.bar)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Middle Column: Pie Chart representation */}
                    <div className="flex flex-col items-center justify-center h-[260px] relative">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start lg:self-center">Distribution Share</h4>
                      <div className="h-[220px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(statusCounts).map(([status, count]) => ({
                                name: formatStatus(status),
                                value: Number(count),
                                color: getOrderStatusColor(status),
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {Object.entries(statusCounts).map(([status, count], index) => (
                                <Cell key={`cell-${index}`} fill={getOrderStatusColor(status)} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} orders`, 'Volume']} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                          <span className="text-2xl font-black text-slate-800 dark:text-white">{totalOrdersCount}</span>
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                            {dashboardDateRange === "all" ? "Total Synced" : "Filtered"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Bar Chart representation */}
                    <div className="flex flex-col items-center justify-center h-[260px]">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start lg:self-center">Order Volume Bar Graph</h4>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.entries(statusCounts).map(([status, count]) => ({
                              name: formatStatus(status),
                              count: Number(count),
                              fill: getOrderStatusColor(status),
                            }))}
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
                              {Object.entries(statusCounts).map(([status, count], index) => (
                                <Cell key={`cell-${index}`} fill={getOrderStatusColor(status)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="setup" className="space-y-8 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  {!storeUrl && (
                    <>
                      {/* Integration Key Card */}
                      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 rounded-xl bg-[#95BF47]/10 dark:bg-[#95BF47]/20 flex items-center justify-center shrink-0">
                            <LinkIcon className="w-6 h-6 text-[#95BF47]" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("setup.keyTitle")}</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              {t("setup.keyDescription")}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-300">{t("setup.yourKey")}</label>
                            <div className="flex flex-col sm:flex-row items-center gap-3">
                              {token ? (
                                <div className="relative flex-1 w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                                  <Input 
                                    value={token} 
                                    readOnly 
                                    className={cn("bg-transparent border-none h-12 font-mono text-slate-600 dark:text-slate-400 focus-visible:ring-0", isRtl ? "pl-12" : "pr-12")}
                                  />
                                  <button 
                                    onClick={() => copyToClipboard(token)}
                                    className={cn("absolute top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#00B074] dark:hover:text-emerald-400 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors", isRtl ? "left-2" : "right-2")}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <Button 
                                  onClick={handleGenerateKey} 
                                  disabled={isGenerating}
                                  className="w-full sm:w-auto bg-[#00B074] hover:bg-[#009662] text-white font-bold h-12 px-8 rounded-xl text-xs tracking-widest shadow-lg shadow-[#00B074]/20 transition-all"
                                >
                                  {isGenerating ? t("buttons.generating") : t("buttons.generateKey")}
                                </Button>
                              )}
                            </div>
                          </div>

                          {token && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex gap-3">
                              <Info className="w-4 h-4 shrink-0" />
                              <p>{t("setup.keyWarning")}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Next Steps Card */}
                      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center shrink-0">
                            <ShopifyIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("setup.completeLinkTitle")}</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              {t("setup.completeLinkDescription")}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", storeUrl ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                              {storeUrl ? <CheckCircle2 className="w-4 h-4" /> : "1"}
                            </div>
                            <span>{t("setup.installStep")}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", storeUrl ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                              {storeUrl ? <CheckCircle2 className="w-4 h-4" /> : "2"}
                            </div>
                            <span>{t("setup.pasteKeyStep")}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {storeUrl && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-8 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t("linked.title")}</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium">
                          {t("linked.beforeStore")} <span className="font-bold text-emerald-600">{storeUrl}</span> {t("linked.afterStore")}
                        </p>
                      </div>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setDisconnectDialogOpen(true)}
                          disabled={isDisconnecting || isLoading}
                          className="h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 font-bold text-xs shadow-none"
                        >
                          {isDisconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Unlink className="w-3.5 h-3.5 me-1.5" />}
                          {isDisconnecting ? tSafe("buttons.disconnecting", "Disconnecting...") : tSafe("buttons.disconnectStore", "Disconnect Store")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-widest mb-4">{t("connection.title")}</h3>
                    {storeUrl ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{t("connection.linkedStore")}</span>
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{storeUrl}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{t("connection.status")}</span>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">{t("status.active")}</Badge>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                          {shopifyAccessToken && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 tracking-widest mb-2 block">{t("connection.accessToken")}</span>
                              <div className="flex items-center gap-2">
                                <code className="text-[10px] bg-slate-50 dark:bg-slate-950 p-1.5 rounded flex-1 truncate font-mono text-slate-500 italic">
                                  {shopifyAccessToken}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(shopifyAccessToken)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => setDisconnectDialogOpen(true)}
                            disabled={isDisconnecting || isLoading}
                            className="w-full h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 font-bold text-xs shadow-none"
                          >
                            {isDisconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Unlink className="w-3.5 h-3.5 me-1.5" />}
                            {isDisconnecting ? tSafe("buttons.disconnecting", "Disconnecting...") : tSafe("buttons.disconnectStore", "Disconnect Store")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-spin-slow" />
                        <p className="text-xs text-slate-400 font-medium italic">{t("connection.waiting")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="outline-none space-y-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Unified Shopify Polaris Toolbar: View Select + Search + Filter Pills + Exports */}
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
                          <SelectItem value="unfulfilled">Unfulfilled ({orders.filter((o) => !isCancelledOrder(o) && normalizeStatus(o.fulfillmentStatus || "") !== "fulfilled").length})</SelectItem>
                          <SelectItem value="unpaid">Unpaid ({orders.filter((o) => !isCancelledOrder(o) && normalizeStatus(o.paymentStatus || o.financialStatus || "") !== "paid").length})</SelectItem>
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
                        setOrderDateRange(val)
                        if (val === "custom") setShowAdvancedFilters(true)
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

                    {/* Payment Status Filter */}
                    <div className="w-[115px] shrink-0">
                      <Select value={orderPaymentStatusFilter} onValueChange={setOrderPaymentStatusFilter}>
                        <SelectTrigger className="h-8 px-2 rounded-lg border-slate-200/90 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <SelectValue placeholder="Payment: All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Payment: All</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="authorized">Authorized</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                          <SelectItem value="voided">Voided</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Fulfillment Status Filter */}
                    <div className="w-[125px] shrink-0">
                      <Select value={orderFulfillmentStatusFilter} onValueChange={setOrderFulfillmentStatusFilter}>
                        <SelectTrigger className="h-8 px-2 rounded-lg border-slate-200/90 bg-white text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <SelectValue placeholder="Fulfillment: All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Fulfillment: All</SelectItem>
                          <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                          <SelectItem value="fulfilled">Fulfilled</SelectItem>
                          <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="not_required">Not Required</SelectItem>
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
                      disabled={filteredOrders.length === 0 || isExportingPdf || isLoading}
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
                      disabled={filteredOrders.length === 0 || isExportingExcel || isLoading}
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
                          setOrderFromDate(e.target.value)
                          setOrderDateRange("custom")
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
                          setOrderToDate(e.target.value)
                          setOrderDateRange("custom")
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
                          setOrderFromTime(e.target.value)
                          setOrderDateRange("custom")
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
                          setOrderToTime(e.target.value)
                          setOrderDateRange("custom")
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
                          <Package className="w-3.5 h-3.5" />
                        )}
                        <span>Mark as Fulfilled in Shopify</span>
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

                {/* Main Shopify Polaris Table */}
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
                                setSelectedOrderIds(filteredOrders.map((o) => o.id))
                              } else {
                                setSelectedOrderIds([])
                              }
                            }}
                            className="w-4 h-4 rounded-[4px] border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                          />
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[90px]">Order</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[140px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            Date <ArrowDown className="w-3 h-3 inline-block" />
                          </span>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[140px]">Customer</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[100px] whitespace-nowrap">Fulfill by</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[110px] whitespace-nowrap">Channel</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[90px]">Total</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[120px] whitespace-nowrap">Payment status</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[130px] whitespace-nowrap">Fulfillment status</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[80px]">Items</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[120px] whitespace-nowrap">Delivery status</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[110px] whitespace-nowrap">Delivery method</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3.5 py-3 min-w-[130px] whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={13} className="h-48 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                              <span className="text-sm font-medium">Syncing & loading Shopify orders...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="h-48 text-center text-slate-500">
                            {orders.length === 0 ? t("empty.orders") : "No orders match the selected filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order) => {
                          const isCancelled = isCancelledOrder(order)
                          const isConfirmed = isConfirmedOrder(order)
                          const isSelected = selectedOrderIds.includes(order.id)
                          const pStatus = normalizeStatus(order.paymentStatus || order.financialStatus || "")
                          const fStatus = normalizeStatus(order.fulfillmentStatus || "")
                          const isUnfulfilled = fStatus !== "fulfilled" && fStatus !== "not_required"
                          const fulfillByText = getFulfillByText(order.createdAt, isUnfulfilled && !isCancelled)

                          return (
                            <TableRow
                              key={order.id}
                              className={cn(
                                "border-b border-slate-100 dark:border-slate-800/70 transition-colors text-[13px]",
                                isSelected
                                  ? "bg-slate-50 dark:bg-slate-800/40"
                                  : "hover:bg-[#f8f9fa] dark:hover:bg-slate-800/30"
                              )}
                            >
                              {/* Checkbox */}
                              <TableCell className="w-10 px-3.5 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds((prev) => [...prev, order.id])
                                    } else {
                                      setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id))
                                    }
                                  }}
                                  className="w-4 h-4 rounded-[4px] border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                                />
                              </TableCell>

                              {/* Order */}
                              <TableCell className="px-3.5 py-3 font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrderForDetails(order)
                                      setIsOrderDetailsOpen(true)
                                    }}
                                    className={cn(
                                      "font-semibold text-left transition-colors",
                                      isCancelled
                                        ? "line-through text-slate-400 dark:text-slate-500 hover:text-slate-600"
                                        : "text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer"
                                    )}
                                    title="View full order details"
                                  >
                                    #{order.orderNumber}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrderForDetails(order)
                                      setIsOrderDetailsOpen(true)
                                    }}
                                    title="View full order details"
                                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-amber-500/80 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[9px] font-black shrink-0 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer"
                                  >
                                    !
                                  </button>
                                </div>
                              </TableCell>

                              {/* Date */}
                              <TableCell className={cn("px-3.5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300", isCancelled && "line-through text-slate-400 dark:text-slate-500")}>
                                {formatShopifyDate(order.createdAt)}
                              </TableCell>

                              {/* Customer */}
                              <TableCell className="px-3.5 py-3 min-w-[160px]">
                                <div className="flex flex-col">
                                  <span className={cn("font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap", isCancelled && "line-through text-slate-400 dark:text-slate-500")}>
                                    {order.customerName || "Customer"}
                                  </span>
                                  {order.customerEmail && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                                      {order.customerEmail}
                                    </span>
                                  )}
                                  {order.customerPhone && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                      {order.customerPhone}
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Fulfill by */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap">
                                {fulfillByText ? (
                                  <span className="font-medium text-[#9a6700] dark:text-amber-400 text-xs">
                                    {fulfillByText}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                )}
                              </TableCell>

                              {/* Channel */}
                              <TableCell className={cn("px-3.5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300", isCancelled && "line-through text-slate-400 dark:text-slate-500")}>
                                {order.channel || "Online Store"}
                              </TableCell>

                              {/* Total */}
                              <TableCell className={cn("px-3.5 py-3 font-semibold whitespace-nowrap text-slate-800 dark:text-slate-200", isCancelled && "line-through text-slate-400 dark:text-slate-500")}>
                                {order.currency ? `${order.currency} ` : "$"}{order.totalPrice}
                              </TableCell>

                              {/* Payment status */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap">
                                {pStatus === "paid" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e3e3e3] dark:bg-slate-700 text-[#303030] dark:text-slate-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#303030] dark:bg-slate-100 shrink-0"></span>
                                    Paid
                                  </span>
                                ) : ["refunded", "voided", "cancelled"].includes(pStatus) || isCancelled ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ffe0e0] dark:bg-red-950/50 text-[#990000] dark:text-red-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#990000] dark:text-red-300 shrink-0"></span>
                                    Refunded
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fff3c4] dark:bg-amber-950/50 text-[#744210] dark:text-amber-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#744210] dark:bg-amber-300 shrink-0"></span>
                                    Pending
                                  </span>
                                )}
                              </TableCell>

                              {/* Fulfillment status */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap">
                                {fStatus === "fulfilled" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e3e3e3] dark:bg-slate-700 text-[#303030] dark:text-slate-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#303030] dark:bg-slate-100 shrink-0"></span>
                                    Fulfilled
                                  </span>
                                ) : fStatus === "not_required" ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f1f1f1] dark:bg-slate-800 text-[#616161] dark:text-slate-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#616161] dark:bg-slate-300 shrink-0"></span>
                                    Not required
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fff8db] dark:bg-amber-950/40 border border-[#f5c342] dark:border-amber-600 text-[#6d4c00] dark:text-amber-300">
                                    <span className="w-2 h-2 rounded-full border border-[#6d4c00] dark:border-amber-300 bg-transparent shrink-0"></span>
                                    Unfulfilled
                                  </span>
                                )}
                              </TableCell>

                              {/* Items */}
                              <TableCell className={cn("px-3.5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300", isCancelled && "line-through text-slate-400 dark:text-slate-500")}>
                                {order.itemsCount || 1} {order.itemsCount === 1 ? "item" : "items"}
                              </TableCell>

                              {/* Delivery status */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap">
                                {order.deliveryStatus ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e3e3e3] dark:bg-slate-700 text-[#303030] dark:text-slate-100">
                                    <span className="text-[10px]">⊘</span> {order.deliveryStatus}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">—</span>
                                )}
                              </TableCell>

                              {/* Delivery method */}
                              <TableCell className="px-3.5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                {order.deliveryMethod || "Standard"}
                              </TableCell>

                              {/* Confirmation / Status Pill */}
                              <TableCell className="px-3.5 py-3">
                                {isCancelled ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ffe0e0] text-[#990000] dark:bg-red-950/40 dark:text-red-300 whitespace-nowrap">
                                    <XCircle className="w-3 h-3 text-[#990000] dark:text-red-300" /> Cancelled
                                  </span>
                                ) : isConfirmed ? (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#c4eed0] text-[#0d542b] dark:bg-emerald-950/40 dark:text-emerald-300 whitespace-nowrap">
                                      <CheckCircle2 className="w-3 h-3 text-[#0d542b] dark:text-emerald-300" /> Confirmed
                                    </span>
                                    {order.tags && (
                                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded max-w-[110px] truncate" title={order.tags}>
                                        {order.tags}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fff3c4] text-[#744210] dark:bg-amber-950/40 dark:text-amber-300 whitespace-nowrap">
                                    <Clock className="w-3 h-3 text-[#744210] dark:text-amber-300" /> Pending
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pending_reminders" className="outline-none space-y-6">
              {/* Header Overview Card */}
              <div className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 dark:border-amber-900/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Pending Orders WhatsApp Broadcast
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                    Target customers with pending (unconfirmed/unpaid) orders. Filter by specific date, day, or week, select an approved WhatsApp template, and send automated reminders in bulk.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl text-center shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pending Orders</span>
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400">{filteredPendingOrders.length}</span>
                  </div>
                  <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Selected</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{selectedPendingOrderIds.length}</span>
                  </div>
                </div>
              </div>

              {/* Broadcast Result Banner (if just sent) */}
              {pendingBroadcastResult && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        Broadcast Sent Successfully!
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Sent {pendingBroadcastResult.sentCount} reminders ({pendingBroadcastResult.failedCount} failed) out of {pendingBroadcastResult.total} target pending orders.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingBroadcastResult(null)}
                    className="text-xs text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  >
                    Dismiss
                  </Button>
                </div>
              )}

              {/* Two Column Layout: Configuration (Left 5 cols) & Order Target List (Right 7 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Date Range, Template Picker & Trigger Action */}
                <div className="lg:col-span-5 space-y-5">
                  
                  {/* Step 1: Target Date Range */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs font-black flex items-center justify-center">
                        1
                      </span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Select Date / Time Range
                      </h4>
                    </div>

                    {/* Date Presets */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "all", label: "All Time" },
                        { id: "today", label: "Today" },
                        { id: "yesterday", label: "Yesterday" },
                        { id: "this-week", label: "This Week" },
                        { id: "last-7-days", label: "Last 7 Days" },
                        { id: "last-30-days", label: "Last 30 Days" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPendingFilterDateRange(item.id as any)
                            setPendingFromDate("")
                            setPendingToDate("")
                          }}
                          className={cn(
                            "py-2 px-2.5 rounded-xl text-xs font-bold text-center border transition-all",
                            pendingFilterDateRange === item.id
                              ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Range Button & Inputs */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setPendingFilterDateRange("custom")}
                        className={cn(
                          "w-full py-2 px-3 rounded-xl text-xs font-bold text-center border transition-all",
                          pendingFilterDateRange === "custom"
                            ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                        )}
                      >
                        <Calendar className="w-3.5 h-3.5 inline-block me-1.5" />
                        Custom Date Range
                      </button>

                      {pendingFilterDateRange === "custom" && (
                        <div className="grid grid-cols-2 gap-2 mt-3 animate-in fade-in duration-200">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">From Date</label>
                            <Input
                              type="date"
                              value={pendingFromDate}
                              onChange={(e) => setPendingFromDate(e.target.value)}
                              className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">To Date</label>
                            <Input
                              type="date"
                              value={pendingToDate}
                              onChange={(e) => setPendingToDate(e.target.value)}
                              className="h-8 text-xs bg-white dark:bg-slate-950 rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Choose WhatsApp Template & Map Variables */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs font-black flex items-center justify-center">
                        2
                      </span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Choose WhatsApp Template
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Message Template
                      </label>
                      <Select value={pendingSelectedTemplate} onValueChange={handlePendingTemplateChange}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-semibold">
                          <SelectValue placeholder="-- Select WhatsApp Template --" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTemplates.length === 0 && (
                            <SelectItem value="__none__" disabled>
                              No templates available
                            </SelectItem>
                          )}
                          {availableTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.name}>
                              {tpl.name} ({tpl.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Variable Mappings if selected */}
                    {pendingSelectedTemplate && (() => {
                      const tplData = availableTemplates.find((t) => t.name === pendingSelectedTemplate)
                      const bodyComp = tplData?.components?.find((c: any) => c.type === "BODY")
                      const placeholders = bodyComp?.text ? detectPlaceholders(bodyComp.text) : []

                      if (placeholders.length === 0) return null

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
                                  {SHOPIFY_VARIABLES.map((v) => (
                                    <option key={v.value} value={v.value}>
                                      {v.label} ({v.value})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Live WhatsApp Bubble Preview */}
                    {pendingSelectedTemplate && (() => {
                      const tplData = availableTemplates.find((t) => t.name === pendingSelectedTemplate)
                      const bodyComp = tplData?.components?.find((c: any) => c.type === "BODY")
                      if (!bodyComp?.text) return null

                      const sampleOrder = filteredPendingOrders[0] || orders[0]
                      let previewText = bodyComp.text

                      Object.entries(pendingVariableMappings).forEach(([num, varPath]) => {
                        let sampleVal = `[${varPath}]`
                        if (sampleOrder) {
                          if (varPath === "customer.first_name") sampleVal = sampleOrder.customerName?.split(" ")[0] || "Haroon"
                          else if (varPath === "customer.last_name") sampleVal = sampleOrder.customerName?.split(" ")[1] || "Khan"
                          else if (varPath === "order_number") sampleVal = `#${sampleOrder.orderNumber}`
                          else if (varPath === "total_price") sampleVal = `${sampleOrder.currency || "$"}${sampleOrder.totalPrice}`
                          else if (varPath === "shop_url") sampleVal = storeUrl || "your-store.myshopify.com"
                        }
                        previewText = previewText.replace(new RegExp(`\\{\\{${num}\\}\\}`, "g"), sampleVal)
                      })

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
                      )
                    })()}
                  </div>

                  {/* Step 3: Broadcast Send CTA */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-3">
                    <Button
                      type="button"
                      onClick={handleSendPendingBroadcast}
                      disabled={isSendingPendingBroadcast || selectedPendingOrderIds.length === 0 || !pendingSelectedTemplate || isLoading}
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
                              setSelectedPendingOrderIds([])
                            } else {
                              setSelectedPendingOrderIds(filteredPendingOrders.map((o) => o.id))
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
                                    setSelectedPendingOrderIds(filteredPendingOrders.map((o) => o.id))
                                  } else {
                                    setSelectedPendingOrderIds([])
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
                              const isSelected = selectedPendingOrderIds.includes(order.id)
                              const hasPhone = Boolean(order.customerPhone && order.customerPhone.replace(/[^0-9]/g, "").length >= 7)

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
                                          setSelectedPendingOrderIds((prev) => [...prev, order.id])
                                        } else {
                                          setSelectedPendingOrderIds((prev) => prev.filter((id) => id !== order.id))
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
                                        setSelectedOrderForDetails(order)
                                        setIsOrderDetailsOpen(true)
                                      }}
                                      className="font-bold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline cursor-pointer"
                                      title="Click to view complete order details"
                                    >
                                      #{order.orderNumber}
                                    </button>
                                  </TableCell>

                                  {/* Date */}
                                  <TableCell className="px-3 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                                    {formatShopifyDate(order.createdAt)}
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
                              )
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
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                            <span className="text-sm font-medium">Syncing & loading Shopify products...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                          {t("empty.products")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {product.imageUrl && <img src={product.imageUrl} alt="" className="w-8 h-8 rounded border border-slate-200" />}
                              <span className="font-bold">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">{product.currency} {product.price.toString()}</TableCell>
                          <TableCell className="text-slate-500">{product.sku || t("fallback.notAvailable")}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">{product.status}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{formatDate(product.updatedAt)}</TableCell>
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
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[200px]">Customer</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[130px]">Phone</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[110px]">Orders & Spent</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[200px]">Last Order</TableHead>
                        <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 min-w-[240px]">Ordered Products</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                              <span className="text-sm font-medium">Syncing & loading Shopify customers...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                            {t("empty.customers")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer) => {
                          const details = getCustomerDetails(customer)
                          const lastOrder = details.lastOrder
                          const pStatus = lastOrder ? normalizeStatus(lastOrder.paymentStatus || lastOrder.financialStatus || "") : ""
                          const fStatus = lastOrder ? normalizeStatus(lastOrder.fulfillmentStatus || "") : ""

                          return (
                            <TableRow key={customer.id} className="border-b border-slate-100 dark:border-slate-800/70 hover:bg-[#f8f9fa] dark:hover:bg-slate-800/30 text-[13px] transition-colors">
                              {/* Customer Name & Email */}
                              <TableCell className="px-4 py-3.5">
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span>{customer.name || customer.email?.split("@")[0] || "Customer"}</span>
                                    {customer.location && (
                                      <span className="text-[10px] font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {customer.location}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                    {customer.email || t("fallback.noEmail")}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Phone */}
                              <TableCell className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {customer.phone ? (
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {customer.phone}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">No Phone</span>
                                )}
                              </TableCell>

                              {/* Orders & Spent */}
                              <TableCell className="px-4 py-3.5 whitespace-nowrap">
                                <div className="space-y-1">
                                  <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-0 font-bold text-xs px-2 py-0.5">
                                    {details.orderCount} {details.orderCount === 1 ? "order" : "orders"}
                                  </Badge>
                                  {Number(customer.totalSpent) > 0 && (
                                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      {customer.currency ? `${customer.currency} ` : "$"}{customer.totalSpent}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              {/* Last Order Detail */}
                              <TableCell className="px-4 py-3.5">
                                {lastOrder ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedOrderForDetails(lastOrder)
                                          setIsOrderDetailsOpen(true)
                                        }}
                                        className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 hover:underline cursor-pointer"
                                      >
                                        #{lastOrder.orderNumber}
                                      </button>
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {lastOrder.currency ? `${lastOrder.currency} ` : "$"}{lastOrder.totalPrice}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {formatShopifyDate(lastOrder.createdAt)}
                                    </div>
                                    <div className="flex items-center gap-1 pt-0.5">
                                      {pStatus === "paid" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e3e3e3] dark:bg-slate-700 text-[#303030] dark:text-slate-100">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#303030] dark:bg-slate-100 shrink-0"></span> Paid
                                        </span>
                                      )}
                                      {fStatus === "fulfilled" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e3e3e3] dark:bg-slate-700 text-[#303030] dark:text-slate-100">
                                          Fulfilled
                                        </span>
                                      ) : fStatus && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fff8db] border border-[#f5c342] text-[#6d4c00]">
                                          Unfulfilled
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : customer.lastOrderName ? (
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-900 dark:text-white">{customer.lastOrderName}</span>
                                    <div className="text-xs text-slate-400">Past Order</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">No orders yet</span>
                                )}
                              </TableCell>

                              {/* Which Products Ordered */}
                              <TableCell className="px-4 py-3.5">
                                {details.uniqueProducts.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-md">
                                    {details.uniqueProducts.slice(0, 3).map((prod, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
                                      >
                                        <Box className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span className="truncate max-w-[140px]" title={prod.title}>{prod.title}</span>
                                        {prod.quantity > 1 && (
                                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded">
                                            ×{prod.quantity}
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                    {details.uniqueProducts.length > 3 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500" title={details.productsSummary}>
                                        +{details.uniqueProducts.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-xs">No product history</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* ── Automation Tab ── */}
            {/* <TabsContent value="automation" className="outline-none space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#00B074]" /> WhatsApp Automation
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Configure automated WhatsApp messages for Shopify events</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadIntegrationData}
                  disabled={isLoading}
                  className="h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 me-2", isLoading && "animate-spin")} /> Reload Templates
                </Button>
              </div>

              {storeUrl ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</div>
                  <span>Store Connected: <span className="font-black">{storeUrl}</span> — automated flows are active.</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Connect your Shopify store first (see Connection Setup tab) to enable automations.</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{Object.values(fullAutomation).filter((m: any) => m?.active).length}</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500">Active<br/>Automations</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-2xl font-black text-slate-700 dark:text-slate-300">{AUTOMATION_MODULES.length}</span>
                  <span className="text-xs font-bold text-slate-500">Total<br/>Modules</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {AUTOMATION_MODULES.map(module => (
                  <AutomationModuleCard
                    key={module.id}
                    module={module}
                    config={fullAutomation[module.id]}
                    onToggle={handleToggleModule}
                    onSettings={id => setEditingModuleId(id)}
                    isTogglingId={isTogglingModuleId}
                  />
                ))}
              </div>

              <AutomationSettingsModal
                isOpen={!!editingModuleId}
                onClose={() => setEditingModuleId(null)}
                module={AUTOMATION_MODULES.find(m => m.id === editingModuleId) ?? null}
                automation={fullAutomation}
                templates={availableTemplates}
                onSave={handleSaveModule}
                isSaving={isSavingModule}
                dbFlows={dbFlows}
              />
            </TabsContent> */}
          </Tabs>
        </div>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md text-start">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              {tSafe("buttons.disconnectStore", "Disconnect Store")}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 text-sm mt-2">
              Are you sure you want to disconnect <span className="font-semibold text-slate-900 dark:text-white">{storeUrl}</span>? This will unlink your Shopify store and clear synced orders and products.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={isDisconnecting}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await handleDisconnectStore()
                setDisconnectDialogOpen(false)
              }}
              disabled={isDisconnecting}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {isDisconnecting ? <RefreshCw className="w-4 h-4 animate-spin me-2" /> : null}
              {isDisconnecting ? tSafe("buttons.disconnecting", "Disconnecting...") : tSafe("buttons.disconnectStore", "Disconnect Store")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Are you sure you want to mark {selectedOrderIds.length} selected {selectedOrderIds.length === 1 ? "order" : "orders"} as fulfilled on Shopify?
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
                  <span>Fulfilling...</span>
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

      {/* Shopify Order Complete Details Modal */}
      <ShopifyOrderDetailsDialog
        order={selectedOrderForDetails}
        isOpen={isOrderDetailsOpen}
        onClose={() => {
          setIsOrderDetailsOpen(false)
          setSelectedOrderForDetails(null)
        }}
        storeUrl={storeUrl}
        products={products}
        onFulfill={handleSingleFulfill}
        isFulfilling={isFulfillingSingleId === selectedOrderForDetails?.id}
      />
    </DashboardLayoutClient>
  )
}
