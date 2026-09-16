
import React from 'react';
import { Info, QrCode } from 'lucide-react';
import { useSession } from "next-auth/react";
import { useUserStatus } from '@/hooks/useUserStatus';

export function LiveChatHeader() {
    const { data: session } = useSession();
    const { whatsappConnected, whatsappConnectionMethod } = useUserStatus();
    const isConnected = whatsappConnected || session?.user?.whatsappConnected;
    const isQr = whatsappConnectionMethod === 'qr' || (session?.user as any)?.whatsappConnectionMethod === 'qr';

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
            <h1 className="text-2xl font-bold text-foreground">Live Chat</h1>

            <div className="flex items-center gap-6 text-xs text-muted-foreground bg-card px-4 py-2 rounded-xl border border-border shadow-sm">
                {isQr ? (
                    <div className="flex items-center gap-2">
                        <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold text-foreground">WhatsApp Web (QR)</span>
                        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            Live Device
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span>Quality Rating</span>
                            <Info className="w-3.5 h-3.5" />
                            {isConnected ? (
                                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-[10px] font-bold">High</span>
                            ) : (
                                <span className="bg-slate-200 dark:bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">N/A</span>
                            )}
                        </div>

                        <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />

                        <div className="flex items-center gap-2">
                            <span>Messaging Tier</span>
                            <Info className="w-3.5 h-3.5" />
                            <span className="font-bold text-gray-900 dark:text-gray-200">
                                {isConnected ? "Tier 1 (250/24h)" : "Unverified"}
                            </span>
                        </div>

                        <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block" />

                        <div className="hidden sm:flex items-center gap-2">
                            <span>Remaining Quota</span>
                            <Info className="w-3.5 h-3.5" />
                            <span className="font-bold text-gray-900 dark:text-gray-200">
                                {isConnected ? "250" : "0"}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
