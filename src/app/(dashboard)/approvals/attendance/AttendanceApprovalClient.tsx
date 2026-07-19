'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Approval Client
// 근태 승인 목록, 개별 보정 비교, claim/approve/reject
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Inbox, CalendarDays, Clock, ArrowRightLeft, ClipboardList,
  CheckCircle2, XCircle, Loader2, AlertTriangle, ChevronLeft, ChevronRight,
  Filter, RefreshCw, User, MessageSquare, CheckSquare, Square,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { isAppError } from '@/lib/errors'
import type { SessionUser } from '@/types'

// ─── Types ─────────────────────────────────────────────────

interface ApprovalStep {
  id: string
  stepOrder: number
  approverId: string
  status: string
  comment: string | null
  decidedAt: string | null
  approver: { id: string; name: string }
}

interface ApprovalRequest {
  id: string
  requestType: string
  referenceId: string | null
  title: string
  details: Record<string, unknown> | null
  status: string
  currentStep: number
  createdAt: string
  requester: { id: string; name: string; employeeNo: string | null }
  steps: ApprovalStep[]
  correctionState?: CorrectionState
}

type ViewMode = 'pending-approval' | 'mine' | 'team'
type RequestTypeFilter = 'all' | 'leave' | 'overtime' | 'attendance_correction' | 'shift_change'
type RequestStatusFilter = 'pending' | 'approved' | 'rejected'
type CorrectionState = 'ready' | 'stale' | 'payroll_locked' | 'invalid'

interface AttendanceCorrectionDetails {
  version: 1
  workDate: string
  timezone: string
  reason: string
  schedule: {
    startHHmm: string
    endHHmm: string
    source: 'shift' | 'base'
  }
  before: {
    clockIn: string | null
    clockOut: string | null
    totalMinutes: number | null
    overtimeMinutes: number | null
    status: 'NORMAL' | 'LATE' | 'EARLY_OUT' | 'ABSENT'
    workType: 'NORMAL' | 'OVERTIME' | 'NIGHT' | 'HOLIDAY'
    note: string | null
  }
  requested: {
    clockIn: string | null
    clockOut: string | null
  }
}

// ─── Constants ──────────────────────────────────────────────

const CORRECTION_ERROR_KEYS: Record<string, string> = {
  ATTENDANCE_CORRECTION_DUPLICATE: 'correctionErrorDuplicate',
  ATTENDANCE_PERIOD_LOCKED: 'correctionErrorPeriodLocked',
  ATTENDANCE_CORRECTION_STALE: 'correctionErrorStale',
  ATTENDANCE_CORRECTION_DECISION_RACE: 'correctionErrorDecisionRace',
  ATTENDANCE_CLOCK_RACE: 'correctionErrorClockRace',
  ATTENDANCE_CORRECTION_INVALID: 'correctionErrorInvalid',
  ATTENDANCE_CORRECTION_CLAIM_REQUIRED: 'correctionErrorClaimRequired',
  ATTENDANCE_CORRECTION_NO_APPROVER: 'correctionErrorNoApprover',
}

const VIEW_MODES = new Set<ViewMode>(['pending-approval', 'mine', 'team'])
const REQUEST_TYPE_FILTERS = new Set<RequestTypeFilter>([
  'all',
  'leave',
  'overtime',
  'attendance_correction',
  'shift_change',
])
const REQUEST_STATUS_FILTERS = new Set<RequestStatusFilter>(['pending', 'approved', 'rejected'])

const REQUEST_TYPE_LABELS: Record<string, { labelKey: string; icon: React.ReactNode; color: string }> = {
  leave: { labelKey: 'typeLeave', icon: <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />, color: 'bg-primary/10 text-emerald-700' },
  overtime: { labelKey: 'typeOvertime', icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />, color: 'bg-amber-500/15 text-amber-700' },
  attendance_correction: { labelKey: 'typeAttendanceCorrection', icon: <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />, color: 'bg-primary/15 text-primary/90' },
  shift_change: { labelKey: 'typeShiftChange', icon: <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />, color: 'bg-orange-500/10 text-orange-700' },
}

