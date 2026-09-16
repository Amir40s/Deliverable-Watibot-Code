"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
 isCollapsed?: boolean
}

export default function ThemeToggle({ isCollapsed }: ThemeToggleProps) {
 const { theme, setTheme } = useTheme()
 const [mounted, setMounted] = React.useState(false)
 const t = useTranslations('Sidebar');

 // Avoid hydration mismatch
 React.useEffect(() => {
 setMounted(true)
 }, [])

 if (!mounted) {
 return (
 <div className={cn(
 "w-full h-11 rounded-xl bg-white/5 animate-pulse",
 isCollapsed ? "w-11" : "w-full"
 )} />
 )
 }

 const toggleTheme = () => {
 setTheme(theme === "dark" ? "light" : "dark")
 }

 return (
 <button
 onClick={toggleTheme}
 className={cn(
 "w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200",
 "text-slate-600 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white",
 isCollapsed ? "justify-center" : ""
 )}
 title={theme === "dark" ? t('switchToLightMode', { defaultValue: "Switch to light mode" }) : t('switchToDarkMode', { defaultValue: "Switch to dark mode" })}
 >
 <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
 <Sun className={cn(
 "w-5 h-5 transition-all",
 theme === "dark" ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
 )} />
 <Moon className={cn(
 "absolute w-5 h-5 transition-all",
 theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
 )} />
 </div>
 <span className={cn(
 "ms-3 text-sm font-medium truncate transition-[opacity,width] duration-150",
 isCollapsed ? "w-0 opacity-0 ms-0 overflow-hidden" : "opacity-100"
 )}>
 {theme === "dark" ? t('lightMode', { defaultValue: "Light Mode" }) : t('darkMode', { defaultValue: "Dark Mode" })}
 </span>
 </button>
 )
}
