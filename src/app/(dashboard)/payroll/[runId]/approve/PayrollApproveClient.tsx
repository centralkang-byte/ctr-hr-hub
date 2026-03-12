'use client'

// ═══════════════════════════════════════════════════════════
// GP#3-C: 급여 결재 페이지 — /payroll/[runId]/approve
// 결재선 진행 현황 + 승인/반려 액션
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, CheckCircle2, XCircle, Clock, CheckCheck,
    Users, DollarSign, AlertTriangle, ChevronRight,
    Loader2, X,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { MODAL_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────

interface RunInfo {
    id: string
    name: string
    yearMonth: string
    status: string
    headcount: number | null
    totalNet: string | number | null
    totalGross: string | number | null
    adjustmentCount: number | null
    allAnomaliesResolved: boolean | null
    notes: string | null
}

interface ApprovalChainStep {
    stepNumber: number
    roleRequired: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approverName: string | null
    approverDept: string | null
    comment: string | null
    decidedAt: string | null
}

interface ApprovalStatus {
    run: { id: string; status: string; yearMonth: string }
    approval: {
        id: string
        currentStep: number
        totalSteps: number
        status: string
        requestedBy: string
        requestedAt: string
        completedAt: string | null
    } | null
    chain: ApprovalChainStep[]
}

const STEP_STATUS_CONFIG = {
    APPROVED: { icon: <CheckCircle2 className="h-5 w-5 text-[#059669]" />, bg: 'bg-[#D1FAE5]', label: '승인' },
    REJECTED: { icon: <XCircle className="h-5 w-5 text-[#DC2626]" />, bg: 'bg-[#FEE2E2]', label: '반려' },
    PENDING: { icon: <Clock className="h-5 w-5 text-[#F59E0B]" />, bg: 'bg-[#FEF3C7]', label: '대기' },
}

const fmt = (n: number | string | null | undefined) => {
    if (n == null) return '—'
    return Number(n).toLocaleString('ko-KR') + '원'
}

const fmtDate = (d: string | null | undefined) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Approval Progress Bar ───────────────────────────────

function ApprovalProgressBar({ chain, currentStep }: { chain: ApprovalChainStep[]; currentStep: number }) {
    return (
        <div className={CARD_STYLES.padded}>
            <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-4">결재 진행 현황</p>
            <div className="flex items-center gap-0">
                {chain.map((step, idx) => {
                    const cfg = STEP_STATUS_CONFIG[step.status]
                    const isActive = step.status === 'PENDING' && step.stepNumber === currentStep
                    return (
                        <div key={step.stepNumber} className="flex items-center flex-1 min-w-0">
                            <div className="flex flex-col items-center flex-1 min-w-0">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.bg} ${isActive ? 'ring-2 ring-offset-1 ring-[#F59E0B]' : ''}`}>
                                    {cfg.icon}
                                </div>
                                <p className="mt-1.5 text-[11px] font-medium text-[#333] text-center truncate max-w-20">
                                    {step.approverName ?? step.roleRequired}
                                </p>
                                <p className="text-[10px] text-[#999] text-center">{cfg.label}</p>
                                {step.decidedAt && (
                                    <p className="text-[10px] text-[#999]">{fmtDate(step.decidedAt)}</p>
                                )}
                            </div>
                            {idx < chain.length - 1 && (
                                <ChevronRight className="h-4 w-4 text-[#D4D4D4] flex-shrink-0 mx-1" />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────

interface Props {
    user: SessionUser
    runId: string
}

export default function PayrollApproveClient({ user: _user, runId }: Props) {
    const router = useRouter()
    const [run, setRun] = useState<RunInfo | null>(null)
    const [approval, setApproval] = useState<ApprovalStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [showReject, setShowReject] = useState(false)
    const [rejectComment, setRejectComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [comment, setComment] = useState('')

    const fetchData = useCallback(async () => {
        try {
            const [runRes, approvalRes] = await Promise.all([
                apiClient.get<RunInfo>(`/api/v1/payroll/runs/${runId}`),
                apiClient.get<ApprovalStatus>(`/api/v1/payroll/${runId}/approval-status`),
            ])
            setRun(runRes.data)
            setApproval(approvalRes.data)
        } catch { /* silent */ } finally {
            setLoading(false)
        }
    }, [runId])

    useEffect(() => { void fetchData() }, [fetchData])

    const handleApprove = async () => {
        setSubmitting(true)
        try {
            await apiClient.post(`/api/v1/payroll/${runId}/approve`, { comment })
            await fetchData()
            // Check if fully approved
            const newApproval = await apiClient.get<ApprovalStatus>(`/api/v1/payroll/${runId}/approval-status`)
            if (newApproval.data.approval?.status === 'APPROVED') {
                router.push('/payroll')
            }
        } catch { /* silent */ } finally {
            setSubmitting(false)
        }
    }

    const handleReject = async () => {
        if (!rejectComment.trim()) return
        setSubmitting(true)
        try {
            await apiClient.post(`/api/v1/payroll/${runId}/reject`, { comment: rejectComment })
            router.push('/approvals/inbox')
        } catch { /* silent */ } finally {
            setSubmitting(false)
            setShowReject(false)
        }
    }

    if (loading || !run || !approval) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#5E81F4]" />
            </div>
        )
    }

    const chain = approval.chain
    const currentStep = approval.approval?.currentStep ?? 1
    const isComplete = approval.approval?.status === 'APPROVED'
    const isRejected = approval.approval?.status === 'REJECTED'
    const isPending = run.status === 'PENDING_APPROVAL'

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/approvals/inbox')} className="text-[#999] hover:text-[#333]">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-[-0.02em]">급여 결재</h1>
                    <p className="text-sm text-[#666] mt-0.5">{run.name} · {run.yearMonth}</p>
                </div>
                <div className="ml-auto">
                    {isComplete && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#D1FAE5] text-[#047857] text-sm font-semibold">
                            <CheckCheck className="h-4 w-4" /> 승인 완료
                        </span>
                    )}
                    {isRejected && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-sm font-semibold">
                            <XCircle className="h-4 w-4" /> 반려됨
                        </span>
                    )}
                    {isPending && !isComplete && !isRejected && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-sm font-semibold">
                            <Clock className="h-4 w-4" /> 결재 대기
                        </span>
                    )}
                </div>
            </div>

            {/* Approval Progress */}
            <ApprovalProgressBar chain={chain} currentStep={currentStep} />

            {/* Run Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: '대상 인원', value: `${run.headcount ?? 0}명`, icon: <Users className="h-4 w-4 text-[#4338CA]" /> },
                    { label: '총 실수령액', value: fmt(Number(run.totalNet ?? 0)), icon: <DollarSign className="h-4 w-4 text-[#059669]" /> },
                    { label: '이상 항목', value: run.allAnomaliesResolved ? '없음 ✅' : '있음 ⚠️', icon: <AlertTriangle className="h-4 w-4 text-[#F59E0B]" /> },
                    { label: '수동 조정', value: `${run.adjustmentCount ?? 0}건`, icon: <CheckCircle2 className="h-4 w-4 text-[#999]" /> },
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

            {/* HR Notes */}
            {run.notes && (
                <div className="bg-[#FAFAFA] rounded-xl border border-[#E8E8E8] p-4">
                    <p className="text-xs font-semibold text-[#999] mb-1">HR 메모</p>
                    <p className="text-sm text-[#555]">{run.notes}</p>
                </div>
            )}

            {/* Step History */}
            {chain.filter((s) => s.status !== 'PENDING').length > 0 && (
                <div className={CARD_STYLES.padded}>
                    <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-3">결재 이력</p>
                    <div className="space-y-3">
                        {chain.filter((s) => s.status !== 'PENDING').map((step) => (
                            <div key={step.stepNumber} className="flex items-start gap-3">
                                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${STEP_STATUS_CONFIG[step.status].bg}`}>
                                    {step.status === 'APPROVED' ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                                    ) : (
                                        <XCircle className="h-3.5 w-3.5 text-[#DC2626]" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-[#1A1A1A]">{step.approverName ?? step.roleRequired}</p>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${step.status === 'APPROVED' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEE2E2] text-[#B91C1C]'}`}>
                                            {STEP_STATUS_CONFIG[step.status].label}
                                        </span>
                                        <span className="text-xs text-[#999]">{fmtDate(step.decidedAt)}</span>
                                    </div>
                                    {step.comment && (
                                        <p className="text-sm text-[#666] mt-0.5">"{step.comment}"</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Area (pending only) */}
            {isPending && !isComplete && !isRejected && (
                <div className={`${CARD_STYLES.kpi} space-y-4`}>
                    <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">내 결재 의견</p>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="결재 의견을 입력하세요 (선택)"
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#5E81F4] focus:ring-2 focus:ring-[#5E81F4]/10 resize-none"
                    />
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleApprove}
                            disabled={submitting}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold text-sm disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            승인
                        </button>
                        <button
                            onClick={() => setShowReject(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#DC2626] text-[#DC2626] font-semibold text-sm hover:bg-[#FEF2F2]"
                        >
                            <XCircle className="h-4 w-4" />
                            반려
                        </button>
                    </div>
                </div>
            )}

            {/* View details link */}
            <div className="text-center">
                <button
                    onClick={() => router.push(`/payroll/${runId}/review`)}
                    className="text-sm text-[#5E81F4] hover:underline"
                >
                    상세 검토 내용 보기 →
                </button>
            </div>

            {/* Reject Modal */}
            {showReject && (
                <div className={MODAL_STYLES.container}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="p-5 border-b border-[#E8E8E8] flex items-center justify-between">
                            <h3 className="font-bold text-lg text-[#1A1A1A]">반려 사유 입력</h3>
                            <button onClick={() => setShowReject(false)} className="text-[#999] hover:text-[#333]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-[#666]">반려 시 급여 담당자에게 사유가 전달됩니다. 자세히 입력해 주세요.</p>
                            <textarea
                                value={rejectComment}
                                onChange={(e) => setRejectComment(e.target.value)}
                                placeholder="반려 사유를 구체적으로 입력해 주세요. (필수)"
                                rows={4}
                                className="w-full px-3 py-2.5 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 resize-none"
                            />
                        </div>
                        <div className="p-5 border-t border-[#E8E8E8] flex justify-end gap-2">
                            <button
                                onClick={() => setShowReject(false)}
                                className="px-4 py-2 rounded-lg border border-[#D4D4D4] text-sm text-[#555] hover:bg-[#F5F5F5]"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectComment.trim() || submitting}
                                className="px-5 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold disabled:opacity-50"
                            >
                                {submitting ? '처리중...' : '반려 확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
