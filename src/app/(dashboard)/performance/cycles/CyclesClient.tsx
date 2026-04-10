'use client'

import { useTranslations } from 'next-intl'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, Settings2, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { SessionUser } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────

interface Cycle {
    id: string; name: string; status: string
    startDate: string; endDate: string
    companyId: string; companyName?: string
    checkInMode: string | null
    peerReviewEnabled: boolean
    peerReviewMinCount: number | null
    peerReviewMaxCount: number | null
    participantCount?: number
}


const STATUS_LABEL_KEYS: Record<string, string> = {
    DRAFT: 'draft',
    ACTIVE: 'goals_settings',
    CHECK_IN: 'kr_kecb2b4ed',
    EVAL_OPEN: 'evaluation_kec8ba4ec',
    CALIBRATION: 'calibration',
    FINALIZED: 'confirmed',
    CLOSED: 'ended',
    COMP_REVIEW: 'kr_kebb3b4ec_keab280ed',
    COMP_COMPLETED: 'kr_kebb3b4ec_complete',
}

// ─── Component ────────────────────────────────────────────

export default function CyclesClient({ user }: { user: SessionUser }) {
    const tCommon = useTranslations('common')
    const t = useTranslations('performance')
    const router = useRouter()
    const [cycles, setCycles] = useState<Cycle[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)

    // Auth guard
    const isHrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'

    const fetchCycles = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const res = await apiClient.getList<Cycle>('/api/v1/performance/cycles', { page: 1, limit: 100 })
            setCycles(res.data)
        } catch { setError(tCommon('loadFailed')) }
        finally { setLoading(false) }
    }, [tCommon])

    useEffect(() => { fetchCycles() }, [fetchCycles])

    if (!isHrAdmin) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('noAccess')}</h2>
                    <p className="text-sm text-muted-foreground">{t('hrOnlyCycles')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">← {tCommon('back')}</a>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('cyclesTitle')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t('cyclesDesc')}</p>
                    </div>
                    <button onClick={() => setShowCreateForm(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
                        <Plus className="h-4 w-4" /> {t('newCycle')}
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
                        {error} <button onClick={fetchCycles} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-6">
                                <div className="mb-3 h-5 w-1/3 rounded bg-border" />
                                <div className="h-4 w-2/3 rounded bg-border" />
                            </div>
                        ))}
                    </div>
                ) : cycles.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-16 text-center">
                        <Settings2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <EmptyState />
                        <button onClick={() => setShowCreateForm(true)}
                            className="mt-3 text-sm font-medium text-primary hover:underline">{t('kr_kecb2ab_cycle_keba78ceb')}</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cycles.map((cycle) => {
                            const badgeLabel = STATUS_LABEL_KEYS[cycle.status] ? t(STATUS_LABEL_KEYS[cycle.status]) : cycle.status
                            return (
                                <button key={cycle.id} onClick={() => router.push(`/performance/cycles/${cycle.id}`)}
                                    className="group w-full rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/30">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-base font-semibold text-foreground">{cycle.name}</h3>
                                                <StatusBadge status={cycle.status}>{badgeLabel}</StatusBadge>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{cycle.startDate?.slice(0, 10)} ~ {cycle.endDate?.slice(0, 10)}</span>
                                                {cycle.participantCount != null && <span>대상: {cycle.participantCount}명</span>}
                                                {cycle.peerReviewEnabled && (
                                                    <span className="inline-flex items-center gap-1">동료평가: <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" /><span className="sr-only">활성</span> ({cycle.peerReviewMinCount}~{cycle.peerReviewMaxCount}명)</span>
                                                )}
                                                {cycle.checkInMode && <span>체크인: {cycle.checkInMode === 'MANDATORY' ? '필수' : '권장'}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create Cycle Modal */}
            {showCreateForm && <CreateCycleModal onClose={() => setShowCreateForm(false)} onCreated={() => { setShowCreateForm(false); fetchCycles() }} />}
        </div>
    )
}

// ─── Create Cycle Modal ───────────────────────────────────

function CreateCycleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const tCommon = useTranslations('common')
    const t = useTranslations('performance')
    const [form, setForm] = useState({
        name: '', companyId: '', startDate: '', endDate: '',
        checkInMode: 'MANDATORY', checkInDeadline: '',
        peerReviewEnabled: true, peerReviewMinCount: 2, peerReviewMaxCount: 4,
        mboWeight: 60, beiWeight: 40, excludeProbation: true,
    })
    const [saving, setSaving] = useState(false)
    const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }))

    async function handleSubmit() {
        if (!form.name || !form.startDate || !form.endDate) { toast({ title: tCommon('required'), description: t('fillRequired'), variant: 'destructive' }); return }
        setSaving(true)
        try {
            await apiClient.post('/api/v1/performance/cycles', form)
            toast({ title: tCommon('created') })
            onCreated()
        } catch { toast({ title: tCommon('error'), description: t('createFailed'), variant: 'destructive' }) }
        finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-5 text-lg font-bold text-foreground">{t('kr_kec8388_cycle_kec839dec')}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{t('cycle_name')}</label>
                        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="2025년 상반기"
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">{t('kr_kec8b9cec')}</label>
                            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-foreground">{t('ended_kec9dbc')}</label>
                            <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{t('kr_kecb2b4ed_kebaaa8eb')}</label>
                        <div className="flex gap-4">
                            {['MANDATORY', 'RECOMMENDED'].map((mode) => (
                                <label key={mode} className="flex items-center gap-2 text-sm">
                                    <input type="radio" name="checkInMode" value={mode} checked={form.checkInMode === mode} onChange={(e) => set('checkInMode', e.target.value)}
                                        className="text-primary" />
                                    {mode === 'MANDATORY' ? '필수' : '권장'}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{t('kr_kecb2b4ed_keba788ea')}</label>
                        <input type="date" value={form.checkInDeadline} onChange={(e) => set('checkInDeadline', e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="peerEnabled" checked={form.peerReviewEnabled} onChange={(e) => set('peerReviewEnabled', e.target.checked)}
                            className="rounded border-border" />
                        <label htmlFor="peerEnabled" className="text-sm text-foreground">{t('kr_keb8f99eb_ked999cec')}</label>
                    </div>
                    {form.peerReviewEnabled && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">{t('kr_kecb59cec_kec9db8ec')}</label>
                                <input type="number" min={2} max={5} value={form.peerReviewMinCount} onChange={(e) => set('peerReviewMinCount', Number(e.target.value))}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">{t('kr_kecb59ceb_kec9db8ec')}</label>
                                <input type="number" min={2} max={5} value={form.peerReviewMaxCount} onChange={(e) => set('peerReviewMaxCount', Number(e.target.value))}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">{t('kr_mbo_bei_kebb984ec_ked95a9ea_10')}</label>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">MBO</span>
                                <input type="number" min={0} max={100} step={5} value={form.mboWeight}
                                    onChange={(e) => { const v = Number(e.target.value); set('mboWeight', v); set('beiWeight', 100 - v) }}
                                    className="w-20 rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none" />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                            <span className="text-muted-foreground">:</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">BEI</span>
                                <span className="w-20 rounded-lg border border-border px-3 py-2 text-sm bg-muted text-muted-foreground">{form.beiWeight}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="excludeProb" checked={form.excludeProbation} onChange={(e) => set('excludeProbation', e.target.checked)}
                            className="rounded border-border" />
                        <label htmlFor="excludeProb" className="text-sm text-foreground">{t('probation_keca781ec_keca09cec')}</label>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground">{tCommon('cancel')}</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{saving ? tCommon('loading') : tCommon('create')}</button>
                </div>
            </div>
        </div>
    )
}
