"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface SparklineProps {
 data: number[]
 color?: string
 height?: number
 width?: number
 className?: string
}

export function Sparkline({
 data,
 color = "#10b981",
 height = 40,
 width = 120,
 className
}: SparklineProps) {
 const id = React.useId().replace(/:/g, "")
 if (!data || data.length < 2) return null

 const min = Math.min(...data)
 const max = Math.max(...data)
 const range = (max - min) || 1

 const points = data.map((val, i) => {
 const x = (i / (data.length - 1)) * width
 const y = height - ((val - min) / range) * height
 return`${x},${y}`
 }).join(" ")

 return (
 <svg
 width={width}
 height={height}
 viewBox={`0 0 ${width} ${height}`}
 className={cn("overflow-visible", className)}
 preserveAspectRatio="none"
 >
 <defs>
 <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={color} stopOpacity="0.2" />
 <stop offset="100%" stopColor={color} stopOpacity="0" />
 </linearGradient>
 </defs>

 {/* Area */}
 <path
 d={`M 0,${height} L ${points} L ${width},${height} Z`}
 fill={`url(#gradient-${id})`}
 className="transition-all duration-700 ease-in-out"
 />

 {/* Line */}
 <polyline
 fill="none"
 stroke={color}
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 points={points}
 className="transition-all duration-700 ease-in-out"
 />
 </svg>
 )
}
