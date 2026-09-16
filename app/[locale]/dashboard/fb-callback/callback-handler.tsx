'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, XCircle, CheckCircle2, Instagram, ChevronRight } from 'lucide-react';

export default function CallbackHandler({
    success: initialSuccess,
    error: initialError,
    manualSetupRequired: initialManual,
    code,
    instagramAccounts: initialInstagramAccounts = [],
    noInstagramFound: initialNoInstagramFound = false,
    channel = 'whatsapp',
}: {
    success?: boolean;
    error?: string;
    manualSetupRequired?: boolean;
    code?: string;
    instagramAccounts?: any[];
    noInstagramFound?: boolean;
    channel?: 'whatsapp' | 'facebook' | 'instagram' | 'ads';
}) {
    const initialStatus: 'loading' | 'success' | 'error' | 'select_instagram' | 'no_instagram' =
        initialError
            ? 'error'
            : initialNoInstagramFound
                ? 'no_instagram'
                : initialInstagramAccounts.length > 0
                    ? 'select_instagram'
                    : initialSuccess
                        ? 'success'
                        : 'loading';

    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'select_instagram' | 'no_instagram'>(initialStatus);
    const [errorMessage, setErrorMessage] = useState(initialError || '');
    const [_isManual, setIsManual] = useState(initialManual || false);
    const [instagramAccounts, setInstagramAccounts] = useState<any[]>(initialInstagramAccounts);
    const [isSaving, setIsSaving] = useState(false);
    const hasStartedRef = useRef(false);
    const successPostedRef = useRef(false);

    useEffect(() => {
        const run = async () => {
            if (!code || hasStartedRef.current) return;
            hasStartedRef.current = true;
            try {
                const redirectUri = `${window.location.origin}/dashboard/fb-callback`;
                if (channel === 'facebook') {
                    await connectFacebookPageAccount(code, redirectUri);
                    if (window.opener) {
                        window.opener.postMessage({ type: 'FACEBOOK_CONNECTED' }, '*');
                    }
                    setStatus('success');
                    setTimeout(() => window.close(), 1000);
                    return;
                }

                if (channel === 'instagram') {
                    const result = await connectMetaAccount(
                        code,
                        redirectUri,
                        undefined,
                        undefined,
                        true,
                        [
                            'instagram_business_basic',
                            'instagram_business_manage_messages',
                            'instagram_business_manage_comments',
                            'instagram_business_content_publish',
                            'instagram_business_manage_insights',
                            'pages_show_list',
                            'pages_read_engagement'
                        ],
                        false,
                        false
                    );
                    if (result?.result === 'error') {
                        throw new Error(result.error || 'Failed to connect Instagram account.');
                    }

                    const firstInstagram = result?.instagramAccounts?.[0];
                    if (!firstInstagram?.id) {
                        throw new Error('No Instagram Business account found. Make sure your Instagram is linked to the selected Facebook Page.');
                    }

                    await connectInstagramAccount(firstInstagram.id, firstInstagram.pageId, firstInstagram.pageName);
                    if (window.opener) {
                        window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', account: firstInstagram }, '*');
                    }
                    setStatus('success');
                    setTimeout(() => window.close(), 1000);
                    return;
                }

                const pendingWabaId = localStorage.getItem('pending_waba_id');
                const pendingPhoneId = localStorage.getItem('pending_phone_id');
                const result = await connectMetaAccount(code, redirectUri, pendingWabaId, pendingPhoneId);

                if (result?.result === 'error') {
                    throw new Error(result.error || 'Failed to connect account.');
                }

                if (window.opener) {
                    successPostedRef.current = true;
                    window.opener.postMessage({
                        type: 'WHATSAPP_CONNECTED',
                        manualSetupRequired: result?.result === 'manual_setup_required'
                    }, '*');
                }

                // Force a second-pass webhook setup for reliability, especially on test numbers.
                const webhookFinalize = await finalizeWhatsAppWebhookSetup();
                if (!webhookFinalize.success) {
                    console.warn('[WebhookAutoSetup] finalize step warning:', webhookFinalize.error);
                }

                localStorage.removeItem('pending_waba_id');
                localStorage.removeItem('pending_phone_id');

                if (result?.result === 'no_instagram_found') {
                    setStatus('no_instagram');
                    return;
                }

                const availableInstagramAccounts = result?.instagramAccounts ?? [];
                if (availableInstagramAccounts.length > 0) {
                    setInstagramAccounts(availableInstagramAccounts);
                    setStatus('select_instagram');
                    return;
                }

                if (result?.result === 'manual_setup_required') {
                    setIsManual(true);
                }

                setStatus('success');
                setTimeout(() => window.close(), 1000);
            } catch (err: any) {
                const isNetworkFetchIssue =
                    typeof err?.message === 'string' &&
                    err.message.toLowerCase().includes('networkerror');

                if (isNetworkFetchIssue) {
                    // In some popup/browser combinations this can be transient.
                    // Verify connection state before treating as success.
                    try {
                        const status = await getWhatsappStatus();
                        if (status?.isConnected && status?.whatsappBusinessId) {
                            const webhookFinalize = await finalizeWhatsAppWebhookSetup();
                            if (!webhookFinalize.success) {
                                console.warn('[WebhookAutoSetup] finalize step warning after network issue:', webhookFinalize.error);
                            }

                            if (window.opener) {
                                window.opener.postMessage({
                                    type: 'WHATSAPP_CONNECTED',
                                    manualSetupRequired: false
                                }, '*');
                            }
                            setStatus('success');
                            setTimeout(() => window.close(), 300);
                            return;
                        }
                    } catch (verifyErr) {
                        console.error('Connection verification after network issue failed:', verifyErr);
                    }
                }

                if (successPostedRef.current) {
                    setStatus('success');
                    setTimeout(() => window.close(), 1000);
                    return;
                }

                setStatus('error');
                const msg = err?.message || 'Failed to connect account.';
                setErrorMessage(msg);
                if (window.opener) {
                    window.opener.postMessage({
                        type: channel === 'facebook' ? 'FACEBOOK_CONNECTION_ERROR' : 'WHATSAPP_CONNECTION_ERROR',
                        error: msg
                    }, '*');
                }
            }
        };

        if (code) {
            run();
            return;
        }

        if (initialError) {
            setStatus('error');
            setErrorMessage(initialError);
            if (window.opener) {
                window.opener.postMessage({
                    type: 'WHATSAPP_CONNECTION_ERROR',
                    error: initialError
                }, '*');
            }
            return;
        }

        if (!initialSuccess) {
            return;
        }

        if (window.opener) {
            window.opener.postMessage({ type: 'WHATSAPP_CONNECTED', manualSetupRequired: initialManual }, '*');
        }

        if (initialNoInstagramFound) {
            setStatus('no_instagram');
            return;
        }

        if (initialInstagramAccounts.length > 0) {
            setInstagramAccounts(initialInstagramAccounts);
            setStatus('select_instagram');
            return;
        }

        setStatus('success');
        setTimeout(() => window.close(), 1000);
    }, [code, initialSuccess, initialError, initialManual, initialInstagramAccounts, initialNoInstagramFound, channel]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
                {/* Background Decor */}
                <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="w-full max-w-sm bg-card/40 backdrop-blur-3xl rounded-[40px] border border-border shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] p-10 text-center space-y-6 relative z-10 ring-1 ring-white/60 dark:ring-slate-800/50">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center border border-primary/20">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-foreground tracking-tight leading-none">Connecting</h2>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Syncing with Meta</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-progress origin-left w-full" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleSelectInstagram = async (account: any) => {
        setIsSaving(true);
        try {
            await connectInstagramAccount(account.id, account.pageId, account.pageName);
            setStatus('success');
            if (window.opener) {
                window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', account }, '*');
            }
            setTimeout(() => window.close(), 1500);
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to connect Instagram account');
            setStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    if (status === 'no_instagram') {
        return (
            <div className="min-h-screen bg-[#FFF0F0] dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] border border-red-200 dark:border-red-900 shadow-xl p-8 space-y-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-red-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Instagram Not Found</h2>
                    <div className="space-y-4 text-left p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">We found your Facebook Page, but no Instagram account is linked.</p>
                        <ul className="text-[10px] text-slate-500 space-y-2 list-disc pl-4 leading-relaxed">
                            <li>Ensure your Instagram is a <b>Business</b> account.</li>
                            <li>Link it to your Facebook Page in Instagram App Settings.</li>
                            <li>Ensure you granted permission for the Page in the login window.</li>
                        </ul>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.close()}
                            className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        const isOrgError = errorMessage.toLowerCase().includes('organization') || errorMessage.toLowerCase().includes('log out');

        return (
            <div className="min-h-screen bg-[#FFF0F0] dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] border border-red-200 dark:border-red-900 shadow-xl p-8 space-y-6 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-red-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Connection Error</h2>

                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-1">What went wrong?</p>
                        <p className="text-xs text-red-500 font-medium leading-relaxed">{errorMessage}</p>
                    </div>

                    <div className="space-y-4 text-left p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider mb-2">Suggested Actions</p>
                        <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                            {isOrgError ? (
                                <>
                                    <li>Log out of Watibot and log in again to refresh your organization session.</li>
                                    <li>Ensure you are a member of the organization you are trying to connect.</li>
                                </>
                            ) : (
                                <>
                                    <li>Ensure you have administrative access to the Facebook/Instagram account.</li>
                                    <li>Verify that all requested permissions were granted during the Meta login.</li>
                                    <li>Check your internet connection and try the process again.</li>
                                </>
                            )}
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-600/20"
                        >
                            Try Again
                        </button>
                        {isOrgError && (
                            <button
                                onClick={() => {
                                    if (window.opener) {
                                        window.opener.location.href = '/api/auth/signout';
                                    } else {
                                        window.location.href = '/api/auth/signout';
                                    }
                                    window.close();
                                }}
                                className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                Log Out & Fix
                            </button>
                        )}
                        <button
                            onClick={() => window.close()}
                            className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            Close Window
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (status === 'select_instagram') {
        return (
            <div className="min-h-screen bg-[#F8F9FB] dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-xl p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                                <Instagram className="w-8 h-8 text-orange-600" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Choose Instagram Account</h2>
                        <p className="text-xs text-slate-500">Select the Business account you want to connect.</p>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {instagramAccounts.map((account) => (
                            <button
                                key={account.id}
                                onClick={() => handleSelectInstagram(account)}
                                disabled={isSaving}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-900 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-all text-left group"
                            >
                                <img src={account.profilePic} alt={account.username} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white truncate">@{account.username}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{account.name} • {account.pageName}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 transition-colors" />
                            </button>
                        ))}
                    </div>

                    {isSaving && (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Connecting account...
                        </div>
                    )}

                    <button
                        onClick={() => window.close()}
                        className="w-full py-4 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FFF8] dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="w-full max-w-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[40px] border border-emerald-100 dark:border-emerald-900/30 shadow-[0_40px_100px_-20px_rgba(16,185,129,0.05)] p-10 text-center space-y-6 relative z-10 ring-1 ring-white/60 dark:ring-slate-800/50">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-[2rem] flex items-center justify-center border border-emerald-100 dark:border-emerald-900/20">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">{_isManual ? 'Authenticated' : 'Success!'}</h2>
                    <p className="text-[10px] font-bold tracking-[0.2em] text-[#00B074] dark:text-emerald-400">{_isManual ? 'Please Complete Setup' : 'Account Linked Successfully'}</p>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                    {_isManual
                        ? 'Please enter your Business Account ID in the main window to finish linking.'
                        : 'Your WhatsApp configuration is active. This window will transition automatically.'
                    }
                </p>
            </div>
        </div>
    );
}
