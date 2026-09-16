import { Metadata } from "next"
import { getAdminStaffUsers, getAllVendorsForPicker } from "@/app/[locale]/admin/staff/actions"
import UserVendorPageClient from "@/components/admin/settings/UserVendorPageClient"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "User & Vendor Governance | Admin Configurations",
  description: "Manage admin staff permissions and vendor registration settings",
}

export default async function UserVendorSettingsPage() {
  const [staffRes, vendorRes] = await Promise.all([
    getAdminStaffUsers(),
    getAllVendorsForPicker(),
  ])

  return (
    <UserVendorPageClient
      initialStaff={staffRes.users || []}
      availableVendors={vendorRes.vendors || []}
    />
  )
}
