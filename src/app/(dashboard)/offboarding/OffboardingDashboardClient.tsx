'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Dashboard Client
// 퇴직처리 현황: 진행률, D-day 경고, 태스크 완료, 취소
// ═══════════════════════════════════════════════════════════

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
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
  completedById: string | null
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

interface Company {
  id: string
  code: string
  name: string
}

interface OffboardingDashboardClientProps {
  user: SessionUser
  companies?: Company[]
}

// ─── Constants ──────────────────────────────────────────────


const ASSIGNEE_COLORS: Record<string, string> = {
  EMPLOYEE: 'bg-muted text-foreground',
  MANAGER: 'bg-primary/10 text-primary/90',
  HR: 'bg-tertiary-container/20 text-tertiary',
  IT: 'bg-wt-4/10 text-wt-4',
  FINANCE: 'bg-warning-bright/15 text-ctr-warning',
}

const LIMIT_OPTIONS = [10, 20, 50]

// ─── Component ──────────────────────────────────────────────

export function OffboardingDashboardClient({ user, companies = [] }: OffboardingDashboardClientProps) {
  const t = useTranslations('offboarding')
  const tCommon = useTranslations('common')
  const locale = useLocale()

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
  const [companyIdFilter, setCompanyIdFilter] = useState('')
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
  const isSuperAdmin = user.role === ROLE.SUPER_ADMIN

  // ─── Fetch ───
  const fetchData = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit, status: tab }
    if (companyIdFilter) params.companyId = companyIdFilter

    apiClient
      .getList<OffboardingRow>('/api/v1/offboarding/dashboard', params)
      .then((res) => {
        setData(res.data)
        setPagination(res.pagination)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [page, limit, tab, companyIdFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Task complete handler ───
  const handleTaskComplete = useCallback(
    async (offboardingId: string, taskId: string, currentStatus: string) => {
      setTaskLoading(taskId)
      try {
        // HR task 완료: 정식 상태 route는 상태머신(PENDING→IN_PROGRESS→DONE)을 거침.
        // 이미 IN_PROGRESS면(이전 시도 중단) 첫 단계 생략 → 재완료 가능. (레거시 /complete는 직원 셀프 전용 → HR 404)
        if (currentStatus === 'PENDING') {
          await apiClient.put(
            `/api/v1/offboarding/instances/${offboardingId}/tasks/${taskId}/status`,
            { status: 'IN_PROGRESS' },
          )
        }
        await apiClient.put(
          `/api/v1/offboarding/instances/${offboardingId}/tasks/${taskId}/status`,
          { status: 'DONE' },
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
            <div
              className="flex-1 bg-border rounded-full h-2"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progressAriaLabel', { completed, total })}
            >
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {completed}/{total}
            </span>
          </div>
        )
      },
    [t],
  )

  // ─── D-day badge renderer ───
  const DdayBadge = useCallback(
    ({ daysUntil, isD3, isD7 }: { daysUntil: number; isD3: boolean; isD7: boolean }) => {
      if (isD3) {
        return (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive/50" />
            </span>
            <span className="text-sm font-semibold text-destructive">D-{Math.max(daysUntil, 0)}</span>
          </div>
        )
      }
      if (isD7) {
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-warning-bright" />
            <span className="text-sm font-medium text-ctr-warning">D-{daysUntil}</span>
          </div>
        )
      }
      return <span className="text-sm text-muted-foreground">D-{daysUntil}</span>
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

        {/* SUPER_ADMIN only: company filter */}
        {isSuperAdmin && companies.length > 0 && (
          <Select
            value={companyIdFilter || '__ALL__'}
            onValueChange={(v) => {
              setCompanyIdFilter(v === '__ALL__' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('dashboard.allCompanies')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">{t('dashboard.allCompanies')}</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
                {headerCols.map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
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
                  {headerCols.map((h, i) => (
                    <TableHead key={i} className={h === t('progressLabel') ? 'w-48' : ''}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <Fragment key={row.id}>
                    {/* Main row */}
                    <TableRow
                      className={
                        row.isD3
                          ? 'bg-destructive/10'
                          : row.isD7
                            ? 'bg-warning-bright/15'
                            : ''
                      }
                    >
                      <TableCell className="w-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          aria-label={t('dashboard.toggleTasks')}
                          aria-expanded={expandedId === row.id}
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
                        <StatusBadge status={row.resignType}>
                          {RESIGN_TYPE_LABELS[row.resignType] ?? row.resignType}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>
                            {new Date(row.lastWorkingDate).toLocaleDateString(locale)}
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
                        <StatusBadge status={row.status}>
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
                        </StatusBadge>
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
                            className="border-warning-bright text-ctr-warning"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {t('caution')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-tertiary text-[#006b39]"
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
                            className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
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
                          className="bg-background p-0"
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
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ASSIGNEE_COLORS[tsk.task.assigneeType] ?? 'bg-muted text-foreground'}`}
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
                                        {(tsk.status === 'PENDING' || tsk.status === 'IN_PROGRESS') && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs"
                                            disabled={taskLoading === tsk.id}
                                            onClick={() =>
                                              handleTaskComplete(row.id, tsk.id, tsk.status)
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
                  </Fragment>
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
              className="bg-destructive hover:brightness-95 text-white"
            >
              {cancelLoading ? t('processing') : t('cancelOffboardingConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
