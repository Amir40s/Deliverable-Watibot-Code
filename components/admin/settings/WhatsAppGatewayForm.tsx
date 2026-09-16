"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { 
  Check, 
  Settings, 
  Trash2, 
  ShieldCheck, 
  Info, 
  Loader2, 
  Save, 
  Phone,
  MessageCircle,
  Facebook,
  HelpCircle,
  Send,
  FileCode2,
  Share2,
  BellRing,
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Globe,
  Copy,
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import WatiBotLoader from "@/components/WatiBotLoader"
import WhatsAppTemplateBuilder from "./WhatsAppTemplateBuilder"

type TokenInfo = {
  scopes?: string[];
  expiresAt?: string | null;
}

type FacebookLoginResponse = {
  authResponse?: {
    code?: string | null;
  } | null;
};

type MetaTemplate = {
  id: string;
  name: string;
  category: string;
  language: string;
  components?: Array<{
    type?: string;
    text?: string;
    buttons?: Array<{
      type?: string;
      text?: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}



export default function WhatsAppGatewayForm() {
  const [activeTab, setActiveTab] = useState<"connection" | "templates" | "templates_debug">("connection")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isFinalizingConnection, setIsFinalizingConnection] = useState(false)
  
  // Test Message Tool State
  const [testPhone, setTestPhone] = useState("")
  const [testMessage, setTestMessage] = useState("")
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [isSendingTestOtp, setIsSendingTestOtp] = useState(false)


  // Meta Templates list state
  const [templates, setTemplates] = useState<MetaTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  
  // All Templates Debugger state
  const [allTemplates, setAllTemplates] = useState<any[]>([])
  const [isLoadingAllTemplates, setIsLoadingAllTemplates] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)
  
  const [config, setConfig] = useState<any>({
    whatsappNumber: "",
    metaAccessToken: "",
    whatsappBusinessId: "",
    whatsappBusinessName: "",
    whatsappPhoneNumberId: "",
    whatsapp_token_info_data: null,
    facebookAppId: "",
    embeddedSignupConfigId: "",
    whatsappOtpTemplate: "",
    whatsappPasswordResetTemplate: "",
    whatsappSubscriptionAlertTemplate: "",
    subAlertCheckTime: "12:00 PM",
    subAlertTimezone: "Asia/Karachi",
    subAlert5DaysEnabled: false,
    subAlert5DaysTemplate: "",
    subAlert1DayEnabled: false,
    subAlert1DayTemplate: ""
  })

  // Manual Form State
  const [formData, setFormData] = useState({
    whatsappNumber: "",
    metaAccessToken: "",
    whatsappBusinessId: "",
    whatsappBusinessName: "",
    whatsappPhoneNumberId: "",
    whatsappOtpTemplate: "",
    whatsappPasswordResetTemplate: "",
    whatsappSubscriptionAlertTemplate: "",
    subAlertCheckTime: "12:00 PM",
    subAlertTimezone: "Asia/Karachi",
    subAlert5DaysEnabled: false,
    subAlert5DaysTemplate: "",
    subAlert1DayEnabled: false,
    subAlert1DayTemplate: ""
  })

  // Subscription Alerts Queue & Stats State
  const [alertLogs, setAlertLogs] = useState<any[]>([])
  const [alertCounts, setAlertCounts] = useState<{ sent: number; pending: number; failed: number }>({ sent: 0, pending: 0, failed: 0 })
  const [alertCandidatesCount, setAlertCandidatesCount] = useState<number>(0)
  const [isLoadingAlertStats, setIsLoadingAlertStats] = useState(false)
  const [isTriggeringAlertCheck, setIsTriggeringAlertCheck] = useState(false)
  const [showLogsTable, setShowLogsTable] = useState(false)

  // Global Webhook Synchronization Tool State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [isSyncingWebhooks, setIsSyncingWebhooks] = useState(false)
  const [syncResults, setSyncResults] = useState<any | null>(null)
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)

  const handleCopyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedWebhookUrl(true)
    toast.success("Webhook URL copied to clipboard")
    setTimeout(() => setCopiedWebhookUrl(false), 2000)
  }

  const handleSyncWebhooks = async () => {
    setIsSyncingWebhooks(true)
    const toastId = toast.loading("Submitting Meta Webhook subscriptions across all active numbers...")
    try {
      const res = await syncAllConnectedWebhooks()
      if (res.success) {
        toast.success(`Webhook sync finished! ${res.updated}/${res.total} updated`, { id: toastId })
        setSyncResults(res)
        setIsSyncModalOpen(false)
        setIsResultsModalOpen(true)
      } else {
        toast.error(res.error || "Failed to sync webhooks", { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred", { id: toastId })
    } finally {
      setIsSyncingWebhooks(false)
    }
  }

  const fetchAlertStats = useCallback(async () => {
    setIsLoadingAlertStats(true)
    try {
      const res = await fetch('/api/admin/configurations/whatsapp-gateway/subscription-alerts')
      if (res.ok) {
        const data = await res.json()
        setAlertLogs(data.logs || [])
        setAlertCounts(data.counts || { sent: 0, pending: 0, failed: 0 })
        setAlertCandidatesCount(data.candidatesCount || 0)
      }
    } catch (err) {
      console.error('Failed to load subscription alert stats:', err)
    } finally {
      setIsLoadingAlertStats(false)
    }
  }, [])

  const handleTriggerAlertCheck = async () => {
    setIsTriggeringAlertCheck(true)
    try {
      const res = await fetch('/api/admin/configurations/whatsapp-gateway/subscription-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_check' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.details || 'Subscription check executed successfully.')
        fetchAlertStats()
      } else {
        toast.error(data.error || data.details || 'Failed to trigger alert check.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error triggering alert check.')
    } finally {
      setIsTriggeringAlertCheck(false)
    }
  }

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/configurations/whatsapp-gateway')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        setFormData({
          whatsappNumber: data.whatsappNumber || "",
          metaAccessToken: data.metaAccessToken || "",
          whatsappBusinessId: data.whatsappBusinessId || "",
          whatsappBusinessName: data.whatsappBusinessName || "",
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || "",
          whatsappOtpTemplate: data.whatsappOtpTemplate || "",
          whatsappPasswordResetTemplate: data.whatsappPasswordResetTemplate || "",
          whatsappSubscriptionAlertTemplate: data.whatsappSubscriptionAlertTemplate || "",
          subAlertCheckTime: data.subAlertCheckTime || "12:00 PM",
          subAlertTimezone: data.subAlertTimezone || "Asia/Karachi",
          subAlert5DaysEnabled: data.subAlert5DaysEnabled ?? false,
          subAlert5DaysTemplate: data.subAlert5DaysTemplate || "",
          subAlert1DayEnabled: data.subAlert1DayEnabled ?? false,
          subAlert1DayTemplate: data.subAlert1DayTemplate || ""
        })
      }
    } catch (error) {
      toast.error("Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchAlertStats()
  }, [fetchSettings, fetchAlertStats])

  // Fetch approved Meta message templates when clicking on templates tab
  useEffect(() => {
    if (activeTab === "templates" && config.whatsappNumber && config.whatsappPhoneNumberId) {
      const fetchMetaTemplates = async () => {
        setIsLoadingTemplates(true)
        try {
          const res = await getAdminGatewayTemplates()
          if (res.success && res.templates) {
            setTemplates(res.templates)
          } else {
            console.warn("Failed to load Meta templates:", res.error)
          }
        } catch (e) {
          console.error("Error fetching templates:", e)
        } finally {
          setIsLoadingTemplates(false)
        }
      }
      fetchMetaTemplates()
    }
  }, [activeTab, config.whatsappNumber, config.whatsappPhoneNumberId])

  useEffect(() => {
    if (activeTab === "templates_debug" && config.whatsappNumber && config.whatsappPhoneNumberId) {
      const fetchAllMetaTemplates = async () => {
        setIsLoadingAllTemplates(true)
        setDebugError(null)
        try {
                    const res = await getAllAdminGatewayTemplates()
          if (res.success && res.templates) {
            setAllTemplates(res.templates)
          } else {
            console.warn("Failed to load all Meta templates:", res.error)
            setDebugError(res.error)
          }
        } catch (e: any) {
          console.error("Error fetching all templates:", e)
          setDebugError(e.message)
        } finally {
          setIsLoadingAllTemplates(false)
        }
      }
      fetchAllMetaTemplates()
    }
  }, [activeTab, config.whatsappNumber, config.whatsappPhoneNumberId])

  const handleConnect = async () => {
    setIsConnecting(true)
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.endsWith('.local') ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    if (window.location.protocol !== 'https:' && !isLocal) {
      setIsConnecting(false)
      toast.error("Meta Connection requires an HTTPS connection.")
      return
    }

    const appId = config.facebookAppId
    const configId = config.embeddedSignupConfigId || ""

    if (!appId) {
      toast.error("Missing Facebook App ID. Please configure it in Social Login settings.")
      setIsConnecting(false)
      return
    }

    window.localStorage.removeItem('pending_waba_id')
    window.localStorage.removeItem('pending_phone_id')
    window.localStorage.removeItem('pending_is_app_onboarding')

    const ensureSdk = () =>
      new Promise<void>((resolve, reject) => {
        const init = () => {
          if (!window.FB) return;
          window.FB.init({
            appId,
            cookie: true,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v24.0',
          });
          resolve();
        };

        if (window.FB) {
          init();
          return;
        }

        const existing = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', init, { once: true });
          setTimeout(() => reject(new Error("Facebook SDK load timeout")), 8000);
          return;
        }

        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.onload = init;
        script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
        document.body.appendChild(script);
      });

    try {
      await ensureSdk();

      window.FB.login((response: FacebookLoginResponse) => {
        (async () => {
          try {
            const authResponse = response?.authResponse;
            const code = authResponse?.code;

            if (!code) {
              setIsConnecting(false);
              toast.error("Facebook Login connection cancelled.");
              return;
            }

            setIsFinalizingConnection(true);
            const pendingWabaId = window.localStorage.getItem('pending_waba_id');
            const pendingPhoneId = window.localStorage.getItem('pending_phone_id');
            const pendingIsAppOnboarding = window.localStorage.getItem('pending_is_app_onboarding') === 'true';

            const result = await connectAdminMetaAccount(
              code,
              window.location.origin + '/admin/configurations/whatsapp-gateway',
              pendingWabaId,
              pendingPhoneId,
              pendingIsAppOnboarding,
              true
            );

            setIsConnecting(false);
            setIsFinalizingConnection(false);

            if (result?.error || result?.result === "error") {
              toast.error(result?.error || "Failed to connect Meta account.");
              return;
            }

            await fetchSettings();
            toast.success("WhatsApp Gateway connected successfully!");
          } catch (err) {
            setIsConnecting(false);
            setIsFinalizingConnection(false);
            toast.error("Failed to exchange Meta credentials");
          }
        })().catch(() => {
          setIsConnecting(false);
          setIsFinalizingConnection(false);
        });
      }, {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        }
      });

    } catch (err) {
      setIsConnecting(false);
      toast.error("Failed to initialize Facebook SDK");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate subscription ending alert configurations
    if (formData.subAlert5DaysEnabled && (!formData.subAlert5DaysTemplate || !formData.subAlert5DaysTemplate.trim())) {
      toast.error("Validation Error: Please select a WhatsApp template for '5 Days Before Expiry' alert, or disable it.")
      return
    }
    if (formData.subAlert1DayEnabled && (!formData.subAlert1DayTemplate || !formData.subAlert1DayTemplate.trim())) {
      toast.error("Validation Error: Please select a WhatsApp template for '1 Day Before Expiry' alert, or disable it.")
      return
    }

    setIsSaving(true)
    try {
      let tokenInfoData = null
      if (formData.metaAccessToken && formData.metaAccessToken !== config.metaAccessToken) {
        tokenInfoData = {
          scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
          expires_at: null
        }
      }

      const payload = {
        ...formData,
        whatsapp_token_info_data: tokenInfoData || config.whatsapp_token_info_data
      }

      const res = await fetch('/api/admin/configurations/whatsapp-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const updated = await res.json()
        setConfig(updated)
        toast.success("WhatsApp Gateway configurations saved successfully")
        fetchSettings()
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || "Failed to save configuration settings")
      }
    } catch (error) {
      toast.error("An error occurred while saving configuration settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone || !testMessage) {
      toast.error("Please enter a valid phone number and message.")
      return
    }

    setIsSendingTest(true)
    try {
      const result = await sendAdminGatewayTestMessage(testPhone, testMessage)
      if (result.success) {
        toast.success("Test message successfully sent via system gateway!")
        setTestMessage("")
      } else {
        toast.error(result.error || "Failed to send test message.")
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred while sending test message.")
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSendTestOtpTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone) {
      toast.error("Please enter a destination phone number.")
      return
    }

    setIsSendingTestOtp(true)
    try {
      const result = await sendAdminGatewayTestOtpTemplate(testPhone, formData.whatsappOtpTemplate)
      if (result.success) {
        toast.success(`OTP Template "${result.template}" sent successfully with test code ${result.code}!`)
      } else {
        toast.error(result.error || "Failed to send OTP template.")
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred while sending test OTP template.")
    } finally {
      setIsSendingTestOtp(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect and clear the Admin WhatsApp Gateway configuration?")) {
      return
    }

    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/admin/configurations/whatsapp-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNumber: null,
          metaAccessToken: null,
          whatsappBusinessId: null,
          whatsappBusinessName: null,
          whatsappPhoneNumberId: null,
          whatsapp_token_info_data: null
        })
      })

      if (res.ok) {
        toast.success("WhatsApp Gateway disconnected successfully")
        fetchSettings()
      } else {
        toast.error("Failed to disconnect")
      }
    } catch (error) {
      toast.error("An error occurred while disconnecting")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const isConnected = !!config.whatsappNumber && !!config.whatsappPhoneNumberId


  if (isLoading) {
    return <WatiBotLoader fullScreen={true} />
  }

  return (
    <div className="space-y-8 w-full max-w-[1200px] animate-in fade-in duration-300 plus-jakarta-forced">
      
      {/* 🟢 Premium Navigation Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("connection")}
          className={cn(
            "pb-4 text-sm font-black transition-all border-b-2 px-1 relative top-[1px]",
            activeTab === "connection" 
              ? "border-[#00a884] text-[#00a884]" 
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          Connection Settings
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "pb-4 text-sm font-black transition-all border-b-2 px-1 relative top-[1px]",
            activeTab === "templates" 
              ? "border-[#00a884] text-[#00a884]" 
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          Message Templates & Alerts
        </button>
        <button
          onClick={() => setActiveTab("templates_debug")}
          className={cn(
            "pb-4 text-sm font-black transition-all border-b-2 px-1 relative top-[1px]",
            activeTab === "templates_debug" 
              ? "border-[#00a884] text-[#00a884]" 
              : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          Templates Debugger
        </button>
      </div>

      {activeTab === "connection" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-1.5 duration-200">
          
          {/* 🔴 Top Connection Action Bar */}
          {!isConnected && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2 text-center md:text-left">
                <h2 className="text-base font-black text-slate-800 dark:text-white tracking-tight flex items-center justify-center md:justify-start gap-2">
                  <Facebook size={18} className="text-blue-600 shrink-0" />
                  Easy Connection with Meta
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl font-medium leading-relaxed">
                  Launch Embedded Onboarding directly to connect your system's admin WhatsApp gateway. No complex copying of access tokens required.
                </p>
              </div>
              
              <button
                onClick={handleConnect}
                disabled={isConnecting || isFinalizingConnection}
                className="w-full md:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-600/15 transition-all flex items-center justify-center gap-2"
              >
                {isConnecting || isFinalizingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Facebook size={14} className="stroke-[3]" />
                )}
                <span>{isFinalizingConnection ? "Finalizing Connection..." : "Connect Admin WhatsApp"}</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Connection Status Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 space-y-6 shadow-sm lg:col-span-1">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                    <MessageCircle size={14} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">
                    Gateway Status
                  </h3>
                </div>
                <span className={cn(
                  "px-2.5 py-1 rounded-xl text-[9px] font-black tracking-wider",
                  isConnected 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                )}>
                  {isConnected ? "ACTIVE" : "DISCONNECTED"}
                </span>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isConnected
                    ? "The system-wide WhatsApp Gateway is active. This number is used to deliver OTPs, password reset codes, and system alerts to your users."
                    : "The system-wide WhatsApp Gateway is not configured. Configure the gateway below to enable automated user notifications."
                  }
                </p>

                {isConnected && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                          <Check className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500">ACTIVE NUMBER</p>
                          <p className="text-sm font-extrabold text-slate-800 dark:text-white">{config.whatsappNumber}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-[#090d16] p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <p className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">TOKEN SECURITY</p>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div>
                          <p className="text-[9px] font-black tracking-wider text-slate-400 dark:text-slate-500 mb-1">APPROVED PERMISSIONS</p>
                          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-350 break-words font-medium">
                            whatsapp_business_management, whatsapp_business_messaging
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] font-bold text-slate-400 truncate max-w-[150px]">
                        {config.whatsappBusinessName || "Meta WABA"}
                      </span>
                      <button
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="h-8 px-4 border border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                      >
                        {isDisconnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 size={13} className="stroke-[2.5]" />
                        )}
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Credentials Form */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 space-y-6 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                  <Settings size={14} />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  Manual Credentials
                </h3>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                      WhatsApp Number
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. +923001234567"
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="h-11 bg-slate-50/50 dark:bg-slate-950! border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                      WhatsApp Business Name
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. WatiBot Gateway"
                      value={formData.whatsappBusinessName}
                      onChange={(e) => setFormData({ ...formData, whatsappBusinessName: e.target.value })}
                      className="h-11 bg-slate-50/50 dark:bg-slate-950! border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                    Meta System Access Token
                  </Label>
                  <Input
                    type="password"
                    placeholder={config.metaAccessToken ? "••••••••••••••••••••••••••••••••" : "EAAG..."}
                    value={formData.metaAccessToken}
                    onChange={(e) => setFormData({ ...formData, metaAccessToken: e.target.value })}
                    className="h-11 bg-slate-50/50 dark:bg-slate-950! border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                    required={!config.metaAccessToken}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                      WhatsApp Business Account (WABA) ID
                    </Label>
                    <Input
                      type="text"
                      placeholder="15-digit WABA ID"
                      value={formData.whatsappBusinessId}
                      onChange={(e) => setFormData({ ...formData, whatsappBusinessId: e.target.value })}
                      className="h-11 bg-slate-50/50 dark:bg-slate-950! border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 ml-1">
                      WhatsApp Phone Number ID
                    </Label>
                    <Input
                      type="text"
                      placeholder="15-digit Phone ID"
                      value={formData.whatsappPhoneNumberId}
                      onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                      className="h-11 bg-slate-50/50 dark:bg-slate-950! border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="bg-[#e6f4ee]/30 dark:bg-[#00a884]/5 rounded-2xl p-4 border border-[#e6f4ee] dark:border-slate-800/80 space-y-2">
                  <p className="text-[10px] text-[#00a884] font-black uppercase tracking-wider flex items-center gap-1">
                    <Info size={12} />
                    Setup Guide Info
                  </p>
                  <ul className="text-[11px] text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-1.5 font-medium leading-relaxed">
                    <li>Create a Meta Developer App and configure WhatsApp integration.</li>
                    <li>Generate a permanent <strong>System User Access Token</strong> in your Meta Business Suite.</li>
                    <li>Ensure the System User is assigned the <strong>whatsapp_business_management</strong> and <strong>whatsapp_business_messaging</strong> permissions.</li>
                    <li>Make sure to add the System User to the specific WABA as a permitted asset.</li>
                  </ul>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-850/60">
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="h-11 px-8 bg-[#00a884] hover:bg-[#009675] text-white rounded-2xl text-xs font-black shadow-lg shadow-[#00a884]/10 transition-all flex items-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save size={14} className="stroke-[3]" />
                    )}
                    <span>Save Gateway Config</span>
                  </button>
                </div>
              </form>

            </div>

          </div>

          {/* 🌐 Global WhatsApp Webhook Synchronizer Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Globe size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800 dark:text-white">
                      Global WhatsApp Webhook Synchronizer
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                      Multi-Tenant Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Update, register, and re-subscribe the active Meta Webhook callback URL across all connected WhatsApp Cloud API numbers.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                disabled={isSyncingWebhooks}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-600/15 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                {isSyncingWebhooks ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw size={14} className="stroke-[2.5]" />
                )}
                <span>Update Webhooks for All Numbers</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Webhook Endpoint Display */}
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 space-y-2">
                <p className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Current System Webhook Callback URL
                </p>
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl px-3 py-2">
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                    {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "https://app.watibot.io/api/webhooks/whatsapp"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyWebhookUrl(typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "https://app.watibot.io/api/webhooks/whatsapp")}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Copy Webhook URL"
                  >
                    {copiedWebhookUrl ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Subscribed Events */}
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 space-y-2">
                <p className="text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Meta Subscribed Fields
                </p>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {['messages', 'message_template_status_update', 'phone_number_name_update'].map((field) => (
                    <span
                      key={field}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1.5"
                    >
                      <Check size={12} className="text-emerald-500" />
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed space-y-1">
                <p className="font-bold">Important Notice:</p>
                <p>
                  Use this button whenever you migrate to a new server domain or if any connected numbers are missing incoming messages. This performs safe per-organization Graph API subscription calls. QR code connected numbers are completely isolated and unaffected.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-1.5 duration-200">
          
          {/* Top Info Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileCode2 size={16} className="text-[#00a884]" />
                Notification Template Builder
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-3xl">
                Configure which approved Meta WhatsApp templates are sent for various system events. You can map dynamic variables (like {'{{1}}'}) directly to system data without any developer changes.
              </p>
            </div>
            
            <div className="flex gap-4 shrink-0">
              <button 
                onClick={handleSave}
                disabled={isSaving || !isConnected}
                className="h-11 px-8 bg-[#00a884] hover:bg-[#009675] disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl text-xs font-black shadow-lg shadow-[#00a884]/10 transition-all flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save size={14} className="stroke-[3]" />
                )}
                <span>Save Mappings</span>
              </button>
            </div>
          </div>

          {isLoadingTemplates && (
            <div className="flex items-center gap-2 text-xs text-[#00a884] font-bold justify-center py-8 animate-pulse bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading Meta approved templates...</span>
            </div>
          )}

          {!isLoadingTemplates && templates.length === 0 && isConnected && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-[32px] p-8 text-center space-y-3">
              <p className="text-sm font-black text-amber-800 dark:text-amber-500">No Templates Found</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium max-w-xl mx-auto">
                We couldn't find any approved message templates in your WhatsApp Business Account. Please go to the Meta Business Manager, create your templates, and submit them for approval.
              </p>
            </div>
          )}

          {!isLoadingTemplates && templates.length > 0 && (
            <div className="space-y-6">
              <WhatsAppTemplateBuilder
                label="OTP Verification Template"
                description="Sent during user onboarding or multi-factor phone number verification. This template must contain variable arguments for OTP codes."
                fieldName="whatsappOtpTemplate"
                value={formData.whatsappOtpTemplate}
                templates={templates}
                onChange={(val) => setFormData(prev => ({ ...prev, whatsappOtpTemplate: val }))}
                availableVariables={[
                  { label: "OTP Code", value: "otp_code" },
                  { label: "Vendor Name", value: "vendor_name" },
                  { label: "System Name", value: "system_name" }
                ]}
              />

              <WhatsAppTemplateBuilder
                label="Password Reset Template"
                description="Sent when users trigger a WhatsApp-based password recovery. Normally expects one variable parameter for the reset link or reset token."
                fieldName="whatsappPasswordResetTemplate"
                value={formData.whatsappPasswordResetTemplate}
                templates={templates}
                onChange={(val) => setFormData(prev => ({ ...prev, whatsappPasswordResetTemplate: val }))}
                availableVariables={[
                  { label: "Reset Link / Token", value: "reset_link" },
                  { label: "Vendor Name", value: "vendor_name" },
                  { label: "System Name", value: "system_name" }
                ]}
              />

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 🔔 Subscription Ending Alert Section                         */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 space-y-8 shadow-sm">
                
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center text-[#00a884]">
                      <BellRing size={20} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-800 dark:text-white">
                          Subscription Ending Alert
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                          Automated Daily Cron
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Automatically dispatch WhatsApp template alerts to customers whose subscriptions are expiring in 5 days or 1 day.
                      </p>
                    </div>
                  </div>

                  {/* Manual Run Check Tool */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTriggerAlertCheck}
                      disabled={isTriggeringAlertCheck || !isConnected}
                      className="h-9 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      title="Run an immediate check on active subscriptions"
                    >
                      {isTriggeringAlertCheck ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw size={13} className="stroke-[2.5]" />
                      )}
                      <span>Run Check Now</span>
                    </button>
                  </div>
                </div>

                {/* 1. Daily Sending Time & Timezone */}
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CalendarClock size={16} className="text-[#00a884]" />
                        <Label className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          Daily Alert Check Time
                        </Label>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        The scheduler evaluates eligible subscriptions once every day at this exact time in the configured timezone.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <select
                          value={formData.subAlertCheckTime || "12:00 PM"}
                          onChange={(e) => setFormData(prev => ({ ...prev, subAlertCheckTime: e.target.value }))}
                          className="h-10 px-4 pr-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 outline-none cursor-pointer appearance-none shadow-sm"
                        >
                          {[
                            "12:00 AM", "01:00 AM", "02:00 AM", "03:00 AM", "04:00 AM", "05:00 AM",
                            "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
                            "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
                            "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
                          ].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <Clock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>

                      <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl">
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                          <span>Timezone:</span>
                          <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                            {formData.subAlertTimezone || "Asia/Karachi"} (Pakistan Time)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 1-Minute Gap Notice */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 font-medium">
                    <Info size={14} className="text-[#00a884] shrink-0" />
                    <span>
                      <strong className="font-bold text-slate-700 dark:text-slate-200">1-Minute Queue Spacing:</strong> When multiple customers qualify on the same day, messages are sent sequentially with an automatic 1-minute delay between each recipient.
                    </span>
                  </div>
                </div>

                {/* 2. Alert Configurations (5 Days and 1 Day) */}
                <div className="space-y-6">
                  
                  {/* Card: 5 Days Before Expiry */}
                  <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-6 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">
                            5 Days Before Expiry
                          </h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                            formData.subAlert5DaysEnabled
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {formData.subAlert5DaysEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Alert will be sent when the subscription has 5 days remaining.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor="subAlert5DaysSwitch" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {formData.subAlert5DaysEnabled ? "Enabled" : "Disabled"}
                        </Label>
                        <Switch
                          id="subAlert5DaysSwitch"
                          checked={formData.subAlert5DaysEnabled}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, subAlert5DaysEnabled: checked }))}
                          className="data-[state=checked]:bg-[#00a884]"
                        />
                      </div>
                    </div>

                    <div className={cn("transition-opacity duration-200", !formData.subAlert5DaysEnabled && "opacity-60 pointer-events-none")}>
                      <WhatsAppTemplateBuilder
                        label="5 Days Before Expiry WhatsApp Template"
                        description="Select the approved Meta template to send 5 days before subscription expiration. Variables will be mapped to customer and subscription fields."
                        fieldName="subAlert5DaysTemplate"
                        value={formData.subAlert5DaysTemplate}
                        templates={templates}
                        onChange={(val) => {
                          setFormData(prev => ({
                            ...prev,
                            subAlert5DaysTemplate: val,
                            whatsappSubscriptionAlertTemplate: val || prev.whatsappSubscriptionAlertTemplate
                          }))
                        }}
                        availableVariables={[
                          { label: "Vendor Name", value: "vendor_name" },
                          { label: "Expiration Date", value: "expiration_date" },
                          { label: "Plan Name", value: "plan_name" },
                          { label: "System Name", value: "system_name" },
                          { label: "Days Remaining (5)", value: "days_remaining" }
                        ]}
                      />
                    </div>
                  </div>

                  {/* Card: 1 Day Before Expiry */}
                  <div className="rounded-3xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-6 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">
                            1 Day Before Expiry
                          </h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                            formData.subAlert1DayEnabled
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {formData.subAlert1DayEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Alert will be sent when the subscription has 1 day remaining.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor="subAlert1DaySwitch" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {formData.subAlert1DayEnabled ? "Enabled" : "Disabled"}
                        </Label>
                        <Switch
                          id="subAlert1DaySwitch"
                          checked={formData.subAlert1DayEnabled}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, subAlert1DayEnabled: checked }))}
                          className="data-[state=checked]:bg-[#00a884]"
                        />
                      </div>
                    </div>

                    <div className={cn("transition-opacity duration-200", !formData.subAlert1DayEnabled && "opacity-60 pointer-events-none")}>
                      <WhatsAppTemplateBuilder
                        label="1 Day Before Expiry WhatsApp Template"
                        description="Select the approved Meta template to send 1 day before subscription expiration (final renewal notice)."
                        fieldName="subAlert1DayTemplate"
                        value={formData.subAlert1DayTemplate}
                        templates={templates}
                        onChange={(val) => setFormData(prev => ({ ...prev, subAlert1DayTemplate: val }))}
                        availableVariables={[
                          { label: "Vendor Name", value: "vendor_name" },
                          { label: "Expiration Date", value: "expiration_date" },
                          { label: "Plan Name", value: "plan_name" },
                          { label: "System Name", value: "system_name" },
                          { label: "Days Remaining (1)", value: "days_remaining" }
                        ]}
                      />
                    </div>
                  </div>

                </div>

                {/* 3. Live Alert Queue & Execution Stats */}
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-500" />
                      <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        Alert Duplicate Prevention & Queue Status
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Sent:</span>
                        <span className="font-extrabold text-slate-800 dark:text-white">{alertCounts.sent}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Queued:</span>
                        <span className="font-extrabold text-slate-800 dark:text-white">{alertCounts.pending}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Failed:</span>
                        <span className="font-extrabold text-slate-800 dark:text-white">{alertCounts.failed}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          fetchAlertStats()
                          setShowLogsTable(prev => !prev)
                        }}
                        className="text-[11px] font-extrabold text-[#00a884] hover:underline ml-2"
                      >
                        {showLogsTable ? "Hide History" : "View History"}
                      </button>
                    </div>
                  </div>

                  {showLogsTable && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 overflow-x-auto animate-in fade-in duration-200">
                      {isLoadingAlertStats ? (
                        <div className="py-6 flex justify-center text-slate-400 text-xs font-bold">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading history...
                        </div>
                      ) : alertLogs.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium py-4 text-center">
                          No subscription alert jobs recorded yet.
                        </p>
                      ) : (
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-200/60 dark:border-slate-800 text-slate-400 font-bold">
                              <th className="pb-2">Phone</th>
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Status</th>
                              <th className="pb-2">Sent / Scheduled</th>
                              <th className="pb-2">Message ID / Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                            {alertLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">{log.recipientPhone}</td>
                                <td className="py-2.5 font-extrabold text-slate-600 dark:text-slate-300">
                                  {log.alertType === '5_DAYS' ? '5 Days Before' : '1 Day Before'}
                                </td>
                                <td className="py-2.5">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                                    log.status === 'SENT' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                                    log.status === 'PENDING' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                                    "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                  )}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="py-2.5 text-slate-500 font-medium">
                                  {log.sentAt ? new Date(log.sentAt).toLocaleString() : log.scheduledFor ? new Date(log.scheduledFor).toLocaleString() : "—"}
                                </td>
                                <td className="py-2.5 text-slate-500 font-medium max-w-[220px] truncate" title={log.error || log.messageId || ''}>
                                  {log.messageId ? `wamid: ${log.messageId}` : log.error ? <span className="text-rose-500 font-bold">{log.error}</span> : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
          
          {/* Live Gateway Test Tool */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                <Send size={14} />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                Live Gateway Test Tool
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Verify your Admin Gateway configuration by sending a real-time manual test message to any destination phone number.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black tracking-wider text-slate-450 dark:text-slate-500 ml-1">
                    Destination Phone Number
                  </Label>
                  <Input
                    type="text"
                    placeholder="e.g. +923001234567"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="h-11 bg-slate-50/50 dark:bg-slate-905! border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSendTestOtpTemplate}
                    disabled={isSendingTestOtp || !isConnected || !formData.whatsappOtpTemplate}
                    className="flex-1 h-11 bg-[#00a884] hover:bg-[#009675] disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-650 text-white rounded-2xl text-xs font-black shadow-lg shadow-[#00a884]/10 transition-all flex items-center justify-center gap-2"
                  >
                    {isSendingTestOtp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileCode2 size={14} className="stroke-[2.5]" />
                    )}
                    <span>Test Configured OTP Template</span>
                  </button>

                  <button
                    type="submit"
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest || !isConnected}
                    className="h-11 px-6 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
                  >
                    {isSendingTest ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send size={13} className="stroke-[2.5]" />
                    )}
                    <span>Send Custom Text</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label className="text-[10px] font-black tracking-wider text-slate-455 dark:text-slate-500 ml-1">
                    Custom Text Content (Optional - for active 24h chats)
                  </Label>
                  <textarea
                    rows={2}
                    placeholder="Type custom test message text here..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-905! border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 transition-all outline-none resize-none"
                  />
                </div>

                {!isConnected && (
                  <p className="text-[10px] text-rose-500 font-bold text-center mt-2 leading-tight">
                    * Gateway connection must be Active to send test messages.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {activeTab === "templates_debug" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-[32px] p-6 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-yellow-100 dark:bg-yellow-500/15 flex items-center justify-center text-yellow-600">
              <Info size={14} />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white">
              All Meta Templates Debugger
            </h3>
          </div>
          
          {isLoadingAllTemplates ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#00a884]" />
            </div>
          ) : debugError ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-200">
              Error fetching templates: {debugError}
            </div>
          ) : allTemplates.length === 0 ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm font-bold rounded-xl text-center">
              No templates found for this WABA account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-3 font-bold text-slate-500">Name</th>
                    <th className="pb-3 font-bold text-slate-500">Status</th>
                    <th className="pb-3 font-bold text-slate-500">Category</th>
                    <th className="pb-3 font-bold text-slate-500">Language</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {allTemplates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">{t.name}</td>
                      <td className="py-3">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                          t.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                          t.status === "REJECTED" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        )}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{t.category}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{t.language}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🔴 Confirmation Dialog for Webhook Sync */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Globe size={20} className="stroke-[2.5]" />
            </div>
            <DialogTitle className="text-base font-black text-slate-800 dark:text-white">
              Update Webhooks for All Numbers?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              This action will connect to Meta Graph API for all active Cloud API WhatsApp accounts and update their webhook endpoint to:
              <span className="font-mono font-bold text-slate-700 dark:text-slate-200 break-all block mt-1.5 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp"}
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(false)}
              disabled={isSyncingWebhooks}
              className="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSyncWebhooks}
              disabled={isSyncingWebhooks}
              className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15 cursor-pointer"
            >
              {isSyncingWebhooks ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={14} />}
              <span>{isSyncingWebhooks ? "Syncing..." : "Confirm & Update All Webhooks"}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🟢 Results Summary Modal */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={20} className="stroke-[2.5]" />
            </div>
            <DialogTitle className="text-base font-black text-slate-800 dark:text-white">
              Webhook Synchronization Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Meta Webhook callback URLs have been processed.
            </DialogDescription>
          </DialogHeader>

          {syncResults && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Processed</p>
                  <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{syncResults.total}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Updated</p>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{syncResults.updated}</p>
                </div>
                <div className="rounded-2xl border border-rose-200/60 dark:border-rose-800/40 bg-rose-50/40 dark:bg-rose-950/20 p-3 text-center">
                  <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">Failed</p>
                  <p className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">{syncResults.failed}</p>
                </div>
              </div>

              {syncResults.details && syncResults.details.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200/60 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {syncResults.details.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.orgName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{item.phone || item.wabaId || 'No Number'}</p>
                        {item.error && <p className="text-[10px] text-rose-500 truncate">{item.error}</p>}
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0",
                        item.status === 'success' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                      )}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setIsResultsModalOpen(false)}
              className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
