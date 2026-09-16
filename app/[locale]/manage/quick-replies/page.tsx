"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  MessageSquare,
  Music,
  FileText,
  Image as ImageIcon,
  Video,
  Search,
  MoreVertical,
  Trash2,
  Edit2,
  ExternalLink,
  Zap,
  Mic,
  Square,
  UploadCloud,
  Loader2,
  Paperclip
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from "@/app/actions/quick-replies"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTranslations } from 'next-intl'
import { MediaLibraryModal } from "@/components/flows/modals/media-library-modal"
import { COMMON_CONTACT_VARIABLES, insertVariableAtCursor } from "@/lib/messaging/contactVariables"

const TYPE_ICONS: Record<string, any> = {
  text: MessageSquare,
  audio: Music,
  image: ImageIcon,
  video: Video,
  document: FileText
}

const parseUrls = (urlStr?: string | null): string[] => {
  if (!urlStr) return [];
  const s = urlStr.trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p.map(String).filter(Boolean);
    } catch {}
  }
  return [s].filter(Boolean);
};

const parseNames = (nameStr?: string | null): string[] => {
  if (!nameStr) return [];
  const s = nameStr.trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p.map(String).filter(Boolean);
    } catch {}
  }
  return [s].filter(Boolean);
};

export default function QuickRepliesPage() {
  const t = useTranslations('QuickReplies')
  const [replies, setReplies] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReply, setEditingReply] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: "",
    type: "text",
    content: "",
    fileUrl: "",
    fileName: "",
    fileUrls: [] as string[],
    fileNames: [] as string[]
  })

  // Upload & Recording State
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const timerRef = useRef<any>(null)
  const recorderRef = useRef<any>(null)
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false)
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null)

  const handleInsertVariable = (variableVal: string) => {
    insertVariableAtCursor(
      contentInputRef.current,
      formData.content || "",
      variableVal,
      (newVal) => setFormData(prev => ({ ...prev, content: newVal }))
    );
  };

  useEffect(() => {
    loadReplies()
    const initRecorder = async () => {
      try {
        const MicRecorder = (await import('mic-recorder-to-mp3')).default
        recorderRef.current = new MicRecorder({ bitRate: 128 })
      } catch (error) {
        console.error("Failed to initialize MicRecorder:", error)
      }
    }
    initRecorder()
  }, [])

  const loadReplies = async () => {
    setIsLoading(true)
    try {
      const data = await getQuickReplies()
      setReplies(data)
    } catch (error) {
      toast.error(t('failedToLoad'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    const effectiveUrls = formData.fileUrls.length > 0
      ? formData.fileUrls
      : (formData.fileUrl ? [formData.fileUrl] : []);
    const effectiveNames = formData.fileNames.length > 0
      ? formData.fileNames
      : (formData.fileName ? [formData.fileName] : []);

    if (!formData.name) return toast.error(t('nameRequired'))
    if (formData.type === "text" && !formData.content) return toast.error(t('contentRequired'))
    if (formData.type !== "text" && effectiveUrls.length === 0) return toast.error(t('fileUrlRequired'))

    const payload = {
      name: formData.name,
      type: formData.type,
      content: formData.content,
      fileUrls: effectiveUrls,
      fileNames: effectiveNames,
      fileUrl: effectiveUrls.length > 1 ? JSON.stringify(effectiveUrls) : (effectiveUrls[0] || ""),
      fileName: effectiveNames.length > 1 ? JSON.stringify(effectiveNames) : (effectiveNames[0] || "")
    }

    try {
      if (editingReply) {
        await updateQuickReply(editingReply.id, payload)
        toast.success(t('quickReplyUpdated'))
      } else {
        await createQuickReply(payload)
        toast.success(t('quickReplyCreated'))
      }
      setIsModalOpen(false)
      setEditingReply(null)
      setFormData({ name: "", type: "text", content: "", fileUrl: "", fileName: "", fileUrls: [], fileNames: [] })
      loadReplies()
    } catch (error) {
      toast.error(t('somethingWentWrong'))
    }
  }

  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)
    const formDataUpload = new FormData()
    formDataUpload.append('file', file)

    try {
      const response = await axios.post('/api/upload', formDataUpload, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
          setUploadProgress(percentCompleted)
        }
      })

      const data = response.data
      if (data.url) {
        setFormData(prev => {
          const nextUrls = [...prev.fileUrls, data.url];
          const nextNames = [...prev.fileNames, file.name];
          return {
            ...prev,
            fileUrl: nextUrls.length > 1 ? JSON.stringify(nextUrls) : (nextUrls[0] || ""),
            fileName: nextNames.length > 1 ? JSON.stringify(nextNames) : (nextNames[0] || ""),
            fileUrls: nextUrls,
            fileNames: nextNames
          };
        })
        toast.success(t('fileUploadedSuccessfully'))
      } else {
        throw new Error(data.error || t('uploadFailed'))
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || t('failedToUploadFile'))
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    const fileList = Array.from(files);
    const newUrls: string[] = [];
    const newNames: string[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post('/api/upload', fd);
        if (res.data?.url) {
          newUrls.push(res.data.url);
          newNames.push(file.name);
        }
        setUploadProgress(Math.round(((i + 1) / fileList.length) * 100));
      }
      setFormData(prev => {
        const combinedUrls = [...prev.fileUrls, ...newUrls];
        const combinedNames = [...prev.fileNames, ...newNames];
        return {
          ...prev,
          fileUrls: combinedUrls,
          fileNames: combinedNames,
          fileUrl: combinedUrls.length > 1 ? JSON.stringify(combinedUrls) : (combinedUrls[0] || ""),
          fileName: combinedNames.length > 1 ? JSON.stringify(combinedNames) : (combinedNames[0] || "")
        };
      });
      toast.success(`${newUrls.length} image(s) uploaded`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || t('failedToUploadFile'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setFormData(prev => {
      const nextUrls = prev.fileUrls.filter((_, idx) => idx !== indexToRemove);
      const nextNames = prev.fileNames.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        fileUrls: nextUrls,
        fileNames: nextNames,
        fileUrl: nextUrls.length > 1 ? JSON.stringify(nextUrls) : (nextUrls[0] || ""),
        fileName: nextNames.length > 1 ? JSON.stringify(nextNames) : (nextNames[0] || "")
      };
    });
  };

  const startRecording = async () => {
    if (!recorderRef.current) {
      try {
        const MicRecorder = (await import('mic-recorder-to-mp3')).default
        recorderRef.current = new MicRecorder({ bitRate: 128 })
      } catch (error) {
        toast.error(t('audioRecorderNotInit'))
        return
      }
    }

    try {
      await recorderRef.current.start()
      setIsRecording(true)
      setRecordingDuration(0)
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error(error)
      toast.error(t('micAccessDenied'))
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)

      recorderRef.current.stop().getMp3().then(async ([buffer, blob]: [any, any]) => {
        const file = new File(buffer, `voice-reply-${Date.now()}.mp3`, { type: 'audio/mpeg' })
        await handleFileUpload(file)
      }).catch((error: any) => {
        console.error(error)
        toast.error(t('failedToStopRecording'))
      })
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return
    try {
      await deleteQuickReply(id)
      toast.success(t('deletedSuccessfully'))
      loadReplies()
    } catch (error) {
      toast.error(t('failedToDelete'))
    }
  }

  const filteredReplies = replies.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayoutClient mainClassName="h-full overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/20 antialiased transition-colors duration-300 plus-jakarta-forced">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-[#00B074]" />
              {t('quickReplies')}
            </h2>
            <p className="text-slate-450 dark:text-slate-400 text-[13px] font-semibold">
              {t('quickRepliesDesc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450 group-focus-within:text-[#00B074] transition-colors" />
              <input
                placeholder={t('searchReplies')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-8 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none focus:border-[#00B074] transition-all pl-9 h-10"
              />
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs h-10 shadow-sm">
              <span className="font-bold text-slate-450  tracking-widest text-[10px]">{t('total')}</span>
              <span className="font-black text-[#00B074]">{replies.length}</span>
            </div>

            <Dialog open={isModalOpen} onOpenChange={(open) => {
              setIsModalOpen(open)
              if (!open) {
                setEditingReply(null)
                setFormData({ name: "", type: "text", content: "", fileUrl: "", fileName: "", fileUrls: [], fileNames: [] })
              }
            }}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-[#00B074] hover:bg-[#009c66] rounded-xl text-[13px] font-bold text-white transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-500/20 h-10">
                  <Plus className="w-4 h-4" /> {t('addReply')}
                </button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-full max-w-2xl rounded-[32px] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-6 sm:p-10 w-full min-w-0 overflow-x-hidden plus-jakarta-forced">
                  <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white">
                      {editingReply ? t('editQuickReply') : t('newQuickReply')}
                    </DialogTitle>
                    <CardDescription className="text-xs">{t('setupResponseHere')}</CardDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2 w-full min-w-0">
                    <div className="space-y-2 w-full min-w-0">
                      <Label className="text-xs font-bold text-slate-400  tracking-widest">{t('responseName')}</Label>
                      <Input
                        placeholder={t('egWelcomeMessage')}
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="rounded-xl border-slate-200 h-11 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-2 w-full min-w-0">
                      <Label className="text-xs font-bold text-slate-400 tracking-widest">{t('type')}</Label>
                      <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        {[
                          { id: 'text', icon: MessageSquare, label: 'Text' },
                          { id: 'image', icon: ImageIcon, label: 'Image' },
                          { id: 'video', icon: Video, label: 'Video' },
                          { id: 'document', icon: FileText, label: 'File' },
                          { id: 'audio', icon: Music, label: 'Audio' },
                        ].map((tItem) => (
                          <button
                            key={tItem.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: tItem.id })}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                              formData.type === tItem.id
                                ? "bg-white dark:bg-slate-700 text-[#00B074] shadow-sm"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            )}
                          >
                            <tItem.icon className="w-3.5 h-3.5" />
                            {tItem.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formData.type === "text" ? (
                      <div className="space-y-2 w-full min-w-0">
                        <Label className="text-xs font-bold text-slate-400  tracking-widest">{t('messageContent')}</Label>
                        <Textarea
                          ref={contentInputRef}
                          placeholder={t('typeMessageHere')}
                          className="rounded-xl border-slate-200 min-h-[120px] focus:ring-emerald-500/20"
                          value={formData.content || ""}
                          onChange={e => setFormData({ ...formData, content: e.target.value })}
                        />
                        <div className="flex flex-col gap-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Insert Recipient Variables:</span>
                            <span className="text-[10px] text-slate-400 italic">Auto-replaces recipient details</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {COMMON_CONTACT_VARIABLES.map((v) => {
                              const isWhatsApp = v.value === "{{WhatsApp Name}}";
                              return (
                                <button
                                  key={v.value}
                                  type="button"
                                  onClick={() => handleInsertVariable(v.value)}
                                  className={cn(
                                    "text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer",
                                    isWhatsApp
                                      ? "bg-[#E8F8F2] dark:bg-emerald-950/40 text-[#00B074] border-[#00B074]/30 hover:bg-[#00B074] hover:text-white"
                                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  )}
                                  title={v.description}
                                >
                                  {v.label} <span className="font-mono text-[10px] opacity-70">({v.value})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full min-w-0">
                        <div className="space-y-2 w-full min-w-0">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-400 tracking-widest">{t('attachment')}</Label>
                            {formData.type === 'image' && formData.fileUrls.length > 0 && (
                              <span className="text-xs font-bold text-[#00B074]">
                                {formData.fileUrls.length} image{formData.fileUrls.length > 1 ? 's' : ''} attached
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col gap-3 w-full min-w-0">
                            {/* If images are selected and type is image */}
                            {formData.type === 'image' && formData.fileUrls.length > 0 ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 max-h-56 overflow-y-auto">
                                  {formData.fileUrls.map((url, idx) => (
                                    <div key={idx} className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square bg-slate-100 dark:bg-slate-900 shadow-sm">
                                      <img src={url} alt={formData.fileNames[idx] || `Image ${idx + 1}`} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveImage(idx)}
                                          className="p-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-transform scale-90 hover:scale-100 cursor-pointer"
                                          title="Remove image"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white truncate text-center font-medium">
                                        {formData.fileNames[idx] || `Img ${idx + 1}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setIsMediaLibraryOpen(true)}
                                      className="rounded-xl text-xs font-bold gap-1.5 h-8 border-slate-200 hover:border-[#00B074] hover:text-[#00B074]"
                                    >
                                      <Plus className="w-3 h-3" /> From Library
                                    </Button>
                                    <label className="cursor-pointer">
                                      <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleMultipleFilesUpload}
                                        disabled={isUploading}
                                      />
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-[#00B074] hover:text-[#00B074] h-8 transition-colors">
                                        <UploadCloud className="w-3 h-3" /> Upload Images
                                      </span>
                                    </label>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFormData(prev => ({ ...prev, fileUrls: [], fileNames: [], fileUrl: "", fileName: "" }))}
                                    className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-8 px-2 font-semibold"
                                  >
                                    Clear all
                                  </Button>
                                </div>
                              </div>
                            ) : formData.type !== 'image' && (formData.fileUrl || formData.fileUrls.length > 0) ? (
                              <div className="flex items-center justify-between w-full gap-3 p-3 bg-[#E8F8F2] border border-[#00B074]/20 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <Paperclip className="w-4 h-4 text-[#00B074] shrink-0" />
                                  <span className="text-sm font-medium text-slate-700 truncate block w-full">{formData.fileName || formData.fileNames[0] || t('uploadedFile')}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg h-7 px-2 shrink-0"
                                  onClick={() => setFormData(prev => ({ ...prev, fileUrl: "", fileName: "", fileUrls: [], fileNames: [] }))}
                                >
                                  {t('remove')}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3">
                                {/* Media Library Selector Button */}
                                <div 
                                  onClick={() => setIsMediaLibraryOpen(true)}
                                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 hover:border-[#00B074] hover:bg-[#E8F8F2]/30 cursor-pointer transition-all duration-300 group"
                                >
                                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#00B074] mb-2 transition-colors" />
                                  <p className="text-sm font-bold text-slate-650 group-hover:text-[#00B074] transition-colors">
                                    {formData.type === 'image' ? 'Choose Image(s) from Media Library' : t('chooseFromMediaLibrary')}
                                  </p>
                                  <p className="text-xs text-slate-450 mt-1">
                                    {formData.type === 'image' ? 'Select single or multiple images' : t('selectExistingMedia').replace('{type}', formData.type)}
                                  </p>
                                </div>

                                {formData.type === 'image' && (
                                  <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                    <UploadCloud className="w-4 h-4 text-[#00B074]" />
                                    <span>Or upload multiple images from device</span>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      className="hidden"
                                      onChange={handleMultipleFilesUpload}
                                      disabled={isUploading}
                                    />
                                  </label>
                                )}

                                {/* Voice Recording Option (only for audio) */}
                                {formData.type === 'audio' && (
                                  <div className="flex items-center gap-2">
                                    <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                                    <span className="text-[10px] font-bold text-slate-400  tracking-widest">{t('or')}</span>
                                    <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                                  </div>
                                )}

                                {formData.type === 'audio' && (
                                  <div className={cn(
                                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                    isRecording ? "bg-rose-50 border-rose-200" : "bg-white dark:bg-slate-900 border-slate-200"
                                  )}>
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-3 h-3 rounded-full",
                                        isRecording ? "bg-rose-500 animate-pulse" : "bg-slate-300"
                                      )} />
                                      <span className={cn(
                                        "text-sm font-bold",
                                        isRecording ? "text-rose-600" : "text-slate-600"
                                      )}>
                                        {isRecording ? t('recording').replace('{duration}', formatDuration(recordingDuration)) : t('recordVoiceReply')}
                                      </span>
                                    </div>

                                    {isRecording ? (
                                      <Button
                                        size="sm"
                                        className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl gap-2 px-4 shadow-md shadow-rose-200"
                                        onClick={stopRecording}
                                      >
                                        <Square className="w-4 h-4 fill-current" />
                                        {t('stop')}
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-xl gap-2 px-4 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                        onClick={startRecording}
                                        disabled={isUploading}
                                      >
                                        <Mic className="w-4 h-4" />
                                        {t('start')}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {formData.type !== "document" && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-400  tracking-widest">{t('captionOptional')}</Label>
                            <Textarea
                              placeholder={t('addCaption')}
                              className="rounded-xl border-slate-200 min-h-[60px] focus:ring-emerald-500/20"
                              value={formData.content || ""}
                              onChange={e => setFormData({ ...formData, content: e.target.value })}
                            />
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {COMMON_CONTACT_VARIABLES.map((v) => (
                                <button
                                  key={v.value}
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, content: (prev.content ? prev.content + ' ' : '') + v.value }))}
                                  className="text-[11px] px-2 py-0.5 rounded-md border font-medium bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#00B074] hover:text-[#00B074] transition-colors cursor-pointer"
                                >
                                  {v.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end rtl:justify-start rtl:flex-row-reverse gap-3 w-full">
                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-semibold">{t('cancel')}</Button>
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      className="bg-[#00B074] hover:bg-[#009662] text-white rounded-xl px-8 font-bold text-xs  tracking-widest shadow-md shadow-[#00B074]/10 h-10 shrink-0"
                      disabled={isUploading || isRecording}
                    >
                      {isUploading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('uploading')}
                        </div>
                      ) : (
                        editingReply ? t('updateReply') : t('createReply')
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative group overflow-hidden bg-white dark:bg-slate-950 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black  tracking-wider text-slate-450 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('predefinedReplies')}
                </p>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl font-black text-slate-850 dark:text-white tracking-tight">{replies.length}</h4>
                  <span className="text-[10px] font-bold text-[#00B074] bg-[#E8F8F2] dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">{t('active')}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('readyToUse')}</p>
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
                <p className="text-[10px] font-black  tracking-wider text-slate-450 dark:text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {t('richMediaAttachments')}
                </p>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl font-black text-slate-850 dark:text-white tracking-tight">{replies.filter(r => r.type !== 'text').length}</h4>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md">{t('media')}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('mediaTypesDesc')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center border border-amber-100/30">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Grid of Replies */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse border border-slate-100 dark:border-slate-850 shadow-sm rounded-[24px] h-48 bg-white dark:bg-slate-950" />
            ))
          ) : filteredReplies.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-slate-350" />
              </div>
              <h3 className="text-lg font-bold text-slate-600 dark:text-slate-350">{t('noQuickRepliesFound')}</h3>
              <p className="text-slate-500 dark:text-slate-450">{t('startByCreatingFirst')}</p>
            </div>
          ) : (
            filteredReplies.map((reply) => {
              const Icon = TYPE_ICONS[reply.type] || MessageSquare
              return (
                <div key={reply.id} className="group flex flex-col h-[280px] rounded-[24px] overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 bg-white relative">

                  {/* WhatsApp-style Header */}
                  <div className="bg-[#00a884] dark:bg-[#008f6f] text-white px-4 py-3 flex justify-between items-center z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[14px] leading-tight truncate max-w-[140px]">{reply.name}</span>
                        <span className="text-[10px] font-semibold text-white/80  tracking-widest mt-0.5">{reply.type}</span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/20 text-white data-[state=open]:bg-white/20">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl border-none shadow-xl min-w-[140px] plus-jakarta-forced">
                        <DropdownMenuItem className="gap-2 focus:bg-slate-50 cursor-pointer py-2" onClick={() => {
                          setEditingReply(reply)
                          const urls = parseUrls(reply.fileUrl);
                          const names = parseNames(reply.fileName);
                          setFormData({
                            name: reply.name,
                            type: reply.type,
                            content: reply.content || "",
                            fileUrl: reply.fileUrl || "",
                            fileName: reply.fileName || "",
                            fileUrls: urls,
                            fileNames: names
                          })
                          setIsModalOpen(true)
                        }}>
                          <Edit2 className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">{t('edit')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 focus:bg-rose-50 text-rose-600 cursor-pointer py-2" onClick={() => handleDelete(reply.id)}>
                          <Trash2 className="w-4 h-4" />
                          <span className="font-semibold">{t('delete')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* WhatsApp Chat Background & Bubble */}
                  <div className="flex-1 p-4 flex flex-col justify-end overflow-hidden relative bg-[#efeae2] dark:bg-[#0b141a]">
                    {/* Fake WhatsApp Doodles Background */}
                    <div className="absolute inset-0 opacity-40 dark:opacity-10" style={{ backgroundImage: "url('https://w0.peakpx.com/wallpaper/508/179/HD-wallpaper-whatsapp-background-doodles-pattern-texture.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', mixBlendMode: 'multiply' }} />

                    {/* The Message Bubble (Incoming / Recipient View) */}
                    <div className="relative self-start max-w-[85%] bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] p-2 pl-2.5 pr-3 rounded-2xl rounded-tl-sm shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] z-10 flex flex-col gap-1">

                      {/* Optional Media Preview */}
                      {reply.type !== 'text' && (() => {
                        const urls = parseUrls(reply.fileUrl);
                        if (reply.type === 'image' && urls.length > 1) {
                          return (
                            <div className="w-full bg-black/5 dark:bg-black/20 rounded-xl mb-1 p-2 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  <ImageIcon className="w-3.5 h-3.5 text-[#00a884]" />
                                  {urls.length} Images Attached
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 w-full">
                                {urls.slice(0, 3).map((u, i) => (
                                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-black/10 bg-black/5">
                                    <img src={u} alt="" className="w-full h-full object-cover" />
                                    {i === 2 && urls.length > 3 && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-extrabold">
                                        +{urls.length - 3}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        if (reply.type === 'image' && urls.length === 1) {
                          return (
                            <div className="w-full rounded-xl mb-1 overflow-hidden max-h-32 bg-black/5">
                              <img src={urls[0]} alt="" className="w-full h-full object-cover" />
                            </div>
                          );
                        }
                        return (
                          <div className="w-full bg-black/5 dark:bg-black/20 rounded-xl mb-1 flex items-center gap-2 p-2 relative overflow-hidden">
                            <Icon className="w-5 h-5 text-slate-500 shrink-0" />
                            <span className="text-[11px] font-bold truncate opacity-80">{reply.fileName || t('attachedMedia')}</span>
                          </div>
                        );
                      })()}

                      {/* Message Text */}
                      {reply.content && (
                        <p className="text-[13.5px] leading-[19px] whitespace-pre-wrap break-words line-clamp-4 pr-1">
                          {reply.content}
                        </p>
                      )}

                      {/* Timestamp (No double ticks for recipient) */}
                      <div className="text-[10px] text-slate-500/80 dark:text-white/50 text-right mt-0.5 font-semibold select-none flex justify-end items-center gap-1 self-end float-right">
                        <span>12:00</span>
                      </div>

                      {/* Chat tail SVG (Flipped for incoming) */}
                      <div className="absolute top-0 -left-1.5 text-white dark:bg-[#202c33]">
                        <svg viewBox="0 0 8 13" width="8" height="13" className="fill-current -scale-x-100 text-white dark:text-[#202c33]">
                          <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <MediaLibraryModal
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        multiple={formData.type === 'image'}
        onSelect={(url, name) => {
          setFormData(prev => ({
            ...prev,
            fileUrl: url,
            fileName: name || url.split('/').pop() || 'Selected file',
            fileUrls: [url],
            fileNames: [name || url.split('/').pop() || 'Selected file']
          }))
        }}
        onSelectMultiple={(items) => {
          setFormData(prev => {
            const addedUrls = items.map(i => i.url);
            const addedNames = items.map(i => i.name || i.url.split('/').pop() || 'Selected file');
            const allUrls = [...prev.fileUrls, ...addedUrls.filter(u => !prev.fileUrls.includes(u))];
            const allNames = [...prev.fileNames, ...addedNames];
            return {
              ...prev,
              fileUrls: allUrls,
              fileNames: allNames,
              fileUrl: allUrls.length > 1 ? JSON.stringify(allUrls) : (allUrls[0] || ""),
              fileName: allNames.length > 1 ? JSON.stringify(allNames) : (allNames[0] || "")
            };
          });
        }}
        contentType={formData.type as any}
      />
    </DashboardLayoutClient>
  )
}
