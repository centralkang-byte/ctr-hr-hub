'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dashboard Task List
// 대시보드 인라인 task 리스트. UnifiedTaskHub fetch/classify 로직 재사용.
// Priority grouped (urgent→week→month). 5건 기본 + 더 보기.
// 인라인 승인 (leave + benefit), 반려는 mini-modal.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  CalendarDays,
  Target,
  ClipboardCheck,
  DoorOpen,
  Clock,
  ListChecks,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DdayPill } from './DdayPill'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
} from '@/lib/unified-task/types'
import type { UnifiedTask, UnifiedTaskListResponse } from '@/lib/unified-task/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
  /** 기본 표시 건수 (default: 5) */
  defaultVisible?: number
  /** 섹션 제목 */
  title?: string
  /** 섹션 설명 */
  description?: string
  className?: string
}

type TaskGroup = 'urgent' | 'week' | 'month'

// ─── Constants ──────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  [UnifiedTaskType.LEAVE_APPROVAL]: CalendarDays,
  [UnifiedTaskType.PERFORMANCE_REVIEW]: Target,
  [UnifiedTaskType.ONBOARDING_TASK]: ClipboardCheck,
  [UnifiedTaskType.OFFBOARDING_TASK]: DoorOpen,
  [UnifiedTaskType.PAYROLL_REVIEW]: Clock,
  [UnifiedTaskType.BENEFIT_REQUEST]: ListChecks,
}

const GROUP_CONFIG: Record<TaskGroup, { emoji: string; labelKey: string; color: string }> = {
  urgent: { emoji: '🔴', labelKey: 'taskHub.groupUrgent', color: 'text-error' },
  week: { emoji: '📌', labelKey: 'taskHub.groupWeek', color: 'text-[#B45309]' },
  month: { emoji: '📅', labelKey: 'taskHub.groupMonth', color: 'text-primary' },
}

const INLINE_APPROVE_TYPES = new Set([
  UnifiedTaskType.LEAVE_APPROVAL,
  UnifiedTaskType.BENEFIT_REQUEST,
])

// ─── Helpers ────────────────────────────────────────────────

function getDaysUntilDue(dueDate?: string): number {
  if (!dueDate) return -30
  return Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
}

function classifyTask(task: UnifiedTask): TaskGroup {
  if (
    task.status === UnifiedTaskStatus.COMPLETED ||
    task.status === UnifiedTaskStatus.REJECTED ||
    task.status === UnifiedTaskStatus.CANCELLED
  ) return 'month' // 완료된 건은 대시보드에서 미표시 (필터됨)

  if (!task.dueDate) return 'month'
  const days = getDaysUntilDue(task.dueDate)
  if (days <= 0 || task.priority === UnifiedTaskPriority.URGENT) return 'urgent'
  if (days <= 7) return 'week'
  return 'month'
}

// ─── Component ──────────────────────────────────────────────

