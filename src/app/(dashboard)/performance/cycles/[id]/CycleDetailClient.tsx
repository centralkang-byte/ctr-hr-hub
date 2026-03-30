'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2, Clock, Users, ShieldAlert } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmployeeCell } from '@/components/common/EmployeeCell'

// ─── Types ────────────────────────────────────────────────

interface CycleDetail {
    id: string; name: string; status: string
    startDate: string; endDate: string
    checkInMode: string | null; peerReviewEnabled: boolean
    peerReviewMinCount: number | null; peerReviewMaxCount: number | null
}

interface Participant {
    employee: { id: string; name: string; employeeNo: string; department: { name: string } | null }
    goalsStatus: string; checkinStatus: string; selfEvalStatus: string
    peerReviewProgress: string; overdueFlags: string[] | null; reviewStatus: string
}

// PIPELINE_STATES is defined inside the component (needs t())

const TRANSITIONS: Record<string, string> = {
    DRAFT: 'ACTIVE', ACTIVE: 'CHECK_IN', CHECK_IN: 'EVAL_OPEN',
    EVAL_OPEN: 'CALIBRATION', CALIBRATION: 'FINALIZED', FINALIZED: 'CLOSED',
    CLOSED: 'COMP_REVIEW', COMP_REVIEW: 'COMP_COMPLETED',
}

// ─── Component ────────────────────────────────────────────

