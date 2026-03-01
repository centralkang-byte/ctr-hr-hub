'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Dashboard Client
// 퇴직처리 현황: 진행률, D-day 경고, 태스크 완료, 취소
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, PaginationInfo } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface OffboardingTaskRow {
  id: string
  status: string
  completedAt: string | null
  completedBy: string | null
  note: string | null
  task: {
    isRequired: boolean
    title: string
    assigneeType: string
    dueDaysBefore: number
  }
}

interface OffboardingRow {
  id: string
  employeeId: string
  resignType: string
  lastWorkingDate: string
  status: string
  startedAt: string
  completedAt: string | null
  employee: { id: string; name: string; companyId: string }
  checklist: { id: string; name: string }
  offboardingTasks: OffboardingTaskRow[]
  progress: { total: number; completed: number }
  daysUntil: number
  isD7: boolean
  isD3: boolean
}

interface OffboardingDashboardClientProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  IN_PROGRESS: 'default',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
}

const RESIGN_TYPE_VARIANTS: Record<string, BadgeVariant> = {
  VOLUNTARY: 'outline',
  INVOLUNTARY: 'destructive',
  RETIREMENT: 'secondary',
  CONTRACT_END: 'default',
  MUTUAL_AGREEMENT: 'outline',
}

const ASSIGNEE_COLORS: Record<string, string> = {
  EMPLOYEE: 'bg-gray-100 text-gray-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  HR: 'bg-green-100 text-green-700',
  IT: 'bg-purple-100 text-purple-700',
  FINANCE: 'bg-orange-100 text-orange-700',
}

const LIMIT_OPTIONS = [10, 20, 50]

// ─── Component ──────────────────────────────────────────────

