'use client'

import { useMemo } from 'react'
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

// Role → Status → action item text
const ACTION_ITEMS: Record<string, Record<string, string>> = {
  EMPLOYEE: {
    ACTIVE: '개인 MBO 목표를 설정하세요',
    EVAL_OPEN: '자기평가를 제출하세요',
    CLOSED: '평가 결과를 확인하세요',
  },
  MANAGER: {
    ACTIVE: '팀원 목표를 검토하세요',
    EVAL_OPEN: '팀원 평가를 제출하세요',
    CALIBRATION: '피플세션에 참여하세요',
    CLOSED: '팀원에게 결과를 공유하세요',
    COMP_REVIEW: '보상 추천을 입력하세요',
  },
  HR_ADMIN: {
    DRAFT: '사이클을 구성하고 마감일을 설정하세요',
    ACTIVE: '제출률을 모니터링하세요',
    EVAL_OPEN: '평가 완료율을 모니터링하세요',
    CALIBRATION: '피플세션을 진행하세요',
    CLOSED: '전사 결과를 공시하세요',
    COMP_REVIEW: '보상 매트릭스를 설계하세요',
    COMP_COMPLETED: '급여 시스템에 연동하세요',
  },
}

// ─── Helpers ────────────────────────────────────────────────

function getActionText(role: string, status: string): string | null {
  const roleKey = role === 'SUPER_ADMIN' ? 'HR_ADMIN'
    : role === 'EXECUTIVE' ? 'MANAGER'
    : role
  return ACTION_ITEMS[roleKey]?.[status] ?? null
}

function formatDeadline(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`
  if (diffDays < 0) return `${dateLabel} (${Math.abs(diffDays)}일 초과)`
  if (diffDays === 0) return `${dateLabel} (오늘)`
  if (diffDays <= 7) return `${dateLabel} (${diffDays}일 남음)`
  return dateLabel
}

// ─── Component ──────────────────────────────────────────────

export function CycleTimeline({ currentStatus, role, cycleHalf, nextDeadline }: CycleTimelineProps) {
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
              <span className="mr-1.5 font-medium text-primary">할 일:</span>{action}
            </span>
          )}
          {nextDeadline && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              마감 {formatDeadline(nextDeadline)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
