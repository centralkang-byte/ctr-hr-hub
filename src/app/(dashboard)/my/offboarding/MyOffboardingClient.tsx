'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Offboarding Client (Stage 5-B)
// /my/offboarding — 직원 본인의 퇴직 처리 진행 현황
//
// 설계 결정:
//   - /api/v1/offboarding/me 조회
//   - EMPLOYEE assigneeType 태스크만 완료 처리 가능
//   - 기타 담당자(HR/IT/MANAGER) 태스크는 read-only 표시
//   - D-day 카운터 prominently 상단 표시
//   - 이탈 시 처리 가능 태스크 없으면 완료 완화 안내
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  Clock,
  CircleDot,
  Circle,
  Loader2,
  AlertTriangle,
  Info,
  CalendarDays,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────

interface OffboardingTask {
  id:           string
  taskId:       string
  title:        string
  description:  string | null
  assigneeType: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'IT' | 'FINANCE'
  isRequired:   boolean
  status:       'PENDING' | 'DONE' | 'SKIPPED' | 'BLOCKED'
  completedAt:  string | null
  dueDate:      string
  isOverdue:    boolean
}

interface OffboardingData {
  offboardingId:   string
  status:          string
  lastWorkingDate: string
  dDay:            number
  progress:        number
  completed:       number
  total:           number
  checklistName:   string
  tasks:           OffboardingTask[]
  reference: {
    annualLeaveRemaining: number | null
  }
}

// ─── Constants ────────────────────────────────────────────

const ASSIGNEE_LABEL: Record<string, string> = {
  EMPLOYEE: '본인',
  MANAGER:  '매니저',
  HR:       'HR팀',
  IT:       'IT팀',
  FINANCE:  '재무팀',
}

// ─── Task Row ─────────────────────────────────────────────

interface TaskRowProps {
  task:       OffboardingTask
  isActive:   boolean
  onComplete: (taskId: string) => void
  processing: string | null
}

function TaskRow({ task, isActive, onComplete, processing }: TaskRowProps) {
  const isDone      = task.status === 'DONE'
  const isEmployee  = task.assigneeType === 'EMPLOYEE'
  const isBusy      = processing === task.id
  const dueDateStr  = new Date(task.dueDate).toLocaleDateString('ko-KR', {
    month: 'short',
    day:   'numeric',
  })

  let rowBg = 'bg-card border-border'
  if (isDone)    rowBg = 'bg-tertiary-container/10 border-emerald-100'
  if (isActive)  rowBg = 'bg-primary/10 border-indigo-200 border-l-4 border-l-[#5E81F4]'
  if (task.isOverdue && !isDone) rowBg = 'bg-destructive/5 border-destructive/20'

  return (
    <div className={`rounded-xl border p-4 transition-colors ${rowBg}`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {isDone
            ? <CheckCircle2 className="h-5 w-5 text-primary" />
            : isActive
              ? <CircleDot className="h-5 w-5 text-primary" />
              : <Circle className="h-5 w-5 text-muted-foreground/40" />
          }
        </div>

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {task.title}
            </p>
            {task.isOverdue && !isDone && (
              <Badge className="h-4 bg-destructive/50 px-1.5 text-[10px] text-white">지연</Badge>
            )}
            {!task.isRequired && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">선택</Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
          )}

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>담당: {ASSIGNEE_LABEL[task.assigneeType] ?? task.assigneeType}</span>
            {isDone && task.completedAt ? (
              <span className="text-primary">
                완료: {new Date(task.completedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </span>
            ) : (
              <span className={task.isOverdue ? 'text-red-500' : ''}>
                마감: {dueDateStr}
              </span>
            )}
          </div>

          {/* Action button — EMPLOYEE tasks only */}
          {!isDone && isEmployee && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 gap-1 border-primary px-2 text-[11px] text-primary hover:bg-primary/10"
              disabled={isBusy}
              onClick={() => onComplete(task.id)}
            >
              {isBusy
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <CheckCircle2 className="h-3 w-3" />
              }
              완료 처리
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── D-day Display ────────────────────────────────────────

function DDayBadge({ dDay }: { dDay: number }) {
  const isOver = dDay < 0
  const isImminent = dDay >= 0 && dDay <= 7

  let bgColor = 'bg-primary/10 text-primary'
  if (isOver)     bgColor = 'bg-destructive/5 text-red-500'
  if (isImminent) bgColor = 'bg-amber-500/15 text-amber-700'

  const label = isOver ? `D+${Math.abs(dDay)}` : dDay === 0 ? 'D-Day' : `D-${dDay}`

  return (
    <span className={`rounded-xl px-3 py-1 text-xl font-bold ${bgColor}`}>
      {label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────

export function MyOffboardingClient() {
  const [data,       setData]       = useState<OffboardingData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [noProcess,  setNoProcess]  = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get<OffboardingData | null>('/api/v1/offboarding/me')
      if (!res.data) {
        setNoProcess(true)
      } else {
        setData(res.data)
      }
    } catch {
      setNoProcess(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const handleComplete = async (instanceTaskId: string) => {
    if (!data) return
    setProcessing(instanceTaskId)
    const prev = data

    setData(d => d ? {
      ...d,
      completed: d.completed + 1,
      progress: Math.round(((d.completed + 1) / d.total) * 100),
      tasks: d.tasks.map(t => t.id === instanceTaskId
        ? { ...t, status: 'DONE' as const, completedAt: new Date().toISOString() }
        : t
      ),
    } : d)

    try {
      await apiClient.put(
        `/api/v1/offboarding/${data.offboardingId}/tasks/${instanceTaskId}/complete`,
        {},
      )
    } catch {
      // Revert on failure
      setData(prev)
    } finally {
      setProcessing(null)
    }
  }

  // ── Loading ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </div>
    )
  }

  // ── No active offboarding ─────────────────────────────────

  if (noProcess || !data) {
    return (
      <Card className="border-border shadow-none">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <Info className="mb-3 h-10 w-10 text-muted-foreground opacity-60" />
          <EmptyState />
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">
            퇴직 관련 문의는 HR팀에 연락해주세요.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Find the "active" task (first non-DONE) ───────────────

  const activeTaskId = data.tasks.find(t => t.status === 'PENDING')?.id
  const lastWorkStr  = new Date(data.lastWorkingDate).toLocaleDateString('ko-KR', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  })

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">나의 퇴직 처리</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              최종 근무일: {lastWorkStr}
            </div>
          </div>
          <DDayBadge dDay={data.dDay} />
        </div>

        {/* Progress bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">전체 진행률</span>
            <span className="text-muted-foreground">
              {data.completed}/{data.total} 완료
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${data.progress}%` }}
            />
          </div>
          <div className="text-right text-xs font-semibold text-primary">
            {data.progress}%
          </div>
        </div>
      </div>

      {/* ── Task list ── */}
      <div className="space-y-2">
        {data.tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            isActive={task.id === activeTaskId}
            onComplete={handleComplete}
            processing={processing}
          />
        ))}
      </div>

      {/* ── Reference info ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            참고 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {data.reference.annualLeaveRemaining !== null && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              잔여 연차: <span className="font-semibold text-foreground">
                {data.reference.annualLeaveRemaining}일
              </span>
              — 최종 근무일 전 사용을 권장합니다.
            </div>
          )}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            4대보험 상실 신고는 퇴직일 기준 14일 이내 처리됩니다.
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            건강보험 임의 계속 가입을 원하시면 HR팀에 문의하세요.
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            퇴직금은 최종 근무일 기준 14일 이내 지급됩니다.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
