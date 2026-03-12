'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// GP#3-C: HR 급여 발행 대시보드 — /payroll/[runId]/publish
// 발행 현황 + 열람률 + 다운로드 + 승인 이력 + 재알림
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, CheckCircle2, Eye, EyeOff, Download,
    Bell, FileSpreadsheet, FileText, CreditCard,
    Users, DollarSign, Loader2, ChevronDown,
    Clock, XCircle,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────

interface PublishStatus {
    run: {
        id: string
        yearMonth: string
        status: string
        headcount: number | null
        totalNet: string | number | null
        totalGross: string | number | null
        totalDeductions: string | number | null
        approvedAt: string | null
        paidAt: string | null
        adjustmentCount: number | null
    }
    payslipStats: {
        total: number
        viewed: number
        unviewed: number
        viewRate: number
    }
    transferBatches: Array<{
        id: string
        status: string
        totalAmount: string | number
        totalCount: number
        generatedAt: string | null
        createdAt: string
        note: string | null
    }>
    approvalHistory: Array<{
        stepNumber: number
        roleRequired: string
        approverName: string | null
        status: string
        comment: string | null
        decidedAt: string | null
    }>
}

const fmt = (n: number | string | null | undefined) => {
    if (n == null) return '—'
    return Number(n).toLocaleString('ko-KR') + '원'
}

const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Progress Bar ────────────────────────────────────────

