'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  Inbox, CalendarDays, Clock, ArrowRightLeft, ClipboardList,
  CheckCircle2, XCircle, Loader2, AlertTriangle, ChevronRight,
  Filter, RefreshCw, User, MessageSquare,
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
  leave: { label: '휴가', icon: <CalendarDays className="w-3.5 h-3.5" />, color: 'bg-[#E8F5E9] text-[#047857]' },
  overtime: { label: '초과근무', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-[#FEF3C7] text-[#B45309]' },
  attendance_correction: { label: '근태수정', icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'bg-[#E0E7FF] text-[#4338CA]' },
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { view, limit: '30' }
      if (typeFilter !== 'all') params.requestType = typeFilter
      const res = await apiClient.get<{ items: ApprovalRequest[]; total: number }>(
        '/api/v1/approvals/attendance',
        params
      )
      // apiPaginated returns { data: [...], pagination: {...} }
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
      alert('처리에 실패했습니다.')
    } finally {
      setApproving(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Inbox className="w-6 h-6 text-[#00C853]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">통합 승인함</h1>
            <p className="text-sm text-[#666] mt-0.5">휴가, 초과근무, 근태수정, 교대변경 요청을 한 곳에서 처리합니다</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA] text-sm text-[#555]"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 뷰 탭 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex border-b border-[#E8E8E8] w-full">
          {([
            { key: 'pending-approval', label: '결재 대기', badge: pendingCount },
            { key: 'mine', label: '내 신청' },
            { key: 'team', label: '팀 전체' },
          ] as { key: ViewMode; label: string; badge?: number }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setView(t.key); setSelected(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                view === t.key
                  ? 'border-[#00C853] text-[#00C853]'
                  : 'border-transparent text-[#666] hover:text-[#333]'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-[#00C853] text-white rounded-full">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Filter className="w-4 h-4 text-[#999]" />
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
                  ? 'bg-[#00C853] text-white'
                  : 'bg-[#F5F5F5] text-[#555] hover:bg-[#E8E8E8]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-[#999]">총 {total}건</span>
      </div>

      {/* 컨텐츠 */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* 목록 */}
        <div className="flex-1 bg-white rounded-xl border border-[#E8E8E8] overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#00C853]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-[#B91C1C] p-6">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#999]">
              <Inbox className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">요청이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-[#F5F5F5]">
              {requests.map((r) => {
                const typeInfo = REQUEST_TYPE_LABELS[r.requestType] ?? { label: r.requestType, icon: null, color: 'bg-[#F5F5F5] text-[#555]' }
                const statusInfo = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
                const isSelected = selected?.id === r.id
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-5 py-4 hover:bg-[#FAFAFA] transition-colors ${isSelected ? 'bg-[#E8F5E9]' : ''}`}
                  >
                    <div className="flex items-start gap-3">
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
                        <p className="text-sm font-medium text-[#1A1A1A] truncate">{r.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#999]">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {r.requester.name}
                          </span>
                          <span>{format(new Date(r.createdAt), 'M/d HH:mm', { locale: ko })}</span>
                          <span>승인 {r.steps.filter((s) => s.status === 'approved').length}/{r.steps.length}단계</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#CCC] flex-shrink-0 mt-1" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="w-96 flex-shrink-0 bg-white rounded-xl border border-[#E8E8E8] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E8E8]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">요청 상세</h3>
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
                <p className="text-base font-semibold text-[#1A1A1A]">{selected.title}</p>
                <p className="text-xs text-[#999]">신청자: {selected.requester.name} ({selected.requester.employeeNo ?? '—'})</p>
                <p className="text-xs text-[#999]">신청일: {format(new Date(selected.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}</p>
              </div>

              {/* 상세 내용 */}
              {selected.details && Object.keys(selected.details).length > 0 && (
                <div className="bg-[#FAFAFA] rounded-lg p-3 space-y-1">
                  {Object.entries(selected.details).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-[#999] flex-shrink-0">{k}:</span>
                      <span className="text-[#555]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 승인 타임라인 */}
              <div>
                <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">승인 단계</p>
                <div className="space-y-3">
                  {selected.steps.map((step, idx) => {
                    const isDone = step.status === 'approved' || step.status === 'rejected'
                    const isCurrent = step.stepOrder === selected.currentStep && step.status === 'pending'
                    return (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          step.status === 'approved' ? 'bg-[#059669] text-white' :
                          step.status === 'rejected' ? 'bg-[#DC2626] text-white' :
                          isCurrent ? 'bg-[#00C853] text-white' :
                          'bg-[#E8E8E8] text-[#999]'
                        }`}>
                          {step.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> :
                           step.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                           idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#1A1A1A]">{step.approver.name}</p>
                          <p className="text-xs text-[#999]">
                            {step.status === 'approved' && step.decidedAt && `승인 · ${format(new Date(step.decidedAt), 'M/d HH:mm')}`}
                            {step.status === 'rejected' && step.decidedAt && `반려 · ${format(new Date(step.decidedAt), 'M/d HH:mm')}`}
                            {isCurrent && '결재 대기중'}
                            {step.status === 'waiting' && '대기'}
                          </p>
                          {step.comment && (
                            <div className="mt-1 flex items-start gap-1 text-xs text-[#555] bg-[#FAFAFA] rounded px-2 py-1">
                              <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#999]" />
                              {step.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 내가 결재해야 하는 단계인지 확인 */}
              {selected.status === 'pending' &&
               selected.steps.some(
                 (s) => s.stepOrder === selected.currentStep &&
                         s.status === 'pending' &&
                         s.approverId === user.employeeId
               ) && (
                <div className="border border-[#E8E8E8] rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">의견 (선택)</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="승인/반려 사유를 입력하세요..."
                    className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg text-sm font-medium disabled:opacity-60"
                    >
                      {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      반려
                    </button>
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium disabled:opacity-60"
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
    </div>
  )
}
