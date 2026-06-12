'use client'

import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Calendar,
    Calculator,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Lock,
    Unlock,
    Users,
    Clock,
    RefreshCw,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS, BUTTON_SIZES, STATUS_FG, TYPOGRAPHY } from '@/lib/styles'
import { toast } from '@/hooks/use-toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface AttendanceStatus {
    yearMonth: string
    companyName: string | null
    totalEmployees: number
    confirmedCount: number
    unconfirmedCount: number
    unconfirmedEmployees: Array<{ id: string; name: string; email: string }>
    totalWorkHours: number
    totalOvertimeHours: number
    unpaidLeaveCount: number
    payrollRunStatus: string | null
    payrollRunId: string | null
    attendanceClosedAt: string | null
}

interface Props {
    user: SessionUser
}

const STATUS_LABEL_KEYS: Record<string, string> = {
    DRAFT: 'closeAtt.statusDraft',
    ATTENDANCE_CLOSED: 'closeAtt.statusClosed',
    CALCULATING: 'closeAtt.statusCalculating',
    ADJUSTMENT: 'closeAtt.statusAdjustment',
    REVIEW: 'closeAtt.statusReview',
    PENDING_APPROVAL: 'closeAtt.statusPendingApproval',
    APPROVED: 'closeAtt.statusApproved',
    PAID: 'closeAtt.statusPaid',
}

function CloseAttStatusBadge({ status }: { status: string | null }) {
    const t = useTranslations('payroll')
    if (!status) return <span className="text-xs text-muted-foreground">—</span>
    const labelKey = STATUS_LABEL_KEYS[status]
    return (
        <StatusBadge status={status}>
            {labelKey ? t(labelKey) : status}
        </StatusBadge>
    )
}

