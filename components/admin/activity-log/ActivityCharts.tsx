'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', 
  '#ffc658', '#82ca9d', '#a4de6c', '#F17CB0', '#5DA5DA', 
  '#60BD68', '#FAA43A', '#B276B2', '#DECF3F', '#F15854'
];

export default function ActivityCharts({ logs, loading }: { logs: any[], loading: boolean }) {
  const chartData = useMemo(() => {
    if (!logs || logs.length === 0) return { volume: [], actions: [], modules: [], activeModules: [] };

    // Group by Date and Module for Volume
    const dateMap: Record<string, Record<string, number>> = {};
    const actionMap: Record<string, number> = {};
    const moduleMap: Record<string, number> = {};
    const moduleSet = new Set<string>();

    logs.forEach(log => {
      // Date string format: YYYY-MM-DD
      const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
      if (!dateMap[dateStr]) dateMap[dateStr] = {};

      const mod = log.module || 'Unknown';
      dateMap[dateStr][mod] = (dateMap[dateStr][mod] || 0) + 1;
      moduleSet.add(mod);

      actionMap[log.action] = (actionMap[log.action] || 0) + 1;
      moduleMap[mod] = (moduleMap[mod] || 0) + 1;
    });

    const volume = Object.keys(dateMap).sort().map(date => ({
      date, 
      ...dateMap[date]
    }));

    const actions = Object.keys(actionMap).map(action => ({
      name: action, value: actionMap[action]
    })).sort((a, b) => b.value - a.value);

    const modules = Object.keys(moduleMap).map(mod => ({
      name: mod, value: moduleMap[mod]
    })).sort((a, b) => b.value - a.value);

    const activeModules = Array.from(moduleSet).sort((a, b) => moduleMap[b] - moduleMap[a]);

    return { volume, actions, modules, activeModules };
  }, [logs]);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-slate-500 text-sm font-medium">
        Loading charts data...
      </div>
    );
  }

  if (chartData.volume.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-slate-500 text-sm font-medium">
        No data available for charts in the last 30 days.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Activity Volume Over Time */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          <h3 className="font-bold text-[13px] text-slate-900 mb-4">Activity Volume (Last 30 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.volume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  shared={false}
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                {chartData.activeModules.map((mod, index) => (
                  <Bar key={mod} dataKey={mod} stackId="a" fill={COLORS[index % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Actions Distribution */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <h3 className="font-bold text-[13px] text-slate-900 mb-4">Actions Distribution</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.actions}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.actions.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Module Usage */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <h3 className="font-bold text-[13px] text-slate-900 mb-4">Module Usage</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.modules}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  >
                    {chartData.modules.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
