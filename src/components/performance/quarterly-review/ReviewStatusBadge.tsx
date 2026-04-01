'use client'

import { cn } from '@/lib/utils'
import { STATUS_VARIANT, type StatusVariant } from '@/lib/styles/status'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  status: string
  label: string
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_MAP: Record<string, StatusVariant> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  EMPLOYEE_DONE: 'warning',
  MANAGER_DONE: 'primary',
  COMPLETED: 'success',
}

// ─── Component ──────────────────────────────────────────────

export default function ReviewStatusBadge({ status, label, className }: Props) {
  const variant = STATUS_MAP[status] ?? 'neutral'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_VARIANT[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}
