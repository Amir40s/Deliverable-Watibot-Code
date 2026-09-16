import type React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AuthCardProps {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function AuthCard({ title, description, children, footer, className }: AuthCardProps) {
  return (
    <Card className={cn("w-full max-w-[480px] border-border shadow-ring p-6 lg:p-8 relative overflow-hidden", className)}>
      <CardHeader className="space-y-2 pb-8 px-0">
        <CardTitle className="wise-heading-section text-foreground !text-4xl">{title}</CardTitle>
        {description && (
          <CardDescription className="wise-body text-muted-foreground !text-sm">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="flex flex-col space-y-4 pt-6 px-0 border-t border-border mt-4">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}
