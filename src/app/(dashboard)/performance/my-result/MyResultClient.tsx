'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Award, Target, TrendingUp, CheckCircle2, Clock, Info, ArrowLeft, Shield } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { GRADE_CONFIG } from '@/lib/styles/performance'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import dynamic from 'next/dynamic'

const GrowthJourneyChart = dynamic(() => import('@/components/performance/GrowthJourneyChart'), { ssr: false })

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; half: string; isResultPublished: boolean }

// API 응답(`/performance/reviews/my-result`)은 { review, mboGoals } 중첩 형태.
// fetchResult에서 이 평탄 형태로 매핑한다 (필드 contract = route.ts).
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
    // MBO 목표는 단일 달성 점수(achievementScore)만 노출 — self/manager 분리 점수는
    // 이 엔드포인트가 제공하지 않음 (PerformanceEvaluation.performanceDetail 영역).
    goals: Array<{
        id: string; title: string; weight: number
        score: number | null; status: string
    }>
}

// ─── API 응답 원형 (중첩) ─────────────────────────────────

interface MyResultApiResponse {
    review: {
        id: string
        finalGrade: string | null
        finalGradeLabel: string | null
        mboScore: number | null
        beiScore: number | null
        totalScore: number | null
        mboWeight: number
        beiWeight: number
        notifiedAt: string | null
        acknowledgedAt: string | null
        acknowledgeDeadline: string | null
    }
    mboGoals: Array<{ id: string; title: string; weight: number; score: number | null; status: string }>
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

// ─── Component ────────────────────────────────────────────

export default function MyResultClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const { confirm, dialogProps } = useConfirmDialog()

    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [result, setResult] = useState<ReviewResult | null>(null)
    const [peerResult, setPeerResult] = useState<PeerResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [acknowledging, setAcknowledging] = useState(false)
    // 사이클 전환 시 늦게 도착한 이전 요청이 새 결과를 덮어쓰는 경합 방지 (최신 요청만 반영)
    const fetchSeqRef = useRef(0)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                // 결과 열람 허용 = isResultPublished (서버: 본인 PerformanceReview.notifiedAt 단조)만으로 판정.
                // status를 추가 결합하면 통보 후 cycle이 CALIBRATION/COMP_*로 진행될 때 결과가 목록에서
                // 사라지는 회귀가 발생(서버 게이트와 불일치) — isResultPublished가 단일 권위 신호다.
                const resultCycles = res.data.filter((c) => c.isResultPublished === true)
                setCycles(resultCycles)
                if (resultCycles.length > 0) {
                    setSelectedCycleId(resultCycles[0].id)
                }
            } catch { setError(t('cycleListLoadFailed')) }
        }
        load()
    }, [t])

    const fetchResult = useCallback(async () => {
        if (!selectedCycleId) { setLoading(false); return }
        const seq = ++fetchSeqRef.current
        setLoading(true); setError('')
        // 사이클 전환 시 직전 결과 잔존 방지 (404면 빈 상태로)
        setResult(null); setPeerResult(null)
        try {
            const [resultRes, peerRes] = await Promise.all([
                apiClient.get<MyResultApiResponse>('/api/v1/performance/reviews/my-result', { cycleId: selectedCycleId }).catch(() => null),
                apiClient.get<PeerResult>(`/api/v1/performance/peer-review/results/${user.employeeId}`, { cycleId: selectedCycleId }).catch(() => null),
            ])
            // 더 새로운 요청이 시작됐으면 이 응답은 stale — 상태 갱신 안 함
            if (seq !== fetchSeqRef.current) return
            if (resultRes) {
                const { review, mboGoals } = resultRes.data
                setResult({
                    reviewId: review.id,
                    finalGradeEnum: review.finalGrade,
                    finalGradeLabel: review.finalGradeLabel,
                    performanceScore: review.mboScore,
                    competencyScore: review.beiScore,
                    totalScore: review.totalScore,
                    mboWeight: review.mboWeight,
                    beiWeight: review.beiWeight,
                    notifiedAt: review.notifiedAt,
                    acknowledgedAt: review.acknowledgedAt,
                    acknowledgeDeadline: review.acknowledgeDeadline,
                    goals: mboGoals ?? [],
                })
            }
            if (peerRes) setPeerResult(peerRes.data)
        } catch {
            if (seq === fetchSeqRef.current) setError(t('myResult.loadFailed'))
        }
        finally {
            if (seq === fetchSeqRef.current) setLoading(false)
        }
    }, [selectedCycleId, user.employeeId])

    useEffect(() => { fetchResult() }, [fetchResult])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
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

    // Route guard — 선택 cycle이 공개(isResultPublished = 본인 PerformanceReview.notifiedAt 단조)
    // 되지 않았으면 차단. status 가드(getAllowedStatuses)는 FINALIZED/CALIBRATION 등 통보 가능 단계를
    // 누락해 통보된 결과를 막던 회귀가 있어 isResultPublished 단일 신호로 통일(드롭다운 필터와 동일).
    const selectedCycle = cycles.find(c => c.id === selectedCycleId)
    const isBlocked = selectedCycleId !== '' && !!selectedCycle && selectedCycle.isResultPublished !== true

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

    const grade = result?.finalGradeEnum ? GRADE_CONFIG[result.finalGradeEnum] : null
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
                        aria-label={t('kr_kec84b1ea_evaluation_keab2b0ea')}
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
                                <div className={`mx-auto inline-flex rounded-xl px-8 py-4 ${grade.className}`}>
                                    <span className="text-2xl font-bold">{t(grade.labelKey)}</span>
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
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-sm font-medium text-foreground">{goal.title}</h3>
                                                    <span className="text-xs text-muted-foreground">{t('weight')}: {goal.weight}%</span>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <span className="text-muted-foreground">{t('achievement')} </span><span className="font-medium text-foreground">{goal.score?.toFixed(1) ?? '-'}</span>
                                                </div>
                                            </div>
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
                                        {t('myResult.peerResultTitle', { count: peerResult.summary.completedReviewers })}
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
                                                    <p className="text-sm text-foreground">{r.overallComment || t('myResult.noComment')}</p>
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
                                <div className="flex items-center gap-2 rounded-lg border border-tertiary/40 bg-tertiary/10 p-4">
                                    <CheckCircle2 className="h-5 w-5 text-[#006b39]" />
                                    <span className="text-sm font-medium text-[#006b39]">
                                        {t('myResult.acknowledgedAt', { date: result.acknowledgedAt?.slice(0, 10) ?? '' })}
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {daysLeft !== null && (
                                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning-bright/40 bg-warning-bright/15 p-3">
                                            <Clock className="h-4 w-4 text-ctr-warning" />
                                            <span className="text-xs text-ctr-warning">
                                                {t('myResult.autoConfirmWarning', { deadline: result.acknowledgeDeadline?.slice(0, 10) ?? '', days: Math.max(daysLeft, 0) })}
                                            </span>
                                        </div>
                                    )}
                                    <button onClick={handleAcknowledge} disabled={acknowledging}
                                        className="w-full rounded-lg bg-warm py-3 text-sm font-medium text-white hover:brightness-95 disabled:opacity-40 transition-colors">
                                        {acknowledging ? t('processing') : t('myResult.acknowledgeButton')}
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
