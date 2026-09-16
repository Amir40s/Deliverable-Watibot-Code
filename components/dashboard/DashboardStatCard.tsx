"use client"

import type * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MiniSparkline } from "./MiniSparkline"

interface DashboardStatCardProps {
  label: string
  title: string
  value: string | number
  icon: LucideIcon
  color: "emerald" | "blue" | "purple" | "indigo" | "orange" | "rose" | "slate"
  sparklineData?: { value: number }[]
  onClick?: () => void
  className?: string
}

export function DashboardStatCard({
  label,
  title,
  value,
  icon: Icon,
  color = "emerald",
  sparklineData,
  onClick,
  className,
}: DashboardStatCardProps) {
  const colorVariants = {
    emerald: "hover:border-primary/50 dark:hover:border-primary/30 focus-within:ring-primary/20",
    blue: "hover:border-blue-200 dark:hover:border-blue-800 focus-within:ring-blue-500/20",
    purple: "hover:border-purple-200 dark:hover:border-purple-800 focus-within:ring-purple-500/20",
    indigo: "hover:border-indigo-200 dark:hover:border-indigo-800 focus-within:ring-indigo-500/20",
    orange: "hover:border-orange-200 dark:hover:border-orange-800 focus-within:ring-orange-500/20",
    rose: "hover:border-rose-200 dark:hover:border-rose-800 focus-within:ring-rose-500/20",
    slate: "hover:border-slate-200 dark:hover:border-slate-800 focus-within:ring-slate-500/20",
  }

  const sparklineColors = {
    emerald: "#00B074",
    blue: "#3B82F6",
    purple: "#A855F7",
    indigo: "#6366F1",
    orange: "#F97316",
    rose: "#F43F5E",
    slate: "#64748b",
  }

  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative h-48 transition-all hover:shadow-xl hover:-translate-y-1 group overflow-hidden cursor-default",
        onClick && "cursor-pointer",
        colorVariants[color],
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground mb-1">
            {label}
          </span>
          <CardTitle
            className={cn(
              "text-lg font-bold tracking-tight text-foreground leading-none",
              onClick && "group-hover:text-primary transition-colors"
            )}
          >
            {title}
          </CardTitle>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
          <Icon className="w-5 h-5 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-[32px] font-black tracking-tight dark:text-white",
            value === "standard" ? "text-[#0e3e1a] lowercase" : "text-slate-800"
          )}>
            {value}
          </span>
        </div>
        {sparklineData && (
          <div className="h-14 w-full mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <MiniSparkline data={sparklineData} color={sparklineColors[color]} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
