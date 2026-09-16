"use client"

import React, { useState, useEffect } from "react"
import {
 Building2
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
import { useTranslations } from "next-intl"

interface CreateDepartmentModalProps {
 isOpen: boolean
 onOpenChange: (open: boolean) => void
 onCreate: (name: string) => void
 onUpdate?: (id: string, name: string) => void
 editData?: { id: string; name: string }
}

export function CreateDepartmentModal({ isOpen, onOpenChange, onCreate, onUpdate, editData }: CreateDepartmentModalProps) {
 const t = useTranslations("agents")
 const [deptName, setDeptName] = useState("")
 const [isLoading, setIsLoading] = useState(false)

 useEffect(() => {
 if (editData && isOpen) {
 setDeptName(editData.name || "")
 } else if (!editData && isOpen) {
 setDeptName("")
 }
 }, [editData, isOpen])

 const handleAction = async () => {
 if (!deptName.trim()) return;
 setIsLoading(true);
 try {
 // Simulate API call delay for premium feel
 await new Promise(resolve => setTimeout(resolve, 800))
 if (editData && onUpdate) {
 await onUpdate(editData.id, deptName);
 } else {
 await onCreate(deptName);
 }
 onOpenChange(false);
 setDeptName("");
 } catch (err) {
 console.error(err);
 } finally {
 setIsLoading(false);
 }
 };

  return (
  <Dialog open={isOpen} onOpenChange={(open) => {
  onOpenChange(open)
  if (!open) setDeptName("")
  }}>
  <DialogContent className="max-w-[450px] p-0 overflow-hidden border-none rounded-[32px] bg-white dark:bg-slate-950 shadow-2xl ">
  <div className="p-8 pb-4 relative shrink-0">
  <DialogHeader>
  <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center mb-4 shadow-xl">
  <Building2 className="w-6 h-6 text-white dark:text-black" />
  </div>
  <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
  {editData ? t("updateUnit") : t("createDepartment")}
  </DialogTitle>
  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
  {editData ? t("updateDeptDesc", { name: editData.name }) : t("createDeptDesc")}
  </p>
  </DialogHeader>
  </div>

  <div className="p-8 pt-4 space-y-6">
  <div className="space-y-2">
  <Label className="text-[10px] font-bold tracking-[0.2em] text-[#6B7280] dark:text-slate-500 ml-1">{t("departmentNameLabel")}</Label>
  <div className="relative">
  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
  <Input
  placeholder={t("deptNamePlaceholder")}
  value={deptName}
  onChange={(e) => setDeptName(e.target.value)}
  className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl text-[14px] px-11 font-medium focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 transition-all text-slate-900 dark:text-white"
  onKeyDown={(e) => e.key === "Enter" && handleAction()}
  />
  </div>
  </div>


  </div>

  {/* Footer */}
  <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
  <Button
  variant="ghost"
  onClick={() => onOpenChange(false)}
  className="h-12 px-6 rounded-xl font-bold text-[11px] tracking-[0.2em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-transparent"
  >
  {t("cancel")}
  </Button>
  <Button
  onClick={handleAction}
  disabled={isLoading || !deptName.trim()}
  className="h-12 px-10 bg-[#10B981] text-white hover:bg-[#059669] shadow-xl shadow-emerald-500/20 rounded-xl font-bold text-[11px] tracking-[0.2em] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 border-none"
  >
  {isLoading ? t("saving") : (editData ? t("update") : t("create"))}
  </Button>
  </div>
 </DialogContent>
 </Dialog>
 )
}
