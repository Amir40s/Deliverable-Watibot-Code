"use client"

import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const EMERALD = "#22c55e"

const defaultData = [
  { month: "Sun", count: 12000, messages: 0 },
  { month: "Mon", count: 21000, messages: 0 },
  { month: "Tue", count: 18000, messages: 0 },
  { month: "Wed", count: 25000, messages: 0 },
  { month: "Thu", count: 14000, messages: 0 },
  { month: "Fri", count: 22000, messages: 0 },
  { month: "Sat", count: 28000, messages: 0 },
]

export type DashboardChartProps = {
  data?: { month: string; count: number; messages: number }[]
}

export default function DashboardChart({ data = defaultData }: DashboardChartProps) {
  // Use defaultData if no data or dummy data for better visual match if requested
  const chartData = data && data.length > 1 ? data.map(d => ({ month: d.month.split('')[0], count: d.count, messages: d.messages })) : defaultData

  return (
    <div className="h-full w-full">
      <div className="h-[300px] w-full relative mt-4">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={EMERALD} stopOpacity={0.15} />
                <stop offset="95%" stopColor={EMERALD} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="0"
              vertical={false}
              stroke="rgba(0,0,0,0.03)"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
              dy={15}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={40}
              tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(val) => {
                if (val >= 1000) return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
                return val.toString();
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card px-3 py-2 border border-border shadow-xl rounded-xl flex flex-col items-center">
                      <p className="text-xs font-bold text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-primary">{(payload[0].value as number).toLocaleString()} messages</p>
                    </div>
                  )
                }
                return null
              }}
              cursor={{ stroke: EMERALD, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={EMERALD}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#areaGradient)"
              animationDuration={2000}
              activeDot={{
                r: 4,
                fill: EMERALD,
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function PlanDistributionChart({ data }: { data: any[] }) {
  const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]

  if (!data || data.length === 0) {
    return (
      <div className="h-[320px] w-full flex items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm font-medium">
        No plan distribution data available.
      </div>
    )
  }

  return (
    <div className="h-[320px] w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="85%"
            paddingAngle={5}
            dataKey="value"
            animationDuration={1500}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #f1f5f9",
              borderRadius: "12px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-colors hover:text-slate-900">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
