"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Trigger>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
 <SelectPrimitive.Trigger
 ref={ref}
 className={cn(
 "flex h-10 w-full items-center justify-between rounded-[10px] border border-input bg-background px-3 py-2 text-[14px] font-semibold tracking-[-0.084px] text-foreground placeholder:text-[#868685] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:shadow-[inset_0_0_0_1px_rgb(134,134,133)] disabled:cursor-not-allowed disabled:opacity-50",
 className
 )}
 {...props}
 >
 {children}
 <SelectPrimitive.Icon asChild>
 <ChevronDown className="h-4 w-4 opacity-50" />
 </SelectPrimitive.Icon>
 </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Content>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-[99999] max-h-60 overflow-y-auto min-w-[8rem] rounded-[20px] border border-border bg-white dark:bg-slate-900 dark:border-slate-800 text-foreground dark:text-slate-200 shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Label>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
 <SelectPrimitive.Label
 ref={ref}
 className={cn("py-1.5 pl-8 pr-2 rtl:pr-8 rtl:pl-2 text-sm font-semibold", className)}
 {...props}
 />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-xl py-2.5 pl-8 pr-3 rtl:pr-8 rtl:pl-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none transition-colors data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-800/80 data-[state=checked]:bg-emerald-50/80 dark:data-[state=checked]:bg-emerald-950/40 data-[state=checked]:text-[#00B074] data-[state=checked]:font-bold data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2.5 rtl:left-auto rtl:right-2.5 flex h-3.5 w-3.5 items-center justify-center text-[#00B074]">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText className="w-full">{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Separator>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
 <SelectPrimitive.Separator
 ref={ref}
 className={cn("-mx-1 my-1 h-px bg-muted", className)}
 {...props}
 />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
 Select,
 SelectGroup,
 SelectValue,
 SelectTrigger,
 SelectContent,
 SelectLabel,
 SelectItem,
 SelectSeparator,
}
