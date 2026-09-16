"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useLocale, useTranslations } from "next-intl"
import {
  getAvailableProjects,
  createNewProject,
  switchProject,
  deleteProject,
  renameProject,
} from "@/app/actions/projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Loader2,
  ArrowRight,
  FolderOpen,
  Plus,
  Building2,
  MessageSquare,
  Bot,
  BarChart3,
  Users,
  CheckCircle2,
  Zap,
  Calendar,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const RTL_LOCALES = new Set(["ar", "ur"])
const LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  ur: "ur-PK",
  hi: "hi-IN",
  bn: "bn-BD",
  en: "en-US",
}

type Project = {
  id: string
  name: string
  status: string
  createdAt: string | Date
}

export default function ProjectsPage() {
  const t = useTranslations("ProjectsPage")
  const locale = useLocale()
  const isRtl = RTL_LOCALES.has(locale)
  const intlLocale = LOCALE_MAP[locale] ?? locale
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState("")

  // Edit modal state
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const reload = async () => {
    const res = await getAvailableProjects()
    if (res.success && res.data) {
      setProjects(res.data.filter((p: Project) => p.status === "active"))
    }
  }

  useEffect(() => {
    const load = async () => {
      if (session?.user?.id) await reload()
      setIsLoading(false)
    }
    load()
  }, [session?.user?.id])

  // Auto-focus edit input when modal opens
  useEffect(() => {
    if (editProject) {
      setTimeout(() => editInputRef.current?.focus(), 50)
    }
  }, [editProject])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    setIsCreating(true)
    try {
      const res = await createNewProject(newProjectName)
      if (res.success) {
        toast.success(t("toasts.projectCreated"))
        await updateSession()
        router.push("/dashboard")
      } else {
        toast.error(res.error || t("toasts.createFailed"))
        setIsCreating(false)
      }
    } catch {
      toast.error(t("toasts.unexpected"))
      setIsCreating(false)
    }
  }

  const handleSwitchProject = async (id: string) => {
    setSwitchingId(id)
    try {
      const res = await switchProject(id)
      if (res.success) {
        await updateSession()
        toast.success(t("toasts.switched"))
        router.push("/dashboard")
      } else {
        toast.error(res.error || t("toasts.switchFailed"))
        setSwitchingId(null)
      }
    } catch {
      toast.error(t("toasts.switchFailed"))
      setSwitchingId(null)
    }
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editProject || !editName.trim()) return
    setIsSavingEdit(true)
    try {
      const res = await renameProject(editProject.id, editName)
      if (res.success) {
        toast.success("Project renamed successfully")
        setEditProject(null)
        await reload()
      } else {
        toast.error(res.error || "Failed to rename project")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await deleteProject(deleteTarget.id)
      if (res.success) {
        toast.success("Project deleted")
        setDeleteTarget(null)
        await updateSession()
        await reload()
      } else {
        toast.error(res.error || "Failed to delete project")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date)
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full min-h-screen bg-white flex flex-col lg:flex-row antialiased plus-jakarta-forced forced-light"
    >
      {/* ───── LEFT: BRAND PANEL ───── */}
      <div
        className="w-full lg:w-[42%] order-2 lg:order-1 flex flex-col justify-between pt-6 px-6 pb-6 lg:pt-8 lg:px-10 lg:pb-8 relative overflow-hidden border-t lg:border-t-0 lg:border-r border-slate-100/60 lg:min-h-screen"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--primary-color, #00a884) 6%, white) 0%, color-mix(in srgb, var(--primary-color, #00a884) 12%, white) 50%, color-mix(in srgb, var(--primary-color, #00a884) 5%, white) 100%)"
        }}
      >
        {/* Background blobs */}
        <div
          className="absolute top-[-10%] right-[-10%] w-[320px] h-[320px] rounded-full blur-[90px] pointer-events-none"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary-color, #00a884) 15%, transparent)" }}
        />
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] rounded-full blur-[100px] pointer-events-none"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary-color, #00a884) 10%, transparent)" }}
        />
        {/* Dotted grid */}
        <div
          className="absolute top-[6%] right-[10%] w-24 h-24 opacity-15 pointer-events-none hidden xl:block"
          style={{
            backgroundImage: "radial-gradient(var(--primary-color, #00a884) 1.5px, transparent 1.5px)",
            backgroundSize: "10px 10px"
          }}
        />

        {/* Concentric rings */}
        <div className="hidden lg:block absolute right-[-140px] xl:right-[-70px] top-[4%] w-[680px] h-[680px] pointer-events-none z-0">
          <div
            className="absolute inset-0 blur-[4px]"
            style={{ background: "radial-gradient(circle at center, color-mix(in srgb, var(--primary-color, #00a884) 18%, transparent) 0%, transparent 75%)" }}
          />
          <svg
            className="w-full h-full animate-[spin_120s_linear_infinite]"
            viewBox="0 0 400 400"
            fill="none"
            style={{ color: "color-mix(in srgb, var(--primary-color, #00a884) 20%, transparent)" }}
          >
            <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.6" />
            <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
            <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="1" strokeDasharray="12 8" opacity="0.75" />
            <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <circle cx="200" cy="200" r="60" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.3" />
            <line x1="200" y1="10" x2="200" y2="390" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.25" />
            <line x1="10" y1="200" x2="390" y2="200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.25" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center lg:justify-start my-8 lg:my-0 lg:mt-2">
          <img src="/logo11122.png" alt="WatiBot Logo" className="w-[160px] xl:w-[180px] h-auto object-contain" />
        </div>

        {/* Hero Text */}
        <div className="relative z-10 flex-1 flex flex-col justify-center space-y-6 py-6">
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm w-fit uppercase tracking-wider"
            style={{
              backgroundColor: "color-mix(in srgb, var(--primary-color, #00a884) 8%, white)",
              color: "var(--primary-color, #00a884)",
              border: "1px solid color-mix(in srgb, var(--primary-color, #00a884) 20%, transparent)"
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--primary-color, #00a884)" }}
            />
            Workspace Manager
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl xl:text-[36px] font-black text-slate-900 tracking-tight leading-[1.15]">
              Manage Your{" "}
              <span style={{ color: "var(--primary-color, #00a884)" }}>Projects</span>
            </h1>
            <p className="text-slate-500 text-[13px] leading-relaxed max-w-xs">
              Switch between workspaces or create a new project to keep your WhatsApp operations organized.
            </p>
          </div>

          <div className="space-y-5 pt-4">
            {[
              { icon: MessageSquare, title: "Separate Inboxes", desc: "Each project has its own live chat inbox and contact list." },
              { icon: Bot, title: "Independent Flows", desc: "Build and manage automation flows per workspace." },
              { icon: BarChart3, title: "Project Analytics", desc: "Track performance metrics independently for each project." },
              { icon: Users, title: "Team Management", desc: "Assign different agents and permissions per project." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3.5 items-start text-left">
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--primary-color, #00a884) 12%, white)",
                    color: "var(--primary-color, #00a884)"
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[13px]">{title}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative z-10 pt-6"
          style={{ borderTop: "1px solid color-mix(in srgb, var(--primary-color, #00a884) 15%, transparent)" }}
        >
          <p className="text-[10px] font-bold text-slate-400">© 2026 WatiBot CRM. All rights reserved.</p>
        </div>
      </div>

      {/* ───── RIGHT: PROJECTS PANEL ───── */}
      <div className="w-full lg:w-[58%] order-1 lg:order-2 bg-[#fafbfc] flex flex-col lg:min-h-screen p-4 sm:p-6 lg:p-8 xl:p-10 overflow-y-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-[20px] font-black text-slate-800 tracking-tight">{t("title")}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{t("subtitle")}</p>
          </div>
          {session?.user?.name && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-white text-[9px] font-black">
                {session.user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] font-bold text-slate-600 max-w-[120px] truncate">{session.user.name}</span>
            </div>
          )}
        </div>

        {/* Create project card */}
        <div className="bg-white border border-slate-100/90 rounded-3xl p-6 sm:p-7 shadow-lg shadow-slate-100/40 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-[#e6f4ee] flex items-center justify-center text-[#00a884]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-slate-800">{t("createNewProject")}</h3>
              <p className="text-[11px] text-slate-400">{t("createDescription")}</p>
            </div>
          </div>
          <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t("projectNamePlaceholder")}
                disabled={isCreating}
                className="h-11 pl-11 border-slate-200/80 rounded-xl focus-visible:ring-[#00a884] focus-visible:border-[#00a884] text-[12.5px] font-bold text-slate-800 placeholder:text-slate-400 bg-white"
              />
            </div>
            <Button
              type="submit"
              disabled={isCreating || !newProjectName.trim()}
              className="h-11 px-6 bg-[#00a884] hover:bg-[#009675] disabled:opacity-70 text-white font-extrabold rounded-xl transition-all duration-200 shadow-md shadow-emerald-100/50 flex items-center gap-2 active:scale-[0.98] whitespace-nowrap"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {t("createProject")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Active Projects header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-black text-slate-700 uppercase tracking-widest">{t("activeProjects")}</h3>
          {!isLoading && (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {t("total", { count: projects.length })}
            </span>
          )}
        </div>

        {/* Projects list */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-[#00a884]/20 border-t-[#00a884] rounded-full animate-spin" />
              <span className="text-[11px] font-bold text-slate-400">Loading projects...</span>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 bg-white border border-slate-100/90 rounded-3xl shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#e6f4ee] flex items-center justify-center text-[#00a884] mb-4">
              <FolderOpen className="w-7 h-7" />
            </div>
            <p className="text-[13px] font-bold text-slate-500 text-center">{t("emptyState")}</p>
            <p className="text-[11px] text-slate-400 text-center mt-1">Create your first project using the form above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white border border-slate-100/90 rounded-3xl p-5 shadow-lg shadow-slate-100/40 flex flex-col justify-between group hover:border-[#00a884]/30 hover:shadow-emerald-50/60 transition-all duration-200"
              >
                <div className="space-y-4">
                  {/* Project header with edit/delete actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00a884] to-emerald-600 flex items-center justify-center text-white font-black text-[14px] shadow-md shadow-emerald-100/60 flex-shrink-0">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-black text-slate-800 leading-tight truncate max-w-[130px]">
                          {project.name}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-[#00a884] uppercase tracking-wider mt-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {t("active")}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditProject(project)
                          setEditName(project.name)
                        }}
                        title="Rename project"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#00a884] hover:bg-emerald-50 transition-all duration-150"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(project)}
                        title="Delete project"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <Zap className="w-3.5 h-3.5 text-[#00a884] flex-shrink-0" />
                      <div>
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">{t("plan")}</p>
                        <p className="text-[10px] font-black text-slate-700">{t("freeForever")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">{t("created")}</p>
                        <p className="text-[10px] font-black text-slate-700">{formatDate(project.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Open button */}
                <Button
                  onClick={() => handleSwitchProject(project.id)}
                  disabled={switchingId === project.id}
                  className="mt-4 w-full h-10 rounded-xl font-extrabold text-[11px] transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] bg-[#00a884] hover:bg-[#009675] text-white shadow-md shadow-emerald-100/50 disabled:opacity-70"
                >
                  {switchingId === project.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {t("openProject")}
                      <ArrowRight className={cn("w-3.5 h-3.5", isRtl && "rotate-180")} />
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───── EDIT MODAL ───── */}
      {editProject && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 plus-jakarta-forced forced-light">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[420px] p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[#e6f4ee] flex items-center justify-center text-[#00a884]">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-slate-800">Rename Project</h3>
                  <p className="text-[11px] text-slate-400">Update the name for this workspace</p>
                </div>
              </div>
              <button
                onClick={() => setEditProject(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRename} className="space-y-4">
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  ref={editInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Project name"
                  disabled={isSavingEdit}
                  className="h-11 pl-11 border-slate-200/80 rounded-xl focus-visible:ring-[#00a884] focus-visible:border-[#00a884] text-[12.5px] font-bold text-slate-800 placeholder:text-slate-400 bg-white"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditProject(null)}
                  className="flex-1 h-11 rounded-xl border-slate-200 text-slate-600 font-bold text-[12px] hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim() || editName.trim() === editProject.name}
                  className="flex-1 h-11 bg-[#00a884] hover:bg-[#009675] disabled:opacity-70 text-white font-extrabold rounded-xl text-[12px] shadow-md shadow-emerald-100/50 active:scale-[0.98] transition-all"
                >
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───── DELETE CONFIRM MODAL ───── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 plus-jakarta-forced forced-light">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-[16px] font-black text-slate-800">Delete Project?</h3>
                <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                  You are about to permanently delete{" "}
                  <span className="font-black text-slate-700">"{deleteTarget.name}"</span>. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-1">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-xl border-slate-200 text-slate-600 font-bold text-[12px] hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-70 text-white font-extrabold rounded-xl text-[12px] shadow-md shadow-red-100/50 active:scale-[0.98] transition-all"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Project"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
