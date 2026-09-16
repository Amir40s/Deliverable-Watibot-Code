"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, indicatorClassName, value = 0, max = 100, ...props }, ref) => {
 const percentage = Math.min(Math.max(0, value), max) / (max / 100)

 return (
 <div
 ref={ref}
 role="progressbar"
 aria-valuemin={0}
 aria-valuemax={max}
 aria-valuenow={value}
 className={cn(
 "relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
 className
 )}
 {...props}
 >
  <div
    className={cn(
      "h-full w-full flex-1 bg-emerald-500 transition-all duration-300 ease-in-out",
      indicatorClassName
    )}
    style={{ transform:`translateX(-${100 - (percentage || 0)}%)` }}
  />
 </div>
 )
 }
)
Progress.displayName = "Progress"

export { Progress }
