import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
 extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
 ({ className, ...props }, ref) => {
 return (
 <textarea
 className={cn(
 "flex min-h-[80px] w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[14px] font-semibold tracking-[-0.084px] text-foreground ring-offset-background placeholder:text-[#868685] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:shadow-[inset_0_0_0_1px_rgb(134,134,133)] disabled:cursor-not-allowed disabled:opacity-50",
 className
 )}
 ref={ref}
 {...props}
 />
 )
 }
)
Textarea.displayName = "Textarea"

export { Textarea }
