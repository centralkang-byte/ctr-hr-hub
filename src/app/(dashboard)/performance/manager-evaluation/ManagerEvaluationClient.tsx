'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { Star, Send, Save, AlertTriangle, CheckCircle2, Clock, X, ArrowLeft, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getGradeLabel } from '@/lib/performance/data-masking'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

const COMMENT_SOFT_LIMIT = 500

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

interface TeamMember {
    employeeId: string; name: string; department: string; jobGrade: string
    selfEval: { status: string; performanceScore: number | null; competencyScore: number | null } | null
    managerEval: { id: string; status: string; performanceScore: number | null; competencyScore: number | null; originalGradeEnum: string | null } | null
    peerReviewProgress: string
    overdueFlags: string[]
    goals: Array<{ id: string; title: string; weight: number; achievementScore: number | null }>
}

interface PeerCandidate {
    employeeId: string; name: string; department: string; jobGrade: string; relevanceScore: number
}

const GRADES = ['E', 'M_PLUS', 'M', 'B']

// ─── Star Rating (reused pattern from D-2a) ───────────────

function Stars({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} disabled={disabled} onClick={() => onChange(i)}
                    className={`transition-transform ${disabled ? 'cursor-not-allowed' : 'hover:scale-110'}`}>
                    <Star className={`h-5 w-5 ${i <= value ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />
                </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
        </div>
    )
}

const CTR_VALUES = [
    { key: 'challenge', label: '도전' }, { key: 'trust', label: '신뢰' },
    { key: 'responsibility', label: '책임' }, { key: 'respect', label: '존중' },
]

// ─── Main Component ───────────────────────────────────────

export default function ManagerEvaluationClient({user: _user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeEval, setActiveEval] = useState<TeamMember | null>(null)
    const [nominating, setNominating] = useState<TeamMember | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                const evalCycles = res.data.filter((c) => ['EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(c.status))
                setCycles(evalCycles)
                if (evalCycles.length > 0) { setSelectedCycleId(evalCycles[0].id); setCycleStatus(evalCycles[0].status) }
            } catch { setError(t('cycleLoadFailed')) }
        }
        load()
    }, [t])

    const fetchTeam = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const res = await apiClient.get<TeamMember[]>('/api/v1/performance/evaluations', { role: 'manager', cycleId: selectedCycleId })
            setTeamMembers(res.data ?? [])
        } catch { setError('팀원 목록을 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { fetchTeam() }, [fetchTeam])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    // Route guard
    const isBlocked = cycleStatus !== '' && !['EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(cycleStatus)
    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_kec9584ec_evaluation_keab8b0ea')}</h2>
                    <p className="text-sm text-muted-foreground">{t('managerEval_keb8a94_eval_open_keb8ba8ea_keca784ed')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}</a>
                </div>
            </div>
        )
    }

    const completedCount = teamMembers.filter((m) => m.managerEval?.status === 'SUBMITTED').length
    const overdueCount = teamMembers.filter((m) => m.overdueFlags.length > 0).length

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('managerEvalTitle')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            내 팀원: {teamMembers.length}명 | 평가 완료: {completedCount}/{teamMembers.length}
                            {overdueCount > 0 && <span className="ml-2 inline-flex items-center gap-1 text-destructive">| Overdue: {overdueCount}명 <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 inline" /><span className="sr-only">경고</span></span>}
                        </p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
                        {error} <button onClick={fetchTeam} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5">
                                <div className="mb-2 h-4 w-1/3 rounded bg-border" />
                                <div className="h-3 w-1/2 rounded bg-border" />
                            </div>
                        ))}
                    </div>
                ) : teamMembers.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-16 text-center">
                        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <EmptyState />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {teamMembers.map((member) => {
                            const isCompleted = member.managerEval?.status === 'SUBMITTED'
                            const hasOverdue = member.overdueFlags.length > 0
                            return (
                                <div key={member.employeeId}
                                    className={`rounded-xl border bg-card p-5 transition-colors ${hasOverdue ? 'border-amber-200' : 'border-border hover:border-primary/30'}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-sm font-semibold text-foreground">{member.name}</h3>
                                                <span className="text-xs text-muted-foreground">{member.jobGrade}</span>
                                                {hasOverdue && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
                                                        <AlertTriangle className="h-3 w-3" /> Overdue
                                                    </span>
                                                )}
                                                {isCompleted && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                        <CheckCircle2 className="h-3 w-3" /> {t('evaluation_complete')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">{member.department}</p>
                                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                <span>MBO: {member.selfEval?.performanceScore?.toFixed(1) ?? '-'}</span>
                                                <span className="inline-flex items-center gap-1">자기평가: {member.selfEval?.status === 'SUBMITTED'
                                                    ? <><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" /><span className="sr-only">완료</span></>
                                                    : <><Clock aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" /><span className="sr-only">미완료</span></>}
                                                </span>
                                                <span>동료평가: {member.peerReviewProgress}</span>
                                            </div>
                                            {hasOverdue && (
                                                <p className="mt-1 text-xs text-red-500">Overdue: {member.overdueFlags.join(', ')}</p>
                                            )}
                                            {isCompleted && member.managerEval?.originalGradeEnum && (
                                                <p className="mt-1 text-xs text-muted-foreground">{t('kr_keba7a4eb_keb93b1ea')} <span className="font-medium text-foreground">{getGradeLabel(member.managerEval.originalGradeEnum)}</span></p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setNominating(member)}
                                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                                                {t('kr_keb8f99eb')}
                                            </button>
                                            <button onClick={() => setActiveEval(member)}
                                                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
                                                {isCompleted ? '수정' : '평가하기'} →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Evaluation Slide-over */}
            {activeEval && (
                <EvalSlideOver member={activeEval} cycleId={selectedCycleId}
                    onClose={() => setActiveEval(null)} onSaved={() => { setActiveEval(null); fetchTeam() }} />
            )}

            {/* Nomination Modal */}
            {nominating && (
                <NominationModal member={nominating} cycleId={selectedCycleId}
                    onClose={() => setNominating(null)} onSaved={() => { setNominating(null); fetchTeam() }} />
            )}
        </div>
    )
}

// ─── EvalSlideOver ────────────────────────────────────────

function EvalSlideOver({ member, cycleId, onClose, onSaved }: {
    member: TeamMember; cycleId: string; onClose: () => void; onSaved: () => void
}) {
    const t = useTranslations('performance')
    const tCommon = useTranslations('common')
    const { confirm, dialogProps } = useConfirmDialog()
    const [tab, setTab] = useState<'mbo' | 'bei' | 'peer' | 'summary'>('mbo')
    const [goalScores, setGoalScores] = useState<Record<string, { score: number; comment: string }>>({})
    const [beiScores, setBeiScores] = useState<Record<string, { score: number; comment: string }>>({})
    const [finalGrade, setFinalGrade] = useState('')
    const [saving, setSaving] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [peerResults, setPeerResults] = useState<Array<{ reviewerName: string; overallComment: string | null; scoreChallenge: number; scoreTrust: number; scoreResponsibility: number; scoreRespect: number }>>([])
    useUnsavedChanges(isDirty)

    const hasOverlengthComment = Object.values(goalScores).some((s) => s.comment.length > COMMENT_SOFT_LIMIT)
        || Object.values(beiScores).some((s) => s.comment.length > COMMENT_SOFT_LIMIT)

    useEffect(() => {
        // Initialize scores
        const gs: Record<string, { score: number; comment: string }> = {}
        for (const g of member.goals) gs[g.id] = { score: 3, comment: '' }
        setGoalScores(gs)
        const bs: Record<string, { score: number; comment: string }> = {}
        for (const v of CTR_VALUES) bs[v.key] = { score: 3, comment: '' }
        setBeiScores(bs)
        setFinalGrade(member.managerEval?.originalGradeEnum ?? 'M')

        // Fetch peer results
        apiClient.get<{ reviews: typeof peerResults }>(`/api/v1/performance/peer-review/results/${member.employeeId}`, { cycleId })
            .then((res) => setPeerResults(res.data.reviews ?? []))
            .catch((err) => { toast({ title: '동료 평가 결과 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) })
    }, [member, cycleId]) // eslint-disable-line react-hooks/exhaustive-deps

    const mboAvg = Object.values(goalScores).length > 0
        ? Object.values(goalScores).reduce((s, v) => s + v.score, 0) / Object.values(goalScores).length : 0
    const beiAvg = Object.values(beiScores).length > 0
        ? Object.values(beiScores).reduce((s, v) => s + v.score, 0) / Object.values(beiScores).length : 0
    const totalScore = Math.round(((mboAvg * 60 + beiAvg * 40) / 100) * 100) / 100

    async function handleSave(status: 'DRAFT' | 'SUBMITTED') {
        if (hasOverlengthComment) {
            toast({ title: `코멘트를 ${COMMENT_SOFT_LIMIT}자 이내로 수정해주세요.`, variant: 'destructive' })
            return
        }
        if (!(status === 'SUBMITTED')) return
        confirm({ title: t('evaluation_keba5bc_ked9995ec_confirmed_ked9b84ec_kec8898ec_keca09ced'), onConfirm: async () => {
            setSaving(true)
            try {
                await apiClient.put(`/api/v1/performance/evaluations/${member.managerEval?.id ?? 'new'}`, {
                    cycleId, employeeId: member.employeeId, status,
                    goalScores: Object.entries(goalScores).map(([goalId, s]) => ({ goalId, ...s })),
                    competencyScores: Object.entries(beiScores).map(([key, s]) => ({ competencyId: key, ...s })),
                    originalGradeEnum: finalGrade,
                })
                setIsDirty(false)
                onSaved()
            } catch { toast({ title: t('saveFailed'), variant: 'destructive' }) }
            finally { setSaving(false) }
        }})
    }

    const TABS = [
        { key: 'mbo' as const, label: t('kr_mbo_evaluation') },
        { key: 'bei' as const, label: t('kr_bei_evaluation') },
        { key: 'peer' as const, label: t('kr_keb8f99eb_keab2b0ea') },
        { key: 'summary' as const, label: t('kr_keca285ed') },
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose}>
            <div className="h-full w-full max-w-2xl overflow-y-auto bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
                    <h2 className="text-lg font-bold text-foreground">{member.name} 평가</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    {TABS.map((t) => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-6">
                    {tab === 'mbo' && (
                        <div className="space-y-4">
                            {member.goals.map((goal) => (
                                <div key={goal.id} className="rounded-xl border border-border p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{goal.title} ({goal.weight}%)</p>
                                            <p className="text-xs text-muted-foreground">자기평가: {goal.achievementScore ?? '-'}/5 | 진행률: {Number(goal.achievementScore ?? 0) * 20}%</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">{t('kr_keba7a4eb_score')}</span>
                                        <Stars value={goalScores[goal.id]?.score ?? 3}
                                            onChange={(v) => { setGoalScores((p) => ({ ...p, [goal.id]: { ...p[goal.id], score: v } })); setIsDirty(true) }} disabled={false} />
                                    </div>
                                    <input type="text" placeholder={tCommon('enterComment')} value={goalScores[goal.id]?.comment ?? ''}
                                        onChange={(e) => { setGoalScores((p) => ({ ...p, [goal.id]: { ...p[goal.id], comment: e.target.value } })); setIsDirty(true) }}
                                        className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
                                    <span className={cn("mt-1 block text-right text-xs", (goalScores[goal.id]?.comment ?? '').length > COMMENT_SOFT_LIMIT ? "text-destructive" : "text-muted-foreground")}>
                                        {(goalScores[goal.id]?.comment ?? '').length}/{COMMENT_SOFT_LIMIT}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'bei' && (
                        <div className="space-y-4">
                            {CTR_VALUES.map((v) => (
                                <div key={v.key} className="rounded-xl border border-border p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-foreground">{v.label}</span>
                                        <Stars value={beiScores[v.key]?.score ?? 3}
                                            onChange={(val) => { setBeiScores((p) => ({ ...p, [v.key]: { ...p[v.key], score: val } })); setIsDirty(true) }} disabled={false} />
                                    </div>
                                    <input type="text" placeholder={tCommon('enterComment')} value={beiScores[v.key]?.comment ?? ''}
                                        onChange={(e) => { setBeiScores((p) => ({ ...p, [v.key]: { ...p[v.key], comment: e.target.value } })); setIsDirty(true) }}
                                        className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
                                    <span className={cn("mt-1 block text-right text-xs", (beiScores[v.key]?.comment ?? '').length > COMMENT_SOFT_LIMIT ? "text-destructive" : "text-muted-foreground")}>
                                        {(beiScores[v.key]?.comment ?? '').length}/{COMMENT_SOFT_LIMIT}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'peer' && (
                        <div className="space-y-4">
                            {peerResults.length === 0 ? (
                                <EmptyState />
                            ) : peerResults.map((r, i) => (
                                <div key={i} className="rounded-xl border border-border p-4">
                                    <p className="mb-2 text-sm font-medium text-foreground">평가자: {r.reviewerName}</p>
                                    <div className="mb-2 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                                        <span>도전: {r.scoreChallenge}/5</span>
                                        <span>신뢰: {r.scoreTrust}/5</span>
                                        <span>책임: {r.scoreResponsibility}/5</span>
                                        <span>존중: {r.scoreRespect}/5</span>
                                    </div>
                                    {r.overallComment && <p className="text-sm text-foreground">&ldquo;{r.overallComment}&rdquo;</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'summary' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-xl border border-border p-3 text-center">
                                    <p className="text-xs text-muted-foreground">MBO (60%)</p>
                                    <p className="text-xl font-bold text-foreground">{mboAvg.toFixed(1)}</p>
                                </div>
                                <div className="rounded-xl border border-border p-3 text-center">
                                    <p className="text-xs text-muted-foreground">BEI (40%)</p>
                                    <p className="text-xl font-bold text-foreground">{beiAvg.toFixed(1)}</p>
                                </div>
                                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                                    <p className="text-xs text-primary">{t('kr_keca285ed_score')}</p>
                                    <p className="text-xl font-bold text-primary">{totalScore.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border p-4">
                                <label className="mb-2 block text-sm font-medium text-foreground">{t('kr_keba7a4eb_kecb59cec_keb93b1ea')}</label>
                                <select value={finalGrade} onChange={(e) => setFinalGrade(e.target.value)}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none">
                                    {GRADES.map((g) => <option key={g} value={g}>{getGradeLabel(g)} ({g})</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 border-t border-border pt-4">
                        <button onClick={() => handleSave('DRAFT')} disabled={saving || hasOverlengthComment}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40">
                            <Save className="h-4 w-4" /> {t('kr_kec9e84ec')}
                        </button>
                        <button onClick={() => handleSave('SUBMITTED')} disabled={saving || hasOverlengthComment}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40">
                            <Send className="h-4 w-4" /> {saving ? '확정 중...' : '평가 확정'}
                        </button>
                    </div>
                </div>
                <ConfirmDialog {...dialogProps} />
            </div>
        </div>
    )
}

// ─── NominationModal ──────────────────────────────────────

function NominationModal({ member, cycleId, onClose, onSaved }: {
    member: TeamMember; cycleId: string; onClose: () => void; onSaved: () => void
}) {
    const t = useTranslations('performance')
    const tCommon = useTranslations('common')
    const [candidates, setCandidates] = useState<PeerCandidate[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
  const { confirm, dialogProps } = useConfirmDialog()

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.get<PeerCandidate[]>('/api/v1/performance/peer-review/candidates', { employeeId: member.employeeId, cycleId })
                setCandidates(res.data ?? [])
            } catch (err) { toast({ title: '동료평가 후보 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
            finally { setLoading(false) }
        }
        load()
    }, [member.employeeId, cycleId])

    function toggleCandidate(id: string) {
        setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
    }

    async function handleNominate() {
        if (selected.size < 2) { toast({ title: t('kr_kecb59cec_2kebaa85ec_keca780eb'), variant: 'destructive' }); return }
        confirm({ title: `${selected.size}명을 동료평가자로 지명하시겠습니까?`, onConfirm: async () => {
            setSaving(true)
            try {
                await apiClient.post('/api/v1/performance/peer-review/nominate', {
                    cycleId, employeeId: member.employeeId, reviewerIds: Array.from(selected),
                })
                onSaved()
            } catch { toast({ title: t('kr_keca780eb_kec8ba4ed'), variant: 'destructive' }) }
            finally { setSaving(false) }
        }})
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
            <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">{member.name} 동료평가자 지명</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">최소 2명, 최대 4명 선택 | 선택: {selected.size}명</p>

                {loading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{tCommon('loading')}</div>
                ) : candidates.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t('kr_kecb694ec_ked9b84eb_kec9786ec')}</div>
                ) : (
                    <div className="space-y-2">
                        {candidates.map((c) => (
                            <label key={c.employeeId}
                                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${selected.has(c.employeeId) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={selected.has(c.employeeId)} onChange={() => toggleCandidate(c.employeeId)}
                                        className="rounded border-border text-primary" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">{c.department} · {c.jobGrade}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground">관련도: {c.relevanceScore}점</span>
                            </label>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">{tCommon('cancel')}</button>
                    <button onClick={handleNominate} disabled={saving || selected.size < 2}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                        {saving ? '지명 중...' : '지명 확정'}
                    </button>
                </div>
            </div>
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
