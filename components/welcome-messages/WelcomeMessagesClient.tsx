"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getTags } from "@/app/actions/tags";
import { getFlows } from "@/app/actions/flows";
import { getAgents } from "@/app/actions/agents";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  Zap,
  X,
  Search,
  Smartphone,
  Facebook,
  Instagram,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Library,
} from "lucide-react";
import { MediaLibraryModal } from "@/components/flows/modals/media-library-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMMON_CONTACT_VARIABLES } from "@/lib/messaging/contactVariables";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  WhatsAppTemplatePreview, 
  type MessageTemplate 
} from "@/components/whatsapp/WhatsAppTemplatePreview";
import {
  createWelcomeMessage,
  updateWelcomeMessage,
  deleteWelcomeMessage,
  toggleWelcomeMessage,
  type WelcomeCondition,
} from "@/app/actions/welcome-messages";

// ─── Condition catalogue ──────────────────────────────────────────────────────
const CONDITION_TYPES = [
  { value: "first_message", label: "First message of chat" },
  { value: "first_message_of_day", label: "First message of the day" },
  { value: "before_flow_starts", label: "Before flow starts", hasValue: true, unit: "flow" },
  { value: "after_flow_starts", label: "After flow starts", hasValue: true, unit: "flow" },
  { value: "after_flow_ends", label: "After flow ends", hasValue: true, unit: "flow" },
  { value: "user_inactive", label: "User inactive for X minutes", hasValue: true, unit: "minutes" },
  { value: "returning_user", label: "Returning user after X hours", hasValue: true, unit: "hours" },
  { value: "new_user", label: "New user (never interacted)" },
  { value: "has_tag", label: "User has tag", hasValue: true, unit: "tag" },
  { value: "time_of_day", label: "Time of day", hasValue: true, unit: "time" },
  { value: "day_type", label: "Day type", hasValue: true, unit: "weekend/weekday" },
  { value: "after_flow", label: "After completing flow", hasValue: true, unit: "flow" },
  { value: "keyword", label: "User sends keyword", hasValue: true, unit: "keyword" },
  { value: "user_sends_message", label: "User sends exact message", hasValue: true, unit: "message" },
  { value: "after_x_messages", label: "After X messages exchanged", hasValue: true, unit: "count" },
  { value: "reopen_chat", label: "User reopens chat after inactivity" },
  { value: "user_location", label: "User location", hasValue: true, unit: "country code" },
  { value: "after_failed_flow", label: "After failed flow / fallback", hasValue: true, unit: "flow" },
  { value: "time_range", label: "Specific time range", hasValue: true, unit: "time range" },
  { value: "date_range", label: "Specific date range", hasValue: true, unit: "date range" },
  { value: "date_time_range", label: "Date and Time range", hasValue: true, unit: "date & time" },
];

const PLATFORMS = [
    { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare },
    { value: 'FACEBOOK', label: 'Facebook', icon: Facebook },
    { value: 'INSTAGRAM', label: 'Instagram', icon: Instagram },
];

export interface SequenceButton {
  id?: string;
  type?: string;
  text?: string;
  url?: string;
  phone_number?: string;
}

export interface SequenceItem {
  id: string;
  type: string;
  content: string;
  mediaUrl: string;
  delaySeconds: number;
  buttons?: SequenceButton[];
}

