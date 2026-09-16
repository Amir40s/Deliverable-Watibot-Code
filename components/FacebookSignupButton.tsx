"use client"

import React, { useEffect, useCallback } from'react'
import { Button } from "@/components/ui/button"
import { Smartphone, ArrowRight } from "lucide-react"
import { toast } from'sonner'

interface FacebookSignupButtonProps {
 appId: string;
 configId: string;
 onSuccess: (accessToken: string) => void;
}

export default function FacebookSignupButton({ appId, configId, onSuccess }: FacebookSignupButtonProps) {
 
 const handleLoginCallback = useCallback((response: any) => {
 console.log('FB Login Response:', response);
 if (response.status ==='connected') {
 const accessToken = response.authResponse.accessToken;
 onSuccess(accessToken);
 } else {
 toast.error("Facebook login failed or was cancelled.");
 }
 }, [onSuccess]);

 const launchWhatsAppSignup = () => {
 // Check if FB is loaded
 if (!window.FB) {
 toast.error("Facebook SDK not loaded yet. Please try again in a moment.");
 return;
 }

 window.FB.login((response: any) => {
 handleLoginCallback(response);
 }, {
 config_id: configId, // This is for the Embedded Signup flow
 response_type:'code',
 override_default_response_type: true,
 extras: {
 setup: {
 // You can add extra setup parameters here if needed
 }
 }
 });
 };

 return (
 <Button 
 onClick={launchWhatsAppSignup}
 className="w-full h-16 bg-[#00B074] hover:bg-emerald-700 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-[#00B074]/20 active:scale-95 transition-all flex items-center justify-center gap-3 group"
 >
 Link WhatsApp via Meta
 <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
 </Button>
 );
}
