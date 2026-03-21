'use client'

import { cn } from '@/lib/utils'

interface StickyActionBarProps {
  children: React.ReactNode
  className?: string
}

export default function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-6 mt-6 px-6 py-4',
        'flex items-center justify-end gap-3',
        'bg-white/80 backdrop-blur-sm border-t border-gray-200',
        'dark:bg-gray-900/80 dark:border-gray-700',
        className
      )}
    >
      {children}
    </div>
  )
}
