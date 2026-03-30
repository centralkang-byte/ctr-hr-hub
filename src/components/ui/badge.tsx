import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
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
          "bg-tertiary-container/30 text-on-tertiary-container",
        warning:
          "bg-amber-50 text-amber-700",
        danger:
          "bg-destructive/10 text-destructive",
        info:
          "bg-primary-container/30 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "danger" | "info"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
