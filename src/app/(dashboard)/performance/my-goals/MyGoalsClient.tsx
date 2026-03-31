'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Lock, AlertTriangle, Target, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getAllowedStatuses } from '@/lib/performance/pipeline'
import { STATUS_VARIANT } from '@/lib/styles/status'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; half: string }
interface GoalItem {
    id: string; title: string; description: string | null; weight: number
    kpiMetrics: string | null; targetDate: string | null; status: string
    achievementScore: number | null; isLocked: boolean | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: '임시저장', cls: STATUS_VARIANT.neutral },
    PENDING_APPROVAL: { label: '승인 대기', cls: STATUS_VARIANT.warning },
    APPROVED: { label: '승인됨', cls: STATUS_VARIANT.success },
    REJECTED: { label: '반려', cls: STATUS_VARIANT.error },
}

// ─── Goal Modal ───────────────────────────────────────────

interface GoalForm { title: string; description: string; kpiMetrics: string; weight: number; targetDate: string }

function GoalModal({ initial, onSave, onClose, saving }: {
    initial?: GoalForm; onSave: (f: GoalForm) => void; onClose: () => void; saving: boolean
}) {
    const [form, setForm] = useState<GoalForm>(initial ?? { title: '', description: '', kpiMetrics: '', weight: 20, targetDate: '' })
    const set = (k: keyof GoalForm, v: string | number) => setForm((p) => ({ ...p, [k]: v }))

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
            <div className="w-full max-w-lg rounded-xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">{initial ? '목표 수정' : '목표 추가'}</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{'제목'} <span className="text-red-500">*</span></label>
                        <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="목표 제목" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{'설명'} <span className="text-red-500">*</span></label>
                        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={500}
                            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="목표 상세 설명" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{'KPI 지표 (선택)'}</label>
                        <input value={form.kpiMetrics} onChange={(e) => set('kpiMetrics', e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="매출액, 수주잔고" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">{'가중치 (%)'} <span className="text-red-500">*</span></label>
                            <input type="number" min={5} max={100} step={5} value={form.weight} onChange={(e) => set('weight', Math.max(5, Math.min(100, Number(e.target.value))))}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">{'마감일'} <span className="text-red-500">*</span></label>
                            <input type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">{'취소'}</button>
                    <button onClick={() => onSave(form)} disabled={!form.title || !form.description || !form.targetDate || saving}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                        {saving ? '로딩 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────

export default function MyGoalsClient({user }: {
  user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const { confirm, dialogProps } = useConfirmDialog()

    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [goals, setGoals] = useState<GoalItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [modal, setModal] = useState<{ mode: 'add' | 'edit'; goalId?: string; initial?: GoalForm } | null>(null)
    const [saving, setSaving] = useState(false)
    const fetchRef = useRef(false)

    // ─── Fetch cycles
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

    // ─── Fetch goals
    const fetchGoals = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const res = await apiClient.getList<GoalItem>('/api/v1/performance/goals', { cycleId: selectedCycleId, page: 1, limit: 50 })
            setGoals(res.data)
        } catch { setError('목표 목록을 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { if (!fetchRef.current) { fetchRef.current = true } fetchGoals() }, [fetchGoals])

    // ─── Derived state (GEMINI FIX #1: integer arithmetic only)
    const totalWeight = goals.reduce((sum, g) => sum + Number(g.weight), 0)
    const canSubmit = totalWeight === 100 && goals.some((g) => g.status === 'DRAFT')
    const selectedHalf = cycles.find(c => c.id === selectedCycleId)?.half ?? 'H2'
    const allowedStatuses = getAllowedStatuses('goals', selectedHalf)
    const isViewOnly = !['ACTIVE'].includes(cycleStatus)
    const isBlocked = !allowedStatuses.includes(cycleStatus) && cycleStatus !== ''

    // ─── Handlers
    async function handleSave(form: GoalForm) {
        setSaving(true)
        try {
            if (modal?.mode === 'edit' && modal.goalId) {
                await apiClient.put(`/api/v1/performance/goals/${modal.goalId}`, { ...form, cycleId: selectedCycleId })
            } else {
                await apiClient.post('/api/v1/performance/goals', { ...form, cycleId: selectedCycleId })
            }
            setModal(null); await fetchGoals()
        } catch { toast({ title: t('saveFailed'), variant: 'destructive' }) }
        finally { setSaving(false) }
    }

    async function handleDelete(goalId: string) {
        confirm({ variant: 'destructive', title: t('kr_kec9db4_kebaaa9ed_kec82adec'), onConfirm: async () => {
            try { await apiClient.delete(`/api/v1/performance/goals/${goalId}`); await fetchGoals() }
            catch { toast({ title: t('delete_kec9790_kec8ba4ed'), variant: 'destructive' }) }
        }})
    }

    async function handleSubmitAll() {
        if (!canSubmit) return
        confirm({ title: t('kr_kebaaa8eb_draft_kebaaa9ed_keca'), onConfirm: async () => {
            setSaving(true)
            try {
                const firstDraft = goals.find((g) => g.status === 'DRAFT')
                if (firstDraft) {
                    await apiClient.put(`/api/v1/performance/goals/${firstDraft.id}/submit`)
                    await fetchGoals()
                }
            } catch { toast({ title: t('submit_kec9790_kec8ba4ed'), variant: 'destructive' }) }
            finally { setSaving(false) }
        }})
    }

    // ─── Cycle selector change
    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    // ─── Route guard
    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('goals_settings_keab8b0ea_kec9584eb')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_ked9884ec_cycle_kec8381ed_keba')}</p>
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
                        <h1 className="text-2xl font-bold text-foreground">{t('myGoals_my_goals')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t('kr_mbo_kebaaa9ed_kec84a4ec_keab48')}</p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Weight summary bar */}
                <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{t('kr_keab080ec_ked95a9ea')}</span>
                        <span className={`text-lg font-bold ${totalWeight === 100 ? 'text-tertiary' : 'text-destructive'}`}>
                            {totalWeight}/100%
                        </span>
                        {totalWeight !== 100 && (
                            <span className="flex items-center gap-1 text-xs text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" /> {t('kr_100_keab080_keb9098ec_submit_k')}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!isViewOnly && (
                            <button onClick={() => setModal({ mode: 'add' })}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
                                <Plus className="h-4 w-4" /> {t('goals_add')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
                        {error} <button onClick={fetchGoals} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {/* Goal cards */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5">
                                <div className="mb-3 h-4 w-2/3 rounded bg-border" />
                                <div className="mb-2 h-3 w-1/2 rounded bg-border" />
                                <div className="h-2 w-full rounded-full bg-border" />
                            </div>
                        ))}
                    </div>
                ) : goals.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-16 text-center">
                        <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="mb-2 text-muted-foreground">{t('kr_kec9584ec_keb93b1eb_kebaaa9ed_')}</p>
                        {!isViewOnly && (
                            <button onClick={() => setModal({ mode: 'add' })}
                                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                                <Plus className="h-4 w-4" /> {t('kr_kecb2ab_kebb288ec_goals_kecb69')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {!(goals?.length) && (
          <EmptyState
            title={tCommon('emptyTitle')}
            description={tCommon('emptyDesc')}
          />
        )}
        {goals.map((goal) => {
                            const pct = Number(goal.achievementScore ?? 0)
                            const locked = goal.isLocked || goal.status === 'APPROVED'
                            const badge = STATUS_BADGE[goal.status] ?? { label: goal.status, cls: STATUS_VARIANT.neutral }

                            return (
                                <div key={goal.id} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <h3 className="text-base font-semibold text-foreground">{goal.title}</h3>
                                                {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            {goal.description && <p className="text-sm text-muted-foreground line-clamp-2">{goal.description}</p>}
                                            {goal.kpiMetrics && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {goal.kpiMetrics.split(',').map((kpi, i) => (
                                                        <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{kpi.trim()}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-lg font-bold text-primary">{Number(goal.weight)}%</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-3">
                                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{t('kr_keca784ed')}</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-border">
                                            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{goal.targetDate ? `마감: ${goal.targetDate.slice(0, 10)}` : ''}</span>
                                        {!isViewOnly && !locked && (
                                            <div className="flex gap-2">
                                                <button onClick={() => setModal({
                                                    mode: 'edit', goalId: goal.id,
                                                    initial: { title: goal.title, description: goal.description ?? '', kpiMetrics: goal.kpiMetrics ?? '', weight: Number(goal.weight), targetDate: goal.targetDate?.slice(0, 10) ?? '' },
                                                })} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-muted-foreground hover:bg-muted transition-colors">
                                                    <Pencil className="h-3 w-3" /> {t('edit')}
                                                </button>
                                                {goal.status === 'DRAFT' && (
                                                    <button onClick={() => handleDelete(goal.id)}
                                                        className="inline-flex items-center gap-1 rounded-md border border-destructive/20 px-2.5 py-1 text-destructive hover:bg-destructive/5 transition-colors">
                                                        <Trash2 className="h-3 w-3" /> {t('delete')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Submit bar */}
                {goals.length > 0 && !isViewOnly && (
                    <div className="mt-6 flex items-center justify-end rounded-xl border border-border bg-card p-4">
                        <button onClick={handleSubmitAll} disabled={!canSubmit || saving}
                            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-primary/90 transition-colors">
                            {saving ? '제출 중...' : '전체 제출'}
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && <GoalModal initial={modal.initial} onSave={handleSave} onClose={() => setModal(null)} saving={saving} />}
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
