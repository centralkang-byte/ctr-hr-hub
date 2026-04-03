'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { Award, Target, TrendingUp, CheckCircle2, Clock, Info, ArrowLeft, Shield } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getAllowedStatuses } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import dynamic from 'next/dynamic'

const GrowthJourneyChart = dynamic(() => import('@/components/performance/GrowthJourneyChart'), { ssr: false })

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; half: string }

interface ReviewResult {
    reviewId: string
    finalGradeEnum: string | null
    finalGradeLabel: string | null
    performanceScore: number | null
    competencyScore: number | null
    totalScore: number | null
    mboWeight: number
    beiWeight: number
    notifiedAt: string | null
    acknowledgedAt: string | null
    acknowledgeDeadline: string | null
    goals: Array<{
        id: string; title: string; weight: number
        selfScore: number | null; managerScore: number | null
        managerComment: string | null
    }>
}

interface PeerResult {
    summary: {
        averageChallenge: number; averageTrust: number
        averageResponsibility: number; averageRespect: number
        overallAverage: number; totalReviewers: number; completedReviewers: number
    }
    reviews: Array<{
        reviewerName: string; overallComment: string | null; submittedAt: string | null
        scoreChallenge: number; scoreTrust: number; scoreResponsibility: number; scoreRespect: number
    }>
}

// ─── Grade display config ─────────────────────────────────

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    EXCEEDS_PLUS: { bg: 'bg-primary/10', text: 'text-primary/90', label: '탁월 (E+)' },
    EXCEEDS: { bg: 'bg-primary/10', text: 'text-primary', label: '우수 (E)' },
    MEETS_PLUS: { bg: 'bg-emerald-500/15', text: 'text-emerald-700', label: '기대 이상 (M+)' },
    MEETS: { bg: 'bg-primary/10', text: 'text-tertiary', label: '기대 충족 (M)' },
    BELOW: { bg: 'bg-amber-500/15', text: 'text-amber-800', label: '개선 필요 (B)' },
    BELOW_MINUS: { bg: 'bg-destructive/5', text: 'text-destructive', label: '미흡 (B-)' },
}

// ─── Component ────────────────────────────────────────────

