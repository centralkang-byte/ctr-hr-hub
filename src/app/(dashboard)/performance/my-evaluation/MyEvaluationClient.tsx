'use client'

import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, Send, Star, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

const COMMENT_SOFT_LIMIT = 500

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; evalDeadline?: string }
interface GoalItem { id: string; title: string; weight: number; achievementScore: number | null }

interface BeiItem { key: string; label: string; labelEn: string }
const BEI_ITEMS: BeiItem[] = [
    { key: 'challenge', label: '도전', labelEn: 'Challenge' },
    { key: 'trust', label: '신뢰', labelEn: 'Trust' },
    { key: 'responsibility', label: '책임', labelEn: 'Responsibility' },
    { key: 'respect', label: '존중', labelEn: 'Respect' },
]

interface EvalData {
    id: string | null; status: string
    goalScores: Record<string, { score: number; comment: string }>
    beiScores: Record<string, { score: number; comment: string }>
    mboWeight: number; beiWeight: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Star Rating Component ───────────────────────────────

function StarRating({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} disabled={disabled} onClick={() => onChange(i)}
                    className={`transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}>
                    <Star className={`h-6 w-6 ${i <= value ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />
                </button>
            ))}
            <span className="ml-2 text-sm font-medium text-muted-foreground">{value}/5</span>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────

export default function MyEvaluationClient({user: _user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const { confirm, dialogProps } = useConfirmDialog()

    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [goals, setGoals] = useState<GoalItem[]>([])
    const [evalData, setEvalData] = useState<EvalData | null>(null)
    const [activeTab, setActiveTab] = useState<'mbo' | 'bei'>('mbo')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const [submitting, setSubmitting] = useState(false)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    useUnsavedChanges(isDirty)

    // ─── Fetch cycles
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
    }, [t])

