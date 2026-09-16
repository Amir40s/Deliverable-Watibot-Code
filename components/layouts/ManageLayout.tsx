"use client"

import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { cn } from "@/lib/utils"

interface ManageLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  contentClassName?: string
}
export default function ManageLayout({ children, title, description, contentClassName }: ManageLayoutProps) {
  return (
    <DashboardLayoutClient 
      mainFullBleed 
      mainClassName="flex h-full overflow-hidden"
    >
       <div className={`flex-1 flex flex-col min-w-0 bg-[#F9FAFB] dark:bg-[#06090F] overflow-y-auto ${contentClassName || ""}`}>
        <div className={cn("p-8 mx-auto w-full", !contentClassName?.includes('max-w-') && "max-w-5xl")}>
          
          {(title || description) && (
            <div className="mb-8">
              {title && <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 ">{title}</h1>}
              {description && <p className="text-sm font-medium text-gray-500 dark:text-gray-400 ">{description}</p>}
            </div>
          )}
          
          {children}
        </div>
      </div>
    </DashboardLayoutClient>
  )
}

