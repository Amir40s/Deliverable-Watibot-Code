import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const pillButtonVariants = {
 default:
 "bg-white border border-[rgba(14,15,12,0.12)] text-[#0e0f0c] shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px]",
 primary:
 "bg-[#00B074] border-[#00B074] text-white shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px] border",
 success:
 "bg-[#e2f6d5] text-[#054d28] border-transparent shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px]",
 /** Same dark teal as admin sidebar (#00B074) */
 sidebar:
 "bg-[#0e0f0c] text-white border-transparent shadow-[rgba(14,15,12,0.12)_0px_0px_0px_1px]",
 outline:
 "bg-[rgba(22,51,0,0.08)] border border-transparent text-[#0e0f0c]",
}

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 /** Optional Lucide icon shown before the label */
 icon?: LucideIcon
 /** Button label (alternative to children) */
 label?: string
 /** Visual variant. Default: "default" (white/gray pill) */
 variant?: keyof typeof pillButtonVariants
 /** Optional class for the root element */
 className?: string
}

/**
 * Pill-shaped button with optional icon. Matches the Minto/dashboard action button style.
 *
 * @example
 * <PillButton icon={ArrowUp} label="Withdraw" />
 * <PillButton icon={ArrowDown} label="Deposit" variant="default" />
 * <PillButton label="New transaction" variant="primary" />
 */
const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
 ({ icon: Icon, label, variant = "default", className, children, ...props }, ref) => {
 const content = label ?? children
 return (
 <button
 ref={ref}
 type="button"
 className={cn(
 "flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-transform duration-200 ease-out text-sm border hover:scale-[1.05] active:scale-[0.95]",
 pillButtonVariants[variant],
 className
 )}
 {...props}
 >
 {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />}
 {content}
 </button>
 )
 }
)
PillButton.displayName = "PillButton"

export { PillButton, pillButtonVariants }
