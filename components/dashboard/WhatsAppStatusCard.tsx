'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check, Facebook, RefreshCw, Settings, ArrowLeft, Trash2, ShieldCheck, Info, QrCode } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MotionCardWrapper } from "@/components/ui/motion-card-wrapper";
import { PillButton } from "@/components/ui/pill-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { usePusher } from '@/components/providers/PusherProvider';
import { WhatsAppQRModal } from './WhatsAppQRModal';

const RTL_LOCALES = new Set(["ar", "ur"]);
const LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  ur: "ur-PK",
  hi: "hi-IN",
  bn: "bn-BD",
  en: "en-US",
};

type FacebookLoginResponse = {
  authResponse?: {
    code?: string | null;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getTokenInfo(value: unknown) {
  const defaultScopes = ["whatsapp_business_management", "whatsapp_business_messaging", "whatsapp_business_manage_events", "public_profile"];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { scopes: defaultScopes, expiresAt: null };
  }

  const record = value as Record<string, unknown>;
  const parsedScopes = Array.isArray(record.scopes)
    ? record.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  return {
    scopes: parsedScopes.length > 0 ? parsedScopes : defaultScopes,
    expiresAt:
      typeof record.expires_at === "string" || record.expires_at instanceof Date
        ? record.expires_at
        : null,
  };
}

export default function WhatsAppStatusCard({ onConnectionStateChange }: { onConnectionStateChange?: () => void } = {}) {
  const t = useTranslations("DashboardSettingsPage.whatsappStatus");
  const locale = useLocale();
  const intlLocale = LOCALE_MAP[locale] ?? locale;
  const isRtl = RTL_LOCALES.has(locale);
  const { data: authSession, update: updateSession } = useSession();
  const { pusher } = usePusher();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [status, setStatus] = useState<{
    isConnected: boolean;
    connectionMethod?: string | null;
    whatsappConnectionMethod?: string | null;
    isInstagramConnected?: boolean;
    isFacebookConnected?: boolean;
    whatsappNumber?: string | null;
    whatsappBusinessName?: string | null;
    whatsappBusinessId?: string | null;
    whatsappPhoneNumberId?: string | null;
    metaAccessToken?: string | null;
    metaBusinessId?: string | null;
    metaAppId?: string | null;
    metaConfigId?: string | null;
    whatsappTokenInfo?: unknown;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [manualInputRequired, setManualInputRequired] = useState(false);
  const [isManualLinking, setIsManualLinking] = useState(false);
  const [isFinalizingConnection, setIsFinalizingConnection] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [wabaId, setWabaId] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const shouldReloadOnPopupCloseRef = useRef(false);

  // Manual Form State
  const [formData, setFormData] = useState({
    appId: '',
    appSecret: '',
    accessToken: '',
    wabaId: '',
    phoneId: '',
    businessId: ''
  });

  const checkStatus = useCallback(async () => {
    try {
      const data = await getWhatsappStatus();
      setStatus(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const refreshConnectedState = useCallback(async () => {
    await Promise.all([
      checkStatus(),
      updateSession(),
    ]);
    onConnectionStateChange?.();
  }, [checkStatus, onConnectionStateChange, updateSession]);

  useEffect(() => {
    checkStatus();

    const waitForConnectionAndReload = async () => {
      setIsFinalizingConnection(true);
      const maxAttempts = 25; // ~50 seconds

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const data = await getWhatsappStatus();
          setStatus(data);

          if (data?.isConnected && data?.whatsappNumber) {
            await Promise.all([updateSession()]);
            window.location.reload();
            return;
          }
        } catch {
          // Keep polling through transient errors
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Fallback: reload anyway so latest server-rendered state is shown
      window.location.reload();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin === "https://www.facebook.com") {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'WA_EMBEDDED_SIGNUP' && (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING')) {
            const { phone_number_id, waba_id } = data.data || {};
            if (waba_id) {
              window.localStorage.setItem('pending_waba_id', waba_id);
              if (phone_number_id) {
                window.localStorage.setItem('pending_phone_id', phone_number_id);
              }
              if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
                window.localStorage.setItem('pending_is_app_onboarding', 'true');
              } else {
                window.localStorage.removeItem('pending_is_app_onboarding');
              }
            }
          }
        } catch {
          // ignore non-JSON postMessage events
        }
      }

      if (event.data?.type === 'WHATSAPP_CONNECTED') {
        setIsConnecting(false);
        if (event.data?.manualSetupRequired) {
          setManualInputRequired(true);
        } else {
          waitForConnectionAndReload();
        }
      }

      if (event.data?.type === 'WHATSAPP_CONNECTION_ERROR') {
        setIsConnecting(false);
        toast.error(event.data.error || t("toasts.connectFailed"));
      }
    };

    const checkPopupStatus = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        setIsConnecting(false);
        refreshConnectedState();
        if (shouldReloadOnPopupCloseRef.current) {
          shouldReloadOnPopupCloseRef.current = false;
          waitForConnectionAndReload();
        }
        clearInterval(checkPopupStatus);
      }
    }, 1000);

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(checkPopupStatus);
    };
  }, [checkStatus, refreshConnectedState, t, updateSession]);

  // Realtime updates for WhatsApp connection & disconnection
  useEffect(() => {
    const orgId = authSession?.user?.organizationId;
    if (!pusher || !orgId) return;

    const channelName = `org-${orgId}`;
    const channel = pusher.subscribe(channelName);

    const onWhatsAppConnected = () => {
      refreshConnectedState();
    };
    const onWhatsAppDisconnected = () => {
      refreshConnectedState();
    };

    channel.bind('whatsapp:connected', onWhatsAppConnected);
    channel.bind('whatsapp:disconnected', onWhatsAppDisconnected);

    return () => {
      channel.unbind('whatsapp:connected', onWhatsAppConnected);
      channel.unbind('whatsapp:disconnected', onWhatsAppDisconnected);
    };
  }, [pusher, authSession?.user?.organizationId, refreshConnectedState]);

  const handleConnect = async () => {
    setIsConnecting(true);
    shouldReloadOnPopupCloseRef.current = true;
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.endsWith('.local') ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    if (window.location.protocol !== 'https:' && !isLocal) {
      setIsConnecting(false);
      toast.error(t("toasts.requiresHttps"));
      return;
    }
    const appId = status?.metaAppId;
    const configId = status?.metaConfigId || '';
    if (!appId) {
      setNotificationMessage(t("toasts.missingAppId"));
      setIsConnecting(false);
      return;
    }
    if (!configId) {
      toast.error(t("toasts.missingConfigId"));
      setIsConnecting(false);
      return;
    }

    window.localStorage.removeItem('pending_waba_id');
    window.localStorage.removeItem('pending_phone_id');
    window.localStorage.removeItem('pending_is_app_onboarding');

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
          setTimeout(() => reject(new Error(t("toasts.sdkTimeout"))), 8000);
          return;
        }

        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.onload = init;
        script.onerror = () => reject(new Error(t("toasts.sdkLoadFailed")));
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
              toast.error(t("toasts.signupCancelled"));
              return;
            }

            const pendingWabaId = window.localStorage.getItem('pending_waba_id');
            const pendingPhoneId = window.localStorage.getItem('pending_phone_id');
            const pendingIsAppOnboarding = window.localStorage.getItem('pending_is_app_onboarding') === 'true';

            const result = await connectMetaAccount(
              code,
              '',
              pendingWabaId,
              pendingPhoneId,
              false,
              [],
              pendingIsAppOnboarding,
              true
            );

            setIsConnecting(false);
            if (result?.error || result?.result === "error") {
              toast.error(result?.error || t("toasts.connectFailed"));
              return;
            }
            if (result?.result === "manual_setup_required") {
              setManualInputRequired(true);
              return;
            }
            await refreshConnectedState();
            toast.success(t("toasts.connected"));
          } catch (err) {
            setIsConnecting(false);
            toast.error(getErrorMessage(err, t("toasts.connectFailed")));
          }
        })().catch((err) => {
          setIsConnecting(false);
          toast.error(getErrorMessage(err, t("toasts.connectFailed")));
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
      toast.error(getErrorMessage(err, t("toasts.sdkInitFailed")));
    }
  };

  const handleManualSubmit = async () => {
    if (!wabaId) return;
    setIsLoading(true);
    setManualError(null);
    try {
      await saveManualWabaId(wabaId);
      setManualInputRequired(false);
      refreshConnectedState();
    } catch (err: unknown) {
      setManualError(((err as Error)?.message) || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setManualError(null);
    try {
      const res = await saveManualMetaConfiguration(formData);
      if (res && !res.success) {
        const errorMsg = res.error || "Failed to save configuration.";
        setManualError(errorMsg);
        toast.error(errorMsg);
      } else {
        setIsManualLinking(false);
        refreshConnectedState();
        toast.success("WhatsApp configuration saved successfully!");
      }
    } catch (err: unknown) {
      const msg = ((err as Error)?.message) || String(err);
      setManualError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t("confirmDisconnect"))) return;

    setIsLoading(true);
    try {
      await disconnectWhatsApp();
      refreshConnectedState();
      toast.success(t("toasts.disconnected"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("toasts.disconnectFailed")));
    } finally {
      setIsLoading(false);
    }
  };

  const tokenInfo = getTokenInfo(status?.whatsappTokenInfo);
  const formatTokenExpiry = (date: string | Date) =>
    new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));

  return (
    <MotionCardWrapper className="h-full flex flex-col group cursor-pointer">
      <div dir={isRtl ? "rtl" : "ltr"} className="h-full aesthetic-glass p-1 rounded-3xl flex flex-col text-start">
        <div className="px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-white/10">
          <h3 className="text-muted-foreground/60 font-bold tracking-widest text-[10px] group-hover:text-foreground transition-colors dark:text-muted-foreground/40 dark:group-hover:text-foreground">
            {t("title")}
          </h3>
          
        </div>
        <div
          className="bg-white dark:bg-slate-900 rounded-3xl p-4 flex-1 flex flex-col"
          style={{ boxShadow: "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px" }}
        >
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-medium tracking-wide text-gray-400 dark:text-gray-500">
              {t("connectionLabel")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">
            {status?.isConnected
              ? t("connectedDescription")
              : t("disconnectedDescription")
            }
          </p>

          {status?.isConnected ? (
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-slate-700 bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">{t("number")}</p>
                      {status.whatsappConnectionMethod === 'qr' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <QrCode className="w-2.5 h-2.5" />
                          QR Linked Device
                        </span>
                      ) : status.whatsappConnectionMethod === 'embedded_signup' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                          Embedded Signup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          Manual API
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{status.whatsappNumber}</p>
                  </div>
                </div>
              </div>

              {status.whatsappConnectionMethod === 'qr' ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">WhatsApp Web Device Connected</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Linked directly to your WhatsApp mobile device. Inbound messages, Live Chat, AI Bot responses, and automations flow through this authenticated session.
                  </p>
                </div>
              ) : tokenInfo && status.metaAccessToken ? (
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-muted/30 p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{t("accessTokenInfo")}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-1">{t("permissionScopes")}</p>
                      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 break-words">
                        {tokenInfo.scopes?.join(", ") || t("notAvailable")}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Info className="h-3 w-3 text-muted-foreground" />
                          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">{t("expiryAt")}</p>
                        </div>
                        <p className={cn(
                          "text-[11px] font-medium",
                          tokenInfo.expiresAt && new Date(tokenInfo.expiresAt) < new Date()
                            ? "text-red-500"
                            : ""
                        )}>
                          {tokenInfo.expiresAt
                            ? formatTokenExpiry(tokenInfo.expiresAt)
                            : t("neverExpires")}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                      <a
                        href={`https://developers.facebook.com/tools/debug/accesstoken/?access_token=${status.metaAccessToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        {t("debugToken")}
                        < RefreshCw className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground">{status.whatsappBusinessName}</span>
                <div className="flex gap-2">
                  {/* <PillButton
 variant="outline"
 icon={Settings}
 label="Edit"
 className="h-7 text-xs"
 onClick={() => {
 setFormData({
 accessToken: status.metaAccessToken ||'',
 wabaId: status.whatsappBusinessId ||'',
 phoneId: status.whatsappPhoneNumberId ||'',
 businessId: status.metaBusinessId ||''
 });
 setIsManualLinking(true);
 }}
 /> */}
                  {/* <PillButton
 variant="primary"
 icon={RefreshCw}
 label="Sync"
 className="h-7 text-xs"
 onClick={() => { if (confirm('Refresh the connection?')) handleConnect(); }}
 /> */}
                  <PillButton
                    variant="outline"
                    icon={isLoading ? Loader2 : Trash2}
                    label={isLoading ? "..." : t("disconnect")}
                    className={cn("h-7 text-xs border-red-500/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20", isLoading && "[&_svg]:animate-spin")}
                    disabled={isLoading}
                    onClick={handleDisconnect}
                  />
                </div>
              </div>
            </div>
          ) : isManualLinking ? (
            <form onSubmit={handleFullManualSubmit} className="space-y-3 pt-4 overflow-y-auto max-h-[400px] pr-1">
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setIsManualLinking(false)} className="p-1 hover:bg-muted rounded-full transition-colors">
                  <ArrowLeft className={cn("w-4 h-4", isRtl && "rotate-180")} />
                </button>
                <span className="text-xs font-bold tracking-wider">{t("manualConfiguration")}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] tracking-widest text-muted-foreground">{t("facebookAppId")}</Label>
                <Input
                  placeholder="123456789..."
                  className="h-9 text-xs border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/2"
                  value={formData.appId}
                  onChange={e => setFormData({ ...formData, appId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] tracking-widest text-muted-foreground">{t("facebookAppSecret")}</Label>
                <Input
                  placeholder={t("appSecretPlaceholder")}
                  className="h-9 text-xs border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/2"
                  value={formData.appSecret}
                  onChange={e => setFormData({ ...formData, appSecret: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] tracking-widest text-muted-foreground">{t("systemAccessToken")}</Label>
                <Input
                  placeholder="EAAG..."
                  className="h-9 text-xs border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/2"
                  value={formData.accessToken}
                  onChange={e => setFormData({ ...formData, accessToken: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-[10px] tracking-widest text-muted-foreground">{t("wabaIdDigits")}</Label>
                  <Input
                    placeholder={t("example1092")}
                    className="h-9 text-xs border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/2"
                    value={formData.wabaId}
                    onChange={e => setFormData({ ...formData, wabaId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] tracking-widest text-muted-foreground">{t("phoneIdOptional")}</Label>
                  <Input
                    placeholder={t("example2938")}
                    className="h-9 text-xs border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/2"
                    value={formData.phoneId}
                    onChange={e => setFormData({ ...formData, phoneId: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] tracking-widest text-muted-foreground">{t("businessManagerIdOptional")}</Label>
                <Input
                  placeholder={t("example789")}
                  className="h-9 text-xs border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/2"
                  value={formData.businessId}
                  onChange={e => setFormData({ ...formData, businessId: e.target.value })}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                  <div className="space-y-1.5">
                      <p className="text-[9px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">{t("howToGetToken")}</p>
                      <ul className={cn("text-[9px] text-blue-600 dark:text-blue-400 list-disc space-y-1", isRtl ? "pr-3" : "pl-3")}>
                          <li>{t("tokenStep1")}</li>
                          <li>{t("tokenStep2")}</li>
                          <li>{t("tokenStep3")} <strong>whatsapp_business_management</strong> {t("and")} <strong>whatsapp_business_messaging</strong></li>
                          <li>{t("tokenStep4")} <strong>{t("addAssets")}</strong> {t("tokenStep4Suffix")}</li>
                      </ul>
                  </div>
              </div>

              {manualError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-xs font-semibold leading-relaxed">
                  {manualError}
                </div>
              )}

              <PillButton
                variant="sidebar"
                type="submit"
                icon={isLoading ? Loader2 : undefined}
                label={isLoading ? t("saving") : t("saveConfiguration")}
                className={cn("w-full justify-center h-10 mt-2", isLoading && "[&_svg]:animate-spin")}
                disabled={isLoading}
              />
            </form>
          ) : manualInputRequired ? (
            <div className="space-y-4 pt-4">
              <div className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("authorizationSuccess")} <strong className="text-foreground font-semibold">{t("businessAccountId")}</strong>
                </p>
                <Input
                  placeholder={t("wabaPlaceholder")}
                  className="h-10 text-sm border-gray-200 dark:border-slate-700"
                  value={wabaId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWabaId(e.target.value)}
                />
                {manualError && (
                  <p className="text-[10px] font-semibold text-destructive tracking-wider">{manualError}</p>
                )}
              </div>
              <PillButton
                variant="sidebar"
                icon={isLoading ? Loader2 : undefined}
                label={isLoading ? t("verifying") : t("verifyUnlock")}
                className={cn("w-full justify-center h-10", isLoading && "[&_svg]:animate-spin")}
                disabled={isLoading || !wabaId}
                onClick={handleManualSubmit}
              />
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {/* Option 1: QR Code Device Linking */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/15 p-3.5 space-y-2.5 transition-all hover:border-emerald-500/50 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Connect via QR Code</h4>
                      <p className="text-[10px] text-muted-foreground">WhatsApp Web multi-device linking</p>
                    </div>
                  </div>
                  <PillButton
                    variant="primary"
                    icon={QrCode}
                    label="Scan QR Code"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
                    disabled={isConnecting || isLoadingStatus || isFinalizingConnection}
                    onClick={() => setIsQRModalOpen(true)}
                  />
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20 leading-relaxed font-medium">
                  Scan the QR code using WhatsApp → Linked Devices → Link a Device.
                </div>
              </div>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-muted" /></div>
                <div className="relative flex justify-center text-[10px] tracking-widest font-semibold"><span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground uppercase">{t("or") || "OR"}</span></div>
              </div>

              {/* Option 2: Meta Embedded Signup */}
              <PillButton
                variant="primary"
                icon={(isConnecting || isLoadingStatus || isFinalizingConnection) ? Loader2 : Facebook}
                label={
                  isLoadingStatus
                    ? t("checkingConfig")
                    : isConnecting
                      ? t("authenticating")
                      : isFinalizingConnection
                        ? t("finalizing")
                        : (t("connectWhatsapp") || "Connect with Meta (Embedded Signup)")
                }
                className={cn("w-full justify-center h-10 gap-2 text-xs", (isConnecting || isLoadingStatus || isFinalizingConnection) && "[&_svg]:animate-spin")}
                disabled={isConnecting || isLoadingStatus || isFinalizingConnection}
                onClick={handleConnect}
              />

              {/* Option 3: Manual API */}
              <PillButton
                variant="outline"
                icon={Settings}
                label={t("linkManually") || "Manual API"}
                className="w-full justify-center h-9 gap-2 text-xs border-dashed"
                disabled={isFinalizingConnection}
                onClick={() => setIsManualLinking(true)}
              />
            </div>
          )}
        </div>
      </div>

      <WhatsAppQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onSuccess={async () => {
          setIsQRModalOpen(false);
          await refreshConnectedState();
          toast.success("WhatsApp device connected successfully!");
        }}
      />

      <Dialog open={!!notificationMessage} onOpenChange={(open) => !open && setNotificationMessage(null)}>
        <DialogContent className="max-w-md ">
          <DialogHeader>
            <DialogTitle>{t("configurationRequired")}</DialogTitle>
            <DialogDescription>{notificationMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setNotificationMessage(null)}>{t("ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionCardWrapper>
  );
}
