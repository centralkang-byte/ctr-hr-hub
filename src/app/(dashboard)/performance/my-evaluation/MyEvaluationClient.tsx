'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, Send, Star, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

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
                    <Star className={`h-6 w-6 ${i <= value ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB]'}`} />
                </button>
            ))}
            <span className="ml-2 text-sm font-medium text-[#8181A5]">{value}/5</span>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────

export default function MyEvaluationClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
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
            } catch { setError('사이클 목록을 불러오지 못했습니다.') }
        }
        load()
    }, [])

    // ─── Fetch evaluation data
    const fetchEvalData = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const [evalRes, goalsRes] = await Promise.all([
                apiClient.get<EvalData>('/api/v1/performance/evaluations/self', { cycleId: selectedCycleId }).catch(() => null),
                apiClient.getList<GoalItem>('/api/v1/performance/goals', { cycleId: selectedCycleId, page: 1, limit: 50 }),
            ])
            setGoals(goalsRes.data)
            if (evalRes) {
                setEvalData(evalRes.data)
            } else {
                // Initialize empty
                const gs: Record<string, { score: number; comment: string }> = {}
                for (const g of goalsRes.data) gs[g.id] = { score: 3, comment: '' }
                const bs: Record<string, { score: number; comment: string }> = {}
                for (const b of BEI_ITEMS) bs[b.key] = { score: 3, comment: '' }
                setEvalData({ id: null, status: 'DRAFT', goalScores: gs, beiScores: bs, mboWeight: 60, beiWeight: 40 })
            }
        } catch { setError('데이터를 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { fetchEvalData() }, [fetchEvalData])

    // ─── Auto-save with debounce (GEMINI FIX #2)
    function scheduleAutoSave() {
        if (isSubmitted) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => { handleSave('DRAFT', true) }, 2000)
    }

    async function handleSave(status: 'DRAFT' | 'SUBMITTED', isAutoSave = false) {
        if (!evalData || !selectedCycleId) return
        if (status === 'SUBMITTED' && !isAutoSave) {
            // Validate all fields
            const allGoalsScored = Object.values(evalData.goalScores).every((s) => s.score > 0)
            const allBeiScored = Object.values(evalData.beiScores).every((s) => s.score > 0)
            const allCommentsNonEmpty = Object.values(evalData.goalScores).every((s) => s.comment.trim())
                && Object.values(evalData.beiScores).every((s) => s.comment.trim())
            if (!allGoalsScored || !allBeiScored || !allCommentsNonEmpty) {
                alert('모든 점수와 코멘트를 작성해주세요.')
                return
            }
            confirm({ title: '제출하면 수정할 수 없습니다. 제출하시겠습니까?', onConfirm: async () =>
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
        scheduleAutoSave()
    }

    function updateBeiScore(key: string, field: 'score' | 'comment', value: number | string) {
        setEvalData((p) => {
            if (!p) return p
            return { ...p, beiScores: { ...p.beiScores, [key]: { ...p.beiScores[key], [field]: value } } }
        })
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
                    <Star className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">아직 자기평가 기간이 아닙니다.</h2>
                    <p className="text-sm text-[#8181A5]">자기평가는 EVAL_OPEN 단계에서 진행됩니다.</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-[#5E81F4] hover:underline">
                        <ArrowLeft className="h-4 w-4" /> 돌아가기
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F5F5FA] p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1C1D21]">{t('selfEvalTitle')}</h1>
                        <p className="mt-1 text-sm text-[#8181A5]">MBO 업적과 BEI 역량을 평가합니다</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Saving indicator (GEMINI FIX #2) */}
                        {saveStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-xs text-[#8181A5]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 저장 중...</span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="flex items-center gap-1.5 text-xs text-[#059669]"><CheckCircle2 className="h-3.5 w-3.5" /> 저장됨</span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="flex items-center gap-1.5 text-xs text-[#C62828]">
                                <XCircle className="h-3.5 w-3.5" /> 저장 실패
                                <button onClick={() => handleSave('DRAFT')} className="font-medium underline">{tCommon('retry')}</button>
                            </span>
                        )}
                        <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                            className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2 text-sm text-[#1C1D21] focus:border-[#5E81F4] focus:outline-none">
                            {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Submitted banner */}
                {isSubmitted && (
                    <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#A7F3D0] bg-[#D1FAE5] p-4">
                        <CheckCircle2 className="h-5 w-5 text-[#059669]" />
                        <span className="text-sm font-medium text-[#047857]">자기평가가 제출되었습니다. 수정할 수 없습니다.</span>
                    </div>
                )}

                {/* Score summary */}
                <div className="mb-6 grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-4 text-center">
                        <p className="text-xs text-[#8181A5]">MBO ({mboWeight}%)</p>
                        <p className="mt-1 text-2xl font-bold text-[#1C1D21]">{mboAvg.toFixed(1)}</p>
                        <p className="text-xs text-[#8181A5]">/ 5.0</p>
                    </div>
                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-4 text-center">
                        <p className="text-xs text-[#8181A5]">BEI ({beiWeight}%)</p>
                        <p className="mt-1 text-2xl font-bold text-[#1C1D21]">{beiAvg.toFixed(1)}</p>
                        <p className="text-xs text-[#8181A5]">/ 5.0</p>
                    </div>
                    <div className="rounded-xl border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4 text-center">
                        <p className="text-xs text-[#5E81F4]">종합 점수</p>
                        <p className="mt-1 text-2xl font-bold text-[#5E81F4]">{totalScore.toFixed(2)}</p>
                        <p className="text-xs text-[#8181A5]">/ 5.0</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-[#FFEBEE] bg-[#FFEBEE] p-3 text-sm text-[#C62828]">
                        {error} <button onClick={fetchEvalData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F3] bg-white p-5">
                                <div className="mb-3 h-4 w-2/3 rounded bg-[#F0F0F3]" />
                                <div className="h-6 w-32 rounded bg-[#F0F0F3]" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="mb-6 flex border-b border-[#F0F0F3]">
                            <button onClick={() => setActiveTab('mbo')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'mbo' ? 'border-[#5E81F4] text-[#5E81F4]' : 'border-transparent text-[#8181A5] hover:text-[#1C1D21]'}`}>
                                MBO 업적평가
                            </button>
                            <button onClick={() => setActiveTab('bei')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bei' ? 'border-[#5E81F4] text-[#5E81F4]' : 'border-transparent text-[#8181A5] hover:text-[#1C1D21]'}`}>
                                BEI 역량평가
                            </button>
                        </div>

                        {/* MBO Tab */}
                        {activeTab === 'mbo' && (
                            <div className="rounded-xl border border-[#F0F0F3] bg-white">
                                <div className="border-b border-[#F0F0F3] px-5 py-4">
                                    <h2 className="text-base font-semibold text-[#1C1D21]">MBO 자기평가 (가중치 합계: {goals.reduce((s, g) => s + Number(g.weight), 0)}%)</h2>
                                </div>
                                <div className="divide-y divide-[#F0F0F3]">
                                    {goals.map((goal) => (
                                        <div key={goal.id} className="px-5 py-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-[#1C1D21]">{goal.title}</p>
                                                    <p className="text-xs text-[#8181A5]">가중치: {goal.weight}%</p>
                                                </div>
                                                <StarRating value={evalData?.goalScores[goal.id]?.score ?? 3}
                                                    onChange={(v) => updateGoalScore(goal.id, 'score', v)} disabled={isSubmitted} />
                                            </div>
                                            <textarea rows={2} disabled={isSubmitted}
                                                value={evalData?.goalScores[goal.id]?.comment ?? ''}
                                                onChange={(e) => updateGoalScore(goal.id, 'comment', e.target.value)}
                                                placeholder="달성 내용을 기술하세요..."
                                                className="w-full resize-none rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none disabled:bg-[#F5F5FA]" />
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-[#F0F0F3] px-5 py-3 text-right">
                                    <span className="text-sm text-[#8181A5]">MBO 총점: </span>
                                    <span className="text-sm font-bold text-[#1C1D21]">{mboAvg.toFixed(1)} / 5.0</span>
                                </div>
                            </div>
                        )}

                        {/* BEI Tab */}
                        {activeTab === 'bei' && (
                            <div className="rounded-xl border border-[#F0F0F3] bg-white">
                                <div className="border-b border-[#F0F0F3] px-5 py-4">
                                    <h2 className="text-base font-semibold text-[#1C1D21]">BEI 역량평가 (CTR 핵심가치)</h2>
                                </div>
                                <div className="divide-y divide-[#F0F0F3]">
                                    {BEI_ITEMS.map((bei) => (
                                        <div key={bei.key} className="px-5 py-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-[#1C1D21]">{bei.label} ({bei.labelEn})</p>
                                                </div>
                                                <StarRating value={evalData?.beiScores[bei.key]?.score ?? 3}
                                                    onChange={(v) => updateBeiScore(bei.key, 'score', v)} disabled={isSubmitted} />
                                            </div>
                                            <textarea rows={2} disabled={isSubmitted}
                                                value={evalData?.beiScores[bei.key]?.comment ?? ''}
                                                onChange={(e) => updateBeiScore(bei.key, 'comment', e.target.value)}
                                                placeholder="근거를 기술하세요..."
                                                className="w-full resize-none rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none disabled:bg-[#F5F5FA]" />
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-[#F0F0F3] px-5 py-3 text-right">
                                    <span className="text-sm text-[#8181A5]">BEI 총점: </span>
                                    <span className="text-sm font-bold text-[#1C1D21]">{beiAvg.toFixed(1)} / 5.0</span>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        {!isSubmitted && (
                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button onClick={() => handleSave('DRAFT')} disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[#F0F0F3] px-4 py-2 text-sm font-medium text-[#1C1D21] hover:bg-[#F5F5FA] disabled:opacity-40 transition-colors">
                                    <Save className="h-4 w-4" /> 임시저장
                                </button>
                                <button onClick={() => handleSave('SUBMITTED')} disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-lg bg-[#5E81F4] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A6FE0] disabled:opacity-40 transition-colors">
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
