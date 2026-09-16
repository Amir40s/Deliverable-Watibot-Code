"use client"

import React, { useMemo } from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { createTheme, ThemeProvider } from "@mui/material/styles"
import { useTheme } from "next-themes"
import type { ChartDataPoint } from "@/app/[locale]/dashboard/actions"

export type MuiStackedAreaChartProps = {
 data: ChartDataPoint[]
}

function formatAxisValue(value: number) {
 if (value >= 1000000) return`${(value / 1000000).toFixed(1)}M`
 if (value >= 1000) return`${(value / 1000).toFixed(0)}K`
 return String(value)
}

/** Single-series area chart: users (contacts) created per month, last 12 months */
export default function MuiStackedAreaChart({ data }: MuiStackedAreaChartProps) {
 const { resolvedTheme } = useTheme()
 const isDark = resolvedTheme === "dark"

 const muiTheme = useMemo(
 () =>
 createTheme({
 palette: { mode: isDark ? "dark" : "light" },
 typography: { fontFamily: "inherit" },
 }),
 [isDark]
 )

 const months = data.length > 0 ? data.map((d) => d.month) : ["—"]
 const countData = data.length > 0 ? data.map((d) => d.count) : [0]

 const margin = { top: 20, right: 20, bottom: 40, left: 50 }

 const axisColor = isDark ? "#94a3b8" : "#64748b"
 const axisLineColor = isDark ? "#475569" : "#cbd5e1"
 const gridColor = isDark ? "rgba(71, 85, 105, 0.4)" : "rgba(203, 213, 225, 0.8)"

 return (
 <ThemeProvider theme={muiTheme}>
 <div
 className="h-full w-full rounded-2xl"
 style={{ backgroundColor: isDark ? undefined : "#ffffff" }}
 >
 <div
 className="h-full w-full"
 style={
 isDark
 ? undefined
 : {
 ["--MuiChartsAxis-tickLabelFill" as string]: axisColor,
 ["--MuiChartsAxis-tickStroke" as string]: axisLineColor,
 }
 }
 >
 <LineChart
 width={undefined}
 height={320}
 margin={margin}
 grid={{ vertical: false, horizontal: false }}
 series={[
 {
 data: countData,
 label: "Users created",
 area: true,
 showMark: true,
 color: "#00D2FF",
 curve: "monotoneX",
 },
 ]}
 xAxis={[
 {
 scaleType: "point",
 data: months,
 tickLabelStyle: { fill: axisColor, fontSize: 11, fontWeight: 700 },
 disableLine: true,
 disableTicks: true,
 },
 ]}
 yAxis={[
 {
 valueFormatter: formatAxisValue,
 tickLabelStyle: { fill: axisColor, fontSize: 11, fontWeight: 700 },
 disableLine: true,
 disableTicks: true,
 },
 ]}
 sx={{
 "& .MuiLineElement-root": { strokeWidth: 4, filter: "drop-shadow(0 0 8px rgba(0,210,255,0.4))" },
 "& .MuiAreaElement-root": {
 fill: "url(#neon-blue-gradient)",
 opacity: 0.2
 },
 "& .MuiChartsAxis-root line": {
 display: "none",
 },
 "& .MuiChartsAxis-tick": {
 display: "none",
 },
 }}
 >
 <defs>
 <linearGradient id="neon-blue-gradient" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#00D2FF" stopOpacity={0.8} />
 <stop offset="95%" stopColor="#00D2FF" stopOpacity={0} />
 </linearGradient>
 </defs>
 </LineChart>
 </div>
 </div>
 </ThemeProvider>
 )
}
