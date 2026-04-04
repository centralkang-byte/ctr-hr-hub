'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Approval Timeline
// 승인 워크플로우 타임라인 (수직)
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { Check, Clock, X, Circle } from 'lucide-react'
import { STATUS_VARIANT, type StatusVariant } from '@/lib/styles/status'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type ApprovalStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'

interface ApprovalStep {
  id: string
  stepNumber: number
  roleRequired: string
  approverName?: string | null
  status: ApprovalStepStatus
  comment?: string | null
  decidedAt?: string | null
}

interface OffCycleApprovalTimelineProps {
  steps: ApprovalStep[]
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

const STEP_VARIANT_MAP: Record<ApprovalStepStatus, StatusVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  SKIPPED: 'neutral',
}

// ─── Helpers ────────────────────────────────────────────────

function StepIcon({ status }: { status: ApprovalStepStatus }) {
  switch (status) {
    case 'APPROVED':
      return <Check className="h-4 w-4 text-[#059669]" />
    case 'REJECTED':
      return <X className="h-4 w-4 text-[#DC2626]" />
    case 'PENDING':
      return <Clock className="h-4 w-4 text-[#D97706]" />
    default:
      return <Circle className="h-4 w-4 text-[#64748B]" />
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleApprovalTimeline({ steps, className }: OffCycleApprovalTimelineProps) {
  const t = useTranslations('compensation')
  if (!steps.length) return null

  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        const variant = STEP_VARIANT_MAP[step.status] ?? 'warning'
        const label = t(`offCycle.approval.${step.status.toLowerCase()}`)

        return (
          <div key={step.id} className="relative flex gap-4">
            {/* ─── Vertical line + icon ─── */}
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-lowest shadow-sm">
                <StepIcon status={step.status} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border/30" />
              )}
            </div>

            {/* ─── Content ─── */}
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {step.stepNumber}. {step.roleRequired}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
                    STATUS_VARIANT[variant],
                  )}
                >
                  {label}
                </span>
              </div>

              {step.approverName && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.approverName}
                </p>
              )}

              {step.comment && (
                <div className="mt-2 rounded-2xl bg-surface-container-low p-3 text-sm text-foreground">
                  {step.comment}
                </div>
              )}

              {step.decidedAt && (
                <p className="mt-1 text-xs text-muted-foreground font-mono tabular-nums">
                  {formatDateTime(step.decidedAt)}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