export default function MyResultClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const { confirm, dialogProps } = useConfirmDialog()

    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [result, setResult] = useState<ReviewResult | null>(null)
    const [peerResult, setPeerResult] = useState<PeerResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [acknowledging, setAcknowledging] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                const resultCycles = res.data.filter((c) => getAllowedStatuses('result', c.half ?? 'H2').includes(c.status))
                setCycles(resultCycles)
                if (resultCycles.length > 0) {
                    setSelectedCycleId(resultCycles[0].id)
                    setCycleStatus(resultCycles[0].status)
                }
            } catch { setError(t('cycleListLoadFailed')) }
        }
        load()
    }, [t])

    const fetchResult = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const [resultRes, peerRes] = await Promise.all([
                apiClient.get<ReviewResult>('/api/v1/performance/reviews/my-result', { cycleId: selectedCycleId }).catch(() => null),
                apiClient.get<PeerResult>(`/api/v1/performance/peer-review/results/${user.employeeId}`, { cycleId: selectedCycleId }).catch(() => null),
            ])
            if (resultRes) setResult(resultRes.data)
            if (peerRes) setPeerResult(peerRes.data)
        } catch { setError('결과를 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId, user.employeeId])

    useEffect(() => { fetchResult() }, [fetchResult])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    async function handleAcknowledge() {
        if (!result?.reviewId) return
        confirm({ title: t('kr_keab2b0ea_ked9995ec_keab2b0ea_'), onConfirm: async () => {
            setAcknowledging(true)
            try {
                await apiClient.post(`/api/v1/performance/reviews/${result.reviewId}/acknowledge`)
                setResult((p) => p ? { ...p, acknowledgedAt: new Date().toISOString() } : p)
            } catch { toast({ title: t('confirm_kecb298eb_kec8ba4ed'), variant: 'destructive' }) }
            finally { setAcknowledging(false) }
        }})
    }

    // Route guard
    const selectedHalf = cycles.find(c => c.id === selectedCycleId)?.half ?? 'H2'
    const allowedStatuses = getAllowedStatuses('result', selectedHalf)
    const isBlocked = cycleStatus !== '' && !allowedStatuses.includes(cycleStatus)

    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_kec9584ec_keab2b0ea_keab3b5ea_')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_keab2b0ea_ked8f89ea_kec9984eb_')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}
                    </a>
                </div>
            </div>
        )
    }

    if (cycles.length === 0 && !loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_ked9884ec_keca784ed_keca491ec_')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_keab2b0ea_keab3b5ea_kec97acea_')}</p>
                </div>
            </div>
        )
    }

    const grade = result?.finalGradeEnum ? GRADE_STYLE[result.finalGradeEnum] : null
    const isAcknowledged = !!result?.acknowledgedAt
    const daysLeft = result?.acknowledgeDeadline ? Math.ceil((new Date(result.acknowledgeDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('kr_keb8298ec_kec84b1ea_keab2b0ea_')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t('kr_kec84b1ea_evaluation_keab2b0ea')}</p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
                        {error} <button onClick={fetchResult} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-6">
                                <div className="mb-3 h-6 w-1/3 rounded bg-border" />
                                <div className="h-4 w-1/2 rounded bg-border" />
                            </div>
                        ))}
                    </div>
                ) : !result ? (
                    <div className="rounded-xl border border-border bg-card p-16 text-center">
                        <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <EmptyState />
                    </div>
                ) : (
                    <>
                        {/* Grade card */}
                        <div className="mb-6 rounded-xl border border-border bg-card p-8 text-center">
                            <p className="mb-3 text-sm text-muted-foreground">{t('kr_kecb59cec_keb93b1ea')}</p>
                            {grade ? (
                                <div className={`mx-auto inline-flex rounded-xl px-8 py-4 ${grade.bg}`}>
                                    <span className={`text-2xl font-bold ${grade.text}`}>{grade.label}</span>
                                </div>
                            ) : (
                                <p className="text-lg text-muted-foreground">{t('kr_keb93b1ea_kebafb8ec')}</p>
                            )}
                            <div className="mt-6 grid grid-cols-3 gap-4">
                                <div>
                                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> {t('kr_mbo_score')}</div>
                                    <p className="mt-1 text-xl font-bold text-foreground">{result.performanceScore?.toFixed(1) ?? '-'}<span className="text-sm text-muted-foreground">/5.0</span></p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> {t('kr_bei_score')}</div>
                                    <p className="mt-1 text-xl font-bold text-foreground">{result.competencyScore?.toFixed(1) ?? '-'}<span className="text-sm text-muted-foreground">/5.0</span></p>
                                </div>
                                <div>
                                    <div className="flex items-center justify-center gap-1 text-xs text-primary"><Award className="h-3.5 w-3.5" /> {t('kr_keca285ed_score')}</div>
                                    <p className="mt-1 text-xl font-bold text-primary">{result.totalScore?.toFixed(2) ?? '-'}<span className="text-sm text-muted-foreground">/5.0</span></p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">(MBO {result.mboWeight}% + BEI {result.beiWeight}%)</p>
                        </div>

                        {/* Growth Journey Chart */}
                        <div className="mb-6">
                            <GrowthJourneyChart />
                        </div>

                        {/* MBO Results */}
                        {result.goals.length > 0 && (
                            <div className="mb-6 rounded-xl border border-border bg-card">
                                <div className="border-b border-border px-5 py-4">
                                    <h2 className="text-base font-semibold text-foreground">{t('kr_mbo_kebaaa9ed_keab2b0ea')}</h2>
                                </div>
                                <div className="divide-y divide-border">
                                    {result.goals.map((goal) => (
                                        <div key={goal.id} className="px-5 py-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-sm font-medium text-foreground">{goal.title}</h3>
                                                    <span className="text-xs text-muted-foreground">가중치: {goal.weight}%</span>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <span className="text-muted-foreground">{t('kr_kec9e90ea')} </span><span className="font-medium text-foreground">{goal.selfScore ?? '-'}</span>
                                                    <span className="ml-3 text-muted-foreground">{t('kr_keba7a4eb')} </span><span className="font-medium text-foreground">{goal.managerScore ?? '-'}</span>
                                                </div>
                                            </div>
                                            {goal.managerComment && (
                                                <p className="mt-1 text-xs text-muted-foreground">매니저 코멘트: &quot;{goal.managerComment}&quot;</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Peer Review Results (masked) */}
                        {peerResult && peerResult.summary.completedReviewers > 0 && (
                            <div className="mb-6 rounded-xl border border-border bg-card">
                                <div className="border-b border-border px-5 py-4">
                                    <h2 className="text-base font-semibold text-foreground">
                                        동료평가 결과 ({peerResult.summary.completedReviewers}명 평가 완료)
                                    </h2>
                                </div>
                                <div className="px-5 py-4">
                                    {/* Score summary */}
                                    <div className="mb-4 grid grid-cols-4 gap-3">
                                        {[
                                            { label: t('challenge'), score: peerResult.summary.averageChallenge },
                                            { label: t('trust'), score: peerResult.summary.averageTrust },
                                            { label: t('responsibility'), score: peerResult.summary.averageResponsibility },
                                            { label: t('respect'), score: peerResult.summary.averageRespect },
                                        ].map((v) => (
                                            <div key={v.label} className="rounded-lg bg-muted p-3 text-center">
                                                <p className="text-xs text-muted-foreground">{v.label}</p>
                                                <p className="mt-1 text-lg font-bold text-foreground">{v.score.toFixed(1)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                                        <span className="text-sm text-muted-foreground">{t('kr_keca285ed_average')} </span>
                                        <span className="text-lg font-bold text-primary">{peerResult.summary.overallAverage.toFixed(1)} / 5.0</span>
                                    </div>

                                    {/* Anonymous comments */}
                                    {peerResult.reviews.length > 0 && (
                                        <div className="space-y-3">
                                            {peerResult.reviews.map((r, i) => (
                                                <div key={i} className="rounded-xl border border-border p-3">
                                                    <p className="mb-1 text-xs font-medium text-muted-foreground">{r.reviewerName}</p>
                                                    <p className="text-sm text-foreground">{r.overallComment || '(의견 없음)'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Shield className="h-3.5 w-3.5" /> {t('evaluation_kec9e90_keca095eb_kec9db5eb_kecb298eb')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Acknowledge section */}
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="mb-3 text-base font-semibold text-foreground">{t('kr_keab2b0ea_confirm')}</h2>
                            {isAcknowledged ? (
                                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-500/15 p-4">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    <span className="text-sm font-medium text-emerald-700">
                                        ✅ 확인 완료 ({result.acknowledgedAt?.slice(0, 10)})
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {daysLeft !== null && (
                                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-500/15 p-3">
                                            <Clock className="h-4 w-4 text-amber-600" />
                                            <span className="text-xs text-amber-800">
                                                {result.acknowledgeDeadline?.slice(0, 10)}까지 확인하지 않으면 자동 확인 처리됩니다. (D-{Math.max(daysLeft, 0)})
                                            </span>
                                        </div>
                                    )}
                                    <button onClick={handleAcknowledge} disabled={acknowledging}
                                        className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                                        {acknowledging ? t('processing') : '결과를 확인합니다'}
                                    </button>
                                    <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <p>{t('kr_keab2b0ea_ked9995ec_keb8f99ec_')}</p>
                                    </div>
                                </>
                            )}
                        </div>
                      <ConfirmDialog {...dialogProps} />
      </>
                )}
            </div>
        </div>
    )
}
