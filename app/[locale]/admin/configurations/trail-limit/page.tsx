"use client"

import { useState, useEffect } from "react"
import { 
  Loader2, 
  Clock,
  Check,
  Users,
  Search,
  ChevronRight,
  ShieldCheck,
  UserCheck
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import VendorDetailsSheet from "@/components/admin/vendors/VendorDetailsSheet"
import { Badge } from "@/components/ui/badge"
import WatiBotLoader from "@/components/WatiBotLoader"

export default function TrialLimitPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [trialLimitDays, setTrialLimitDays] = useState(15)
  const [trialUsers, setTrialUsers] = useState<any[]>([])
  
  // Modal states
  const [selectedVendor, setSelectedVendor] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/configurations/trial-limit')
      if (response.ok) {
        const data = await response.json()
        setTrialLimitDays(data.trialLimitDays ?? 15)
        setTrialUsers(data.trialUsers || [])
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      toast.error("Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    const toastId = toast.loading("Saving settings...")
    try {
      const response = await fetch('/api/admin/configurations/trial-limit', {
        method:'POST',
        headers: {'Content-Type':'application/json' },
        body: JSON.stringify({ trialLimitDays })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to save settings')
      }
      
      toast.success("Trial limit updated successfully", { id: toastId })
      fetchSettings()
    } catch (error: any) {
      console.error("Error saving settings:", error)
      toast.error(error.message || "Failed to save settings", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const handleViewVendor = (user: any) => {
    if (!user.vendor) {
      toast.error("Vendor details not found for this user")
      return
    }
    setSelectedVendor(user.vendor)
    setIsDetailsOpen(true)
  }

  // Generate dynamic initials for the initial avatar
  const getInitials = (name: string) => {
    if (!name) return "VN"
    const parts = name.split(" ")
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  if (isLoading) {
    return <WatiBotLoader />;
  }

  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#fafbfc] dark:bg-slate-950 min-h-screen transition-colors duration-300 relative overflow-hidden plus-jakarta-forced">
      
     
      {/* Content Section */}
      <div className="relative z-10 w-full px-8 py-8 max-w-[1300px] space-y-8">
        
        

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Settings Card */}
          <div className="lg:col-span-4 h-full">
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800/40 shadow-sm transition-all duration-300 overflow-hidden flex flex-col h-full">
              
              <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                    <Clock size={16} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">
                    Trial Duration
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Global Limit (Days)
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={trialLimitDays}
                      onChange={(e) => setTrialLimitDays(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
                      className="w-full h-12 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-2xl px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884]/30 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none pr-12"
                      placeholder="15"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pointer-events-none">
                      Days
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 w-full h-12 bg-[#00a884] hover:bg-[#008f70] text-white rounded-2xl text-xs font-black tracking-wider shadow-lg shadow-[#00a884]/10 transition-all active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Apply Limit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Monitor Accounts */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800/40 shadow-sm transition-all duration-300 overflow-hidden">
              
              <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#e6f4ee] dark:bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                    <Users size={16} />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">
                    Active Trials Monitor
                  </h3>
                </div>
                <Badge variant="outline" className="bg-[#e6f4ee] dark:bg-[#00a884]/15 text-[#00a884] border-transparent text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl shadow-inner border-0">
                  {trialUsers.length} Testing Accounts
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800/40 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <th className="px-6 py-4 text-left">Identity</th>
                      <th className="px-6 py-4 text-left">Timeline</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {trialUsers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-3 grayscale opacity-30">
                            <Clock size={40} className="text-[#00a884]" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">No active trials detected</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      trialUsers.map((user) => (
                        <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              
                              {/* Initials avatar circle */}
                              <div className="w-10 h-10 rounded-xl bg-[#e6f4ee] dark:bg-[#00a884]/15 text-[#00a884] font-black text-xs flex items-center justify-center uppercase tracking-wider shadow-inner select-none">
                                {getInitials(user.name || user.email)}
                              </div>
                              
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.name || 'Anonymous Vendor'}</span>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide">{user.email}</span>
                              </div>

                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2 max-w-[160px]">
                              <div className="flex justify-between items-end">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                                  user.daysRemaining > 5 
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15" 
                                    : "bg-rose-500/10 text-rose-600 border-rose-500/15"
                                )}>
                                  {user.daysRemaining}d left
                                </span>
                                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500">{user.percentUsed}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all duration-1000",
                                    user.percentUsed > 80 
                                      ? "bg-rose-500" 
                                      : "bg-[#00a884]"
                                  )}
                                  style={{ width: `${user.percentUsed}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleViewVendor(user)}
                              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-[#00a884] hover:text-white dark:hover:bg-[#00a884] dark:hover:text-white hover:border-[#00a884] transition-all text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-800/80 active:scale-95 shadow-sm"
                            >
                              Inspect
                              <ChevronRight size={12} className="stroke-[2.5]" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Vendor Details Modal */}
      {selectedVendor && (
        <VendorDetailsSheet
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false)
            fetchSettings()
          }}
          vendor={selectedVendor}
        />
      )}

    </div>
  )
}
