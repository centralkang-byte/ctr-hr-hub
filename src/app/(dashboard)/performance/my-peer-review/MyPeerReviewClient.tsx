'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { Star, Send, Save, CheckCircle2, Clock, AlertCircle, ArrowLeft, Users, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }
interface AssignmentItem {
    nominationId: string; employeeId: string; employeeName: string
    department: string; status: string
}

interface ReviewForm {
    scoreChallenge: number; scoreTrust: number; scoreResponsibility: number; scoreRespect: number
    commentChallenge: string; commentTrust: string; commentResponsibility: string; commentRespect: string
    overallComment: string
}

const EMPTY_FORM: ReviewForm = {
    scoreChallenge: 3, scoreTrust: 3, scoreResponsibility: 3, scoreRespect: 3,
    commentChallenge: '', commentTrust: '', commentResponsibility: '', commentRespect: '',
    overallComment: '',
}

const STATUS_BADGE: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
    SUBMITTED: { label: '제출 완료', icon: CheckCircle2, cls: 'bg-[#D1FAE5] text-[#047857]' },
    DRAFT: { label: '작성 중', icon: Clock, cls: 'bg-[#FEF3C7] text-[#92400E]' },
}

// ─── Star Rating ──────────────────────────────────────────

function Stars({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} disabled={disabled} onClick={() => onChange(i)}
                    className={`transition-transform ${disabled ? 'cursor-not-allowed' : 'hover:scale-110'}`}>
                    <Star className={`h-5 w-5 ${i <= value ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB]'}`} />
                </button>
            ))}
            <span className="ml-2 text-sm font-medium text-[#8181A5]">{value}/5</span>
        </div>
    )
}

// ─── CTR Values ───────────────────────────────────────────

const CTR_VALUES = [
    { scoreKey: 'scoreChallenge' as const, commentKey: 'commentChallenge' as const, label: '도전', labelEn: 'Challenge' },
    { scoreKey: 'scoreTrust' as const, commentKey: 'commentTrust' as const, label: '신뢰', labelEn: 'Trust' },
    { scoreKey: 'scoreResponsibility' as const, commentKey: 'commentResponsibility' as const, label: '책임', labelEn: 'Responsibility' },
    { scoreKey: 'scoreRespect' as const, commentKey: 'commentRespect' as const, label: '존중', labelEn: 'Respect' },
]

// ─── Main Component ───────────────────────────────────────

