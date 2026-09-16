"use client"

import React, { useMemo } from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { createTheme, ThemeProvider } from "@mui/material/styles"
import { useTheme } from "next-themes"
import type { TodayMessagesChartPoint } from "@/app/[locale]/dashboard/actions"

export type MuiTodayMessagesChartProps = {
 data: TodayMessagesChartPoint[]
}

/** Two-series line chart: messages sent and received per hour today */
export default function MuiTodayMessagesChart({ data }: MuiTodayMessagesChartProps) {
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

 const hours = data.length > 0 ? data.map((d) => d.hour) : ["—"]
 const sentData = data.length > 0 ? data.map((d) => d.sent) : [0]
 const receivedData = data.length > 0 ? data.map((d) => d.received) : [0]

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
 height={280}
 margin={margin}
 grid={{ vertical: false, horizontal: false }}
 series={[
 {
 data: sentData,
 label: "Sent",
 area: true,
 showMark: true,
 color: "#10b981",
 curve: "monotoneX",
 },
 {
 data: receivedData,
 label: "Received",
 area: true,
 showMark: true,
 color: "#00D2FF",
 curve: "monotoneX",
 },
 ]}
 xAxis={[
 {
 scaleType: "point",
 data: hours,
 tickLabelStyle: { fill: axisColor, fontSize: 10, fontWeight: 700 },
 tickInterval: (_, index) => index % 3 === 0,
 disableLine: true,
 disableTicks: true,
 },
 ]}
 yAxis={[
 {
 tickLabelStyle: { fill: axisColor, fontSize: 11, fontWeight: 700 },
 disableLine: true,
 disableTicks: true,
 },
 ]}
 sx={{
 "& .MuiLineElement-root": { strokeWidth: 4, filter: "drop-shadow(0 0 8px rgba(0,210,255,0.2))" },
 "& .MuiAreaElement-root": {
 fill: "url(#chart-gradient)",
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
 <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
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
