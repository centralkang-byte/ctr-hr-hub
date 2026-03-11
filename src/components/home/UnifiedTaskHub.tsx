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

const TYPE_LABEL: Record<string, string> = {
  [UnifiedTaskType.LEAVE_APPROVAL]: '휴가',
  [UnifiedTaskType.PERFORMANCE_REVIEW]: '성과',
  [UnifiedTaskType.ONBOARDING_TASK]: '온보딩',
  [UnifiedTaskType.OFFBOARDING_TASK]: '퇴직',
  [UnifiedTaskType.PAYROLL_REVIEW]: '급여',
  [UnifiedTaskType.BENEFIT_REQUEST]: '복리후생',
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
  [UnifiedTaskType.LEAVE_APPROVAL]: 'text-[#5E81F4]',
  [UnifiedTaskType.PERFORMANCE_REVIEW]: 'text-[#A855F7]',
  [UnifiedTaskType.ONBOARDING_TASK]: 'text-[#00C853]',
  [UnifiedTaskType.OFFBOARDING_TASK]: 'text-[#F59E0B]',
  [UnifiedTaskType.PAYROLL_REVIEW]: 'text-[#EF4444]',
  [UnifiedTaskType.BENEFIT_REQUEST]: 'text-[#06B6D4]',
}

// 필터 탭 정의
const FILTER_TABS = [
  { key: 'all', label: '전체' },
  { key: UnifiedTaskType.LEAVE_APPROVAL, label: '휴가' },
  { key: UnifiedTaskType.PERFORMANCE_REVIEW, label: '성과' },
  { key: UnifiedTaskType.ONBOARDING_TASK, label: '온보딩' },
  { key: UnifiedTaskType.OFFBOARDING_TASK, label: '퇴직' },
  { key: UnifiedTaskType.PAYROLL_REVIEW, label: '급여' },
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
  if (!dueDate) return 'text-[#8181A5]'
  const diff = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]'
  if (diff === 0) return 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
  if (diff <= 3) return 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]'
  return 'bg-[#F0F4FF] text-[#5E81F4] border-[#C7D2FE]'
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
  const Icon = TYPE_ICON[task.type] ?? ListChecks
  const iconColor = TYPE_ICON_COLOR[task.type] ?? 'text-[#8181A5]'
  const dday = getDday(task.dueDate)
  const ddayColor = getDdayColor(task.dueDate)
  const isLeave = task.type === UnifiedTaskType.LEAVE_APPROVAL
  const canInlineApprove = isLeave && user.role !== 'EMPLOYEE'
  const isPending = task.status === UnifiedTaskStatus.PENDING ||
    task.status === UnifiedTaskStatus.IN_PROGRESS
  const isBusy = processing === task.id

  // Urgency border highlight
  let borderStyle = 'border border-[#F0F0F3]'
  if (task.priority === UnifiedTaskPriority.URGENT) borderStyle = 'border border-[#FECACA] border-l-4 border-l-[#EF4444]'
  else if (task.priority === UnifiedTaskPriority.HIGH) borderStyle = 'border border-[#FCD34D] border-l-4 border-l-[#F59E0B]'

  return (
    <div
      className={`group rounded-xl bg-white p-3.5 transition-shadow hover:shadow-sm ${borderStyle}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F5FA]`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#1C1D21]">
            {task.title}
          </p>
          {task.summary && (
            <p className="mt-0.5 truncate text-xs text-[#8181A5]">
              {task.summary}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="h-5 rounded-md px-1.5 text-[10px] font-medium text-[#8181A5]"
            >
              {TYPE_LABEL[task.type] ?? task.type}
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
                className="h-7 gap-1 px-2 text-[11px] text-[#00A844] hover:bg-[#E8F5E9] hover:text-[#00A844]"
                disabled={isBusy}
                onClick={() => onAction(task.id, 'approve', task.sourceId)}
                title="승인"
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">승인</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] text-[#EF4444] hover:bg-[#FEE2E2] hover:text-[#EF4444]"
                disabled={isBusy}
                onClick={() => onAction(task.id, 'reject', task.sourceId)}
                title="반려"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">반려</span>
              </Button>
            </>
          ) : isPending && task.actionUrl ? (
            <Link href={task.actionUrl}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] text-[#8181A5] hover:bg-[#F5F5FA]"
                title="이동"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">보기</span>
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
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8181A5]">
          {label}
        </span>
        <span className="ml-1 rounded-full bg-[#F0F0F3] px-1.5 py-0.5 text-[10px] text-[#8181A5]">
          {tasks.length}
        </span>
        {collapsible && (
          <span className="ml-auto text-[#8181A5]">
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
  const [tasks, setTasks] = useState<UnifiedTask[]>([])
  const [countByType, setCountByType] = useState<Partial<Record<UnifiedTaskType, number>>>({})
  const [loading, setLoading] = useState(true)
  const [activeFilter, setFilter] = useState<FilterKey>('all')
  const [processing, setProcessing] = useState<string | null>(null)

  // ── Fetch ───────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiClient.get<UnifiedTaskListResponse>(
        '/api/v1/unified-tasks?limit=50&sortField=priority&sortDir=desc',
      )
      setTasks(res.data.items)
      setCountByType(res.data.countByType)
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
    <Card className="flex flex-col border-[#F0F0F3] shadow-none">
      {/* ── Header ── */}
      <CardHeader className="border-b border-[#F0F0F3] pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1C1D21]">
            <ListChecks className="h-4 w-4 text-[#5E81F4]" />
            나의 할 일
            {pendingCount > 0 && (
              <span className="rounded-full bg-[#5E81F4] px-2 py-0.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </CardTitle>
          <Link
            href="/my/tasks"
            className="text-xs font-medium text-[#5E81F4] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? tasks.filter(t => classifyTask(t) !== 'done').length
              : (countByType[tab.key as UnifiedTaskType] ?? 0)

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as FilterKey)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeFilter === tab.key
                    ? 'bg-[#5E81F4] text-white'
                    : 'bg-[#F5F5FA] text-[#8181A5] hover:bg-[#E8EBFF] hover:text-[#5E81F4]'
                  }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1 text-[10px] ${activeFilter === tab.key ? 'bg-white/30 text-white' : 'bg-[#E8E8F0] text-[#8181A5]'
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
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F5F5FA]" />
            ))}
          </div>
        ) : pendingCount === 0 && done.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PartyPopper className="mb-3 h-10 w-10 text-[#5E81F4] opacity-70" />
            <p className="text-sm font-medium text-[#1C1D21]">모든 할 일을 완료했습니다! 🎉</p>
            <p className="mt-1 text-xs text-[#8181A5]">처리할 항목이 없습니다.</p>
          </div>
        ) : (
          <>
            <GroupSection
              label="🔴 긴급"
              tasks={urgent}
              user={user}
              onAction={handleAction}
              processing={processing}
              accentColor="bg-[#EF4444]"
            />
            <GroupSection
              label="📌 이번 주"
              tasks={week}
              user={user}
              onAction={handleAction}
              processing={processing}
              accentColor="bg-[#F59E0B]"
            />
            <GroupSection
              label="📅 이번 달"
              tasks={month}
              user={user}
              onAction={handleAction}
              processing={processing}
              accentColor="bg-[#5E81F4]"
            />
            {/* Completed section — collapsible */}
            {done.length > 0 && (
              <GroupSection
                label="✅ 완료 (최근)"
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
