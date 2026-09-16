import { LucideIcon, ArrowRight, TrendingUp, TrendingDown, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { MotionCardWrapper } from "@/components/ui/motion-card-wrapper"
import { MiniSparkline } from "@/components/dashboard/MiniSparkline"

export interface OverviewCardProps {
 title: string
 value: string | number
 label?: string
 icon?: LucideIcon
 color?: string
 trend?: {
 value: string
 positive?: boolean
 }
 viewDetailsHref?: string
 viewDetailsLabel?: string
 showViewDetails?: boolean
 className?: string
 sparklineData?: { value: number }[]
}

export function OverviewCard({
 title,
 value,
 trend,
 color = "#00a884",
 icon: Icon,
 viewDetailsHref = "#",
 showViewDetails = true,
 className,
 sparklineData,
}: OverviewCardProps) {
 return (
 <MotionCardWrapper className={cn("h-full", className)}>
   <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all flex flex-col h-[170px] relative overflow-hidden group">
     
     {/* Header: Icon + Title & Badge */}
     <div className="flex justify-between items-start relative z-10 w-full mb-2">
       <div className="flex items-center gap-3">
         {Icon && (
           <div 
             className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
             style={{ backgroundColor: color + '1A', color: color }}
           >
             <Icon className="w-4 h-4" />
           </div>
         )}
         <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase truncate">
           {title}
         </span>
       </div>
       
       {trend && (
         <div 
           className="text-[9.5px] font-black px-2.5 py-1 rounded-full tracking-wider border shrink-0 shadow-sm"
           style={{ 
             backgroundColor: color + '15', 
             color: color, 
             borderColor: color + '30' 
           }}
         >
           {trend.value}
         </div>
       )}
     </div>

     {/* Value Display */}
     <div className="mt-3 flex items-baseline gap-2 z-10 relative">
       <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tight tabular-nums">
         {typeof value === 'number' ? value.toLocaleString() : value}
       </span>
       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">vs last 7 days</span>
     </div>

     {/* Sparkline Graph (Absolutely positioned to bottom) */}
     {sparklineData ? (
       <div className="absolute bottom-0 left-0 right-0 h-[65px] z-0 opacity-90 pointer-events-none">
         <MiniSparkline data={sparklineData} color={color} />
       </div>
     ) : (
       <div className="absolute bottom-0 left-0 right-0 h-[65px] z-0" />
     )}
   </div>
 </MotionCardWrapper>
 )
}
