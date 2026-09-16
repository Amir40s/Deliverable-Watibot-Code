"use client"

import React, { useMemo } from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { createTheme, ThemeProvider } from "@mui/material/styles"
import { useTheme } from "next-themes"
import type { ContactsThisMonthChartPoint } from "@/app/[locale]/dashboard/actions"

export type MuiContactsThisMonthChartProps = {
 data: ContactsThisMonthChartPoint[]
}

/** Single-series area chart: contacts added per day this month */
export default function MuiContactsThisMonthChart({ data }: MuiContactsThisMonthChartProps) {
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

 const days = data.length > 0 ? data.map((d) => d.day) : ["—"]
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
 height={280}
 margin={margin}
 grid={{ vertical: false, horizontal: false }}
 series={[
 {
 data: countData,
 label: "Contacts added",
 area: true,
 showMark: true,
 color: "#00D2FF",
 curve: "monotoneX",
 },
 ]}
 xAxis={[
 {
 scaleType: "point",
 data: days,
 tickLabelStyle: { fill: axisColor, fontSize: 11, fontWeight: 700 },
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
 "& .MuiLineElement-root": { strokeWidth: 4, filter: "drop-shadow(0 0 8px rgba(0,210,255,0.3))" },
 "& .MuiAreaElement-root": {
 fill: "url(#contacts-gradient)",
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
 <linearGradient id="contacts-gradient" x1="0" y1="0" x2="0" y2="1">
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
