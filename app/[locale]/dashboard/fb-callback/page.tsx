'use client';

import { useMemo } from'react';
import { useSearchParams } from'next/navigation';
import CallbackHandler from'./callback-handler';

export default function FacebookCallbackPage() {
 const searchParams = useSearchParams();

 const code = searchParams.get('code') || undefined;
 const error = searchParams.get('error') || undefined;
 const errorDescription = searchParams.get('error_description') || undefined;
 const state = searchParams.get('state') || undefined;

 const channel = useMemo<'facebook' |'instagram' |'whatsapp'>(() => {
  if (state ==='facebook_page') return'facebook';
  if (state ==='instagram_connect') return'instagram';
  return'whatsapp';
  }, [state]);

 if (error) {
 return <CallbackHandler error={errorDescription || error} channel={channel} />;
 }

 if (!code) {
 return <CallbackHandler error="No authorization code received." channel={channel} />;
 }

 return <CallbackHandler code={code} channel={channel} />;
}
