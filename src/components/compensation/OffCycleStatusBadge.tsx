'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Status Badge
// Off-Cycle 보상 요청 상태 뱃지
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { STATUS_VARIANT, type StatusVariant } from '@/lib/styles/status'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type OffCycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

interface OffCycleStatusBadgeProps {
  status: OffCycleStatus
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_VARIANT_MAP: Record<OffCycleStatus, StatusVariant> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'neutral',
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleStatusBadge({ status, className }: OffCycleStatusBadgeProps) {
  const t = useTranslations('compensation')
  const variant = STATUS_VARIANT_MAP[status] ?? 'neutral'
  const label = t(`offCycle.status.${status}`)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
        STATUS_VARIANT[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}
