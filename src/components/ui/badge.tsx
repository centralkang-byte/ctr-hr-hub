import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[4px] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#5E81F4] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#5E81F4]/10 text-[#5E81F4]",
        secondary:
          "border-[#F0F0F3] bg-[#F5F5FA] text-[#8181A5]",
        destructive:
          "border-transparent bg-[#FF808B]/20 text-[#E11D48]",
        outline: "border-[#F0F0F3] text-[#1C1D21]",
        success:
          "border-transparent bg-[#7CE7AC]/20 text-[#059669]",
        warning:
          "border-transparent bg-[#F4BE5E]/20 text-[#B45309]",
        danger:
          "border-transparent bg-[#FF808B]/20 text-[#E11D48]",
        info:
          "border-transparent bg-[#5E81F4]/10 text-[#5E81F4]",
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
