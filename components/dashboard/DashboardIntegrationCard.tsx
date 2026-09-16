"use client"

import type * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardIntegrationCardProps {
  title: string
  description: string
  icon: LucideIcon
  color: "emerald" | "blue" | "orange" | "slate"
  isConnected: boolean
  children?: React.ReactNode
  className?: string
}

export function DashboardIntegrationCard({
  title,
  description,
  icon: Icon,
  color = "emerald",
  isConnected,
  children,
  className,
}: DashboardIntegrationCardProps) {
  const colorVariants = {
    emerald: {
      bg: "bg-emerald-50/80 dark:bg-emerald-950/20",
      border: "border-emerald-200/50 dark:border-emerald-800/30",
      iconBg: "bg-emerald-500/15",
      iconText: "text-emerald-600",
      iconBorder: "border-emerald-300/40",
      accent: "text-emerald-500/[0.08]",
    },
    blue: {
      bg: "bg-blue-50/80 dark:bg-blue-950/20",
      border: "border-blue-200/50 dark:border-blue-800/30",
      iconBg: "bg-blue-500/15",
      iconText: "text-blue-600",
      iconBorder: "border-blue-300/40",
      accent: "text-blue-400/[0.08]",
    },
    orange: {
      bg: "bg-orange-50/80 dark:bg-orange-950/20",
      border: "border-orange-200/50 dark:border-orange-800/30",
      iconBg: "bg-orange-500/15",
      iconText: "text-orange-600",
      iconBorder: "border-orange-300/40",
      accent: "text-orange-400/[0.08]",
    },
    slate: {
      bg: "bg-white dark:bg-slate-900",
      border: "border-slate-200 dark:border-slate-800",
      iconBg: "bg-slate-900/10 dark:bg-white/10",
      iconText: "text-slate-800 dark:text-white",
      iconBorder: "border-slate-900/10 dark:border-white/10",
      accent: "text-slate-900/[0.03]",
    },
  }

  const v = colorVariants[color]

  return (
    <Card
      className={cn(
        "relative group overflow-hidden backdrop-blur-xl transition-all flex flex-col justify-between p-6",
        v.bg,
        v.border,
        className
      )}
    >
      <CardHeader className="p-0 relative z-10 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform",
              v.iconBg,
              v.iconText,
              v.iconBorder
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none">
            {title}
          </CardTitle>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">{description}</p>
      </CardHeader>

      <CardContent className="p-0 mt-5 relative z-10">{children}</CardContent>

      <Icon className={cn("absolute -right-3 -bottom-3 w-24 h-24 rotate-12", v.accent)} />
    </Card>
  )
}
