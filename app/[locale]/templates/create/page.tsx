"use client";

import { useState, useRef, useMemo } from "react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Loader2,
  ArrowLeft,
  Trash2,
  Link2,
  Phone,
  Bold,
  Italic,
  Strikethrough,
  Code,
  User,
  Hash,
  Wand2,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"

import { WhatsAppTemplatePreview, type MessageTemplate, type TemplateComponent } from "@/components/whatsapp/WhatsAppTemplatePreview"
import Link from "next/link"
import { MediaLibraryModal } from "@/components/flows/modals/media-library-modal"
import { useUserStatus } from "@/hooks/useUserStatus"
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay"
import { Smartphone } from "lucide-react"

export default function CreateTemplatePage() {
  const { whatsappConnected, whatsappConnectionMethod } = useUserStatus();
  const isQr = whatsappConnectionMethod === "qr";
  const t = useTranslations('TemplatesPage');
  const locale = useLocale();
  const router = useRouter();
  const isRTL = ['ur', 'ar'].includes(locale);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [templateType, setTemplateType] = useState("STANDARD");
  const [headerType, setHeaderType] = useState<"TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO">("TEXT");
  const [headerText, setHeaderText] = useState("");
  const [headerFileUrl, setHeaderFileUrl] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [actionType, setActionType] = useState("NONE");
  const [buttons, setButtons] = useState<Array<{
    type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY";
    text: string;
    url?: string;
    phone_number?: string;
  }>>([]);

  // Carousel State
  const [carouselCards, setCarouselCards] = useState<Array<{
    id: string;
    headerType: "IMAGE" | "VIDEO";
    headerUrl: string;
    body: string;
    buttons: Array<{
      type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY";
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>>([
    { id: "1", headerType: "IMAGE", headerUrl: "", body: "", buttons: [] },
    { id: "2", headerType: "IMAGE", headerUrl: "", body: "", buttons: [] }
  ]);
  const [activeCardId, setActiveCardId] = useState("1");

  interface TemplateVariable {
    key: string;
    raw: string;
    type: "NAME" | "NUMBER";
    displayName: string;
    placeholder: string;
    defaultVal: string;
  }

  const detectedVariables = useMemo(() => {
    const textToScan = `${headerType === 'TEXT' ? headerText : ''} ${body}`;
    const regex = /\{\{\s*([a-zA-Z0-9_]*)\s*\}\}|\{\s*\}\}|\{\s*([a-zA-Z0-9_]*)\s*\}/g;
    const list: TemplateVariable[] = [];
    let match: RegExpExecArray | null;
    let nameCount = 0;

    while ((match = regex.exec(textToScan)) !== null) {
      const raw = match[0];
      const val = (match[1] ?? match[2] ?? "").trim();
      const isNum = /^\d+$/.test(val);

      if (isNum) {
        const numStr = val;
        if (!list.some(v => v.key === numStr)) {
          list.push({
            key: numStr,
            raw,
            type: "NUMBER",
            displayName: `{{${numStr}}} Number`,
            placeholder: numStr === "1" ? "e.g. 1001" : numStr === "2" ? "e.g. 500" : `Sample value for {{${numStr}}}`,
            defaultVal: numStr === "1" ? "1001" : `${Number(numStr) * 100}`,
          });
        }
      } else {
        nameCount++;
        const key = val && val !== "name" ? val : (nameCount === 1 ? "name" : `name_${nameCount}`);
        if (!list.some(v => v.key === key)) {
          list.push({
            key,
            raw,
            type: "NAME",
            displayName: nameCount === 1 ? `{{}} Name` : `{{}} Name ${nameCount}`,
            placeholder: "e.g. John (Customer Name)",
            defaultVal: "John",
          });
        }
      }
    }

    return list;
  }, [body, headerText, headerType]);

  const hasEmptyVariables = useMemo(() => {
    const textToScan = `${headerType === 'TEXT' ? headerText : ''} ${body}`;
    return /\{\{\s*\}\}|\{\s*\}\}|\{\s*\}/.test(textToScan);
  }, [body, headerText, headerType]);

  const autoFixEmptyVariables = () => {
    let nextIndex = 1;
    const existingMatches = `${headerType === 'TEXT' ? headerText : ''} ${body}`.match(/\{\{(\d+)\}\}/g);
    if (existingMatches) {
      const numbers = existingMatches.map(m => parseInt(m.replace(/[^\d]/g, ''), 10));
      nextIndex = Math.max(...numbers, 0) + 1;
    }

    const updatedSampleValues = { ...sampleValues };

    const newBody = body.replace(/\{\{\s*\}\}|\{\s*\}\}|\{\s*\}/g, () => {
      const currentIdx = nextIndex++;
      if (!updatedSampleValues[currentIdx.toString()]) {
        updatedSampleValues[currentIdx.toString()] = updatedSampleValues["name"] || (currentIdx === 1 ? "John" : `Sample ${currentIdx}`);
      }
      return `{{${currentIdx}}}`;
    });

    setBody(newBody);
    setSampleValues(updatedSampleValues);
    toast.success("All empty variables {{}} numbered successfully!");
  };

  const applyFormatting = (prefix: string, suffix: string, defaultPlaceholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const textToInsert = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${defaultPlaceholder}${suffix}`;
    const newBody = body.substring(0, start) + textToInsert + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start, start + textToInsert.length);
      } else {
        const cursorStart = start + prefix.length;
        const cursorEnd = cursorStart + defaultPlaceholder.length;
        textarea.setSelectionRange(cursorStart, cursorEnd);
      }
    }, 0);
  };

  const handleCreate = async () => {
    if (!name || !body) return;

    // Automatically format all variables into sequential {{1}}, {{2}}... and prepare valid samples for Meta review
    let nextIndex = 1;
    let nameVarIdx = 0;
    const finalSamples: Record<string, string> = {};
    const finalBody = body.replace(
      /\{\{\s*([a-zA-Z0-9_]*)\s*\}\}|\{\s*\}\}|\{\s*([a-zA-Z0-9_]*)\s*\}/g,
      (match, p1, p2) => {
        const currentIdx = nextIndex++;
        const val = (p1 ?? p2 ?? "").trim();
        const isNum = /^\d+$/.test(val);

        let sampleVal = "";
        if (isNum) {
          sampleVal = sampleValues[val] || sampleValues[currentIdx.toString()] || `${currentIdx * 1000}`;
        } else {
          nameVarIdx++;
          const nameKey = nameVarIdx === 1 ? "name" : `name_${nameVarIdx}`;
          sampleVal = sampleValues[nameKey] || sampleValues[val] || sampleValues["name"] || "John";
        }

        finalSamples[currentIdx.toString()] = sampleVal;
        return `{{${currentIdx}}}`;
      }
    );

    // Meta Rule: Variables cannot be at the start or end of template body (subcode 2388299)
    let sanitizedFinalBody = finalBody.trim();
    if (/\{\{\d+\}\}(\*|_|~)?$/.test(sanitizedFinalBody)) {
      sanitizedFinalBody = `${sanitizedFinalBody}.`;
    }
    if (/^(\*|_|~)?\{\{\d+\}\}/.test(sanitizedFinalBody)) {
      sanitizedFinalBody = `Hi ${sanitizedFinalBody}`;
    }

    setIsCreating(true);
    const toastId = toast.loading("Submitting template for review...");

    try {
      let headerParam = undefined;
      let cardsParam = undefined;
      
      if (templateType === "MEDIA") {
        if (headerType === "TEXT" && headerText) {
          headerParam = { type: "TEXT" as const, text: headerText };
        } else if (headerType !== "TEXT" && headerFileUrl) {
          headerParam = { type: headerType as "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO", handle: headerFileUrl };
        }
      } else if (templateType === "CAROUSEL") {
        cardsParam = carouselCards;
      }

      const result = await createMessageTemplate(name, category, language, sanitizedFinalBody, buttons, footer, headerParam, cardsParam, finalSamples);

      if (!result.success) {
        toast.error(result.error || "Failed to submit template", { id: toastId });
        return;
      }

      toast.success("Template submitted successfully!", { id: toastId });

      router.push(`/${locale}/templates`);
      router.refresh();

    } catch (error) {
      toast.error((error as Error).message, { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddVariable = (type: "NAME" | "NUMBER") => {
    let variableText = "";
    let sampleKey = "";
    let sampleVal = "";

    if (type === "NAME") {
      variableText = "{{}}";
      sampleKey = "name";
      sampleVal = "John";
    } else {
      const textToScan = `${headerType === 'TEXT' ? headerText : ''} ${body}`;
      const matches = textToScan.match(/\{\{(\d+)\}\}/g);
      let nextIndex = 1;
      if (matches) {
        const numbers = matches.map(m => parseInt(m.replace(/[^\d]/g, ''), 10));
        nextIndex = Math.max(...numbers) + 1;
      }
      variableText = `{{${nextIndex}}}`;
      sampleKey = nextIndex.toString();
      sampleVal = nextIndex === 1 ? "1001" : `${nextIndex * 500}`;
    }

    setSampleValues(prev => ({
      ...prev,
      [sampleKey]: prev[sampleKey] || sampleVal
    }));

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.substring(0, start) + variableText + body.substring(end);
      setBody(newBody);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableText.length, start + variableText.length);
      }, 0);
    } else {
      setBody(body + variableText);
    }
  };

  const getQuickRepliesCount = () => buttons.filter(b => b.type === 'QUICK_REPLY').length;
  const getUrlCount = () => buttons.filter(b => b.type === 'URL').length;
  const getPhoneCount = () => buttons.filter(b => b.type === 'PHONE_NUMBER').length;

  const handleAddButton = (type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER") => {
    if (type === 'QUICK_REPLY' && getQuickRepliesCount() >= 10) return;
    if (type === 'URL' && getUrlCount() >= 2) return;
    if (type === 'PHONE_NUMBER' && getPhoneCount() >= 1) return;

    setButtons([...buttons, { type, text: "" }]);
  };

  const handleActionTypeChange = (val: string) => {
    setActionType(val);
    if (val === "NONE") setButtons([]);
    else if (val === "CALL_TO_ACTIONS") setButtons(buttons.filter(b => b.type !== 'QUICK_REPLY'));
    else if (val === "QUICK_REPLIES") setButtons(buttons.filter(b => b.type === 'QUICK_REPLY'));
  };

  return (
    <DashboardLayoutClient mainClassName="h-full overflow-y-auto bg-white antialiased transition-colors duration-300 plus-jakarta-forced">
      {isQr ? (
        <LockedPageOverlay
          title="Templates Restricted for QR Connections"
          description="You are connected via WhatsApp QR Code. QR mode allows sending direct, free-form messages, media, and broadcasts instantly without needing Meta-approved message templates."
          icon={<Smartphone className="w-10 h-10 text-[#00B074]" />}
        >
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link href={`/${locale}/live-chat`} className="flex-1">
              <Button className="w-full h-12 bg-[#00B074] hover:bg-[#064a42] text-white font-bold rounded-2xl shadow-lg shadow-[#00B074]/20 transition-all">
                Go to Live Chat
              </Button>
            </Link>
            <Link href={`/${locale}/campaign`} className="flex-1">
              <Button variant="outline" className="w-full h-12 rounded-2xl border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                QR Broadcast
              </Button>
            </Link>
          </div>
        </LockedPageOverlay>
      ) : (!whatsappConnected && (
        <LockedPageOverlay
          title="Templates Hub Restricted"
          description="Message templates must be synced from your Meta Business Suite. Connect your WhatsApp Account to manage, create, and submit templates for approval."
          icon={<Smartphone className="w-10 h-10" />}
          ctaText="Connect via Meta"
        />
      ))}
      <div className="w-full plus-jakarta-forced">
        <div className="flex items-center gap-3 border-b border-gray-100 py-4 px-6 md:px-12 bg-white">
          <Link href={`/${locale}/templates`}>
            <button className="text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </Link>
          <h2 className="text-[15px] font-semibold text-gray-800 tracking-tight">
            New Template Message
          </h2>
        </div>

        <div className="max-w-[1400px] mx-auto p-6 md:p-12">
          <div className="flex flex-col lg:flex-row gap-16">

            <div className="flex-1 space-y-8">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[13px] font-semibold text-slate-800 block">Template Category</label>
                  <span className="text-[11px] text-slate-500 block mb-2 font-medium">Your template should fall under one of these categories.</span>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-[42px] bg-white border border-slate-200 rounded-md px-3 text-[13px] font-medium text-slate-700 shadow-sm focus:ring-1 focus:ring-[#00B074] focus:border-[#00B074]">
                      <SelectValue placeholder="Select message categories" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md bg-white border-slate-200 plus-jakarta-forced">
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-semibold text-slate-800 block">Template Language</label>
                  <span className="text-[11px] text-slate-500 block mb-2 font-medium">The language in which message template is submitted.</span>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-[42px] bg-white border border-slate-200 rounded-md px-3 text-[13px] font-medium text-slate-700 shadow-sm focus:ring-1 focus:ring-[#00B074] focus:border-[#00B074]">
                      <SelectValue placeholder="Select message language" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md bg-white border-slate-200 plus-jakarta-forced max-h-60">
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="en_GB">English (UK)</SelectItem>
                      <SelectItem value="es_ES">Spanish (Spain)</SelectItem>
                      <SelectItem value="es_MX">Spanish (Mexico)</SelectItem>
                      <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                      <SelectItem value="pt_PT">Portuguese (PT)</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="ru">Russian</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                      <SelectItem value="ur">Urdu</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="id">Indonesian</SelectItem>
                      <SelectItem value="tr">Turkish</SelectItem>
                      <SelectItem value="pl">Polish</SelectItem>
                      <SelectItem value="vi">Vietnamese</SelectItem>
                      <SelectItem value="th">Thai</SelectItem>
                      <SelectItem value="zh_CN">Chinese (Simplified)</SelectItem>
                      <SelectItem value="zh_TW">Chinese (Traditional)</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Template Name */}
              <div className="space-y-1">
                <label className="text-[13px] font-semibold text-slate-800 block">Template Name</label>
                <span className="text-[11px] text-slate-500 block mb-2 font-medium">Name can only be in lowercase alphanumeric characters and underscores. Special characters and white-space are not allowed<br />e.g - app_verification_code</span>
                <Input
                  placeholder="Enter name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="h-[42px] bg-white border border-slate-200 rounded-md px-3 text-[13px] font-medium text-slate-700 shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074]"
                />
              </div>

              {/* Template Type */}
              <div className="space-y-1">
                <label className="text-[13px] font-semibold text-slate-800 block">Template Type</label>
                <span className="text-[11px] text-slate-500 block mb-2 font-medium">Your template type should fall under one of these categories.</span>
                <Select value={templateType} onValueChange={(val) => {
                  setTemplateType(val);
                  if (val === "MEDIA" && !headerType) {
                    setHeaderType("TEXT");
                  }
                }}>
                  <SelectTrigger className="h-[42px] bg-white border border-slate-200 rounded-md px-3 text-[13px] font-medium text-slate-700 shadow-sm focus:ring-1 focus:ring-[#00B074] focus:border-[#00B074]">
                    <SelectValue placeholder="Select message type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-md bg-white border-slate-200 plus-jakarta-forced">
                    <SelectItem value="STANDARD">Standard (Text Only)</SelectItem>
                    <SelectItem value="MEDIA">Media / Header Option</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Media/Header Settings */}
              {templateType === "MEDIA" && (
                <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                  <div className="space-y-1">
                    <label className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 block">Header Type</label>
                    <Select value={headerType} onValueChange={(val: any) => setHeaderType(val)}>
                      <SelectTrigger className="h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-[13px] font-medium text-slate-700 dark:text-slate-350 shadow-sm focus:ring-1 focus:ring-[#00B074] focus:border-[#00B074]">
                        <SelectValue placeholder="Select header type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 plus-jakarta-forced">
                        <SelectItem value="TEXT">Text Header</SelectItem>
                        <SelectItem value="IMAGE">Image Header</SelectItem>
                        <SelectItem value="VIDEO">Video Header</SelectItem>
                        <SelectItem value="DOCUMENT">Document Header</SelectItem>
                        <SelectItem value="AUDIO">Audio Header</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {headerType === "TEXT" && (
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <label className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 block">Header Text</label>
                      <Input
                        placeholder="Enter header text (e.g. Welcome)"
                        value={headerText}
                        maxLength={60}
                        onChange={(e) => setHeaderText(e.target.value)}
                        className="h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-[13px] font-medium text-slate-700 dark:text-slate-350 shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074]"
                      />
                    </div>
                  )}

                  {headerType !== "TEXT" && (
                    <div className="space-y-1 animate-in fade-in duration-300">
                      <label className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 block">
                        Header {headerType === "IMAGE" ? "Image" : headerType === "VIDEO" ? "Video" : headerType === "AUDIO" ? "Audio" : "Document"} URL
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Enter public ${headerType.toLowerCase()} URL`}
                          value={headerFileUrl}
                          onChange={(e) => setHeaderFileUrl(e.target.value)}
                          className="h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-[13px] font-medium text-slate-700 dark:text-slate-350 shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074] flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsMediaLibraryOpen(true)}
                          className="h-[42px] px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4 text-slate-400" />
                          Library
                        </Button>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium mt-1">
                        {headerType === "IMAGE" && "Please provide a direct link to an image file (JPEG or PNG)."}
                        {headerType === "VIDEO" && "Please provide a direct link to a video file (MP4)."}
                        {headerType === "AUDIO" && "Please provide a direct link to an audio file (MP3, OGG)."}
                        {headerType === "DOCUMENT" && "Please provide a direct link to a document file (PDF)."}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Carousel Settings */}
              {templateType === "CAROUSEL" && (
                <div className="space-y-4 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/20">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Carousel Cards ({carouselCards.length}/10)</label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (carouselCards.length < 10) {
                          const newId = Date.now().toString();
                          setCarouselCards([...carouselCards, { id: newId, headerType: "IMAGE", headerUrl: "", body: "", buttons: [] }]);
                          setActiveCardId(newId);
                        }
                      }}
                      disabled={carouselCards.length >= 10}
                      className="h-7 text-[12px]"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Card
                    </Button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                    {carouselCards.map((card, idx) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setActiveCardId(card.id)}
                        className={`px-3 py-1.5 text-[12px] font-semibold rounded-md border whitespace-nowrap transition-colors ${
                          activeCardId === card.id 
                            ? 'bg-[#00B074] text-white border-[#00B074]' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        Card {idx + 1}
                      </button>
                    ))}
                  </div>

                  {carouselCards.map((card, idx) => {
                    if (card.id !== activeCardId) return null;
                    return (
                      <div key={card.id} className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Editing Card {idx + 1}</h4>
                          {carouselCards.length > 2 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7"
                              onClick={() => {
                                const newCards = carouselCards.filter(c => c.id !== card.id);
                                setCarouselCards(newCards);
                                setActiveCardId(newCards[0].id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Card
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 block">Header Media Type</label>
                          <Select 
                            value={card.headerType} 
                            onValueChange={(val: any) => {
                              setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, headerType: val } : c));
                            }}
                          >
                            <SelectTrigger className="h-[38px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-[12px] font-medium text-slate-700 dark:text-slate-350 shadow-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                              <SelectItem value="IMAGE">Image</SelectItem>
                              <SelectItem value="VIDEO">Video</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 block">
                            {card.headerType === "IMAGE" ? "Image" : "Video"} URL
                          </label>
                          <div className="flex gap-2">
                            <Input
                              placeholder={`Enter public ${card.headerType.toLowerCase()} URL`}
                              value={card.headerUrl}
                              onChange={(e) => {
                                setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, headerUrl: e.target.value } : c));
                              }}
                              className="h-[38px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-[12px] font-medium flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsMediaLibraryOpen(true)}
                              className="h-[38px] px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[12px] font-semibold text-slate-700"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Library
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 block">Card Body Text</label>
                          <div className="relative">
                            <Textarea
                              placeholder="Enter message for this card..."
                              value={card.body}
                              maxLength={160}
                              onChange={(e) => {
                                setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, body: e.target.value } : c));
                              }}
                              className="min-h-[80px] bg-white border border-slate-200 rounded-md p-3 pb-8 text-[12px] font-medium resize-none"
                            />
                            <div className="absolute bottom-2 right-3 text-[10px] text-slate-400 font-medium">{card.body.length}/160</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                           <div className="flex justify-between items-center">
                             <label className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">Card Buttons</label>
                             <div className="flex gap-1">
                               <Button 
                                 type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                 disabled={card.buttons.length >= 2}
                                 onClick={() => {
                                   setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: [...c.buttons, { type: "URL", text: "", url: "" }] } : c));
                                 }}
                               >+ URL</Button>
                               <Button 
                                 type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                 disabled={card.buttons.length >= 2}
                                 onClick={() => {
                                   setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: [...c.buttons, { type: "PHONE_NUMBER", text: "", phone_number: "" }] } : c));
                                 }}
                               >+ Phone</Button>
                               <Button 
                                 type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                 disabled={card.buttons.length >= 2}
                                 onClick={() => {
                                   setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: [...c.buttons, { type: "QUICK_REPLY", text: "" }] } : c));
                                 }}
                               >+ Quick Reply</Button>
                             </div>
                           </div>
                           
                           {card.buttons.map((btn, btnIdx) => (
                             <div key={btnIdx} className="flex gap-2 items-start bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                               <div className="flex-1 space-y-2">
                                 <Input 
                                   placeholder="Button Text" 
                                   className="h-7 text-[11px]" 
                                   value={btn.text}
                                   onChange={(e) => {
                                     const newBtns = [...card.buttons];
                                     newBtns[btnIdx].text = e.target.value;
                                     setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: newBtns } : c));
                                   }}
                                 />
                                 {btn.type === "URL" && (
                                   <Input 
                                     placeholder="URL (e.g. https://example.com)" 
                                     className="h-7 text-[11px]" 
                                     value={btn.url || ""}
                                     onChange={(e) => {
                                       const newBtns = [...card.buttons];
                                       newBtns[btnIdx].url = e.target.value;
                                       setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: newBtns } : c));
                                     }}
                                   />
                                 )}
                                 {btn.type === "PHONE_NUMBER" && (
                                   <Input 
                                     placeholder="Phone (e.g. +1234567890)" 
                                     className="h-7 text-[11px]" 
                                     value={btn.phone_number || ""}
                                     onChange={(e) => {
                                       const newBtns = [...card.buttons];
                                       newBtns[btnIdx].phone_number = e.target.value;
                                       setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: newBtns } : c));
                                     }}
                                   />
                                 )}
                               </div>
                               <Button 
                                 type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                 onClick={() => {
                                   const newBtns = card.buttons.filter((_, i) => i !== btnIdx);
                                   setCarouselCards(cards => cards.map(c => c.id === card.id ? { ...c, buttons: newBtns } : c));
                                 }}
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </Button>
                             </div>
                           ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Template Format */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-semibold text-slate-800 block">Template Format</label>
                  <span className="text-[10px] text-slate-400 font-medium">Upto 1024 characters</span>
                </div>
                <span className="text-[11px] text-slate-500 block mb-2 font-medium">
                  Format text using <b>*bold*</b>, <i>_italic_</i>, <s>~strikethrough~</s> & <code>```code```</code>. Use variables like {'{{1}}'}, {'{{2}}'}.
                </span>

                {/* Formatting & Variable Toolbar */}
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm focus-within:ring-1 focus-within:ring-[#00B074] focus-within:border-[#00B074]">
                  <div className="flex flex-wrap items-center justify-between bg-slate-50 border-b border-slate-200 px-2 py-1.5 gap-1">
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Bold (*bold*)"
                        onClick={() => applyFormatting("*", "*", "bold text")}
                        className="h-7 w-7 p-0 text-slate-700 font-bold hover:bg-slate-200/70"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Italic (_italic_)"
                        onClick={() => applyFormatting("_", "_", "italic text")}
                        className="h-7 w-7 p-0 text-slate-700 italic hover:bg-slate-200/70"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Strikethrough (~strikethrough~)"
                        onClick={() => applyFormatting("~", "~", "strikethrough text")}
                        className="h-7 w-7 p-0 text-slate-700 line-through hover:bg-slate-200/70"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Monospace (```code```)"
                        onClick={() => applyFormatting("```", "```", "code text")}
                        className="h-7 w-7 p-0 text-slate-700 hover:bg-slate-200/70"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </Button>

                      <div className="h-4 w-[1px] bg-slate-300 mx-1" />

                      {/* Add Variable Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 rounded shadow-xs hover:bg-slate-50"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#00B074]" />
                            Add Variable
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 plus-jakarta-forced bg-white border-slate-200 rounded-md shadow-lg p-1">
                          <DropdownMenuItem onClick={() => handleAddVariable("NAME")} className="text-[12px] font-medium cursor-pointer flex flex-col items-start py-2 hover:bg-slate-50 rounded">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-[#00B074]" /> Name
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Inserts name variable {'{{}}'} with sample text</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddVariable("NUMBER")} className="text-[12px] font-medium cursor-pointer flex flex-col items-start py-2 border-t border-slate-100 hover:bg-slate-50 rounded">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Hash className="w-3.5 h-3.5 text-[#00B074]" /> Number
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Inserts sequential number {'{{1}}'}, {'{{2}}'}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <Textarea
                    ref={textareaRef}
                    placeholder="Enter your message in here... Use *bold*, _italic_, ~strike~ or insert variables."
                    value={body}
                    maxLength={1024}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-[130px] border-0 rounded-none p-3 pb-8 text-[13px] font-medium text-slate-700 shadow-none focus-visible:ring-0 resize-none"
                  />
                  <div className="flex justify-between items-center px-3 py-1.5 bg-slate-50/50 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                    <span>Variables: Name {'{{}}'} or Number {'{{1}}'}, {'{{2}}'}</span>
                    <span>{body.length}/1024</span>
                  </div>
                </div>

                {detectedVariables.length > 0 && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>Variable Sample Values</span>
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Required by Meta</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Updates preview in real-time</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">Provide realistic sample values so Meta can approve your template and you can preview it accurately.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {detectedVariables.map((v) => (
                        <div key={v.key} className="flex items-center gap-2 bg-white p-1.5 rounded border border-slate-200 shadow-xs">
                          <span className="text-[11px] font-mono font-bold text-[#00B074] bg-emerald-50 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1 shrink-0">
                            {v.type === "NAME" ? <User className="w-3 h-3 text-[#00B074]" /> : <Hash className="w-3 h-3 text-[#00B074]" />}
                            {v.displayName}
                          </span>
                          <Input
                            placeholder={v.placeholder}
                            value={sampleValues[v.key] ?? ""}
                            onChange={(e) => setSampleValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                            className="h-8 text-[12px] border-slate-200 focus-visible:ring-[#00B074] flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Template Footer */}
              <div className="space-y-1">
                <label className="text-[13px] font-semibold text-slate-800 block">Template Footer (Optional)</label>
                <span className="text-[11px] text-slate-500 block mb-2 font-medium">Your message content. Upto 60 characters are allowed.</span>
                <Input
                  placeholder="Enter footer text here"
                  value={footer}
                  maxLength={60}
                  onChange={(e) => setFooter(e.target.value)}
                  className="h-[42px] bg-white border border-slate-200 rounded-md px-3 text-[13px] font-medium text-slate-700 shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074]"
                />
              </div>

              {/* Interactive Actions */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[13px] font-semibold text-slate-800 block">Interactive Actions</label>
                  <span className="text-[11px] text-slate-500 block mb-2 font-medium">In addition to your message, you can send actions with your message.<br />Maximum 25 characters are allowed in CTA button title & Quick Replies.</span>
                </div>

                <RadioGroup value={actionType} onValueChange={handleActionTypeChange} className="flex items-center gap-6 mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NONE" id="r-none" className="w-4 h-4 text-[#004f46] border-slate-300 focus:ring-[#004f46]" />
                    <Label htmlFor="r-none" className="text-[13px] font-semibold cursor-pointer">None</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CALL_TO_ACTIONS" id="r-cta" className="w-4 h-4 text-[#004f46] border-slate-300 focus:ring-[#004f46]" />
                    <Label htmlFor="r-cta" className="text-[13px] font-semibold cursor-pointer">Call to Actions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="QUICK_REPLIES" id="r-qr" className="w-4 h-4 text-[#004f46] border-slate-300 focus:ring-[#004f46]" />
                    <Label htmlFor="r-qr" className="text-[13px] font-semibold cursor-pointer">Quick Replies</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ALL" id="r-all" className="w-4 h-4 text-[#004f46] border-slate-300 focus:ring-[#004f46]" />
                    <Label htmlFor="r-all" className="text-[13px] font-semibold cursor-pointer">All</Label>
                  </div>
                </RadioGroup>

                {actionType !== 'NONE' && (
                  <div className="flex flex-wrap gap-3 pt-3">
                    {(actionType === 'ALL' || actionType === 'QUICK_REPLIES') && (
                      <button
                        type="button"
                        onClick={() => handleAddButton('QUICK_REPLY')}
                        disabled={getQuickRepliesCount() >= 10}
                        className="h-[34px] px-3 rounded-md border border-gray-300 text-[12px] font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-400" /> Quick Replies <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-[10px]">{getQuickRepliesCount()}/10</span>
                      </button>
                    )}
                    {(actionType === 'ALL' || actionType === 'CALL_TO_ACTIONS') && (
                      <button
                        type="button"
                        onClick={() => handleAddButton('URL')}
                        disabled={getUrlCount() >= 2}
                        className="h-[34px] px-3 rounded-md border border-gray-300 text-[12px] font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-400" /> URL <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-[10px]">{getUrlCount()}/2</span>
                      </button>
                    )}
                    {(actionType === 'ALL' || actionType === 'CALL_TO_ACTIONS') && (
                      <button
                        type="button"
                        onClick={() => handleAddButton('PHONE_NUMBER')}
                        disabled={getPhoneCount() >= 1}
                        className="h-[34px] px-3 rounded-md border border-gray-300 text-[12px] font-semibold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-400" /> Phone Number <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-[10px]">{getPhoneCount()}/1</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Added Buttons Fields */}
                {buttons.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-gray-100 mt-4">
                    {buttons.map((btn, idx) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-md p-4 relative flex gap-4 items-start shadow-sm">
                        <button
                          type="button"
                          onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                          className="absolute right-3 top-3 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="w-32 pt-2 flex items-center gap-2 text-slate-500 font-semibold text-[12px]">
                          {btn.type === 'URL' && <Link2 className="w-4 h-4" />}
                          {btn.type === 'PHONE_NUMBER' && <Phone className="w-4 h-4" />}
                          {btn.type === 'QUICK_REPLY' && <ArrowLeft className="w-4 h-4 rotate-180" />}
                          {btn.type.replace('_', ' ')}
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-gray-500">Button Label</label>
                            <Input
                              placeholder="e.g. Confirm"
                              value={btn.text}
                              maxLength={25}
                              onChange={(e) => {
                                const newButtons = [...buttons];
                                newButtons[idx].text = e.target.value;
                                setButtons(newButtons);
                              }}
                              className="h-[38px] bg-white border border-slate-200 px-3 text-[13px] rounded-md shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074]"
                            />
                          </div>

                          {btn.type === 'URL' && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-gray-500">Website URL</label>
                              <Input
                                placeholder="https://..."
                                value={btn.url || ''}
                                onChange={(e) => {
                                  const newButtons = [...buttons];
                                  newButtons[idx].url = e.target.value;
                                  setButtons(newButtons);
                                }}
                                className="h-[38px] bg-white border border-slate-200 px-3 text-[13px] rounded-md shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074]"
                              />
                            </div>
                          )}

                          {btn.type === 'PHONE_NUMBER' && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-gray-500">Phone Number</label>
                              <Input
                                placeholder="+1234567890"
                                value={btn.phone_number || ''}
                                onChange={(e) => {
                                  const newButtons = [...buttons];
                                  newButtons[idx].phone_number = e.target.value;
                                  setButtons(newButtons);
                                }}
                                className="h-[38px] bg-white border border-slate-200 px-3 text-[13px] rounded-md shadow-sm focus-visible:ring-1 focus-visible:ring-[#00B074] focus-visible:border-[#00B074]"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-8">
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating || !name || !body}
                  className="h-9 px-6 bg-[#004f46] hover:bg-[#003b34] text-white rounded-[4px] font-semibold text-[13px] shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                  Submit
                </Button>
              </div>

            </div>

            {/* Right Column: Preview */}
            <div className="w-full lg:w-[400px]">
              <div className="sticky top-6">
                <label className="text-[13px] font-semibold text-slate-800 block">Template Preview</label>
                <span className="text-[11px] text-slate-500 block mb-6 font-medium">Your template message preview. It will update as you fill in the values in the form.</span>

                <div className="scale-100 origin-top">
                  <WhatsAppTemplatePreview
                    template={{
                      name: name || "template_preview",
                      language: language,
                      category: category,
                      status: "PREVIEW",
                      components: [
                        ...(templateType === "MEDIA" && headerType === "TEXT" && headerText
                          ? [{ type: "HEADER" as const, format: "TEXT" as const, text: headerText }]
                          : []
                        ),
                        ...(templateType === "MEDIA" && headerType !== "TEXT" && headerFileUrl
                          ? [{ type: "HEADER" as const, format: headerType as "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO", example: { header_handle: [headerFileUrl] } }]
                          : []
                        ),
                        { type: "BODY", text: body || "Your message content will appear here..." },
                        ...(footer ? [{ type: "FOOTER" as const, text: footer }] : []),
                        ...(buttons.length > 0 ? [{ type: "BUTTONS" as const, buttons: buttons }] : []),
                        ...(templateType === "CAROUSEL" && carouselCards.length > 0
                          ? [{
                              type: "CAROUSEL" as const,
                              cards: carouselCards.map(c => ({
                                components: [
                                  ...(c.headerUrl ? [{
                                    type: "HEADER" as const,
                                    format: c.headerType,
                                    example: { header_handle: [c.headerUrl] }
                                  }] : []),
                                  { type: "BODY" as const, text: c.body || "Your message content will appear here..." },
                                  ...(c.buttons.length > 0 ? [{ type: "BUTTONS" as const, buttons: c.buttons }] : [])
                                ]
                              }))
                            }]
                          : []
                        )
                      ]
                    }}
                    mediaUrl={headerType !== "TEXT" ? headerFileUrl : undefined}
                    testValues={sampleValues}
                    getStatusColor={() => "bg-blue-500/10 text-blue-600 border-blue-500/20"}
                  />
                </div>

                <p className="text-[10px] text-slate-400 mt-6 text-center leading-relaxed">
                  Disclaimer: This is just a graphical representation of the message that will be delivered. Actual message will consist of media selected and may appear different.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
      <MediaLibraryModal
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        contentType={
          templateType === "CAROUSEL" 
            ? (carouselCards.find(c => c.id === activeCardId)?.headerType === "VIDEO" ? "video" : "image")
            : (headerType === "IMAGE" ? "image" : headerType === "VIDEO" ? "video" : headerType === "AUDIO" ? "audio" : "document")
        }
        onSelect={(url) => {
          if (templateType === "CAROUSEL") {
            setCarouselCards(cards => cards.map(c => c.id === activeCardId ? { ...c, headerUrl: url } : c));
          } else {
            setHeaderFileUrl(url);
          }
          setIsMediaLibraryOpen(false);
        }}
      />
    </DashboardLayoutClient>
  );
}
