'use client'

// ═══════════════════════════════════════════════════════════
// GP#3-C: 급여 결재 페이지 — /payroll/[runId]/approve
// 결재선 진행 현황 + 승인/반려 액션
// Wave 1: 프로토 .wd-stepper 정합 + 패턴 B 상태 칩 + D17 시맨틱 토큰
// ═══════════════════════════════════════════════════════════

import { Fragment, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
    ArrowLeft, Check, CheckCheck, CheckCircle2, ChevronRight, Clock,
    Loader2, X, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { WdStatusChips } from '@/components/shared/WdStatusChips'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { CARD_STYLES, TYPOGRAPHY } from '@/lib/styles'
import type { SessionUser } from '@/types'

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
    run: RunInfo
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

// ─── Constants ──────────────────────────────────────────

// D17 분리: bg는 soft 틴트, 아이콘/텍스트는 AA ink (rules/design.md)
const STEP_STATUS_CONFIG = {
    APPROVED: { labelKey: 'approvePage.approved', iconWrap: 'bg-tertiary/10', iconText: 'text-[#006b39]' },
    REJECTED: { labelKey: 'approvePage.rejected', iconWrap: 'bg-destructive/10', iconText: 'text-destructive' },
    PENDING: { labelKey: 'approvePage.pending', iconWrap: 'bg-warning-bright/15', iconText: 'text-ctr-warning' },
} as const

// ─── Helpers ────────────────────────────────────────────

function formatDecidedAt(d: string | null | undefined, locale: string): string {
    if (!d) return '—'
    return new Date(d).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Approval Stepper (proto .wd-stepper-track, styles.css:2646-2705) ───

function ApprovalStepper({ chain, currentStep }: { chain: ApprovalChainStep[]; currentStep: number }) {
    const t = useTranslations('payroll')
    const locale = useLocale()
    return (
        <div className={CARD_STYLES.padded}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">{t('approvePage.progressTitle')}</p>
            <div className="flex items-start" role="list" aria-label={t('approvePage.progressTitle')}>
                {chain.map((step, idx) => {
                    const isDone = step.status === 'APPROVED'
                    const isRejectedStep = step.status === 'REJECTED'
                    const isCurrent = step.status === 'PENDING' && step.stepNumber === currentStep
                    return (
                        <Fragment key={step.stepNumber}>
                            {idx > 0 && (
                                // 커넥터 2px — 직전 단계 완료 시 success (proto .connector.done)
                                <div
                                    className={cn(
                                        'mt-[22px] h-0.5 flex-1',
                                        chain[idx - 1].status === 'APPROVED' ? 'bg-tertiary' : 'bg-border',
                                    )}
                                    aria-hidden="true"
                                />
                            )}
                            <div role="listitem" className="flex flex-1 min-w-0 flex-col items-center gap-2 px-1">
                                {/* 44px dot — done=solid success, current=solid navy+soft 헤일로, future=sunk+2px border */}
                                <div
                                    className={cn(
                                        'grid h-11 w-11 shrink-0 place-items-center rounded-full font-mono text-[15px] font-bold tabular-nums',
                                        isDone && 'bg-tertiary text-white',
                                        isRejectedStep && 'bg-destructive text-white',
                                        isCurrent && 'bg-primary text-white shadow-[0_0_0_6px_hsl(var(--accent))]',
                                        !isDone && !isRejectedStep && !isCurrent && 'border-2 border-border bg-muted text-muted-foreground',
                                    )}
                                >
                                    {isDone ? (
                                        <Check className="h-5 w-5" aria-hidden="true" />
                                    ) : isRejectedStep ? (
                                        <X className="h-5 w-5" aria-hidden="true" />
                                    ) : (
                                        step.stepNumber
                                    )}
                                </div>
                                <p
                                    className={cn(
                                        'w-full truncate text-center text-[12.5px] font-semibold',
                                        isDone || isCurrent || isRejectedStep ? 'text-foreground' : 'text-muted-foreground',
                                    )}
                                >
                                    {step.approverName ?? step.roleRequired}
                                </p>
                                <span className="sr-only">{t(STEP_STATUS_CONFIG[step.status].labelKey)}</span>
                                {step.decidedAt && (
                                    <p className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                                        {formatDecidedAt(step.decidedAt, locale)}
                                    </p>
                                )}
                            </div>
                        </Fragment>
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
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { confirm, dialogProps } = useConfirmDialog()

  const fmt = (n: number | string | null | undefined) => {
      if (n == null) return '—'
      return t('fmt.amountWon', { n: Number(n).toLocaleString() })
  }
  const fmtDate = (d: string | null | undefined) => formatDecidedAt(d, locale)

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
            // approval-status가 run 요약 + 결재 현황을 함께 반환 → EXECUTIVE가 payroll:view 없이 로드.
            const approvalRes = await apiClient.get<ApprovalStatus>(`/api/v1/payroll/${runId}/approval-status`)
            setRun(approvalRes.data.run)
            setApproval(approvalRes.data)
        } catch (err) {
            toast({ title: t('approvePage.loadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [runId, t])

    useEffect(() => { void fetchData() }, [fetchData])

    const doApprove = async () => {
        setSubmitting(true)
        try {
            await apiClient.post(`/api/v1/payroll/${runId}/approve`, { comment })
            await fetchData()
            // Check if fully approved
            const newApproval = await apiClient.get<ApprovalStatus>(`/api/v1/payroll/${runId}/approval-status`)
            if (newApproval.data.approval?.status === 'APPROVED') {
                // 승인 완료 후 결재함으로 복귀 — reject·뒤로가기와 일관.
                // /payroll(급여 목록)은 ceo 단계 승인자(EXECUTIVE)가 payroll:view 없어
                // 미들웨어가 /home으로 튕기므로 부적합 (S270 dogfood 발견).
                router.push('/my/tasks?tab=approvals')
            }
        } catch (err) {
            toast({ title: t('approvePage.approveFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setSubmitting(false)
        }
    }

    const handleApprove = () => {
        confirm({
            title: t('approvePage.confirmTitle'),
            description: t('approvePage.confirmDesc'),
            confirmLabel: t('approvePage.confirmLabel'),
            variant: 'default',
            onConfirm: doApprove,
        })
    }

    const handleReject = async () => {
        if (!rejectComment.trim()) return
        setSubmitting(true)
        try {
            await apiClient.post(`/api/v1/payroll/${runId}/reject`, { comment: rejectComment })
            router.push('/my/tasks?tab=approvals')
        } catch (err) {
            toast({ title: t('approvePage.rejectFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setSubmitting(false)
            setShowReject(false)
        }
    }

    if (loading || !run || !approval) {
        // 페이지 골격 스켈레톤 (rules/components.md 3-상태)
        return (
            <div className="p-4 max-w-3xl mx-auto space-y-4">
                <Skeleton className="h-8 w-44" />
                <div className="flex gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className={cn(CARD_STYLES.padded, 'space-y-5')}>
                    <Skeleton className="h-4 w-28" />
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-11 w-11 rounded-full" />
                        <Skeleton className="h-0.5 flex-1" />
                        <Skeleton className="h-11 w-11 rounded-full" />
                    </div>
                </div>
                <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
        )
    }

    const chain = approval.chain
    const currentStep = approval.approval?.currentStep ?? 1
    const isComplete = approval.approval?.status === 'APPROVED'
    const isRejected = approval.approval?.status === 'REJECTED'
    const isPending = run.status === 'PENDING_APPROVAL'

    return (
        <div className="p-4 max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.push('/my/tasks?tab=approvals')}
                    aria-label={tCommon('back')}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <div>
                    <h1 className={TYPOGRAPHY.pageTitle}>{t('approvePage.title')}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{run.name} · {run.yearMonth}</p>
                </div>
                <div className="ml-auto">
                    {isComplete && (
                        <StatusBadge status="APPROVED">
                            <CheckCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                            {t('approvePage.statusApproved')}
                        </StatusBadge>
                    )}
                    {isRejected && (
                        <StatusBadge status="REJECTED">
                            <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
                            {t('approvePage.statusRejected')}
                        </StatusBadge>
                    )}
                    {isPending && !isComplete && !isRejected && (
                        <StatusBadge status="PENDING_APPROVAL">
                            <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                            {t('approvePage.statusPending')}
                        </StatusBadge>
                    )}
                </div>
            </div>

            {/* Run Summary — 패턴 B 상태 칩 (Codex G1 #2: 3실수치 + 이상해결 상태) */}
            <WdStatusChips
                aria-label={t('approvePage.runSummaryAria')}
                items={[
                    { label: t('approvePage.headcount'), value: t('approvePage.countPeople', { count: run.headcount ?? 0 }) },
                    { label: t('netPay'), value: fmt(Number(run.totalNet ?? 0)) },
                    { label: t('adjustments'), value: t('approvePage.countCases', { count: run.adjustmentCount ?? 0 }), muted: (run.adjustmentCount ?? 0) === 0 },
                    run.allAnomaliesResolved
                        ? { label: t('approvePage.anomaliesResolved'), tone: 'success' }
                        : { label: t('approvePage.anomaliesUnresolved'), tone: 'warn' },
                ]}
            />

            {/* Approval Progress */}
            <ApprovalStepper chain={chain} currentStep={currentStep} />

            {/* HR Notes */}
            {run.notes && (
                <div className={CARD_STYLES.padded}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{t('approvePage.hrNotes')}</p>
                    <p className="text-sm text-muted-foreground">{run.notes}</p>
                </div>
            )}

            {/* Step History */}
            {chain.filter((s) => s.status !== 'PENDING').length > 0 && (
                <div className={CARD_STYLES.padded}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('approvePage.historyTitle')}</p>
                    <div className="space-y-3">
                        {chain.filter((s) => s.status !== 'PENDING').map((step) => (
                            <div key={step.stepNumber} className="flex items-start gap-3">
                                <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full', STEP_STATUS_CONFIG[step.status].iconWrap)}>
                                    {step.status === 'APPROVED' ? (
                                        <CheckCircle2 className={cn('h-3.5 w-3.5', STEP_STATUS_CONFIG[step.status].iconText)} aria-hidden="true" />
                                    ) : (
                                        <XCircle className={cn('h-3.5 w-3.5', STEP_STATUS_CONFIG[step.status].iconText)} aria-hidden="true" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-foreground">{step.approverName ?? step.roleRequired}</p>
                                        <StatusBadge status={step.status}>
                                            {t(STEP_STATUS_CONFIG[step.status].labelKey)}
                                        </StatusBadge>
                                        <span className="text-xs text-muted-foreground">{fmtDate(step.decidedAt)}</span>
                                    </div>
                                    {step.comment && (
                                        <p className="text-sm text-muted-foreground mt-0.5">&quot;{step.comment}&quot;</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Area (pending only) */}
            {isPending && !isComplete && !isRejected && (
                <div className={cn(CARD_STYLES.padded, 'space-y-4')}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('approvePage.myDecisionTitle')}</p>
                    <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={tCommon('placeholderApprovalComment')}
                        rows={3}
                        className="resize-none"
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={handleApprove} disabled={submitting} className="flex-1">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {t('approvePage.approveButton')}
                        </Button>
                        {/* 프로토 .btn-danger = ghost형 (danger 텍스트 + soft hover, fill/red 보더 아님) */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowReject(true)}
                            className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                        >
                            <XCircle className="h-4 w-4" />
                            {t('reject')}
                        </Button>
                    </div>
                </div>
            )}

            {/* View details link */}
            <div className="text-center">
                <button
                    type="button"
                    onClick={() => router.push(`/payroll/${runId}/review`)}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                    {t('approvePage.viewDetails')}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>

            {/* Reject Dialog — confirm류는 중앙 Dialog 유지 (DESIGN.md §5.4) */}
            <Dialog open={showReject} onOpenChange={(open) => { if (!open && !submitting) setShowReject(false) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('approvePage.rejectTitle')}</DialogTitle>
                        <DialogDescription>{t('approvePage.rejectDesc')}</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        placeholder={tCommon('placeholderRejectReasonRequiredAlt')}
                        rows={4}
                        className="resize-none focus-visible:border-destructive focus-visible:ring-destructive/20"
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowReject(false)} disabled={submitting}>
                            {t('cancel')}
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleReject} disabled={!rejectComment.trim() || submitting}>
                            {submitting ? t('approvePage.processing') : t('approvePage.rejectConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog {...dialogProps} />
        </div>
    )
}
