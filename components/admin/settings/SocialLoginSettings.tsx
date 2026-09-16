"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  Cloud,
  Share2,
  Mail,
  DatabaseBackup,
  CreditCard,
  Landmark,
  Radio,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Undo2
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import WatiBotLoader from "@/components/WatiBotLoader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface FullConfig {
  storageDriver: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  r2Endpoint: string;
  googleLoginEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  facebookAppId: string;
  facebookAppSecret: string;
  embeddedSignupConfigId: string;
  instagramConfigId: string;
  instagramAppId: string;
  instagramAppSecret: string;
  tiktokClientKey: string;
  tiktokClientSecret: string;
  tiktokRedirectUri: string;
  tiktokOauthScopes: string;
  tiktokIsBusinessApi: boolean;
  aiProvider: string;
  aiProviderApiKey: string;
  aiSystemPrompt: string;
  aiTemperature: number;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  adminEmail: string;
  backupEmail: string;
  backupScheduleTime: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  payfastEnabled: boolean;
  payfastMerchantId: string;
  payfastMerchantName: string;
  payfastSecuredKey: string;
  payfastEnvironment: string;
  payfastTokenUrl: string;
  payfastCheckoutUrl: string;
  payfastCurrencyCode: string;
  payfastStoreId: string;
  payfastDefaultCustomerMobile: string;
  pusherAppId: string;
  pusherKey: string;
  pusherSecret: string;
  pusherCluster: string;
  notificationSoundUrl: string;
}

const INTEGRATIONS = [
  {
    id: "r2",
    name: "Cloudflare R2 Storage",
    description: "S3-compatible fast object storage for WhatsApp voice, media, and attachments.",
    icon: Cloud,
    theme: { color: "amber", bg: "bg-amber-600", text: "text-amber-600", lightBg: "bg-amber-500/10", border: "border-amber-500/30" },
  },
  {
    id: "google",
    name: "Google OAuth",
    description: "Allow users to sign in with Google.",
    icon: Globe,
    theme: { color: "blue", bg: "bg-blue-600", text: "text-blue-600", lightBg: "bg-blue-500/10", border: "border-blue-500/30" },
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    description: "Store and manage uploaded images, videos, and media files.",
    icon: Cloud,
    theme: { color: "sky", bg: "bg-sky-500", text: "text-sky-500", lightBg: "bg-sky-500/10", border: "border-sky-500/30" },
  },
  {
    id: "meta",
    name: "Meta Ecosystem",
    description: "Connect WhatsApp, Facebook, and Instagram services.",
    icon: Share2,
    theme: { color: "indigo", bg: "bg-[#0674E8]", text: "text-[#0674E8]", lightBg: "bg-[#0674E8]/10", border: "border-[#0674E8]/30" },
  },
  {
    id: "smtp",
    name: "Nodemailer",
    description: "Send platform emails through your SMTP provider.",
    icon: Mail,
    theme: { color: "emerald", bg: "bg-[#00a884]", text: "text-[#00a884]", lightBg: "bg-[#00a884]/10", border: "border-[#00a884]/30" },
  },
  {
    id: "backup",
    name: "Global Backup Email",
    description: "Choose where daily backup reports should be sent.",
    icon: DatabaseBackup,
    theme: { color: "amber", bg: "bg-amber-500", text: "text-amber-500", lightBg: "bg-amber-500/10", border: "border-amber-500/30" },
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    description: "Accept card payments and manage subscription billing.",
    icon: CreditCard,
    theme: { color: "violet", bg: "bg-[#635BFF]", text: "text-[#635BFF]", lightBg: "bg-[#635BFF]/10", border: "border-[#635BFF]/30" },
  },
  {
    id: "payfast",
    name: "PayFast Payments",
    description: "Accept PayFast payments for supported regions.",
    icon: Landmark,
    theme: { color: "emerald", bg: "bg-emerald-600", text: "text-emerald-600", lightBg: "bg-emerald-600/10", border: "border-emerald-600/30" },
  },
  {
    id: "pusher",
    name: "Pusher Realtime Notifications",
    description: "Power realtime chat, notifications, and live updates.",
    icon: Radio,
    theme: { color: "purple", bg: "bg-purple-600", text: "text-purple-600", lightBg: "bg-purple-600/10", border: "border-purple-600/30" },
  },
];

