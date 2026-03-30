'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  CheckCircle2, Loader2, AlertTriangle,
  FileText, ChevronRight,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface BenefitClaim {
  id: string
  claimAmount: number
  approvedAmount: number | null
  eventDate: string | null
  eventDetail: string | null
  proofPaths: string[]
  status: string
  createdAt: string
  rejectedReason: string | null
  benefitPlan: { id: string; name: string; category: string; benefitType: string; currency: string }
  employee: { id: string; name: string; employeeNo: string | null }
  approver: { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '승인대기', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  approved: { label: '승인', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700 border-red-200' },
  paid: { label: '지급완료', color: 'bg-primary/10 text-primary/90 border-primary/20' },
  cancelled: { label: '취소', color: 'bg-background text-[#555] border-border' },
}

const CATEGORY_LABELS: Record<string, string> = {
  family: '경조금', health: '건강', education: '교육', lifestyle: '생활', financial: '금융',
}

const formatCurrency = (amount: number, currency: string) =>
  currency === 'KRW' ? `₩${amount.toLocaleString()}` : `$${amount.toLocaleString()}`

export function BenefitApprovalTab({ user, view }: { user: SessionUser; view: 'pending' | 'all' }) {
  const [claims, setClaims] = useState<BenefitClaim[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BenefitClaim | null>(null)
  const [processing, setProcessing] = useState(false)
  const [rejectedReason, setRejectedReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  // Suppress unused variable warning - user prop reserved for future RBAC use
  void user

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<unknown>('/api/v1/benefit-claims', { view, limit: '50' })
      const raw = res as unknown as { data: BenefitClaim[]; pagination: { total: number } }
      setClaims(raw.data ?? [])
      setTotal(raw.pagination?.total ?? 0)
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { void load() }, [load])

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selected) return
    if (action === 'reject' && !rejectedReason.trim()) {
      setShowRejectForm(true)
      return
    }
    setProcessing(true)
    try {
      await apiClient.patch(`/api/v1/benefit-claims/${selected.id}`, {
        action,
        rejectedReason: action === 'reject' ? rejectedReason : undefined,
      })
      setSelected(null)
      setRejectedReason('')
      setShowRejectForm(false)
      await load()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? '처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 280px)' }}>
      {/* 좌측 목록 */}
      <div className="w-80 shrink-0 bg-white rounded-xl border border-border overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium text-[#333]">
            {view === 'pending' ? '승인 대기' : '전체 내역'} ({total})
          </span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {error && (
            <div className="p-4 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
          {!loading && claims.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[#999] text-sm">
              <CheckCircle2 className="w-8 h-8 mb-2" />
              {view === 'pending' ? '대기중인 신청이 없습니다.' : '내역이 없습니다.'}
            </div>
          )}
          {claims.map((claim) => {
            const s = STATUS_LABELS[claim.status] ?? { label: claim.status, color: '' }
            const isSelected = selected?.id === claim.id
            return (
              <button
                key={claim.id}
                onClick={() => { setSelected(claim); setShowRejectForm(false); setRejectedReason('') }}
                className={`w-full text-left px-4 py-3 hover:bg-background transition-colors ${isSelected ? 'bg-primary/10' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{claim.employee.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${s.color}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-xs text-[#666] truncate">{claim.benefitPlan.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[#999]">
                    {format(new Date(claim.createdAt), 'MM/dd', { locale: ko })}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {formatCurrency(claim.claimAmount, claim.benefitPlan.currency)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 우측 상세 */}
      <div className="flex-1 bg-white rounded-xl border border-border overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#999]">
            <ChevronRight className="w-10 h-10 mb-3" />
            <p className="text-sm">신청 항목을 선택하세요</p>
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {selected.employee.name} · {selected.benefitPlan.name}
                  </h3>
                  <p className="text-xs text-[#999] mt-0.5">
                    신청일: {format(new Date(selected.createdAt), 'yyyy.MM.dd', { locale: ko })}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_LABELS[selected.status]?.color ?? ''}`}>
                  {STATUS_LABELS[selected.status]?.label ?? selected.status}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#999] mb-1">카테고리</p>
                  <p className="text-sm font-medium">{CATEGORY_LABELS[selected.benefitPlan.category] ?? selected.benefitPlan.category}</p>
                </div>
                <div>
                  <p className="text-xs text-[#999] mb-1">신청 금액</p>
                  <p className="text-sm font-medium">{formatCurrency(selected.claimAmount, selected.benefitPlan.currency)}</p>
                </div>
                {selected.eventDate && (
                  <div>
                    <p className="text-xs text-[#999] mb-1">이벤트 날짜</p>
                    <p className="text-sm">{format(new Date(selected.eventDate), 'yyyy.MM.dd', { locale: ko })}</p>
                  </div>
                )}
                {selected.eventDetail && (
                  <div>
                    <p className="text-xs text-[#999] mb-1">상세</p>
                    <p className="text-sm">{selected.eventDetail}</p>
                  </div>
                )}
              </div>

              {selected.proofPaths.length > 0 && (
                <div>
                  <p className="text-xs text-[#999] mb-2">증빙 서류</p>
                  <div className="space-y-1">
                    {selected.proofPaths.map((path, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-[#555]">
                        <FileText className="w-4 h-4 text-primary" />
                        {path.split('/').pop()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.rejectedReason && (
                <div className="p-3 bg-red-100 rounded-lg">
                  <p className="text-xs text-[#999] mb-1">반려 사유</p>
                  <p className="text-sm text-red-700">{selected.rejectedReason}</p>
                </div>
              )}
            </div>

            {selected.status === 'pending' && (
              <div className="p-5 border-t border-border space-y-3">
                {showRejectForm && (
                  <div>
                    <label className="text-xs text-[#333] font-medium mb-1 block">반려 사유 *</label>
                    <textarea
                      value={rejectedReason}
                      onChange={(e) => setRejectedReason(e.target.value)}
                      placeholder={'반려 사유를 입력해 주세요.'}
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 resize-none"
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (!showRejectForm) { setShowRejectForm(true); return }
                      void handleAction('reject')
                    }}
                    disabled={processing}
                    className="flex-1 py-2 border border-red-300 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {showRejectForm ? '반려 확인' : '반려'}
                  </button>
                  <button
                    onClick={() => void handleAction('approve')}
                    disabled={processing}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                    승인
                  </button>
                </div>
                {showRejectForm && (
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectedReason('') }}
                    className="w-full text-xs text-[#999] hover:text-[#555]"
                  >
                    취소
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
