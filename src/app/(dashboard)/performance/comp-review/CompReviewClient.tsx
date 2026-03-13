'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState, memo } from 'react'
import { DollarSign, Users, TrendingUp, AlertTriangle, Download, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getGradeLabel } from '@/lib/performance/data-masking'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

interface DashboardStats {
    totalEmployees: number; avgMeritPct: number; totalBudget: number; exceptionCount: number
    gradeDistribution: Record<string, { count: number; avgMeritPct: number }>
}

interface MeritRow {
    employeeId: string; name: string; department: string; gradeEnum: string
    currentSalary: number; comparatio: number; recommendedPct: number
    appliedPct: number; newSalary: number; isException: boolean; exceptionReason: string
}

type TabKey = 'dashboard' | 'table' | 'exceptions'

// ─── Formats ──────────────────────────────────────────────

function fmtKRW(v: number) { return Math.round(v).toLocaleString('ko-KR') + '원' }
function fmtPct(v: number) { return v.toFixed(1) + '%' }

// ─── MeritRow Component (GEMINI FIX #3: isolated state) ──

const MeritRowComponent = memo(function MeritRowComponent({
    row, onUpdate
}: {
    row: MeritRow; onUpdate: (employeeId: string, appliedPct: number, reason: string) => void
}) {
    const tCommon = useTranslations('common')
    const [localPct, setLocalPct] = useState(row.appliedPct)
    const [localReason, setLocalReason] = useState(row.exceptionReason)
    const isOutOfRange = localPct < row.recommendedPct * 0.5 || localPct > row.recommendedPct * 1.5
    const newSalary = Math.round(row.currentSalary * (1 + localPct / 100))

    return (
        <tr className={`border-b border-[#F0F0F3] ${row.isException || isOutOfRange ? 'bg-[#FEF3C7]/30' : 'hover:bg-[#F5F5FA]'}`}>
            <td className={TABLE_STYLES.cell}>{row.name}</td>
            <td className={TABLE_STYLES.cellMuted}>{row.department}</td>
            <td className="px-4 py-3 text-sm text-center font-medium text-[#1C1D21]">{getGradeLabel(row.gradeEnum)}</td>
            <td className="px-4 py-3 text-sm text-right text-[#8181A5]">{fmtKRW(row.currentSalary)}</td>
            <td className="px-4 py-3 text-sm text-center text-[#8181A5]">{row.comparatio.toFixed(2)}</td>
            <td className="px-4 py-3 text-sm text-center text-[#8181A5]">{fmtPct(row.recommendedPct)}</td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                    <input type="number" step={0.5} min={0} max={30} value={localPct}
                        onChange={(e) => setLocalPct(Number(e.target.value))}
                        onBlur={() => onUpdate(row.employeeId, localPct, localReason)}
                        className={`w-16 rounded-lg border px-2 py-1 text-sm text-center focus:outline-none ${isOutOfRange ? 'border-[#EF4444] bg-[#FFEBEE]' : 'border-[#F0F0F3] focus:border-[#4F46E5]'}`} />
                    <span className="text-xs text-[#8181A5]">%</span>
                    {isOutOfRange && <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />}
                </div>
                {isOutOfRange && (
                    <input type="text" placeholder={tCommon('placeholderExceptionReasonRequired')} value={localReason}
                        onChange={(e) => setLocalReason(e.target.value)}
                        onBlur={() => onUpdate(row.employeeId, localPct, localReason)}
                        className="mt-1 w-full rounded-lg border border-[#FDE68A] px-2 py-1 text-xs focus:border-[#4F46E5] focus:outline-none" />
                )}
            </td>
            <td className="px-4 py-3 text-sm text-right font-medium text-[#1C1D21]">
                {isOutOfRange && <span className="mr-1 text-[#EF4444]">🚨</span>}
                {fmtKRW(newSalary)}
            </td>
        </tr>
    )
})

// ─── Main Component ───────────────────────────────────────