const FieldGroup = ({ label, helper, children, error }: { label: string; helper?: string; children: React.ReactNode; error?: string }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    {children}
    {error && <span className="text-[10px] font-bold text-rose-500 ml-1">{error}</span>}
    {helper && !error && <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1">{helper}</span>}
  </div>
);

const Input = ({ value, onChange, placeholder, type = "text", readOnly = false, allowCopy = false }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="relative">
      <input
        type={type}
        value={value || ""}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600",
          readOnly && "text-slate-500 bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed",
          allowCopy && "pr-12"
        )}
      />
      {allowCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute inset-y-0 right-2 flex items-center justify-center w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          {copied ? <CheckCircle2 size={16} className="text-[#00a884]" /> : <Copy size={16} />}
        </button>
      )}
    </div>
  );
};

const PasswordInput = ({ value, onChange, placeholder }: any) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative w-full">
      <input
        type={show ? "text" : "password"}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 pr-12 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 right-4 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const SelectInput = ({ value, onChange, children }: any) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
  >
    {children}
  </select>
);

export default function SocialLoginSettings() {
  const [activeTab, setActiveTab] = useState<string>("google");
  const [loading, setLoading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [originalConfig, setOriginalConfig] = useState<FullConfig | null>(null);
  const [config, setConfig] = useState<FullConfig>({
    storageDriver: "r2",
    r2AccountId: "",
    r2AccessKeyId: "",
    r2SecretAccessKey: "",
    r2BucketName: "",
    r2PublicUrl: "",
    r2Endpoint: "",
    googleLoginEnabled: false,
    googleClientId: "",
    googleClientSecret: "",
    cloudinaryCloudName: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
    facebookAppId: "",
    facebookAppSecret: "",
    embeddedSignupConfigId: "",
    instagramConfigId: "",
    instagramAppId: "",
    instagramAppSecret: "",
    tiktokClientKey: "",
    tiktokClientSecret: "",
    tiktokRedirectUri: "",
    tiktokOauthScopes: "",
    tiktokIsBusinessApi: false,
    aiProvider: "openai",
    aiProviderApiKey: "",
    aiSystemPrompt: "",
    aiTemperature: 0.1,
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
    adminEmail: "",
    backupEmail: "",
    backupScheduleTime: "15:00",
    stripePublishableKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    payfastEnabled: false,
    payfastMerchantId: "",
    payfastMerchantName: "",
    payfastSecuredKey: "",
    payfastEnvironment: "sandbox",
    payfastTokenUrl: "",
    payfastCheckoutUrl: "",
    payfastCurrencyCode: "PKR",
    payfastStoreId: "",
    payfastDefaultCustomerMobile: "",
    pusherAppId: "",
    pusherKey: "",
    pusherSecret: "",
    pusherCluster: "",
    notificationSoundUrl: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/configurations/social");
      if (res.ok) {
        const data = await res.json();
        const full = {
          ...config,
          ...data,
          storageDriver: data.storageDriver || "r2",
          payfastEnvironment: data.payfastEnvironment || "sandbox",
          payfastCurrencyCode: data.payfastCurrencyCode || "PKR",
          backupScheduleTime: data.backupScheduleTime || "15:00",
        };
        setConfig(full);
        setOriginalConfig(full);
      }
    } catch (error) {
      toast.error("Failed to load integrations");
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  // Warn before unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleSave = async (section: string) => {
    if (!hasChanges) return;

    setLoading(section);
    const toastId = toast.loading("Saving integration settings...");

    try {
      const payload: any = {};
      if (section === "r2") {
        payload.storageDriver = config.storageDriver || "r2";
        payload.r2AccountId = config.r2AccountId;
        payload.r2AccessKeyId = config.r2AccessKeyId;
        payload.r2SecretAccessKey = config.r2SecretAccessKey;
        payload.r2BucketName = config.r2BucketName;
        payload.r2PublicUrl = config.r2PublicUrl;
        payload.r2Endpoint = config.r2Endpoint;
      } else if (section === "google") {
        payload.googleLoginEnabled = config.googleLoginEnabled;
        payload.googleClientId = config.googleClientId;
        payload.googleClientSecret = config.googleClientSecret;
      } else if (section === "cloudinary") {
        payload.cloudinaryCloudName = config.cloudinaryCloudName;
        payload.cloudinaryApiKey = config.cloudinaryApiKey;
        payload.cloudinaryApiSecret = config.cloudinaryApiSecret;
      } else if (section === "meta") {
        payload.facebookAppId = config.facebookAppId;
        payload.facebookAppSecret = config.facebookAppSecret;
        payload.embeddedSignupConfigId = config.embeddedSignupConfigId;
        payload.instagramAppId = config.instagramAppId;
        payload.instagramAppSecret = config.instagramAppSecret;
        payload.instagramConfigId = config.instagramConfigId;
      } else if (section === "smtp") {
        payload.smtpHost = config.smtpHost;
        payload.smtpPort = config.smtpPort;
        payload.smtpUser = config.smtpUser;
        payload.smtpPassword = config.smtpPassword;
        payload.smtpFrom = config.smtpFrom;
        payload.adminEmail = config.adminEmail;
      } else if (section === "backup") {
        payload.backupEmail = config.backupEmail;
        payload.backupScheduleTime = config.backupScheduleTime;
      } else if (section === "stripe") {
        payload.stripePublishableKey = config.stripePublishableKey;
        payload.stripeSecretKey = config.stripeSecretKey;
        payload.stripeWebhookSecret = config.stripeWebhookSecret;
      } else if (section === "payfast") {
        payload.payfastEnabled = config.payfastEnabled;
        payload.payfastMerchantId = config.payfastMerchantId;
        payload.payfastMerchantName = config.payfastMerchantName;
        payload.payfastSecuredKey = config.payfastSecuredKey;
        payload.payfastEnvironment = config.payfastEnvironment;
        payload.payfastTokenUrl = config.payfastTokenUrl;
        payload.payfastCheckoutUrl = config.payfastCheckoutUrl;
        payload.payfastCurrencyCode = config.payfastCurrencyCode;
        payload.payfastStoreId = config.payfastStoreId;
        payload.payfastDefaultCustomerMobile = config.payfastDefaultCustomerMobile;
      } else if (section === "pusher") {
        payload.pusherAppId = config.pusherAppId;
        payload.pusherKey = config.pusherKey;
        payload.pusherSecret = config.pusherSecret;
        payload.pusherCluster = config.pusherCluster;
        payload.notificationSoundUrl = config.notificationSoundUrl;
      }

      const res = await fetch("/api/admin/configurations/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Settings saved successfully", { id: toastId });
        setOriginalConfig(config);
      } else {
        toast.error("Failed to update settings", { id: toastId });
      }
    } catch (e) {
      toast.error("An error occurred during save", { id: toastId });
    } finally {
      setLoading(null);
    }
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      toast("Changes discarded");
    }
  };

  const set = (field: keyof FullConfig, value: any) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

  const getStatus = (id: string) => {
    switch (id) {
      case "r2":
        if (config.r2AccountId && config.r2AccessKeyId && config.r2BucketName) return { type: "connected", label: "Connected" };
        return { type: "missing", label: "Not Configured" };
      case "google":
        if (config.googleLoginEnabled && config.googleClientId) return { type: "enabled", label: "Enabled" };
        if (config.googleClientId && config.googleClientSecret) return { type: "connected", label: "Configured" };
        return { type: "missing", label: "Not Configured" };
      case "cloudinary":
        if (config.cloudinaryCloudName && config.cloudinaryApiKey) return { type: "connected", label: "Connected" };
        return { type: "missing", label: "Not Configured" };
      case "meta":
        if (config.facebookAppId && config.facebookAppSecret) return { type: "connected", label: "Connected" };
        return { type: "missing", label: "Not Configured" };
      case "smtp":
        if (config.smtpHost && config.smtpUser) return { type: "connected", label: "Connected" };
        return { type: "missing", label: "Not Configured" };
      case "backup":
        if (config.backupEmail) return { type: "connected", label: "Active" };
        return { type: "missing", label: "Not Configured" };
      case "stripe":
        if (config.stripePublishableKey && config.stripeSecretKey) return { type: "connected", label: "Connected" };
        return { type: "missing", label: "Not Configured" };
      case "payfast":
        if (config.payfastEnabled && config.payfastMerchantId) return { type: "enabled", label: "Enabled" };
        if (config.payfastMerchantId) return { type: "connected", label: "Configured" };
        return { type: "missing", label: "Not Configured" };
      case "pusher":
        if (config.pusherAppId && config.pusherKey) return { type: "connected", label: "Connected" };
        return { type: "missing", label: "Not Configured" };
      default:
        return { type: "missing", label: "Not Configured" };
    }
  };

  if (isLoading) {
    return <WatiBotLoader fullScreen={false} />;
  }

  const activeIntegration = INTEGRATIONS.find((i) => i.id === activeTab) || INTEGRATIONS[0];
  const theme = activeIntegration.theme;

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-20 plus-jakarta-forced">
      {/* Left Sidebar: Integration List */}
      <div className="w-full lg:w-80 shrink-0 space-y-3">
        {INTEGRATIONS.map((int) => {
          const isSelected = activeTab === int.id;
          const status = getStatus(int.id);
          
          return (
            <button
              key={int.id}
              onClick={() => {
                if (hasChanges && activeTab !== int.id) {
                  const confirmChange = window.confirm("You have unsaved changes. Are you sure you want to switch tabs?");
                  if (!confirmChange) return;
                  handleReset();
                }
                setActiveTab(int.id);
              }}
              className={cn(
                "w-full text-left p-4 rounded-[20px] transition-all duration-200 border flex flex-col gap-3",
                isSelected
                  ? `bg-white dark:bg-slate-900 shadow-md ${theme.border}`
                  : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isSelected ? theme.lightBg : "bg-slate-100 dark:bg-slate-800")}>
                  <int.icon size={18} className={cn(isSelected ? theme.text : "text-slate-500")} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{int.name}</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-1 text-[9px] uppercase tracking-wider font-bold border-none px-2 py-0.5",
                      status.type === "enabled" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                      status.type === "connected" && "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
                      status.type === "missing" && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {status.label}
                  </Badge>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Content: Settings Panel */}
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Top accent bar */}
          <div className={cn("h-1 w-full", theme.bg)} />

          {/* Sticky Header with Save actions */}
          <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between p-5 px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner", theme.lightBg)}>
                <activeIntegration.icon size={24} className={theme.text} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{activeIntegration.name}</h2>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{activeIntegration.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-2" />
                  Discard
                </Button>
              )}
              <Button
                onClick={() => handleSave(activeTab)}
                disabled={!hasChanges || loading === activeTab}
                className={cn(
                  "rounded-xl h-10 px-6 text-xs font-bold shadow-sm transition-all",
                  hasChanges && loading !== activeTab
                    ? `${theme.bg} text-white hover:opacity-90`
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                )}
              >
                {loading === activeTab ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </div>

          <div className="p-8">
            <div className="max-w-2xl space-y-8">
              
              {/* Conditional Panel Rendering */}
              {activeTab === "r2" && (
                <>
                  <FieldGroup label="Cloudflare Account ID" helper="Account ID from Cloudflare Overview or R2 Overview">
                    <Input value={config.r2AccountId} onChange={(v: string) => set("r2AccountId", v)} placeholder="e.g. 5402d58bce617b15e37beed221f05e9f" allowCopy />
                  </FieldGroup>
                  
                  <FieldGroup label="R2 Access Key ID" helper="S3-compatible Access Key ID generated for your R2 API Token">
                    <Input value={config.r2AccessKeyId} onChange={(v: string) => set("r2AccessKeyId", v)} placeholder="e.g. 2243bb7d353a36b4c2cf57e63c27f833" allowCopy />
                  </FieldGroup>
                  
                  <FieldGroup label="R2 Secret Access Key" helper="S3-compatible Secret Access Key generated for your R2 API Token">
                    <PasswordInput value={config.r2SecretAccessKey} onChange={(v: string) => set("r2SecretAccessKey", v)} placeholder="********" />
                  </FieldGroup>
                  
                  <FieldGroup label="R2 Bucket Name" helper="The exact name of your Cloudflare R2 bucket">
                    <Input value={config.r2BucketName} onChange={(v: string) => set("r2BucketName", v)} placeholder="watibot-media" allowCopy />
                  </FieldGroup>
                  
                  <FieldGroup label="Public URL / Custom Domain" helper="Public Development URL or your connected Custom Domain on R2">
                    <Input value={config.r2PublicUrl} onChange={(v: string) => set("r2PublicUrl", v)} placeholder="https://pub-6f7723931262447abd4de599730f9cb9.r2.dev" allowCopy />
                  </FieldGroup>
                  
                  <FieldGroup label="S3 API Endpoint (Optional)" helper="Defaults to https://<account_id>.r2.cloudflarestorage.com">
                    <Input value={config.r2Endpoint} onChange={(v: string) => set("r2Endpoint", v)} placeholder={`https://${config.r2AccountId || 'account_id'}.r2.cloudflarestorage.com`} allowCopy />
                  </FieldGroup>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                    <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                      Configure your token in the <a href="https://dash.cloudflare.com/?to=/:account/r2" target="_blank" rel="noopener noreferrer" className="font-bold underline">Cloudflare R2 Dashboard</a> with <strong>Object Read &amp; Write</strong> permissions and enable the <strong>Public Development URL</strong> on your bucket.
                    </p>
                  </div>
                </>
              )}

              {activeTab === "google" && (
                <>
                  <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex flex-col space-y-1">
                      <Label className="text-sm font-bold text-slate-900 dark:text-white">Enable Google Authentication</Label>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Allow users to log in or sign up with their Google account</span>
                    </div>
                    <Switch checked={config.googleLoginEnabled} onCheckedChange={(v) => set("googleLoginEnabled", v)} />
                  </div>
                  
                  <div className={cn("space-y-6 transition-all duration-300", !config.googleLoginEnabled && "opacity-50 pointer-events-none")}>
                    <FieldGroup label="Client ID" helper="Found in Google Cloud Console > APIs & Services > Credentials">
                      <Input value={config.googleClientId} onChange={(v: string) => set("googleClientId", v)} placeholder="e.g. 1092...apps.googleusercontent.com" allowCopy />
                    </FieldGroup>
                    <FieldGroup label="Client Secret" helper="Keep this secret secure and never share it publicly">
                      <PasswordInput value={config.googleClientSecret} onChange={(v: string) => set("googleClientSecret", v)} placeholder="********" />
                    </FieldGroup>
                  </div>
                </>
              )}

              {activeTab === "cloudinary" && (
                <>
                  <FieldGroup label="Cloud Name" helper="Your unique Cloudinary environment name">
                    <Input value={config.cloudinaryCloudName} onChange={(v: string) => set("cloudinaryCloudName", v)} placeholder="e.g. storage_bucket_01" allowCopy />
                  </FieldGroup>
                  <FieldGroup label="API Key" helper="Public identifier for your Cloudinary account">
                    <Input value={config.cloudinaryApiKey} onChange={(v: string) => set("cloudinaryApiKey", v)} placeholder="Public API Key" allowCopy />
                  </FieldGroup>
                  <FieldGroup label="API Secret" helper="Private key for secure uploads">
                    <PasswordInput value={config.cloudinaryApiSecret} onChange={(v: string) => set("cloudinaryApiSecret", v)} placeholder="********" />
                  </FieldGroup>
                  
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                    <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                      Acquire keys from your <a href="https://cloudinary.com/console" target="_blank" rel="noopener noreferrer" className="font-bold underline">Cloudinary Developer Console</a>. Ensure strict CORS policies are configured.
                    </p>
                  </div>
                </>
              )}

              {activeTab === "meta" && (
                <div className="space-y-8">
                  {/* WhatsApp Section */}
                  <div className="p-6 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/20 space-y-6">
                    <div className="flex items-center gap-3 border-b border-emerald-500/10 pb-4">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xs">
                        WA
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">WhatsApp Cloud API (Embedded Signup)</h3>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Credentials for WhatsApp Business Platform</p>
                      </div>
                    </div>

                    <FieldGroup label="WhatsApp Meta App ID" helper="App ID from your WhatsApp Meta Developer App (e.g. 3892322487735301)">
                      <Input value={config.facebookAppId} onChange={(v: string) => set("facebookAppId", v)} placeholder="e.g. 3892322487735301" allowCopy />
                    </FieldGroup>
                    <FieldGroup label="WhatsApp App Secret" helper="App Secret for your WhatsApp Meta App">
                      <PasswordInput value={config.facebookAppSecret} onChange={(v: string) => set("facebookAppSecret", v)} placeholder="********" />
                    </FieldGroup>
                    <FieldGroup label="WhatsApp Embedded Signup Config ID" helper="Configuration ID for WhatsApp Embedded Signup (e.g. 1279315830937298)">
                      <Input value={config.embeddedSignupConfigId} onChange={(v: string) => set("embeddedSignupConfigId", v)} placeholder="e.g. 1279315830937298" />
                    </FieldGroup>
                  </div>

                  {/* Facebook & Instagram Section */}
                  <div className="p-6 rounded-2xl bg-blue-500/[0.03] border border-blue-500/20 space-y-6">
                    <div className="flex items-center gap-3 border-b border-blue-500/10 pb-4">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xs">
                        FB/IG
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Facebook & Instagram (Messenger & DMs)</h3>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Separate App credentials for Facebook Pages, Messenger Bot, and Instagram DMs</p>
                      </div>
                    </div>

                    <FieldGroup label="Facebook / Instagram App ID" helper="App ID for your Facebook & Instagram Meta App (e.g. 757548130734743)">
                      <Input value={config.instagramAppId} onChange={(v: string) => set("instagramAppId", v)} placeholder="e.g. 757548130734743" allowCopy />
                    </FieldGroup>
                    <FieldGroup label="Facebook / Instagram App Secret" helper="App Secret for your Facebook & Instagram Meta App">
                      <PasswordInput value={config.instagramAppSecret} onChange={(v: string) => set("instagramAppSecret", v)} placeholder="********" />
                    </FieldGroup>
                    <FieldGroup label="Facebook & Instagram Config ID" helper="Configuration ID from Facebook Login for Business (e.g. 1613430839726705)">
                      <Input value={config.instagramConfigId} onChange={(v: string) => set("instagramConfigId", v)} placeholder="e.g. 1613430839726705" />
                    </FieldGroup>
                  </div>
                </div>
              )}

              {activeTab === "smtp" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldGroup label="SMTP Host" helper="e.g. smtp.gmail.com or smtp.sendgrid.net">
                      <Input value={config.smtpHost} onChange={(v: string) => set("smtpHost", v)} placeholder="smtp.relay.host" />
                    </FieldGroup>
                    <FieldGroup label="SMTP Port" helper="Usually 587 (TLS) or 465 (SSL)">
                      <Input value={config.smtpPort} onChange={(v: string) => set("smtpPort", v)} placeholder="587" />
                    </FieldGroup>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldGroup label="SMTP User" helper="Email or API key identity">
                      <Input value={config.smtpUser} onChange={(v: string) => set("smtpUser", v)} placeholder="user@domain.com" />
                    </FieldGroup>
                    <FieldGroup label="SMTP Password" helper="App password or API secret">
                      <PasswordInput value={config.smtpPassword} onChange={(v: string) => set("smtpPassword", v)} placeholder="********" />
                    </FieldGroup>
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldGroup label="From Email Address" helper="Address emails will be sent from">
                      <Input type="email" value={config.smtpFrom} onChange={(v: string) => set("smtpFrom", v)} placeholder="noreply@domain.com" />
                    </FieldGroup>
                    <FieldGroup label="Admin Alert Email" helper="Where system alerts should be sent">
                      <Input type="email" value={config.adminEmail} onChange={(v: string) => set("adminEmail", v)} placeholder="admin@domain.com" />
                    </FieldGroup>
                  </div>
                </>
              )}

              {activeTab === "backup" && (
                <>
                  <FieldGroup label="Backup Recipient Email" helper="Where the daily backup file will be sent">
                    <Input type="email" value={config.backupEmail} onChange={(v: string) => set("backupEmail", v)} placeholder="backup@yourdomain.com" />
                  </FieldGroup>
                  <FieldGroup label="Schedule Time" helper="Daily time (PKT) the backup will be triggered">
                    <Input type="time" value={config.backupScheduleTime} onChange={(v: string) => set("backupScheduleTime", v)} />
                  </FieldGroup>
                  
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                    <DatabaseBackup size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      The global database backup is generated automatically every day at the selected time and emailed to this address. Ensure SMTP settings are configured first.
                    </p>
                  </div>
                </>
              )}

              {activeTab === "stripe" && (
                <>
                  <FieldGroup label="Publishable Key" helper="Public key starting with pk_live_ or pk_test_">
                    <Input value={config.stripePublishableKey} onChange={(v: string) => set("stripePublishableKey", v)} placeholder="pk_..." allowCopy />
                  </FieldGroup>
                  <FieldGroup label="Secret Key" helper="Private key starting with sk_live_ or sk_test_">
                    <PasswordInput value={config.stripeSecretKey} onChange={(v: string) => set("stripeSecretKey", v)} placeholder="sk_..." />
                  </FieldGroup>
                  <FieldGroup label="Webhook Signing Secret" helper="Starts with whsec_">
                    <PasswordInput value={config.stripeWebhookSecret} onChange={(v: string) => set("stripeWebhookSecret", v)} placeholder="whsec_..." />
                  </FieldGroup>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <ExternalLink size={16} className="text-slate-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      Configure your webhook destination to point to <strong>/api/webhooks/stripe</strong> in your <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#635BFF]">Stripe Dashboard</a>. Ensure `checkout.session.completed` events are enabled.
                    </p>
                  </div>
                </>
              )}

              {activeTab === "payfast" && (
                <>
                  <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex flex-col space-y-1">
                      <Label className="text-sm font-bold text-slate-900 dark:text-white">Enable PayFast Payments</Label>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Allow users to pay using PayFast gateway</span>
                    </div>
                    <Switch checked={config.payfastEnabled} onCheckedChange={(v) => set("payfastEnabled", v)} />
                  </div>

                  <div className={cn("space-y-6 transition-all duration-300", !config.payfastEnabled && "opacity-50 pointer-events-none")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FieldGroup label="Merchant ID">
                        <Input value={config.payfastMerchantId} onChange={(v: string) => set("payfastMerchantId", v)} placeholder="e.g. 10000100" />
                      </FieldGroup>
                      <FieldGroup label="Merchant Name">
                        <Input value={config.payfastMerchantName} onChange={(v: string) => set("payfastMerchantName", v)} placeholder="Your Business Name" />
                      </FieldGroup>
                    </div>
                    <FieldGroup label="Secured Key" helper="Optional passphrase for signature validation">
                      <PasswordInput value={config.payfastSecuredKey} onChange={(v: string) => set("payfastSecuredKey", v)} placeholder="********" />
                    </FieldGroup>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FieldGroup label="Environment">
                        <SelectInput value={config.payfastEnvironment} onChange={(v: string) => set("payfastEnvironment", v)}>
                          <option value="sandbox">Sandbox</option>
                          <option value="production">Production</option>
                        </SelectInput>
                      </FieldGroup>
                      <FieldGroup label="Currency Code">
                        <Input value={config.payfastCurrencyCode} onChange={(v: string) => set("payfastCurrencyCode", v.toUpperCase())} placeholder="PKR" />
                      </FieldGroup>
                    </div>
                    
                    <FieldGroup label="Store ID" helper="Optional store identifier">
                      <Input value={config.payfastStoreId} onChange={(v: string) => set("payfastStoreId", v)} placeholder="Optional" />
                    </FieldGroup>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-6">
                      <FieldGroup label="Webhook / Return URL" helper="Use this URL in your PayFast configuration">
                        <Input value={typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/payfast` : "/api/webhooks/payfast"} readOnly allowCopy />
                      </FieldGroup>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "pusher" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldGroup label="App ID">
                      <Input value={config.pusherAppId} onChange={(v: string) => set("pusherAppId", v)} placeholder="e.g. 1234567" allowCopy />
                    </FieldGroup>
                    <FieldGroup label="App Key">
                      <Input value={config.pusherKey} onChange={(v: string) => set("pusherKey", v)} placeholder="e.g. abcd1234efgh5678" allowCopy />
                    </FieldGroup>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldGroup label="App Secret">
                      <PasswordInput value={config.pusherSecret} onChange={(v: string) => set("pusherSecret", v)} placeholder="********" />
                    </FieldGroup>
                    <FieldGroup label="Cluster">
                      <Input value={config.pusherCluster} onChange={(v: string) => set("pusherCluster", v)} placeholder="e.g. ap2 or mt1" />
                    </FieldGroup>
                  </div>
                  
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-6">
                    <FieldGroup label="Notification Sound URL (MP3)" helper="Audio played for incoming live chat messages">
                      <Input value={config.notificationSoundUrl} onChange={(v: string) => set("notificationSoundUrl", v)} placeholder="https://.../notification.mp3" />
                    </FieldGroup>
                    {!!config.notificationSoundUrl && (
                      <audio controls className="w-full mt-4 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-10">
                        <source src={config.notificationSoundUrl} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
