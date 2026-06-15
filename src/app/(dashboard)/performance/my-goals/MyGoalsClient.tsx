'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Lock, AlertTriangle, Target } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getAllowedStatuses } from '@/lib/performance/pipeline'
import { STATUS_VARIANT } from '@/lib/styles/status'
import type { SessionUser } from '@/types'
import type { EmbeddedChildProps } from '@/lib/performance/growth-hub'
import { cn } from '@/lib/utils'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; half: string }
interface GoalItem {
    id: string; title: string; description: string | null; weight: number
    kpiMetrics: string | null; targetDate: string | null; status: string
    achievementScore: number | null; isLocked: boolean | null
}

const STATUS_BADGE: Record<string, { labelKey: string; cls: string }> = {
    DRAFT: { labelKey: 'myGoals.statusDraft', cls: STATUS_VARIANT.neutral },
    PENDING_APPROVAL: { labelKey: 'myGoals.statusPendingApproval', cls: STATUS_VARIANT.warning },
    APPROVED: { labelKey: 'myGoals.statusApproved', cls: STATUS_VARIANT.success },
    REJECTED: { labelKey: 'myGoals.statusRejected', cls: STATUS_VARIANT.error },
}

// ─── Goal Drawer (입력 폼 표준 컨테이너 = WdDrawer, DESIGN.md §5.4) ─────

interface GoalForm { title: string; description: string; kpiMetrics: string; weight: number; targetDate: string }

const EMPTY_GOAL: GoalForm = { title: '', description: '', kpiMetrics: '', weight: 20, targetDate: '' }
const GOAL_INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

function GoalModal({ open, initial, onSave, onClose, saving, t }: {
    open: boolean; initial?: GoalForm; onSave: (f: GoalForm) => void; onClose: () => void; saving: boolean; t: (key: string) => string
}) {
    const [form, setForm] = useState<GoalForm>(EMPTY_GOAL)
    // 열릴 때 initial(추가=빈값 / 수정=기존값)로 리셋
    useEffect(() => { if (open) setForm(initial ?? EMPTY_GOAL) }, [open, initial])
    const set = (k: keyof GoalForm, v: string | number) => setForm((p) => ({ ...p, [k]: v }))
    const valid = Boolean(form.title && form.description && form.targetDate)

    return (
        <WdDrawer
            open={open}
            onClose={onClose}
            title={initial ? t('myGoals.editGoal') : t('myGoals.addGoal')}
            closeDisabled={saving}
            secondary={{ label: t('myGoals.cancel'), onClick: onClose, disabled: saving }}
            primary={{ label: saving ? t('myGoals.loading') : t('myGoals.save'), onClick: () => onSave(form), disabled: !valid || saving }}
        >
            <div className="space-y-4">
                <WdField label={t('myGoals.titleLabel')} required htmlFor="goal-title">
                    <input id="goal-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100}
                        className={GOAL_INPUT_CLS} placeholder={t('myGoals.titlePlaceholder')} />
                </WdField>
                <WdField label={t('myGoals.descLabel')} required htmlFor="goal-description">
                    <textarea id="goal-description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={500}
                        className={`${GOAL_INPUT_CLS} resize-none`} placeholder={t('myGoals.descPlaceholder')} />
                </WdField>
                <WdField label={t('myGoals.kpiLabel')} htmlFor="goal-kpi">
                    <input id="goal-kpi" value={form.kpiMetrics} onChange={(e) => set('kpiMetrics', e.target.value)}
                        className={GOAL_INPUT_CLS} placeholder={t('myGoals.kpiPlaceholder')} />
                </WdField>
                <WdRow>
                    <WdField label={t('myGoals.weightLabel')} required htmlFor="goal-weight">
                        <input id="goal-weight" type="number" min={5} max={100} step={5} value={form.weight}
                            onChange={(e) => set('weight', Math.max(5, Math.min(100, Number(e.target.value))))} className={GOAL_INPUT_CLS} />
                    </WdField>
                    <WdField label={t('myGoals.deadlineLabel')} required htmlFor="goal-deadline">
                        <input id="goal-deadline" type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)}
                            className={GOAL_INPUT_CLS} />
                    </WdField>
                </WdRow>
            </div>
        </WdDrawer>
    )
}

// ─── Main Component ───────────────────────────────────────