    // ─── Fetch evaluation data
    const fetchEvalData = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const [evalRes, goalsRes] = await Promise.all([
                apiClient.get<EvalData>('/api/v1/performance/evaluations/self', { cycleId: selectedCycleId }).catch(() => null),
                apiClient.getList<GoalItem>('/api/v1/performance/goals', { cycleId: selectedCycleId, page: 1, limit: 50 }),
            ])
            setGoals(goalsRes.data)
            if (evalRes) {
                // Ensure goalScores/beiScores are initialized for all goals/BEI items
                const data = evalRes.data
                const gs = { ...data.goalScores }
                for (const g of goalsRes.data) { if (!gs[g.id]) gs[g.id] = { score: 3, comment: '' } }
                const bs = { ...data.beiScores }
                for (const b of BEI_ITEMS) { if (!bs[b.key]) bs[b.key] = { score: 3, comment: '' } }
                setEvalData({ ...data, goalScores: gs, beiScores: bs })
            } else {
                // Initialize empty
                const gs: Record<string, { score: number; comment: string }> = {}
                for (const g of goalsRes.data) gs[g.id] = { score: 3, comment: '' }
                const bs: Record<string, { score: number; comment: string }> = {}
                for (const b of BEI_ITEMS) bs[b.key] = { score: 3, comment: '' }
                setEvalData({ id: null, status: 'DRAFT', goalScores: gs, beiScores: bs, mboWeight: 60, beiWeight: 40 })
            }
        } catch { setError(t('dataLoadFailed')) }
        finally { setLoading(false) }
    }, [selectedCycleId, t])

    useEffect(() => { fetchEvalData() }, [fetchEvalData])

    // ─── Auto-save with debounce (GEMINI FIX #2)
    function scheduleAutoSave() {
        if (isSubmitted) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => { handleSave('DRAFT', true) }, 2000)
    }

    // Check if any comment exceeds soft limit
    const hasOverlengthComment = evalData?.goalScores && evalData?.beiScores ? (
        Object.values(evalData.goalScores).some((s) => s.comment.length > COMMENT_SOFT_LIMIT)
        || Object.values(evalData.beiScores).some((s) => s.comment.length > COMMENT_SOFT_LIMIT)
    ) : false

    async function handleSave(status: 'DRAFT' | 'SUBMITTED', isAutoSave = false) {
        if (!evalData || !selectedCycleId) return
        if (hasOverlengthComment && !isAutoSave) {
            toast({ title: `코멘트를 ${COMMENT_SOFT_LIMIT}자 이내로 수정해주세요.`, variant: 'destructive' })
            return
        }
        if (status === 'SUBMITTED' && !isAutoSave) {
            // Validate all fields
            const allGoalsScored = Object.values(evalData.goalScores).every((s) => s.score > 0)
            const allBeiScored = Object.values(evalData.beiScores).every((s) => s.score > 0)
            const allCommentsNonEmpty = Object.values(evalData.goalScores).every((s) => s.comment.trim())
                && Object.values(evalData.beiScores).every((s) => s.comment.trim())
            if (!allGoalsScored || !allBeiScored || !allCommentsNonEmpty) {
                toast({ title: t('kr_kebaaa8eb_keca090ec_kecbd94eb_'), variant: 'destructive' })
                return
            }
            confirm({ title: t('submit_ked9598eb_kec8898ec_kec8898_kec9786ec_keca09cec'), onConfirm: async () => {
                if (abortRef.current) abortRef.current.abort()
                abortRef.current = new AbortController()
                setSubmitting(true)
                setSaveStatus('saving')
                try {
                    await apiClient.post('/api/v1/performance/evaluations/self', {
                        cycleId: selectedCycleId,
                        goalScores: Object.entries(evalData.goalScores).map(([goalId, s]) => ({ goalId, ...s })),
                        competencyScores: Object.entries(evalData.beiScores).map(([competencyId, s]) => ({ competencyId, ...s })),
                        overallComment: '',
                        status,
                    })
                    setSaveStatus('saved')
                    setIsDirty(false)
                    setEvalData((p) => p ? { ...p, status: 'SUBMITTED' } : p)
                    setTimeout(() => setSaveStatus('idle'), 3000)
                } catch (err) {
                    if (err instanceof Error && err.name === 'AbortError') return
                    setSaveStatus('error')
                } finally {
                    setSubmitting(false)
                }
            }})
            return
        }

        // Abort previous in-flight request (GEMINI FIX #2)
        if (abortRef.current) abortRef.current.abort()
        abortRef.current = new AbortController()

        if (!isAutoSave) setSubmitting(true)
        setSaveStatus('saving')

        try {
            await apiClient.post('/api/v1/performance/evaluations/self', {
                cycleId: selectedCycleId,
                goalScores: Object.entries(evalData.goalScores).map(([goalId, s]) => ({ goalId, ...s })),
                competencyScores: Object.entries(evalData.beiScores).map(([competencyId, s]) => ({ competencyId, ...s })),
                overallComment: '',
                status,
            })
            setSaveStatus('saved')
            setIsDirty(false)
            if (status === 'SUBMITTED') {
                setEvalData((p) => p ? { ...p, status: 'SUBMITTED' } : p)
            }
            setTimeout(() => setSaveStatus('idle'), 3000)
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return
            setSaveStatus('error')
        } finally {
            if (!isAutoSave) setSubmitting(false)
        }
    }

    // ─── Helpers
    function updateGoalScore(goalId: string, field: 'score' | 'comment', value: number | string) {
        setEvalData((p) => {
            if (!p) return p
            return { ...p, goalScores: { ...p.goalScores, [goalId]: { ...p.goalScores[goalId], [field]: value } } }
        })
        setIsDirty(true)
        scheduleAutoSave()
    }

    function updateBeiScore(key: string, field: 'score' | 'comment', value: number | string) {
        setEvalData((p) => {
            if (!p) return p
            return { ...p, beiScores: { ...p.beiScores, [key]: { ...p.beiScores[key], [field]: value } } }
        })
        setIsDirty(true)
        scheduleAutoSave()
    }

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    const isSubmitted = evalData?.status === 'SUBMITTED'

    // ─── Calculated scores
    const mboScores = Object.values(evalData?.goalScores ?? {})
    const mboAvg = mboScores.length > 0 ? mboScores.reduce((s, v) => s + v.score, 0) / mboScores.length : 0
    const beiScores = Object.values(evalData?.beiScores ?? {})
    const beiAvg = beiScores.length > 0 ? beiScores.reduce((s, v) => s + v.score, 0) / beiScores.length : 0
    const mboWeight = evalData?.mboWeight ?? 60
    const beiWeight = evalData?.beiWeight ?? 40
    const totalScore = Math.round(((mboAvg * mboWeight + beiAvg * beiWeight) / 100) * 100) / 100

    // Route guard
    const isBlocked = cycleStatus !== '' && !['EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(cycleStatus)

    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_kec9584ec_selfeval_keab8b0ea_k')}</h2>
                    <p className="text-sm text-muted-foreground">{t('selfEval_keb8a94_eval_open_keb8ba8ea_keca784ed')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('selfEvalTitle')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t('kr_mbo_kec9785ec_bei_kec97adeb_ke')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Saving indicator (GEMINI FIX #2) */}
                        {saveStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('save_keca491')}</span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {t('save_keb90a8')}</span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="flex items-center gap-1.5 text-xs text-destructive">
                                <XCircle className="h-3.5 w-3.5" /> {t('saveFailed')}
                                <button onClick={() => handleSave('DRAFT')} className="font-medium underline">{tCommon('retry')}</button>
                            </span>
                        )}
                        <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                            {!cycles?.length && <option value="">{t('kr_kec9584ec_selfeval_keab8b0ea_k')}</option>}
                            {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Submitted banner */}
                {isSubmitted && (
                    <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-500/15 p-4">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">{t('selfEval_keab080_keca09cec_kec8898ec_kec8898_kec9786ec')}</span>
                    </div>
                )}

                {/* Score summary */}
                <div className="mb-6 grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-xs text-muted-foreground">MBO ({mboWeight}%)</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{mboAvg.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">/ 5.0</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-xs text-muted-foreground">BEI ({beiWeight}%)</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">{beiAvg.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">/ 5.0</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                        <p className="text-xs text-primary">{t('kr_keca285ed_score')}</p>
                        <p className="mt-1 text-2xl font-bold text-primary">{totalScore.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">/ 5.0</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
                        {error} <button onClick={fetchEvalData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5">
                                <div className="mb-3 h-4 w-2/3 rounded bg-border" />
                                <div className="h-6 w-32 rounded bg-border" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="mb-6 flex border-b border-border">
                            <button onClick={() => setActiveTab('mbo')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'mbo' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                                {t('kr_mbo_kec9785ec')}
                            </button>
                            <button onClick={() => setActiveTab('bei')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bei' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                                {t('kr_bei_kec97adeb')}
                            </button>
                        </div>

                        {/* MBO Tab */}
                        {activeTab === 'mbo' && (
                            <div className="rounded-xl border border-border bg-card">
                                <div className="border-b border-border px-5 py-4">
                                    <h2 className="text-base font-semibold text-foreground">MBO 자기평가 (가중치 합계: {goals.reduce((s, g) => s + Number(g.weight), 0)}%)</h2>
                                </div>
                                <div className="divide-y divide-border">
                                    {goals.map((goal) => (
                                        <div key={goal.id} className="px-5 py-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{goal.title}</p>
                                                    <p className="text-xs text-muted-foreground">가중치: {goal.weight}%</p>
                                                </div>
                                                <StarRating value={evalData?.goalScores?.[goal.id]?.score ?? 3}
                                                    onChange={(v) => updateGoalScore(goal.id, 'score', v)} disabled={isSubmitted} />
                                            </div>
                                            <textarea rows={2} disabled={isSubmitted}
                                                value={evalData?.goalScores?.[goal.id]?.comment ?? ''}
                                                onChange={(e) => updateGoalScore(goal.id, 'comment', e.target.value)}
                                                placeholder="달성 내용을 기술하세요..."
                                                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-muted" />
                                            <span className={cn("mt-1 block text-right text-xs", (evalData?.goalScores?.[goal.id]?.comment ?? '').length > COMMENT_SOFT_LIMIT ? "text-destructive" : "text-muted-foreground")}>
                                                {(evalData?.goalScores?.[goal.id]?.comment ?? '').length}/{COMMENT_SOFT_LIMIT}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-border px-5 py-3 text-right">
                                    <span className="text-sm text-muted-foreground">{t('kr_mbo_kecb49dec')} </span>
                                    <span className="text-sm font-bold text-foreground">{mboAvg.toFixed(1)} / 5.0</span>
                                </div>
                            </div>
                        )}

                        {/* BEI Tab */}
                        {activeTab === 'bei' && (
                            <div className="rounded-xl border border-border bg-card">
                                <div className="border-b border-border px-5 py-4">
                                    <h2 className="text-base font-semibold text-foreground">{t('kr_bei_kec97adeb_ctr_ked95b5ec')}</h2>
                                </div>
                                <div className="divide-y divide-border">
                                    {BEI_ITEMS.map((bei) => (
                                        <div key={bei.key} className="px-5 py-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{bei.label} ({bei.labelEn})</p>
                                                </div>
                                                <StarRating value={evalData?.beiScores?.[bei.key]?.score ?? 3}
                                                    onChange={(v) => updateBeiScore(bei.key, 'score', v)} disabled={isSubmitted} />
                                            </div>
                                            <textarea rows={2} disabled={isSubmitted}
                                                value={evalData?.beiScores?.[bei.key]?.comment ?? ''}
                                                onChange={(e) => updateBeiScore(bei.key, 'comment', e.target.value)}
                                                placeholder="근거를 기술하세요..."
                                                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:bg-muted" />
                                            <span className={cn("mt-1 block text-right text-xs", (evalData?.beiScores?.[bei.key]?.comment ?? '').length > COMMENT_SOFT_LIMIT ? "text-destructive" : "text-muted-foreground")}>
                                                {(evalData?.beiScores?.[bei.key]?.comment ?? '').length}/{COMMENT_SOFT_LIMIT}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-border px-5 py-3 text-right">
                                    <span className="text-sm text-muted-foreground">{t('kr_bei_kecb49dec')} </span>
                                    <span className="text-sm font-bold text-foreground">{beiAvg.toFixed(1)} / 5.0</span>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        {!isSubmitted && (
                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button onClick={() => handleSave('DRAFT')} disabled={submitting || hasOverlengthComment}
                                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors">
                                    <Save className="h-4 w-4" /> {t('kr_kec9e84ec')}
                                </button>
                                <button onClick={() => handleSave('SUBMITTED')} disabled={submitting || hasOverlengthComment}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                                    <Send className="h-4 w-4" /> {submitting ? tCommon('loading') : tCommon('submit')}
                                </button>
                            </div>
                        )}
                      <ConfirmDialog {...dialogProps} />
      </>
                )}
            </div>
        </div>
    )
}
