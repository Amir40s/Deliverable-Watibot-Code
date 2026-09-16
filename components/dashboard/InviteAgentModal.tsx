"use client"

import React, { useState, useEffect } from "react"
import {
  UserPlus,
  Mail,
  User,
  Lock,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createAgent, updateAgent } from "@/app/actions/agents"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"

interface EditableAgentData {
  id: string
  name?: string | null
  email?: string
  status?: string
  permissions?: Record<string, unknown>
  department?: {
    name?: string | null
  } | null
}

interface CreateAgentModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  availableDepartments?: string[]
  onSuccess?: () => void
  editData?: EditableAgentData | null
}

export function InviteAgentModal({ isOpen, onOpenChange, availableDepartments = [], onSuccess, editData }: CreateAgentModalProps) {
  const t = useTranslations("agents")
  const locale = useLocale()
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr"
  const isRtl = dir === "rtl"
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedPerms, setSelectedPerms] = useState<Record<string, unknown>>({})
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
    status: "ACTIVE"
  })

  useEffect(() => {
    setShowPassword(false)
    if (editData && isOpen) {
      setFormData({
        name: editData.name || "",
        email: editData.email || "",
        password: "", // Don't populate password
        department: editData.department?.name || "",
        status: editData.status || "ACTIVE"
      })
      setSelectedPerms(editData.permissions || {})
    } else if (!editData && isOpen) {
      // Reset for new agent
      setFormData({
        name: "",
        email: "",
        password: "",
        department: "",
        status: "ACTIVE"
      })
      setSelectedPerms({})
    }
  }, [editData, isOpen])

  const passwordLength = formData.password.length
  const isPasswordValid = editData
    ? passwordLength === 0 || passwordLength >= 8
    : passwordLength >= 8

  const isFormValid =
    formData.name.trim().length > 0 &&
    formData.email.trim().length > 0 &&
    isPasswordValid

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error(t("usernameLabel") || "Name is required")
      return
    }

    if (!formData.email.trim()) {
      toast.error(t("emailLabel") || "Email is required")
      return
    }

    if (!editData && passwordLength < 8) {
      toast.error(t("passwordMinLength") || "Password must be at least 8 characters long")
      return
    }

    if (editData && passwordLength > 0 && passwordLength < 8) {
      toast.error(t("passwordMinLength") || "Password must be at least 8 characters long")
      return
    }

    setIsLoading(true)
    try {
      if (editData) {
        await updateAgent(editData.id, {
          ...formData,
          name: formData.name.trim(),
          email: formData.email.trim(),
          permissions: selectedPerms,
          departmentName: formData.department
        })
        toast.success(t("toastAgentUpdated"))
      } else {
        await createAgent({
          ...formData,
          name: formData.name.trim(),
          email: formData.email.trim(),
          permissions: selectedPerms,
          departmentName: formData.department
        })
        toast.success(t("toastAgentCreated"))
      }

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("operationFailed"))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="p-0 overflow-hidden border-none rounded-[32px] bg-white dark:bg-slate-950 shadow-2xl max-w-[500px] plus-jakarta-forced">
        {/* Header */}
        <div className="p-8 pb-4 relative shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <DialogHeader>
            <div className="space-y-1 text-start">
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-[#00B074]" />
                {editData ? t("editAgent") : t("createAgent")}
              </DialogTitle>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                {editData ? t("updateAgentDesc") : t("createAgentDesc")}
              </p>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 space-y-6">
          <div className="grid grid-cols-1 gap-5">
            {/* Username */}
            <div className="space-y-2 text-start">
              <Label className="text-xs font-bold text-slate-500/90 dark:text-slate-400 ms-1 block">
                {t("usernameLabel")}
              </Label>
              <div className="relative">
                <User className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRtl ? "right-4" : "left-4")} />
                <Input
                  placeholder={t("usernamePlaceholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={cn(
                    "h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus-visible:border-[#00B074] focus-visible:ring-[#00B074]/20 transition-all text-slate-900 dark:text-white focus:border-[#00B074] focus:ring-2 focus:ring-[#00B074]/20",
                    isRtl ? "text-right pr-11 pl-4" : "text-left pl-11 pr-4"
                  )}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2 text-start">
              <Label className="text-xs font-bold text-slate-500/90 dark:text-slate-400 ms-1 block">
                {t("emailLabel")}
              </Label>
              <div className="relative">
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRtl ? "right-4" : "left-4")} />
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={cn(
                    "h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus-visible:border-[#00B074] focus-visible:ring-[#00B074]/20 transition-all text-slate-900 dark:text-white focus:border-[#00B074] focus:ring-2 focus:ring-[#00B074]/20",
                    isRtl ? "text-right pr-11 pl-4" : "text-left pl-11 pr-4"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Password */}
              <div className="space-y-2 text-start">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-500/90 dark:text-slate-400 ms-1 block">
                    {t("passwordLabel")}
                  </Label>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {t("passwordHelp") || "Min 8 chars"}
                  </span>
                </div>
                <div className="relative">
                  <Lock className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRtl ? "right-4" : "left-4")} />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={editData ? t("passwordPlaceholderNew") : t("passwordPlaceholderCreate")}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={cn(
                      "h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus-visible:border-[#00B074] focus-visible:ring-[#00B074]/20 transition-all text-slate-900 dark:text-white focus:border-[#00B074] focus:ring-2 focus:ring-[#00B074]/20",
                      isRtl ? "text-right pr-11 pl-10" : "text-left pl-11 pr-10",
                      formData.password.length > 0 && formData.password.length < 8 ? "border-amber-500/70 focus-visible:border-amber-500 focus-visible:ring-amber-500/20" : ""
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer",
                      isRtl ? "left-3" : "right-3"
                    )}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Validation status indicator */}
                {passwordLength > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 ms-1">
                    {passwordLength >= 8 ? (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {passwordLength}/8+ characters
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {passwordLength}/8 characters ({8 - passwordLength} more needed)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Department */}
              <div className="space-y-2 text-start">
                <Label className="text-xs font-bold text-slate-500/90 dark:text-slate-400 ms-1 block">
                  {t("departmentLabel")}
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger className={cn(
                    "h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:border-[#00B074] focus:ring-[#00B074]/20 focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074] transition-all text-slate-900 dark:text-white flex items-center justify-between",
                    isRtl ? "text-right flex-row-reverse" : "text-left"
                  )}>
                    <div className={cn("flex min-w-0 flex-1 items-center gap-2", isRtl ? "flex-row-reverse justify-start" : "justify-start")}>
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <SelectValue placeholder={t("selectDeptPlaceholder")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 plus-jakarta-forced shadow-lg">
                    {availableDepartments.length > 0 ? (
                      availableDepartments.map(dept => (
                        <SelectItem key={dept} value={dept} className="font-medium text-xs cursor-pointer rounded-lg m-1">
                          {dept}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-[10px] text-center font-bold tracking-widest text-slate-400">
                        {t("noDeptsFound")}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-12 px-6 rounded-xl font-bold text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || !isFormValid}
            className="h-12 px-8 bg-[#00B074] hover:bg-[#00B074]/90 text-white shadow-lg shadow-emerald-500/10 rounded-xl font-bold text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 border-none cursor-pointer"
          >
            {isLoading ? (editData ? t("updating") : t("creating")) : (editData ? t("editAgent") : t("createAgent"))}
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
