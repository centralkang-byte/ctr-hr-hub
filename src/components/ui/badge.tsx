import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[4px] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-border bg-muted text-muted-foreground",
        destructive:
          "border-transparent bg-red-50 text-red-600",
        outline: "border-border text-foreground",
        success:
          "border-transparent bg-emerald-50 text-emerald-600",
        warning:
          "border-transparent bg-amber-50 text-amber-600",
        danger:
          "border-transparent bg-red-50 text-red-600",
        info:
          "border-transparent bg-blue-50 text-blue-600",
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
