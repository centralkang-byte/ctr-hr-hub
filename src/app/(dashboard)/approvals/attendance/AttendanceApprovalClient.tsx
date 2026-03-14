'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  Inbox, CalendarDays, Clock, ArrowRightLeft, ClipboardList,
  CheckCircle2, XCircle, Loader2, AlertTriangle, ChevronRight,
  Filter, RefreshCw, User, MessageSquare, CheckSquare, Square,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

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

const REQUEST_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  leave: { label: '휴가', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'bg-[#EDF1FE] text-[#047857]' },
  overtime: { label: '초과근무', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-[#FEF3C7] text-[#B45309]' },
  attendance_correction: { label: '근태수정', icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'bg-[#E0E7FF] text-[#4B6DE0]' },
  shift_change: { label: '교대변경', icon: <ArrowRightLeft className="w-3.5 h-3.5" />, color: 'bg-[#FFF7ED] text-[#C2410C]' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기중', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  approved: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  rejected: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
  cancelled: { label: '취소', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]' },
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function AttendanceApprovalClient({ user }: { user: SessionUser }) {
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
      setError('승인 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [view, typeFilter])

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
      toast({ title: '처리에 실패했습니다.', variant: 'destructive' })
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
      toast({ title: `처리 완료: ${processed}건 처리됨${skipped > 0 ? `, ${skipped}건 건너뜀` : ''}` })
      setSelectedIds(new Set())
      setSelected(null)
      await load()
    } catch {
      toast({ title: '일괄 처리에 실패했습니다.', variant: 'destructive' })
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
          <Inbox className="w-6 h-6 text-[#5E81F4]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1C1D21]">근태 승인함</h1>
            <p className="text-sm text-[#8181A5] mt-0.5">휴가, 초과근무, 근태수정, 교대변경 요청을 한 곳에서 처리합니다</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-[#F0F0F3] rounded-lg hover:bg-[#F5F5FA] text-sm text-[#8181A5]"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 뷰 탭 */}
      <div className="flex border-b border-[#F0F0F3] flex-shrink-0">
        {([
          { key: 'pending-approval', label: '결재 대기', badge: pendingCount },
          { key: 'mine', label: '내 신청' },
          { key: 'team', label: '팀 전체' },
        ] as { key: ViewMode; label: string; badge?: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => changeView(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === t.key
                ? 'border-[#5E81F4] text-[#5E81F4]'
                : 'border-transparent text-[#8181A5] hover:text-[#1C1D21]'
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-[#5E81F4] text-white rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Filter className="w-4 h-4 text-[#8181A5]" />
        <div className="flex gap-2">
          {([
            { key: 'all', label: '전체' },
            { key: 'leave', label: '휴가' },
            { key: 'overtime', label: '초과근무' },
            { key: 'attendance_correction', label: '근태수정' },
            { key: 'shift_change', label: '교대변경' },
          ] as { key: RequestTypeFilter; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                typeFilter === f.key
                  ? 'bg-[#5E81F4] text-white'
                  : 'bg-[#F5F5FA] text-[#8181A5] hover:bg-[#EBEBF5]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#8181A5]">총 {total}건</span>
      </div>

      {/* 컨텐츠 */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* 목록 */}
        <div className="flex-1 bg-white rounded-xl border border-[#F0F0F3] overflow-hidden flex flex-col">
          {/* Select All 헤더 (pending-approval 뷰 + checkable 항목 있을 때만) */}
          {view === 'pending-approval' && checkableRequests.length > 0 && !loading && (
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-[#F0F0F3] bg-[#FAFBFF]">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs text-[#8181A5] hover:text-[#5E81F4] transition-colors"
              >
                {allChecked ? (
                  <CheckSquare className="w-4 h-4 text-[#5E81F4]" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                전체 선택
              </button>
              {someChecked && (
                <span className="text-xs text-[#5E81F4] font-medium ml-1">{selectedIds.size}건 선택됨</span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#5E81F4]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-[#FF808B] p-6">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8181A5]">
              <Inbox className="w-10 h-10 mb-2 opacity-40" />
              <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-[#F5F5FA]">
              {requests.map((r) => {
                const typeInfo = REQUEST_TYPE_LABELS[r.requestType] ?? { label: r.requestType, icon: null, color: 'bg-[#F5F5FA] text-[#8181A5]' }
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
                    className={`flex items-start px-5 py-4 hover:bg-[#F5F5FA] transition-colors cursor-pointer ${isSelected ? 'bg-[#EEF1FD]' : ''}`}
                    onClick={() => setSelected(r)}
                  >
                    {/* 체크박스 */}
                    {isCheckable && (
                      <div
                        className="flex-shrink-0 mr-3 mt-0.5"
                        onClick={(e) => toggleSelect(r.id, e)}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#5E81F4]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#C0C0D0] hover:text-[#5E81F4]" />
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
                          {typeInfo.label}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#1C1D21] truncate">{r.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#8181A5]">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {r.requester.name}
                        </span>
                        <span>{format(new Date(r.createdAt), 'M/d HH:mm', { locale: ko })}</span>
                        <span>승인 {r.steps.filter((s) => s.status === 'approved').length}/{r.steps.length}단계</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C0C0D0] flex-shrink-0 mt-1 ml-2" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-[#F0F0F3] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0F0F3]">
              <h3 className="text-sm font-semibold text-[#1C1D21]">요청 상세</h3>
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
                        {typeInfo.label}
                      </span>
                    )
                  })()}
                  {(() => {
                    const statusInfo = STATUS_LABELS[selected.status]
                    if (!statusInfo) return null
                    return (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )
                  })()}
                </div>
                <p className="text-base font-semibold text-[#1C1D21]">{selected.title}</p>
                <p className="text-xs text-[#8181A5]">신청자: {selected.requester.name} ({selected.requester.employeeNo ?? '—'})</p>
                <p className="text-xs text-[#8181A5]">신청일: {format(new Date(selected.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}</p>
              </div>

              {/* 상세 내용 */}
              {selected.details && Object.keys(selected.details).length > 0 && (
                <div className="bg-[#F5F5FA] rounded-lg p-3 space-y-1">
                  {Object.entries(selected.details).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-[#8181A5] flex-shrink-0">{k}:</span>
                      <span className="text-[#1C1D21]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 승인 타임라인 */}
              <div>
                <p className="text-xs font-semibold text-[#8181A5] uppercase tracking-wider mb-3">승인 단계</p>
                <div className="space-y-3">
                  {selected.steps.map((step, idx) => {
                    const isCurrent = step.stepOrder === selected.currentStep && step.status === 'pending'
                    return (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          step.status === 'approved' ? 'bg-[#059669] text-white' :
                          step.status === 'rejected' ? 'bg-[#FF808B] text-white' :
                          isCurrent ? 'bg-[#5E81F4] text-white' :
                          'bg-[#F0F0F3] text-[#8181A5]'
                        }`}>
                          {step.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> :
                           step.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                           idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#1C1D21]">{step.approver.name}</p>
                          <p className="text-xs text-[#8181A5]">
                            {step.status === 'approved' && step.decidedAt && `승인 · ${format(new Date(step.decidedAt), 'M/d HH:mm')}`}
                            {step.status === 'rejected' && step.decidedAt && `반려 · ${format(new Date(step.decidedAt), 'M/d HH:mm')}`}
                            {isCurrent && '결재 대기중'}
                            {step.status === 'waiting' && '대기'}
                          </p>
                          {step.comment && (
                            <div className="mt-1 flex items-start gap-1 text-xs text-[#8181A5] bg-[#F5F5FA] rounded px-2 py-1">
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
                <div className="border border-[#F0F0F3] rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-[#1C1D21]">의견 (선택)</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder={tCommon('placeholderApprovalReason')}
                    className="w-full px-3 py-2 border border-[#F0F0F3] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 focus:border-[#5E81F4] resize-none placeholder:text-[#C0C0D0]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[#FF808B] text-[#FF808B] hover:bg-[#FFF0F1] rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      반려
                    </button>
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#5E81F4] hover:bg-[#4A6FE3] text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      승인
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 bg-white rounded-2xl shadow-xl border border-[#F0F0F3]">
          <span className="text-sm font-semibold text-[#1C1D21]">
            {selectedIds.size}건 선택됨
          </span>
          <div className="h-4 w-px bg-[#F0F0F3]" />
          <button
            onClick={() => handleBulkAction('REJECT')}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-4 py-2 border border-[#FF808B] text-[#FF808B] hover:bg-[#FFF0F1] rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            일괄 반려
          </button>
          <button
            onClick={() => handleBulkAction('APPROVE')}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#5E81F4] hover:bg-[#4A6FE3] text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors"
          >
            {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            일괄 승인
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[#8181A5] hover:text-[#1C1D21] transition-colors"
          >
            취소
          </button>
        </div>
      )}
    </div>
  )
}
