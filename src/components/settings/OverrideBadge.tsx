'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Override Badge (SSOT)
// "differs-from-global / 법인 오버라이드" 표시 — wd-orange warm accent
// CEO 2026-06-12: override 상태색 = wd-orange (global=primary·custom=wd-orange·locked=muted)
// wd-orange는 override 전용 — warning(amber)·bg-warm(버튼 fill)과 공유 금지
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

interface OverrideBadgeProps {
  children: React.ReactNode
  className?: string
}

export function OverrideBadge({ children, className }: OverrideBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full bg-wd-orange-soft px-2.5 py-[3px] text-[11px] font-medium text-wd-orange-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}
