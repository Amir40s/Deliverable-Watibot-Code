"use client"

import { useSyncExternalStore, useEffect } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import AdminSidebar from "@/components/admin/Sidebar"
import AdminHeader from "@/components/admin/Header"

const localizedAdminPathPattern = /^\/(en|ur|hi|ar|bn)(?=\/|$)/
const sidebarStorageKey = "adminSidebarCollapsed"
const sidebarChangeEvent = "adminSidebarCollapsedChange"

function getStoredSidebarState() {
  if (typeof window === "undefined") return true
  const savedState = window.localStorage.getItem(sidebarStorageKey)
  return savedState === null ? true : savedState !== "false"
}

function subscribeToSidebarState(callback: () => void) {
  if (typeof window === "undefined") return () => {}

  window.addEventListener("storage", callback)
  window.addEventListener(sidebarChangeEvent, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(sidebarChangeEvent, callback)
  }
}

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarState,
    getStoredSidebarState,
    () => true
  )
  const pathname = usePathname()
  const normalizedPathname = pathname.replace(localizedAdminPathPattern, "")
  const showHeader = normalizedPathname.startsWith("/admin")

  useEffect(() => {
    document.body.classList.remove('sidebar-open')
  }, [pathname])

  const toggleSidebar = () => {
    const newState = !isCollapsed
    localStorage.setItem(sidebarStorageKey, String(newState))
    window.dispatchEvent(new Event(sidebarChangeEvent))
  }

  return (
    <div className="h-dvh bg-[#F4F6F9] dark:bg-[#0B0F1A] transition-colors duration-300 relative overflow-hidden text-slate-900 dark:text-slate-100 plus-jakarta-forced admin-layout">
      <AdminSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      
      <div 
        className={cn(
          "flex flex-col h-full transition-[margin-left] duration-150 ease-out",
          isCollapsed ? "ml-0 md:ml-20" : "ml-0 md:ml-64",
          "max-md:ml-0"
        )}
      >
        {showHeader && <AdminHeader />}
        <main className="flex-1 relative z-10 px-6 py-4 full-width-admin w-full overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth overscroll-y-contain">
          {children}
        </main>
      </div>
    </div>
  )
}
