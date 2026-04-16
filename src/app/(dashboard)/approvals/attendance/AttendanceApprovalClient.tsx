'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { apiClient } from '@/lib/api'
import {
  Inbox, CalendarDays, Clock, ArrowRightLeft, ClipboardList,
  CheckCircle2, XCircle, Loader2, AlertTriangle, ChevronRight,
  Filter, RefreshCw, User, MessageSquare, CheckSquare, Square,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'

// ─── 타입 ─────────────────────────────────────────────────

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
}

type ViewMode = 'pending-approval' | 'mine' | 'team'
type RequestTypeFilter = 'all' | 'leave' | 'overtime' | 'attendance_correction' | 'shift_change'

const REQUEST_TYPE_LABELS: Record<string, { labelKey: string; icon: React.ReactNode; color: string }> = {
  leave: { labelKey: 'typeLeave', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'bg-primary/10 text-emerald-700' },
  overtime: { labelKey: 'typeOvertime', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-amber-500/15 text-amber-700' },
  attendance_correction: { labelKey: 'typeAttendanceCorrection', icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'bg-indigo-500/15 text-primary/90' },
  shift_change: { labelKey: 'typeShiftChange', icon: <ArrowRightLeft className="w-3.5 h-3.5" />, color: 'bg-orange-500/10 text-orange-700' },
}

const STATUS_LABELS: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: 'statusPending', color: 'bg-amber-500/15 text-amber-700 border-amber-300' },
  approved: { labelKey: 'statusApproved', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  rejected: { labelKey: 'statusRejected', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  cancelled: { labelKey: 'statusCancelled', color: 'bg-background text-muted-foreground border-border' },
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function AttendanceApprovalClient({ user }: { user: SessionUser }) {
  const t = useTranslations('attendance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [view, setView] = useState<ViewMode>('pending-approval')
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all')
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ApprovalRequest | null>(null)
  const [approving, setApproving] = useState(false)
  const [comment, setComment] = useState('')

  // ── Bulk selection state ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // 체크 가능한 항목 (내가 승인해야 하는 pending 항목)
  const checkableRequests = requests.filter(
    (r) =>
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

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 뷰 변경 시 선택 초기화
  const changeView = (v: ViewMode) => {
    setView(v)
    setSelected(null)
    setSelectedIds(new Set())
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedIds(new Set())
    try {
      const params: Record<string, string> = { view, limit: '30' }
      if (typeFilter !== 'all') params.requestType = typeFilter
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
  }, [view, typeFilter, t])

  useEffect(() => { load() }, [load])

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selected) return
    setApproving(true)
    try {
      await apiClient.put(`/api/v1/approvals/attendance/${selected.id}`, { action, comment })
      setComment('')
      setSelected(null)
      await load()
    } catch {
      toast({ title: t('processFailed'), variant: 'destructive' })
    } finally {
      setApproving(false)
    }
  }

  const handleBulkAction = async (action: 'APPROVE' | 'REJECT') => {
    if (selectedIds.size === 0) return
    setBulkProcessing(true)
    try {
      const res = await apiClient.post<{ processed: number; skipped: number }>(
        '/api/v1/approvals/attendance/bulk',
        { ids: Array.from(selectedIds), action }
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

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Inbox className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('approvalInbox')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('approvalInboxDesc')}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm text-muted-foreground motion-safe:transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          {tc('refresh')}
        </button>
      </div>

      {/* 뷰 탭 */}
      <div className="flex border-b border-border flex-shrink-0">
        {([
          { key: 'pending-approval', labelKey: 'pendingApproval', badge: pendingCount },
          { key: 'mine', labelKey: 'myRequests' },
          { key: 'team', labelKey: 'teamAll' },
        ] as { key: ViewMode; labelKey: string; badge?: number }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => changeView(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
      <div className="flex items-center gap-3 flex-shrink-0">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-2">
          {([
            { key: 'all', labelKey: 'filterAll' },
            { key: 'leave', labelKey: 'typeLeave' },
            { key: 'overtime', labelKey: 'typeOvertime' },
            { key: 'attendance_correction', labelKey: 'typeAttendanceCorrection' },
            { key: 'shift_change', labelKey: 'typeShiftChange' },
          ] as { key: RequestTypeFilter; labelKey: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                typeFilter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{t('totalCount', { count: total })}</span>
      </div>

      {/* 컨텐츠 */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* 목록 */}
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          {/* Select All 헤더 (pending-approval 뷰 + checkable 항목 있을 때만) */}
          {view === 'pending-approval' && checkableRequests.length > 0 && !loading && (
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-background">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {allChecked ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {tc('selectAll')}
              </button>
              {someChecked && (
                <span className="text-xs text-primary font-medium ml-1">{t('itemsSelected', { count: selectedIds.size })}</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400 p-6">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="w-10 h-10 mb-2 opacity-40" />
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
                  r.status === 'pending' &&
                  r.steps.some(
                    (s) => s.stepOrder === r.currentStep && s.status === 'pending' && s.approverId === user.employeeId
                  )
                const isChecked = selectedIds.has(r.id)

                return (
                  <div
                    key={r.id}
                    className={`flex items-start px-5 py-4 hover:bg-muted transition-colors cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                    onClick={() => setSelected(r)}
                  >
                    {/* 체크박스 */}
                    {isCheckable && (
                      <div
                        className="flex-shrink-0 mr-3 mt-0.5"
                        onClick={(e) => toggleSelect(r.id, e)}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/60 hover:text-primary" />
                        )}
                      </div>
                    )}
                    {!isCheckable && view === 'pending-approval' && checkableRequests.length > 0 && (
                      <div className="flex-shrink-0 mr-3 mt-0.5 w-4" />
                    )}

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.icon}
                          {t(typeInfo.labelKey)}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                          {t(statusInfo.labelKey)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {r.requester.name}
                        </span>
                        <span>{new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(r.createdAt))}</span>
                        <span>{t('approvalProgress', { approved: r.steps.filter((s) => s.status === 'approved').length, total: r.steps.length })}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0 mt-1 ml-2" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="w-96 flex-shrink-0 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
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
              {selected.details && Object.keys(selected.details).length > 0 && (
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  {Object.entries(selected.details).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground flex-shrink-0">{k}:</span>
                      <span className="text-foreground">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

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
                          step.status === 'rejected' ? 'bg-red-400 text-white' :
                          isCurrent ? 'bg-primary text-white' :
                          'bg-border text-muted-foreground'
                        }`}>
                          {step.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> :
                           step.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                           idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{step.approver.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {step.status === 'approved' && step.decidedAt && t('approvedAt', { time: format(new Date(step.decidedAt), 'M/d HH:mm') })}
                            {step.status === 'rejected' && step.decidedAt && t('rejectedAt', { time: format(new Date(step.decidedAt), 'M/d HH:mm') })}
                            {isCurrent && t('approvalPending')}
                            {step.status === 'waiting' && t('waiting')}
                          </p>
                          {step.comment && (
                            <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                              <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
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
              {selected.status === 'pending' &&
               selected.steps.some(
                 (s) => s.stepOrder === selected.currentStep &&
                         s.status === 'pending' &&
                         s.approverId === user.employeeId
               ) && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{t('commentOptional')}</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder={t('approvalReasonPlaceholder')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 focus:border-primary resize-none placeholder:text-muted-foreground/60"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-red-400 text-red-400 hover:bg-destructive/5 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      {tc('reject')}
                    </button>
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {tc('approve')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Bulk Action Bar ────────────────────────── */}
      {showBulkBar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 bg-card rounded-xl shadow-lg border border-border">
          <span className="text-sm font-semibold text-foreground">
            {t('itemsSelected', { count: selectedIds.size })}
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => handleBulkAction('REJECT')}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-400 text-red-400 hover:bg-destructive/5 rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {t('bulkReject')}
          </button>
          <button
            onClick={() => handleBulkAction('APPROVE')}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {t('bulkApprove')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {tc('cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
