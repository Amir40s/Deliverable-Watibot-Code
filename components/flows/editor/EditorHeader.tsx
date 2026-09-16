"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit2, RotateCcw, Sparkles, FileJson, Check, X } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

interface EditorHeaderProps {
 flowName: string;
 onSave: () => void;
 isSaving: boolean;
 isActive: boolean;
 onToggleActive: (active: boolean) => void;
 onExport?: () => void;
 onRename?: (newName: string) => void;
}

export function EditorHeader({ flowName, onSave, isSaving, isActive, onToggleActive, onExport, onRename }: EditorHeaderProps) {
 const [isEditing, setIsEditing] = useState(false);
 const [tempName, setTempName] = useState(flowName);
 const inputRef = useRef<HTMLInputElement>(null);
 const t = useTranslations("FlowEditor");

 useEffect(() => {
 setTempName(flowName);
 }, [flowName]);

 const handleStartEdit = () => {
 setIsEditing(true);
 setTimeout(() => inputRef.current?.focus(), 0);
 };

 const handleSaveRename = () => {
 if (tempName.trim() && tempName !== flowName) {
 onRename?.(tempName.trim());
 }
 setIsEditing(false);
 };

 const handleCancelRename = () => {
 setTempName(flowName);
 setIsEditing(false);
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key ==='Enter') handleSaveRename();
 if (e.key ==='Escape') handleCancelRename();
 };

 return (
 <div className="h-[72px] border-b border-border bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0 z-20 relative shadow-ring">
 <div className="flex items-center gap-4">
 <Link href="/dashboard/flows">
 <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors">
 <ArrowLeft className="w-5 h-5" />
 </Button>
 </Link>
 <div className="flex items-center gap-3">
 {isEditing ? (
 <div className="flex items-center gap-2">
 <input
 ref={inputRef}
 type="text"
 value={tempName}
 onChange={(e) => setTempName(e.target.value)}
 onBlur={handleSaveRename}
 onKeyDown={handleKeyDown}
 className="text-xl font-semibold bg-muted dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary rounded-standard px-2 py-1 text-foreground w-[300px]"
 />
 <div className="flex items-center gap-1">
 <button onClick={handleSaveRename} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 rounded">
 <Check className="w-4 h-4" />
 </button>
 <button onClick={handleCancelRename} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded">
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 ) : (
 <>
 <h1 className="text-xl font-semibold text-foreground">{flowName || t("untitled")}</h1>
 <button 
 onClick={handleStartEdit}
 className="p-1 hover:bg-muted dark:hover:bg-slate-800 rounded-md transition-colors text-muted-foreground hover:text-foreground"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 </>
 )}
 </div>
 </div>

 <div className="flex-1" />

 <div className="flex items-center gap-2">
 <div className="flex items-center bg-muted dark:bg-slate-800/50 rounded-pill p-1 border border-border">
 <Button 
 onClick={onExport}
 variant="ghost" 
 size="sm" 
 className="h-9 px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-all"
 >
 <FileJson className="w-3.5 h-3.5 mr-1.5" />
 {t("exportJson")}
 </Button>
 </div>

 <div className="h-6 w-px bg-border mx-1" />
 
 <div className="flex items-center gap-2.5 px-3 bg-muted dark:bg-slate-800/50 rounded-pill h-11 border border-border">
 <span className={cn("text-[9px] font-bold uppercase tracking-widest transition-colors", !isActive ? "text-foreground" : "text-muted-foreground")}>{t("off")}</span>
 <Switch 
 checked={isActive}
 onCheckedChange={onToggleActive}
 className="scale-90 data-[state=checked]:bg-primary"
 />
 <span className={cn("text-[9px] font-bold uppercase tracking-widest transition-colors", isActive ? "text-foreground" : "text-muted-foreground")}>{t("live")}</span>
 </div>

 <div className="ml-2">
 <Button 
 onClick={onSave} 
 disabled={isSaving}
 variant="default"
 size="default"
 >
 {isSaving ? t("saving") : t("saveChanges")}
 </Button>
 </div>
 </div>
 </div>
 );
}
