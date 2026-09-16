"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Plus,
  QrCode,
  ShieldCheck,
  Check,
  Trash2,
  Edit2,
  Star,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getWhatsAppChannels,
  createWhatsAppChannel,
  updateWhatsAppChannel,
  deleteWhatsAppChannel,
  connectMetaChannel,
  connectSecondaryMetaChannelViaEmbeddedSignup,
import type { WhatsAppChannelDTO } from "@/lib/whatsapp/channel-resolver";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { FacebookColorIcon } from "@/components/icons/SocialIcons";

export function WhatsAppChannelsWidget() {
  const [channels, setChannels] = useState<WhatsAppChannelDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<WhatsAppChannelDTO | null>(null);
  const [editName, setEditName] = useState("");

  // Meta System Config for Embedded Signup
  const [metaConfig, setMetaConfig] = useState<{
    metaAppId?: string | null;
    metaConfigId?: string | null;
  } | null>(null);

  // Add Channel Modal States
  const [channelType, setChannelType] = useState<"embedded" | "qr" | "manual">("embedded");
  const [newChannelName, setNewChannelName] = useState("");
  const [metaPhone, setMetaPhone] = useState("");
  const [metaPhoneId, setMetaPhoneId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // QR Scanning Modal States
  const [activeQrSession, setActiveQrSession] = useState<{
    channelId: string;
    sessionId: string;
    qrData?: string | null;
    status: string;
  } | null>(null);

  useEffect(() => {
    loadChannels();
    loadMetaConfig();

    // Listen for Meta Embedded Signup message events
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.origin === "string" && event.origin.includes("facebook.com")) {
        try {
          let data = event.data;
          if (typeof event.data === "string") {
            data = JSON.parse(event.data);
          }
          if (data?.type === "WA_EMBEDDED_SIGNUP") {
            if (data.event === "FINISH" || data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
              const { phone_number_id, waba_id } = data.data || {};
              if (waba_id) {
                window.localStorage.setItem("pending_channel_waba_id", waba_id);
              }
              if (phone_number_id) {
                window.localStorage.setItem("pending_channel_phone_id", phone_number_id);
              }
            }
          }
        } catch (_e) {
          // Ignore parse errors from other iframe messages
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const loadMetaConfig = async () => {
    try {
      const status = await getWhatsappStatus();
      setMetaConfig({
        metaAppId: status?.metaAppId || null,
        metaConfigId: status?.metaConfigId || null,
      });

      if (status?.metaAppId) {
        initFacebookSdk(status.metaAppId);
      }
    } catch (err) {
      console.warn("[WhatsAppChannelsWidget] Failed to load Meta config:", err);
    }
  };

  const initFacebookSdk = (appId: string) => {
    if (typeof window === "undefined") return;

    if (!window.FB) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.FB) {
          window.FB.init({
            appId,
            cookie: true,
            autoLogAppEvents: true,
            xfbml: true,
            version: "v21.0",
          });
        }
      };
      document.body.appendChild(script);
    } else {
      window.FB.init({
        appId,
        cookie: true,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v21.0",
      });
    }
  };

  const loadChannels = async () => {
    setIsLoading(true);
    try {
      const res = await getWhatsAppChannels();
      if (res.success && res.channels) {
        setChannels(res.channels);
      }
    } catch (err: any) {
      console.error("Failed to load channels:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (channelId: string) => {
    try {
      const res = await updateWhatsAppChannel(channelId, { isDefault: true });
      if (res.success) {
        toast.success("Default sender number updated");
        await loadChannels();
      } else {
        toast.error(res.error || "Failed to set default");
      }
    } catch {
      toast.error("Error setting default number");
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!confirm("Are you sure you want to disconnect and delete this WhatsApp channel?")) return;
    try {
      const res = await deleteWhatsAppChannel(channelId);
      if (res.success) {
        toast.success("WhatsApp channel removed");
        await loadChannels();
      } else {
        toast.error(res.error || "Failed to remove channel");
      }
    } catch {
      toast.error("Error removing channel");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingChannel || !editName.trim()) return;
    try {
      const res = await updateWhatsAppChannel(editingChannel.id, { name: editName.trim() });
      if (res.success) {
        toast.success("Channel name updated");
        setIsEditModalOpen(false);
        await loadChannels();
      } else {
        toast.error(res.error || "Failed to update channel");
      }
    } catch {
      toast.error("Error updating channel name");
    }
  };

  const handleLaunchEmbeddedSignup = () => {
    if (!newChannelName.trim()) {
      toast.error("Please enter a name for this number (e.g. Sales Desk)");
      return;
    }

    if (!metaConfig?.metaAppId || !metaConfig?.metaConfigId) {
      toast.error("Meta App ID or Configuration ID is missing. Please configure it in Social Login Settings.");
      return;
    }

    if (!window.FB) {
      toast.error("Facebook SDK is loading. Please wait 2 seconds and try again.");
      initFacebookSdk(metaConfig.metaAppId);
      return;
    }

    window.localStorage.removeItem("pending_channel_waba_id");
    window.localStorage.removeItem("pending_channel_phone_id");
    setIsSubmitting(true);

    try {
      window.FB.login(
        (response: any) => {
          (async () => {
            try {
              const authResponse = response?.authResponse;
              const code = authResponse?.code;
              const directToken = authResponse?.accessToken;

              if (!code && !directToken) {
                setIsSubmitting(false);
                toast.error("Meta Embedded Signup was cancelled or failed.");
                return;
              }

              // Poll briefly to capture WABA and Phone IDs sent via postMessage
              let pendingWabaId = window.localStorage.getItem("pending_channel_waba_id");
              let pendingPhoneId = window.localStorage.getItem("pending_channel_phone_id");
              let retries = 0;
              while (!pendingWabaId && retries < 10) {
                await new Promise((r) => setTimeout(r, 200));
                pendingWabaId = window.localStorage.getItem("pending_channel_waba_id");
                if (pendingWabaId) {
                  pendingPhoneId = window.localStorage.getItem("pending_channel_phone_id");
                  break;
                }
                retries++;
              }

              const res = await connectSecondaryMetaChannelViaEmbeddedSignup({
                channelName: newChannelName.trim(),
                code,
                accessToken: directToken,
                wabaId: pendingWabaId,
                phoneNumberId: pendingPhoneId,
              });

              setIsSubmitting(false);

              if (res.success && res.channel) {
                toast.success(`WhatsApp number "${res.channel.name}" connected successfully!`);
                setIsAddModalOpen(false);
                resetAddForm();
                await loadChannels();
              } else {
                toast.error(res.error || "Failed to link Meta WhatsApp number");
              }
            } catch (err: any) {
              setIsSubmitting(false);
              toast.error(err?.message || "Failed to process Meta Embedded Signup");
            }
          })().catch((e) => {
            setIsSubmitting(false);
            toast.error(e?.message || "An error occurred");
          });
        },
        {
          config_id: metaConfig.metaConfigId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        }
      );
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error(err?.message || "Failed to launch Facebook login modal");
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Please enter a name for this number (e.g. Sales Desk)");
      return;
    }

    if (channelType === "embedded") {
      handleLaunchEmbeddedSignup();
      return;
    }

    setIsSubmitting(true);
    try {
      if (channelType === "manual") {
        if (!metaPhone.trim() || !metaPhoneId.trim() || !metaToken.trim()) {
          toast.error("Please fill in Phone Number, Phone Number ID, and Access Token");
          setIsSubmitting(false);
          return;
        }

        const createRes = await createWhatsAppChannel({
          name: newChannelName.trim(),
          phoneNumber: metaPhone.trim(),
          connectionMethod: "manual",
        });

        if (!createRes.success || !createRes.channel) {
          toast.error(createRes.error || "Failed to initialize channel");
          setIsSubmitting(false);
          return;
        }

        const connectRes = await connectMetaChannel(createRes.channel.id, {
          phoneNumber: metaPhone.trim(),
          phoneNumberId: metaPhoneId.trim(),
          businessAccountId: metaWabaId.trim() || undefined,
          accessToken: metaToken.trim(),
        });

        if (connectRes.success) {
          toast.success("Meta WhatsApp account connected successfully");
          setIsAddModalOpen(false);
          resetAddForm();
          await loadChannels();
        } else {
          toast.error(connectRes.error || "Failed to connect Meta account");
        }
      } else {
        // QR Flow
        const createRes = await createWhatsAppChannel({
          name: newChannelName.trim(),
          connectionMethod: "qr",
        });

        if (!createRes.success || !createRes.channel) {
          toast.error(createRes.error || "Failed to initialize channel");
          setIsSubmitting(false);
          return;
        }

        setIsAddModalOpen(false);
        resetAddForm();
        await loadChannels();

        // Start QR session for the newly created channel
        await startQrForChannel(createRes.channel.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startQrForChannel = async (channelId: string) => {
    try {
      const qrRes = await createWhatsAppQRSession();
      if (qrRes.success && qrRes.session) {
        setActiveQrSession({
          channelId,
          sessionId: qrRes.session.id,
          qrData: qrRes.session.qrData,
          status: qrRes.session.status,
        });

        // Start polling QR status
        pollQrSession(channelId, qrRes.session.id);
      } else {
        toast.error(qrRes.error || "Failed to generate QR code");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start QR session");
    }
  };

  const pollQrSession = (channelId: string, sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await getWhatsAppQRSession(sessionId);
        if (res.success && res.session) {
          setActiveQrSession((prev) =>
            prev && prev.sessionId === sessionId
              ? {
                  ...prev,
                  qrData: res.session.qrData,
                  status: res.session.status,
                }
              : prev
          );

          if (res.session.status === "connected") {
            clearInterval(interval);
            setActiveQrSession(null);
            toast.success(`WhatsApp connected successfully: ${res.phoneNumber || "New Device"}`);
            await loadChannels();
          } else if (res.session.status === "failed" || res.session.status === "expired") {
            clearInterval(interval);
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
  };

  const resetAddForm = () => {
    setNewChannelName("");
    setMetaPhone("");
    setMetaPhoneId("");
    setMetaWabaId("");
    setMetaToken("");
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Connected WhatsApp Numbers & Channels
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            Manage multiple WhatsApp numbers within the same workspace. Connect both QR-linked phones and official Meta Cloud API accounts simultaneously.
          </p>
        </div>

        <Button
          onClick={() => {
            resetAddForm();
            setChannelType("embedded");
            setIsAddModalOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-sm flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Another Number</span>
        </Button>
      </div>

      {/* Channels List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          <span className="text-xs font-bold text-slate-400">Loading connected numbers...</span>
        </div>
      ) : channels.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Smartphone className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Connected WhatsApp Numbers</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click &quot;Connect Another Number&quot; above to link a WhatsApp phone via Meta Embedded Signup, QR code, or Cloud API.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const isQr = channel.connectionMethod === "qr" || channel.phoneNumberId?.startsWith("qr_");
            const isLive = channel.status === "CONNECTED";

            return (
              <div
                key={channel.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4 shadow-sm",
                  channel.isDefault
                    ? "border-emerald-500/80 ring-2 ring-emerald-500/15"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                          isQr
                            ? "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"
                            : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {isQr ? <QrCode className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {channel.name}
                          </h4>
                          {channel.isDefault && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              Default Sender
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
                          {channel.phoneNumber.startsWith("pending_") ? "Pending Pairing" : channel.phoneNumber}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isLive ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[10px] font-extrabold uppercase",
                          isLive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {isLive ? "Live" : "Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Type:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {isQr
                          ? "QR Multi-Device Connection"
                          : channel.connectionMethod === "embedded_signup"
                          ? "Meta Cloud API (Embedded Signup)"
                          : "Meta Cloud API (Manual)"}
                      </span>
                    </div>
                    {channel.phoneNumberId && !channel.phoneNumberId.startsWith("qr_") && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Phone ID:</span>
                        <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {channel.phoneNumberId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {!channel.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(channel.id)}
                        className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 h-8 px-2.5 cursor-pointer"
                      >
                        Make Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingChannel(channel);
                        setEditName(channel.name);
                        setIsEditModalOpen(true);
                      }}
                      className="text-xs font-bold text-slate-600 dark:text-slate-400 h-8 px-2.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Rename
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isQr && !isLive && (
                      <Button
                        size="sm"
                        onClick={() => startQrForChannel(channel.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold h-8 px-3 rounded-lg cursor-pointer flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Scan QR
                      </Button>
                    )}
                    {channels.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(channel.id)}
                        className="text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 px-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Channel Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-[#0B0F1A] border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
              Connect Another WhatsApp Number
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name Input */}
            <div className="space-y-1.5 text-start">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Channel Name / Label <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Sales Desk, Support Number, Backup Line"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="h-10 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold"
              />
            </div>

            {/* Connection Type Switcher */}
            <div className="space-y-1.5 text-start">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Connection Method
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {/* 1-Click Embedded Signup */}
                <div
                  onClick={() => setChannelType("embedded")}
                  className={cn(
                    "p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-1.5",
                    channelType === "embedded"
                      ? "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <FacebookColorIcon className="w-5 h-5" />
                  <span className="text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
                    Meta Embedded Signup
                  </span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">1-Click Official</span>
                </div>

                {/* QR Code */}
                <div
                  onClick={() => setChannelType("qr")}
                  className={cn(
                    "p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-1.5",
                    channelType === "qr"
                      ? "border-purple-600 bg-purple-500/10 ring-2 ring-purple-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <QrCode className="w-5 h-5 text-purple-600" />
                  <span className="text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
                    QR Code Device
                  </span>
                  <span className="text-[9px] text-slate-400">Any Mobile Phone</span>
                </div>

                {/* Manual Cloud API */}
                <div
                  onClick={() => setChannelType("manual")}
                  className={cn(
                    "p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-1.5",
                    channelType === "manual"
                      ? "border-blue-600 bg-blue-500/10 ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <span className="text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight">
                    Manual Cloud API
                  </span>
                  <span className="text-[9px] text-slate-400">Tokens &amp; IDs</span>
                </div>
              </div>
            </div>

            {/* Embedded Signup Description */}
            {channelType === "embedded" && (
              <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 space-y-2 text-start">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Meta Official Fast Onboarding</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Log in with your Meta/Facebook business account to instantly link your WhatsApp Business Number, complete embedded verification, and auto-subscribe webhooks.
                </p>
                {!metaConfig?.metaAppId && (
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Meta App ID not configured in Admin &gt; Social Settings.</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual Meta API Fields */}
            {channelType === "manual" && (
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="space-y-1 text-start">
                  <Label className="text-[10px] font-bold text-slate-500">Phone Number (with Country Code)</Label>
                  <Input
                    placeholder="+923001234567"
                    value={metaPhone}
                    onChange={(e) => setMetaPhone(e.target.value)}
                    className="h-9 bg-white dark:bg-slate-900 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 text-start">
                    <Label className="text-[10px] font-bold text-slate-500">Phone Number ID</Label>
                    <Input
                      placeholder="1029384756..."
                      value={metaPhoneId}
                      onChange={(e) => setMetaPhoneId(e.target.value)}
                      className="h-9 bg-white dark:bg-slate-900 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1 text-start">
                    <Label className="text-[10px] font-bold text-slate-500">WABA ID (Optional)</Label>
                    <Input
                      placeholder="9876543210..."
                      value={metaWabaId}
                      onChange={(e) => setMetaWabaId(e.target.value)}
                      className="h-9 bg-white dark:bg-slate-900 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-start">
                  <Label className="text-[10px] font-bold text-slate-500">Permanent Access Token</Label>
                  <Input
                    type="password"
                    placeholder="EAAG..."
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    className="h-9 bg-white dark:bg-slate-900 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs font-bold h-10 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateChannel}
                disabled={isSubmitting}
                className={cn(
                  "text-white font-bold text-xs h-10 px-5 rounded-xl cursor-pointer flex items-center gap-2",
                  channelType === "embedded"
                    ? "bg-[#1877F2] hover:bg-[#166fe5]"
                    : channelType === "qr"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : channelType === "embedded" ? (
                  <>
                    <FacebookColorIcon className="w-4 h-4 brightness-200" />
                    <span>Launch Meta Embedded Signup</span>
                  </>
                ) : channelType === "qr" ? (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Proceed to Scan QR</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Connect Meta Account</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Name Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#0B0F1A] border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
              Rename Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 text-start">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Channel Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs font-bold h-10 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5 rounded-xl cursor-pointer"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active QR Scanning Modal */}
      <Dialog open={!!activeQrSession} onOpenChange={(open) => !open && setActiveQrSession(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#0B0F1A] border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
              Scan WhatsApp QR Code
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4 flex flex-col items-center">
            {activeQrSession?.qrData ? (
              <div className="p-3 bg-white rounded-2xl border-4 border-emerald-500/20 shadow-md">
                <QRCodeSVG value={activeQrSession.qrData} size={220} />
              </div>
            ) : (
              <div className="w-[220px] h-[220px] rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-slate-500">Generating QR code...</span>
              </div>
            )}

            <div className="space-y-1 text-xs text-slate-500 max-w-xs">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                1. Open WhatsApp on your phone
              </p>
              <p>2. Tap Menu / Settings &gt; Linked Devices &gt; Link a Device</p>
              <p>3. Point your camera at this QR code to connect</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
