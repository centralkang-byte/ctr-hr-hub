'use client'

import { useTranslations } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import {
    Calendar,
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
import { BUTTON_VARIANTS,  MODAL_STYLES } from '@/lib/styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

interface AttendanceStatus {
    yearMonth: string
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

const COMPANY_LIST = [
    { id: 'CTR', name: 'CTR (한국)' },
    { id: 'CTR-CN', name: 'CTR-CN (중국)' },
    { id: 'CTR-US', name: 'CTR-US (미국)' },
    { id: 'CTR-VN', name: 'CTR-VN (베트남)' },
    { id: 'CTR-EU', name: 'CTR-EU (폴란드)' },
    { id: 'CTR-RU', name: 'CTR-RU (러시아)' },
]

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'DRAFT', color: '#555', bg: '#FAFAFA' },
    ATTENDANCE_CLOSED: { label: '근태 마감', color: '#047857', bg: '#D1FAE5' },
    CALCULATING: { label: '계산 중', color: '#B45309', bg: '#FEF3C7' },
    ADJUSTMENT: { label: '조정 중', color: '#1D4ED8', bg: '#DBEAFE' },
    REVIEW: { label: '검토 중', color: '#7C3AED', bg: '#EDE9FE' },
    PENDING_APPROVAL: { label: '결재 대기', color: '#B45309', bg: '#FEF3C7' },
    APPROVED: { label: '승인 완료', color: '#047857', bg: '#D1FAE5' },
    PAID: { label: '지급 완료', color: '#059669', bg: '#D1FAE5' },
}

function StatusBadge({ status }: { status: string | null }) {
    if (!status) return <span className="text-xs text-muted-foreground">—</span>
    const s = STATUS_LABELS[status] ?? { label: status, color: '#555', bg: '#FAFAFA' }
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
            style={{ color: s.color, background: s.bg, borderColor: s.bg }}
        >
            {s.label}
        </span>
    )
}