function ViewProgressBar({ viewed, total }: { viewed: number; total: number }) {
    const pct = total > 0 ? Math.round((viewed / total) * 100) : 0
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-[#666]">열람률</span>
                <span className="text-sm font-bold text-[#1A1A1A]">{pct}%</span>
            </div>
            <div className="h-3 w-full bg-[#F0F0F3] rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#5E81F4] to-[#A855F7]"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-xs text-[#999]">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> 열람 {viewed}명</span>
                <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> 미열람 {total - viewed}명</span>
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────

interface Props {
    user: SessionUser
    runId: string
}

export default function PayrollPublishDashboardClient({user: _user, runId }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')

    const router = useRouter()
    const [data, setData] = useState<PublishStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [notifying, setNotifying] = useState(false)
    const [notifyResult, setNotifyResult] = useState<string | null>(null)
    const [showDownloads, setShowDownloads] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const res = await apiClient.get<PublishStatus>(`/api/v1/payroll/${runId}/publish-status`)
            setData(res.data)
        } catch { /* silent */ } finally {
            setLoading(false)
        }
    }, [runId])

    useEffect(() => { void fetchData() }, [fetchData])

    const handleNotifyUnread = async () => {
        setNotifying(true)
        setNotifyResult(null)
        try {
            const res = await apiClient.post<{ notifiedCount: number; message: string }>(
                `/api/v1/payroll/${runId}/notify-unread`,
                {},
            )
            setNotifyResult(res.data.message)
            await fetchData()
        } catch { /* silent */ } finally {
            setNotifying(false)
        }
    }

    const triggerDownload = (url: string) => {
        const a = document.createElement('a')
        a.href = url
        a.click()
    }

    if (loading || !data) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#5E81F4]" />
            </div>
        )
    }

    const { run, payslipStats, transferBatches, approvalHistory } = data
    const isApproved = ['APPROVED', 'PAID'].includes(run.status)

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/payroll')} className="text-[#999] hover:text-[#333]">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-[-0.02em]">발행 현황</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-[#666]">{run.yearMonth}</span>
                        {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]">
                                <CheckCircle2 className="h-3 w-3" /> 발행 완료
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: '총 인원', value: `${run.headcount ?? 0}명`, icon: <Users className="h-4 w-4 text-[#4338CA]" /> },
                    { label: '총 실수령액', value: fmt(Number(run.totalNet ?? 0)), icon: <DollarSign className="h-4 w-4 text-[#059669]" /> },
                    { label: '명세서 발행', value: `${payslipStats.total}건`, icon: <FileText className="h-4 w-4 text-[#5E81F4]" /> },
                    { label: '열람완료', value: `${payslipStats.viewed}명 (${payslipStats.viewRate}%)`, icon: <Eye className="h-4 w-4 text-[#A855F7]" /> },
                ].map((kpi) => (
                    <div key={kpi.label} className={CARD_STYLES.padded}>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-[#666]">{kpi.label}</p>
                            {kpi.icon}
                        </div>
                        <p className="text-sm font-bold text-[#1A1A1A] leading-tight">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Payslip View Rate */}
            <div className={`${CARD_STYLES.kpi} space-y-4`}>
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-[#1A1A1A]">급여명세서 열람 현황</h2>
                    <button
                        onClick={handleNotifyUnread}
                        disabled={notifying || payslipStats.unviewed === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4D4D4] text-sm text-[#555] hover:bg-[#F5F5F5] disabled:opacity-40"
                    >
                        {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                        미열람자 재알림 ({payslipStats.unviewed}명)
                    </button>
                </div>
                <ViewProgressBar viewed={payslipStats.viewed} total={payslipStats.total} />
                {notifyResult && (
                    <p className="text-xs text-[#059669] bg-[#D1FAE5] rounded-lg px-3 py-2">{notifyResult}</p>
                )}
            </div>

            {/* Downloads */}
            <div className={CARD_STYLES.padded}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-[#1A1A1A]">파일 다운로드</h2>
                    <button
                        onClick={() => setShowDownloads(!showDownloads)}
                        className="text-[#999] hover:text-[#333]"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${showDownloads ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            label: '은행 이체파일',
                            sub: 'CSV',
                            icon: <CreditCard className="h-5 w-5 text-[#059669]" />,
                            bg: 'bg-[#D1FAE5]',
                            disabled: !isApproved,
                            url: `/api/v1/payroll/${runId}/export/transfer`,
                        },
                        {
                            label: '급여대장',
                            sub: 'Excel',
                            icon: <FileSpreadsheet className="h-5 w-5 text-[#4338CA]" />,
                            bg: 'bg-[#E0E7FF]',
                            disabled: false,
                            url: `/api/v1/payroll/${runId}/export/ledger`,
                        },
                        {
                            label: '전월 대비 비교',
                            sub: 'Excel',
                            icon: <FileSpreadsheet className="h-5 w-5 text-[#F59E0B]" />,
                            bg: 'bg-[#FEF3C7]',
                            disabled: false,
                            url: `/api/v1/payroll/${runId}/export/comparison`,
                        },
                        {
                            label: '인건비 전표',
                            sub: 'Excel',
                            icon: <FileText className="h-5 w-5 text-[#A855F7]" />,
                            bg: 'bg-[#F3E8FF]',
                            disabled: false,
                            url: `/api/v1/payroll/${runId}/export/journal`,
                        },
                    ].map((item) => (
                        <button
                            key={item.label}
                            onClick={() => !item.disabled && triggerDownload(item.url)}
                            disabled={item.disabled}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-[#E8E8E8] transition-colors ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#FAFAFA] cursor-pointer'}`}
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.bg}`}>
                                {item.icon}
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold text-[#1A1A1A]">{item.label}</p>
                                <p className="text-[10px] text-[#999]">{item.sub}</p>
                            </div>
                            <Download className="h-3.5 w-3.5 text-[#999]" />
                        </button>
                    ))}
                </div>

                {/* Transfer batch history */}
                {transferBatches.length > 0 && showDownloads && (
                    <div className="mt-4 border-t border-[#E8E8E8] pt-4">
                        <p className="text-xs font-semibold text-[#999] mb-2">이체 파일 생성 이력</p>
                        <div className="space-y-1">
                            {transferBatches.map((b) => (
                                <div key={b.id} className="flex items-center justify-between text-xs text-[#666]">
                                    <span>{fmtDate(b.createdAt)}</span>
                                    <span>{b.totalCount}명 / {fmt(Number(b.totalAmount))}</span>
                                    <span className="text-[#999]">{b.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Approval History */}
            {approvalHistory.length > 0 && (
                <div className={CARD_STYLES.padded}>
                    <h2 className="font-semibold text-[#1A1A1A] mb-4">승인 이력</h2>
                    <div className="space-y-3">
                        {approvalHistory.map((step) => (
                            <div key={step.stepNumber} className="flex items-start gap-3">
                                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${step.status === 'APPROVED' ? 'bg-[#D1FAE5]' : 'bg-[#FEE2E2]'}`}>
                                    {step.status === 'APPROVED'
                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                                        : <XCircle className="h-3.5 w-3.5 text-[#DC2626]" />
                                    }
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-[#1A1A1A]">{step.approverName ?? step.roleRequired}</p>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${step.status === 'APPROVED' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEE2E2] text-[#B91C1C]'}`}>
                                            {step.status === 'APPROVED' ? '승인' : '반려'}
                                        </span>
                                        <span className="text-xs text-[#999] flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {fmtDate(step.decidedAt)}
                                        </span>
                                    </div>
                                    {step.comment && (
                                        <p className="text-sm text-[#666] mt-0.5 italic">"{step.comment}"</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
