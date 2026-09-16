
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Users,
  Paperclip,
  X,
  FileIcon,
  ImageIcon,
  Loader2,
  Link2,
  AlertCircle,
  Check,
  ChevronDown,
  Megaphone,
  QrCode,
  Send,
  Sparkles,
  Droplet,
  Zap,
  Bookmark,
  FlaskConical,
  Eye,
  Plus,
  Library,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useUserStatus } from "@/hooks/useUserStatus";
import { getGroups, createGroup } from "@/app/actions/groups";
import { getTags } from "@/app/actions/tags";
import { getAgents } from "@/app/actions/agents";

import {
  WhatsAppTemplatePreview,
  type MessageTemplate,
} from "@/components/whatsapp/WhatsAppTemplatePreview";
import { MediaLibraryModal } from "@/components/flows/modals/media-library-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMMON_CONTACT_VARIABLES,
  insertVariableAtCursor,
} from "@/lib/messaging/contactVariables";
import { useTranslations, useLocale } from "next-intl";

const isImageUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0];
  if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i)) {
    return true;
  }
  if (url.startsWith('data:image/')) {
    return true;
  }
  if (url.includes('images.unsplash.com') || url.includes('/photo-') || url.includes('/images/') || url.includes('/uploads/image')) {
    return true;
  }
  const filename = url.split('/').pop() || '';
  if (filename.startsWith('photo-') || filename.toLowerCase().includes('image') || filename.toLowerCase().includes('pic')) {
    return true;
  }
  return false;
};

interface ScheduleCampaignFormProps {
  initialData?: {
    id: string;
    content: string;
    scheduledAt: Date;
    mediaUrl?: string | null;
    contactId?: string | null;
    groupId?: string | null;
    templateName?: string | null;
    templateLanguage?: string | null;
    templateParams?: any | null;
    buttons?: { id: string; text: string; url?: string; type?: "reply" | "url" }[] | null;
    platform?: string;
  };
}

interface SelectionContact {
  id: string;
  waId: string;
  name: string | null;
  lastMessageAt: Date | string | null;
  groups: { groupId: string }[];
  tags: { id: string }[];
  assignedUsers: { id: string }[];
  isBlocked: boolean;
}

interface SelectionGroup {
  id: string;
  name: string;
  description?: string | null;
}

interface SelectionTag {
  id: string;
  name: string;
  color: string;
}

interface SelectionAgent {
  id: string;
  name: string | null;
  email: string;
}

import { useRouter } from "next/navigation";

