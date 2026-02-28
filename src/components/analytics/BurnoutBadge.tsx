'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Burnout Risk Badge
// WARNING / CRITICAL 뱃지
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils'

interface BurnoutBadgeProps {
  isCritical: boolean
}

export function BurnoutBadge({ isCritical }: BurnoutBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isCritical
          ? 'border border-red-200 bg-red-50 text-red-700'
          : 'border border-orange-200 bg-orange-50 text-orange-700',
      )}
    >
      {isCritical ? 'CRITICAL' : 'WARNING'}
    </span>
  )
}
