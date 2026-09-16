"use client"

import { useState, useEffect, useMemo } from "react"
import { Check, Image as ImageIcon, Video, FileText, Smartphone, Type, AlertCircle, Play, Share2, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export type MetaTemplate = {
  id: string
  name: string
  category: string
  language: string
  components?: Array<{
    type?: string
    text?: string
    format?: string
    example?: {
      header_handle?: string[]
      header_text?: string[]
      body_text?: string[][]
    }
    buttons?: Array<{
      type?: string
      text?: string
      url?: string
      phone_number?: string
    }>
  }>
}

export type TemplateConfig = {
  templateName: string
  language: string
  headerValue?: string
  headerVariables: Record<string, string>
  bodyVariables: Record<string, string>
  buttonVariables: Record<string, string>
}

interface WhatsAppTemplateBuilderProps {
  label: string
  description: string
  fieldName: string
  value: string // Stringified JSON or just template name
  templates: MetaTemplate[]
  onChange: (value: string) => void
  availableVariables?: { label: string; value: string }[]
}

function parseConfig(value: string): TemplateConfig {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === "object" && parsed.templateName) {
      return {
        templateName: parsed.templateName || "",
        language: parsed.language || "",
        headerValue: parsed.headerValue || "",
        headerVariables: parsed.headerVariables || {},
        bodyVariables: parsed.bodyVariables || {},
        buttonVariables: parsed.buttonVariables || {},
      }
    }
  } catch (e) {
    // legacy format: just the template name
  }
  return {
    templateName: value || "",
    language: "",
    headerValue: "",
    headerVariables: {},
    bodyVariables: {},
    buttonVariables: {},
  }
}

function extractVariables(text: string): string[] {
  if (!text) return []
  const matches = text.match(/\{\{(\d+)\}\}/g)
  if (!matches) return []
  // return unique numbers as strings
  return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, "")))).sort((a, b) => parseInt(a) - parseInt(b))
}

