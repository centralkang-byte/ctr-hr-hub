'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Status Badge
// Off-Cycle 보상 요청 상태 뱃지
// ═══════════════════════════════════════════════════════════

import { STATUS_VARIANT, type StatusVariant } from '@/lib/styles/status'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type OffCycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

interface OffCycleStatusBadgeProps {
  status: OffCycleStatus
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_MAP: Record<OffCycleStatus, { variant: StatusVariant; label: string }> = {
  DRAFT: { variant: 'neutral', label: '초안' }, // TODO: i18n
  PENDING_APPROVAL: { variant: 'warning', label: '승인 대기' }, // TODO: i18n
  APPROVED: { variant: 'success', label: '승인' }, // TODO: i18n
  REJECTED: { variant: 'error', label: '반려' }, // TODO: i18n
  CANCELLED: { variant: 'neutral', label: '취소' }, // TODO: i18n
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleStatusBadge({ status, className }: OffCycleStatusBadgeProps) {
  const { variant, label } = STATUS_MAP[status] ?? STATUS_MAP.DRAFT

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
