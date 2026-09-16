"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Facebook, ArrowRight, Instagram } from "lucide-react";
import { WhatsAppColorIcon, FacebookColorIcon, InstagramColorIcon } from "@/components/icons/SocialIcons";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export default function ConnectFacebookButton({
  label,
  channel = "whatsapp",
  onSuccess,
  className,
}: {
  label?: string;
  channel?: "whatsapp" | "instagram" | "facebook";
  onSuccess?: () => void;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<{
    isConnected: boolean;
    whatsappNumber?: string | null;
    whatsappBusinessName?: string | null;
    metaAppId?: string | null;
    metaConfigId?: string | null;
    instagramAppId?: string | null;
    instagramAppSecret?: string | null;
    instagramConfigId?: string | null;
    enableBusinessAppOnboarding?: boolean;
  } | null>(null);
  const [manualInputRequired, setManualInputRequired] = useState(false);
  const [wabaId, setWabaId] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );
  const popupRef = useRef<Window | null>(null);

  const checkStatus = async () => {
    try {
      const data = await getWhatsappStatus();
      setStatus(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    checkStatus();

    // 1. Pre-load Facebook SDK on mount
    const loadSdk = async () => {
      const currentStatus = status || (await getWhatsappStatus());
      const appId = currentStatus?.metaAppId;
      if (!appId) return;

      if (!window.FB) {
        const script = document.createElement("script");
        script.id = "facebook-jssdk";
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          window.FB.init({
            appId,
            cookie: true,
            autoLogAppEvents: true,
            xfbml: true,
            version: "v24.0",
          });
        };
        document.body.appendChild(script);
      } else {
        window.FB.init({
          appId,
          cookie: true,
          autoLogAppEvents: true,
          xfbml: true,
          version: "v24.0",
        });
      }
    };
    loadSdk();

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      // ... (rest of the handleMessage logic remains same)
      // 1. Listen for Meta's Embedded Signup events
      if (event.origin.includes("facebook.com")) {
        try {
          let data = event.data;
          if (typeof event.data === 'string') {
            data = JSON.parse(event.data);
          }

          if (data?.type === "WA_EMBEDDED_SIGNUP") {
            console.log("[Meta] Embedded Signup Event:", data.event, data.data);
            if (
              data.event === "FINISH" ||
              data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
            ) {
              const { phone_number_id, waba_id } = data.data || {};
              if (waba_id) {
                console.log("[Meta] Capture IDs:", {
                  waba_id,
                  phone_number_id,
                });
                window.localStorage.setItem("pending_waba_id", waba_id);
                if (phone_number_id) {
                  window.localStorage.setItem("pending_phone_id", phone_number_id);
                }
                if (data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
                  window.localStorage.setItem(
                    "pending_is_app_onboarding",
                    "true",
                  );
                } else {
                  window.localStorage.removeItem("pending_is_app_onboarding");
                }
              }
            }
          }
        } catch (_e) {
          console.warn("Failed to parse message from Meta:", _e);
        }
      }

      // 2. Original callback from our fb-callback page
      if (event.data?.type === "WHATSAPP_CONNECTED") {
        setIsConnecting(false);
        if (event.data?.manualSetupRequired) {
          setManualInputRequired(true);
        } else {
          checkStatus();
          if (onSuccess) onSuccess();
        }
      }

      if (event.data?.type === "INSTAGRAM_CONNECTED") {
        setIsConnecting(false);
        checkStatus();
        if (onSuccess) onSuccess();
        toast.success("Instagram account connected successfully!");
      }

      if (event.data?.type === "FACEBOOK_CONNECTED") {
        setIsConnecting(false);
        checkStatus();
        if (onSuccess) onSuccess();
        toast.success("Facebook page connected successfully!");
      }

      // 3. Handle connection error
      if (event.data?.type === "WHATSAPP_CONNECTION_ERROR") {
        setIsConnecting(false);
        toast.error(event.data.error || "Failed to connect WhatsApp account");
      }

      if (event.data?.type === "FACEBOOK_CONNECTION_ERROR") {
        setIsConnecting(false);
        toast.error(event.data.error || "Failed to connect Facebook page");
      }
    };

    const checkPopupStatus = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        setIsConnecting(false);
        clearInterval(checkPopupStatus);
      }
    }, 1000);

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(checkPopupStatus);
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("localhost") ||
      window.location.hostname.endsWith(".local") ||
      window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.startsWith("10.");

    if (channel === "whatsapp" && window.location.protocol !== "https:" && !isLocal) {
      setIsConnecting(false);
      toast.error(
        "Meta Embedded Signup requires HTTPS. Use your ngrok URL instead of localhost.",
      );
      return;
    }

    // 1. If status hasn't loaded yet, fetch it now
    let currentStatus = status;
    if (!currentStatus) {
      try {
        currentStatus = await getWhatsappStatus();
        setStatus(currentStatus);
      } catch (e) {
        console.error("Failed to fetch current status in handleConnect:", e);
      }
    }

    const targetAppId = (channel === "facebook" || channel === "instagram")
      ? (currentStatus?.instagramAppId || currentStatus?.metaAppId)
      : currentStatus?.metaAppId;

    if (!targetAppId) {
      setNotificationMessage(
        `${channel === "facebook" || channel === "instagram" ? "Facebook/Instagram" : "Meta"} App ID is missing in configuration. Please add it in Admin > Configurations > Social Login Settings.`,
      );
      setIsConnecting(false);
      return;
    }

    const configId = currentStatus?.metaConfigId || "";
    if (!window.FB) {
      setIsConnecting(false);
      toast.error("Facebook SDK not loaded yet. Please wait a moment and try again.");
      return;
    }

    try {
      if (channel === "facebook" || channel === "instagram") {
        const scopes =
          channel === "facebook"
            ? "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging"
            : "instagram_basic,instagram_manage_messages,instagram_manage_comments,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging";

        // Re-initialize FB SDK with the specific Facebook/Instagram App ID so domain check matches
        if (targetAppId && window.FB) {
          window.FB.init({
            appId: targetAppId,
            cookie: true,
            autoLogAppEvents: true,
            xfbml: true,
            version: "v24.0",
          });
        }

        const loginOptions: any = {
          scope: scopes,
          auth_type: "rerequest",
          return_scopes: true,
        };

        window.FB.login(
          (response: any) => {
            (async () => {
              try {
                let accessToken = response?.authResponse?.accessToken;
                const code = response?.authResponse?.code;

                if (!accessToken && code) {
                  try {
                    accessToken = await exchangeMetaCodeToToken(code, "", true);
                  } catch (e: any) {
                    setIsConnecting(false);
                    toast.error(e?.message || "Failed to exchange authorization code for token");
                    return;
                  }
                }

                if (!accessToken) {
                  setIsConnecting(false);
                  toast.error(
                    `${channel === "facebook" ? "Facebook" : "Instagram"} login was cancelled or failed.`,
                  );
                  return;
                }

                if (channel === "facebook") {
                  await connectFacebookPageWithToken(accessToken);
                } else {
                  const result =
                    await connectInstagramAccountWithToken(accessToken);
                  if (!result.success) {
                    toast.error(
                      result.error || "Failed to connect Instagram account",
                    );
                    setIsConnecting(false);
                    return;
                  }
                }

                setIsConnecting(false);
                checkStatus();
                if (onSuccess) onSuccess();
                toast.success(
                  `${channel === "facebook" ? "Facebook page" : "Instagram account"} connected successfully!`,
                );
              } catch (err: any) {
                setIsConnecting(false);
                toast.error(
                  err?.message ||
                  `Failed to connect ${channel === "facebook" ? "Facebook page" : "Instagram account"}`,
                );
              }
            })().catch((err) => {
              setIsConnecting(false);
              toast.error(
                (err as Error)?.message ||
                `Failed to connect ${channel === "facebook" ? "Facebook page" : "Instagram account"}`,
              );
            });
          },
          loginOptions,
        );
        return;
      }


      window.localStorage.removeItem("pending_waba_id");
      window.localStorage.removeItem("pending_phone_id");
      window.localStorage.removeItem("pending_is_app_onboarding");

      window.FB.login(
        (response: any) => {
          (async () => {
            try {
              const authResponse = response?.authResponse;
              const code = authResponse?.code;

              if (!code) {
                setIsConnecting(false);
                toast.error(
                  "WhatsApp Embedded Signup was cancelled or failed.",
                );
                return;
              }
              let pendingWabaId = window.localStorage.getItem("pending_waba_id");
              let pendingPhoneId = window.localStorage.getItem("pending_phone_id");
              let pendingIsAppOnboarding = window.localStorage.getItem("pending_is_app_onboarding") === "true";

              // Race condition fix: Wait up to 3 seconds for the message event to populate localStorage
              let retries = 0;
              while (!pendingWabaId && retries < 15) {
                await new Promise(r => setTimeout(r, 200));
                pendingWabaId = window.localStorage.getItem("pending_waba_id");
                if (pendingWabaId) {
                  pendingPhoneId = window.localStorage.getItem("pending_phone_id");
                  pendingIsAppOnboarding = window.localStorage.getItem("pending_is_app_onboarding") === "true";
                  break;
                }
                retries++;
              }

              const result = await connectMetaAccount(
                code,
                "",
                pendingWabaId,
                pendingPhoneId,
                false,
                [],
                pendingIsAppOnboarding,
                true,
              );

              setIsConnecting(false);

              if (result?.error || result?.result === "error") {
                toast.error(
                  result?.error || "Failed to connect WhatsApp account",
                );
                return;
              }

              if (result?.result === "manual_setup_required") {
                setManualInputRequired(true);
                return;
              }
              checkStatus();
              if (onSuccess) onSuccess();
              toast.success("WhatsApp connected successfully!");
            } catch (err: any) {
              setIsConnecting(false);
              toast.error(err?.message || "Failed to connect WhatsApp account");
            }
          })().catch((err) => {
            setIsConnecting(false);
            toast.error(
              (err as Error)?.message || "Failed to connect WhatsApp account",
            );
          });
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (err: any) {
      setIsConnecting(false);
      toast.error(err?.message || "Failed to initialize Facebook SDK");
    }
  };

  const handleManualSubmit = async () => {
    if (!wabaId) return;
    setIsLoading(true);
    setManualError(null);
    try {
      await saveManualWabaId(wabaId);
      setManualInputRequired(false);
      checkStatus();
    } catch (err: unknown) {
      setManualError((err as Error)?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (status?.isConnected && channel === "whatsapp") {
    return (
      <div className="flex flex-col gap-2 w-full">
        <Button
          disabled
          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium w-full h-auto flex items-center justify-center gap-2 opacity-90 cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          Connected: {status.whatsappNumber}
        </Button>
        {status.whatsappBusinessName && (
          <p className="text-xs text-green-100 pl-1">
            Business: {status.whatsappBusinessName}
          </p>
        )}
      </div>
    );
  }

  if (manualInputRequired) {
    return (
      <div className="flex flex-col gap-3 w-full animate-in fade-in zoom-in duration-300">
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
          <p className="text-xs text-yellow-800 mb-2">
            Authorization successful! <br />
            Please enter your <strong>WhatsApp Business Account ID</strong> to
            finish setup.
            <br />
            <a
              href="https://business.facebook.com/settings/whatsapp-business-accounts/"
              target="_blank"
              className="underline font-semibold"
            >
              Find it here
            </a>
            .
          </p>
          <Input
            placeholder="Enter WABA ID (e.g., 3892...)"
            className="bg-white"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
          />
          {manualError && (
            <p className="text-xs text-red-600 mt-1">{manualError}</p>
          )}
        </div>
        <Button
          onClick={handleManualSubmit}
          disabled={isLoading || !wabaId}
          className="bg-blue-600 text-white hover:bg-blue-700 w-full"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4 hidden" />
          )}
          Verify & Save
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className={cn(
          "px-5 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all flex items-center justify-center gap-2.5 font-['Plus_Jakarta_Sans',sans-serif] active:scale-[0.99]",
          channel === "instagram"
            ? "bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:brightness-105 text-white shadow-md shadow-pink-500/20"
            : "bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-md shadow-blue-500/20",
          className
        )}
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            {channel === "instagram" ? (
              <InstagramColorIcon className="w-4 h-4 shrink-0 drop-shadow-xs" />
            ) : (
              <FacebookColorIcon className="w-4 h-4 shrink-0 drop-shadow-xs" />
            )}
            <span>
              {label ||
                (channel === "instagram"
                  ? "Connect Instagram"
                  : "Connect with Facebook")}
            </span>
          </>
        )}
      </Button>

      <Dialog
        open={!!notificationMessage}
        onOpenChange={(open) => !open && setNotificationMessage(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configuration Required</DialogTitle>
            <DialogDescription>{notificationMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setNotificationMessage(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