const STATUS_LABELS: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: 'statusPending', color: 'bg-amber-500/15 text-amber-700 border-amber-300' },
  approved: { labelKey: 'statusApproved', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  rejected: { labelKey: 'statusRejected', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { labelKey: 'statusCancelled', color: 'bg-background text-muted-foreground border-border' },
}

const ATTENDANCE_STATUS_LABELS: Record<AttendanceCorrectionDetails['before']['status'], string> = {
  NORMAL: 'normal',
  LATE: 'late',
  EARLY_OUT: 'earlyOut',
  ABSENT: 'absent',
}

const WORK_TYPE_LABELS: Record<AttendanceCorrectionDetails['before']['workType'], string> = {
  NORMAL: 'regular',
  OVERTIME: 'overtime',
  NIGHT: 'night',
  HOLIDAY: 'holiday',
}

// ─── Helpers ────────────────────────────────────────────────

function parseViewMode(value: string | null): ViewMode {
  return value && VIEW_MODES.has(value as ViewMode) ? value as ViewMode : 'pending-approval'
}

function parseRequestTypeFilter(value: string | null): RequestTypeFilter {
  return value && REQUEST_TYPE_FILTERS.has(value as RequestTypeFilter)
    ? value as RequestTypeFilter
    : 'all'
}

function parseRequestStatusFilter(value: string | null): RequestStatusFilter | null {
  return value && REQUEST_STATUS_FILTERS.has(value as RequestStatusFilter)
    ? value as RequestStatusFilter
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isNullableNumber(value: unknown): value is number | null {
  return (typeof value === 'number' && Number.isFinite(value)) || value === null
}

function parseCorrectionDetails(value: unknown): AttendanceCorrectionDetails | null {
  if (!isRecord(value) || value.version !== 1) return null

  const { schedule, before, requested } = value
  if (!isRecord(schedule) || !isRecord(before) || !isRecord(requested)) return null
  if (
    typeof value.workDate !== 'string' ||
    typeof value.timezone !== 'string' ||
    typeof value.reason !== 'string' ||
    typeof schedule.startHHmm !== 'string' ||
    typeof schedule.endHHmm !== 'string' ||
    !['shift', 'base'].includes(String(schedule.source)) ||
    !isNullableString(before.clockIn) ||
    !isNullableString(before.clockOut) ||
    !isNullableNumber(before.totalMinutes) ||
    !isNullableNumber(before.overtimeMinutes) ||
    !['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT'].includes(String(before.status)) ||
    !['NORMAL', 'OVERTIME', 'NIGHT', 'HOLIDAY'].includes(String(before.workType)) ||
    !isNullableString(before.note) ||
    !isNullableString(requested.clockIn) ||
    !isNullableString(requested.clockOut)
  ) {
    return null
  }

  return value as unknown as AttendanceCorrectionDetails
}

function formatCorrectionTime(value: string | null, locale: string, timeZone: string): string {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

// ─── Components ─────────────────────────────────────────────

function CorrectionDetailsPanel({
  request,
  loading,
  onRefresh,
}: {
  request: ApprovalRequest
  loading: boolean
  onRefresh: () => void
}) {
  const t = useTranslations('attendance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const details = parseCorrectionDetails(request.details)
  const correctionState: CorrectionState = details ? request.correctionState ?? 'invalid' : 'invalid'

  const statePresentation: Record<CorrectionState, { label: string; className: string }> = {
    ready: {
      label: t('correctionStateReady'),
      className: 'border-emerald-200 bg-emerald-500/10 text-emerald-700',
    },
    stale: {
      label: t('correctionStateStale'),
      className: 'border-amber-300 bg-amber-500/10 text-amber-700',
    },
    payroll_locked: {
      label: t('correctionStatePayrollLocked'),
      className: 'border-red-300 bg-destructive/10 text-destructive',
    },
    invalid: {
      label: t('correctionStateInvalid'),
      className: 'border-red-300 bg-destructive/10 text-destructive',
    },
  }
  const state = statePresentation[correctionState]

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted py-8" role="status" aria-label={tc('loading')}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        data-correction-state={correctionState}
        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-medium ${state.className}`}
      >
        <span className="flex items-center gap-1.5">
          {correctionState === 'ready' ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {state.label}
        </span>
        {correctionState !== 'ready' && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-background/60"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {tc('refresh')}
          </button>
        )}
      </div>

      {details ? (
        <>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{t('workDate')}</span>
              <span className="text-muted-foreground">{details.workDate} · {details.timezone}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{t('workHours')}</span>
              <span className="text-muted-foreground">{details.schedule.startHHmm}–{details.schedule.endHHmm}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{tc('previous')}</p>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t('clockInTime')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatCorrectionTime(details.before.clockIn, locale, details.timezone)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('clockOutTime')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatCorrectionTime(details.before.clockOut, locale, details.timezone)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('status')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {t(ATTENDANCE_STATUS_LABELS[details.before.status])}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('workType')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {t(WORK_TYPE_LABELS[details.before.workType])}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('totalMinutes')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{details.before.totalMinutes ?? '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-semibold text-primary">{t('requestCorrection')}</p>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t('clockInTime')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatCorrectionTime(details.requested.clockIn, locale, details.timezone)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('clockOutTime')}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatCorrectionTime(details.requested.clockOut, locale, details.timezone)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs">
            <p className="font-semibold text-muted-foreground">{t('correctionReason')}</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{details.reason}</p>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          {t('processFailed')}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function AttendanceApprovalClient({ user }: { user: SessionUser }) {
  const t = useTranslations('attendance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryView = parseViewMode(searchParams.get('view'))
  const queryTypeFilter = parseRequestTypeFilter(searchParams.get('requestType'))
  const statusFilter = parseRequestStatusFilter(searchParams.get('status'))
  const [view, setView] = useState<ViewMode>(queryView)
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>(queryTypeFilter)
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ApprovalRequest | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [comment, setComment] = useState('')
  const detailRequestSequence = useRef(0)

  // ── Bulk selection state ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // 체크 가능한 항목 (내가 승인해야 하는 pending 항목)
  const checkableRequests = requests.filter(
    (r) =>
      r.requestType !== 'attendance_correction' &&
      r.status === 'pending' &&
      r.steps.some(
        (s) => s.stepOrder === r.currentStep && s.status === 'pending' && s.approverId === user.employeeId
      )
  )
  const allChecked =
    checkableRequests.length > 0 && checkableRequests.every((r) => selectedIds.has(r.id))
  const someChecked = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(checkableRequests.map((r) => r.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const replaceQuery = useCallback((nextView: ViewMode, nextType: RequestTypeFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', nextView)
    if (nextType === 'all') params.delete('requestType')
    else params.set('requestType', nextType)
    router.replace(`/approvals/attendance?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // 뷰 변경 시 선택 초기화
  const changeView = (v: ViewMode) => {
    setView(v)
    setSelected(null)
    setComment('')
    setSelectedIds(new Set())
    replaceQuery(v, typeFilter)
  }

  const changeTypeFilter = (nextType: RequestTypeFilter) => {
    setTypeFilter(nextType)
    setSelected(null)
    setComment('')
    setSelectedIds(new Set())
    replaceQuery(view, nextType)
  }

  useEffect(() => {
    setView(queryView)
    setTypeFilter(queryTypeFilter)
    setSelected(null)
    setComment('')
    setSelectedIds(new Set())
  }, [queryTypeFilter, queryView, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedIds(new Set())
    try {
      const params: Record<string, string> = { view, limit: '30' }
      if (typeFilter !== 'all') params.requestType = typeFilter
      if (statusFilter) params.status = statusFilter
      const res = await apiClient.get<{ items: ApprovalRequest[]; total: number }>(
        '/api/v1/approvals/attendance',
        params
      )
      const raw = res as unknown as { data: ApprovalRequest[]; pagination: { total: number } }
      setRequests(raw.data ?? [])
      setTotal(raw.pagination?.total ?? 0)
    } catch {
      setError(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [view, typeFilter, statusFilter, t])

  useEffect(() => { load() }, [load])

  const loadCorrectionDetail = useCallback(async (request: ApprovalRequest, showError = true) => {
    const sequence = ++detailRequestSequence.current
    setDetailLoading(true)
    try {
      const res = await apiClient.get<ApprovalRequest>(`/api/v1/approvals/attendance/${request.id}`)
      if (sequence !== detailRequestSequence.current) return

      setSelected((current) => current?.id === request.id ? res.data : current)
    } catch {
      if (sequence === detailRequestSequence.current && showError) {
        toast({ title: t('loadFailed'), variant: 'destructive' })
      }
    } finally {
      if (sequence === detailRequestSequence.current) setDetailLoading(false)
    }
  }, [t])

  const openRequest = (request: ApprovalRequest) => {
    setSelected(request)
    setComment('')
    if (request.requestType === 'attendance_correction') {
      void loadCorrectionDetail(request)
    } else {
      detailRequestSequence.current += 1
      setDetailLoading(false)
    }
  }

  const closeRequest = () => {
    detailRequestSequence.current += 1
    setSelected(null)
    setComment('')
    setDetailLoading(false)
  }

  const refreshSelected = () => {
    if (selected?.requestType === 'attendance_correction') {
      void loadCorrectionDetail(selected)
    }
  }

  const handleAction = async (action: 'approve' | 'reject' | 'claim') => {
    if (!selected) return
    if (
      action === 'approve' &&
      selected.requestType === 'attendance_correction' &&
      (selected.correctionState !== 'ready' || !parseCorrectionDetails(selected.details))
    ) {
      return
    }

    setApproving(true)
    try {
      await apiClient.put(
        `/api/v1/approvals/attendance/${selected.id}`,
        { action, comment },
      )
      if (action === 'claim') {
        await loadCorrectionDetail(selected, false)
        return
      }

      setComment('')
      setSelected(null)
      await load()
    } catch (error) {
      const errorKey =
        selected.requestType === 'attendance_correction' && isAppError(error)
          ? CORRECTION_ERROR_KEYS[error.code]
          : undefined
      toast({
        title: t('processFailed'),
        description: errorKey ? t(errorKey) : undefined,
        variant: 'destructive',
      })
      if (selected.requestType === 'attendance_correction') {
        await loadCorrectionDetail(selected, false)
      }
    } finally {
      setApproving(false)
    }
  }

  const handleBulkAction = async (action: 'APPROVE' | 'REJECT') => {
    const eligibleIds = checkableRequests
      .filter((request) => selectedIds.has(request.id))
      .map((request) => request.id)
    if (eligibleIds.length === 0) return
    setBulkProcessing(true)
    try {
      const res = await apiClient.post<{ processed: number; skipped: number }>(
        '/api/v1/approvals/attendance/bulk',
        { ids: eligibleIds, action }
      )
      const { processed, skipped } = res.data
      toast({ title: skipped > 0 ? t('processedResultWithSkipped', { processed, skipped }) : t('processedResult', { processed }) })
      setSelectedIds(new Set())
      setSelected(null)
      await load()
    } catch {
      toast({ title: t('bulkProcessFailed'), variant: 'destructive' })
    } finally {
      setBulkProcessing(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const showBulkBar = view === 'pending-approval' && someChecked
  const selectedHasCurrentStep = Boolean(
    selected?.steps.some(
      (step) =>
        step.stepOrder === selected.currentStep &&
        step.status === 'pending' &&
        step.approverId === user.employeeId,
    ),
  )
  const correctionApprovalBlocked = Boolean(
    selected?.requestType === 'attendance_correction' &&
    (selected.correctionState !== 'ready' || !parseCorrectionDetails(selected.details)),
  )
  const canClaimSelectedCorrection = Boolean(
    selected?.requestType === 'attendance_correction' &&
    selected.status === 'pending' &&
    !selectedHasCurrentStep &&
    selected.requester.id !== user.employeeId,
  )

  return (
    <div className="flex h-full flex-col space-y-6 p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="w-6 h-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('approvalInbox')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('approvalInboxDesc')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          {tc('refresh')}
        </button>
      </div>

      {/* 뷰 탭 */}
      <div className="flex flex-shrink-0 overflow-x-auto border-b border-border">
        {([
          { key: 'pending-approval', labelKey: 'pendingApproval', badge: pendingCount },
          { key: 'mine', labelKey: 'myRequests' },
          { key: 'team', labelKey: 'teamAll' },
        ] as { key: ViewMode; labelKey: string; badge?: number }[]).map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => changeView(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
              view === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(tab.labelKey)}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary text-white rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-shrink-0 items-center gap-3 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <div className="flex shrink-0 gap-2">
          {([
            { key: 'all', labelKey: 'filterAll' },
            { key: 'leave', labelKey: 'typeLeave' },
            { key: 'overtime', labelKey: 'typeOvertime' },
            { key: 'attendance_correction', labelKey: 'typeAttendanceCorrection' },
            { key: 'shift_change', labelKey: 'typeShiftChange' },
          ] as { key: RequestTypeFilter; labelKey: string }[]).map((f) => (
            <button
              type="button"
              key={f.key}
              onClick={() => changeTypeFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                typeFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{t('totalCount', { count: total })}</span>
      </div>

      {/* 컨텐츠 */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        {/* 목록 */}
        <div className={`${selected ? 'hidden lg:flex' : 'flex'} min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card`}>
          {/* Select All 헤더 (pending-approval 뷰 + checkable 항목 있을 때만) */}
          {view === 'pending-approval' && checkableRequests.length > 0 && !loading && (
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-background">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 rounded-sm text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-pressed={allChecked}
              >
                {allChecked ? (
                  <CheckSquare className="w-4 h-4 text-primary" aria-hidden="true" />
                ) : (
                  <Square className="w-4 h-4" aria-hidden="true" />
                )}
                {tc('selectAll')}
              </button>
              {someChecked && (
                <span className="text-xs text-primary font-medium ml-1">{t('itemsSelected', { count: selectedIds.size })}</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16" role="status" aria-label={tc('loading')}>
              <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-6 text-destructive">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              {error}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <EmptyState />
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-muted">
              {requests.map((r) => {
                const typeInfo = REQUEST_TYPE_LABELS[r.requestType] ?? { labelKey: r.requestType, icon: null, color: 'bg-muted text-muted-foreground' }
                const statusInfo = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
                const isSelected = selected?.id === r.id
                const isCheckable =
                  view === 'pending-approval' &&
                  r.requestType !== 'attendance_correction' &&
                  r.status === 'pending' &&
                  r.steps.some(
                    (s) => s.stepOrder === r.currentStep && s.status === 'pending' && s.approverId === user.employeeId
                  )
                const isChecked = selectedIds.has(r.id)

                return (
                  <div
                    key={r.id}
                    className={`flex items-start px-5 py-4 transition-colors hover:bg-muted ${isSelected ? 'bg-primary/10' : ''}`}
                  >
                    {/* 체크박스 */}
                    {isCheckable && (
                      <button
                        type="button"
                        className="mr-2 inline-flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:mr-3 lg:mt-0.5 lg:min-h-6 lg:min-w-6"
                        onClick={() => toggleSelect(r.id)}
                        aria-label={`${tc('select')} ${r.title}`}
                        aria-pressed={isChecked}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-primary" aria-hidden="true" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground hover:text-primary" aria-hidden="true" />
                        )}
                      </button>
                    )}
                    {!isCheckable && view === 'pending-approval' && checkableRequests.length > 0 && (
                      <div className="mr-2 min-h-11 min-w-11 flex-shrink-0 lg:mr-3 lg:mt-0.5 lg:min-h-6 lg:min-w-6" />
                    )}

                    {/* 내용 */}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openRequest(r)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.icon}
                            {t(typeInfo.labelKey)}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                            {t(statusInfo.labelKey)}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" aria-hidden="true" />
                            {r.requester.name}
                          </span>
                          <span>{formatDateTime(r.createdAt, locale)}</span>
                          <span>{t('approvalProgress', { approved: r.steps.filter((s) => s.status === 'approved').length, total: r.steps.length })}</span>
                        </div>
                      </div>
                      <ChevronRight className="ml-2 mt-1 w-4 flex-shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card lg:w-96 lg:flex-none">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3 lg:py-4">
              <button
                type="button"
                onClick={closeRequest}
                className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {tc('back')}
              </button>
              <h3 className="text-sm font-semibold text-foreground">{t('requestDetail')}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 기본 정보 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const typeInfo = REQUEST_TYPE_LABELS[selected.requestType]
                    if (!typeInfo) return null
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.icon}
                        {t(typeInfo.labelKey)}
                      </span>
                    )
                  })()}
                  {(() => {
                    const statusInfo = STATUS_LABELS[selected.status]
                    if (!statusInfo) return null
                    return (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                        {t(statusInfo.labelKey)}
                      </span>
                    )
                  })()}
                </div>
                <p className="text-base font-semibold text-foreground">{selected.title}</p>
                <p className="text-xs text-muted-foreground">{t('applicant')}: {selected.requester.name} ({selected.requester.employeeNo ?? '—'})</p>
                <p className="text-xs text-muted-foreground">{t('applicationDate')}: {new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(selected.createdAt))}</p>
              </div>

              {/* 상세 내용 */}
              {selected.requestType === 'attendance_correction' ? (
                <CorrectionDetailsPanel
                  request={selected}
                  loading={detailLoading}
                  onRefresh={refreshSelected}
                />
              ) : selected.details && Object.keys(selected.details).length > 0 ? (
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  {Object.entries(selected.details).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground flex-shrink-0">{k}:</span>
                      <span className="text-foreground">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* 승인 타임라인 */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('approvalSteps')}</p>
                <div className="space-y-3">
                  {selected.steps.map((step, idx) => {
                    const isCurrent = step.stepOrder === selected.currentStep && step.status === 'pending'
                    return (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          step.status === 'approved' ? 'bg-emerald-600 text-white' :
                          step.status === 'rejected' ? 'bg-destructive text-destructive-foreground' :
                          isCurrent ? 'bg-primary text-white' :
                          'bg-border text-muted-foreground'
                        }`}>
                          {step.status === 'approved' ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> :
                           step.status === 'rejected' ? <XCircle className="w-4 h-4" aria-hidden="true" /> :
                           idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{step.approver.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {step.status === 'approved' && step.decidedAt && t('approvedAt', { time: formatDateTime(step.decidedAt, locale) })}
                            {step.status === 'rejected' && step.decidedAt && t('rejectedAt', { time: formatDateTime(step.decidedAt, locale) })}
                            {isCurrent && t('approvalPending')}
                            {step.status === 'waiting' && t('waiting')}
                          </p>
                          {step.comment && (
                            <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                              <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
                              {step.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 개별 승인/반려 액션 */}
              {selected.status === 'pending' && (selectedHasCurrentStep || canClaimSelectedCorrection) && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  {selectedHasCurrentStep ? (
                    <>
                      <label
                        htmlFor="attendance-approval-comment"
                        className="text-sm font-medium text-foreground"
                      >
                        {t('commentOptional')}
                      </label>
                      <textarea
                        id="attendance-approval-comment"
                        name="attendanceApprovalComment"
                        autoComplete="off"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        placeholder={t('approvalReasonPlaceholder')}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none placeholder:text-muted-foreground/60"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction('reject')}
                          disabled={approving}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        >
                          {approving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                          {tc('reject')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction('approve')}
                          disabled={approving || detailLoading || correctionApprovalBlocked}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-warm px-3 py-2 text-sm font-medium text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        >
                          {approving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                          {tc('approve')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction('claim')}
                      disabled={approving}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-warm px-3 py-2 text-sm font-medium text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <User className="w-4 h-4" aria-hidden="true" />}
                      {t('claimCorrection')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Bulk Action Bar ────────────────────────── */}
      {showBulkBar && (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:flex-nowrap sm:gap-4 sm:px-5 md:bottom-6">
          <span className="text-sm font-semibold text-foreground">
            {t('itemsSelected', { count: selectedIds.size })}
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => handleBulkAction('REJECT')}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
            {t('bulkReject')}
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction('APPROVE')}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-warm px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            {t('bulkApprove')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="min-h-11 rounded-sm px-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
          >
            {tc('cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
