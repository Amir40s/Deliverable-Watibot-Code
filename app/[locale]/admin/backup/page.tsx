"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  DatabaseBackup,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RESTORE_CONFIRMATION = "RESTORE GLOBAL BACKUP";
const EMPTY_CONFIRMATION = "FACTORY RESET";

type RestoreResult = {
  restoredAt: string;
  tableCount: number;
  rowCount: number;
  mediaFileCount: number;
};

type BackupStatus = {
  hasBackup: boolean;
  isCurrent: boolean;
  message: string;
  checkedAt: string;
  lastBackupAt?: string;
  current: {
    tableCount: number;
    rowCount: number;
    mediaFileCount: number;
    mediaBytes: number;
  };
  lastBackup?: {
    tableCount: number;
    rowCount: number;
    mediaFileCount: number;
    mediaBytes: number;
  };
  changes: {
    rowDelta: number;
    mediaFileDelta: number;
    mediaBytesDelta: number;
    changedTables: Array<{
      name: string;
      currentRows: number;
      lastRows: number;
      rowDelta: number;
    }>;
    changedMediaFiles: Array<{
      path: string;
      currentSize: number;
      lastSize: number;
      status: "added" | "removed" | "updated";
    }>;
  };
};

type TransferProgress = {
  stage: "preparing" | "downloading" | "uploading" | "restoring" | "complete" | "error";
  label: string;
  percent: number;
  loaded?: number;
  total?: number | null;
};

