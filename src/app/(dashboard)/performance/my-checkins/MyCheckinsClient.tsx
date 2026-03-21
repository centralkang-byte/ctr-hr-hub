'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, Clock, ClipboardCheck, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; checkInMode: string | null }
interface CheckinStatus {
    hasOneOnOne: boolean; hasManagerNote: boolean; goalsUpdated: number; goalsTotal: number
    checkInMode: string; deadline: string | null; completed: boolean
}
interface GoalProgress {
    id: string; title: string; weight: number; achievementScore: number | null; status: string
}

// ─── Component ────────────────────────────────────────────

export default function MyCheckinsClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [checkinStatus, setCheckinStatus] = useState<CheckinStatus | null>(null)
    const [goals, setGoals] = useState<GoalProgress[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [progressInputs, setProgressInputs] = useState<Record<string, number>>({})
    const [memos, setMemos] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                setCycles(res.data)
                if (res.data.length > 0) {
                    setSelectedCycleId(res.data[0].id)
                    setCycleStatus(res.data[0].status)
                }
            } catch { setError(t('cycleListLoadFailed')) }
        }
        load()
    }, [])

    const fetchData = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const [statusRes, goalsRes] = await Promise.all([
                apiClient.get<CheckinStatus>(`/api/v1/performance/checkins/${selectedCycleId}/status`).catch(() => null),
                apiClient.getList<GoalProgress>('/api/v1/performance/goals', { cycleId: selectedCycleId, page: 1, limit: 50 }),
            ])
            if (statusRes) setCheckinStatus(statusRes.data)
            setGoals(goalsRes.data)
            const pi: Record<string, number> = {}
            for (const g of goalsRes.data) pi[g.id] = Number(g.achievementScore ?? 0)
            setProgressInputs(pi)
        } catch { setError(t('dataLoadFailed')) }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { fetchData() }, [fetchData])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    async function handleSaveProgress(goalId: string) {
        setSaving(goalId)
        try {
            await apiClient.post(`/api/v1/performance/goals/${goalId}/progress`, {
                progressPct: progressInputs[goalId] ?? 0,
                note: memos[goalId] || undefined,
            })
            await fetchData()
        } catch { toast({ title: t('kr_keca784ed_keca080ec_kec8ba4ed'), variant: 'destructive' }) }
        finally { setSaving(null) }
    }

    // Route guard
    const isCheckInPeriod = cycleStatus === 'CHECK_IN'
    const isBlocked = cycleStatus !== '' && !['CHECK_IN', 'EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED'].includes(cycleStatus)

    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">{t('kr_kecb2b4ed_keab8b0ea_kec9584eb')}</h2>
                    <p className="text-sm text-[#8181A5]">{t('kr_kecb2b4ed_check_in_keb8ba8ea_k')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-[#5E81F4] hover:underline">
                        <ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}
                    </a>
                </div>
            </div>
        )
    }

    const conditions = checkinStatus ? [
        { label: t('oneOnOne_keab8b0eb'), done: checkinStatus.hasOneOnOne, detail: checkinStatus.hasOneOnOne ? '완료' : '미완료' },
        { label: t('kr_keba7a4eb_keab8b0eb'), done: checkinStatus.hasManagerNote, detail: checkinStatus.hasManagerNote ? '완료' : '미완료' },
        { label: t('goals_keca784ed_kec9785eb'), done: checkinStatus.goalsUpdated >= checkinStatus.goalsTotal && checkinStatus.goalsTotal > 0, detail: `${checkinStatus.goalsUpdated}/${checkinStatus.goalsTotal} 목표 업데이트됨` },
    ] : []

    const allComplete = conditions.every((c) => c.done)
    const isMandatory = checkinStatus?.checkInMode === 'MANDATORY'

    return (
        <div className="min-h-screen bg-[#F5F5FA] p-6">
            <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1C1D21]">{t('kr_keb8298ec_kecb2b4ed_my_check_i')}</h1>
                        <p className="mt-1 text-sm text-[#8181A5]">{t('kr_keca491ea_keca090ea_ked86b5ed_')}</p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2 text-sm text-[#1C1D21] focus:border-[#5E81F4] focus:outline-none">
                        {!cycles?.length && <EmptyState />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Status banner */}
                {checkinStatus && (
                    <div className={`mb-6 rounded-xl border p-4 ${allComplete ? 'border-[#A7F3D0] bg-[#D1FAE5]' : isMandatory ? 'border-[#FDE68A] bg-[#FEF3C7]' : 'border-[#F0F0F3] bg-white'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {allComplete ? (
                                    <><CheckCircle2 className="h-5 w-5 text-[#059669]" /><span className="font-medium text-[#047857]">{t('kr_kecb2b4ed_complete')}</span></>
                                ) : (
                                    <><Clock className="h-5 w-5 text-[#D97706]" /><span className="font-medium text-[#92400E]">{isMandatory ? '필수' : '권장'} 체크인 진행 중</span></>
                                )}
                            </div>
                            {checkinStatus.deadline && (
                                <span className="text-sm text-[#8181A5]">마감: {checkinStatus.deadline.slice(0, 10)}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 rounded-lg border border-[#FFEBEE] bg-[#FFEBEE] p-3 text-sm text-[#C62828]">
                        {error} <button onClick={fetchData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F3] bg-white p-5">
                                <div className="mb-3 h-4 w-1/2 rounded bg-[#F0F0F3]" />
                                <div className="h-3 w-1/3 rounded bg-[#F0F0F3]" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Check-in conditions */}
                        {conditions.length > 0 && (
                            <div className="mb-6 rounded-xl border border-[#F0F0F3] bg-white">
                                <div className="border-b border-[#F0F0F3] px-5 py-4">
                                    <h2 className="text-base font-semibold text-[#1C1D21]">{t('kr_kecb2b4ed_keca1b0ea')}</h2>
                                </div>
                                <div className="divide-y divide-[#F0F0F3]">
                                    {conditions.map((c, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                {c.done ? (
                                                    <CheckCircle2 className="h-5 w-5 text-[#059669]" />
                                                ) : (
                                                    <Circle className="h-5 w-5 text-[#8181A5]" />
                                                )}
                                                <span className={`text-sm font-medium ${c.done ? 'text-[#047857]' : 'text-[#1C1D21]'}`}>{c.label}</span>
                                            </div>
                                            <span className={`text-sm ${c.done ? 'text-[#059669]' : 'text-[#8181A5]'}`}>{c.detail}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Goals progress update */}
                        <div className="rounded-xl border border-[#F0F0F3] bg-white">
                            <div className="border-b border-[#F0F0F3] px-5 py-4">
                                <h2 className="text-base font-semibold text-[#1C1D21]">{t('goals_keca784ed_kec9785eb')}</h2>
                            </div>
                            {goals.length === 0 ? (
                                <div className="p-8 text-center text-sm text-[#8181A5]">{t('register_keb909c_kebaaa9ed_kec9786ec')}</div>
                            ) : (
                                <div className="divide-y divide-[#F0F0F3]">
                                    {goals.map((goal) => (
                                        <div key={goal.id} className="px-5 py-4">
                                            <div className="mb-3 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[#1C1D21]">{goal.title}</h3>
                                                    <span className="text-xs text-[#8181A5]">가중치: {goal.weight}%</span>
                                                </div>
                                                <span className="text-sm font-medium text-[#5E81F4]">{Number(goal.achievementScore ?? 0)}%</span>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="mb-3 h-2 rounded-full bg-[#F0F0F3]">
                                                <div className="h-2 rounded-full bg-[#5E81F4] transition-all" style={{ width: `${Math.min(Number(goal.achievementScore ?? 0), 100)}%` }} />
                                            </div>
                                            {/* Inline edit (only during CHECK_IN) */}
                                            {isCheckInPeriod && (
                                                <div className="flex items-end gap-3">
                                                    <div className="flex-1">
                                                        <label className="mb-1 block text-xs text-[#8181A5]">{t('kr_kec8388_keca784ed')}</label>
                                                        <input type="number" min={0} max={100}
                                                            value={progressInputs[goal.id] ?? 0}
                                                            onChange={(e) => setProgressInputs((p) => ({ ...p, [goal.id]: Number(e.target.value) }))}
                                                            className="w-24 rounded-lg border border-[#F0F0F3] px-3 py-1.5 text-sm focus:border-[#5E81F4] focus:outline-none" />
                                                    </div>
                                                    <div className="flex-[2]">
                                                        <label className="mb-1 block text-xs text-[#8181A5]">{t('kr_keba994eb_kec84a0ed')}</label>
                                                        <input type="text" value={memos[goal.id] ?? ''}
                                                            onChange={(e) => setMemos((p) => ({ ...p, [goal.id]: e.target.value }))}
                                                            placeholder={tCommon('enterNote')}
                                                            className="w-full rounded-lg border border-[#F0F0F3] px-3 py-1.5 text-sm focus:border-[#5E81F4] focus:outline-none" />
                                                    </div>
                                                    <button onClick={() => handleSaveProgress(goal.id)}
                                                        disabled={saving === goal.id}
                                                        className="rounded-lg bg-[#5E81F4] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#4A6FE0] transition-colors">
                                                        {saving === goal.id ? tCommon('loading') : tCommon('save')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
