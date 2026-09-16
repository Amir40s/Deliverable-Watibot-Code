"use client"

import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface MiniSparklineProps {
 data: { value: number }[]
 color: string
}

export function MiniSparkline({ data, color }: MiniSparklineProps) {
 return (
 <div className="h-16 min-h-16 w-full min-w-0 relative">
 <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={48} debounce={50}>
 <AreaChart data={data}>
 <defs>
 <linearGradient id={`gradient-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={color} stopOpacity={0.4} />
 <stop offset="100%" stopColor={color} stopOpacity={0} />
 </linearGradient>
 </defs>
 <Area
 type="monotone"
 dataKey="value"
 stroke={color}
 strokeWidth={2}
 fill={`url(#gradient-${color.replace('#','')})`}
 isAnimationActive={true}
 animationDuration={1500}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 )
}