type ParsedBackupSummary = {
  version: number;
  createdAt: string;
  tableCount: number;
  rowCount: number;
  mediaFileCount: number;
  mediaBytes: number;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDelta(value: number) {
  if (value > 0) return `+${value.toLocaleString()}`;
  return value.toLocaleString();
}

function getDefaultBackupFileName() {
  return `watibot-global-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function downloadBlobToBrowser(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ProgressPanel({
  progress,
  indicatorClassName,
}: {
  progress: TransferProgress | null;
  indicatorClassName?: string;
}) {
  if (!progress) return null;

  const remaining =
    typeof progress.total === "number"
      ? Math.max(progress.total - (progress.loaded || 0), 0)
      : null;
  const isIndeterminate = progress.stage === "preparing" || progress.stage === "restoring";

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{progress.label}</p>
        <span className="shrink-0 text-sm font-black tabular-nums text-slate-500 dark:text-slate-400">
          {Math.round(progress.percent)}%
        </span>
      </div>
      <Progress
        value={progress.percent}
        className={cn("h-3 bg-slate-200 dark:bg-slate-800", isIndeterminate && "animate-pulse")}
        indicatorClassName={indicatorClassName}
      />
      <div className="mt-3 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span>
          {typeof progress.loaded === "number" ? formatBytes(progress.loaded) : "Preparing"}
          {typeof progress.total === "number" ? ` / ${formatBytes(progress.total)}` : ""}
        </span>
        <span>{remaining === null ? "Calculating remaining" : `${formatBytes(remaining)} remaining`}</span>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: any;
  title: string;
  value: string;
  tone: "emerald" | "blue" | "violet" | "amber";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
    violet: "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/50",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border", tones[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function GlobalBackupPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedSummary, setParsedSummary] = useState<ParsedBackupSummary | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [confirmation, setConfirmation] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTargetDb, setExportTargetDb] = useState<'neon' | 'contabo'>('neon');
  const [restoreTargetDb, setRestoreTargetDb] = useState<'neon' | 'contabo'>('neon');

  const [lastRestore, setLastRestore] = useState<RestoreResult | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [backupProgress, setBackupProgress] = useState<TransferProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<TransferProgress | null>(null);
  const [showBackupStatus, setShowBackupStatus] = useState(false);

  const [isEmptying, setIsEmptying] = useState(false);
  const [isEmptyModalOpen, setIsEmptyModalOpen] = useState(false);
  const [emptyConfirmation, setEmptyConfirmation] = useState("");
  const [connectedDbName, setConnectedDbName] = useState("");

  const canRestore = Boolean(parsedSummary) && !validationError && confirmation === RESTORE_CONFIRMATION && !isRestoring;

  const refreshBackupStatus = async (showToast = false) => {
    setIsCheckingStatus(true);
    try {
      const response = await fetch(`/api/admin/backup/status?t=${Date.now()}`, { method: "GET", cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error || "Failed to check backup status");
      setBackupStatus(data.status);
      if (data.databaseName) setConnectedDbName(data.databaseName);
      if (showToast) toast.success("Backup status checked");
    } catch (error: any) {
      if (showToast) toast.error(error?.message || "Status check failed");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    void refreshBackupStatus();
  }, []);

  const handleGenerateBackup = async (targetDb: 'neon' | 'contabo' = exportTargetDb) => {
    setIsExportModalOpen(false);
    setIsGenerating(true);
    setBackupProgress({
      stage: "preparing",
      label: `Preparing global backup file from ${targetDb === 'contabo' ? 'Contabo' : 'Neon'}...`,
      percent: 8,
      total: null,
    });
    const toastId = toast.loading(`Generating backup from ${targetDb === 'contabo' ? 'Contabo' : 'Neon'}...`);

    try {
      const response = await fetch(`/api/admin/backup/export?targetDb=${targetDb}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to generate backup");
      }

      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || getDefaultBackupFileName();
      const totalBytes = Number(response.headers.get("Content-Length") || 0);
      const contentType = response.headers.get("Content-Type") || "application/json";
      let blob: Blob;

      if (response.body && totalBytes > 0) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let loadedBytes = 0;

        setBackupProgress({
          stage: "downloading",
          label: "Downloading backup file...",
          percent: 0,
          loaded: 0,
          total: totalBytes,
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          const chunk = new Uint8Array(value);
          chunks.push(chunk);
          loadedBytes += chunk.byteLength;
          setBackupProgress({
            stage: "downloading",
            label: "Downloading backup file...",
            percent: Math.min(99, Math.round((loadedBytes / totalBytes) * 100)),
            loaded: loadedBytes,
            total: totalBytes,
          });
        }
        blob = new Blob(chunks, { type: contentType });
      } else {
        setBackupProgress({
          stage: "downloading",
          label: "Downloading backup file...",
          percent: 50,
          total: null,
        });
        blob = await response.blob();
      }

      downloadBlobToBrowser(blob, filename);

      setBackupProgress({
        stage: "complete",
        label: "Backup download complete.",
        percent: 100,
        loaded: blob.size,
        total: blob.size,
      });
      await refreshBackupStatus();
      toast.success("Global backup downloaded and status updated", { id: toastId });
    } catch (error: any) {
      setBackupProgress({
        stage: "error",
        label: error?.message || "Backup failed",
        percent: 0,
        total: null,
      });
      toast.error(error?.message || "Backup failed", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setParsedSummary(null);
    setValidationError(null);
    setConfirmation("");
    
    if (!file) return;

    if (file.size > 1024 * 1024 * 1024) {
       setValidationError("File is too large to validate in browser. Proceed with caution.");
       return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      if (json.app !== "watibot" || json.type !== "global-backup") {
        throw new Error("Invalid backup file: Not a WatiBot global backup");
      }
      if (!json.summary) {
        throw new Error("Invalid backup file: Missing summary metadata");
      }
      
      setParsedSummary({
        version: json.version,
        createdAt: json.createdAt,
        tableCount: json.summary.tableCount,
        rowCount: json.summary.rowCount,
        mediaFileCount: json.summary.mediaFileCount,
        mediaBytes: json.summary.mediaBytes,
      });
    } catch (err: any) {
      setValidationError(err.message || "Failed to parse JSON backup file");
    }
  };

  const executeRestore = async () => {
    if (!selectedFile) return;
    setIsConfirmModalOpen(false);
    setIsRestoring(true);
    setRestoreProgress({
      stage: "uploading",
      label: "Uploading backup file...",
      percent: 0,
      loaded: 0,
      total: selectedFile.size,
    });
    const toastId = toast.loading(`Restoring backup into ${restoreTargetDb === 'contabo' ? 'Contabo' : 'Neon'}...`);
    let restoreTimer: ReturnType<typeof setInterval> | null = null;

    try {
      const formData = new FormData();
      formData.append("backup", selectedFile);
      formData.append("confirmation", confirmation);
      formData.append("targetDb", restoreTargetDb);

      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/backup/restore");
        xhr.responseType = "text";

        xhr.upload.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : selectedFile.size;
          const loaded = event.loaded;
          const uploadPercent = total ? Math.round((loaded / total) * 60) : 10;
          setRestoreProgress({
            stage: "uploading",
            label: "Uploading backup file...",
            percent: Math.min(60, uploadPercent),
            loaded,
            total,
          });
        };

        xhr.upload.onload = () => {
          setRestoreProgress({
            stage: "restoring",
            label: "Restoring database and media...",
            percent: 70,
            loaded: selectedFile.size,
            total: selectedFile.size,
          });

          restoreTimer = setInterval(() => {
            setRestoreProgress((current) => {
              if (!current || current.stage !== "restoring") return current;
              return { ...current, percent: Math.min(95, current.percent + 3) };
            });
          }, 900);
        };

        xhr.onerror = () => reject(new Error("Restore request failed"));

        xhr.onload = () => {
          if (restoreTimer) clearInterval(restoreTimer);
          const responseData = (() => {
            try { return JSON.parse(xhr.responseText); } catch { return null; }
          })();

          if (xhr.status < 200 || xhr.status >= 300 || !responseData?.success) {
            reject(new Error(responseData?.error || "Failed to restore backup"));
            return;
          }
          resolve(responseData);
        };
        xhr.send(formData);
      });

      setLastRestore({
        restoredAt: data.restoredAt,
        tableCount: data.tableCount,
        rowCount: data.rowCount,
        mediaFileCount: data.mediaFileCount,
      });
      setConfirmation("");
      setSelectedFile(null);
      setParsedSummary(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setRestoreProgress({
        stage: "complete",
        label: "Restore complete.",
        percent: 100,
        loaded: selectedFile.size,
        total: selectedFile.size,
      });
      await refreshBackupStatus();
      toast.success("Global backup restored successfully", { id: toastId });
    } catch (error: any) {
      if (restoreTimer) clearInterval(restoreTimer);
      setRestoreProgress({
        stage: "error",
        label: error?.message || "Restore failed",
        percent: 0,
        total: selectedFile.size,
      });
      toast.error(error?.message || "Restore failed", { id: toastId });
    } finally {
      setIsRestoring(false);
    }
  };

  const executeEmptyDatabase = async () => {
    setIsEmptyModalOpen(false);
    setIsEmptying(true);
    const toastId = toast.loading("Emptying database...");
    
    try {
      const response = await fetch("/api/admin/backup/empty", { method: "POST" });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to empty database");
      }
      
      setEmptyConfirmation("");
      toast.success(`Successfully emptied ${data.tableCount} tables. Database is now factory reset!`, { id: toastId });
      
    } catch (error: any) {
      toast.error(error?.message || "Failed to empty database", { id: toastId });
    } finally {
      setIsEmptying(false);
    }
  };

  const statusTone = !backupStatus
    ? "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-300"
    : backupStatus.isCurrent
      ? "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300"
      : "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300";
      
  const changedTablesPreview = backupStatus?.changes.changedTables.slice(0, 5) || [];
  const changedMediaPreview = backupStatus?.changes.changedMediaFiles.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 plus-jakarta-forced">
      <div className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl flex-col justify-center gap-3 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00a884]">
              <ShieldCheck className="h-4 w-4" />
              <span>Super Admin Protocol</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Global Backup & Restore</h1>
            <p className="max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
              Manage complete platform snapshots. Includes all accounts, users, tables, flows, automations, chat messages, billing records, and media files.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={DatabaseBackup} title="Database Scope" value="All Tables" tone="emerald" />
          <InfoCard icon={FileJson} title="Backup Format" value="JSON" tone="blue" />
          <InfoCard icon={HardDrive} title="Media Included" value="URLs + Uploads" tone="violet" />
          <InfoCard icon={ArchiveRestore} title="Restore Mode" value="Replace All" tone="amber" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
                  backupStatus?.isCurrent
                    ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400",
                )}
              >
                {isCheckingStatus ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : backupStatus?.isCurrent ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Real-Time Status</p>
                <p className="mt-1 text-base font-bold text-slate-800 dark:text-white">
                  {backupStatus?.message || "Analyzing global database state..."}
                </p>
                {backupStatus?.lastBackupAt && (
                   <p className="mt-1 text-xs text-slate-500">Last backup: {formatDateTime(backupStatus.lastBackupAt)}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => refreshBackupStatus(true)}
                disabled={isCheckingStatus || isGenerating || isRestoring}
                variant="outline"
                className="h-12 rounded-xl border-slate-200 bg-white px-6 text-sm font-bold shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                {isCheckingStatus ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
                Sync Status
              </Button>
              <Button
                type="button"
                onClick={() => setShowBackupStatus((current) => !current)}
                className="h-12 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {showBackupStatus ? <EyeOff className="me-2 h-4 w-4" /> : <Eye className="me-2 h-4 w-4" />}
                {showBackupStatus ? "Hide Details" : "View Details"}
              </Button>
            </div>
          </div>

          {showBackupStatus && backupStatus && (
            <div className="mt-8 animate-in slide-in-from-top-4 fade-in duration-300">
               <div className={cn("rounded-2xl border p-6 shadow-inner", statusTone)}>
                 <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                   <div className="rounded-xl bg-white/60 p-5 backdrop-blur-sm dark:bg-slate-950/40">
                     <p className="text-xs font-bold uppercase tracking-wider opacity-70">Current Rows</p>
                     <p className="mt-2 text-2xl font-black">{backupStatus.current.rowCount.toLocaleString()}</p>
                     {!backupStatus.isCurrent && backupStatus.hasBackup && (
                        <p className="mt-1 text-xs font-semibold opacity-80">{formatDelta(backupStatus.changes.rowDelta)} since last backup</p>
                     )}
                   </div>
                   <div className="rounded-xl bg-white/60 p-5 backdrop-blur-sm dark:bg-slate-950/40">
                     <p className="text-xs font-bold uppercase tracking-wider opacity-70">Media Files</p>
                     <p className="mt-2 text-2xl font-black">{backupStatus.current.mediaFileCount.toLocaleString()}</p>
                     {!backupStatus.isCurrent && backupStatus.hasBackup && (
                        <p className="mt-1 text-xs font-semibold opacity-80">{formatDelta(backupStatus.changes.mediaFileDelta)} since last backup</p>
                     )}
                   </div>
                   <div className="rounded-xl bg-white/60 p-5 backdrop-blur-sm dark:bg-slate-950/40">
                     <p className="text-xs font-bold uppercase tracking-wider opacity-70">Media Size</p>
                     <p className="mt-2 text-2xl font-black">{formatBytes(backupStatus.current.mediaBytes)}</p>
                     {!backupStatus.isCurrent && backupStatus.hasBackup && (
                        <p className="mt-1 text-xs font-semibold opacity-80">{formatDelta(backupStatus.changes.mediaBytesDelta)} B since last backup</p>
                     )}
                   </div>
                 </div>

                 {!backupStatus.isCurrent && (changedTablesPreview.length > 0 || changedMediaPreview.length > 0) && (
                   <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                     {changedTablesPreview.length > 0 && (
                       <div className="rounded-xl bg-white/60 p-5 text-sm font-medium shadow-sm dark:bg-slate-950/40">
                         <p className="mb-4 text-xs font-bold uppercase tracking-wider opacity-70">Updated Tables (Preview)</p>
                         <div className="space-y-3">
                           {changedTablesPreview.map((table) => (
                             <div key={table.name} className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0 last:pb-0 dark:border-white/5">
                               <span className="font-semibold">{table.name}</span>
                               <span className="tabular-nums opacity-80">{formatDelta(table.rowDelta)} rows</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                     {changedMediaPreview.length > 0 && (
                       <div className="rounded-xl bg-white/60 p-5 text-sm font-medium shadow-sm dark:bg-slate-950/40">
                         <p className="mb-4 text-xs font-bold uppercase tracking-wider opacity-70">Updated Files (Preview)</p>
                         <div className="space-y-3">
                           {changedMediaPreview.map((file) => (
                             <div key={file.path} className="flex items-center justify-between border-b border-black/5 pb-2 last:border-0 last:pb-0 dark:border-white/5">
                               <span className="truncate pr-4 font-semibold">{file.path}</span>
                               <span className="shrink-0 capitalize opacity-80">{file.status}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Generate Backup Section */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-8 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00a884]/10 text-[#00a884]">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Generate Backup</h2>
                  <p className="text-sm text-slate-500">Download a secure JSON snapshot to your local machine.</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-1 flex-col p-8">
              <div className="mb-8 rounded-xl border border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Included in Snapshot</p>
                <div className="grid grid-cols-1 gap-4 text-sm font-semibold text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                  {[
                    "Organizations & Users",
                    "Contacts & Messages",
                    "Flows & Executions",
                    "Campaigns & Billing",
                    "Integrations & Tokens",
                    "Media URLs & Uploads",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00a884]/20 text-[#00a884]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto space-y-4">
                <Button
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={isGenerating || isRestoring}
                  className="h-14 w-full rounded-xl bg-[#00a884] text-sm font-bold text-white shadow-md hover:bg-[#00946f]"
                >
                  {isGenerating ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Download className="me-2 h-5 w-5" />}
                  Generate & Download Backup
                </Button>
                <ProgressPanel progress={backupProgress} indicatorClassName="bg-[#00a884]" />
              </div>
            </div>
          </section>

          {/* Restore Backup Section */}
          <section className="flex flex-col rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/30 dark:bg-slate-900">
            <div className="border-b border-red-100 p-8 dark:border-red-900/30">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Restore Backup</h2>
                  <p className="text-sm text-slate-500">Upload a JSON snapshot to override the entire platform.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-8">
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider">Critical Warning</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed">
                      Restoring a backup will permanently replace all current database records and media files. This action cannot be undone. Active sessions may be terminated.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRestoring || isGenerating}
                    className={cn(
                       "flex min-h-[5rem] w-full items-center justify-center rounded-xl border-2 border-dashed px-6 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                       selectedFile && !validationError 
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : selectedFile && validationError
                          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                          : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400 dark:hover:bg-slate-900"
                    )}
                  >
                    {selectedFile && !validationError ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>File Verified: {selectedFile.name} ({formatBytes(selectedFile.size)})</span>
                      </div>
                    ) : selectedFile && validationError ? (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5" />
                        <span>{validationError}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileJson className="h-5 w-5 text-red-500" />
                        <span>Select backup JSON file</span>
                      </div>
                    )}
                  </button>
                </div>

                {parsedSummary && (
                   <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                     <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Backup Contents</p>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                       <div>
                         <span className="block text-xs text-slate-500">Created</span>
                         <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(parsedSummary.createdAt)}</span>
                       </div>
                       <div>
                         <span className="block text-xs text-slate-500">Version</span>
                         <span className="font-semibold text-slate-900 dark:text-slate-100">v{parsedSummary.version}</span>
                       </div>
                       <div>
                         <span className="block text-xs text-slate-500">Database</span>
                         <span className="font-semibold text-slate-900 dark:text-slate-100">{parsedSummary.rowCount.toLocaleString()} rows in {parsedSummary.tableCount} tables</span>
                       </div>
                       <div>
                         <span className="block text-xs text-slate-500">Media</span>
                         <span className="font-semibold text-slate-900 dark:text-slate-100">{parsedSummary.mediaFileCount.toLocaleString()} files ({formatBytes(parsedSummary.mediaBytes)})</span>
                       </div>
                     </div>
                   </div>
                )}

                {parsedSummary && !validationError && (
                   <div className="animate-in fade-in slide-in-from-top-4 space-y-3">
                     <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                       Type <span className="text-red-600 font-black">{RESTORE_CONFIRMATION}</span> to proceed
                     </label>
                     <Input
                       value={confirmation}
                       onChange={(event) => setConfirmation(event.target.value)}
                       disabled={isRestoring || isGenerating}
                       placeholder={RESTORE_CONFIRMATION}
                       className="h-12 rounded-xl border-slate-300 bg-white text-sm font-bold focus-visible:ring-red-500 dark:border-slate-700 dark:bg-slate-950"
                     />
                   </div>
                )}

                <div className="mt-auto">
                  <Button
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={!canRestore || isGenerating}
                    className="h-14 w-full rounded-xl bg-red-600 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                  >
                    {isRestoring ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <RefreshCw className="me-2 h-5 w-5" />}
                    Restore Platform Data
                  </Button>
                  <ProgressPanel progress={restoreProgress} indicatorClassName="bg-red-600" />
                  
                  {lastRestore && (
                    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                      Successfully restored {lastRestore.rowCount.toLocaleString()} rows and {lastRestore.mediaFileCount} media files at {formatDateTime(lastRestore.restoredAt)}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Empty Database Section */}
        <section className="mt-8 flex flex-col rounded-2xl border border-red-500 bg-red-50 shadow-sm dark:border-red-900/50 dark:bg-red-950/20">
          <div className="border-b border-red-200 p-8 dark:border-red-900/30">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                  Factory Reset (Empty Database)
                  {connectedDbName && (
                    <span className="text-xs font-bold uppercase tracking-widest bg-red-100 text-red-600 px-2 py-1 rounded-md border border-red-200 dark:bg-red-900/40 dark:border-red-800/50">
                      {connectedDbName}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Permanently delete all rows from all tables to prepare for a fresh import.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-8">
            <div className="mb-6 rounded-xl border border-red-200 bg-white p-5 text-red-800 dark:border-red-900/50 dark:bg-black/20 dark:text-red-300">
              <p className="text-sm font-medium leading-relaxed">
                If your pg_dump import failed due to duplicate keys, you can use this to completely empty the database. This acts as a factory reset.
              </p>
            </div>

            <div className="space-y-6">
              <div className="animate-in fade-in space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Type <span className="text-red-600 font-black">{EMPTY_CONFIRMATION}</span> to proceed
                </label>
                <Input
                  value={emptyConfirmation}
                  onChange={(event) => setEmptyConfirmation(event.target.value)}
                  disabled={isEmptying || isRestoring || isGenerating}
                  placeholder={EMPTY_CONFIRMATION}
                  className="h-12 rounded-xl border-slate-300 bg-white text-sm font-bold focus-visible:ring-red-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="mt-auto">
                <Button
                  onClick={() => setIsEmptyModalOpen(true)}
                  disabled={emptyConfirmation !== EMPTY_CONFIRMATION || isEmptying || isRestoring || isGenerating}
                  className="h-14 w-full rounded-xl bg-red-600 text-sm font-bold text-white shadow-md hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  {isEmptying ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <AlertTriangle className="me-2 h-5 w-5" />}
                  Empty Entire Database
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Export Target DB Selection Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg">
              <Download className="h-5 w-5 text-[#00a884]" />
              Select Database to Export From
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-500 dark:text-slate-400">
              Select which database connection to export the global JSON backup snapshot from:
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div
              onClick={() => setExportTargetDb('neon')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                exportTargetDb === 'neon'
                  ? 'border-[#00a884] bg-[#00a884]/5 dark:bg-[#00a884]/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${exportTargetDb === 'neon' ? 'border-[#00a884]' : 'border-slate-400'}`}>
                  {exportTargetDb === 'neon' && <div className="w-2 h-2 rounded-full bg-[#00a884]" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Neon PostgreSQL</p>
                  <p className="text-xs text-slate-500">Primary database (DATABASE_URL)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Primary</span>
            </div>

            <div
              onClick={() => setExportTargetDb('contabo')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                exportTargetDb === 'contabo'
                  ? 'border-[#00a884] bg-[#00a884]/5 dark:bg-[#00a884]/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${exportTargetDb === 'contabo' ? 'border-[#00a884]' : 'border-slate-400'}`}>
                  {exportTargetDb === 'contabo' && <div className="w-2 h-2 rounded-full bg-[#00a884]" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Contabo PostgreSQL</p>
                  <p className="text-xs text-slate-500">Secondary migration DB (CONTABO_DATABASE_URL)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">Secondary</span>
            </div>
          </div>

          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExportModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleGenerateBackup(exportTargetDb)}
              className="rounded-xl bg-[#00a884] font-bold text-white hover:bg-[#00946f]"
            >
              Export Selected Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black text-lg">
              <AlertTriangle className="h-5 w-5" />
              Final Confirmation & Destination Selection
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-600 dark:text-slate-400">
              Select the destination database where this backup file should be restored:
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Destination Database</p>
            <div
              onClick={() => setRestoreTargetDb('neon')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                restoreTargetDb === 'neon'
                  ? 'border-red-500 bg-red-500/5 dark:bg-red-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${restoreTargetDb === 'neon' ? 'border-red-500' : 'border-slate-400'}`}>
                  {restoreTargetDb === 'neon' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Neon PostgreSQL</p>
                  <p className="text-xs text-slate-500">Restore into Primary Neon Database</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">Primary</span>
            </div>

            <div
              onClick={() => setRestoreTargetDb('contabo')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                restoreTargetDb === 'contabo'
                  ? 'border-red-500 bg-red-500/5 dark:bg-red-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${restoreTargetDb === 'contabo' ? 'border-red-500' : 'border-slate-400'}`}>
                  {restoreTargetDb === 'contabo' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Contabo PostgreSQL</p>
                  <p className="text-xs text-slate-500">Restore into Secondary Contabo Database</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">Secondary</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
              Warning: Restoring will overwrite existing data in the target database.
            </p>
          </div>

          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={executeRestore}
              className="rounded-xl bg-red-600 font-bold text-white hover:bg-red-700"
            >
              Yes, Restore Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmptyModalOpen} onOpenChange={setIsEmptyModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Factory Reset
            </DialogTitle>
            <DialogDescription className="pt-3 text-sm text-slate-600 dark:text-slate-400">
              You are about to irreversibly empty the entire database. 
              <br/><br/>
              <strong>All current data will be permanently wiped out.</strong>
              <br/><br/>
              Are you absolutely sure you want to empty the database?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEmptyModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={executeEmptyDatabase}
              className="rounded-xl bg-red-600 font-bold text-white hover:bg-red-700"
            >
              Yes, Empty Database Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
