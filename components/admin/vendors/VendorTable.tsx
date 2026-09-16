"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Button } from "@/components/ui/button"
import { User, Mail, LogIn, Eye, ShieldCheck, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { signIn } from "next-auth/react"
import { impersonateUser } from "@/app/actions/impersonate"
import { useState } from "react"
import { toast } from "sonner"

export type Vendor = {
 id: string
 userId: string
 title: string
 status: string
 createdAt: string | Date
 adminName?: string
 username?: string
 email?: string
 role?: string
 adminUser?: {
 username: string
 firstName: string
 lastName: string
 email: string
 whatsappNumber?: string
 status?: string
 }
}

export const columns = (onView: (vendor: any) => void, onManagePermissions?: (vendor: any) => void): ColumnDef<Vendor>[] => [
 {
 accessorKey: "title",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="VENDOR TITLE" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => (
 <div className="flex flex-col whitespace-nowrap min-w-[200px]">
 <span className="font-bold text-slate-900 dark:text-slate-100">{row.getValue("title")}</span>
 <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">ID: {row.original.id}</span>
 </div>
 ),
 },
 {
 accessorKey: "adminName",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="USER NAME" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => (
 <div className="flex items-center gap-2 whitespace-nowrap min-w-[180px]">
 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
 <User className="h-4 w-4 text-slate-400" />
 </div>
 <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
 {row.getValue("adminName")}
 </span>
 </div>
 ),
 },
 {
 accessorKey: "username",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="USERNAME" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => (
 <span className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap tracking-tight">
 {row.getValue("username")}
 </span>
 ),
 },
 {
 accessorKey: "email",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="EMAIL" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => (
 <div className="flex items-center gap-2 text-slate-500 whitespace-nowrap min-w-[200px]">
 <Mail className="h-4 w-4 text-slate-400" />
 <span className="text-sm font-medium">{row.getValue("email")}</span>
 </div>
 ),
 },
 {
 accessorKey: "role",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="ROLE" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => {
 const role = row.getValue("role") as string
 return (
 <div className="whitespace-nowrap">
 <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">
 {role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : role === "USER" ? "User" : role || "Admin"}
 </span>
 </div>
 )
 },
 },
 {
 accessorKey: "status",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="STATUS" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => {
 const status = row.getValue("status") as string
 return (
 <div className="whitespace-nowrap">
 <Badge
 variant="secondary"
 className={cn(
 "rounded-full px-3 py-1 text-[10px] font-bold border-0 shadow-none uppercase tracking-wider",
 status === "ACTIVE"
 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
 status === "TRIAL"
 ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" :
 "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
 )}
 >
 {status}
 </Badge>
 </div>
 )
 },
 },
 {
 id: "actions",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="ACTIONS" className="whitespace-nowrap" />
 ),
 cell: ({ row }) => {
 const vendor = row.original
 const [isImpersonating, setIsImpersonating] = useState(false)

 const handleImpersonate = async () => {
 if (!vendor.userId) {
 toast.error("User ID not found for this vendor")
 return
 }

 setIsImpersonating(true)
 try {
 const result = await impersonateUser(vendor.userId)
 if (result.error) {
 toast.error(result.error)
 return
 }

    if (result.success && result.email && result.token) {
      const { getSession } = await import("next-auth/react")
      const currentSession = await getSession()
      await signIn("credentials", {
        email: result.email,
        impersonationToken: result.token,
        originalAdminId: currentSession?.user?.id || "",
        originalAdminEmail: currentSession?.user?.email || "",
        callbackUrl: "/dashboard",
        redirect: true
      })
    }
 } catch (error) {
 console.error("Impersonation failed:", error)
 toast.error("Failed to sign in as user")
 } finally {
 setIsImpersonating(false)
 }
 }

  return (
  <div className="flex items-center gap-2 whitespace-nowrap py-1">
  <Button
  variant="ghost"
  size="sm"
  className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
  onClick={() => onView(vendor)}
  title="View Details"
  >
  <Eye className="h-4 w-4 text-slate-500" />
  </Button>
  {onManagePermissions && (
    <Button
    variant="ghost"
    size="sm"
    className="h-9 w-9 p-0 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-colors"
    onClick={() => onManagePermissions(vendor)}
    title="Manage Sidebar Permissions"
    >
    <ShieldCheck className="h-4 w-4" />
    </Button>
  )}
  <Button
  variant="ghost"
  size="sm"
  disabled={isImpersonating}
  className="h-9 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold text-[11px] flex items-center gap-2 transition-all active:scale-95 border-0 shadow-none shrink-0"
  onClick={handleImpersonate}
  >
  {isImpersonating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
  {isImpersonating ? "Signing in..." : "Sign in as user"}
  </Button>
  </div>
  )
  },
  },
]

interface VendorTableProps {
 data: Vendor[]
 onView: (vendor: any) => void
 onManagePermissions?: (vendor: any) => void
}

export function VendorTable({ data, onView, onManagePermissions }: VendorTableProps) {
 return (
 <Card className="border-0 shadow-none bg-transparent">
 <CardContent className="p-0">
 <DataTable
 columns={columns(onView, onManagePermissions)}
 data={data}
 searchKey="title"
 />
 </CardContent>
 </Card>
 )
}
