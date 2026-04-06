'use client'

import { useTranslations } from 'next-intl'

const STATUS_CONFIG: Record<string, { labelKey: string; bg: string; text: string; border: string }> = {
  DRAFT: { labelKey: 'status.draft', bg: 'bg-background', text: 'text-muted-foreground', border: 'border-border' },
  ATTENDANCE_CLOSED: { labelKey: 'status.attendanceClosed', bg: 'bg-primary/10', text: 'text-emerald-700', border: 'border-emerald-200' },
  CALCULATING: { labelKey: 'status.calculating', bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-300' },
  ADJUSTMENT: { labelKey: 'status.adjustment', bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  REVIEW: { labelKey: 'status.review', bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  PENDING_APPROVAL: { labelKey: 'status.pendingApproval', bg: 'bg-amber-500/15', text: 'text-amber-700', border: 'border-amber-300' },
  APPROVED: { labelKey: 'status.approved', bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200' },
  PAID: { labelKey: 'status.paid', bg: 'bg-indigo-500/15', text: 'text-primary/90', border: 'border-indigo-200' },
  PUBLISHED: { labelKey: 'status.published', bg: 'bg-indigo-500/15', text: 'text-primary/90', border: 'border-indigo-200' },
  CANCELLED: { labelKey: 'status.cancelled', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
}

interface PayrollStatusBadgeProps {
  status: string
}

export default function PayrollStatusBadge({ status }: PayrollStatusBadgeProps) {
  const t = useTranslations('payroll')
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      {t(config.labelKey)}
    </span>
  )
}
