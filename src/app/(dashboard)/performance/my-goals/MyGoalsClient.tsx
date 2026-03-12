'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Lock, AlertTriangle, Target, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }
interface GoalItem {
    id: string; title: string; description: string | null; weight: number
    kpiMetrics: string | null; targetDate: string | null; status: string
    achievementScore: number | null; isLocked: boolean | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: '초안', cls: 'bg-[#F5F5FA] text-[#8181A5]' },
    PENDING_APPROVAL: { label: '승인 대기', cls: 'bg-[#FFF8E1] text-[#F57F17]' },
    APPROVED: { label: '승인됨', cls: 'bg-[#E8F5E9] text-[#2E7D32]' },
    REJECTED: { label: '반려', cls: 'bg-[#FFEBEE] text-[#C62828]' },
}

// ─── Goal Modal ───────────────────────────────────────────

interface GoalForm { title: string; description: string; kpiMetrics: string; weight: number; targetDate: string }

function GoalModal({ initial, onSave, onClose, saving }: {
    initial?: GoalForm; onSave: (f: GoalForm) => void; onClose: () => void; saving: boolean
}) {
    const [form, setForm] = useState<GoalForm>(initial ?? { title: '', description: '', kpiMetrics: '', weight: 20, targetDate: '' })
    const set = (k: keyof GoalForm, v: string | number) => setForm((p) => ({ ...p, [k]: v }))

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
            <div className="w-full max-w-lg rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#1C1D21]">{initial ? '목표 수정' : '목표 추가'}</h3>
                    <button onClick={onClose} className="text-[#8181A5] hover:text-[#1C1D21]"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-[#1C1D21]">제목 <span className="text-red-500">*</span></label>
                        <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100}
                            className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" placeholder="목표 제목" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-[#1C1D21]">설명 <span className="text-red-500">*</span></label>
                        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={500}
                            className="w-full resize-none rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" placeholder="목표 상세 설명" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-[#1C1D21]">KPI 지표 (선택)</label>
                        <input value={form.kpiMetrics} onChange={(e) => set('kpiMetrics', e.target.value)}
                            className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" placeholder="매출액, 수주잔고" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1D21]">가중치 (%) <span className="text-red-500">*</span></label>
                            <input type="number" min={5} max={100} step={5} value={form.weight} onChange={(e) => set('weight', Math.max(5, Math.min(100, Number(e.target.value))))}
                                className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1D21]">마감일 <span className="text-red-500">*</span></label>
                            <input type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)}
                                className="w-full rounded-lg border border-[#F0F0F3] px-3 py-2 text-sm focus:border-[#5E81F4] focus:outline-none" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="rounded-lg border border-[#F0F0F3] px-4 py-2 text-sm font-medium text-[#1C1D21]">{tCommon('cancel')}</button>
                    <button onClick={() => onSave(form)} disabled={!form.title || !form.description || !form.targetDate || saving}
                        className="rounded-lg bg-[#5E81F4] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                        {saving ? tCommon('loading') : tCommon('save')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────

