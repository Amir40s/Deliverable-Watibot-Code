"use client"

import React, { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { Switch } from "@/components/ui/switch"
import { MessageCircle, Plus, X, Upload, Sparkles, Bot, Workflow, ExternalLink, Globe, Check } from "lucide-react"
import Link from "next/link"

interface UrlRule {
  id: string;
  sourceUrl: string;
  prefillMsg: string;
  onScreenMsg: string;
  removeChars: boolean;
  capitalize: boolean;
}

interface WidgetConfig {
  phone: string;
  buttonBgColor: string;
  ctaText: string;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  borderRadius: number;
  prefillMsg: string;
  position: "Bottom-Right" | "Bottom-Left";
  brandName: string;
  brandSubtitle: string;
  brandColor: string;
  brandImageUrl: string;
  widgetCtaText: string;
  onScreenMsg: string;
  openOnMobile: "Yes" | "No";
  openByDefault: "Yes" | "No";
  reopenByDefault: "Always" | "After 24 hour";
  urlPersonalizationEnabled: boolean;
  urlRules: UrlRule[];
  automationType: "none" | "ai_agent" | "flow";
  agentId: string;
  flowId: string;
}

export default function WhatsAppWidgetBuilderPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showEmbedCode, setShowEmbedCode] = useState(false)
  const [widgetId, setWidgetId] = useState("")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string; model?: string; aiProvider?: string; isDefault?: boolean }>>([])
  const [availableFlows, setAvailableFlows] = useState<Array<{ id: string; name: string; isActive?: boolean }>>([])

  const [cfg, setCfg] = useState<WidgetConfig>({
    phone: "",
    buttonBgColor: "#4dc247",
    ctaText: "Chat with us",
    marginBottom: 30,
    marginLeft: 30,
    marginRight: 30,
    borderRadius: 24,
    prefillMsg: "Hi",
    position: "Bottom-Right",
    brandName: "AiSensy",
    brandSubtitle: "online",
    brandColor: "#0A5F54",
    brandImageUrl: "",
    widgetCtaText: "Start chat",
    onScreenMsg: "Hi,\nHow can I help you ?",
    openOnMobile: "Yes",
    openByDefault: "Yes",
    reopenByDefault: "Always",
    urlPersonalizationEnabled: false,
    urlRules: [],
    automationType: "none",
    agentId: "",
    flowId: ""
  })

  // Load existing config on mount
  useEffect(() => {
    fetch("/api/wa-widget")
      .then(r => r.json())
      .then(data => {
        if (data.config) {
          setCfg(prev => ({ 
            ...prev, 
            ...data.config,
            automationType: data.config.automationType || "none",
            agentId: data.config.agentId || "",
            flowId: data.config.flowId || ""
          }))
        }
        if (data.widgetId) setWidgetId(data.widgetId)
        if (data.whatsappNumber && !data.config?.phone) {
          setCfg(prev => ({ ...prev, phone: data.whatsappNumber?.replace(/\D/g, "") || prev.phone }))
        }
        if (data.availableAgents) setAvailableAgents(data.availableAgents)
        if (data.availableFlows) setAvailableFlows(data.availableFlows)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const set = (key: keyof WidgetConfig, value: any) => {
    setCfg(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/wa-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg)
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Widget saved! Your embed code is ready.")
        if (data.widgetId) setWidgetId(data.widgetId)
        setShowEmbedCode(true)
      } else {
        toast.error("Failed to save widget")
      }
    } catch {
      toast.error("Failed to save widget")
    } finally {
      setIsSaving(false)
    }
  }, [cfg])

  const addRule = () => {
    setCfg(prev => ({
      ...prev,
      urlRules: [...prev.urlRules, {
        id: Math.random().toString(36).substr(2, 9),
        sourceUrl: "",
        prefillMsg: "",
        onScreenMsg: "",
        removeChars: true,
        capitalize: true
      }]
    }))
  }

  const updateRule = (id: string, field: keyof UrlRule, value: any) => {
    setCfg(prev => ({
      ...prev,
      urlRules: prev.urlRules.map(rule => rule.id === id ? { ...rule, [field]: value } : rule)
    }))
  }

  const removeRule = (id: string) => {
    setCfg(prev => ({
      ...prev,
      urlRules: prev.urlRules.filter(rule => rule.id !== id)
    }))
  }

  const scriptTag = `<script\n  type="text/javascript"\n  src="${typeof window !== "undefined" ? window.location.origin : ""}/wa-widget.js"\n  id="watibot-wa-widget"\n  widget-id="${widgetId}"\n></script>`

  if (isLoading) {
    return (
      <DashboardLayoutClient mainClassName="antialiased bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="p-8 flex items-center justify-center min-h-[500px]">
          <div className="w-8 h-8 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayoutClient>
    )
  }

  return (
    <DashboardLayoutClient mainClassName="antialiased bg-white dark:bg-slate-900 min-h-screen relative overflow-y-auto pb-32">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-16">

          {/* SECTION 1: Configure WhatsApp Chat Button */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            <div className="lg:w-1/4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Configure WhatsApp Chat Button</h2>
              <p className="text-xs text-gray-500">Personalize the pre-filled user message for your WhatsApp button</p>
            </div>
            
            <div className="lg:w-3/4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">WhatsApp Phone Number</label>
                  <input 
                    type="text" 
                    value={cfg.phone}
                    onChange={e => set('phone', e.target.value.replace(/\D/g, ""))}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                    placeholder="+92345678910"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Button Background</label>
                  <div className="flex items-center gap-2 w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md">
                    <input 
                      type="color" 
                      value={cfg.buttonBgColor}
                      onChange={e => set('buttonBgColor', e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-none p-0" 
                    />
                    <input 
                      type="text"
                      value={cfg.buttonBgColor}
                      onChange={e => set('buttonBgColor', e.target.value)}
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">CTA Text</label>
                  <input 
                    type="text" 
                    value={cfg.ctaText}
                    onChange={e => set('ctaText', e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Margin Bottom(px)</label>
                  <input type="number" value={cfg.marginBottom} onChange={e => set('marginBottom', parseInt(e.target.value)||0)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Margin Left(px)</label>
                  <input type="number" value={cfg.marginLeft} onChange={e => set('marginLeft', parseInt(e.target.value)||0)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Margin Right(px)</label>
                  <input type="number" value={cfg.marginRight} onChange={e => set('marginRight', parseInt(e.target.value)||0)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Border Radius(px)</label>
                  <input type="number" value={cfg.borderRadius} onChange={e => set('borderRadius', parseInt(e.target.value)||0)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Default Pre-filled Message</label>
                <textarea 
                  value={cfg.prefillMsg}
                  onChange={e => set('prefillMsg', e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm min-h-[100px] resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">You can use defaults - (&#123;&#123;page_url&#125;&#125; &amp; &#123;&#123;page_title&#125;&#125;)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Position</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.position === "Bottom-Right" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('position', "Bottom-Right")}>
                      {cfg.position === "Bottom-Right" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <span className="text-sm" onClick={() => set('position', "Bottom-Right")}>Bottom-Right</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.position === "Bottom-Left" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('position', "Bottom-Left")}>
                      {cfg.position === "Bottom-Left" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <span className="text-sm" onClick={() => set('position', "Bottom-Left")}>Bottom-Left</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: Widget Automation (AI Agent or Flow) */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-16 p-6 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <div className="lg:w-1/4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Automation</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Connect your website widget to an AI Agent or an automated Flow, or use standard WhatsApp Click-to-Chat.
              </p>
            </div>
            
            <div className="lg:w-3/4 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Automation Type</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Option 1: None */}
                  <div
                    onClick={() => set('automationType', 'none')}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between bg-white dark:bg-slate-900 shadow-xs",
                      cfg.automationType === "none"
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold text-sm text-gray-900 dark:text-white">None</span>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center",
                        cfg.automationType === "none" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                      )}>
                        {cfg.automationType === "none" && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                      Standard Click-to-Chat. Opens WhatsApp app or web directly with your pre-filled message.
                    </p>
                  </div>

                  {/* Option 2: AI Agent */}
                  <div
                    onClick={() => set('automationType', 'ai_agent')}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between bg-white dark:bg-slate-900 shadow-xs",
                      cfg.automationType === "ai_agent"
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        <span className="font-bold text-sm text-gray-900 dark:text-white">AI Agent</span>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center",
                        cfg.automationType === "ai_agent" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                      )}>
                        {cfg.automationType === "ai_agent" && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                      Live AI assistant. Responds to inquiries using Knowledge Base, custom prompt instructions, and CRM history.
                    </p>
                  </div>

                  {/* Option 3: Flow */}
                  <div
                    onClick={() => set('automationType', 'flow')}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between bg-white dark:bg-slate-900 shadow-xs",
                      cfg.automationType === "flow"
                        ? "border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-bold text-sm text-gray-900 dark:text-white">Flow</span>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center",
                        cfg.automationType === "flow" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                      )}>
                        {cfg.automationType === "flow" && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                      Interactive flow. Delivers buttons, lists, and form capture via your existing Flow Builder engine.
                    </p>
                  </div>

                </div>
              </div>

              {/* Sub-config: AI Agent selection */}
              {cfg.automationType === "ai_agent" && (
                <div className="p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-violet-900 dark:text-violet-300">Select AI Agent</label>
                    <Link
                      href="/dashboard/knowledge-base"
                      className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1"
                    >
                      Manage AI Agents <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {availableAgents.length > 0 ? (
                    <div>
                      <select
                        value={cfg.agentId}
                        onChange={e => set('agentId', e.target.value)}
                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800/60 rounded-md text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">-- Choose an AI Agent --</option>
                        {availableAgents.map(agent => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} {agent.isDefault ? "(Default)" : ""} - [{agent.model || agent.aiProvider || "OpenAI"}]
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        Visitor inquiries in the website widget will be handled in real-time by the selected agent.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                      No AI Agents found. Please create an AI Agent first in <Link href="/dashboard/knowledge-base" className="font-bold underline">Knowledge Base</Link>.
                    </div>
                  )}
                </div>
              )}

              {/* Sub-config: Flow selection */}
              {cfg.automationType === "flow" && (
                <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-blue-900 dark:text-blue-300">Select Flow</label>
                    <Link
                      href="/dashboard/flows"
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                    >
                      Manage Flows <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {availableFlows.length > 0 ? (
                    <div>
                      <select
                        value={cfg.flowId}
                        onChange={e => set('flowId', e.target.value)}
                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-md text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Choose a Flow --</option>
                        {availableFlows.map(flow => (
                          <option key={flow.id} value={flow.id}>
                            {flow.name} {flow.isActive ? "(Active)" : "(Inactive)"}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        The website widget will start this flow and deliver interactive buttons, lists, and messages.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                      No Flows found. Please create an automated flow in the <Link href="/dashboard/flows" className="font-bold underline">Flow Builder</Link>.
                    </div>
                  )}
                </div>
              )}

            </div>
          </section>

          {/* SECTION 2: Chat Widget */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            <div className="lg:w-1/4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Chat Widget</h2>
              <p className="text-xs text-gray-500">You can personalize the user message based on your website's URL</p>
            </div>
            
            <div className="lg:w-3/4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">BrandName</label>
                  <input type="text" value={cfg.brandName} onChange={e => set('brandName', e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Brand Subtitle</label>
                  <input type="text" value={cfg.brandSubtitle} onChange={e => set('brandSubtitle', e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Brand Color</label>
                  <div className="flex items-center gap-2 w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md">
                    <input type="color" value={cfg.brandColor} onChange={e => set('brandColor', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none p-0" />
                    <input type="text" value={cfg.brandColor} onChange={e => set('brandColor', e.target.value)} className="flex-1 bg-transparent border-none focus:outline-none text-sm uppercase" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Brand Image Url</label>
                  <input type="text" value={cfg.brandImageUrl} onChange={e => set('brandImageUrl', e.target.value)} placeholder="https://..." className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Widget CTA Text</label>
                  <input type="text" value={cfg.widgetCtaText} onChange={e => set('widgetCtaText', e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Default On-screen Message</label>
                  <textarea 
                    value={cfg.onScreenMsg}
                    onChange={e => set('onScreenMsg', e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm min-h-[100px] resize-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">You can use defaults - (&#123;&#123;page_url&#125;&#125; &amp; &#123;&#123;page_title&#125;&#125;)</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Open widget on Mobile screen</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.openOnMobile === "Yes" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('openOnMobile', "Yes")}>
                        {cfg.openOnMobile === "Yes" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.openOnMobile === "No" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('openOnMobile', "No")}>
                        {cfg.openOnMobile === "No" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Open widget by default</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.openByDefault === "Yes" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('openByDefault', "Yes")}>
                        {cfg.openByDefault === "Yes" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.openByDefault === "No" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('openByDefault', "No")}>
                        {cfg.openByDefault === "No" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Re-open widget by default</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.reopenByDefault === "Always" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('reopenByDefault', "Always")}>
                        {cfg.reopenByDefault === "Always" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm">Always</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", cfg.reopenByDefault === "After 24 hour" ? "border-emerald-500" : "border-gray-300")} onClick={() => set('reopenByDefault', "After 24 hour")}>
                        {cfg.reopenByDefault === "After 24 hour" && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm">After 24 hour</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

           <section className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            <div className="lg:w-1/4">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">URL Personalization</h2>
                <Switch 
                  checked={cfg.urlPersonalizationEnabled}
                  onCheckedChange={(c) => set('urlPersonalizationEnabled', c)}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              <p className="text-xs text-gray-500">You can personalize the user message based on your website's URL</p>
            </div>
            
            <div className={cn("lg:w-3/4 space-y-6 transition-opacity duration-300", cfg.urlPersonalizationEnabled ? "opacity-100" : "opacity-40 pointer-events-none")}>
              <button 
                onClick={addRule}
                className="flex items-center gap-2 px-4 py-2 border border-emerald-500 text-emerald-600 font-semibold text-xs rounded shadow-sm hover:bg-emerald-50 transition-colors uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" /> Add URL
              </button>

              {cfg.urlRules.map((rule, idx) => (
                <div key={rule.id} className="p-6 border border-gray-100 rounded-xl shadow-sm relative space-y-6 bg-white">
                  <button 
                    onClick={() => removeRule(rule.id)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-gray-500"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Source Url</label>
                    <input 
                      type="text" 
                      value={rule.sourceUrl}
                      onChange={e => updateRule(rule.id, 'sourceUrl', e.target.value)}
                      placeholder="https://..." 
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" 
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Parameters - (&#123;&#123;page_url&#125;&#125;, &#123;&#123;page_title&#125;&#125;)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Pre-filled Message</label>
                    <input 
                      type="text" 
                      value={rule.prefillMsg}
                      onChange={e => updateRule(rule.id, 'prefillMsg', e.target.value)}
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">On screen Message</label>
                    <input 
                      type="text" 
                      value={rule.onScreenMsg}
                      onChange={e => updateRule(rule.id, 'onScreenMsg', e.target.value)}
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Format parameters values</label>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={rule.removeChars}
                          onChange={e => updateRule(rule.id, 'removeChars', e.target.checked)}
                          className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 accent-emerald-500" 
                        />
                        <span className="text-sm">Remove - &amp; _</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={rule.capitalize}
                          onChange={e => updateRule(rule.id, 'capitalize', e.target.checked)}
                          className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 accent-emerald-500" 
                        />
                        <span className="text-sm">Capitilize first letter</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

           <div className="flex flex-col md:flex-row items-center gap-6 pt-8 mt-8 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-bold rounded-md transition-all shadow-md active:scale-95"
            >
              {isSaving ? "Saving..." : "Generate Snippet"}
            </button>
            
            {showEmbedCode && (
              <div className="flex-1 w-full flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Widget Name</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{cfg.brandName || "WhatsApp Widget"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Status</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Automation</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">
                      {cfg.automationType === "ai_agent" ? "AI Agent" : cfg.automationType === "flow" ? "Flow" : "None (Click-to-Chat)"}
                    </span>
                  </div>
                  {cfg.automationType === "ai_agent" && (
                    <div>
                      <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">AI Agent</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        {availableAgents.find(a => a.id === cfg.agentId)?.name || "Default Agent"}
                      </span>
                    </div>
                  )}
                  {cfg.automationType === "flow" && (
                    <div>
                      <span className="text-gray-400 font-bold block uppercase tracking-wider text-[10px]">Flow</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {availableFlows.find(f => f.id === cfg.flowId)?.name || "None"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">YOUR EMBED CODE</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(scriptTag)
                      toast.success("Embed code copied to clipboard!")
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    Copy Code
                  </button>
                </div>
                <div className="bg-slate-900 rounded-xl p-6 font-mono text-sm text-emerald-400 overflow-x-auto whitespace-pre border border-slate-800 shadow-inner selection:bg-emerald-500/30">
                  {scriptTag}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Highlight and copy the code above, then paste it right before the closing <code>&lt;/body&gt;</code> tag of your HTML or PHP website.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
      <style>{`
        .widget-preview-fixed {
          position: fixed;
          z-index: 9999;
          transition: all 0.3s ease;
          bottom: var(--widget-mb);
        }
        .widget-preview-fixed.pos-right {
          right: var(--widget-mr);
          left: auto;
          align-items: flex-end;
        }
        .widget-preview-fixed.pos-left {
          left: calc(256px + var(--widget-ml));
          right: auto;
          align-items: flex-start;
        }
        body.sidebar-collapsed .widget-preview-fixed.pos-left {
          left: calc(80px + var(--widget-ml));
        }
        @media (max-width: 768px) {
          .widget-preview-fixed.pos-left {
            left: var(--widget-ml);
          }
        }
      `}</style>
      <div 
        className={cn(
          "widget-preview-fixed flex flex-col",
          cfg.position === "Bottom-Left" ? "pos-left" : "pos-right"
        )}
        style={{
          "--widget-mb": `${cfg.marginBottom}px`,
          "--widget-ml": `${cfg.marginLeft}px`,
          "--widget-mr": `${cfg.marginRight}px`,
        } as React.CSSProperties}
      >
        {/* Chat Bubble Preview */}
        <div 
          className={cn(
            "mb-4 w-[320px] bg-white rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 origin-bottom flex flex-col",
            isPreviewOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 pointer-events-none"
          )}
        >
          {/* Header */}
          <div 
            className="p-3.5 flex items-center gap-3 relative shadow-xs"
            style={{ backgroundColor: cfg.brandColor }}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              {cfg.brandImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.brandImageUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm m-0 leading-tight truncate">{cfg.brandName || "WhatsApp"}</h3>
              <p className="text-white/85 text-[11px] m-0 mt-0.5 truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] inline-block shrink-0"></span>
                {cfg.brandSubtitle}
              </p>
            </div>
            <button 
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/25 text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chat Area */}
          <div 
            className="p-4 min-h-[160px] flex flex-col justify-end gap-2.5 relative overflow-y-auto"
            style={{ 
              backgroundColor: "#efeae2", 
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          >
            {/* Bot message */}
            <div className="self-start max-w-[84%] bg-white rounded-t-xl rounded-br-xl rounded-bl-[3px] p-2.5 px-3 shadow-[0_1px_1.5px_rgba(11,20,26,0.12)] relative">
              <p className="text-[13.5px] text-[#111b21] leading-snug whitespace-pre-wrap m-0">
                {cfg.onScreenMsg}
              </p>
              <span className="block text-[10.5px] text-[#667781] mt-1 text-right">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-2.5 px-3 border-t border-[#e9edef] flex items-center gap-2 bg-[#f0f2f5]">
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={cfg.prefillMsg}
              readOnly
              className="flex-1 bg-white border border-[#d1d7db] rounded-full px-3.5 py-2 text-sm text-[#111b21] focus:outline-none"
            />
            <button 
              className="w-9 h-9 rounded-full text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shrink-0 shadow-sm"
              style={{ backgroundColor: cfg.buttonBgColor }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>

        {/* Button */}
        <button 
          onClick={() => setIsPreviewOpen(!isPreviewOpen)}
          className="flex items-center gap-2 px-4 py-3 shadow-xl transition-transform hover:scale-105 active:scale-95 border-none cursor-pointer"
          style={{
            backgroundColor: cfg.buttonBgColor,
            borderRadius: `${cfg.borderRadius}px`,
          }}
        >
          <svg className="w-5 h-5 text-white shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span className="text-white font-bold text-sm tracking-tight">{cfg.ctaText}</span>
        </button>
      </div>

    </DashboardLayoutClient>
  )
}