export default function CompReviewClient({user }: { user: SessionUser }) {
    const tCommon = useTranslations('common')
    const t = useTranslations('performance')
    const isHrAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'
    const isExecutive = user.role === 'EXECUTIVE'
    const hasAccess = isHrAdmin || isExecutive

    const [cycles, setCycles] = useState<CycleOption[]>([])
    const [selectedCycleId, setSelectedCycleId] = useState('')
    const [cycleStatus, setCycleStatus] = useState('')
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [rows, setRows] = useState<MeritRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [tab, setTab] = useState<TabKey>('dashboard')
    const [saving, setSaving] = useState(false)
    const [approving, setApproving] = useState(false)
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, { pct: number; reason: string }>>({})
    const { confirm, dialogProps } = useConfirmDialog()

    useEffect(() => {
        async function load() {
            try {
                const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
                const valid = res.data.filter((c) => ['COMP_REVIEW', 'COMP_COMPLETED'].includes(c.status))
                setCycles(valid)
                if (valid.length > 0) { setSelectedCycleId(valid[0].id); setCycleStatus(valid[0].status) }
            } catch { setError('사이클을 불러오지 못했습니다.') }
        }
        load()
    }, [])

    const fetchData = useCallback(async () => {
        if (!selectedCycleId) return
        setLoading(true); setError('')
        try {
            const [dashRes, recRes] = await Promise.all([
                apiClient.get<DashboardStats>(`/api/v1/performance/compensation/${selectedCycleId}/dashboard`).catch(() => null),
                apiClient.get<MeritRow[]>(`/api/v1/performance/compensation/${selectedCycleId}/recommendations`).catch(() => null),
            ])
            if (dashRes) setStats(dashRes.data)
            if (recRes) setRows(recRes.data ?? [])
        } catch { setError('데이터를 불러오지 못했습니다.') }
        finally { setLoading(false) }
    }, [selectedCycleId])

    useEffect(() => { fetchData() }, [fetchData])

    function handleCycleChange(id: string) {
        setSelectedCycleId(id)
        const c = cycles.find((c) => c.id === id)
        if (c) setCycleStatus(c.status)
    }

    // GEMINI FIX #3: only update global state on blur, not on every keystroke
    function handleRowUpdate(employeeId: string, pct: number, reason: string) {
        setPendingUpdates((p) => ({ ...p, [employeeId]: { pct, reason } }))
    }

    async function handleSave() {
        const updates = Object.entries(pendingUpdates).map(([employeeId, { pct, reason }]) => ({
            employeeId, appliedPct: pct, exceptionReason: reason
        }))
        if (updates.length === 0) { toast({ title: '변경된 내용이 없습니다.' }); return }
        setSaving(true)
        try {
            await apiClient.put(`/api/v1/performance/compensation/${selectedCycleId}/apply`, { adjustments: updates })
            setPendingUpdates({})
            await fetchData()
        } catch { toast({ title: '저장에 실패했습니다.', variant: 'destructive' }) }
        finally { setSaving(false) }
    }

    async function handleApprove() {
        const exceptionCount = rows.filter((r) => r.isException).length
        const msg = exceptionCount > 0
            ? `최종 승인을 요청합니다.\n\n⚠️ ${exceptionCount}건의 예외가 포함되어 있습니다.\n\n승인 후에는 되돌릴 수 없습니다.`
            : '최종 승인을 요청합니다.\n\n승인 후에는 되돌릴 수 없습니다.'
        confirm({ title: msg, onConfirm: async () => {
            setApproving(true)
            try {
                await apiClient.post(`/api/v1/performance/compensation/${selectedCycleId}/approve`)
                await fetchData()
            } catch { toast({ title: '승인에 실패했습니다.', variant: 'destructive' }) }
            finally { setApproving(false) }
        }})
    }

    async function handleExport() {
        try {
            const res = await apiClient.get<unknown>(`/api/v1/performance/compensation/${selectedCycleId}/export`)
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `comp-review-${selectedCycleId}.json`; a.click()
            URL.revokeObjectURL(url)
        } catch { toast({ title: '내보내기에 실패했습니다.', variant: 'destructive' }) }
    }

    // Auth guard
    if (!hasAccess) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">접근 권한이 없습니다.</h2>
                    <p className="text-sm text-[#8181A5]">HR 관리자 또는 임원만 접근 가능합니다.</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-[#4F46E5] hover:underline"><ArrowLeft className="h-4 w-4" /> 돌아가기</a>
                </div>
            </div>
        )
    }

    // Route guard
    const isBlocked = cycleStatus !== '' && !['COMP_REVIEW', 'COMP_COMPLETED'].includes(cycleStatus)
    if (isBlocked) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <DollarSign className="mx-auto mb-4 h-12 w-12 text-[#8181A5]" />
                    <h2 className="mb-2 text-lg font-semibold text-[#1C1D21]">보상 기획 단계가 아닙니다.</h2>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-[#4F46E5] hover:underline"><ArrowLeft className="h-4 w-4" /> 돌아가기</a>
                </div>
            </div>
        )
    }

    const isReadOnly = cycleStatus === 'COMP_COMPLETED'
    const exceptionRows = rows.filter((r) => r.isException)

    return (
        <div className="min-h-screen bg-[#F5F5FA] p-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1C1D21]">보상기획 대시보드 (Compensation Review)</h1>
                        <p className="mt-1 text-sm text-[#8181A5]">성과 등급 기반 보상 조정을 계획합니다</p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-[#F0F0F3] bg-white px-3 py-2 text-sm">
                        {!cycles?.length && <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex border-b border-[#F0F0F3]">
                    {([['dashboard', '대시보드'], ['table', '조정 테이블'], ['exceptions', `예외 목록 (${exceptionRows.length})`]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key as TabKey)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === key ? 'border-[#4F46E5] text-[#4F46E5]' : 'border-transparent text-[#8181A5]'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-[#FFEBEE] bg-[#FFEBEE] p-3 text-sm text-[#C62828]">
                        {error} <button onClick={fetchData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-[#F0F0F3] bg-white p-6">
                                <div className="mb-3 h-6 w-1/4 rounded bg-[#F0F0F3]" />
                                <div className="h-4 w-1/3 rounded bg-[#F0F0F3]" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Dashboard Tab */}
                        {tab === 'dashboard' && stats && (
                            <div className="space-y-6">
                                {/* KPI Cards */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-[#8181A5]"><Users className="h-3.5 w-3.5" /> 대상 인원</div>
                                        <p className="mt-2 text-2xl font-bold text-[#1C1D21]">{stats.totalEmployees}명</p>
                                    </div>
                                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-[#8181A5]"><TrendingUp className="h-3.5 w-3.5" /> 평균 인상</div>
                                        <p className="mt-2 text-2xl font-bold text-[#1C1D21]">{fmtPct(stats.avgMeritPct)}</p>
                                    </div>
                                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-[#8181A5]"><DollarSign className="h-3.5 w-3.5" /> 총 예산</div>
                                        <p className="mt-2 text-2xl font-bold text-[#1C1D21]">{fmtKRW(stats.totalBudget)}</p>
                                    </div>
                                    <div className="rounded-xl border border-[#F0F0F3] bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-[#8181A5]"><AlertTriangle className="h-3.5 w-3.5" /> 예외 건수</div>
                                        <p className={`mt-2 text-2xl font-bold ${stats.exceptionCount > 0 ? 'text-[#EF4444]' : 'text-[#1C1D21]'}`}>
                                            {stats.exceptionCount}건
                                        </p>
                                    </div>
                                </div>

                                {/* Grade breakdown */}
                                <div className="rounded-xl border border-[#F0F0F3] bg-white p-5">
                                    <h3 className="mb-4 text-base font-semibold text-[#1C1D21]">등급별 평균 인상률</h3>
                                    <div className="grid grid-cols-4 gap-4">
                                        {Object.entries(stats.gradeDistribution).map(([grade, data]) => (
                                            <div key={grade} className="rounded-lg bg-[#F5F5FA] p-4 text-center">
                                                <p className="text-xs text-[#8181A5]">{getGradeLabel(grade)} ({data.count}명)</p>
                                                <p className="mt-1 text-lg font-bold text-[#1C1D21]">{fmtPct(data.avgMeritPct)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Table Tab */}
                        {tab === 'table' && (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-[#F0F0F3] bg-white overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-[#F5F5FA] text-xs text-[#8181A5] font-medium">
                                                    <th className={TABLE_STYLES.headerCell}>이름</th>
                                                    <th className={TABLE_STYLES.headerCell}>부서</th>
                                                    <th className={TABLE_STYLES.headerCell}>등급</th>
                                                    <th className={TABLE_STYLES.headerCellRight}>현재연봉</th>
                                                    <th className={TABLE_STYLES.headerCell}>Comp.</th>
                                                    <th className={TABLE_STYLES.headerCell}>추천%</th>
                                                    <th className={TABLE_STYLES.headerCell}>적용%</th>
                                                    <th className={TABLE_STYLES.headerCellRight}>새연봉</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row) => (
                                                    <MeritRowComponent key={row.employeeId} row={row} onUpdate={handleRowUpdate} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {!isReadOnly && (
                                    <div className="flex items-center justify-end gap-3">
                                        <button onClick={handleExport}
                                            className="inline-flex items-center gap-2 rounded-lg border border-[#F0F0F3] px-4 py-2 text-sm font-medium text-[#1C1D21] hover:bg-[#F5F5FA]">
                                            <Download className="h-4 w-4" /> Excel 내보내기
                                        </button>
                                        <button onClick={handleSave} disabled={saving}
                                            className="rounded-lg border border-[#4F46E5] px-4 py-2 text-sm font-medium text-[#4F46E5] hover:bg-[#4F46E5]/5 disabled:opacity-40">
                                            {saving ? '저장 중...' : '변경사항 저장'}
                                        </button>
                                        <button onClick={handleApprove} disabled={approving}
                                            className="inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-5 py-2 text-sm font-medium text-white hover:bg-[#4A6FE0] disabled:opacity-40">
                                            <CheckCircle2 className="h-4 w-4" /> {approving ? '승인 중...' : '최종 승인 요청'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Exceptions Tab */}
                        {tab === 'exceptions' && (
                            <div className="rounded-xl border border-[#F0F0F3] bg-white overflow-hidden">
                                {exceptionRows.length === 0 ? (
                                    <div className="p-12 text-center text-sm text-[#8181A5]">예외 건이 없습니다.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[#FEF3C7] text-xs text-[#92400E] font-medium">
                                                <th className={TABLE_STYLES.headerCell}>이름</th>
                                                <th className={TABLE_STYLES.headerCell}>부서</th>
                                                <th className={TABLE_STYLES.headerCell}>등급</th>
                                                <th className={TABLE_STYLES.headerCell}>추천%</th>
                                                <th className={TABLE_STYLES.headerCell}>적용%</th>
                                                <th className={TABLE_STYLES.headerCell}>사유</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exceptionRows.map((row) => (
                                                <tr key={row.employeeId} className="border-b border-[#FDE68A] bg-[#FEF3C7]/20">
                                                    <td className="px-4 py-3 font-medium text-[#1C1D21]">{row.name}</td>
                                                    <td className="px-4 py-3 text-[#8181A5]">{row.department}</td>
                                                    <td className="px-4 py-3 text-center font-medium text-[#1C1D21]">{getGradeLabel(row.gradeEnum)}</td>
                                                    <td className="px-4 py-3 text-center text-[#8181A5]">{fmtPct(row.recommendedPct)}</td>
                                                    <td className="px-4 py-3 text-center font-medium text-[#EF4444]">{fmtPct(row.appliedPct)}</td>
                                                    <td className="px-4 py-3 text-[#92400E]">{row.exceptionReason || '사유 미입력'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                      <ConfirmDialog {...dialogProps} />
      </>
                )}
            </div>
        </div>
    )
}