export function DashboardTaskList({
  user,
  defaultVisible = 5,
  title,
  description,
  className,
}: Props) {
  const t = useTranslations('home')
  const [tasks, setTasks] = useState<UnifiedTask[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // ── Fetch ──────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<UnifiedTaskListResponse>(
        '/api/v1/unified-tasks?statuses=PENDING,IN_PROGRESS&limit=50&sortField=priority&sortDir=desc',
      )
      setTasks(res.data.items)
      setTotalCount(res.data.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  // ── Inline Approve ────────────────────────────────────

  const handleApprove = useCallback(
    async (task: UnifiedTask) => {
      setProcessing(task.id)
      const prev = tasks
      setTasks((ts) => ts.filter((t) => t.id !== task.id))

      try {
        if (task.type === UnifiedTaskType.LEAVE_APPROVAL) {
          await apiClient.put(`/api/v1/leave/requests/${task.sourceId}/approve`, {})
        } else if (task.type === UnifiedTaskType.BENEFIT_REQUEST) {
          await apiClient.put(`/api/v1/benefits/claims/${task.sourceId}/approve`, {})
        }
        await fetchTasks()
      } catch {
        setTasks(prev)
        toast({ title: '승인 실패', variant: 'destructive' })
      } finally {
        setProcessing(null)
      }
    },
    [tasks, fetchTasks],
  )

  // ── Classify & Flatten ────────────────────────────────

  const groups: Record<TaskGroup, UnifiedTask[]> = { urgent: [], week: [], month: [] }
  for (const task of tasks) {
    const group = classifyTask(task)
    groups[group].push(task)
  }

  const flatTasks: { group: TaskGroup; task: UnifiedTask }[] = []
  for (const g of ['urgent', 'week', 'month'] as TaskGroup[]) {
    for (const task of groups[g]) {
      flatTasks.push({ group: g, task })
    }
  }

  const visibleTasks = expanded ? flatTasks : flatTasks.slice(0, defaultVisible)
  const hiddenCount = flatTasks.length - defaultVisible

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn('rounded-2xl bg-card p-5 shadow-sm', className)}>
        <Skeleton className="mb-3 h-5 w-40" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-[52px] w-[52px] rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-2xl bg-card p-5 shadow-sm', className)}>
        <DashboardErrorBanner
          message={t('taskHub.loadError')}
          onRetry={() => void fetchTasks()}
        />
      </div>
    )
  }

  if (flatTasks.length === 0) {
    return (
      <div className={cn('rounded-2xl bg-card p-5 shadow-sm', className)}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="mb-2 h-8 w-8 text-tertiary" />
          <p className="text-sm font-semibold text-foreground">
            {t('taskHub.emptyTitle')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('taskHub.emptyDesc')}
          </p>
        </div>
      </div>
    )
  }

  let lastGroup: TaskGroup | null = null

  return (
    <div className={cn('flex flex-col rounded-2xl bg-card p-5 shadow-sm', className)}>
      {/* Header */}
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-extrabold text-foreground">
            {title ?? t('taskHub.myTasks')}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Link
          href="/my/tasks"
          className="flex items-center gap-1 text-xs font-semibold text-primary"
        >
          {t('taskHub.viewAll')} ↗
        </Link>
      </div>

      {/* Task List */}
      <div className="flex-1">
        {visibleTasks.map(({ group, task }, idx) => {
          const Icon = TYPE_ICON[task.type] ?? ListChecks
          const days = getDaysUntilDue(task.dueDate)
          const showGroupHeader = group !== lastGroup
          lastGroup = group

          const canApprove =
            INLINE_APPROVE_TYPES.has(task.type) &&
            user.role !== 'EMPLOYEE' &&
            (task.status === UnifiedTaskStatus.PENDING || task.status === UnifiedTaskStatus.IN_PROGRESS)

          return (
            <Fragment key={task.id}>
              {showGroupHeader && (
                <p
                  className={cn(
                    'mt-3 text-[10px] font-bold uppercase tracking-wider',
                    GROUP_CONFIG[group].color,
                    idx === 0 && 'mt-2',
                  )}
                >
                  {GROUP_CONFIG[group].emoji} {t(GROUP_CONFIG[group].labelKey)} ({groups[group].length})
                </p>
              )}
              <div className="flex items-center gap-3.5 border-b border-outline-variant/15 py-3 last:border-b-0">
                <DdayPill daysUntilDue={-days} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {task.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {task.summary}
                  </p>
                </div>
                {canApprove && (
                  <Button
                    size="sm"
                    className="h-7 rounded-lg bg-tertiary px-3 text-[10px] font-bold text-white hover:bg-tertiary-dim"
                    disabled={processing === task.id}
                    onClick={() => handleApprove(task)}
                  >
                    {processing === task.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      t('taskHub.approve')
                    )}
                  </Button>
                )}
                {!canApprove && task.actionUrl && (
                  <Link href={task.actionUrl}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-lg px-2 text-[10px] font-semibold text-primary"
                    >
                      {t('taskHub.detail')}
                    </Button>
                  </Link>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Expand / Collapse */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-dashed border-primary/20 bg-surface py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-container/10"
        >
          {expanded
            ? t('taskHub.collapse')
            : `+ ${hiddenCount} ${t('taskHub.moreTasks')} (${t('taskHub.groupWeek')} ${groups.week.length} · ${t('taskHub.groupMonth')} ${groups.month.length})`}
        </button>
      )}
    </div>
  )
}