export function OffboardingDashboardClient({ user }: OffboardingDashboardClientProps) {
  const t = useTranslations('offboarding')
  const tCommon = useTranslations('common')

  const STATUS_LABELS: Record<string, string> = {
    IN_PROGRESS: t('inProgress'),
    COMPLETED: t('completed'),
    CANCELLED: t('cancelled'),
  }

  const RESIGN_TYPE_LABELS: Record<string, string> = {
    VOLUNTARY: t('resignVoluntary'),
    INVOLUNTARY: t('resignInvoluntary'),
    RETIREMENT: t('resignRetirement'),
    CONTRACT_END: t('resignContractEnd'),
    MUTUAL_AGREEMENT: t('resignMutualAgreement'),
  }

  const ASSIGNEE_LABELS: Record<string, string> = {
    EMPLOYEE: t('assigneeEmployee'),
    MANAGER: t('assigneeManager'),
    HR: t('assigneeHr'),
    IT: t('assigneeIt'),
    FINANCE: t('assigneeFinance'),
  }

  const TASK_STATUS_LABELS: Record<string, string> = {
    PENDING: t('taskStatusPending'),
    DONE: t('taskStatusDone'),
    SKIPPED: t('taskStatusSkipped'),
    BLOCKED: t('taskStatusBlocked'),
  }

  // ─── State ───
  const [tab, setTab] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [data, setData] = useState<OffboardingRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [taskLoading, setTaskLoading] = useState<string | null>(null)

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<OffboardingRow | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  // ─── Fetch ───
  const fetchData = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit, status: tab }

    apiClient
      .getList<OffboardingRow>('/api/v1/offboarding/dashboard', params)
      .then((res) => {
        setData(res.data)
        setPagination(res.pagination)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [page, limit, tab])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Task complete handler ───
  const handleTaskComplete = useCallback(
    async (offboardingId: string, taskId: string) => {
      setTaskLoading(taskId)
      try {
        await apiClient.put(
          `/api/v1/offboarding/${offboardingId}/tasks/${taskId}/complete`,
        )
        fetchData()
      } catch {
        // Error handled by apiClient
      } finally {
        setTaskLoading(null)
      }
    },
    [fetchData],
  )

  // ─── Cancel handler ───
  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      await apiClient.put(`/api/v1/offboarding/${cancelTarget.id}/cancel`)
      setCancelTarget(null)
      fetchData()
    } catch {
      // Error handled by apiClient
    } finally {
      setCancelLoading(false)
    }
  }, [cancelTarget, fetchData])

  // ─── Pagination ───
  const totalPages = pagination?.totalPages ?? 1

  // ─── Progress bar renderer ───
  const ProgressBar = useMemo(
    () =>
      function ProgressBarInner({
        completed,
        total,
      }: {
        completed: number
        total: number
      }) {
        const pct = total > 0 ? (completed / total) * 100 : 0
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-ctr-primary h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {completed}/{total}
            </span>
          </div>
        )
      },
    [],
  )

  // ─── D-day badge renderer ───
  const DdayBadge = useCallback(
    ({ daysUntil, isD3, isD7 }: { daysUntil: number; isD3: boolean; isD7: boolean }) => {
      if (isD3) {
        return (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-sm font-semibold text-red-600">D-{Math.max(daysUntil, 0)}</span>
          </div>
        )
      }
      if (isD7) {
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
            <span className="text-sm font-medium text-yellow-700">D-{daysUntil}</span>
          </div>
        )
      }
      return <span className="text-sm text-gray-500">D-{daysUntil}</span>
    },
    [],
  )

  // ─── Table columns (header) ───
  const headerCols = ['', t('employeeName'), t('resignTypeLabel'), t('lastWorkingDateLabel'), t('progressLabel'), t('statusLabel'), t('warningLabel')]
  if (isHrAdmin && tab === 'IN_PROGRESS') headerCols.push('')

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('dashboardTitle')}
        description={t('dashboardDescription')}
      />

      {/* ─── Tab Filter ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as 'IN_PROGRESS' | 'COMPLETED')
            setPage(1)
            setExpandedId(null)
          }}
        >
          <TabsList>
            <TabsTrigger value="IN_PROGRESS">{t('inProgress')}</TabsTrigger>
            <TabsTrigger value="COMPLETED">{t('completed')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={String(limit)}
          onValueChange={(v) => {
            setLimit(Number(v))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t('itemsPerPage', { n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ─── */}
      {loading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {headerCols.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {headerCols.map((_, j) => (
                    <TableCell key={`sk-${i}-${j}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-md border p-8">
          <EmptyState
            title={t('noOffboardingData')}
            description={t('noOffboardingDataDesc')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headerCols.map((h) => (
                    <TableHead key={h} className={h === t('progressLabel') ? 'w-48' : ''}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <>
                    {/* Main row */}
                    <TableRow
                      key={row.id}
                      className={
                        row.isD3
                          ? 'bg-red-50'
                          : row.isD7
                            ? 'bg-yellow-50'
                            : ''
                      }
                    >
                      <TableCell className="w-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            setExpandedId(expandedId === row.id ? null : row.id)
                          }
                        >
                          {expandedId === row.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.employee.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={RESIGN_TYPE_VARIANTS[row.resignType] ?? 'outline'}>
                          {RESIGN_TYPE_LABELS[row.resignType] ?? row.resignType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>
                            {new Date(row.lastWorkingDate).toLocaleDateString('ko-KR')}
                          </span>
                          <DdayBadge
                            daysUntil={row.daysUntil}
                            isD3={row.isD3}
                            isD7={row.isD7}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          completed={row.progress.completed}
                          total={row.progress.total}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.status] ?? 'outline'}>
                          {row.status === 'IN_PROGRESS' && (
                            <Clock className="mr-1 h-3 w-3" />
                          )}
                          {row.status === 'COMPLETED' && (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          )}
                          {row.status === 'CANCELLED' && (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.isD3 ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {t('urgent')}
                          </Badge>
                        ) : row.isD7 ? (
                          <Badge
                            variant="outline"
                            className="border-yellow-500 text-yellow-700"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {t('caution')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-700"
                          >
                            {t('normalStatus')}
                          </Badge>
                        )}
                      </TableCell>
                      {isHrAdmin && tab === 'IN_PROGRESS' && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => setCancelTarget(row)}
                          >
                            {t('cancelOffboarding')}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>

                    {/* Expanded task rows */}
                    {expandedId === row.id && (
                      <TableRow key={`${row.id}-tasks`}>
                        <TableCell
                          colSpan={headerCols.length}
                          className="bg-gray-50 p-0"
                        >
                          <div className="p-4">
                            <h4 className="text-sm font-semibold mb-3">
                              {t('taskListTitle')} ({row.checklist.name})
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t('taskLabel')}</TableHead>
                                  <TableHead>{t('assigneeLabel')}</TableHead>
                                  <TableHead>{t('requiredLabel')}</TableHead>
                                  <TableHead>{t('statusLabel')}</TableHead>
                                  {tab === 'IN_PROGRESS' && <TableHead className="w-24" />}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.offboardingTasks.map((tsk) => (
                                  <TableRow key={tsk.id}>
                                    <TableCell className="text-sm">
                                      {tsk.task.title}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ASSIGNEE_COLORS[tsk.task.assigneeType] ?? 'bg-gray-100 text-gray-700'}`}
                                      >
                                        {ASSIGNEE_LABELS[tsk.task.assigneeType] ??
                                          tsk.task.assigneeType}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-xs">
                                        {tsk.task.isRequired ? t('requiredTask') : t('optionalTask')}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {tsk.status === 'DONE' ? (
                                        <Badge variant="secondary">
                                          <CheckCircle2 className="mr-1 h-3 w-3" />
                                          {TASK_STATUS_LABELS[tsk.status]}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">
                                          {TASK_STATUS_LABELS[tsk.status] ?? tsk.status}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    {tab === 'IN_PROGRESS' && (
                                      <TableCell>
                                        {tsk.status === 'PENDING' && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs"
                                            disabled={taskLoading === tsk.id}
                                            onClick={() =>
                                              handleTaskComplete(row.id, tsk.id)
                                            }
                                          >
                                            {taskLoading === tsk.id
                                              ? t('processing')
                                              : t('completeBtn')}
                                          </Button>
                                        )}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                {t('totalItems', { total: pagination?.total.toLocaleString() ?? '0' })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {tCommon('prev')}
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {tCommon('next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Cancel Offboarding Dialog ─── */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelOffboardingTitle')}</DialogTitle>
            <DialogDescription>
              {t('cancelOffboardingDesc', { name: cancelTarget?.employee.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {tCommon('close')}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="bg-ctr-accent hover:bg-ctr-accent/90 text-white"
            >
              {cancelLoading ? t('processing') : t('cancelOffboardingConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