export function ScheduleCampaignForm({
  initialData,
}: ScheduleCampaignFormProps) {
  const router = useRouter();
  const t = useTranslations("CampaignsPage");
  const locale = useLocale();
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr";

  const { whatsappConnected, whatsappConnectionMethod, whatsappNumber } = useUserStatus();
  const isQrConnected = whatsappConnected && whatsappConnectionMethod === "qr";
  const isApiConnected = whatsappConnected && (whatsappConnectionMethod === "embedded_signup" || whatsappConnectionMethod === "manual" || !whatsappConnectionMethod);

  // Category cards states
  const [campaignCategory, setCampaignCategory] = useState<
    "qr_broadcast" | "broadcast" | "drip" | "automation" | "ab"
  >("broadcast");

  // Sync initial category based on active connection mode
  useEffect(() => {
    if (isQrConnected) {
      setCampaignCategory("qr_broadcast");
      setIsTemplateMode(false);
      setPlatform("WHATSAPP");
    } else if (isApiConnected) {
      setCampaignCategory("broadcast");
      setIsTemplateMode(true);
      setPlatform("WHATSAPP");
    }
  }, [isQrConnected, isApiConnected]);

  // Mockup custom states
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");

  // Variant A states
  const [isTemplateModeA, setIsTemplateModeA] = useState(true);
  const [selectedTemplateA, setSelectedTemplateA] = useState<MessageTemplate | null>(null);
  const [templateParamsA, setTemplateParamsA] = useState<string[]>([]);
  const [contentA, setContentA] = useState("");
  const [mediaUrlA, setMediaUrlA] = useState<string | null>(null);
  const [buttonsA, setButtonsA] = useState<{ id: string; text: string; url?: string; type?: "reply" | "url" }[]>([]);
  const [newButtonTextA, setNewButtonTextA] = useState("");
  const [newButtonUrlA, setNewButtonUrlA] = useState("");
  const [newButtonTypeA, setNewButtonTypeA] = useState<"reply" | "url">("reply");
  const [isTemplateDropdownOpenA, setIsTemplateDropdownOpenA] = useState(false);
  const [templateSearchA, setTemplateSearchA] = useState("");
  const [isMediaLibraryOpenA, setIsMediaLibraryOpenA] = useState(false);

  // Variant B states
  const [isTemplateModeB, setIsTemplateModeB] = useState(true);
  const [selectedTemplateB, setSelectedTemplateB] = useState<MessageTemplate | null>(null);
  const [templateParamsB, setTemplateParamsB] = useState<string[]>([]);
  const [contentB, setContentB] = useState("");
  const [mediaUrlB, setMediaUrlB] = useState<string | null>(null);
  const [buttonsB, setButtonsB] = useState<{ id: string; text: string; url?: string; type?: "reply" | "url" }[]>([]);
  const [newButtonTextB, setNewButtonTextB] = useState("");
  const [newButtonUrlB, setNewButtonUrlB] = useState("");
  const [newButtonTypeB, setNewButtonTypeB] = useState<"reply" | "url">("reply");
  const [isTemplateDropdownOpenB, setIsTemplateDropdownOpenB] = useState(false);
  const [templateSearchB, setTemplateSearchB] = useState("");
  const [isMediaLibraryOpenB, setIsMediaLibraryOpenB] = useState(false);
  const [sendNow, setSendNow] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [trackOpens, setTrackOpens] = useState(true);
  const [enableUtm, setEnableUtm] = useState(false);
  const [excludeOptedOut, setExcludeOptedOut] = useState(false);

  // Original underlying functional states
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState("");
  const contentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const contentVarTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [targetType, setTargetType] = useState<"contact" | "multi">("multi");
  const [selectedId, setSelectedId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [multiSelectionMode, setMultiSelectionMode] = useState<
    "individual" | "group" | "tag" | "agent" | "open24" | "recency" | "uploaded"
  >("individual");
  const [platform, setPlatform] = useState("WHATSAPP");

  // Drip Campaign Exclusive States
  const [dripIntervalSeconds, setDripIntervalSeconds] = useState<number>(5);
  const [dripFallbackTemplate, setDripFallbackTemplate] = useState<MessageTemplate | null>(null);
  const [isDripFallbackDropdownOpen, setIsDripFallbackDropdownOpen] = useState<boolean>(false);
  const [dripFallbackPlacement, setDripFallbackPlacement] = useState<"top" | "bottom">("top");

  // QR Broadcast Rate Limiting & Dynamic Gap States
  const [qrMinDelaySeconds, setQrMinDelaySeconds] = useState<number>(() => {
    if (initialData?.templateParams && typeof initialData.templateParams === "object" && !Array.isArray(initialData.templateParams)) {
      return initialData.templateParams.throttleConfig?.messageDelayMinSeconds ?? 5;
    }
    return 5;
  });
  const [qrMaxDelaySeconds, setQrMaxDelaySeconds] = useState<number>(() => {
    if (initialData?.templateParams && typeof initialData.templateParams === "object" && !Array.isArray(initialData.templateParams)) {
      return initialData.templateParams.throttleConfig?.messageDelayMaxSeconds ?? 15;
    }
    return 15;
  });
  const [qrBatchSize, setQrBatchSize] = useState<number>(() => {
    if (initialData?.templateParams && typeof initialData.templateParams === "object" && !Array.isArray(initialData.templateParams)) {
      return initialData.templateParams.throttleConfig?.batchSize ?? 10;
    }
    return 10;
  });
  const [qrBatchBreakSeconds, setQrBatchBreakSeconds] = useState<number>(() => {
    if (initialData?.templateParams && typeof initialData.templateParams === "object" && !Array.isArray(initialData.templateParams)) {
      return initialData.templateParams.throttleConfig?.batchBreakSeconds ?? 60;
    }
    return 60;
  });
  const dripFallbackButtonRef = React.useRef<HTMLButtonElement>(null);
  const [fallbackTemplateSearch, setFallbackTemplateSearch] = useState<string>("");
  const [uploadedContactsList, setUploadedContactsList] = useState<Array<{ id: string; name: string | null; waId: string }>>([]);
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<string[]>([]);
  const [isImportingContacts, setIsImportingContacts] = useState<boolean>(false);
  const [uploadedFileStatus, setUploadedFileStatus] = useState<string>("");
  const [pasteInputText, setPasteInputText] = useState<string>("");
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  // Column Mapping States for Uploaded File
  const [parsedFileRows, setParsedFileRows] = useState<any[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [selectedPhoneColumn, setSelectedPhoneColumn] = useState<string>("");
  const [selectedNameColumn, setSelectedNameColumn] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // Segmentation Filters
  const [windowFilter, setWindowFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  const [contactSearch, setContactSearch] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

  // Dropdown states for interactive panels
  const [isAudienceModalOpen, setIsAudienceModalOpen] = useState(false);
  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // Buttons
  const [buttons, setButtons] = useState<
    { id: string; text: string; url?: string; type?: "reply" | "url" }[]
  >([]);
  const [newButtonText, setNewButtonText] = useState("");
  const [newButtonUrl, setNewButtonUrl] = useState("");
  const [newButtonType, setNewButtonType] = useState<"reply" | "url">("reply");

  // Templates
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [isTemplateMode, setIsTemplateMode] = useState(true); // Default to template mode as shown in mockup
  const [selectedOpen24Ids, setSelectedOpen24Ids] = useState<string[]>([]);

  const [contacts, setContacts] = useState<SelectionContact[]>([]);
  const [groups, setGroups] = useState<SelectionGroup[]>([]);
  const [tags, setTags] = useState<SelectionTag[]>([]);
  const [agents, setAgents] = useState<SelectionAgent[]>([]);
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [isAudienceLoading, setIsAudienceLoading] = useState(true);
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const query = contactSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.waId && c.waId.toLowerCase().includes(query))
    );
  });

  useEffect(() => {
    loadData(platform);
  }, [platform]);

  const loadData = async (currentPlatform?: string) => {
    const platformToUse = currentPlatform || platform;
    setIsTemplatesLoading(true);
    setIsAudienceLoading(true);
    setIsDataLoading(false); // Form structure renders immediately!

    // 1. Fetch metadata in background
    getGroups().then((res) => setGroups((res?.groups as SelectionGroup[]) || [])).catch(() => {});
    getTags().then((res) => setTags((res as SelectionTag[]) || [])).catch(() => {});
    getAgents().then((res) => setAgents((res as SelectionAgent[]) || [])).catch(() => {});
    getCustomAttributes().then((res) => setCustomFields(res || [])).catch(() => {});

    // 2. Fetch templates in background (cached & APPROVED only)
    getMessageTemplates()
      .then((templateRes) => {
        const allTemplates = templateRes.success ? (templateRes.data || []) : [];
        const approvedOnly = allTemplates.filter(
          (t: any) => t && t.status && String(t.status).toUpperCase() === "APPROVED"
        );
        setTemplates(approvedOnly);

        if (initialData?.templateName) {
          const matching = approvedOnly.find((t: any) => t.name === initialData.templateName);
          if (matching) {
            setSelectedTemplate(matching);
            setSelectedTemplateA(matching);
            setSelectedTemplateB(matching);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load message templates:", err);
      })
      .finally(() => {
        setIsTemplatesLoading(false);
      });

    // 3. Fetch all audience contacts in background
    getCampaignContactsSelection(platformToUse)
      .then((contactsData) => {
        setContacts((contactsData as SelectionContact[]) || []);
      })
      .catch((err) => {
        console.error("Failed to load campaign contacts:", err);
      })
      .finally(() => {
        setIsAudienceLoading(false);
      });
  };

  const handleFileUploadForDrip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileStatus(`Reading ${file.name}...`);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

      if (!rows || rows.length === 0) {
        toast.error("File is empty or has no rows");
        setUploadedFileStatus("");
        return;
      }

      // Collect all column names from rows
      const columnSet = new Set<string>();
      rows.forEach((row) => {
        Object.keys(row).forEach((key) => {
          const trimmed = key.trim();
          if (trimmed && !trimmed.startsWith("__EMPTY")) {
            columnSet.add(trimmed);
          }
        });
      });
      const columns = Array.from(columnSet);

      if (columns.length === 0) {
        toast.error("Could not detect any columns in file");
        setUploadedFileStatus("");
        return;
      }

      // Auto-detect best phone column
      const phoneKeywords = ["phone", "mobile", "contact", "whatsapp", "wa", "number", "tel", "cell"];
      const guessedPhone = columns.find((c) =>
        phoneKeywords.some((k) => c.toLowerCase().includes(k))
      ) || columns[0] || "";

      // Auto-detect best name column
      const nameKeywords = ["name", "vendor", "customer", "client", "person", "full name", "first name", "title", "company"];
      const guessedName = columns.find((c) =>
        c !== guessedPhone && nameKeywords.some((k) => c.toLowerCase().includes(k))
      ) || "";

      setParsedFileRows(rows);
      setDetectedColumns(columns);
      setSelectedPhoneColumn(guessedPhone);
      setSelectedNameColumn(guessedName);
      setUploadedFileName(file.name);
      setUploadedFileStatus(`Detected ${columns.length} columns & ${rows.length} rows in ${file.name}. Please confirm column mapping below.`);
      toast.success(`Detected ${rows.length} rows! Please choose Phone and Name columns.`);
    } catch (err: any) {
      console.error("Failed to parse file:", err);
      toast.error("Failed to parse uploaded file. Please check file format.");
      setUploadedFileStatus("");
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const handleProcessMappedContacts = async () => {
    if (!selectedPhoneColumn) {
      toast.error("Please select the Phone column");
      return;
    }
    if (parsedFileRows.length === 0) {
      toast.error("No data rows found to process");
      return;
    }

    setIsImportingContacts(true);
    setUploadedFileStatus(`Extracting and validating contacts from "${selectedPhoneColumn}"...`);

    try {
      const rawContacts: Array<{ name?: string; phoneNumber: string }> = [];
      for (const row of parsedFileRows) {
        const phone = String(row[selectedPhoneColumn] || "").trim();
        const name = selectedNameColumn ? String(row[selectedNameColumn] || "").trim() : "";

        if (phone.replace(/\D/g, "").length >= 7) {
          rawContacts.push({
            name: name || "Contact",
            phoneNumber: phone,
          });
        }
      }

      if (rawContacts.length === 0) {
        toast.error(`No valid phone numbers found in column "${selectedPhoneColumn}"`);
        setIsImportingContacts(false);
        return;
      }

      setUploadedFileStatus(`Importing ${rawContacts.length} numbers to workspace...`);
      const res = await resolveOrImportCampaignContacts(rawContacts);
      if (!res.success || !res.contacts) {
        toast.error(res.error || "Failed to import contacts");
        setIsImportingContacts(false);
        return;
      }

      setUploadedContactsList(res.contacts as any);
      setSelectedUploadedIds(res.contacts.map((c) => c.id));
      setUploadedFileStatus(`Loaded ${res.contacts.length} numbers from ${uploadedFileName}`);
      setParsedFileRows([]);
      toast.success(`Successfully imported ${res.contacts.length} contacts!`);
    } catch (err: any) {
      console.error("Failed to process mapped contacts:", err);
      toast.error("Failed to import contacts");
    } finally {
      setIsImportingContacts(false);
    }
  };

  const handleResetUpload = () => {
    setParsedFileRows([]);
    setDetectedColumns([]);
    setSelectedPhoneColumn("");
    setSelectedNameColumn("");
    setUploadedFileName("");
    setUploadedFileStatus("");
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const handlePasteNumbersForDrip = async () => {
    if (!pasteInputText.trim()) {
      toast.error("Please enter or paste phone numbers");
      return;
    }
    setIsImportingContacts(true);
    try {
      const lines = pasteInputText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      const rawContacts: Array<{ name?: string; phoneNumber: string }> = lines.map((line) => {
        const parts = line.split(/[:\t,-]/);
        if (parts.length >= 2 && parts[1].replace(/\D/g, "").length >= 7) {
          return { name: parts[0].trim(), phoneNumber: parts[1].trim() };
        }
        return { name: "Pasted Contact", phoneNumber: line };
      }).filter((c) => c.phoneNumber.replace(/\D/g, "").length >= 7);

      if (rawContacts.length === 0) {
        toast.error("No valid phone numbers found in pasted text");
        setIsImportingContacts(false);
        return;
      }

      const res = await resolveOrImportCampaignContacts(rawContacts);
      if (!res.success || !res.contacts) {
        toast.error(res.error || "Failed to process numbers");
        setIsImportingContacts(false);
        return;
      }

      setUploadedContactsList((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        const newItems = res.contacts.filter((c) => !existing.has(c.id));
        return [...prev, ...newItems];
      });
      setSelectedUploadedIds((prev) => [...new Set([...prev, ...res.contacts.map((c) => c.id)])]);
      setPasteInputText("");
      toast.success(`Imported ${res.contacts.length} numbers!`);
    } catch (err: any) {
      console.error("Paste import failed:", err);
      toast.error("Failed to process pasted numbers");
    } finally {
      setIsImportingContacts(false);
    }
  };

  const handleToggleDripFallbackDropdown = () => {
    if (!isDripFallbackDropdownOpen && dripFallbackButtonRef.current) {
      const rect = dripFallbackButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280) {
        setDripFallbackPlacement("top");
      } else {
        setDripFallbackPlacement("bottom");
      }
    }
    setIsDripFallbackDropdownOpen(!isDripFallbackDropdownOpen);
  };

  const handleContactSearch = async (query: string) => {
    setContactSearch(query);
    if (query.length > 2) {
      const results = await getAllContacts(undefined, undefined, query, undefined, undefined, platform);
      setContacts((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newOnes = (results as SelectionContact[]).filter(
          (c) => !existingIds.has(c.id),
        );
        return [...prev, ...newOnes];
      });
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setMediaUrl(data.url);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Upload Error:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = () => {
    setMediaUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const getCampaignGroupName = (variant?: string) => {
      const baseName = campaignName.trim() || `Campaign ${new Date().toLocaleDateString()}`;
      return variant ? `${baseName} - ${variant}` : baseName;
    };
    const isMultiMode = targetType === "multi";
    const hasSelection = isMultiMode
      ? selectedContactIds.length > 0 ||
      selectedGroupIds.length > 0 ||
      selectedTagIds.length > 0 ||
      selectedAgentIds.length > 0 ||
      selectedOpen24Ids.length > 0
      : !!selectedId;

    if (!hasSelection) {
      toast.error(t("selectAudiencePlaceholder"));
      return;
    }

    if (!sendNow && (!scheduledDate || !scheduledTime)) {
      toast.error(t("scheduleLabel"));
      return;
    }

    if (campaignCategory === "ab") {
      if (!campaignName.trim()) {
        toast.error("Please enter a campaign name");
        return;
      }
      if (targetType === "contact") {
        toast.error("A/B campaigns require a multi-contact target audience to split.");
        return;
      }

      let resolvedContentA = contentA || campaignDescription;
      if (isTemplateModeA) {
        if (!selectedTemplateA) {
          toast.error("Please select a template for Variant A");
          return;
        }
        const bodyComponent = selectedTemplateA.components?.find((c) => c.type === "BODY");
        if (bodyComponent?.example?.body_text?.[0]) {
          const paramCount = bodyComponent.example.body_text[0].length;
          if (templateParamsA.length !== paramCount || templateParamsA.some((p) => !p.trim())) {
            toast.error(`Please fill in all ${paramCount} parameter(s) for Variant A template.`);
            return;
          }
        }
        let parts = [];
        const header = selectedTemplateA.components?.find((c) => c.type === "HEADER")?.text;
        if (header) parts.push(header);
        let body = bodyComponent?.text || "";
        templateParamsA.forEach((param, idx) => {
          body = body.replaceAll(`{{${idx + 1}}}`, param);
        });
        if (body) parts.push(body);
        const footer = selectedTemplateA.components?.find((c) => c.type === "FOOTER")?.text;
        if (footer) parts.push(footer);
        resolvedContentA = parts.join("\n\n") || `Template: ${selectedTemplateA.name}`;
      } else if (!resolvedContentA) {
        toast.error("Please write a custom message or description for Variant A");
        return;
      }

      let resolvedContentB = contentB || campaignDescription;
      if (isTemplateModeB) {
        if (!selectedTemplateB) {
          toast.error("Please select a template for Variant B");
          return;
        }
        const bodyComponent = selectedTemplateB.components?.find((c) => c.type === "BODY");
        if (bodyComponent?.example?.body_text?.[0]) {
          const paramCount = bodyComponent.example.body_text[0].length;
          if (templateParamsB.length !== paramCount || templateParamsB.some((p) => !p.trim())) {
            toast.error(`Please fill in all ${paramCount} parameter(s) for Variant B template.`);
            return;
          }
        }
        let parts = [];
        const header = selectedTemplateB.components?.find((c) => c.type === "HEADER")?.text;
        if (header) parts.push(header);
        let body = bodyComponent?.text || "";
        templateParamsB.forEach((param, idx) => {
          body = body.replaceAll(`{{${idx + 1}}}`, param);
        });
        if (body) parts.push(body);
        const footer = selectedTemplateB.components?.find((c) => c.type === "FOOTER")?.text;
        if (footer) parts.push(footer);
        resolvedContentB = parts.join("\n\n") || `Template: ${selectedTemplateB.name}`;
      } else if (!resolvedContentB) {
        toast.error("Please write a custom message or description for Variant B");
        return;
      }

      setIsLoading(true);
      try {
        let finalContactIds: string[] = [];
        let resolved: any[] = [];
        if (multiSelectionMode === "individual") {
          finalContactIds = [...selectedContactIds];
        } else if (multiSelectionMode === "group") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          finalContactIds = resolved
            .filter((c: any) => c.groups.some((g: any) => selectedGroupIds.includes(g.groupId)))
            .map((c: any) => c.id);
        } else if (multiSelectionMode === "tag") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, selectedTagIds, platform);
          finalContactIds = resolved.map((c: any) => c.id);
        } else if (multiSelectionMode === "agent") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          finalContactIds = resolved
            .filter((c: any) => c.assignedUsers.some((u: any) => selectedAgentIds.includes(u.id)))
            .map((c: any) => c.id);
        } else if (multiSelectionMode === "open24") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          const activeFilter = windowFilter === "all" ? "active" : windowFilter;
          finalContactIds = resolved
            .filter((c: any) => {
              const lastMsgTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
              const isWindowActive = Date.now() - lastMsgTime < 24 * 60 * 60 * 1000;
              return activeFilter === "active" ? isWindowActive : !isWindowActive;
            })
            .map((c: any) => c.id);
        } else if (multiSelectionMode === "recency") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          const activeFilter = dateFilter === "all" ? "1day" : dateFilter;
          finalContactIds = resolved
            .filter((c: any) => {
              if (!c.lastMessageAt) return false;
              const lastMsgTime = new Date(c.lastMessageAt).getTime();
              const nowTime = Date.now();
              if (activeFilter === "1day") {
                return lastMsgTime >= nowTime - 24 * 60 * 60 * 1000;
              } else if (activeFilter === "2days") {
                return lastMsgTime >= nowTime - 2 * 24 * 60 * 60 * 1000;
              } else if (activeFilter === "7days") {
                return lastMsgTime >= nowTime - 7 * 24 * 60 * 60 * 1000;
              } else if (activeFilter === "custom") {
                if (filterStartDate && lastMsgTime < new Date(filterStartDate).getTime()) return false;
                if (filterEndDate && lastMsgTime > new Date(filterEndDate).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
                return true;
              }
              return true;
            })
            .map((c: any) => c.id);
        }

        if (excludeOptedOut) {
          finalContactIds = finalContactIds.filter((id) => {
            const c = contacts.find((contact) => contact.id === id);
            return !c?.isBlocked;
          });
        }

        if (finalContactIds.length < 2) {
          toast.error("A/B campaign requires at least 2 contacts in the target audience to perform a split.");
          setIsLoading(false);
          return;
        }

        // Shuffle contacts randomly to ensure unbiased split
        const shuffled = [...finalContactIds].sort(() => Math.random() - 0.5);
        const splitIndex = Math.ceil(shuffled.length / 2);
        const contactIdsA = shuffled.slice(0, splitIndex);
        const contactIdsB = shuffled.slice(splitIndex);

        // Create Group A
        const groupResA = await createGroup({
          name: getCampaignGroupName("Variant A"),
          description: campaignDescription || "Variant A of A/B split campaign",
          contactIds: contactIdsA,
        });

        if (!groupResA.success || !groupResA.group) {
          toast.error("Failed to create campaign group for Variant A");
          setIsLoading(false);
          return;
        }

        // Create Group B
        const groupResB = await createGroup({
          name: getCampaignGroupName("Variant B"),
          description: campaignDescription || "Variant B of A/B split campaign",
          contactIds: contactIdsB,
        });

        if (!groupResB.success || !groupResB.group) {
          toast.error("Failed to create campaign group for Variant B");
          setIsLoading(false);
          return;
        }

        // Launch Time
        const scheduledAt = sendNow
          ? new Date(Date.now() + 5000)
          : new Date(`${scheduledDate}T${scheduledTime}`);

        // Create message A
        const resA = await createScheduledMessage({
          content: resolvedContentA,
          scheduledAt,
          mediaUrl: isTemplateModeA ? undefined : mediaUrlA || undefined,
          templateName: isTemplateModeA ? selectedTemplateA?.name : undefined,
          templateLanguage: isTemplateModeA ? selectedTemplateA?.language : undefined,
          templateParams: isTemplateModeA && templateParamsA.length > 0 ? templateParamsA : undefined,
          buttons: !isTemplateModeA && buttonsA.length > 0 ? buttonsA : undefined,
          type: "DRIP",
          platform: platform,
          groupId: groupResA.group.id,
        });

        // Create message B
        const resB = await createScheduledMessage({
          content: resolvedContentB,
          scheduledAt,
          mediaUrl: isTemplateModeB ? undefined : mediaUrlB || undefined,
          templateName: isTemplateModeB ? selectedTemplateB?.name : undefined,
          templateLanguage: isTemplateModeB ? selectedTemplateB?.language : undefined,
          templateParams: isTemplateModeB && templateParamsB.length > 0 ? templateParamsB : undefined,
          buttons: !isTemplateModeB && buttonsB.length > 0 ? buttonsB : undefined,
          type: "DRIP",
          platform: platform,
          groupId: groupResB.group.id,
        });

        if (resA.success && resB.success) {
          toast.success("A/B Campaign variants created and scheduled successfully");
          router.push("/campaign");
        } else {
          toast.error("Failed to schedule one or both campaign variants");
        }
      } catch (error) {
        console.error(error);
        toast.error("An unexpected error occurred during A/B campaign split");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    let resolvedContent = content || campaignDescription;

    if (isTemplateMode) {
      if (!selectedTemplate) {
        toast.error(t("selectTemplatePlaceholder"));
        return;
      }

      const bodyComponent = selectedTemplate.components?.find(
        (c) => c.type === "BODY",
      );
      if (bodyComponent?.example?.body_text?.[0]) {
        const paramCount = bodyComponent.example.body_text[0].length;
        if (
          templateParams.length !== paramCount ||
          templateParams.some((p) => !p.trim())
        ) {
          toast.error(
            `Please fill in all ${paramCount} parameter(s) for this template.`,
          );
          return;
        }
      }

      let parts = [];
      const header = selectedTemplate.components?.find(
        (c) => c.type === "HEADER",
      )?.text;
      if (header) parts.push(header);

      let body = bodyComponent?.text || "";
      templateParams.forEach((param, idx) => {
        body = body.replaceAll(`{{${idx + 1}}}`, param);
      });
      if (body) parts.push(body);

      const footer = selectedTemplate.components?.find(
        (c) => c.type === "FOOTER",
      )?.text;
      if (footer) parts.push(footer);

      resolvedContent =
        parts.join("\n\n") || `Template: ${selectedTemplate.name}`;
    } else if (!resolvedContent) {
      toast.error("Please type a message or description");
      return;
    }

    // Resolve targeted contacts
    let finalContactIds: string[] = [];
    if (targetType === "contact") {
      if (!selectedId) {
        toast.error(t("selectContactPlaceholder"));
        return;
      }
      finalContactIds = [selectedId];
    } else {
      setIsLoading(true);
      try {
        let resolved: any[] = [];

        if (multiSelectionMode === "individual") {
          finalContactIds = [...selectedContactIds];
        } else if (multiSelectionMode === "uploaded") {
          finalContactIds = [...selectedUploadedIds];
        } else if (multiSelectionMode === "group") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          finalContactIds = resolved
            .filter((c: any) => c.groups.some((g: any) => selectedGroupIds.includes(g.groupId)))
            .map((c: any) => c.id);
        } else if (multiSelectionMode === "tag") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, selectedTagIds, platform);
          finalContactIds = resolved.map((c: any) => c.id);
        } else if (multiSelectionMode === "agent") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          finalContactIds = resolved
            .filter((c: any) => c.assignedUsers.some((u: any) => selectedAgentIds.includes(u.id)))
            .map((c: any) => c.id);
        } else if (multiSelectionMode === "open24") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          const activeFilter = windowFilter === "all" ? "active" : windowFilter;
          finalContactIds = resolved
            .filter((c: any) => {
              const lastMsgTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
              const isWindowActive = Date.now() - lastMsgTime < 24 * 60 * 60 * 1000;
              return activeFilter === "active" ? isWindowActive : !isWindowActive;
            })
            .map((c: any) => c.id);
        } else if (multiSelectionMode === "recency") {
          resolved = await getAllContacts(undefined, undefined, "", undefined, undefined, platform);
          const activeFilter = dateFilter === "all" ? "1day" : dateFilter;
          finalContactIds = resolved
            .filter((c: any) => {
              if (!c.lastMessageAt) return false;
              const lastMsgTime = new Date(c.lastMessageAt).getTime();
              const nowTime = Date.now();

              if (activeFilter === "1day") {
                return lastMsgTime >= nowTime - 24 * 60 * 60 * 1000;
              } else if (activeFilter === "2days") {
                return lastMsgTime >= nowTime - 2 * 24 * 60 * 60 * 1000;
              } else if (activeFilter === "7days") {
                return lastMsgTime >= nowTime - 7 * 24 * 60 * 60 * 1000;
              } else if (activeFilter === "custom") {
                if (filterStartDate && lastMsgTime < new Date(filterStartDate).getTime()) return false;
                if (filterEndDate && lastMsgTime > new Date(filterEndDate).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
                return true;
              }
              return true;
            })
            .map((c: any) => c.id);
        }
      } catch (error) {
        console.error("Failed to resolve contacts:", error);
        toast.error("Failed to resolve campaign contacts");
        setIsLoading(false);
        return;
      }
    }

    if (excludeOptedOut) {
      finalContactIds = finalContactIds.filter((id) => {
        const c = contacts.find((contact) => contact.id === id);
        return !c?.isBlocked;
      });
    }

    if (finalContactIds.length === 0) {
      toast.error("No contacts selected for campaign");
      setIsLoading(false);
      return;
    }

    // Launch Time
    const scheduledAt = sendNow
      ? new Date(Date.now() + 5000) // Launch in 5 seconds
      : new Date(`${scheduledDate}T${scheduledTime}`);

    const finalButtons = [...buttons];

    try {
      const basePayload = {
        content: resolvedContent,
        scheduledAt,
        mediaUrl: mediaUrl || undefined,
        templateName: isTemplateMode ? selectedTemplate?.name : undefined,
        templateLanguage: isTemplateMode
          ? selectedTemplate?.language
          : undefined,
        templateParams:
          isTemplateMode && templateParams.length > 0
            ? templateParams
            : undefined,
        buttons:
          !isTemplateMode && finalButtons.length > 0 ? finalButtons : undefined,
        type: campaignCategory === "drip" ? "DRIP" : "SCHEDULED",
        platform: platform,
        delaySeconds: campaignCategory === "drip" ? dripIntervalSeconds : undefined,
        throttleConfig:
          campaignCategory === "qr_broadcast"
            ? {
                messageDelayMinSeconds: qrMinDelaySeconds,
                messageDelayMaxSeconds: Math.max(qrMinDelaySeconds, qrMaxDelaySeconds),
                batchSize: qrBatchSize,
                batchBreakSeconds: qrBatchBreakSeconds,
              }
            : undefined,
        fallbackTemplateName: campaignCategory === "drip" && !isTemplateMode && dripFallbackTemplate ? dripFallbackTemplate.name : undefined,
        fallbackTemplateLanguage: campaignCategory === "drip" && !isTemplateMode && dripFallbackTemplate ? dripFallbackTemplate.language : undefined,
      };

      if (targetType === "multi") {
        let finalGroupId = "";

        if (multiSelectionMode === "group" && selectedGroupIds.length === 1) {
          // Direct reuse of the selected group segment without creating a duplicate record!
          finalGroupId = selectedGroupIds[0];
        } else {
          const groupRes = await createGroup({
            name: getCampaignGroupName(),
            description: campaignDescription || "Dynamic Multi-Contact Campaign",
            contactIds: finalContactIds,
          });

          if (!groupRes.success || !groupRes.group) {
            toast.error("Failed to create campaign group");
            return;
          }

          finalGroupId = groupRes.group.id;
        }

        const payload = {
          ...basePayload,
          groupId: finalGroupId,
        };

        const res = initialData
          ? await updateScheduledMessage(initialData.id, payload)
          : await createScheduledMessage(payload);

        if (res.success) {
          toast.success(initialData ? "Campaign updated successfully" : "Campaign created and scheduled successfully");
          router.push("/campaign");
        } else {
          toast.error(res.error || "Failed to schedule campaign");
        }
      } else {
        const payload = {
          ...basePayload,
          contactId: targetType === "contact" ? selectedId : undefined,
        };
        const res = initialData
          ? await updateScheduledMessage(initialData.id, payload)
          : await createScheduledMessage(payload);

        if (res.success) {
          toast.success(
            initialData
              ? "Campaign updated successfully"
              : "Campaign scheduled successfully",
          );
          router.push("/campaign");
        } else {
          toast.error(res.error || "Failed to save campaign");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to count targeted contacts dynamically
  const getTargetedCount = () => {
    let list: SelectionContact[] = [];

    if (multiSelectionMode === "individual") {
      list = contacts.filter((c) => selectedContactIds.includes(c.id));
    } else if (multiSelectionMode === "uploaded") {
      return selectedUploadedIds.length;
    } else if (multiSelectionMode === "group") {
      if (selectedGroupIds.length > 0) {
        list = contacts.filter((c) =>
          c.groups.some((g) => selectedGroupIds.includes(g.groupId))
        );
      }
    } else if (multiSelectionMode === "tag") {
      if (selectedTagIds.length > 0) {
        list = contacts.filter((c) =>
          c.tags.some((t) => selectedTagIds.includes(t.id))
        );
      }
    } else if (multiSelectionMode === "agent") {
      if (selectedAgentIds.length > 0) {
        list = contacts.filter((c) =>
          c.assignedUsers.some((u) => selectedAgentIds.includes(u.id))
        );
      }
    } else if (multiSelectionMode === "open24") {
      const activeFilter = windowFilter === "all" ? "active" : windowFilter;
      list = contacts.filter((c) => {
        const lastMsgTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
        const isWindowActive = Date.now() - lastMsgTime < 24 * 60 * 60 * 1000;
        return activeFilter === "active" ? isWindowActive : !isWindowActive;
      });
    } else if (multiSelectionMode === "recency") {
      const activeFilter = dateFilter === "all" ? "1day" : dateFilter;
      list = contacts.filter((c) => {
        if (!c.lastMessageAt) return false;
        const lastMsgTime = new Date(c.lastMessageAt).getTime();
        const nowTime = Date.now();

        if (activeFilter === "1day") {
          return lastMsgTime >= nowTime - 24 * 60 * 60 * 1000;
        } else if (activeFilter === "2days") {
          return lastMsgTime >= nowTime - 2 * 24 * 60 * 60 * 1000;
        } else if (activeFilter === "7days") {
          return lastMsgTime >= nowTime - 7 * 24 * 60 * 60 * 1000;
        } else if (activeFilter === "custom") {
          if (filterStartDate && lastMsgTime < new Date(filterStartDate).getTime()) return false;
          if (filterEndDate && lastMsgTime > new Date(filterEndDate).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
          return true;
        }
        return true;
      });
    }

    if (excludeOptedOut) {
      list = list.filter((c) => !c.isBlocked);
    }

    if (targetType === "contact" && selectedId) return 1;
    return list.length;
  };

  const renderVariantForm = (v: "A" | "B") => {
    const isTemplateModeVar = v === "A" ? isTemplateModeA : isTemplateModeB;
    const setIsTemplateModeVar = v === "A" ? setIsTemplateModeA : setIsTemplateModeB;
    const selectedTemplateVar = v === "A" ? selectedTemplateA : selectedTemplateB;
    const setSelectedTemplateVar = v === "A" ? setSelectedTemplateA : setSelectedTemplateB;
    const templateSearchVar = v === "A" ? templateSearchA : templateSearchB;
    const setTemplateSearchVar = v === "A" ? setTemplateSearchA : setTemplateSearchB;
    const templateParamsVar = v === "A" ? templateParamsA : templateParamsB;
    const setTemplateParamsVar = v === "A" ? setTemplateParamsA : setTemplateParamsB;
    const contentVar = v === "A" ? contentA : contentB;
    const setContentVar = v === "A" ? setContentA : setContentB;
    const mediaUrlVar = v === "A" ? mediaUrlA : mediaUrlB;
    const setMediaUrlVar = v === "A" ? setMediaUrlA : setMediaUrlB;
    const isMediaLibraryOpenVar = v === "A" ? isMediaLibraryOpenA : isMediaLibraryOpenB;
    const setIsMediaLibraryOpenVar = v === "A" ? setIsMediaLibraryOpenA : setIsMediaLibraryOpenB;
    const buttonsVar = v === "A" ? buttonsA : buttonsB;
    const setButtonsVar = v === "A" ? setButtonsA : setButtonsB;
    const newButtonTextVar = v === "A" ? newButtonTextA : newButtonTextB;
    const setNewButtonTextVar = v === "A" ? setNewButtonTextA : setNewButtonTextB;
    const newButtonUrlVar = v === "A" ? newButtonUrlA : newButtonUrlB;
    const setNewButtonUrlVar = v === "A" ? setNewButtonUrlA : setNewButtonUrlB;
    const newButtonTypeVar = v === "A" ? newButtonTypeA : newButtonTypeB;
    const setNewButtonTypeVar = v === "A" ? setNewButtonTypeA : setNewButtonTypeB;
    const isTemplateDropdownOpenVar = v === "A" ? isTemplateDropdownOpenA : isTemplateDropdownOpenB;
    const setIsTemplateDropdownOpenVar = v === "A" ? setIsTemplateDropdownOpenA : setIsTemplateDropdownOpenB;

    const variantColor = v === "A" ? "text-emerald-600 border-[#00B074]" : "text-blue-600 border-blue-500";
    const variantBg = v === "A" ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-blue-50 dark:bg-blue-950/20";

    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-6 text-start flex-1 w-full">
        {/* Header Title with toggle option */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 select-none">
          <div className="flex items-center gap-2">
            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center font-black text-xs", variantBg, variantColor)}>
              {v}
            </span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-white">
              Variant {v} Message
            </span>
          </div>
          {platform === "WHATSAPP" && (
            <button
              type="button"
              onClick={() => setIsTemplateModeVar(!isTemplateModeVar)}
              className="text-[10px] font-bold text-[#00B074] tracking-wide hover:underline"
            >
              {isTemplateModeVar ? t("useCustomText") : t("useTemplate")}
            </button>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {isTemplateModeVar ? (
            <div className="relative space-y-2">
              <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest block mb-1">
                {t("messageTemplateLabel")} <span className="text-red-500">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setIsTemplateDropdownOpenVar(!isTemplateDropdownOpenVar)}
                className={cn(
                  "w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 flex items-center justify-between font-bold text-slate-700 dark:text-slate-200",
                  dir === "rtl" ? "text-right" : "text-left"
                )}
              >
                <span className="truncate">
                  {selectedTemplateVar
                    ? `${selectedTemplateVar.name} (${selectedTemplateVar.language})`
                    : t("selectTemplatePlaceholder")}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {isTemplateDropdownOpenVar && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsTemplateDropdownOpenVar(false)}
                  />
                  <div className={cn(
                    "absolute top-full mt-2 bg-white dark:bg-[#0B0F1A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-40 max-h-[220px] overflow-y-auto space-y-3 left-0 right-0 animate-in fade-in slide-in-from-top-1 duration-150"
                  )}>
                    <Input
                      placeholder={t("searchTemplatesPlaceholder")}
                      value={templateSearchVar}
                      onChange={(e) => setTemplateSearchVar(e.target.value)}
                      className="h-10 bg-slate-55 dark:bg-slate-900 rounded-lg text-xs"
                    />
                    <div className="space-y-1">
                      {templates
                        .filter((tmpl) => tmpl.name.toLowerCase().includes(templateSearchVar.toLowerCase()))
                        .map((tmpl) => (
                          <div
                            key={tmpl.name}
                            onClick={() => {
                              setSelectedTemplateVar(tmpl);
                              setTemplateParamsVar([]);
                              setIsTemplateDropdownOpenVar(false);
                            }}
                            className={cn(
                              "flex justify-between items-center py-2 px-3 rounded-xl cursor-pointer hover:bg-slate-55 dark:hover:bg-slate-800 text-xs font-bold transition-all",
                              selectedTemplateVar?.name === tmpl.name
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074]"
                                : "text-slate-750 dark:text-slate-200"
                            )}
                          >
                            <span className="truncate">{tmpl.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">{tmpl.language}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                  {t("customMessageLabel") || "MESSAGE CONTENT (VARIANT B)"}
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">Insert:</span>
                  {COMMON_CONTACT_VARIABLES.slice(0, 3).map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => insertVariableAtCursor(contentVarTextareaRef.current, contentVar, v.value, setContentVar)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/50 dark:border-emerald-800 transition-colors cursor-pointer"
                      title={v.description}
                    >
                      + {v.label}
                    </button>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        More...
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 shadow-xl rounded-xl p-1 z-50">
                      {COMMON_CONTACT_VARIABLES.map((v) => (
                        <DropdownMenuItem
                          key={v.value}
                          onClick={() => insertVariableAtCursor(contentVarTextareaRef.current, contentVar, v.value, setContentVar)}
                          className="text-xs py-2 px-3 rounded-lg cursor-pointer flex flex-col items-start hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        >
                          <span className="font-bold text-slate-800 dark:text-slate-200">{v.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{v.value}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <Textarea
                ref={contentVarTextareaRef}
                placeholder={t("customMessagePlaceholder")}
                value={contentVar}
                onChange={(e) => setContentVar(e.target.value)}
                className="min-h-[100px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl font-bold py-3 px-4 focus:ring-[#00B074]/20"
              />

              {/* Media Attachment */}
              <div className="space-y-1.5">
                <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                  {t("mediaAttachmentLabel")}
                </Label>
                {!mediaUrlVar ? (
                  <button
                    type="button"
                    onClick={() => setIsMediaLibraryOpenVar(true)}
                    className="w-full h-11 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <Library className="w-4 h-4 text-[#00B074]" />
                    {t("chooseMediaBtn")}
                  </button>
                ) : (
                  <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                      {isImageUrl(mediaUrlVar) ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{mediaUrlVar.split("/").pop()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaUrlVar(null)}
                      className="p-1.5 rounded-full hover:bg-slate-50 text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Interactive buttons */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                  {t("interactiveButtonsLabel")}
                </Label>

                {buttonsVar.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {buttonsVar.map((btn) => {
                      const isUrl = btn.type === "url" || !!btn.url;
                      return (
                        <div
                          key={btn.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border text-xs font-extrabold shadow-sm transition-all",
                            isUrl
                              ? "border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400"
                              : "border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-400"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            {isUrl ? (
                              <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                            {btn.text}
                          </span>
                          <span className={cn(
                            "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none",
                            isUrl ? "bg-emerald-55 text-emerald-600" : "bg-blue-55 text-blue-600"
                          )}>
                            {isUrl ? t("ctaLinkOption") : t("quickReplyOption")}
                          </span>
                          <button
                            type="button"
                            onClick={() => setButtonsVar((prev) => prev.filter((b) => b.id !== btn.id))}
                            className="text-rose-500 hover:text-rose-600 transition-colors cursor-pointer shrink-0 ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {buttonsVar.length < 3 && !buttonsVar.some((b) => b.type === "url" || !!b.url) ? (
                  <div className="space-y-3.5">
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setNewButtonTypeVar("reply")}
                        className={cn(
                          "flex-1 py-2 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
                          newButtonTypeVar === "reply"
                            ? "bg-white dark:bg-slate-850 text-slate-800 dark:text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 bg-transparent"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {t("quickReplyOption")}
                      </button>
                      <button
                        type="button"
                        disabled={buttonsVar.length > 0}
                        onClick={() => setNewButtonTypeVar("url")}
                        className={cn(
                          "flex-1 py-2 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
                          newButtonTypeVar === "url"
                            ? "bg-white dark:bg-slate-850 text-[#00B074] shadow-sm"
                            : "text-slate-400 hover:text-slate-650 dark:hover:text-slate-355 bg-transparent",
                          buttonsVar.length > 0 && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                        {t("ctaLinkOption")}
                      </button>
                    </div>

                    <div className={cn("grid gap-2.5", newButtonTypeVar === "url" ? "grid-cols-2" : "grid-cols-1")}>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("buttonTextLabel")}</Label>
                        <Input
                          placeholder={newButtonTypeVar === "url" ? t("ctaPlaceholder") : t("replyPlaceholder")}
                          value={newButtonTextVar}
                          onChange={(e) => setNewButtonTextVar(e.target.value.slice(0, 20))}
                          className="bg-white dark:bg-slate-900 h-10 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 focus:ring-[#00B074]/20 font-bold text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      {newButtonTypeVar === "url" && (
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("linkUrlLabel")}</Label>
                          <Input
                            placeholder="https://example.com"
                            value={newButtonUrlVar}
                            onChange={(e) => setNewButtonUrlVar(e.target.value)}
                            className="bg-white dark:bg-slate-900 h-10 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 focus:ring-[#00B074]/20 font-bold text-slate-700 dark:text-slate-200"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!newButtonTextVar.trim()) {
                          toast.error("Button text is required");
                          return;
                        }
                        if (newButtonTypeVar === "url" && !newButtonUrlVar.trim()) {
                          toast.error("Link URL is required");
                          return;
                        }
                        let formattedUrl = newButtonUrlVar.trim();
                        if (newButtonTypeVar === "url") {
                          if (!/^https?:\/\//i.test(formattedUrl)) {
                            formattedUrl = "https://" + formattedUrl;
                          }
                          try {
                            new URL(formattedUrl);
                          } catch (_) {
                            toast.error("Please enter a valid URL");
                            return;
                          }
                        }
                        const newBtn = {
                          id: Math.random().toString(36).substring(2, 9),
                          text: newButtonTextVar.trim(),
                          type: newButtonTypeVar,
                          url: newButtonTypeVar === "url" ? formattedUrl : undefined,
                        };
                        setButtonsVar((prev) => [...prev, newBtn]);
                        setNewButtonTextVar("");
                        setNewButtonUrlVar("");
                      }}
                      className="w-full h-10 bg-emerald-55/60 dark:bg-emerald-950/20 hover:bg-[#00B074]/15 text-[#00B074] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
                    >
                      <Plus className="w-4 h-4" />
                      {t("addInteractiveBtn")}
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold italic tracking-wide mt-1">
                    {buttonsVar.some((b) => b.type === "url" || !!b.url)
                      ? t("ctaMaxLimit")
                      : t("buttonsMaxLimit")}
                  </p>
                )}
              </div>
            </div>
          )}

          {isTemplateModeVar && selectedTemplateVar && (
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {selectedTemplateVar.components?.some((c) => c.type === "HEADER" && (c.format === "IMAGE" || c.format === "VIDEO" || c.format === "DOCUMENT")) && (
                <div className="space-y-1.5">
                  <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                    {t("mediaAttachmentLabel")} <span className="text-red-500">*</span>
                  </Label>
                  {!mediaUrlVar ? (
                    <button
                      type="button"
                      onClick={() => setIsMediaLibraryOpenVar(true)}
                      className="w-full h-11 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                    >
                      <Library className="w-4 h-4 text-[#00B074]" />
                      {t("chooseMediaBtn")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                        {isImageUrl(mediaUrlVar) ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{mediaUrlVar.split("/").pop()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMediaUrlVar(null)}
                        className="p-1.5 rounded-full hover:bg-slate-50 text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {selectedTemplateVar.components?.find((c) => c.type === "BODY")?.example?.body_text?.[0] && (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <Label className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest block mb-1">
                    {t("templateParametersLabel")}
                  </Label>
                  {selectedTemplateVar.components
                    .find((c) => c.type === "BODY")
                    ?.example?.body_text?.[0].map((exampleText: string, index: number) => (
                      <div key={index} className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 ml-1">
                          Variable {"{{"}{index + 1}{"}}"} (e.g. {exampleText})
                        </Label>
                        <div className="flex gap-2">
                          <select
                            value={
                              templateParamsVar[index]?.startsWith("{{contact.")
                                ? templateParamsVar[index]
                                : "static"
                            }
                            onChange={(e) => {
                              const newParams = [...templateParamsVar];
                              if (e.target.value === "static") {
                                newParams[index] = "";
                              } else {
                                newParams[index] = e.target.value;
                              }
                              setTemplateParamsVar(newParams);
                            }}
                            className="w-1/3 bg-white dark:bg-slate-900 h-10 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-2 focus:ring-[#00B074]/20 font-bold outline-none text-slate-700 dark:text-slate-200"
                          >
                            <option value="static">Static Text</option>
                            <option value="{{contact.name}}">Contact Name</option>
                            <option value="{{contact.firstName}}">First Name</option>
                            <option value="{{contact.lastName}}">Last Name</option>
                            <option value="{{contact.waId}}">Mobile Number</option>
                            <option value="{{contact.email}}">Email</option>
                            {customFields.map((field) => (
                              <option key={field} value={`{{contact.custom.${field}}}`}>
                                {field} (Custom Field)
                              </option>
                            ))}
                          </select>

                          {(!templateParamsVar[index]?.startsWith("{{contact.")) && (
                            <Input
                              placeholder={`${t("templateParametersLabel")} {{${index + 1}}}`}
                              value={templateParamsVar[index] || ""}
                              onChange={(e) => {
                                const newParams = [...templateParamsVar];
                                newParams[index] = e.target.value;
                                setTemplateParamsVar(newParams);
                              }}
                              className="flex-1 bg-white dark:bg-slate-900 h-10 border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 focus:ring-[#00B074]/20 font-bold"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp Message Live Preview */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 block mb-2">
              Variant {v} Chat Preview
            </span>
            {isTemplateModeVar && selectedTemplateVar ? (
              <div className="scale-[0.85] origin-top bg-white dark:bg-[#111b21] p-3 rounded-xl dark:border-slate-800 shadow-sm max-w-sm mx-auto">
                <WhatsAppTemplatePreview
                  template={selectedTemplateVar as any}
                  getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                  testValues={templateParamsVar.reduce((acc, val, idx) => {
                    if (val) acc[(idx + 1).toString()] = val;
                    return acc;
                  }, {} as Record<string, string>)}
                  mediaUrl={mediaUrlVar}
                />
              </div>
            ) : (
              <div className="scale-[0.88] origin-top bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-2xl dark:border-slate-800 shadow-sm max-w-sm mx-auto min-h-[140px] flex flex-col justify-start relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className={cn(
                  "relative z-10 bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-2xl p-3 shadow-md text-xs break-words max-w-[90%] flex flex-col gap-1.5 transition-all duration-200",
                  dir === "rtl" ? "rounded-tl-none self-start" : "rounded-tr-none self-end"
                )}>
                  {mediaUrlVar && (
                    <div className="mb-1 rounded-lg overflow-hidden bg-white/40 max-h-[140px] flex items-center justify-center border border-slate-200/10">
                      {isImageUrl(mediaUrlVar) ? (
                        <img src={mediaUrlVar} className="w-full h-full object-cover" alt="Variant Media" />
                      ) : (
                        <div className="p-3 text-[10px] flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-100">
                          <FileIcon className="w-4 h-4 shrink-0 text-emerald-600" />
                          <span className="truncate max-w-[150px]">{mediaUrlVar.split("/").pop()}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap font-semibold leading-relaxed">
                    {contentVar || t("previewPlaceholder")}
                  </p>
                  {buttonsVar.length > 0 && (
                    <div className="mt-1 pt-1.5 border-t border-slate-200/30 dark:border-slate-700/30 flex flex-col gap-1">
                      {buttonsVar.map((btn) => {
                        const isUrl = btn.type === "url" || !!btn.url;
                        return (
                          <div
                            key={btn.id}
                            className="bg-white dark:bg-[#202c33] text-[#00a884] dark:text-[#00a884] text-[10px] font-extrabold text-center py-2 rounded-xl shadow-sm select-none transition-all active:scale-[0.98] flex items-center justify-center gap-1"
                          >
                            {isUrl && <Link2 className="w-3 h-3 text-[#00a884]" />}
                            <span>{btn.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <span className="text-[9px] opacity-65 text-right block leading-none self-end mt-0.5 font-bold">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Media Library sub-modal binding for this specific variant */}
        <MediaLibraryModal
          isOpen={isMediaLibraryOpenVar}
          onClose={() => setIsMediaLibraryOpenVar(false)}
          onSelect={(url) => setMediaUrlVar(url)}
          contentType="image"
        />
      </div>
    );
  };

  return (
    <div dir={dir} className="w-full bg-white dark:bg-[#0B0F1A] border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col plus-jakarta-forced transition-colors duration-300">
      <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-855 shrink-0 bg-white dark:bg-[#0B0F1A]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
            <Send className={cn("w-6 h-6", dir === "rtl" ? "-rotate-45" : "rotate-45")} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {t("modalTitle")}
            </h2>
            <p className="text-slate-550 dark:text-slate-400 text-xs font-bold mt-0.5">
              {t("modalSubtitle")}
            </p>
          </div>
        </div>

      </div>


      <div className="p-8 pb-36 overflow-y-auto flex-1 space-y-8 bg-[#F8FAFC]/40 dark:bg-[#0B0F1A]/20">

        {/* 1. Category Selection Row (Dynamic 5 Cards based on Connection Method) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          {/* 1. QR Broadcast (Active when connected via WhatsApp QR Code) */}
          <div
            onClick={() => {
              if (!isQrConnected) {
                toast.error("QR Broadcast is only available when your number is connected via WhatsApp QR Code in Settings.");
                return;
              }
              setCampaignCategory("qr_broadcast");
              setIsTemplateMode(false);
              setPlatform("WHATSAPP");
              if (multiSelectionMode === "uploaded") {
                setMultiSelectionMode("individual");
              }
            }}
            className={cn(
              "p-5 rounded-2xl border-2 transition-all duration-300 relative select-none flex flex-col items-center text-center",
              !isQrConnected
                ? "opacity-55 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                : "cursor-pointer hover:border-slate-200 dark:hover:border-slate-700",
              campaignCategory === "qr_broadcast"
                ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-md scale-[1.02] ring-2 ring-emerald-500/20"
                : isQrConnected ? "border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/60" : ""
            )}
          >
            {campaignCategory === "qr_broadcast" && (
              <div className={cn("absolute top-3 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center", dir === "rtl" ? "left-3" : "right-3")}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-3",
              isQrConnected ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            )}>
              <QrCode className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 mb-1">
              QR Broadcast
            </h4>
            <div className="mb-2">
              {isQrConnected ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                  ● QR Active
                </span>
              ) : (
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                  Requires QR
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400 mt-1 leading-relaxed">
              Custom text, media &amp; buttons via connected QR number without template approval
            </p>
          </div>

          {/* 2. Official Cloud API Broadcast (Active when connected via Official Meta API) */}
          <div
            onClick={() => {
              if (isQrConnected) {
                toast.error("Cloud API Broadcast is disabled because your number is connected via WhatsApp QR Code. Use QR Broadcast instead.");
                return;
              }
              setCampaignCategory("broadcast");
              setIsTemplateMode(true);
              setPlatform("WHATSAPP");
              if (multiSelectionMode === "uploaded") {
                setMultiSelectionMode("individual");
              }
            }}
            className={cn(
              "p-5 rounded-2xl border-2 transition-all duration-300 relative select-none flex flex-col items-center text-center",
              isQrConnected
                ? "opacity-55 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                : "cursor-pointer hover:border-slate-200 dark:hover:border-slate-700",
              campaignCategory === "broadcast"
                ? "border-[#00B074] bg-[#00B074]/5 dark:bg-[#00B074]/10 shadow-md scale-[1.02] ring-2 ring-[#00B074]/20"
                : !isQrConnected ? "border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/60" : ""
            )}
          >
            {campaignCategory === "broadcast" && (
              <div className={cn("absolute top-3 w-5 h-5 rounded-full bg-[#00B074] text-white flex items-center justify-center", dir === "rtl" ? "left-3" : "right-3")}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-3",
              !isQrConnected ? "bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074]" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            )}>
              <Megaphone className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 mb-1">
              Cloud API Broadcast
            </h4>
            <div className="mb-2">
              {!isQrConnected ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                  ● API Active
                </span>
              ) : (
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                  Requires API
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400 mt-1 leading-relaxed">
              Meta-approved WhatsApp template broadcast to contacts and segments
            </p>
          </div>

          {/* 3. Drip */}
          <div
            onClick={() => {
              setCampaignCategory("drip");
              setIsTemplateMode(false);
            }}
            className={cn(
              "p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative select-none flex flex-col items-center text-center",
              campaignCategory === "drip"
                ? "border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 shadow-md scale-[1.02] ring-2 ring-purple-500/20"
                : "border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-700"
            )}
          >
            {campaignCategory === "drip" && (
              <div className={cn("absolute top-3 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center", dir === "rtl" ? "left-3" : "right-3")}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/20 text-purple-500 flex items-center justify-center mb-3">
              <Droplet className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 mb-1">
              {t("typeDrip")}
            </h4>
            <div className="mb-2">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                Sequencing
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400 mt-1 leading-relaxed">
              {t("dripDesc")}
            </p>
          </div>

          {/* 4. Automation */}
          <div
            onClick={() => {
              setCampaignCategory("automation");
              setIsTemplateMode(false);
              if (multiSelectionMode === "uploaded") {
                setMultiSelectionMode("individual");
              }
            }}
            className={cn(
              "p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative select-none flex flex-col items-center text-center",
              campaignCategory === "automation"
                ? "border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-md scale-[1.02] ring-2 ring-amber-500/20"
                : "border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-700"
            )}
          >
            {campaignCategory === "automation" && (
              <div className={cn("absolute top-3 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center", dir === "rtl" ? "left-3" : "right-3")}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center mb-3">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 mb-1">
              {t("typeAutomation")}
            </h4>
            <div className="mb-2">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                Event Triggers
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400 mt-1 leading-relaxed">
              {t("automationDesc")}
            </p>
          </div>

          {/* 5. A/B Test */}
          <div
            onClick={() => {
              setCampaignCategory("ab");
              setIsTemplateMode(true);
              if (multiSelectionMode === "uploaded") {
                setMultiSelectionMode("individual");
              }
            }}
            className={cn(
              "p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative select-none flex flex-col items-center text-center",
              campaignCategory === "ab"
                ? "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 shadow-md scale-[1.02] ring-2 ring-blue-500/20"
                : "border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 hover:border-slate-200 dark:hover:border-slate-700"
            )}
          >
            {campaignCategory === "ab" && (
              <div className={cn("absolute top-3 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center", dir === "rtl" ? "left-3" : "right-3")}>
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            )}
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-500 flex items-center justify-center mb-3">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100 mb-1">
              {t("typeAB")}
            </h4>
            <div className="mb-2">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                Split Test
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400 mt-1 leading-relaxed">
              {t("abDesc")}
            </p>
          </div>

        </div>

        {/* 2. Form - Two Columns Grid */}
        {campaignCategory !== "ab" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

            {/* Left Column Fields */}
            <div className="space-y-6">

              {/* Campaign Name */}
              <div className="space-y-2 text-start">
                <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-0.5">
                  {t("campaignNameLabel")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder={t("campaignNamePlaceholder")}
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 font-bold placeholder:text-slate-300 placeholder:font-semibold"
                />
              </div>


              <div className="space-y-2 text-start">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-1">
                      {campaignCategory === "qr_broadcast"
                        ? "QR BROADCAST MESSAGE"
                        : isTemplateMode
                          ? t("messageTemplateLabel")
                          : (t("customMessageLabel") || "CUSTOM MESSAGE")} <span className="text-red-500">*</span>
                    </Label>
                    {campaignCategory === "qr_broadcast" && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        Direct QR (No Template Approval Needed)
                      </span>
                    )}
                  </div>
                  {platform === "WHATSAPP" && !isQrConnected && campaignCategory !== "broadcast" && (
                    <button
                      type="button"
                      onClick={() => setIsTemplateMode(!isTemplateMode)}
                      className="text-[10px] font-bold text-[#00B074] tracking-wide hover:underline cursor-pointer"
                    >
                      {isTemplateMode ? t("useCustomText") : t("useTemplate")}
                    </button>
                  )}
                </div>

                {isTemplateMode ? (
                  <div className="relative">
                    <button
                      type="button"
                      disabled={isTemplatesLoading}
                      onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                      className={cn(
                        "w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-55 dark:hover:bg-slate-800 disabled:opacity-75 disabled:cursor-wait",
                        dir === "rtl" ? "text-right" : "text-left"
                      )}
                    >
                      <span className="truncate flex items-center gap-2">
                        {isTemplatesLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 text-[#00B074] animate-spin shrink-0" />
                            <span className="text-slate-400 font-semibold text-xs">Loading approved templates...</span>
                          </>
                        ) : selectedTemplate ? (
                          `${selectedTemplate.name} (${selectedTemplate.language})`
                        ) : (
                          t("selectTemplatePlaceholder")
                        )}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>

                    {isTemplateDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setIsTemplateDropdownOpen(false)}
                        />
                        <div className={cn(
                          "absolute top-full mt-2 bg-white dark:bg-[#0B0F1A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-40 max-h-[300px] overflow-y-auto space-y-3 animate-in fade-in slide-in-from-top-1 duration-150",
                          dir === "rtl" ? "right-0 left-0" : "left-0 right-0"
                        )}>

                          {/* Search bar inside template selector */}
                          <Input
                            placeholder={t("searchTemplatesPlaceholder")}
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            className="h-10 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs"
                          />

                          <div className="space-y-1">
                            {isTemplatesLoading ? (
                              <div className="space-y-2 py-2">
                                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                              </div>
                            ) : (
                              <>
                                {templates
                                  .filter((t) =>
                                    t.name.toLowerCase().includes(templateSearch.toLowerCase())
                                  )
                                  .map((tmpl) => (
                                    <div
                                      key={tmpl.name}
                                      onClick={() => {
                                        setSelectedTemplate(tmpl);
                                        setTemplateParams([]);
                                        setIsTemplateDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "flex justify-between items-center py-2.5 px-3 rounded-xl cursor-pointer hover:bg-slate-55 dark:hover:bg-slate-800 text-xs font-bold transition-all",
                                        selectedTemplate?.name === tmpl.name
                                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074]"
                                          : "text-slate-750 dark:text-slate-200"
                                      )}
                                    >
                                      <span className="truncate">{tmpl.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                        {tmpl.language}
                                      </span>
                                    </div>
                                  ))}

                                {templates.filter((tmpl) =>
                                  tmpl.name.toLowerCase().includes(templateSearch.toLowerCase())
                                ).length === 0 && (
                                  <div className="py-4 px-2 text-center text-xs text-slate-400 font-bold">
                                    {t("noTemplatesFound")}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                        {t("customMessageLabel") || "CUSTOM MESSAGE"}
                      </Label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">Insert:</span>
                        {COMMON_CONTACT_VARIABLES.slice(0, 3).map((v) => (
                          <button
                            key={v.value}
                            type="button"
                            onClick={() => insertVariableAtCursor(contentTextareaRef.current, content, v.value, setContent)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[#00B074] hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/50 dark:border-emerald-800 transition-colors cursor-pointer"
                            title={v.description}
                          >
                            + {v.label}
                          </button>
                        ))}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                            >
                              More...
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 shadow-xl rounded-xl p-1 z-50">
                            {COMMON_CONTACT_VARIABLES.map((v) => (
                              <DropdownMenuItem
                                key={v.value}
                                onClick={() => insertVariableAtCursor(contentTextareaRef.current, content, v.value, setContent)}
                                className="text-xs py-2 px-3 rounded-lg cursor-pointer flex flex-col items-start hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                              >
                                <span className="font-bold text-slate-800 dark:text-slate-200">{v.label}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{v.value}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <Textarea
                      ref={contentTextareaRef}
                      placeholder={t("customMessagePlaceholder")}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="min-h-[100px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl font-bold py-3 px-4 focus:ring-[#00B074]/20"
                    />

                    {/* Media Attachment (Left Column, exactly below Message) */}
                    <div className="space-y-1.5">
                      <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                        {t("mediaAttachmentLabel")}
                      </Label>

                      {!mediaUrl ? (
                        <button
                          type="button"
                          onClick={() => setIsMediaLibraryOpen(true)}
                          className="w-full h-11 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                        >
                          <Library className="w-4 h-4 text-[#00B074]" />
                          {t("chooseMediaBtn")}
                        </button>
                      ) : (
                        <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                            {isImageUrl(mediaUrl) ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{mediaUrl.split("/").pop()}</p>
                          </div>
                          <button type="button" onClick={removeAttachment} className="p-1.5 rounded-full hover:bg-slate-50 text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                        {t("interactiveButtonsLabel")}
                      </Label>

                      {/* Display added buttons */}
                      {buttons.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {buttons.map((btn) => {
                            const isUrl = btn.type === "url" || !!btn.url;
                            return (
                              <div
                                key={btn.id}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border text-xs font-extrabold shadow-sm transition-all",
                                  isUrl
                                    ? "border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400"
                                    : "border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-400"
                                )}
                              >
                                <span className="flex items-center gap-1">
                                  {isUrl ? (
                                    <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                  )}
                                  {btn.text}
                                </span>

                                <span className={cn(
                                  "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none",
                                  isUrl
                                    ? "bg-emerald-55 text-emerald-600"
                                    : "bg-blue-55 text-blue-600"
                                )}>
                                  {isUrl ? t("ctaLinkOption") : t("quickReplyOption")}
                                </span>

                                {isUrl && btn.url && (
                                  <span className="text-[9px] opacity-60 font-semibold truncate max-w-[120px]">
                                    {btn.url}
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setButtons((prev) =>
                                      prev.filter((b) => b.id !== btn.id)
                                    )
                                  }
                                  className={cn("text-rose-500 hover:text-rose-600 transition-colors cursor-pointer shrink-0", dir === "rtl" ? "mr-1" : "ml-1")}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {buttons.length < 3 && !buttons.some(b => b.type === "url" || !!b.url) ? (
                        <div className="space-y-3.5">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-widest block">
                              {t("buttonTypeLabel")}
                            </Label>
                            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setNewButtonType("reply")}
                                className={cn(
                                  "flex-1 py-2 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
                                  newButtonType === "reply"
                                    ? "bg-white dark:bg-slate-850 text-slate-800 dark:text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 bg-transparent"
                                )}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {t("quickReplyOption")}
                              </button>

                              <button
                                type="button"
                                disabled={buttons.length > 0}
                                onClick={() => setNewButtonType("url")}
                                className={cn(
                                  "flex-1 py-2 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none",
                                  newButtonType === "url"
                                    ? "bg-white dark:bg-slate-850 text-[#00B074] shadow-sm"
                                    : "text-slate-400 hover:text-slate-650 dark:hover:text-slate-355 bg-transparent",
                                  buttons.length > 0 && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                                {t("ctaLinkOption")}
                              </button>
                            </div>

                            {buttons.length > 0 && (
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold italic tracking-wide">
                                {t("buttonsWarning")}
                              </p>
                            )}
                          </div>

                          <div className={cn(
                            "grid gap-2.5",
                            newButtonType === "url" ? "grid-cols-2" : "grid-cols-1"
                          )}>
                            <div className="space-y-1.5">
                              <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("buttonTextLabel")}</Label>
                              <Input
                                placeholder={newButtonType === "url" ? t("ctaPlaceholder") : t("replyPlaceholder")}
                                value={newButtonText}
                                onChange={(e) => setNewButtonText(e.target.value.slice(0, 20))}
                                className="bg-white dark:bg-slate-900 h-10 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 focus:ring-[#00B074]/20 font-bold text-slate-700 dark:text-slate-200"
                              />
                              <div className={cn("text-[9px] text-slate-405 dark:text-slate-500 font-semibold pr-1", dir === "rtl" ? "text-left pl-1" : "text-right pr-1")}>
                                {t("charsLimit", { count: newButtonText.length })}
                              </div>
                            </div>

                            {newButtonType === "url" && (
                              <div className="space-y-1.5">
                                <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t("linkUrlLabel")}</Label>
                                <Input
                                  placeholder="https://example.com"
                                  value={newButtonUrl}
                                  onChange={(e) => setNewButtonUrl(e.target.value)}
                                  className="bg-white dark:bg-slate-900 h-10 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 focus:ring-[#00B074]/20 font-bold text-slate-700 dark:text-slate-200"
                                />
                                <div className={cn("text-[9px] text-slate-405 dark:text-slate-500 font-semibold pl-1", dir === "rtl" ? "pr-1" : "pl-1")}>
                                  {t("validUrlWarning")}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!newButtonText.trim()) {
                                toast.error("Button text is required");
                                return;
                              }
                              if (newButtonType === "url" && !newButtonUrl.trim()) {
                                toast.error("Link URL is required for Call-to-Action button");
                                return;
                              }

                              let formattedUrl = newButtonUrl.trim();
                              if (newButtonType === "url") {
                                // Basic validation & formatting
                                if (!/^https?:\/\//i.test(formattedUrl)) {
                                  formattedUrl = "https://" + formattedUrl;
                                }
                                try {
                                  new URL(formattedUrl);
                                } catch (_) {
                                  toast.error("Please enter a valid URL");
                                  return;
                                }
                              }

                              const newBtn = {
                                id: Math.random().toString(36).substring(2, 9),
                                text: newButtonText.trim(),
                                type: newButtonType,
                                url: newButtonType === "url" ? formattedUrl : undefined,
                              };
                              setButtons((prev) => [...prev, newBtn]);
                              setNewButtonText("");
                              setNewButtonUrl("");
                            }}
                            className="w-full h-10 bg-emerald-55/60 dark:bg-emerald-950/20 hover:bg-[#00B074]/15 text-[#00B074] rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
                          >
                            <Plus className="w-4 h-4" />
                            {t("addInteractiveBtn")}
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold italic tracking-wide mt-1 text-start">
                          {buttons.some(b => b.type === "url" || !!b.url)
                            ? t("ctaMaxLimit")
                            : t("buttonsMaxLimit")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-start">
                <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-0.5">
                  {t("targetAudienceLabel")} <span className="text-red-500">*</span>
                </Label>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <button
                      type="button"
                      disabled={isAudienceLoading}
                      onClick={() => setIsAudienceModalOpen(true)}
                      className={cn(
                        "w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-55 dark:hover:bg-slate-800 disabled:opacity-75 disabled:cursor-wait",
                        dir === "rtl" ? "text-right" : "text-left"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {isAudienceLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 text-[#00B074] animate-spin shrink-0" />
                            <span className="text-slate-400 font-semibold text-xs">Loading audience lists...</span>
                          </>
                        ) : targetType === "contact" ? (
                          selectedId
                            ? contacts.find((c) => c.id === selectedId)?.name || t("oneContactSelected")
                            : t("selectContactPlaceholder")
                        ) : getTargetedCount() > 0 ? (
                          t("recipientsSelected", { count: getTargetedCount() })
                        ) : (
                          t("selectAudiencePlaceholder")
                        )}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("multi");
                      setMultiSelectionMode("individual");
                      setIsAudienceModalOpen(true);
                    }}
                    className="px-4 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#00B074] hover:bg-[#00B074]/5 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("newListBtn")}
                  </button>
                </div>

                {/* Select Target Audience Sub-Modal */}
                <Dialog open={isAudienceModalOpen} onOpenChange={setIsAudienceModalOpen}>
                  <DialogContent dir={dir} className="max-w-[700px] w-full p-6 gap-5 bg-white dark:bg-[#0B0F1A] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col plus-jakarta-forced transition-colors duration-300">
                    <div className={cn("flex items-center gap-3 shrink-0", dir === "rtl" ? "text-right" : "text-left")}>
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                          {t("selectAudienceTitle")}
                        </DialogTitle>
                        <p className="text-slate-450 text-[11px] font-bold mt-0.5">
                          {t("selectAudienceSubtitle")}
                        </p>
                      </div>
                    </div>

                    {/* Tab Selection */}
                    <div className="flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                        <button
                          type="button"
                          onClick={() => setTargetType("contact")}
                          className={cn(
                            "px-2.5 py-1.5 rounded-md text-[10px] font-extrabold tracking-wide transition-all",
                            targetType === "contact"
                              ? "bg-white dark:bg-slate-700 text-[#00B074] shadow-sm"
                              : "text-slate-500"
                          )}
                        >
                          {t("singleTab")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetType("multi")}
                          className={cn(
                            "px-2.5 py-1.5 rounded-md text-[10px] font-extrabold tracking-wide transition-all",
                            targetType === "multi"
                              ? "bg-white dark:bg-slate-700 text-[#00B074] shadow-sm"
                              : "text-slate-500"
                          )}
                        >
                          {t("multiTab")}
                        </button>
                      </div>

                      {targetType === "multi" && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {([
                            "individual",
                            "group",
                            "tag",
                            "agent",
                            "open24",
                            "recency",
                            ...(campaignCategory === "drip" ? ["uploaded" as const] : [])
                          ] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                setMultiSelectionMode(mode as any);
                                setSelectedContactIds([]);
                                setSelectedGroupIds([]);
                                setSelectedTagIds([]);
                                setSelectedAgentIds([]);
                                setSelectedOpen24Ids([]);

                                if (mode !== "open24") {
                                  setWindowFilter("all");
                                } else {
                                  setWindowFilter("active");
                                }

                                if (mode !== "recency") {
                                  setDateFilter("all");
                                  setFilterStartDate("");
                                  setFilterEndDate("");
                                } else {
                                  setDateFilter("1day");
                                }
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-bold transition-all",
                                multiSelectionMode === mode
                                  ? campaignCategory === "drip" && mode === "uploaded"
                                    ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                    : "bg-[#00B074]/15 text-[#00B074]"
                                  : "text-slate-400 hover:text-slate-650"
                              )}
                            >
                              {mode === "individual"
                                ? t("contactsMode")
                                : mode === "tag"
                                  ? t("labelsMode")
                                  : mode === "open24"
                                    ? t("windowMode")
                                    : mode === "recency"
                                      ? t("recencyMode")
                                      : mode === "uploaded"
                                        ? "Uploaded Contacts"
                                        : `${mode}s`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Content Panel Area */}
                    <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] pr-1">
                      {isAudienceLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <Loader2 className="w-8 h-8 text-[#00B074] animate-spin" />
                          <span className="text-xs font-bold text-slate-400">Loading contacts...</span>
                        </div>
                      ) : targetType === "contact" ? (
                        <div className="space-y-3 text-start">
                          <Input
                            placeholder={t("searchSingleContact")}
                            value={contactSearch}
                            onChange={(e) => handleContactSearch(e.target.value)}
                            className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                          />
                          <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {filteredContacts.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setSelectedId(c.id);
                                  setIsAudienceModalOpen(false);
                                }}
                                className={cn(
                                  "flex justify-between items-center py-2 px-3 rounded-lg cursor-pointer hover:bg-slate-55 dark:hover:bg-slate-800 text-xs font-bold",
                                  selectedId === c.id ? "bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074]" : "text-slate-700 dark:text-slate-200"
                                )}
                              >
                                <span>{c.name || "Unnamed"} (+{c.waId})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 text-start">
                          {multiSelectionMode === "individual" && (
                            <div className="space-y-3">
                              <Input
                                placeholder={t("searchCampaigns")}
                                value={contactSearch}
                                onChange={(e) => handleContactSearch(e.target.value)}
                                className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                              />
                              <div className="flex items-center justify-between px-1 text-xs select-none">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allIds = filteredContacts.map(c => c.id);
                                    const allSelected = allIds.every(id => selectedContactIds.includes(id));
                                    if (allSelected) {
                                      setSelectedContactIds(prev => prev.filter(id => !allIds.includes(id)));
                                    } else {
                                      setSelectedContactIds(prev => [...new Set([...prev, ...allIds])]);
                                    }
                                  }}
                                  className="font-bold text-[#00B074] hover:underline uppercase tracking-wider text-[10px]"
                                >
                                  {filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.includes(c.id)) ? "Deselect All" : "Select All"}
                                </button>
                                {selectedContactIds.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedContactIds([])}
                                    className="font-bold text-red-500 hover:underline uppercase tracking-wider text-[10px]"
                                  >
                                    Clear Selection
                                  </button>
                                )}
                              </div>
                              <div className="max-h-[280px] overflow-y-auto space-y-1 grid grid-cols-2 gap-x-4">
                                {filteredContacts.map((c) => {
                                  const isChecked = selectedContactIds.includes(c.id);
                                  return (
                                    <label key={c.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-semibold">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedContactIds(prev =>
                                            isChecked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                          );
                                        }}
                                        className="w-3.5 h-3.5 rounded accent-[#00B074]"
                                      />
                                      <span>{c.name || "Unnamed"} (+{c.waId})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {multiSelectionMode === "group" && (
                            <div className="max-h-[280px] overflow-y-auto space-y-1 grid grid-cols-2 gap-x-4">
                              {groups.map((g) => {
                                const isChecked = selectedGroupIds.includes(g.id);
                                return (
                                  <label key={g.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-805 cursor-pointer text-xs font-semibold">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedGroupIds(prev =>
                                          isChecked ? prev.filter(id => id !== g.id) : [...prev, g.id]
                                        );
                                      }}
                                      className="w-3.5 h-3.5 rounded accent-[#00B074]"
                                    />
                                    <span>{g.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {multiSelectionMode === "tag" && (
                            <div className="grid grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto p-0.5">
                              {tags.map((tg) => {
                                const isChecked = selectedTagIds.includes(tg.id);
                                return (
                                  <label
                                    key={tg.id}
                                    style={{
                                      backgroundColor: isChecked ? `${tg.color}15` : `${tg.color}06`,
                                      borderColor: isChecked ? tg.color : `${tg.color}25`,
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 py-2 px-3 rounded-xl border cursor-pointer text-xs font-black transition-all duration-200 select-none hover:scale-[1.01] active:scale-[0.99]",
                                      isChecked ? "shadow-sm scale-[1.01]" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      style={{ accentColor: tg.color }}
                                      onChange={() => {
                                        setSelectedTagIds((prev) =>
                                          isChecked ? prev.filter((id) => id !== tg.id) : [...prev, tg.id]
                                        );
                                      }}
                                      className="w-3.5 h-3.5 rounded cursor-pointer accent-[#00B074]"
                                    />
                                    <span
                                      style={{ color: tg.color }}
                                      className="font-extrabold flex items-center gap-1.5"
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: tg.color }}
                                      />
                                      {tg.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {multiSelectionMode === "agent" && (
                            <div className="max-h-[280px] overflow-y-auto space-y-1 grid grid-cols-2 gap-x-4">
                              {agents.map((a) => {
                                const isChecked = selectedAgentIds.includes(a.id);
                                return (
                                  <label key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-semibold">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedAgentIds(prev =>
                                          isChecked ? prev.filter(id => id !== a.id) : [...prev, a.id]
                                        );
                                      }}
                                      className="w-3.5 h-3.5 rounded accent-[#00B074]"
                                    />
                                    <span>{a.name || a.email}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {multiSelectionMode === "open24" && (
                            <div className="space-y-3.5 py-1 px-0.5">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                                  {t("windowStatusLabel")}
                                </Label>
                                <select
                                  value={windowFilter === "all" ? "active" : windowFilter}
                                  onChange={(e) => setWindowFilter(e.target.value)}
                                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-250"
                                >
                                  <option value="active">{t("windowActive")}</option>
                                  <option value="expired">{t("windowExpired")}</option>
                                </select>
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold italic">
                                {t("windowDesc")}
                              </div>
                            </div>
                          )}

                          {multiSelectionMode === "recency" && (
                            <div className="space-y-3.5 py-1 px-0.5">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                                  {t("recencyLabel")}
                                </Label>
                                <select
                                  value={dateFilter}
                                  onChange={(e) => setDateFilter(e.target.value)}
                                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-xs font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-250"
                                >
                                  <option value="1day">{t("1dayAgo")}</option>
                                  <option value="2days">{t("2daysAgo")}</option>
                                  <option value="7days">{t("7daysAgo")}</option>
                                  <option value="custom">{t("customDateRange")}</option>
                                </select>
                              </div>

                              {dateFilter === "custom" && (
                                <div className="grid grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">{t("startDateLabel")}</Label>
                                    <Input
                                      type="date"
                                      value={filterStartDate}
                                      onChange={(e) => setFilterStartDate(e.target.value)}
                                      className="h-9 text-xs rounded-xl"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-slate-400 uppercase">{t("endDateLabel")}</Label>
                                    <Input
                                      type="date"
                                      value={filterEndDate}
                                      onChange={(e) => setFilterEndDate(e.target.value)}
                                      className="h-9 text-xs rounded-xl"
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="text-[10px] text-slate-400 font-semibold italic">
                                {t("recencyDesc")}
                              </div>
                            </div>
                          )}

                          {multiSelectionMode === "uploaded" && (
                            <div className="space-y-4 py-1 text-start">
                              {/* File Upload / Mapping or Paste Option */}
                              {parsedFileRows.length > 0 ? (
                                <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="flex items-center justify-between pb-2 border-b border-purple-200/60 dark:border-purple-800/40">
                                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-extrabold text-xs">
                                      <FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                      <span className="truncate">{uploadedFileName} ({parsedFileRows.length} rows detected)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleResetUpload}
                                      className="text-xs text-red-500 hover:underline font-bold shrink-0 cursor-pointer"
                                    >
                                      Change File
                                    </button>
                                  </div>

                                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                    Choose which columns from your spreadsheet correspond to the <strong>Phone Number</strong> and <strong>Contact Name</strong>:
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    {/* Phone Column (Required) */}
                                    <div className="space-y-1.5 text-start">
                                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                        Phone Number Column <span className="text-red-500">*</span>
                                      </Label>
                                      <select
                                        value={selectedPhoneColumn}
                                        onChange={(e) => setSelectedPhoneColumn(e.target.value)}
                                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                                      >
                                        <option value="">-- Select Phone Column --</option>
                                        {detectedColumns.map((col) => {
                                          const sampleVal = String(parsedFileRows[0]?.[col] ?? "").trim();
                                          return (
                                            <option key={col} value={col}>
                                              {col} {sampleVal ? `(e.g. ${sampleVal.slice(0, 18)})` : ""}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>

                                    {/* Name Column (Optional) */}
                                    <div className="space-y-1.5 text-start">
                                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Contact Name Column (Optional)
                                      </Label>
                                      <select
                                        value={selectedNameColumn}
                                        onChange={(e) => setSelectedNameColumn(e.target.value)}
                                        className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                                      >
                                        <option value="">-- (None / Default to "Contact") --</option>
                                        {detectedColumns.map((col) => {
                                          const sampleVal = String(parsedFileRows[0]?.[col] ?? "").trim();
                                          return (
                                            <option key={col} value={col}>
                                              {col} {sampleVal ? `(e.g. ${sampleVal.slice(0, 18)})` : ""}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Confirm / Process Button */}
                                  <div className="pt-1">
                                    <Button
                                      type="button"
                                      disabled={!selectedPhoneColumn || isImportingContacts}
                                      onClick={handleProcessMappedContacts}
                                      className="w-full h-10 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-500/10 cursor-pointer"
                                    >
                                      {isImportingContacts ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          <span>Importing & Matching Contacts...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-4 h-4" />
                                          <span>Confirm Mapping & Load {parsedFileRows.length} Contacts</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {/* Upload Box */}
                                  <div
                                    onClick={() => uploadInputRef.current?.click()}
                                    className="border-2 border-dashed border-purple-300 dark:border-purple-800/60 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all"
                                  >
                                    <input
                                      ref={uploadInputRef}
                                      type="file"
                                      accept=".xlsx, .xls, .csv"
                                      onChange={handleFileUploadForDrip}
                                      className="hidden"
                                    />
                                    <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1.5">
                                      <Upload className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                      Upload File (.xlsx, .csv)
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                      Detects all columns automatically
                                    </span>
                                  </div>

                                  {/* Paste Box */}
                                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between space-y-2 bg-slate-50/50 dark:bg-slate-900/40">
                                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                                      Or Paste Numbers (Line / Comma separated)
                                    </Label>
                                    <textarea
                                      value={pasteInputText}
                                      onChange={(e) => setPasteInputText(e.target.value)}
                                      placeholder="+923001234567, +923019876543&#10;John: +923001112233"
                                      rows={3}
                                      className="w-full text-xs font-mono p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                    <button
                                      type="button"
                                      disabled={isImportingContacts || !pasteInputText.trim()}
                                      onClick={handlePasteNumbersForDrip}
                                      className="w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      {isImportingContacts ? "Processing..." : "Add Pasted Numbers"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {uploadedFileStatus && (
                                <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                                  {uploadedFileStatus}
                                </p>
                              )}

                              {/* Selected / Parsed Numbers List */}
                              {uploadedContactsList.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center justify-between px-1 text-xs select-none">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                        Select Numbers ({selectedUploadedIds.length} of {uploadedContactsList.length} selected)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (selectedUploadedIds.length === uploadedContactsList.length) {
                                            setSelectedUploadedIds([]);
                                          } else {
                                            setSelectedUploadedIds(uploadedContactsList.map((c) => c.id));
                                          }
                                        }}
                                        className="font-bold text-purple-600 hover:underline uppercase tracking-wider text-[10px] cursor-pointer"
                                      >
                                        {selectedUploadedIds.length === uploadedContactsList.length ? "Deselect All" : "Select All"}
                                      </button>
                                      {selectedUploadedIds.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedUploadedIds([])}
                                          className="font-bold text-red-500 hover:underline uppercase tracking-wider text-[10px] cursor-pointer"
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="max-h-[220px] overflow-y-auto space-y-1 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 p-1">
                                    {uploadedContactsList.map((c) => {
                                      const isChecked = selectedUploadedIds.includes(c.id);
                                      return (
                                        <label
                                          key={c.id}
                                          className={cn(
                                            "flex items-center gap-2 py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors",
                                            isChecked
                                              ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-200"
                                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                                          )}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              setSelectedUploadedIds((prev) =>
                                                isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                              );
                                            }}
                                            className="w-3.5 h-3.5 rounded accent-purple-600"
                                          />
                                          <span className="truncate">{c.name || "Contact"} (+{c.waId})</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      )}
                    </div>

                    {/* Modal Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4 shrink-0">
                      <div className="text-xs font-extrabold text-[#00B074]">
                        {targetType === "contact"
                          ? t("singleRecipientTargeted")
                          : t("recipientsSelected", { count: getTargetedCount() })}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          onClick={() => setIsAudienceModalOpen(false)}
                          className="font-bold text-xs tracking-widest text-slate-550 dark:text-slate-400 hover:bg-slate-55 dark:hover:bg-slate-850 h-10 rounded-xl px-4"
                        >
                          {t("cancelBtn")}
                        </Button>
                        <Button
                          onClick={() => setIsAudienceModalOpen(false)}
                          className="bg-[#00B074] hover:bg-[#009A64] text-white font-bold h-10 rounded-xl text-xs tracking-widest px-6"
                        >
                          {t("confirmSelectionBtn")}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Schedule Options */}
              <div className="space-y-3 text-start">
                <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest">
                  {t("scheduleLabel")}
                </Label>

                {/* Inline Radios */}
                <div className="flex gap-6 items-center">

                  {/* Send Now */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={sendNow}
                      onChange={() => setSendNow(true)}
                      className="hidden"
                    />
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                      sendNow ? "border-[#00B074] bg-[#00B074]/10" : "border-slate-300 dark:border-slate-700"
                    )}>
                      {sendNow && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                    </div>
                    <span className="text-xs font-bold text-slate-750 dark:text-slate-300">{t("sendNowOption")}</span>
                  </label>

                  {/* Schedule Later */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={!sendNow}
                      onChange={() => setSendNow(false)}
                      className="hidden"
                    />
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                      !sendNow ? "border-[#00B074] bg-[#00B074]/10" : "border-slate-300 dark:border-slate-700"
                    )}>
                      {!sendNow && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                    </div>
                    <span className="text-xs font-bold text-slate-750 dark:text-slate-300">{t("scheduleLaterOption")}</span>
                  </label>

                </div>

                {/* Inputs Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Input
                      type="date"
                      value={scheduledDate}
                      disabled={sendNow}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-4 font-bold disabled:opacity-40"
                    />
                  </div>
                  <div className="relative">
                    <Input
                      type="time"
                      value={scheduledTime}
                      disabled={sendNow}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-4 font-bold disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Exclude Opted-out data Switch */}
              <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm mt-6">
                <div className="space-y-0.5 text-start">
                  <Label className="text-sm font-bold text-slate-900 dark:text-white block">Exclude Opted-out data</Label>
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-400 block">Skip users who have opted out from future campaign</span>
                </div>
                <Switch
                  checked={excludeOptedOut}
                  onCheckedChange={setExcludeOptedOut}
                  className={cn(!excludeOptedOut && "!bg-slate-200 dark:!bg-slate-700 !border-slate-200 dark:!border-slate-700")}
                />
              </div>

              {/* DRIP CAMPAIGN EXCLUSIVE SETTINGS */}
              {campaignCategory === "drip" && (
                <div className="space-y-4 p-5 bg-purple-500/5 dark:bg-purple-950/15 border border-purple-200/80 dark:border-purple-800/40 rounded-2xl mt-4">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <Droplet className="w-4 h-4 fill-purple-500/20" />
                    <span className="text-xs font-black uppercase tracking-wider">Drip Campaign Settings</span>
                  </div>

                  {/* Message Interval (Delay in seconds) */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="space-y-0.5 text-start">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Message Interval / Delay
                      </Label>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                        Delay between consecutive messages in this Drip Campaign (Anti-Ban safety)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min={1}
                        max={300}
                        value={dripIntervalSeconds}
                        onChange={(e) => setDripIntervalSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 h-9 text-center font-black text-xs bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-800/60 rounded-xl"
                      />
                      <span className="text-xs font-bold text-slate-500">sec</span>
                    </div>
                  </div>

                  {/* Fallback Template for Expired 24h Window */}
                  {!isTemplateMode && platform === "WHATSAPP" && (
                    <div className="space-y-2 pt-2 border-t border-purple-200/40 dark:border-purple-800/20 text-start">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Fallback Template for Expired 24h Window
                        </Label>
                        {dripFallbackTemplate && (
                          <button
                            type="button"
                            onClick={() => setDripFallbackTemplate(null)}
                            className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                        If an uploaded contact's 24-hour chat window has expired, this approved Meta template will be sent automatically so the message does not fail.
                      </span>

                      <div className="relative mt-2">
                        <button
                          ref={dripFallbackButtonRef}
                          type="button"
                          onClick={handleToggleDripFallbackDropdown}
                          className="w-full h-11 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs px-3.5 flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-purple-50/50 dark:hover:bg-purple-950/30 cursor-pointer"
                        >
                          <span className="truncate">
                            {dripFallbackTemplate ? `${dripFallbackTemplate.name} (${dripFallbackTemplate.language})` : "Select approved template for expired window..."}
                          </span>
                          <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200", isDripFallbackDropdownOpen && "rotate-180")} />
                        </button>

                        {isDripFallbackDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsDripFallbackDropdownOpen(false)}
                            />
                            <div
                              className={cn(
                                "absolute bg-white dark:bg-[#0B0F1A] border border-purple-200 dark:border-purple-800/80 rounded-2xl shadow-2xl p-3 z-50 max-h-[260px] overflow-y-auto space-y-2 left-0 right-0 duration-150",
                                dripFallbackPlacement === "top"
                                  ? "bottom-full mb-2 animate-in fade-in slide-in-from-bottom-2"
                                  : "top-full mt-2 animate-in fade-in slide-in-from-top-2"
                              )}
                            >
                              <Input
                                placeholder="Search approved templates..."
                                value={fallbackTemplateSearch}
                                onChange={(e) => setFallbackTemplateSearch(e.target.value)}
                                className="h-9 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs"
                              />
                              <div className="space-y-1">
                                {templates
                                  .filter((tpl) => tpl.status === "APPROVED" && (!fallbackTemplateSearch || tpl.name.toLowerCase().includes(fallbackTemplateSearch.toLowerCase())))
                                  .map((tpl) => (
                                    <button
                                      key={`${tpl.name}_${tpl.language}`}
                                      type="button"
                                      onClick={() => {
                                        setDripFallbackTemplate(tpl);
                                        setIsDripFallbackDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-start py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                                        dripFallbackTemplate?.name === tpl.name ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                      )}
                                    >
                                      <span>{tpl.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{tpl.language}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QR BROADCAST PACING & ANTI-BAN SETTINGS */}
              {campaignCategory === "qr_broadcast" && (
                <div className="space-y-4 p-5 bg-emerald-500/5 dark:bg-emerald-950/15 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-black uppercase tracking-wider">QR Broadcast Pacing & Anti-Ban Safety</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      Anti-Ban Protection
                    </span>
                  </div>

                  {/* 1. Dynamic Message Gap (Randomized Delay between consecutive messages) */}
                  <div className="p-3.5 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800/30 rounded-xl space-y-3">
                    <div className="space-y-0.5 text-start">
                      <div className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Dynamic Message Gap (Per-Message Delay)
                        </Label>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                        Randomized time delay before sending each individual message to simulate natural human typing.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1 text-start">
                        <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Min Delay (Seconds)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={300}
                            value={qrMinDelaySeconds}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setQrMinDelaySeconds(val);
                              if (val > qrMaxDelaySeconds) {
                                setQrMaxDelaySeconds(val);
                              }
                            }}
                            className="h-9 text-center font-black text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <span className="text-xs font-bold text-slate-500">sec</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-start">
                        <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Max Delay (Seconds)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={600}
                            value={qrMaxDelaySeconds}
                            onChange={(e) => {
                              const val = Math.max(qrMinDelaySeconds, parseInt(e.target.value) || qrMinDelaySeconds);
                              setQrMaxDelaySeconds(val);
                            }}
                            className="h-9 text-center font-black text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <span className="text-xs font-bold text-slate-500">sec</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Overall Batch Gap (Batch Cooldown / Pause) */}
                  <div className="p-3.5 bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-800/30 rounded-xl space-y-3">
                    <div className="space-y-0.5 text-start">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Overall Batch Gap (Batch Pause & Cooldown)
                        </Label>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                        Temporarily pauses transmission after every X messages to avoid high-volume account flags.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1 text-start">
                        <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Messages per Batch
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            value={qrBatchSize}
                            onChange={(e) => setQrBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-9 text-center font-black text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <span className="text-xs font-bold text-slate-500">msgs</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-start">
                        <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Batch Break / Wait Duration
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={3600}
                            value={qrBatchBreakSeconds}
                            onChange={(e) => setQrBatchBreakSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-9 text-center font-black text-xs bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <span className="text-xs font-bold text-slate-500">sec</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right Column Fields */}
            <div className="space-y-6">

              {/* Campaign Description */}
              <div className="space-y-2 text-start">
                <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest">
                  {t("campaignDescriptionLabel")}
                </Label>
                <div className="relative">
                  <Textarea
                    placeholder={t("campaignDescriptionPlaceholder")}
                    value={campaignDescription}
                    onChange={(e) => setCampaignDescription(e.target.value.slice(0, 500))}
                    className="min-h-[148px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl font-bold py-4 px-5 focus:ring-[#00B074]/20 placeholder:text-slate-300 placeholder:font-semibold text-slate-700 dark:text-slate-200"
                  />
                  <div className={cn("absolute bottom-3 text-[10px] font-bold text-slate-400", dir === "rtl" ? "left-4" : "right-4")}>
                    {campaignDescription.length}/500
                  </div>
                </div>
              </div>



              {/* Template Previews in Right Column (Conditional) */}
              {isTemplateMode && selectedTemplate && (
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-start">

                  {selectedTemplate.components?.some((c) => c.type === "HEADER" && (c.format === "IMAGE" || c.format === "VIDEO" || c.format === "DOCUMENT")) && (
                    <div className="space-y-1.5">
                      <Label className="text-[10.5px] font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                        {t("mediaAttachmentLabel")} <span className="text-red-500">*</span>
                      </Label>
                      {!mediaUrl ? (
                        <button
                          type="button"
                          onClick={() => setIsMediaLibraryOpen(true)}
                          className="w-full h-11 bg-slate-55 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-350 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                        >
                          <Library className="w-4 h-4 text-[#00B074]" />
                          {t("chooseMediaBtn")}
                        </button>
                      ) : (
                        <div className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-[#00B074] flex items-center justify-center">
                            {isImageUrl(mediaUrl) ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{mediaUrl.split("/").pop()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMediaUrl(null)}
                            className="p-1.5 rounded-full hover:bg-slate-50 text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Parameter Inputs if needed */}
                  {selectedTemplate.components?.find((c) => c.type === "BODY")?.example?.body_text?.[0] && (
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <Label className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest block mb-1">
                        {t("templateParametersLabel")}
                      </Label>
                      {selectedTemplate.components
                        .find((c) => c.type === "BODY")
                        ?.example?.body_text?.[0].map((exampleText: string, index: number) => (
                          <div key={index} className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500 ml-1">
                              Variable {"{{"}{index + 1}{"}}"} (e.g. {exampleText})
                            </Label>
                            <div className="flex gap-2">
                              <select
                                value={
                                  templateParams[index]?.startsWith("{{contact.")
                                    ? templateParams[index]
                                    : "static"
                                }
                                onChange={(e) => {
                                  const newParams = [...templateParams];
                                  if (e.target.value === "static") {
                                    newParams[index] = "";
                                  } else {
                                    newParams[index] = e.target.value;
                                  }
                                  setTemplateParams(newParams);
                                }}
                                className="w-1/3 bg-white dark:bg-slate-900 h-10 border border-slate-200 dark:border-slate-800 rounded-lg text-xs px-2 focus:ring-[#00B074]/20 font-bold outline-none text-slate-700 dark:text-slate-200"
                              >
                                <option value="static">Static Text</option>
                                <option value="{{contact.name}}">Contact Name</option>
                                <option value="{{contact.firstName}}">First Name</option>
                                <option value="{{contact.lastName}}">Last Name</option>
                                <option value="{{contact.waId}}">Mobile Number</option>
                                <option value="{{contact.email}}">Email</option>
                                {customFields.map((field) => (
                                  <option key={field} value={`{{contact.custom.${field}}}`}>
                                    {field} (Custom Field)
                                  </option>
                                ))}
                              </select>

                              {(!templateParams[index]?.startsWith("{{contact.")) && (
                                <Input
                                  placeholder={`${t("templateParametersLabel")} {{${index + 1}}}`}
                                  value={templateParams[index] || ""}
                                  onChange={(e) => {
                                    const newParams = [...templateParams];
                                    newParams[index] = e.target.value;
                                    setTemplateParams(newParams);
                                  }}
                                  className="flex-1 bg-white dark:bg-slate-900 h-10 border-slate-200 dark:border-slate-800 rounded-lg text-xs px-3 focus:ring-[#00B074]/20 font-bold"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Render WhatsApp template preview nicely */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">
                        {t("templatePreviewLabel")}
                      </span>
                    </div>
                    <div className="scale-[0.85] origin-top bg-white dark:bg-[#111b21] p-3 rounded-xl dark:border-slate-800 shadow-sm max-w-sm mx-auto">
                      <WhatsAppTemplatePreview
                        template={selectedTemplate as any}
                        getStatusColor={() => "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}
                        testValues={templateParams.reduce((acc, val, idx) => {
                          if (val) acc[(idx + 1).toString()] = val;
                          return acc;
                        }, {} as Record<string, string>)}
                        mediaUrl={mediaUrl}
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* Regular Content Attachment in Right Column (Conditional) */}
              {!isTemplateMode && (
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-start">

                  {/* WhatsApp Custom Chat Bubble Live Preview */}
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">
                        {t("customPreviewLabel")}
                      </span>
                    </div>

                    <div className="scale-[0.88] origin-top bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-2xl dark:border-slate-800 shadow-sm max-w-sm mx-auto min-h-[160px] flex flex-col justify-start relative overflow-hidden">
                      {/* WhatsApp Chat pattern background */}
                      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

                      {/* Message Bubble Container */}
                      <div className={cn(
                        "relative z-10 bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-2xl p-3 shadow-md text-xs break-words max-w-[90%] flex flex-col gap-1.5 transition-all duration-200",
                        dir === "rtl" ? "rounded-tl-none self-start" : "rounded-tr-none self-end"
                      )}>
                        {mediaUrl && (
                          <div className="mb-1 rounded-lg overflow-hidden bg-white/40 max-h-[140px] flex items-center justify-center border border-slate-200/10">
                            {isImageUrl(mediaUrl) ? (
                              <img src={mediaUrl} className="w-full h-full object-cover" alt="Campaign Media" />
                            ) : (
                              <div className="p-3 text-[10px] flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-100">
                                <FileIcon className="w-4 h-4 shrink-0 text-emerald-600" />
                                <span className="truncate max-w-[150px]">{mediaUrl.split("/").pop()}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <p className="whitespace-pre-wrap font-semibold leading-relaxed">
                          {content || t("previewPlaceholder")}
                        </p>

                        {buttons.length > 0 && (
                          <div className="mt-1 pt-1.5 border-t border-slate-200/30 dark:border-slate-700/30 flex flex-col gap-1">
                            {buttons.map((btn) => {
                              const isUrl = btn.type === "url" || !!btn.url;
                              return (
                                <div
                                  key={btn.id}
                                  className="bg-white dark:bg-[#202c33] text-[#00a884] dark:text-[#00a884] text-[10px] font-extrabold text-center py-2 rounded-xl shadow-sm select-none transition-all active:scale-[0.98] flex items-center justify-center gap-1"
                                >
                                  {isUrl && <Link2 className="w-3 h-3 text-[#00a884]" />}
                                  <span>{btn.text}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <span className="text-[9px] opacity-65 text-right block leading-none self-end mt-0.5 font-bold">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="space-y-8">
            {/* General Settings Top Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-6">
              <h3 className="text-sm font-extrabold text-slate-850 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2 select-none text-start">
                <Sparkles className="w-5 h-5 text-[#00B074]" />
                A/B Campaign Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* Campaign Name */}
                <div className="space-y-2 text-start">
                  <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-0.5">
                    {t("campaignNameLabel")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder={t("campaignNamePlaceholder")}
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 font-bold placeholder:text-slate-300 placeholder:font-semibold"
                  />
                </div>
                {/* Target Audience */}
                <div className="space-y-2 text-start">
                  <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest flex items-center gap-0.5">
                    {t("targetAudienceLabel")} <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetType("multi");
                        setIsAudienceModalOpen(true);
                      }}
                      className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="truncate">
                        {getTargetedCount() > 0
                          ? t("recipientsSelected", { count: getTargetedCount() })
                          : t("selectAudiencePlaceholder")}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                {/* Schedule Options */}
                <div className="space-y-2 text-start">
                  <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest block mb-1">
                    {t("scheduleLabel")}
                  </Label>
                  <div className="flex gap-4 items-center h-10 select-none">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleMode"
                        checked={sendNow}
                        onChange={() => setSendNow(true)}
                        className="hidden"
                      />
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                        sendNow ? "border-[#00B074] bg-[#00B074]/10" : "border-slate-300 dark:border-slate-700"
                      )}>
                        {sendNow && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                      </div>
                      <span className="text-xs font-bold text-slate-750 dark:text-slate-300">{t("sendNowOption")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleMode"
                        checked={!sendNow}
                        onChange={() => setSendNow(false)}
                        className="hidden"
                      />
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                        !sendNow ? "border-[#00B074] bg-[#00B074]/10" : "border-slate-300 dark:border-slate-700"
                      )}>
                        {!sendNow && <div className="w-2 h-2 rounded-full bg-[#00B074]" />}
                      </div>
                      <span className="text-xs font-bold text-slate-750 dark:text-slate-300">{t("scheduleLaterOption")}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Exclude Opted-out data Switch */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm md:col-span-3">
                  <div className="space-y-0.5 text-start">
                    <Label className="text-sm font-bold text-slate-900 dark:text-white block">Exclude Opted-out data</Label>
                    <span className="text-[10px] font-bold text-slate-450 dark:text-slate-400 block">Skip users who have opted out from future campaign</span>
                  </div>
                  <Switch
                    checked={excludeOptedOut}
                    onCheckedChange={setExcludeOptedOut}
                    className={cn(!excludeOptedOut && "!bg-slate-200 dark:!bg-slate-700 !border-slate-200 dark:!border-slate-700")}
                  />
                </div>

                {/* Campaign Description */}
                <div className="space-y-2 text-start md:col-span-2">
                  <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest">
                    {t("campaignDescriptionLabel")}
                  </Label>
                  <Input
                    placeholder={t("campaignDescriptionPlaceholder")}
                    value={campaignDescription}
                    onChange={(e) => setCampaignDescription(e.target.value)}
                    className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm px-4 focus:ring-[#00B074]/20 font-semibold"
                  />
                </div>
                {/* Date & Time if scheduled */}
                {!sendNow && (
                  <div className="space-y-2 text-start">
                    <Label className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-widest block">
                      Launch Schedule Date & Time
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-2 font-bold"
                      />
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs px-2 font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Variant Split Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {renderVariantForm("A")}
              {renderVariantForm("B")}
            </div>
          </div>
        )}


      </div>

      {/* Sticky Premium Actions Footer */}
      <div className="p-6 border-t border-slate-100 dark:border-slate-855 flex items-center justify-end bg-white dark:bg-[#0B0F1A] shrink-0">


        {/* Cancel & Create */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push('/campaign')}
            className="font-bold text-xs tracking-widest text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t("cancelBtn")}
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isLoading || isDataLoading}
            className="bg-[#00B074] hover:bg-[#009A64] text-white font-bold px-8 h-11 rounded-xl text-xs tracking-widest transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 border-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("creatingBtn")}</span>
              </>
            ) : (
              <>
                <Send className={cn("w-3.5 h-3.5", dir === "rtl" ? "-rotate-45" : "rotate-45")} />
                <span>{t("createCampaignBtn")}</span>
              </>
            )}
          </Button>
        </div>

      </div>

      <MediaLibraryModal
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        onSelect={(url) => setMediaUrl(url)}
        contentType={(selectedTemplate?.components?.find((c: any) => c.type === 'HEADER')?.format?.toLowerCase() as any) || 'image'}
      />

      <MediaLibraryModal
        isOpen={isMediaLibraryOpenA}
        onClose={() => setIsMediaLibraryOpenA(false)}
        onSelect={(url) => setMediaUrlA(url)}
        contentType={(selectedTemplateA?.components?.find((c: any) => c.type === 'HEADER')?.format?.toLowerCase() as any) || 'image'}
      />

      <MediaLibraryModal
        isOpen={isMediaLibraryOpenB}
        onClose={() => setIsMediaLibraryOpenB(false)}
        onSelect={(url) => setMediaUrlB(url)}
        contentType={(selectedTemplateB?.components?.find((c: any) => c.type === 'HEADER')?.format?.toLowerCase() as any) || 'image'}
      />

    </div>
  );
}
