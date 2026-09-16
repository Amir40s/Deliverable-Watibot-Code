"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload, X, Palette, Globe, Loader2, ShieldCheck,
  FileText, Phone, Image as ImageIcon, Save, Undo2,
  Clock, Users, ChevronRight, Smartphone, Download,
  ExternalLink, Copy, Check, Cloud, Sparkles, QrCode
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import VendorDetailsSheet from "@/components/admin/vendors/VendorDetailsSheet";
import { Badge } from "@/components/ui/badge";

interface SystemConfig {
  logoLightTheme: string | null;
  smallLogo: string | null;
  favicon: string | null;
  platformName: string;
  seoDescription: string | null;
  supportEmail: string;
  supportPhone?: string | null;
  whatsappNumber?: string | null;
  officeAddress: string | null;
  systemTimezone: string;
  defaultLanguage: string;
  userTerms: string | null;
  privacyPolicy: string | null;
  termsOfService: string | null;
  vendorTerms: string | null;
  lightThemeColors: Record<string, string> | null;
  darkThemeColors: Record<string, string> | null;
  trialLimitDays: number;
  apkDownloadUrl?: string | null;
  playStoreUrl?: string | null;
  appStoreUrl?: string | null;
}

const DEFAULT_LIGHT_COLORS = {
  primary: "#00a884",
  secondary: "#22c55e",
  background: "#fafbfc",
  sidebar: "#ffffff",
  cards: "#ffffff",
  borders: "#e2e8f0",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  chatIncoming: "#ffffff",
  chatOutgoing: "#00a884",
};

const DEFAULT_DARK_COLORS = {
  primary: "#00a884",
  secondary: "#22c55e",
  background: "#090d16",
  sidebar: "#0f172a",
  cards: "#1e293b",
  borders: "#334155",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  chatIncoming: "#1e293b",
  chatOutgoing: "#00a884",
};

const TABS = [
  { id: "brand", label: "Brand Identity", icon: ImageIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "mobile_app", label: "Mobile App (APK)", icon: Smartphone },
  { id: "platform", label: "Platform Information", icon: Globe },
  { id: "support", label: "Support Information", icon: Phone },
  { id: "legal", label: "Legal & Compliance", icon: FileText },
  { id: "localization", label: "Localization", icon: Globe },
  { id: "trials", label: "Trial Limits", icon: Clock },
];

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5 flex-1 min-w-[140px]">
    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
      {label}
    </Label>
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-full h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl pl-12 text-sm font-bold focus-visible:ring-emerald-500"
        />
        <div className="absolute inset-y-0 left-2 flex items-center justify-center">
          <label className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer overflow-hidden shadow-inner flex items-center justify-center shrink-0">
            <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="sr-only" />
            <div className="w-full h-full" style={{ backgroundColor: value || "#000000" }} />
          </label>
        </div>
      </div>
    </div>
  </div>
);

