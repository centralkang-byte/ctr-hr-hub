'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Task Hub (Stage 5-A)
// /api/v1/unified-tasks 기반 나의 할 일 통합 위젯
// PendingActionsPanel 완전 대체
// ═══════════════════════════════════════════════════════════
//
// 설계 결정:
//   - UnifiedTask API를 직접 호출 (PendingActions API 폐기)
//   - 긴급→이번주→이번달→완료 4개 그룹으로 분류
//   - 휴가·성과 인라인 액션 (optimistic UI)
//   - 필터 탭: 전체/휴가/성과/온보딩/근태
//   - WidgetSkeleton 재사용

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  CalendarDays,
  Target,
  ClipboardCheck,
  Clock,
  DoorOpen,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  ListChecks,
  ChevronDown,
  ChevronUp,
  PartyPopper,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
} from '@/lib/unified-task/types'
import type { UnifiedTask, UnifiedTaskListResponse } from '@/lib/unified-task/types'

// ─── Constants ───────────────────────────────────────────

const TYPE_LABEL_KEY: Record<string, string> = {
  [UnifiedTaskType.LEAVE_APPROVAL]: 'taskHub.typeLeave',
  [UnifiedTaskType.PERFORMANCE_REVIEW]: 'taskHub.typePerformance',
  [UnifiedTaskType.ONBOARDING_TASK]: 'taskHub.typeOnboarding',
  [UnifiedTaskType.OFFBOARDING_TASK]: 'taskHub.typeOffboarding',
  [UnifiedTaskType.PAYROLL_REVIEW]: 'taskHub.typePayroll',
  [UnifiedTaskType.BENEFIT_REQUEST]: 'taskHub.typeBenefit',
}

const TYPE_ICON: Record<string, React.ElementType> = {
  [UnifiedTaskType.LEAVE_APPROVAL]: CalendarDays,
  [UnifiedTaskType.PERFORMANCE_REVIEW]: Target,
  [UnifiedTaskType.ONBOARDING_TASK]: ClipboardCheck,
  [UnifiedTaskType.OFFBOARDING_TASK]: DoorOpen,
  [UnifiedTaskType.PAYROLL_REVIEW]: Clock,
  [UnifiedTaskType.BENEFIT_REQUEST]: ListChecks,
}

const TYPE_ICON_COLOR: Record<string, string> = {
  [UnifiedTaskType.LEAVE_APPROVAL]: 'text-primary',
  [UnifiedTaskType.PERFORMANCE_REVIEW]: 'text-violet-500',
  [UnifiedTaskType.ONBOARDING_TASK]: 'text-primary',
  [UnifiedTaskType.OFFBOARDING_TASK]: 'text-amber-500',
  [UnifiedTaskType.PAYROLL_REVIEW]: 'text-red-500',
  [UnifiedTaskType.BENEFIT_REQUEST]: 'text-cyan-500',
}

// 필터 탭 정의
const FILTER_TABS = [
  { key: 'all', labelKey: 'taskHub.filterAll' },
  { key: UnifiedTaskType.LEAVE_APPROVAL, labelKey: 'taskHub.typeLeave' },
  { key: UnifiedTaskType.PERFORMANCE_REVIEW, labelKey: 'taskHub.typePerformance' },
  { key: UnifiedTaskType.ONBOARDING_TASK, labelKey: 'taskHub.typeOnboarding' },
  { key: UnifiedTaskType.OFFBOARDING_TASK, labelKey: 'taskHub.typeOffboarding' },
  { key: UnifiedTaskType.PAYROLL_REVIEW, labelKey: 'taskHub.typePayroll' },
]

// ─── Types ────────────────────────────────────────────────

interface UnifiedTaskHubProps {
  user: SessionUser
}

type FilterKey = 'all' | UnifiedTaskType

// ─── Helpers ─────────────────────────────────────────────