export default function CloseAttendanceClient({ user }: Props) {
    const tCommon = useTranslations('common')
    const t = useTranslations('payroll')
    const { confirm, dialogProps } = useConfirmDialog()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
    const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})
    const [loading, setLoading] = useState(false)
    const [expandedEmp, setExpandedEmp] = useState<Record<string, boolean>>({})
    const [closing, setClosing] = useState<string | null>(null)
    const [reopening, setReopening] = useState<string | null>(null)
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
    }, [year, month])

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

    const yearMonth = `${year}-${String(month).padStart(2, '0')}`

    return (
        <div className="p-6 bg-background min-h-screen">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <nav className="text-xs text-muted-foreground mb-1">{t('kr_keab889ec_keab7bced_closed')}</nav>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('closeAttendance')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {t('closeAttendanceDesc')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Month Selector */}
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                        {[2024, 2025, 2026].map((y) => (
                            <option key={y} value={y}>{y}년</option>
                        ))}
                    </select>
                    <button
                        onClick={() => {
                            setLoading(true)
                            Promise.all(
                                [user.companyId].filter(Boolean).map(fetchStatus)
                            ).finally(() => setLoading(false))
                        }}
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
                    const label = COMPANY_LIST.find((c) => c.id === companyId)?.name ?? companyId
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
                                            <StatusBadge status={status?.payrollRunStatus ?? null} />
                                        </div>
                                        <p className="text-xs text-muted-foreground">{yearMonth}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isClosed ? (
                                        <button
                                            onClick={() => status?.payrollRunId && handleReopen(status.payrollRunId, companyId)}
                                            disabled={reopening === companyId}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted text-muted-foreground rounded-lg text-sm transition-colors disabled:opacity-50"
                                        >
                                            <Unlock size={14} />
                                            {tCommon('unlock')}
                                        </button>
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
                                                {status.confirmedCount}/{status.totalEmployees}명 ({confirmedPct}%)
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-border overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-[width] duration-600"
                                                style={{
                                                    width: `${confirmedPct}%`,
                                                    background: confirmedPct === 100 ? '#059669' : 'linear-gradient(90deg, #5E81F4, #00BFA5)',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* KPI row */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-background rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <CheckCircle2 size={13} className="text-emerald-600" />
                                                <p className="text-xs text-muted-foreground">{t('confirmed')}</p>
                                            </div>
                                            <p className="text-xl font-bold text-foreground">{status.confirmedCount}명</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Clock size={13} className="text-amber-500" />
                                                <p className="text-xs text-muted-foreground">{t('kr_kecb49dea')}</p>
                                            </div>
                                            <p className="text-xl font-bold text-foreground">{status.totalWorkHours}h</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <AlertTriangle size={13} className="text-red-500" />
                                                <p className="text-xs text-muted-foreground">{t('kr_kebafb8ed')}</p>
                                            </div>
                                            <p className="text-xl font-bold text-foreground">{status.unconfirmedCount}명</p>
                                        </div>
                                    </div>

                                    {/* Unconfirmed employees expandable */}
                                    {status.unconfirmedEmployees.length > 0 && (
                                        <div className="border border-amber-100 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setExpandedEmp((prev) => ({ ...prev, [companyId]: !prev[companyId] }))}
                                                className="flex items-center justify-between w-full px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/15 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={14} className="text-amber-500" />
                                                    <span className="text-sm font-semibold text-amber-700">
                                                        미확정 직원 {status.unconfirmedEmployees.length}명
                                                    </span>
                                                </div>
                                                {expandedEmp[companyId] ? (
                                                    <ChevronDown size={14} className="text-amber-700" />
                                                ) : (
                                                    <ChevronRight size={14} className="text-amber-700" />
                                                )}
                                            </button>
                                            {expandedEmp[companyId] && (
                                                <div className="divide-y divide-amber-200">
                                                    {status.unconfirmedEmployees.map((emp) => (
                                                        <div key={emp.id} className="flex items-center gap-3 px-4 py-2.5 bg-card">
                                                            <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center flex-shrink-0">
                                                                <Users size={12} className="text-muted-foreground" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">{emp.name}</p>
                                                                <p className="text-xs text-muted-foreground">{emp.email}</p>
                                                            </div>
                                                            <XCircle size={14} className="text-red-500 ml-auto" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Closed at info */}
                                    {isClosed && status.attendanceClosedAt && (
                                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
                                            <Lock size={12} />
                                            <span>
                                                {new Date(status.attendanceClosedAt).toLocaleString('ko-KR')} 마감 완료
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!status && (
                                <div className="p-5 flex items-center justify-center text-muted-foreground text-sm">
                                    {loading ? '로딩 중...' : '데이터 없음'}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Confirm Modal */}
            {confirmModal && (
                <div className={MODAL_STYLES.container}>
                    <div className={`${MODAL_STYLES.content.sm} mx-4 overflow-hidden`}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-bold text-foreground">{t('closeAttendance_confirm')}</h2>
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="p-1 hover:bg-muted rounded-lg transition-colors"
                            >
                                <XCircle size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <div className="bg-muted rounded-xl p-4 mb-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('kr_keb8c80ec_company')}</span>
                                    <span className="font-semibold text-foreground">
                                        {COMPANY_LIST.find((c) => c.id === confirmModal.companyId)?.name ?? confirmModal.companyId}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('kr_keb8c80ec_month')}</span>
                                    <span className="font-semibold">{yearMonth}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('all_keca781ec')}</span>
                                    <span className="font-semibold">{confirmModal.status.totalEmployees}명</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('confirmed_keca781ec')}</span>
                                    <span className="font-semibold text-emerald-600">{confirmModal.status.confirmedCount}명</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('kr_kebafb8ed_keca781ec')}</span>
                                    <span className="font-semibold text-red-500">{confirmModal.status.unconfirmedCount}명</span>
                                </div>
                            </div>
                            {confirmModal.status.unconfirmedCount > 0 && (
                                <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
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
                                        미확정 직원 {confirmModal.status.unconfirmedCount}명 제외하고 마감
                                    </span>
                                </label>
                            )}
                            <p className="text-xs text-muted-foreground mb-5">
                                {t('closed_ked9b84ec_ked95b4eb_kec9b94ec_keab7bced_kec8898ec_kebb688ea_closed_ked95b4ec_keab384ec_kec8b9cec_keca084ea_keab080eb')}
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors"
                            >
                                {tCommon('cancel')}
                            </button>
                            <button
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
                        </div>
                    </div>
                </div>
            )}
        <ConfirmDialog {...dialogProps} />
        </div>
    )
}
