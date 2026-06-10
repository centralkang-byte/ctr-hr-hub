import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Wave 0: proto .chip 정렬 (styles.css:1259) — 11px/500, pad 3x10
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border-0 px-2.5 py-[3px] text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary-container/30 text-primary",
        secondary:
          "bg-muted text-muted-foreground",
        destructive:
          "bg-destructive/10 text-[#b71824] dark:text-destructive",
        outline: "border border-border text-foreground",
        // dark:text-tertiary는 Violet 다크 팔레트 잔존 — Phase 4b 다크 재설계 시 ink 일원화
        success:
          "bg-tertiary/10 text-[#006b39] dark:text-tertiary",
        warning:
          "bg-[#b45309]/10 text-ctr-warning",
        error:
          "bg-destructive/10 text-[#b71824] dark:text-destructive",
        info:
          "bg-wt-7/10 text-wt-7 dark:bg-primary/10 dark:text-primary-dim",
        neutral:
          "bg-muted text-muted-foreground",
        accent:
          "bg-wt-4/10 text-wt-4 dark:bg-badge-accent/10 dark:text-badge-accent",
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