export default function MyGoalsClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
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
            } catch { setError('사이클 목록을 불러오지 못했습니다.') }
        }
        load()
    }, [])

    // ─── Fetch goals
    const fetchGoals = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
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
    const allowedStatuses = ['ACTIVE', 'CHECK_IN', 'EVAL_OPEN', 'CALIBRATION', 'COMP_REVIEW', 'COMP_COMPLETED', 'FINALIZED', 'CLOSED']
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
        } catch { toast({ title: '저장에 실패했습니다.', variant: 'destructive' }) }
        finally { setSaving(false) }
    }

    async function handleDelete(goalId: string) {
        confirm({ variant: 'destructive', title: '이 목표를 삭제하시겠습니까?', onConfirm: async () =>
        try { await apiClient.delete(`/api/v1/performance/goals/${goalId}`); await fetchGoals() }
        catch { toast({ title: '삭제에 실패했습니다.', variant: 'destructive' }) }
    }

    async function handleSubmitAll() {
        if (!canSubmit) return
        confirm({ title: '모든 초안 목표를 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.', onConfirm: async () =>
        setSaving(true)
        try {
            const firstDraft = goals.find((g) => g.status === 'DRAFT')
            if (firstDraft) {
                await apiClient.put(`/api/v1/performance/goals/${firstDraft.id}/submit`)
                await fetchGoals()
            }
        } catch { toast({ title: '제출에 실패했습니다.', variant: 'destructive' }) }
        finally { setSaving(false) }
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
                    <Target className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">목표 설정 기간이 아닙니다.</h2>
                    <p className="text-sm text-[#8181A5]">현재 사이클 상태에서는 목표를 조회할 수 없습니다.</p>
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
                        <h1 className="text-2xl font-bold text-[#1C1D21]">나의 목표 (My Goals)</h1>
                        <p className="mt-1 text-sm text-[#8181A5]">MBO 목표를 설정하고 관리합니다</p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2 text-sm text-[#1C1D21] focus:border-[#5E81F4] focus:outline-none">
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Weight summary bar */}
                <div className="mb-6 flex items-center justify-between rounded-xl border border-[#F0F0F3] bg-white p-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-[#8181A5]">가중치 합계:</span>
                        <span className={`text-lg font-bold ${totalWeight === 100 ? 'text-[#2E7D32]' : 'text-[#C62828]'}`}>
                            {totalWeight}/100%
                        </span>
                        {totalWeight !== 100 && (
                            <span className="flex items-center gap-1 text-xs text-[#F57F17]">
                                <AlertTriangle className="h-3.5 w-3.5" /> 100%가 되어야 제출 가능합니다
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!isViewOnly && (
                            <button onClick={() => setModal({ mode: 'add' })}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#5E81F4] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A6FE0] transition-colors">
                                <Plus className="h-4 w-4" /> 목표 추가
                            </button>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 rounded-lg border border-[#FFEBEE] bg-[#FFEBEE] p-3 text-sm text-[#C62828]">
                        {error} <button onClick={fetchGoals} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {/* Goal cards */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F3] bg-white p-5">
                                <div className="mb-3 h-4 w-2/3 rounded bg-[#F0F0F3]" />
                                <div className="mb-2 h-3 w-1/2 rounded bg-[#F0F0F3]" />
                                <div className="h-2 w-full rounded-full bg-[#F0F0F3]" />
                            </div>
                        ))}
                    </div>
                ) : goals.length === 0 ? (
                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-16 text-center">
                        <Target className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                        <p className="mb-2 text-[#8181A5]">아직 등록된 목표가 없습니다.</p>
                        {!isViewOnly && (
                            <button onClick={() => setModal({ mode: 'add' })}
                                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#5E81F4] hover:underline">
                                <Plus className="h-4 w-4" /> 첫 번째 목표 추가하기
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
                            const badge = STATUS_BADGE[goal.status] ?? { label: goal.status, cls: 'bg-[#F5F5FA] text-[#8181A5]' }

                            return (
                                <div key={goal.id} className="rounded-xl border border-[#F0F0F3] bg-white p-5 transition-colors hover:border-[#5E81F4]/30">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <h3 className="text-base font-semibold text-[#1C1D21]">{goal.title}</h3>
                                                {locked && <Lock className="h-3.5 w-3.5 text-[#8181A5]" />}
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            {goal.description && <p className="text-sm text-[#8181A5] line-clamp-2">{goal.description}</p>}
                                            {goal.kpiMetrics && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {goal.kpiMetrics.split(',').map((kpi, i) => (
                                                        <span key={i} className="rounded-md bg-[#F5F5FA] px-2 py-0.5 text-xs text-[#8181A5]">{kpi.trim()}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-lg font-bold text-[#5E81F4]">{Number(goal.weight)}%</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-3">
                                        <div className="mb-1 flex items-center justify-between text-xs text-[#8181A5]">
                                            <span>진행률</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-[#F0F0F3]">
                                            <div className="h-2 rounded-full bg-[#5E81F4] transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center justify-between text-xs text-[#8181A5]">
                                        <span>{goal.targetDate ? `마감: ${goal.targetDate.slice(0, 10)}` : ''}</span>
                                        {!isViewOnly && !locked && (
                                            <div className="flex gap-2">
                                                <button onClick={() => setModal({
                                                    mode: 'edit', goalId: goal.id,
                                                    initial: { title: goal.title, description: goal.description ?? '', kpiMetrics: goal.kpiMetrics ?? '', weight: Number(goal.weight), targetDate: goal.targetDate?.slice(0, 10) ?? '' },
                                                })} className="inline-flex items-center gap-1 rounded-md border border-[#F0F0F3] px-2.5 py-1 text-[#8181A5] hover:bg-[#F5F5FA] transition-colors">
                                                    <Pencil className="h-3 w-3" /> 수정
                                                </button>
                                                {goal.status === 'DRAFT' && (
                                                    <button onClick={() => handleDelete(goal.id)}
                                                        className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] px-2.5 py-1 text-[#C62828] hover:bg-[#FFEBEE] transition-colors">
                                                        <Trash2 className="h-3 w-3" /> 삭제
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
                    <div className="mt-6 flex items-center justify-end rounded-xl border border-[#F0F0F3] bg-white p-4">
                        <button onClick={handleSubmitAll} disabled={!canSubmit || saving}
                            className="rounded-lg bg-[#5E81F4] px-6 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-[#4A6FE0] transition-colors">
                            {saving ? '제출 중...' : '전체 제출'}
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && <GoalModal initial={modal.initial} onSave={handleSave} onClose={() => setModal(null)} saving={saving} />}
        <ConfirmDialog {...dialogProps} />
        </div>
      </>
    )
}
