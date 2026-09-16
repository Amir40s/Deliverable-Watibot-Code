import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import ProfileSettings from "@/components/admin/profile/ProfileSettings"

export default function ProfilePage() {
 return (
 <DashboardLayoutClient mainClassName="bg-[#F0F2F5] dark:bg-slate-950 p-0">
 <div className="p-0">
 <ProfileSettings />
 </div>
 </DashboardLayoutClient>
 )
}
