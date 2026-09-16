import { getAdminStaffUsers, getAllVendorsForPicker } from "./actions"
import AdminStaffClient from "@/components/admin/staff/AdminStaffClient"
import { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin Staff & Role Permissions | Admin Control Panel",
  description: "Enterprise Role-Based Access Control (RBAC) & Granular Scoping",
}

export default async function AdminStaffPage() {
  const [staffRes, vendorRes] = await Promise.all([
    getAdminStaffUsers(),
    getAllVendorsForPicker(),
  ])

  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#F4F6F9] dark:bg-slate-950 min-h-screen flex flex-col plus-jakarta-forced">
      <AdminStaffClient
        initialStaff={staffRes.users || []}
        availableVendors={vendorRes.vendors || []}
      />
    </div>
  )
}
