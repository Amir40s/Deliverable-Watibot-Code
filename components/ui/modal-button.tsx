import React, { forwardRef } from'react';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 children: React.ReactNode;
 variant?: "primary" | "outline" | "ghost" | "danger";
 loading?: boolean;
}

export const ModalButton = forwardRef<HTMLButtonElement, ModalButtonProps>(({ 
 children, 
 variant = "primary", 
 loading = false,
 className,
 ...props
}, ref) => {
 const baseStyles = "h-11 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all focus-visible:ring-0 focus-visible:ring-offset-0 active:scale-95 px-6 flex items-center justify-center";
 
 const variants = {
  primary: "bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none border-none",
 outline: "border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 text-foreground shadow-sm",
 ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground border-none shadow-none",
 danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:pointer-events-none border-none"
 };

 return (
 <Button 
 ref={ref}
 variant="ghost" 
 className={cn(baseStyles, variants[variant], className)}
 disabled={props.disabled || loading}
 {...props}
 >
 {loading && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
 {children}
 </Button>
 );
});

ModalButton.displayName = "ModalButton";
