'use client'

import { useTranslations } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  Gift, Plus, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronRight, Upload, FileText,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BUTTON_VARIANTS, MODAL_STYLES } from '@/lib/styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'


// ─── 타입 ─────────────────────────────────────────────────

interface BenefitPlan {
  id: string
  code: string
  name: string
  category: string
  benefitType: string
  amount: number | null
  maxAmount: number | null
  currency: string
  frequency: string
  requiresApproval: boolean
  requiresProof: boolean
}

interface UsageSummaryItem {
  planId: string
  planName: string
  category: string
  maxAmount: number | null
  currency: string
  used: number
  pending: number
}

interface BenefitClaim {
  id: string
  benefitPlanId: string
  claimAmount: number
  approvedAmount: number | null
  eventDate: string | null
  eventDetail: string | null
  status: string
  createdAt: string
  benefitPlan: { id: string; name: string; category: string; benefitType: string; currency: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '승인대기', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: <Clock className="w-3 h-3" /> },
  approved: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: <XCircle className="w-3 h-3" /> },
  paid: { label: '지급완료', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: '취소', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]', icon: null },
}

const CATEGORY_LABELS: Record<string, string> = {
  family: '경조금', health: '건강', education: '교육', lifestyle: '생활', financial: '금융',
}

const formatCurrency = (amount: number, currency: string) =>
  currency === 'KRW' ? `₩${amount.toLocaleString()}` : `$${amount.toLocaleString()}`

// ─── 신청 모달 ─────────────────────────────────────────────

