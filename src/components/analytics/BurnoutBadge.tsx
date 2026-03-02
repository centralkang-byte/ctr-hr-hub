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
          ? 'border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]'
          : 'border border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]',
      )}
    >
      {isCritical ? 'CRITICAL' : 'WARNING'}
    </span>
  )
}