const UploadField = ({ label, description, value, fieldName, onUpload, onRemove }: any) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${label} to Cloudflare R2...`);
    try {
      let uploadedUrl = "";
      let usedPresigned = false;

      try {
        const presignRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "image/png"
          })
        });

        if (presignRes.ok) {
          const { presignedUrl, publicUrl, cleanMime } = await presignRes.json();
          if (presignedUrl) {
            await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open("PUT", presignedUrl);
              xhr.setRequestHeader("Content-Type", cleanMime || file.type || "image/png");
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve(true);
                else reject(new Error(`Direct R2 upload status ${xhr.status}`));
              };
              xhr.onerror = () => reject(new Error("Direct R2 upload network error"));
              xhr.send(file);
            });
            uploadedUrl = publicUrl;
            usedPresigned = true;
          }
        }
      } catch (presignErr) {
        console.warn("Direct R2 presigned upload fallback:", presignErr);
      }

      if (!usedPresigned) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        uploadedUrl = data.url;
      }

      onUpload(fieldName, uploadedUrl);
      toast.success(`${label} uploaded to Cloudflare R2 successfully`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{label}</h4>
            {value && value.includes("r2.dev") && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[9px] font-black tracking-wider uppercase border border-emerald-200/60 dark:border-emerald-800/40">
                Cloudflare R2
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {value ? (
            <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-center h-16 w-32">
              <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
              <button
                type="button"
                onClick={() => onRemove(fieldName)}
                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <div className="h-16 w-32 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {isUploading ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin text-[#00a884]" /> : <ImageIcon className="w-5 h-5 text-slate-400" />}
            </div>
          )}
          <div className="relative">
            <input 
              type="file" 
              accept="image/*,.ico,.svg,.png,.jpg,.jpeg,.webp" 
              onChange={handleFile} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              disabled={isUploading} 
            />
            <Button type="button" variant="outline" disabled={isUploading} className="rounded-xl font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
              {isUploading ? "Uploading..." : "Browse"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GeneralSettingsForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("brand");
  const [originalConfig, setOriginalConfig] = useState<SystemConfig | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");

  // Trial specific states
  const [trialUsers, setTrialUsers] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Mobile App APK upload states
  const [isUploadingApk, setIsUploadingApk] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [copiedApkUrl, setCopiedApkUrl] = useState(false);
  const apkFileInputRef = useRef<HTMLInputElement>(null);

  const handleApkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast.error("Please select a valid Android APK file (.apk)");
      return;
    }

    setIsUploadingApk(true);
    setUploadProgress(0);
    setUploadStatusText("Initiating upload to Cloudflare R2...");
    const toastId = toast.loading(`Uploading ${file.name} to Cloudflare R2 (0%)...`);

    try {
      // Step 1: Request pre-signed direct upload URL
      let uploadedUrl = "";
      let usedPresigned = false;

      try {
        const presignRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/vnd.android.package-archive"
          })
        });

        if (presignRes.ok) {
          const { presignedUrl, publicUrl, cleanMime } = await presignRes.json();
          if (presignedUrl) {
            setUploadStatusText("Uploading directly to Cloudflare R2...");
            await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open("PUT", presignedUrl);
              xhr.setRequestHeader("Content-Type", cleanMime || "application/vnd.android.package-archive");

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const percent = Math.round((event.loaded / event.total) * 100);
                  setUploadProgress(percent);
                  setUploadStatusText(`Uploading to Cloudflare R2: ${percent}%`);
                  toast.loading(`Uploading to Cloudflare R2 (${percent}%)...`, { id: toastId });
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve(true);
                } else {
                  reject(new Error(`Direct R2 upload responded with status ${xhr.status}`));
                }
              };

              xhr.onerror = () => reject(new Error("Direct R2 upload network error"));
              xhr.send(file);
            });

            uploadedUrl = publicUrl;
            usedPresigned = true;
          }
        }
      } catch (presignErr) {
        console.warn("Direct R2 presigned upload skipped/failed, falling back to server route:", presignErr);
      }

      // Step 2: Fallback to /api/upload if direct presigned was not used
      if (!usedPresigned) {
        const formData = new FormData();
        formData.append("file", file);

        const data: any = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 95);
              setUploadProgress(percent);
              if (percent >= 90) {
                setUploadStatusText("Storing & syncing on Cloudflare R2...");
                toast.loading(`Storing on Cloudflare R2...`, { id: toastId });
              } else {
                setUploadStatusText(`Sending file: ${percent}%`);
                toast.loading(`Sending ${file.name} (${percent}%)...`, { id: toastId });
              }
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                resolve(resJson);
              } catch (e) {
                reject(new Error("Invalid server response"));
              }
            } else {
              try {
                const errJson = JSON.parse(xhr.responseText);
                reject(new Error(errJson.error || `Upload failed with status ${xhr.status}`));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          };

          xhr.onerror = () => reject(new Error("Network connection error during upload"));
          xhr.send(formData);
        });

        uploadedUrl = data.url;
      }

      setUploadProgress(100);
      setUploadStatusText("APK ready & live on Cloudflare R2!");
      updateConfig("apkDownloadUrl", uploadedUrl);
      toast.success("APK successfully uploaded and stored on Cloudflare R2!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload APK", { id: toastId });
    } finally {
      setIsUploadingApk(false);
      setUploadProgress(0);
      setUploadStatusText("");
      if (apkFileInputRef.current) apkFileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedApkUrl(true);
    toast.success("APK URL copied to clipboard");
    setTimeout(() => setCopiedApkUrl(false), 2000);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/configurations/general").then(res => res.json()),
      fetch("/api/admin/configurations/trial-limit").then(res => res.json()).catch(() => ({ trialUsers: [] }))
    ])
      .then(([data, trialData]) => {
        const fullConfig = {
          ...data,
          lightThemeColors: data.lightThemeColors || DEFAULT_LIGHT_COLORS,
          darkThemeColors: data.darkThemeColors || DEFAULT_DARK_COLORS,
          trialLimitDays: data.trialLimitDays ?? 15
        };
        setConfig(fullConfig);
        setOriginalConfig(fullConfig);
        setTrialUsers(trialData.trialUsers || []);
        setIsLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load settings");
        setIsLoading(false);
      });
  }, []);

  const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    const toastId = toast.loading("Saving configuration...");
    try {
      const res = await fetch("/api/admin/configurations/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      const updatedConfig = {
        ...data,
        lightThemeColors: data.lightThemeColors || DEFAULT_LIGHT_COLORS,
        darkThemeColors: data.darkThemeColors || DEFAULT_DARK_COLORS,
      };
      setConfig(updatedConfig);
      setOriginalConfig(updatedConfig);
      toast.success("Settings saved securely", { id: toastId });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("general_config_updated"));
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (originalConfig) setConfig(originalConfig);
    toast("Changes reverted to last saved state");
  };

  const updateConfig = (field: keyof SystemConfig, value: any) => {
    setConfig((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleViewVendor = (user: any) => {
    if (!user.vendor) {
      toast.error("Vendor details not found for this user");
      return;
    }
    setSelectedVendor(user.vendor);
    setIsDetailsOpen(true);
  };

  const getInitials = (name: string) => {
    if (!name) return "VN";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const setLightColor = (key: string, val: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, lightThemeColors: { ...prev.lightThemeColors, [key]: val } };
    });
  };

  const setDarkColor = (key: string, val: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, darkThemeColors: { ...prev.darkThemeColors, [key]: val } };
    });
  };

  if (isLoading || !config) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
          <p className="text-sm font-bold uppercase tracking-wider">Loading Configuration...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "brand":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Brand Identity</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                Customize how your platform appears across dashboards, login screens, and browser tabs.
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-slate-900 dark:text-white">Platform / Brand Name</Label>
                    <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 text-[10px] font-bold">
                      Global
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    The platform name used across browser titles, emails, and system notifications.
                  </p>
                  <Input
                    value={config.platformName || ""}
                    onChange={(e) => updateConfig("platformName", e.target.value)}
                    placeholder="e.g. WatiBot"
                    className="h-12 mt-2 rounded-xl bg-slate-50 dark:bg-slate-950 font-bold text-sm border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
              <UploadField label="Platform Logo" description="Primary logo for the sidebar and main navigation" value={config.logoLightTheme} fieldName="logoLightTheme" onUpload={updateConfig} onRemove={(f: any) => updateConfig(f, null)} />
              <UploadField label="Compact Logo" description="Small square logo for collapsed sidebars" value={config.smallLogo} fieldName="smallLogo" onUpload={updateConfig} onRemove={(f: any) => updateConfig(f, null)} />
              <UploadField label="Favicon" description="Icon shown in the browser tab" value={config.favicon} fieldName="favicon" onUpload={updateConfig} onRemove={(f: any) => updateConfig(f, null)} />
            </div>
          </div>
        );

      case "appearance":
        const currentColors = previewMode === "light" ? config.lightThemeColors || DEFAULT_LIGHT_COLORS : config.darkThemeColors || DEFAULT_DARK_COLORS;
        const setModeColor = previewMode === "light" ? setLightColor : setDarkColor;

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Appearance</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Personalize your platform colors to match your brand.
                </p>
              </div>
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button onClick={() => setPreviewMode("light")} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", previewMode === "light" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Light Mode</button>
                <button onClick={() => setPreviewMode("dark")} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", previewMode === "dark" ? "bg-slate-900 text-white shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-300")}>Dark Mode</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">Core Colors</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <ColorField label="Primary Color" value={currentColors.primary} onChange={(v) => setModeColor("primary", v)} />
                    <ColorField label="Secondary Color" value={currentColors.secondary} onChange={(v) => setModeColor("secondary", v)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">Layout Colors</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <ColorField label="Background" value={currentColors.background} onChange={(v) => setModeColor("background", v)} />
                    <ColorField label="Sidebar" value={currentColors.sidebar} onChange={(v) => setModeColor("sidebar", v)} />
                    <ColorField label="Cards" value={currentColors.cards} onChange={(v) => setModeColor("cards", v)} />
                    <ColorField label="Borders" value={currentColors.borders} onChange={(v) => setModeColor("borders", v)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">Chat Bubbles</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <ColorField label="Incoming Message" value={currentColors.chatIncoming} onChange={(v) => setModeColor("chatIncoming", v)} />
                    <ColorField label="Outgoing Message" value={currentColors.chatOutgoing} onChange={(v) => setModeColor("chatOutgoing", v)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">Status Colors</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <ColorField label="Success" value={currentColors.success} onChange={(v) => setModeColor("success", v)} />
                    <ColorField label="Warning" value={currentColors.warning} onChange={(v) => setModeColor("warning", v)} />
                    <ColorField label="Error" value={currentColors.error} onChange={(v) => setModeColor("error", v)} />
                  </div>
                </div>
              </div>

              <div className="sticky top-24 space-y-4">
                <h3 className="text-xs font-black tracking-wider uppercase text-slate-400">Real-Time Preview</h3>
                <div 
                  className="rounded-2xl border overflow-hidden shadow-xl"
                  style={{ backgroundColor: currentColors.background, borderColor: currentColors.borders }}
                >
                  <div className="flex h-64">
                    <div className="w-16 border-r flex flex-col items-center py-4 gap-4" style={{ backgroundColor: currentColors.sidebar, borderColor: currentColors.borders }}>
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: currentColors.primary }} />
                      <div className="w-8 h-8 rounded-lg opacity-20" style={{ backgroundColor: currentColors.primary }} />
                      <div className="w-8 h-8 rounded-lg opacity-20" style={{ backgroundColor: currentColors.primary }} />
                    </div>
                    <div className="flex-1 p-6 flex flex-col gap-4 relative">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-32 rounded" style={{ backgroundColor: previewMode === "dark" ? "#334155" : "#e2e8f0" }} />
                        <div className="h-8 w-24 rounded-lg text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: currentColors.primary }}>Button</div>
                      </div>
                      <div className="flex-1 rounded-xl border p-4 flex flex-col gap-3" style={{ backgroundColor: currentColors.cards, borderColor: currentColors.borders }}>
                        <div className="self-start px-4 py-2 rounded-2xl rounded-tl-sm text-[10px] font-medium shadow-sm max-w-[80%]" style={{ backgroundColor: currentColors.chatIncoming, color: previewMode === "dark" ? "#fff" : "#0f172a" }}>
                          Hello! How can I help you?
                        </div>
                        <div className="self-end px-4 py-2 rounded-2xl rounded-tr-sm text-[10px] font-medium shadow-sm text-white max-w-[80%]" style={{ backgroundColor: currentColors.chatOutgoing }}>
                          I need some assistance with my account.
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColors.success }} />
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColors.warning }} />
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColors.error }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "mobile_app":
        const currentApkUrl = config.apkDownloadUrl || "";
        const qrPreviewData = currentApkUrl || "https://watibot.pro/downloads/watibot.apk";

        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-[#00a884]">
                  <Smartphone className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Mobile App & APK Distribution</h2>
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Upload your Android APK directly to Cloudflare R2 storage or provide mobile app download links.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: APK Uploader & Store Links */}
              <div className="lg:col-span-7 space-y-6">

                {/* 1. Cloudflare R2 APK Upload Section */}
                <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-[#00a884]" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Android APK Direct Upload</h3>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 text-[10px] font-bold">
                      Cloudflare R2
                    </Badge>
                  </div>

                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                    Upload your compiled <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">.apk</code> file directly. It will be securely stored on Cloudflare R2 and served at high speed globally for user downloads.
                  </p>

                  {/* Active APK status if uploaded */}
                  {currentApkUrl ? (
                    <div className="p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                            <Download className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {currentApkUrl.split("/").pop() || "watibot.apk"}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase">Active</span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {currentApkUrl}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => updateConfig("apkDownloadUrl", null)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                          title="Remove APK URL"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/30">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(currentApkUrl)}
                          className="h-8 text-xs font-bold rounded-lg border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30"
                        >
                          {copiedApkUrl ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                          {copiedApkUrl ? "Copied!" : "Copy Link"}
                        </Button>

                        <a
                          href={currentApkUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="inline-flex items-center h-8 px-3 text-xs font-bold rounded-lg bg-[#00a884] text-white hover:bg-[#00946f] transition-all shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Test Download
                        </a>

                        <div className="relative ml-auto">
                          <input
                            type="file"
                            ref={apkFileInputRef}
                            accept=".apk,application/vnd.android.package-archive"
                            onChange={handleApkFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploadingApk}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isUploadingApk}
                            className="h-8 text-xs font-bold rounded-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {isUploadingApk ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#00a884]" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                            {isUploadingApk ? `Uploading (${uploadProgress}%)...` : "Replace APK"}
                          </Button>
                        </div>
                      </div>

                      {isUploadingApk && (
                        <div className="pt-2 space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <Cloud className="w-3.5 h-3.5 text-[#00a884] animate-pulse" />
                              {uploadStatusText || "Uploading to Cloudflare R2..."}
                            </span>
                            <span className="text-[#00a884] font-black">{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#00a884] transition-all duration-200 rounded-full"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-950/40">
                      <input
                        type="file"
                        ref={apkFileInputRef}
                        accept=".apk,application/vnd.android.package-archive"
                        onChange={handleApkFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={isUploadingApk}
                      />
                      <div className="flex flex-col items-center gap-3 pointer-events-none">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00a884] flex items-center justify-center shadow-inner">
                          {isUploadingApk ? (
                            <Loader2 className="w-7 h-7 animate-spin text-[#00a884]" />
                          ) : (
                            <Upload className="w-7 h-7" />
                          )}
                        </div>
                        <div className="w-full max-w-sm space-y-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {isUploadingApk ? (uploadStatusText || `Uploading APK (${uploadProgress}%)...`) : "Click or drag & drop to upload Android APK"}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">Supports .apk files up to 200 MB</p>

                          {isUploadingApk && (
                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                <span>Progress</span>
                                <span className="text-[#00a884] font-black">{uploadProgress}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#00a884] transition-all duration-200 rounded-full shadow-sm"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        {!isUploadingApk && (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-1 rounded-xl text-xs font-bold border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                          >
                            Browse Files
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manual URL override */}
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Direct APK Download URL (Manual Input / CDN Fallback)
                    </Label>
                    <Input
                      value={config.apkDownloadUrl || ""}
                      onChange={(e) => updateConfig("apkDownloadUrl", e.target.value)}
                      placeholder="https://pub-...r2.dev/documents/.../app.apk or /downloads/watibot.apk"
                      className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-xs border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 font-medium">
                      If set, scanning the QR code or clicking the Android badge will directly download this APK.
                    </p>
                  </div>
                </div>

                {/* 2. Store Links */}
                <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Official App Store Links</h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Provide store URLs for users who prefer downloading from official marketplaces.
                  </p>

                  <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg" alt="Play Store" className="w-3.5 h-3.5 object-contain" />
                        Google Play Store URL
                      </Label>
                      <Input
                        value={config.playStoreUrl || ""}
                        onChange={(e) => updateConfig("playStoreUrl", e.target.value)}
                        placeholder="https://play.google.com/store/apps/details?id=com.watibot.app"
                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-medium border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/3/31/Apple_logo_white.svg" alt="App Store" className="w-3.5 h-3.5 object-contain invert dark:invert-0" />
                        Apple App Store (iOS) URL
                      </Label>
                      <Input
                        value={config.appStoreUrl || ""}
                        onChange={(e) => updateConfig("appStoreUrl", e.target.value)}
                        placeholder="https://apps.apple.com/app/watibot/id123456789"
                        className="h-11 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs font-medium border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Live Interactive Preview */}
              <div className="lg:col-span-5 sticky top-24 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#00a884]" />
                    Dashboard Preview
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-bold text-slate-500">Live Preview</Badge>
                </div>

                {/* Dashboard Card Preview */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 shadow-md">
                  <h3 className="text-xs font-black text-slate-800 dark:text-white tracking-tight mb-4">
                    Scan to download Mobile App
                  </h3>

                  <div className="flex items-center gap-5">
                    {/* QR Code */}
                    <div className="relative w-[105px] h-[105px] bg-white border border-slate-100 rounded-xl p-1 flex-shrink-0 flex items-center justify-center shadow-inner">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrPreviewData)}`}
                        alt="QR Code"
                        className="w-full h-full object-contain"
                      />
                      {/* Brand Favicon center */}
                      <div className="absolute w-[24px] h-[24px] rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm p-0.5">
                        <img 
                          src={config.favicon || config.smallLogo || config.logoLightTheme || "/favicon.ico"} 
                          alt={config.platformName || "Favicon"} 
                          className="w-full h-full rounded-full object-contain" 
                        />
                      </div>
                    </div>

                    {/* Badges column */}
                    <div className="flex flex-col gap-2.5">
                      <a
                        href={config.playStoreUrl || currentApkUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:opacity-90 transition-opacity"
                        title={currentApkUrl ? "Download APK" : "Google Play"}
                      >
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                          alt="Google Play"
                          className="h-9 w-auto object-contain"
                        />
                      </a>
                      <a
                        href={config.appStoreUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:opacity-90 transition-opacity"
                        title="App Store"
                      >
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                          alt="App Store"
                          className="h-9 w-auto object-contain"
                        />
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="font-medium truncate">
                      Target: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{currentApkUrl ? "Cloudflare R2 APK" : "Default Landing"}</span>
                    </span>
                    <span className="font-bold text-[#00a884]">Scannable</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 space-y-1.5">
                  <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                    How Users Download:
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    1. Users can scan the QR code with their mobile phone camera to download the APK instantly.
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    2. Clicking the Android badge triggers the APK direct download or redirects to Google Play if specified.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case "platform":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Platform Information</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Core details about your organization and platform.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Platform Name</Label>
                <Input value={config.platformName} onChange={(e) => updateConfig("platformName", e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900" />
                <p className="text-[11px] text-slate-500 font-medium">This name appears throughout the platform.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Search Engine Description (SEO)</Label>
                <Textarea value={config.seoDescription || ""} onChange={(e) => updateConfig("seoDescription", e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50 dark:bg-slate-900 resize-none" />
              </div>
            </div>
          </div>
        );

      case "support":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Support Information</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Contact details provided to your users when they need help.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Support Email</Label>
                <Input value={config.supportEmail} onChange={(e) => updateConfig("supportEmail", e.target.value)} type="email" className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Support WhatsApp / Phone Number</Label>
                <Input 
                  value={config.supportPhone || config.whatsappNumber || ""} 
                  onChange={(e) => {
                    updateConfig("supportPhone", e.target.value);
                    updateConfig("whatsappNumber", e.target.value);
                  }} 
                  placeholder="+92 329 1486545" 
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 font-bold" 
                />
                <p className="text-[11px] font-medium text-slate-500">
                  Used for WhatsApp support links on the Account Under Review and Suspended pages.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Business Address</Label>
                <Textarea value={config.officeAddress || ""} onChange={(e) => updateConfig("officeAddress", e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50 dark:bg-slate-900 resize-none" />
              </div>
            </div>
          </div>
        );

      case "legal":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Legal & Compliance</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Configure your legal agreements. HTML formatting is supported.</p>
            </div>
            <div className="space-y-6">
              {[
                { key: "termsOfService", label: "Terms of Service" },
                { key: "privacyPolicy", label: "Privacy Policy" },
                { key: "userTerms", label: "User Terms" },
                { key: "vendorTerms", label: "Vendor Terms" },
              ].map((policy) => (
                <div key={policy.key} className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-white dark:bg-slate-900 shadow-sm">
                  <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">{policy.label}</Label>
                  <Textarea 
                    value={(config as any)[policy.key] || ""} 
                    onChange={(e) => updateConfig(policy.key as any, e.target.value)} 
                    className="min-h-[150px] font-mono text-xs mt-2 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-[#00a884]" 
                    placeholder={`Enter ${policy.label} content here...`} 
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case "localization":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Localization</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Configure language and region defaults.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">Default Language</Label>
                <Input value={config.defaultLanguage} onChange={(e) => updateConfig("defaultLanguage", e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">System Timezone</Label>
                <Input value={config.systemTimezone} onChange={(e) => updateConfig("systemTimezone", e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900" />
              </div>
            </div>
          </div>
        );

      case "trials":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Trial Limits & Monitoring</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Configure global trial duration and monitor active testing accounts.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Settings Card */}
              <div className="lg:col-span-4 h-full">
                <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800/40 shadow-sm transition-all duration-300 overflow-hidden flex flex-col h-full">
                  <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                        <Clock size={16} />
                      </div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">Trial Duration</h3>
                    </div>
                  </div>
                  <div className="p-6 space-y-6 flex-1 flex flex-col">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Global Limit (Days)</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={config.trialLimitDays}
                          onChange={(e) => updateConfig("trialLimitDays", parseInt(e.target.value.replace(/\D/g, "")) || 0)}
                          className="w-full h-12 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none pr-12"
                          placeholder="15"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pointer-events-none">Days</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monitor Accounts */}
              <div className="lg:col-span-8">
                <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800/40 shadow-sm transition-all duration-300 overflow-hidden">
                  <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                        <Users size={16} />
                      </div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">Active Trials Monitor</h3>
                    </div>
                    <Badge variant="outline" className="bg-[#e6f4ee] dark:bg-[#00a884]/15 text-[#00a884] border-transparent text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl shadow-inner border-0">
                      {trialUsers.length} Testing Accounts
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/40 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          <th className="px-6 py-4 text-left">Identity</th>
                          <th className="px-6 py-4 text-left">Timeline</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {trialUsers.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-3 grayscale opacity-30">
                                <Clock size={40} className="text-[#00a884]" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">No active trials detected</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          trialUsers.map((user) => (
                            <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-[#e6f4ee] dark:bg-[#00a884]/15 text-[#00a884] font-black text-xs flex items-center justify-center uppercase tracking-wider shadow-inner select-none">
                                    {getInitials(user.name || user.email)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.name || 'Anonymous Vendor'}</span>
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide">{user.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-2 max-w-[160px]">
                                  <div className="flex justify-between items-end">
                                    <span className={cn(
                                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                                      user.daysRemaining > 5 
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15" 
                                        : "bg-rose-500/10 text-rose-600 border-rose-500/15"
                                    )}>
                                      {user.daysRemaining}d left
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500">{user.percentUsed}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full transition-all duration-1000",
                                        user.percentUsed > 80 ? "bg-rose-500" : "bg-[#00a884]"
                                      )}
                                      style={{ width: `${user.percentUsed}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleViewVendor(user)}
                                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-[#00a884] hover:text-white dark:hover:bg-[#00a884] dark:hover:text-white hover:border-[#00a884] transition-all text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-800/80 active:scale-95 shadow-sm"
                                >
                                  Inspect
                                  <ChevronRight size={12} className="stroke-[2.5]" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 pb-20">
      <div className="xl:w-64 shrink-0">
        <div className="sticky top-24 space-y-1 bg-white dark:bg-slate-900/50 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left",
                  isActive
                    ? "bg-[#00a884] text-white shadow-md shadow-[#00a884]/20"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <tab.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 max-w-4xl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="sticky top-0 z-20 flex items-center justify-between p-4 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full transition-colors duration-300" style={{ backgroundColor: hasUnsavedChanges ? "#f59e0b" : "#10b981" }} />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                {hasUnsavedChanges ? "Unsaved Changes" : "All Changes Saved"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <Button onClick={handleReset} variant="outline" className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Undo2 className="w-3.5 h-3.5 mr-2" />
                  Discard
                </Button>
              )}
              <Button 
                onClick={handleSave} 
                disabled={!hasUnsavedChanges || isSaving} 
                className={cn(
                  "rounded-xl h-10 px-6 text-xs font-bold shadow-sm transition-all",
                  hasUnsavedChanges && !isSaving 
                    ? "bg-[#00a884] text-white hover:bg-[#00946f]" 
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                )}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>

          <div className="p-8 md:p-10 min-h-[600px]">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Vendor Details Modal */}
      {selectedVendor && (
        <VendorDetailsSheet
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
          }}
          vendor={selectedVendor}
        />
      )}
    </div>
  );
}
