"use client"

import { useEffect } from'react'

interface MetaSDKProps {
 appId: string;
 version?: string;
}

declare global {
 interface Window {
 fbAsyncInit: () => void;
 FB: any;
 }
}

export default function MetaSDK({ appId, version ='v21.0' }: MetaSDKProps) {
 useEffect(() => {
 window.fbAsyncInit = function() {
 window.FB.init({
 appId: appId,
 cookie: true,
 xfbml: true,
 version: version
 });
 
 window.FB.AppEvents.logPageView(); 
 };

 (function(d, s, id){
 var js: any, fjs = d.getElementsByTagName(s)[0] as any;
 if (d.getElementById(id)) {return;}
 js = d.createElement(s); js.id = id;
 js.src = "https://connect.facebook.net/en_US/sdk.js";
 fjs.parentNode.insertBefore(js, fjs);
 }(document,'script','facebook-jssdk'));
 }, [appId, version]);

 return null;
}
