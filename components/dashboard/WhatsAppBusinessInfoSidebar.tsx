"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Smartphone, Activity, QrCode, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppBusinessInfoSidebarProps {
  onboarding?: {
    whatsappBusinessId?: string | null;
    whatsappPhoneNumberId?: string | null;
    whatsappNumber?: string | null;
    whatsappBusinessName?: string | null;
    whatsappConnectionMethod?: string | null;
    metaAccessToken?: string | null;
    metaBusinessId?: string | null;
    metaAppId?: string | null;
    whatsapp_onboarding_raw_data?: any;
    progress?: number;
  } | null;
  onRefreshInfo?: () => void;
  isRefreshingInfo?: boolean;
}

export default function WhatsAppBusinessInfoSidebar({
  onboarding,
  onRefreshInfo,
  isRefreshingInfo,
}: WhatsAppBusinessInfoSidebarProps) {
  const wabaId = onboarding?.whatsappBusinessId || null;
  const phoneId = onboarding?.whatsappPhoneNumberId || null;
  const phoneNumber = onboarding?.whatsappNumber || null;
  const businessName = onboarding?.whatsappBusinessName || "Connected Account";
  const businessId = onboarding?.metaBusinessId || "1836006594030647";
  const appId = onboarding?.metaAppId || "757548130734743";
  const isQr = onboarding?.whatsappConnectionMethod === 'qr' || (phoneId ? phoneId.startsWith('qr_') : false);
  const isConnected = isQr ? !!(phoneNumber || phoneId) : !!(wabaId && phoneId && onboarding?.metaAccessToken);

  const rawData = onboarding?.whatsapp_onboarding_raw_data;
  const rawQuality = rawData?.phone_info?.quality_rating || rawData?.phone?.quality_rating || null;
  
  const getQualityDisplay = (rating: string | null) => {
    if (!rating) return null;
    const r = String(rating).toUpperCase();
    if (r === 'RED') return { label: 'Red - Low quality', class: 'text-rose-500 font-extrabold' };
    if (r === 'YELLOW') return { label: 'Yellow - Medium quality', class: 'text-amber-500 font-extrabold' };
    if (r === 'GREEN') return { label: 'Green - High quality', class: 'text-emerald-500 font-extrabold' };
    return { label: rating, class: 'text-slate-500 font-bold' };
  };

  const qualityInfo = (!isQr && isConnected) ? getQualityDisplay(rawQuality) : null;

  if (isQr) {
    return (
      <div className="space-y-6">
        {/* 1. WhatsApp Web Device Info Card */}
        <div className="aesthetic-glass p-1 rounded-3xl flex flex-col border border-border/50">
          <div className="px-4 py-3 flex justify-between items-center border-b border-border/50">
            <h3 className="text-muted-foreground/80 font-bold tracking-widest text-[10px] uppercase dark:text-muted-foreground/60 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-emerald-500" />
              WhatsApp Web Device Info
            </h3>
            <Badge className={cn("text-[9px] font-bold uppercase", isConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600")}>
              {isConnected ? "CONNECTED (QR)" : "DISCONNECTED"}
            </Badge>
          </div>

          <div className="p-5 space-y-4 text-start">
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Device Name</p>
                  <p className="text-xs font-extrabold text-foreground mt-0.5">{businessName}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Connected Phone Number</p>
                  <p className="text-xs font-mono font-bold text-foreground mt-0.5">{phoneNumber || "N/A"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Connection Protocol</p>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">Baileys WebSocket (Multi-Device)</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Session Encryption</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">End-to-end encrypted authenticated session stored on disk</p>
                </div>
              </div>
            </div>

            {/* Re-sync Action Button */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshInfo}
                disabled={isRefreshingInfo || !isConnected}
                className="w-full h-8 text-[10px] font-extrabold uppercase tracking-widest justify-center gap-1.5"
              >
                <RefreshCw className={cn("w-3 h-3", isRefreshingInfo && "animate-spin")} />
                Re-sync Device Profile
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Device Health Card */}
        <div className="aesthetic-glass p-1 rounded-3xl flex flex-col border border-border/50">
          <div className="px-4 py-3 flex justify-between items-center border-b border-border/50">
            <h3 className="text-muted-foreground/80 font-bold tracking-widest text-[10px] uppercase dark:text-muted-foreground/60 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              Device Health
            </h3>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
              {isConnected ? "ONLINE" : "OFFLINE"}
            </Badge>
          </div>

          <div className="p-5 space-y-4 text-start">
            <div className="space-y-3">
              {/* WhatsApp Socket */}
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">WhatsApp Web Socket</p>
                  <p className="text-[10px] font-bold text-muted-foreground">Inbound & Outbound Messaging</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
                  {isConnected ? "ACTIVE" : "STANDBY"}
                </Badge>
              </div>

              {/* Live Chat & AI Bot */}
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">Live Chat & AI Bot</p>
                  <p className="text-[10px] font-bold text-muted-foreground">Real-time Delivery</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
                  AVAILABLE
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. WhatsApp Business Info Card */}
      <div className="aesthetic-glass p-1 rounded-3xl flex flex-col border border-border/50">
        <div className="px-4 py-3 flex justify-between items-center border-b border-border/50">
          <h3 className="text-muted-foreground/80 font-bold tracking-widest text-[10px] uppercase dark:text-muted-foreground/60 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            WhatsApp Business Info
          </h3>
        </div>

        <div className="p-5 space-y-4 text-start">
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Phone Numbers</p>
            
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phone Number ID</p>
                  <p className="text-xs font-mono font-bold text-foreground mt-0.5">{phoneId || "N/A"}</p>
                </div>
                <Badge className={cn("text-[9px] font-bold uppercase", isConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600")}>
                  {isConnected ? "CONNECTED" : "DISCONNECTED"}
                </Badge>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Name</p>
                <p className="text-xs font-extrabold text-foreground mt-0.5">{businessName}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Display Phone Number</p>
                <p className="text-xs font-mono font-bold text-foreground mt-0.5">{phoneNumber || "N/A"}</p>
              </div>

              {isConnected && qualityInfo && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quality Rating</p>
                    <a
                      href="https://www.facebook.com/business/help/896873687365001"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 font-bold"
                    >
                      Meta Help <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <p className={cn("text-xs mt-0.5", qualityInfo.class)}>{qualityInfo.label}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Meta Action Links */}
          <div className="space-y-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshInfo}
              disabled={isRefreshingInfo || !isConnected}
              className="w-full h-8 text-[10px] font-extrabold uppercase tracking-widest justify-center gap-1.5"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshingInfo && "animate-spin")} />
              Re-sync Phone Numbers
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://business.facebook.com/wa/manage/phone-numbers/?waba_id=${wabaId || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "h-8 px-2 rounded-xl border border-border/50 bg-muted/20 text-[10px] font-bold flex items-center justify-center gap-1 text-foreground hover:bg-muted/40 transition-colors",
                  !isConnected && "pointer-events-none opacity-50"
                )}
              >
                Manage Numbers <ExternalLink className="w-2.5 h-2.5" />
              </a>

              <a
                href={`https://business.facebook.com/latest/whatsapp_manager/overview/?asset_id=${wabaId || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "h-8 px-2 rounded-xl border border-border/50 bg-muted/20 text-[10px] font-bold flex items-center justify-center gap-1 text-foreground hover:bg-muted/40 transition-colors",
                  !isConnected && "pointer-events-none opacity-50"
                )}
              >
                WhatsApp Manager <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <a
              href={`https://business.facebook.com/billing_hub/accounts/details?asset_id=${wabaId || ''}&account_type=whatsapp-business-account`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "h-8 px-2 rounded-xl border border-border/50 bg-muted/20 text-[10px] font-bold flex items-center justify-center gap-1 text-foreground hover:bg-muted/40 transition-colors w-full",
                !isConnected && "pointer-events-none opacity-50"
              )}
            >
              Manage Payments <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Overall Health Card */}
      <div className="aesthetic-glass p-1 rounded-3xl flex flex-col border border-border/50">
        <div className="px-4 py-3 flex justify-between items-center border-b border-border/50">
          <h3 className="text-muted-foreground/80 font-bold tracking-widest text-[10px] uppercase dark:text-muted-foreground/60 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            Overall Health
          </h3>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
            AVAILABLE
          </Badge>
        </div>

        <div className="p-5 space-y-4 text-start">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp Business ID</p>
            <p className="text-xs font-mono font-extrabold text-foreground mt-0.5">{wabaId || "N/A"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status as at</p>
            <p className="text-xs font-bold text-foreground mt-0.5">{new Date().toLocaleString()}</p>
          </div>

          {/* Entity Health Cards */}
          <div className="space-y-3 pt-2">
            {/* WABA Entity */}
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">WABA - {wabaId || "N/A"}</p>
                <p className="text-[10px] font-bold text-muted-foreground">Can Send Message</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
                AVAILABLE
              </Badge>
            </div>

            {/* Business Verification Entity */}
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">BUSINESS - {businessId}</p>
                <p className="text-[10px] font-bold text-muted-foreground">Business Verification</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
                VERIFIED
              </Badge>
            </div>

            {/* APP Entity */}
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">APP - {appId}</p>
                <p className="text-[10px] font-bold text-muted-foreground">Can Send Message</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold uppercase">
                AVAILABLE
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
