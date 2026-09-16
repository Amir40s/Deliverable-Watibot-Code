"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  Smartphone,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePusher } from "@/components/providers/PusherProvider";
import { useSession } from "next-auth/react";
import {
  createWhatsAppQRSession,
  getWhatsAppQRSession,
  cancelWhatsAppQRSession,
  regenerateWhatsAppQRSession,
import type { QRSessionStatus, WhatsAppQRSessionDTO } from "@/lib/whatsapp/types";

interface WhatsAppQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WhatsAppQRModal({
  isOpen,
  onClose,
  onSuccess,
}: WhatsAppQRModalProps) {
  const { data: authSession } = useSession();
  const { pusher } = usePusher();

  const [session, setSession] = useState<WhatsAppQRSessionDTO | null>(null);
  const [status, setStatus] = useState<QRSessionStatus>("pending");
  const [qrData, setQrData] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const activeSessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Initialize a new QR linking session
  const initSession = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatus("pending");
    setQrData(null);
    cleanupPolling();

    try {
      const res = await createWhatsAppQRSession();
      if (res.success && res.session) {
        setSession(res.session);
        setStatus(res.session.status);
        activeSessionIdRef.current = res.session.id;

        if (res.session.qrData) {
          setQrData(res.session.qrData);
        }

        // Setup periodic status check (fallback alongside Pusher)
        pollTimerRef.current = setInterval(async () => {
          if (!activeSessionIdRef.current) return;
          try {
            const check = await getWhatsAppQRSession(activeSessionIdRef.current);
            if (check.success && check.session) {
              const current = check.session;
              setStatus(current.status);
              if (current.qrData) setQrData(current.qrData);

              if (current.status === "connected") {
                cleanupPolling();
                if ((check as any).phoneNumber) setConnectedPhone((check as any).phoneNumber);
                if ((check as any).businessName) setConnectedName((check as any).businessName);
                toast.success("WhatsApp device linked successfully!");
              } else if (current.status === "expired" || current.status === "failed") {
                cleanupPolling();
              }
            }
          } catch {
            // Ignore polling errors
          }
        }, 3000);
      } else {
        setErrorMessage(res.error || "Failed to initialize QR session");
        setStatus("failed");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
      setStatus("failed");
    } finally {
      setIsLoading(false);
    }
  }, [cleanupPolling]);

  // Handle regenerating a new QR code when expired
  const handleRegenerate = async () => {
    if (!session?.id) {
      await initSession();
      return;
    }

    setIsRegenerating(true);
    setErrorMessage(null);
    cleanupPolling();

    try {
      const res = await regenerateWhatsAppQRSession(session.id);
      if (res.success && res.session) {
        setSession(res.session);
        setStatus(res.session.status);
        activeSessionIdRef.current = res.session.id;
        if (res.session.qrData) setQrData(res.session.qrData);

        // Resume polling fallback
        pollTimerRef.current = setInterval(async () => {
          if (!activeSessionIdRef.current) return;
          try {
            const check = await getWhatsAppQRSession(activeSessionIdRef.current);
            if (check.success && check.session) {
              setStatus(check.session.status);
              if (check.session.qrData) setQrData(check.session.qrData);
              if (check.session.status === "connected") {
                cleanupPolling();
                if ((check as any).phoneNumber) setConnectedPhone((check as any).phoneNumber);
                if ((check as any).businessName) setConnectedName((check as any).businessName);
                toast.success("WhatsApp device linked successfully!");
              }
            }
          } catch {}
        }, 3000);
      } else {
        setErrorMessage(res.error || "Failed to refresh QR code");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error refreshing QR code");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Start session when modal opens
  useEffect(() => {
    if (isOpen) {
      initSession();
    } else {
      cleanupPolling();
      if (activeSessionIdRef.current && status !== "connected") {
        cancelWhatsAppQRSession(activeSessionIdRef.current).catch(() => {});
      }
      activeSessionIdRef.current = null;
    }

    return () => {
      cleanupPolling();
    };
  }, [isOpen, initSession, cleanupPolling]);

  // Listen to realtime Pusher updates
  useEffect(() => {
    const orgId = authSession?.user?.organizationId;
    if (!pusher || !orgId || !isOpen) return;

    const channelName = `org-${orgId}`;
    const channel = pusher.subscribe(channelName);

    const handleQrUpdate = (payload: any) => {
      if (payload.sessionId && activeSessionIdRef.current && payload.sessionId !== activeSessionIdRef.current) {
        return;
      }

      if (payload.status) {
        setStatus(payload.status);
      }
      if (payload.qrData) {
        setQrData(payload.qrData);
      }
      if (payload.errorReason) {
        setErrorMessage(payload.errorReason);
      }
      if (payload.phoneNumber) {
        setConnectedPhone(payload.phoneNumber);
      }
      if (payload.businessName) {
        setConnectedName(payload.businessName);
      }

      if (payload.status === "connected") {
        cleanupPolling();
        toast.success("WhatsApp device linked successfully!");
      }
    };

    const handleConnected = (payload: any) => {
      setStatus("connected");
      if (payload.phoneNumber) setConnectedPhone(payload.phoneNumber);
      if (payload.businessName) setConnectedName(payload.businessName);
      cleanupPolling();
    };

    channel.bind("whatsapp:qr-update", handleQrUpdate);
    channel.bind("whatsapp:connected", handleConnected);

    return () => {
      channel.unbind("whatsapp:qr-update", handleQrUpdate);
      channel.unbind("whatsapp:connected", handleConnected);
    };
  }, [pusher, authSession?.user?.organizationId, isOpen, cleanupPolling]);

  const handleClose = () => {
    cleanupPolling();
    if (activeSessionIdRef.current && status !== "connected") {
      cancelWhatsAppQRSession(activeSessionIdRef.current).catch(() => {});
    }
    onClose();
  };

  const handleFinish = () => {
    handleClose();
    onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
        <div className="p-7">
          <DialogHeader className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[18px] font-black flex items-center gap-2.5 text-slate-800 dark:text-white">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-[#00B074] flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                Connect WhatsApp via QR Code
              </DialogTitle>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Link your WhatsApp account seamlessly as a connected device without Meta Cloud API setup.
            </p>
          </DialogHeader>

          {/* Connected Success View */}
          {status === "connected" ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074] flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shadow-sm animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-800 dark:text-white">
                  WhatsApp Connected Successfully!
                </h4>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Your WhatsApp device is now authenticated and ready for Live Chat, AI Bots, and automated messaging.
                </p>
              </div>

              {(connectedPhone || connectedName) && (
                <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                  {connectedName && <span className="text-slate-400 mr-2">{connectedName}</span>}
                  <span className="font-mono text-[#00B074]">{connectedPhone}</span>
                </div>
              )}

              <Button
                onClick={handleFinish}
                className="mt-4 px-6 h-10 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                Continue to Dashboard
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-2">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[300px] text-center relative overflow-hidden">
                {isLoading || (status === "pending" && !qrData) ? (
                  <div className="flex flex-col items-center justify-center space-y-3 p-6">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00B074]" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Generating secure QR code...
                    </p>
                  </div>
                ) : status === "scanning" || status === "authenticated" ? (
                  <div className="flex flex-col items-center justify-center space-y-3 p-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074] flex items-center justify-center border border-emerald-200 dark:border-emerald-800 animate-pulse">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-black text-slate-800 dark:text-white">
                      Authenticating device...
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Please keep your phone active while we finalize the connection.
                    </p>
                  </div>
                ) : status === "expired" ? (
                  <div className="flex flex-col items-center justify-center space-y-3 p-6">
                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-white">
                      QR Code Expired
                    </h5>
                    <p className="text-[11px] font-semibold text-slate-400">
                      The QR code expired for your security. Generate a new one to continue.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="mt-2 h-9 px-4 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isRegenerating && "animate-spin")} />
                      Generate New QR
                    </Button>
                  </div>
                ) : status === "failed" ? (
                  <div className="flex flex-col items-center justify-center space-y-3 p-6">
                    <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-white">
                      Connection Failed
                    </h5>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {errorMessage || "We couldn't connect this WhatsApp device."}
                    </p>
                    <Button
                      size="sm"
                      onClick={initSession}
                      disabled={isLoading}
                      className="mt-2 h-9 px-4 bg-[#00B074] hover:bg-[#009c66] text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Again
                    </Button>
                  </div>
                ) : qrData ? (
                  <div className="flex flex-col items-center space-y-3 animate-in fade-in duration-300">
                    <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200/80">
                      <QRCodeSVG
                        value={qrData}
                        size={195}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-[#00B074] animate-ping inline-block" />
                      Waiting for scan...
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Instructions Guide */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#00B074]" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Open WhatsApp on your phone
                  </h4>
                </div>

                <ol className="space-y-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your mobile device.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>Select <strong>Linked Devices</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>Tap <strong>Link a Device</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#00B074]/15 text-[#00B074] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      5
                    </span>
                    <span>Point your phone camera to scan the QR code.</span>
                  </li>
                </ol>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancel
                  </Button>

                  {qrData && status === "qr_ready" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 rounded-xl"
                    >
                      <RefreshCw className={cn("w-3 h-3 mr-1.5", isRegenerating && "animate-spin")} />
                      Refresh QR
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { WhatsAppQRModal };