function getDday(dueDate?: string): string | null {
  if (!dueDate) return null
  const diff = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return `D+${Math.abs(diff)}`
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

function getDdayColor(dueDate?: string): string {
  if (!dueDate) return 'text-muted-foreground'
  const diff = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return 'bg-destructive/10 text-destructive border-destructive/20'
  if (diff === 0) return 'bg-amber-500/15 text-amber-700 border-amber-300'
  if (diff <= 3) return 'bg-amber-500/15 text-amber-700 border-amber-300'
  return 'bg-primary/10 text-primary border-indigo-200'
}

function classifyTask(task: UnifiedTask): 'urgent' | 'week' | 'month' | 'done' {
  if (task.status === UnifiedTaskStatus.COMPLETED ||
    task.status === UnifiedTaskStatus.REJECTED ||
    task.status === UnifiedTaskStatus.CANCELLED) return 'done'

  if (!task.dueDate) return 'month'

  const now = new Date()
  const due = new Date(task.dueDate)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0 ||
    task.priority === UnifiedTaskPriority.URGENT) return 'urgent'
  if (diffDays <= 7) return 'week'
  if (diffDays <= 31) return 'month'
  return 'month'
}

// ─── TaskCard (single item) ───────────────────────────────

interface TaskCardProps {
  task: UnifiedTask
  user: SessionUser
  onAction: (taskId: string, action: 'approve' | 'reject', sourceId: string) => void
  processing: string | null
}