export default function MyPeerReviewClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [assignments, setAssignments] = useState<AssignmentItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeReview, setActiveReview] = useState<AssignmentItem | null>(null)
    const [form, setForm] = useState<ReviewForm>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                const evalCycles = res.data.filter((c) => ['EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(c.status))
                setCycles(evalCycles)
                if (evalCycles.length > 0) {
                    setSelectedCycleId(evalCycles[0].id)
                    setCycleStatus(evalCycles[0].status)
                }
            } catch { setError('사이클 목록을 불러오지 못했습니다.') }
        }
        load()
    }, [])

    const fetchAssignments = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const res = await apiClient.get<AssignmentItem[]>('/api/v1/performance/peer-review/my-assignments', { cycleId: selectedCycleId })
            setAssignments(res.data ?? [])
        } catch { setError('동료평가 목록을 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { fetchAssignments() }, [fetchAssignments])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    function openReview(item: AssignmentItem) {
        setActiveReview(item)
        setForm(EMPTY_FORM)
    }

    async function handleSubmit(status: 'DRAFT' | 'SUBMITTED') {
        if (!activeReview) return
        if (status === 'SUBMITTED') {
            if (form.overallComment.trim().length < 20) {
                alert('종합 의견은 최소 20자 이상 작성해주세요.')
                return
            }
            if (!confirm('제출하면 수정할 수 없습니다. 제출하시겠습니까?')) return
        }

        setSaving(true)
        try {
            await apiClient.post('/api/v1/performance/peer-review/submit', {
                cycleId: selectedCycleId,
                nominationId: activeReview.nominationId,
                ...form,
                status,
            })
            setActiveReview(null)
            await fetchAssignments()
        } catch { alert('저장에 실패했습니다.') }
        finally { setSaving(false) }
    }

    // Route guard
    const isBlocked = cycleStatus !== '' && !['EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(cycleStatus)

    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Users className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">아직 동료평가 기간이 아닙니다.</h2>
                    <p className="text-sm text-[#8181A5]">동료평가는 EVAL_OPEN 단계에서 진행됩니다.</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-[#5E81F4] hover:underline">
                        <ArrowLeft className="h-4 w-4" /> 돌아가기
                    </a>
                </div>
            </div>
        )
    }

    const completed = assignments.filter((a) => a.status === 'SUBMITTED').length
    const total = assignments.length

    return (
        <div className="min-h-screen bg-[#F5F5FA] p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1C1D21]">동료평가 (Peer Review)</h1>
                        <p className="mt-1 text-sm text-[#8181A5]">
                            내가 평가해야 할 동료: {total}명 | 완료: {completed}/{total}
                        </p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2 text-sm">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Progress */}
                {total > 0 && (
                    <div className="mb-6 rounded-xl border border-[#F0F0F3] bg-white p-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-[#8181A5]">진행률</span>
                            <span className="font-medium text-[#1C1D21]">{completed}/{total} 완료</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F0F0F3]">
                            <div className="h-2 rounded-full bg-[#5E81F4] transition-all" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-lg border border-[#FFEBEE] bg-[#FFEBEE] p-3 text-sm text-[#C62828]">
                        {error} <button onClick={fetchAssignments} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F3] bg-white p-5">
                                <div className="mb-2 h-4 w-1/3 rounded bg-[#F0F0F3]" />
                                <div className="h-3 w-1/4 rounded bg-[#F0F0F3]" />
                            </div>
                        ))}
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-16 text-center">
                        <Users className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                        <p className="text-[#8181A5]">현재 사이클에서 평가할 동료가 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assignments.map((item) => {
                            const badge = STATUS_BADGE[item.status]
                            const Icon = badge?.icon ?? AlertCircle
                            const isCompleted = item.status === 'SUBMITTED'

                            return (
                                <div key={item.nominationId} className="flex items-center justify-between rounded-xl border border-[#F0F0F3] bg-white p-5 transition-colors hover:border-[#5E81F4]/30">
                                    <div>
                                        <h3 className="text-sm font-semibold text-[#1C1D21]">{item.employeeName}</h3>
                                        <p className="mt-0.5 text-xs text-[#8181A5]">{item.department}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {badge && (
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                                                <Icon className="h-3.5 w-3.5" /> {badge.label}
                                            </span>
                                        )}
                                        {!isCompleted && (
                                            <button onClick={() => openReview(item)}
                                                className="rounded-lg bg-[#5E81F4] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A6FE0] transition-colors">
                                                {item.status === 'DRAFT' ? '이어서 작성' : '평가 시작'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Review Form Slide-over */}
            {activeReview && (
                <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={() => setActiveReview(null)}>
                    <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F0F0F3] bg-white px-6 py-4">
                            <h2 className="text-lg font-bold text-[#1C1D21]">{activeReview.employeeName} 님에 대한 동료평가</h2>
                            <button onClick={() => setActiveReview(null)} className="text-[#8181A5] hover:text-[#1C1D21]"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Anonymity notice */}
                            <div className="flex items-start gap-2 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#3B82F6]" />
                                <p className="text-xs text-[#1E40AF]">
                                    평가는 익명으로 처리됩니다. 매니저만 평가자를 확인할 수 있습니다.
                                </p>
                            </div>

                            {/* CTR Values */}
                            <div className="space-y-5">
                                <h3 className="text-base font-semibold text-[#1C1D21]">CTR 핵심가치 평가</h3>
                                {CTR_VALUES.map((v) => (
                                    <div key={v.scoreKey} className="rounded-xl border border-[#F0F0F3] p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-[#1C1D21]">{v.label} ({v.labelEn})</span>
                                            <Stars value={form[v.scoreKey]} onChange={(val) => setForm((p) => ({ ...p, [v.scoreKey]: val }))} disabled={false} />
                                        </div>
                                        <textarea rows={2} value={form[v.commentKey]}
                                            onChange={(e) => setForm((p) => ({ ...p, [v.commentKey]: e.target.value }))}
                                            placeholder={`${v.label}에 대한 의견 (선택)`}
                                            className="w-full resize-none rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" />
                                    </div>
                                ))}
                            </div>

                            {/* Overall comment */}
                            <div>
                                <h3 className="mb-2 text-base font-semibold text-[#1C1D21]">종합 의견 (최소 20자)</h3>
                                <textarea rows={4} value={form.overallComment}
                                    onChange={(e) => setForm((p) => ({ ...p, overallComment: e.target.value }))}
                                    placeholder="동료에 대한 종합적인 의견을 작성해주세요..."
                                    className="w-full resize-none rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" />
                                <p className="mt-1 text-xs text-[#8181A5]">{form.overallComment.length}자 / 최소 20자</p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 border-t border-[#F0F0F3] pt-4">
                                <button onClick={() => handleSubmit('DRAFT')} disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[#F0F0F3] px-4 py-2 text-sm font-medium text-[#1C1D21] hover:bg-[#F5F5FA] disabled:opacity-40">
                                    <Save className="h-4 w-4" /> 임시저장
                                </button>
                                <button onClick={() => handleSubmit('SUBMITTED')} disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-[#5E81F4] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A6FE0] disabled:opacity-40">
                                    <Send className="h-4 w-4" /> {saving ? tCommon('loading') : tCommon('submit')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
