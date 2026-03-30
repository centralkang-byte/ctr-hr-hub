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
import { cn } from '@/lib/utils'
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
        <tr className={cn(TABLE_STYLES.row, row.isException || isOutOfRange ? 'bg-amber-100/30' : '')}>
            <td className={TABLE_STYLES.cell}>{row.name}</td>
            <td className={TABLE_STYLES.cellMuted}>{row.department}</td>
            <td className={cn(TABLE_STYLES.cell, "text-center font-medium")}>{getGradeLabel(row.gradeEnum)}</td>
            <td className={TABLE_STYLES.cellRight}>{fmtKRW(row.currentSalary)}</td>
            <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{row.comparatio.toFixed(2)}</td>
            <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{fmtPct(row.recommendedPct)}</td>
            <td className={cn(TABLE_STYLES.cell, "text-center")}>
                <div className="flex items-center gap-1 justify-center">
                    <input type="number" step={0.5} min={0} max={30} value={localPct}
                        onChange={(e) => setLocalPct(Number(e.target.value))}
                        onBlur={() => onUpdate(row.employeeId, localPct, localReason)}
                        className={`w-16 rounded-lg border px-2 py-1 text-sm text-center focus:outline-none ${isOutOfRange ? 'border-red-500 bg-red-50' : 'border-border focus:border-primary'}`} />
                    <span className="text-xs text-muted-foreground">%</span>
                    {isOutOfRange && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                </div>
                {isOutOfRange && (
                    <input type="text" placeholder={'placeholderExceptionReasonRequired'} value={localReason}
                        onChange={(e) => setLocalReason(e.target.value)}
                        onBlur={() => onUpdate(row.employeeId, localPct, localReason)}
                        className="mt-1 w-full rounded-lg border border-amber-200 px-2 py-1 text-xs focus:border-primary focus:outline-none" />
                )}
            </td>
            <td className={cn(TABLE_STYLES.cellRight, "font-medium text-foreground")}>
                {isOutOfRange && <span className="mr-1 text-red-500">🚨</span>}
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
            } catch { setError(t('cycleLoadFailed')) }
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
        } catch { setError(t('dataLoadFailed')) }
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
        if (updates.length === 0) { toast({ title: t('kr_kebb380ea_keb82b4ec_kec9786ec') }); return }
        setSaving(true)
        try {
            await apiClient.put(`/api/v1/performance/compensation/${selectedCycleId}/apply`, { adjustments: updates })
            setPendingUpdates({})
            await fetchData()
        } catch { toast({ title: t('saveFailed'), variant: 'destructive' }) }
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
            } catch { toast({ title: t('approve_kec9790_kec8ba4ed'), variant: 'destructive' }) }
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
        } catch { toast({ title: t('export_kec9790_kec8ba4ed'), variant: 'destructive' }) }
    }

    // Auth guard
    if (!hasAccess) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="text-center">
                    <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_keca091ea_keab68ced_kec9786ec')}</h2>
                    <p className="text-sm text-muted-foreground">{t('kr_hr_keab480eb_keb9890eb_kec9e84')}</p>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}</a>
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
                    <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h2 className="mb-2 text-lg font-semibold text-foreground">{t('kr_kebb3b4ec_keab8b0ed_keb8ba8ea_')}</h2>
                    <a href="/performance" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> {t('kr_keb8f8cec')}</a>
                </div>
            </div>
        )
    }

    const isReadOnly = cycleStatus === 'COMP_COMPLETED'
    const exceptionRows = rows.filter((r) => r.isException)

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('kr_kebb3b4ec_keb8c80ec_compensati')}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t('kr_kec84b1ea_keb93b1ea_keab8b0eb_')}</p>
                    </div>
                    <select value={selectedCycleId} onChange={(e) => handleCycleChange(e.target.value)}
                        className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
                        {!cycles?.length && <EmptyState />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex border-b border-border">
                    {([['dashboard', '대시보드'], ['table', '조정 테이블'], ['exceptions', `예외 목록 (${exceptionRows.length})`]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key as TabKey)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                        {error} <button onClick={fetchData} className="ml-2 font-medium underline">{tCommon('retry')}</button>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse rounded-xl border border-border bg-white p-6">
                                <div className="mb-3 h-6 w-1/4 rounded bg-border" />
                                <div className="h-4 w-1/3 rounded bg-border" />
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
                                    <div className="rounded-xl border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {t('kr_keb8c80ec_kec9db8ec')}</div>
                                        <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalEmployees}명</p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> {t('average_kec9db8ec')}</div>
                                        <p className="mt-2 text-2xl font-bold text-foreground">{fmtPct(stats.avgMeritPct)}</p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" /> {t('kr_kecb49d_kec9888ec')}</div>
                                        <p className="mt-2 text-2xl font-bold text-foreground">{fmtKRW(stats.totalBudget)}</p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> {t('kr_kec9888ec_keab1b4ec')}</div>
                                        <p className={`mt-2 text-2xl font-bold ${stats.exceptionCount > 0 ? 'text-red-500' : 'text-foreground'}`}>
                                            {stats.exceptionCount}건
                                        </p>
                                    </div>
                                </div>

                                {/* Grade breakdown */}
                                <div className="rounded-xl border border-border bg-white p-5">
                                    <h3 className="mb-4 text-base font-semibold text-foreground">{t('kr_keb93b1ea_average_kec9db8ec')}</h3>
                                    <div className="grid grid-cols-4 gap-4">
                                        {Object.entries(stats.gradeDistribution).map(([grade, data]) => (
                                            <div key={grade} className="rounded-lg bg-muted p-4 text-center">
                                                <p className="text-xs text-muted-foreground">{getGradeLabel(grade)} ({data.count}명)</p>
                                                <p className="mt-1 text-lg font-bold text-foreground">{fmtPct(data.avgMeritPct)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Table Tab */}
                        {tab === 'table' && (
                            <div className="space-y-4">
                                <div className={TABLE_STYLES.wrapper}>
                                    <div className="overflow-x-auto">
                                        <table className={TABLE_STYLES.table}>
                                            <thead>
                                                <tr className={TABLE_STYLES.header}>
                                                    <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_keb93b1ea')}</th>
                                                    <th className={TABLE_STYLES.headerCellRight}>{t('kr_ked9884ec')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>Comp.</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kecb694ec')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_keca081ec')}</th>
                                                    <th className={TABLE_STYLES.headerCellRight}>{t('kr_kec8388ec')}</th>
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
                                            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                                            <Download className="h-4 w-4" /> {t('kr_excel_export')}
                                        </button>
                                        <button onClick={handleSave} disabled={saving}
                                            className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-40">
                                            {saving ? '저장 중...' : '변경사항 저장'}
                                        </button>
                                        <button onClick={handleApprove} disabled={approving}
                                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40">
                                            <CheckCircle2 className="h-4 w-4" /> {approving ? '승인 중...' : '최종 승인 요청'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Exceptions Tab */}
                        {tab === 'exceptions' && (
                            <div className={TABLE_STYLES.wrapper}>
                                {exceptionRows.length === 0 ? (
                                    <div className="p-12 text-center text-sm text-muted-foreground">{t('kr_kec9888ec_keab1b4ec_kec9786ec')}</div>
                                ) : (
                                    <table className={TABLE_STYLES.table}>
                                        <thead>
                                            <tr className={cn(TABLE_STYLES.header, "bg-amber-100")}>
                                                <th className={cn(TABLE_STYLES.headerCell, "text-amber-800")}>{t('name')}</th>
                                                <th className={cn(TABLE_STYLES.headerCell, "text-amber-800")}>{t('department')}</th>
                                                <th className={cn(TABLE_STYLES.headerCell, "text-amber-800 text-center")}>{t('kr_keb93b1ea')}</th>
                                                <th className={cn(TABLE_STYLES.headerCell, "text-amber-800 text-center")}>{t('kr_kecb694ec')}</th>
                                                <th className={cn(TABLE_STYLES.headerCell, "text-amber-800 text-center")}>{t('kr_keca081ec')}</th>
                                                <th className={cn(TABLE_STYLES.headerCell, "text-amber-800")}>{t('kr_kec82acec')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exceptionRows.map((row) => (
                                                <tr key={row.employeeId} className={cn(TABLE_STYLES.row, "bg-amber-100/20")}>
                                                    <td className={TABLE_STYLES.cell}>{row.name}</td>
                                                    <td className={TABLE_STYLES.cellMuted}>{row.department}</td>
                                                    <td className={cn(TABLE_STYLES.cell, "text-center font-medium")}>{getGradeLabel(row.gradeEnum)}</td>
                                                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{fmtPct(row.recommendedPct)}</td>
                                                    <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-red-500")}>{fmtPct(row.appliedPct)}</td>
                                                    <td className={cn(TABLE_STYLES.cell, "text-amber-800")}>{row.exceptionReason || '사유 미입력'}</td>
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