export default function CycleDetailClient({user, cycleId }: { user: SessionUser; cycleId: string }) {
    const tCommon = useTranslations('common')
    const t = useTranslations('performance')
    const router = useRouter()
    const isHrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'

    const PIPELINE_STATES = [
        { key: 'DRAFT', label: t('draft') },
        { key: 'ACTIVE', label: t('goals_settings') },
        { key: 'CHECK_IN', label: t('kr_kecb2b4ed') },
        { key: 'EVAL_OPEN', label: t('evaluation_kec8ba4ec') },
        { key: 'CALIBRATION', label: t('calibration') },
        { key: 'FINALIZED', label: t('confirmed') },
        { key: 'CLOSED', label: t('ended') },
        { key: 'COMP_REVIEW', label: t('kr_kebb3b4ec_keab280ed') },
        { key: 'COMP_COMPLETED', label: t('kr_kebb3b4ec_complete') },
    ]

    const [cycle, setCycle] = useState<CycleDetail | null>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [advancing, setAdvancing] = useState(false)
    const [tab, setTab] = useState<'pipeline' | 'participants'>('pipeline')
    const [deptFilter, setDeptFilter] = useState('')
    const { confirm, dialogProps } = useConfirmDialog()

    const fetchData = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const [cycleRes, partRes] = await Promise.all([
                apiClient.get<CycleDetail>(`/api/v1/performance/cycles/${cycleId}`),
                apiClient.get<Participant[]>(`/api/v1/performance/cycles/${cycleId}/participants`).catch(() => null),
            ])
            setCycle(cycleRes.data)
            if (partRes) setParticipants(partRes.data ?? [])
        } catch { setError('사이클 데이터를 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [cycleId])

    useEffect(() => { fetchData() }, [fetchData])

    async function handleAdvance() {
        if (!cycle) return
        const nextState = TRANSITIONS[cycle.status]
        if (!nextState) return

        const overdueCount = participants.filter((p) => p.overdueFlags && p.overdueFlags.length > 0).length
        const msg = overdueCount > 0
            ? `다음 단계(${nextState})로 진행합니다.\n\n⚠️ 미완료 ${overdueCount}명은 Overdue 처리됩니다.\n\n되돌릴 수 없습니다. 계속하시겠습니까?`
            : `다음 단계(${nextState})로 진행합니다.\n\n되돌릴 수 없습니다. 계속하시겠습니까?`

        confirm({ title: msg, onConfirm: async () => {
            setAdvancing(true)
            try {
                await apiClient.post(`/api/v1/performance/cycles/${cycleId}/advance`)
                await fetchData()
            } catch { toast({ title: t('status_keca084ed_kec8ba4ed'), variant: 'destructive' }) }
            finally { setAdvancing(false) }
        }})
    }

    if (!isHrAdmin) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_keca091ea_keab68ced_kec9786ec')}</h2>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">{t('kr_keb8f8cec')}</a>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-muted p-6">
                <div className="mx-auto max-w-5xl space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse rounded-xl border border-border bg-white p-6">
                            <div className="mb-3 h-5 w-1/3 rounded bg-border" />
                            <div className="h-4 w-2/3 rounded bg-border" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!cycle) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <EmptyState />
                    <a href="/performance/cycles" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">{t('kr_keb8f8cec')}</a>
                </div>
            </div>
        )
    }

    const currentIdx = PIPELINE_STATES.findIndex((s) => s.key === cycle.status)
    const nextState = TRANSITIONS[cycle.status]
    const overdueParticipants = participants.filter((p) => p.overdueFlags && p.overdueFlags.length > 0)
    const departments = [...new Set(participants.map((p) => p.employee.department?.name ?? '미지정'))]
    const filteredParticipants = deptFilter ? participants.filter((p) =>
        p.employee.department?.name === deptFilter
    ) : participants
    return (
        <>
            <div className="mx-auto max-w-5xl">
                {/* Back + Title */}
                <button onClick={() => router.push('/performance/cycles')}
                    className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> {t('cycle_kebaaa9eb')}
                </button>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground">{cycle.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{cycle.startDate?.slice(0, 10)} ~ {cycle.endDate?.slice(0, 10)}</p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                        {error} <button onClick={fetchData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {/* Pipeline Visualization */}
                <div className="mb-6 rounded-xl border border-border bg-white p-6">
                    <h2 className="mb-4 text-base font-semibold text-foreground">{t('pipeline_keca784ed_status')}</h2>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                        {PIPELINE_STATES.map((state, idx) => {
                            const isCurrent = idx === currentIdx
                            const isPast = idx < currentIdx
                            return (
                                <div key={state.key} className="flex items-center">
                                    <div className="flex flex-col items-center">
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' :
                                                isPast ? 'bg-green-500 text-white' : 'bg-border text-muted-foreground'
                                            }`}>
                                            {isPast ? '✓' : idx + 1}
                                        </div>
                                        <span className={`mt-1.5 text-[10px] whitespace-nowrap ${isCurrent ? 'font-bold text-primary' : isPast ? 'text-green-500' : 'text-muted-foreground'}`}>
                                            {state.label}
                                        </span>
                                    </div>
                                    {idx < PIPELINE_STATES.length - 1 && (
                                        <div className={`mx-1 h-0.5 w-6 ${idx < currentIdx ? 'bg-green-500' : 'bg-border'}`} />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Advance button */}
                    {nextState && (
                        <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-muted p-4">
                            <div>
                                <p className="text-sm font-medium text-foreground">현재: {PIPELINE_STATES[currentIdx]?.label}</p>
                                <p className="text-xs text-muted-foreground">다음: {PIPELINE_STATES[currentIdx + 1]?.label}</p>
                            </div>
                            <button onClick={handleAdvance} disabled={advancing}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                                {advancing ? '전환 중...' : <><span>{t('next_keb8ba8ea_keca784ed')}</span><ChevronRight className="h-4 w-4" /></>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Overdue Warning */}
                {overdueParticipants.length > 0 && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-100 p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">⚠️ 미완료 현황: {overdueParticipants.length}명</span>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-amber-800">
                            {overdueParticipants.slice(0, 5).map((p) => (
                                <li key={p.employee.id}>• {p.employee.name} ({p.employee.department?.name ?? '-'}): {(p.overdueFlags ?? []).join(', ')}</li>
                            ))}
                            {overdueParticipants.length > 5 && <li>...외 {overdueParticipants.length - 5}명</li>}
                        </ul>
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-4 flex border-b border-border">
                    <button onClick={() => setTab('pipeline')}
                        className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === 'pipeline' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
                        {t('cycle_keca095eb')}
                    </button>
                    <button onClick={() => setTab('participants')}
                        className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === 'participants' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
                        참여자 ({participants.length}명)
                    </button>
                </div>

                {tab === 'pipeline' ? (
                    <div className="rounded-xl border border-border bg-white p-5 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-muted-foreground">{t('kr_kecb2b4ed_kebaaa8eb')}</span> <span className="font-medium text-foreground">{cycle.checkInMode === 'MANDATORY' ? '필수' : '권장'}</span></div>
                            <div><span className="text-muted-foreground">{t('kr_keb8f99eb')}</span> <span className="font-medium text-foreground">{cycle.peerReviewEnabled ? `활성 (${cycle.peerReviewMinCount}~${cycle.peerReviewMaxCount}명)` : '비활성'}</span></div>
                            <div><span className="text-muted-foreground">{t('kr_kecb0b8ec_kec8898')}</span> <span className="font-medium text-foreground">{participants.length}명</span></div>
                        </div>
                    </div>
                ) : (
                    /* Participants Table */
                    <div className={TABLE_STYLES.wrapper}>
                        {/* Department filter */}
                        <div className="border-b border-border px-5 py-3 flex items-center gap-3">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                                className="rounded-lg border border-border px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none">
                                <option value="">{t('all_department')}</option>
                                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className={TABLE_STYLES.table}>
                                <thead>
                                    <tr className={TABLE_STYLES.header}>
                                        <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
                                        <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('goals')}</th>
                                        <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kecb2b4ed')}</th>
                                        <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('selfEval')}</th>
                                        <th className={cn(TABLE_STYLES.headerCell, "text-center")}>동료평가</th>
                                        <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredParticipants.map((p) => {
                                        const hasOverdue = p.overdueFlags && p.overdueFlags.length > 0
                                        return (
                                            <tr key={p.employee.id} className={cn(TABLE_STYLES.row, hasOverdue && 'bg-amber-100/30 hover:bg-amber-100/50')}>
                                                <td className={TABLE_STYLES.cell}>
                                                  <EmployeeCell
                                                    size="sm"
                                                    employee={{
                                                      id: p.employee.id,
                                                      name: p.employee.name,
                                                      department: p.employee.department?.name,
                                                    }}
                                                  />
                                                </td>
                                                <td className={cn(TABLE_STYLES.cell, "text-center")}>{p.goalsStatus === 'DONE' ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" /> : <Clock className="mx-auto h-4 w-4 text-amber-500" />}</td>
                                                <td className={cn(TABLE_STYLES.cell, "text-center")}>{p.checkinStatus === 'DONE' ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" /> : <Clock className="mx-auto h-4 w-4 text-amber-500" />}</td>
                                                <td className={cn(TABLE_STYLES.cell, "text-center")}>{p.selfEvalStatus === 'SUBMITTED' ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" /> : <Clock className="mx-auto h-4 w-4 text-amber-500" />}</td>
                                                <td className={cn(TABLE_STYLES.cell, "text-center text-muted-foreground")}>{p.peerReviewProgress ?? '-'}</td>
                                                <td className={cn(TABLE_STYLES.cell, "text-center")}>
                                                    {hasOverdue ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                                                            <AlertTriangle className="h-3 w-3" /> {t('kr_keca780ec')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{t('kr_keca095ec')}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Summary */}
                        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                            합계: {filteredParticipants.length}명 | 정상: {filteredParticipants.filter((p) => !p.overdueFlags || p.overdueFlags.length === 0).length} | 지연: {filteredParticipants.filter((p) => p.overdueFlags && p.overdueFlags.length > 0).length}
                        </div>
            </div>
        )}
            </div>
        <ConfirmDialog {...dialogProps} />
        </>
    )
}