export default function MyGoalsClient({ user: _user, embedded = false, onPrimaryActionChange }: {
  user: SessionUser } & EmbeddedChildProps) {
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
                    // 기본 선택 = ACTIVE 사이클 우선(없으면 첫 번째). cycles API 정렬이
                    // year/createdAt desc 라 최신 비-ACTIVE 사이클이 앞설 수 있어, 목표를
                    // 실제로 생성/수정 가능한 ACTIVE 사이클로 랜딩시켜 헤더 액션이 활성화되게 함.
                    const preferred = res.data.find((c) => c.status === 'ACTIVE') ?? res.data[0]
                    setSelectedCycleId(preferred.id)
                    setCycleStatus(preferred.status)
                }
            } catch { setError(t('cycleListLoadFailed')) }
        }
        load()
    }, [t])

    // ─── Fetch goals
    const fetchGoals = useCallback(async () => {
        if (!selectedCycleId) { setLoading(false); return }
        setLoading(true); setError('')
        try {
            const res = await apiClient.getList<GoalItem>('/api/v1/performance/goals', { cycleId: selectedCycleId, page: 1, limit: 50 })
            setGoals(res.data)
        } catch { setError(t('myGoals.loadFailed')) }
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

    // ─── 허브 헤더 1차 액션 등록 (embedded) — hooks 규칙상 조기 return 위에 위치
    const openNewGoal = useCallback(() => setModal({ mode: 'add' }), [])
    useEffect(() => {
        if (!onPrimaryActionChange) return
        onPrimaryActionChange({
            labelKey: 'action.newGoal',
            icon: Plus,
            enabled: !isViewOnly && !isBlocked,
            visible: !isBlocked,
            run: openNewGoal,
        })
        return () => onPrimaryActionChange(null)
    }, [onPrimaryActionChange, isViewOnly, isBlocked, openNewGoal])

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
            <div className={cn('flex items-center justify-center', embedded ? 'py-12' : 'min-h-[60vh] p-6')}>
                <div className="text-center">
                    <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('goals_settings_keab8b0ea_kec9584eb')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_ked9884ec_cycle_kec8381ed_keba')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn(embedded ? '' : 'min-h-screen bg-muted p-6')}>
            <div className={cn(embedded ? '' : 'mx-auto max-w-4xl')}>
                {/* Header */}
                <div className={cn('mb-6 flex items-center', embedded ? 'justify-end' : 'justify-between')}>
                    {!embedded && (
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">{t('myGoals_my_goals')}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">{t('kr_mbo_kebaaa9ed_kec84a4ec_keab48')}</p>
                        </div>
                    )}
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Weight summary bar */}
                <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{t('kr_keab080ec_ked95a9ea')}</span>
                        <span className={`text-lg font-bold ${totalWeight === 100 ? 'text-[#006b39]' : 'text-destructive'}`}>
                            {totalWeight}/100%
                        </span>
                        {totalWeight !== 100 && (
                            <span className="flex items-center gap-1 text-xs text-ctr-warning">
                                <AlertTriangle className="h-3.5 w-3.5" /> {t('kr_100_keab080_keb9098ec_submit_k')}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!isViewOnly && !embedded && (
                            <button onClick={openNewGoal}
                                className="inline-flex items-center gap-2 rounded-lg bg-warm px-4 py-2 text-sm font-medium text-white hover:brightness-95 transition-colors">
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
                        {!isViewOnly && !embedded && (
                            <button onClick={openNewGoal}
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
                            const badge = STATUS_BADGE[goal.status] ?? { labelKey: goal.status, cls: STATUS_VARIANT.neutral }

                            return (
                                <div key={goal.id} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <h3 className="text-base font-semibold text-foreground">{goal.title}</h3>
                                                {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                                                    {t(badge.labelKey as Parameters<typeof t>[0])}
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
                                        <span>{goal.targetDate ? t('myGoals.deadline', { date: goal.targetDate.slice(0, 10) }) : ''}</span>
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
                            className="rounded-lg bg-warm px-6 py-2 text-sm font-medium text-white disabled:opacity-40 hover:brightness-95 transition-colors">
                            {saving ? t('myGoals.submitting') : t('myGoals.submitAll')}
                        </button>
                    </div>
                )}
            </div>

            {/* 입력 드로어 (우측 슬라이드 — 입력 폼 표준 컨테이너) */}
            <GoalModal open={!!modal} initial={modal?.initial} onSave={handleSave} onClose={() => setModal(null)} saving={saving} t={(key: string) => t(key as Parameters<typeof t>[0])} />
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
