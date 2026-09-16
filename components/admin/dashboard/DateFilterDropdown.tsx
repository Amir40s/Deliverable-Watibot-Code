"use client"

import React, { useState } from "react"
import { Calendar, ChevronDown, Check, Clock, CalendarDays, History, Sparkles, X } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { type DateFilterType, type DateFilterParams, getDateBounds } from "@/lib/admin/dashboard-date-filter"

interface DateFilterDropdownProps {
    currentParams: DateFilterParams;
    onFilterChange: (params: DateFilterParams) => void;
    isLoading?: boolean;
}

export function DateFilterDropdown({ currentParams, onFilterChange, isLoading }: DateFilterDropdownProps) {
    const [open, setOpen] = useState(false)
    const [isCustomMode, setIsCustomMode] = useState(currentParams.filter === 'custom')
    const [customStart, setCustomStart] = useState(currentParams.startDate || "")
    const [customEnd, setCustomEnd] = useState(currentParams.endDate || "")

    const activeFilter = (currentParams.filter as DateFilterType) || 'all'
    const resolved = getDateBounds(currentParams)

    const presets: { id: DateFilterType; label: string; icon: any; hint: string }[] = [
        { id: 'today', label: 'Today', icon: Clock, hint: 'Since 00:00 today' },
        { id: 'yesterday', label: 'Yesterday', icon: History, hint: 'Full day yesterday' },
        { id: '7days', label: 'Last 7 Days', icon: CalendarDays, hint: 'Past 7 days rolling' },
        { id: 'all', label: 'All Time', icon: Sparkles, hint: 'Entire platform history' },
    ]

    const handleSelectPreset = (filterType: DateFilterType) => {
        setIsCustomMode(false)
        setOpen(false)
        onFilterChange({ filter: filterType })
    }

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault()
        if (!customStart) return
        setOpen(false)
        onFilterChange({
            filter: 'custom',
            startDate: customStart,
            endDate: customEnd || customStart
        })
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
                        "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all shadow-xs",
                        "flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-200",
                        isLoading && "opacity-70 pointer-events-none"
                    )}
                >
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[#00a884] flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex flex-col items-start text-left leading-none">
                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Timeframe</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                            {resolved.label}
                        </span>
                    </div>

                    <div className="hidden lg:flex items-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                        {resolved.subLabel}
                    </div>

                    <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ml-1", open && "rotate-180")} />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-72 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl"
            >
                <div className="px-3 py-2">
                    <p className="text-xs font-black text-slate-900 dark:text-white tracking-tight">Filter Analytics Window</p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">Update metrics across the dashboard</p>
                </div>

                <div className="space-y-1">
                    {presets.map((p) => {
                        const Icon = p.icon
                        const isSelected = activeFilter === p.id && !isCustomMode
                        return (
                            <DropdownMenuItem
                                key={p.id}
                                onClick={() => handleSelectPreset(p.id)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all",
                                    isSelected 
                                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-[#00a884] dark:text-[#00a884]" 
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center",
                                        isSelected ? "bg-[#00a884] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                    )}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="leading-tight">{p.label}</div>
                                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">{p.hint}</div>
                                    </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#00a884]" />}
                            </DropdownMenuItem>
                        )
                    })}
                </div>

                <DropdownMenuSeparator className="my-2 bg-slate-100 dark:bg-slate-800" />

                {/* Custom Date Range Toggle & Form */}
                <div className="p-2">
                    {!isCustomMode ? (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsCustomMode(true)
                            }}
                            className={cn(
                                "w-full justify-between rounded-xl px-3 py-2 h-auto text-xs font-bold",
                                activeFilter === 'custom'
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-[#00a884]"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 flex items-center justify-center">
                                    <Calendar className="w-3.5 h-3.5" />
                                </div>
                                <div className="text-left">
                                    <div>Custom Date Range</div>
                                    <div className="text-[10px] font-medium text-slate-400">Pick custom start & end</div>
                                </div>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                    ) : (
                        <form onSubmit={handleApplyCustom} className="space-y-3 pt-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-[#00a884]" />
                                    Custom Range
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsCustomMode(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</Label>
                                    <Input
                                        type="date"
                                        required
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="h-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 font-semibold px-2"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase">End Date</Label>
                                    <Input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="h-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 font-semibold px-2"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsCustomMode(false)}
                                    className="flex-1 h-8 rounded-lg text-xs font-bold"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="flex-1 h-8 rounded-lg text-xs font-black bg-[#00a884] hover:bg-[#009272] text-white"
                                >
                                    Apply Range
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