export default function WhatsAppTemplateBuilder({
  label,
  description,
  fieldName,
  value,
  templates,
  onChange,
  availableVariables,
}: WhatsAppTemplateBuilderProps) {
  const [config, setConfig] = useState<TemplateConfig>(parseConfig(value))

  // Sync state upward when config changes
  useEffect(() => {
    // Only fire onChange if we actually have a templateName
    if (config.templateName) {
      onChange(JSON.stringify(config))
    } else {
      onChange("")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.templateName, config.language, config.headerValue, JSON.stringify(config.headerVariables), JSON.stringify(config.bodyVariables), JSON.stringify(config.buttonVariables)])

  // Get unique template names
  const uniqueTemplateNames = useMemo(() => {
    return Array.from(new Set(templates.map(t => t.name))).sort()
  }, [templates])

  // Get languages for the selected template
  const availableLanguages = useMemo(() => {
    if (!config.templateName) return []
    return templates
      .filter(t => t.name === config.templateName)
      .map(t => t.language)
      .sort()
  }, [templates, config.templateName])

  // Set default language if none selected or if languages list changes
  useEffect(() => {
    if (config.templateName && availableLanguages.length > 0) {
      if (!config.language || !availableLanguages.includes(config.language)) {
        setConfig(prev => ({ ...prev, language: availableLanguages[0] }))
      }
    }
  }, [config.templateName, availableLanguages, config.language])

  // Get the selected template object
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.name === config.templateName && t.language === config.language)
  }, [templates, config.templateName, config.language])

  const headerComponent = activeTemplate?.components?.find(c => c.type?.toUpperCase() === "HEADER")
  const bodyComponent = activeTemplate?.components?.find(c => c.type?.toUpperCase() === "BODY")
  const footerComponent = activeTemplate?.components?.find(c => c.type?.toUpperCase() === "FOOTER")
  const buttonsComponent = activeTemplate?.components?.find(c => c.type?.toUpperCase() === "BUTTONS")

  const headerFormat = headerComponent?.format?.toUpperCase() || "NONE"
  const bodyVars = extractVariables(bodyComponent?.text || "")
  const headerVars = extractVariables(headerComponent?.text || "")

  const hasVariables = bodyVars.length > 0 || headerVars.length > 0 || headerFormat === "IMAGE" || headerFormat === "DOCUMENT" || headerFormat === "VIDEO"

  // Check validation
  const isValid = useMemo(() => {
    if (!config.templateName || !config.language) return false
    
    // Check body variables
    for (const v of bodyVars) {
      if (!config.bodyVariables[v]) return false
    }
    
    // Check header variables / media
    if (headerFormat === "TEXT") {
      for (const v of headerVars) {
        if (!config.headerVariables[v]) return false
      }
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
      if (!config.headerValue) return false
    }

    return true
  }, [config, bodyVars, headerVars, headerFormat])

  const handleUpdateBodyVar = (variable: string, val: string) => {
    setConfig(prev => ({ ...prev, bodyVariables: { ...prev.bodyVariables, [variable]: val } }))
  }

  const handleUpdateHeaderVar = (variable: string, val: string) => {
    setConfig(prev => ({ ...prev, headerVariables: { ...prev.headerVariables, [variable]: val } }))
  }

  const handleUpdateHeaderValue = (val: string) => {
    setConfig(prev => ({ ...prev, headerValue: val }))
  }

  const handleUpdateButtonVar = (index: string, val: string) => {
    setConfig(prev => ({ ...prev, buttonVariables: { ...prev.buttonVariables, [index]: val } }))
  }

  // --- Render Live Preview ---
  const renderPreview = () => {
    if (!activeTemplate) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-[#efeae2] dark:bg-[#0b141a]">
          <Smartphone className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm font-medium text-slate-500">Select a template to view the preview</p>
        </div>
      )
    }

    let previewBody = bodyComponent?.text || ""
    bodyVars.forEach(v => {
      const mappedVal = config.bodyVariables[v]
      let val = mappedVal || `{{${v}}}`
      if (mappedVal && availableVariables) {
        const found = availableVariables.find(av => av.value === mappedVal)
        if (found) {
          if (mappedVal === "otp_code") val = "123456"
          else if (mappedVal === "reset_link") val = "https://example.com/reset"
          else if (mappedVal === "vendor_name") val = "Vendor Corp"
          else if (mappedVal === "system_name") val = "WatiBot"
          else val = `[${found.label}]`
        }
      }
      previewBody = previewBody.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val)
    })

    let previewHeader = null
    if (headerFormat === "TEXT" && headerComponent?.text) {
      let hText = headerComponent.text
      headerVars.forEach(v => {
        const mappedVal = config.headerVariables[v]
        let val = mappedVal || `{{${v}}}`
        if (mappedVal && availableVariables) {
          const found = availableVariables.find(av => av.value === mappedVal)
          if (found) {
            if (mappedVal === "otp_code") val = "123456"
            else if (mappedVal === "reset_link") val = "https://example.com/reset"
            else if (mappedVal === "vendor_name") val = "Vendor Corp"
            else val = `[${found.label}]`
          }
        }
        hText = hText.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val)
      })
      previewHeader = <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{hText}</p>
    } else if (headerFormat === "IMAGE") {
      previewHeader = config.headerValue ? (
        <img src={config.headerValue} alt="Header" className="w-full h-32 object-cover rounded-lg mb-2" />
      ) : (
        <div className="w-full h-32 bg-slate-200 dark:bg-slate-700 flex items-center justify-center rounded-lg mb-2 text-slate-400"><ImageIcon className="w-8 h-8" /></div>
      )
    } else if (headerFormat === "VIDEO") {
      previewHeader = config.headerValue ? (
        <div className="relative w-full h-32 bg-black rounded-lg mb-2 overflow-hidden flex items-center justify-center">
          <Play className="w-10 h-10 text-white opacity-80" />
        </div>
      ) : (
        <div className="w-full h-32 bg-slate-200 dark:bg-slate-700 flex items-center justify-center rounded-lg mb-2 text-slate-400"><Video className="w-8 h-8" /></div>
      )
    } else if (headerFormat === "DOCUMENT") {
      previewHeader = (
        <div className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-lg flex items-center gap-3 mb-2 border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {config.headerValue ? config.headerValue.split('/').pop() : "document.pdf"}
            </p>
            <p className="text-xs text-slate-500">1.2 MB • PDF</p>
          </div>
        </div>
      )
    }

    return (
      <div className="w-full h-full bg-[#efeae2] dark:bg-[#0b141a] p-4 flex flex-col font-sans overflow-y-auto">
        <div className="bg-white dark:bg-[#202c33] rounded-[10px] rounded-tl-none p-2 shadow-sm max-w-[90%] self-start border border-transparent dark:border-slate-800">
          {previewHeader}
          <div className="text-[14.2px] leading-relaxed text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap px-1">
            {previewBody}
          </div>
          {footerComponent?.text && (
            <p className="text-[12.5px] text-[#667781] dark:text-[#8696a0] mt-2 px-1">
              {footerComponent.text}
            </p>
          )}
          <div className="flex justify-end pt-1 pr-1">
            <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">12:00 PM</span>
          </div>
        </div>
        
        {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
          <div className="flex flex-col gap-1 mt-1 max-w-[90%] self-start w-full">
            {buttonsComponent.buttons.map((btn, idx) => (
              <div key={idx} className="bg-white dark:bg-[#202c33] rounded-[10px] p-2.5 text-center shadow-sm cursor-pointer border border-transparent dark:border-slate-800">
                <span className="text-[#00a884] dark:text-[#53bdeb] font-medium text-[14.5px] flex items-center justify-center gap-2">
                  {btn.type === "URL" && <Share2 className="w-4 h-4" />}
                  {btn.type === "PHONE_NUMBER" && <Phone className="w-4 h-4" />}
                  {btn.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm plus-jakarta-forced transition-all duration-300">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/30">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-black text-slate-800 dark:text-white leading-tight">
              {label}
            </h3>
            {!isValid && config.templateName && (
              <Badge variant="destructive" className="text-[9px] uppercase tracking-wider font-bold h-5 px-1.5 rounded-md flex items-center gap-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                <AlertCircle className="w-3 h-3" /> Needs Config
              </Badge>
            )}
            {isValid && config.templateName && (
              <Badge variant="success" className="text-[9px] uppercase tracking-wider font-bold h-5 px-1.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-none">
                <Check className="w-3 h-3 mr-1" /> Ready
              </Badge>
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            {description}
          </p>
        </div>
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-600 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 self-start md:self-auto">
          {fieldName}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-100 dark:divide-slate-800">
        
        {/* Left: Configuration Form */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Template Name</Label>
                <select
                  value={config.templateName}
                  onChange={(e) => setConfig({ templateName: e.target.value, language: "", headerValue: "", headerVariables: {}, bodyVariables: {}, buttonVariables: {} })}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30"
                >
                  <option value="">-- Select Template --</option>
                  {uniqueTemplateNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black tracking-wider text-slate-500 uppercase ml-1">Language</Label>
                <select
                  value={config.language}
                  onChange={(e) => setConfig(prev => ({ ...prev, language: e.target.value }))}
                  disabled={!config.templateName}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 disabled:opacity-50"
                >
                  <option value="">-- --</option>
                  {availableLanguages.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {activeTemplate && hasVariables && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 border-t border-slate-100 dark:border-slate-800 pt-5">
              <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Type className="w-4 h-4 text-slate-400" />
                Map Template Variables
              </h4>

              {/* Header Configuration */}
              {headerFormat !== "NONE" && (
                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">Header ({headerFormat})</p>
                  
                  {headerFormat === "TEXT" && headerVars.length > 0 && (
                    <div className="space-y-3">
                      {headerVars.map(v => (
                        <div key={`h_${v}`} className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                            {v}
                          </span>
                          {availableVariables ? (
                            <select
                              value={config.headerVariables[v] || ""}
                              onChange={(e) => handleUpdateHeaderVar(v, e.target.value)}
                              className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/30"
                            >
                              <option value="">-- Select Variable --</option>
                              {availableVariables.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <Input 
                              placeholder="Value or {{system.user.name}}"
                              value={config.headerVariables[v] || ""}
                              onChange={(e) => handleUpdateHeaderVar(v, e.target.value)}
                              className="h-9 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500 ml-1">Media URL</Label>
                      <Input 
                        placeholder={`https://example.com/file.${headerFormat === "IMAGE" ? "jpg" : headerFormat === "VIDEO" ? "mp4" : "pdf"}`}
                        value={config.headerValue || ""}
                        onChange={(e) => handleUpdateHeaderValue(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Body Variables Configuration */}
              {bodyVars.length > 0 && (
                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">Body Variables</p>
                  {bodyVars.map(v => (
                    <div key={`b_${v}`} className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/20 text-[#00a884] font-black text-xs flex items-center justify-center shrink-0">
                        {v}
                      </span>
                      {availableVariables ? (
                        <select
                          value={config.bodyVariables[v] || ""}
                          onChange={(e) => handleUpdateBodyVar(v, e.target.value)}
                          className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/30"
                        >
                          <option value="">-- Select Variable --</option>
                          {availableVariables.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <Input 
                          placeholder={`Value for {{${v}}}`}
                          value={config.bodyVariables[v] || ""}
                          onChange={(e) => handleUpdateBodyVar(v, e.target.value)}
                          className="h-9 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Button Configuration */}
              {buttonsComponent?.buttons?.map((btn, i) => {
                if (btn.type === "URL" && btn.url && btn.url.includes("{{1}}")) {
                  return (
                    <div key={`btn_${i}`} className="space-y-3 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black tracking-wider text-slate-500 uppercase">Button: {btn.text}</p>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                          {i}
                        </span>
                        {availableVariables ? (
                          <select
                            value={config.buttonVariables[i.toString()] || ""}
                            onChange={(e) => handleUpdateButtonVar(i.toString(), e.target.value)}
                            className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]/30"
                          >
                            <option value="">-- Select Variable --</option>
                            {availableVariables.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Input 
                            placeholder="Dynamic URL Parameter"
                            value={config.buttonVariables[i.toString()] || ""}
                            onChange={(e) => handleUpdateButtonVar(i.toString(), e.target.value)}
                            className="h-9 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}

          {activeTemplate && !hasVariables && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 flex items-center gap-3 mt-4">
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                This template requires no variables or media mapping. It is ready to use!
              </p>
            </div>
          )}
        </div>

        {/* Right: Live Preview */}
        <div className="bg-slate-50 dark:bg-slate-950/50 p-6 flex items-center justify-center relative min-h-[400px]">
          <div className="absolute top-4 left-4">
            <span className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest text-slate-500 uppercase shadow-sm">
              Live Preview
            </span>
          </div>

          {/* Phone Frame */}
          <div className="w-[320px] h-[580px] bg-[#111b21] rounded-[40px] border-[12px] border-slate-900 dark:border-slate-950 shadow-2xl overflow-hidden relative ring-1 ring-white/10 flex flex-col">
            {/* Notch */}
            <div className="absolute top-0 inset-x-0 h-[24px] flex justify-center z-20">
              <div className="w-[120px] h-[24px] bg-slate-900 dark:bg-slate-950 rounded-b-[16px]"></div>
            </div>
            
            {/* WhatsApp Header */}
            <div className="bg-[#202c33] px-4 pt-10 pb-3 flex items-center gap-3 z-10 shadow-sm shrink-0">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white overflow-hidden shrink-0">
                <img src="/logo.png" alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              </div>
              <div>
                <p className="text-white font-medium text-[15px] leading-tight">Wati Bot</p>
                <p className="text-[#8696a0] text-[11px]">Business Account</p>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 w-full bg-[#0b141a] bg-cover bg-center" style={{ backgroundImage: "url('/img/whatsapp-bg-dark.png')" }}>
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
