"use client"
import { useState, useEffect, useCallback } from "react"
import ManageLayout from "@/components/layouts/ManageLayout"
import { Button } from "@/components/ui/button"
import { Tag as TagIcon, Trash2, Plus, Search, Filter, Hash, Edit2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getTags, deleteTag } from "@/app/actions/tags"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { CreateTagModal } from "@/components/dashboard/CreateTagModal"
import WatiBotLoader from "@/components/WatiBotLoader"
import { useLocale, useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

interface Tag {
 id: string;
 name: string;
 color: string;
 category: string | null;
}

export default function TagsPage() {
 const t = useTranslations("TagsPage")
 const locale = useLocale()
 const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr"
 const isRtl = dir === "rtl"
 const { data: session } = useSession()
 const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"
 const userPerms = (session?.user?.permissions ?? {}) as Record<string, boolean>
 const canCreate = isAdmin || userPerms.tags_create === true || userPerms.tags_super === true
 const canEdit = isAdmin || userPerms.tags_edit === true || userPerms.tags_super === true
 const canDelete = isAdmin || userPerms.tags_delete === true || userPerms.tags_super === true

 const [searchQuery, setSearchQuery] = useState("")
 const [tags, setTags] = useState<Tag[]>([])
 const [isLoading, setIsLoading] = useState(true)
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [editingTag, setEditingTag] = useState<Tag | null>(null)

 const getCategoryLabel = useCallback((category?: string | null) => {
 const normalized = (category || "General").toLowerCase()
 if (normalized === "label") return t("categories.label")
 if (normalized === "tag") return t("categories.tag")
 if (normalized === "general") return t("categories.general")
 return category || t("categories.general")
 }, [t])

 const fetchTags = useCallback(async () => {
 setIsLoading(true)
 try {
 const data = await getTags()
 setTags(data as Tag[])
 } catch {
 toast.error(t("failedToLoad"))
 } finally {
 setIsLoading(false)
 }
 }, [t])

 useEffect(() => {
 fetchTags()
 }, [fetchTags])

 const handleDelete = async (id: string) => {
 if (!confirm(t("deleteConfirm"))) return
 try {
 await deleteTag(id)
 fetchTags()
 toast.success(t("tagRemoved"))
 } catch {
 toast.error(t("deleteFailed"))
 }
 }

 const openEdit = (tag: Tag) => {
 setEditingTag(tag)
 setIsModalOpen(true)
 }

 const filteredTags = tags.filter(tag => {
 const query = searchQuery.toLowerCase()
 return (
 tag.name.toLowerCase().includes(query) ||
 (tag.category?.toLowerCase() || "").includes(query) ||
 getCategoryLabel(tag.category).toLowerCase().includes(query)
 )
 })

 if (isLoading) {
    return <WatiBotLoader fullScreen={true} />
 }

 return (
 <ManageLayout contentClassName="bg-[#F0F2F5] dark:bg-slate-950 min-h-screen pb-16 max-w-[1600px]">
 <div dir={dir} className="flex flex-col gap-10">
 {/* Page Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-6">
 <div className="space-y-1.5 text-start">
 <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
 {t("title")}
 </h2>
 <p className="text-[#6B7280] dark:text-slate-400 text-[14px] font-medium leading-relaxed max-w-lg">
 {t("subtitle")}
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-3">
 {canCreate && (
 <Button
 onClick={() => {
 setEditingTag(null)
 setIsModalOpen(true)
 }}
 className="h-11 px-6 bg-[#10B981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] gap-2 transition-all hover:scale-[1.02] active:scale-95 border-none"
 >
 <Plus className="w-4 h-4" />
 {t("createNewTag")}
 </Button>
 )}
 </div>
 </div>

 {/* Filter / Search Bar */}
 <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
 <div className="relative w-full md:w-96 group">
 <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#10B981] transition-colors", isRtl ? "right-4" : "left-4")} />
 <Input
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder={t("searchPlaceholder")}
 className={cn(
 "h-12 bg-white dark:bg-slate-900 border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500/20 text-slate-900 dark:text-white font-medium",
 isRtl ? "pr-11 text-right" : "pl-11 text-left"
 )}
 />
 </div>
 <div className="flex items-center gap-3">
 <Button variant="ghost" className="h-11 px-5 rounded-xl text-[11px] font-bold uppercase tracking-widest text-slate-500 gap-3 hover:bg-white dark:hover:bg-slate-900 transition-all">
 <Filter className="w-3.5 h-3.5" />
 {t("categoryAll")}
 </Button>
 </div>
 </div>

 {/* Main Content Area */}
 {filteredTags.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
 {filteredTags.map((tag) => (
 <div key={tag.id} className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all group white-premium-card relative">
 <div className={cn("absolute top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity", isRtl ? "left-4" : "right-4")}>
 {canEdit && (
 <button
 onClick={() => openEdit(tag)}
 className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 transition-colors"
 >
 <Edit2 className="w-3.5 h-3.5" />
 </button>
 )}
 {canDelete && (
 <button
 onClick={() => handleDelete(tag.id)}
 className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 <div className="flex flex-col items-center text-center space-y-4">
 <div
 className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500"
 style={{ backgroundColor:`${tag.color}15`, color: tag.color }}
 >
 <Hash className="w-8 h-8 opacity-60" />
 </div>
 <div className="space-y-1">
 <h4 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{tag.name}</h4>
 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{getCategoryLabel(tag.category)}</p>
 </div>
 <div className="pt-2">
 <span
 className="inline-block w-3 h-3 rounded-full"
 style={{ backgroundColor: tag.color }}
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] shadow-sm overflow-hidden p-20 flex flex-col items-center justify-center text-center space-y-8 relative group">
 <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-100" />
 <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-100" />

 <div className="w-24 h-24 rounded-[32px] bg-emerald-500/10 flex items-center justify-center border-2 border-dashed border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
 <TagIcon className="w-12 h-12 text-emerald-600/40 stroke-[1.5]" />
 </div>

 <div className="space-y-3 relative z-10">
 <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{t("emptyTitle")}</h3>
 <p className="text-[15px] text-[#6B7280] dark:text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
 {searchQuery ? t("noSearchResults") : t("emptyDescription")}
 </p>
 </div>

 
 </div>
 )}

 {/* Tag Stats / Help */}

 </div> 

 <CreateTagModal
 isOpen={isModalOpen}
 onOpenChange={setIsModalOpen}
 onSuccess={fetchTags}
 editData={editingTag || undefined}
 />
 </ManageLayout>
 )
}
