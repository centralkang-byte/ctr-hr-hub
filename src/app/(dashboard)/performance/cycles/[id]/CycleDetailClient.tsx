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
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

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

// 9-state pipeline
const PIPELINE_STATES = [
    { key: 'DRAFT', label: '초안' },
    { key: 'ACTIVE', label: '목표 설정' },
    { key: 'CHECK_IN', label: '체크인' },
    { key: 'EVAL_OPEN', label: '평가 실시' },
    { key: 'CALIBRATION', label: '캘리브레이션' },
    { key: 'FINALIZED', label: '확정' },
    { key: 'CLOSED', label: '종료' },
    { key: 'COMP_REVIEW', label: '보상 검토' },
    { key: 'COMP_COMPLETED', label: '보상 완료' },
]

const TRANSITIONS: Record<string, string> = {
    DRAFT: 'ACTIVE', ACTIVE: 'CHECK_IN', CHECK_IN: 'EVAL_OPEN',
    EVAL_OPEN: 'CALIBRATION', CALIBRATION: 'FINALIZED', FINALIZED: 'CLOSED',
    CLOSED: 'COMP_REVIEW', COMP_REVIEW: 'COMP_COMPLETED',
}

// ─── Component ────────────────────────────────────────────

export default function CycleDetailClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user, cycleId }: { user: SessionUser; cycleId: string }) {
    const router = useRouter()
    const isHrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'

    const [cycle, setCycle] = useState<CycleDetail | null>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [advancing, setAdvancing] = useState(false)
    const [tab, setTab] = useState<'pipeline' | 'participants'>('pipeline')
    const [deptFilter, setDeptFilter] = useState('')

    const fetchData = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
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

        confirm({ title: msg, onConfirm: async () =>
        setAdvancing(true)
        try {
            await apiClient.post(`/api/v1/performance/cycles/${cycleId}/advance`)
            await fetchData()
        } catch { toast({ title: '상태 전환에 실패했습니다.', variant: 'destructive' }) }
        finally { setAdvancing(false) }
    }

    if (!isHrAdmin) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">접근 권한이 없습니다.</h2>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-[#5E81F4] hover:underline">← 돌아가기</a>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F5F5FA] p-6">
                <div className="mx-auto max-w-5xl space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F3] bg-white p-6">
                            <div className="mb-3 h-5 w-1/3 rounded bg-[#F0F0F3]" />
                            <div className="h-4 w-2/3 rounded bg-[#F0F0F3]" />
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
                    <p className="text-[#8181A5]">사이클을 찾을 수 없습니다.</p>
                    <a href="/performance/cycles" className="mt-4 inline-flex items-center gap-1 text-sm text-[#5E81F4] hover:underline">← 돌아가기</a>
                </div>
            </div>
        )
    }

    const currentIdx = PIPELINE_STATES.findIndex((s) => s.key === cycle.status)
    const nextState = TRANSITIONS[cycle.status]
    const overdueParticipants = participants.filter((p) => p.overdueFlags && p.overdueFlags.length > 0)
    const departments = [...new Set(participants.map((p) => p.employee.department?.name ?? '미지정'))]
    const filteredParticipants = deptFilter ? participants.filter((p) => (p.employee.department?.name ?? '미지정') === deptFilter) : participants

    return (
        <div className="min-h-screen bg-[#F5F5FA] p-6">
            <div className="mx-auto max-w-5xl">
                {/* Back + Title */}
                <button onClick={() => router.push('/performance/cycles')}
                    className="mb-4 inline-flex items-center gap-1 text-sm text-[#8181A5] hover:text-[#1C1D21]">
                    <ArrowLeft className="h-4 w-4" /> 사이클 목록
                </button>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#1C1D21]">{cycle.name}</h1>
                    <p className="mt-1 text-sm text-[#8181A5]">{cycle.startDate?.slice(0, 10)} ~ {cycle.endDate?.slice(0, 10)}</p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-[#FFEBEE] bg-[#FFEBEE] p-3 text-sm text-[#C62828]">
                        {error} <button onClick={fetchData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {/* Pipeline Visualization */}
                <div className="mb-6 rounded-xl border border-[#F0F0F3] bg-white p-6">
                    <h2 className="mb-4 text-base font-semibold text-[#1C1D21]">파이프라인 진행 상태</h2>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                        {PIPELINE_STATES.map((state, idx) => {
                            const isCurrent = idx === currentIdx
                            const isPast = idx < currentIdx
                            return (
                                <div key={state.key} className="flex items-center">
                                    <div className="flex flex-col items-center">
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${isCurrent ? 'bg-[#5E81F4] text-white ring-4 ring-[#5E81F4]/20' :
                                                isPast ? 'bg-[#22C55E] text-white' : 'bg-[#F0F0F3] text-[#8181A5]'
                                            }`}>
                                            {isPast ? '✓' : idx + 1}
                                        </div>
                                        <span className={`mt-1.5 text-[10px] whitespace-nowrap ${isCurrent ? 'font-bold text-[#5E81F4]' : isPast ? 'text-[#22C55E]' : 'text-[#8181A5]'}`}>
                                            {state.label}
                                        </span>
                                    </div>
                                    {idx < PIPELINE_STATES.length - 1 && (
                                        <div className={`mx-1 h-0.5 w-6 ${idx < currentIdx ? 'bg-[#22C55E]' : 'bg-[#F0F0F3]'}`} />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Advance button */}
                    {nextState && (
                        <div className="mt-6 flex items-center justify-between rounded-xl border border-[#F0F0F3] bg-[#F5F5FA] p-4">
                            <div>
                                <p className="text-sm font-medium text-[#1C1D21]">현재: {PIPELINE_STATES[currentIdx]?.label}</p>
                                <p className="text-xs text-[#8181A5]">다음: {PIPELINE_STATES[currentIdx + 1]?.label}</p>
                            </div>
                            <button onClick={handleAdvance} disabled={advancing}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#5E81F4] px-5 py-2 text-sm font-medium text-white hover:bg-[#4A6FE0] disabled:opacity-40 transition-colors">
                                {advancing ? '전환 중...' : <><span>다음 단계로 진행</span><ChevronRight className="h-4 w-4" />  <ConfirmDialog {...dialogProps} />
      </>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Overdue Warning */}
                {overdueParticipants.length > 0 && (
                    <div className="mb-6 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-[#D97706]" />
                            <span className="text-sm font-medium text-[#92400E]">⚠️ 미완료 현황: {overdueParticipants.length}명</span>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-[#92400E]">
                            {overdueParticipants.slice(0, 5).map((p) => (
                                <li key={p.employee.id}>• {p.employee.name} ({p.employee.department?.name ?? '-'}): {(p.overdueFlags ?? []).join(', ')}</li>
                            ))}
                            {overdueParticipants.length > 5 && <li>...외 {overdueParticipants.length - 5}명</li>}
                        </ul>
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-4 flex border-b border-[#F0F0F3]">
                    <button onClick={() => setTab('pipeline')}
                        className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === 'pipeline' ? 'border-[#5E81F4] text-[#5E81F4]' : 'border-transparent text-[#8181A5]'}`}>
                        사이클 정보
                    </button>
                    <button onClick={() => setTab('participants')}
                        className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === 'participants' ? 'border-[#5E81F4] text-[#5E81F4]' : 'border-transparent text-[#8181A5]'}`}>
                        참여자 ({participants.length}명)
                    </button>
                </div>

                {tab === 'pipeline' ? (
                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-5 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-[#8181A5]">체크인 모드:</span> <span className="font-medium text-[#1C1D21]">{cycle.checkInMode === 'MANDATORY' ? '필수' : '권장'}</span></div>
                            <div><span className="text-[#8181A5]">동료평가:</span> <span className="font-medium text-[#1C1D21]">{cycle.peerReviewEnabled ? `활성 (${cycle.peerReviewMinCount}~${cycle.peerReviewMaxCount}명)` : '비활성'}</span></div>
                            <div><span className="text-[#8181A5]">참여자 수:</span> <span className="font-medium text-[#1C1D21]">{participants.length}명</span></div>
                        </div>
                    </div>
                ) : (
                    /* Participants Table */
                    <div className="rounded-xl border border-[#F0F0F3] bg-white overflow-hidden">
                        {/* Department filter */}
                        <div className="border-b border-[#F0F0F3] px-5 py-3 flex items-center gap-3">
                            <Users className="h-4 w-4 text-[#8181A5]" />
                            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                                className="rounded-lg border border-[#F0F0F3] px-2 py-1 text-xs text-[#1C1D21] focus:border-[#5E81F4] focus:outline-none">
                                <option value="">전체 부서</option>
                                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#F5F5FA] text-xs text-[#8181A5] font-medium">
                                        <th className={TABLE_STYLES.headerCell}>이름</th>
                                        <th className={TABLE_STYLES.headerCell}>부서</th>
                                        <th className={TABLE_STYLES.headerCell}>목표</th>
                                        <th className={TABLE_STYLES.headerCell}>체크인</th>
                                        <th className={TABLE_STYLES.headerCell}>자기평가</th>
                                        <th className={TABLE_STYLES.headerCell}>동료평가</th>
                                        <th className={TABLE_STYLES.headerCell}>상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredParticipants.map((p) => {
                                        const hasOverdue = p.overdueFlags && p.overdueFlags.length > 0
                                        return (
                                            <tr key={p.employee.id} className={`border-b border-[#F0F0F3] ${hasOverdue ? 'bg-[#FEF3C7]/30' : 'hover:bg-[#F5F5FA]'}`}>
                                                <td className="px-4 py-3 font-medium text-[#1C1D21]">{p.employee.name}</td>
                                                <td className="px-4 py-3 text-[#8181A5]">{p.employee.department?.name ?? '-'}</td>
                                                <td className="px-4 py-3 text-center">{p.goalsStatus === 'DONE' ? <CheckCircle2 className="mx-auto h-4 w-4 text-[#22C55E]" /> : <Clock className="mx-auto h-4 w-4 text-[#F59E0B]" />}</td>
                                                <td className="px-4 py-3 text-center">{p.checkinStatus === 'DONE' ? <CheckCircle2 className="mx-auto h-4 w-4 text-[#22C55E]" /> : <Clock className="mx-auto h-4 w-4 text-[#F59E0B]" />}</td>
                                                <td className="px-4 py-3 text-center">{p.selfEvalStatus === 'SUBMITTED' ? <CheckCircle2 className="mx-auto h-4 w-4 text-[#22C55E]" /> : <Clock className="mx-auto h-4 w-4 text-[#F59E0B]" />}</td>
                                                <td className="px-4 py-3 text-center text-xs text-[#8181A5]">{p.peerReviewProgress ?? '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {hasOverdue ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFEBEE] px-2 py-0.5 text-xs font-medium text-[#C62828]">
                                                            <AlertTriangle className="h-3 w-3" /> 지연
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-full bg-[#D1FAE5] px-2 py-0.5 text-xs font-medium text-[#047857]">정상</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Summary */}
                        <div className="border-t border-[#F0F0F3] px-5 py-3 text-xs text-[#8181A5]">
                            합계: {filteredParticipants.length}명 | 정상: {filteredParticipants.filter((p) => !p.overdueFlags || p.overdueFlags.length === 0).length} | 지연: {filteredParticipants.filter((p) => p.overdueFlags && p.overdueFlags.length > 0).length}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
