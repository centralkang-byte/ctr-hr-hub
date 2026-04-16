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
          "bg-tertiary/10 text-[#15803d] dark:text-tertiary",
        warning:
          "bg-[#b45309]/10 text-ctr-warning",
        error:
          "bg-destructive/10 text-destructive",
        info:
          "bg-primary/10 text-primary-dim",
        neutral:
          "bg-muted text-muted-foreground",
        accent:
          "bg-badge-accent/10 text-badge-accent",
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
