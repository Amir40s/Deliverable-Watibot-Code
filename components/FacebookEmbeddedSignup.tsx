"use client"

import React, { useEffect, useCallback } from'react'
import Script from'next/script'
import { toast } from'sonner'
import { useRouter } from'next/navigation'

interface FacebookEmbeddedSignupProps {
 appId: string;
 configId: string;
 onSuccess?: (response: any) => void;
 version?: string;
}

declare global {
 interface Window {
 fbAsyncInit: () => void;
 checkLoginState: () => void;
 FB: any;
 }
}

export default function FacebookEmbeddedSignup({ 
 appId, 
 configId, 
 onSuccess,
 version ='v21.0' 
}: FacebookEmbeddedSignupProps) {
 const router = useRouter();

 const statusChangeCallback = useCallback(async (response: any) => {
 console.log('Facebook Login Status Response:', response);
 
 if (response.status ==='connected') {
 const { authResponse } = response;
 console.log('Successfully connected!', authResponse);
 
 if (onSuccess) {
 onSuccess(response);
 } else {
 try {
 toast.info("Connecting your account...");
 const result = await connectMetaAccountWithToken(authResponse.accessToken);
 
 if (result.result ==='success') {
 toast.success(`Successfully connected ${result.whatsappBusinessName}!`);
 router.refresh();
 } else if (result.result ==='instagram_selection_required') {
 toast.success("WhatsApp connected! Redirecting to setup Instagram...");
 router.push('/dashboard/settings'); // Or wherever they can finish setup
 } else if (result.result ==='manual_setup_required') {
 toast.warning("WhatsApp connected, but automatic discovery failed. Please enter your IDs manually in Settings.");
 router.push('/dashboard/settings');
 } else {
 toast.error(result.error || "Failed to save connection.");
 }
 } catch (error) {
 console.error('Error saving FB connection:', error);
 toast.error("An error occurred while connecting.");
 }
 }
 } else {
 console.log('User not connected or login failed.');
 }
 }, [onSuccess, router]);

 useEffect(() => {
 // Define the global callback for the fb:login-button
 window.checkLoginState = () => {
 window.FB.getLoginStatus((response: any) => {
 statusChangeCallback(response);
 });
 };

 window.fbAsyncInit = function() {
 window.FB.init({
 appId: appId,
 cookie: true,
 xfbml: true,
 version: version
 });
 window.FB.AppEvents.logPageView();
 };

 // Load SDK if not already loaded
 if (!document.getElementById('facebook-jssdk')) {
 const fjs = document.getElementsByTagName('script')[0];
 const js = document.createElement('script');
 js.id ='facebook-jssdk';
 js.src = "https://connect.facebook.net/en_US/sdk.js";
 fjs.parentNode?.insertBefore(js, fjs);
 } else if (window.FB) {
 // If already loaded, re-parse XFBML
 window.FB.XFBML.parse();
 }
 }, [appId, version, statusChangeCallback]);

 return (
 <div className="flex flex-col items-center gap-4 w-full">
 <div 
 className="fb-signup-container"
 dangerouslySetInnerHTML={{ 
 __html:`<fb:login-button 
 config_id="${configId}" 
 onlogin="checkLoginState();"
 size="large"
 button_type="continue_with"
 layout="default"
 auto_logout_link="false"
 use_continue_as="true"
 >
 </fb:login-button>` 
 }} 
 />
 
 {/* Script for re-parsing when the component is rendered (especially after hydration) */}
 <Script
 id="fb-xfbml-parse"
 strategy="afterInteractive"
 dangerouslySetInnerHTML={{
 __html:`
 if (window.FB) {
 window.FB.XFBML.parse();
 }
`
 }}
 />

 <style jsx global>{`
 .fb-signup-container fb\\:login-button,
 .fb-signup-container .fb_iframe_widget {
 width: 100% !important;
 display: flex !important;
 justify-content: center !important;
 }
 .fb_iframe_widget span {
 width: 100% !important;
 }
 .fb_iframe_widget iframe {
 width: 100% !important;
 position: relative !important;
 }
`}</style>
 </div>
 )
}
