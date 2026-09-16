import type React from "react"
import { Zap, ShieldCheck, Globe, CheckCircle2 } from "lucide-react"

interface AuthPageWrapperProps {
  children: React.ReactNode
  heroTitle?: React.ReactNode
  heroDescription?: string
}

export function AuthPageWrapper({ 
  children, 
  heroTitle = (
    <>
      Money moves. <br />
      <span className="text-wise-green">Growth stays.</span>
    </>
  ),
  heroDescription = "The world's most international WhatsApp CRM. Automated support, high-performance marketing, and seamless integrations."
}: AuthPageWrapperProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden antialiased">
      {/* Background Blobs (Optional for extra flair) */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-wise-green/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-wise-green/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left Side: Brand & Social Proof */}
        <div className="hidden lg:flex flex-col space-y-12 pr-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-wise-green flex items-center justify-center shadow-ring">
              <span className="text-wise-green-dark font-bold text-3xl">W</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-4xl font-bold text-foreground tracking-tighter">Watibot</h1>
              <span className="text-xs font-bold text-wise-green-dark uppercase tracking-widest">Enterprise CRM Suite</span>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="wise-display-hero text-foreground">
              {heroTitle}
            </h2>
            <p className="wise-body text-muted-foreground max-w-md">
              {heroDescription}
            </p>
          </div>

          {/* Modern Feature Icons */}
          <div className="grid grid-cols-2 gap-8">
            {[
              { icon: Zap, label: "Instant Flows" },
              { icon: ShieldCheck, label: "Meta Verified" },
              { icon: Globe, label: "Global Scale" },
              { icon: CheckCircle2, label: "99.9% Uptime" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-wise-light-mint flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-wise-green-dark" />
                </div>
                <div className="text-sm font-bold text-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Form Content */}
        <div className="flex justify-center lg:justify-end w-full">
          {children}
        </div>
      </div>
    </div>
  )
}
