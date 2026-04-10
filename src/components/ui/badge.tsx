import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border-0 px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary-container/30 text-primary",
        secondary:
          "bg-muted text-muted-foreground",
        destructive:
          "bg-destructive/10 text-destructive",
        outline: "border border-border/15 text-foreground",
        success:
          "bg-[#16a34a]/10 text-[#15803d]",
        warning:
          "bg-[#b45309]/10 text-[#b45309]",
        error:
          "bg-[#e11d48]/10 text-[#e11d48]",
        info:
          "bg-[#6366f1]/10 text-[#4f46e5]",
        neutral:
          "bg-[#f1f5f9] text-[#64748b]",
        accent:
          "bg-[#7c3aed]/10 text-[#7c3aed]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "error" | "info" | "neutral" | "accent"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
