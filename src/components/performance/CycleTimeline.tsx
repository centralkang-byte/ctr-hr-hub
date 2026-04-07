'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPipelineSteps, CYCLE_STATUS_LABELS } from '@/lib/performance/pipeline'

// ─── Types ──────────────────────────────────────────────────

interface CycleTimelineProps {
  currentStatus: string
  role: string
  cycleHalf: string
  nextDeadline?: string | null
}

// ─── Constants ──────────────────────────────────────────────

// EMPLOYEE에게 숨길 단계 (API에서 이미 마스킹하지만 UI에서도 방어)
const EMPLOYEE_HIDDEN_STEPS = new Set(['COMP_REVIEW', 'COMP_COMPLETED'])

// Role → Status → i18n key for action item text
const ACTION_ITEMS: Record<string, Record<string, string>> = {
  EMPLOYEE: {
    ACTIVE: 'timeline.action.employeeActive',
    EVAL_OPEN: 'timeline.action.employeeEvalOpen',
    CLOSED: 'timeline.action.employeeClosed',
  },
  MANAGER: {
    ACTIVE: 'timeline.action.managerActive',
    EVAL_OPEN: 'timeline.action.managerEvalOpen',
    CALIBRATION: 'timeline.action.managerCalibration',
    CLOSED: 'timeline.action.managerClosed',
    COMP_REVIEW: 'timeline.action.managerCompReview',
  },
  HR_ADMIN: {
    DRAFT: 'timeline.action.hrDraft',
    ACTIVE: 'timeline.action.hrActive',
    EVAL_OPEN: 'timeline.action.hrEvalOpen',
    CALIBRATION: 'timeline.action.hrCalibration',
    CLOSED: 'timeline.action.hrClosed',
    COMP_REVIEW: 'timeline.action.hrCompReview',
    COMP_COMPLETED: 'timeline.action.hrCompCompleted',
  },
}

// ─── Helpers ────────────────────────────────────────────────

function getActionText(role: string, status: string): string | null {
  const roleKey = role === 'SUPER_ADMIN' ? 'HR_ADMIN'
    : role === 'EXECUTIVE' ? 'MANAGER'
    : role
  return ACTION_ITEMS[roleKey]?.[status] ?? null
}

function formatDeadline(dateStr: string, t: (key: string, values?: Record<string, string | number | Date>) => string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`
  if (diffDays < 0) return `${dateLabel} (${t('timeline.daysOverdue', { days: Math.abs(diffDays) })})`
  if (diffDays === 0) return `${dateLabel} (${t('timeline.today')})`
  if (diffDays <= 7) return `${dateLabel} (${t('timeline.daysLeft', { days: diffDays })})`
  return dateLabel
}

// ─── Component ──────────────────────────────────────────────

export function CycleTimeline({ currentStatus, role, cycleHalf, nextDeadline }: CycleTimelineProps) {
  const t = useTranslations('performance')
  // 동적 파이프라인: half에 따라 H1(4단계) vs H2(7단계)
  const steps = useMemo(() => {
    const pipeline = getPipelineSteps(cycleHalf)
    // EMPLOYEE에게는 보상 단계 숨김 (API 마스킹 + UI 방어)
    if (role === 'EMPLOYEE') return pipeline.filter(s => !EMPLOYEE_HIDDEN_STEPS.has(s))
    return pipeline
  }, [cycleHalf, role])

  const currentIdx = steps.indexOf(currentStatus)
  const action = getActionText(role, currentStatus)

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const isCompleted = i < currentIdx
          const isCurrent = i === currentIdx
          const label = CYCLE_STATUS_LABELS[step]?.ko?.split('(')[0] ?? step

          return (
            <div key={step} className="flex flex-1 items-center">
              {/* Node */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                  isCompleted && 'bg-emerald-500/15 text-emerald-600',
                  isCurrent && 'bg-primary text-white shadow-sm shadow-primary/30',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                )}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Circle className="h-3 w-3 fill-current" /> : <span className="text-[10px] font-medium">{i + 1}</span>}
                </div>
                <span className={cn(
                  'mt-1.5 text-center text-[10px] leading-tight',
                  isCurrent ? 'font-semibold text-primary' : isCompleted ? 'text-emerald-600' : 'text-muted-foreground',
                )}>
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className={cn(
                  'mx-0.5 h-0.5 flex-1',
                  i < currentIdx ? 'bg-emerald-500/30' : 'bg-border',
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Action bar */}
      {(action || nextDeadline) && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5">
          {action && (
            <span className="text-sm text-foreground">
              <span className="mr-1.5 font-medium text-primary">{t('timeline.toDo')}</span>{t(action)}
            </span>
          )}
          {nextDeadline && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {t('timeline.deadline')} {formatDeadline(nextDeadline, t)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
