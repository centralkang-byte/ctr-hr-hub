'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { Star, Send, Save, CheckCircle2, Clock, AlertCircle, ArrowLeft, Users, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { STATUS_VARIANT } from '@/lib/styles/status'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

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
    SUBMITTED: { label: '제출 완료', icon: CheckCircle2, cls: STATUS_VARIANT.info },
    DRAFT: { label: '작성 중', icon: Clock, cls: STATUS_VARIANT.neutral },
}

// ─── Star Rating ──────────────────────────────────────────

function Stars({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} disabled={disabled} onClick={() => onChange(i)}
                    className={`transition-transform ${disabled ? 'cursor-not-allowed' : 'hover:scale-110'}`}>
                    <Star className={`h-5 w-5 ${i <= value ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} />
                </button>
            ))}
            <span className="ml-2 text-sm font-medium text-muted-foreground">{value}/5</span>
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

export default function MyPeerReviewClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const { confirm, dialogProps } = useConfirmDialog()

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
            } catch { setError(t('cycleListLoadFailed')) }
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
                toast({ title: t('kr_keca285ed_kec9d98ea_kecb59cec_'), variant: 'destructive' })
                return
            }
            confirm({ title: t('submit_ked9598eb_kec8898ec_kec8898_kec9786ec_keca09cec'), onConfirm: async () => {
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
                } catch { toast({ title: t('saveFailed'), variant: 'destructive' }) }
                finally { setSaving(false) }
            }})
            return
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
        } catch { toast({ title: t('saveFailed'), variant: 'destructive' }) }
        finally { setSaving(false) }
    }

    // Route guard
    const isBlocked = cycleStatus !== '' && !['EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(cycleStatus)

    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_kec9584ec_keb8f99eb_keab8b0ea_')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_keb8f99eb_eval_open_keb8ba8ea_')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}
                    </a>
                </div>
            </div>
        )
    }

    const completed = assignments.filter((a) => a.status === 'SUBMITTED').length
    const total = assignments.length

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('kr_keb8f99eb_peer_review')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            내가 평가해야 할 동료: {total}명 | 완료: {completed}/{total}
                        </p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Progress */}
                {total > 0 && (
                    <div className="mb-6 rounded-xl border border-border bg-white p-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t('kr_keca784ed')}</span>
                            <span className="font-medium text-foreground">{completed}/{total} 완료</span>
                        </div>
                        <div className="h-2 rounded-full bg-border">
                            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                        {error} <button onClick={fetchAssignments} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-white p-5">
                                <div className="mb-2 h-4 w-1/3 rounded bg-border" />
                                <div className="h-3 w-1/4 rounded bg-border" />
                            </div>
                        ))}
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="rounded-xl border border-border bg-white p-16 text-center">
                        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <EmptyState />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assignments.map((item) => {
                            const badge = STATUS_BADGE[item.status]
                            const Icon = badge?.icon ?? AlertCircle
                            const isCompleted = item.status === 'SUBMITTED'

                            return (
                                <div key={item.nominationId} className="flex items-center justify-between rounded-xl border border-border bg-white p-5 transition-colors hover:border-primary/30">
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">{item.employeeName}</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{item.department}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {badge && (
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                                                <Icon className="h-3.5 w-3.5" /> {badge.label}
                                            </span>
                                        )}
                                        {!isCompleted && (
                                            <button onClick={() => openReview(item)}
                                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
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
                    <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4">
                            <h2 className="text-lg font-bold text-foreground">{activeReview.employeeName} 님에 대한 동료평가</h2>
                            <button onClick={() => setActiveReview(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Anonymity notice */}
                            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                                <p className="text-xs text-blue-800">
                                    {t('evaluation_keb8a94_kec9db5eb_kecb298eb_keba7a4eb_ked8f89ea_ked9995ec_kec8898_kec9e88ec')}
                                </p>
                            </div>

                            {/* CTR Values */}
                            <div className="space-y-5">
                                <h3 className="text-base font-semibold text-foreground">{t('kr_ctr_ked95b5ec_evaluation')}</h3>
                                {CTR_VALUES.map((v) => (
                                    <div key={v.scoreKey} className="rounded-xl border border-border p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-foreground">{v.label} ({v.labelEn})</span>
                                            <Stars value={form[v.scoreKey]} onChange={(val) => setForm((p) => ({ ...p, [v.scoreKey]: val }))} disabled={false} />
                                        </div>
                                        <textarea rows={2} value={form[v.commentKey]}
                                            onChange={(e) => setForm((p) => ({ ...p, [v.commentKey]: e.target.value }))}
                                            placeholder={`${v.label}에 대한 의견 (선택)`}
                                            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                                    </div>
                                ))}
                            </div>

                            {/* Overall comment */}
                            <div>
                                <h3 className="mb-2 text-base font-semibold text-foreground">종합 의견 (최소 20자)</h3>
                                <textarea rows={4} value={form.overallComment}
                                    onChange={(e) => setForm((p) => ({ ...p, overallComment: e.target.value }))}
                                    placeholder="동료에 대한 종합적인 의견을 작성해주세요..."
                                    className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                                <p className="mt-1 text-xs text-muted-foreground">{form.overallComment.length}자 / 최소 20자</p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 border-t border-border pt-4">
                                <button onClick={() => handleSubmit('DRAFT')} disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40">
                                    <Save className="h-4 w-4" /> {t('kr_kec9e84ec')}
                                </button>
                                <button onClick={() => handleSubmit('SUBMITTED')} disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40">
                                    <Send className="h-4 w-4" /> {saving ? tCommon('loading') : tCommon('submit')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
