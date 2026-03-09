import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-[#F0F0F3] bg-white px-3 py-1 text-sm text-[#1C1D21] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#1C1D21] placeholder:text-[#8181A5] focus-visible:outline-none focus-visible:border-[#5E81F4] focus-visible:ring-1 focus-visible:ring-[#5E81F4] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
