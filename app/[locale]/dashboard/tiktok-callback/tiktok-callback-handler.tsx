'use client';

import { useEffect, useRef, useState } from'react';
import { Loader2, CheckCircle2, XCircle } from'lucide-react';
import { connectTikTokAccount } from'@/app/actions/tiktok';

export default function TikTokCallbackHandler({
 code,
 state,
 error,
}: {
 code?: string;
 state?: string;
 error?: string;
}) {
 const [status, setStatus] = useState<'loading' |'success' |'error'>(error ?'error' :'loading');
 const [message, setMessage] = useState(error ||'Completing TikTok connection...');
 const startedRef = useRef(false);

 useEffect(() => {
 const run = async () => {
 if (!code || !state || startedRef.current) return;
 startedRef.current = true;

 try {
 await connectTikTokAccount(code, state);
 setStatus('success');
 setMessage('TikTok connected successfully.');
 if (window.opener) {
 window.opener.postMessage({ type:'TIKTOK_CONNECTED' },'*');
 }
 setTimeout(() => window.close(), 1200);
 } catch (err: any) {
 const msg = err?.message ||'Failed to connect TikTok account.';
 setStatus('error');
 setMessage(msg);
 if (window.opener) {
 window.opener.postMessage({ type:'TIKTOK_CONNECTION_ERROR', error: msg },'*');
 }
 }
 };

 run();
 }, [code, state]);

 if (status ==='loading') {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-6">
 <div className="w-full max-w-md rounded-[30px] border border-border bg-card p-8 text-center shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px]">
 <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-foreground" />
 <h1 className="mb-2 text-2xl font-bold">Connecting TikTok</h1>
 <p className="text-sm text-muted-foreground">{message}</p>
 </div>
 </div>
 );
 }

 if (status ==='error') {
 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-6">
 <div className="w-full max-w-md rounded-[30px] border border-destructive/30 bg-card p-8 text-center shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px]">
 <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
 <h1 className="mb-2 text-2xl font-bold">TikTok Connection Failed</h1>
 <p className="text-sm text-muted-foreground">{message}</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-6">
 <div className="w-full max-w-md rounded-[30px] border border-border bg-card p-8 text-center shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px]">
 <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-[#054d28]" />
 <h1 className="mb-2 text-2xl font-bold">TikTok Connected</h1>
 <p className="text-sm text-muted-foreground">{message}</p>
 </div>
 </div>
 );
}
