"use client";

import { useState, useEffect, useRef } from "react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { useTranslations, useLocale } from 'next-intl'
import { useSession } from "next-auth/react"
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay"
import { Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { FileText, Plus, Loader2, CheckCircle2, AlertCircle, Clock, Search, Filter, ExternalLink, ArrowRight, Trash2, Download, Upload, FileJson, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { hasPermission } from '@/lib/permissions'

import { WhatsAppTemplatePreview, type MessageTemplate, type TemplateComponent } from "@/components/whatsapp/WhatsAppTemplatePreview"
import Link from "next/link"
import { useUserStatus } from "@/hooks/useUserStatus"

export default function TemplatesPage() {
  const { data: session } = useSession();
  const { whatsappConnected, whatsappConnectionMethod } = useUserStatus();
  const isQr = whatsappConnectionMethod === "qr" || (session?.user as any)?.whatsappConnectionMethod === "qr";
  const t = useTranslations('TemplatesPage');
  const locale = useLocale();
  const isRTL = ['ur', 'ar'].includes(locale);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsTemplate, setDetailsTemplate] = useState<MessageTemplate | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [body, setBody] = useState("");
  const [buttons, setButtons] = useState<Array<{
    type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY";
    text: string;
    url?: string;
    phone_number?: string;
  }>>([]);

  // Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [detailTestValues, setDetailTestValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(6);

  const canCreate = hasPermission(session, ['tpl_super', 'tpl_create', 'templates:Create Templates']);
  const canDelete = hasPermission(session, ['tpl_super', 'tpl_delete', 'templates:Delete Templates', 'templates:Create Templates']);
  const canEdit = hasPermission(session, ['tpl_super', 'tpl_edit', 'templates:Edit Templates', 'templates:Create Templates']);

  const handleDelete = async () => {
    if (!detailsTemplate) return;
    setIsDeleting(true);
    const toastId = toast.loading("Deleting template...");
    try {
      const result = await deleteMessageTemplate(detailsTemplate.name, detailsTemplate.id);
      if (result.success) {
        toast.success("Template deleted successfully!", { id: toastId });
        setDetailsTemplate(null);
        setIsDeleteConfirmOpen(false);
        await fetchTemplates();
      } else {
        toast.error(result.error || "Failed to delete template", { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while deleting template", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchTemplates = async (force: boolean = false) => {
    try {
      console.log("[fetchTemplates] Started. Force:", force);
      setIsLoading(true);
      const result = await getMessageTemplates(force);
      console.log("[fetchTemplates] Result received:", result);

      if (result.success) {
        setTemplates(result.data);
        if (result.data.length > 0) setIsConnected(true);
        setApiError(null);
      } else {
        setApiError(result.error || "Failed to load templates");
        setTemplates([]);
        if (result.error === 'WhatsApp not configured') {
          setIsConnected(false);
        }
      }
    } catch (error) {
      console.error("[fetchTemplates] Failed:", error);
      setApiError("An unexpected error occurred while fetching templates.");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnection = async () => {
    );
    setIsConnected(connected);
  };

  useEffect(() => {
    if (isQr) {
      setIsLoading(false);
      return;
    }
    const init = async () => {
      await checkConnection();
      await fetchTemplates(true);
    };
    init();
  }, [isQr]);

  const handleCreate = async () => {
    console.log("[handleCreate] Start", { name, category, language, body, buttons });
    if (!name || !body) return;
    setIsCreating(true);
    const toastId = toast.loading("Submitting template for review...");

    try {
      const formattedName = name.toLowerCase().replace(/\s+/g, '_');
      console.log("[handleCreate] Calling server action...");
      const result = await createMessageTemplate(name, category, language, body, buttons);
      console.log("[handleCreate] Server action result:", result);

      if (!result.success) {
        toast.error(result.error || "Failed to submit template", { id: toastId });
        // We don't close the dialog so the user can see/fix the error
        return;
      }

      // Optimistic update: Add to list immediately
      const newTemplate: MessageTemplate = {
        name: formattedName,
        category: category,
        language: language,
        status: "PENDING",
        components: [
          { type: "BODY", text: body },
          ...(buttons.length > 0 ? [{ type: "BUTTONS" as const, buttons: buttons }] : [])
        ]
      };
      console.log("[handleCreate] Adding optimistic template", newTemplate);
      setTemplates(prev => [newTemplate, ...prev]);

      toast.success("Template submitted successfully!", { id: toastId });
      setIsDialogOpen(false);

      // Reset form
      setName("");
      setBody("");
      setCategory("MARKETING");
      setButtons([]);

      // Refresh the whole list to sync with server
      await fetchTemplates();
    } catch (error) {
      console.error("[handleCreate] Error captured:", error);
      toast.error((error as Error).message, { id: toastId });
    } finally {
      console.log("[handleCreate] Setting isCreating to false");
      setIsCreating(false);
    }
  };

  const handleExportSingle = (template: MessageTemplate) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `template_${template.name}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success(`Template ${template.name} exported`);
  };

  const handleExportAll = () => {
    if (templates.length === 0) {
      toast.error("No templates to export");
      return;
    }
    const dataStr = JSON.stringify(templates, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `all_templates_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    toast.success("All templates exported");
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);

        const toastId = toast.loading("Importing template(s)...");

        const templatesToImport = Array.isArray(importedData) ? importedData : [importedData];

        // Filter out templates that already exist by name
        const existingNames = new Set(templates.map(t => t.name.toLowerCase()));
        const filteredTemplates = templatesToImport.filter(t => !existingNames.has(t.name.toLowerCase()));

        const skippedCount = templatesToImport.length - filteredTemplates.length;

        if (filteredTemplates.length === 0) {
          toast.info(skippedCount > 0 ? "All templates already exist" : "No templates to import", { id: toastId });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const template of filteredTemplates) {
          const result = await importMessageTemplate(template as MessageTemplate);
          if (result.success) {
            successCount++;
          } else {
            console.error(`Failed to import ${template.name}:`, result.error);
            errorCount++;
          }
        }

        if (successCount > 0) {
          const msg = skippedCount > 0
            ? `Imported ${successCount} template(s), skipped ${skippedCount} duplicates`
            : `Successfully imported ${successCount} template(s)`;
          toast.success(msg, { id: toastId });
          await fetchTemplates();
        } else {
          toast.error(`Failed to import templates. Errors: ${errorCount}`, { id: toastId });
        }
      } catch (error) {
        console.error("Import failed:", error);
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const getStatusColor = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'APPROVED': return 'bg-[#00B074]/10 text-[#00B074] border-[#00B074]/20';
      case 'REJECTED':
      case 'FAILED': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'PENDING':
      case 'IN_REVIEW':
      case 'IN_PROGRESS': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-muted/10 text-muted-foreground border-border/50';
    }
  };

  const getStatusIcon = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'APPROVED': return <CheckCircle2 className="w-3 h-3 mr-1.5 rtl:mr-0 rtl:ml-1.5" />;
      case 'REJECTED':
      case 'FAILED': return <AlertCircle className="w-3 h-3 mr-1.5 rtl:mr-0 rtl:ml-1.5" />;
      case 'PENDING':
      case 'IN_REVIEW':
      case 'IN_PROGRESS': return <Clock className="w-3 h-3 mr-1.5 rtl:mr-0 rtl:ml-1.5" />;
      default: return null;
    }
  };

  // Derived State for Filtering & Pagination
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.components?.find((c: TemplateComponent) => c.type === 'BODY')?.text?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "ALL" || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const paginatedTemplates = itemsPerPage === 'all'
    ? filteredTemplates
    : filteredTemplates.slice((currentPage - 1) * (itemsPerPage as number), currentPage * (itemsPerPage as number));

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(filteredTemplates.length / (itemsPerPage as number));

  return (
    <DashboardLayoutClient mainClassName="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/20 antialiased transition-colors duration-300 plus-jakarta-forced">
      {isQr ? (
        <LockedPageOverlay
          title="Templates Restricted for QR Connections"
          description="You are connected via WhatsApp QR Code. QR mode allows sending direct, free-form messages, media, and broadcasts instantly without needing Meta-approved message templates. Message templates are only available for Meta Official Cloud API accounts."
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
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className={`space-y-1 ${isRTL ? 'text-right' : ''}`}>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 sm:w-6 h-6 text-[#00B074]" />
              {t('messageTemplates')}
            </h2>
            <p className={`text-slate-450 dark:text-slate-400 text-xs sm:text-[13px] font-semibold ${isRTL ? 'text-right' : ''}`}>
              {t('standardizedFormatting')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto rtl:flex-row-reverse">
            <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200/60 dark:border-slate-800 shadow-sm h-10">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleFileImport}
              />
              {canCreate && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-2.5 sm:px-3 text-[10px] font-extrabold tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all rounded-lg cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 mr-1 sm:mr-1.5 inline" />
                  {t('import')}
                </button>
              )}

              <button
                onClick={handleExportAll}
                className="h-8 px-2.5 sm:px-3 text-[10px] font-extrabold tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1 sm:mr-1.5 inline" />
                {t('exportAll')}
              </button>
            </div>

            <button
              onClick={() => fetchTemplates(true)}
              disabled={isLoading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs disabled:opacity-50 cursor-pointer h-10"
              title="Sync latest templates and review status directly from Meta"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-[#00B074]", isLoading && "animate-spin")} />
              <span>Sync with Meta</span>
            </button>

            {canCreate && (
              <Link href={`/${locale}/templates/create`} className="flex-1 sm:flex-initial">
                <button className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-[#00B074] hover:bg-[#009c66] rounded-xl text-[13px] font-bold text-white transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-500/20 h-10">
                  <Plus className="w-4 h-4" />
                  {t('createTemplate')}
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* API Error Notification */}

        {apiError && (
          <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-red-500/10 transition-colors duration-500" />
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 space-y-2 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-red-600">Meta API Connectivity Restricted</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchTemplates(true)}
                  className="h-7 px-3 rounded-lg text-[10px] font-bold  tracking-widest text-red-600 hover:bg-red-500/10 hover:text-red-700 transition-all gap-1.5 border border-red-500/20"
                >
                  <Clock className="w-3 h-3" />
                  {t('retryConnection')}
                </Button>
              </div>
              <p className="text-xs font-semibold text-red-600/80 leading-relaxed max-w-2xl">
                {apiError === 'API access blocked.'
                  ? "Your Meta App is currently blocking API access. This usually happens if the app is in'Development Mode' and hasn't been granted permission to access this WhatsApp Business Account, or if your account has been restricted by Meta."
                  : apiError
                }
              </p>
              <div className="pt-1 flex items-center gap-4">
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-red-600/60 hover:text-red-600  tracking-widest flex items-center gap-1.5 transition-colors"
                >
                  Check Meta Developer Dashboard
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-[10px] font-bold text-red-600/30">|</span>
                <p className="text-[10px] font-bold text-red-600/60  tracking-widest font-mono">
                  Status: 400 Bad Request
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Template Details Sidebar */}
        <Sheet open={!!detailsTemplate} onOpenChange={(open) => !open && setDetailsTemplate(null)}>
          <SheetContent className="w-full max-w-[100vw] sm:max-w-md p-0 overflow-hidden bg-white dark:bg-[#111b21] border-l border-gray-200 dark:border-slate-800 flex flex-col plus-jakarta-forced">
            {detailsTemplate && (
              <>
                <SheetHeader className="p-4 sm:p-6 md:p-8 pb-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-[#1f2c33]/50">
                  <div className="flex items-center gap-2 flex-wrap mb-3 sm:mb-4">
                    <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-[#00B074]/10 text-[#00B074] border-none px-2.5 sm:px-3 py-1">
                      {detailsTemplate.language}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-gray-200/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-none px-2.5 sm:px-3 py-1">
                      {detailsTemplate.category}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[9px] sm:text-[10px] font-bold tracking-widest px-2.5 sm:px-3 py-1 rounded-full border shadow-sm", getStatusColor(detailsTemplate.status ?? "PENDING"))}>
                      {getStatusIcon(detailsTemplate.status ?? "PENDING")}
                      {detailsTemplate.status ?? "PENDING"}
                    </Badge>
                  </div>
                  <SheetTitle className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827] dark:text-gray-100 leading-tight group flex items-center gap-2 break-words">
                    {detailsTemplate.name}
                  </SheetTitle>
                  <SheetDescription className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {t('templateDetails')}
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
                    <div>
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500">{t('messagingPreview')}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[9px] font-bold text-emerald-600 tracking-tight">{t('activeRendering')}</span>
                        </div>
                      </div>
                      <div className="w-full flex justify-center mb-6 sm:mb-8 overflow-hidden">
                        <WhatsAppTemplatePreview
                          template={detailsTemplate}
                          getStatusColor={getStatusColor}
                          testValues={detailTestValues}
                        />
                      </div>
                    </div>

                    {/* Dynamic Test Inputs */}
                    {(() => {
                      const bodyText = detailsTemplate.components?.find(c => c.type === "BODY")?.text || "";
                      const headerText = detailsTemplate.components?.find(c => c.type === "HEADER")?.text || "";
                      const allText = headerText + " " + bodyText;
                      const matches = Array.from(allText.matchAll(/\{\{(\d+)\}\}/g));
                      const uniqueIndices = Array.from(new Set(matches.map(m => m[1]))).sort((a, b) => parseInt(a) - parseInt(b));

                      if (uniqueIndices.length === 0) return null;

                      return (
                        <div className="space-y-4 pt-5 sm:pt-6 border-t border-gray-100 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-bold text-gray-400 tracking-widest">{t('testVariables')}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailTestValues({})}
                              className="h-6 px-2 text-[9px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 tracking-tight"
                            >
                              {t('clearAll')}
                            </Button>
                          </div>
                          <div className="grid gap-3">
                            {uniqueIndices.map((idx) => (
                              <div key={idx} className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 ml-1">
                                  Variable {"{{"}{idx}{"}}"}
                                </label>
                                <Input
                                  placeholder={`Enter value for parameter ${idx}...`}
                                  value={detailTestValues[idx] || ""}
                                  onChange={(e) => setDetailTestValues(prev => ({ ...prev, [idx]: e.target.value }))}
                                  className="h-9 bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 rounded-lg text-xs focus-visible:ring-emerald-500/20"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-6 pt-5 sm:pt-6 border-t border-gray-100 dark:border-slate-800">
                      <div className="bg-gray-50/80 dark:bg-slate-800/30 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-700/50 space-y-4">
                        <div>
                          <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block mb-1.5">{t('registryIdentifier')}</span>
                          <p className="text-xs font-bold text-[#111827] dark:text-gray-100 font-mono break-all bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2.5 rounded-lg shadow-sm">
                            {detailsTemplate.id || 'registry_not_synced'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block mb-1">{t('status')}</span>
                            <p className="text-xs font-bold text-[#111827] dark:text-gray-200 ">{detailsTemplate.status || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 block mb-1">{t('region')}</span>
                            <p className="text-xs font-bold text-[#111827] dark:text-gray-200 ">{detailsTemplate.language}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 pt-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                  <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => handleExportSingle(detailsTemplate)}
                      className="rounded-xl font-bold text-[10px] h-9 sm:h-10 px-2 sm:px-4 tracking-wider sm:tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center"
                    >
                      <FileJson className="w-3.5 h-3.5 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="truncate">{t('exportJson')}</span>
                    </Button>
                    {canEdit && detailsTemplate.id && (
                      <Link
                        href={detailsTemplate.status === 'PENDING' ? '#' : `/${locale}/templates/edit/${detailsTemplate.id}`}
                        onClick={(e) => detailsTemplate.status === 'PENDING' && e.preventDefault()}
                        className="w-full sm:w-auto"
                      >
                        <Button
                          variant="outline"
                          disabled={detailsTemplate.status === 'PENDING'}
                          className="w-full rounded-xl font-bold text-[10px] h-9 sm:h-10 px-2 sm:px-4 tracking-wider sm:tracking-widest hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          title={detailsTemplate.status === 'PENDING' ? "Template is under review and cannot be edited" : ""}
                        >
                          {t('edit')}
                        </Button>
                      </Link>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="rounded-xl font-bold text-[10px] h-9 sm:h-10 px-2 sm:px-4 tracking-wider sm:tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1 sm:mr-1.5 shrink-0" />
                        <span>{t('delete')}</span>
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setDetailsTemplate(null)}
                    className="w-full sm:w-auto rounded-xl font-bold text-[10px] h-9 sm:h-10 px-4 tracking-wider sm:tracking-widest hover:bg-gray-100 dark:hover:bg-slate-700 transition-all text-[#374151] dark:text-gray-200 justify-center"
                  >
                    {t('closeDetails')}
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
        {/* Status Overview Cards */}
        {templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-950 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between rtl:flex-row-reverse">
              <div>
                <p className="text-[10px] font-bold  tracking-widest text-emerald-600 dark:text-emerald-500 mb-1 rtl:text-right">{t('approved')}</p>
                <h4 className="text-2xl font-bold text-[#111827] dark:text-gray-100 rtl:text-right">{templates.filter(t => String(t.status || '').toUpperCase() === 'APPROVED').length}</h4>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-950 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between rtl:flex-row-reverse">
              <div>
                <p className="text-[10px] font-bold  tracking-widest text-amber-500 mb-1 rtl:text-right">{t('pendingReview')}</p>
                <h4 className="text-2xl font-bold text-[#111827] dark:text-gray-100 rtl:text-right">{templates.filter(t => {
                  const s = String(t.status || '').toUpperCase();
                  return s === 'PENDING' || s === 'IN_REVIEW' || s === 'IN_PROGRESS';
                }).length}</h4>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-950 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between rtl:flex-row-reverse">
              <div>
                <p className="text-[10px] font-bold  tracking-widest text-red-500 mb-1 rtl:text-right">{t('rejected')}</p>
                <h4 className="text-2xl font-bold text-[#111827] dark:text-gray-100 rtl:text-right">{templates.filter(t => {
                  const s = String(t.status || '').toUpperCase();
                  return s === 'REJECTED' || s === 'FAILED';
                }).length}</h4>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </div>
        )}

        {/* Search Toolbar */}
        <div className="flex items-center justify-between rtl:flex-row-reverse">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450 group-focus-within:text-[#00B074] transition-colors" />
            <input
              placeholder={t('searchTemplates')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none focus:border-[#00B074] transition-all pl-9 rtl:pl-8 rtl:pr-9 rtl:text-right"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-muted/10 rounded-2xl animate-pulse border border-gray-200 dark:border-slate-700/50" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-[#F3F4F6] dark:bg-slate-800/10 p-[0.8px] rounded-3xl overflow-hidden border border-transparent dark:border-slate-800/50">
            <div className="bg-white dark:bg-[#111b21] rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]" style={{ boxShadow: "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px" }}>
              <div className="w-20 h-20 rounded-2xl bg-[#00B074]/10 flex items-center justify-center border border-[#00B074]/20 relative">
                <FileText className="w-10 h-10 text-[#00B074]" />
                {!isConnected && (
                  <div className="absolute -top-2 -right-2 bg-amber-500 rounded-full p-1 border-2 border-white dark:border-slate-900">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-[#111827] dark:text-gray-100">
                  {isConnected === false ? t('whatsappNotConnected') : t('libraryEmpty')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
                  {isConnected === false
                    ? t('whatsappNotConnectedDescription')
                    : t('libraryEmptyDescription')
                  }
                </p>
              </div>
              {isConnected === false ? (
                <Button
                  className="h-11 px-8 rounded-xl font-bold text-xs bg-[#00B074] hover:bg-[#009662] text-white shadow-lg  tracking-widest "
                  onClick={() => window.location.href = '/admin/configurations/whatsapp'}
                >
                  {t('connectWhatsApp')}
                </Button>
              ) : canCreate ? (
                <Button
                  className="h-11 px-8 rounded-xl font-bold text-xs bg-[#00B074] hover:bg-[#009662] text-white shadow-lg  tracking-widest flex items-center gap-2 "
                  onClick={() => { /* setDialogOpen logic here */ }}
                >
                  <Plus className="w-4 h-4" />
                  {t('generateFirstTemplate')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter & Pagination Controls moved to top */}
            {filteredTemplates.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between rtl:flex-row-reverse gap-3 sm:gap-4 pb-2">
                {/* Category Filter Pill */}
                <div>
                  <Select value={filterCategory} onValueChange={(val) => {
                    setFilterCategory(val);
                    setCurrentPage(1); // Reset to first page on filter change
                  }}>
                    <SelectTrigger className="w-full sm:w-auto min-w-[160px] h-9 rounded-full border-[#00B074] hover:bg-[#00B074]/5 transition-colors bg-transparent text-[11px] font-bold tracking-widest text-[#111b21] dark:text-gray-200 px-4">
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-[#111b21] dark:text-gray-200" />
                        <SelectValue placeholder={t('allCategories')} />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-200 dark:border-slate-800 ">
                      <SelectItem value="ALL">{t('allCategories')}</SelectItem>
                      <SelectItem value="MARKETING">{t('marketing')}</SelectItem>
                      <SelectItem value="UTILITY">{t('utility')}</SelectItem>
                      <SelectItem value="AUTHENTICATION">{t('auth')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 rtl:flex-row-reverse">
                  <div className="flex items-center gap-2 rtl:flex-row-reverse">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('rowsPerPage')}</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(val) => {
                        setItemsPerPage(val === 'all' ? 'all' : Number(val));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px] text-xs bg-transparent border-none shadow-none focus:ring-0 px-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md cursor-pointer transition-colors outline-none focus:border-none ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="min-w-[70px]">
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="48">48</SelectItem>
                        <SelectItem value="all">{t('all')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium text-gray-500 dark:text-gray-400 rtl:flex-row-reverse">
                    <span className="text-[11px] sm:text-xs">
                      {t('showing')} {itemsPerPage === 'all' ? 1 : Math.min(((currentPage - 1) * (itemsPerPage as number)) + 1, filteredTemplates.length)} {t('to')} {itemsPerPage === 'all' ? filteredTemplates.length : Math.min(currentPage * (itemsPerPage as number), filteredTemplates.length)} {t('of')} {filteredTemplates.length}
                    </span>

                    {itemsPerPage !== 'all' && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="h-7 w-7 p-0 rounded-full bg-transparent border-gray-300 dark:border-slate-700 text-gray-500 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300"
                        >
                          {'<'}
                        </Button>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs px-1">
                          {currentPage} / {totalPages}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages || totalPages === 0}
                          className="h-7 w-7 p-0 rounded-full bg-transparent border-gray-300 dark:border-slate-700 text-gray-500 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-300"
                        >
                          {'>'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {paginatedTemplates.map((template: MessageTemplate) => (
                <div
                  key={template.id || template.name}
                  onClick={() => {
                    setDetailsTemplate(template);
                    setDetailTestValues({});
                  }}
                  className="cursor-pointer group flex flex-col bg-white dark:bg-slate-950 rounded-[24px] overflow-hidden border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  {/* Top Section: Beige Preview */}
                  <div className="bg-[#ede7df] dark:bg-[#1a2328] min-h-[200px] sm:min-h-[220px] p-4 sm:p-6 flex flex-col relative overflow-hidden flex-1">
                    <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-1.5 z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded backdrop-blur-sm">
                        {t('messagingPreview')}
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-center pt-7 sm:pt-8">
                      <div className="relative max-w-[92%] sm:max-w-[90%] w-full">
                        {/* WhatsApp Tail */}
                        <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-[8px] top-0 text-white dark:text-[#202c33] z-10">
                          <path opacity="1" fill="currentColor" d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z"></path>
                        </svg>

                        <div className="bg-white dark:bg-[#202c33] w-full rounded-2xl rounded-tl-none shadow-sm overflow-hidden relative">
                          {/* Image Header */}
                          {(() => {
                            const headerComp = template.components?.find((c: TemplateComponent) => c.type === 'HEADER');
                            if (headerComp?.format === 'IMAGE') {
                              const imageUrl = headerComp.example?.header_handle?.[0];
                              return (
                                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt="Template Header"
                                      className="object-cover w-full h-full"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs">
                                      Image Header
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (headerComp?.format === 'VIDEO') {
                              return (
                                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                                   Video Header
                                </div>
                              );
                            } else if (headerComp?.format === 'DOCUMENT') {
                              return (
                                <div className="relative h-14 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs border-b border-gray-100 dark:border-slate-700/50">
                                   Document Header
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="p-3 pb-2">
                            {/* Text Header (if any) */}
                            {(() => {
                              const headerComp = template.components?.find((c: TemplateComponent) => c.type === 'HEADER');
                              if (headerComp && headerComp.format !== 'IMAGE' && headerComp.format !== 'VIDEO' && headerComp.format !== 'DOCUMENT') {
                                return (
                                  <div className="font-bold text-[12.5px] text-[#111b21] dark:text-gray-100 mb-1">
                                    {headerComp.text}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            <div className="text-[13px] text-[#111b21] dark:text-[#e9edef] leading-[19px] whitespace-pre-wrap break-words line-clamp-4">
                              {template.components?.find((c: TemplateComponent) => c.type === 'BODY')?.text || 'No preview available'}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right mt-1 w-full flex justify-end">
                              15:30
                            </div>
                          </div>

                        {/* Check for buttons and render them */}
                        {(template.components?.find((c: TemplateComponent) => c.type === 'BUTTONS')?.buttons?.length || 0) > 0 && (
                          <div className="mt-2 space-y-1 border-t border-gray-100 dark:border-slate-700/50 pt-1">
                            {template.components?.find((c: TemplateComponent) => c.type === 'BUTTONS')?.buttons?.map((button: any, i: number) => (
                              <div key={i} className="text-[13px] text-[#00a884] font-medium text-center py-1.5 border-b border-gray-100 dark:border-slate-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                {button.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Details */}
                  <div className="p-4 sm:p-5 bg-white dark:bg-slate-950 flex flex-col gap-3 sm:gap-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-slate-800/50 pb-3 sm:pb-4">
                      <h3 className="font-bold text-[14px] sm:text-[15px] tracking-tight text-[#111827] dark:text-gray-100 truncate flex-1">
                        {template.name}
                      </h3>
                      <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded-full border shadow-none shrink-0", getStatusColor(template.status ?? "PENDING"))}>
                        {template.status ?? "PENDING"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-gray-100/80 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-none px-2.5 py-1 whitespace-nowrap">
                          {template.language}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-gray-100/80 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-none px-2.5 py-1 whitespace-nowrap">
                          {template.category}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-bold tracking-widest text-[#00B074] hover:bg-[#00B074]/5 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                      >
                        {t('details')}
                        <ArrowRight className="w-3.5 h-3.5 ml-1 rtl:ml-0 rtl:mr-1 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {t('deleteTemplate')}
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
              {t.rich('deleteTemplateConfirm', {
                name: detailsTemplate?.name || '',
                strong: (chunks) => <strong className="font-bold">{chunks}</strong>
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center gap-3 pt-4 justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="rounded-xl font-bold text-[11px] h-10 px-6 tracking-widest text-[#374151] dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl font-bold text-[11px] h-10 px-6 tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-md active:scale-95 transition-all"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  {t('delete')}...
                </>
              ) : (
                t('confirmDelete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayoutClient>
  );
}
