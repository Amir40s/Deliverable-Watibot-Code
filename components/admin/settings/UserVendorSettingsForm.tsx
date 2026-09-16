"use client"

import { useState, useEffect } from "react"
import { 
  UserPlus, 
  Settings2,
  Loader2,
  Mail,
  Zap,
  MailOpen,
  CheckCircle2,
  Save
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import WatiBotLoader from "@/components/WatiBotLoader"

const SegmentedCard = ({ title, description, checked, onChange, icon: Icon }: any) => (
  <button
    onClick={onChange}
    className={cn(
      "flex flex-col text-left p-5 rounded-2xl border-2 transition-all duration-200 flex-1 relative overflow-hidden group outline-none",
      checked 
        ? "border-[#00a884] bg-[#00a884]/5 ring-4 ring-[#00a884]/10" 
        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-[#00a884]/40"
    )}
  >
    {checked && (
      <div className="absolute top-4 right-4 text-[#00a884]">
        <CheckCircle2 size={22} className="fill-[#00a884]/20" />
      </div>
    )}
    <div className={cn(
      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
      checked ? "bg-[#00a884]/10 text-[#00a884]" : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
    )}>
      <Icon size={22} />
    </div>
    <h4 className={cn("font-bold mb-1.5", checked ? "text-[#00a884]" : "text-slate-900 dark:text-white")}>{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{description}</p>
  </button>
)

export default function UserVendorSettingsForm() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [initialSettings, setInitialSettings] = useState<any>(null)
  const [settings, setSettings] = useState({
    enableVendorRegistration: true,
    vendorEmailActivation: false,
    sendWelcomeEmail: false,
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/configurations/users')
        if (response.ok) {
          const data = await response.json()
          const loadedSettings = {
            enableVendorRegistration: Boolean(data.enableVendorRegistration ?? true),
            vendorEmailActivation: Boolean(data.vendorEmailActivation ?? false),
            sendWelcomeEmail: Boolean(data.sendWelcomeEmail ?? false),
          }
          setSettings(loadedSettings)
          setInitialSettings(loadedSettings)
        }
      } catch (error) {
        console.error("Error fetching settings:", error)
        toast.error("Failed to load settings")
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const hasChanges = initialSettings && JSON.stringify(initialSettings) !== JSON.stringify(settings)

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const handleSave = async () => {
    if (!hasChanges) return
    setIsSaving(true)
    const toastId = toast.loading("Saving settings...")
    try {
      const response = await fetch('/api/admin/configurations/users', {
        method:'POST',
        headers: {'Content-Type':'application/json' },
        body: JSON.stringify(settings)
      })

      if (!response.ok) throw new Error('Failed to save settings')
      
      setInitialSettings(settings)
      toast.success("Settings saved successfully", { id: toastId })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <WatiBotLoader fullScreen={true} />;
  }

  return (
    <div className="animate-in fade-in duration-500 w-full plus-jakarta-forced">
      
      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        
        {/* Settings Card Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-12 h-12 rounded-xl bg-[#00a884]/10 flex items-center justify-center text-[#00a884]">
            <UserPlus size={24} />
          </div>
          <div>
            <h3 className="text-slate-900 dark:text-white font-black text-lg tracking-tight">Registration Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Control how new vendors can create and access their accounts.</p>
          </div>
        </div>

        {/* Settings Card Body */}
        <div className="p-8 space-y-10">
          
          {/* Allow Public Sign-up */}
          <div className="flex items-start justify-between gap-6 pb-8 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex gap-4">
              <div className="mt-1">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <Settings2 size={20} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Allow Public Sign-up</h4>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border",
                    settings.enableVendorRegistration 
                      ? "text-[#00a884] border-[#00a884]/20 bg-[#00a884]/10"
                      : "text-slate-500 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                  )}>
                    {settings.enableVendorRegistration ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Let new vendors create an account without administrator assistance.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-2">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.enableVendorRegistration}
                onChange={(e) => setSettings({ ...settings, enableVendorRegistration: e.target.checked })}
              />
              <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884] peer-checked:after:border-transparent" />
            </label>
          </div>

          <div className={cn(
            "space-y-10 transition-all duration-300",
            !settings.enableVendorRegistration && "opacity-50 pointer-events-none grayscale-[0.5]"
          )}>
            
            {/* Verification Logic */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Account Activation</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Choose how accounts are activated after a user signs up.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <SegmentedCard 
                  title="Email Verification"
                  description="Users receive an activation email before they can access their account."
                  icon={Mail}
                  checked={settings.vendorEmailActivation}
                  onChange={() => setSettings({ ...settings, vendorEmailActivation: true })}
                />
                <SegmentedCard 
                  title="Instant Access"
                  description="Users can access their account immediately after registration."
                  icon={Zap}
                  checked={!settings.vendorEmailActivation}
                  onChange={() => setSettings({ ...settings, vendorEmailActivation: false })}
                />
              </div>
              <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-[#e6f4ee]/50 dark:bg-[#00a884]/10 rounded-xl border border-[#00a884]/20">
                <CheckCircle2 size={16} className="text-[#00a884] shrink-0" />
                <p className="text-sm text-[#00a884] font-medium">
                  {settings.vendorEmailActivation 
                    ? "New users must verify their email address before they can sign in." 
                    : "New users will bypass email verification and sign in directly."}
                </p>
              </div>
            </div>

            {/* Welcome Email */}
            <div className="flex items-start justify-between gap-6 pt-8 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex gap-4">
                <div className="mt-1">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <MailOpen size={20} />
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Welcome Email</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Automatically send a welcome email after a successful registration.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-2">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.sendWelcomeEmail}
                  disabled={!settings.enableVendorRegistration}
                  onChange={(e) => setSettings({ ...settings, sendWelcomeEmail: e.target.checked })}
                />
                <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884] peer-checked:after:border-transparent" />
              </label>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {hasChanges ? "You have unsaved changes." : "All settings are up to date."}
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="flex items-center justify-center gap-2 h-11 px-6 bg-[#00a884] hover:bg-[#009676] text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-[#00a884]/20 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