function TaskCard({ task, user, onAction, processing }: TaskCardProps) {
  const t = useTranslations('home')
  const Icon = TYPE_ICON[task.type] ?? ListChecks
  const iconColor = TYPE_ICON_COLOR[task.type] ?? 'text-muted-foreground'
  const dday = getDday(task.dueDate)
  const ddayColor = getDdayColor(task.dueDate)
  const isLeave = task.type === UnifiedTaskType.LEAVE_APPROVAL
  const canInlineApprove = isLeave && user.role !== 'EMPLOYEE'
  const isPending = task.status === UnifiedTaskStatus.PENDING ||
    task.status === UnifiedTaskStatus.IN_PROGRESS
  const isBusy = processing === task.id

  // Urgency border highlight
  let borderStyle = 'border border-border'
  if (task.priority === UnifiedTaskPriority.URGENT) borderStyle = 'border border-destructive/20 border-l-4 border-l-[#EF4444]'
  else if (task.priority === UnifiedTaskPriority.HIGH) borderStyle = 'border border-amber-300 border-l-4 border-l-[#F59E0B]'

  return (
    <div
      className={`group rounded-xl bg-card p-3.5 transition-shadow hover:shadow-sm ${borderStyle}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {task.title}
          </p>
          {task.summary && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {task.summary}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="h-5 rounded-md px-1.5 text-[10px] font-medium text-muted-foreground"
            >
              {t(TYPE_LABEL_KEY[task.type] ?? task.type)}
            </Badge>
            {dday && (
              <Badge variant="outline" className={`h-5 rounded-md px-1.5 text-[10px] font-medium ${ddayColor}`}>
                {dday}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isPending && canInlineApprove ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] text-primary/90 hover:bg-primary/10 hover:text-primary/90"
                disabled={isBusy}
                onClick={() => onAction(task.id, 'approve', task.sourceId)}
                title={t('taskHub.approve')}
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{t('taskHub.approve')}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] text-red-500 hover:bg-destructive/10 hover:text-red-500"
                disabled={isBusy}
                onClick={() => onAction(task.id, 'reject', task.sourceId)}
                title={t('taskHub.reject')}
              >
                <XCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('taskHub.reject')}</span>
              </Button>
            </>
          ) : isPending && task.actionUrl ? (
            <Link href={task.actionUrl}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-muted"
                title={t('taskHub.view')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('taskHub.view')}</span>
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Group Section ────────────────────────────────────────

interface GroupSectionProps {
  label: string
  tasks: UnifiedTask[]
  user: SessionUser
  onAction: (taskId: string, action: 'approve' | 'reject', sourceId: string) => void
  processing: string | null
  collapsible?: boolean
  defaultOpen?: boolean
  accentColor?: string
}

function GroupSection({
  label, tasks, user, onAction, processing,
  collapsible = false, defaultOpen = true, accentColor,
}: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  if (tasks.length === 0) return null

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 py-2"
        onClick={() => collapsible && setOpen((v) => !v)}
      >
        {accentColor && (
          <span className={`h-2 w-2 rounded-full ${accentColor}`} />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="ml-1 rounded-full bg-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {tasks.length}
        </span>
        {collapsible && (
          <span className="ml-auto text-muted-foreground">
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              user={user}
              onAction={onAction}
              processing={processing}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

export function UnifiedTaskHub({ user }: UnifiedTaskHubProps) {
  const t = useTranslations('home')
  const [tasks, setTasks] = useState<UnifiedTask[]>([])
  const [countByType, setCountByType] = useState<Partial<Record<UnifiedTaskType, number>>>({})
  const [loading, setLoading] = useState(true)
  const [activeFilter, setFilter] = useState<FilterKey>('all')
  const [processing, setProcessing] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  // ── Fetch ───────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiClient.get<UnifiedTaskListResponse>(
        '/api/v1/unified-tasks?limit=50&sortField=priority&sortDir=desc',
      )
      setTasks(res.data.items)
      setCountByType(res.data.countByType)
      setTotalCount(res.data.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  // ── Inline Actions (Leave approve/reject) ───────────────

  const handleAction = useCallback(
    async (taskId: string, action: 'approve' | 'reject', sourceId: string) => {
      // Optimistic remove
      setProcessing(taskId)
      const prev = tasks
      setTasks((ts) => ts.filter((t) => t.id !== taskId))

      try {
        await apiClient.put(
          `/api/v1/leave/requests/${sourceId}/${action}`,
          {},
        )
        // Refresh to get updated list
        await fetchTasks()
      } catch {
        // Revert on failure
        setTasks(prev)
      } finally {
        setProcessing(null)
      }
    },
    [tasks, fetchTasks],
  )

  // ── Filter ──────────────────────────────────────────────

  const filtered = activeFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.type === activeFilter)

  // ── Group ───────────────────────────────────────────────

  const urgent: UnifiedTask[] = []
  const week: UnifiedTask[] = []
  const month: UnifiedTask[] = []
  const done: UnifiedTask[] = []

  for (const t of filtered) {
    switch (classifyTask(t)) {
      case 'urgent': urgent.push(t); break
      case 'week': week.push(t); break
      case 'month': month.push(t); break
      case 'done': done.push(t); break
    }
  }

  const pendingCount = urgent.length + week.length + month.length

  // ── Render ──────────────────────────────────────────────

  return (
    <Card className="flex flex-col border-border shadow-none">
      {/* ── Header ── */}
      <CardHeader className="border-b border-border pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-primary" />
            {t('taskHub.myTasks')}
            {totalCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                {totalCount}
              </span>
            )}
          </CardTitle>
          <Link
            href="/my/tasks"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('taskHub.viewAll')}
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? totalCount
              : (countByType[tab.key as UnifiedTaskType] ?? 0)

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as FilterKey)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeFilter === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
              >
                {t(tab.labelKey)}
                {count > 0 && (
                  <span className={`rounded-full px-1 text-[10px] ${activeFilter === tab.key ? 'bg-white/30 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </CardHeader>

      {/* ── Body ── */}
      <CardContent className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: '520px' }}>
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : pendingCount === 0 && done.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PartyPopper className="mb-3 h-10 w-10 text-primary opacity-70" />
            <p className="text-sm font-medium text-foreground">{t('taskHub.allDone')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('taskHub.noItems')}</p>
          </div>
        ) : (
          <>
            <GroupSection
              label={`🔴 ${t('taskHub.groupUrgent')}`}
              tasks={urgent}
              user={user}
              onAction={handleAction}
              processing={processing}
              accentColor="bg-destructive/50"
            />
            <GroupSection
              label={`📌 ${t('taskHub.groupThisWeek')}`}
              tasks={week}
              user={user}
              onAction={handleAction}
              processing={processing}
              accentColor="bg-amber-500/100"
            />
            <GroupSection
              label={`📅 ${t('taskHub.groupThisMonth')}`}
              tasks={month}
              user={user}
              onAction={handleAction}
              processing={processing}
              accentColor="bg-primary"
            />
            {/* Completed section — collapsible */}
            {done.length > 0 && (
              <GroupSection
                label={`✅ ${t('taskHub.groupCompleted')}`}
                tasks={done.slice(0, 10)}
                user={user}
                onAction={handleAction}
                processing={processing}
                collapsible
                defaultOpen={false}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
