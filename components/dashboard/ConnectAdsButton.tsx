'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Facebook } from 'lucide-react';
import { connectFacebookAdsWithToken } from '@/app/actions/facebook-ads';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function ConnectAdsButton() {
  const t = useTranslations("AdManager");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [metaAppId, setMetaAppId] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  useEffect(() => {
    let currentAppId: string | null = null;
    getWhatsappStatus()
      .then(data => {
        if (data && data.metaAppId) {
          setMetaAppId(data.metaAppId);
          currentAppId = data.metaAppId;
        }
      })
      .catch(console.error)
      .finally(() => {
        setIsLoadingCredentials(false);
        if (currentAppId) {
          if (!window.FB) {
            const script = document.createElement("script");
            script.id = "facebook-jssdk";
            script.src = "https://connect.facebook.net/en_US/sdk.js";
            script.async = true;
            script.defer = true;
            script.onload = () => {
              window.FB.init({
                appId: currentAppId,
                cookie: true,
                autoLogAppEvents: true,
                xfbml: true,
                version: "v21.0",
              });
            };
            document.body.appendChild(script);
          } else {
            window.FB.init({
              appId: currentAppId,
              cookie: true,
              autoLogAppEvents: true,
              xfbml: true,
              version: "v21.0",
            });
          }
        }
      });
  }, []);

  const handleConnect = () => {
    setIsConnecting(true);
    const appId = metaAppId;
    if (!appId) {
      setNotificationMessage(t("metaAppIdMissing"));
      setIsConnecting(false);
      return;
    }

    if (!window.FB) {
      setIsConnecting(false);
      toast.error("Facebook SDK not loaded yet. Please wait a moment and try again.");
      return;
    }

    // Basic scopes (no App Review needed for development):
    // Advanced scopes (ads_management, catalog_management, leads_retrieval etc.) require
    // App Review approval in Meta App Dashboard → Permissions and Features.
    // ads_read is REQUIRED for getAdAccounts to work.
    // Enable it in Meta App Dashboard → Permissions → ads_read → Standard Access
    // (Standard Access works immediately for app admins without App Review)
    const scopes = 'public_profile,email,ads_read,pages_show_list,business_management,pages_manage_metadata,pages_read_engagement,pages_messaging';

    try {
      window.FB.login(
        (response: any) => {
          (async () => {
            try {
              const accessToken = response?.authResponse?.accessToken;
              if (!accessToken) {
                setIsConnecting(false);
                toast.error("Facebook login was cancelled or failed.");
                return;
              }

              await connectFacebookAdsWithToken(accessToken);

              setIsConnecting(false);
              toast.success("Facebook Ad Account connected successfully!");
              window.location.reload();
            } catch (err: any) {
              setIsConnecting(false);
              toast.error(err?.message || "Failed to connect Facebook Ad Account.");
            }
          })().catch((err) => {
            setIsConnecting(false);
            toast.error((err as Error)?.message || "Failed to connect Facebook Ad Account.");
          });
        },
        {
          scope: scopes,
          auth_type: "rerequest",
          return_scopes: true,
        }
      );
    } catch (err: any) {
      setIsConnecting(false);
      toast.error(err?.message || "Failed to initialize Facebook login.");
    }
  };

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={isConnecting || isLoadingCredentials}
        className="bg-[#1877F2] text-white hover:bg-[#166fe5] shadow-lg shadow-blue-500/20"
      >
        {isConnecting || isLoadingCredentials ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {isLoadingCredentials ? "Loading..." : t("connecting")}
          </>
        ) : (
          <>
            <Facebook className="w-4 h-4 mr-2" fill="currentColor" />
            {t("connectAdAccount")}
          </>
        )}
      </Button>

      <Dialog open={!!notificationMessage} onOpenChange={(open) => !open && setNotificationMessage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("configRequired")}</DialogTitle>
            <DialogDescription>{notificationMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setNotificationMessage(null)}>{t("ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