export default function CloseAttendanceClient({ user }: Props) {
    const tCommon = useTranslations('common')
    const t = useTranslations('payroll')
    const locale = useLocale()
    const router = useRouter()
    const { confirm, dialogProps } = useConfirmDialog()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [, _setSelectedCompanyId] = useState<string | null>(null)
    const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})
    const [loading, setLoading] = useState(false)
    const [expandedEmp, setExpandedEmp] = useState<Record<string, boolean>>({})
    const [closing, setClosing] = useState<string | null>(null)
    const [reopening, setReopening] = useState<string | null>(null)
    const [calculating, setCalculating] = useState<string | null>(null)
    const [confirmModal, setConfirmModal] = useState<{
        companyId: string
        status: AttendanceStatus
        excludeUnconfirmed: boolean
    } | null>(null)

    const fetchStatus = useCallback(async (companyId: string) => {
        try {
            const res = await fetch(
                `/api/v1/payroll/attendance-status?companyId=${companyId}&year=${year}&month=${month}`,
            )
            if (res.ok) {
                const json = await res.json()
                setStatuses((prev) => ({ ...prev, [companyId]: json.data }))
            }
        } catch {
      toast({ title: tCommon('error'), description: t('kr_kecb298eb_keca491_kec98a4eb_ke'), variant: 'destructive' })
    }
    }, [year, month, tCommon, t])

    useEffect(() => {
        setLoading(true)
        // 현재 사용자 소속 법인만 로드 (데모: 전체 로드)
        const companiesToLoad = [user.companyId].filter(Boolean)
        Promise.all(companiesToLoad.map(fetchStatus)).finally(() => setLoading(false))
    }, [year, month, user.companyId, fetchStatus])

    const handleClose = async (companyId: string, excludeEmployeeIds: string[] = []) => {
        setClosing(companyId)
        try {
            const res = await fetch('/api/v1/payroll/attendance-close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, year, month, excludeEmployeeIds }),
            })
            if (res.ok) {
                await fetchStatus(companyId)
                setConfirmModal(null)
                toast({ title: t('attendanceClosed') })
            } else {
                const err = await res.json()
                toast({ title: err.error?.message ?? tCommon('saveFailed'), variant: 'destructive' })
            }
        } finally {
            setClosing(null)
        }
    }

    const handleReopen = async (payrollRunId: string, companyId: string) => {
        confirm({ 
            title: tCommon('confirmReopen'), 
            description: t('reopenDescription'),
            onConfirm: async () => {
            setReopening(companyId)
            try {
                const res = await fetch('/api/v1/payroll/attendance-reopen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payrollRunId }),
                })
                if (res.ok) {
                    await fetchStatus(companyId)
                    toast({ title: t('reopenSuccess') })
                } else {
                    const err = await res.json()
                    toast({ title: err.error?.message ?? tCommon('saveFailed'), variant: 'destructive' })
                }
            } finally {
                setReopening(null)
            }
        }})
    }

    // ATTENDANCE_CLOSED → 급여 계산 실행 (동기: 완료 시 REVIEW로 전이) → 리뷰 페이지로 이동
    const handleCalculate = async (payrollRunId: string, companyId: string) => {
        setCalculating(companyId)
        try {
            const res = await fetch(`/api/v1/payroll/runs/${payrollRunId}/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            if (res.ok) {
                toast({ title: t('closeAtt.calculateSuccess') })
                router.push(`/payroll/${payrollRunId}/review`)
            } else {
                const err = await res.json()
                toast({ title: err.error?.message ?? tCommon('saveFailed'), variant: 'destructive' })
            }
        } finally {
            setCalculating(null)
        }
    }

    const yearMonth = `${year}-${String(month).padStart(2, '0')}`

    return (
        <div className="mx-auto max-w-7xl space-y-4 p-4">
            {/* Page Header (ALL-1: proto .page-h — 56px 아이콘 타일 + pageTitle. 월/연 select·refresh 우측 보존) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
                        <Calendar className="h-[26px] w-[26px]" aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className={TYPOGRAPHY.pageTitle}>{t('closeAttendance')}</h1>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            {t('closeAttendanceDesc')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Month Selector */}
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{t('closeAtt.month', { month: m })}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                        {[2024, 2025, 2026].map((y) => (
                            <option key={y} value={y}>{t('closeAtt.year', { year: y })}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            setLoading(true)
                            Promise.all(
                                [user.companyId].filter(Boolean).map(fetchStatus)
                            ).finally(() => setLoading(false))
                        }}
                        aria-label={tCommon('refresh')}
                        className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                        <RefreshCw size={16} className={`text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Company Cards */}
            <div className="space-y-4">
                {[user.companyId].filter(Boolean).map((companyId) => {
                    const status = statuses[companyId]
                    // 회사명은 API(attendance-status)가 내려준 companyName 사용 — companyId(UUID) 직접 노출 방지
                    const label = status?.companyName ?? companyId
                    const isClosed = status?.payrollRunStatus === 'ATTENDANCE_CLOSED'
                    const isAlreadyCalculating = status?.payrollRunStatus && !['DRAFT', 'ATTENDANCE_CLOSED', null].includes(status.payrollRunStatus)
                    const confirmedPct = status ? Math.round((status.confirmedCount / Math.max(status.totalEmployees, 1)) * 100) : 0

                    return (
                        <div key={companyId} className="bg-card rounded-xl border border-border overflow-hidden">
                            {/* Card Header */}
                            <div className="flex items-center justify-between p-5 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Calendar size={18} className="text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[15px] font-bold text-foreground">{label}</p>
                                            <CloseAttStatusBadge status={status?.payrollRunStatus ?? null} />
                                        </div>
                                        <p className="text-xs text-muted-foreground">{yearMonth}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isClosed ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => status?.payrollRunId && handleCalculate(status.payrollRunId, companyId)}
                                                disabled={calculating === companyId}
                                                className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold transition-colors disabled:opacity-50`}
                                            >
                                                {calculating === companyId
                                                    ? <RefreshCw size={14} className="animate-spin" />
                                                    : <Calculator size={14} />}
                                                {t('closeAtt.calculate')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => status?.payrollRunId && handleReopen(status.payrollRunId, companyId)}
                                                disabled={reopening === companyId}
                                                className={`${BUTTON_VARIANTS.secondary} ${BUTTON_SIZES.md} inline-flex items-center gap-1.5 disabled:opacity-50`}
                                            >
                                                <Unlock size={14} />
                                                {tCommon('unlock')}
                                            </button>
                                        </>
                                    ) : !isAlreadyCalculating ? (
                                        <button
                                            onClick={() => status && setConfirmModal({ companyId, status, excludeUnconfirmed: false })}
                                            disabled={closing === companyId || !status}
                                            className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold transition-colors disabled:opacity-50`}
                                        >
                                            <Lock size={14} />
                                            {t('close')}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">{tCommon('processing')}</span>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            {status && (
                                <div className="p-5">
                                    {/* Progress */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                                            <span>{t('kr_keab7bced_confirmed_status')}</span>
                                            <span className="font-semibold text-foreground">
                                                {t('closeAtt.confirmedRatio', { confirmed: status.confirmedCount, total: status.totalEmployees, pct: confirmedPct })}
                                            </span>
                                        </div>
                                        <div
                                            role="progressbar"
                                            aria-valuenow={confirmedPct}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label={t('closeAtt.confirmedRatio', { confirmed: status.confirmedCount, total: status.totalEmployees, pct: confirmedPct })}
                                            className="h-2 rounded-full bg-border overflow-hidden"
                                        >
                                            <div
                                                className={`h-full rounded-full transition-[width] duration-500 ${confirmedPct === 100 ? 'bg-[#008b4e]' : 'bg-primary'}`}
                                                style={{ width: `${confirmedPct}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* KPI row */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-background rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <CheckCircle2 size={13} style={{ color: STATUS_FG.success }} aria-hidden="true" />
                                                <p className="text-xs text-muted-foreground">{t('confirmed')}</p>
                                            </div>
                                            <p className="text-xl font-bold tabular-nums text-foreground">{t('closeAtt.personCount', { count: status.confirmedCount })}</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Clock size={13} className="text-muted-foreground" aria-hidden="true" />
                                                <p className="text-xs text-muted-foreground">{t('kr_kecb49dea')}</p>
                                            </div>
                                            <p className="text-xl font-bold tabular-nums text-foreground">{status.totalWorkHours}h</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <AlertTriangle size={13} style={{ color: STATUS_FG.error }} aria-hidden="true" />
                                                <p className="text-xs text-muted-foreground">{t('kr_kebafb8ed')}</p>
                                            </div>
                                            <p className="text-xl font-bold tabular-nums text-foreground">{t('closeAtt.personCount', { count: status.unconfirmedCount })}</p>
                                        </div>
                                    </div>

                                    {/* Unconfirmed employees expandable */}
                                    {status.unconfirmedEmployees.length > 0 && (
                                        <div className="border border-warning-bright/30 rounded-lg overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedEmp((prev) => ({ ...prev, [companyId]: !prev[companyId] }))}
                                                aria-expanded={!!expandedEmp[companyId]}
                                                className="flex items-center justify-between w-full px-4 py-2.5 bg-warning-bright/10 hover:bg-warning-bright/20 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={14} className="text-ctr-warning" aria-hidden="true" />
                                                    <span className="text-sm font-semibold text-ctr-warning">
                                                        {t('closeAtt.unconfirmedEmployees', { count: status.unconfirmedEmployees.length })}
                                                    </span>
                                                </div>
                                                {expandedEmp[companyId] ? (
                                                    <ChevronDown size={14} className="text-ctr-warning" aria-hidden="true" />
                                                ) : (
                                                    <ChevronRight size={14} className="text-ctr-warning" aria-hidden="true" />
                                                )}
                                            </button>
                                            {expandedEmp[companyId] && (
                                                <div className="divide-y divide-border">
                                                    {status.unconfirmedEmployees.map((emp) => (
                                                        <div key={emp.id} className="flex items-center gap-3 px-4 py-2.5 bg-card">
                                                            <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center flex-shrink-0">
                                                                <Users size={12} className="text-muted-foreground" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">{emp.name}</p>
                                                                <p className="text-xs text-muted-foreground">{emp.email}</p>
                                                            </div>
                                                            <XCircle size={14} className="text-destructive ml-auto" aria-hidden="true" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Closed at info */}
                                    {isClosed && status.attendanceClosedAt && (
                                        <div className="mt-3 flex items-center gap-2 text-xs text-[#006b39]">
                                            <Lock size={12} aria-hidden="true" />
                                            <span>
                                                {new Date(status.attendanceClosedAt).toLocaleString(locale)} {t('closeAtt.closingComplete')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!status && (
                                loading ? (
                                    <div className="p-5 flex items-center justify-center text-muted-foreground">
                                        <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
                                    </div>
                                ) : (
                                    <EmptyState icon={Calendar} sub="" size="sm" />
                                )
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Confirm Dialog (CLOSE-8: 수제 div → shadcn Dialog 프리미티브 — focus-trap·ESC·aria-modal. checkbox 포함이라 ConfirmDialog 불가) */}
            <Dialog open={!!confirmModal} onOpenChange={(o) => { if (!o) setConfirmModal(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('closeAttendance_confirm')}</DialogTitle>
                    </DialogHeader>
                    {confirmModal && (
                        <>
                            <div className="bg-muted rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('kr_keb8c80ec_company')}</span>
                                    <span className="font-semibold text-foreground">
                                        {confirmModal.status?.companyName ?? confirmModal.companyId}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('kr_keb8c80ec_month')}</span>
                                    <span className="font-semibold">{yearMonth}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('all_keca781ec')}</span>
                                    <span className="font-semibold tabular-nums">{t('closeAtt.personCount', { count: confirmModal.status.totalEmployees })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('confirmed_keca781ec')}</span>
                                    <span className="font-semibold tabular-nums text-[#006b39]">{t('closeAtt.personCount', { count: confirmModal.status.confirmedCount })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('kr_kebafb8ed_keca781ec')}</span>
                                    <span className="font-semibold tabular-nums text-[#b71824]">{t('closeAtt.personCount', { count: confirmModal.status.unconfirmedCount })}</span>
                                </div>
                            </div>
                            {confirmModal.status.unconfirmedCount > 0 && (
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        id="exclude-unconfirmed"
                                        checked={confirmModal.excludeUnconfirmed}
                                        onChange={(e) =>
                                            setConfirmModal((prev) => prev ? { ...prev, excludeUnconfirmed: e.target.checked } : null)
                                        }
                                        className="w-4 h-4 rounded border-border text-primary"
                                    />
                                    <span className="text-sm text-foreground">
                                        {t('closeAtt.closeExcluding', { count: confirmModal.status.unconfirmedCount })}
                                    </span>
                                </label>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {t('closed_ked9b84ec_ked95b4eb_kec9b94ec_keab7bced_kec8898ec_kebb688ea_closed_ked95b4ec_keab384ec_kec8b9cec_keca084ea_keab080eb')}
                            </p>
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={() => setConfirmModal(null)}
                                    className={`${BUTTON_VARIANTS.secondary} ${BUTTON_SIZES.md} inline-flex items-center`}
                                >
                                    {tCommon('cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleClose(
                                            confirmModal.companyId,
                                            confirmModal.excludeUnconfirmed
                                                ? confirmModal.status.unconfirmedEmployees.map((e) => e.id)
                                                : [],
                                        )
                                    }
                                    disabled={closing === confirmModal.companyId}
                                    className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold transition-colors disabled:opacity-50`}
                                >
                                    <Lock size={14} />
                                    {closing === confirmModal.companyId ? tCommon('processing') : t('close')}
                                </button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