function ClaimModal({ plans, onClose, onSubmit }: {
  plans: BenefitPlan[]
  onClose: () => void
  onSubmit: () => void
}) {
  const tCommon = useTranslations('common')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [claimAmount, setClaimAmount] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventDetail, setEventDetail] = useState('')
  const [proofFiles, setProofFiles] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  useEffect(() => {
    if (selectedPlan?.benefitType === 'fixed_amount' && selectedPlan.amount) {
      setClaimAmount(String(selectedPlan.amount))
    } else if (selectedPlan?.benefitType !== 'fixed_amount') {
      setClaimAmount('')
    }
  }, [selectedPlan])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const paths = files.map((f) => `benefit-claims/${Date.now()}-${f.name}`)
    setProofFiles((prev) => [...prev, ...paths])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanId) { setError('복리후생 항목을 선택해 주세요.'); return }
    if (!claimAmount || Number(claimAmount) <= 0) { setError('신청 금액을 입력해 주세요.'); return }
    if (selectedPlan?.requiresProof && proofFiles.length === 0) {
      setError('증빙 서류를 첨부해 주세요.'); return
    }

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/api/v1/benefit-claims', {
        benefitPlanId: selectedPlanId,
        claimAmount: Number(claimAmount),
        eventDate: eventDate || undefined,
        eventDetail: eventDetail || undefined,
        proofPaths: proofFiles,
      })
      onSubmit()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? tCommon('errorDesc')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={MODAL_STYLES.container}>
      <div className={`${MODAL_STYLES.content.md}`}>
        <div className="flex items-center justify-between p-5 border-b border-[#E8E8E8]">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">{tCommon('benefit.apply')}</h2>
          <button onClick={onClose} className="text-[#999] hover:text-[#555] text-xl leading-none">✕</button>
        </div>

        <form onSubmit={guardedSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#FEE2E2] rounded-lg text-sm text-[#B91C1C]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">복리후생 항목 *</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            >
              <option value="">항목을 선택하세요</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  [{CATEGORY_LABELS[p.category] ?? p.category}] {p.name}
                  {p.maxAmount ? ` (최대 ${formatCurrency(p.maxAmount, p.currency)})` : ''}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <p className="text-xs text-[#666] mt-1">
                {selectedPlan.benefitType === 'fixed_amount' ? '고정금액' : '실비 상환'}
                {selectedPlan.requiresProof && ' · 증빙 필수'}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">신청 금액 *</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#666]">{selectedPlan?.currency === 'USD' ? '$' : '₩'}</span>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                readOnly={selectedPlan?.benefitType === 'fixed_amount'}
                placeholder="0"
                className="flex-1 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 read-only:bg-[#FAFAFA]"
              />
            </div>
            {selectedPlan?.maxAmount && (
              <p className="text-xs text-[#666] mt-1">
                한도: {formatCurrency(selectedPlan.maxAmount, selectedPlan.currency)}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">이벤트 날짜</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">상세 내용</label>
            <input
              type="text"
              value={eventDetail}
              onChange={(e) => setEventDetail(e.target.value)}
              placeholder="예: 본인 결혼"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">
              증빙 서류 {selectedPlan?.requiresProof && <span className="text-[#EF4444]">*</span>}
            </label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#D4D4D4] rounded-lg cursor-pointer hover:bg-[#FAFAFA] text-sm text-[#666]">
              <Upload className="w-4 h-4" />
              파일 첨부
              <input type="file" multiple onChange={handleFileChange} className="hidden" />
            </label>
            {proofFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {proofFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#555]">
                    <FileText className="w-3 h-3" />
                    {f.split('/').pop()}
                    <button
                      type="button"
                      onClick={() => setProofFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-[#EF4444] hover:underline ml-auto"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-3 p-5 border-t border-[#E8E8E8]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#D4D4D4] hover:bg-[#FAFAFA] text-[#333] rounded-lg text-sm font-medium"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); void handleSubmit(e as unknown as React.FormEvent) }}
            disabled={submitting}
            className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? tCommon('loading') : tCommon('apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function MyBenefitsClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')

  const [plans, setPlans] = useState<BenefitPlan[]>([])
  const [summary, setSummary] = useState<UsageSummaryItem[]>([])
  const [claims, setClaims] = useState<BenefitClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const year = new Date().getFullYear()

  // Suppress unused variable warning — user prop reserved for future use
  void user

  const load = useCallback(async () => {
  const { guardedSubmit, isSubmitting } = useSubmitGuard(handleSubmit)
    setLoading(true)
    setError(null)
    try {
      const [plansRes, summaryRes, claimsRes] = await Promise.all([
        apiClient.get<BenefitPlan[]>('/api/v1/benefit-plans'),
        apiClient.get<{ year: number; summary: UsageSummaryItem[] }>('/api/v1/benefit-claims/summary', { year: String(year) }),
        apiClient.get<unknown>('/api/v1/benefit-claims', { view: 'mine', limit: '20' }),
      ])
      setPlans(plansRes.data ?? [])
      setSummary(summaryRes.data.summary ?? [])
      const raw = claimsRes as unknown as { data: BenefitClaim[]; pagination: unknown }
      setClaims(raw.data ?? [])
    } catch {
      setError('복리후생 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-[#999] mb-1">나의 공간</nav>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('myBenefits')}</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}
        >
          <Plus className="w-4 h-4" />
          {t('applyBenefit')}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-[#FEE2E2] rounded-xl text-sm text-[#B91C1C]">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {summary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">📊 {year}{tCommon('unit.year')} {t('usageSummary')}</h2>
          <div className="space-y-4">
            {summary.map((item) => {
              const total = item.maxAmount ?? 0
              const usedPct = total > 0 ? Math.min(100, Math.round((item.used / total) * 100)) : 0
              const pendingPct = total > 0 ? Math.min(100 - usedPct, Math.round((item.pending / total) * 100)) : 0
              return (
                <div key={item.planId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#333]">{item.planName}</span>
                    <span className="text-xs text-[#666]">
                      {formatCurrency(item.used, item.currency)}
                      {item.maxAmount ? ` / ${formatCurrency(item.maxAmount, item.currency)}` : ''}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="w-full bg-[#F5F5F5] rounded-full h-2 overflow-hidden">
                      <div className="h-full flex">
                        <div className="bg-[#00C853] transition-all" style={{ width: `${usedPct}%` }} />
                        <div className="bg-[#FCD34D] transition-all" style={{ width: `${pendingPct}%` }} />
                      </div>
                    </div>
                  )}
                  {item.pending > 0 && (
                    <p className="text-xs text-[#B45309] mt-1">
                      대기중: {formatCurrency(item.pending, item.currency)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="p-5 border-b border-[#E8E8E8]">
          <h2 className="text-base font-semibold text-[#1A1A1A]">{t('claimHistory')}</h2>
        </div>
        {claims.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={t('emptyBenefitClaim')}
            description={t('emptyBenefitClaimDesc')}
            action={{ label: t('applyBenefit'), onClick: () => setShowModal(true) }}
          />
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {claims.map((claim) => {
              const s = STATUS_LABELS[claim.status] ?? { label: claim.status, color: '', icon: null }
              return (
                <div key={claim.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A]">{claim.benefitPlan.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-[#666]">
                        {format(new Date(claim.createdAt), 'MM/dd', { locale: ko })}
                      </p>
                      {claim.eventDetail && (
                        <span className="text-xs text-[#999]">· {claim.eventDetail}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {formatCurrency(claim.claimAmount, claim.benefitPlan.currency)}
                    </p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${s.color}`}>
                      {s.icon}
                      {s.label}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#CCC]" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ClaimModal
          plans={plans}
          onClose={() => setShowModal(false)}
          onSubmit={() => { void load() }}
        />
      )}
    </div>
  )
}
