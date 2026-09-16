"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MotionCardWrapperProps {
 children: React.ReactNode
 className?: string
}

/** Wraps card content and lifts slightly on hover. Use inside Server Components. */
export function MotionCardWrapper({ children, className }: MotionCardWrapperProps) {
 return (
 <motion.div
 className={cn("h-full", className)}
 whileHover={{ y: -6 }}
 transition={{ type: "spring", stiffness: 400, damping: 25 }}
 >
 {children}
 </motion.div>
 )
}