// ─── Main Client ──────────────────────────────────────────────────────────────
export function WelcomeMessagesClient({ initialMessages }: { initialMessages: any[] }) {
  const t = useTranslations("WelcomeMessages");
  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [buttons, setButtons] = useState<{ id: string, text: string, url?: string, phone_number?: string, type: string }[]>([]);
  const [sequenceItems, setSequenceItems] = useState<SequenceItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tagsData, { flows: flowsData }, templateRes, agentsData] = await Promise.all([
          getTags(),
          getFlows(),
          getMessageTemplates(),
          getAgents()
        ]);
        setTags(tagsData);
        setFlows(flowsData);
        setAgents(agentsData);
        if (templateRes.success) {
          setTemplates(templateRes.data.filter((t: any) => t.status === 'APPROVED'));
        }
      } catch (err) {
        console.error("Error fetching tags/flows/templates:", err);
      }
    };
    fetchData();
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    content: "",
    platform: "WHATSAPP",
    isActive: true,
    condition: { type: "first_message", value: "" },
    assignTagId: "none",
    assignAgentId: "none",
    mediaUrl: "",
    mediaType: "IMAGE"
  });
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

  const refresh = async () => {
    const { getWelcomeMessages } = await import("@/app/actions/welcome-messages");
    const { messages } = await getWelcomeMessages();
    setMessages(messages);
  };

  const openCreate = () => {
    setEditTarget(null);
    setIsTemplateMode(false);
    setSelectedTemplate(null);
    setTemplateParams([]);
    setButtons([]);
    setKeywordInput("");
    setSequenceItems([{ id: Math.random().toString(), type: 'TEXT', content: '', mediaUrl: '', delaySeconds: 0 }]);
    setFormData({
      name: "",
      content: "",
      platform: "WHATSAPP",
      isActive: true,
      condition: { type: "first_message", value: "" },
      assignTagId: "none",
      assignAgentId: "none",
      mediaUrl: "",
      mediaType: "IMAGE"
    });
    setIsModalOpen(true);
  };

  const openEdit = (msg: any) => {
    setEditTarget(msg);
    const cond = Array.isArray(msg.conditions) && msg.conditions.length > 0 
        ? msg.conditions[0] 
        : { type: "first_message", value: "" };
        
    setIsTemplateMode(!!msg.templateName);
    if (msg.templateName) {
      const template = templates.find(t => t.name === msg.templateName);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
    setTemplateParams(msg.templateParams || []);
    setButtons(msg.buttons || []);

    const parsedSequence = Array.isArray(msg.sequenceItems) ? msg.sequenceItems : [];
    if (parsedSequence.length > 0) {
        setSequenceItems(parsedSequence);
    } else if (msg.content || msg.mediaUrl) {
        setSequenceItems([{ id: Math.random().toString(), type: msg.mediaType || 'TEXT', content: msg.content || '', mediaUrl: msg.mediaUrl || '', delaySeconds: msg.delaySeconds || 0 }]);
    } else {
        setSequenceItems([{ id: Math.random().toString(), type: 'TEXT', content: '', mediaUrl: '', delaySeconds: 0 }]);
    }

    setFormData({
      name: msg.name,
      content: msg.content,
      platform: msg.platform || "WHATSAPP",
      isActive: msg.isActive,
      condition: { type: cond.type, value: cond.value || "" },
      assignTagId: msg.assignTagId || "none",
      assignAgentId: msg.assignAgentId || "none",
      mediaUrl: msg.mediaUrl || "",
      mediaType: msg.mediaType || "IMAGE"
    });
    setKeywordInput("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return toast.error(t("toastNameRequired"));
    if (!isTemplateMode && sequenceItems.length === 0) return toast.error(t("toastMessageRequired"));
    
    setSaving(true);
    const condTypeDef = CONDITION_TYPES.find(ct => ct.value === formData.condition.type);
    const hasValue = condTypeDef?.hasValue;

    const payload: any = {
        name: formData.name,
        content: isTemplateMode ? formData.content : (sequenceItems[0]?.content || "Sequence Message"),
        platform: formData.platform,
        isActive: formData.isActive,
        priority: 0,
        delaySeconds: 0,
        conditionLogic: "OR" as "OR" | "AND",
        conditions: [{ id: "c1", type: formData.condition.type, value: hasValue ? formData.condition.value : "" }],
        templateName: isTemplateMode ? selectedTemplate?.name : null,
        templateLanguage: isTemplateMode ? selectedTemplate?.language : null,
        templateParams: isTemplateMode ? templateParams : null,
        buttons: !isTemplateMode ? buttons : null,
        assignTagId: (formData.assignTagId && formData.assignTagId !== 'none') ? formData.assignTagId : null,
        assignAgentId: (formData.assignAgentId && formData.assignAgentId !== 'none') ? formData.assignAgentId : null,
        mediaUrl: formData.mediaUrl || null,
        mediaType: formData.mediaUrl ? formData.mediaType : null,
        sequenceItems: !isTemplateMode ? sequenceItems : [],
    };

    if (isTemplateMode && selectedTemplate) {
        const bodyText = selectedTemplate.components?.find(c => c.type === 'BODY')?.text || '';
        let resolvedContent = bodyText;
        templateParams.forEach((val, idx) => {
            resolvedContent = resolvedContent.replace(`{{${idx + 1}}}`, val);
        });
        payload.content = resolvedContent;
    }

    try {
        if (editTarget) {
            await updateWelcomeMessage(editTarget.id, payload);
            toast.success(t("toastUpdated"));
        } else {
            await createWelcomeMessage(payload);
            toast.success(t("toastCreated"));
        }
        setIsModalOpen(false);
        await refresh();
    } catch (e) {
        toast.error(t("toastError"));
    } finally {
        setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    await deleteWelcomeMessage(id);
    toast.success(t("toastDeleted"));
    await refresh();
  };

  const handleToggle = async (id: string, v: boolean) => {
    await toggleWelcomeMessage(id, v);
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, isActive: v } : m));
  };

  const filtered = messages.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/20 antialiased transition-colors duration-300 plus-jakarta-forced">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-5">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100/30">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[#00B074]" />
              </div>
              {t("title")}
            </h2>
            <p className="text-slate-450 dark:text-slate-450 text-xs sm:text-[13px] font-semibold">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#00B074] transition-colors" />
              <input 
                placeholder={t("searchPlaceholder")} 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none focus:border-[#00B074] transition-all"
              />
            </div>
            <button 
              onClick={openCreate} 
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00B074] to-[#009c66] hover:brightness-105 rounded-xl text-xs sm:text-[13px] font-bold text-white transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/10 border-0 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> {t("addNewRule")}
            </button>
          </div>
        </div>

        {/* Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative group overflow-hidden bg-white dark:bg-slate-950 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t("totalRules")}
                </p>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl font-black text-slate-850 dark:text-white tracking-tight">{messages.length}</h4>
                  <span className="text-[10px] font-bold text-[#00B074] bg-[#E8F8F2] dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">{t("configured")}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t("totalRulesDesc")}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100/30">
                <MessageSquare className="w-6 h-6 text-[#00B074]" />
              </div>
            </div>
          </div>
          
          <div className="relative group overflow-hidden bg-white dark:bg-slate-950 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {t("activeAutomations")}
                </p>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl font-black text-slate-850 dark:text-white tracking-tight">{messages.filter(m => m.isActive).length}</h4>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-55 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md">{t("live")}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t("activeAutomationsDesc")}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center border border-amber-100/30">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t("noMessagesFound")}</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-[280px]">
                {t("noMessagesDesc")}
              </p>
              <button 
                onClick={openCreate} 
                className="mt-6 px-4 py-2 border border-[#00B074]/30 text-[#00B074] hover:bg-emerald-50/50 rounded-xl text-xs font-bold transition-all"
              >
                  {t("createFirstMessage")}
              </button>
            </div>
          ) : (
            filtered.map((msg) => {
              const platform = PLATFORMS.find(p => p.value === msg.platform) || PLATFORMS[0];
              const cond = Array.isArray(msg.conditions) && msg.conditions[0];
              const condDef = cond ? CONDITION_TYPES.find(ct => ct.value === cond.type) : null;
              const isWhatsApp = msg.platform === 'WHATSAPP';
              const isInstagram = msg.platform === 'INSTAGRAM';
              
              return (
                <div key={msg.id} className="group bg-white dark:bg-slate-950 rounded-[24px] border border-slate-100 dark:border-slate-800/80 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-5 relative overflow-hidden">
                  {/* Top Actions: Platform & Active Toggle */}
                  <div className="flex justify-between items-start shrink-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors",
                      msg.isActive 
                        ? isWhatsApp ? "bg-[#E8F8F2] text-[#00B074]" : isInstagram ? "bg-pink-50 text-pink-500 dark:bg-pink-950/20" : "bg-blue-50 text-blue-500 dark:bg-blue-950/20"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    )}>
                      <platform.icon className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Switch checked={msg.isActive} onCheckedChange={v => handleToggle(msg.id, v)} className="data-[state=checked]:bg-[#00B074] scale-90" />
                      </div>
                      <div className="flex items-center gap-0.5 border-l border-slate-100 dark:border-slate-800/60 pl-2">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(msg)} className="h-8 w-8 text-slate-400 hover:text-[#00B074] hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(msg.id)} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-base text-slate-800 dark:text-white truncate">{msg.name}</span>
                    </div>

                    {/* Trigger Badge */}
                    {condDef && (
                      <div className="inline-flex items-center gap-1 text-[9px] font-black text-[#00B074] dark:text-emerald-450 bg-[#E8F8F2] dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg uppercase tracking-wider mt-0.5">
                        <Zap className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[220px]">{t(`conditions.${cond.type}`)}{condDef.hasValue && cond.value ? `: ${String(cond.value).split(',')[0]}` : ""}</span>
                      </div>
                    )}

                    {/* Chat Bubble Style content preview */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 min-h-[90px] max-h-[110px] border border-slate-100 dark:border-slate-800/30 overflow-hidden relative mt-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed font-semibold italic">
                        "{msg.content}"
                      </p>
                    </div>
                  </div>

                  {/* Footer Dynamic Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 shrink-0">
                    {msg.templateName && (
                      <Badge variant="outline" className="text-[9px] border-[#00B074]/30 text-[#00B074] dark:text-emerald-450 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {t("badgeTemplate")}
                      </Badge>
                    )}
                    {msg.assignTagId && (
                      <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600 bg-amber-500/5 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {t("badgeTag")}: {tags.find(tag => tag.id === msg.assignTagId)?.name || '...'}
                      </Badge>
                    )}
                    {msg.assignAgentId && (
                      <Badge variant="outline" className="text-[9px] border-indigo-200 text-indigo-600 bg-indigo-500/5 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {t("badgeAgent")}: {agents.find(agent => agent.id === msg.assignAgentId)?.name || agents.find(agent => agent.id === msg.assignAgentId)?.email?.split('@')[0] || '...'}
                      </Badge>
                    )}
                    {msg.mediaUrl && (
                      <Badge variant="outline" className="text-[9px] border-purple-200 text-purple-600 bg-purple-500/5 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {t("badgeMedia")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            }))
          }
        </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[620px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] plus-jakarta-forced">
          <DialogHeader className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {editTarget ? t("editTitle") : t("newTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500">{t("internalName")}</label>
                    <Input 
                        placeholder={t("internalNamePlaceholder")} 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="h-10 focus:ring-[#00B074]"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500">{t("socialPlatform")}</label>
                    <Select value={formData.platform} onValueChange={v => {
                        setFormData({...formData, platform: v});
                        if (v !== 'WHATSAPP') setIsTemplateMode(false);
                    }}>
                        <SelectTrigger className="h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{t("messageType")}</label>
                    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                        <button 
                            onClick={() => setIsTemplateMode(false)}
                            className={cn(
                                "px-3 py-1 rounded text-[10px] font-bold uppercase transition-all",
                                !isTemplateMode ? "bg-white dark:bg-slate-700 text-[#00B074] shadow-sm" : "text-gray-400"
                            )}
                        >{t("regular")}</button>
                        {formData.platform === 'WHATSAPP' && (
                            <button 
                                onClick={() => setIsTemplateMode(true)}
                                className={cn(
                                    "px-3 py-1 rounded text-[10px] font-bold uppercase transition-all",
                                    isTemplateMode ? "bg-white dark:bg-slate-700 text-[#00B074] shadow-sm" : "text-gray-400"
                                )}
                            >{t("template")}</button>
                        )}
                    </div>
                </div>

                {!isTemplateMode ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Message Sequence</label>
                                <span className="text-[10px] text-gray-400 font-semibold">{sequenceItems.length} item(s)</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap p-2 bg-gray-100/80 dark:bg-slate-800/80 rounded-xl border border-gray-200/50 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1 ml-1">Quick Add:</span>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setSequenceItems([...sequenceItems, { id: Math.random().toString(), type: 'TEXT', content: '', mediaUrl: '', delaySeconds: 0 }])}
                                    className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-[#00B074] transition-all cursor-pointer rounded-lg shadow-2xs"
                                >
                                    <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Text
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        const newIdx = sequenceItems.length;
                                        setSequenceItems([...sequenceItems, { id: Math.random().toString(), type: 'IMAGE', content: '', mediaUrl: '', delaySeconds: 0 }]);
                                        setActiveMediaIndex(newIdx);
                                        setIsMediaLibraryOpen(true);
                                    }}
                                    className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 transition-all cursor-pointer rounded-lg shadow-2xs"
                                >
                                    <ImageIcon className="w-3.5 h-3.5 mr-1 text-blue-500" /> Image
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        const newIdx = sequenceItems.length;
                                        setSequenceItems([...sequenceItems, { id: Math.random().toString(), type: 'VIDEO', content: '', mediaUrl: '', delaySeconds: 0 }]);
                                        setActiveMediaIndex(newIdx);
                                        setIsMediaLibraryOpen(true);
                                    }}
                                    className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 transition-all cursor-pointer rounded-lg shadow-2xs"
                                >
                                    <Film className="w-3.5 h-3.5 mr-1 text-purple-500" /> Video
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        const newIdx = sequenceItems.length;
                                        setSequenceItems([...sequenceItems, { id: Math.random().toString(), type: 'DOCUMENT', content: '', mediaUrl: '', delaySeconds: 0 }]);
                                        setActiveMediaIndex(newIdx);
                                        setIsMediaLibraryOpen(true);
                                    }}
                                    className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 transition-all cursor-pointer rounded-lg shadow-2xs"
                                >
                                    <FileText className="w-3.5 h-3.5 mr-1 text-amber-500" /> File
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        const newIdx = sequenceItems.length;
                                        setSequenceItems([...sequenceItems, { id: Math.random().toString(), type: 'AUDIO', content: '', mediaUrl: '', delaySeconds: 0 }]);
                                        setActiveMediaIndex(newIdx);
                                        setIsMediaLibraryOpen(true);
                                    }}
                                    className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-all cursor-pointer rounded-lg shadow-2xs"
                                >
                                    <Music className="w-3.5 h-3.5 mr-1 text-rose-500" /> Audio
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {sequenceItems.map((item, idx) => (
                                <div key={item.id} className="bg-white dark:bg-slate-950 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-slate-800 relative space-y-3 overflow-hidden">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-gray-100 dark:bg-slate-800 text-gray-500 border-none font-bold">#{idx + 1}</Badge>
                                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-900 p-1 rounded-md border border-gray-100 dark:border-slate-800">
                                                <label className="text-[10px] font-bold text-gray-500 ml-1">Delay (s)</label>
                                                <Input 
                                                    type="number" 
                                                    min="0"
                                                    value={item.delaySeconds} 
                                                    onChange={e => {
                                                        const newSeq = [...sequenceItems];
                                                        newSeq[idx].delaySeconds = Math.max(0, parseInt(e.target.value) || 0);
                                                        setSequenceItems(newSeq);
                                                    }}
                                                    className="w-14 sm:w-16 h-6 text-xs text-center p-1"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                disabled={idx === 0}
                                                onClick={() => {
                                                    const newSeq = [...sequenceItems];
                                                    [newSeq[idx - 1], newSeq[idx]] = [newSeq[idx], newSeq[idx - 1]];
                                                    setSequenceItems(newSeq);
                                                }}
                                                className="h-6 w-6"
                                            >
                                                ↑
                                            </Button>
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                disabled={idx === sequenceItems.length - 1}
                                                onClick={() => {
                                                    const newSeq = [...sequenceItems];
                                                    [newSeq[idx + 1], newSeq[idx]] = [newSeq[idx], newSeq[idx + 1]];
                                                    setSequenceItems(newSeq);
                                                }}
                                                className="h-6 w-6"
                                            >
                                                ↓
                                            </Button>
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                onClick={() => setSequenceItems(sequenceItems.filter((_, i) => i !== idx))}
                                                className="h-6 w-6 text-red-500"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-5 gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg w-full max-w-full overflow-x-auto">
                                        {[
                                            { id: 'TEXT', icon: MessageSquare, label: "Text" },
                                            { id: 'IMAGE', icon: ImageIcon, label: "Image" },
                                            { id: 'VIDEO', icon: Film, label: "Video" },
                                            { id: 'AUDIO', icon: Music, label: "Audio" },
                                            { id: 'DOCUMENT', icon: FileText, label: "File" },
                                        ].map((mt) => (
                                            <button
                                                key={mt.id}
                                                type="button"
                                                onClick={() => {
                                                    const newSeq = [...sequenceItems];
                                                    newSeq[idx].type = mt.id;
                                                    setSequenceItems(newSeq);
                                                }}
                                                className={cn(
                                                    "flex items-center justify-center gap-1 px-1 sm:px-3 py-1.5 rounded-md text-[10px] font-bold transition-all truncate",
                                                    item.type === mt.id ? "bg-white dark:bg-slate-700 text-[#00B074] shadow-sm" : "text-gray-400 hover:text-gray-600"
                                                )}
                                            >
                                                <mt.icon className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{mt.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {item.type === 'TEXT' ? (
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center justify-between gap-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Text</span>
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="text-[10px] text-gray-400">Insert:</span>
                                                    {COMMON_CONTACT_VARIABLES.slice(0, 3).map(v => (
                                                        <button
                                                            key={v.value}
                                                            type="button"
                                                            onClick={() => {
                                                                const newSeq = [...sequenceItems];
                                                                newSeq[idx].content = (newSeq[idx].content || '') + (newSeq[idx].content ? ' ' : '') + v.value;
                                                                setSequenceItems(newSeq);
                                                            }}
                                                            className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] hover:bg-emerald-100 border border-emerald-200/50 cursor-pointer"
                                                            title={v.description}
                                                        >
                                                            + {v.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <Textarea 
                                                placeholder="Message text..." 
                                                value={item.content} 
                                                onChange={e => {
                                                    const newSeq = [...sequenceItems];
                                                    newSeq[idx].content = e.target.value;
                                                    setSequenceItems(newSeq);
                                                }}
                                                className="min-h-[80px] resize-none bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {item.type !== 'AUDIO' && item.type !== 'DOCUMENT' && (
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Caption</span>
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span className="text-[10px] text-gray-400">Insert:</span>
                                                            {COMMON_CONTACT_VARIABLES.slice(0, 3).map(v => (
                                                                <button
                                                                    key={v.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newSeq = [...sequenceItems];
                                                                        newSeq[idx].content = (newSeq[idx].content || '') + (newSeq[idx].content ? ' ' : '') + v.value;
                                                                        setSequenceItems(newSeq);
                                                                    }}
                                                                    className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] hover:bg-emerald-100 border border-emerald-200/50 cursor-pointer"
                                                                    title={v.description}
                                                                >
                                                                    + {v.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Textarea 
                                                        placeholder="Optional caption..." 
                                                        value={item.content} 
                                                        onChange={e => {
                                                            const newSeq = [...sequenceItems];
                                                            newSeq[idx].content = e.target.value;
                                                            setSequenceItems(newSeq);
                                                        }}
                                                        className="h-10 min-h-[40px] resize-none bg-white dark:bg-slate-950"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <Input 
                                                    placeholder="Media URL..." 
                                                    value={item.mediaUrl} 
                                                    onChange={e => {
                                                        const newSeq = [...sequenceItems];
                                                        newSeq[idx].mediaUrl = e.target.value;
                                                        setSequenceItems(newSeq);
                                                    }}
                                                    className="h-9 text-xs flex-1"
                                                />
                                                <Button 
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setActiveMediaIndex(idx);
                                                        setIsMediaLibraryOpen(true);
                                                    }}
                                                    className="h-9 px-3 gap-1.5 text-xs font-bold border-[#00B074]/20 text-[#00B074] hover:bg-emerald-50"
                                                >
                                                    <Library className="w-3.5 h-3.5" />
                                                    Library
                                                </Button>
                                            </div>
                                            {item.mediaUrl && (
                                                <div className="mt-2 rounded-lg border border-gray-100 dark:border-slate-800 overflow-hidden bg-gray-50 p-2">
                                                    {item.type === 'IMAGE' && <img src={item.mediaUrl} className="max-h-24 rounded object-contain mx-auto" alt="Preview" />}
                                                    {item.type === 'VIDEO' && <video src={item.mediaUrl} className="max-h-24 mx-auto" controls />}
                                                    {item.type === 'AUDIO' && <audio src={item.mediaUrl} className="w-full" controls />}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* WhatsApp Quick Reply / Interactive Buttons for this Item */}
                                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <Zap className="w-3 h-3 text-[#00B074]" /> Quick Reply Buttons (WhatsApp)
                                            </label>
                                            <span className="text-[10px] text-gray-400 font-semibold">
                                                {(item.buttons || []).length} / 3 buttons
                                            </span>
                                        </div>

                                        {(item.buttons && item.buttons.length > 0) && (
                                            <div className="space-y-2">
                                                {item.buttons.map((btn: any, btnIdx: number) => (
                                                    <div key={btn.id || btnIdx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-200/60 dark:border-slate-800">
                                                        <Select
                                                            value={btn.type || 'QUICK_REPLY'}
                                                            onValueChange={(val) => {
                                                                const newSeq = [...sequenceItems];
                                                                if (!newSeq[idx].buttons) newSeq[idx].buttons = [];
                                                                newSeq[idx].buttons[btnIdx].type = val;
                                                                setSequenceItems(newSeq);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-[11px] font-bold w-full sm:w-[130px] shrink-0 bg-white dark:bg-slate-950">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="z-[99999]">
                                                                <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                                                                <SelectItem value="URL">Website Link</SelectItem>
                                                                <SelectItem value="PHONE_NUMBER">Call Phone</SelectItem>
                                                            </SelectContent>
                                                        </Select>

                                                        <Input
                                                            placeholder="Button Text (e.g. Reply / Order)..."
                                                            maxLength={25}
                                                            value={btn.text || ''}
                                                            onChange={(e) => {
                                                                const newSeq = [...sequenceItems];
                                                                if (!newSeq[idx].buttons) newSeq[idx].buttons = [];
                                                                newSeq[idx].buttons[btnIdx].text = e.target.value;
                                                                setSequenceItems(newSeq);
                                                            }}
                                                            className="h-8 text-xs flex-1 bg-white dark:bg-slate-950"
                                                        />

                                                        {btn.type === 'URL' && (
                                                            <Input
                                                                placeholder="https://example.com"
                                                                value={btn.url || ''}
                                                                onChange={(e) => {
                                                                    const newSeq = [...sequenceItems];
                                                                    if (!newSeq[idx].buttons) newSeq[idx].buttons = [];
                                                                    newSeq[idx].buttons[btnIdx].url = e.target.value;
                                                                    setSequenceItems(newSeq);
                                                                }}
                                                                className="h-8 text-xs flex-1 bg-white dark:bg-slate-950"
                                                            />
                                                        )}

                                                        {btn.type === 'PHONE_NUMBER' && (
                                                            <Input
                                                                placeholder="+1234567890"
                                                                value={btn.phone_number || ''}
                                                                onChange={(e) => {
                                                                    const newSeq = [...sequenceItems];
                                                                    if (!newSeq[idx].buttons) newSeq[idx].buttons = [];
                                                                    newSeq[idx].buttons[btnIdx].phone_number = e.target.value;
                                                                    setSequenceItems(newSeq);
                                                                }}
                                                                className="h-8 text-xs flex-1 bg-white dark:bg-slate-950"
                                                            />
                                                        )}

                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                const newSeq = [...sequenceItems];
                                                                newSeq[idx].buttons = newSeq[idx].buttons?.filter((_: any, i: number) => i !== btnIdx);
                                                                setSequenceItems(newSeq);
                                                            }}
                                                            className="h-8 w-8 text-red-500 shrink-0 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {(!item.buttons || item.buttons.length < 3) && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const newSeq = [...sequenceItems];
                                                    if (!newSeq[idx].buttons) newSeq[idx].buttons = [];
                                                    newSeq[idx].buttons.push({
                                                        id: `btn_${Math.random().toString(36).substring(2, 7)}`,
                                                        type: 'QUICK_REPLY',
                                                        text: ''
                                                    });
                                                    setSequenceItems(newSeq);
                                                }}
                                                className="h-7 text-[10px] font-bold text-[#00B074] border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/60 transition-all rounded-lg cursor-pointer"
                                            >
                                                <Plus className="w-3 h-3 mr-1" /> Add Quick Reply Button
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500">{t("selectTemplate")}</label>
                            <Select 
                                value={selectedTemplate?.name} 
                                onValueChange={v => {
                                    const tempObj = templates.find(temp => temp.name === v);
                                    setSelectedTemplate(tempObj || null);
                                    if (tempObj) {
                                        const bodyText = tempObj.components?.find(c => c.type === 'BODY')?.text || '';
                                        const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
                                        setTemplateParams(new Array(matches.length).fill(""));
                                    }
                                }}
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder={t("chooseTemplatePlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.map(tempItem => <SelectItem key={tempItem.name} value={tempItem.name}>{tempItem.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedTemplate && (
                            <div className="space-y-4 pt-2">
                                <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">{t("livePreview")}</label>
                                    <div className="scale-90 origin-top">
                                        <WhatsAppTemplatePreview 
                                            template={selectedTemplate} 
                                            getStatusColor={(s) => 
                                                s === 'APPROVED' ? 'bg-emerald-100 text-[#00B074] border-[#00B074]/30' :
                                                s === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                                                'bg-amber-100 text-amber-700 border-amber-200'
                                            }
                                            testValues={templateParams.reduce((acc, val, i) => ({ ...acc, [i+1]: val }), {})}
                                        />
                                    </div>
                                </div>

                                {templateParams.length > 0 && (
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-[#00B074] uppercase">{t("variableMapping")}</label>
                                        <div className="grid gap-2">
                                            {templateParams.map((val, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400">{t("parameterLabel")} {"{{"}{idx+1}{"}}"}</label>
                                                    <Input 
                                                        placeholder={t("parameterPlaceholder")} 
                                                        value={val} 
                                                        onChange={e => {
                                                            const newParams = [...templateParams];
                                                            newParams[idx] = e.target.value;
                                                            setTemplateParams(newParams);
                                                        }}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                <label className="text-[11px] font-bold text-[#00B074] flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> {t("triggerRule")}
                </label>
                <div className="flex flex-col gap-2.5">
                    <Select 
                        value={formData.condition.type}
                        onValueChange={v => setFormData({...formData, condition: { ...formData.condition, type: v }})}
                    >
                        <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CONDITION_TYPES.map(condType => <SelectItem key={condType.value} value={condType.value}>{t(`conditions.${condType.value}`)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {CONDITION_TYPES.find(ct => ct.value === formData.condition.type)?.hasValue && (
                        <>
                            {formData.condition.type === 'time_of_day' ? (
                                <input 
                                    type="time"
                                    className="w-full h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 outline-none focus:ring-1 focus:ring-[#00B074]"
                                    value={formData.condition.value}
                                    onChange={e => setFormData({...formData, condition: { ...formData.condition, value: e.target.value }})}
                                />
                            ) : formData.condition.type === 'has_tag' ? (
                                <Select 
                                    value={formData.condition.value as string}
                                    onValueChange={v => setFormData({...formData, condition: { ...formData.condition, value: v }})}
                                >
                                    <SelectTrigger className="w-full h-9 text-xs">
                                        <SelectValue placeholder={t("badgeTag") + "..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tags.map(tag => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : ['before_flow_starts', 'after_flow_starts', 'after_flow_ends', 'after_flow', 'after_failed_flow'].includes(formData.condition.type) ? (
                                <Select 
                                    value={formData.condition.value as string}
                                    onValueChange={v => setFormData({...formData, condition: { ...formData.condition, value: v }})}
                                >
                                    <SelectTrigger className="w-full h-9 text-xs">
                                        <SelectValue placeholder={t("conditions.before_flow_starts").split(' ')[0] + "..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : formData.condition.type === 'day_type' ? (
                                <select 
                                    className="w-full h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 outline-none focus:ring-1 focus:ring-[#00B074]"
                                    value={formData.condition.value}
                                    onChange={e => setFormData({...formData, condition: { ...formData.condition, value: e.target.value }})}
                                >
                                    <option value="">Select Type</option>
                                    <option value="weekday">Weekday</option>
                                    <option value="weekend">Weekend</option>
                                </select>
                            ) : formData.condition.type === 'time_range' ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="time"
                                        className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                        value={formData.condition.value.split(',')[0] || ''}
                                        onChange={e => {
                                            const parts = formData.condition.value.split(',');
                                            setFormData({...formData, condition: { ...formData.condition, value: `${e.target.value},${parts[1] || ''}` }});
                                        }}
                                    />
                                    <span className="text-xs text-gray-400">-</span>
                                    <input 
                                        type="time"
                                        className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                        value={formData.condition.value.split(',')[1] || ''}
                                        onChange={e => {
                                            const parts = formData.condition.value.split(',');
                                            setFormData({...formData, condition: { ...formData.condition, value: `${parts[0] || ''},${e.target.value}` }});
                                        }}
                                    />
                                </div>
                            ) : formData.condition.type === 'date_range' ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date"
                                        className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                        value={formData.condition.value.split(',')[0] || ''}
                                        onChange={e => {
                                            const parts = formData.condition.value.split(',');
                                            setFormData({...formData, condition: { ...formData.condition, value: `${e.target.value},${parts[1] || ''}` }});
                                        }}
                                    />
                                    <span className="text-xs text-gray-400">-</span>
                                    <input 
                                        type="date"
                                        className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                        value={formData.condition.value.split(',')[1] || ''}
                                        onChange={e => {
                                            const parts = formData.condition.value.split(',');
                                            setFormData({...formData, condition: { ...formData.condition, value: `${parts[0] || ''},${e.target.value}` }});
                                        }}
                                    />
                                </div>
                            ) : formData.condition.type === 'date_time_range' ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="date"
                                            className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                            value={formData.condition.value.split(',')[0] || ''}
                                            onChange={e => {
                                                const parts = formData.condition.value.split(',');
                                                setFormData({...formData, condition: { ...formData.condition, value: `${e.target.value},${parts[1] || ''},${parts[2] || ''},${parts[3] || ''}` }});
                                            }}
                                        />
                                        <span className="text-xs text-gray-400">-</span>
                                        <input 
                                            type="date"
                                            className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                            value={formData.condition.value.split(',')[1] || ''}
                                            onChange={e => {
                                                const parts = formData.condition.value.split(',');
                                                setFormData({...formData, condition: { ...formData.condition, value: `${parts[0] || ''},${e.target.value},${parts[2] || ''},${parts[3] || ''}` }});
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="time"
                                            className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                            value={formData.condition.value.split(',')[2] || ''}
                                            onChange={e => {
                                                const parts = formData.condition.value.split(',');
                                                setFormData({...formData, condition: { ...formData.condition, value: `${parts[0] || ''},${parts[1] || ''},${e.target.value},${parts[3] || ''}` }});
                                            }}
                                        />
                                        <span className="text-xs text-gray-400">-</span>
                                        <input 
                                            type="time"
                                            className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2 outline-none focus:ring-1 focus:ring-[#00B074]"
                                            value={formData.condition.value.split(',')[3] || ''}
                                            onChange={e => {
                                                const parts = formData.condition.value.split(',');
                                                setFormData({...formData, condition: { ...formData.condition, value: `${parts[0] || ''},${parts[1] || ''},${parts[2] || ''},${e.target.value}` }});
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : ['keyword', 'user_sends_message'].includes(formData.condition.type) ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            className="flex-1 h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 outline-none focus:ring-1 focus:ring-[#00B074]"
                                            placeholder="Type keyword and press Enter or Add..."
                                            value={keywordInput}
                                            onChange={e => setKeywordInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ',') {
                                                    e.preventDefault();
                                                    const newKw = keywordInput.trim().replace(/,/g, '');
                                                    if (newKw) {
                                                        const existing = formData.condition.value 
                                                            ? formData.condition.value.split(',').map(s => s.trim()).filter(Boolean)
                                                            : [];
                                                        if (!existing.includes(newKw)) {
                                                            const updated = [...existing, newKw].join(', ');
                                                            setFormData({ ...formData, condition: { ...formData.condition, value: updated } });
                                                        }
                                                        setKeywordInput('');
                                                    }
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                                const newKw = keywordInput.trim().replace(/,/g, '');
                                                if (newKw) {
                                                    const existing = formData.condition.value 
                                                        ? formData.condition.value.split(',').map(s => s.trim()).filter(Boolean)
                                                        : [];
                                                    if (!existing.includes(newKw)) {
                                                        const updated = [...existing, newKw].join(', ');
                                                        setFormData({ ...formData, condition: { ...formData.condition, value: updated } });
                                                    }
                                                    setKeywordInput('');
                                                }
                                            }}
                                            className="h-9 px-3 text-xs bg-[#00B074] hover:bg-[#009663] text-white font-medium flex items-center gap-1 shrink-0 rounded-md shadow-xs transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add
                                        </Button>
                                    </div>
                                    {formData.condition.value ? (
                                        <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 min-h-[38px] items-center">
                                            {formData.condition.value.split(',').map(s => s.trim()).filter(Boolean).map((kw, kwIdx) => (
                                                <span 
                                                    key={kwIdx}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-[#00B074] border border-[#00B074]/20 dark:bg-emerald-950/50 dark:text-emerald-400"
                                                >
                                                    <span>{kw}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const existing = formData.condition.value.split(',').map(s => s.trim()).filter(Boolean);
                                                            const updated = existing.filter((_, i) => i !== kwIdx).join(', ');
                                                            setFormData({ ...formData, condition: { ...formData.condition, value: updated } });
                                                        }}
                                                        className="text-[#00B074]/70 hover:text-red-500 transition-colors p-0.5 rounded-full"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <input 
                                    className="w-full h-9 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 outline-none focus:ring-1 focus:ring-[#00B074]"
                                    placeholder={t("parameterPlaceholder")}
                                    value={formData.condition.value}
                                    onChange={e => setFormData({...formData, condition: { ...formData.condition, value: e.target.value }})}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>


            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                <label className="text-[11px] font-bold text-blue-600 flex items-center gap-1.5 uppercase tracking-wider">
                    <Plus className="w-3 h-3" /> {t("postTriggerActions")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400">{t("assignTag")}</label>
                        <Select 
                            value={formData.assignTagId} 
                            onValueChange={v => setFormData({ ...formData, assignTagId: v })}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder={t("noTag")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t("noTag")}</SelectItem>
                                {tags.map(tag => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400">{t("assignAgent")}</label>
                        <Select 
                            value={formData.assignAgentId} 
                            onValueChange={v => setFormData({ ...formData, assignAgentId: v })}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder={t("noAgent")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t("noAgent")}</SelectItem>
                                {agents.map(agent => <SelectItem key={agent.id} value={agent.id}>{agent.name || agent.email}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 pt-2 bg-white dark:bg-slate-900 border-t border-gray-50 dark:border-slate-800 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-gray-500 w-full sm:w-auto">{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#00B074] hover:bg-[#009662] text-white font-bold px-8 w-full sm:w-auto">
              {saving ? t("saveSaving") : editTarget ? t("saveUpdate") : t("saveCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaLibraryModal 
        isOpen={isMediaLibraryOpen}
        onClose={() => {
            setIsMediaLibraryOpen(false);
            setActiveMediaIndex(null);
        }}
        onSelect={(url) => {
            if (activeMediaIndex !== null) {
                const newSeq = [...sequenceItems];
                newSeq[activeMediaIndex].mediaUrl = url;
                setSequenceItems(newSeq);
            } else {
                setFormData({ ...formData, mediaUrl: url });
            }
        }}
        contentType={activeMediaIndex !== null ? (sequenceItems[activeMediaIndex]?.type?.toLowerCase() as any) : (formData.mediaType?.toLowerCase() as any)}
      />
      </div>
    </div>
  );
};
