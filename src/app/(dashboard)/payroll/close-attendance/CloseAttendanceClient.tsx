'use client'

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
    { id: 'CTR-KR', name: 'CTR-KR (한국)' },
    { id: 'CTR-CN', name: 'CTR-CN (중국)' },
    { id: 'CTR-US', name: 'CTR-US (미국)' },
    { id: 'CTR-VN', name: 'CTR-VN (베트남)' },
    { id: 'CTR-MX', name: 'CTR-MX (멕시코)' },
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
    if (!status) return <span className="text-xs text-[#999]">—</span>
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
            // ignore
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
            } else {
                const err = await res.json()
                alert(err.error?.message ?? '마감 처리 중 오류가 발생했습니다.')
            }
        } finally {
            setClosing(null)
        }
    }

    const handleReopen = async (payrollRunId: string, companyId: string) => {
        if (!confirm('마감을 해제하시겠습니까? 계산이 시작된 이후에는 해제할 수 없습니다.')) return
        setReopening(companyId)
        try {
            const res = await fetch('/api/v1/payroll/attendance-reopen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payrollRunId }),
            })
            if (res.ok) {
                await fetchStatus(companyId)
            } else {
                const err = await res.json()
                alert(err.error?.message ?? '마감 해제 중 오류가 발생했습니다.')
            }
        } finally {
            setReopening(null)
        }
    }

    const yearMonth = `${year}-${String(month).padStart(2, '0')}`

    return (
        <div className="p-6 bg-[#FAFAFA] min-h-screen">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <nav className="text-xs text-[#999] mb-1">급여 / 근태 마감</nav>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">근태 마감</h1>
                    <p className="text-sm text-[#666] mt-0.5">
                        월별 근태를 마감하여 급여 계산을 시작합니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Month Selector */}
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
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
                        className="p-2 border border-[#D4D4D4] rounded-lg hover:bg-[#F5F5F5] transition-colors"
                    >
                        <RefreshCw size={16} className={`text-[#555] ${loading ? 'animate-spin' : ''}`} />
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
                        <div key={companyId} className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
                            {/* Card Header */}
                            <div className="flex items-center justify-between p-5 border-b border-[#F5F5F5]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center">
                                        <Calendar size={18} className="text-[#00C853]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[15px] font-bold text-[#1A1A1A]">{label}</p>
                                            <StatusBadge status={status?.payrollRunStatus ?? null} />
                                        </div>
                                        <p className="text-xs text-[#999]">{yearMonth}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isClosed ? (
                                        <button
                                            onClick={() => status?.payrollRunId && handleReopen(status.payrollRunId, companyId)}
                                            disabled={reopening === companyId}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#555] rounded-lg text-sm transition-colors disabled:opacity-50"
                                        >
                                            <Unlock size={14} />
                                            마감 해제
                                        </button>
                                    ) : !isAlreadyCalculating ? (
                                        <button
                                            onClick={() => status && setConfirmModal({ companyId, status, excludeUnconfirmed: false })}
                                            disabled={closing === companyId || !status}
                                            className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold transition-colors disabled:opacity-50`}
                                        >
                                            <Lock size={14} />
                                            마감하기
                                        </button>
                                    ) : (
                                        <span className="text-xs text-[#999]">처리 중</span>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            {status && (
                                <div className="p-5">
                                    {/* Progress */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between text-xs text-[#666] mb-1.5">
                                            <span>근태 확정 현황</span>
                                            <span className="font-semibold text-[#1A1A1A]">
                                                {status.confirmedCount}/{status.totalEmployees}명 ({confirmedPct}%)
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-[width] duration-600"
                                                style={{
                                                    width: `${confirmedPct}%`,
                                                    background: confirmedPct === 100 ? '#059669' : 'linear-gradient(90deg, #00C853, #00BFA5)',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* KPI row */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-[#FAFAFA] rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <CheckCircle2 size={13} className="text-[#059669]" />
                                                <p className="text-xs text-[#666]">확정</p>
                                            </div>
                                            <p className="text-xl font-bold text-[#1A1A1A]">{status.confirmedCount}명</p>
                                        </div>
                                        <div className="bg-[#FAFAFA] rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Clock size={13} className="text-[#F59E0B]" />
                                                <p className="text-xs text-[#666]">총근무</p>
                                            </div>
                                            <p className="text-xl font-bold text-[#1A1A1A]">{status.totalWorkHours}h</p>
                                        </div>
                                        <div className="bg-[#FAFAFA] rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <AlertTriangle size={13} className="text-[#EF4444]" />
                                                <p className="text-xs text-[#666]">미확정</p>
                                            </div>
                                            <p className="text-xl font-bold text-[#1A1A1A]">{status.unconfirmedCount}명</p>
                                        </div>
                                    </div>

                                    {/* Unconfirmed employees expandable */}
                                    {status.unconfirmedEmployees.length > 0 && (
                                        <div className="border border-[#FEF3C7] rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setExpandedEmp((prev) => ({ ...prev, [companyId]: !prev[companyId] }))}
                                                className="flex items-center justify-between w-full px-4 py-2.5 bg-[#FFFBEB] hover:bg-[#FEF3C7] transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={14} className="text-[#F59E0B]" />
                                                    <span className="text-sm font-semibold text-[#B45309]">
                                                        미확정 직원 {status.unconfirmedEmployees.length}명
                                                    </span>
                                                </div>
                                                {expandedEmp[companyId] ? (
                                                    <ChevronDown size={14} className="text-[#B45309]" />
                                                ) : (
                                                    <ChevronRight size={14} className="text-[#B45309]" />
                                                )}
                                            </button>
                                            {expandedEmp[companyId] && (
                                                <div className="divide-y divide-[#FDE68A]">
                                                    {status.unconfirmedEmployees.map((emp) => (
                                                        <div key={emp.id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                                                            <div className="w-7 h-7 rounded-full bg-[#E8E8E8] flex items-center justify-center flex-shrink-0">
                                                                <Users size={12} className="text-[#999]" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-[#333]">{emp.name}</p>
                                                                <p className="text-xs text-[#999]">{emp.email}</p>
                                                            </div>
                                                            <XCircle size={14} className="text-[#EF4444] ml-auto" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Closed at info */}
                                    {isClosed && status.attendanceClosedAt && (
                                        <div className="mt-3 flex items-center gap-2 text-xs text-[#059669]">
                                            <Lock size={12} />
                                            <span>
                                                {new Date(status.attendanceClosedAt).toLocaleString('ko-KR')} 마감 완료
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!status && (
                                <div className="p-5 flex items-center justify-center text-[#999] text-sm">
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
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
                            <h2 className="text-lg font-bold text-[#1A1A1A]">근태 마감 확인</h2>
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="p-1 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                            >
                                <XCircle size={20} className="text-[#999]" />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <div className="bg-[#F5F5F5] rounded-xl p-4 mb-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">대상 법인</span>
                                    <span className="font-semibold text-[#1A1A1A]">
                                        {COMPANY_LIST.find((c) => c.id === confirmModal.companyId)?.name ?? confirmModal.companyId}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">대상 월</span>
                                    <span className="font-semibold">{yearMonth}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">전체 직원</span>
                                    <span className="font-semibold">{confirmModal.status.totalEmployees}명</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">확정 직원</span>
                                    <span className="font-semibold text-[#059669]">{confirmModal.status.confirmedCount}명</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">미확정 직원</span>
                                    <span className="font-semibold text-[#EF4444]">{confirmModal.status.unconfirmedCount}명</span>
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
                                        className="w-4 h-4 rounded border-[#D4D4D4] text-[#00C853]"
                                    />
                                    <span className="text-sm text-[#333]">
                                        미확정 직원 {confirmModal.status.unconfirmedCount}명 제외하고 마감
                                    </span>
                                </label>
                            )}
                            <p className="text-xs text-[#999] mb-5">
                                마감 후에는 해당 월의 근태 수정이 불가합니다. 마감 해제는 계산 시작 전까지만 가능합니다.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E8E8E8]">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="px-4 py-2 border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#333] rounded-lg text-sm font-medium transition-colors"
                            >
                                취소
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
                                {closing === confirmModal.companyId ? '마감 처리 중...' : '마감하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
