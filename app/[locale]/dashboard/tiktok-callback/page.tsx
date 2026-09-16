'use client';

import { useSearchParams } from'next/navigation';
import TikTokCallbackHandler from'./tiktok-callback-handler';

export default function TikTokCallbackPage() {
 const searchParams = useSearchParams();
 const code = searchParams.get('code') || undefined;
 const state = searchParams.get('state') || undefined;
 const error = searchParams.get('error') || undefined;
 const errorDescription = searchParams.get('error_description') || undefined;

 if (error) {
 return <TikTokCallbackHandler error={errorDescription || error} />;
 }

 if (!code || !state) {
 return <TikTokCallbackHandler error="Missing TikTok callback parameters." />;
 }

 return <TikTokCallbackHandler code={code} state={state} />;
}
